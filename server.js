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
const PUZZLE_SECRET = process.env.PUZZLE_SECRET || 'pxlParties_puzzl3_k3y_2025!';
const profileImportUsed = new Set();

// ===== PUZZLE ENCRYPTION =====
function encryptPuzzle(data) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(PUZZLE_SECRET, 'pxl-puzzle-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}
function decryptPuzzle(encryptedStr) {
  const [ivB64, data] = encryptedStr.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const key = crypto.scryptSync(PUZZLE_SECRET, 'pxl-puzzle-salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// ===== DEBUG FLAGS =====
// Reveal the CPU/NPC opponent's hand to the human player during singleplayer
// matches. Useful while debugging CPU behaviour — you can see exactly what
// the CPU is holding and predict its plays. MUST be `false` for public
// builds (leaks opponent information).
const DEBUG_REVEAL_NPC_HAND = true;

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

// Surface silent async failures — self-play batches will otherwise hang
// indefinitely on a rejected Promise that nobody handled, with no trace
// whatsoever in the log. This at least tells us what threw.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason?.stack || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.stack || err);
});

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
  try { await db.execute("ALTER TABLE users ADD COLUMN hide_tutorial INTEGER DEFAULT 0"); } catch {}
  // Tracks which sample deck (starter or structure) the user has pinned as
  // their default. Null when the default is a custom deck from `decks`.
  try { await db.execute("ALTER TABLE users ADD COLUMN default_sample_deck_id TEXT DEFAULT NULL"); } catch {}

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

  // Per-opponent win/loss for singleplayer CPU battles. Keyed by the
  // deckId the player faced — sample decks (`sample-<filename>`) and
  // structure decks share this key space since both come from
  // loadSampleDecks().
  await db.execute(`CREATE TABLE IF NOT EXISTS npc_stats (
    user_id TEXT NOT NULL,
    opponent_deck_id TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, opponent_deck_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_stats_user ON npc_stats(user_id)');

  // One-time migration: sample-deck IDs used to be array-index-based
  // (`sample-0`, `sample-1`, ...) which made every win/loss record shift
  // to a DIFFERENT deck whenever a new sample deck was added or the
  // alphabetical order of files changed. IDs are now filename-based
  // (`sample-Heal Burn`, ...). Drop the legacy numeric rows so users
  // don't carry forward mis-attributed stats — starting fresh is
  // better than seeing wins against decks you never played.
  try {
    await db.execute(`DELETE FROM npc_stats
      WHERE opponent_deck_id LIKE 'sample-%'
        AND opponent_deck_id GLOB 'sample-[0-9]*'`);
  } catch (err) {
    console.error('[npc_stats migration] failed:', err.message);
  }

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

  // Puzzle completions table
  await db.execute(`CREATE TABLE IF NOT EXISTS puzzle_completions (
    user_id TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, puzzle_id)
  )`);

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
  // Repair the user's default-deck pin if it's missing or illegal. Safe
  // to run on every session check (no-op when the existing default is
  // fine). Re-fetch the user row afterwards so `sanitizeUser` sees the
  // possibly-updated `default_sample_deck_id`.
  let userForResponse = user;
  try {
    await ensureValidDefaultDeck(user.id);
    userForResponse = await db.get('SELECT * FROM users WHERE id = ?', [user.id]) || user;
  } catch (err) {
    console.error('[auth/me] ensureValidDefaultDeck threw:', err.message);
  }
  res.json({ user: sanitizeUser(userForResponse), token: req.authToken });
});

function sanitizeUser(u) {
  return { id: u.id, username: u.username, elo: u.elo, color: u.color, avatar: u.avatar, cardback: u.cardback, board: u.board || null, bio: u.bio || '', wins: u.wins || 0, losses: u.losses || 0, sc: u.sc || 0, created_at: u.created_at, hide_tutorial: u.hide_tutorial || 0, defaultSampleDeckId: u.default_sample_deck_id || null };
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

// Toggle hide_tutorial preference
app.put('/api/profile/hide-tutorial', authMiddleware, async (req, res) => {
  const hide = req.body.hide_tutorial ? 1 : 0;
  await db.run('UPDATE users SET hide_tutorial = ? WHERE id = ?', [hide, req.user.userId]);
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
  // A custom deck is now the default — clear any pinned sample-deck default.
  await db.run('UPDATE users SET default_sample_deck_id = NULL WHERE id = ?', [req.user.userId]);
  res.json({ ok: true });
});

/**
 * Same deck-legality rule the profile "Deck Wall" uses: exactly 60 main
 * cards, exactly 3 heroes, and the potion deck is either empty or sized
 * 5–15. Duplicated inline here rather than refactored because the rule
 * already lives inline at `/api/profile/deck-stats` — keeping them in
 * sync is the maintenance note.
 */
function isCustomDeckRowLegal(row) {
  if (!row) return false;
  try {
    const main = JSON.parse(row.main_deck || '[]');
    const heroes = JSON.parse(row.heroes || '[]').filter(h => h && h.hero);
    const potions = JSON.parse(row.potion_deck || '[]');
    const pc = potions.length;
    return main.length === 60 && heroes.length === 3 && (pc === 0 || (pc >= 5 && pc <= 15));
  } catch { return false; }
}

/**
 * If the user's currently-selected default deck is missing or not legal,
 * pick and persist a replacement:
 *   1. Random LEGAL user-built deck, if any exist.
 *   2. Otherwise, a random Starter (non-structure) sample deck.
 * Idempotent — a no-op when the existing default is already valid.
 *
 * Called on /api/auth/me (every session check) so the client always
 * sees a usable default in its deck picker. Writes go through the same
 * mutually-exclusive convention the two set-default endpoints use:
 *   custom default   → flip `decks.is_default`, null `users.default_sample_deck_id`
 *   sample default   → null all `decks.is_default`, set `users.default_sample_deck_id`
 */
async function ensureValidDefaultDeck(userId) {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [userId]);
  const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [userId]);

  // 1. Current custom default still legal? No-op.
  const customDefault = decks.find(d => d.is_default);
  if (customDefault && isCustomDeckRowLegal(customDefault)) return;

  // 2. Pinned sample-deck default still valid?
  //    • Starter (non-structure): always legal — content shipped by us.
  //    • Structure: requires the user to still own it in the shop table.
  if (userRow?.default_sample_deck_id) {
    const samples = loadSampleDecks();
    const sample = samples.find(s => s.id === userRow.default_sample_deck_id);
    if (sample) {
      if (!sample.isStructure) return;
      const owned = await db.get(
        "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
        [userId, sample.structureId]
      );
      if (owned) return;
    }
  }

  // 3. Random legal user-built deck, if any.
  const legalCustoms = decks.filter(isCustomDeckRowLegal);
  if (legalCustoms.length > 0) {
    const pick = legalCustoms[Math.floor(Math.random() * legalCustoms.length)];
    await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE decks SET is_default = 1 WHERE id = ? AND user_id = ?', [pick.id, userId]);
    await db.run('UPDATE users SET default_sample_deck_id = NULL WHERE id = ?', [userId]);
    return;
  }

  // 4. Fall back to a random Starter deck. Structure decks are excluded —
  //    they're paywall content; the user may not own them.
  const starters = loadSampleDecks().filter(s => !s.isStructure);
  if (starters.length > 0) {
    const pick = starters[Math.floor(Math.random() * starters.length)];
    await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [pick.id, userId]);
  }
}

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

      const fileBase = files[fi].replace(/\.txt$/, '');
      let deckName = fileBase;
      let coverCard = '';
      let section = null;
      const heroNames = [];
      const mainCards = [];
      const potionCards = [];
      const sideCards = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('Name:')) { deckName = line.slice(5).trim(); continue; }
        if (line.startsWith('Cover:')) { coverCard = line.slice(6).trim(); continue; }
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

      // "Structure Deck …" files are gated behind a shop purchase. Others
      // are "Starter Decks" — always visible in the deck list and used as
      // the random default for new accounts.
      const isStructure = /^Structure Deck\b/i.test(fileBase) || /^Structure Deck\b/i.test(deckName);
      // Strip the "Structure Deck" / "Starter Deck" prefix (with optional
      // colon) from the stored Name so the deck list / shop show just the
      // real deck title.
      const stripped = deckName.replace(/^(Structure|Starter) Deck\s*:?\s*/i, '').trim();
      const displayName = stripped || deckName;

      decks.push({
        // Stable ID derived from the source filename so adding / removing
        // / reordering sample decks never causes stats (npc_stats) to
        // drift onto the wrong opponent. Previously this was 'sample-' +
        // array-index, which shifted every key on any roster change.
        id: 'sample-' + fileBase,
        name: displayName,
        heroes,
        mainDeck: mainCards,
        potionDeck: potionCards,
        sideDeck: sideCards,
        isDefault: false,
        isSample: true,
        isStructure,
        // Stable id used for ownership tracking in user_shop_items.
        structureId: isStructure ? fileBase : null,
        coverCard,
      });
    } catch (err) { console.error('[SampleDecks] Error reading', files[fi], err.message); }
  }
  return decks;
}

// Only the starter (non-structure) sample decks are returned to every
// client. Structure decks ride on a separate owned-items catalog below.
app.get('/api/sample-decks', async (req, res) => {
  const all = loadSampleDecks();
  res.json({ decks: all.filter(d => !d.isStructure) });
});

// Authenticated variant — includes any structure decks the caller has
// unlocked, so they appear in the deck picker next to starter decks.
app.get('/api/sample-decks/owned', authMiddleware, async (req, res) => {
  const all = loadSampleDecks();
  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  const decks = all.filter(d => !d.isStructure || ownedSet.has(d.structureId));
  res.json({ decks });
});

// Singleplayer opponent-gallery feed. Returns every sample deck the caller
// can face (all Starter + all Structure decks, regardless of shop-ownership),
// each enriched with the middle-hero name and the caller's W/L record vs
// that opponent. The client crops the hero's skin image to render a clean
// portrait tile. Note: structure-deck ownership still gates use of the deck
// in the deckbuilder — this endpoint just opens every AI opponent.
app.get('/api/sample-decks/gallery', authMiddleware, async (req, res) => {
  const decks = loadSampleDecks();
  const statRows = await db.all(
    'SELECT opponent_deck_id, wins, losses FROM npc_stats WHERE user_id = ?',
    [req.user.userId]
  );
  const statMap = new Map(statRows.map(r => [r.opponent_deck_id, r]));
  const enriched = decks.map(d => {
    const middleHero = d.heroes?.[1]?.hero || null;
    const stat = statMap.get(d.id);
    return {
      id: d.id,
      name: d.name,
      isStructure: !!d.isStructure,
      middleHero,
      wins: stat?.wins || 0,
      losses: stat?.losses || 0,
    };
  });
  res.json({ opponents: enriched });
});

// Structure-deck shop catalog with per-deck ownership flags.
app.get('/api/shop/structure-decks', authMiddleware, async (req, res) => {
  const all = loadSampleDecks().filter(d => d.isStructure);
  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  // Which deck is currently flagged as this user's default? Used by the UI
  // to draw the green "this is your active deck" border.
  const defaultRow = await db.get('SELECT id FROM decks WHERE user_id = ? AND is_default = 1', [req.user.userId]);
  const defaultDeckId = defaultRow?.id || null;
  const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [req.user.userId]);
  const defaultSampleId = userRow?.default_sample_deck_id || null;
  res.json({
    decks: all.map(d => ({
      structureId: d.structureId,
      id: d.id,
      name: d.name,
      coverCard: d.coverCard || '',
      owned: ownedSet.has(d.structureId),
      isDefault: defaultSampleId === d.id,
    })),
    price: STRUCTURE_DECK_PRICE,
    randomPrice: STRUCTURE_DECK_RANDOM_PRICE,
    defaultDeckId,
  });
});

// ===== SKINS =====
let SKINS_DATA = {};
try { SKINS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'skins.json'), 'utf-8')); } catch {}
app.get('/api/skins', (req, res) => res.json({ skins: SKINS_DATA }));

// ===== SHOP SYSTEM =====
const SHOP_PRICES = { avatar: 10, sleeve: 10, board: 10, skin: 10 };
const RANDOM_PRICES = { skin: 5, avatar: 5, sleeve: 5 };
const STRUCTURE_DECK_PRICE = 10;
const STRUCTURE_DECK_RANDOM_PRICE = 5;

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

// ───── Structure decks (shop-gated sample decks) ─────

// POST /api/shop/buy-structure-deck — buy a specific structure deck by its file id.
app.post('/api/shop/buy-structure-deck', authMiddleware, async (req, res) => {
  const { structureId } = req.body;
  if (!structureId) return res.status(400).json({ error: 'Missing structureId' });

  const exists = loadSampleDecks().some(d => d.isStructure && d.structureId === structureId);
  if (!exists) return res.status(404).json({ error: 'Structure deck not found' });

  const already = await db.get(
    "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
    [req.user.userId, structureId]
  );
  if (already) return res.status(409).json({ error: 'Already owned' });

  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < STRUCTURE_DECK_PRICE) return res.status(400).json({ error: 'Not enough SC' });

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [STRUCTURE_DECK_PRICE, req.user.userId]);
  await db.run(
    'INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.user.userId, 'structure_deck', structureId]
  );
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, structureId });
});

// POST /api/shop/buy-random-structure-deck — unlock a random unowned structure deck.
app.post('/api/shop/buy-random-structure-deck', authMiddleware, async (req, res) => {
  const all = loadSampleDecks().filter(d => d.isStructure);
  if (all.length === 0) return res.status(400).json({ error: 'No structure decks available' });

  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  const unowned = all.filter(d => !ownedSet.has(d.structureId));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all Structure Decks!' });

  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < STRUCTURE_DECK_RANDOM_PRICE) return res.status(400).json({ error: 'Not enough SC' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];
  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [STRUCTURE_DECK_RANDOM_PRICE, req.user.userId]);
  await db.run(
    'INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.user.userId, 'structure_deck', pick.structureId]
  );
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({
    ok: true, sc: updated.sc,
    structureId: pick.structureId,
    name: pick.name,
    coverCard: pick.coverCard || '',
  });
});

// POST /api/decks/set-default-sample — pin an unlocked sample/structure deck as default.
app.post('/api/decks/set-default-sample', authMiddleware, async (req, res) => {
  const { sampleDeckId } = req.body;
  if (!sampleDeckId) return res.status(400).json({ error: 'Missing sampleDeckId' });
  const deck = loadSampleDecks().find(d => d.id === sampleDeckId);
  if (!deck) return res.status(404).json({ error: 'Sample deck not found' });

  if (deck.isStructure) {
    const owned = await db.get(
      "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
      [req.user.userId, deck.structureId]
    );
    if (!owned) return res.status(403).json({ error: 'Structure deck not unlocked' });
  }

  // Clear the default flag on all custom decks + pin the sample deck.
  await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);
  await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [sampleDeckId, req.user.userId]);
  res.json({ ok: true, sampleDeckId });
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
  if (room.engine?._fastMode) return; // Silent during MCTS simulations.
  const p = room.players[playerIdx];
  if (!p?.socketId) return;
  const gs = room.gameState;
  if (!gs) return;

  // Terror: force end turn if threshold reached.
  //
  // Defer firing while ANY effect, prompt, or chain is still in flight.
  // Without this gate, a sync() emitted from inside a hero/creature/ability
  // effect (e.g. Siphem mid-onHeroEffect, before its prompts resolve) would
  // run runPhase(5) here while the effect is still awaiting a player
  // response — the effect then resumes during the *next* turn. The flag
  // stays set, so the next `sendGameState` after the effect / chain fully
  // resolves picks it up.
  if (gs._terrorForceEndTurn != null && !gs._terrorProcessing && room.engine) {
    const phase = gs.currentPhase;
    const engine = room.engine;
    const heroEffectActive = gs._heroEffectInProgress
      && Object.values(gs._heroEffectInProgress).some(v => v);
    const cardResolving = (gs.players || []).some(p => p?._resolvingCard);
    const promptOpen = !!(engine._pendingPrompt || engine._pendingGenericPrompt);
    const chainOpen = !!engine._inReactionCheck;
    const midEffect = heroEffectActive || cardResolving || promptOpen || chainOpen;
    // Only force during playable phases (Main1, Action, Main2)
    if (phase >= 2 && phase <= 4 && !midEffect) {
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
      // Reveal CPU hand in singleplayer games so the human tester can
      // see what the CPU is holding. Has no effect on MP games or the
      // CPU itself (the CPU brain reads from gs directly, not the
      // redacted client-side state).
      hand: (pi === playerIdx || (room.type === 'singleplayer' && DEBUG_REVEAL_NPC_HAND)) ? ps.hand : [], handCount: ps.hand.length,
      revealedHandCards: pi !== playerIdx ? (() => {
        // SINGLEPLAYER debug reveal: show every card in the CPU's hand.
        // The client renders `revealedHandCards` as face-up tiles, so
        // populating all indexes here surfaces the whole hand without
        // requiring client-side changes. Gated on DEBUG_REVEAL_NPC_HAND
        // so public builds don't leak CPU information.
        if (room.type === 'singleplayer' && DEBUG_REVEAL_NPC_HAND) {
          return ps.hand.map((name, index) => ({ index, name }));
        }
        const result = [];
        const seenIdx = new Set();
        const pushReveal = (idx) => {
          if (seenIdx.has(idx)) return;
          if (idx < 0 || idx >= ps.hand.length) return;
          seenIdx.add(idx);
          result.push({ index: idx, name: ps.hand[idx] });
        };
        // Per-index reveals (Luna Kiai): exact copy was revealed for
        // the rest of THIS turn.
        const indexMap = ps._revealedHandIndices || {};
        for (const kStr of Object.keys(indexMap)) pushReveal(+kStr);
        // Permanent per-index reveals (legacy hook — currently unused
        // by any card; Bamboo Shield switched to instance-flagged
        // reveals, see below).
        const permaMap = ps._permanentlyRevealedHandIndices || {};
        for (const kStr of Object.keys(permaMap)) pushReveal(+kStr);
        // Per-instance reveals (Luna Kiai per-turn via `_revealedThisTurn`,
        // Bamboo Shield permanent via `_permanentlyRevealed`): map each
        // revealed inst to its specific hand position via rank-by-name
        // correspondence (K-th tracked inst of name X ↔ K-th hand
        // position of name X). Inverse of `_findHandInstanceAt`. The
        // earlier "count + mark first N" version always exposed the
        // leftmost matching slot regardless of which copy was actually
        // revealed — visible bug with multiple copies of the same card.
        const revealedRanks = {};
        const trackingRank  = {};
        for (const inst of (room.engine?.cardInstances || [])) {
          if (inst.owner !== pi) continue;
          if (inst.zone !== 'hand') continue;
          const name = inst.name;
          const rank = trackingRank[name] || 0;
          trackingRank[name] = rank + 1;
          if (inst.counters?._permanentlyRevealed || inst.counters?._revealedThisTurn) {
            if (!revealedRanks[name]) revealedRanks[name] = new Set();
            revealedRanks[name].add(rank);
          }
        }
        if (Object.keys(revealedRanks).length > 0) {
          const handRank = {};
          for (let i = 0; i < ps.hand.length; i++) {
            if (seenIdx.has(i)) { /* still need to bump rank */ }
            const name = ps.hand[i];
            const k = handRank[name] || 0;
            handRank[name] = k + 1;
            if (revealedRanks[name]?.has(k) && !seenIdx.has(i)) {
              pushReveal(i);
            }
          }
        }
        // Legacy count-based reveals (Madaga's temporary reveal): pick
        // the last-N matching copies. Skip indices already exposed by
        // the per-index map to avoid double-listing.
        const counts = ps._revealedCardCounts;
        if (counts && Object.keys(counts).length > 0
            && (!ps._revealedCardExpiry || Date.now() < ps._revealedCardExpiry)) {
          const used = new Set(result.map(r => r.index));
          const remaining = { ...counts };
          for (let i = ps.hand.length - 1; i >= 0; i--) {
            if (used.has(i)) continue;
            const name = ps.hand[i];
            if (remaining[name] > 0) {
              result.push({ index: i, name });
              remaining[name]--;
            }
          }
        }
        return result;
      })() : [],
      mainDeckCards: pi === playerIdx ? ps.mainDeck : [], deckCount: ps.mainDeck.length,
      potionDeckCards: pi === playerIdx ? ps.potionDeck : [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      disconnected: ps.disconnected || false, left: ps.left || false,
      gold: ps.gold || 0,
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false,false,false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      oppHandLocked: ps.oppHandLocked || false,
      itemLocked: ps.itemLocked || false,
      // Boomerang's "no Artifacts for the rest of this turn" lockout —
      // surfaced as a clean boolean so the client can grey out hand
      // Artifacts and show a debuff badge. Self-expires when the turn
      // number rolls over (the underlying flag holds the lock-turn).
      artifactLocked: (ps._artifactLockTurn === gs.turn) || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: ps.potionLocked || false,
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
      handLocked: ps.handLocked || false,
      flashbanged: ps._flashbangedDebuff || false,
      forsaken: ps._discardToDeleteActive || false,
      creationLockedNames: (pi === playerIdx && ps._creationLockedNames) ? [...ps._creationLockedNames] : [],
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
      neverPlayableCards: pi === playerIdx ? ps.hand.filter(cn => loadCardEffect(cn)?.neverPlayable) : [],
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
    isPuzzle: gs.isPuzzle || false,
    isTutorial: gs.isTutorial || false,
    isCpuBattle: room.type === 'singleplayer',
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    // Compute fresh per-sync so per-turn gates (Deepsea `canSummon`,
    // etc.) flip to "blocked" the moment the first copy is summoned.
    // The phase-start cache alone would miss mid-turn updates and let
    // a second copy slip through.
    summonBlocked: room.engine ? room.engine.getSummonBlocked(playerIdx) : (gs.summonBlocked || []),
    customPlacementCards: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (s?.customPlacement) names.add(cn);
      }
      return [...names];
    })(),
    // Cards whose script declares `usesCustomHostPick: true` — the
    // card's own `beforeSummon` runs a richer host picker (zones +
    // heroes clickable) than the generic spellHeroPick panel can
    // offer, so the client SKIPS that panel for these cards on a
    // click play and emits `play_creature` with the first eligible
    // hero as a placeholder. The card's `beforeSummon` then prompts
    // for the real host. Drag-drop bypasses both flows because the
    // explicit drop slot is the player's host pick (signalled via
    // `viaDragDrop` on the play_creature payload).
    customHostPickCards: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (s?.usesCustomHostPick) names.add(cn);
      }
      return [...names];
    })(),
    ascendedOnlyAbilities: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        const s = loadCardEffect(cn);
        if (s?.ascendedHeroOnly) names.add(cn);
      }
      return [...names];
    })(),
    // Reaction-subtype Artifacts that opt into `proactivePlay: true`
    // can be cast on the player's own turn just like a Normal Artifact
    // (they merely retain the chain-reaction window during the
    // opponent's phase changes). Surface them so the client's hand
    // grey-out doesn't blanket-disable every Reaction Artifact.
    // Server's `doUseArtifactEffect` (see server.js ~line 4700) already
    // respects this opt-in; this list mirrors that to the client.
    proactiveReactionArtifacts: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      const cardDB = getCardDB();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const cd = cardDB[cn];
        if (cd?.cardType !== 'Artifact') continue;
        if ((cd.subtype || '').toLowerCase() !== 'reaction') continue;
        const s = loadCardEffect(cn);
        if (s?.proactivePlay) names.add(cn);
      }
      return [...names];
    })(),
    // Abilities flagged with `restrictedAttachment: true` can never be
    // attached to a Hero by normal play / generic tutors — Divinity is
    // the inaugural example. Surface them so the client gray-out logic
    // can refuse the attach immediately rather than letting the player
    // drag the card onto a hero only to be silently denied server-side.
    restrictedAttachmentAbilities: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        const s = loadCardEffect(cn);
        if (s?.restrictedAttachment) names.add(cn);
      }
      return [...names];
    })(),
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
    bonusMainActions: gs.players[playerIdx]?._bonusMainActions || 0,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    handReturnToOppCards: gs.handReturnToOppCards || [],
    potionTargeting: gs.potionTargeting || null,
    effectPrompt: gs.effectPrompt || null,
    surprisePending: gs.surprisePending || false,
    heroEffectPending: gs.heroEffectPending || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      const currentTurn = gs.turn || 0;
      for (const inst of room.engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        // Key by OWNER — the creature renders on its owner's board even
        // when its `controller` has been flipped by a steal. The client
        // reads `creatureCounters[${ownerPi}-${hi}-${zi}]`. `_stolenBy`
        // surfaces the stealer so the client can paint their color.
        const key = `${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn && (() => {
          const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
          return !!(script?.creatureEffect);
        })();
        const isFaceDown = !!inst.faceDown;
        const isStolen = inst.stolenBy != null && inst.controller !== inst.owner;
        if (hasCounters || hasSummoningSickness || isFaceDown || isStolen) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
          if (isStolen) cc[key]._stolenBy = inst.stolenBy;
        }
      }
      return cc;
    })() : {},
    additionalActions: room.engine ? room.engine.getAdditionalActions(playerIdx) : [],
    // Per-card level reductions contributed by board-wide `reduceCardLevel`
    // hooks (Elven Forager, …). Map of cardName → non-negative reduction.
    // Client subtracts this from the card's raw level before running the
    // spell-school-count check, so the UI agrees with the server's
    // `heroMeetsLevelReq` — without forcing the client to replay every
    // board-side hook.
    cardLevelReductions: room.engine ? (() => {
      const result = {};
      const ps2 = gs.players[playerIdx];
      const cardDB = getCardDB();
      const seen = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const cd = cardDB[cn];
        if (!cd) continue;
        const raw = cd.level || 0;
        if (raw <= 0) continue;
        const reduced = room.engine._applyCardLevelReductions(cd, raw, playerIdx);
        const delta = raw - reduced;
        if (delta > 0) result[cn] = delta;
      }
      return result;
    })() : {},
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
    // Creatures that can act as Spell casters via Wolflesia-style
    // `bypassesCasterRequirement` additional actions. Each entry has
    // `{ creatureInstId, cardName, heroIdx, zoneSlot, eligibleHandCards }`.
    // Used by the client to highlight the Creature as the visible
    // caster (instead of the host Hero) for matching Spells.
    creatureSpellCasters: room.engine ? room.engine.getCreatureSpellCasters(playerIdx) : [],
    // Hero-side level-req bypass per (heroIdx → list of hand-card names).
    // Populated by Cute Princess Mary's "Cute" bypass and any future
    // `canBypassLevelReqForCard`-exporting hero. Used by the client's
    // `canHeroNormalSummon` empty-slot drop check so Mary's free
    // Support Zones light up under a Cute Phoenix drag.
    heroBypassSummonCards: room.engine ? room.engine.getHeroBypassSummonCards(playerIdx) : {},
    // Hand slots with a clickable "activate in hand without playing"
    // effect (Luna Kiai's "reveal to Burn a Hero" — any future card
    // with the same shape). Each entry is `{ cardName, handIndex,
    // label }`, one per eligible hand slot. The client gates activation
    // per-index so a specific copy can be clicked and revealed.
    handActivatableCards: room.engine ? room.engine.getHandActivatableCards(playerIdx) : [],
    // Own-hand revealed indices — the specific hand slots the owner
    // has spent on `handActivatedEffect` this turn. The client marks
    // them semi-transparent and blocks clicks on them. Cleared on
    // turn start along with other reveal state.
    revealedOwnHandIndices: (() => {
      const myPs = gs.players[playerIdx];
      if (!myPs) return [];
      const handLen = myPs.hand?.length || 0;
      const out = new Set();
      const collect = (map) => {
        if (!map) return;
        for (const kStr of Object.keys(map)) {
          const k = +kStr;
          if (k >= 0 && k < handLen) out.add(k);
        }
      };
      // Per-turn reveals (Luna Kiai) AND legacy permanent index
      // reveals are both surfaced here with the same styling.
      collect(myPs._revealedHandIndices);
      collect(myPs._permanentlyRevealedHandIndices);
      // Per-instance reveals (Luna Kiai per-turn via `_revealedThisTurn`,
      // Bamboo Shield permanent via `_permanentlyRevealed`): walk
      // tracked instances and map EACH revealed inst back to its
      // specific hand position via rank-by-name correspondence.
      //   • Tracked instances are appended in entry order; cards in hand
      //     are appended in the same order. So the K-th tracked inst
      //     of name X corresponds to the K-th hand position of name X.
      //   • For each revealed inst, compute its rank-by-name in tracking
      //     order, then mark the K-th hand position with that name.
      // This is the EXACT inverse of `_findHandInstanceAt(handIndex)`,
      // which is what stamps the reveal flag in the first place — so
      // the round-trip lands on the same physical copy the player clicked.
      // The earlier "count per name → mark first N" version always
      // marked the leftmost copy regardless of which one was actually
      // clicked (visible bug with 3 Luna Kiais — clicking the rightmost
      // revealed the leftmost).
      const revealedRanks = {}; // name -> Set<rankAmongName>
      const trackingRank = {};  // name -> running counter
      for (const inst of (room.engine?.cardInstances || [])) {
        if (inst.owner !== playerIdx) continue;
        if (inst.zone !== 'hand') continue;
        const name = inst.name;
        const rank = trackingRank[name] || 0;
        trackingRank[name] = rank + 1;
        if (inst.counters?._permanentlyRevealed || inst.counters?._revealedThisTurn) {
          if (!revealedRanks[name]) revealedRanks[name] = new Set();
          revealedRanks[name].add(rank);
        }
      }
      if (Object.keys(revealedRanks).length > 0) {
        const handRank = {};
        for (let i = 0; i < handLen; i++) {
          if (out.has(i)) continue;
          const name = myPs.hand[i];
          const k = handRank[name] || 0;
          handRank[name] = k + 1;
          if (revealedRanks[name]?.has(k)) out.add(i);
        }
      }
      return [...out];
    })(),
    // True only while Deepsea Spores' per-turn override is live — the
    // client tints every board Creature dark-red and prefixes "Deepsea"
    // onto the tooltip name. Cleared automatically on the next turn
    // because the engine compares the stored turn against `gs.turn`.
    deepseaSporesActive: !!(gs._deepseaSporesActiveTurn != null && gs._deepseaSporesActiveTurn === gs.turn),
    activatableEquips: room.engine ? room.engine.getActivatableEquips(playerIdx) : [],
    activatablePermanents: room.engine ? room.engine.getActivatablePermanents(playerIdx) : [],
    activatableAreas: room.engine ? room.engine.getActivatableAreas(playerIdx) : [],
    heroPlayableCards: room.engine ? room.engine.getHeroPlayableCards(playerIdx) : { own: {}, charmed: {} },
    bouncePlacementTargets: room.engine ? room.engine.getBouncePlacementTargets(playerIdx) : {},
    bakhmSurpriseSlots: room.engine ? (() => {
      const result = [];
      const ps2 = gs.players[playerIdx];
      for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
        const hero = ps2.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated || hero.statuses?.bound) continue;
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
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated || hero.statuses?.bound) continue;
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
  if (room.engine?._fastMode) return;
  if (!room.spectators) return;
  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit(event, data);
  }
}

function sendSpectatorGameState(room) {
  if (room.engine?._fastMode) return;
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
      // CPU-vs-CPU spectator view reveals both hands so the watcher can
      // see every CPU decision in context. Normal spectator view keeps
      // hands hidden (fairness for real-player matches).
      hand: room.type === 'cpu_vs_cpu' ? ps.hand : [], handCount: ps.hand.length,
      revealedHandCards: room.type === 'cpu_vs_cpu'
        ? ps.hand.map((name, index) => ({ index, name }))
        : [],
      mainDeckCards: [], deckCount: ps.mainDeck.length,
      potionDeckCards: [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      disconnected: ps.disconnected || false, left: ps.left || false,
      gold: ps.gold || 0,
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false, false, false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      oppHandLocked: ps.oppHandLocked || false,
      itemLocked: ps.itemLocked || false,
      // Boomerang lockout — see the matching block in sendGameState
      // for the rationale.
      artifactLocked: (ps._artifactLockTurn === gs.turn) || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: ps.potionLocked || false,
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(spi) : 30,
      handLocked: ps.handLocked || false,
      flashbanged: ps._flashbangedDebuff || false,
      forsaken: ps._discardToDeleteActive || false,
      supportSpellLocked: ps.supportSpellLocked || false,
      permanents: ps.permanents || [],
      oncePerGameUsed: ps._oncePerGameUsed ? [...ps._oncePerGameUsed] : [],
      resolvingCard: ps._resolvingCard || null,
      deckSkins: ps.deckSkins || {},
      poisonDmgPerStack: room.engine ? room.engine.getPoisonDamagePerStack(spi) : 30,
      // Fields that sendGameState includes per-player but spectators don't interact with
      surpriseFaceDown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return null;
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return inst ? inst.faceDown : true;
      }),
      revealedHandCards: [],
      creationLockedNames: [],
      handLockBlockedCards: [],
      neverPlayableCards: [],
      comboLockHeroIdx: ps.comboLockHeroIdx ?? null,
      heroesActedThisTurn: ps.heroesActedThisTurn || [],
    })),
    areaZones: gs.areaZones, turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    isPuzzle: gs.isPuzzle || false,
    isTutorial: gs.isTutorial || false,
    isCpuBattle: room.type === 'singleplayer',
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: [],
    customHostPickCards: [],
    ascendedOnlyAbilities: [],
    proactiveReactionArtifacts: [],
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    choosingPlayerName,
    terrorCount: 0,
    terrorThreshold: null,
    bonusActions: null,
    bonusMainActions: 0,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    handReturnToOppCards: gs.handReturnToOppCards || [],
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
        // Key by OWNER — the creature renders on its owner's board even
        // when its `controller` has been flipped by a steal. The client
        // reads `creatureCounters[${ownerPi}-${hi}-${zi}]`. `_stolenBy`
        // surfaces the stealer so the client can paint their color.
        const key = `${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn && (() => {
          const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
          return !!(script?.creatureEffect);
        })();
        const isFaceDown = !!inst.faceDown;
        const isStolen = inst.stolenBy != null && inst.controller !== inst.owner;
        if (hasCounters || hasSummoningSickness || isFaceDown || isStolen) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
          if (isStolen) cc[key]._stolenBy = inst.stolenBy;
        }
      }
      return cc;
    })() : {},
    additionalActions: [],
    inherentActionCards: [],
    inherentActionHeroes: {},
    unactivatableArtifacts: [],
    blockedSpells: [],
    activatableAbilities: [],
    freeActivatableAbilities: [],
    activeHeroEffects: [],
    activatableCreatures: [],
    activatableEquips: [],
    activatablePermanents: [],
    activatableAreas: [],
    heroPlayableCards: { own: {}, charmed: {} },
    bouncePlacementTargets: {},
    bakhmSurpriseSlots: [],
    ushabtiSummonable: [],
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

/**
 * Lightweight endGame for puzzle/single-player rooms.
 * No DB writes (ELO, wins, losses, SC rewards, game history).
 * Just sets gs.result and syncs to the client.
 */
function puzzleEndGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  const puzzleSuccess = reason !== 'puzzle_failed' && winnerIdx === 0;

  console.log(`[Puzzle] Game ended: reason=${reason}, winner=${winnerIdx}, success=${puzzleSuccess}, phase=${gs.currentPhase}`);

  gs.result = {
    winnerIdx, reason,
    winnerName: winner?.username || '?',
    loserName: loser?.username || '?',
    isRanked: false,
    eloChanges: null,
    setScore: [0, 0], setOver: true, format: 1,
    isPuzzle: true,
    isTutorial: gs.isTutorial || false,
    puzzleResult: puzzleSuccess ? 'success' : 'fail',
    puzzleAttemptId: gs._puzzleAttemptId || null,
    puzzleDifficulty: gs._puzzleDifficulty || null,
    scAwarded: 0,
  };
  gs.rematchRequests = [];
  room.status = 'finished';

  // Award SC for first-time official puzzle completion
  if (puzzleSuccess && gs._puzzleAttemptId && gs._puzzleDifficulty) {
    const SC_BY_DIFFICULTY = { easy: 3, medium: 6, hard: 10 };
    const scAmount = SC_BY_DIFFICULTY[gs._puzzleDifficulty] || 0;
    const userId = winner?.userId;
    const puzzleId = gs._puzzleAttemptId;

    if (userId && scAmount > 0) {
      (async () => {
        try {
          // Check if already completed
          const existing = await db.get(
            'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
            [userId, puzzleId]
          );
          if (!existing) {
            // First clear — record completion and award SC
            await db.run(
              'INSERT INTO puzzle_completions (user_id, puzzle_id) VALUES (?, ?)',
              [userId, puzzleId]
            );
            await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [scAmount, userId]);
            gs.result.scAwarded = scAmount;
            console.log(`[Puzzle] Awarded ${scAmount} SC to ${winner.username} for first clear of ${puzzleId}`);
          } else {
            // Already completed — record but no SC
            console.log(`[Puzzle] ${winner.username} re-cleared ${puzzleId} (no SC)`);
          }
        } catch (err) {
          console.error('[Puzzle] SC award error:', err.message);
        }
        // Re-sync with updated scAwarded
        for (let i = 0; i < 2; i++) sendGameState(room, i);
      })();
    }
  }

  // Track tutorial completion (no SC reward)
  if (puzzleSuccess && gs.isTutorial && gs._puzzleAttemptId) {
    const userId = winner?.userId;
    const puzzleId = gs._puzzleAttemptId;
    if (userId) {
      (async () => {
        try {
          const existing = await db.get(
            'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
            [userId, puzzleId]
          );
          if (!existing) {
            await db.run(
              'INSERT INTO puzzle_completions (user_id, puzzle_id) VALUES (?, ?)',
              [userId, puzzleId]
            );
            console.log(`[Tutorial] ${winner.username} cleared ${puzzleId}`);
          }
        } catch (err) {
          console.error('[Tutorial] completion tracking error:', err.message);
        }
      })();
    }
  }

  for (let i = 0; i < 2; i++) sendGameState(room, i);
}

// Singleplayer CPU battle end — no Elo/ranked/hero stats writes, mirrors puzzleEndGame's
// minimal pattern. The human earns a small SC reward on a non-surrender win, gated by
// light anti-farm guards (min turns + min cards played).
const CPU_WIN_SC = 1;
const CPU_WIN_MIN_TURN = 3;
const CPU_WIN_MIN_CARDS = 3;
function endCpuBattle(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  gs.result = {
    winnerIdx, reason,
    winnerName: winner?.username || '?',
    loserName: loser?.username || '?',
    isRanked: false, eloChanges: null,
    setScore: [0, 0], setOver: true, format: 1,
    isCpuBattle: true,
    scAwarded: 0,
  };
  gs.rematchRequests = [];

  // MCTS rollouts share the live room.gameState (snapshot/restore rolls
  // back gs, but NOT fire-and-forget DB writes or socket emits). Without
  // this guard, every simulated rollout that killed all heroes would
  // stack another npc_stats + SC update on the real user — that's the
  // "60+ wins and multi-stacked SC after a few games" bug. gs.result is
  // still set above so the rollout's termination checks work; restore()
  // then clears it for the next simulation.
  if (room.engine?._fastMode) return;

  room.status = 'finished';

  // Record per-opponent W/L for the human player so the singleplayer
  // gallery can show their record vs this deck. Only counts when a human
  // userId and opponent deckId are both known (skips anon/dev runs).
  // Surrenders count as a loss for the human — bailing out shouldn't be
  // a free escape from the record.
  const humanUserId = room.players?.[0]?.userId;
  const opponentDeckId = room.players?.[1]?.deckId;
  if (humanUserId && opponentDeckId) {
    const humanWon = winnerIdx === 0 ? 1 : 0;
    const humanLost = winnerIdx === 0 ? 0 : 1;
    (async () => {
      try {
        await db.run(`
          INSERT INTO npc_stats (user_id, opponent_deck_id, wins, losses)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, opponent_deck_id) DO UPDATE SET
            wins = wins + excluded.wins,
            losses = losses + excluded.losses
        `, [humanUserId, opponentDeckId, humanWon, humanLost]);
      } catch (err) {
        console.error('[CPU battle] npc_stats update error:', err.message);
      }
    })();
  }

  // SC reward: only the human (idx 0), only on an actual victory (no surrender
  // wins), and only if the game reached a real play state.
  const humanPlayed = gs._scTracking?.[0]?.cardsPlayedFromHand || 0;
  const eligible =
    winnerIdx === 0 &&
    reason !== 'surrender' &&
    (gs.turn || 0) >= CPU_WIN_MIN_TURN &&
    humanPlayed >= CPU_WIN_MIN_CARDS;

  if (eligible && winner?.userId) {
    const userId = winner.userId;
    const sid = winner.socketId;
    gs.result.scAwarded = CPU_WIN_SC;
    (async () => {
      try {
        await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [CPU_WIN_SC, userId]);
        if (sid) io.to(sid).emit('sc_earned', {
          rewards: [{ id: 'cpu_win', title: 'CPU Battle Victory', amount: CPU_WIN_SC }],
          total: CPU_WIN_SC,
        });
        const updated = await db.get('SELECT wins, losses, elo, sc FROM users WHERE id = ?', [userId]);
        if (updated && sid) io.to(sid).emit('user_stats_updated', updated);
      } catch (err) {
        console.error('[CPU battle] SC award error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  }

  for (let i = 0; i < 2; i++) sendGameState(room, i);
}

// CPU turn driver. Delegates to the brain module in cards/effects/_cpu.js.
// Passes the room and the set of action helpers the brain is allowed to call.
const { runCpuTurn, installCpuBrain, shouldMulliganStartingHand, setCpuVerbose, getCpuVerbose, setCpuTranscribeFn, setRolloutHorizon, getRolloutHorizon, setRolloutBrain, getRolloutBrain } = require('./cards/effects/_cpu');
function makeCpuDriver(room) {
  return async function cpuTurn(engine) {
    try {
      await runCpuTurn(engine, {
        room,
        doPlayAbility,
        doPlayArtifact,
        doUseArtifactEffect,
        doUsePotion,
        doConfirmPotion,
        doPlaySurprise,
        doPlaySpell,
        doPlayCreature,
        doActivateFreeAbility,
        doActivateCreatureEffect,
        doActivateHeroEffect,
        doActivateEquipEffect,
        doActivateAreaEffect,
        doActivatePermanent,
        doActivateAbility,
        sendGameState,
        sendSpectatorGameState,
      });
    } catch (err) {
      // Record the error so the no-result diagnosis (self-play) can report
      // that the CPU driver crashed instead of resolving cleanly.
      if (!engine._driverErrors) engine._driverErrors = [];
      engine._driverErrors.push({
        turn: engine.gs?.turn,
        player: engine._cpuPlayerIdx,
        phase: engine.gs?.currentPhase,
        message: err.message,
        stack: err.stack,
      });
      console.error('[CPU] turn error:', err.message, err.stack);
    }
  };
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

// ─── Card movement animation ───
// Emits to the OPPONENT's socket so their client can animate a cardback
// flying from the owner's hand slot to the destination zone. Areas are
// excluded per product spec — they use their own central reveal flow.
// Payload is intentionally semantic (not CSS selectors) so the client can
// decide how to render the animation.
function broadcastHandToBoard(room, ownerIdx, payload) {
  if (room.engine?._fastMode) return;
  if (!room?.gameState) return;
  const oppIdx = ownerIdx === 0 ? 1 : 0;
  const oppSid = room.gameState.players[oppIdx]?.socketId;
  if (oppSid) io.to(oppSid).emit('hand_to_board_fly', { ownerIdx, ...payload });
  sendToSpectators(room, 'hand_to_board_fly', { ownerIdx, ...payload });
}

// ─── Action helpers (shared between socket handlers and the CPU brain) ───
// Each helper contains the action's full logic EXCEPT the socket-level auth and
// "is this really your turn / your hand index" checks. The caller is trusted to
// pass a valid playerIdx. Returns true on success, false on early-return.

async function doPlayAbility(room, pi, { cardName, handIndex, heroIdx, zoneSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false; // Must be Main Phase 1 or 2

  const ps = gs.players[pi];
  if (!ps) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Ability') return false;

  const hero = ps.heroes[heroIdx];
  if (!hero || !hero.name || hero.hp <= 0) return false;
  if (ps.abilityGivenThisTurn[heroIdx]) return false;

  const abZones = ps.abilityZones[heroIdx] || [[], [], []];
  const script = loadCardEffect(cardName);

  if (script?.canAttachToHero && !script.canAttachToHero(gs, pi, heroIdx, room.engine)) return false;

  if (script?.customPlacement) {
    if (zoneSlot < 0 || zoneSlot >= 3) return false;
    const zone = abZones[zoneSlot] || [];
    if (!script.customPlacement.canPlace(zone)) return false;
    abZones[zoneSlot].push(cardName);
  } else {
    // Standard placement: stack onto existing same-name zone, or take a free zone
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
      if (existingCount >= 3) return false;
      abZones[existingZoneIdx].push(cardName);
    } else {
      if (zoneSlot >= 0 && zoneSlot < 3 && (abZones[zoneSlot] || []).length === 0) {
        abZones[zoneSlot] = [cardName];
      } else {
        let freeZ = -1;
        for (let z = 0; z < 3; z++) {
          if ((abZones[z] || []).length === 0) { freeZ = z; break; }
        }
        if (freeZ < 0) return false;
        abZones[freeZ] = [cardName];
      }
    }
  }

  ps.abilityZones[heroIdx] = abZones;
  ps.hand.splice(handIndex, 1);
  if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
  ps.abilityGivenThisTurn[heroIdx] = true;

  const finalZone = abZones.findIndex(z => (z || []).includes(cardName));
  const inst = room.engine._trackCard(cardName, pi, 'ability', heroIdx, Math.max(0, finalZone));

  room.engine.log('ability_attached', { player: ps.username, card: cardName, hero: hero.name });
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'ability', heroIdx, slotIdx: Math.max(0, finalZone) });

  try {
    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, heroIdx, cardType: 'Ability', goldCost: 0,
    });

    if (chainResult.negated) {
      const abZones2 = ps.abilityZones[heroIdx] || [];
      for (let z = 0; z < abZones2.length; z++) {
        const idx = abZones2[z].lastIndexOf(cardName);
        if (idx >= 0) { abZones2[z].splice(idx, 1); break; }
      }
      // Foreign-origin abilities (Magic Lamp gifts etc.) discard to
      // the ORIGINAL owner's pile when negated.
      const negatedAbilityOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      gs.players[negatedAbilityOwner].discardPile.push(cardName);
      ps.abilityGivenThisTurn[heroIdx] = false;
      room.engine.log('ability_negated', { card: cardName, player: ps.username });
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx });
    await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx });
  } catch (err) {
    console.error('[Engine] doPlayAbility hooks error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlayArtifact(room, pi, { cardName, handIndex, heroIdx, zoneSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps.itemLocked && (ps.hand || []).length < 2) return false;
  // Boomerang's "no Artifacts for the rest of this turn" lockout —
  // self-expiring (the stored turn number invalidates on the next
  // turn-rollover). Blocks all proactive Artifact plays via this path.
  if (ps._artifactLockTurn === gs.turn) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Artifact') return false;

  const rawCost = cardData.cost || 0;
  const costReduction = ps._nextArtifactCostReduction || 0;
  const cost = Math.max(0, rawCost - costReduction);
  if ((ps.gold || 0) < cost) return false;

  const hero = ps.heroes[heroIdx];
  if (!hero || !hero.name) return false;
  const subLower = (cardData.subtype || '').toLowerCase();
  const isEquip = subLower === 'equipment';
  const isArtifactCreature = subLower.split('/').some(t => t.trim() === 'creature');

  if (isEquip) {
    if (hero.hp <= 0) return false;
    if (hero.statuses?.frozen) return false;
    if (hero.statuses?.charmed) return false;

    const equipScript = loadCardEffect(cardName);
    if (equipScript?.canEquipToHero && !equipScript.canEquipToHero(gs, pi, heroIdx, room.engine)) return false;
    if (equipScript?.oncePerGame) {
      const opgKey = equipScript.oncePerGameKey || cardName;
      if (ps._oncePerGameUsed?.has(opgKey)) return false;
    }

    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    let finalSlot = zoneSlot;
    if (finalSlot < 0) {
      for (let z = 0; z < 3; z++) {
        if ((ps.supportZones[heroIdx][z] || []).length === 0) { finalSlot = z; break; }
      }
      if (finalSlot < 0) return false;
    }
    if (finalSlot < 0 || finalSlot >= 3) return false;
    if ((ps.supportZones[heroIdx][finalSlot] || []).length > 0) return false;

    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

    room.engine.log('artifact_equipped', { player: ps.username, card: cardName, hero: hero.name, cost });
    room.engine._trackTerrorResolvedEffect(pi, cardName);
    broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: finalSlot });

    try {
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
      sendToSpectators(room, 'card_reveal', { cardName });
      await room.engine._delay(100);

      if (ps.itemLocked && (ps.hand || []).length > 0) {
        await room.engine.actionPromptForceDiscard(pi, 1, {
          title: 'Item Lock Cost',
          description: 'You must delete 1 card from your hand to use an Artifact.',
          source: 'Item Lock', deleteMode: true, selfInflicted: true,
        });
      }

      const chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
        resolve: async () => {
          if (cost > 0) ps.gold -= cost;
          if (costReduction > 0) {
            delete ps._nextArtifactCostReduction;
            delete ps._nextArtifactCostReductionTurn;
          }
          const result = room.engine.safePlaceInSupport(cardName, pi, heroIdx, finalSlot);
          if (!result) {
            ps.discardPile.push(cardName);
            room.engine.log('equip_fizzle', { card: cardName, reason: 'zone_occupied_by_chain' });
            return true;
          }
          const { inst, actualSlot } = result;
          await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualSlot });
          await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
          if (equipScript?.oncePerGame) {
            const opgKey = equipScript.oncePerGameKey || cardName;
            if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
            ps._oncePerGameUsed.add(opgKey);
          }
          return true;
        },
      });

      if (chainResult.negated) ps.discardPile.push(cardName);
    } catch (err) {
      console.error('[Engine] doPlayArtifact (equip) error:', err.message);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  if (isArtifactCreature) {
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    let finalSlot = zoneSlot;
    if (finalSlot < 0) {
      for (let z = 0; z < 3; z++) {
        if ((ps.supportZones[heroIdx][z] || []).length === 0) { finalSlot = z; break; }
      }
      if (finalSlot < 0) return false;
    }
    if (finalSlot < 0 || finalSlot >= 3) return false;
    if ((ps.supportZones[heroIdx][finalSlot] || []).length > 0) return false;

    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    room.engine.log('artifact_creature_placed', { player: ps.username, card: cardName, hero: hero.name, cost });
    room.engine._trackTerrorResolvedEffect(pi, cardName);
    broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: finalSlot });

    try {
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
      sendToSpectators(room, 'card_reveal', { cardName });
      await room.engine._delay(100);

      if (ps.itemLocked && (ps.hand || []).length > 0) {
        await room.engine.actionPromptForceDiscard(pi, 1, {
          title: 'Item Lock Cost',
          description: 'You must delete 1 card from your hand to use an Artifact.',
          source: 'Item Lock', deleteMode: true, selfInflicted: true,
        });
      }

      const chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
        resolve: async () => {
          if (cost > 0) ps.gold -= cost;
          if (costReduction > 0) {
            delete ps._nextArtifactCostReduction;
            delete ps._nextArtifactCostReductionTurn;
          }
          const placed = await room.engine.summonCreatureWithHooks(
            cardName, pi, heroIdx, finalSlot,
            { source: 'Artifact-Creature play' },
          );
          if (!placed) {
            ps.discardPile.push(cardName);
            room.engine.log('artifact_creature_fizzle', { card: cardName, reason: 'no_free_zone_or_canceled' });
            return true;
          }
          return true;
        },
      });

      if (chainResult.negated) ps.discardPile.push(cardName);
    } catch (err) {
      console.error('[Engine] doPlayArtifact (creature) error:', err.message);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // Non-equipment, non-creature Artifacts (Normal/Reaction/Area/Surprise) are
  // routed through use_artifact_effect (doUseArtifactEffect) instead.
  return false;
}

async function doPlaySpell(room, pi, { cardName, handIndex, heroIdx, charmedOwner, attachmentZoneSlot, viaCreatureInstId }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;

  const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Spell', 'Attack'], { charmedOwner });
  if (!v) return false;
  const { ps, cardData, hero, script, isActionPhase, isMainPhase, isInherentAction } = v;

  // Wolflesia-style Creature spell-cast routing: the client sends
  // `viaCreatureInstId` when the player picked a Creature as the
  // visible caster (or dropped on her support slot). We:
  //   • set `gs._spellCasterOverride` so the engine's `_broadcastEvent`
  //     anchors caster-side animations on the Creature's slot instead
  //     of the host hero's zone (Heal beam etc. originate from her);
  //   • force-consume the matching `bypassesCasterRequirement`
  //     additional action so the play counts as Wolflesia's free
  //     additional, not the host hero's main action — even when the
  //     host hero could have cast it normally.
  // Cleared in the finally block below so it never leaks into a
  // subsequent spell cast.
  let _viaCreature = null;
  if (viaCreatureInstId != null) {
    const creature = room.engine.cardInstances.find(c => c.id === viaCreatureInstId);
    if (creature && creature.zone === 'support'
        && (creature.controller ?? creature.owner) === pi) {
      _viaCreature = creature;
      gs._spellCasterOverride = {
        owner: creature.owner,
        heroIdx: creature.heroIdx,
        zoneSlot: creature.zoneSlot,
      };
    }
  }

  // Consume Silence's one-use bypass token as soon as validation succeeds.
  // After this point the Spell lock fully applies — any further Spell attempts
  // this turn are blocked.
  if (cardData.cardType === 'Spell'
      && ps._spellLockTurn === gs.turn
      && ps._silenceBonusSpell === gs.turn) {
    ps._silenceBonusSpell = -1;
  }

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const wisdomDiscardCost = room.engine.getWisdomDiscardCost(heroOwner, heroIdx, cardData);

  const actionsPlayedThisPhase = ps._actionsPlayedThisPhase || 0;
  const hasBonusAction = isActionPhase && (
    (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1)
  );
  const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0) && !hasBonusAction;
  // Wolflesia-style Creature spell-cast: force-consume the bypass
  // additional action regardless of phase, so the play never counts
  // as the host hero's main action even when they had a free slot.
  const forceAdditional = _viaCreature != null;
  const needsAdditional = forceAdditional || (isMainPhase && !isInherentAction) || actionAlreadyUsed;
  let additionalConsumed = false;
  let consumedInst = null;
  if (needsAdditional) {
    const typeId = room.engine.findAdditionalActionForCard(pi, cardName, heroIdx);
    if (!typeId) {
      // Clean up the spell-caster override we set above before bailing,
      // otherwise the next spell cast in this turn could pick it up.
      if (_viaCreature) delete gs._spellCasterOverride;
      return false;
    }
    consumedInst = room.engine.consumeAdditionalAction(pi, typeId);
    additionalConsumed = true;
  }

  if (isActionPhase) {
    ps._actionsPlayedThisPhase = (ps._actionsPlayedThisPhase || 0) + 1;
    if (ps._actionsPlayedThisPhase === 2 && (ps._bonusMainActions || 0) > 0) {
      ps._bonusMainActions = 0;
    }
  }

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  // Spell-in-flight counter — gates advancePhase so the turn can't end
  // while a Spell is still mid-resolve (e.g. Rain of Arrows waiting on
  // Ida's single-target prompt). Bumped here before onPlay; released
  // explicitly below the moment effect resolution finishes (so the
  // engine's own auto-advance to Main Phase 2 isn't blocked by its own
  // counter), and the finally serves as a double-release-safe safety net.
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
  let _spellDepthReleased = false;
  const _releaseSpellDepth = () => {
    if (_spellDepthReleased) return;
    _spellDepthReleased = true;
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
  };

  try {
    const inst = room.engine._trackCard(cardName, pi, 'hand', heroIdx, -1);
    if (charmedOwner != null) inst.heroOwner = charmedOwner;

    // Hand-to-board fly animation for Attachment-subtype Spells. The card
    // attaches to heroIdx's hero card — we don't know the exact slot yet
    // (card scripts pick it inside onPlay), so we target the hero card
    // itself and let the client route to a visually sensible destination.
    if ((cardData.subtype || '').toLowerCase() === 'attachment') {
      broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'hero', heroIdx });
    }

    room.engine._setPendingPlayLog('spell_played', { card: cardName, player: ps.username, hero: hero.name, cardType: cardData.cardType });

    if (script?.payActivationCost) {
      try {
        const costCtx = room.engine._createContext(inst, {});
        await script.payActivationCost(costCtx);
      } catch (err) {
        console.error(`[Engine] payActivationCost for ${cardName} failed:`, err.message);
      }
    }

    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, cardType: cardData.cardType, goldCost: 0, heroIdx,
      resolve: null,
    });

    if (chainResult.negated) {
      const hi = getResolvingHandIndex(ps);
      ps._resolvingCard = null;
      if (hi >= 0) { ps.hand.splice(hi, 1); if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++; }
      // Foreign-origin cards (Magic Lamp gifts etc.) route to the
      // ORIGINAL owner's discard pile, not the caster's. Falls back
      // to `pi` when the card has no foreign-origin tag.
      const discardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      gs.players[discardOwner].discardPile.push(cardName);
      room.engine._untrackCard(inst.id);
      // Wisdom cost is paid IMMEDIATELY after the spell leaves hand,
      // BEFORE any phase-advance / turn-end mechanics can interrupt.
      // Otherwise a Flashbanged / Terror turn-end fired by the
      // action-used hooks would walk past this discard prompt.
      if (wisdomDiscardCost > 0) {
        await room.engine.actionPromptForceDiscard(pi, wisdomDiscardCost, {
          title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
        });
      }
      if (additionalConsumed && consumedInst) {
        consumedInst.counters.additionalActionAvail = 1;
      }
      if (cardData.cardType === 'Attack') {
        ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
        if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
        if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
        if (hero.ghuanjunAttacksUsed && !hero.ghuanjunAttacksUsed.includes(cardName)) hero.ghuanjunAttacksUsed.push(cardName);
        // Drop any arrows armed for this negated attack — otherwise a
        // follow-up attack this turn would inherit them.
        const { clearArmedArrows } = require('./cards/effects/_arrows-shared');
        clearArmedArrows(room.engine, pi);
      } else if (cardData.cardType === 'Spell') {
        ps.spellsPlayedThisTurn = (ps.spellsPlayedThisTurn || 0) + 1;
      }
      if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
      if (!isInherentAction && !additionalConsumed && !ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
      if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;
      if (isActionPhase && !additionalConsumed && !isInherentAction) {
        await room.engine.advanceToPhase(pi, 4);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    gs._spellDamageLog = [];
    gs._spellExcludeTargets = [];
    gs._spellCancelled = false;

    if (!chainResult.chainFormed) {
      gs._pendingCardReveal = { cardName, ownerIdx: pi };
    }

    if (attachmentZoneSlot != null && attachmentZoneSlot >= 0) gs._attachmentZoneSlot = attachmentZoneSlot;
    await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });
    delete gs._attachmentZoneSlot;
    await room.engine._flushSurpriseDrawChecks();

    if (gs._spellCancelled && !gs._spellNegatedByEffect) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      ps._resolvingCard = null;
      room.engine._untrackCard(inst.id);
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._spellCancelled;
      if (additionalConsumed && consumedInst) {
        consumedInst.counters.additionalActionAvail = 1;
      }
      // Spell was cancelled pre-resolution — release the in-flight lock
      // now (the finally would also catch this, but being explicit makes
      // the intent clear and matches the post-resolution release below).
      _releaseSpellDepth();
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }
    delete gs._spellCancelled;

    if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
    else room.engine._firePendingPlayLog();

    const becameFreeAction = gs._spellFreeAction === true;
    delete gs._spellFreeAction;
    if (becameFreeAction && additionalConsumed && consumedInst) {
      consumedInst.counters.additionalActionAvail = 1;
      additionalConsumed = false;
    }

    const uniqueTargets = [];
    const seenIds = new Set();
    for (const t of (gs._spellDamageLog || [])) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
    }

    if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
    // Additional-action plays (Friendship etc.) do NOT consume the hero's
    // normal turn slot — they're explicitly "extra beyond the normal".
    // Marking the hero here would force any follow-up normal action in
    // Action Phase to need ANOTHER additional action, which isn't the
    // intended semantics of `additionalConsumed`.
    if (!isInherentAction && !additionalConsumed && !ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
    if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;

    if (!gs._spellNegatedByEffect) {
      await room.engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cardData, heroIdx, casterIdx: pi,
        damageTargets: uniqueTargets, isSecondCast: !!gs._bartasSecondCast,
        _skipReactionCheck: true,
      });
    }

    // Clean up any armed-arrow modifiers that chained onto THIS attack —
    // see `cards/effects/_arrows-shared.js`. Happens regardless of
    // negate, so a negated attack still drops the arrows (otherwise a
    // later same-turn attack would inherit them). Idempotent / no-op
    // when nothing is armed.
    if (cardData.cardType === 'Attack') {
      const { clearArmedArrows } = require('./cards/effects/_arrows-shared');
      clearArmedArrows(room.engine, pi);
    }

    await room.engine.resolveDeferredRecoil();
    await room.engine._executeDeferredSurprises();

    // Effect resolution is complete — release the in-flight lock BEFORE
    // the engine's own auto-advance to Main Phase 2 below, otherwise
    // advanceToPhase would refuse its own call. The finally is idempotent.
    _releaseSpellDepth();

    delete gs._spellDamageLog;
    delete gs._spellExcludeTargets;
    delete gs._bartasSecondCast;
    delete gs._spellNegatedByEffect;
    delete gs._surpriseCheckedHeroes;
    delete gs._deferredRecoil;
    delete gs._ameShieldedHeroes;
    delete gs._ameDeclinedHeroes;

    const resolveHi = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (resolveHi >= 0) { ps.hand.splice(resolveHi, 1); if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++; }
    if (gs._spellPlacedOnBoard) {
      delete gs._spellPlacedOnBoard;
    } else {
      if (resolveHi >= 0) {
        // Foreign-origin cards (Magic Lamp etc.) discard to their
        // ORIGINAL owner's pile. `_consumeHandCardOrigin` returns `pi`
        // for normally-owned cards, so the local case is unchanged.
        const discardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
        gs.players[discardOwner].discardPile.push(cardName);
      }
      room.engine._untrackCard(inst.id);
    }

    // Wisdom cost is paid IMMEDIATELY after the spell leaves the
    // caster's hand, BEFORE any onActionUsed / onAnyActionResolved
    // hooks (Flashbang's turn-end, Reiza's bonus action, etc.) and
    // BEFORE any phase-advance. If we leave it at the end of the
    // function the way it used to be, a Flashbanged caster's turn
    // ends mid-flow on the action-used hook, the CPU runs an entire
    // counter-turn while we're still mid-await here, and by the time
    // we resume the player has long since moved on — the prompt
    // either fires too late or gets eaten by stale state. Paying
    // costs upfront matches Wisdom's "always paid even if the spell
    // is negated, interrupted, or fizzles" contract.
    if (wisdomDiscardCost > 0) {
      await room.engine.actionPromptForceDiscard(pi, wisdomDiscardCost, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }

    if (cardData.cardType === 'Spell' && cardData.spellSchool1 === 'Support Magic') {
      ps.supportSpellUsedThisTurn = true;
      if (additionalConsumed && consumedInst?.counters?.additionalActionType?.startsWith('friendship_support')) {
        // Read ability zones from the HERO OWNER's side — for charmed
        // casts this differs from the acting player. Using ps.abilityZones
        // here would give the wrong level when the hero is on the opponent.
        const heroPs = gs.players[heroOwner];
        const abZones = heroPs?.abilityZones?.[heroIdx] || [];
        let friendshipLevel = 0;
        for (const slot of abZones) {
          if ((slot || []).includes('Friendship')) { friendshipLevel = (slot || []).length; break; }
        }
        // ONLY Lv1 applies the "no more Support Spells this turn" debuff.
        // Strict equality defends against friendshipLevel=0 (detection
        // miss — treat as "no Friendship present, don't add a penalty").
        if (friendshipLevel === 1) {
          ps.supportSpellLocked = true;
          room.engine.log('support_spell_locked', { player: ps.username, by: 'Friendship' });
        }
      }
    }

    if (cardData.cardType === 'Attack') {
      ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
      if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
      if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
    } else if (cardData.cardType === 'Spell') {
      ps.spellsPlayedThisTurn = (ps.spellsPlayedThisTurn || 0) + 1;
    }

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
    // ── Universal "any action resolved" hook ──
    // Unlike onActionUsed (which skips inherent + free plays so things
    // like Reiza's bonus-action-on-poison don't fire on Quick Attack),
    // this hook fires for EVERY action play — Spell/Attack/Creature/
    // Ability/HeroEffect, regardless of whether it consumed the main
    // action slot. Flashbang listens here so it correctly ends the
    // turn on the first inherent / additional / free action too.
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, heroIdx,
      isAdditional: !!additionalConsumed,
      isInherent: !!isInherentAction,
      isFree: !!becameFreeAction,
      _skipReactionCheck: true,
    });

    if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction && !gs._preventPhaseAdvance) {
      await room.engine.advanceToPhase(pi, 4);
    }
    if (isActionPhase && additionalConsumed && !gs._preventPhaseAdvance) {
      const hasMore = room.engine.cardInstances.some(c =>
        c.owner === pi && c.counters.additionalActionAvail
      );
      if (!hasMore) {
        await room.engine.advanceToPhase(pi, 4);
      }
    }
    delete gs._preventPhaseAdvance;

    if (script?.oncePerGame) {
      const opgKey = script.oncePerGameKey || cardName;
      if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
      ps._oncePerGameUsed.add(opgKey);
    }

    // (Wisdom discard is paid earlier — right after the spell leaves
    // the caster's hand. See the comment above that earlier site.)
  } catch (err) {
    console.error('[Engine] doPlaySpell error:', err.message, err.stack);
  } finally {
    // Safety-net release — idempotent via _releaseSpellDepth's flag, so
    // this is a no-op if resolution already released normally above. Only
    // fires on error / early returns that skipped the explicit release.
    _releaseSpellDepth();
    // Always clear the spell-caster animation override so it never
    // leaks into a subsequent cast.
    if (gs._spellCasterOverride) delete gs._spellCasterOverride;
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateCreatureEffect(room, pi, { heroIdx, zoneSlot, charmedOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name) return false;

  const slot = (ps.supportZones[heroIdx] || [])[zoneSlot] || [];
  if (slot.length === 0) return false;
  const creatureName = slot[0];

  const inst = room.engine.cardInstances.find(c =>
    (c.owner === heroOwner || c.controller === heroOwner) && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
  );
  if (!inst) return false;
  // CC-locked creatures cannot fire their own effects — mirrors the
  // engine-side filter in getActivatableCreatures and the hook gate in
  // runHooks. Defensive: a stale activate request from a client whose
  // UI hasn't seen the freeze/stun yet would otherwise resolve.
  if (inst.counters?.frozen || inst.counters?.stunned
      || inst.counters?.negated || inst.counters?.nulled) return false;

  if (charmedOwner != null
      && hero.charmedBy !== pi && hero.controlledBy !== pi
      && inst.stolenBy !== pi) return false;

  const effectName = inst.counters?._effectOverride || creatureName;
  const script = loadCardEffect(effectName);
  if (!script?.creatureEffect || !script?.onCreatureEffect) return false;

  // Phase + action-economy gate. The default creature-effect path is
  // Main-Phase-only and free. Creatures that opt into `creatureActionCost`
  // (Adventurousness-style: "spend an Action") follow the ability
  // action-cost rules — Action Phase OR Main Phase with an additional-
  // action provider that covers the 'ability_activation' category.
  const isActionPhase = gs.currentPhase === 3;
  const isMainPhase   = gs.currentPhase === 2 || gs.currentPhase === 4;
  const isActionCost  = !!script.creatureActionCost;
  let hasAdditionalForActionCost = false;
  if (isActionCost) {
    if (isActionPhase) {
      // Allowed.
    } else if (isMainPhase) {
      hasAdditionalForActionCost = room.engine.hasAdditionalActionForCategory(pi, 'ability_activation');
      if (!hasAdditionalForActionCost) return false;
    } else {
      return false;
    }
  } else {
    if (!isMainPhase) return false;
  }

  if (inst.turnPlayed === (gs.turn || 0)) return false;

  const hoptKey = `creature-effect:${inst.id}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

  if (script.canActivateCreatureEffect) {
    const checkCtx = room.engine._createContext(inst, { event: 'canCreatureEffectCheck' });
    if (!script.canActivateCreatureEffect(checkCtx)) return false;
  }

  room.engine._setPendingPlayLog('creature_effect_activated', { player: gs.players[pi].username, card: creatureName, hero: hero.name });
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts (see HOPT-stamp on cancel
  // below for the Gerrymander veto path).
  room.engine._lastPromptGerryDeclined = false;

  try {
    const isStolenByPi = inst.stolenBy === pi && inst.controller === pi;
    const charmedHeroCreature = charmedOwner != null && !isStolenByPi;

    const origController = inst.controller;
    const origOwner = inst.owner;
    if (charmedHeroCreature) {
      inst.controller = pi;
      inst.owner = pi;
      inst.heroOwner = charmedOwner;
    } else if (isStolenByPi) {
      inst.heroOwner = inst.owner;
    }

    gs._pendingCardReveal = { cardName: creatureName, ownerIdx: pi };

    const ctx = room.engine._createContext(inst, {});
    const resolved = await script.onCreatureEffect(ctx);

    if (charmedHeroCreature) {
      inst.controller = origController;
      inst.owner = origOwner;
      delete inst.heroOwner;
    } else if (isStolenByPi) {
      delete inst.heroOwner;
    }

    if (resolved !== false) {
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      // Allow the script to opt out of the standard once-per-turn lock
      // by stamping `ctx._skipCreatureEffectHopt = true` during
      // `onCreatureEffect`. Used by Dream Lander Creatures
      // (Wolflesia / Clausss / Vullary) whose "attach a Hero" mode is
      // a separate, independent gate from the post-attach effect —
      // attaching shouldn't burn the once-per-turn slot the bonus
      // mode also wants to use this turn.
      if (!ctx._skipCreatureEffectHopt) {
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
      }
      // Action-cost creatures consume the Action on success — phase
      // advance in Action Phase, additional-action consumption in Main
      // Phase. Mirrors the doActivateActionCost path for abilities.
      if (isActionCost) {
        if (isActionPhase) {
          await room.engine.advanceToPhase(pi, 4);
        } else if (hasAdditionalForActionCost) {
          for (const inst2 of room.engine.cardInstances) {
            if (inst2.owner !== pi) continue;
            if (!inst2.counters?.additionalActionType || !inst2.counters?.additionalActionAvail) continue;
            const config = room.engine._additionalActionTypes[inst2.counters.additionalActionType];
            if (config?.allowedCategories?.includes('ability_activation')) {
              room.engine.consumeAdditionalAction(pi, inst2.counters.additionalActionType, inst2.id);
              break;
            }
          }
        }
      }
    } else {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      // Gerrymander veto on a "may" confirm consumes the once-per-turn
      // even though `resolved` came back false — the activator did
      // commit, opp's Gerrymander declined for them. Stamp HOPT so
      // the activation can't be retried this turn.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, creature: creatureName });
      }
    }
    await room.engine._flushSurpriseDrawChecks();
    await room.engine._executeDeferredSurprises();
  } catch (err) {
    console.error('[Engine] doActivateCreatureEffect error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateFreeAbility(room, pi, { heroIdx, zoneIdx, charmedOwner, borrowedFromOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;
  const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
  const isActionPhase = gs.currentPhase === 3;
  if (!isMainPhase && !isActionPhase) return false;

  // Lizbeth/Smugbeth borrow: the slot lives on opponent's hero but the
  // activation runs on the borrower's side. Validate via the engine
  // helper; reject if no borrower covers this slot.
  let borrowerHeroIdx = null;
  if (borrowedFromOwner != null) {
    if (charmedOwner != null) return false;
    const borrow = room.engine._getAbilityBorrowerForOppSlot(pi, borrowedFromOwner, heroIdx, zoneIdx);
    if (!borrow) return false;
    borrowerHeroIdx = borrow.borrowerHeroIdx;
  }

  const heroOwner = borrowedFromOwner != null
    ? borrowedFromOwner
    : (charmedOwner != null ? charmedOwner : pi);
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" (Spell/Attack/Creature plays from hand)
  // — NOT Ability activations like Alchemy, Adventurousness, etc.
  // Frozen/Stunned still gate ability activations because those
  // statuses silence the hero outright.
  if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;

  const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
  if (!abilitySlot || abilitySlot.length === 0) return false;
  const abilityName = abilitySlot[0];
  const level = abilitySlot.length;

  const script = loadCardEffect(abilityName);
  if (!script?.freeActivation || !script?.onFreeActivate) return false;
  if (isActionPhase && !script.actionPhaseEligible) return false;

  const hoptKey = `free-ability:${abilityName}:${pi}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

  const inst = room.engine.cardInstances.find(c =>
    c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
  );
  if (!inst) return false;

  if (script.canFreeActivate) {
    const checkCtx = room.engine._createContext(inst, { event: 'canFreeActivateCheck' });
    if (borrowedFromOwner != null) {
      // Borrow check uses borrower-side ctx so per-hero checks (gold,
      // hand cards, etc.) hit the activator instead of the source side.
      checkCtx.cardOwner = pi;
      checkCtx.cardController = pi;
      checkCtx.cardHeroOwner = pi;
      checkCtx.cardHeroIdx = borrowerHeroIdx;
      checkCtx.attachedHero = gs.players[pi]?.heroes?.[borrowerHeroIdx];
    }
    if (!script.canFreeActivate(checkCtx, level)) return false;
  }

  // Reserve the HOPT slot BEFORE any `await`. Without this, the chain
  // window opened by `executeCardWithChain` below yields to the event
  // loop, and a second `activate_free_ability` socket message from the
  // same client (fired while the chain is still resolving a reaction
  // like Cure on top of Alchemy) passes the HOPT check at line 3043
  // and enters a parallel activation. Reserving at entry and rolling
  // back on cancel closes the race.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;
  let hoptReserved = true;
  const releaseHopt = () => {
    if (hoptReserved) { delete gs.hoptUsed[hoptKey]; hoptReserved = false; }
  };
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines that happen during this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  try {
    const chainResult = await room.engine.executeCardWithChain({
      cardName: abilityName, owner: pi, cardType: 'Ability', goldCost: 0,
      resolve: null, fromBoard: true,
    });

    if (chainResult.negated) {
      // Negation keeps HOPT consumed — the ability fired (and was countered).
      hoptReserved = false;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const origController = inst.controller;
    const origOwner = inst.owner;
    const origHeroIdx = inst.heroIdx;
    if (charmedOwner != null) {
      inst.controller = pi;
      inst.owner = pi;
      inst.heroOwner = charmedOwner;
    } else if (borrowedFromOwner != null) {
      // Borrow: temporarily reroute the inst as if attached to the
      // borrower hero on the activator's side. Restored after the
      // free-activate finishes (success OR cancel).
      inst.controller = pi;
      inst.owner = pi;
      inst.heroIdx = borrowerHeroIdx;
      inst.heroOwner = pi;
    }

    gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };
    room.engine._setPendingPlayLog('ability_activated', { player: gs.players[pi].username, card: abilityName, hero: hero.name, level });

    const ctx = room.engine._createContext(inst, {});
    const resolved = await script.onFreeActivate(ctx, level);
    await room.engine._flushSurpriseDrawChecks();

    if (charmedOwner != null) {
      inst.controller = origController;
      inst.owner = origOwner;
      delete inst.heroOwner;
    } else if (borrowedFromOwner != null) {
      inst.controller = origController;
      inst.owner = origOwner;
      inst.heroIdx = origHeroIdx;
      delete inst.heroOwner;
    }

    if (resolved !== false) {
      // Reservation becomes the final consumption — nothing to do.
      hoptReserved = false;
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      if (!script.noDefaultFlash) {
        room.engine._broadcastEvent('ability_activated', { owner: heroOwner, heroIdx, zoneIdx });
      }
      if (isActionPhase) {
        const actingPs = gs.players[pi];
        actingPs._actionsPlayedThisPhase = (actingPs._actionsPlayedThisPhase || 0) + 1;
        if (actingPs._actionsPlayedThisPhase === 2 && (actingPs._bonusMainActions || 0) > 0) {
          actingPs._bonusMainActions = 0;
        }
        await room.engine.advanceToPhase(pi, 4);
      }
    } else {
      // Ability cancelled (user backed out, no legal target, etc.) — roll
      // back the HOPT reservation so the player keeps their once-per-turn.
      // EXCEPTION: if a Gerrymander redirect on a "you may" confirm caused
      // the cancel, the activator did COMMIT to playing the ability — the
      // opp's Gerrymander vetoed it. The once-per-turn slot is consumed.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        hoptReserved = false; // keep HOPT consumed
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, ability: abilityName });
      } else {
        releaseHopt();
      }
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    }
  } catch (err) {
    console.error('[Engine] doActivateFreeAbility error:', err.message);
    // Unexpected error mid-activation — release the reservation so the
    // player isn't silently robbed of their HOPT by a crash.
    releaseHopt();
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlayCreature(room, pi, { cardName, handIndex, heroIdx, zoneSlot, additionalActionProvider, viaDragDrop }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;

  const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Creature'], { zoneSlot });
  if (!v) return false;
  const { ps, cardData, hero, script, isActionPhase, isMainPhase, isInherentAction } = v;

  if (ps.summonLocked) return false;
  const freshBlocked = room.engine.getSummonBlocked(pi);
  if (freshBlocked.includes(cardName)) return false;
  const creatureHero = ps.heroes?.[heroIdx];
  if (creatureHero?.statuses?.charmed) return false;

  const additionalTypeId = !isInherentAction ? room.engine.findAdditionalActionForCard(pi, cardName, heroIdx) : null;
  const usingAdditional = !!additionalTypeId;
  const actionsPlayedThisPhase = ps._actionsPlayedThisPhase || 0;
  const hasBonusAction = isActionPhase && (
    (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1)
  );
  const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0) && !hasBonusAction;
  if ((isMainPhase || actionAlreadyUsed) && !usingAdditional && !isInherentAction) return false;

  if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
  const totalZones = ps.supportZones[heroIdx].length;
  if (zoneSlot < 0 || zoneSlot >= totalZones) return false;
  if ((ps.supportZones[heroIdx][zoneSlot] || []).length > 0) {
    const occCardScript = loadCardEffect(cardName);
    let allowOccupied = false;
    if (typeof occCardScript?.canPlaceOnOccupiedSlot === 'function') {
      try {
        allowOccupied = !!occCardScript.canPlaceOnOccupiedSlot(gs, pi, heroIdx, zoneSlot, room.engine);
      } catch (err) {
        console.error('[canPlaceOnOccupiedSlot]', cardName, err.message);
      }
    }
    if (!allowOccupied) return false;
    ps._requestedBouncePlaceSlot = { heroIdx, slotIdx: zoneSlot };
  } else {
    // Player picked an EMPTY slot — they want a regular summon into this
    // zone, not a bounce-place swap. Set an intent flag so beforeSummon
    // hooks (tryBouncePlace for Deepsea) can short-circuit and let the
    // normal placeCreature path run instead of prompting to bounce an
    // on-board Deepsea. Flag is cleared either by the hook that reads it
    // or, as a safety net, at turn start. Co-exists with the bounce-place
    // flag — only one of the two is ever set for a given play.
    ps._requestedNormalSummonSlot = { heroIdx, slotIdx: zoneSlot };
  }

  let additionalConsumed = false;
  let consumedInst = null;
  if (usingAdditional) {
    consumedInst = room.engine.consumeAdditionalAction(pi, additionalTypeId, additionalActionProvider || null);
    if (!consumedInst) return false;
    additionalConsumed = true;
  }

  const nthCreature = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth: nthCreature };

  if (isActionPhase) {
    ps._actionsPlayedThisPhase = (ps._actionsPlayedThisPhase || 0) + 1;
    if (ps._actionsPlayedThisPhase === 2 && (ps._bonusMainActions || 0) > 0) {
      ps._bonusMainActions = 0;
    }
  }

  room.engine._trackTerrorResolvedEffect(pi, cardName);

  const commitHandRemoval = () => {
    const idx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (idx >= 0) {
      ps.hand.splice(idx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    }
    return idx;
  };

  try {
    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, heroIdx, cardType: 'Creature', goldCost: 0,
    });

    if (chainResult.negated) {
      commitHandRemoval();
      // Foreign-origin Creatures (Magic Lamp gifts etc.) discard to
      // the ORIGINAL owner's pile when negated before placement.
      // Once the Creature is on the board, the death path already
      // routes via `inst.originalOwner` (see processCreatureDamageBatch),
      // so we only need the override here on the negate-from-hand path.
      const negatedDiscardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      gs.players[negatedDiscardOwner].discardPile.push(cardName);
      room.engine.log('creature_negated', { card: cardName, player: ps.username });
      if (isActionPhase && !usingAdditional) {
        await room.engine.advanceToPhase(pi, 4);
      }
      if (isActionPhase && usingAdditional) {
        const hasMore = room.engine.cardInstances.some(c =>
          c.owner === pi && c.counters.additionalActionAvail
        );
        if (!hasMore) await room.engine.advanceToPhase(pi, 4);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const beforeSummonOk = await room.engine._runBeforeSummon(cardName, pi, heroIdx, { isInherentAction, viaDragDrop: !!viaDragDrop });
    const placementConsumed = ps._placementConsumedByCard === cardName;
    if (placementConsumed) delete ps._placementConsumedByCard;
    if (!beforeSummonOk && !placementConsumed) {
      ps._resolvingCard = null;
      if (additionalConsumed && consumedInst) {
        consumedInst.counters.additionalActionAvail = 1;
      }
      room.engine.log('creature_fizzle', { card: cardName, reason: 'beforeSummon_cancelled' });
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    let actualZoneSlot = zoneSlot;
    let inst = null;
    if (placementConsumed) {
      commitHandRemoval();
    } else {
      commitHandRemoval();
      const placeResult = room.engine.summonCreature(cardName, pi, heroIdx, zoneSlot);
      if (!placeResult) {
        // Fizzle on a full zone — foreign-origin Creatures still route
        // their fizzle discard back to the original owner's pile.
        const fizzleDiscardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
        gs.players[fizzleDiscardOwner].discardPile.push(cardName);
        room.engine.log('creature_fizzle', { card: cardName, reason: 'zone_occupied' });
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        return true;
      }
      actualZoneSlot = placeResult.actualSlot;
      inst = placeResult.inst;
      // Propagate foreign-origin tag from the hand-tracked instance
      // onto the placed-on-board instance, so when the Creature dies
      // the engine's death-path (which already routes via
      // `inst.originalOwner`) returns the card to its true owner.
      const placedOriginOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      if (placedOriginOwner !== pi) {
        inst.originalOwner = placedOriginOwner;
      }

      broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: actualZoneSlot });
      for (let i = 0; i < 2; i++) {
        const sid = gs.players[i]?.socketId;
        if (sid) io.to(sid).emit('summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });
      }
      sendToSpectators(room, 'summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });
    }

    if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;

    if (!placementConsumed) {
      // `_isNormalSummon: true` flags this as a player-driven summon
      // gated against THIS hero's spell-school + level requirements.
      // Distinguishes from card-effect placements (Loyal Rottweiler,
      // Loyal Shepherd's revive, Monster in a Bottle, bounce-place,
      // …) where no hero-level gating happens. Listeners like
      // Orthos's "if THIS Hero summons a Loyal" use the flag to
      // skip non-summon placements.
      await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualZoneSlot, _isNormalSummon: true });
      await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _isNormalSummon: true });
    }
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
    // Universal action-resolved hook (see doPlaySpell for rationale).
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: 'creature', playerIdx: pi, cardName, heroIdx,
      isAdditional: !!usingAdditional,
      isInherent: !!isInherentAction,
      isFree: false,
      _skipReactionCheck: true,
    });
    if (isActionPhase && !usingAdditional && !isInherentAction) {
      await room.engine.advanceToPhase(pi, 4);
    }
    if (isActionPhase && usingAdditional) {
      const hasMore = room.engine.cardInstances.some(c =>
        c.owner === pi && c.counters.additionalActionAvail
      );
      if (!hasMore) {
        await room.engine.advanceToPhase(pi, 4);
      }
    }
  } catch (err) {
    console.error('[Engine] doPlayCreature error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateAbility(room, pi, { heroIdx, zoneIdx, charmedOwner, borrowedFromOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;

  // Borrowed activation (Lizbeth / Smugbeth): the slot is on opponent's
  // hero but the activation runs on the borrower's side. Validate via
  // the engine's borrow check; reject if no borrower covers this slot.
  // The borrower's heroIdx is what becomes the activation context.
  let borrowerHeroIdx = null;
  if (borrowedFromOwner != null) {
    if (charmedOwner != null) return false; // charm + borrow combo not supported
    const borrow = room.engine._getAbilityBorrowerForOppSlot(pi, borrowedFromOwner, heroIdx, zoneIdx);
    if (!borrow) return false;
    borrowerHeroIdx = borrow.borrowerHeroIdx;
  }

  const heroOwner = borrowedFromOwner != null
    ? borrowedFromOwner
    : (charmedOwner != null ? charmedOwner : pi);
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;
  if (charmedOwner == null && borrowedFromOwner == null && gs.players[pi].comboLockHeroIdx != null && gs.players[pi].comboLockHeroIdx !== heroIdx) return false;
  // One-turn action lock (Treasure Hunter's Backpack, etc.)
  if (hero._actionLockedTurn === gs.turn) return false;

  const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
  if (!abilitySlot || abilitySlot.length === 0) return false;
  const abilityName = abilitySlot[0];
  const level = abilitySlot.length;

  const script = loadCardEffect(abilityName);
  if (!script?.actionCost || !script?.onActivate) return false;

  const hoptKey = `ability-action:${abilityName}:${pi}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
  if (script.canActivateAction && !script.canActivateAction(gs, pi, heroIdx, level, room.engine)) return false;

  const isActionPhase = gs.currentPhase === 3;
  const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
  const hasAdditional = isMainPhase && room.engine.hasAdditionalActionForCategory(pi, 'ability_activation');
  if (!isActionPhase && !hasAdditional) return false;

  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;

  if (isActionPhase) {
    const actingPs = gs.players[pi];
    actingPs._actionsPlayedThisPhase = (actingPs._actionsPlayedThisPhase || 0) + 1;
    if (actingPs._actionsPlayedThisPhase === 2 && (actingPs._bonusMainActions || 0) > 0) {
      actingPs._bonusMainActions = 0;
    }
  }

  room.engine._setPendingPlayLog('ability_activated', { player: gs.players[pi].username, card: abilityName, hero: hero.name, level });
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts (see HOPT-keep logic below).
  room.engine._lastPromptGerryDeclined = false;

  try {
    const inst = room.engine.cardInstances.find(c =>
      c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
    );
    if (!inst) return false;

    const chainResult = await room.engine.executeCardWithChain({
      cardName: abilityName, owner: pi, cardType: 'Ability', goldCost: 0, resolve: null,
      fromBoard: true,
    });

    if (chainResult.negated) {
      if (isActionPhase) await room.engine.advanceToPhase(pi, 4);
      else if (hasAdditional) {
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
      return true;
    }

    const origController = inst.controller;
    const origOwner = inst.owner;
    const origHeroIdx = inst.heroIdx;
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });
    }
    sendToSpectators(room, 'ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });

    gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };
    if (charmedOwner != null) {
      inst.controller = pi; inst.owner = pi; inst.heroOwner = charmedOwner;
    } else if (borrowedFromOwner != null) {
      // Borrowed activation: temporarily pretend the ability instance is
      // attached to the borrower's hero on the activator's side. The
      // script's `ctx.cardOwner / cardHeroIdx / attachedHero` then route
      // benefits to the activator. Restored after onActivate returns.
      inst.controller = pi; inst.owner = pi;
      inst.heroIdx = borrowerHeroIdx;
      inst.heroOwner = pi;
    }

    const ctx = room.engine._createContext(inst, {});
    const result = await script.onActivate(ctx, level);

    if (result === false) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    } else if (gs._pendingCardReveal) {
      room.engine._firePendingCardReveal();
    } else {
      room.engine._firePendingPlayLog();
    }

    if (charmedOwner != null) {
      inst.controller = origController; inst.owner = origOwner; delete inst.heroOwner;
    } else if (borrowedFromOwner != null) {
      inst.controller = origController; inst.owner = origOwner;
      inst.heroIdx = origHeroIdx; delete inst.heroOwner;
    }
    if (result === false) {
      // Standard cancel rolls HOPT back. Gerrymander-vetoed "may"
      // confirms keep HOPT consumed — the activator committed; opp's
      // Gerrymander declined for them, the slot is spent.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, ability: abilityName });
      } else {
        delete gs.hoptUsed[hoptKey];
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const usingAdditional = hasAdditional && !isActionPhase;
    await room.engine.runHooks('onActionUsed', {
      actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
      isAdditional: usingAdditional, _skipReactionCheck: true,
    });
    if (usingAdditional) {
      await room.engine.runHooks('onAdditionalActionUsed', {
        actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx, _skipReactionCheck: true,
      });
    }
    // Universal action-resolved hook (see doPlaySpell for rationale).
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
      isAdditional: !!usingAdditional, isInherent: false, isFree: false,
      _skipReactionCheck: true,
    });

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
  } catch (err) {
    console.error('[doActivateAbility]', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateHeroEffect(room, pi, { heroIdx, charmedOwner, chosenEffectName }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" (Spell/Attack/Creature plays from hand) only.
  // Hero-effect activations are an "effect", not an Action — Bound's
  // text-spec ("ONLY Actions, but not their Abilities or effects")
  // covers hero effects too. Frozen/stunned/negated still silence them.
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;
  // _actionLockedTurn (Treasure Hunter's Backpack, etc.) blocks "Actions"
  // only — Spell/Attack/Creature plays and `actionCost` Ability activations.
  // Hero-effect activations are an "effect", not an Action, so the lock
  // does NOT gate this path. Same rationale as the frozen/stunned/negated
  // comment above (Bound vs. Frozen distinction).

  const availableEffects = [];
  const hasMummyToken = (ps.supportZones[heroIdx] || []).some(slot => (slot || []).includes('Mummy Token'));
  const mummyScript = hasMummyToken ? loadCardEffect('Mummy Token') : null;
  const ownScript = loadCardEffect(hero.name);

  if (hasMummyToken && mummyScript?.heroEffect && mummyScript?.onHeroEffect) {
    const mummyInst = room.engine.cardInstances.find(c =>
      c.owner === heroOwner && c.zone === 'support' && c.heroIdx === heroIdx && c.name === 'Mummy Token'
    );
    const hoptKey = `hero-effect:MummyToken:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] !== gs.turn && mummyInst) {
      let ok = true;
      if (mummyScript.canActivateHeroEffect) {
        const ctx = room.engine._createContext(mummyInst, { event: 'canHeroEffectCheck' });
        ok = mummyScript.canActivateHeroEffect(ctx);
      }
      if (ok) availableEffects.push({ name: 'Mummy Token', script: mummyScript, inst: mummyInst, hoptKey });
    }
  } else if (ownScript?.heroEffect && ownScript?.onHeroEffect) {
    const hoptKey = `hero-effect:${hero.name}:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] !== gs.turn) {
      const inst = room.engine.cardInstances.find(c => c.owner === heroOwner && c.zone === 'hero' && c.heroIdx === heroIdx);
      let ok = !!inst;
      if (ok && ownScript.canActivateHeroEffect) {
        const ctx = room.engine._createContext(inst, { event: 'canHeroEffectCheck' });
        ok = ownScript.canActivateHeroEffect(ctx);
      }
      if (ok) availableEffects.push({ name: hero.name, script: ownScript, inst, hoptKey });
    }
  }

  for (const ci of room.engine.cardInstances) {
    if (ci.owner !== heroOwner || ci.zone !== 'support' || ci.heroIdx !== heroIdx) continue;
    if (!ci.counters?.treatAsEquip) continue;
    const eqScript = loadCardEffect(ci.name);
    if (!eqScript?.heroEffect || !eqScript?.onHeroEffect) continue;
    const hoptKey = `hero-effect:${ci.name}:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
    let ok = true;
    if (eqScript.canActivateHeroEffect) {
      try {
        const ctx = room.engine._createContext(ci, { event: 'canHeroEffectCheck' });
        ok = eqScript.canActivateHeroEffect(ctx);
      } catch { ok = false; }
    }
    if (ok) availableEffects.push({ name: ci.name, script: eqScript, inst: ci, hoptKey });
  }

  if (availableEffects.length === 0) return false;

  // ── Re-entry guard ─────────────────────────────────────────────────
  // The HOPT for a hero effect is only stamped AFTER `onHeroEffect`
  // resolves below — the choice prompt, the chain-reaction window, and
  // the effect itself all `await`, yielding the event loop in between.
  // A second socket message ("clicked her again") arriving during any
  // of those awaits would otherwise pass the HOPT check above and run
  // a parallel activation. A per-(player, heroIdx) in-progress lock
  // closes that race; cleared in the finally so a crash mid-flight
  // doesn't permanently brick the hero. Mirrors the pre-await
  // reservation pattern doActivateFreeAbility uses, but stamping the
  // chosen HOPT ahead of time is awkward here because the choice isn't
  // known until after the option prompt — so the lock covers the
  // whole activation instead.
  const inProgressKey = `${pi}:${heroIdx}`;
  if (!gs._heroEffectInProgress) gs._heroEffectInProgress = {};
  if (gs._heroEffectInProgress[inProgressKey]) return false;
  gs._heroEffectInProgress[inProgressKey] = true;
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  try {
    let chosen;
    if (availableEffects.length === 1) chosen = availableEffects[0];
    else if (chosenEffectName) {
      chosen = availableEffects.find(e => e.name === chosenEffectName);
    }
    if (!chosen) {
      const response = await room.engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Hero Effect`,
        description: 'Choose which Hero Effect to activate.',
        options: availableEffects.map((e, i) => ({
          id: `effect-${i}`, label: e.name,
          description: e.script.heroEffect || '',
          color: e.inst?.zone === 'support' ? 'var(--warning)' : 'var(--accent)',
        })),
        cancellable: true,
        // Each option is a different Hero Effect — distinct effects.
        // No card-level cpuGerrymanderResponse override; engine falls
        // back to "first option" which usually picks the lower-tier /
        // base hero effect over a board-attached upgrade.
        gerrymanderEligible: true,
      });
      if (!response || response.cancelled) return false;
      const idx = availableEffects.findIndex((_, i) => `effect-${i}` === response.optionId);
      chosen = idx >= 0 ? availableEffects[idx] : null;
    }
    if (!chosen?.inst) return false;

    room.engine._setPendingPlayLog('hero_effect_activated', { player: gs.players[pi].username, hero: hero.name, effect: chosen.name });

    const chainResult = await room.engine.executeCardWithChain({
      cardName: chosen.name, owner: pi, cardType: 'Hero', goldCost: 0, resolve: null,
      fromBoard: true,
    });

    if (chainResult.negated) {
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[chosen.hoptKey] = gs.turn;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const surprise = await room.engine._checkSurpriseOnHeroEffect(pi, heroIdx, chosen.name);
    if (surprise?.negateEffect) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const origController = chosen.inst.controller;
    const origOwner = chosen.inst.owner;
    if (charmedOwner != null) {
      chosen.inst.controller = pi;
      chosen.inst.owner = pi;
      chosen.inst.heroOwner = charmedOwner;
    }

    gs._pendingCardReveal = { cardName: chosen.name, ownerIdx: pi };
    const ctx = room.engine._createContext(chosen.inst, {});
    const resolved = await chosen.script.onHeroEffect(ctx);
    await room.engine._flushSurpriseDrawChecks();

    if (charmedOwner != null) {
      chosen.inst.controller = origController;
      chosen.inst.owner = origOwner;
      delete chosen.inst.heroOwner;
    }

    if (resolved !== false) {
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[chosen.hoptKey] = gs.turn;
      delete gs._preventPhaseAdvance;
      // Universal action-resolved hook — Hero Effect activations count
      // as Actions for Flashbang's purposes even though they don't
      // consume the action-phase slot.
      await room.engine.runHooks('onAnyActionResolved', {
        actionType: 'hero_effect', playerIdx: pi, cardName: chosen.name, heroIdx,
        isAdditional: false, isInherent: true, isFree: false,
        _skipReactionCheck: true,
      });
    } else {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      // Gerrymander veto on a "may" confirm consumes the once-per-turn
      // even though `resolved` came back false — the activator did
      // commit, opp's Gerrymander declined for them.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[chosen.hoptKey] = gs.turn;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, hero: hero.name, effect: chosen.name });
      }
    }
  } catch (err) {
    console.error('[doActivateHeroEffect]', err.message);
  } finally {
    delete gs._heroEffectInProgress[inProgressKey];
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateAreaEffect(room, pi, { areaOwner, areaName }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;
  try {
    await room.engine.activateAreaEffect(pi, areaOwner, areaName);
  } catch (err) {
    console.error('[doActivateAreaEffect]', err.message);
    return false;
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivatePermanent(room, pi, { permId, ownerIdx }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 3 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const permOwner = ownerIdx;
  const ownerPs = gs.players[permOwner];
  if (!ownerPs) return false;

  const perm = (ownerPs.permanents || []).find(p => p.id === permId);
  if (!perm) return false;

  const script = loadCardEffect(perm.name);
  if (!script?.canActivatePermanent || !script?.onActivatePermanent) return false;
  if (!script.canActivatePermanent(gs, pi, permOwner, room.engine)) return false;

  try {
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: perm.name });
    sendToSpectators(room, 'card_reveal', { cardName: perm.name });
    room.engine.log('permanent_activated', { card: perm.name, player: gs.players[pi].username });
    await script.onActivatePermanent(room.engine, pi, permOwner, perm);
  } catch (err) {
    console.error('[doActivatePermanent]', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateEquipEffect(room, pi, { heroIdx, zoneSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const ps = gs.players[pi];
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" only — equip-effect activations are an
  // "effect" per the spec and stay alive under Bound.
  if (hero.statuses?.frozen || hero.statuses?.stunned) return false;

  const slot = (ps.supportZones[heroIdx] || [])[zoneSlot] || [];
  if (slot.length === 0) return false;
  const cardName = slot[0];

  const inst = room.engine.cardInstances.find(c =>
    (c.owner === pi || c.controller === pi) && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
  );
  if (!inst) return false;

  const script = loadCardEffect(cardName);
  if (!script?.equipEffect || !script?.onEquipEffect) return false;

  const hoptKey = `equip-effect:${inst.id}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

  if (script.canActivateEquipEffect) {
    const checkCtx = room.engine._createContext(inst, { event: 'canEquipEffectCheck' });
    if (!script.canActivateEquipEffect(checkCtx)) return false;
  }

  // Reserve the HOPT BEFORE any await. `onEquipEffect` may issue prompts
  // that yield the event loop; without the pre-stamp, a second socket
  // call (double-click) passes the check above and runs the effect a
  // second time. Released on cancel (resolved === false) so a backed-out
  // activation doesn't burn the slot.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;
  let hoptReserved = true;
  const releaseHopt = () => {
    if (hoptReserved) { delete gs.hoptUsed[hoptKey]; hoptReserved = false; }
  };
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  room.engine._setPendingPlayLog('equip_effect_activated', { player: gs.players[pi].username, card: cardName, hero: hero.name });

  try {
    gs._pendingCardReveal = { cardName, ownerIdx: pi };
    const ctx = room.engine._createContext(inst, {});
    const resolved = await script.onEquipEffect(ctx);
    if (resolved !== false) {
      hoptReserved = false; // reservation becomes the final consumption
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
    } else {
      // Standard cancel rolls HOPT back. Gerrymander veto on a "may"
      // confirm keeps it consumed — the activator committed and opp's
      // Gerrymander declined for them.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        hoptReserved = false; // keep HOPT consumed
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, equip: cardName });
      } else {
        releaseHopt();
      }
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    }
    await room.engine._flushSurpriseDrawChecks();
    await room.engine._executeDeferredSurprises();
  } catch (err) {
    console.error('[doActivateEquipEffect]', err.message);
    // Crash mid-activation — release the reservation so a real error
    // doesn't silently brick the player's once-per-turn slot.
    releaseHopt();
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doConfirmPotion(room, pi, { selectedIds }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (!gs.potionTargeting) return false;
  if (pi !== gs.potionTargeting.ownerIdx) return false;

  // Effect prompt (engine-driven from card hooks) resolves the engine promise.
  if (gs.potionTargeting.isEffectPrompt) {
    room.engine.resolveEffectPrompt(selectedIds);
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  const { potionName, handIndex, validTargets, cardType, goldCost } = gs.potionTargeting;
  const script = loadCardEffect(potionName);
  if (!script) { gs.potionTargeting = null; return false; }
  if (script.validateSelection && !script.validateSelection(selectedIds, validTargets)) return false;

  const ps = gs.players[pi];
  if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost) {
    if ((ps.gold || 0) < goldCost) return false;
  }

  gs.potionTargeting = null;
  room.engine.log('card_played', { player: ps.username, card: potionName, cardType, cost: goldCost || 0 });
  room.engine._trackTerrorResolvedEffect(pi, potionName);

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === potionName).length;
  ps._resolvingCard = { name: potionName, nth };

  const oi = pi === 0 ? 1 : 0;
  const oppSid = gs.players[oi]?.socketId;
  if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: potionName });
  sendToSpectators(room, 'card_reveal', { cardName: potionName });
  await room.engine._delay(100);

  if (cardType === 'Artifact' && ps.itemLocked && (ps.hand || []).length > 0) {
    await room.engine.actionPromptForceDiscard(pi, 1, {
      title: 'Item Lock Cost',
      description: 'You must delete 1 card from your hand to use an Artifact.',
      source: 'Item Lock', deleteMode: true, selfInflicted: true,
    });
  }

  let chainResult;
  try {
    chainResult = await room.engine.executeCardWithChain({
      cardName: potionName, owner: pi, cardType, goldCost: goldCost || 0,
      resolve: script.resolve ? async () => await script.resolve(room.engine, pi, selectedIds, validTargets) : null,
    });
  } catch (err) {
    console.error('[Engine] doConfirmPotion chain error:', err.message);
    chainResult = { negated: false, chainFormed: false, resolveResult: null };
  }

  if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
    ps.gold -= goldCost;
  }

  if (chainResult.resolveResult?.aborted) {
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
    return true;
  }

  if (chainResult.resolveResult?.cancelled) {
    if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
      ps.gold += goldCost;
    }
    ps._resolvingCard = null;
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  await room.engine._delay(100);

  const hi = getResolvingHandIndex(ps);
  ps._resolvingCard = null;
  if (hi >= 0) {
    ps.hand.splice(hi, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    // Foreign-origin cards (Magic Lamp gifts etc.) discard / delete
    // to the ORIGINAL owner's pile. `_consumeHandCardOrigin` returns
    // `pi` for normally-owned cards.
    const pileOwner = room.engine._consumeHandCardOrigin(pi, potionName);
    const pilePs = gs.players[pileOwner];
    if (chainResult.negated) {
      pilePs.discardPile.push(potionName);
    } else if (cardType === 'Potion') {
      const potionHookCtx = { potionName, potionOwner: pi, placed: false, _skipReactionCheck: true };
      await room.engine.runHooks('afterPotionUsed', potionHookCtx);
      if (!potionHookCtx.placed) pilePs.deletedPile.push(potionName);
      checkPotionLock(ps, gs, pi);
    } else {
      pilePs.discardPile.push(potionName);
    }
  } else {
    if (!chainResult.negated && cardType === 'Potion') checkPotionLock(ps, gs, pi);
  }

  if (!chainResult.negated && (script.animationType || 'explosion') !== 'none') {
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
    }
    sendToSpectators(room, 'potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlaySurprise(room, pi, { cardName, handIndex, heroIdx, bakhmSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const script = loadCardEffect(cardName);
  if (!script?.isSurprise) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || (cardData.subtype || '').toLowerCase() !== 'surprise') return false;

  const hero = ps.heroes[heroIdx];
  if (!hero || !hero.name || hero.hp <= 0) return false;

  // Bakhm Support-Zone placement: Surprise Creatures can go into Bakhm's own
  // Support Zones instead of the Surprise Zone.
  if (bakhmSlot != null && bakhmSlot >= 0) {
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated || hero.statuses?.bound) return false;
    const heroScript = loadCardEffect(hero.name);
    if (!heroScript?.isBakhmHero) return false;
    if (cardData.cardType !== 'Creature') return false;
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    if ((ps.supportZones[heroIdx][bakhmSlot] || []).length > 0) return false;

    ps.supportZones[heroIdx][bakhmSlot] = [cardName];
    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

    const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, bakhmSlot);
    inst.faceDown = true;

    room.engine.log('surprise_set', { player: ps.username, hero: hero.name, bakhmSlot: true });
    broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: bakhmSlot, faceDown: true });

    try {
      await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });
    } catch (err) {
      console.error('[Engine] doPlaySurprise (bakhm) hooks error:', err.message);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // Regular Surprise-Zone placement. Each Hero has only 1 Surprise Zone.
  if ((ps.surpriseZones[heroIdx] || []).length > 0) return false;

  if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
  ps.surpriseZones[heroIdx] = [cardName];
  ps.hand.splice(handIndex, 1);
  if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

  const inst = room.engine._trackCard(cardName, pi, 'surprise', heroIdx, 0);
  inst.faceDown = true;

  room.engine.log('surprise_set', { player: ps.username, hero: hero.name });
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'surprise', heroIdx, slotIdx: 0, faceDown: true });

  try {
    await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx, _skipReactionCheck: true });
  } catch (err) {
    console.error('[Engine] doPlaySurprise hooks error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doUsePotion(room, pi, { cardName, handIndex }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps.potionLocked) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;
  if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Potion') return false;

  const script = loadCardEffect(cardName);
  if (!script?.isPotion) return false;
  if (script.canActivate && !script.canActivate(gs, pi)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;

  // Targeted Potions enter targeting mode; the CPU defers them until 2i (the
  // targeting brain). Callers should pre-filter those — this branch still
  // supports them for the human socket path.
  if (script.getValidTargets && script.targetingConfig) {
    const validTargets = script.getValidTargets(gs, pi, room.engine);
    gs.potionTargeting = {
      potionName: cardName, handIndex, ownerIdx: pi,
      cardType: 'Potion', validTargets, config: script.targetingConfig,
    };
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // No targeting — mark this card instance as resolving and execute.
  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  try {
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;
    if (!script.deferBroadcast) {
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
      sendToSpectators(room, 'card_reveal', { cardName });
      await room.engine._delay(100);
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
    await room.engine._delay(100);

    if (chainResult.resolveResult?.cancelled) {
      ps._resolvingCard = null;
      delete gs._pendingPlayLog;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }
    room.engine._firePendingPlayLog();

    const currentIdx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (currentIdx >= 0) {
      ps.hand.splice(currentIdx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
      // Foreign-origin Potions (Magic Lamp gifts etc.) route to the
      // ORIGINAL owner's pile. Resolves to `pi` for normally-owned
      // Potions, so the local-pile case is unchanged.
      const pileOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      const pilePs = gs.players[pileOwner];
      if (chainResult.negated) {
        pilePs.discardPile.push(cardName);
      } else if (chainResult.resolveResult?.placed) {
        checkPotionLock(ps, gs, pi);
      } else {
        const potionHookCtx = { potionName: cardName, potionOwner: pi, placed: false, _skipReactionCheck: true };
        await room.engine.runHooks('afterPotionUsed', potionHookCtx);
        if (potionHookCtx.placed) {
          checkPotionLock(ps, gs, pi);
        } else {
          pilePs.deletedPile.push(cardName);
          checkPotionLock(ps, gs, pi);
        }
      }
    } else {
      if (!chainResult.negated && !chainResult.resolveResult?.placed) checkPotionLock(ps, gs, pi);
    }
  } catch (err) {
    console.error('[Engine] doUsePotion error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doUseArtifactEffect(room, pi, { cardName, handIndex }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps.itemLocked && (ps.hand || []).length < 2) return false;
  // Boomerang's "no Artifacts for the rest of this turn" lockout —
  // covers Normal / Reaction-with-proactivePlay Artifacts that route
  // through this handler.
  if (ps._artifactLockTurn === gs.turn) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;
  if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Artifact') return false;
  if ((cardData.subtype || '').toLowerCase() === 'equipment') return false;

  const rawCost = cardData.cost || 0;
  const costReduction = ps._nextArtifactCostReduction || 0;
  const cost = Math.max(0, rawCost - costReduction);
  if ((ps.gold || 0) < cost) return false;

  const script = loadCardEffect(cardName);
  if (!script) return false;
  if ((cardData.subtype || '').toLowerCase() === 'reaction' && !script.proactivePlay) return false;
  if (script.canActivate && !script.canActivate(gs, pi)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;

  // Targeting-required Artifacts enter targeting mode; the CPU doesn't yet
  // handle Artifact targeting (scheduled for 2i), so callers should pre-filter
  // those and only invoke this helper on the non-targeting path.
  if (script.getValidTargets && script.targetingConfig) {
    const validTargets = script.getValidTargets(gs, pi, room.engine);
    const config = typeof script.targetingConfig === 'function'
      ? script.targetingConfig(gs, pi, cost)
      : { ...script.targetingConfig };
    if (script.manualGoldCost && !config.maxTotal) {
      config.maxTotal = cost > 0 ? Math.floor((ps.gold || 0) / cost) : 99;
    }
    gs.potionTargeting = {
      potionName: cardName, handIndex, ownerIdx: pi,
      cardType: 'Artifact', goldCost: cost, validTargets, config,
    };
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  if (!script.resolve) return false;

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  // Hand-to-board fly animation for non-equipment, non-creature, non-targeting
  // Artifacts (Normal / Reaction-with-proactivePlay). The destination is the
  // permanents zone (or the board area if none renders yet).
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'permanent' });

  try {
    if (!script.deferBroadcast) {
      gs._pendingCardReveal = { cardName, ownerIdx: pi };
    }
    room.engine._setPendingPlayLog('card_played', { player: ps.username, card: cardName, cardType: 'Artifact', cost: cost || 0 });

    if (ps.itemLocked && (ps.hand || []).length > 0) {
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      await room.engine.actionPromptForceDiscard(pi, 1, {
        title: 'Item Lock Cost',
        description: 'You must delete 1 card from your hand to use an Artifact.',
        source: 'Item Lock', deleteMode: true, selfInflicted: true,
      });
    }

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
    await room.engine._delay(100);

    if (chainResult.resolveResult?.cancelled) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      ps._resolvingCard = null;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
    else room.engine._firePendingPlayLog();

    if (cost > 0 && !script.manualGoldCost && !chainResult.negated) ps.gold -= cost;
    if (!chainResult.negated && costReduction > 0) {
      delete ps._nextArtifactCostReduction;
      delete ps._nextArtifactCostReductionTurn;
    }

    const currentIdx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (currentIdx >= 0) {
      ps.hand.splice(currentIdx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
      if (chainResult.negated) ps.discardPile.push(cardName);
      else if (script.deleteOnUse) ps.deletedPile.push(cardName);
      else ps.discardPile.push(cardName);
    }
  } catch (err) {
    console.error('[Engine] doUseArtifactEffect error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
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
      // Check if the selected deck is a sample deck (starter or owned structure).
      if (p.deckId && p.deckId.startsWith('sample-')) {
        const samples = loadSampleDecks();
        const pick = samples.find(s => s.id === p.deckId) || null;
        if (pick && pick.isStructure) {
          // Verify ownership — a structure deck can only be used if unlocked.
          const owned = await db.get(
            "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
            [p.userId, pick.structureId]
          );
          if (owned) deck = pick;
        } else {
          deck = pick;
        }
      }

      if (!deck) {
        let deckRow = p.deckId ? await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [p.deckId, p.userId]) : null;
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? AND is_default = 1', [p.userId]);
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at LIMIT 1', [p.userId]);
        deck = deckRow ? parseDeck(deckRow) : null;
      }

      // User has a pinned sample/structure default deck but no custom deck —
      // use that pinned one (re-verifying ownership for structures).
      if (!deck) {
        const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [p.userId]);
        const pinnedId = userRow?.default_sample_deck_id;
        if (pinnedId) {
          const samples = loadSampleDecks();
          const pick = samples.find(s => s.id === pinnedId) || null;
          if (pick && pick.isStructure) {
            const owned = await db.get(
              "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
              [p.userId, pick.structureId]
            );
            if (owned) deck = pick;
          } else if (pick) {
            deck = pick;
          }
        }
      }

      if (!deck || (!deck.mainDeck.length && !deck.heroes.some(h => h.hero))) {
        // New-account fallback uses only STARTER decks (structure decks stay
        // locked until purchased).
        const starters = loadSampleDecks().filter(s => !s.isStructure);
        if (starters.length > 0) {
          const hash = [...p.userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
          deck = starters[Math.abs(hash) % starters.length];
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

async function startGameEngine(room, roomId, activePlayer, afterInit) {
  room.gameState.activePlayer = activePlayer;
  room.gameState.turn = 1;
  room.gameState.awaitingFirstChoice = false;
  room.engine = new GameEngine(room, io, sendGameState, endGame, sendSpectatorGameState);
  room.engine.init();

  // Optional hook: callers (e.g. singleplayer) use this to configure the
  // engine (swap onGameOver, set _cpuPlayerIdx, install the CPU brain)
  // BEFORE onBeforeHandDraw fires — otherwise a Hero with an onBeforeHandDraw
  // prompt (Bill) would try to prompt the CPU's non-existent socket.
  if (afterInit) afterInit(room.engine);

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
            // Disconnect previous socket for this user (prevents dual-tab issues)
            const oldSocketId = room.players[pi]?.socketId;
            if (oldSocketId && oldSocketId !== socket.id) {
              const oldSocket = io.sockets.sockets.get(oldSocketId);
              if (oldSocket) {
                oldSocket.leave('room:' + activeRoomId);
                oldSocket.emit('superseded', { reason: 'This session was opened in another tab.' });
                oldSocket.disconnect(true);
              }
            }
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
        if (specEntry) {
          // Disconnect previous socket for this spectator (prevents dual-tab issues)
          const oldSpecSocketId = specEntry.socketId;
          if (oldSpecSocketId && oldSpecSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(oldSpecSocketId);
            if (oldSocket) {
              oldSocket.leave('room:' + roomId);
              oldSocket.emit('superseded', { reason: 'This session was opened in another tab.' });
              oldSocket.disconnect(true);
            }
          }
          specEntry.socketId = socket.id;
        }
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
        console.log(`[SP trace] mulligan both decided — activePlayer=${gs.activePlayer}, calling engine.startGame()`);
        gs.mulliganPending = false;
        delete gs.mulliganDecisions;
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        room.engine.startGame()
          .then(() => console.log('[SP trace] engine.startGame() resolved'))
          .catch(err => console.error('[Engine] startGame error:', err.message));
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
      if (pi >= 0) {
        const winnerIdx = pi === 0 ? 1 : 0;
        if (room.type === 'puzzle') {
          puzzleEndGame(room, winnerIdx, 'surrender');
          // Puzzle surrender: clean up immediately so the player can start a new puzzle
          socket.leave('room:' + roomId);
          activeGames.delete(currentUser.userId);
        }
        else if (room.type === 'singleplayer') {
          // Don't cleanup — the client's handleSurrender intentionally keeps
          // the user on the result screen so they can rematch. endCpuBattle
          // sets gs.result and sends a final game_state; the room stays alive
          // until the user explicitly rematches (rematch_cpu_battle) or
          // leaves (post-result leave_game, handled below).
          endCpuBattle(room, winnerIdx, 'surrender');
        }
        else await endGame(room, winnerIdx, 'surrender');
      }
      // Don't mark as left — both players should see Rematch/Leave
      return;
    }

    // Singleplayer post-result: clean up immediately — the CPU never calls leave_game
    // itself, so the "every player left" check used by PvP games can never fire.
    if (hadResult && room.gameState && room.type === 'singleplayer') {
      socket.leave('room:' + roomId);
      cleanupRoom(roomId);
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
  socket.on('reorder_hand', ({ roomId, hand, indexMap }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Validate: same cards, just reordered.
    const ps = room.gameState.players[pi];
    const current = ps.hand;
    if (hand.length !== current.length) return;
    const sorted1 = [...hand].sort();
    const sorted2 = [...current].sort();
    if (sorted1.some((c, i) => c !== sorted2[i])) return;
    // Validate the optional permutation. `indexMap[newIdx] = oldIdx`.
    // Must be a permutation of [0..n) and each hand entry must match
    // the source-old position (newHand[newIdx] === oldHand[oldIdx]).
    let validMap = null;
    if (Array.isArray(indexMap) && indexMap.length === hand.length) {
      const seen = new Set();
      let ok = true;
      for (let newIdx = 0; newIdx < hand.length; newIdx++) {
        const oldIdx = indexMap[newIdx];
        if (typeof oldIdx !== 'number' || oldIdx < 0 || oldIdx >= current.length || seen.has(oldIdx)) { ok = false; break; }
        if (current[oldIdx] !== hand[newIdx]) { ok = false; break; }
        seen.add(oldIdx);
      }
      if (ok) validMap = indexMap;
    }
    // Per-copy reveal state (Luna Kiai per-turn, Bamboo Shield
    // permanent) is keyed by hand index. With a valid indexMap we can
    // remap old→new positions so reveals follow their physical copy.
    // Without one, we fall back to clearing.
    const remap = (oldMap) => {
      const out = {};
      if (oldMap && validMap) {
        for (let newIdx = 0; newIdx < hand.length; newIdx++) {
          if (oldMap[validMap[newIdx]]) out[newIdx] = true;
        }
      }
      return out;
    };
    ps._revealedHandIndices = remap(ps._revealedHandIndices);
    ps._permanentlyRevealedHandIndices = remap(ps._permanentlyRevealedHandIndices);
    ps.hand = hand;
    // Array reassignment wiped the splice interceptor — re-install.
    if (room.engine) room.engine._installHandRevealInterceptor(pi);
    // Push a fresh snapshot so the reordering player's client picks up
    // the remapped `handActivatableCards` / `revealedOwnHandIndices`.
    // Without this, per-index UI state (Luna Kiai's clickable halo +
    // revealed semi-transparency) stays pinned to the OLD positions
    // until the next unrelated event drives a snapshot.
    for (let i = 0; i < 2; i++) sendGameState(room, i);
    sendSpectatorGameState(room);
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

  // Play an ability from hand onto a hero (thin socket wrapper — logic lives in doPlayAbility)
  socket.on('play_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlayAbility(room, pi, params).catch(err => console.error('[play_ability] error:', err.message));
  });

  // ── Place a Surprise card face-down into a Hero's Surprise Zone ──
  socket.on('play_surprise', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlaySurprise(room, pi, params).catch(err => console.error('[play_surprise] error:', err.message));
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
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated || hero.statuses?.bound) return;

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
    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;
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
  socket.on('activate_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateAbility(room, pi, params).catch(err => console.error('[activate_ability]', err.message));
  });

  // Activate a free-activation ability (no action cost, Main Phase only)
  socket.on('activate_free_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateFreeAbility(room, pi, params).catch(err => console.error('[activate_free_ability] error:', err.message));
  });

  // Activate a hero's active effect (Main Phase, no action cost)
  socket.on('activate_hero_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateHeroEffect(room, pi, params).catch(err => console.error('[activate_hero_effect]', err.message));
  });

  // ── ACTIVE CREATURE EFFECTS ──
  // Generic Area-effect activation — Deepsea Castle etc. The engine's
  // activateAreaEffect validates turn/phase/HOPT, re-runs the card's
  // canActivateAreaEffect gate, and invokes onAreaEffect(ctx).
  socket.on('activate_area_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateAreaEffect(room, pi, params).catch(err => console.error('[activate_area_effect]', err.message));
  });

  socket.on('activate_creature_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateCreatureEffect(room, pi, params).catch(err => console.error('[activate_creature_effect] error:', err.message));
  });

  // Activate an equipped card's active effect (Slippery Skates, etc.)
  socket.on('activate_equip_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateEquipEffect(room, pi, params).catch(err => console.error('[activate_equip_effect]', err.message));
  });

  // Activate a permanent card's effect
  socket.on('activate_permanent', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivatePermanent(room, pi, params).catch(err => console.error('[activate_permanent]', err.message));
  });

  // Activate a hand card's "handActivatedEffect" without playing it.
  // Luna Kiai's "reveal to Burn" — and any future card with the same shape.
  socket.on('activate_hand_card', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState || !room.engine) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const cardName = params?.cardName;
    const handIndex = params?.handIndex;
    if (typeof cardName !== 'string') return;
    if (typeof handIndex !== 'number' || handIndex < 0) return;
    (async () => {
      try {
        await room.engine.doHandActivate(pi, cardName, handIndex);
      } catch (err) {
        console.error('[activate_hand_card]', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      sendSpectatorGameState(room);
    })();
  });

  // Play a creature from hand to support zone
  socket.on('play_creature', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlayCreature(room, pi, params).catch(err => console.error('[play_creature] error:', err.message));
  });


  // Play a spell or attack from hand (drag onto a hero)
  socket.on('play_spell', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlaySpell(room, pi, params).catch(err => console.error('[play_spell] error:', err.message));
  });

  // Play an artifact from hand
  socket.on('play_artifact', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlayArtifact(room, pi, params).catch(err => console.error('[play_artifact] error:', err.message));
  });

  // ── Potion system ──

  // Start using a potion (enters targeting mode if needed)
  socket.on('use_potion', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doUsePotion(room, pi, params).catch(err => console.error('[use_potion] error:', err.message));
  });

  // Use a non-equip artifact from hand (targeting mode)
  socket.on('use_artifact_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doUseArtifactEffect(room, pi, params).catch(err => console.error('[use_artifact_effect] error:', err.message));
  });

  // Confirm potion/artifact targeting selection
  socket.on('confirm_potion', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doConfirmPotion(room, pi, params).catch(err => console.error('[confirm_potion] error:', err.message));
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
    if (room.engine) room.engine.resolveEffectPrompt(null, { cancelled: true });
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

  // ── Hero Ascension ──

  socket.on('ascend_hero', async ({ roomId, heroIdx, cardName, handIndex }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState || room.gameState.result) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Must be active player during Main Phase 1 or 2
    if (pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // MAIN1=2, MAIN2=4
    // Perform ascension via engine
    try {
      const result = await room.engine.performAscension(pi, heroIdx, cardName, handIndex);
      if (!result.success) return;
      // Skip to End Phase if required
      if (result.skipEndPhase) {
        await room.engine.advanceToPhase(pi, 5); // PHASES.END = 5
      }
    } catch (err) {
      console.error('[Engine] ascend_hero error:', err.message, err.stack);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i);
    sendSpectatorGameState(room);
  });

  // ── Surrender Game vs Surrender Match (Bo3/Bo5) ──

  socket.on('surrender_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState || room.gameState.result) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const winnerIdx = pi === 0 ? 1 : 0;
    if (room.type === 'puzzle') { puzzleEndGame(room, winnerIdx, 'surrender'); return; }
    await endGame(room, winnerIdx, 'surrender');
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

  // ── Puzzle / Single-Player Battle ──────────────────────────────────

  // Shared function: create and start a puzzle game from puzzle data
  async function createPuzzleGame(puzzleData, opts = {}) {
    const roomId = 'pz-' + uuidv4().substring(0, 8);
    const cardsByName = getCardDB();
    const usr = await db.get('SELECT color, avatar, cardback, board FROM users WHERE id = ?', [currentUser.userId]);

    const buildPlayerState = (pz, userId, username, socketId, hand) => {
      // Normalize statuses loaded from the puzzle editor so they behave like
      // statuses applied during normal play. The editor stores statuses as
      // either `true` (non-stacking: frozen, stunned, burned, negated, ...)
      // or `{ stacks: N }` (poisoned). Neither shape carries the `appliedTurn`
      // field that cards like Coffee use to tell "inflicted this turn" apart
      // from "inflicted previously". Since puzzle statuses represent the
      // pre-existing board state before the player's turn begins, they MUST
      // count as "not inflicted this turn" — i.e. have an appliedTurn that
      // is strictly less than the puzzle's starting turn (which is 1).
      //
      // We normalize to appliedTurn: 0 for anything missing one. Any future
      // editor format that writes appliedTurn explicitly is preserved.
      const normalizePuzzleStatuses = (raw) => {
        if (!raw || typeof raw !== 'object') return {};
        const out = {};
        for (const key of Object.keys(raw)) {
          const v = raw[key];
          if (v == null || v === false) continue;
          if (v === true) {
            out[key] = { appliedTurn: 0 };
          } else if (typeof v === 'object') {
            out[key] = { appliedTurn: 0, ...v };
            // If editor explicitly set appliedTurn, the spread above already
            // overrode the default (object props win in right-side spread).
          } else {
            // Unknown shape — coerce to a minimal object form
            out[key] = { appliedTurn: 0, value: v };
          }
        }
        return out;
      };

      const heroes = (pz.heroes || []).map(h => {
        if (!h || !h.name) return { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} };
        return {
          name: h.name, hp: h.hp ?? 0, maxHp: h.maxHp ?? h.hp ?? 0,
          atk: h.atk ?? 0, baseAtk: h.baseAtk ?? h.atk ?? 0,
          statuses: normalizePuzzleStatuses(h.statuses),
          buffs: h.buffs ? JSON.parse(JSON.stringify(h.buffs)) : undefined,
        };
      });
      while (heroes.length < 3) heroes.push({ name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} });

      return {
        userId, username, socketId,
        color: '#00f0ff', avatar: null, cardback: null, board: null,
        heroes,
        abilityZones: (pz.abilityZones || [[], [], []]).map(hz => (hz || [[], [], []]).map(slot => [...(slot || [])])),
        surpriseZones: (pz.surpriseZones || [[], [], []]).map(sz => [...(sz || [])]),
        supportZones: (pz.supportZones || [[], [], []]).map(hz => (hz || [[], [], []]).map(slot => [...(slot || [])])),
        hand: [...(hand || [])],
        mainDeck: [...(pz.mainDeck || [])],
        potionDeck: [...(pz.potionDeck || [])],
        discardPile: [...(pz.discardPile || [])],
        deletedPile: [...(pz.deletedPile || [])],
        disconnected: false, left: false,
        gold: pz.gold ?? 0,
        abilityGivenThisTurn: [false, false, false],
        islandZoneCount: [...(pz.islandZoneCount || [0, 0, 0])],
        damageLocked: false, itemLocked: false,
        dealtDamageToOpponent: false, potionLocked: false,
        potionsUsedThisTurn: 0,
        permanents: (pz.permanents || []).map(pm => ({ name: pm.name, id: pm.id || ('p' + Date.now() + Math.random()) })),
        _oncePerGameUsed: new Set(),
        _resolvingCard: null,
        deckSkins: {},
      };
    };

    const p0 = buildPlayerState(puzzleData.players[0], currentUser.userId, currentUser.username, socket.id, puzzleData.hand || []);
    const p1 = buildPlayerState(puzzleData.players[1], 'cpu-puzzle', 'CPU', null, puzzleData.oppHand || []);
    if (usr) {
      p0.color = usr.color || '#00f0ff'; p0.avatar = usr.avatar;
      p0.cardback = usr.cardback; p0.board = usr.board;
      // Apply the player's chosen board skin to the CPU side too so the
      // whole puzzle playfield — including the opponent's Area Zone —
      // uses the same skin as a normal game instead of the default.
      p1.board = usr.board;
      p1.cardback = usr.cardback;
    }

    const gs = {
      players: [p0, p1],
      areaZones: (puzzleData.areaZones || [[], []]).map(az => [...(az || [])]),
      turn: 1, activePlayer: 0, currentPhase: 0,
      result: null, rematchRequests: [],
      awaitingFirstChoice: false,
      isPuzzle: true,
      isTutorial: opts.isTutorial || false,
      _puzzleAttemptId: opts.puzzleAttemptId || null,
      _puzzleDifficulty: opts.puzzleDifficulty || null,
      _puzzleRawData: JSON.parse(JSON.stringify(puzzleData)),
      _gameStartTime: Date.now(),
      _playerIPs: [getSocketIP(socket), 'cpu'],
    };

    const room = {
      id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: 'puzzle', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: null },
        { username: 'CPU', userId: 'cpu-puzzle', socketId: null, deckId: null },
      ],
      spectators: [], status: 'playing', created: Date.now(),
      gameState: gs, chatHistory: [], privateChatHistory: {},
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);
    activeGames.set(currentUser.userId, roomId);

    room.engine = new GameEngine(room, io, sendGameState, (r, winnerIdx, reason) => puzzleEndGame(r, winnerIdx, reason), sendSpectatorGameState);
    room.engine.isPuzzle = true;
    room.engine._cpuPlayerIdx = 1;
    room.engine.init();

    // Pre-placed creatures should behave as if summoned last turn (no summoning sickness,
    // count for Alice's damage, etc.). init() sets turnPlayed = current turn (1), so
    // backdate all support zone instances to turn 0.
    for (const inst of room.engine.cardInstances) {
      if (inst.zone === 'support') inst.turnPlayed = 0;
    }

    // ── Apply player-state starting debuffs ──
    // The Puzzle Creator stores `playerDebuffs` as `[meDebuffs, oppDebuffs]`,
    // each an array of registry keys. Most simply set a player flag the
    // engine and UI already read; `flashbanged` additionally tracks a
    // Flashbang sentinel instance in the deleted pile so its onActionUsed
    // hook fires correctly when the affected player takes their first
    // action of the puzzle.
    if (Array.isArray(puzzleData.playerDebuffs)) {
      const flagByKey = {
        flashbanged:        '_flashbangedDebuff',
        summonLocked:       'summonLocked',
        damageLocked:       'damageLocked',
        oppHandLocked:      'oppHandLocked',
        itemLocked:         'itemLocked',
        potionLocked:       'potionLocked',
        supportSpellLocked: 'supportSpellLocked',
        forsaken:           '_discardToDeleteActive',
        handLocked:         'handLocked',
      };
      for (let pi = 0; pi < 2; pi++) {
        const debuffs = puzzleData.playerDebuffs[pi] || [];
        const ps = gs.players[pi];
        if (!ps) continue;
        for (const key of debuffs) {
          const flag = flagByKey[key];
          if (flag) ps[flag] = true;
          if (key === 'flashbanged') {
            // Sentinel Flashbang in the deleted pile, owned by the
            // OPPONENT (whoever would have used the potion), targeting
            // the affected player and pre-armed for the puzzle's first
            // turn so the trigger fires on their first action.
            const opp = pi === 0 ? 1 : 0;
            const inst = room.engine._trackCard('Flashbang', opp, 'deleted', -1, -1);
            if (!inst.counters) inst.counters = {};
            inst.counters.flashbangTargetIdx = pi;
            inst.counters.flashbangArmedTurn = gs.turn;
          }
        }
      }
    }

    // Apply creature custom HP and statuses
    for (let pi = 0; pi < 2; pi++) {
      const pz = puzzleData.players[pi];
      if (!pz) continue;
      for (let hi = 0; hi < (pz.supportZones || []).length; hi++) {
        for (let slot = 0; slot < (pz.supportZones[hi] || []).length; slot++) {
          const cards = pz.supportZones[hi][slot] || [];
          if (cards.length === 0) continue;
          const inst = room.engine.cardInstances.find(c =>
            c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === slot
          );
          if (!inst) continue;
          // Explicitly stamp max HP from cards.json on every preset
          // creature so downstream readers (sacrifice thresholds, Alice's
          // damage, UI displays) see a populated value instead of
          // undefined. Max HP ALWAYS tracks cards.json in puzzle mode —
          // customHp below only affects CURRENT HP.
          const cd = cardsByName[inst.name];
          if (cd?.hp) inst.counters.maxHp = cd.hp;

          const cs = pz._creatureStatuses?.[hi + '-' + slot];

          // Dream-Landers attach: apply BEFORE customHp so any HP bump
          // from `onAttachHero` lands on the base, then customHp can
          // override `currentHp` to the user's authored value. Stamps
          // `inst.counters.attachedHero` and re-runs the creature
          // script's `onAttachHero` so future attach Creatures inherit
          // the same bookkeeping with no engine edits.
          if (cs?.attachedHero) {
            inst.counters.attachedHero = cs.attachedHero;
            const creatureScript = loadCardEffect(inst.name);
            if (typeof creatureScript?.onAttachHero === 'function') {
              try {
                const ctx = room.engine._createContext(inst, {});
                creatureScript.onAttachHero(room.engine, ctx);
              } catch (err) {
                console.error(`[puzzle attachHero] ${inst.name} onAttachHero threw:`, err.message);
              }
            }
          }

          const customHp = pz._customSupportHp?.[hi]?.[slot];
          if (customHp != null) {
            // customHp is CURRENT HP only — may be above or below the
            // card's max. Effects that check max HP still see cards.json.
            inst.counters.currentHp = customHp;
          }
          if (cs) {
            if (cs.frozen) inst.counters.frozen = 1;
            if (cs.stunned) inst.counters.stunned = 1;
            if (cs.burned) inst.counters.burned = 1;
            if (cs.negated) inst.counters.negated = 1;
            if (cs.poisoned) { inst.counters.poisoned = 1; inst.counters.poisonStacks = cs.poisoned.stacks || 1; }
            if (cs.buffs) { if (!inst.counters.buffs) inst.counters.buffs = {}; Object.assign(inst.counters.buffs, cs.buffs); }
            // Taunt mirror: when a puzzle creature carries the
            // forcesTargeting buff, set the functional counter the engine
            // filter actually reads. No pi restriction (= any opposing
            // caster) and no untilTurn (= permanent).
            if (cs.buffs?.forcesTargeting) {
              inst.counters.forcesTargeting = true;
            }
            // Anti Magic Enchantment buff on an Equip needs its functional
            // counter too — the `antiMagicEnchanted` counter is what the
            // engine reads to offer spell-negation, the buff is just the
            // visible icon. Set both so puzzle-authored equips protect heroes.
            if (cs.buffs?.anti_magic_enchanted) {
              inst.counters.antiMagicEnchanted = { ownerPi: pi, charges: 1 };
            }
            // Biomancy Token: a Potion placed in a Support Zone in the
            // puzzle builder represents a Biomancy Token. Apply the same
            // override counters the runtime Biomancy ability sets up so
            // the in-game behavior (Creature/Token with HP, once-per-turn
            // damage effect) is identical whether the token was created
            // during play or authored into a puzzle.
            if (cs.biomancyLevel) {
              const level = Math.max(1, Math.min(3, cs.biomancyLevel));
              const stats = { 1: 40, 2: 60, 3: 80 }[level];
              const potionData = cardsByName[inst.name];
              inst.counters._cardDataOverride = {
                ...(potionData || {}),
                cardType: 'Creature/Token',
                hp: stats,
                effect: `Once per turn: Deal ${stats} damage to any target on the board.`,
              };
              inst.counters._effectOverride = 'Biomancy Token';
              inst.counters.currentHp = stats;
              inst.counters.maxHp = stats;
              inst.counters.biomancyDamage = stats;
              inst.counters.biomancyLevel = level;
            }
            // Cute Hydra Head Counter — authored in the puzzle editor,
            // mirrors what the live `onPlay` handler stamps after the
            // discard prompt. The board renderer keys off
            // `inst.counters.headCounter` for the badge AND the HOPT
            // creature-effect uses it as the cap on different targets,
            // so a puzzle Hydra with N counters can immediately strike
            // up to N targets on its first activation.
            if (typeof cs.headCounter === 'number' && cs.headCounter > 0) {
              inst.counters.headCounter = cs.headCounter;
            }
            // Sleeping Beauty's linked-hero slot — authored in the puzzle
            // editor. The link is per-SLOT (matches in-game behavior:
            // a Hero swapped into the slot inherits the tether). Owner
            // is implicit (= Beauty's controller, `pi`). The script
            // reads these counters in `canActivateCreatureEffect` /
            // `onCreatureEffect` / `onCreatureDeath`.
            if (typeof cs._linkedHeroIdx === 'number'
                && cs._linkedHeroIdx >= 0 && cs._linkedHeroIdx <= 2) {
              inst.counters._linkedHeroOwner = pi;
              inst.counters._linkedHeroIdx   = cs._linkedHeroIdx;
            }
          }
        }
      }
    }

    // Track permanents
    for (let pi = 0; pi < 2; pi++) {
      for (const pm of (gs.players[pi].permanents || [])) {
        room.engine._trackCard(pm.name, pi, 'permanent');
      }
    }

    // Start the puzzle game — go directly to Main Phase 1
    socket.emit('room_joined', { id: roomId, host: currentUser.username, players: room.players.map(p => ({ username: p.username })), spectators: [], status: 'playing', type: 'puzzle' });
    socket.emit('game_started', { id: roomId, players: room.players.map(p => ({ username: p.username })), status: 'playing', type: 'puzzle' });

    (async () => {
      try {
        for (const ps of gs.players) {
          if (!ps) continue;
          ps.summonLocked = false; ps.handLocked = false; ps.damageLocked = false;
          ps.dealtDamageToOpponent = false; ps.potionLocked = false;
          ps.oppHandLocked = false;
          ps.supportSpellLocked = false; ps.supportSpellUsedThisTurn = false;
          ps.potionsUsedThisTurn = 0; ps.attacksPlayedThisTurn = 0; ps.spellsPlayedThisTurn = 0;
          ps.comboLockHeroIdx = null; ps.heroesActedThisTurn = []; ps.heroesAttackedThisTurn = [];
          ps._creaturesSummonedThisTurn = 0; ps.bonusActions = null; ps._bonusMainActions = 0;
          ps._actionsPlayedThisPhase = 0;
          ps.abilityGivenThisTurn = [false, false, false];
          for (const hero of (ps.heroes || [])) { if (hero?._actionsThisTurn) hero._actionsThisTurn = 0; }
        }
        room.engine._resetTerrorTracking();
        await room.engine.runHooks('onGameStart', { _skipReactionCheck: true });
        // Puzzles skip the normal Resource/Action phases and jump straight to Main Phase 1.
        // Fire onTurnStart so cards that rely on it for per-turn setup (Slime Rancher,
        // additional actions, etc.) are correctly initialised before the player acts.
        await room.engine.runHooks('onTurnStart', { playerIdx: 0, _skipReactionCheck: true });
        gs.currentPhase = 2; // PHASES.MAIN1
        gs.unactivatableArtifacts = room.engine.getUnactivatableArtifacts(0);
        room.engine.log('phase_start', { phase: 'Main Phase 1' });
        room.engine.sync();
      } catch (err) {
        console.error('[Puzzle] startup error:', err.message, err.stack);
      }
    })();

    return roomId;
  }

  // Creator test: raw puzzle data from client
  socket.on('start_puzzle', (puzzleData) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }
    if (!puzzleData?.players?.[0] || !puzzleData?.players?.[1]) { socket.emit('puzzle_error', 'Invalid puzzle data'); return; }
    createPuzzleGame(puzzleData).catch(err => {
      console.error('[Puzzle] start_puzzle error:', err.message, err.stack);
      socket.emit('puzzle_error', 'Failed to start puzzle: ' + err.message);
    });
  });

  // Export puzzle: encrypt server-side, send back to client for download
  socket.on('export_puzzle', (puzzleData) => {
    if (!currentUser) return;
    try {
      const encrypted = encryptPuzzle(puzzleData);
      socket.emit('puzzle_exported', { data: encrypted });
    } catch (err) {
      console.error('[Puzzle] export error:', err.message);
      socket.emit('puzzle_error', 'Encryption failed: ' + err.message);
    }
  });

  // Get puzzle list: read puzzle files, check completions
  socket.on('get_puzzles', async () => {
    if (!currentUser) return;
    try {
      const puzzlesDir = path.join(__dirname, 'data', 'puzzles');
      const difficulties = ['easy', 'medium', 'hard'];
      const puzzles = [];

      for (const diff of difficulties) {
        const dir = path.join(puzzlesDir, diff);
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
        for (const file of files) {
          const name = file.replace(/\.json$/, '');
          const puzzleId = diff + '/' + name;
          puzzles.push({ name, difficulty: diff, puzzleId });
        }
      }

      // Check completions for this user
      const completions = await db.all(
        'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ?',
        [currentUser.userId]
      );
      const completedSet = new Set(completions.map(r => r.puzzle_id));

      socket.emit('puzzle_list', puzzles.map(p => ({
        ...p,
        completed: completedSet.has(p.puzzleId),
      })));
    } catch (err) {
      console.error('[Puzzle] get_puzzles error:', err.message);
      socket.emit('puzzle_list', []);
    }
  });

  // Attempt an official puzzle: decrypt file, start game
  socket.on('start_puzzle_attempt', ({ puzzleId, difficulty }) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }

    (async () => {
      try {
        const filePath = path.join(__dirname, 'data', 'puzzles', difficulty, puzzleId.split('/')[1] + '.json');
        if (!fs.existsSync(filePath)) { socket.emit('puzzle_error', 'Puzzle not found'); return; }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const puzzleData = decryptPuzzle(raw.data);

        await createPuzzleGame(puzzleData, {
          puzzleAttemptId: puzzleId,
          puzzleDifficulty: difficulty,
        });
      } catch (err) {
        console.error('[Puzzle] start_puzzle_attempt error:', err.message, err.stack);
        socket.emit('puzzle_error', 'Failed to load puzzle: ' + err.message);
      }
    })();
  });

  // ── Singleplayer CPU battle ──
  async function createCpuBattle({ playerDeckId, cpuDeckId }) {
    if (!currentUser) { socket.emit('cpu_battle_error', 'Not authenticated'); return; }
    if (activeGames.has(currentUser.userId)) { socket.emit('cpu_battle_error', 'Already in a game'); return; }

    // Player deck must be owned (their own custom deck or owned sample).
    // CPU deck can be ANY sample — the CPU playing a structure deck
    // doesn't grant the human anything, and blocking unowned structure
    // decks for the CPU just breaks rematch flows when the UI dropdown
    // offers them as legal options.
    const fetchDeck = async (deckId, { allowUnownedStructure = false, label = 'deck' } = {}) => {
      if (!deckId) {
        console.warn(`[createCpuBattle] ${label}: no deckId provided`);
        return null;
      }
      if (deckId.startsWith('sample-')) {
        const samples = loadSampleDecks();
        const pick = samples.find(s => s.id === deckId) || null;
        if (!pick) {
          console.warn(`[createCpuBattle] ${label}: sample deck '${deckId}' not found in loadSampleDecks() output (${samples.length} available)`);
          return null;
        }
        if (pick.isStructure && !allowUnownedStructure) {
          const owned = await db.get(
            "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
            [currentUser.userId, pick.structureId]
          );
          if (!owned) {
            console.warn(`[createCpuBattle] ${label}: structure deck '${pick.name}' (structureId=${pick.structureId}) not owned by ${currentUser.username}`);
            return null;
          }
        }
        return pick;
      }
      const row = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, currentUser.userId]);
      if (!row) {
        console.warn(`[createCpuBattle] ${label}: user deck id='${deckId}' not found in DB for user ${currentUser.username}`);
        return null;
      }
      return parseDeck(row);
    };

    console.log(`[createCpuBattle] playerDeckId='${playerDeckId}' cpuDeckId='${cpuDeckId}' user=${currentUser.username}`);
    const playerDeck = await fetchDeck(playerDeckId, { label: 'player' });
    const cpuDeck = await fetchDeck(cpuDeckId, { allowUnownedStructure: true, label: 'cpu' });
    if (!playerDeck) { socket.emit('cpu_battle_error', 'Your deck is not available'); return; }
    if (!cpuDeck) { socket.emit('cpu_battle_error', 'CPU deck is not available'); return; }

    const snapshotDeck = (d) => JSON.parse(JSON.stringify({
      mainDeck: d.mainDeck || [], heroes: d.heroes || [],
      potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
      skins: d.skins || {},
    }));

    const roomId = 'sp-' + uuidv4().substring(0, 8);
    const room = {
      id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: playerDeckId },
        { username: 'CPU', userId: 'cpu-sp-' + roomId, socketId: null, deckId: cpuDeckId },
      ],
      spectators: [], status: 'waiting', created: Date.now(),
      gameState: null, chatHistory: [], privateChatHistory: {},
      // Pre-populate _currentDecks so setupGameState uses our fetched decks
      // directly instead of re-querying per-player (which would fail for the CPU user).
      _currentDecks: [snapshotDeck(playerDeck), snapshotDeck(cpuDeck)],
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);

    await setupGameState(room);
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    console.log(`[SP trace] firstPlayer=${firstPlayer} (0=human, 1=CPU)`);
    await startGameEngine(room, roomId, firstPlayer, (engine) => {
      engine.onGameOver = (r, winnerIdx, reason) => endCpuBattle(r, winnerIdx, reason);
      engine._cpuPlayerIdx = 1;
      installCpuBrain(engine);
      console.log(`[SP trace] afterInit — brain installed, _cpuPlayerIdx=${engine._cpuPlayerIdx}`);
    });
    console.log(`[SP trace] startGameEngine returned — mulliganPending=${room.gameState.mulliganPending}`);
    room.engine._cpuDriver = makeCpuDriver(room);
    if (room.gameState.mulliganDecisions) {
      // CPU smart-mulligan: evaluate the opening hand. If too few cards are
      // playable in the first couple of turns, shuffle back and redraw.
      const mull = (() => {
        try { return shouldMulliganStartingHand(room.engine, 1); }
        catch (err) { console.error('[CPU mulligan] check threw:', err.message); return false; }
      })();
      room.gameState.mulliganDecisions[1] = mull;
      if (mull) {
        // Apply the swap synchronously — no animation needed since the CPU's
        // opening hand isn't visible to the human.
        const ps = room.gameState.players[1];
        const cardDB = getCardDB();
        const handSize = ps.hand.length;
        let potionCount = 0;
        for (const card of ps.hand) {
          const cd = cardDB[card];
          if (cd?.cardType === 'Potion') {
            ps.potionDeck.push(card);
            potionCount++;
          } else {
            ps.mainDeck.push(card);
          }
        }
        ps.hand.length = 0;
        const shuffleArr = (arr) => {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
        };
        shuffleArr(ps.mainDeck);
        shuffleArr(ps.potionDeck);
        const mainToDraw = handSize - potionCount;
        for (let i = 0; i < mainToDraw; i++) {
          if (ps.mainDeck.length === 0) break;
          ps.hand.push(ps.mainDeck.shift());
        }
        for (let i = 0; i < potionCount; i++) {
          if (ps.potionDeck.length === 0) break;
          ps.hand.push(ps.potionDeck.shift());
        }
        console.log(`[SP trace] CPU mulligan accepted — new hand size=${ps.hand.length}`);
      }
    }
    console.log(`[SP trace] CPU mulligan decided — decisions=${JSON.stringify(room.gameState.mulliganDecisions)}`);
    for (let i = 0; i < 2; i++) sendGameState(room, i);
  }

  // Debug: snapshot → mutate heavily → restore → compare. Verifies the
  // engine's snapshot/restore methods produce byte-identical state after
  // a round-trip. Client can trigger via:
  //   window.socket.emit('debug_cpu_snapshot_test', { roomId: <current room id> })
  // Results print on the server console AND echo back to the client.
  socket.on('debug_cpu_snapshot_test', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine) {
      const msg = 'no engine for room';
      console.log('[snapshot test]', msg);
      socket.emit('debug_cpu_snapshot_test_result', { ok: false, msg });
      return;
    }
    const engine = room.engine;
    const serialize = (v) => JSON.stringify(v, (_k, val) => {
      if (val instanceof Set) return { __set: [...val].sort() };
      if (val instanceof Map) return { __map: [...val].sort() };
      return val;
    });
    try {
      // 1. Take the snapshot.
      const snap = engine.snapshot();
      const beforeJson = serialize(snap);

      // 2. Mutate the engine heavily — fake some in-place changes.
      const t0 = Date.now();
      const gs = engine.gs;
      // Scramble hand of each player
      for (const ps of gs.players) {
        if (ps?.hand) ps.hand.reverse();
        if (ps) ps.gold = (ps.gold || 0) + 777;
      }
      gs.turn += 42;
      gs.currentPhase = 99;
      gs._dummyField = 'injected';
      engine.eventId += 1000;
      engine.cardInstances.push({
        id: 'sentinel-id', name: 'Sentinel Card', owner: 0,
        originalOwner: 0, controller: 0, zone: 'hand', heroIdx: -1,
        zoneSlot: -1, faceDown: false, statuses: {}, counters: {},
        turnPlayed: 0, activatedThisChain: false, script: null,
      });
      if (engine.cardInstances[0]) engine.cardInstances[0].counters._corrupted = true;

      // 3. Restore.
      engine.restore(snap);
      const afterJson = serialize(engine.snapshot());

      // 4. Compare.
      const ok = beforeJson === afterJson;
      const elapsed = Date.now() - t0;
      const snapSize = (beforeJson.length / 1024).toFixed(1);
      if (ok) {
        console.log(`[snapshot test] PASS — ${elapsed}ms round-trip, snapshot ~${snapSize}KB, ${engine.cardInstances.length} card instances`);
      } else {
        // Find the first divergence for triage.
        let i = 0;
        while (i < beforeJson.length && i < afterJson.length && beforeJson[i] === afterJson[i]) i++;
        const ctx = Math.max(0, i - 40);
        console.log(`[snapshot test] FAIL — state diverged at char ${i}`);
        console.log(`  expected: ...${beforeJson.slice(ctx, i + 80)}`);
        console.log(`  actual:   ...${afterJson.slice(ctx, i + 80)}`);
      }
      socket.emit('debug_cpu_snapshot_test_result', {
        ok, elapsed, snapSize: Number(snapSize), instCount: engine.cardInstances.length,
      });
    } catch (err) {
      console.error('[snapshot test] THREW:', err.message, err.stack);
      socket.emit('debug_cpu_snapshot_test_result', { ok: false, err: err.message });
    }
  });

  // ═══════════════════════════════════════════
  //  SELF-PLAY TEST HARNESS
  //  Trigger from browser console:
  //    socket.emit('debug_self_play_run', { count: 10, deckIdA: <id>, deckIdB: <id> })
  //    socket.on('debug_self_play_progress', console.log)
  //    socket.on('debug_self_play_result', console.log)
  //  Both deckIds are optional — defaults to your first deck for both sides.
  //  Runs N games sequentially (CPU vs CPU, both running the MCTS brain),
  //  reports per-game winner / turn-count / duration plus a final summary.
  //
  //  Three pairing modes:
  //    • Default (no `random`, no `pinDeckName(s)`) — fixed deck A vs deck B.
  //    • `random: true`                              — both decks picked randomly
  //                                                    per game from the pool.
  //    • `pinDeckName: 'Gather That Storm'`          — one slot fixed to the
  //                                                    named deck (substring
  //                                                    match), other slot drawn
  //                                                    randomly from the
  //                                                    remaining pool. Side
  //                                                    assignment (p0 vs p1)
  //                                                    flips 50/50 each game.
  //    • `pinDeckNames: ['A', 'B']` (multi-pin)     — one slot drawn each game
  //                                                    from the named set; other
  //                                                    slot from the rest.
  //
  //  Extra options:
  //    • `samplesOnly: true` — opponent pool is restricted to canonical
  //      Starter / Structure decks; user-saved decks are excluded. Pinned
  //      names also only resolve against samples in this mode.
  //    • `cpuSkipCardNames: ['Lifeforce Howitzer']` — runtime block-list:
  //      the CPU brain refuses to proactively play any of these cards
  //      during the run. Useful for isolating suspected problem cards
  //      without modifying their scripts. Cleared when the game ends.
  //
  //  Examples:
  //    // Single-pin vs the field
  //    socket.emit('debug_self_play_run', { count: 100, pinDeckName: 'Gather That Storm' })
  //    // Multi-pin (rotate the pinned slot between two decks) vs sample
  //    // decks only, blocking Howitzer from CPU's proactive play list
  //    socket.emit('debug_self_play_run', {
  //      count: 300,
  //      pinDeckNames: ["Structure Deck: Man's Best Friends", 'Structure Deck: To Attain Divinity'],
  //      samplesOnly: true,
  //      cpuSkipCardNames: ['Lifeforce Howitzer'],
  //    })
  // ═══════════════════════════════════════════

  // Heal Burn per-game instrumentation removed — every self-play OOM during
  // testing was a Heal Burn match, and even though the diagnostic wrappers
  // short-circuited inside `_inMctsSim`, they still wrapped every heal /
  // damage call in an async layer that compounded under 2-turn rollout on
  // a heal-heavy deck. Win-rate for Heal Burn is tracked via the normal
  // deck table; if synergy-specific debugging is needed again, reinstate
  // from git history.

  /**
   * Snapshot engine state for tie/result diagnosis. Called from `finish()`
   * to capture WHY a game ended the way it did — crucial for explaining
   * `no-result` ties, where the turn chain exited cleanly without setting
   * gs.result. Returns a short human-readable string.
   */
  function buildGameDiagnosis(room, winnerIdx, reason) {
    const gs = room?.gameState;
    const engine = room?.engine;
    if (!gs) return 'no-gamestate';

    const summarizeSide = (pi) => {
      const ps = gs.players?.[pi];
      if (!ps) return `p${pi}=?`;
      const heroes = (ps.heroes || []).filter(h => h && h.name);
      const alive = heroes.filter(h => (h.hp || 0) > 0).length;
      const totalHp = heroes.reduce((s, h) => s + Math.max(0, h.hp || 0), 0);
      const deck = (ps.mainDeck || []).length;
      const hand = (ps.hand || []).length;
      return `p${pi}(heroes ${alive}/${heroes.length} alive, ${totalHp}hp, deck ${deck}, hand ${hand})`;
    };

    const parts = [summarizeSide(0), summarizeSide(1)];
    parts.push(`turn ${gs.turn} phase ${gs.currentPhase} active p${gs.activePlayer}`);

    // Hypothesize ONLY for unexplained finishes. Named reasons already
    // carry their own meaning.
    if (reason === 'no-result' || !reason) {
      const p0Alive = (gs.players?.[0]?.heroes || []).some(h => h?.name && (h.hp || 0) > 0);
      const p1Alive = (gs.players?.[1]?.heroes || []).some(h => h?.name && (h.hp || 0) > 0);
      const p0Deck = (gs.players?.[0]?.mainDeck || []).length;
      const p1Deck = (gs.players?.[1]?.mainDeck || []).length;
      const pendingPrompt = !!(engine?._pendingPrompt || engine?._pendingGenericPrompt);
      const driverErrors = engine?._driverErrors || [];

      const hypotheses = [];
      if (!p0Alive && !p1Alive) hypotheses.push('both sides wiped (all-heroes-dead never fired?)');
      else if (!p0Alive) hypotheses.push('p0 wiped, win-check skipped');
      else if (!p1Alive) hypotheses.push('p1 wiped, win-check skipped');
      if (p0Deck === 0 && p1Deck === 0) hypotheses.push('both decks empty');
      else if (p0Deck === 0) hypotheses.push('p0 deck empty, deck-out never fired');
      else if (p1Deck === 0) hypotheses.push('p1 deck empty, deck-out never fired');
      if (pendingPrompt) hypotheses.push('pending prompt unresolved');
      if (driverErrors.length) {
        const last = driverErrors.at(-1);
        // Extract the first in-project frame from the stack so the tie log
        // points straight at the thrower (usually a card script).
        const pickFrame = (stack) => {
          if (!stack) return '';
          const lines = stack.split('\n').slice(1);
          const frame = lines.find(l => /cards[\\/]/.test(l) && !/_engine\.js/.test(l))
                     || lines.find(l => /cards[\\/]/.test(l))
                     || lines[0] || '';
          return frame.trim();
        };
        const frame = pickFrame(last.stack);
        hypotheses.push(`CPU driver threw ${driverErrors.length}× (last: t${last.turn} p${last.player}: ${last.message}${frame ? ` @ ${frame}` : ''})`);
      }
      if (!hypotheses.length) hypotheses.push('turn chain exited with both sides alive and decks non-empty');
      parts.push('cause: ' + hypotheses.join('; '));
    }

    return parts.join(' | ');
  }

  async function runOneSelfPlayGame(deckA, deckB, opts = {}) {
    // `cpuSkipCardNames` lives in the caller's destructured options
    // closure (debug_self_play_run handler) — it's NOT in scope here,
    // so it must be passed through. Defaulting to [] keeps the A/B
    // sweep caller, which doesn't expose the option, working too.
    const cpuSkipCardNames = Array.isArray(opts.cpuSkipCardNames) ? opts.cpuSkipCardNames : [];
    const snapshotDeck = (d) => JSON.parse(JSON.stringify({
      mainDeck: d.mainDeck || [], heroes: d.heroes || [],
      potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
      skins: d.skins || {},
    }));
    const deckNames = [deckA.name || 'Unnamed', deckB.name || 'Unnamed'];
    const roomId = 'sp-test-' + uuidv4().substring(0, 8);
    const room = {
      id: roomId, host: 'self-play', hostId: 'self-play',
      type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: 'CPU-A', userId: 'cpu-test-a-' + roomId, socketId: null, deckId: 'self-play-a' },
        { username: 'CPU-B', userId: 'cpu-test-b-' + roomId, socketId: null, deckId: 'self-play-b' },
      ],
      spectators: [], status: 'waiting', created: Date.now(),
      gameState: null, chatHistory: [], privateChatHistory: {},
      _currentDecks: [snapshotDeck(deckA), snapshotDeck(deckB)],
      _deckNames: deckNames,
    };
    rooms.set(roomId, room);

    await setupGameState(room);
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    const startMs = Date.now();

    return new Promise((resolve) => {
      let done = false;
      // We must drain this before resolving — `onGameOver` fires while
      // hook chains are still mid-await, so if we resolve the outer
      // Promise immediately the next game boots and its hooks interleave
      // with the dying engine's tail. That's what was causing games
      // 17/18/19 to log simultaneously and eventually saturate the loop.
      let startGamePromise = null;
      // Captured so finish() can clear them on normal completion. Leaving the
      // 5-min hard timeout dangling kept each game's closure (watchdog, room,
      // engine, cardInstances) alive for the full 5 minutes — ~130MB per game
      // × ~30 fast games = OOM.
      let firstTickTimer = null;
      let hardTimeoutTimer = null;
      let watchdogInterval = null;
      let heapMonitorInterval = null;
      const DRAIN_TIMEOUT_MS = 2000;
      const finish = (winnerIdx, reason, extraDiag) => {
        if (done) return;
        done = true;
        if (firstTickTimer) { clearTimeout(firstTickTimer); firstTickTimer = null; }
        if (hardTimeoutTimer) { clearTimeout(hardTimeoutTimer); hardTimeoutTimer = null; }
        if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
        if (heapMonitorInterval) { clearInterval(heapMonitorInterval); heapMonitorInterval = null; }
        // Self-play's fake user IDs ('cpu-test-a-<roomId>', 'cpu-test-b-...')
        // get added to activeGames via setupGameState but never removed —
        // runOneSelfPlayGame bypasses cleanupRoom. Small per-entry (~80 bytes)
        // but 400+ dangling entries after 200 games; clean up for hygiene.
        for (const p of room.players) activeGames.delete(p.userId);
        const turns = room.gameState?.turn || 0;
        const ms = Date.now() - startMs;
        // Always snapshot the final engine state so the caller can explain
        // ties. Richer detail for `no-result` lets us see WHY the turn chain
        // exited without setting gs.result (driver crash? stuck phase?
        // simultaneous KO? pending prompt?).
        const diagnosis = extraDiag || buildGameDiagnosis(room, winnerIdx, reason);
        drainThenResolve();

        function drainThenResolve() {
          const drain = startGamePromise
            ? Promise.race([
                startGamePromise.catch(() => {}),
                new Promise(r => setTimeout(r, DRAIN_TIMEOUT_MS)),
              ])
            : Promise.resolve();
          drain.then(() => {
            rooms.delete(roomId);
            // ── Tear-down: break the closure refs that capture `room` ──
            // We DON'T null `eng.room` or `room.engine` — V8 GC handles
            // simple 2-cycles natively (mark-and-sweep), and a tail-async
            // chain (switchTurn → cpuTurn → runPhase → log →
            // _broadcastEvent → this.room.spectators) was crashing on
            // those refs being null. The actual leak vectors are the
            // closure captures on onGameOver and _cpuDriver — null those
            // and the room becomes unreachable through everything except
            // the cycle, which V8 reclaims on the next GC pass.
            const eng = room.engine;
            if (eng) {
              eng.onGameOver = null;
              eng._cpuDriver = null;
            }
            room._currentDecks = null;
            room._originalDecks = null;
            resolve({ winnerIdx, reason, turns, ms, firstPlayer, diagnosis });
          });
        }
      };

      startGameEngine(room, roomId, firstPlayer, (engine) => {
        engine._isSelfPlay = true;
        engine._cpuPlayerIdx = firstPlayer;
        // Per-game runtime CPU skip list: blocks the CPU brain's
        // proactive-play scanner from picking specific cards. Read by
        // _cpu.js next to the per-card `cpuSkipProactive` flag. Used
        // by self-play tests to isolate suspected problem cards
        // (e.g. Lifeforce Howitzer during Loyal/Divinity rebalance
        // testing) without modifying their scripts.
        if (Array.isArray(cpuSkipCardNames) && cpuSkipCardNames.length > 0
            && engine.gs && !engine.gs._cpuSkipProactiveNames) {
          engine.gs._cpuSkipProactiveNames = new Set(cpuSkipCardNames);
        }
        installCpuBrain(engine);
        engine.onGameOver = (_room, winnerIdx, reason) => {
          // The engine's deck-out / all-heroes-dead paths call onGameOver
          // but do NOT set gs.result themselves — the normal SP endCpuBattle
          // handler does that. In self-play we must do it here too, or the
          // engine's stillCpuTurn / !gs.result guards never fire and the
          // CPU driver keeps looping indefinitely (turn 4822+ bug).
          if (room.gameState && !room.gameState.result) {
            room.gameState.result = { winnerIdx, reason };
          }
          finish(winnerIdx, reason);
        };
      }).then(async () => {
        room.engine._cpuDriver = makeCpuDriver(room);
        // Auto-mulligan BOTH sides via the smart-mulligan heuristic.
        if (room.gameState.mulliganDecisions) {
          for (const pi of [0, 1]) {
            let mull = false;
            try {
              room.engine._cpuPlayerIdx = pi; // brain reads its own hand
              mull = shouldMulliganStartingHand(room.engine, pi);
            } catch (err) {
              console.error('[self-play] mulligan check threw:', err.message);
            }
            room.gameState.mulliganDecisions[pi] = mull;
            if (mull) {
              const ps = room.gameState.players[pi];
              const cardDB = getCardDB();
              const handSize = ps.hand.length;
              let potionCount = 0;
              for (const card of ps.hand) {
                const cd = cardDB[card];
                if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
                else { ps.mainDeck.push(card); }
              }
              ps.hand.length = 0;
              const shuf = (arr) => {
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [arr[i], arr[j]] = [arr[j], arr[i]];
                }
              };
              shuf(ps.mainDeck);
              shuf(ps.potionDeck);
              const mainToDraw = handSize - potionCount;
              for (let i = 0; i < mainToDraw; i++) {
                if (ps.mainDeck.length === 0) break;
                ps.hand.push(ps.mainDeck.shift());
              }
              for (let i = 0; i < potionCount; i++) {
                if (ps.potionDeck.length === 0) break;
                ps.hand.push(ps.potionDeck.shift());
              }
            }
          }
          room.gameState.mulliganPending = false;
          delete room.gameState.mulliganDecisions;
        }
        // Enter fast mode for the whole game. Skips pacing delays, log
        // spam, broadcast work, and SC tracking across all turns — drops
        // per-game time from ~100s (real-time pacing) to a few seconds of
        // pure engine work. `_inMctsSim` stays false, so the CPU driver
        // still fires between turns as normal.
        room.engine.enterFastMode();
        // Fire the engine — startGame triggers the first turn's _cpuDriver,
        // which chains via switchTurn through every subsequent turn until
        // gs.result is set. The whole game completes within this await.
        // Captured so finish() can drain it before resolving the outer
        // Promise — this prevents the next game from starting while the
        // dying engine is still fluttering through async hook tails.
        startGamePromise = room.engine.startGame()
          .then(() => {
            // If the game ended without onGameOver firing (shouldn't happen
            // for normal completions), check result and finish manually.
            if (!done) {
              const w = room.gameState?.result?.winnerIdx;
              finish(w != null ? w : -1, room.gameState?.result?.reason || 'no-result');
            }
          })
          .catch(err => {
            console.error('[self-play] engine.startGame error:', err.message);
            if (!done) finish(-1, 'error: ' + err.message);
          });
      }).catch(err => {
        console.error('[self-play] setup error:', err.message);
        if (!done) finish(-1, 'setup-error: ' + err.message);
      });

      // Watchdog: silently tracks turn progress. If the turn counter
      // doesn't advance for STALL_TICKS × WATCHDOG_INTERVAL_MS, aborts
      // the game with a `stalled` reason — saves the batch from hanging
      // if a pathological loop sneaks back in. Also enforces a hard cap
      // on total turns to catch games that advance turns indefinitely
      // without either side pressing lethal (the "both-decks-heal-forever"
      // case that OOM'd a batch at 4GB over ~2 min on Heal Burn vs
      // Lightning Caller).
      let lastWatchdogTurn = -1;
      let stallTicks = 0;
      const WATCHDOG_INTERVAL_MS = 3000;
      const STALL_TICKS_BEFORE_ABORT = 20; // 60s of no turn progress → abort
      const MAX_TURNS = 400; // Realistic hard cap — normal games end well under 50.
      const tick = () => {
        if (done) { clearInterval(watchdog); return; }
        const gs = room.gameState;
        if (!gs) return;
        if ((gs.turn || 0) >= MAX_TURNS) {
          clearInterval(watchdog);
          console.error(`[self-play watchdog] ${roomId} MAX TURNS (${MAX_TURNS}) reached — forcing tie`);
          if (!done) finish(-1, `max-turns@${gs.turn}`);
          return;
        }
        if (gs.turn === lastWatchdogTurn) {
          stallTicks++;
          if (stallTicks >= STALL_TICKS_BEFORE_ABORT) {
            clearInterval(watchdog);
            console.error(`[self-play watchdog] ${roomId} STALLED at turn ${gs.turn} phase ${gs.currentPhase} — forcing stall finish`);
            if (!done) finish(-1, `stalled@turn${gs.turn}phase${gs.currentPhase}`);
          }
        } else {
          stallTicks = 0;
          lastWatchdogTurn = gs.turn;
        }
      };
      // First tick at 2s to confirm the engine is actually running (or stuck).
      firstTickTimer = setTimeout(tick, 2000);
      const watchdog = setInterval(tick, WATCHDOG_INTERVAL_MS);
      watchdogInterval = watchdog;

      // Hard timeout: 5 minutes per game (safety net on top of watchdog).
      hardTimeoutTimer = setTimeout(() => {
        clearInterval(watchdog);
        watchdogInterval = null;
        if (!done) finish(-1, 'timeout');
      }, 5 * 60 * 1000);

      // Heap-growth watchdog: self-play normally sits around 150-500MB
      // heapUsed. Abort games at 2GB heapUsed — gives 6GB of headroom
      // on an 8GB heap for GC to catch up. Tighter (500ms) interval so
      // a fast allocator has more chances to trip. Can't catch purely
      // synchronous loops — for those, runHooks has an inline heap
      // check at 4GB (see _engine.js runHooks).
      const HEAP_ABORT_THRESHOLD_MB = 2000;
      heapMonitorInterval = setInterval(() => {
        if (done) return;
        const mu = process.memoryUsage();
        const heapMB = Math.round(mu.heapUsed / 1024 / 1024);
        if (heapMB >= HEAP_ABORT_THRESHOLD_MB) {
          const gs = room.gameState;
          const diag = `heap-abort: heapUsed=${heapMB}MB at turn ${gs?.turn} phase ${gs?.currentPhase} active p${gs?.activePlayer}. Offending matchup: ${deckNames.join(' vs ')}. Likely card-effect loop allocating unboundedly within this game.`;
          console.error(`[self-play heap-watchdog] ${diag}`);
          if (!done) finish(-1, `heap-abort@${heapMB}MB`, diag);
        }
      }, 500);
    });
  }

  // Configure MCTS settings for self-play. Optional parameters override defaults:
  //   rolloutHorizon: 0-4 (default 2)
  //   rolloutBrain: 'heuristic' | 'evalGreedy' (default 'evalGreedy')
  // Emit BEFORE launching a run to change settings. Persists until
  // changed again or process restarts.
  socket.on('debug_self_play_config', ({ rolloutHorizon, rolloutBrain } = {}) => {
    if (rolloutHorizon != null) setRolloutHorizon(rolloutHorizon);
    if (rolloutBrain != null) setRolloutBrain(rolloutBrain);
    const cfg = { rolloutHorizon: getRolloutHorizon(), rolloutBrain: getRolloutBrain() };
    console.log(`[self-play config] ${JSON.stringify(cfg)}`);
    socket.emit('debug_self_play_config_result', { ok: true, ...cfg });
  });

  socket.on('debug_self_play_run', ({
    count = 5, deckIdA, deckIdB, random, silent = true,
    minMatchupGames = 5, excludeDeckNames = [],
    pinDeckName, pinDeckNames, samplesOnly = false,
    cpuSkipCardNames = [],
  } = {}) => {
    if (!currentUser) {
      socket.emit('debug_self_play_result', { ok: false, msg: 'not authenticated' });
      return;
    }
    // Save verbose state here so both the happy path AND the .catch
    // block below can restore it.
    const _prevVerbose_sp = getCpuVerbose();
    (async () => {
      // ── Deck source ──
      // random=true: pick 2 random legal decks per game from the user's
      // collection. Otherwise: explicit deckIdA / deckIdB (defaults to first
      // deck for both sides if omitted).
      const fetchDeckById = async (deckId) => {
        if (typeof deckId === 'string' && deckId.startsWith('sample-')) {
          const samples = loadSampleDecks();
          return samples.find(s => s.id === deckId) || null;
        }
        const row = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, currentUser.userId]);
        return row ? parseDeck(row) : null;
      };
      let allDecks = [];
      let pickerMode = 'fixed';
      let pinnedDeck = null; // Set when pinDeckName resolves to a real deck.
      let _pinnedDecks = null; // Multi-pin variant — array of pinned decks.
      let _pinnedOpponents = null; // Closure-scope opponent pool.
      // Resolve pin spec: accept either a single name (`pinDeckName`) or
      // an array of names (`pinDeckNames`). The multi-pin variant lets
      // tests rotate the pinned side between two or more decks across
      // the run (e.g. "pin {Loyals, Divinity} vs the field").
      const pinNames = Array.isArray(pinDeckNames) && pinDeckNames.length > 0
        ? pinDeckNames
        : (pinDeckName ? [pinDeckName] : null);
      // Pinned mode supersedes the random / fixed branches below — it
      // builds the same broad pool but reserves one slot for the
      // pinned-deck rotation and draws the other slot from the
      // remaining pool each game.
      if (pinNames) {
        const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
        const userDecks = rows.map(parseDeck).filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        const sampleDecks = loadSampleDecks().filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        // `samplesOnly: true` excludes user-saved decks from BOTH the
        // pinned-resolution pool AND the opponent pool. The pinned
        // names still resolve via sample decks (Starter / Structure
        // collections). Useful for "test only against the canonical
        // sample decks" runs that don't want noisy user creations.
        const pool = samplesOnly ? sampleDecks : [...userDecks, ...sampleDecks];
        const resolved = [];
        // Punctuation-insensitive bidirectional matcher: strip
        // apostrophes / colons / spaces / etc., then accept either
        // direction of substring containment. Handles three traps in
        // one:
        //   1. Straight-vs-curly apostrophe (Man's vs Man’s)
        //   2. Missing-colon variants ("Mans Best Friends" matches
        //      the canonical "Structure Deck: Man's Best Friends")
        //   3. Search query is MORE specific than the deck's stored
        //      name (e.g. user types "Structure Deck: To Attain
        //      Divinity" but the file's `Name:` line is just "To
        //      Attain Divinity"). Without bidirectional matching, a
        //      longer query can never resolve a shorter name.
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const matchesEitherWay = (a, b) => a.includes(b) || b.includes(a);
        for (const name of pinNames) {
          const target = norm(name);
          if (!target) {
            socket.emit('debug_self_play_result', { ok: false, msg: `pinDeckName empty: ${name}` });
            return;
          }
          const found = pool.find(d => matchesEitherWay(norm(d.name), target));
          if (!found) {
            const available = pool.map(d => d.name).filter(Boolean).join(', ');
            socket.emit('debug_self_play_result', {
              ok: false,
              msg: `pinDeckName not found: ${name} — available: ${available}`,
            });
            return;
          }
          if (!resolved.includes(found)) resolved.push(found);
        }
        _pinnedDecks = resolved;
        pinnedDeck = resolved[0]; // legacy reference for stats labels
        // Opponent pool — every legal deck OTHER than any pinned one.
        let opponents = pool.filter(d => !resolved.includes(d));
        if (excludeDeckNames.length > 0) {
          const excludeLc = excludeDeckNames.map(n => n.toLowerCase());
          opponents = opponents.filter(d => {
            const nameLc = (d.name || '').toLowerCase();
            return !excludeLc.some(ex => nameLc.includes(ex) || ex.includes(nameLc));
          });
        }
        if (opponents.length === 0) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'no legal opponents found for pinned deck(s)' });
          return;
        }
        // The full deck list reported in the summary still includes
        // every pinned deck so each deck's W-L line shows up.
        allDecks = [...resolved, ...opponents];
        pickerMode = 'pinned';
        const pinLabel = resolved.map(d => `"${d.name}"`).join(' / ');
        console.log(`[self-play] pinned mode: ${pinLabel} vs ${opponents.length} opponent${opponents.length !== 1 ? 's' : ''}${samplesOnly ? ' (samples only)' : ''}`);
        _pinnedOpponents = opponents;
      } else if (random) {
        // Pool = user's saved decks + ALL sample decks (Starter + Structure).
        // Self-play is a test tool, so we want broad archetype coverage even
        // when the user has only a few decks of their own saved. Pass
        // `samplesOnly: true` to drop user decks entirely — useful for
        // canonical-deck-only sweeps that shouldn't be polluted by
        // personal creations.
        const sampleDecks = loadSampleDecks().filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        let userDecks = [];
        if (!samplesOnly) {
          const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
          userDecks = rows.map(parseDeck).filter(d =>
            d && Array.isArray(d.heroes) && d.heroes.length > 0
            && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        }
        allDecks = [...userDecks, ...sampleDecks];
        // Apply exclusion list. Matches deck name (case-insensitive,
        // substring-in-either-direction) so 'heal burn' excludes
        // 'Structure Deck: Heal Burn' and anything else containing it.
        if (excludeDeckNames.length > 0) {
          const excludeLc = excludeDeckNames.map(n => n.toLowerCase());
          const before = allDecks.length;
          allDecks = allDecks.filter(d => {
            const nameLc = (d.name || '').toLowerCase();
            return !excludeLc.some(ex => nameLc.includes(ex) || ex.includes(nameLc));
          });
          console.log(`[self-play] excluded ${before - allDecks.length} decks matching: ${excludeDeckNames.join(', ')}`);
        }
        if (allDecks.length === 0) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'no legal decks found' });
          return;
        }
        const structureCount = sampleDecks.filter(d => d.isStructure && allDecks.includes(d)).length;
        const starterCount = allDecks.filter(d => !d.isStructure).length - userDecks.filter(d => allDecks.includes(d)).length;
        console.log(`[self-play] deck pool: ${allDecks.length} total after filtering`);
        pickerMode = 'random';
      } else {
        const da = deckIdA
          ? await fetchDeckById(deckIdA)
          : await (async () => { const r = await db.get('SELECT * FROM decks WHERE user_id = ? LIMIT 1', [currentUser.userId]); return r ? parseDeck(r) : null; })();
        const db2 = deckIdB ? await fetchDeckById(deckIdB) : da;
        if (!da || !db2) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'deck not found' });
          return;
        }
        allDecks = [da, db2];
      }
      const pickPair = () => {
        if (pickerMode === 'fixed') return [allDecks[0], allDecks[1] || allDecks[0]];
        if (pickerMode === 'pinned') {
          // 50/50 side assignment so the pinned deck(s) play p0 and p1
          // an equal number of times across the run — keeps first-
          // player skew from biasing the measured win-rate.
          // For multi-pin: pick a random pinned deck per game so the
          // rotation is even across the pinned set.
          const opponents = _pinnedOpponents;
          const pinned = (_pinnedDecks && _pinnedDecks.length > 0)
            ? _pinnedDecks[Math.floor(Math.random() * _pinnedDecks.length)]
            : pinnedDeck;
          const opp = opponents[Math.floor(Math.random() * opponents.length)];
          return Math.random() < 0.5 ? [pinned, opp] : [opp, pinned];
        }
        if (allDecks.length < 2) return [allDecks[0], allDecks[0]];
        const i = Math.floor(Math.random() * allDecks.length);
        let j = Math.floor(Math.random() * (allDecks.length - 1));
        if (j >= i) j++;
        return [allDecks[i], allDecks[j]];
      };

      // ── Stats accumulators ──
      const byDeck = new Map(); // deckId -> { name, games, wins, losses, winReasons }
      const byMatchup = new Map(); // sortedKey -> { idA, idB, nameA, nameB, gamesAsA, gamesAsB, aWins, bWins }
      const totalWinReasons = Object.create(null);
      // Friendly labels for the reasons the engine emits via onGameOver.
      // New reasons (future game-over paths) fall through to the raw string.
      const REASON_LABELS = {
        deck_out: 'Deck-out',
        all_heroes_dead: 'Heroes dead',
        cardinal_beast: 'Cardinal Beasts',
        puzzle_failed: 'Puzzle failed',
        timeout: 'Timeout',
      };
      const labelReason = (r) => REASON_LABELS[r] || (r || 'unknown');
      const recordDeck = (deck, won, reason) => {
        const key = String(deck.id || deck.name);
        let s = byDeck.get(key);
        if (!s) {
          s = {
            id: key, name: deck.name || 'Unnamed',
            games: 0, wins: 0, losses: 0,
            winReasons: Object.create(null),
          };
          byDeck.set(key, s);
        }
        s.games++;
        if (won === true) {
          s.wins++;
          const label = labelReason(reason);
          s.winReasons[label] = (s.winReasons[label] || 0) + 1;
          totalWinReasons[label] = (totalWinReasons[label] || 0) + 1;
        } else if (won === false) {
          s.losses++;
        }
      };
      const recordMatchup = (deckP0, deckP1, winnerIdx) => {
        if (winnerIdx !== 0 && winnerIdx !== 1) return;
        const id0 = String(deckP0.id || deckP0.name);
        const id1 = String(deckP1.id || deckP1.name);
        const sorted = id0 < id1 ? [deckP0, deckP1, 0, 1] : [deckP1, deckP0, 1, 0];
        const [a, b, aSlot] = sorted;
        const key = String(a.id || a.name) + '|' + String(b.id || b.name);
        let m = byMatchup.get(key);
        if (!m) {
          m = {
            idA: String(a.id || a.name), nameA: a.name || 'Unnamed',
            idB: String(b.id || b.name), nameB: b.name || 'Unnamed',
            games: 0, aWins: 0, bWins: 0,
          };
          byMatchup.set(key, m);
        }
        m.games++;
        if (winnerIdx === aSlot) m.aWins++;
        else m.bWins++;
      };

      // Silence the per-decision [CPU] log spam — it dominates self-play
      // runtime (synchronous stdout flushes block the event loop). Prev
      // state saved outside the IIFE so the .catch block can restore too.
      setCpuVerbose(!silent);
      console.log(`[self-play] starting ${count} games (${pickerMode}, ${allDecks.length} decks, silent=${silent})`);
      const stats = { p0wins: 0, p1wins: 0, draws: 0, totalTurns: 0, totalMs: 0 };
      // Incremental save path so a crash doesn't lose everything. Writes
      // the running summary to disk after each game. On process death,
      // this file is the user's recovery point.
      const partialSavePath = path.join(__dirname, 'data', `selfplay-partial-${Date.now()}.json`);
      console.log(`[self-play] incremental save → ${partialSavePath}`);
      // Emit a "started" event to the BROWSER side so the user sees
      // immediate confirmation in their dev console rather than
      // staring at silence until the first game completes ~30s later.
      // Includes the picker mode, deck count, and partial-save path
      // so the user can tail the JSON live if they want.
      socket.emit('debug_self_play_started', {
        count, pickerMode, deckCount: allDecks.length,
        pinnedDeckNames: _pinnedDecks ? _pinnedDecks.map(d => d.name) : null,
        partialSavePath,
        cpuSkipCardNames: Array.isArray(cpuSkipCardNames) ? cpuSkipCardNames : [],
        startedAt: new Date().toISOString(),
      });

      // Pick ~10 random game indices for detailed transcription. Selected
      // up front so every batch has a consistent sample size regardless
      // of early termination. Transcription is FREE to set during normal
      // silent play — it just routes cpuLog messages into a buffer.
      const TRANSCRIPT_COUNT = Math.min(10, count);
      const transcriptIndices = new Set();
      while (transcriptIndices.size < TRANSCRIPT_COUNT) {
        transcriptIndices.add(Math.floor(Math.random() * count));
      }
      const transcripts = []; // [{ gameIdx, deckP0, deckP1, firstPlayer, result, lines: [...] }]
      console.log(`[self-play] will transcribe games: ${[...transcriptIndices].sort((a,b)=>a-b).map(i => i+1).join(', ')}`);
      // Tie details: decks + reason + turn/ms for every drawn game. Ties
      // are rare and worth inspecting individually (timeout? simultaneous
      // hero deaths? engine bug?).
      const tieDetails = [];
      const t0 = Date.now();
      const printEvery = count > 1000 ? 100 : count > 100 ? 10 : 1;
      for (let i = 0; i < count; i++) {
        const [deckP0, deckP1] = pickPair();
        const nameP0 = deckP0.name || '?';
        const nameP1 = deckP1.name || '?';
        // Announce decks BEFORE the game runs — if the game hangs, this
        // is the last line in the log and pinpoints the offending matchup.
        console.log(`[self-play] Game ${i + 1}/${count} starting: ${nameP0} vs ${nameP1}`);
        // Browser-side start signal so the dev console gets immediate
        // feedback that the next game has begun. Without this the user
        // only sees output once a game COMPLETES (the
        // `debug_self_play_progress` event fires post-game), which can
        // look like nothing's happening for the first ~10-30s of the
        // run.
        socket.emit('debug_self_play_game_start', {
          i: i + 1, total: count,
          deckP0: nameP0, deckP1: nameP1,
          startedAt: new Date().toISOString(),
        });
        // Set up transcription for this game if selected. Buffer caps at
        // ~500 lines to keep the report readable; older lines drop.
        const isTranscribeGame = transcriptIndices.has(i);
        let transcriptLines = null;
        if (isTranscribeGame) {
          const BUF_CAP = 500;
          transcriptLines = [];
          setCpuTranscribeFn((msg) => {
            transcriptLines.push(msg);
            if (transcriptLines.length > BUF_CAP) transcriptLines.shift();
          });
        }
        try {
          // Race the game against an outer watchdog. The per-game timeout
          // inside runOneSelfPlayGame (5 min) only kicks in AFTER the
          // Promise is returned — if the hang is during setupGameState or
          // inside startGameEngine's hook cascade, the inner timeout never
          // fires. This outer 6-min cap is the last line of defence.
          // Capture the timer handle so it can be cleared on the normal
          // path — otherwise every game leaves a 6-min pending timeout
          // whose closure pins Error + reject fn (small, but adds up).
          const OUTER_TIMEOUT_MS = 6 * 60 * 1000;
          let outerTimeoutHandle = null;
          const outerTimeout = new Promise((_, reject) => {
            outerTimeoutHandle = setTimeout(
              () => reject(new Error(`outer-timeout after ${OUTER_TIMEOUT_MS / 1000}s`)),
              OUTER_TIMEOUT_MS,
            );
          });
          let r;
          try {
            r = await Promise.race([runOneSelfPlayGame(deckP0, deckP1, { cpuSkipCardNames }), outerTimeout]);
          } finally {
            if (outerTimeoutHandle) clearTimeout(outerTimeoutHandle);
            // Tear down transcription regardless of game outcome.
            if (isTranscribeGame) {
              setCpuTranscribeFn(null);
              transcripts.push({
                gameIdx: i + 1,
                deckP0: nameP0, deckP1: nameP1,
                firstPlayer: r?.firstPlayer,
                turns: r?.turns,
                reason: r?.reason,
                winnerIdx: r?.winnerIdx,
                lines: transcriptLines,
              });
            }
          }
          if (r.winnerIdx === 0) {
            stats.p0wins++;
            recordDeck(deckP0, true, r.reason); recordDeck(deckP1, false);
          } else if (r.winnerIdx === 1) {
            stats.p1wins++;
            recordDeck(deckP0, false); recordDeck(deckP1, true, r.reason);
          } else {
            stats.draws++;
            recordDeck(deckP0, null); recordDeck(deckP1, null);
            tieDetails.push({
              gameIdx: i + 1,
              deckP0: nameP0,
              deckP1: nameP1,
              firstPlayer: r.firstPlayer,
              turns: r.turns,
              ms: r.ms,
              reason: r.reason || 'unknown',
              diagnosis: r.diagnosis || '',
            });
          }
          recordMatchup(deckP0, deckP1, r.winnerIdx);
          stats.totalTurns += r.turns;
          stats.totalMs += r.ms;
          // Per-game heap log — diagnoses leak vs transient spike. Linear
          // growth = real leak. Flat with spikes on long matches (e.g.
          // Heal Burn vs Lightning Caller) = allocation pressure; rerun
          // node with --max-old-space-size=8192.
          const mu = process.memoryUsage();
          const mb = (n) => Math.round(n / 1024 / 1024);
          console.log(`[self-play] heap after game ${i + 1}: rss=${mb(mu.rss)}MB heapUsed=${mb(mu.heapUsed)}MB heapTotal=${mb(mu.heapTotal)}MB external=${mb(mu.external)}MB turns=${r.turns}`);
          // Per-game result line — name the winner, loser, how it ended,
          // and a running win/loss tally for the participating decks so
          // the user can watch trends as the batch runs.
          const winnerName = r.winnerIdx === 0 ? nameP0 : r.winnerIdx === 1 ? nameP1 : 'DRAW';
          const loserName = r.winnerIdx === 0 ? nameP1 : r.winnerIdx === 1 ? nameP0 : 'DRAW';
          const method = labelReason(r.reason);
          const diagSuffix = (r.winnerIdx === -1 && r.diagnosis) ? `\n    → ${r.diagnosis}` : '';
          // Running w/l line for both participants — sample-size aware.
          const fmtRunning = (deck) => {
            const s = byDeck.get(String(deck.id || deck.name));
            if (!s || s.games === 0) return `${deck.name} 0-0`;
            const wr = ((s.wins / s.games) * 100).toFixed(1);
            return `${deck.name} ${s.wins}-${s.losses} (${wr}%)`;
          };
          console.log(`[self-play] Game ${i + 1}/${count} complete (${nameP0} vs ${nameP1})! Winner: ${winnerName}, Loser: ${loserName}, method of victory: ${method}, game lasted ${r.turns} turns, took ${r.ms} ms.${diagSuffix}`);
          console.log(`[self-play]   running: ${fmtRunning(deckP0)} | ${fmtRunning(deckP1)}`);
          socket.emit('debug_self_play_progress', {
            i: i + 1, total: count,
            deckP0: deckP0.name, deckP1: deckP1.name,
            ...r,
          });
          // Incremental save — fire-and-forget; a failed write here
          // shouldn't stop the batch. Synchronous to guarantee flush
          // to disk before a potential OOM a few seconds later.
          //
          // Snapshot includes:
          //   • stats: aggregate p0/p1 wins, draws, totals.
          //   • decks: per-deck record (games, wins, losses, winRate,
          //     winReasons {Heroes dead, Deck-out, Cardinal Beasts, ...}).
          //     Sorted by winRate so the leaderboard is at the top.
          //   • matchups: every distinct pairing seen so far, with
          //     game count, side splits, and a `dominance` measure
          //     (|aWins-bWins|/games — 0 = even, 1 = whitewash).
          //   • onesidedMatchups: top 10 most-lopsided eligible
          //     pairings (≥ minMatchupGames games), so the user can
          //     watch the "particularly good/bad matchups" narrow
          //     in as more games run.
          //   • aggregateWinReasons: how all wins broke down across
          //     the entire run (Heroes dead vs Deck-out vs Cardinal
          //     Beasts vs Puzzle failed vs Timeout).
          //   • tieDetails: per-tie diagnostics for inspection.
          try {
            const decksSnapshot = [...byDeck.values()].map(d => ({
              ...d,
              winRate: d.games > 0 ? +(d.wins / d.games).toFixed(3) : 0,
            })).sort((a, b) => b.winRate - a.winRate);
            const matchupSnapshot = [...byMatchup.values()].map(m => {
              const dominance = m.games > 0 ? Math.abs(m.aWins - m.bWins) / m.games : 0;
              return {
                ...m,
                dominance: +dominance.toFixed(3),
                dominantSide: m.aWins > m.bWins ? m.nameA : m.nameB,
              };
            });
            const onesidedSnapshot = matchupSnapshot
              .filter(m => m.games >= minMatchupGames)
              .sort((a, b) => b.dominance - a.dominance)
              .slice(0, 10);
            const partial = {
              gamesDone: i + 1, total: count, elapsedMs: Date.now() - t0,
              pickerMode,
              stats: { ...stats },
              aggregateWinReasons: { ...totalWinReasons },
              decks: decksSnapshot,
              matchups: matchupSnapshot,
              onesidedMatchups: onesidedSnapshot,
              tieDetails: [...tieDetails],
              savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(partialSavePath, JSON.stringify(partial, null, 2));
          } catch (werr) {
            // Partial-save failure shouldn't abort batch.
            console.error('[self-play] partial save failed:', werr.message);
          }
        } catch (err) {
          console.error(`[self-play] game ${i + 1} threw:`, err.message);
        }
      }
      if (silent) setCpuVerbose(true);

      // ── Build rankings ──
      const deckList = [...byDeck.values()].map(d => ({
        ...d,
        winRate: d.games > 0 ? +(d.wins / d.games).toFixed(3) : 0,
      }));
      const rankedDecks = [...deckList].sort((a, b) => b.winRate - a.winRate);

      const matchupList = [...byMatchup.values()].map(m => {
        const dominance = m.games > 0 ? Math.abs(m.aWins - m.bWins) / m.games : 0;
        return {
          ...m,
          dominance: +dominance.toFixed(3),
          dominantSide: m.aWins > m.bWins ? m.nameA : m.nameB,
        };
      });
      const eligibleMatchups = matchupList.filter(m => m.games >= minMatchupGames);
      const onesidedMatchups = [...eligibleMatchups]
        .sort((a, b) => b.dominance - a.dominance)
        .slice(0, 10);

      const totalMs = Date.now() - t0;
      // Helper: render a winReasons map as a compact breakdown string.
      const fmtReasons = (winReasons) => {
        const entries = Object.entries(winReasons || {}).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return '';
        return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
      };
      const summary = {
        ok: true,
        count,
        pickerMode,
        deckCount: allDecks.length,
        p0wins: stats.p0wins,
        p1wins: stats.p1wins,
        draws: stats.draws,
        firstPlayerSkew: count > 0 ? +(((stats.p0wins + stats.p1wins) > 0 ? Math.abs(stats.p0wins - stats.p1wins) / (stats.p0wins + stats.p1wins) : 0).toFixed(3)) : 0,
        avgTurns: count > 0 ? +(stats.totalTurns / count).toFixed(1) : 0,
        avgMsPerGame: count > 0 ? Math.round(stats.totalMs / count) : 0,
        totalMs,
        // Aggregate win-condition breakdown across ALL games (both sides).
        winReasons: totalWinReasons,
        // Per-deck rankings (full list, sorted by winRate desc). Each deck
        // now carries a winReasons map showing HOW that deck wins.
        decks: rankedDecks,
        // Per-game detail for every tied game — ties are rare enough that
        // listing them individually is more useful than aggregating.
        tieDetails,
        // Most one-sided matchups (need ≥ minMatchupGames games to qualify).
        onesidedMatchups,
        // Full matchup table (raw).
        matchups: matchupList,
      };
      console.log(`[self-play] DONE — count=${count} p0wins=${stats.p0wins} p1wins=${stats.p1wins} draws=${stats.draws} avgTurns=${summary.avgTurns} avgMs=${summary.avgMsPerGame} totalMs=${totalMs}`);
      if (Object.keys(totalWinReasons).length) {
        console.log(`[self-play] Win conditions: ${fmtReasons(totalWinReasons)}`);
      }

      // ── Full deck table ──
      // Columns: Rank | Deck name | W-L | WR% | Games | Win conditions.
      // Width is computed from the data so long deck names aren't clipped.
      if (rankedDecks.length) {
        const nameW = Math.max(9, ...rankedDecks.map(d => (d.name || '?').length));
        const wlW = Math.max(5, ...rankedDecks.map(d => `${d.wins}-${d.losses}`.length));
        const gW = Math.max(5, ...rankedDecks.map(d => String(d.games).length));
        const pad = (s, w, right = false) => {
          const str = String(s);
          if (str.length >= w) return str;
          return right ? str.padStart(w) : str.padEnd(w);
        };
        const sep = '-'.repeat(4 + 2 + nameW + 2 + wlW + 2 + 6 + 2 + gW + 2 + 30);
        console.log(`[self-play] DECK TABLE (${rankedDecks.length} decks, sorted by win-rate):`);
        console.log(`  ${pad('#', 4, true)}  ${pad('Deck', nameW)}  ${pad('W-L', wlW, true)}  ${pad('WR%', 6, true)}  ${pad('Games', gW, true)}  Win conditions`);
        console.log(`  ${sep}`);
        rankedDecks.forEach((d, i) => {
          const rb = fmtReasons(d.winReasons) || '—';
          const wl = `${d.wins}-${d.losses}`;
          const wrPct = (d.winRate * 100).toFixed(1);
          console.log(`  ${pad(i + 1, 4, true)}  ${pad(d.name || '?', nameW)}  ${pad(wl, wlW, true)}  ${pad(wrPct, 6, true)}  ${pad(d.games, gW, true)}  ${rb}`);
        });
      }

      // ── Tie details ──
      if (tieDetails.length) {
        console.log(`[self-play] TIE DETAILS (${tieDetails.length}):`);
        for (const t of tieDetails) {
          const diag = t.diagnosis ? `\n      ${t.diagnosis}` : '';
          console.log(`  Game ${t.gameIdx}: ${t.deckP0} vs ${t.deckP1} — firstPlayer=p${t.firstPlayer} turns=${t.turns} ms=${t.ms} reason=${t.reason}${diag}`);
        }
      }

      if (summary.onesidedMatchups.length) {
        console.log(`[self-play] MOST ONE-SIDED matchups (≥${minMatchupGames} games):`);
        for (const m of summary.onesidedMatchups) {
          console.log(`  ${m.nameA} vs ${m.nameB} — ${m.aWins}-${m.bWins} (dominance ${(m.dominance * 100).toFixed(1)}%, ${m.dominantSide} winning)`);
        }
      }
      // ── Write a human-readable TXT report ──
      // Mirrors the stdout summary but saved to data/ for easy retrieval
      // after a long run. Unlike the partial JSON (overwritten per game),
      // this is the FINAL report, written once at the end.
      try {
        const lines = [];
        const push = (s) => lines.push(s);
        push(`Pixel Parties self-play report`);
        push(`Generated: ${new Date().toISOString()}`);
        push(`Config: rolloutHorizon=${getRolloutHorizon()} rolloutBrain=${getRolloutBrain()}`);
        push(`Games: ${count}  |  Deck pool: ${allDecks.length} (${pickerMode})`);
        push(`Results: p0 wins=${stats.p0wins}  p1 wins=${stats.p1wins}  draws=${stats.draws}`);
        push(`Timing: avgTurns=${summary.avgTurns}  avgMs=${summary.avgMsPerGame}  totalMs=${totalMs} (${(totalMs / 60000).toFixed(1)} min)`);
        push(`First-player skew: ${summary.firstPlayerSkew}`);
        push('');
        if (Object.keys(totalWinReasons).length) {
          const reasonStr = Object.entries(totalWinReasons).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}: ${v}`).join(', ');
          push(`Win conditions: ${reasonStr}`);
          push('');
        }
        if (rankedDecks.length) {
          const nameW = Math.max(9, ...rankedDecks.map(d => (d.name || '?').length));
          const wlW = Math.max(5, ...rankedDecks.map(d => `${d.wins}-${d.losses}`.length));
          const gW = Math.max(5, ...rankedDecks.map(d => String(d.games).length));
          const pad = (s, w, right = false) => {
            const str = String(s);
            if (str.length >= w) return str;
            return right ? str.padStart(w) : str.padEnd(w);
          };
          const sep = '-'.repeat(4 + 2 + nameW + 2 + wlW + 2 + 6 + 2 + gW + 2 + 30);
          push(`DECK TABLE (${rankedDecks.length} decks, sorted by win-rate):`);
          push(`  ${pad('#', 4, true)}  ${pad('Deck', nameW)}  ${pad('W-L', wlW, true)}  ${pad('WR%', 6, true)}  ${pad('Games', gW, true)}  Win conditions`);
          push(`  ${sep}`);
          rankedDecks.forEach((d, i) => {
            const rb = (() => {
              const e = Object.entries(d.winReasons || {}).sort((a, b) => b[1] - a[1]);
              return e.length ? e.map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
            })();
            const wl = `${d.wins}-${d.losses}`;
            const wrPct = (d.winRate * 100).toFixed(1);
            push(`  ${pad(i + 1, 4, true)}  ${pad(d.name || '?', nameW)}  ${pad(wl, wlW, true)}  ${pad(wrPct, 6, true)}  ${pad(d.games, gW, true)}  ${rb}`);
          });
          push('');
        }
        // ── Full matchup matrix ──
        // All 66 unique matchups (12 choose 2) + up to 12 mirror matches.
        // Sorted alphabetically by pair so readers can scan to find a
        // specific matchup. The `byMatchup` keys are sorted already, so
        // we just sort the entries by nameA then nameB.
        if (matchupList.length) {
          const sortedMatchups = [...matchupList].sort((a, b) => {
            if (a.nameA !== b.nameA) return a.nameA.localeCompare(b.nameA);
            return a.nameB.localeCompare(b.nameB);
          });
          push(`FULL MATCHUP TABLE (${sortedMatchups.length} unique pairings):`);
          const nameW = Math.max(...sortedMatchups.map(m => Math.max((m.nameA || '?').length, (m.nameB || '?').length)));
          for (const m of sortedMatchups) {
            const aName = (m.nameA || '?').padEnd(nameW);
            const bName = (m.nameB || '?').padEnd(nameW);
            const total = m.aWins + m.bWins;
            const aPct = total > 0 ? ((m.aWins / total) * 100).toFixed(1) : '—';
            push(`  ${aName} vs ${bName}  →  ${String(m.aWins).padStart(3)}-${String(m.bWins).padStart(3)} (${m.games} games, ${aName.trim()}: ${aPct}%)`);
          }
          push('');
        }
        if (summary.onesidedMatchups.length) {
          push(`MOST ONE-SIDED matchups (≥${minMatchupGames} games):`);
          for (const m of summary.onesidedMatchups) {
            push(`  ${m.nameA} vs ${m.nameB} — ${m.aWins}-${m.bWins} (dominance ${(m.dominance * 100).toFixed(1)}%, ${m.dominantSide} winning)`);
          }
          push('');
        }
        if (tieDetails.length) {
          push(`TIE DETAILS (${tieDetails.length}):`);
          for (const t of tieDetails) {
            const diag = t.diagnosis ? `\n      ${t.diagnosis}` : '';
            push(`  Game ${t.gameIdx}: ${t.deckP0} vs ${t.deckP1} — firstPlayer=p${t.firstPlayer} turns=${t.turns} ms=${t.ms} reason=${t.reason}${diag}`);
          }
          push('');
        }

        // ── Game transcripts ──
        // Detailed CPU decision traces for the random-sampled games.
        // Shows hand snapshots, MCTS candidate scores, chosen plays,
        // and commit/skip decisions on Main Phase gates. Capped at
        // ~500 lines per game to keep the report readable.
        if (transcripts.length) {
          push(`═══════════════════════════════════════════════════════════`);
          push(`GAME TRANSCRIPTS (${transcripts.length} random samples)`);
          push(`═══════════════════════════════════════════════════════════`);
          push('');
          for (const t of transcripts) {
            const winner = t.winnerIdx === 0 ? t.deckP0 : t.winnerIdx === 1 ? t.deckP1 : 'DRAW';
            push(`─── Game ${t.gameIdx}: ${t.deckP0} (p0) vs ${t.deckP1} (p1) ───`);
            push(`   firstPlayer=p${t.firstPlayer}  turns=${t.turns}  winner=${winner}  reason=${t.reason}`);
            push(`   Transcript (${(t.lines || []).length} lines):`);
            for (const ln of (t.lines || [])) push(`   ${ln}`);
            push('');
          }
        }

        const reportPath = path.join(__dirname, 'data', `selfplay-report-${Date.now()}.txt`);
        fs.writeFileSync(reportPath, lines.join('\n'));
        console.log(`[self-play] final report saved → ${reportPath}`);
      } catch (werr) {
        console.error('[self-play] report write failed:', werr.message);
      }

      socket.emit('debug_self_play_result', summary);
    })().catch(err => {
      console.error('[self-play] runner threw:', err.message, err.stack);
      setCpuVerbose(_prevVerbose_sp);
      socket.emit('debug_self_play_result', { ok: false, msg: err.message });
    });
  });

  // ═══════════════════════════════════════════
  //  A/B sweep — rollout horizon × rollout brain.
  //  Runs `count` games per config on a fixed matchup, alternating first
  //  player 50/50. Default sweep: 4 configs =
  //    (horizon 0, 2) × (brain 'heuristic', 'evalGreedy').
  //    socket.emit('debug_self_play_ab', { count: 50 });
  //    socket.on('debug_self_play_ab_result', console.log);
  //  Optional: { deckNameA, deckNameB, horizons: [0,1,2], brains: ['heuristic','evalGreedy'] }
  // ═══════════════════════════════════════════
  socket.on('debug_self_play_ab', ({
    count = 50,
    deckNameA = 'Heal Burn',
    deckNameB = 'Spell Industrialization',
    horizons = [0, 2],
    brains = ['heuristic', 'evalGreedy'],
    silent = true,
  } = {}) => {
    if (!currentUser) {
      socket.emit('debug_self_play_ab_result', { ok: false, msg: 'not authenticated' });
      return;
    }
    const _prevVerbose_ab = getCpuVerbose();
    (async () => {
      // Find the two decks by name (saved + sample pool).
      const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
      const userDecks = rows.map(parseDeck).filter(Boolean);
      const pool = [...userDecks, ...loadSampleDecks()].filter(d =>
        d && Array.isArray(d.heroes) && d.heroes.length > 0
        && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
      const findByName = (n) => pool.find(d => (d.name || '').toLowerCase() === n.toLowerCase());
      const deckA = findByName(deckNameA);
      const deckB = findByName(deckNameB);
      if (!deckA || !deckB) {
        socket.emit('debug_self_play_ab_result', { ok: false, msg: `deck not found: ${!deckA ? deckNameA : deckNameB}` });
        return;
      }

      setCpuVerbose(!silent);
      const originalHorizon = getRolloutHorizon();
      const originalBrain = getRolloutBrain();

      // Build config matrix (cartesian product of horizons × brains).
      const configs = [];
      for (const h of horizons) for (const b of brains) configs.push({ horizon: h, brain: b });

      console.log(`[self-play A/B] matchup: "${deckA.name}" vs "${deckB.name}", ${count} games per config, ${configs.length} configs → ${configs.length * count} games total`);

      const byConfig = [];
      const t0 = Date.now();
      try {
        for (const cfg of configs) {
          setRolloutHorizon(cfg.horizon);
          setRolloutBrain(cfg.brain);
          const label = `h=${cfg.horizon} brain=${cfg.brain}`;
          console.log(`[self-play A/B] ─── ${label} ─── starting ${count} games`);
          const stats = {
            horizon: cfg.horizon,
            brain: cfg.brain,
            aWins: 0, bWins: 0, draws: 0,
            aWinsWhenFirst: 0, aWinsWhenSecond: 0,
            totalTurns: 0, totalMs: 0,
            // Split by winner-side so we can see HOW each side wins.
            // Heal Burn winning via deck-out ≠ winning via hero kills.
            aWinReasons: Object.create(null),
            bWinReasons: Object.create(null),
            ties: [],
          };
          for (let i = 0; i < count; i++) {
            const aIsP0 = (i % 2 === 0);
            const deckP0 = aIsP0 ? deckA : deckB;
            const deckP1 = aIsP0 ? deckB : deckA;
            const aLabel = deckA.name + (aIsP0 ? ' (p0)' : ' (p1)');
            const bLabel = deckB.name + (aIsP0 ? ' (p1)' : ' (p0)');
            try {
              const r = await runOneSelfPlayGame(deckP0, deckP1);
              stats.totalTurns += r.turns;
              stats.totalMs += r.ms;
              let outcome;
              if (r.winnerIdx === 0 || r.winnerIdx === 1) {
                const aIdx = aIsP0 ? 0 : 1;
                const aWon = r.winnerIdx === aIdx;
                const reason = r.reason || 'unknown';
                if (aWon) {
                  stats.aWins++;
                  outcome = `A (${deckA.name}) won via ${reason}`;
                  if ((aIsP0 && r.firstPlayer === 0) || (!aIsP0 && r.firstPlayer === 1)) stats.aWinsWhenFirst++;
                  else stats.aWinsWhenSecond++;
                  stats.aWinReasons[reason] = (stats.aWinReasons[reason] || 0) + 1;
                } else {
                  stats.bWins++;
                  outcome = `B (${deckB.name}) won via ${reason}`;
                  stats.bWinReasons[reason] = (stats.bWinReasons[reason] || 0) + 1;
                }
              } else {
                stats.draws++;
                outcome = `DRAW (${r.reason || 'unknown'})`;
                stats.ties.push({ gameIdx: i + 1, turns: r.turns, ms: r.ms, reason: r.reason, diagnosis: r.diagnosis });
              }
              console.log(`[self-play A/B] ${label} ${i + 1}/${count}: ${aLabel} vs ${bLabel} → ${outcome} (${r.turns}t, ${r.ms}ms) — running A:${stats.aWins} B:${stats.bWins} D:${stats.draws}`);
              if ((i + 1) % 10 === 0) {
                const mu = process.memoryUsage();
                const mb = (n) => Math.round(n / 1024 / 1024);
                console.log(`[self-play A/B] ${label} heap: rss=${mb(mu.rss)}MB heapUsed=${mb(mu.heapUsed)}MB`);
              }
            } catch (err) {
              console.error(`[self-play A/B] ${label} game ${i + 1} threw:`, err.message);
            }
          }
          const games = stats.aWins + stats.bWins + stats.draws;
          stats.games = games;
          stats.aWR = games ? +(stats.aWins / games).toFixed(3) : 0;
          stats.avgTurns = games ? +(stats.totalTurns / games).toFixed(1) : 0;
          stats.avgMsPerGame = games ? Math.round(stats.totalMs / games) : 0;
          const fmtReasons = (o) => {
            const entries = Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
            return entries.length ? entries.map(([k, v]) => `${k}:${v}`).join(', ') : '—';
          };
          console.log(`[self-play A/B] ${label} DONE — ${deckA.name}: ${stats.aWins}-${stats.bWins}, draws=${stats.draws}, WR=${(stats.aWR * 100).toFixed(1)}%, avgTurns=${stats.avgTurns}, avgMs=${stats.avgMsPerGame}`);
          console.log(`  ${deckA.name} wins via: ${fmtReasons(stats.aWinReasons)}`);
          console.log(`  ${deckB.name} wins via: ${fmtReasons(stats.bWinReasons)}`);
          byConfig.push(stats);
        }
      } finally {
        setRolloutHorizon(originalHorizon);
        setRolloutBrain(originalBrain);
        setCpuVerbose(_prevVerbose_ab);
      }

      const totalMs = Date.now() - t0;
      console.log(`[self-play A/B] ═══ FINAL REPORT (${totalMs}ms total) ═══`);
      console.log(`  Matchup: ${deckA.name} (A) vs ${deckB.name} (B), ${count} games per config`);
      console.log(`  ${'Horizon'.padEnd(8)} ${'Brain'.padEnd(11)} ${'A-Wins'.padStart(7)} ${'B-Wins'.padStart(7)} ${'Draws'.padStart(6)} ${'A-WR'.padStart(7)} ${'A-1st'.padStart(6)} ${'A-2nd'.padStart(6)} ${'AvgTurns'.padStart(9)} ${'AvgMs'.padStart(7)}`);
      const fmtReasonsForReport = (o) => {
        const entries = Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
        return entries.length ? entries.map(([k, v]) => `${k}:${v}`).join(', ') : '—';
      };
      for (const s of byConfig) {
        const wrPct = (s.aWR * 100).toFixed(1);
        console.log(`  ${String(s.horizon).padEnd(8)} ${s.brain.padEnd(11)} ${String(s.aWins).padStart(7)} ${String(s.bWins).padStart(7)} ${String(s.draws).padStart(6)} ${wrPct.padStart(6)}% ${String(s.aWinsWhenFirst).padStart(6)} ${String(s.aWinsWhenSecond).padStart(6)} ${String(s.avgTurns).padStart(9)} ${String(s.avgMsPerGame).padStart(7)}`);
        console.log(`      A wins: ${fmtReasonsForReport(s.aWinReasons)}  |  B wins: ${fmtReasonsForReport(s.bWinReasons)}`);
      }
      const summary = {
        ok: true,
        deckA: deckA.name, deckB: deckB.name,
        gamesPerConfig: count,
        totalMs,
        byConfig,
      };
      socket.emit('debug_self_play_ab_result', summary);
    })().catch(err => {
      console.error('[self-play A/B] runner threw:', err.message, err.stack);
      setCpuVerbose(_prevVerbose_ab);
      try { setRolloutHorizon(2); setRolloutBrain('heuristic'); } catch {}
      socket.emit('debug_self_play_ab_result', { ok: false, msg: err.message });
    });
  });

  // ═══════════════════════════════════════════
  //  CPU vs CPU spectate — both sides controlled by the CPU brain, user
  //  watches at normal pace via the standard spectator UI.
  //    socket.emit('debug_cpu_vs_cpu', { deckNameA: 'Dance of the Butterflies', deckNameB: 'Heal Burn' });
  //    socket.on('cpu_battle_error', console.log);
  // ═══════════════════════════════════════════
  socket.on('debug_cpu_vs_cpu', async ({ deckNameA, deckNameB } = {}) => {
    if (!currentUser) { socket.emit('cpu_battle_error', 'Not authenticated'); return; }
    if (activeGames.has(currentUser.userId)) { socket.emit('cpu_battle_error', 'Already in a game — leave first'); return; }

    // Find decks by name across user + sample decks.
    try {
      const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
      const userDecks = rows.map(parseDeck).filter(Boolean);
      const pool = [...userDecks, ...loadSampleDecks()].filter(d =>
        d && Array.isArray(d.heroes) && d.heroes.length > 0
        && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
      const findByName = (n) => pool.find(d => (d.name || '').toLowerCase().includes((n || '').toLowerCase()));
      const deckA = findByName(deckNameA);
      const deckB = findByName(deckNameB);
      if (!deckA) { socket.emit('cpu_battle_error', `Deck A not found: ${deckNameA}`); return; }
      if (!deckB) { socket.emit('cpu_battle_error', `Deck B not found: ${deckNameB}`); return; }

      const snapshotDeck = (d) => JSON.parse(JSON.stringify({
        mainDeck: d.mainDeck || [], heroes: d.heroes || [],
        potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
        skins: d.skins || {},
      }));

      const roomId = 'cvc-' + uuidv4().substring(0, 8);
      const room = {
        id: roomId, host: currentUser.username, hostId: currentUser.userId,
        // Marked as 'cpu_vs_cpu' so sendSpectatorGameState can reveal
        // both hands for the watcher. The CPU driver logic keys off
        // engine._isSelfPlay below, not room.type, so regular SP code
        // paths aren't affected.
        type: 'cpu_vs_cpu', format: 1, winsNeeded: 1, setScore: [0, 0],
        playerPw: null, specPw: null,
        players: [
          { username: `CPU · ${deckA.name}`, userId: 'cpu-a-' + roomId, socketId: null, deckId: 'cvc-a' },
          { username: `CPU · ${deckB.name}`, userId: 'cpu-b-' + roomId, socketId: null, deckId: 'cvc-b' },
        ],
        spectators: [{ socketId: socket.id, userId: currentUser.userId, username: currentUser.username }],
        status: 'waiting', created: Date.now(),
        gameState: null, chatHistory: [], privateChatHistory: {},
        _currentDecks: [snapshotDeck(deckA), snapshotDeck(deckB)],
        _deckNames: [deckA.name, deckB.name],
      };
      rooms.set(roomId, room);
      socket.join('room:' + roomId);
      // Occupy an activeGames slot so the user can't double-launch.
      activeGames.set(currentUser.userId, roomId);

      await setupGameState(room);
      const firstPlayer = Math.random() < 0.5 ? 0 : 1;
      console.log(`[cpu-vs-cpu] ${deckA.name} (p0) vs ${deckB.name} (p1), firstPlayer=p${firstPlayer}`);

      await startGameEngine(room, roomId, firstPlayer, (engine) => {
        engine._isSelfPlay = true; // every turn driven by the CPU brain
        engine._cpuPlayerIdx = firstPlayer;
        installCpuBrain(engine);
        engine.onGameOver = (r, winnerIdx, reason) => {
          if (r.gameState && !r.gameState.result) {
            r.gameState.result = { winnerIdx, reason, isCpuBattle: true };
          }
          for (let i = 0; i < 2; i++) sendGameState(r, i);
          sendSpectatorGameState(r);
          // Free the slot so the user can launch another spectate or rematch.
          setTimeout(() => { activeGames.delete(currentUser.userId); }, 1000);
        };
      });
      room.engine._cpuDriver = makeCpuDriver(room);

      // DELIBERATELY NOT entering fast mode — the whole point is to
      // watch at normal pace. Pacing delays (_delay, broadcasts,
      // animations) fire as they do in a regular CPU battle.

      // Auto-mulligan both sides via the smart-mulligan heuristic, same
      // as self-play batches do (no user interaction needed).
      if (room.gameState.mulliganDecisions) {
        for (const pi of [0, 1]) {
          let mull = false;
          try {
            room.engine._cpuPlayerIdx = pi;
            mull = shouldMulliganStartingHand(room.engine, pi);
          } catch (err) {
            console.error('[cpu-vs-cpu] mulligan check threw:', err.message);
          }
          room.gameState.mulliganDecisions[pi] = mull;
          if (mull) {
            const ps = room.gameState.players[pi];
            const cardDB = getCardDB();
            const handSize = ps.hand.length;
            let potionCount = 0;
            for (const card of ps.hand) {
              const cd = cardDB[card];
              if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
              else { ps.mainDeck.push(card); }
            }
            ps.hand.length = 0;
            const shuf = (arr) => {
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
            };
            shuf(ps.mainDeck);
            shuf(ps.potionDeck);
            const mainToDraw = handSize - potionCount;
            for (let i = 0; i < mainToDraw; i++) {
              if (ps.mainDeck.length === 0) break;
              ps.hand.push(ps.mainDeck.shift());
            }
            for (let i = 0; i < potionCount; i++) {
              if (ps.potionDeck.length === 0) break;
              ps.hand.push(ps.potionDeck.shift());
            }
          }
        }
        room.gameState.mulliganPending = false;
        delete room.gameState.mulliganDecisions;
      }

      // Initial state push so the spectator sees the board immediately.
      sendSpectatorGameState(room);

      // Kick off the engine — it chains through every subsequent turn
      // via _cpuDriver until gs.result is set.
      room.engine.startGame().catch(err => {
        console.error('[cpu-vs-cpu] startGame threw:', err.message, err.stack);
        socket.emit('cpu_battle_error', 'Engine error: ' + err.message);
      });
    } catch (err) {
      console.error('[cpu-vs-cpu] setup threw:', err.message, err.stack);
      socket.emit('cpu_battle_error', 'Setup failed: ' + err.message);
      activeGames.delete(currentUser.userId);
    }
  });

  socket.on('start_cpu_battle', ({ playerDeckId, cpuDeckId }) => {
    if (!currentUser) return;
    createCpuBattle({ playerDeckId, cpuDeckId }).catch(err => {
      console.error('[CPU battle] creation error:', err.message, err.stack);
      socket.emit('cpu_battle_error', 'Failed to start: ' + (err.message || 'unknown'));
    });
  });

  // Rematch: human clicks REMATCH on the singleplayer win/lose screen.
  // Reuses the player's currently-selected deck (as synced via
  // `change_deck` through the dropdown) and re-uses the previous CPU
  // opponent's deck by default — the client sends no cpuDeckId, so
  // "Rematch" means "same opponent, your chosen deck". The current
  // room is destroyed (activeGames cleared) so createCpuBattle can
  // spin up a fresh one without tripping the "already in a game" guard.
  socket.on('rematch_cpu_battle', ({ roomId, cpuDeckId }) => {
    console.log('[CPU rematch] received', { roomId, cpuDeckId, user: currentUser?.username });
    if (!currentUser) { console.warn('[CPU rematch] no currentUser — aborting'); return; }
    const room = rooms.get(roomId);
    if (!room) { console.warn('[CPU rematch] room not found:', roomId); return; }
    if (room.type !== 'singleplayer') { console.warn('[CPU rematch] wrong room type:', room.type); return; }
    const playerEntry = room.players?.find(p => p.userId === currentUser.userId);
    if (!playerEntry) { console.warn('[CPU rematch] playerEntry not found in room', roomId); return; }
    const playerDeckId = playerEntry.deckId;
    // CPU is always player index 1 in singleplayer rooms (set by
    // createCpuBattle at line ~5617). Fall back to the prior CPU deck
    // when the client doesn't pass one.
    const cpuEntry = room.players?.[1];
    const cpuDeckIdToUse = cpuDeckId || cpuEntry?.deckId;
    console.log('[CPU rematch] resolved decks', { playerDeckId, cpuDeckIdToUse });
    // Clean up the old room synchronously — don't even need to emit a
    // departure; the client is about to receive a brand-new game_state.
    socket.leave('room:' + roomId);
    cleanupRoom(roomId);
    console.log('[CPU rematch] cleanup done, calling createCpuBattle');
    createCpuBattle({ playerDeckId, cpuDeckId: cpuDeckIdToUse })
      .then(() => console.log('[CPU rematch] createCpuBattle resolved'))
      .catch(err => {
        console.error('[CPU rematch] creation error:', err.message, err.stack);
        socket.emit('cpu_battle_error', 'Failed to rematch: ' + (err.message || 'unknown'));
      });
  });

  // ── Tutorial system ──
  socket.on('get_tutorials', async () => {
    if (!currentUser) return;
    try {
      const tutDir = path.join(__dirname, 'data', 'puzzles', 'tutorial');
      if (!fs.existsSync(tutDir)) { socket.emit('tutorial_list', []); return; }
      const files = fs.readdirSync(tutDir).filter(f => f.endsWith('.json')).sort();
      const tutorials = [];
      for (const file of files) {
        const base = file.replace(/\.json$/, '');
        const match = base.match(/^tutorial(\d+)\s+(.+)$/i);
        if (!match) continue;
        const num = parseInt(match[1], 10);
        const name = match[2];
        const tutorialId = 'tutorial/' + base;
        tutorials.push({ num, name, tutorialId, fileName: base });
      }
      tutorials.sort((a, b) => a.num - b.num);

      const completions = await db.all(
        'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ?',
        [currentUser.userId]
      );
      const completedSet = new Set(completions.map(r => r.puzzle_id));
      const completedByNum = new Set(
        tutorials.filter(t => completedSet.has(t.tutorialId)).map(t => t.num)
      );

      // Progression gate: tutorial N is locked until tutorial N-1 is cleared.
      // Tutorial 1 is always unlocked.
      socket.emit('tutorial_list', tutorials.map(t => ({
        num: t.num, name: t.name, tutorialId: t.tutorialId,
        completed: completedSet.has(t.tutorialId),
        locked: t.num > 1 && !completedByNum.has(t.num - 1),
      })));
    } catch (err) {
      console.error('[Tutorial] get_tutorials error:', err.message);
      socket.emit('tutorial_list', []);
    }
  });

  socket.on('start_tutorial_attempt', ({ tutorialId }) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }

    (async () => {
      try {
        const fileName = tutorialId.replace('tutorial/', '');
        const filePath = path.join(__dirname, 'data', 'puzzles', 'tutorial', fileName + '.json');
        if (!fs.existsSync(filePath)) { socket.emit('puzzle_error', 'Tutorial not found'); return; }

        // Progression gate: parse this tutorial's number out of its file
        // name and require the previous tutorial to already be cleared.
        const numMatch = fileName.match(/^tutorial(\d+)/i);
        const num = numMatch ? parseInt(numMatch[1], 10) : 1;
        if (num > 1) {
          const tutDir = path.dirname(filePath);
          const prevPrefix = `tutorial${num - 1} `;
          const prevFile = fs.readdirSync(tutDir).find(f => f.startsWith(prevPrefix) && f.endsWith('.json'));
          if (prevFile) {
            const prevId = 'tutorial/' + prevFile.replace(/\.json$/, '');
            const cleared = await db.get(
              'SELECT 1 FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
              [currentUser.userId, prevId]
            );
            if (!cleared) { socket.emit('puzzle_error', 'Clear the previous tutorial first.'); return; }
          }
        }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const puzzleData = decryptPuzzle(raw.data);

        await createPuzzleGame(puzzleData, {
          puzzleAttemptId: tutorialId,
          isTutorial: true,
        });
      } catch (err) {
        console.error('[Tutorial] start_tutorial_attempt error:', err.message, err.stack);
        socket.emit('puzzle_error', 'Failed to load tutorial: ' + err.message);
      }
    })();
  });

  // ── Retry puzzle/tutorial: clean up current game and immediately restart ──
  socket.on('retry_puzzle', () => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (!activeRoomId) return;
    const room = rooms.get(activeRoomId);
    if (!room?.gameState || room.type !== 'puzzle') return;

    const gs = room.gameState;
    const puzzleData = gs._puzzleRawData;
    const attemptId = gs._puzzleAttemptId;
    const difficulty = gs._puzzleDifficulty;
    const isTutorial = gs.isTutorial || false;

    if (!puzzleData) { socket.emit('puzzle_error', 'No puzzle data available for retry'); return; }

    // Clean up old room
    socket.leave('room:' + activeRoomId);
    activeGames.delete(currentUser.userId);
    rooms.delete(activeRoomId);

    // Restart with stored data (deep clone so original stays clean for future retries)
    const freshData = JSON.parse(JSON.stringify(puzzleData));
    createPuzzleGame(freshData, {
      puzzleAttemptId: attemptId,
      puzzleDifficulty: isTutorial ? null : difficulty,
      isTutorial,
    }).catch(err => {
      console.error('[Puzzle] retry error:', err.message, err.stack);
      socket.emit('puzzle_error', 'Failed to retry: ' + err.message);
    });
  });

  // ── Tutorial mid-game state modifications ──
  socket.on('tutorial_modify', ({ type }) => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (!activeRoomId) return;
    const room = rooms.get(activeRoomId);
    if (!room?.gameState || !room.gameState.isPuzzle) return;

    const gs = room.gameState;
    const engine = room.engine;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;

    if (type === 'tutorial3_boost') {
      const ps = gs.players[pi];
      // Find Willy and Reiza by name prefix
      const willyIdx = ps.heroes.findIndex(h => h?.name && h.name.startsWith('Willy'));
      const reizaIdx = ps.heroes.findIndex(h => h?.name && h.name.startsWith('Reiza'));
      console.log(`[Tutorial] tutorial3_boost: Willy=${willyIdx}, Reiza=${reizaIdx}, heroes=${ps.heroes.map(h => h?.name).join(', ')}`);

      // Phase 1: ATK changes + remove Reiza's Fighting + clear Willy's old abilities
      if (willyIdx >= 0) {
        ps.heroes[willyIdx].atk = 9999;
        ps.heroes[willyIdx].baseAtk = 9999;
        // Log an atk_grant so the client plays the buff SFX.
        if (engine) {
          engine.log('atk_grant', {
            hero: ps.heroes[willyIdx].name, amount: 9999, source: 'Tutorial',
          });
        }
        // Clear old ability card instances for Willy
        if (engine) {
          engine.cardInstances = engine.cardInstances.filter(c =>
            !(c.owner === pi && c.zone === 'ability' && c.heroIdx === willyIdx)
          );
        }
        ps.abilityZones[willyIdx] = [[], [], []];
      }

      if (reizaIdx >= 0) {
        ps.heroes[reizaIdx].atk = 0;
        ps.heroes[reizaIdx].baseAtk = 0;
        // Remove Reiza's Fighting abilities
        if (engine) {
          engine.cardInstances = engine.cardInstances.filter(c =>
            !(c.owner === pi && c.zone === 'ability' && c.heroIdx === reizaIdx && c.name === 'Fighting')
          );
        }
        for (let z = 0; z < (ps.abilityZones[reizaIdx] || []).length; z++) {
          ps.abilityZones[reizaIdx][z] = (ps.abilityZones[reizaIdx][z] || []).filter(n => n !== 'Fighting');
        }
      }

      // Sync phase 1
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      sendSpectatorGameState(room);

      // Phase 2: Attach Fighting to Willy after a short delay
      if (willyIdx >= 0) {
        setTimeout(() => {
          if (!room.gameState || room.gameState.result) return;
          ps.abilityZones[willyIdx] = [[], ['Fighting', 'Fighting', 'Fighting'], []];
          if (engine) {
            for (let copy = 0; copy < 3; copy++) {
              engine._trackCard('Fighting', pi, 'ability', willyIdx, 1);
            }
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i);
          sendSpectatorGameState(room);
        }, 600);
      }
    }

    if (type === 'tutorial5_gold') {
      // Antonia's "pocket change" — set the player's Gold to 999 and fire a
      // gold_gain log so the standard SFX + float animation trigger.
      const ps = gs.players[pi];
      if (ps) {
        const prev = ps.gold || 0;
        ps.gold = 999;
        if (engine) {
          engine.log('gold_gain', { player: ps.username, amount: 999 - prev, total: 999 });
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i);
        sendSpectatorGameState(room);
      }
    }

    if (type === 'tutorial4_suppress_reiza') {
      // Strip Reiza's onActionUsed hook (additional action) while keeping her afterSpellResolved (Stun+Poison)
      if (engine) {
        for (const inst of engine.cardInstances) {
          if (inst.owner === pi && inst.zone === 'hero' && inst.name && inst.name.startsWith('Reiza')) {
            const originalScript = inst.loadScript();
            if (originalScript?.hooks?.onActionUsed) {
              inst.script = { ...originalScript, hooks: { ...originalScript.hooks } };
              delete inst.script.hooks.onActionUsed;
              console.log(`[Tutorial] Stripped Reiza onActionUsed hook for player ${pi}`);
            }
          }
        }
      }
    }
  });

  socket.on('leave_room', ({ roomId }) => handleLeaveRoom(socket, roomId, currentUser));

  // Debug: add a card to a player's hand
  socket.on('disconnect', () => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (activeRoomId) {
      const room = rooms.get(activeRoomId);
      if (room?.gameState && !room.gameState.result) {
        // Puzzle rooms: preserve existing immediate cleanup.
        if (room.type === 'puzzle') {
          activeGames.delete(currentUser.userId);
          rooms.delete(activeRoomId);
          return;
        }
        // Singleplayer rooms: same idea, but cleanupRoom also clears the
        // synthetic CPU user's activeGames entry.
        if (room.type === 'singleplayer') {
          cleanupRoom(activeRoomId);
          return;
        }
        const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
        if (pi >= 0) {
          // Ignore if this socket was superseded by a newer connection (dual-tab)
          if (room.players[pi]?.socketId !== socket.id) return;

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
      // Post-result singleplayer / puzzle rooms: preserve across transient
      // disconnects (socket.io heartbeat blips, tab backgrounding) so the
      // user's rematch opportunity isn't destroyed. Explicit leave_game /
      // rematch_cpu_battle handlers handle cleanup on purpose.
      if (room && (room.type === 'singleplayer' || room.type === 'puzzle')) return;
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
    // Host leaves = destroy room. Clean up activeGames for all players.
    for (const p of room.players) activeGames.delete(p.userId);
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
  return Array.from(rooms.values())
    .filter(r => r.type !== 'puzzle')
    .map(r => ({
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
