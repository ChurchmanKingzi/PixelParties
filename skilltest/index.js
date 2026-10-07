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

const PHASES = ['lobby', 'prep', 'battle', 'over'];

function clampInt(v, [lo, hi], def) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

/** Ein Timer-Feld des Raum-Dialogs: `0` (oder die ältere Flagge `…Disabled`) heißt „aus", sonst Sekunden innerhalb der Grenzen. */
function timerOption(rawSec, rawDisabled, range, def) {
  const n = parseInt(rawSec, 10);
  const off = !!rawDisabled || (Number.isFinite(n) && n <= 0);
  return { disabled: off, sec: clampInt(off ? def : rawSec, range, def) };
}

/** Aus den Rohwerten des Raum-Dialogs die Raum-Konfiguration bauen. */
function buildRoomConfig(raw) {
  raw = raw || {};
  const prep = timerOption(raw.prepTimerSec, raw.prepTimerDisabled, CONFIG.PREP_TIMER_RANGE, CONFIG.DEFAULT_PREP_TIMER_SEC);
  const turn = timerOption(raw.turnTimerSec, raw.turnTimerDisabled, CONFIG.TURN_TIMER_RANGE, CONFIG.DEFAULT_TURN_TIMER_SEC);
  return {
    phase: 'lobby',
    prepTimerDisabled: prep.disabled,
    prepTimerSec: prep.sec,
    turnTimerDisabled: turn.disabled,
    turnTimerSec: turn.sec,
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

/** Sitzliste für die Lobby. CPU-Sitze bleiben bis zum Kampfbeginn anonym (Name „CPU n“, im Client eine Fragezeichen-Kachel). */
function seatsOf(room) {
  const cap = room.maxPlayers || CONFIG.MAX_PLAYERS;
  return Array.from({ length: cap }, (_, i) => {
    const p = room.players[i];
    if (!p) return null;
    return {
      username: p.username,
      isBot: !!p.isBot,
      isHost: p.username === room.host,
    };
  });
}

// ── CPU-Sitze ──────────────────────────────────────────────────────

/** Nächster freier Anzeigename „CPU n“ im Raum. */
function nextCpuName(room) {
  const taken = new Set(room.players.map(p => p.username));
  let n = 1;
  while (taken.has('CPU ' + n)) n++;
  return 'CPU ' + n;
}

let _cpuSeq = 0;
/**
 * CPU-Sitz. Bis zum Kampfbeginn hat er KEIN Gesicht: Name „CPU n“, kein Hero. Erst wenn sein Brett steht, nimmt er
 * Namen und Aussehen seines mittleren Heroes an (battle.js `nameBots`) — vorher wüsste man nie, welcher Name zu welchem Bild gehört.
 */
function makeCpuSeat(room) {
  return {
    username: nextCpuName(room),
    userId: `cpu-st:${room.id}:${++_cpuSeq}`,
    socketId: null,
    deckId: null,
    isBot: true,
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
  socket.on('st_creature_skip', ({ roomId, heroIdx, zoneSlot, charmedOwner } = {}) => {
    const c = seatCtx(roomId); if (!c) return;
    require('./rounds').skipWithCreature(c.room, c.seat, { heroIdx, zoneSlot, charmedOwner }, deps.host)
      .catch(err => console.error('[skilltest] st_creature_skip:', err && err.message));
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
/**
 * Erschöpfte Helden, die jetzt noch eine Zusatzaktion (zweite Aktion einer Gewährung) für einen einfachen Angriff haben:
 * „Sitz:Held"-Schlüssel. Die Oberfläche lässt sie anklicken, obwohl ihre Hauptaktion verbraucht ist.
 */
function bonusHeroesOf(gs, engine) {
  const out = [];
  if (!engine || !gs.skillTest || !gs.skillTest.heroEco) return out;
  gs.players.forEach((ps, seat) => (ps.heroes || []).forEach((h, hi) => {
    const key = seat + ':' + hi;
    if (!h || !h.name || h.hp <= 0 || !gs.skillTest.exhaustedHeroes[key]) return;
    try { if (engine.findAdditionalActionForCategory(seat, 'attack', hi)) out.push(key); } catch { /* optional */ }
  }));
  return out;
}

/** Erschöpfte Kreaturen als „Brettseite:Held:Platz" (die Oberfläche kennt keine Instanznummern). */
function exhaustedSlotsOf(gs, engine) {
  const out = [];
  const ids = gs.skillTest && gs.skillTest.exhaustedCreatures;
  if (!engine || !ids) return out;
  for (const id of Object.keys(ids)) {
    const inst = engine.cardInstances.find(c => String(c.id) === String(id));
    if (!inst || inst.zone !== 'support') continue;
    let side = inst.owner;
    try { side = engine.physicalSide(inst); } catch { /* Brettseite = Besitzer */ }
    out.push(side + ':' + inst.heroIdx + ':' + inst.zoneSlot);
  }
  return out;
}

function publicState(gs, engine) {
  const st = gs && gs.skillTest;
  if (!st) return null;
  return {
    round: st.round, order: st.order, starter: st.starter, turnSeat: st.turnSeat,
    exhaustedHeroes: st.exhaustedHeroes, exhaustedCreatures: st.exhaustedCreatures, passed: st.passed,
    eliminated: st.eliminated, botSeats: st.botSeats, phase: st.phase,
    turnDeadline: st.turnDeadline || null, turnTimerSec: st.turnTimerSec || 0, serverNow: Date.now(),
    busy: !!st.busy,
    bonusHeroes: bonusHeroesOf(gs, engine),
    exhaustedSlots: exhaustedSlotsOf(gs, engine),
    watch: st.watch || null,          // Hierhin schauen (Zugbeginn, Zielwahl): die Anzeige folgt dem Geschehen
    acting: st.acting || null,        // wer gerade handelt (leuchtet auf, bis die Aktion vorbei ist)
  };
}

/** Zugwächter (siehe rounds.act). */
function act(room, pi, kind, params, fn, host) { return require('./rounds').act(room, pi, kind, params, fn, host); }

/** Einen Bot-Zug mit kurzer Denkpause einplanen. */
function scheduleBotTurn(room, seat, host, opts = {}) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result) return;
  const delay = opts.forced ? 50 : (opts.delayMs ?? parseInt(process.env.PP_ST_BOT_DELAY_MS || '700', 10));
  setTimeout(() => {
    if (!room.gameState || room.gameState.result || room.gameState.activePlayer !== seat) return;
    if (!opts.forced && !st.botSeats.includes(seat)) return;   // der Mensch ist zurück
    require('./bot').takeTurn(room, seat, host, opts).catch(err => console.error('[skilltest] Bot-Zug:', err && err.stack || err));
  }, delay);
}

/** Wiederverbinden (auth/join_room): Sicht der aktuellen Phase erneut senden. */
function onRejoin(room, user, socket, host) {
  if (!room.skillTest) return;
  if (room.gameState) {
    const seat = room.players.findIndex(p => p.userId === user.userId && !p.isBot);
    if (seat >= 0) require('./battle').seatBack(room, seat, host);
    return;
  }
  if (room.skillTest.phase === 'prep') require('./prep').onRejoin(room, user, socket, host);
}

/** Ein Mensch hat nach der Lobby die Verbindung/den Raum verlassen. */
function onSeatLeft(room, user, socket, host, opts = {}) {
  const seat = room.players.findIndex(p => p.userId === user.userId && !p.isBot);
  if (seat >= 0) {
    if (room.players[seat].socketId === socket.id) room.players[seat].socketId = null;
  } else {
    room.spectators = room.spectators.filter(s => s.username !== user.username);
  }
  try { require('./prep').onSeatLeft?.(room, seat, host); } catch (e) { console.error('[skilltest] onSeatLeft', e); }
  // Im Kampf: die CPU übernimmt den Sitz (bei Verbindungsverlust nur, bis der Mensch zurück ist).
  if (seat >= 0 && room.gameState && !room.gameState.result) {
    try { require('./battle').seatAway(room, seat, host, { permanent: !!opts.permanent }); } catch (e) { console.error('[skilltest] seatAway', e); }
  }
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

/** Raum wird abgebaut: alle Timer des Moduls anhalten. */
function dispose(room) {
  const st = room.gameState && room.gameState.skillTest;
  if (st) {
    if (st._timer) clearTimeout(st._timer);
    if (st._watch) clearInterval(st._watch);
    st._timerToken = (st._timerToken || 0) + 1;
  }
  try { require('./prep').dispose?.(room); } catch { /* egal */ }
}

module.exports = {
  dispose,
  PHASES, startPrep, onSeatLeft, onRejoin, act, scheduleBotTurn, isGameplayEvent, setPhaseFor, publicState,
  buildRoomConfig, isSkillTestRoom, isLobbyPhase, summary, seatsOf,
  makeCpuSeat, registerLobbyHandlers, surrender: (room, seat, host) => require('./battle').surrender(room, seat, host),
};
