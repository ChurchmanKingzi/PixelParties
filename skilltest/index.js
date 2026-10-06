'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — SERVER-EINSTIEG
//
//  Lobby/Raum-Verwaltung des Modus. server.js bleibt bewusst dünn: es
//  ruft nur die hier exportierten Funktionen auf (siehe die mit
//  `skillTest.` beginnenden Stellen). Die Spielphasen selbst leben in
//  den Geschwistermodulen:
//
//    config.js   Regel-/Balance-Konstanten
//    pool.js     Kartenpool, Handgenerierung, Recycler-Ausgabe
//    prep.js     Vorbereitungsphase (Basis, Recycler, Ready)
//
//  `room.skillTest` ist das Gegenstück zu `room.cubeDraft`: sein
//  Vorhandensein markiert den Raum als Skill-Test-Raum.
// ═══════════════════════════════════════════════════════════════════

const { CONFIG } = require('./config');
const { getCardDB } = require('../cards/effects/_card-db');

const PHASES = ['lobby', 'prep', 'battle', 'over'];

function clampInt(v, [lo, hi], def) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

/** Aus den Rohwerten des Raum-Dialogs die Raum-Konfiguration bauen. */
function buildRoomConfig(raw) {
  raw = raw || {};
  return {
    phase: 'lobby',
    prepTimerDisabled: !!raw.prepTimerDisabled,
    prepTimerSec: clampInt(raw.prepTimerSec, CONFIG.PREP_TIMER_RANGE, CONFIG.DEFAULT_PREP_TIMER_SEC),
    turnTimerDisabled: !!raw.turnTimerDisabled,
    turnTimerSec: clampInt(raw.turnTimerSec, CONFIG.TURN_TIMER_RANGE, CONFIG.DEFAULT_TURN_TIMER_SEC),
  };
}

function isSkillTestRoom(room) { return !!(room && room.skillTest); }
function isLobbyPhase(room) { return !!(room && room.skillTest && room.skillTest.phase === 'lobby'); }

/** Kurzfassung für Raumliste und Lobby (nie Spielinterna). */
function summary(room) {
  const st = room.skillTest;
  if (!st) return null;
  return {
    phase: st.phase,
    prepTimerDisabled: !!st.prepTimerDisabled,
    prepTimerSec: st.prepTimerSec,
    turnTimerDisabled: !!st.turnTimerDisabled,
    turnTimerSec: st.turnTimerSec,
  };
}

/** Sitzliste für die Lobby (inkl. CPU-Personas). */
function seatsOf(room) {
  const cap = room.maxPlayers || CONFIG.MAX_PLAYERS;
  return Array.from({ length: cap }, (_, i) => {
    const p = room.players[i];
    if (!p) return null;
    return {
      username: p.username,
      isBot: !!p.isBot,
      isHost: p.username === room.host,
      persona: p.persona ? { hero: p.persona.hero } : null,
    };
  });
}

// ── CPU-Sitze ──────────────────────────────────────────────────────

/** Alle Hero-Namen, die als CPU-Persona taugen (reiner Flavor). */
function personaHeroNames() {
  const db = getCardDB();
  return Object.values(db).filter(c => c.cardType === 'Hero').map(c => c.name);
}

function pickPersona(room) {
  const taken = new Set(room.players.map(p => p.username));
  const free = personaHeroNames().filter(n => !taken.has(n));
  if (!free.length) return null;
  return free[Math.floor(Math.random() * free.length)];
}

let _cpuSeq = 0;
function makeCpuSeat(room) {
  const hero = pickPersona(room);
  if (!hero) return null;
  return {
    username: hero,
    userId: `cpu-st:${room.id}:${++_cpuSeq}`,
    socketId: null,
    deckId: null,
    isBot: true,
    persona: { hero },
  };
}

// ── Socket-Handler der Lobby ───────────────────────────────────────

/**
 * Registriert die Lobby-Ereignisse. `deps`:
 *   io, rooms, getUser(), sanitizeRoom, getRoomList, startPrep(room)
 */
function registerLobbyHandlers(socket, deps) {
  const { io, rooms, getUser, sanitizeRoom, getRoomList } = deps;

  const hostRoom = (roomId) => {
    const user = getUser();
    if (!user) return null;
    const room = rooms.get(roomId);
    if (!room || !isLobbyPhase(room) || room.hostId !== user.userId) return null;
    return room;
  };
  const broadcast = (room) => {
    io.to('room:' + room.id).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  };

  // Host fügt einen CPU-Sitz hinzu (online wie lokal gleichermaßen).
  socket.on('st_add_cpu', ({ roomId }) => {
    const room = hostRoom(roomId);
    if (!room) return;
    if (room.players.length >= (room.maxPlayers || CONFIG.MAX_PLAYERS)) return socket.emit('join_error', 'Alle Sitze sind belegt.');
    const seat = makeCpuSeat(room);
    if (!seat) return;
    room.players.push(seat);
    broadcast(room);
  });

  // Host entfernt einen CPU-Sitz (Menschen werden nicht gekickt).
  socket.on('st_remove_cpu', ({ roomId, username }) => {
    const room = hostRoom(roomId);
    if (!room) return;
    const idx = room.players.findIndex(p => p.isBot && p.username === username);
    if (idx < 0) return;
    room.players.splice(idx, 1);
    broadcast(room);
  });

  // Host startet: ab 2 Sitzen (Menschen + CPUs), danach beginnt die Vorbereitung.
  socket.on('st_start', async ({ roomId }) => {
    const room = hostRoom(roomId);
    if (!room) return;
    if (room.players.length < CONFIG.MIN_PLAYERS) return socket.emit('join_error', 'Mindestens 2 Spieler nötig.');
    room.skillTest.phase = 'prep';
    room.status = 'playing';
    broadcast(room);
    try {
      await deps.startPrep(room);
    } catch (err) {
      console.error('[skilltest] startPrep failed:', err);
      io.to('room:' + room.id).emit('join_error', 'Skill Test konnte nicht gestartet werden.');
    }
  });

  // Vorbereitungsphase (Platzieren, Recyceln, Ready).
  require('./prep').registerHandlers(socket, { rooms, getUser, host: deps.host });

  // Kampf: Basisangriff per Hero-Klick und „Round beenden".
  const seatCtx = (roomId) => {
    const user = getUser();
    const room = user && rooms.get(roomId);
    if (!room || !room.skillTest || !room.gameState || !room.gameState.skillTest) return null;
    const seat = room.gameState.players.findIndex(p => p.userId === user.userId);
    return seat < 0 ? null : { room, seat };
  };
  socket.on('st_attack', ({ roomId, heroIdx } = {}) => {
    const c = seatCtx(roomId); if (!c) return;
    require('./rounds').playBaseAttack(c.room, c.seat, heroIdx, deps.host)
      .catch(err => console.error('[skilltest] st_attack:', err && err.message));
  });
  socket.on('st_pass_round', ({ roomId } = {}) => {
    const c = seatCtx(roomId); if (!c) return;
    require('./rounds').passRound(c.room, c.seat, deps.host)
      .catch(err => console.error('[skilltest] st_pass_round:', err && err.message));
  });
}

// ── Vorbereitung / Sitzverlust (Platzhalter bis prep.js steht) ─────

async function startPrep(room, host) {
  const prep = require('./prep');
  return prep.start(room, host);
}

/** Spielereignisse, vor denen die Phase eingestellt wird (alle Handler mit Aktions-/Effektcharakter). */
const GAMEPLAY_EVENTS = new Set([
  'play_spell', 'play_creature', 'activate_ability', 'activate_hero_effect', 'activate_creature_effect', 'activate_area_effect',
  'play_artifact', 'use_potion', 'confirm_potion', 'use_artifact_effect', 'activate_free_ability', 'activate_equip_effect',
  'activate_discard_effect', 'activate_permanent', 'play_surprise', 'play_ability', 'summon_ushabti',
  'play_from_coolness_stack', 'activate_hand_card', 'trigger_treacherous_crystal', 'ascend_hero',
]);
const isGameplayEvent = (e) => GAMEPLAY_EVENTS.has(e);
function setPhaseFor(room, pi, event, params) { return require('./rounds').setPhaseFor(room, pi, event, params); }

/** Öffentlicher Skill-Test-Zustand für die Clients (nur Sichtbares). */
function publicState(gs) {
  const st = gs && gs.skillTest;
  if (!st) return null;
  return {
    round: st.round, order: st.order, starter: st.starter, turnSeat: st.turnSeat,
    exhaustedHeroes: st.exhaustedHeroes, exhaustedCreatures: st.exhaustedCreatures, passed: st.passed,
    eliminated: st.eliminated, botSeats: st.botSeats, phase: st.phase,
    turnDeadline: st.turnDeadline || null, turnTimerSec: st.turnTimerSec || 0, serverNow: Date.now(),
    busy: !!st.busy,
  };
}

/** Zugwächter (siehe rounds.act). */
function act(room, pi, kind, params, fn, host) { return require('./rounds').act(room, pi, kind, params, fn, host); }

/** Einen Bot-Zug mit kurzer Denkpause einplanen. */
function scheduleBotTurn(room, seat, host, opts = {}) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result) return;
  const delay = opts.forced ? 50 : (opts.delayMs ?? 700);
  setTimeout(() => {
    if (!room.gameState || room.gameState.result || room.gameState.activePlayer !== seat) return;
    require('./bot').takeTurn(room, seat, host, opts).catch(err => console.error('[skilltest] Bot-Zug:', err && err.stack || err));
  }, delay);
}

/** Wiederverbinden (auth/join_room): Sicht der aktuellen Phase erneut senden. */
function onRejoin(room, user, socket, host) {
  if (!room.skillTest) return;
  if (room.skillTest.phase === 'prep') require('./prep').onRejoin(room, user, socket, host);
}

/** Ein Mensch hat nach der Lobby die Verbindung/den Raum verlassen. */
function onSeatLeft(room, user, socket, host) {
  const seat = room.players.findIndex(p => p.userId === user.userId && !p.isBot);
  if (seat >= 0) {
    if (room.players[seat].socketId === socket.id) room.players[seat].socketId = null;
  } else {
    room.spectators = room.spectators.filter(s => s.username !== user.username);
  }
  try { require('./prep').onSeatLeft?.(room, seat, host); } catch (e) { console.error('[skilltest] onSeatLeft', e); }
  // Kein Mensch mehr online: Raum nach einer Karenzzeit aufräumen.
  if (!room.players.some(p => !p.isBot && p.socketId) && !room._verlassenTimer) {
    room._verlassenTimer = setTimeout(() => {
      const r = host.rooms.get(room.id);
      if (!r) return;
      delete r._verlassenTimer;
      if (!r.players.some(p => !p.isBot && p.socketId)) {
        try { require('./prep').dispose?.(r); } catch { /* egal */ }
        host.destroyRoom(room.id);
        host.io.emit('rooms', host.getRoomList());
      }
    }, 10 * 60 * 1000);
  }
}

module.exports = {
  PHASES, startPrep, onSeatLeft, onRejoin, act, scheduleBotTurn, isGameplayEvent, setPhaseFor, publicState,
  buildRoomConfig, isSkillTestRoom, isLobbyPhase, summary, seatsOf,
  makeCpuSeat, registerLobbyHandlers,
};
