'use strict';
// ═══════════════════════════════════════════════════════════════
//  EMOTES & TITEL — Besitz, Ausrüstung (Profil), Vergabe über das Glücksrad, Emote-Versand im Duell
//
//  Emotes: data/shop/emotes/emotes.json (Import: scripts/emotes/import.py). `smuggest`, `sad`, `cool` gehören jedem von Anfang an und sind in dieser
//  Reihenfolge auf den Tasten 1–3 vorausgewählt; weitere Emotes gewinnt man am Glücksrad. Höchstens 3 gewählte Emotes (Slots = Tasten 1–3).
//  Titel: data/titles.json (Englisch/Deutsch, je Sprache „davor“ oder „dahinter“ am Namen). Einer ist ausrüstbar; alle kommen vom Glücksrad.
//
//    GET  /api/profile/cosmetics    → { emotes: { all, owned, slots, max }, titles: { all, owned, equipped } }
//    POST /api/profile/emote-slots  { slots: [id, …] } (≤ 3, nur eigene, ohne Doppelte)  → { slots }
//    POST /api/profile/title        { id | null }  → { title }
//    Socket 'emote' { roomId, id } → alle im Raum bekommen 'emote' { username, seat, id }   (nur Spieler, nur eigene Emotes, höchstens eines je 1,2 s)
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const MAX_SLOTS = 3;
const EMOTE_COOLDOWN_MS = 1200;

let _man = null, _titles = null;
function emoteManifest() {
  if (!_man) _man = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'shop', 'emotes', 'emotes.json'), 'utf8'));
  return _man;
}
function titleList() {
  if (!_titles) _titles = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'titles.json'), 'utf8')).titles;
  return _titles;
}
const emoteIds = () => emoteManifest().emotes.map(e => e.id);
const titleIds = () => titleList().map(t => t.id);
const DEFAULTS = () => emoteManifest().defaults || [];

function parseSlots(json) {
  try { const a = JSON.parse(json || 'null'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : null; } catch { return null; }
}

module.exports = function create(d) {
  const { db } = d;

  /** Besitz: die Start-Emotes plus die in user_emotes. */
  async function ownedEmotes(dbh, userId) {
    const rows = await (dbh || db).all('SELECT emote_id FROM user_emotes WHERE user_id = ?', [userId]);
    const set = new Set(DEFAULTS());
    for (const r of rows) set.add(r.emote_id);
    const valid = new Set(emoteIds());
    return [...set].filter(id => valid.has(id));
  }
  async function ownedTitles(dbh, userId) {
    const rows = await (dbh || db).all('SELECT title_id FROM user_titles WHERE user_id = ?', [userId]);
    const valid = new Set(titleIds());
    return rows.map(r => r.title_id).filter(id => valid.has(id));
  }
  /** Gewählte Emotes (Tasten 1–3): gespeicherte Auswahl, bereinigt; nie gesetzt → die Start-Emotes in Standardreihenfolge. */
  async function emoteSlots(dbh, userId, ownedList) {
    const row = await (dbh || db).get('SELECT emote_slots FROM users WHERE id = ?', [userId]);
    const own = new Set(ownedList || await ownedEmotes(dbh, userId));
    const saved = parseSlots(row && row.emote_slots);
    const list = saved === null ? DEFAULTS().slice() : saved;
    const out = [];
    for (const id of list) if (own.has(id) && !out.includes(id)) out.push(id);
    return out.slice(0, MAX_SLOTS);
  }

  /** Vergabe über das Glücksrad: ein zufälliges noch nicht besessenes Emote/Titel; null, wenn alles besessen ist. */
  async function grantRandomEmote(tx, userId, rand) {
    const own = new Set(await ownedEmotes(tx, userId));
    const left = emoteIds().filter(id => !own.has(id));
    if (!left.length) return null;
    const id = left[Math.min(left.length - 1, Math.floor((rand || Math.random)() * left.length))];
    await tx.run('INSERT OR IGNORE INTO user_emotes (user_id, emote_id) VALUES (?, ?)', [userId, id]);
    return id;
  }
  async function grantRandomTitle(tx, userId, rand) {
    const own = new Set(await ownedTitles(tx, userId));
    const left = titleIds().filter(id => !own.has(id));
    if (!left.length) return null;
    const id = left[Math.min(left.length - 1, Math.floor((rand || Math.random)() * left.length))];
    await tx.run('INSERT OR IGNORE INTO user_titles (user_id, title_id) VALUES (?, ?)', [userId, id]);
    return id;
  }

  function register() {
    const { app, authMiddleware } = d;
    app.get('/api/profile/cosmetics', authMiddleware, async (req, res) => {
      try {
        const userId = req.user.userId;
        const owned = await ownedEmotes(db, userId);
        const row = await db.get('SELECT title FROM users WHERE id = ?', [userId]);
        const ot = await ownedTitles(db, userId);
        res.json({
          emotes: { all: emoteManifest().emotes, owned, slots: await emoteSlots(db, userId, owned), max: MAX_SLOTS },
          titles: { all: titleList(), owned: ot, equipped: row && ot.includes(row.title) ? row.title : null },
        });
      } catch (err) { console.error('[profile/cosmetics]', err.message); res.status(500).json({ error: 'Failed to load' }); }
    });
    app.post('/api/profile/emote-slots', authMiddleware, async (req, res) => {
      try {
        const userId = req.user.userId, slots = req.body && req.body.slots;
        if (!Array.isArray(slots) || slots.length > MAX_SLOTS) return res.status(400).json({ error: 'Invalid slots' });
        const own = new Set(await ownedEmotes(db, userId)), clean = [];
        for (const id of slots) { if (typeof id !== 'string' || !own.has(id) || clean.includes(id)) return res.status(400).json({ error: 'Invalid emote' }); clean.push(id); }
        await db.run('UPDATE users SET emote_slots = ? WHERE id = ?', [JSON.stringify(clean), userId]);
        res.json({ ok: true, slots: clean });
      } catch (err) { console.error('[profile/emote-slots]', err.message); res.status(500).json({ error: 'Failed to save' }); }
    });
    app.post('/api/profile/title', authMiddleware, async (req, res) => {
      try {
        const userId = req.user.userId, id = req.body && req.body.id != null ? String(req.body.id) : null;
        if (id !== null && !(await ownedTitles(db, userId)).includes(id)) return res.status(400).json({ error: 'You do not own that title' });
        await db.run('UPDATE users SET title = ? WHERE id = ?', [id, userId]);
        res.json({ ok: true, title: id });
      } catch (err) { console.error('[profile/title]', err.message); res.status(500).json({ error: 'Failed to save' }); }
    });
  }

  /** Socket-Handler 'emote': `ctx` = { socket, io, rooms, getUser(), sendTo(room, event, payload) }. */
  function onEmote(ctx) {
    let last = 0;
    return async ({ roomId, id }) => {
      const user = ctx.getUser(); if (!user) return;
      const now = Date.now(); if (now - last < EMOTE_COOLDOWN_MS) return; last = now;
      const room = ctx.rooms.get(roomId); if (!room) return;
      const seat = (room.gameState ? room.gameState.players : room.players || []).findIndex(p => p && p.userId === user.userId);
      if (seat < 0 || typeof id !== 'string') return;
      if (!(await ownedEmotes(db, user.userId)).includes(id)) return;
      ctx.sendTo(room, 'emote', { username: user.username, seat, id });
    };
  }

  return { ownedEmotes, ownedTitles, emoteSlots, grantRandomEmote, grantRandomTitle, register, onEmote, emoteManifest, titleList, MAX_SLOTS };
};
