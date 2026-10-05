// ═══════════════════════════════════════════════════════════════════
//  SOCIAL — „Who's Online“, private Chats und Herausforderungen
//
//  • Anwesenheit: je Nutzer die Sockets mit Zeitstempel der letzten Eingabe.
//      online  grünes Lämpchen   – mindestens ein Socket hatte zuletzt Eingabe
//      afk     oranges Lämpchen  – seit AFK_MS keine Eingabe
//      ingame  rotes Lämpchen    – steckt in einer laufenden Partie
//      offline graues Lämpchen   – kein Socket (nach kurzer Karenzzeit)
//    Die Liste zeigt nur Online-Nutzer; Offline-Nutzer tauchen für DICH nur
//    auf, solange sie ungelesene Nachrichten oder eine offene Herausforderung
//    an dich haben (siehe `social_state.extras`).
//  • Private Nachrichten liegen dauerhaft in `dm_messages` (Verlauf bleibt
//    über Logins erhalten, ungelesene werden je Absender gezählt).
//  • Herausforderungen sind Nachrichten mit `kind = 'challenge'`. Sie bleiben
//    offen, bis sie angenommen/abgelehnt werden — oder bis einer der beiden
//    von aktiv auf AFK wechselt bzw. offline geht. Wer einen schon AFK
//    stehenden Spieler herausfordert, verfällt NICHT sofort: nur der ÜBERGANG
//    aktiv → AFK nach der Erstellung lässt sie verfallen.
//  • Blockieren: beide Seiten können einander weder schreiben noch
//    herausfordern; in der Liste erscheinen sie weiterhin.
//
//  Spielstart bei „Accept“ gehört dem Server (server.js) und wird als
//  `startChallengeGame` hereingereicht.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const AFK_MS = Number(process.env.PP_AFK_MS) > 0 ? Number(process.env.PP_AFK_MS) : 5 * 60 * 1000;
const OFFLINE_GRACE_MS = 15 * 1000;   // F5 / kurzer Verbindungsabbruch zählt noch nicht als offline
const SWEEP_MS = 5 * 1000;
const MAX_TEXT = 500;
const HISTORY_LIMIT = 200;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 8;

function createSocial({ db, io, uuidv4, isInGame, startChallengeGame }) {
  /** userId -> { id, username, color, online, afk, sockets: Map(socketId -> { lastActive }), offlineTimer } */
  const presence = new Map();
  /** socketId -> userId */
  const socketUser = new Map();
  /** userId -> Zeitstempel der letzten Nachrichten (Ratenbegrenzung) */
  const rate = new Map();
  let lastBroadcast = '';
  let broadcastTimer = null;

  async function init() {
    await db.execute(`CREATE TABLE IF NOT EXISTS dm_messages (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'text',
      body TEXT NOT NULL DEFAULT '',
      ctype TEXT,
      cstatus TEXT,
      created_at INTEGER NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0
    )`);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_pair ON dm_messages(from_id, to_id, created_at)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_dm_unread ON dm_messages(to_id, is_read)');
    await db.execute(`CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    )`);
  }

  // ── Hilfen ────────────────────────────────────────────────────────
  const fmt = (r) => ({
    id: r.id, from: r.from_id, to: r.to_id, kind: r.kind, text: r.body,
    ctype: r.ctype || null, cstatus: r.cstatus || null, at: Number(r.created_at), read: !!r.is_read,
  });

  function emitToUser(userId, event, payload) {
    const u = presence.get(userId);
    if (!u) return;
    for (const sid of u.sockets.keys()) io.to(sid).emit(event, payload);
  }

  function statusOf(u) {
    if (!u || !u.online) return 'offline';
    if (isInGame(u.id)) return 'ingame';
    return u.afk ? 'afk' : 'online';
  }

  function buildPresenceList() {
    const out = [];
    for (const u of presence.values()) {
      if (!u.online) continue;
      out.push({ id: u.id, name: u.username, color: u.color || '#00f0ff', status: statusOf(u) });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  /** Anwesenheitsliste an alle angemeldeten Sockets — nur wenn sie sich geändert hat. */
  function broadcastPresence(force) {
    const list = buildPresenceList();
    const json = JSON.stringify(list);
    if (!force && json === lastBroadcast) return;
    lastBroadcast = json;
    io.to('social').emit('social_presence', { users: list });
  }
  function scheduleBroadcast() {
    if (broadcastTimer) return;
    broadcastTimer = setTimeout(() => { broadcastTimer = null; broadcastPresence(false); }, 250);
  }

  async function isBlockedEitherWay(a, b) {
    const r = await db.get(
      'SELECT 1 AS x FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
      [a, b, b, a]
    );
    return !!r;
  }

  /** Persönlicher Zustand: Ungelesenes, offene Herausforderungen an dich, Blockierungen, Namen Offline-Beteiligter. */
  async function computeState(userId) {
    const unreadRows = await db.all(
      'SELECT from_id, COUNT(*) AS n FROM dm_messages WHERE to_id = ? AND is_read = 0 GROUP BY from_id', [userId]);
    const incRows = await db.all(
      "SELECT DISTINCT from_id FROM dm_messages WHERE to_id = ? AND kind = 'challenge' AND cstatus = 'open'", [userId]);
    const blockedRows = await db.all('SELECT blocked_id FROM user_blocks WHERE blocker_id = ?', [userId]);
    const blockedByRows = await db.all('SELECT blocker_id FROM user_blocks WHERE blocked_id = ?', [userId]);
    const unread = {};
    for (const r of unreadRows) unread[r.from_id] = Number(r.n);
    const incoming = incRows.map(r => r.from_id);
    const ids = [...new Set([...Object.keys(unread), ...incoming])];
    let extras = [];
    if (ids.length) {
      const rows = await db.all(
        `SELECT id, username, color FROM users WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
      extras = rows.map(r => ({ id: r.id, name: r.username, color: r.color || '#00f0ff' }));
    }
    return {
      unread, incoming, extras,
      blocked: blockedRows.map(r => r.blocked_id),
      blockedBy: blockedByRows.map(r => r.blocker_id),
    };
  }

  async function pushState(userId) {
    if (!presence.get(userId)?.sockets.size) return;
    try { emitToUser(userId, 'social_state', await computeState(userId)); }
    catch (err) { console.error('[social] Zustand senden fehlgeschlagen:', err.message); }
  }

  function pushUpdate(row) {
    const msg = fmt(row);
    emitToUser(row.from_id, 'dm_update', msg);
    emitToUser(row.to_id, 'dm_update', msg);
  }

  // ── Herausforderungen: Ablauf ─────────────────────────────────────
  /** Offene Herausforderungen eines Nutzers (als Absender ODER Empfänger) verfallen lassen. */
  async function expireChallengesFor(userId) {
    try {
      const rows = await db.all(
        "SELECT * FROM dm_messages WHERE kind = 'challenge' AND cstatus = 'open' AND (from_id = ? OR to_id = ?)",
        [userId, userId]);
      for (const r of rows) {
        await db.run("UPDATE dm_messages SET cstatus = 'expired' WHERE id = ? AND cstatus = 'open'", [r.id]);
        pushUpdate({ ...r, cstatus: 'expired' });
      }
      const peers = new Set(rows.flatMap(r => [r.from_id, r.to_id]));
      for (const p of peers) pushState(p);
    } catch (err) { console.error('[social] Herausforderungen verfallen lassen fehlgeschlagen:', err.message); }
  }

  async function expireChallengesBetween(a, b) {
    const rows = await db.all(
      `SELECT * FROM dm_messages WHERE kind = 'challenge' AND cstatus = 'open'
         AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`, [a, b, b, a]);
    for (const r of rows) {
      await db.run("UPDATE dm_messages SET cstatus = 'expired' WHERE id = ? AND cstatus = 'open'", [r.id]);
      pushUpdate({ ...r, cstatus: 'expired' });
    }
    return rows.length;
  }

  // ── Anwesenheit ───────────────────────────────────────────────────
  function computeAfk(u, now) {
    for (const s of u.sockets.values()) if (now - s.lastActive < AFK_MS) return false;
    return true;
  }

  function sweep() {
    const now = Date.now();
    let dirty = false;
    for (const u of presence.values()) {
      if (!u.online || !u.sockets.size) continue;
      const afk = computeAfk(u, now);
      if (afk && !u.afk) {
        // Übergang aktiv → AFK: offene Herausforderungen mit diesem Spieler verfallen.
        u.afk = true; dirty = true;
        expireChallengesFor(u.id);
      } else if (!afk && u.afk) { u.afk = false; dirty = true; }
    }
    // Ob jemand in eine Partie gekommen / aus ihr heraus ist, steht nur im Vergleich der Liste.
    broadcastPresence(false);
    return dirty;
  }
  const sweepTimer = setInterval(sweep, SWEEP_MS);
  if (sweepTimer.unref) sweepTimer.unref();

  async function onAuth(socket, session) {
    if (!session?.userId) return;
    const prev = socketUser.get(socket.id);
    if (prev && prev !== session.userId) detach(socket.id);
    let row;
    try { row = await db.get('SELECT username, color, is_guest FROM users WHERE id = ?', [session.userId]); }
    catch { return; }
    if (!row || row.is_guest) return; // Gäste sind weder in der Liste noch im Chat
    let u = presence.get(session.userId);
    if (!u) {
      u = { id: session.userId, username: row.username, color: row.color, online: false, afk: false, sockets: new Map(), offlineTimer: null };
      presence.set(session.userId, u);
    }
    u.username = row.username; u.color = row.color;
    if (u.offlineTimer) { clearTimeout(u.offlineTimer); u.offlineTimer = null; }
    u.sockets.set(socket.id, { lastActive: Date.now() });
    socketUser.set(socket.id, session.userId);
    u.online = true; u.afk = false;
    socket.join('social');
    socket.emit('social_presence', { users: buildPresenceList() });
    scheduleBroadcast();
    pushState(session.userId);
  }

  function detach(socketId) {
    const uid = socketUser.get(socketId);
    if (!uid) return;
    socketUser.delete(socketId);
    const u = presence.get(uid);
    if (!u) return;
    u.sockets.delete(socketId);
    if (u.sockets.size === 0 && !u.offlineTimer) {
      u.offlineTimer = setTimeout(() => {
        u.offlineTimer = null;
        if (u.sockets.size) return;
        u.online = false; u.afk = false;
        expireChallengesFor(u.id);
        scheduleBroadcast();
      }, OFFLINE_GRACE_MS);
    }
  }

  function bestSocketOf(userId) {
    const u = presence.get(userId);
    if (!u) return null;
    let best = null; let bestT = -1;
    for (const [sid, s] of u.sockets) if (s.lastActive > bestT) { best = sid; bestT = s.lastActive; }
    return best;
  }

  function refreshIdentity(userId, { username, color }) {
    const u = presence.get(userId);
    if (!u) return;
    if (username) u.username = username;
    if (color) u.color = color;
    scheduleBroadcast();
  }

  // ── Socket-Ereignisse ─────────────────────────────────────────────
  function onConnection(socket) {
    const me = () => socketUser.get(socket.id) || null;
    const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };

    socket.on('presence_activity', () => {
      const uid = me(); if (!uid) return;
      const u = presence.get(uid); const s = u?.sockets.get(socket.id);
      if (!s) return;
      s.lastActive = Date.now();
      if (u.afk) { u.afk = false; scheduleBroadcast(); }
    });

    socket.on('social_sync', () => {
      const uid = me(); if (!uid) return;
      socket.emit('social_presence', { users: buildPresenceList() });
      pushState(uid);
    });

    socket.on('dm_history', async (data, ack) => {
      const uid = me(); if (!uid) return reply(ack, { error: 'Not signed in.' });
      const peer = String(data?.peer || '');
      try {
        const rows = await db.all(
          `SELECT * FROM dm_messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)
           ORDER BY created_at DESC, rowid DESC LIMIT ?`, [uid, peer, peer, uid, HISTORY_LIMIT]);
        reply(ack, { messages: rows.reverse().map(fmt) });
      } catch (err) { reply(ack, { error: 'Could not load the chat.' }); }
    });

    socket.on('dm_read', async (data) => {
      const uid = me(); if (!uid) return;
      const peer = String(data?.peer || '');
      try {
        const r = await db.run('UPDATE dm_messages SET is_read = 1 WHERE to_id = ? AND from_id = ? AND is_read = 0', [uid, peer]);
        if (r.rowsAffected) pushState(uid);
      } catch { /* Anzeige-Hilfe */ }
    });

    async function loadPeer(peerId) {
      const row = await db.get('SELECT id, username, is_guest FROM users WHERE id = ?', [peerId]);
      return row && !row.is_guest ? row : null;
    }

    socket.on('dm_send', async (data, ack) => {
      const uid = me(); if (!uid) return reply(ack, { error: 'Not signed in.' });
      try {
        const text = String(data?.text ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, MAX_TEXT);
        if (!text) return reply(ack, { error: 'Empty message.' });
        const peer = await loadPeer(String(data?.to || ''));
        if (!peer || peer.id === uid) return reply(ack, { error: 'Player not found.' });
        if (await isBlockedEitherWay(uid, peer.id)) return reply(ack, { error: "You can't chat with this player." });
        const now = Date.now();
        const hist = (rate.get(uid) || []).filter(t => now - t < RATE_WINDOW_MS);
        if (hist.length >= RATE_MAX) return reply(ack, { error: 'Slow down a little.' });
        hist.push(now); rate.set(uid, hist);
        const row = { id: uuidv4(), from_id: uid, to_id: peer.id, kind: 'text', body: text, ctype: null, cstatus: null, created_at: now, is_read: 0 };
        await db.run('INSERT INTO dm_messages (id, from_id, to_id, kind, body, created_at, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [row.id, row.from_id, row.to_id, 'text', text, now]);
        const msg = fmt(row);
        emitToUser(uid, 'dm_message', msg);
        emitToUser(peer.id, 'dm_message', msg);
        pushState(peer.id);
        reply(ack, { ok: true, message: msg });
      } catch (err) {
        console.error('[social] dm_send:', err.message);
        reply(ack, { error: 'Could not send the message.' });
      }
    });

    socket.on('challenge_send', async (data, ack) => {
      const uid = me(); if (!uid) return reply(ack, { error: 'Not signed in.' });
      try {
        const peer = await loadPeer(String(data?.to || ''));
        if (!peer || peer.id === uid) return reply(ack, { error: 'Player not found.' });
        if (await isBlockedEitherWay(uid, peer.id)) return reply(ack, { error: "You can't challenge this player." });
        const pu = presence.get(peer.id);
        if (!pu || !pu.online) return reply(ack, { error: peer.username + ' is offline.' });
        const ctype = data?.ranked ? 'ranked' : 'unranked';
        // Pro Spielerpaar nur eine offene Herausforderung: die neue ersetzt die alte.
        await expireChallengesBetween(uid, peer.id);
        const now = Date.now();
        const row = { id: uuidv4(), from_id: uid, to_id: peer.id, kind: 'challenge', body: '', ctype, cstatus: 'open', created_at: now, is_read: 0 };
        await db.run(
          "INSERT INTO dm_messages (id, from_id, to_id, kind, body, ctype, cstatus, created_at, is_read) VALUES (?, ?, ?, 'challenge', '', ?, 'open', ?, 0)",
          [row.id, uid, peer.id, ctype, now]);
        const msg = fmt(row);
        emitToUser(uid, 'dm_message', msg);
        emitToUser(peer.id, 'dm_message', msg);
        pushState(peer.id); pushState(uid);
        reply(ack, { ok: true, message: msg });
      } catch (err) {
        console.error('[social] challenge_send:', err.message);
        reply(ack, { error: 'Could not send the challenge.' });
      }
    });

    socket.on('challenge_respond', async (data, ack) => {
      const uid = me(); if (!uid) return reply(ack, { error: 'Not signed in.' });
      try {
        const row = await db.get("SELECT * FROM dm_messages WHERE id = ? AND kind = 'challenge'", [String(data?.id || '')]);
        if (!row || row.to_id !== uid) return reply(ack, { error: 'Challenge not found.' });
        if (row.cstatus !== 'open') return reply(ack, { error: 'This challenge is no longer open.' });
        if (await isBlockedEitherWay(uid, row.from_id)) return reply(ack, { error: "You can't challenge this player." });

        if (!data?.accept) {
          const r = await db.run("UPDATE dm_messages SET cstatus = 'declined', is_read = 1 WHERE id = ? AND cstatus = 'open'", [row.id]);
          if (!r.rowsAffected) return reply(ack, { error: 'This challenge is no longer open.' });
          pushUpdate({ ...row, cstatus: 'declined' });
          pushState(uid); pushState(row.from_id);
          return reply(ack, { ok: true });
        }

        const challenger = presence.get(row.from_id);
        if (!challenger || !challenger.online) return reply(ack, { error: 'The challenger is no longer online.' });
        // Erst „annehmen“, dann starten — so kann eine Doppelannahme nie zwei Partien erzeugen.
        const claim = await db.run("UPDATE dm_messages SET cstatus = 'accepted', is_read = 1 WHERE id = ? AND cstatus = 'open'", [row.id]);
        if (!claim.rowsAffected) return reply(ack, { error: 'This challenge is no longer open.' });
        let result;
        try {
          result = await startChallengeGame({
            challengerId: row.from_id, challengeeId: uid, ranked: row.ctype === 'ranked',
            challengerSocketId: bestSocketOf(row.from_id), challengeeSocketId: socket.id,
          });
        } catch (err) {
          console.error('[social] Spielstart fehlgeschlagen:', err.message, err.stack);
          result = { error: 'Could not start the game.' };
        }
        if (!result || result.error) {
          await db.run("UPDATE dm_messages SET cstatus = 'open' WHERE id = ? AND cstatus = 'accepted'", [row.id]);
          return reply(ack, { error: (result && result.error) || 'Could not start the game.' });
        }
        pushUpdate({ ...row, cstatus: 'accepted' });
        pushState(uid); pushState(row.from_id);
        reply(ack, { ok: true });
      } catch (err) {
        console.error('[social] challenge_respond:', err.message);
        reply(ack, { error: 'Could not answer the challenge.' });
      }
    });

    socket.on('block_set', async (data, ack) => {
      const uid = me(); if (!uid) return reply(ack, { error: 'Not signed in.' });
      try {
        const peer = await loadPeer(String(data?.user || ''));
        if (!peer || peer.id === uid) return reply(ack, { error: 'Player not found.' });
        if (data?.blocked) {
          await db.run('INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [uid, peer.id, Date.now()]);
          await expireChallengesBetween(uid, peer.id);
        } else {
          await db.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [uid, peer.id]);
        }
        pushState(uid); pushState(peer.id);
        reply(ack, { ok: true });
      } catch (err) {
        console.error('[social] block_set:', err.message);
        reply(ack, { error: 'Could not update the block list.' });
      }
    });

    socket.on('disconnect', () => detach(socket.id));
  }

  return { init, onConnection, onAuth, refreshIdentity, bestSocketOf, statusOf: (id) => statusOf(presence.get(id)), _sweep: sweep };
}

module.exports = { createSocial, AFK_MS };
