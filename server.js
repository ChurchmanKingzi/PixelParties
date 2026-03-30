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
  res.json({ user: sanitizeUser(user) });
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
  stmts.updateProfile.run(null, avatarUrl, null, req.user.userId);
  // Re-read to get current values
  const user = stmts.getUserById.get(req.user.userId);
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
const rooms = new Map(); // roomId -> room data

io.on('connection', (socket) => {
  let currentUser = null;

  socket.on('auth', (token) => {
    const session = sessions.get(token);
    if (session) {
      currentUser = session;
      socket.emit('auth_ok', session);
    } else {
      socket.emit('auth_fail');
    }
  });

  // Room list
  socket.on('get_rooms', () => {
    socket.emit('rooms', getRoomList());
  });

  // Create room
  socket.on('create_room', ({ type, playerPw, specPw }) => {
    if (!currentUser) return;
    const roomId = uuidv4().substring(0, 8);
    const room = {
      id: roomId,
      host: currentUser.username,
      hostId: currentUser.userId,
      type: type || 'unranked',
      playerPw: playerPw || null,
      specPw: specPw || null,
      players: [{ username: currentUser.username, odId: currentUser.userId, socketId: socket.id }],
      spectators: [],
      status: 'waiting',
      created: Date.now(),
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.emit('rooms', getRoomList());
  });

  // Join room
  socket.on('join_room', ({ roomId, password, asSpectator }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return socket.emit('join_error', 'Room not found');

    // Already in this room?
    const isPlayer = room.players.some(p => p.username === currentUser.username);
    const isSpec = room.spectators.some(s => s.username === currentUser.username);
    if (isPlayer || isSpec) {
      socket.join('room:' + roomId);
      return socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    }

    if (asSpectator) {
      if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Wrong spectator password');
      room.spectators.push({ username: currentUser.username, odId: currentUser.userId, socketId: socket.id });
    } else {
      if (room.players.length >= 2) {
        // Auto-spectate
        if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Game full. Wrong spectator password');
        room.spectators.push({ username: currentUser.username, odId: currentUser.userId, socketId: socket.id });
      } else {
        if (room.playerPw && password !== room.playerPw) return socket.emit('join_error', 'Wrong password');
        room.players.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id });
        // Notify host
        const hostSocket = room.players[0]?.socketId;
        if (hostSocket) {
          io.to(hostSocket).emit('player_joined', { username: currentUser.username });
        }
      }
    }

    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  // Swap to spectator
  socket.on('swap_to_spectator', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.username !== currentUser.username);
    room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id });
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  // Start game
  socket.on('start_game', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== currentUser.userId) return;
    if (room.players.length < 2) return;
    room.status = 'playing';
    io.to('room:' + roomId).emit('game_started', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  // Leave room
  socket.on('leave_room', ({ roomId }) => {
    handleLeaveRoom(socket, roomId, currentUser);
  });

  socket.on('disconnect', () => {
    // Remove from all rooms
    if (currentUser) {
      for (const [roomId, room] of rooms) {
        const wasPlayer = room.players.some(p => p.username === currentUser.username);
        const wasSpec = room.spectators.some(s => s.username === currentUser.username);
        if (wasPlayer || wasSpec) {
          handleLeaveRoom(socket, roomId, currentUser);
        }
      }
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
