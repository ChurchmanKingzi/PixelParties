const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { GameEngine } = require('./cards/effects/_engine');
const { loadCardEffect } = require('./cards/effects/_loader');

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/cards', express.static(path.join(__dirname, 'cards')));

// Ensure required dirs exist
['uploads/avatars', 'uploads/cardbacks', 'cards'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ===== DATABASE =====
const dbPath = path.join(__dirname, 'data', 'pixel-parties.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    elo INTEGER DEFAULT 1000,
    color TEXT DEFAULT '#00f0ff',
    avatar TEXT DEFAULT NULL,
    cardback TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS decks (
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
  );

  CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
`);

// Add new columns if they don't exist yet (safe migration)
try { db.exec(`ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN wins INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN losses INTEGER DEFAULT 0`); } catch {}

// Hero usage tracking per game
db.exec(`
  CREATE TABLE IF NOT EXISTS hero_stats (
    user_id TEXT NOT NULL,
    hero_name TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, hero_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    hero1 TEXT,
    hero2 TEXT,
    hero3 TEXT,
    won INTEGER NOT NULL,
    opponent_id TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_hero_stats_user ON hero_stats(user_id);
  CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id);
`);

// Prepared statements
const stmts = {
  getUserByUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)'),
  updateProfile: db.prepare('UPDATE users SET color = ?, avatar = ?, cardback = ?, bio = ? WHERE id = ?'),
  updateElo: db.prepare('UPDATE users SET elo = ? WHERE id = ?'),
  getDecks: db.prepare('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at'),
  getDeck: db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?'),
  createDeck: db.prepare('INSERT INTO decks (id, user_id, name) VALUES (?, ?, ?)'),
  updateDeck: db.prepare('UPDATE decks SET name=?, main_deck=?, heroes=?, potion_deck=?, side_deck=?, is_default=?, updated_at=unixepoch() WHERE id=? AND user_id=?'),
  deleteDeck: db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?'),
  clearDefaults: db.prepare('UPDATE decks SET is_default = 0 WHERE user_id = ?'),
  upsertHeroStat: db.prepare(`INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses`),
  getHeroStats: db.prepare('SELECT hero_name, wins, losses FROM hero_stats WHERE user_id = ? ORDER BY (CAST(wins AS REAL) / MAX(wins + losses, 1)) DESC, (wins + losses) DESC'),
  insertGameHistory: db.prepare('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)'),
};

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
app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be 3+ characters' });
  if (password.length < 3) return res.status(400).json({ error: 'Password must be 3+ characters' });

  const existing = stmts.getUserByUsername.get(username.trim());
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  stmts.createUser.run(id, username.trim(), hash);

  // Create default deck
  stmts.createDeck.run(uuidv4(), id, 'My First Deck');

  const token = uuidv4();
  sessions.set(token, { userId: id, username: username.trim() });
  res.cookie('pp_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  const user = stmts.getUserById.get(id);
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const user = stmts.getUserByUsername.get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = uuidv4();
  sessions.set(token, { userId: user.id, username: user.username });
  res.cookie('pp_token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.pp_token;
  if (token) sessions.delete(token);
  res.clearCookie('pp_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = stmts.getUserById.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user), token: req.authToken });
});

function sanitizeUser(u) {
  return { id: u.id, username: u.username, elo: u.elo, color: u.color, avatar: u.avatar, cardback: u.cardback, bio: u.bio || '', wins: u.wins || 0, losses: u.losses || 0, created_at: u.created_at };
}

// ===== PROFILE ROUTES =====
app.put('/api/profile', authMiddleware, (req, res) => {
  const { color, avatar, cardback, bio } = req.body;
  stmts.updateProfile.run(color || '#00f0ff', avatar || null, cardback || null, (bio || '').slice(0, 200), req.user.userId);
  const user = stmts.getUserById.get(req.user.userId);
  res.json({ user: sanitizeUser(user) });
});

// File uploads for avatar and cardback
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads', 'avatars'),
    filename: (req, file, cb) => cb(null, req.user.userId + path.extname(file.originalname))
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

const cardbackUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, 'uploads', 'cardbacks'),
    filename: (req, file, cb) => cb(null, req.user.userId + '_' + Date.now() + path.extname(file.originalname))
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

app.post('/api/profile/avatar', authMiddleware, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const avatarUrl = '/uploads/avatars/' + req.file.filename;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.userId);
  res.json({ avatar: avatarUrl });
});

app.post('/api/profile/cardback', authMiddleware, cardbackUpload.single('cardback'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const cbUrl = '/uploads/cardbacks/' + req.file.filename;
  // Don't auto-set as active — user picks from gallery, saves via profile
  res.json({ cardback: cbUrl });
});

// List all cardbacks uploaded by this user
app.get('/api/profile/cardbacks', authMiddleware, (req, res) => {
  const dir = path.join(__dirname, 'uploads', 'cardbacks');
  try {
    const files = fs.readdirSync(dir);
    const userFiles = files
      .filter(f => f.startsWith(req.user.userId + '_') || f.startsWith(req.user.userId + '.'))
      .map(f => '/uploads/cardbacks/' + f);
    res.json({ cardbacks: userFiles });
  } catch {
    res.json({ cardbacks: [] });
  }
});

// ===== CHANGE PASSWORD =====
app.post('/api/profile/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both old and new password required' });
  if (newPassword.length < 3) return res.status(400).json({ error: 'New password must be 3+ characters' });
  const user = stmts.getUserById.get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  res.json({ success: true });
});

// ===== PROFILE DECK STATS =====
app.get('/api/profile/deck-stats', authMiddleware, (req, res) => {
  const decks = stmts.getDecks.all(req.user.userId);
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
app.post('/api/game/result', authMiddleware, (req, res) => {
  const { won, heroes, opponentId } = req.body;
  if (typeof won !== 'boolean') return res.status(400).json({ error: 'won must be boolean' });
  if (!Array.isArray(heroes) || heroes.length !== 3) return res.status(400).json({ error: 'heroes must be array of 3 names' });

  const userId = req.user.userId;

  // Update user wins/losses
  if (won) {
    db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(userId);
  } else {
    db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(userId);
  }

  // Update hero stats (aggregate)
  for (const heroName of heroes) {
    if (heroName) {
      stmts.upsertHeroStat.run(userId, heroName, won ? 1 : 0, won ? 0 : 1);
    }
  }

  // Record in game history
  stmts.insertGameHistory.run(uuidv4(), userId, heroes[0] || null, heroes[1] || null, heroes[2] || null, won ? 1 : 0, opponentId || null);

  const user = stmts.getUserById.get(userId);
  res.json({ success: true, user: sanitizeUser(user) });
});

// ===== HERO STATS =====
app.get('/api/profile/hero-stats', authMiddleware, (req, res) => {
  const rows = stmts.getHeroStats.all(req.user.userId);
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

app.get('/api/cards/available', (req, res) => {
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
app.get('/api/decks', authMiddleware, (req, res) => {
  const decks = stmts.getDecks.all(req.user.userId);
  res.json({ decks: decks.map(parseDeck) });
});

app.post('/api/decks', authMiddleware, (req, res) => {
  const { name } = req.body;
  const id = uuidv4();
  stmts.createDeck.run(id, req.user.userId, name || 'New Deck');
  const deck = stmts.getDeck.get(id, req.user.userId);
  res.json({ deck: parseDeck(deck) });
});

app.put('/api/decks/:id', authMiddleware, (req, res) => {
  const { name, mainDeck, heroes, potionDeck, sideDeck, isDefault } = req.body;
  const deckRow = stmts.getDeck.get(req.params.id, req.user.userId);
  if (!deckRow) return res.status(404).json({ error: 'Deck not found' });

  if (isDefault) stmts.clearDefaults.run(req.user.userId);

  stmts.updateDeck.run(
    name || deckRow.name,
    JSON.stringify(mainDeck || JSON.parse(deckRow.main_deck)),
    JSON.stringify(heroes || JSON.parse(deckRow.heroes)),
    JSON.stringify(potionDeck || JSON.parse(deckRow.potion_deck)),
    JSON.stringify(sideDeck || JSON.parse(deckRow.side_deck)),
    isDefault ? 1 : (isDefault === false ? 0 : deckRow.is_default),
    req.params.id, req.user.userId
  );

  const updated = stmts.getDeck.get(req.params.id, req.user.userId);
  res.json({ deck: parseDeck(updated) });
});

app.post('/api/decks/:id/saveas', authMiddleware, (req, res) => {
  const { name } = req.body;
  const original = stmts.getDeck.get(req.params.id, req.user.userId);
  if (!original) return res.status(404).json({ error: 'Deck not found' });

  const newId = uuidv4();
  stmts.createDeck.run(newId, req.user.userId, name || original.name + ' (Copy)');
  stmts.updateDeck.run(
    name || original.name + ' (Copy)',
    original.main_deck, original.heroes, original.potion_deck, original.side_deck, 0,
    newId, req.user.userId
  );

  const newDeck = stmts.getDeck.get(newId, req.user.userId);
  res.json({ deck: parseDeck(newDeck) });
});

app.delete('/api/decks/:id', authMiddleware, (req, res) => {
  stmts.deleteDeck.run(req.params.id, req.user.userId);
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
    })),
    areaZones: gs.areaZones, turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: gs.customPlacementCards || [],
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    potionTargeting: gs.potionTargeting || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      for (const inst of room.engine.cardInstances) {
        if (inst.zone === 'support' && Object.keys(inst.counters).length > 0) {
          cc[`${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`] = { ...inst.counters };
        }
      }
      return cc;
    })() : {},
    ...extra,
  };
  io.to(p.socketId).emit('game_state', state);
}

function endGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const isRanked = room.type === 'ranked';
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  const wUser = stmts.getUserById.get(winner.userId);
  const lUser = stmts.getUserById.get(loser.userId);
  const wElo = wUser?.elo || 1000; const lElo = lUser?.elo || 1000;
  let newWElo = wElo, newLElo = lElo;

  if (isRanked) {
    const K = 32;
    const expectedW = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
    newWElo = Math.round(wElo + K * (1 - expectedW));
    newLElo = Math.max(0, Math.round(lElo + K * (0 - (1 - expectedW))));
    stmts.updateElo.run(newWElo, winner.userId);
    stmts.updateElo.run(newLElo, loser.userId);
  }

  // Always track wins/losses and hero stats
  db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(winner.userId);
  db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(loser.userId);
  for (const ps of [winner, loser]) {
    const won = ps === winner;
    for (const h of ps.heroes) {
      if (h.name) stmts.upsertHeroStat.run(ps.userId, h.name, won ? 1 : 0, won ? 0 : 1);
    }
    stmts.insertGameHistory.run(uuidv4(), ps.userId, ps.heroes[0]?.name||null, ps.heroes[1]?.name||null, ps.heroes[2]?.name||null, won?1:0, (won?loser:winner).userId);
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

  socket.on('start_game', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== currentUser.userId || room.players.length < 2) return;
    const activePlayer = Math.random() < 0.5 ? 0 : 1;
    setupGameState(room);
    startGameEngine(room, roomId, activePlayer);
  });

  /** Set up fresh game state: decks, hands, heroes — but don't start the engine or turns. */
  function setupGameState(room) {
    const allCards = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    const cardsByName = {}; allCards.forEach(c => { cardsByName[c.name] = c; });
    const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

    const playerStates = room.players.map(p => {
      const deckRow = p.deckId ? stmts.getDeck.get(p.deckId, p.userId) : null;
      const deck = deckRow ? parseDeck(deckRow) : null;
      const usr = stmts.getUserById.get(p.userId);
      const heroes = (deck?.heroes||[]).map(h => {
        const c = h.hero ? cardsByName[h.hero] : null;
        return { name:h.hero, hp:c?.hp||0, maxHp:c?.hp||0, ability1:h.ability1||null, ability2:h.ability2||null, statuses:{} };
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
      return { userId:p.userId, username:p.username, socketId:p.socketId,
        color:usr?.color||'#00f0ff', avatar:usr?.avatar||null,
        heroes, abilityZones, surpriseZones:[[],[],[]], supportZones:[[[],[],[]],[[],[],[]],[[],[],[]]],
        hand, mainDeck, potionDeck, discardPile:[], deletedPile:[], disconnected:false, left:false, gold:0,
        abilityGivenThisTurn:[false,false,false], islandZoneCount:[0,0,0] };
    });
    room.gameState = { players:playerStates, areaZones:[[],[]], turn:0, activePlayer:0, currentPhase:0, result:null, rematchRequests:[], awaitingFirstChoice:true };
    room.status = 'playing';
    room.players.forEach(p => activeGames.set(p.userId, room.id));

    // ── DEBUG: Add Performance + Flying Island to both hands, set a random hero to 10 HP ──
    for (let pi = 0; pi < 2; pi++) {
      playerStates[pi].hand.push('Performance');
      playerStates[pi].hand.push('Performance');
      playerStates[pi].hand.push('Flying Island in the Sky');
      playerStates[pi].hand.push('Snow Cannon');
      playerStates[pi].hand.push('Fire Bomb');
      playerStates[pi].hand.push('Icy Slime');
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

  socket.on('leave_game', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const hadResult = !!room.gameState?.result;

    // If game is active and no result yet, surrendering ends the game
    if (room.gameState && !hadResult && room.status === 'playing') {
      const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
      if (pi >= 0) endGame(room, pi===0?1:0, 'surrender');
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
        await room.engine.runHooks('onCardEnterZone', { card: inst, toZone: 'ability', toHeroIdx: heroIdx });
      } catch (err) {
        console.error('[Engine] play_ability hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  });

  // Play a creature from hand to support zone
  socket.on('play_creature', ({ roomId, cardName, handIndex, heroIdx, zoneSlot }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 3) return; // Must be Action Phase

    const ps = gs.players[pi];
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
        for (const ab of (slot || [])) { if (ab === school) count++; }
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

    // Execute: remove from hand, add to support zone
    ps.hand.splice(handIndex, 1);
    ps.supportZones[heroIdx][zoneSlot] = [cardName];

    // Track card instance in engine
    const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, zoneSlot);

    // If creature has onPlay hook, emit summon effect highlight to both players
    if (inst.getHook && inst.getHook('onPlay')) {
      for (let i = 0; i < 2; i++) {
        const sid = gs.players[i]?.socketId;
        if (sid) io.to(sid).emit('summon_effect', { owner: pi, heroIdx, zoneSlot, cardName });
      }
    }

    // Fire hooks, wait for resolution, then advance phase and sync
    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot });
        await room.engine.runHooks('onCardEnterZone', { card: inst, toZone: 'support', toHeroIdx: heroIdx });
        await room.engine.advanceToPhase(pi, 4);
      } catch (err) {
        console.error('[Engine] play_creature hooks error:', err.message);
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
          await room.engine.runHooks('onCardEnterZone', { card: inst, toZone: 'support', toHeroIdx: heroIdx });
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
      // No targeting needed — resolve immediately
      (async () => {
        if (script.resolve) await script.resolve(room.engine, pi, [], []);
        ps.hand.splice(handIndex, 1);
        ps.deletedPile.push(cardName);
        // Reveal card to opponent
        const oi = pi === 0 ? 1 : 0;
        const oppSid = gs.players[oi]?.socketId;
        if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
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
      const validTargets = script.getValidTargets(gs, pi);
      gs.potionTargeting = {
        potionName: cardName,
        handIndex,
        ownerIdx: pi,
        cardType: 'Artifact',
        goldCost: cost,
        validTargets,
        config: script.targetingConfig,
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

    // Deduct gold for artifacts
    if (cardType === 'Artifact' && goldCost > 0) {
      if ((ps.gold || 0) < goldCost) return;
      ps.gold -= goldCost;
    }

    (async () => {
      // Resolve the effect
      if (script.resolve) await script.resolve(room.engine, pi, selectedIds, validTargets);
      // Remove from hand and move to appropriate pile
      const hi = ps.hand.indexOf(potionName);
      if (hi >= 0) ps.hand.splice(hi, 1);
      if (cardType === 'Potion') {
        ps.deletedPile.push(potionName); // Potions get deleted
      } else {
        ps.discardPile.push(potionName); // Artifacts get discarded
      }
      // Clear targeting
      gs.potionTargeting = null;
      // Reveal card to opponent
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: potionName });
      // Send animation event
      for (let i = 0; i < 2; i++) {
        const sid = gs.players[i]?.socketId;
        if (sid) io.to(sid).emit('potion_resolved', { destroyedIds: selectedIds, animationType: script.animationType || 'explosion' });
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

  socket.on('request_rematch', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.result) return;
    if (!room.gameState.rematchRequests.includes(currentUser.userId))
      room.gameState.rematchRequests.push(currentUser.userId);
    if (room.gameState.rematchRequests.length >= 2) {
      const loserIdx = room.gameState.result.winnerIdx === 0 ? 1 : 0;
      // Set up fresh game state FIRST so both players see their new hands
      setupGameState(room);
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
            if (room.gameState && !room.gameState.result) endGame(room, oi, 'disconnect_timeout');
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
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== START =====
server.listen(PORT, () => {
  console.log(`Pixel Parties TCG running on http://localhost:${PORT}`);
});
