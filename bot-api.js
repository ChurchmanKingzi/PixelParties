'use strict';
// ═══════════════════════════════════════════════════════════════════
//  MONIABOT-SCHNITTSTELLE
//
//  Verbindet den Discord-Bot (bot/) mit den Spielerkonten. Drei Teile:
//
//  1. SPIELER-ROUTEN (angemeldet, wie alle anderen /api-Routen)
//       POST /api/discord/link-code   erzeugt einen Einmalcode (10 min gültig)
//       GET  /api/discord/status      ist das Konto verknüpft?
//       POST /api/discord/unlink      hebt die Verknüpfung auf
//     Der Spieler tippt dann `!link CODE` im Discord. So beweist er, dass das
//     Discord-Konto und das Spielkonto derselben Person gehören.
//
//  2. BOT-ROUTEN (/api/bot/…) — NUR für den Bot
//     Geschützt durch das geheime BOT_SECRET (Header `x-bot-secret`). Zusätzlich
//     lehnt das Modul jede Anfrage ab, die über den Reverse-Proxy kam
//     (X-Forwarded-For gesetzt): der Bot läuft auf derselben Maschine und ruft
//     http://127.0.0.1:3000 direkt auf. Ohne BOT_SECRET in der Umgebung sind alle
//     Bot-Routen abgeschaltet (404) — ein Spiel ohne Bot verhält sich wie vorher.
//
//  3. SPALTE `users.discord_id` (eindeutig, wird beim Start angelegt).
//
//  Alles, was der Bot über einen Spieler erfährt, steht schon öffentlich im Spiel
//  (Rangliste, Profil). Nicht herausgegeben werden E-Mail, Passwort-Hash, Decks
//  anderer oder Sitzungen.
// ═══════════════════════════════════════════════════════════════════
const crypto = require('crypto');

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // ohne 0/O/1/I: wird abgetippt
const CODE_LEN = 8;
const MAX_ADMIN_SC_DELTA = 1000000;
/** Wofür der Bot SC bucht (steht in sc_log.reward_id). Alles andere wird als Admin-Buchung geführt. */
const SC_REASONS = new Set(['admin:discord', 'bot:mystery']);

function createCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return s;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Schema: Spalte + eindeutiger Index. Idempotent, läuft bei jedem Start. */
async function ensureSchema(db) {
  try { await db.execute('ALTER TABLE users ADD COLUMN discord_id TEXT DEFAULT NULL'); } catch { /* existiert schon */ }
  await db.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id) WHERE discord_id IS NOT NULL');
}

/**
 * @param {object} o
 * @param {import('express').Express} o.app
 * @param {object} o.db                  db.js (get/all/run)
 * @param {Function} o.authMiddleware
 * @param {Function} o.getActiveDaily    (userRow, nowSec) → { heroes, startTs, expiresTs, claimedBig } | null
 * @param {Function} o.nextNoonCETAfter
 * @param {Function} o.mostRecentNoonCETSec
 * @param {Function} o.uuidv4
 */
function mount({ app, db, authMiddleware, getActiveDaily, nextNoonCETAfter, mostRecentNoonCETSec, uuidv4 }) {
  const secret = process.env.BOT_SECRET || '';
  /** code → { userId, expires } */
  const codes = new Map();
  const codeOfUser = new Map();   // userId → code (ein offener Code je Spieler)

  function sweep() {
    const now = Date.now();
    for (const [c, v] of codes) if (v.expires <= now) { codes.delete(c); if (codeOfUser.get(v.userId) === c) codeOfUser.delete(v.userId); }
  }

  // ── 1. Spieler-Routen ──────────────────────────────────────────
  app.get('/api/discord/status', authMiddleware, async (req, res) => {
    try {
      const u = await db.get('SELECT discord_id FROM users WHERE id = ?', [req.user.userId]);
      res.json({ linked: !!(u && u.discord_id), enabled: !!secret });
    } catch (err) { console.error('[discord/status]', err.message); res.status(500).json({ error: 'Failed to load status' }); }
  });

  app.post('/api/discord/link-code', authMiddleware, async (req, res) => {
    try {
      if (!secret) return res.status(503).json({ error: 'Discord link is not enabled on this server' });
      const u = await db.get('SELECT is_guest, discord_id FROM users WHERE id = ?', [req.user.userId]);
      if (!u) return res.status(404).json({ error: 'User not found' });
      if (u.is_guest) return res.status(403).json({ error: 'Guest accounts cannot be linked. Create an account first.' });
      if (u.discord_id) return res.status(409).json({ error: 'Already linked. Unlink first to link a different Discord account.' });
      sweep();
      const old = codeOfUser.get(req.user.userId);
      if (old) codes.delete(old);
      let code;
      do { code = createCode(); } while (codes.has(code));
      codes.set(code, { userId: req.user.userId, expires: Date.now() + CODE_TTL_MS });
      codeOfUser.set(req.user.userId, code);
      res.json({ code, expiresInSec: Math.floor(CODE_TTL_MS / 1000) });
    } catch (err) { console.error('[discord/link-code]', err.message); res.status(500).json({ error: 'Failed to create code' }); }
  });

  app.post('/api/discord/unlink', authMiddleware, async (req, res) => {
    try {
      await db.run('UPDATE users SET discord_id = NULL WHERE id = ?', [req.user.userId]);
      res.json({ linked: false });
    } catch (err) { console.error('[discord/unlink]', err.message); res.status(500).json({ error: 'Failed to unlink' }); }
  });

  // ── 2. Bot-Routen ──────────────────────────────────────────────
  function botAuth(req, res, next) {
    if (!secret) return res.status(404).end();
    if (req.headers['x-forwarded-for'] || req.headers['x-forwarded-host']) return res.status(403).json({ error: 'forbidden' });
    const given = req.headers['x-bot-secret'];
    if (!given || !safeEqual(given, secret)) return res.status(403).json({ error: 'forbidden' });
    next();
  }
  const bot = (path) => '/api/bot' + path;

  async function skinCount(userId) {
    const r = await db.get("SELECT COUNT(*) AS n FROM user_shop_items WHERE user_id = ? AND item_type = 'skin'", [userId]);
    return Number(r?.n || 0);
  }
  async function shopCounts(userId) {
    const rows = await db.all('SELECT item_type, COUNT(*) AS n FROM user_shop_items WHERE user_id = ? GROUP BY item_type', [userId]);
    const out = {};
    for (const r of rows) out[r.item_type] = Number(r.n);
    return out;
  }
  /** `withAvatar: false` lässt das (bis zu 3 MB große) Avatar-Bild weg — die Sammelabfrage für den Rollenabgleich braucht es nicht. */
  async function publicView(u, { withAvatar = true } = {}) {
    const counts = await shopCounts(u.id);
    return {
      id: u.id, username: u.username, discordId: u.discord_id,
      elo: u.elo, color: u.color || '#00f0ff', sc: u.sc || 0,
      wins: u.wins || 0, losses: u.losses || 0, rankedGames: u.ranked_games || 0,
      ...(withAvatar ? { avatar: u.avatar || null } : {}), createdAt: u.created_at,
      skins: counts.skin || 0, avatars: counts.avatar || 0, sleeves: counts.sleeve || 0,
    };
  }

  /** Verknüpft den Einmalcode mit einer Discord-ID. */
  app.post(bot('/link'), botAuth, async (req, res) => {
    try {
      const code = String(req.body?.code || '').trim().toUpperCase();
      const discordId = String(req.body?.discordId || '');
      if (!/^\d{5,25}$/.test(discordId)) return res.status(400).json({ error: 'bad_discord_id' });
      sweep();
      const entry = codes.get(code);
      if (!entry) return res.status(404).json({ error: 'invalid_code' });
      // Code SOFORT verbrauchen (vor den Datenbank-Aufrufen): zwei gleichzeitige Anfragen mit demselben Code dürfen nicht beide gelten.
      codes.delete(code);
      codeOfUser.delete(entry.userId);
      const taken = await db.get('SELECT id, username FROM users WHERE discord_id = ?', [discordId]);
      if (taken && taken.id !== entry.userId) return res.status(409).json({ error: 'discord_already_linked', username: taken.username });
      try { await db.run('UPDATE users SET discord_id = ? WHERE id = ?', [discordId, entry.userId]); }
      catch { return res.status(409).json({ error: 'discord_already_linked' }); }   // eindeutiger Index: jemand war schneller
      const u = await db.get('SELECT * FROM users WHERE id = ?', [entry.userId]);
      res.json({ user: await publicView(u) });
    } catch (err) { console.error('[bot/link]', err.message); res.status(500).json({ error: 'link_failed' }); }
  });

  app.post(bot('/unlink'), botAuth, async (req, res) => {
    try {
      const r = await db.run('UPDATE users SET discord_id = NULL WHERE discord_id = ?', [String(req.body?.discordId || '')]);
      res.json({ unlinked: r.rowsAffected > 0 });
    } catch (err) { console.error('[bot/unlink]', err.message); res.status(500).json({ error: 'unlink_failed' }); }
  });

  app.get(bot('/user/:discordId'), botAuth, async (req, res) => {
    try {
      const u = await db.get('SELECT * FROM users WHERE discord_id = ?', [String(req.params.discordId)]);
      if (!u) return res.status(404).json({ error: 'not_linked' });
      res.json({ user: await publicView(u) });
    } catch (err) { console.error('[bot/user]', err.message); res.status(500).json({ error: 'failed' }); }
  });

  /** Alle verknüpften Spieler (für den Rollenabgleich) samt Platz in der Rangliste. */
  app.get(bot('/linked'), botAuth, async (req, res) => {
    try {
      const rows = await db.all('SELECT * FROM users WHERE discord_id IS NOT NULL');
      const board = await db.all('SELECT id FROM users WHERE ranked_games > 0 ORDER BY elo DESC, username ASC LIMIT 20');
      const rankOf = new Map(board.map((r, i) => [r.id, i + 1]));
      const users = [];
      for (const u of rows) users.push({ ...(await publicView(u, { withAvatar: false })), leaderboardRank: rankOf.get(u.id) || null });
      res.json({ users });
    } catch (err) { console.error('[bot/linked]', err.message); res.status(500).json({ error: 'failed' }); }
  });

  /** Daily Challenge des verknüpften Spielers (nur lesen — gestartet wird im Spiel). */
  app.get(bot('/daily/:discordId'), botAuth, async (req, res) => {
    try {
      const u = await db.get('SELECT * FROM users WHERE discord_id = ?', [String(req.params.discordId)]);
      if (!u) return res.status(404).json({ error: 'not_linked' });
      const nowSec = Math.floor(Date.now() / 1000);
      const active = getActiveDaily(u, nowSec);
      res.json({
        username: u.username,
        active: !!active,
        heroes: active ? active.heroes : [],
        expiresTs: active ? active.expiresTs : 0,
        nextResetTs: nextNoonCETAfter(nowSec),
        lastResetTs: mostRecentNoonCETSec(nowSec),
      });
    } catch (err) { console.error('[bot/daily]', err.message); res.status(500).json({ error: 'failed' }); }
  });

  /**
   * SC erhöhen/senken (Admin-Befehle, Mystery-Gewinne). `delta` ganze Zahl ≠ 0. Das Guthaben fällt nie unter 0.
   * Jede Buchung steht in sc_log (reward_id = `reason`, Voreinstellung `admin:discord`), `opponent_id` trägt die Discord-ID des Auslösers.
   */
  app.post(bot('/sc'), botAuth, async (req, res) => {
    try {
      const delta = Number(req.body?.delta);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_ADMIN_SC_DELTA) return res.status(400).json({ error: 'bad_delta' });
      const u = await db.get('SELECT id, username, sc FROM users WHERE discord_id = ?', [String(req.body?.discordId || '')]);
      if (!u) return res.status(404).json({ error: 'not_linked' });
      const before = u.sc || 0;
      const after = Math.max(0, before + delta);
      const applied = after - before;
      // Atomar gegen gleichzeitige Spielbuchungen: relativ ändern, nicht den gelesenen Wert zurückschreiben.
      await db.run('UPDATE users SET sc = MAX(0, COALESCE(sc, 0) + ?) WHERE id = ?', [delta, u.id]);
      await db.run('INSERT INTO sc_log (id, user_id, reward_id, opponent_id, amount) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), u.id, SC_REASONS.has(req.body?.reason) ? req.body.reason : 'admin:discord', String(req.body?.adminDiscordId || ''), applied]);
      const now = await db.get('SELECT sc FROM users WHERE id = ?', [u.id]);
      res.json({ username: u.username, before, after: now?.sc ?? after, applied });
    } catch (err) { console.error('[bot/sc]', err.message); res.status(500).json({ error: 'failed' }); }
  });

  /** Die Decks eines verknüpften Spielers (Namen) bzw. ein einzelnes Deck — für `!deck`. Nur das eigene, nie fremde. */
  app.get(bot('/decks/:discordId'), botAuth, async (req, res) => {
    try {
      const u = await db.get('SELECT id, username FROM users WHERE discord_id = ?', [String(req.params.discordId)]);
      if (!u) return res.status(404).json({ error: 'not_linked' });
      const rows = await db.all('SELECT name, main_deck, heroes, potion_deck, side_deck, cover_card FROM decks WHERE user_id = ? ORDER BY updated_at DESC', [u.id]);
      const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
      res.json({
        username: u.username,
        decks: rows.map(r => ({
          name: r.name, cover: r.cover_card || '',
          main: parse(r.main_deck, []), heroes: parse(r.heroes, []), potion: parse(r.potion_deck, []), side: parse(r.side_deck, []),
        })),
      });
    } catch (err) { console.error('[bot/decks]', err.message); res.status(500).json({ error: 'failed' }); }
  });

  return { codes };
}

module.exports = { mount, ensureSchema, createCode, CODE_LEN };
