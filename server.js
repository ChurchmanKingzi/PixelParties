const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');
const bcrypt = require('bcryptjs');
// const multer = require('multer'); // Replaced by base64 uploads
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { GameEngine } = require('./cards/effects/_engine');
const { loadCardEffect } = require('./cards/effects/_loader');

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
const PROFILE_SECRET = process.env.PROFILE_SECRET || 'pxlParties_s3cret_k3y_2025!';
const profileImportUsed = new Set();

// ===== CARD DATABASE CACHE =====
// Module-level card DB cache — loaded once, used everywhere.
// Replaces per-request JSON.parse(fs.readFileSync(...)) calls.
let _cachedCardDB = null;    // { cardName: cardData }
let _cachedCardArray = null;  // [cardData, ...]
function getCardDB() {
  if (!_cachedCardDB) {
    _cachedCardArray = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    _cachedCardDB = {};
    _cachedCardArray.forEach(c => { _cachedCardDB[c.name] = c; });
  }
  return _cachedCardDB;
}
function getCardArray() {
  if (!_cachedCardArray) getCardDB();
  return _cachedCardArray;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/cards', express.static(path.join(__dirname, 'cards')));

// Database initialization (async — called at startup)
async function initDatabase() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    elo INTEGER DEFAULT 1000,
    color TEXT DEFAULT '#00f0ff',
    avatar TEXT DEFAULT NULL,
    cardback TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    main_deck TEXT DEFAULT '[]',
    heroes TEXT DEFAULT '[{"hero":null,"ability1":null,"ability2":null},{"hero":null,"ability1":null,"ability2":null},{"hero":null,"ability1":null,"ability2":null}]',
    potion_deck TEXT DEFAULT '[]',
    side_deck TEXT DEFAULT '[]',
    is_default INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id)');

  // Safe column migrations
  try { await db.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN wins INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN losses INTEGER DEFAULT 0'); } catch {}
  try { await db.execute("ALTER TABLE decks ADD COLUMN cover_card TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE decks ADD COLUMN skins TEXT DEFAULT '{}'"); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN sc INTEGER DEFAULT 0'); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN board TEXT DEFAULT NULL"); } catch {}

  await db.execute(`CREATE TABLE IF NOT EXISTS hero_stats (
    user_id TEXT NOT NULL,
    hero_name TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, hero_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    hero1 TEXT,
    hero2 TEXT,
    hero3 TEXT,
    won INTEGER NOT NULL,
    opponent_id TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_hero_stats_user ON hero_stats(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id)');

  // Cardback storage table (replaces filesystem storage)
  await db.execute(`CREATE TABLE IF NOT EXISTS user_cardbacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // SC reward log table
  await db.execute(`CREATE TABLE IF NOT EXISTS sc_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    opponent_id TEXT,
    opponent_ip TEXT,
    amount INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sc_log_user ON sc_log(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sc_log_user_date ON sc_log(user_id, created_at)');

  // Shop purchases table
  await db.execute(`CREATE TABLE IF NOT EXISTS user_shop_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    purchased_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, item_type, item_id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_shop_items_user ON user_shop_items(user_id)');

  console.log('[DB] Tables initialized');
}

// ===== AUTH MIDDLEWARE =====

/** Pick a random standard avatar from public/avatars/, or null if none available. */
function getRandomDefaultAvatar() {
  try {
    const dir = path.join(__dirname, 'public', 'avatars');
    const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
    const files = fs.readdirSync(dir).filter(f => exts.has(path.extname(f).toLowerCase()));
    if (files.length === 0) return null;
    return '/avatars/' + encodeURIComponent(files[Math.floor(Math.random() * files.length)]);
  } catch { return null; }
}
// Simple token-based auth using cookies
const sessions = new Map(); // token -> { userId, username }

function authMiddleware(req, res, next) {
  const token = req.cookies?.pp_token || req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = sessions.get(token);
  req.authToken = token;
  next();
}

// ===== AUTH ROUTES =====
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be 3+ characters' });
  if (password.length < 3) return res.status(400).json({ error: 'Password must be 3+ characters' });

  const existing = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username.trim()]);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const defaultAvatar = getRandomDefaultAvatar();
  await db.run('INSERT INTO users (id, username, password_hash, avatar) VALUES (?, ?, ?, ?)', [id, username.trim(), hash, defaultAvatar]);

  // Create default deck
  await db.run('INSERT INTO decks (id, user_id, name) VALUES (?, ?, ?)', [uuidv4(), id, 'My First Deck']);

  const token = uuidv4();
  sessions.set(token, { userId: id, username: username.trim() });
  res.cookie('pp_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username.trim()]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = uuidv4();
  sessions.set(token, { userId: user.id, username: user.username });
  res.cookie('pp_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  // Assign a random default avatar if the user doesn't have one
  if (!user.avatar) {
    const defaultAvatar = getRandomDefaultAvatar();
    if (defaultAvatar) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [defaultAvatar, user.id]);
      user.avatar = defaultAvatar;
    }
  }
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.pp_token;
  if (token) sessions.delete(token);
  res.clearCookie('pp_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Assign a random default avatar if the user doesn't have one
  if (!user.avatar) {
    const defaultAvatar = getRandomDefaultAvatar();
    if (defaultAvatar) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [defaultAvatar, user.id]);
      user.avatar = defaultAvatar;
    }
  }
  res.json({ user: sanitizeUser(user), token: req.authToken });
});

function sanitizeUser(u) {
  return { id: u.id, username: u.username, elo: u.elo, color: u.color, avatar: u.avatar, cardback: u.cardback, board: u.board || null, bio: u.bio || '', wins: u.wins || 0, losses: u.losses || 0, sc: u.sc || 0, created_at: u.created_at };
}

// ===== PROFILE ROUTES =====
app.put('/api/profile', authMiddleware, async (req, res) => {
  const { color, avatar, cardback, bio, board } = req.body;
  if (board !== undefined) {
    await db.run('UPDATE users SET color = ?, avatar = ?, cardback = ?, bio = ?, board = ? WHERE id = ?', [color || '#00f0ff', avatar || null, cardback || null, (bio || '').slice(0, 200), board || null, req.user.userId]);
  } else {
    await db.run('UPDATE users SET color = ?, avatar = ?, cardback = ?, bio = ? WHERE id = ?', [color || '#00f0ff', avatar || null, cardback || null, (bio || '').slice(0, 200), req.user.userId]);
  }
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ user: sanitizeUser(user) });
});

// Avatar upload — accepts base64 data URL in JSON body
app.post('/api/profile/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar || !avatar.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  // Limit ~2MB base64
  if (avatar.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 2MB)' });
  await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.userId]);
  res.json({ avatar });
});

// Cardback upload — accepts base64 data URL, stores in DB
app.post('/api/profile/cardback', authMiddleware, async (req, res) => {
  const { cardback } = req.body;
  if (!cardback || !cardback.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  if (cardback.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 2MB)' });
  const id = uuidv4();
  const filename = req.user.userId + '_' + Date.now() + '.png';
  await db.run('INSERT INTO user_cardbacks (id, user_id, filename, data) VALUES (?, ?, ?, ?)', [id, req.user.userId, filename, cardback]);
  res.json({ cardback });
});

// List all cardbacks uploaded by this user (from DB)
app.get('/api/profile/cardbacks', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT data FROM user_cardbacks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  res.json({ cardbacks: rows.map(r => r.data) });
});

// ===== PROFILE EXPORT / IMPORT =====
function encryptProfile(data) {
  const key = crypto.scryptSync(PROFILE_SECRET, 'pixelparties', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  enc += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag, data: enc });
}

function decryptProfile(blob) {
  try {
    const { v, iv, tag, data } = JSON.parse(blob);
    if (v !== 1) throw new Error('Unknown format version');
    const key = crypto.scryptSync(PROFILE_SECRET, 'pixelparties', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let dec = decipher.update(data, 'base64', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch (e) {
    return null;
  }
}

app.get('/api/profile/export', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Gather decks
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ?', [req.user.userId]);

  // Gather hero stats
  const heroStats = await db.all('SELECT * FROM hero_stats WHERE user_id = ?', [req.user.userId]);

  // Gather game history
  const gameHistory = await db.all('SELECT * FROM game_history WHERE user_id = ?', [req.user.userId]);

  // Avatar is stored as data URL in DB — just include it directly
  const avatarData = user.avatar || null;

  // Read cardback data from DB
  const cardbackRows = await db.all('SELECT filename, data FROM user_cardbacks WHERE user_id = ?', [req.user.userId]);
  const cardbackFiles = cardbackRows.map(r => ({ name: r.filename, data: r.data }));

  const payload = {
    username: user.username,
    elo: user.elo,
    color: user.color,
    bio: user.bio || '',
    wins: user.wins || 0,
    losses: user.losses || 0,
    cardback: user.cardback,
    avatar: avatarData,
    cardbacks: cardbackFiles,
    decks: decks.map(d => ({ name: d.name, main_deck: d.main_deck, heroes: d.heroes, potion_deck: d.potion_deck, side_deck: d.side_deck, is_default: d.is_default })),
    heroStats,
    gameHistory: gameHistory.map(g => ({ hero1: g.hero1, hero2: g.hero2, hero3: g.hero3, won: g.won, opponent_id: g.opponent_id, created_at: g.created_at })),
    exportedAt: Date.now(),
  };

  const encrypted = encryptProfile(payload);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${user.username}_profile.ppb"`);
  res.send(encrypted);
});

app.post('/api/profile/import', authMiddleware, express.text({ limit: '20mb' }), async (req, res) => {
  if (profileImportUsed.has(req.user.userId)) {
    return res.status(403).json({ error: 'You cannot import your profile again until the next update!' });
  }

  const data = decryptProfile(req.body);
  if (!data) return res.status(400).json({ error: 'Invalid or corrupted backup file.' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Username must match (case-insensitive)
  if (data.username.toLowerCase() !== user.username.toLowerCase()) {
    return res.status(403).json({ error: `This backup belongs to "${data.username}", but you are "${user.username}". You can only import your own profile.` });
  }

  // Restore user fields
  await db.run('UPDATE users SET elo = ?, color = ?, bio = ?, wins = ?, losses = ?, cardback = ? WHERE id = ?',
    [data.elo || 1000, data.color || '#00f0ff', (data.bio || '').slice(0, 200), data.wins || 0, data.losses || 0, data.cardback || null, req.user.userId]);

  // Restore avatar (may be data URL or old-format base64 object)
  if (data.avatar) {
    let avatarUrl = data.avatar;
    if (typeof data.avatar === 'object' && data.avatar.data) {
      // Legacy format: convert base64 to data URL
      const ext = (data.avatar.ext || '.png').replace('.', '');
      avatarUrl = 'data:image/' + ext + ';base64,' + data.avatar.data;
    }
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.userId]);
  }

  // Restore cardbacks to DB
  if (data.cardbacks && data.cardbacks.length) {
    await db.run('DELETE FROM user_cardbacks WHERE user_id = ?', [req.user.userId]);
    for (const cb of data.cardbacks) {
      const cbData = typeof cb.data === 'string' && cb.data.startsWith('data:') ? cb.data : 'data:image/png;base64,' + cb.data;
      await db.run('INSERT INTO user_cardbacks (id, user_id, filename, data) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, cb.name || 'cardback.png', cbData]);
    }
  }

  // Restore decks — delete existing, insert from backup
  await db.run('DELETE FROM decks WHERE user_id = ?', [req.user.userId]);
  for (const d of (data.decks || [])) {
    await db.run('INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user.userId, d.name, d.main_deck, d.heroes, d.potion_deck, d.side_deck, d.is_default ? 1 : 0, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)]);
  }

  // Restore hero stats
  await db.run('DELETE FROM hero_stats WHERE user_id = ?', [req.user.userId]);
  for (const hs of (data.heroStats || [])) {
    await db.run('INSERT OR REPLACE INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?)',
      [req.user.userId, hs.hero_name, hs.wins || 0, hs.losses || 0]);
  }

  // Restore game history
  await db.run('DELETE FROM game_history WHERE user_id = ?', [req.user.userId]);
  for (const g of (data.gameHistory || [])) {
    await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user.userId, g.hero1, g.hero2, g.hero3, g.won, g.opponent_id, g.created_at]);
  }

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  profileImportUsed.add(req.user.userId);
  res.json({ success: true, user: sanitizeUser(updated) });
});

// ===== CHANGE PASSWORD =====
app.post('/api/profile/password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both old and new password required' });
  if (newPassword.length < 3) return res.status(400).json({ error: 'New password must be 3+ characters' });
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ success: true });
});

// ===== PROFILE DECK STATS =====
app.get('/api/profile/deck-stats', authMiddleware, async (req, res) => {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  let legalCount = 0;
  const deckWall = decks.map(d => {
    const main = JSON.parse(d.main_deck || '[]');
    const heroes = JSON.parse(d.heroes || '[]').filter(h => h && h.hero);
    const potions = JSON.parse(d.potion_deck || '[]');
    const pc = potions.length;
    const mainOk = main.length === 60;
    const heroOk = heroes.length === 3;
    const potionOk = pc === 0 || (pc >= 5 && pc <= 15);
    const legal = mainOk && heroOk && potionOk;
    if (legal) legalCount++;
    // Use cover card if set, otherwise pick a random card
    const allCards = [...main, ...heroes.map(h => h.hero), ...potions];
    const repCard = d.cover_card || (allCards.length > 0 ? allCards[Math.floor(Math.random() * allCards.length)] : null);
    let deckSkins = {};
    try { deckSkins = JSON.parse(d.skins || '{}'); } catch {}
    const repSkin = repCard && deckSkins[repCard] ? deckSkins[repCard] : null;
    return { id: d.id, name: d.name, legal, isDefault: !!d.is_default, repCard, repSkin, cardCount: main.length };
  });
  res.json({ total: decks.length, legal: legalCount, decks: deckWall });
});

// ===== GAME RESULT RECORDING =====
// Called when a game ends — records win/loss for the player and their 3 heroes
app.post('/api/game/result', authMiddleware, async (req, res) => {
  const { won, heroes, opponentId } = req.body;
  if (typeof won !== 'boolean') return res.status(400).json({ error: 'won must be boolean' });
  if (!Array.isArray(heroes) || heroes.length !== 3) return res.status(400).json({ error: 'heroes must be array of 3 names' });

  const userId = req.user.userId;

  // Update user wins/losses
  if (won) {
    await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [userId]);
  } else {
    await db.run('UPDATE users SET losses = losses + 1 WHERE id = ?', [userId]);
  }

  // Update hero stats (aggregate)
  for (const heroName of heroes) {
    if (heroName) {
      await db.run('INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', [userId, heroName, won ? 1 : 0, won ? 0 : 1]);
    }
  }

  // Record in game history
  await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), userId, heroes[0] || null, heroes[1] || null, heroes[2] || null, won ? 1 : 0, opponentId || null]);

  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  res.json({ success: true, user: sanitizeUser(user) });
});

// ===== HERO STATS =====
app.get('/api/profile/hero-stats', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT hero_name, wins, losses FROM hero_stats WHERE user_id = ? ORDER BY (CAST(wins AS REAL) / MAX(wins + losses, 1)) DESC, (wins + losses) DESC', [req.user.userId]);
  // Return top 3 by win rate (already sorted by the query)
  const top = rows.slice(0, 3).map(r => ({
    name: r.hero_name,
    wins: r.wins,
    losses: r.losses,
    games: r.wins + r.losses,
    winRate: r.wins + r.losses > 0 ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0
  }));
  res.json({ heroes: top });
});

// ===== AVAILABLE CARDS (based on ./cards folder) =====
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// Build reverse lookup: filename-safe name (no punctuation) → actual card name
const nameByStripped = {};
getCardArray().forEach(c => { nameByStripped[c.name.replace(/[^a-zA-Z0-9 ]/g, '')] = c.name; });

app.get('/api/cards/available', async (req, res) => {
  const cardsDir = path.join(__dirname, 'cards');
  try {
    const files = fs.readdirSync(cardsDir);
    // Map: actual card name (with commas) → filename for image URLs
    const available = {};
    files
      .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
      .forEach(f => {
        const stem = path.basename(f, path.extname(f));
        const stripped = stem.replace(/[^a-zA-Z0-9 ]/g, '');
        const realName = nameByStripped[stripped] || stem;
        available[realName] = f;
      });
    res.json({ available });
  } catch {
    res.json({ available: {} });
  }
});

// ===== DECK ROUTES =====
app.get('/api/decks', authMiddleware, async (req, res) => {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  res.json({ decks: decks.map(parseDeck) });
});

app.post('/api/decks', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  await db.run('INSERT INTO decks (id, user_id, name) VALUES (?, ?, ?)', [id, req.user.userId, name || 'New Deck']);
  const deck = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  res.json({ deck: parseDeck(deck) });
});

app.put('/api/decks/:id', authMiddleware, async (req, res) => {
  const { name, mainDeck, heroes, potionDeck, sideDeck, isDefault, coverCard, skins } = req.body;
  const deckRow = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!deckRow) return res.status(404).json({ error: 'Deck not found' });

  if (isDefault) await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);

  await db.run('UPDATE decks SET name=?, main_deck=?, heroes=?, potion_deck=?, side_deck=?, is_default=?, cover_card=?, skins=?, updated_at=unixepoch() WHERE id=? AND user_id=?', [
    name || deckRow.name,
    JSON.stringify(mainDeck || JSON.parse(deckRow.main_deck)),
    JSON.stringify(heroes || JSON.parse(deckRow.heroes)),
    JSON.stringify(potionDeck || JSON.parse(deckRow.potion_deck)),
    JSON.stringify(sideDeck || JSON.parse(deckRow.side_deck)),
    isDefault ? 1 : (isDefault === false ? 0 : deckRow.is_default),
    coverCard !== undefined ? (coverCard || '') : (deckRow.cover_card || ''),
    skins !== undefined ? JSON.stringify(skins) : (deckRow.skins || '{}'),
    req.params.id, req.user.userId
  ]);

  const updated = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ deck: parseDeck(updated) });
});

app.post('/api/decks/:id/set-default', authMiddleware, async (req, res) => {
  const deck = await db.get('SELECT id FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);
  await db.run('UPDATE decks SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

app.post('/api/decks/:id/saveas', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const original = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!original) return res.status(404).json({ error: 'Deck not found' });

    const newId = uuidv4();
    await db.run(
      'INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, cover_card, skins, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, unixepoch(), unixepoch())',
      [newId, req.user.userId, name || original.name + ' (Copy)',
       original.main_deck, original.heroes, original.potion_deck, original.side_deck,
       original.cover_card || '', original.skins || '{}']
    );

    const newDeck = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [newId, req.user.userId]);
    if (!newDeck) return res.status(500).json({ error: 'Failed to create deck copy' });
    res.json({ deck: parseDeck(newDeck) });
  } catch (err) {
    console.error('[SaveAs] Error:', err.message);
    res.status(500).json({ error: 'Failed to save deck copy' });
  }
});

app.delete('/api/decks/:id', authMiddleware, async (req, res) => {
  await db.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

// ===== SAMPLE DECKS =====
function loadSampleDecks() {
  const dir = path.join(__dirname, 'data', 'SampleDecks');
  if (!fs.existsSync(dir)) return [];

  const cardsByName = getCardDB();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
  const decks = [];

  for (let fi = 0; fi < files.length; fi++) {
    try {
      const text = fs.readFileSync(path.join(dir, files[fi]), 'utf-8');
      const lines = text.split(/\r?\n/);
      if (!lines[0] || !lines[0].includes('PIXEL PARTIES DECK')) continue;

      let deckName = files[fi].replace('.txt', '');
      let section = null;
      const heroNames = [];
      const mainCards = [];
      const potionCards = [];
      const sideCards = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('Name:')) { deckName = line.slice(5).trim(); continue; }
        if (line.startsWith('===')) continue;
        if (line === '== HEROES ==') { section = 'heroes'; continue; }
        if (line === '== MAIN DECK ==') { section = 'main'; continue; }
        if (line === '== POTION DECK ==') { section = 'potion'; continue; }
        if (line === '== SIDE DECK ==') { section = 'side'; continue; }

        if (section === 'heroes') {
          heroNames.push(line === '(empty)' ? null : line);
        } else if (section) {
          const m = line.match(/^(\d+)x\s+(.+)$/);
          if (!m) continue;
          const count = parseInt(m[1], 10);
          const name = m[2].trim();
          const arr = section === 'main' ? mainCards : section === 'potion' ? potionCards : sideCards;
          for (let j = 0; j < count; j++) arr.push(name);
        }
      }

      const heroes = [0, 1, 2].map(i => {
        const name = heroNames[i] || null;
        if (!name) return { hero: null, ability1: null, ability2: null };
        const card = cardsByName[name];
        return { hero: name, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
      });

      decks.push({
        id: 'sample-' + fi,
        name: deckName,
        heroes,
        mainDeck: mainCards,
        potionDeck: potionCards,
        sideDeck: sideCards,
        isDefault: false,
        isSample: true,
      });
    } catch (err) { console.error('[SampleDecks] Error reading', files[fi], err.message); }
  }
  return decks;
}

app.get('/api/sample-decks', (req, res) => {
  res.json({ decks: loadSampleDecks() });
});

// ===== SKINS =====
let SKINS_DATA = {};
try { SKINS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'skins.json'), 'utf-8')); } catch {}
app.get('/api/skins', (req, res) => res.json({ skins: SKINS_DATA }));

// ===== SHOP SYSTEM =====
const SHOP_PRICES = { avatar: 10, sleeve: 10, board: 10, skin: 10 };
const RANDOM_PRICES = { skin: 5, avatar: 5, sleeve: 5 };

// Scan a shop directory and return available items
function scanShopDir(subdir) {
  const dir = path.join(__dirname, 'data', 'shop', subdir);
  try {
    return fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  } catch { return []; }
}

// Scan skins directory
function scanSkinFiles() {
  const dir = path.join(__dirname, 'cards', 'skins');
  try {
    return fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  } catch { return []; }
}

// Build flat list of all skin IDs from skins.json that have images on disk
function getAvailableSkins() {
  const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
  // Only include skins for heroes whose card images exist in ./cards
  const cardsDir = path.join(__dirname, 'cards');
  let heroFiles = [];
  try { heroFiles = fs.readdirSync(cardsDir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())); } catch {}
  const heroSet = new Set(heroFiles.map(f => {
    const stem = path.basename(f, path.extname(f));
    return nameByStripped[stem] || stem;
  }));
  const result = [];
  for (const [heroName, skinNames] of Object.entries(SKINS_DATA)) {
    if (!heroSet.has(heroName)) continue;
    for (const skinName of skinNames) {
      if (skinFiles.has(skinName)) {
        result.push({ heroName, skinName });
      }
    }
  }
  return result;
}

// GET /api/shop/catalog — all available shop items
app.get('/api/shop/catalog', (req, res) => {
  const avatars = scanShopDir('avatars').map(f => ({ id: path.basename(f, path.extname(f)), file: f }));
  const sleeves = scanShopDir('sleeves').map(f => ({ id: path.basename(f, path.extname(f)), file: f }));
  const boards = scanShopDir('boards').filter(f => /^board\d+\./i.test(f)).map(f => ({ id: path.basename(f, path.extname(f)), file: f }));

  // Skins: only for heroes whose cards exist in ./cards
  const cardsDir = path.join(__dirname, 'cards');
  let heroFiles = [];
  try { heroFiles = fs.readdirSync(cardsDir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())); } catch {}
  const heroSet = new Set(heroFiles.map(f => {
    const stem = path.basename(f, path.extname(f));
    return nameByStripped[stem] || stem;
  }));

  const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
  const skins = [];
  for (const [heroName, skinNames] of Object.entries(SKINS_DATA)) {
    if (!heroSet.has(heroName)) continue;
    for (const skinName of skinNames) {
      if (skinFiles.has(skinName)) {
        skins.push({ id: skinName, heroName, skinName });
      }
    }
  }

  res.json({
    avatars, sleeves, boards, skins,
    prices: SHOP_PRICES,
    randomPrices: RANDOM_PRICES
  });
});

// GET /api/shop/owned — user's purchased items
app.get('/api/shop/owned', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT item_type, item_id FROM user_shop_items WHERE user_id = ?', [req.user.userId]);
  const owned = { avatar: [], sleeve: [], board: [], skin: [] };
  for (const r of rows) {
    if (owned[r.item_type]) owned[r.item_type].push(r.item_id);
  }
  res.json({ owned });
});

// POST /api/shop/buy — buy a specific item
app.post('/api/shop/buy', authMiddleware, async (req, res) => {
  const { itemType, itemId } = req.body;
  if (!itemType || !itemId) return res.status(400).json({ error: 'Missing itemType or itemId' });
  const price = SHOP_PRICES[itemType];
  if (price === undefined) return res.status(400).json({ error: 'Invalid item type' });

  // Verify item exists
  if (itemType === 'skin') {
    const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
    if (!skinFiles.has(itemId)) return res.status(404).json({ error: 'Skin not found' });
  } else {
    const subdir = itemType === 'avatar' ? 'avatars' : itemType === 'sleeve' ? 'sleeves' : 'boards';
    const files = scanShopDir(subdir).map(f => path.basename(f, path.extname(f)));
    if (!files.includes(itemId)) return res.status(404).json({ error: 'Item not found' });
  }

  // Check already owned
  const existing = await db.get('SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = ? AND item_id = ?', [req.user.userId, itemType, itemId]);
  if (existing) return res.status(409).json({ error: 'Already owned' });

  // Check SC balance
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < price) return res.status(400).json({ error: 'Not enough SC' });

  // Deduct and add
  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [price, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, itemType, itemId]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc });
});

// POST /api/shop/buy-random-skin — buy a random unowned skin
app.post('/api/shop/buy-random-skin', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < RANDOM_PRICES.skin) return res.status(400).json({ error: 'Not enough SC' });

  const allSkins = getAvailableSkins();
  const ownedRows = await db.all("SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'skin'", [req.user.userId]);
  const ownedSet = new Set(ownedRows.map(r => r.item_id));

  const unowned = allSkins.filter(s => !ownedSet.has(s.skinName));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all available skins!' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [RANDOM_PRICES.skin, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, 'skin', pick.skinName]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, skinName: pick.skinName, heroName: pick.heroName });
});

// POST /api/shop/buy-random — buy a random unowned item of a given type (avatar or sleeve)
app.post('/api/shop/buy-random', authMiddleware, async (req, res) => {
  const { itemType } = req.body;
  if (!itemType || !RANDOM_PRICES[itemType]) return res.status(400).json({ error: 'Invalid item type for random buy' });
  if (itemType === 'skin') return res.status(400).json({ error: 'Use /api/shop/buy-random-skin for skins' });

  const price = RANDOM_PRICES[itemType];
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < price) return res.status(400).json({ error: 'Not enough SC' });

  const subdir = itemType === 'avatar' ? 'avatars' : 'sleeves';
  const allItems = scanShopDir(subdir).map(f => path.basename(f, path.extname(f)));
  const ownedRows = await db.all('SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = ?', [req.user.userId, itemType]);
  const ownedSet = new Set(ownedRows.map(r => r.item_id));

  const unowned = allItems.filter(id => !ownedSet.has(id));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all available ' + subdir + '!' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [price, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, itemType, pick]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, itemId: pick, itemType });
});

// Standard avatars (free defaults in public/avatars/)
app.get('/api/profile/standard-avatars', (req, res) => {
  const dir = path.join(__dirname, 'public', 'avatars');
  try {
    const files = fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    res.json({ avatars: files });
  } catch { res.json({ avatars: [] }); }
});

// Standard sleeves (shop items in data/shop/sleeves/)
app.get('/api/profile/standard-sleeves', (req, res) => {
  const files = scanShopDir('sleeves');
  res.json({ sleeves: files });
});

function parseDeck(row) {
  let skins = {};
  try { skins = JSON.parse(row.skins || '{}'); } catch {}
  return {
    id: row.id,
    name: row.name,
    mainDeck: JSON.parse(row.main_deck),
    heroes: JSON.parse(row.heroes),
    potionDeck: JSON.parse(row.potion_deck),
    sideDeck: JSON.parse(row.side_deck),
    isDefault: !!row.is_default,
    coverCard: row.cover_card || '',
    skins,
  };
}

// ===== SMUG COINS (SC) SYSTEM =====
const SC_REWARDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sc-rewards.json'), 'utf-8'));
const SC_DAILY_CAP_PER_OPPONENT = 15;
const SC_MIN_GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const SC_MIN_TURNS = 4; // at least turn 4 (each player took 2 turns)
const SC_MIN_CARDS_PLAYED = 3; // each player must play at least 3 cards

function getSocketIP(socket) {
  return socket?.handshake?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || socket?.handshake?.address
    || 'unknown';
}

async function evaluateSCRewards(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs) return {};
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const tracking = gs._scTracking || [{}, {}];
  const startTime = gs._gameStartTime || Date.now();
  const gameDuration = Date.now() - startTime;
  const turn = gs.turn || 0;
  const isRanked = room.type === 'ranked';

  // ── Safeguard checks ──
  // Same IP → no SC for anyone
  const ip0 = gs._playerIPs?.[0] || 'unknown';
  const ip1 = gs._playerIPs?.[1] || 'unknown';
  if (ip0 !== 'unknown' && ip0 === ip1) return {};

  // Min game duration
  if (gameDuration < SC_MIN_GAME_DURATION_MS) return {};

  // Min turns
  if (turn < SC_MIN_TURNS) return {};

  // Min cards played from hand
  if ((tracking[0].cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return {};
  if ((tracking[1].cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return {};

  // Surrender before any hero takes damage → no SC
  if (reason === 'surrender') {
    const anyDamage = gs.players.some(ps =>
      (ps.heroes || []).some(h => h.name && h.hp < h.maxHp)
    );
    if (!anyDamage) return {};
  }

  // Disconnect wins only get "Player" reward
  const isDisconnectWin = reason === 'disconnect_timeout';

  const todayStart = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);
  const results = {}; // { [playerIdx]: { rewards: [{id,title,amount}], total: N } }

  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    const opp = gs.players[pi === 0 ? 1 : 0];
    const isWinner = pi === winnerIdx;
    const oppIp = pi === 0 ? ip1 : ip0;
    const t = tracking[pi] || {};
    const earned = [];

    for (const reward of SC_REWARDS) {
      // Disconnect winners only get "player" reward
      if (isDisconnectWin && reward.id !== 'player') continue;

      // Check if this reward's condition is met
      let met = false;
      switch (reward.requires) {
        case 'play':
          met = true; // Playing a game
          break;
        case 'win':
          met = isWinner;
          break;
        case 'win_ranked':
          met = isWinner && isRanked;
          break;
        case 'win_all_heroes_alive':
          if (isWinner && (ps.heroes || []).filter(h => h.name).every(h => h.hp > 0)) {
            if (reason === 'surrender') {
              // Only eligible on surrender if opponent lost ≥1 hero AND turn ≥5
              const oppHeroes = opp.heroes || [];
              const oppDead = oppHeroes.filter(h => h.name && h.hp <= 0).length;
              met = oppDead >= 1 && turn >= 5;
            } else {
              met = true;
            }
          }
          break;
        case 'win_last_hero_low':
          if (isWinner) {
            const alive = (ps.heroes || []).filter(h => h.name && h.hp > 0);
            met = alive.length === 1 && alive[0].hp < alive[0].maxHp * 0.5;
          }
          break;
        case 'win_deck_out':
          met = isWinner && reason === 'deck_out';
          break;
        case 'win_support_full':
          met = isWinner && t.allSupportFull;
          break;
        case 'damage_instance_400':
          met = (t.maxDamageInstance || 0) >= 400;
          break;
        case 'gold_earned_99':
          met = (t.totalGoldEarned || 0) >= 99;
          break;
        case 'win_comeback':
          met = isWinner && t.wasFirstToOneHero;
          break;
        case 'win_flawless':
          met = isWinner && !t.heroEverBelow50;
          break;
        case 'creature_overkill':
          met = t.creatureOverkill;
          break;
        case 'all_abilities_filled': {
          // Check ALL heroes (alive AND dead) have all 3 ability slots filled
          let filled = true;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue; // Skip empty hero slots
            const abZ = ps.abilityZones?.[hi] || [];
            for (let z = 0; z < 3; z++) {
              if ((abZ[z] || []).length === 0) { filled = false; break; }
            }
            if (!filled) break;
          }
          met = filled && (ps.heroes || []).some(h => h.name);
          break;
        }
        case 'all_abilities_level3': {
          // Check ALL heroes (alive AND dead) have all 3 ability slots at level 3
          let maxed = true;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue;
            const abZ = ps.abilityZones?.[hi] || [];
            for (let z = 0; z < 3; z++) {
              if ((abZ[z] || []).length < 3) { maxed = false; break; }
            }
            if (!maxed) break;
          }
          met = maxed && (ps.heroes || []).some(h => h.name);
          break;
        }
        case 'win_turn_30':
          met = isWinner && turn >= 30;
          break;
        case 'win_speedrun':
          met = isWinner && turn <= 6 && reason !== 'surrender';
          break;
        case 'unique_opponents_5': {
          // Count unique opponent IPs today (including this game)
          const uniqueToday = await db.get(
            `SELECT COUNT(DISTINCT opponent_ip) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND created_at >= ?`,
            [ps.userId, todayStart]
          );
          // +1 for current game if this is a new IP
          const prevPlayed = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND opponent_ip = ? AND created_at >= ?`,
            [ps.userId, oppIp, todayStart]
          );
          const totalUnique = (uniqueToday?.cnt || 0) + (prevPlayed?.cnt === 0 ? 1 : 0);
          met = totalUnique >= 5;
          break;
        }
        case 'first_win':
          if (isWinner) {
            const prevWins = await db.get(
              `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'first_blood'`,
              [ps.userId]
            );
            met = (prevWins?.cnt || 0) === 0;
          }
          break;
        case 'good_game':
          met = turn >= 7
            && gameDuration >= 5 * 60 * 1000
            && (tracking[0].totalHpLost || 0) >= 400
            && (tracking[1].totalHpLost || 0) >= 400;
          break;
        default:
          break;
      }

      if (!met) continue;

      // Check limit
      let allowed = true;
      switch (reward.limit) {
        case 'daily_per_opponent_ip': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND opponent_ip = ? AND created_at >= ?`,
            [ps.userId, reward.id, oppIp, todayStart]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'daily': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND created_at >= ?`,
            [ps.userId, reward.id, todayStart]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'once': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ?`,
            [ps.userId, reward.id]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'unlimited':
          allowed = true;
          break;
      }

      if (!allowed) continue;

      // Check daily cap per opponent
      if (reward.limit !== 'once') {
        const dailyFromOpp = await db.get(
          `SELECT COALESCE(SUM(amount), 0) as total FROM sc_log WHERE user_id = ? AND opponent_ip = ? AND created_at >= ?`,
          [ps.userId, oppIp, todayStart]
        );
        const alreadyEarned = dailyFromOpp?.total || 0;
        if (alreadyEarned >= SC_DAILY_CAP_PER_OPPONENT) continue;
      }

      earned.push({ id: reward.id, title: reward.title, amount: reward.amount, description: reward.description });
    }

    // Record SC earnings
    if (earned.length > 0) {
      let total = 0;
      for (const r of earned) {
        await db.run(
          'INSERT INTO sc_log (id, user_id, reward_id, opponent_id, opponent_ip, amount) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), ps.userId, r.id, opp.userId, oppIp, r.amount]
        );
        total += r.amount;
      }
      await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [total, ps.userId]);
      results[pi] = { rewards: earned, total };
    }
  }

  return results;
}

// ===== GAME ROOMS (Socket.io) =====
const rooms = new Map();
const activeGames = new Map(); // userId -> roomId
const disconnectTimers = new Map(); // userId -> timeout handle

/**
 * After a potion resolves, check if any hero on the player's side
 * has a potionLockAfterN flag and the threshold has been met.
 * Generic replacement for hardcoded hero-name checks.
 */
function checkPotionLock(ps, gs, pi) {
  ps.potionsUsedThisTurn = (ps.potionsUsedThisTurn || 0) + 1;
  // Check own heroes
  for (const hero of (ps.heroes || [])) {
    if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) continue;
    const heroScript = loadCardEffect(hero.name);
    if (heroScript?.potionLockAfterN && ps.potionsUsedThisTurn >= heroScript.potionLockAfterN) {
      ps.potionLocked = true;
      return;
    }
  }
  // Check charmed opponent heroes controlled by this player
  if (gs && pi != null) {
    const oi = pi === 0 ? 1 : 0;
    for (const hero of (gs.players[oi]?.heroes || [])) {
      if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) continue;
      if (hero.charmedBy !== pi) continue;
      const heroScript = loadCardEffect(hero.name);
      if (heroScript?.potionLockAfterN && ps.potionsUsedThisTurn >= heroScript.potionLockAfterN) {
        ps.potionLocked = true;
        return;
      }
    }
  }
}

/**
 * Find the current hand index of a resolving card tracked by nth-occurrence.
 * Returns -1 if the card was removed from hand (self-discarded).
 */
function getResolvingHandIndex(ps) {
  if (!ps._resolvingCard) return -1;
  const { name, nth } = ps._resolvingCard;
  let count = 0;
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (ps.hand[i] === name) {
      count++;
      if (count === nth) return i;
    }
  }
  return -1; // Card was removed from hand during resolution
}

function sendGameState(room, playerIdx, extra) {
  const p = room.players[playerIdx];
  if (!p?.socketId) return;
  const gs = room.gameState;
  if (!gs) return;

  // Terror: force end turn if threshold reached
  if (gs._terrorForceEndTurn != null && !gs._terrorProcessing && room.engine) {
    const phase = gs.currentPhase;
    // Only force during playable phases (Main1, Action, Main2)
    if (phase >= 2 && phase <= 4) {
      gs._terrorProcessing = true;
      const terrorPi = gs._terrorForceEndTurn;
      delete gs._terrorForceEndTurn;
      setTimeout(() => {
        gs._terrorProcessing = false;
        room.engine.runPhase(5).then(() => { // PHASES.END = 5
          for (let i = 0; i < 2; i++) sendGameState(room, i);
          sendSpectatorGameState(room);
        }).catch(err => console.error('[Terror] force end error:', err.message));
      }, 500);
    }
  }
  const state = {
    myIndex: playerIdx, roomId: room.id,
    players: gs.players.map((ps, pi) => ({
      username: ps.username, color: ps.color, avatar: ps.avatar, cardback: ps.cardback || null, board: ps.board || null,
      heroes: ps.heroes, abilityZones: ps.abilityZones,
      surpriseZones: pi === playerIdx ? ps.surpriseZones : ps.surpriseZones.map((sz, hi) => (sz || []).map(cn => {
        // Face-up surprises (activated) are visible to opponent
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === cn);
        if (inst && !inst.faceDown) return cn;
        // Known surprises (re-set) are visible but marked as known
        if (inst && inst.knownToOpponent) return cn;
        return '?';
      })),
      surpriseFaceDown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return null;
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return inst ? inst.faceDown : true;
      }),
      surpriseKnown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return false;
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return !!(inst && inst.faceDown && inst.knownToOpponent);
      }),
      supportZones: pi === playerIdx ? ps.supportZones : ps.supportZones.map((heroSlots, hi) => (heroSlots || []).map((slot, si) => {
        if (!slot || slot.length === 0) return slot;
        const inst = room.engine?.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.faceDown
        );
        if (inst?.faceDown && !inst.knownToOpponent) return ['?']; // Unknown face-down: show cardback
        return slot;
      })),
      islandZoneCount: ps.islandZoneCount || [0,0,0],
      hand: pi === playerIdx ? ps.hand : [], handCount: ps.hand.length,
      mainDeckCards: pi === playerIdx ? ps.mainDeck : [], deckCount: ps.mainDeck.length,
      potionDeckCards: pi === playerIdx ? ps.potionDeck : [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      disconnected: ps.disconnected || false, left: ps.left || false,
      gold: ps.gold || 0,
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false,false,false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      itemLocked: ps.itemLocked || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: ps.potionLocked || false,
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
      handLocked: ps.handLocked || false,
      handLockBlockedCards: (ps.handLocked && pi === playerIdx) ? (() => {
        const blocked = new Set();
        const handCardDB = getCardDB();
        for (const cn of ps.hand) {
          const scr = loadCardEffect(cn);
          if (!scr?.blockedByHandLock) continue;
          // Abilities can still be placed in hand — only block on board
          const cd = handCardDB[cn];
          if (cd?.cardType === 'Ability') continue;
          blocked.add(cn);
        }
        return [...blocked];
      })() : [],
      supportSpellLocked: ps.supportSpellLocked || false,
      comboLockHeroIdx: ps.comboLockHeroIdx ?? null,
      heroesActedThisTurn: ps.heroesActedThisTurn || [],
      permanents: ps.permanents || [],
      oncePerGameUsed: ps._oncePerGameUsed ? [...ps._oncePerGameUsed] : [],
      resolvingCard: ps._resolvingCard || null,
      deckSkins: ps.deckSkins || {},
      poisonDmgPerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
    })),
    areaZones: gs.areaZones, turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: gs.customPlacementCards || [],
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    terrorCount: gs.activePlayer != null ? (gs._terrorTracking?.[gs.activePlayer] || []).length : 0,
    terrorThreshold: room.engine ? (() => {
      let threshold = Infinity;
      for (let sp = 0; sp < 2; sp++) {
        const sps = gs.players[sp]; if (!sps) continue;
        for (let hi = 0; hi < (sps.heroes || []).length; hi++) {
          const h = sps.heroes[hi];
          if (!h?.name || h.hp <= 0 || h.statuses?.negated) continue;
          let tc = 0; for (const z of (sps.abilityZones[hi] || [])) for (const n of (z || [])) if (n === 'Terror') tc++;
          if (tc > 0) { const t = 10 - tc; if (t < threshold) threshold = t; }
        }
      }
      return threshold === Infinity ? null : threshold;
    })() : null,
    bonusActions: gs.players[playerIdx]?.bonusActions || null,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    potionTargeting: gs.potionTargeting || null,
    effectPrompt: gs.effectPrompt || null,
    surprisePending: gs.surprisePending || false,
    heroEffectPending: gs.heroEffectPending || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      const currentTurn = gs.turn || 0;
      for (const inst of room.engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        const key = `${inst.controller}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn && (() => {
          const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
          return !!(script?.creatureEffect);
        })();
        const isFaceDown = !!inst.faceDown;
        if (hasCounters || hasSummoningSickness || isFaceDown) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
        }
      }
      return cc;
    })() : {},
    additionalActions: room.engine ? room.engine.getAdditionalActions(playerIdx) : [],
    inherentActionCards: (() => {
      if (!room.engine) return [];
      const { loadCardEffect } = require('./cards/effects/_loader');
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (!s) continue;
        if (s.inherentAction === true) { names.add(cn); continue; }
        if (typeof s.inherentAction === 'function') {
          for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
            if (ps2.heroes[hi]?.name && ps2.heroes[hi].hp > 0 && s.inherentAction(gs, playerIdx, hi, room.engine)) { names.add(cn); break; }
          }
        }
      }
      return [...names];
    })(),
    // Per-hero eligibility for function-based inherent actions (Muscle Training, etc.)
    // Maps card name → array of hero indices that satisfy the inherent condition.
    // Cards with inherentAction === true (always inherent) are NOT listed here.
    inherentActionHeroes: (() => {
      if (!room.engine) return {};
      const { loadCardEffect } = require('./cards/effects/_loader');
      const ps2 = gs.players[playerIdx];
      const result = {};
      const seen = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const s = loadCardEffect(cn);
        if (!s || typeof s.inherentAction !== 'function') continue;
        const heroes = [];
        for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
          if (ps2.heroes[hi]?.name && ps2.heroes[hi].hp > 0 && s.inherentAction(gs, playerIdx, hi, room.engine)) {
            heroes.push(hi);
          }
        }
        if (heroes.length > 0) result[cn] = heroes;
      }
      return result;
    })(),
    unactivatableArtifacts: room.engine ? room.engine.getUnactivatableArtifacts(playerIdx) : [],
    blockedSpells: room.engine ? room.engine.getBlockedSpells(playerIdx) : [],
    activatableAbilities: room.engine ? room.engine.getActivatableAbilities(playerIdx) : [],
    freeActivatableAbilities: room.engine ? room.engine.getFreeActivatableAbilities(playerIdx) : [],
    activeHeroEffects: room.engine ? room.engine.getActiveHeroEffects(playerIdx) : [],
    activatableCreatures: room.engine ? room.engine.getActivatableCreatures(playerIdx) : [],
    bakhmSurpriseSlots: room.engine ? (() => {
      const result = [];
      const ps2 = gs.players[playerIdx];
      for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
        const hero = ps2.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
        const heroScript = loadCardEffect(hero.name);
        if (!heroScript?.isBakhmHero) continue;
        const freeSlots = [];
        for (let si = 0; si < 3; si++) {
          if (((ps2.supportZones[hi] || [])[si] || []).length === 0) freeSlots.push(si);
        }
        result.push({ heroIdx: hi, freeSlots });
      }
      return result;
    })() : [],
    ushabtiSummonable: room.engine ? (() => {
      if (playerIdx !== gs.activePlayer) return [];
      const currentTurn = gs.turn || 0;
      const ps2 = gs.players[playerIdx];
      const result = [];
      for (const inst of room.engine.cardInstances) {
        if (inst.owner !== playerIdx || inst.zone !== 'surprise' || !inst.ushabtiPlaced) continue;
        if (inst.ushabtiTurn >= currentTurn) continue; // Can't summon same turn
        const hi = inst.heroIdx;
        const hero = ps2?.heroes?.[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
        // Check abilities
        const cardData = getCardDB()[inst.name];
        if (!cardData) continue;
        const level = cardData.level || 0;
        if (level > 0 || cardData.spellSchool1) {
          const abZones = ps2.abilityZones?.[hi] || [];
          let ok = true;
          if (cardData.spellSchool1 && room.engine.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) ok = false;
          if (cardData.spellSchool2 && room.engine.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) ok = false;
          if (!ok) continue;
        }
        // Check free support zone
        let hasFreeSlot = false;
        for (let si = 0; si < 3; si++) {
          if (((ps2.supportZones[hi] || [])[si] || []).length === 0) { hasFreeSlot = true; break; }
        }
        if (!hasFreeSlot) continue;
        // Check custom summon conditions
        const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
        if (script?.canSummon && !script.canSummon({ _engine: room.engine, cardOwner: playerIdx, cardHeroIdx: hi })) continue;
        result.push({ heroIdx: hi, cardName: inst.name });
      }
      return result;
    })() : [],
    roomParticipants: {
      players: gs.players.map(ps => ({ username: ps.username, color: ps.color, avatar: ps.avatar })),
      spectators: (room.spectators || []).map(s => ({ username: s.username, color: s.color || '#888', avatar: s.avatar || null })),
    },
    ...extra,
  };
  io.to(p.socketId).emit('game_state', state);
}

function sendToSpectators(room, event, data) {
  if (!room.spectators) return;
  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit(event, data);
  }
}

function sendSpectatorGameState(room) {
  if (!room.spectators || room.spectators.length === 0) return;
  const gs = room.gameState;
  if (!gs) return;

  // Determine who is choosing first (for awaiting first choice overlay)
  let choosingPlayerName = null;
  if (gs.awaitingFirstChoice && room._pendingRematch) {
    const loserPs = gs.players[room._pendingRematch.loserIdx];
    if (loserPs) choosingPlayerName = loserPs.username;
  }

  const state = {
    isSpectator: true,
    myIndex: 0, // Player 0 at bottom, Player 1 at top (host = bottom)
    roomId: room.id,
    players: gs.players.map((ps, spi) => ({
      username: ps.username, color: ps.color, avatar: ps.avatar, cardback: ps.cardback || null, board: ps.board || null,
      heroes: ps.heroes, abilityZones: ps.abilityZones,
      surpriseZones: ps.surpriseZones.map((sz, hi) => (sz || []).map(cn => {
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === cn);
        if (inst && !inst.faceDown) return cn;
        if (inst && inst.knownToOpponent) return cn;
        return '?';
      })),
      surpriseKnown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return false;
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return !!(inst && inst.faceDown && inst.knownToOpponent);
      }),
      supportZones: ps.supportZones.map((heroSlots, hi) => (heroSlots || []).map((slot, si) => {
        if (!slot || slot.length === 0) return slot;
        const inst = room.engine?.cardInstances.find(c =>
          c.owner === spi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.faceDown
        );
        if (inst?.faceDown && !inst.knownToOpponent) return ['?'];
        return slot;
      })),
      islandZoneCount: ps.islandZoneCount || [0, 0, 0],
      hand: [], handCount: ps.hand.length,
      mainDeckCards: [], deckCount: ps.mainDeck.length,
      potionDeckCards: [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      disconnected: ps.disconnected || false, left: ps.left || false,
      gold: ps.gold || 0,
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false, false, false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      itemLocked: ps.itemLocked || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: ps.potionLocked || false,
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
      handLocked: ps.handLocked || false,
      supportSpellLocked: ps.supportSpellLocked || false,
      permanents: ps.permanents || [],
      oncePerGameUsed: ps._oncePerGameUsed ? [...ps._oncePerGameUsed] : [],
      resolvingCard: ps._resolvingCard || null,
      deckSkins: ps.deckSkins || {},
      poisonDmgPerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
    })),
    areaZones: gs.areaZones, turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: (gs.players[playerIdx]?.hand || []).filter(cn => { const s = loadCardEffect(cn); return s?.customPlacement; }),
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    choosingPlayerName,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    potionTargeting: gs.potionTargeting ? {
      potionName: gs.potionTargeting.potionName,
      ownerIdx: gs.potionTargeting.ownerIdx,
      cardType: gs.potionTargeting.cardType,
      config: gs.potionTargeting.config,
      validTargets: gs.potionTargeting.validTargets,
    } : null,
    effectPrompt: gs.effectPrompt || null,
    surprisePending: gs.surprisePending || false,
    heroEffectPending: gs.heroEffectPending || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      const currentTurn = gs.turn || 0;
      for (const inst of room.engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        const key = `${inst.controller}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn && (() => {
          const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
          return !!(script?.creatureEffect);
        })();
        const isFaceDown = !!inst.faceDown;
        if (hasCounters || hasSummoningSickness || isFaceDown) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
        }
      }
      return cc;
    })() : {},
    additionalActions: [],
    inherentActionCards: [],
    unactivatableArtifacts: [],
    blockedSpells: [],
    activatableAbilities: [],
    freeActivatableAbilities: [],
    activeHeroEffects: [],
    activatableCreatures: [],
    roomParticipants: {
      players: gs.players.map(ps => ({ username: ps.username, color: ps.color, avatar: ps.avatar })),
      spectators: (room.spectators || []).map(s => ({ username: s.username, color: s.color || '#888', avatar: s.avatar || null })),
    },
  };

  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit('game_state', state);
  }
}

async function endGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const isRanked = room.type === 'ranked';
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];

  // Update set score
  room.setScore[winnerIdx]++;
  const setOver = room.setScore[winnerIdx] >= room.winsNeeded;

  // Elo only changes when the full set is decided
  let eloChanges = null;
  if (setOver && isRanked) {
    const wUser = await db.get('SELECT * FROM users WHERE id = ?', [winner.userId]);
    const lUser = await db.get('SELECT * FROM users WHERE id = ?', [loser.userId]);
    const wElo = wUser?.elo || 1000; const lElo = lUser?.elo || 1000;
    const K = 32;
    const expectedW = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
    const newWElo = Math.round(wElo + K * (1 - expectedW));
    const newLElo = Math.max(0, Math.round(lElo + K * (0 - (1 - expectedW))));
    await db.run('UPDATE users SET elo = ? WHERE id = ?', [newWElo, winner.userId]);
    await db.run('UPDATE users SET elo = ? WHERE id = ?', [newLElo, loser.userId]);
    eloChanges = [{ username: winner.username, oldElo: wElo, newElo: newWElo }, { username: loser.username, oldElo: lElo, newElo: newLElo }];
  }

  // Always track wins/losses and hero stats per round
  await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [winner.userId]);
  await db.run('UPDATE users SET losses = losses + 1 WHERE id = ?', [loser.userId]);
  for (const ps of [winner, loser]) {
    const won = ps === winner;
    for (const h of ps.heroes) {
      if (h.name) await db.run('INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', [ps.userId, h.name, won ? 1 : 0, won ? 0 : 1]);
    }
    await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), ps.userId, ps.heroes[0]?.name||null, ps.heroes[1]?.name||null, ps.heroes[2]?.name||null, won?1:0, (won?loser:winner).userId]);
  }

  gs.result = {
    winnerIdx, reason, winnerName: winner.username, loserName: loser.username, isRanked,
    eloChanges,
    setScore: [...room.setScore], setOver, format: room.format,
  };
  gs.rematchRequests = [];
  if (setOver) room.status = 'finished';
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  io.emit('rooms', getRoomList());

  // ── Emit updated profile stats (wins/losses/elo) to both players ──
  for (let i = 0; i < 2; i++) {
    const userId = gs.players[i]?.userId;
    const sid = gs.players[i]?.socketId;
    if (userId && sid) {
      const updated = await db.get('SELECT wins, losses, elo, sc FROM users WHERE id = ?', [userId]);
      if (updated) io.to(sid).emit('user_stats_updated', updated);
    }
  }

  // ── SC reward evaluation ──
  try {
    const scResults = await evaluateSCRewards(room, winnerIdx, reason);
    for (let pi = 0; pi < 2; pi++) {
      if (scResults[pi] && scResults[pi].total > 0) {
        const sid = gs.players[pi]?.socketId;
        if (sid) io.to(sid).emit('sc_earned', scResults[pi]);
      }
    }
    // Also tell spectators about SC earnings
    if (Object.keys(scResults).length > 0) {
      sendToSpectators(room, 'sc_earned_spectator', scResults);
    }
  } catch (err) {
    console.error('[SC] Error evaluating rewards:', err.message);
  }

  // Auto-advance to next round after 4 seconds (if set not over)
  if (!setOver) {
    // Check if either player has a side deck
    const hasSideDeck = room._currentDecks && room._currentDecks.some(d => d && (d.sideDeck || []).length > 0);
    room._setAdvanceTimer = setTimeout(async () => {
      delete room._setAdvanceTimer;
      room._pendingLoserIdx = loserIdx;

      if (hasSideDeck && room.format > 1) {
        // Enter side-deck phase
        room._sideDeckDone = [false, false];
        room._sideDeckPhase = true;

        // Auto-done players with empty side decks
        for (let i = 0; i < 2; i++) {
          if ((room._currentDecks[i]?.sideDeck || []).length === 0) {
            room._sideDeckDone[i] = true;
          }
        }

        // Send side-deck state to both players
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) {
            io.to(sid).emit('side_deck_phase', {
              currentDeck: room._currentDecks[i],
              originalDeck: room._originalDecks[i],
              opponentDone: room._sideDeckDone[i === 0 ? 1 : 0],
              setScore: [...room.setScore],
              format: room.format,
              autoDone: room._sideDeckDone[i],
            });
          }
        }

        // If both auto-done (both have empty side decks), proceed immediately
        if (room._sideDeckDone[0] && room._sideDeckDone[1]) {
          room._sideDeckPhase = false;
          delete room._sideDeckDone;
          await advanceToNextGame(room, loserIdx);
        }
      } else {
        // No side decks or bo1 — skip to next game
        await advanceToNextGame(room, loserIdx);
      }
    }, 2000);
  }
}

/**
 * Server-side mirror of canCardTypeEnterSection (app-shared.jsx).
 * Checks if a card's TYPE is compatible with a deck pool.
 * Only type rules — no copy limits or deck size checks.
 * IMPORTANT: When adding new card effects that modify deckbuilding rules,
 * update BOTH this function AND canCardTypeEnterSection() in app-shared.jsx.
 */
function canCardTypeEnterPool(cardDB, deck, cardName, pool) {
  const card = cardDB[cardName];
  if (!card) return false;
  const ct = card.cardType;
  if (ct === 'Token') return false;
  if (pool === 'main') {
    if (ct === 'Hero') return false;
    if (ct === 'Potion') {
      return (deck.heroes || []).some(h => h?.hero === 'Nicolas, the Hidden Alchemist');
    }
    return true;
  }
  if (pool === 'potion') return ct === 'Potion';
  if (pool === 'hero') return ct === 'Hero';
  if (pool === 'side') return true;
  return false;
}

async function advanceToNextGame(room, loserIdx) {
  await setupGameState(room);
  // Notify clients that side-deck phase is over
  for (let i = 0; i < 2; i++) {
    const sid = room.gameState.players[i]?.socketId;
    if (sid) io.to(sid).emit('side_deck_complete');
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  const loserPs = room.gameState.players[loserIdx];
  if (loserPs?.socketId) {
    room._pendingRematch = { roomId: room.id, loserIdx };
    io.to(loserPs.socketId).emit('rematch_choose_first', {});
  } else {
    await startGameEngine(room, room.id, loserIdx);
  }
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const p of room.players) {
    activeGames.delete(p.userId);
    const t = disconnectTimers.get(p.userId);
    if (t) { clearTimeout(t); disconnectTimers.delete(p.userId); }
  }
  rooms.delete(roomId);
  io.emit('rooms', getRoomList());
}

/** Set up fresh game state: decks, hands, heroes — but don't start the engine or turns. */
async function setupGameState(room) {
  const cardsByName = getCardDB();
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  const playerStates = [];
  for (let idx = 0; idx < room.players.length; idx++) {
    const p = room.players[idx];
    let deck = null;

    // Use side-decked override if available (subsequent games in a set)
    if (room._currentDecks && room._currentDecks[idx]) {
      deck = room._currentDecks[idx];
    } else {
      // Check if the selected deck is a sample deck
      if (p.deckId && p.deckId.startsWith('sample-')) {
        const samples = loadSampleDecks();
        deck = samples.find(s => s.id === p.deckId) || null;
      }

      if (!deck) {
        let deckRow = p.deckId ? await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [p.deckId, p.userId]) : null;
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? AND is_default = 1', [p.userId]);
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at LIMIT 1', [p.userId]);
        deck = deckRow ? parseDeck(deckRow) : null;
      }

      if (!deck || (!deck.mainDeck.length && !deck.heroes.some(h => h.hero))) {
        const samples = loadSampleDecks();
        if (samples.length > 0) {
          const hash = [...p.userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
          deck = samples[Math.abs(hash) % samples.length];
        }
      }

      // Save original deck state at match start (for side-deck reset)
      if (!room._originalDecks) room._originalDecks = [{}, {}];
      room._originalDecks[idx] = JSON.parse(JSON.stringify({
        mainDeck: deck?.mainDeck || [], heroes: deck?.heroes || [],
        potionDeck: deck?.potionDeck || [], sideDeck: deck?.sideDeck || [],
        skins: deck?.skins || {},
      }));
      if (!room._currentDecks) room._currentDecks = [null, null];
      room._currentDecks[idx] = JSON.parse(JSON.stringify(room._originalDecks[idx]));
    }

    const usr = await db.get('SELECT * FROM users WHERE id = ?', [p.userId]);
    const heroes = (deck?.heroes||[]).map(h => {
      const c = h.hero ? cardsByName[h.hero] : null;
      return { name:h.hero, hp:c?.hp||0, maxHp:c?.hp||0, atk:c?.atk||0, baseAtk:c?.atk||0, ability1:h.ability1||null, ability2:h.ability2||null, statuses:{} };
    });
    const abilityZones = heroes.map(h => {
      const z=[[],[],[]];
      if(h.ability1&&h.ability2&&h.ability1===h.ability2){z[1]=[h.ability1,h.ability2];}
      else if(h.ability1&&!h.ability2){z[1]=[h.ability1];}
      else if(!h.ability1&&h.ability2){z[1]=[h.ability2];}
      else{if(h.ability1)z[0]=[h.ability1];if(h.ability2)z[1]=[h.ability2];}
      return z;
    });
    const mainDeck = shuffle(deck?.mainDeck||[]);
    const potionDeck = shuffle(deck?.potionDeck||[]);
    playerStates.push({ userId:p.userId, username:p.username, socketId:p.socketId,
      color:usr?.color||'#00f0ff', avatar:usr?.avatar||null, cardback:usr?.cardback||null, board:usr?.board||null,
      heroes, abilityZones, surpriseZones:[[],[],[]], supportZones:[[[],[],[]],[[],[],[]],[[],[],[]]],
      hand:[], mainDeck, potionDeck, discardPile:[], deletedPile:[], disconnected:false, left:false, gold:0,
      abilityGivenThisTurn:[false,false,false], islandZoneCount:[0,0,0],
      damageLocked:false, itemLocked:false, dealtDamageToOpponent:false, potionLocked:false, potionsUsedThisTurn:0,
      permanents:[], _oncePerGameUsed: new Set(), _resolvingCard: null, deckSkins: deck?.skins || {} });
  }
  room.gameState = { players:playerStates, areaZones:[[],[]], turn:0, activePlayer:0, currentPhase:0, result:null, rematchRequests:[], awaitingFirstChoice:true,
    _gameStartTime: Date.now(),
    _playerIPs: room.players.map(p => {
      const sock = io.sockets.sockets.get(p.socketId);
      return sock ? getSocketIP(sock) : 'unknown';
    }),
  };
  room.status = 'playing';
  room.players.forEach(p => activeGames.set(p.userId, room.id));
}

async function startGameEngine(room, roomId, activePlayer) {
  room.gameState.activePlayer = activePlayer;
  room.gameState.turn = 1;
  room.gameState.awaitingFirstChoice = false;
  room.engine = new GameEngine(room, io, sendGameState, endGame, sendSpectatorGameState);
  room.engine.init();

  // Fire onBeforeHandDraw hook (Bill, etc.) — before starting hands are drawn
  await room.engine.runHooks('onBeforeHandDraw', {});

  // Draw starting hands (5 cards per player)
  for (let pi = 0; pi < 2; pi++) {
    const ps = room.gameState.players[pi];
    const drawn = ps.mainDeck.splice(0, 5);
    ps.hand.push(...drawn);
  }

  room.gameState.mulliganPending = true;
  room.gameState.mulliganDecisions = [null, null];
  for(let i=0;i<2;i++) sendGameState(room, i); sendSpectatorGameState(room);
  io.to('room:' + room.id).emit('game_started', sanitizeRoom(room));
  io.emit('rooms', getRoomList());
}

io.on('connection', (socket) => {
  let currentUser = null;
  const socketIP = getSocketIP(socket);

  socket.on('auth', (token) => {
    const session = sessions.get(token);
    if (session) {
      currentUser = { ...session, ip: socketIP };
      socket.emit('auth_ok', session);
      // Reconnect to active game
      const activeRoomId = activeGames.get(session.userId);
      if (activeRoomId) {
        const room = rooms.get(activeRoomId);
        if (room?.gameState) {
          const t = disconnectTimers.get(session.userId);
          if (t) { clearTimeout(t); disconnectTimers.delete(session.userId); }
          const pi = room.gameState.players.findIndex(ps => ps.userId === session.userId);
          if (pi >= 0) {
            if (room.players[pi]) room.players[pi].socketId = socket.id;
            room.gameState.players[pi].socketId = socket.id;
            room.gameState.players[pi].disconnected = false;
            socket.join('room:' + activeRoomId);
            sendGameState(room, pi, { reconnected: true });
            // Send chat history on reconnect
            if (room.chatHistory?.length || Object.keys(room.privateChatHistory || {}).length) {
              socket.emit('chat_history', { main: room.chatHistory || [], private: room.privateChatHistory || {} });
            }
            const oi = pi === 0 ? 1 : 0;
            sendGameState(room, oi);
            sendSpectatorGameState(room);
          }
        }
      }
    } else { socket.emit('auth_fail'); }
  });

  socket.on('get_rooms', () => socket.emit('rooms', getRoomList()));

  socket.on('create_room', ({ type, playerPw, specPw, deckId, format }) => {
    if (!currentUser) return;
    const fmt = [1, 3, 5].includes(format) ? format : 1;
    const roomId = uuidv4().substring(0, 8);
    const room = { id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: type||'unranked', format: fmt, winsNeeded: Math.ceil(fmt / 2), setScore: [0, 0],
      playerPw: playerPw||null, specPw: specPw||null,
      players: [{ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: deckId||null }],
      spectators: [], status: 'waiting', created: Date.now(), gameState: null,
      chatHistory: [], privateChatHistory: {} };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.emit('rooms', getRoomList());
  });

  socket.on('join_room', ({ roomId, password, asSpectator, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return socket.emit('join_error', 'Room not found');
    const isPlayer = room.players.some(p => p.username === currentUser.username);
    const isSpec = room.spectators.some(s => s.username === currentUser.username);
    if (isPlayer || isSpec) {
      socket.join('room:' + roomId);
      socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
      // If spectator re-joins during a game, send them the current game state
      if (isSpec && room.status === 'playing' && room.gameState) {
        // Update the spectator's socketId (they may have reconnected)
        const specEntry = room.spectators.find(s => s.username === currentUser.username);
        if (specEntry) specEntry.socketId = socket.id;
        sendSpectatorGameState(room);
        if (room.chatHistory?.length || Object.keys(room.privateChatHistory || {}).length) {
          socket.emit('chat_history', { main: room.chatHistory || [], private: room.privateChatHistory || {} });
        }
      }
      return;
    }
    if (asSpectator) {
      if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Wrong spectator password');
      room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
    } else {
      if (room.players.length >= 2) {
        if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Game full');
        room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
      } else {
        if (room.playerPw && password !== room.playerPw) return socket.emit('join_error', 'Wrong password');
        room.players.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: deckId||null });
        const hs = room.players[0]?.socketId;
        if (hs) io.to(hs).emit('player_joined', { username: currentUser.username });
      }
    }
    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
    // If the game is already playing, send initial game state to the new spectator
    if (room.status === 'playing' && room.gameState && room.spectators.some(s => s.userId === currentUser.userId)) {
      sendSpectatorGameState(room);
    }
  });

  socket.on('swap_to_spectator', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    room.players = room.players.filter(p => p.username !== currentUser.username);
    room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  socket.on('swap_to_player', ({ roomId, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    if (room.players.length >= 2) return socket.emit('join_error', 'No player slot');
    if (room.status === 'playing') return socket.emit('join_error', 'Game in progress');
    room.spectators = room.spectators.filter(s => s.username !== currentUser.username);
    room.players.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: deckId||null });
    const hs = room.players[0]?.socketId;
    if (hs) io.to(hs).emit('player_joined', { username: currentUser.username });
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  socket.on('change_deck', ({ roomId, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const player = room.players.find(p => p.userId === currentUser.userId);
    if (!player) return;
    player.deckId = deckId || null;
    socket.emit('deck_changed', { deckId: player.deckId });
  });

  socket.on('start_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== currentUser.userId || room.players.length < 2) return;
    const activePlayer = Math.random() < 0.5 ? 0 : 1;
    await setupGameState(room);
    await startGameEngine(room, roomId, activePlayer);
  });

  // ── MULLIGAN ──
  socket.on('mulligan_decision', ({ roomId, accept }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.mulliganPending) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || gs.mulliganDecisions[pi] !== null) return; // Already decided

    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };

    const checkBothReady = () => {
      if (!gs.mulliganDecisions) return; // Already processed
      if (gs.mulliganDecisions[0] !== null && gs.mulliganDecisions[1] !== null) {
        gs.mulliganPending = false;
        delete gs.mulliganDecisions;
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        room.engine.startGame().catch(err => console.error('[Engine] startGame error:', err.message));
      }
    };

    gs.mulliganDecisions[pi] = accept;

    if (accept) {
      const ps = gs.players[pi];
      const cardDB = getCardDB();
      (async () => {
        // Separate potions from non-potions for routing
        const handSize = ps.hand.length;
        let potionCount = 0;
        // Return cards to correct deck one by one (reverse draw animation)
        for (let i = 0; i < handSize; i++) {
          const card = ps.hand.shift();
          const cd = cardDB[card];
          if (cd?.cardType === 'Potion') {
            ps.potionDeck.push(card);
            potionCount++;
          } else {
            ps.mainDeck.push(card);
          }
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 180));
        }
        // Wait 1 second
        await new Promise(r => setTimeout(r, 1000));
        // Shuffle both decks
        shuffle(ps.mainDeck);
        shuffle(ps.potionDeck);
        // Draw replacements: potions from potion deck, rest from main deck
        const mainToDraw = handSize - potionCount;
        for (let i = 0; i < mainToDraw; i++) {
          if (ps.mainDeck.length === 0) break;
          const card = ps.mainDeck.shift();
          ps.hand.push(card);
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 200));
        }
        for (let i = 0; i < potionCount; i++) {
          if (ps.potionDeck.length === 0) break;
          const card = ps.potionDeck.shift();
          ps.hand.push(card);
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 200));
        }
        checkBothReady();
      })();
    } else {
      sendGameState(room, pi);
      sendSpectatorGameState(room);
      checkBothReady();
    }
  });

  socket.on('leave_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const hadResult = !!room.gameState?.result;

    // If game is active and no result yet, surrendering ends the game
    if (room.gameState && !hadResult && room.status === 'playing') {
      const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
      if (pi >= 0) await endGame(room, pi===0?1:0, 'surrender');
      // Don't mark as left — both players should see Rematch/Leave
      return;
    }

    // If game already had a result, this is a post-result LEAVE
    if (hadResult && room.gameState) {
      socket.leave('room:' + roomId);
      activeGames.delete(currentUser.userId);
      const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
      if (pi >= 0) room.gameState.players[pi].left = true;
      room.gameState.rematchRequests = room.gameState.rematchRequests.filter(u => u !== currentUser.userId);
      const oi = room.gameState.players.findIndex(ps => ps.userId !== currentUser.userId);
      if (oi >= 0) sendGameState(room, oi);
      sendSpectatorGameState(room);
      if (room.gameState.players.every(ps => ps.left)) cleanupRoom(roomId);
    } else {
      socket.leave('room:' + roomId);
      activeGames.delete(currentUser.userId);
    }
  });

  // Reorder hand (cosmetic, persists across reconnect)
  socket.on('reorder_hand', ({ roomId, hand }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Validate: same cards, just reordered
    const current = room.gameState.players[pi].hand;
    if (hand.length !== current.length) return;
    const sorted1 = [...hand].sort();
    const sorted2 = [...current].sort();
    if (sorted1.some((c, i) => c !== sorted2[i])) return;
    room.gameState.players[pi].hand = hand;
  });

  // Advance phase (player clicks a phase button)
  socket.on('advance_phase', ({ roomId, targetPhase }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    if (targetPhase !== undefined) {
      room.engine.advanceToPhase(pi, targetPhase).catch(err => console.error('[Engine] advanceToPhase error:', err.message));
    } else {
      room.engine.advancePhase(pi).catch(err => console.error('[Engine] advancePhase error:', err.message));
    }
  });

  // Play an ability from hand onto a hero
  socket.on('play_ability', ({ roomId, cardName, handIndex, heroIdx, zoneSlot }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Must be Main Phase 1 or 2

    const ps = gs.players[pi];
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    // Load card data
    const cardData = getCardDB()[cardName];
    if (!cardData || cardData.cardType !== 'Ability') return;

    // Validate hero
    const hero = ps.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return;
    if (ps.abilityGivenThisTurn[heroIdx]) return; // Already received one this turn

    const abZones = ps.abilityZones[heroIdx] || [[], [], []];

    // Check for custom placement (e.g. Performance)
    const script = loadCardEffect(cardName);
    if (script?.customPlacement) {
      // Custom placement — must target a specific zone
      if (zoneSlot < 0 || zoneSlot >= 3) return;
      const zone = abZones[zoneSlot] || [];
      if (!script.customPlacement.canPlace(zone)) return;
      abZones[zoneSlot].push(cardName);
    } else {
      // Standard placement logic
      // Check if hero already has this ability — find which zone it's in
      let existingZoneIdx = -1;
      let existingCount = 0;
      for (let z = 0; z < 3; z++) {
        if ((abZones[z] || []).length > 0 && abZones[z][0] === cardName) {
          existingZoneIdx = z;
          existingCount = abZones[z].length;
          break;
        }
      }

      if (existingZoneIdx >= 0) {
        // Stack onto existing — max level 3
        if (existingCount >= 3) return;
        abZones[existingZoneIdx].push(cardName);
      } else {
        // New ability — needs a free zone
        if (zoneSlot >= 0 && zoneSlot < 3 && (abZones[zoneSlot] || []).length === 0) {
          abZones[zoneSlot] = [cardName];
        } else {
          let freeZ = -1;
          for (let z = 0; z < 3; z++) {
            if ((abZones[z] || []).length === 0) { freeZ = z; break; }
          }
          if (freeZ < 0) return;
          abZones[freeZ] = [cardName];
        }
      }
    }

    // Update state
    ps.abilityZones[heroIdx] = abZones;
    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    ps.abilityGivenThisTurn[heroIdx] = true;

    // Track in engine — find which zone the card ended up in
    const finalZone = abZones.findIndex(z => (z || []).includes(cardName));
    const inst = room.engine._trackCard(cardName, pi, 'ability', heroIdx, Math.max(0, finalZone));

    room.engine.log('ability_attached', { player: ps.username, card: cardName, hero: hero.name });

    // Fire hooks and WAIT for them to resolve (including damage effects) before syncing
    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx });
      } catch (err) {
        console.error('[Engine] play_ability hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // ── Place a Surprise card face-down into a Hero's Surprise Zone ──
  socket.on('play_surprise', ({ roomId, cardName, handIndex, heroIdx, bakhmSlot }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Main Phase 1 or 2

    const ps = gs.players[pi];
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    // Card must have a Surprise script
    const script = loadCardEffect(cardName);
    if (!script?.isSurprise) return;

    // Also verify the card data has the Surprise subtype
    const cardData = getCardDB()[cardName];
    if (!cardData || (cardData.subtype || '').toLowerCase() !== 'surprise') return;

    // Hero must be alive
    const hero = ps.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return;

    // Bakhm support zone placement
    if (bakhmSlot != null && bakhmSlot >= 0) {
      // Bakhm must not be incapacitated
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;
      // Verify hero is Bakhm
      const heroScript = loadCardEffect(hero.name);
      if (!heroScript?.isBakhmHero) return;
      // Only Surprise Creatures allowed in Bakhm slots
      if (cardData.cardType !== 'Creature') return;
      // Support zone must be empty
      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      if ((ps.supportZones[heroIdx][bakhmSlot] || []).length > 0) return;

      // Place face-down in support zone
      ps.supportZones[heroIdx][bakhmSlot] = [cardName];
      ps.hand.splice(handIndex, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

      const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, bakhmSlot);
      inst.faceDown = true;

      room.engine.log('surprise_set', { player: ps.username, hero: hero.name, bakhmSlot: true });

      (async () => {
        try {
          await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });
        } catch (err) {
          console.error('[Engine] play_surprise bakhm hooks error:', err.message);
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      })();
      return;
    }

    // Regular surprise zone placement
    // Surprise zone must be empty
    if ((ps.surpriseZones[heroIdx] || []).length > 0) return;

    // Place face-down — no ability check required for placement
    if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
    ps.surpriseZones[heroIdx] = [cardName];
    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

    // Track in engine
    const inst = room.engine._trackCard(cardName, pi, 'surprise', heroIdx, 0);
    inst.faceDown = true;

    room.engine.log('surprise_set', { player: ps.username, hero: hero.name });

    // Run hooks (card entering zone)
    (async () => {
      try {
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx, _skipReactionCheck: true });
      } catch (err) {
        console.error('[Engine] play_surprise hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Summon a creature placed by Ushabti from surprise zone
  socket.on('summon_ushabti', ({ roomId, heroIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Main Phase only

    const ps = gs.players[pi];
    const sz = ps.surpriseZones?.[heroIdx] || [];
    if (sz.length === 0) return;
    const cardName = sz[0];
    const inst = room.engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'surprise' && c.heroIdx === heroIdx && c.ushabtiPlaced
    );
    if (!inst) return;
    const currentTurn = gs.turn || 0;
    if (inst.ushabtiTurn >= currentTurn) return; // Can't summon same turn

    const hero = ps.heroes[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

    // Check abilities
    const cardData = getCardDB()[cardName];
    if (!cardData) return;
    const level = cardData.level || 0;
    if (level > 0 || cardData.spellSchool1) {
      const abZones = ps.abilityZones?.[heroIdx] || [];
      if (cardData.spellSchool1 && room.engine.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) return;
      if (cardData.spellSchool2 && room.engine.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) return;
    }

    // Find free support zone slot
    let freeSlot = -1;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[heroIdx] || [])[si] || []).length === 0) { freeSlot = si; break; }
    }
    if (freeSlot < 0) return;

    // Check custom summon conditions
    const script = loadCardEffect(cardName);
    if (script?.canSummon && !script.canSummon({ _engine: room.engine, cardOwner: pi, cardHeroIdx: heroIdx })) return;

    // Remove from surprise zone
    const szIdx = sz.indexOf(cardName);
    if (szIdx >= 0) sz.splice(szIdx, 1);

    // Place in support zone
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    ps.supportZones[heroIdx][freeSlot] = [cardName];

    // Update instance
    inst.zone = 'support';
    inst.heroIdx = heroIdx;
    inst.zoneSlot = freeSlot;
    inst.faceDown = false;
    delete inst.ushabtiPlaced;
    delete inst.ushabtiTurn;
    inst.turnPlayed = currentTurn;

    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    room.engine.log('creature_summoned', { player: ps.username, card: cardName, hero: hero.name });
    room.engine._trackTerrorResolvedEffect(pi, cardName);
    room.engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: freeSlot, cardName });
    room.engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: freeSlot,
    });

    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: freeSlot, _skipReactionCheck: true });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });
        // Fire Bakhm's onSurpriseCreaturePlaced for surprise creature summons
        await room.engine.runHooks('onSurpriseCreaturePlaced', {
          surpriseCardName: cardName, surpriseOwner: pi, heroIdx,
          zoneSlot: freeSlot, cardInstance: inst,
        });
        await room.engine._flushSurpriseDrawChecks();
        // Check summon triggers
        await room.engine._checkSurpriseOnSummon(pi, inst);
      } catch (err) {
        console.error('[Engine] summon_ushabti hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Activate an action-costing ability on the board
  socket.on('activate_ability', ({ roomId, heroIdx, zoneIdx, charmedOwner }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.potionTargeting) return;

    // Determine which player's heroes to look at
    const heroOwner = charmedOwner != null ? charmedOwner : pi;
    const ps = gs.players[heroOwner];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // If charmedOwner is set, verify the hero is actually charmed by this player
    if (charmedOwner != null && hero.charmedBy !== pi) return;

    // Combo lock: if a hero has an exclusive combo active, only that hero can act
    if (charmedOwner == null && gs.players[pi].comboLockHeroIdx != null && gs.players[pi].comboLockHeroIdx !== heroIdx) return;

    const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
    if (!abilitySlot || abilitySlot.length === 0) return;
    const abilityName = abilitySlot[0];
    const level = abilitySlot.length;

    const { loadCardEffect } = require('./cards/effects/_loader');
    const script = loadCardEffect(abilityName);
    if (!script?.actionCost || !script?.onActivate) return;

    // Check HOPT
    const hoptKey = `ability-action:${abilityName}:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

    // Check script-defined activation condition (Necromancy, etc.)
    if (script.canActivateAction && !script.canActivateAction(gs, pi, heroIdx, level, room.engine)) return;

    // Check if action is available
    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    const hasAdditional = isMainPhase && room.engine.hasAdditionalActionForCategory(pi, 'ability_activation');
    if (!isActionPhase && !hasAdditional) return;

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey] = gs.turn;

    room.engine._setPendingPlayLog('ability_activated', { player: gs.players[pi].username, card: abilityName, hero: hero.name, level });

    (async () => {
      try {
        // Create a context for the ability
        const inst = room.engine.cardInstances.find(c =>
          c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
        );
        if (!inst) return;

        // ── Reaction chain window — opponents can chain before ability resolves ──
        const chainResult = await room.engine.executeCardWithChain({
          cardName: abilityName, owner: pi, cardType: 'Ability', goldCost: 0,
          resolve: null, // Resolution handled by onActivate below
        });

        if (chainResult.negated) {
          // Ability negated — action consumed but effect doesn't resolve
          if (isActionPhase) {
            await room.engine.advanceToPhase(pi, 4);
          } else if (hasAdditional) {
            for (const inst2 of room.engine.cardInstances) {
              if (inst2.owner !== pi) continue;
              if (!inst2.counters.additionalActionType || !inst2.counters.additionalActionAvail) continue;
              const config = room.engine._additionalActionTypes[inst2.counters.additionalActionType];
              if (config?.allowedCategories?.includes('ability_activation')) {
                room.engine.consumeAdditionalAction(pi, inst2.counters.additionalActionType, inst2.id);
                break;
              }
            }
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // For charmed heroes: temporarily set controller to the charming player
        const origController = inst.controller;
        const origOwner = inst.owner;

        // Play shine animation on the ability (after chain, before effect)
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) io.to(sid).emit('ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });
        }
        sendToSpectators(room, 'ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });

        // Queue card reveal — fires on the script's first confirmed prompt
        gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };

        if (charmedOwner != null) {
          inst.controller = pi;
          inst.owner = pi;
          inst.heroOwner = charmedOwner;
        }

        const ctx = room.engine._createContext(inst, {});

        // Run the activation — if it returns false, treat as cancelled (refund HOPT, keep action)
        const result = await script.onActivate(ctx, level);

        // Fire reveal if script resolved without any prompts, or clean up if cancelled
        if (result === false) {
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
        } else if (gs._pendingCardReveal) {
          room.engine._firePendingCardReveal();
        } else {
          room.engine._firePendingPlayLog();
        }

        // Restore original controller/owner
        if (charmedOwner != null) {
          inst.controller = origController;
          inst.owner = origOwner;
          delete inst.heroOwner;
        }
        if (result === false) {
          delete gs.hoptUsed[hoptKey];
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // Fire action hooks
        const usingAdditional = hasAdditional && !isActionPhase;
        await room.engine.runHooks('onActionUsed', {
          actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
          isAdditional: usingAdditional, _skipReactionCheck: true,
        });
        if (usingAdditional) {
          await room.engine.runHooks('onAdditionalActionUsed', {
            actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
            _skipReactionCheck: true,
          });
        }

        // Consume action
        if (isActionPhase) {
          await room.engine.advanceToPhase(pi, 4); // Action → Main Phase 2
        } else if (hasAdditional) {
          // Consume additional action with ability_activation category
          for (const inst2 of room.engine.cardInstances) {
            if (inst2.owner !== pi) continue;
            if (!inst2.counters.additionalActionType || !inst2.counters.additionalActionAvail) continue;
            const config = room.engine._additionalActionTypes[inst2.counters.additionalActionType];
            if (config?.allowedCategories?.includes('ability_activation')) {
              room.engine.consumeAdditionalAction(pi, inst2.counters.additionalActionType, inst2.id);
              break;
            }
          }
        }
      } catch (err) {
        console.error('[Engine] activate_ability error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Activate a free-activation ability (no action cost, Main Phase only)
  // Generic handler — individual ability logic lives in the card script's onFreeActivate.
  socket.on('activate_free_ability', ({ roomId, heroIdx, zoneIdx, charmedOwner }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.potionTargeting) return;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    const isActionPhase = gs.currentPhase === 3;
    if (!isMainPhase && !isActionPhase) return; // Main or Action Phase

    // Determine which player's heroes to look at
    const heroOwner = charmedOwner != null ? charmedOwner : pi;
    const ps = gs.players[heroOwner];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return;

    // If charmedOwner is set, verify the hero is actually charmed by this player
    if (charmedOwner != null && hero.charmedBy !== pi) return;

    const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
    if (!abilitySlot || abilitySlot.length === 0) return;
    const abilityName = abilitySlot[0];
    const level = abilitySlot.length;

    const { loadCardEffect } = require('./cards/effects/_loader');
    const script = loadCardEffect(abilityName);
    if (!script?.freeActivation || !script?.onFreeActivate) return;

    // Action Phase: only scripts with actionPhaseEligible can activate here
    if (isActionPhase && !script.actionPhaseEligible) return;

    // Check HOPT (by ability name — blocks all copies for this player)
    const hoptKey = `free-ability:${abilityName}:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

    // Check canFreeActivate (don't claim HOPT yet — effect might cancel)
    if (script.canFreeActivate) {
      const inst = room.engine.cardInstances.find(c =>
        c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
      );
      if (!inst) return;
      const ctx = room.engine._createContext(inst, { event: 'canFreeActivateCheck' });
      if (!script.canFreeActivate(ctx, level)) return;
    }

    (async () => {
      try {
        const inst = room.engine.cardInstances.find(c =>
          c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
        );
        if (!inst) return;

        // ── Reaction chain window — opponents can chain before ability resolves ──
        const chainResult = await room.engine.executeCardWithChain({
          cardName: abilityName, owner: pi, cardType: 'Ability', goldCost: 0,
          resolve: null, // Resolution handled by onFreeActivate below
        });

        if (chainResult.negated) {
          // Negated — claim HOPT (activation was attempted) but effect doesn't resolve
          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[hoptKey] = gs.turn;
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // For charmed heroes: temporarily set controller to the charming player
        const origController = inst.controller;
        const origOwner = inst.owner;
        if (charmedOwner != null) {
          inst.controller = pi;
          inst.owner = pi;
          inst.heroOwner = charmedOwner;
        }

        // Queue card reveal — fires on the script's first confirmed prompt
        gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };
        room.engine._setPendingPlayLog('ability_activated', { player: gs.players[pi].username, card: abilityName, hero: hero.name, level });

        const ctx = room.engine._createContext(inst, {});
        // onFreeActivate returns true if the effect resolved (HOPT should be claimed)
        const resolved = await script.onFreeActivate(ctx, level);
        await room.engine._flushSurpriseDrawChecks();

        // Restore original controller/owner
        if (charmedOwner != null) {
          inst.controller = origController;
          inst.owner = origOwner;
          delete inst.heroOwner;
        }

        // Only claim HOPT if the effect actually resolved (not cancelled)
        if (resolved !== false) {
          // Fire reveal + log if script resolved without any prompts
          if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
          else room.engine._firePendingPlayLog();

          // Generic "ability activated" flash — visible to both players (unless script handles its own)
          if (!script.noDefaultFlash) {
            room.engine._broadcastEvent('ability_activated', { owner: heroOwner, heroIdx, zoneIdx });
          }

          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[hoptKey] = gs.turn;

          // If activated during Action Phase, consume the action
          if (isActionPhase) {
            await room.engine.advanceToPhase(pi, 4);
          }
        } else {
          // Cancelled — clean up pending reveal + log
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
        }
      } catch (err) {
        console.error('[Engine] activate_free_ability error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Activate a hero's active effect (Main Phase, no action cost)
  socket.on('activate_hero_effect', ({ roomId, heroIdx, charmedOwner }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return;
    if (gs.potionTargeting) return;

    const heroOwner = charmedOwner != null ? charmedOwner : pi;
    const ps = gs.players[heroOwner];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

    // If charmedOwner is set, verify the hero is actually charmed by this player
    if (charmedOwner != null && hero.charmedBy !== pi) return;

    const { loadCardEffect } = require('./cards/effects/_loader');

    // Collect ALL available hero effects for this hero (own + equipped)
    const availableEffects = [];

    // Hero's own effect
    // Check if hero has a Mummy Token — replaces hero's own effect
    const hasMummyToken = (ps.supportZones[heroIdx] || []).some(slot => (slot || []).includes('Mummy Token'));
    const mummyTokenScript = hasMummyToken ? loadCardEffect('Mummy Token') : null;

    const ownScript = loadCardEffect(hero.name);
    if (hasMummyToken && mummyTokenScript?.heroEffect && mummyTokenScript?.onHeroEffect) {
      // Mummy Token replaces the hero's own effect
      const mummyInst = room.engine.cardInstances.find(c =>
        c.owner === heroOwner && c.zone === 'support' && c.heroIdx === heroIdx && c.name === 'Mummy Token'
      );
      const hoptKey = `hero-effect:MummyToken:${pi}:${heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] !== gs.turn && mummyInst) {
        let canActivate = true;
        if (mummyTokenScript.canActivateHeroEffect) {
          const ctx = room.engine._createContext(mummyInst, { event: 'canHeroEffectCheck' });
          canActivate = mummyTokenScript.canActivateHeroEffect(ctx);
        }
        if (canActivate) {
          availableEffects.push({
            name: 'Mummy Token',
            script: mummyTokenScript,
            inst: mummyInst,
            hoptKey,
          });
        }
      }
    } else if (ownScript?.heroEffect && ownScript?.onHeroEffect) {
      const hoptKey = `hero-effect:${hero.name}:${pi}:${heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] !== gs.turn) {
        let canActivate = true;
        if (ownScript.canActivateHeroEffect) {
          const inst = room.engine.cardInstances.find(c => c.owner === heroOwner && c.zone === 'hero' && c.heroIdx === heroIdx);
          if (inst) {
            const ctx = room.engine._createContext(inst, { event: 'canHeroEffectCheck' });
            canActivate = ownScript.canActivateHeroEffect(ctx);
          } else {
            canActivate = false;
          }
        }
        if (canActivate) {
          availableEffects.push({
            name: hero.name,
            script: ownScript,
            inst: room.engine.cardInstances.find(c => c.owner === heroOwner && c.zone === 'hero' && c.heroIdx === heroIdx),
            hoptKey,
          });
        }
      }
    }

    // Equipped hero effects
    for (const ci of room.engine.cardInstances) {
      if (ci.owner !== heroOwner || ci.zone !== 'support' || ci.heroIdx !== heroIdx) continue;
      if (!ci.counters?.treatAsEquip) continue;
      const equipScript = loadCardEffect(ci.name);
      if (!equipScript?.heroEffect || !equipScript?.onHeroEffect) continue;
      const hoptKey = `hero-effect:${ci.name}:${pi}:${heroIdx}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
      let canActivate = true;
      if (equipScript.canActivateHeroEffect) {
        try {
          const ctx = room.engine._createContext(ci, { event: 'canHeroEffectCheck' });
          canActivate = equipScript.canActivateHeroEffect(ctx);
        } catch { canActivate = false; }
      }
      if (canActivate) {
        availableEffects.push({ name: ci.name, script: equipScript, inst: ci, hoptKey });
      }
    }

    if (availableEffects.length === 0) {
      return;
    }

    (async () => {
      try {
        let chosen;

        if (availableEffects.length === 1) {
          chosen = availableEffects[0];
        } else {
          // Multiple effects — prompt player to choose via optionPicker
          const response = await room.engine.promptGeneric(pi, {
            type: 'optionPicker',
            title: `${hero.name} — Hero Effect`,
            description: 'Choose which Hero Effect to activate.',
            options: availableEffects.map((e, i) => ({
              id: `effect-${i}`,
              label: e.name,
              description: e.script.heroEffect || '',
              color: e.inst?.zone === 'support' ? 'var(--warning)' : 'var(--accent)',
            })),
            cancellable: true,
          });
          if (!response || response.cancelled) return;
          const idx = availableEffects.findIndex((_, i) => `effect-${i}` === response.optionId);
          chosen = idx >= 0 ? availableEffects[idx] : null;
          if (!chosen) return;
        }

        if (!chosen.inst) return;

        room.engine._setPendingPlayLog('hero_effect_activated', { player: gs.players[pi].username, hero: hero.name, effect: chosen.name });

        // ── Reaction chain window ──
        const chainResult = await room.engine.executeCardWithChain({
          cardName: chosen.name, owner: pi, cardType: 'Hero', goldCost: 0,
          resolve: null,
        });

        if (chainResult.negated) {
          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[chosen.hoptKey] = gs.turn;
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // Check for hero-effect-triggered surprises (Mummy Maker Machine)
        const heroEffectSurprise = await room.engine._checkSurpriseOnHeroEffect(pi, heroIdx, chosen.name);
        if (heroEffectSurprise?.negateEffect) {
          // Surprise negated the hero effect — do NOT consume HOPT so the new effect can be used
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // For charmed heroes: temporarily set controller to the charming player
        const origController2 = chosen.inst.controller;
        const origOwner2 = chosen.inst.owner;
        if (charmedOwner != null) {
          chosen.inst.controller = pi;
          chosen.inst.owner = pi;
          chosen.inst.heroOwner = charmedOwner;
        }

        // Queue card reveal — fires on the script's first confirmed prompt
        gs._pendingCardReveal = { cardName: chosen.name, ownerIdx: pi };

        const ctx = room.engine._createContext(chosen.inst, {});
        const resolved = await chosen.script.onHeroEffect(ctx);
        await room.engine._flushSurpriseDrawChecks();

        // Restore original controller/owner
        if (charmedOwner != null) {
          chosen.inst.controller = origController2;
          chosen.inst.owner = origOwner2;
          delete chosen.inst.heroOwner;
        }

        if (resolved !== false) {
          // Fire reveal if script resolved without any prompts
          if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
          else room.engine._firePendingPlayLog();

          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[chosen.hoptKey] = gs.turn;
        } else {
          // Cancelled — clean up pending reveal + log
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
        }
      } catch (err) {
        console.error('[Engine] activate_hero_effect error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // ── ACTIVE CREATURE EFFECTS ──
  socket.on('activate_creature_effect', ({ roomId, heroIdx, zoneSlot, charmedOwner }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return;
    if (gs.potionTargeting) return;

    const heroOwner = charmedOwner != null ? charmedOwner : pi;
    const ps = gs.players[heroOwner];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return;
    if (charmedOwner != null && hero.charmedBy !== pi) return;

    const slot = (ps.supportZones[heroIdx] || [])[zoneSlot] || [];
    if (slot.length === 0) return;
    const creatureName = slot[0];

    const inst = room.engine.cardInstances.find(c =>
      c.owner === heroOwner && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
    );
    if (!inst) return;

    const { loadCardEffect } = require('./cards/effects/_loader');
    const effectName = inst.counters?._effectOverride || creatureName;
    const script = loadCardEffect(effectName);
    if (!script?.creatureEffect || !script?.onCreatureEffect) return;

    // Summoning sickness: cannot activate on the turn summoned
    if (inst.turnPlayed === (gs.turn || 0)) return;

    // Soft HOPT per creature instance
    const hoptKey = `creature-effect:${inst.id}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

    // Check activation condition
    if (script.canActivateCreatureEffect) {
      const ctx = room.engine._createContext(inst, { event: 'canCreatureEffectCheck' });
      if (!script.canActivateCreatureEffect(ctx)) return;
    }

    room.engine._setPendingPlayLog('creature_effect_activated', { player: gs.players[pi].username, card: creatureName, hero: hero.name });

    (async () => {
      try {
        // Temporarily override controller for charmed heroes
        const origController = inst.controller;
        const origOwner = inst.owner;
        if (charmedOwner != null) {
          inst.controller = pi;
          inst.owner = pi;
          inst.heroOwner = charmedOwner;
        }

        // Queue card reveal — fires on the script's first confirmed prompt
        gs._pendingCardReveal = { cardName: creatureName, ownerIdx: pi };

        const ctx = room.engine._createContext(inst, {});
        const resolved = await script.onCreatureEffect(ctx);

        // Restore controller
        if (charmedOwner != null) {
          inst.controller = origController;
          inst.owner = origOwner;
          delete inst.heroOwner;
        }

        if (resolved !== false) {
          // Fire reveal if script resolved without any prompts
          if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
          else room.engine._firePendingPlayLog();

          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[hoptKey] = gs.turn;
        } else {
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
        }
        // Flush any accumulated surprise draw checks
        await room.engine._flushSurpriseDrawChecks();
      } catch (err) {
        console.error('[Engine] activate_creature_effect error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Play a creature from hand to support zone
  socket.on('play_creature', ({ roomId, cardName, handIndex, heroIdx, zoneSlot, additionalActionProvider }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);

    const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Creature']);
    if (!v) return;
    const { ps, cardData, isActionPhase, isMainPhase } = v;

    // Creature-specific checks
    if (ps.summonLocked) return;
    if ((gs.summonBlocked || []).includes(cardName)) return;
    // Charmed heroes' support zones are locked
    const creatureHero = ps.heroes?.[heroIdx];
    if (creatureHero?.statuses?.charmed) return;

    // Additional action handling — creatures in Main Phase or Action Phase after normal action MUST use one
    const additionalTypeId = room.engine.findAdditionalActionForCard(pi, cardName, heroIdx);
    const usingAdditional = !!additionalTypeId;
    const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0);
    if ((isMainPhase || actionAlreadyUsed) && !usingAdditional) return;

    // Validate support zone slot is free
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    const totalZones = ps.supportZones[heroIdx].length;
    if (zoneSlot < 0 || zoneSlot >= totalZones) return;
    if ((ps.supportZones[heroIdx][zoneSlot] || []).length > 0) return;

    // Consume additional action if applicable
    if (usingAdditional) {
      const consumed = room.engine.consumeAdditionalAction(pi, additionalTypeId, additionalActionProvider || null);
      if (!consumed) return; // Failed to consume — shouldn't happen
    }

    // Execute: remove from hand, add to support zone
    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

    // Safe placement — handles zone-occupied fallback
    const placeResult = room.engine.safePlaceInSupport(cardName, pi, heroIdx, zoneSlot);
    if (!placeResult) {
      // No free zones — creature fizzles, goes to discard (action still consumed)
      ps.discardPile.push(cardName);
      room.engine.log('creature_fizzle', { card: cardName, reason: 'zone_occupied' });
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return;
    }
    const actualZoneSlot = placeResult.actualSlot;

    // Track card instance in engine
    const inst = placeResult.inst;

    // Emit summon effect highlight to both players for every creature
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });
    }
    sendToSpectators(room, 'summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });

    room.engine.log('creature_summoned', { player: ps.username, card: cardName, hero: gs.players[pi].heroes[heroIdx]?.name });
    room.engine._trackTerrorResolvedEffect(pi, cardName);

    // Fire hooks, wait for resolution, then advance phase (only if NOT using additional action)
    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualZoneSlot });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
        // Trigger reaction check for creature summon (with creature as initial card in chain)
        await room.engine._checkReactionCards('onCreatureSummoned', {
          _initialCard: { cardName, owner: pi, cardType: 'Creature' },
        });
        // Fire action hooks
        await room.engine.runHooks('onActionUsed', {
          actionType: 'creature', playerIdx: pi, cardName, heroIdx,
          isAdditional: usingAdditional, _skipReactionCheck: true,
        });
        if (usingAdditional) {
          await room.engine.runHooks('onAdditionalActionUsed', {
            actionType: 'creature', playerIdx: pi, cardName, heroIdx,
            _skipReactionCheck: true,
          });
        }
        // Only advance phase if this was a "real" action (not additional) during Action Phase
        if (isActionPhase && !usingAdditional) {
          await room.engine.advanceToPhase(pi, 4);
        }
        // After consuming an additional action in Action Phase, auto-advance if none remain
        if (isActionPhase && usingAdditional) {
          const hasMore = room.engine.cardInstances.some(c =>
            c.owner === pi && c.counters.additionalActionAvail
          );
          if (!hasMore) {
            await room.engine.advanceToPhase(pi, 4);
          }
        }
      } catch (err) {
        console.error('[Engine] play_creature hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Play a spell or attack from hand (drag onto a hero)
  socket.on('play_spell', ({ roomId, cardName, handIndex, heroIdx, charmedOwner, attachmentZoneSlot }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);

    const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Spell', 'Attack'], { charmedOwner });
    if (!v) return;
    const { ps, cardData, hero, script, isActionPhase, isMainPhase, isInherentAction } = v;

    // Check if this needs an additional action (Main Phase play, or Action Phase after normal action used)
    const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0);
    const needsAdditional = (isMainPhase && !isInherentAction) || actionAlreadyUsed;
    let additionalConsumed = false;
    let consumedInst = null;
    if (needsAdditional) {
      const typeId = room.engine.findAdditionalActionForCard(pi, cardName, heroIdx);
      if (!typeId) return; // No additional action available
      consumedInst = room.engine.consumeAdditionalAction(pi, typeId);
      additionalConsumed = true;
    }

    // Mark card as resolving (stays in hand visually, prevents re-play)
    const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
    ps._resolvingCard = { name: cardName, nth };

    (async () => {
      try {
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;

        // Track card instance with heroIdx so onPlay knows which hero cast it
        const inst = room.engine._trackCard(cardName, pi, 'hand', heroIdx, -1);
        if (charmedOwner != null) inst.heroOwner = charmedOwner;

        room.engine._setPendingPlayLog('spell_played', { card: cardName, player: ps.username, hero: hero.name, cardType: cardData.cardType });

        // ── Reaction chain window — opponents can chain before spell resolves ──
        const chainResult = await room.engine.executeCardWithChain({
          cardName, owner: pi, cardType: cardData.cardType, goldCost: 0, heroIdx,
          resolve: null, // Resolution handled by onPlay below
        });

        if (chainResult.negated) {
          // Spell was negated — remove from hand + discard in single sync
          const hi = getResolvingHandIndex(ps);
          ps._resolvingCard = null;
          if (hi >= 0) { ps.hand.splice(hi, 1); if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++; }
          ps.discardPile.push(cardName);
          room.engine._untrackCard(inst.id);
          if (additionalConsumed && consumedInst) {
            consumedInst.counters.additionalActionAvail = 1;
          }
          // Still count as action used (the action was spent even if negated)
          if (cardData.cardType === 'Attack') {
            ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
            if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
            if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
            // Per-hero duplicate attack ban (managed by hero hooks, needed here since onActionUsed doesn't fire for negated spells)
            if (hero.ghuanjunAttacksUsed && !hero.ghuanjunAttacksUsed.includes(cardName)) hero.ghuanjunAttacksUsed.push(cardName);
          }
          if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
          if (!ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
          if (isActionPhase && !additionalConsumed && !isInherentAction) {
            await room.engine.advanceToPhase(pi, 4);
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // Set up spell damage tracking (for Bartas second-cast detection)
        gs._spellDamageLog = [];
        gs._spellExcludeTargets = [];
        gs._spellCancelled = false;

        // Queue card reveal — will fire when the player confirms a target prompt
        if (!chainResult.chainFormed) {
          gs._pendingCardReveal = { cardName, ownerIdx: pi };
        }

        // Fire onPlay hook (spell resolves here)
        if (attachmentZoneSlot != null && attachmentZoneSlot >= 0) gs._attachmentZoneSlot = attachmentZoneSlot;
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });
        delete gs._attachmentZoneSlot;
        await room.engine._flushSurpriseDrawChecks();

        // If spell was cancelled (player backed out of target selection), unmark and keep in hand
        if (gs._spellCancelled) {
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
          ps._resolvingCard = null;
          room.engine._untrackCard(inst.id);
          delete gs._spellDamageLog;
          delete gs._spellExcludeTargets;
          delete gs._spellCancelled;
          // Refund additional action if one was consumed
          if (additionalConsumed && consumedInst) {
            consumedInst.counters.additionalActionAvail = 1;
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }
        delete gs._spellCancelled;

        // Fire pending reveal if it wasn't consumed by a prompt (auto-resolve spells)
        if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
        else room.engine._firePendingPlayLog();

        // Check if the spell declared itself a free action (Fire Bolts enhanced mode, etc.)
        const becameFreeAction = gs._spellFreeAction === true;
        delete gs._spellFreeAction;
        if (becameFreeAction && additionalConsumed && consumedInst) {
          consumedInst.counters.additionalActionAvail = 1;
          additionalConsumed = false;
        }

        // Collect unique damage targets
        const uniqueTargets = [];
        const seenIds = new Set();
        for (const t of (gs._spellDamageLog || [])) {
          if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
        }

        // Track which heroes performed actions this turn (BEFORE afterSpellResolved so hooks see updated state)
        if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
        if (!ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);

        // Fire afterSpellResolved hook (Bartas, etc.)
        await room.engine.runHooks('afterSpellResolved', {
          spellName: cardName, spellCardData: cardData, heroIdx, casterIdx: pi,
          damageTargets: uniqueTargets, isSecondCast: !!gs._bartasSecondCast,
          _skipReactionCheck: true,
        });

        // Clean up tracking
        delete gs._spellDamageLog;
        delete gs._spellExcludeTargets;
        delete gs._bartasSecondCast;

        // Move to discard (unless the spell placed itself on the board as an attachment)
        const resolveHi = getResolvingHandIndex(ps);
        ps._resolvingCard = null;
        if (resolveHi >= 0) { ps.hand.splice(resolveHi, 1); if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++; }
        if (gs._spellPlacedOnBoard) {
          delete gs._spellPlacedOnBoard;
          // Card is already tracked in its new zone by the onPlay hook — don't discard
        } else {
          if (resolveHi >= 0) ps.discardPile.push(cardName);
          room.engine._untrackCard(inst.id);
        }

        // Track Support Spell usage (for Friendship Lv1 restriction)
        if (cardData.cardType === 'Spell' && cardData.spellSchool1 === 'Support Magic') {
          ps.supportSpellUsedThisTurn = true;
          // Friendship Lv1: lock all Support Spells if this was played via Friendship additional action
          if (additionalConsumed && consumedInst?.counters?.additionalActionType?.startsWith('friendship_support')) {
            const { loadCardEffect: loadFx } = require('./cards/effects/_loader');
            const friendshipScript = loadFx('Friendship');
            // Only lock at Lv1
            const abZones = ps.abilityZones[heroIdx] || [];
            let friendshipLevel = 0;
            for (const slot of abZones) {
              if ((slot || []).includes('Friendship')) { friendshipLevel = (slot || []).length; break; }
            }
            if (friendshipLevel <= 1) {
              ps.supportSpellLocked = true;
              room.engine.log('support_spell_locked', { player: ps.username, by: 'Friendship' });
            }
          }
        }

        // Track successful attacks for combo effects
        if (cardData.cardType === 'Attack') {
          ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
          if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
          if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
        }

        // Fire action hooks (only when an action is actually consumed)
        if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction) {
          await room.engine.runHooks('onActionUsed', {
            actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
            isAdditional: false, _skipReactionCheck: true,
          });
        } else if (additionalConsumed) {
          await room.engine.runHooks('onActionUsed', {
            actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
            isAdditional: true, _skipReactionCheck: true,
          });
          await room.engine.runHooks('onAdditionalActionUsed', {
            actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
            _skipReactionCheck: true,
          });
        }

        // Advance from Action Phase → Main Phase 2 (if not additional/inherent/free action)
        // _preventPhaseAdvance can be set by hooks (Ghuanjun combo) to keep the phase open
        if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction && !gs._preventPhaseAdvance) {
          await room.engine.advanceToPhase(pi, 4);
        }
        // After consuming an additional action in Action Phase, auto-advance if none remain
        if (isActionPhase && additionalConsumed && !gs._preventPhaseAdvance) {
          const hasMore = room.engine.cardInstances.some(c =>
            c.owner === pi && c.counters.additionalActionAvail
          );
          if (!hasMore) {
            await room.engine.advanceToPhase(pi, 4);
          }
        }
        delete gs._preventPhaseAdvance;

        // Mark once-per-game cards as used
        if (script?.oncePerGame) {
          const opgKey = script.oncePerGameKey || cardName;
          if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
          ps._oncePerGameUsed.add(opgKey);
        }
      } catch (err) {
        console.error('[Engine] play_spell error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Play an artifact from hand
  socket.on('play_artifact', ({ roomId, cardName, handIndex, heroIdx, zoneSlot }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Must be Main Phase

    const ps = gs.players[pi];
    if (ps.itemLocked) return; // Hammer Throw lock
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    const cardData = getCardDB()[cardName];
    if (!cardData || cardData.cardType !== 'Artifact') return;

    // Check gold
    const cost = cardData.cost || 0;
    if ((ps.gold || 0) < cost) return;

    const hero = ps.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen) return; // Can't equip to frozen heroes
    // Charmed heroes' support zones are locked
    if (hero.statuses?.charmed) return;
    const isEquip = (cardData.subtype || '').toLowerCase() === 'equipment';
    if (isEquip) {
      // Per-card equip restrictions (e.g. Lifeforce Howitzer 1-per-hero)
      const equipScript = loadCardEffect(cardName);
      if (equipScript?.canEquipToHero && !equipScript.canEquipToHero(gs, pi, heroIdx, room.engine)) return;

      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      // Auto-find free support zone if zoneSlot is -1 (dropped on hero)
      let finalSlot = zoneSlot;
      if (finalSlot < 0) {
        const baseZoneCount = 3; // Only base zones, not island zones
        for (let z = 0; z < baseZoneCount; z++) {
          if ((ps.supportZones[heroIdx][z] || []).length === 0) { finalSlot = z; break; }
        }
        if (finalSlot < 0) return; // No free slot
      }
      if (finalSlot < 0 || finalSlot >= 3) return; // Must be base zone (not island)
      if ((ps.supportZones[heroIdx][finalSlot] || []).length > 0) return; // Slot occupied

      // Remove from hand (gold deduction deferred to after chain — not charged if negated)
      ps.hand.splice(handIndex, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

      room.engine.log('artifact_equipped', { player: ps.username, card: cardName, hero: hero.name, cost });
      room.engine._trackTerrorResolvedEffect(pi, cardName);

      (async () => {
        try {
          // Broadcast card to opponent BEFORE chain
          const oi = pi === 0 ? 1 : 0;
          const oppSid = gs.players[oi]?.socketId;
          if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
          sendToSpectators(room, 'card_reveal', { cardName });
          await new Promise(r => setTimeout(r, 100));

          // Execute with reaction window (Tool Freezer can react to this)
          const chainResult = await room.engine.executeCardWithChain({
            cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
            resolve: async () => {
              // Deduct gold on resolve (not negated)
              if (cost > 0) ps.gold -= cost;

              // Safe placement — handles zone-occupied fallback (Slippery Fridge, etc.)
              const result = room.engine.safePlaceInSupport(cardName, pi, heroIdx, finalSlot);
              if (!result) {
                // No free zones — card fizzles, goes to discard
                ps.discardPile.push(cardName);
                room.engine.log('equip_fizzle', { card: cardName, reason: 'zone_occupied_by_chain' });
                return true;
              }

              const { inst, actualSlot } = result;
              await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualSlot });
              await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
              return true;
            },
          });

          if (chainResult.negated) {
            // Negated → card goes to discard, gold NOT deducted
            ps.discardPile.push(cardName);
          }
        } catch (err) {
          console.error('[Engine] play_artifact hooks error:', err.message);
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      })();
    }
  });

  // ── Potion system ──

  // Start using a potion (enters targeting mode if needed)
  socket.on('use_potion', ({ roomId, cardName, handIndex }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Main Phase only
    if (gs.potionTargeting) return; // Already targeting

    const ps = gs.players[pi];
    if (ps.potionLocked) return; // Potion lock active (hero ability threshold reached)
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;
    if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return; // This specific card is resolving

    const cardData = getCardDB()[cardName];
    if (!cardData || cardData.cardType !== 'Potion') return;

    // Load card script for targeting
    const script = loadCardEffect(cardName);
    if (!script?.isPotion) return;
    if (script.canActivate && !script.canActivate(gs, pi)) return;

    // Generic draw/search lock
    if (script.blockedByHandLock && ps.handLocked) return;

    if (script.getValidTargets && script.targetingConfig) {
      // Targeting mode — compute valid targets and send to clients
      const validTargets = script.getValidTargets(gs, pi, room.engine);
      gs.potionTargeting = {
        potionName: cardName,
        handIndex,
        ownerIdx: pi,
        cardType: 'Potion',
        validTargets,
        config: script.targetingConfig,
      };
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    } else {
      // No targeting needed — mark this specific card instance as resolving
      const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
      ps._resolvingCard = { name: cardName, nth };

      // Execute with reaction window (async)
      (async () => {
        // Broadcast card to opponent BEFORE resolving (unless script handles it manually)
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;
        if (!script.deferBroadcast) {
          if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
          sendToSpectators(room, 'card_reveal', { cardName });
          await new Promise(r => setTimeout(r, 100));
        }

        room.engine._setPendingPlayLog('card_played', { player: ps.username, card: cardName, cardType: 'Potion', cost: 0 });

        let chainResult;
        try {
          chainResult = await room.engine.executeCardWithChain({
            cardName, owner: pi, cardType: 'Potion', goldCost: 0,
            resolve: script.resolve ? async () => await script.resolve(room.engine, pi, [], []) : null,
          });
        } catch (err) {
          console.error('[Engine] Potion chain error:', err.message);
          chainResult = { negated: false, chainFormed: false };
        }
        await new Promise(r => setTimeout(r, 100));
        // If the effect was cancelled (player backed out), unmark and keep in hand
        if (chainResult.resolveResult?.cancelled) {
          ps._resolvingCard = null;
          delete gs._pendingPlayLog;
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }
        room.engine._firePendingPlayLog();
        const currentIdx = getResolvingHandIndex(ps);
        ps._resolvingCard = null;
        if (currentIdx >= 0) {
          ps.hand.splice(currentIdx, 1);
          if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
          if (chainResult.negated) {
            ps.discardPile.push(cardName);
          } else if (chainResult.resolveResult?.placed) {
            checkPotionLock(ps, gs, pi);
          } else {
            // Fire afterPotionUsed hook — Biomancy etc. can intercept and place the potion
            const potionHookCtx = { potionName: cardName, potionOwner: pi, placed: false, _skipReactionCheck: true };
            await room.engine.runHooks('afterPotionUsed', potionHookCtx);
            if (potionHookCtx.placed) {
              // Potion was converted to a Token and placed on the board
              checkPotionLock(ps, gs, pi);
            } else {
              ps.deletedPile.push(cardName);
              checkPotionLock(ps, gs, pi);
            }
          }
        } else {
          // Card was already removed from hand during resolution (e.g. self-discarded)
          // Still count potion lock but don't double-add to piles
          if (!chainResult.negated && !chainResult.resolveResult?.placed) checkPotionLock(ps, gs, pi);
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      })();
    }
  });

  // Use a non-equip artifact from hand (targeting mode)
  socket.on('use_artifact_effect', ({ roomId, cardName, handIndex }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return;
    if (gs.potionTargeting) return;

    const ps = gs.players[pi];
    if (ps.itemLocked) return; // Hammer Throw lock
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;
    if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return; // This specific card is resolving

    const cardData = getCardDB()[cardName];
    if (!cardData || cardData.cardType !== 'Artifact') return;
    if ((cardData.subtype || '').toLowerCase() === 'equipment') return; // Equips use play_artifact
    if ((cardData.subtype || '').toLowerCase() === 'reaction') return; // Reaction artifacts are not manually playable

    const cost = cardData.cost || 0;
    if ((ps.gold || 0) < cost) return;

    const script = loadCardEffect(cardName);
    if (!script) return;
    if (script.canActivate && !script.canActivate(gs, pi)) return;

    // Generic draw/search lock
    if (script.blockedByHandLock && ps.handLocked) return;

    if (script.getValidTargets && script.targetingConfig) {
      const validTargets = script.getValidTargets(gs, pi, room.engine);
      const config = typeof script.targetingConfig === 'function'
        ? script.targetingConfig(gs, pi, cost)
        : { ...script.targetingConfig };
      // Compute dynamic maxTotal if not set (for cards like Beer where cost scales with targets)
      if (script.manualGoldCost && !config.maxTotal) {
        config.maxTotal = cost > 0 ? Math.floor((ps.gold || 0) / cost) : 99;
      }
      gs.potionTargeting = {
        potionName: cardName,
        handIndex,
        ownerIdx: pi,
        cardType: 'Artifact',
        goldCost: cost,
        validTargets,
        config,
      };
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    } else if (script.resolve) {
      // No targeting needed — resolve directly (card handles its own prompts)
      const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
      ps._resolvingCard = { name: cardName, nth };

      (async () => {
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;
        if (!script.deferBroadcast) {
          gs._pendingCardReveal = { cardName, ownerIdx: pi };
        }

        room.engine._setPendingPlayLog('card_played', { player: ps.username, card: cardName, cardType: 'Artifact', cost: cost || 0 });

        let chainResult;
        try {
          chainResult = await room.engine.executeCardWithChain({
            cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
            resolve: async () => await script.resolve(room.engine, pi, [], []),
          });
        } catch (err) {
          console.error('[Engine] Artifact resolve error:', err.message);
          chainResult = { negated: false, chainFormed: false };
        }
        await new Promise(r => setTimeout(r, 100));

        if (chainResult.resolveResult?.cancelled) {
          delete gs._pendingCardReveal;
          delete gs._pendingPlayLog;
          ps._resolvingCard = null;
          for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
          return;
        }

        // Fire pending reveal if it wasn't consumed by a prompt
        if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
        else room.engine._firePendingPlayLog();

        if (cost > 0 && !script.manualGoldCost && !chainResult.negated) {
          ps.gold -= cost;
        }

        const currentIdx = getResolvingHandIndex(ps);
        ps._resolvingCard = null;
        if (currentIdx >= 0) {
          ps.hand.splice(currentIdx, 1);
          if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
          if (chainResult.negated) {
            ps.discardPile.push(cardName);
          } else if (script.deleteOnUse) {
            ps.deletedPile.push(cardName);
          } else {
            ps.discardPile.push(cardName);
          }
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      })();
    }
  });

  // Confirm potion/artifact targeting selection
  socket.on('confirm_potion', ({ roomId, selectedIds }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    if (!gs.potionTargeting) return;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.potionTargeting.ownerIdx) return;

    // Effect prompt (from card hooks like Icy Slime) — resolve engine promise
    if (gs.potionTargeting.isEffectPrompt) {
      room.engine.resolveEffectPrompt(selectedIds);
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return;
    }

    const { potionName, handIndex, validTargets, cardType, goldCost } = gs.potionTargeting;
    const script = loadCardEffect(potionName);
    if (!script) { gs.potionTargeting = null; return; }

    // Validate selection
    if (script.validateSelection && !script.validateSelection(selectedIds, validTargets)) return;

    const ps = gs.players[pi];

    // Gold check for artifacts (deduction deferred to after chain — not charged if negated)
    if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost) {
      if ((ps.gold || 0) < goldCost) return;
    }

    (async () => {
      // Clear targeting before resolve — resolve may use its own prompts
      gs.potionTargeting = null;

      room.engine.log('card_played', { player: ps.username, card: potionName, cardType: cardType, cost: goldCost || 0 });
      room.engine._trackTerrorResolvedEffect(pi, potionName);

      // Mark this specific card instance as resolving
      const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === potionName).length;
      ps._resolvingCard = { name: potionName, nth };

      // Broadcast card to opponent BEFORE resolving
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: potionName });
      sendToSpectators(room, 'card_reveal', { cardName: potionName });
      await new Promise(r => setTimeout(r, 100));

      // Execute with reaction window — defers resolve until chain resolves (if chain forms)
      let chainResult;
      try {
        chainResult = await room.engine.executeCardWithChain({
          cardName: potionName,
          owner: pi,
          cardType: cardType,
          goldCost: goldCost || 0,
          resolve: script.resolve
            ? async () => await script.resolve(room.engine, pi, selectedIds, validTargets)
            : null,
        });
      } catch (err) {
        console.error('[Engine] executeCardWithChain error:', err.message, err.stack);
        chainResult = { negated: false, chainFormed: false, resolveResult: null };
      }

      // Deduct gold for artifacts AFTER chain — only if NOT negated
      if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
        ps.gold -= goldCost;
      }

      if (chainResult.resolveResult?.aborted) {
        // Re-enter targeting mode — unmark resolving, card stays in hand
        ps._resolvingCard = null;
        const freshTargets = script.getValidTargets ? script.getValidTargets(gs, pi, room.engine) : validTargets;
        const config = typeof script.targetingConfig === 'function'
          ? script.targetingConfig(gs, pi, goldCost)
          : { ...script.targetingConfig };
        if (script.manualGoldCost && !config.maxTotal) {
          config.maxTotal = goldCost > 0 ? Math.floor((ps.gold || 0) / goldCost) : 99;
        }
        gs.potionTargeting = {
          potionName, handIndex, ownerIdx: pi, cardType, goldCost,
          validTargets: freshTargets, config,
        };
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        return;
      }

      if (chainResult.resolveResult?.cancelled) {
        // Fully cancelled — refund gold, card stays in hand
        if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
          ps.gold += goldCost; // Refund gold deducted above
        }
        ps._resolvingCard = null;
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        return;
      }

      // Brief delay so effect animations finish before pile assignment
      await new Promise(r => setTimeout(r, 100));

      // Remove the specific resolving card from hand, move to pile (single sync → triggers animation)
      const hi = getResolvingHandIndex(ps);
      ps._resolvingCard = null;
      if (hi >= 0) {
        ps.hand.splice(hi, 1);
        if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
        if (chainResult.negated) {
          ps.discardPile.push(potionName);
        } else if (cardType === 'Potion') {
          // Fire afterPotionUsed hook — Biomancy etc. can intercept
          const potionHookCtx = { potionName, potionOwner: pi, placed: false, _skipReactionCheck: true };
          await room.engine.runHooks('afterPotionUsed', potionHookCtx);
          if (!potionHookCtx.placed) {
            ps.deletedPile.push(potionName);
          }
          checkPotionLock(ps, gs, pi);
        } else {
          ps.discardPile.push(potionName);
        }
      } else {
        // Card was already removed from hand during resolution (e.g. self-discarded)
        if (!chainResult.negated && cardType === 'Potion') checkPotionLock(ps, gs, pi);
      }

      // Play target animation if card resolved (not negated) and has an animation
      if (!chainResult.negated && (script.animationType || 'explosion') !== 'none') {
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) io.to(sid).emit('potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
        }
        sendToSpectators(room, 'potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Broadcast targeting selections to opponent
  socket.on('targeting_update', ({ roomId, selectedIds }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_targeting', { selectedIds });
    sendToSpectators(room, 'opponent_targeting', { selectedIds });
  });

  // Card ping — broadcast to opponent and spectators
  socket.on('ping_card', ({ roomId, ping, color }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    // Flip perspective for opponent: sender's "me" → opponent's "opp" and vice versa
    const flipped = { ...ping };
    if (flipped.owner === 'me') flipped.owner = 'opp';
    else if (flipped.owner === 'opp') flipped.owner = 'me';
    if (flipped.type === 'hand-me') flipped.type = 'hand-opp';
    else if (flipped.type === 'hand-opp') flipped.type = 'hand-me';
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('ping_card', { ping: flipped, color });
    // Spectators see from player 0's perspective — translate accordingly
    const specPing = pi === 0 ? { ...ping } : { ...flipped };
    sendToSpectators(room, 'ping_card', { ping: specPing, color });
    // Echo back to sender unchanged (their perspective is already correct)
    socket.emit('ping_card', { ping, color });
  });

  // ─── CHAT SYSTEM ──────────────────────────
  socket.on('chat_message', ({ roomId, text }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = (text || '').slice(0, 500).trim();
    if (!msg) return;
    const isPlayer = room.players.some(p => p.userId === currentUser.userId);
    const isSpec = room.spectators.some(s => s.userId === currentUser.userId);
    if (!isPlayer && !isSpec) return;
    // Look up player's in-game color from gameState
    const gsPlayer = room.gameState?.players?.find(ps => ps.userId === currentUser.userId);
    const playerColor = gsPlayer?.color || currentUser.color || '#00f0ff';
    const entry = {
      id: Date.now() + Math.random(),
      username: currentUser.username,
      color: isSpec ? '#888' : playerColor,
      avatar: gsPlayer?.avatar || currentUser.avatar || null,
      isSpectator: isSpec,
      text: msg,
      timestamp: Date.now(),
    };
    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(entry);
    // Broadcast to all in room
    const allSids = [];
    for (const p of room.players) { if (p.socketId) allSids.push(p.socketId); }
    if (room.gameState) {
      for (const ps of room.gameState.players) { if (ps.socketId && !allSids.includes(ps.socketId)) allSids.push(ps.socketId); }
    }
    for (const s of (room.spectators || [])) { if (s.socketId) allSids.push(s.socketId); }
    for (const sid of new Set(allSids)) { io.to(sid).emit('chat_message', entry); }
    // Check for @pings
    const pingRegex = /@(\S+)/g;
    let match;
    while ((match = pingRegex.exec(msg)) !== null) {
      const target = match[1].toLowerCase();
      // Find target user in room
      let targetSid = null, targetColor = currentUser.color || '#00f0ff';
      for (const p of room.players) { if (p.username.toLowerCase() === target && p.socketId) { targetSid = p.socketId; break; } }
      if (!targetSid && room.gameState) {
        for (const ps of room.gameState.players) { if (ps.username?.toLowerCase() === target && ps.socketId) { targetSid = ps.socketId; break; } }
      }
      if (!targetSid) {
        for (const s of (room.spectators || [])) { if (s.username.toLowerCase() === target && s.socketId) { targetSid = s.socketId; break; } }
      }
      if (targetSid) {
        io.to(targetSid).emit('chat_ping', { from: currentUser.username, color: isSpec ? '#aaaaaa' : (currentUser.color || '#00f0ff') });
      }
    }
  });

  socket.on('chat_private', ({ roomId, targetUsername, text }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = (text || '').slice(0, 500).trim();
    if (!msg) return;
    const entry = {
      id: Date.now() + Math.random(),
      from: currentUser.username,
      to: targetUsername,
      color: currentUser.color || '#00f0ff',
      avatar: currentUser.avatar || null,
      isSpectator: room.spectators.some(s => s.userId === currentUser.userId),
      text: msg,
      timestamp: Date.now(),
    };
    if (!room.privateChatHistory) room.privateChatHistory = {};
    const pairKey = [currentUser.username, targetUsername].sort().join('::');
    if (!room.privateChatHistory[pairKey]) room.privateChatHistory[pairKey] = [];
    room.privateChatHistory[pairKey].push(entry);
    // Send to both participants
    socket.emit('chat_private', entry);
    // Find target socket
    let targetSid = null;
    for (const p of room.players) { if (p.username === targetUsername && p.socketId) { targetSid = p.socketId; break; } }
    if (!targetSid && room.gameState) {
      for (const ps of room.gameState.players) { if (ps.username === targetUsername && ps.socketId) { targetSid = ps.socketId; break; } }
    }
    if (!targetSid) {
      for (const s of (room.spectators || [])) { if (s.username === targetUsername && s.socketId) { targetSid = s.socketId; break; } }
    }
    if (targetSid) io.to(targetSid).emit('chat_private', entry);
  });

  socket.on('request_chat_history', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    socket.emit('chat_history', {
      main: room.chatHistory || [],
      private: room.privateChatHistory || {},
    });
  });

  // Relay pending creature placement (for additional action selection visual)
  socket.on('pending_placement', ({ roomId, heroIdx, zoneSlot, cardName }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_pending_placement', { owner: pi, heroIdx, zoneSlot, cardName });
    sendToSpectators(room, 'opponent_pending_placement', { owner: pi, heroIdx, zoneSlot, cardName });
  });
  socket.on('pending_placement_clear', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_pending_placement', null);
    sendToSpectators(room, 'opponent_pending_placement', null);
  });

  // Cancel potion targeting
  socket.on('cancel_potion', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.potionTargeting) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.potionTargeting.ownerIdx) return;
    room.gameState.potionTargeting = null;
    // Resolve the engine's pending prompt so the play_spell handler can reach its cancel path
    if (room.engine) room.engine.resolveEffectPrompt([]);
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  });

  // General-purpose effect prompt response (confirm, card gallery, zone pick)
  socket.on('effect_prompt_response', ({ roomId, response }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState?.effectPrompt) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.effectPrompt.ownerIdx) return;
    // Reject force-discard of the specific resolving card instance
    const epType = room.gameState.effectPrompt.type;
    if ((epType === 'forceDiscard' || epType === 'forceDiscardCancellable') && response?.handIndex != null) {
      const ps = room.gameState.players[pi];
      if (ps._resolvingCard && response.handIndex === getResolvingHandIndex(ps)) return;
    }
    room.engine.resolveGenericPrompt(response);
  });

  // Relay blind-pick selection to the victim so they see highlighted cards
  socket.on('blind_pick_update', ({ roomId, indices }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oppIdx]?.socketId;
    if (oppSid) io.to(oppSid).emit('blind_pick_highlight', { indices: indices || [] });
  });

  // ── Side-Deck Phase Handlers (Bo3/Bo5) ──

  socket.on('side_deck_swap', ({ roomId, from, fromIdx, to, toIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    const deck = room._currentDecks[pi];
    if (!deck) return;

    const getPool = (key) => {
      if (key === 'main') return deck.mainDeck;
      if (key === 'potion') return deck.potionDeck;
      if (key === 'side') return deck.sideDeck;
      if (key === 'hero') return null; // handled separately
      return null;
    };

    // Hero swap: swap entire hero slot with a hero from side deck
    if (from === 'hero' || to === 'hero') {
      const heroKey = from === 'hero' ? from : to;
      const sideKey = from === 'hero' ? to : from;
      const heroSlotIdx = from === 'hero' ? fromIdx : toIdx;
      const sideIdx = from === 'hero' ? toIdx : fromIdx;
      if (sideKey !== 'side') return;
      if (heroSlotIdx < 0 || heroSlotIdx >= (deck.heroes || []).length) return;
      if (sideIdx < 0 || sideIdx >= (deck.sideDeck || []).length) return;

      const cardDB = getCardDB();
      const sideCardName = deck.sideDeck[sideIdx];

      // Side card must be a Hero
      if (!canCardTypeEnterPool(cardDB, deck, sideCardName, 'hero')) return;

      const oldHero = deck.heroes[heroSlotIdx];
      const oldHeroName = oldHero?.hero;

      // Simulate deck state after swap to check Nicolas-dependent rules
      const simHeroes = (deck.heroes || []).map((h, i) =>
        i === heroSlotIdx ? { hero: sideCardName } : h
      );
      const simDeck = { ...deck, heroes: simHeroes };
      // If main deck has potions, Nicolas must still be present after swap
      const mainPotions = (deck.mainDeck || []).filter(n => cardDB[n]?.cardType === 'Potion');
      if (mainPotions.length > 0 && !simDeck.heroes.some(h => h?.hero === 'Nicolas, the Hidden Alchemist')) return;

      // Find starting abilities for the new hero from card data
      const newHeroData = cardDB[sideCardName];
      const newAbility1 = newHeroData.startingAbility1 || null;
      const newAbility2 = newHeroData.startingAbility2 || null;

      // Swap hero into side deck, side card into hero slot
      deck.heroes[heroSlotIdx] = { hero: sideCardName, ability1: newAbility1, ability2: newAbility2 };
      deck.sideDeck[sideIdx] = oldHeroName || '';
      // Remove empty strings from side deck
      deck.sideDeck = deck.sideDeck.filter(c => c);
      if (oldHeroName) deck.sideDeck.push(oldHeroName);
    } else {
      // Card swap between main/potion ↔ side
      const fromPool = getPool(from);
      const toPool = getPool(to);
      if (!fromPool || !toPool) return;
      if (fromIdx < 0 || fromIdx >= fromPool.length) return;
      if (toIdx < 0 || toIdx >= toPool.length) return;

      // No direct main↔potion
      if ((from === 'main' && to === 'potion') || (from === 'potion' && to === 'main')) return;

      const cardDB = getCardDB();
      const fromCardName = fromPool[fromIdx];
      const toCardName = toPool[toIdx];

      // Simulate deck state after swap for Nicolas-dependent checks
      const simDeck = { ...deck, heroes: [...(deck.heroes || [])] };

      // Validate both directions using shared type rules
      if (!canCardTypeEnterPool(cardDB, simDeck, fromCardName, to)) return;
      if (!canCardTypeEnterPool(cardDB, simDeck, toCardName, from)) return;

      // Swap the cards
      const tmp = fromPool[fromIdx];
      fromPool[fromIdx] = toPool[toIdx];
      toPool[toIdx] = tmp;
    }

    // Send updated deck back to the player
    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: deck,
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  // Move a card from one pool to another (not swap — add/remove)
  socket.on('side_deck_move', ({ roomId, from, fromIdx, to }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    const deck = room._currentDecks[pi];
    if (!deck) return;

    const getPool = (key) => {
      if (key === 'main') return deck.mainDeck;
      if (key === 'potion') return deck.potionDeck;
      if (key === 'side') return deck.sideDeck;
      return null;
    };

    const fromPool = getPool(from);
    const toPool = getPool(to);
    if (!fromPool || !toPool || from === to) return;
    if (fromIdx < 0 || fromIdx >= fromPool.length) return;

    const cardDB = getCardDB();
    const cardName = fromPool[fromIdx];

    // No direct main↔potion
    if ((from === 'main' && to === 'potion') || (from === 'potion' && to === 'main')) return;
    // Validate using shared type rules
    if (!canCardTypeEnterPool(cardDB, deck, cardName, to)) return;

    const card = fromPool.splice(fromIdx, 1)[0];
    toPool.push(card);

    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: deck,
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  socket.on('side_deck_reset', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._originalDecks || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    // Deep clone original back to current
    room._currentDecks[pi] = JSON.parse(JSON.stringify(room._originalDecks[pi]));

    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: room._currentDecks[pi],
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  socket.on('side_deck_done', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._sideDeckDone) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0) return;

    room._sideDeckDone[pi] = true;

    // Notify opponent
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState?.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('side_deck_opponent_done');

    // If both done, proceed to next game
    if (room._sideDeckDone[0] && room._sideDeckDone[1]) {
      room._sideDeckPhase = false;
      delete room._sideDeckDone;
      const loserIdx = room._pendingLoserIdx ?? 0;
      delete room._pendingLoserIdx;
      await advanceToNextGame(room, loserIdx);
    }
  });

  // ── Surrender Game vs Surrender Match (Bo3/Bo5) ──

  socket.on('surrender_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState || room.gameState.result) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Surrender just this game (set continues)
    await endGame(room, pi === 0 ? 1 : 0, 'surrender');
  });

  socket.on('surrender_match', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const winnerIdx = pi === 0 ? 1 : 0;
    // Set the winner's score to winsNeeded to end the set
    room.setScore[winnerIdx] = room.winsNeeded;
    if (!room.gameState.result) {
      await endGame(room, winnerIdx, 'surrender');
    }
  });

  socket.on('request_rematch', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.result) return;
    if (!room.gameState.rematchRequests.includes(currentUser.userId))
      room.gameState.rematchRequests.push(currentUser.userId);
    if (room.gameState.rematchRequests.length >= 2) {
      const loserIdx = room.gameState.result.winnerIdx === 0 ? 1 : 0;
      // Set up fresh game state FIRST so both players see their new hands
      await setupGameState(room);
      for(let i=0;i<2;i++) sendGameState(room, i); sendSpectatorGameState(room);
      // Now ask the loser who goes first — no time limit
      const loserPs = room.gameState.players[loserIdx];
      if (loserPs?.socketId) {
        room._pendingRematch = { roomId, loserIdx };
        io.to(loserPs.socketId).emit('rematch_choose_first', {});
      } else {
        await startGameEngine(room, roomId, loserIdx);
      }
    } else {
      for (let i=0;i<2;i++) sendGameState(room, i);
    }
  });

  socket.on('rematch_first_choice', async ({ roomId, goFirst }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?._pendingRematch) return;
    const { loserIdx } = room._pendingRematch;
    const loserPs = room.gameState?.players?.[loserIdx];
    if (!loserPs || loserPs.userId !== currentUser.userId) return;
    if (room._rematchTimer) { clearTimeout(room._rematchTimer); delete room._rematchTimer; }
    delete room._pendingRematch;
    const activePlayer = goFirst ? loserIdx : (loserIdx === 0 ? 1 : 0);
    await startGameEngine(room, roomId, activePlayer);
  });

  socket.on('leave_room', ({ roomId }) => handleLeaveRoom(socket, roomId, currentUser));

  // Debug: add a card to a player's hand
  socket.on('disconnect', () => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (activeRoomId) {
      const room = rooms.get(activeRoomId);
      if (room?.gameState && !room.gameState.result) {
        const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
        if (pi >= 0) {
          room.gameState.players[pi].disconnected = true;
          const oi = pi===0?1:0;
          sendGameState(room, oi);
          sendSpectatorGameState(room);
          const timer = setTimeout(() => {
            disconnectTimers.delete(currentUser.userId);
            if (room.gameState && !room.gameState.result) endGame(room, oi, 'disconnect_timeout').catch(e => console.error('[endGame] error:', e.message));
            activeGames.delete(currentUser.userId);
          }, 60000);
          disconnectTimers.set(currentUser.userId, timer);
        }
        return;
      }
    }
    for (const [rid, room] of rooms) {
      if (room.players.some(p => p.username === currentUser.username) || room.spectators.some(s => s.username === currentUser.username))
        handleLeaveRoom(socket, rid, currentUser);
    }
  });
});

function handleLeaveRoom(socket, roomId, user) {
  if (!user) return;
  const room = rooms.get(roomId);
  if (!room) return;

  socket.leave('room:' + roomId);

  if (room.hostId === user.userId) {
    // Host leaves = destroy room
    rooms.delete(roomId);
    io.to('room:' + roomId).emit('room_closed');
  } else {
    room.players = room.players.filter(p => p.username !== user.username);
    room.spectators = room.spectators.filter(s => s.username !== user.username);
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
  }
  io.emit('rooms', getRoomList());
}

function getRoomList() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id, host: r.host, type: r.type, format: r.format || 1,
    hasPlayerPw: !!r.playerPw, hasSpecPw: !!r.specPw,
    playerCount: r.players.length,
    spectatorCount: r.spectators.length,
    status: r.status, created: r.created,
    players: r.players.map(p => p.username),
  }));
}

function sanitizeRoom(room, forUser) {
  return {
    id: room.id, host: room.host, type: room.type, format: room.format || 1,
    hasPlayerPw: !!room.playerPw, hasSpecPw: !!room.specPw,
    players: room.players.map(p => p.username),
    spectators: room.spectators.map(s => s.username),
    status: room.status, created: room.created,
    isHost: forUser === room.host,
  };
}

// ===== CATCH-ALL (SPA) =====
app.get('*', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START =====
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Pixel Parties TCG running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[DB] Failed to initialize database:', err);
  process.exit(1);
});
