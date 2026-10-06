'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — VORBEREITUNGSPHASE (server-autoritativ)
//
//  Jeder Spieler sieht nur seine eigene Basis: 18 Handkarten, freie
//  Platzierung ohne Level/Kosten, ein Recycler (jede 2. Karte spuckt
//  eine zufällige neue aus, +4 Gold je Karte), dann „Ready!". Wenn alle
//  bereit sind (oder der Timer abläuft), beginnt der Kampf (battle.js).
//
//  Die Platzierungsregeln stehen in public/skilltest-rules.js und
//  laufen identisch im Client (nur für Drop-Highlights).
// ═══════════════════════════════════════════════════════════════════

const Rules = require('../public/skilltest-rules.js');
const { CONFIG } = require('./config');
const { CardPool, dealHand } = require('./pool');
const { autoBuild, autoFillHeroes } = require('./autoprep');
const { getCardDB } = require('../cards/effects/_card-db');

const DISCONNECT_AUTOREADY_MS = 60 * 1000;

function rulesEnv() {
  let loader = null;
  try { loader = require('../cards/effects/_loader'); } catch { /* nur Tests */ }
  return {
    cards: getCardDB(),
    areaLimitOf: (name) => {
      try { return loader && loader.loadCardEffect(name) && loader.loadCardEffect(name).areaLimit; } catch { return undefined; }
    },
  };
}

const prepOf = (room) => room.skillTest && room.skillTest.prep;

// ── Sichten ────────────────────────────────────────────────────────

function othersView(room) {
  const prep = prepOf(room);
  return room.players.map((p, idx) => ({
    idx,
    username: p.username,
    isBot: !!p.isBot,
    persona: p.persona ? { hero: p.persona.hero } : null,
    ready: !!prep.players[idx].ready,
    connected: p.isBot || !!p.socketId,
  }));
}

function viewFor(room, idx) {
  const prep = prepOf(room);
  const st = room.skillTest;
  const base = {
    roomId: room.id,
    serverNow: Date.now(),
    deadlineAt: st.prepTimerDisabled ? null : prep.deadlineAt,
    recycleEvery: CONFIG.RECYCLE_EVERY,
    recycleGold: CONFIG.RECYCLE_GOLD,
    players: othersView(room),
  };
  if (idx == null || idx < 0) return { ...base, spectator: true };
  const ps = prep.players[idx];
  return {
    ...base,
    you: idx,
    me: ps,
    required: Rules.requiredHeroes(ps),
    readyProblem: Rules.readyProblem(ps),
    gold: ps.recycled * CONFIG.RECYCLE_GOLD,
  };
}

function seatOf(room, userId) { return room.players.findIndex(p => p.userId === userId && !p.isBot); }

function sendTo(room, host, socketId, event, payload) {
  if (socketId) host.io.to(socketId).emit(event, payload);
}

function broadcast(room, host, extra) {
  const prep = prepOf(room);
  if (!prep) return;
  room.players.forEach((p, idx) => {
    if (!p.isBot) sendTo(room, host, p.socketId, 'st_prep_state', { ...viewFor(room, idx), ...(idx === (extra && extra.only) ? extra : {}) });
  });
  for (const s of room.spectators) sendTo(room, host, s.socketId, 'st_prep_state', viewFor(room, null));
}

// ── Start ──────────────────────────────────────────────────────────

async function start(room, host) {
  const env = rulesEnv();
  const pool = new CardPool(env.cards);
  const players = room.players.map(() => {
    const ps = Rules.emptyPlayer();
    ps.hand = dealHand(pool).hand;
    return ps;
  });
  const st = room.skillTest;
  const prep = {
    pool, players, startedAt: Date.now(), deadlineAt: null,
    timer: null, autoTimers: {}, done: false,
  };
  st.prep = prep;

  // CPU-Sitze bauen sofort und sind bereit.
  room.players.forEach((p, idx) => {
    if (p.isBot) players[idx] = botPrep(room, idx, env);
    else host.activeGames.set(p.userId, room.id);
  });

  if (!st.prepTimerDisabled) {
    prep.deadlineAt = Date.now() + st.prepTimerSec * 1000;
    prep.timer = setTimeout(() => onDeadline(room, host), st.prepTimerSec * 1000);
  }
  console.log(`[skilltest] Raum ${room.id}: Vorbereitung (${room.players.length} Spieler, Pool ${pool.remaining()} Karten übrig)`);
  broadcast(room, host);
  checkAllReady(room, host);
}

/** Hook für den Bot (bot.js ersetzt/ergänzt die Standardlogik). */
function botPrep(room, idx, env) {
  const prep = prepOf(room);
  let ps = prep.players[idx];
  try {
    const { prepareBase } = require('./bot');
    if (typeof prepareBase === 'function') {
      return prepareBase({ env, ps, room, idx, pool: prep.pool, rules: Rules, config: CONFIG });
    }
  } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') console.error('[skilltest] bot prepareBase', e); }
  return autoBuild(env, ps);
}

// ── Aktionen der Spieler ───────────────────────────────────────────

function handleMove(room, idx, move, host) {
  const prep = prepOf(room);
  if (!prep || prep.done) return;
  const env = rulesEnv();
  const ps = prep.players[idx];
  const res = Rules.applyMove(env, ps, move);
  if (!res.ok) {
    const p = room.players[idx];
    sendTo(room, host, p.socketId, 'st_prep_error', { reason: res.reason });
    sendTo(room, host, p.socketId, 'st_prep_state', viewFor(room, idx));
    return;
  }
  const next = res.ps;
  let ejected = null;
  if (move.type === 'recycle') {
    // Jede RECYCLE_EVERY-te Karte löst einen Auswurf aus einer zufälligen, nie gesehenen Karte aus.
    if (next.recycled % CONFIG.RECYCLE_EVERY === 0) {
      ejected = prep.pool.takeAny(CONFIG.RECYCLER_TYPE_WEIGHTS);
      if (ejected) next.hand.push(ejected);
    }
  }
  prep.players[idx] = next;
  const p = room.players[idx];
  sendTo(room, host, p.socketId, 'st_prep_state', {
    ...viewFor(room, idx),
    event: move.type === 'recycle' ? { type: 'recycle', card: res.recycledCard, ejected } : null,
  });
}

function handleReady(room, idx, ready, host) {
  const prep = prepOf(room);
  if (!prep || prep.done) return;
  const ps = prep.players[idx];
  const p = room.players[idx];
  if (ready) {
    const problem = Rules.readyProblem(ps);
    if (problem) { sendTo(room, host, p.socketId, 'st_prep_error', { reason: problem }); return; }
  }
  ps.ready = !!ready;
  broadcast(room, host);
  if (ps.ready) checkAllReady(room, host);
}

function checkAllReady(room, host) {
  const prep = prepOf(room);
  if (!prep || prep.done) return;
  if (prep.players.every(p => p.ready)) finishPrep(room, host, 'alle bereit');
}

/** Timer abgelaufen: wer noch nicht bereit ist, wird aufgefüllt und bereit gesetzt. */
function onDeadline(room, host) {
  const prep = prepOf(room);
  if (!prep || prep.done) return;
  forceReadyAll(room, host);
}

function forceReady(room, idx) {
  const prep = prepOf(room);
  const env = rulesEnv();
  let ps = prep.players[idx];
  if (ps.ready) return;
  ps = autoFillHeroes(env, Rules.clone(ps));
  ps.ready = Rules.boardFull(ps); // ohne genug Heroes in der Gesamtmenge bliebe es sonst offen
  prep.players[idx] = ps;
}

function forceReadyAll(room, host) {
  const prep = prepOf(room);
  room.players.forEach((_, idx) => forceReady(room, idx));
  broadcast(room, host);
  finishPrep(room, host, 'Timer');
}

function finishPrep(room, host, why) {
  const prep = prepOf(room);
  if (!prep || prep.done) return;
  // Nicht bereite Reste (z. B. Heroes fehlen unerreichbar) nicht blockieren lassen.
  prep.done = true;
  if (prep.timer) clearTimeout(prep.timer);
  for (const t of Object.values(prep.autoTimers)) clearTimeout(t);
  console.log(`[skilltest] Raum ${room.id}: Vorbereitung beendet (${why})`);
  const battle = require('./battle');
  Promise.resolve(battle.start(room, host, prep)).catch(err => console.error('[skilltest] battle.start failed:', err));
}

// ── Verbindung ─────────────────────────────────────────────────────

/** Ein Mensch ist weg: nach einer Karenzzeit wird er automatisch bereit gesetzt. */
function onSeatLeft(room, seat, host) {
  const prep = prepOf(room);
  if (!prep || prep.done || seat < 0) return;
  if (prep.autoTimers[seat]) clearTimeout(prep.autoTimers[seat]);
  prep.autoTimers[seat] = setTimeout(() => {
    if (prep.done) return;
    forceReady(room, seat);
    broadcast(room, host);
    checkAllReady(room, host);
  }, DISCONNECT_AUTOREADY_MS);
  broadcast(room, host);
}

function onRejoin(room, user, socket, host) {
  const prep = prepOf(room);
  if (!prep) return;
  const seat = seatOf(room, user.userId);
  if (seat >= 0) {
    if (prep.autoTimers[seat]) { clearTimeout(prep.autoTimers[seat]); delete prep.autoTimers[seat]; }
    room.players[seat].socketId = socket.id;
  }
  if (!prep.done) {
    socket.emit('st_prep_state', viewFor(room, seat >= 0 ? seat : null));
    broadcast(room, host);
  }
}

function dispose(room) {
  const prep = prepOf(room);
  if (!prep) return;
  if (prep.timer) clearTimeout(prep.timer);
  for (const t of Object.values(prep.autoTimers)) clearTimeout(t);
}

// ── Socket-Handler ─────────────────────────────────────────────────

function registerHandlers(socket, deps) {
  const { rooms, getUser, host } = deps;
  const ctx = (roomId) => {
    const user = getUser();
    if (!user) return null;
    const room = rooms.get(roomId);
    if (!room || !room.skillTest || room.skillTest.phase !== 'prep') return null;
    return { user, room, idx: seatOf(room, user.userId) };
  };
  socket.on('st_prep_sync', ({ roomId } = {}) => {
    const c = ctx(roomId); if (!c) return;
    socket.emit('st_prep_state', viewFor(c.room, c.idx >= 0 ? c.idx : null));
  });
  socket.on('st_prep_move', ({ roomId, move } = {}) => {
    const c = ctx(roomId); if (!c || c.idx < 0) return;
    handleMove(c.room, c.idx, move, host);
  });
  socket.on('st_prep_ready', ({ roomId, ready } = {}) => {
    const c = ctx(roomId); if (!c || c.idx < 0) return;
    handleReady(c.room, c.idx, ready, host);
  });
}

module.exports = {
  start, handleMove, handleReady, onSeatLeft, onRejoin, dispose, registerHandlers,
  viewFor, forceReadyAll, rulesEnv,
};
