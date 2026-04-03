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

  console.log('[DB] Tables initialized');
}

// ===== AUTH MIDDLEWARE =====
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
  await db.run('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', [id, username.trim(), hash]);

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
  res.json({ user: sanitizeUser(user), token: req.authToken });
});

function sanitizeUser(u) {
  return { id: u.id, username: u.username, elo: u.elo, color: u.color, avatar: u.avatar, cardback: u.cardback, bio: u.bio || '', wins: u.wins || 0, losses: u.losses || 0, created_at: u.created_at };
}

// ===== PROFILE ROUTES =====
app.put('/api/profile', authMiddleware, async (req, res) => {
  const { color, avatar, cardback, bio } = req.body;
  await db.run('UPDATE users SET color = ?, avatar = ?, cardback = ?, bio = ? WHERE id = ?', [color || '#00f0ff', avatar || null, cardback || null, (bio || '').slice(0, 200), req.user.userId]);
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
    // Pick a random card from the deck to represent it
    const allCards = [...main, ...heroes.map(h => h.hero), ...potions];
    const repCard = allCards.length > 0 ? allCards[Math.floor(Math.random() * allCards.length)] : null;
    return { id: d.id, name: d.name, legal, isDefault: !!d.is_default, repCard, cardCount: main.length };
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

// Build reverse lookup: filename-safe name (no commas) → actual card name
const cardsJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
const nameByStripped = {};
cardsJson.forEach(c => { nameByStripped[c.name.replace(/,/g, '')] = c.name; });

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
        const realName = nameByStripped[stem] || stem;
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
  const { name, mainDeck, heroes, potionDeck, sideDeck, isDefault } = req.body;
  const deckRow = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!deckRow) return res.status(404).json({ error: 'Deck not found' });

  if (isDefault) await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);

  await db.run('UPDATE decks SET name=?, main_deck=?, heroes=?, potion_deck=?, side_deck=?, is_default=?, updated_at=unixepoch() WHERE id=? AND user_id=?', [
    name || deckRow.name,
    JSON.stringify(mainDeck || JSON.parse(deckRow.main_deck)),
    JSON.stringify(heroes || JSON.parse(deckRow.heroes)),
    JSON.stringify(potionDeck || JSON.parse(deckRow.potion_deck)),
    JSON.stringify(sideDeck || JSON.parse(deckRow.side_deck)),
    isDefault ? 1 : (isDefault === false ? 0 : deckRow.is_default),
    req.params.id, req.user.userId
  ]);

  const updated = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ deck: parseDeck(updated) });
});

app.post('/api/decks/:id/saveas', authMiddleware, async (req, res) => {
  const { name } = req.body;
  const original = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!original) return res.status(404).json({ error: 'Deck not found' });

  const newId = uuidv4();
  await db.run('INSERT INTO decks (id, user_id, name) VALUES (?, ?, ?)', [newId, req.user.userId, name || original.name + ' (Copy)']);
  await db.run('UPDATE decks SET name=?, main_deck=?, heroes=?, potion_deck=?, side_deck=?, is_default=?, updated_at=unixepoch() WHERE id=? AND user_id=?', [
    name || original.name + ' (Copy)',
    original.main_deck, original.heroes, original.potion_deck, original.side_deck, 0,
    newId, req.user.userId
  ]);

  const newDeck = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [newId, req.user.userId]);
  res.json({ deck: parseDeck(newDeck) });
});

app.delete('/api/decks/:id', authMiddleware, async (req, res) => {
  await db.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

function parseDeck(row) {
  return {
    id: row.id,
    name: row.name,
    mainDeck: JSON.parse(row.main_deck),
    heroes: JSON.parse(row.heroes),
    potionDeck: JSON.parse(row.potion_deck),
    sideDeck: JSON.parse(row.side_deck),
    isDefault: !!row.is_default,
  };
}

// ===== GAME ROOMS (Socket.io) =====
const rooms = new Map();
const activeGames = new Map(); // userId -> roomId
const disconnectTimers = new Map(); // userId -> timeout handle

function sendGameState(room, playerIdx, extra) {
  const p = room.players[playerIdx];
  if (!p?.socketId) return;
  const gs = room.gameState;
  if (!gs) return;
  const state = {
    myIndex: playerIdx, roomId: room.id,
    players: gs.players.map((ps, pi) => ({
      username: ps.username, color: ps.color, avatar: ps.avatar,
      heroes: ps.heroes, abilityZones: ps.abilityZones,
      surpriseZones: ps.surpriseZones, supportZones: ps.supportZones,
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
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: ps.potionLocked || false,
      permanents: ps.permanents || [],
      divineGiftUsed: ps.divineGiftUsed || false,
    })),
    areaZones: gs.areaZones, turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: gs.customPlacementCards || [],
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    potionTargeting: gs.potionTargeting || null,
    effectPrompt: gs.effectPrompt || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      for (const inst of room.engine.cardInstances) {
        if (inst.zone === 'support' && Object.keys(inst.counters).length > 0) {
          cc[`${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`] = { ...inst.counters };
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
    unactivatableArtifacts: room.engine ? room.engine.getUnactivatableArtifacts(playerIdx) : [],
    blockedSpells: room.engine ? room.engine.getBlockedSpells(playerIdx) : [],
    activatableAbilities: room.engine ? room.engine.getActivatableAbilities(playerIdx) : [],
    freeActivatableAbilities: room.engine ? room.engine.getFreeActivatableAbilities(playerIdx) : [],
    activeHeroEffects: room.engine ? room.engine.getActiveHeroEffects(playerIdx) : [],
    ...extra,
  };
  io.to(p.socketId).emit('game_state', state);
}

async function endGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const isRanked = room.type === 'ranked';
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  const wUser = await db.get('SELECT * FROM users WHERE id = ?', [winner.userId]);
  const lUser = await db.get('SELECT * FROM users WHERE id = ?', [loser.userId]);
  const wElo = wUser?.elo || 1000; const lElo = lUser?.elo || 1000;
  let newWElo = wElo, newLElo = lElo;

  if (isRanked) {
    const K = 32;
    const expectedW = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
    newWElo = Math.round(wElo + K * (1 - expectedW));
    newLElo = Math.max(0, Math.round(lElo + K * (0 - (1 - expectedW))));
    await db.run('UPDATE users SET elo = ? WHERE id = ?', [newWElo, winner.userId]);
    await db.run('UPDATE users SET elo = ? WHERE id = ?', [newLElo, loser.userId]);
  }

  // Always track wins/losses and hero stats
  await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [winner.userId]);
  await db.run('UPDATE users SET losses = losses + 1 WHERE id = ?', [loser.userId]);
  for (const ps of [winner, loser]) {
    const won = ps === winner;
    for (const h of ps.heroes) {
      if (h.name) await db.run('INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', [ps.userId, h.name, won ? 1 : 0, won ? 0 : 1]);
    }
    await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), ps.userId, ps.heroes[0]?.name||null, ps.heroes[1]?.name||null, ps.heroes[2]?.name||null, won?1:0, (won?loser:winner).userId]);
  }
  gs.result = { winnerIdx, reason, winnerName: winner.username, loserName: loser.username, isRanked,
    eloChanges: isRanked ? [{ username: winner.username, oldElo: wElo, newElo: newWElo }, { username: loser.username, oldElo: lElo, newElo: newLElo }] : null };
  gs.rematchRequests = [];
  room.status = 'finished';
  for (let i = 0; i < 2; i++) sendGameState(room, i);
  io.emit('rooms', getRoomList());
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

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('auth', (token) => {
    const session = sessions.get(token);
    if (session) {
      currentUser = session;
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
            room.players[pi].socketId = socket.id;
            room.gameState.players[pi].socketId = socket.id;
            room.gameState.players[pi].disconnected = false;
            socket.join('room:' + activeRoomId);
            sendGameState(room, pi, { reconnected: true });
            const oi = pi === 0 ? 1 : 0;
            sendGameState(room, oi);
          }
        }
      }
    } else { socket.emit('auth_fail'); }
  });

  socket.on('get_rooms', () => socket.emit('rooms', getRoomList()));

  socket.on('create_room', ({ type, playerPw, specPw, deckId }) => {
    if (!currentUser) return;
    const roomId = uuidv4().substring(0, 8);
    const room = { id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: type||'unranked', playerPw: playerPw||null, specPw: specPw||null,
      players: [{ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: deckId||null }],
      spectators: [], status: 'waiting', created: Date.now(), gameState: null };
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
    if (isPlayer || isSpec) { socket.join('room:' + roomId); return socket.emit('room_joined', sanitizeRoom(room, currentUser.username)); }
    if (asSpectator) {
      if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Wrong spectator password');
      room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id });
    } else {
      if (room.players.length >= 2) {
        if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Game full');
        room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id });
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
  });

  socket.on('swap_to_spectator', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    room.players = room.players.filter(p => p.username !== currentUser.username);
    room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id });
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

  socket.on('start_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== currentUser.userId || room.players.length < 2) return;
    const activePlayer = Math.random() < 0.5 ? 0 : 1;
    await setupGameState(room);
    startGameEngine(room, roomId, activePlayer);
  });

  /** Set up fresh game state: decks, hands, heroes — but don't start the engine or turns. */
  async function setupGameState(room) {
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardsByName = {}; allCards.forEach(c => { cardsByName[c.name] = c; });
    const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

    const playerStates = [];
    for (const p of room.players) {
      const deckRow = p.deckId ? await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [p.deckId, p.userId]) : null;
      const deck = deckRow ? parseDeck(deckRow) : null;
      const usr = await db.get('SELECT * FROM users WHERE id = ?', [p.userId]);
      const heroes = (deck?.heroes||[]).map(h => {
        const c = h.hero ? cardsByName[h.hero] : null;
        return { name:h.hero, hp:c?.hp||0, maxHp:c?.hp||0, atk:c?.atk||0, baseAtk:c?.atk||0, ability1:h.ability1||null, ability2:h.ability2||null, statuses:{} };
      });
      const abilityZones = heroes.map(h => {
        const z=[[],[],[]];
        if(h.ability1&&h.ability2&&h.ability1===h.ability2){z[0]=[h.ability1,h.ability2];}
        else{if(h.ability1)z[0]=[h.ability1];if(h.ability2)z[1]=[h.ability2];}
        return z;
      });
      const mainDeck = shuffle(deck?.mainDeck||[]);
      const potionDeck = shuffle(deck?.potionDeck||[]);
      const hand = mainDeck.splice(0, 5);
      playerStates.push({ userId:p.userId, username:p.username, socketId:p.socketId,
        color:usr?.color||'#00f0ff', avatar:usr?.avatar||null,
        heroes, abilityZones, surpriseZones:[[],[],[]], supportZones:[[[],[],[]],[[],[],[]],[[],[],[]]],
        hand, mainDeck, potionDeck, discardPile:[], deletedPile:[], disconnected:false, left:false, gold:0,
        abilityGivenThisTurn:[false,false,false], islandZoneCount:[0,0,0],
        damageLocked:false, dealtDamageToOpponent:false, potionLocked:false, potionsUsedThisTurn:0,
        permanents:[], divineGiftUsed:false });
    }
    room.gameState = { players:playerStates, areaZones:[[],[]], turn:0, activePlayer:0, currentPhase:0, result:null, rematchRequests:[], awaitingFirstChoice:true };
    room.status = 'playing';
    room.players.forEach(p => activeGames.set(p.userId, room.id));

    // ── DEBUG: Add Performance + Flying Island to both hands, set a random hero to 10 HP ──
    for (let pi = 0; pi < 2; pi++) {
      
    }
    const debugHeroPlayer = Math.floor(Math.random() * 2);
    const debugHeroIdx = Math.floor(Math.random() * 3);
    if (playerStates[debugHeroPlayer].heroes[debugHeroIdx]) {
      playerStates[debugHeroPlayer].heroes[debugHeroIdx].hp = 10;
    }
    // ── END DEBUG ──
  }

  /** Start the engine and first turn with a chosen active player. */
  function startGameEngine(room, roomId, activePlayer) {
    room.gameState.activePlayer = activePlayer;
    room.gameState.turn = 1;
    room.gameState.awaitingFirstChoice = false;
    room.engine = new GameEngine(room, io, sendGameState, endGame);
    room.engine.init();
    for(let i=0;i<2;i++) sendGameState(room, i);
    room.engine.startGame().catch(err => console.error('[Engine] startGame error:', err.message));
    io.to('room:' + room.id).emit('game_started', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  }

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
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
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
    ps.abilityGivenThisTurn[heroIdx] = true;

    // Track in engine — find which zone the card ended up in
    const finalZone = abZones.findIndex(z => (z || []).includes(cardName));
    const inst = room.engine._trackCard(cardName, pi, 'ability', heroIdx, Math.max(0, finalZone));

    // Fire hooks and WAIT for them to resolve (including damage effects) before syncing
    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx });
      } catch (err) {
        console.error('[Engine] play_ability hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Activate an action-costing ability on the board
  socket.on('activate_ability', ({ roomId, heroIdx, zoneIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;

    const ps = gs.players[pi];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

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

    // Check if action is available
    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    const hasAdditional = isMainPhase && room.engine.hasAdditionalActionForCategory(pi, 'ability_activation');
    if (!isActionPhase && !hasAdditional) return;

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[hoptKey] = gs.turn;

    (async () => {
      try {
        // Create a context for the ability
        const inst = room.engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
        );
        if (!inst) return;
        const ctx = room.engine._createContext(inst, {});

        // Play shine animation on the ability
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) io.to(sid).emit('ability_activated', { owner: pi, heroIdx, zoneIdx, abilityName });
        }

        // Run the activation
        await script.onActivate(ctx, level);

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
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Activate a free-activation ability (no action cost, Main Phase only)
  // Generic handler — individual ability logic lives in the card script's onFreeActivate.
  socket.on('activate_free_ability', ({ roomId, heroIdx, zoneIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Main Phase only

    const ps = gs.players[pi];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return;

    const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
    if (!abilitySlot || abilitySlot.length === 0) return;
    const abilityName = abilitySlot[0];
    const level = abilitySlot.length;

    const { loadCardEffect } = require('./cards/effects/_loader');
    const script = loadCardEffect(abilityName);
    if (!script?.freeActivation || !script?.onFreeActivate) return;

    // Check HOPT (by ability name — blocks all copies for this player)
    const hoptKey = `free-ability:${abilityName}:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

    // Check canFreeActivate (don't claim HOPT yet — effect might cancel)
    if (script.canFreeActivate) {
      const inst = room.engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
      );
      if (!inst) return;
      const ctx = room.engine._createContext(inst, { event: 'canFreeActivateCheck' });
      if (!script.canFreeActivate(ctx, level)) return;
    }

    (async () => {
      try {
        const inst = room.engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
        );
        if (!inst) return;

        const ctx = room.engine._createContext(inst, {});
        // onFreeActivate returns true if the effect resolved (HOPT should be claimed)
        const resolved = await script.onFreeActivate(ctx, level);

        // Only claim HOPT if the effect actually resolved (not cancelled)
        if (resolved !== false) {
          // Generic "ability activated" flash — visible to both players
          room.engine._broadcastEvent('ability_activated', { owner: pi, heroIdx, zoneIdx });

          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[hoptKey] = gs.turn;
        }
      } catch (err) {
        console.error('[Engine] activate_free_ability error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Activate a hero's active effect (Main Phase, no action cost)
  socket.on('activate_hero_effect', ({ roomId, heroIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return;

    const ps = gs.players[pi];
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

    const { loadCardEffect } = require('./cards/effects/_loader');
    const script = loadCardEffect(hero.name);
    if (!script?.heroEffect || !script?.onHeroEffect) return;

    const hoptKey = `hero-effect:${hero.name}:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

    if (script.canActivateHeroEffect) {
      const inst = room.engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx
      );
      if (!inst) return;
      const ctx = room.engine._createContext(inst, { event: 'canHeroEffectCheck' });
      if (!script.canActivateHeroEffect(ctx)) return;
    }

    (async () => {
      try {
        const inst = room.engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'hero' && c.heroIdx === heroIdx
        );
        if (!inst) return;

        const ctx = room.engine._createContext(inst, {});
        const resolved = await script.onHeroEffect(ctx);

        if (resolved !== false) {
          if (!gs.hoptUsed) gs.hoptUsed = {};
          gs.hoptUsed[hoptKey] = gs.turn;
        }
      } catch (err) {
        console.error('[Engine] activate_hero_effect error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Play a creature from hand to support zone
  socket.on('play_creature', ({ roomId, cardName, handIndex, heroIdx, zoneSlot, additionalActionProvider }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;

    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;

    // Must be Action Phase or Main Phase (with additional action)
    if (!isActionPhase && !isMainPhase) return;

    // Check for additional action coverage
    const additionalTypeId = room.engine.findAdditionalActionForCard(pi, cardName);
    const usingAdditional = !!additionalTypeId;

    // In Main Phase, MUST have additional action to play a creature
    if (isMainPhase && !usingAdditional) return;

    const ps = gs.players[pi];
    if (ps.summonLocked) return; // Summon lock active — can't summon creatures
    // Validate card is in hand
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    // Load card data
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
    if (!cardData || cardData.cardType !== 'Creature') return;

    // Validate hero
    const hero = ps.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return;

    // Validate spell school / level
    const level = cardData.level || 0;
    const countAbility = (school) => {
      let count = 0;
      for (const slot of (ps.abilityZones[heroIdx] || [])) {
        if (!slot || slot.length === 0) continue;
        const base = slot[0];
        for (const ab of slot) { if (ab === school) count++; else if (ab === 'Performance' && base === school) count++; }
      }
      return count;
    };
    if (cardData.spellSchool1 && countAbility(cardData.spellSchool1) < level) return;
    if (cardData.spellSchool2 && countAbility(cardData.spellSchool2) < level) return;

    // Check custom summoning conditions
    if ((gs.summonBlocked || []).includes(cardName)) return;

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
    ps.supportZones[heroIdx][zoneSlot] = [cardName];

    // Track card instance in engine
    const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, zoneSlot);

    // Emit summon effect highlight to both players for every creature
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('summon_effect', { owner: pi, heroIdx, zoneSlot, cardName });
    }

    // Fire hooks, wait for resolution, then advance phase (only if NOT using additional action)
    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
        // Trigger reaction check for creature summon (with creature as initial card in chain)
        await room.engine._checkReactionCards('onCreatureSummoned', {
          _initialCard: { cardName, owner: pi, cardType: 'Creature' },
        });
        // Only advance phase if this was a "real" action (not additional) during Action Phase
        if (isActionPhase && !usingAdditional) {
          await room.engine.advanceToPhase(pi, 4);
        }
      } catch (err) {
        console.error('[Engine] play_creature hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Play a spell or attack from hand (drag onto a hero)
  socket.on('play_spell', ({ roomId, cardName, handIndex, heroIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;

    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isActionPhase && !isMainPhase) return;

    const ps = gs.players[pi];
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
    if (!cardData || (cardData.cardType !== 'Spell' && cardData.cardType !== 'Attack')) return;

    // Validate hero can cast this spell (spell school / level)
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return;
    const level = cardData.level || 0;
    if (level > 0 || cardData.spellSchool1) {
      const abZones = ps.abilityZones[heroIdx] || [];
      const countAb = (school) => { let c = 0; for (const s of abZones) { if (!s || s.length === 0) continue; const base = s[0]; for (const a of s) { if (a === school) c++; else if (a === 'Performance' && base === school) c++; } } return c; };
      if (cardData.spellSchool1 && countAb(cardData.spellSchool1) < level) return;
      if (cardData.spellSchool2 && countAb(cardData.spellSchool2) < level) return;
    }

    // Check custom play conditions (Flame Avalanche, etc.)
    const { loadCardEffect } = require('./cards/effects/_loader');
    const script = loadCardEffect(cardName);
    if (script?.spellPlayCondition && !script.spellPlayCondition(gs, pi)) return;

    // Divine Gift: once per game
    if (cardName.startsWith('Divine Gift') && ps.divineGiftUsed) return;

    // Check if this is an inherent action (doesn't need additional action, doesn't consume Action Phase)
    const isInherentAction = typeof script?.inherentAction === 'function'
      ? script.inherentAction(gs, pi, heroIdx, room.engine)
      : script?.inherentAction === true;

    // Check if this needs an additional action (Main Phase play)
    const needsAdditional = isMainPhase && !isInherentAction;
    let additionalConsumed = false;
    let consumedInst = null;
    if (needsAdditional) {
      const typeId = room.engine.findAdditionalActionForCard(pi, cardName);
      if (!typeId) return; // No additional action available
      consumedInst = room.engine.consumeAdditionalAction(pi, typeId);
      additionalConsumed = true;
    }

    // Remove from hand
    ps.hand.splice(handIndex, 1);

    (async () => {
      try {
        // Broadcast spell to opponent BEFORE resolving
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;
        if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
        await new Promise(r => setTimeout(r, 100));

        // Track card instance with heroIdx so onPlay knows which hero cast it
        const inst = room.engine._trackCard(cardName, pi, 'hand', heroIdx, -1);

        // Set up spell damage tracking (for Bartas second-cast detection)
        gs._spellDamageLog = [];
        gs._spellExcludeTargets = [];
        gs._spellCancelled = false;

        // Fire onPlay hook (spell resolves here)
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });

        // If spell was cancelled (player backed out of target selection), return card to hand
        if (gs._spellCancelled) {
          ps.hand.push(cardName);
          room.engine._untrackCard(inst.id);
          delete gs._spellDamageLog;
          delete gs._spellExcludeTargets;
          delete gs._spellCancelled;
          // Refund additional action if one was consumed
          if (additionalConsumed && consumedInst) {
            consumedInst.counters.additionalActionAvail = 1;
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i);
          return;
        }
        delete gs._spellCancelled;

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

        // Move to discard
        ps.discardPile.push(cardName);
        room.engine._untrackCard(inst.id);
        room.engine.log('spell_played', { card: cardName, player: ps.username, hero: hero.name, type: cardData.cardType });

        // Advance from Action Phase → Main Phase 2 (if not additional/inherent/free action)
        if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction) {
          await room.engine.advanceToPhase(pi, 4);
        }

        // Mark Divine Gift as used (once per game)
        if (cardName.startsWith('Divine Gift')) {
          ps.divineGiftUsed = true;
        }
      } catch (err) {
        console.error('[Engine] play_spell error:', err.message, err.stack);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
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
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
    if (!cardData || cardData.cardType !== 'Artifact') return;

    // Check gold
    const cost = cardData.cost || 0;
    if ((ps.gold || 0) < cost) return;

    const hero = ps.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen) return; // Can't equip to frozen heroes
    const isEquip = (cardData.subtype || '').toLowerCase() === 'equipment';
    if (isEquip) {
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

      // Execute: deduct gold, remove from hand, place
      ps.gold -= cost;
      ps.hand.splice(handIndex, 1);
      ps.supportZones[heroIdx][finalSlot] = [cardName];

      const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, finalSlot);

      (async () => {
        try {
          await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: finalSlot });
          await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
        } catch (err) {
          console.error('[Engine] play_artifact hooks error:', err.message);
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i);
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
    if (ps.potionLocked) return; // Nicolas potion lock active
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
    if (!cardData || cardData.cardType !== 'Potion') return;

    // Load card script for targeting
    const script = loadCardEffect(cardName);
    if (!script?.isPotion) return;
    if (script.canActivate && !script.canActivate(gs, pi)) return;

    if (script.getValidTargets && script.targetingConfig) {
      // Targeting mode — compute valid targets and send to clients
      const validTargets = script.getValidTargets(gs, pi);
      gs.potionTargeting = {
        potionName: cardName,
        handIndex,
        ownerIdx: pi,
        cardType: 'Potion',
        validTargets,
        config: script.targetingConfig,
      };
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    } else {
      // No targeting needed — execute with reaction window
      (async () => {
        // Broadcast card to opponent BEFORE resolving (unless script handles it manually)
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;
        if (!script.deferBroadcast) {
          if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
          await new Promise(r => setTimeout(r, 100));
        }

        let chainResult;
        try {
          chainResult = await room.engine.executeCardWithChain({
            cardName, owner: pi, cardType: 'Potion',
            resolve: script.resolve ? async () => await script.resolve(room.engine, pi, [], []) : null,
          });
        } catch (err) {
          console.error('[Engine] Potion chain error:', err.message);
          chainResult = { negated: false, chainFormed: false };
        }
        await new Promise(r => setTimeout(r, 100));
        // If the effect was cancelled (player backed out), don't consume the card
        if (chainResult.resolveResult?.cancelled) {
          for (let i = 0; i < 2; i++) sendGameState(room, i);
          return;
        }
        // Use indexOf to find card (handIndex may be stale if resolve modified hand)
        const currentIdx = ps.hand.indexOf(cardName);
        if (currentIdx >= 0) ps.hand.splice(currentIdx, 1);
        if (chainResult.negated) {
          ps.discardPile.push(cardName); // Negated → discard
        } else if (chainResult.resolveResult?.placed) {
          // Card was placed as a permanent — already on the board, don't delete
          // Still counts as a potion use for Nicolas lock
          ps.potionsUsedThisTurn = (ps.potionsUsedThisTurn || 0) + 1;
          if (ps.potionsUsedThisTurn >= 2) {
            const hasNicolas = (ps.heroes || []).some(h => h?.name === 'Nicolas, the Hidden Alchemist' && h.hp > 0 && !h.statuses?.negated);
            if (hasNicolas) ps.potionLocked = true;
          }
        } else {
          ps.deletedPile.push(cardName); // Resolved → deleted
          // Track potion usage for Nicolas lock
          ps.potionsUsedThisTurn = (ps.potionsUsedThisTurn || 0) + 1;
          if (ps.potionsUsedThisTurn >= 2) {
            // Check if Nicolas is alive and not negated
            const hasNicolas = (ps.heroes || []).some(h => h?.name === 'Nicolas, the Hidden Alchemist' && h.hp > 0 && !h.statuses?.negated);
            if (hasNicolas) ps.potionLocked = true;
          }
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i);
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
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return;

    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardData = allCards.find(c => c.name === cardName);
    if (!cardData || cardData.cardType !== 'Artifact') return;
    if ((cardData.subtype || '').toLowerCase() === 'equipment') return; // Equips use play_artifact

    const cost = cardData.cost || 0;
    if ((ps.gold || 0) < cost) return;

    const script = loadCardEffect(cardName);
    if (!script) return;
    if (script.canActivate && !script.canActivate(gs, pi)) return;

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
      for (let i = 0; i < 2; i++) sendGameState(room, i);
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
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      return;
    }

    const { potionName, handIndex, validTargets, cardType, goldCost } = gs.potionTargeting;
    const script = loadCardEffect(potionName);
    if (!script) { gs.potionTargeting = null; return; }

    // Validate selection
    if (script.validateSelection && !script.validateSelection(selectedIds, validTargets)) return;

    const ps = gs.players[pi];

    // Deduct gold for artifacts (unless script handles gold manually)
    if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost) {
      if ((ps.gold || 0) < goldCost) return;
      ps.gold -= goldCost;
    }

    (async () => {
      // Clear targeting before resolve — resolve may use its own prompts
      gs.potionTargeting = null;

      // Broadcast card to opponent BEFORE resolving
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: potionName });
      await new Promise(r => setTimeout(r, 100));

      // Execute with reaction window — defers resolve until chain resolves (if chain forms)
      let chainResult;
      try {
        chainResult = await room.engine.executeCardWithChain({
          cardName: potionName,
          owner: pi,
          cardType: cardType,
          resolve: script.resolve
            ? async () => await script.resolve(room.engine, pi, selectedIds, validTargets)
            : null,
        });
      } catch (err) {
        console.error('[Engine] executeCardWithChain error:', err.message, err.stack);
        chainResult = { negated: false, chainFormed: false, resolveResult: null };
      }

      if (chainResult.resolveResult?.aborted) {
        // Re-enter targeting mode (player pressed Back from status select)
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
        for (let i = 0; i < 2; i++) sendGameState(room, i);
        return;
      }

      // Brief delay so effect animations finish before self-discard
      await new Promise(r => setTimeout(r, 100));

      // Remove from hand and move to appropriate pile
      const hi = ps.hand.indexOf(potionName);
      if (hi >= 0) ps.hand.splice(hi, 1);
      if (chainResult.negated) {
        ps.discardPile.push(potionName); // Negated → always discard
      } else if (cardType === 'Potion') {
        ps.deletedPile.push(potionName); // Potions get deleted on resolve
        // Track potion usage for Nicolas lock
        ps.potionsUsedThisTurn = (ps.potionsUsedThisTurn || 0) + 1;
        if (ps.potionsUsedThisTurn >= 2) {
          const hasNicolas = (ps.heroes || []).some(h => h?.name === 'Nicolas, the Hidden Alchemist' && h.hp > 0 && !h.statuses?.negated);
          if (hasNicolas) ps.potionLocked = true;
        }
      } else {
        ps.discardPile.push(potionName); // Artifacts get discarded
      }

      // Play target animation if card resolved (not negated)
      if (!chainResult.negated) {
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) io.to(sid).emit('potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
        }
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
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
  });

  // Cancel potion targeting
  socket.on('cancel_potion', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.potionTargeting) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.potionTargeting.ownerIdx) return;
    room.gameState.potionTargeting = null;
    for (let i = 0; i < 2; i++) sendGameState(room, i);
  });

  // General-purpose effect prompt response (confirm, card gallery, zone pick)
  socket.on('effect_prompt_response', ({ roomId, response }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState?.effectPrompt) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.effectPrompt.ownerIdx) return;
    room.engine.resolveGenericPrompt(response);
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
      for(let i=0;i<2;i++) sendGameState(room, i);
      // Now ask the loser who goes first — no time limit
      const loserPs = room.gameState.players[loserIdx];
      if (loserPs?.socketId) {
        room._pendingRematch = { roomId, loserIdx };
        io.to(loserPs.socketId).emit('rematch_choose_first', {});
      } else {
        startGameEngine(room, roomId, loserIdx);
      }
    } else {
      for (let i=0;i<2;i++) sendGameState(room, i);
    }
  });

  socket.on('rematch_first_choice', ({ roomId, goFirst }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?._pendingRematch) return;
    const { loserIdx } = room._pendingRematch;
    const loserPs = room.gameState?.players?.[loserIdx];
    if (!loserPs || loserPs.userId !== currentUser.userId) return;
    if (room._rematchTimer) { clearTimeout(room._rematchTimer); delete room._rematchTimer; }
    delete room._pendingRematch;
    const activePlayer = goFirst ? loserIdx : (loserIdx === 0 ? 1 : 0);
    startGameEngine(room, roomId, activePlayer);
  });

  socket.on('leave_room', ({ roomId }) => handleLeaveRoom(socket, roomId, currentUser));

  // Debug: add a card to a player's hand
  socket.on('debug_add_card', ({ roomId, cardName }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    room.gameState.players[pi].hand.push(cardName);
    for (let i = 0; i < 2; i++) sendGameState(room, i);
  });

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
    id: r.id, host: r.host, type: r.type,
    hasPlayerPw: !!r.playerPw, hasSpecPw: !!r.specPw,
    playerCount: r.players.length,
    spectatorCount: r.spectators.length,
    status: r.status, created: r.created,
    players: r.players.map(p => p.username),
  }));
}

function sanitizeRoom(room, forUser) {
  return {
    id: room.id, host: room.host, type: room.type,
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
