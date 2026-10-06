'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — KAMPFSTART UND SPIELENDE
//
//  Aus den fertigen Basen der Vorbereitung wird ein echter Spielzustand
//  für N Spieler gebaut (Identitäten wie im normalen Spiel über
//  `setupGameState`, Brett aus der Vorbereitung), die Engine gestartet
//  und der Round-Treiber (rounds.js) angeworfen.
// ═══════════════════════════════════════════════════════════════════

const Rules = require('../public/skilltest-rules.js');
const { CONFIG } = require('./config');
const rounds = require('./rounds');
const ext = require('./engine-ext');
const { getCardDB } = require('../cards/effects/_card-db');

/** Startspieler: wer die meisten Karten recycelt hat; bei Gleichstand der Zufall. */
function pickStarter(prep) {
  const best = Math.max(...prep.players.map(p => p.recycled));
  const cands = prep.players.map((p, i) => ({ p, i })).filter(x => x.p.recycled === best).map(x => x.i);
  return cands[Math.floor(Math.random() * cands.length)];
}

/** Besetzte Hero-Zonen (links→rechts); nur sie gehen ins Spiel, Lücken fallen zusammen. */
function usedColumns(ps) { return [0, 1, 2].filter(hi => ps.heroes[hi]); }

/** Pseudo-Deck je Sitz, damit `setupGameState` Identität/Farbe/Avatar wie gewohnt aufbaut. */
function pseudoDeck(ps, cards) {
  return {
    mainDeck: [], potionDeck: [], sideDeck: [], skins: {},
    heroes: usedColumns(ps).map(hi => {
      const c = cards[ps.heroes[hi]] || {};
      return { hero: ps.heroes[hi], ability1: c.startingAbility1 || null, ability2: c.startingAbility2 || null };
    }),
  };
}

/** Brett der Vorbereitung in den Spielzustand schreiben (Reihenfolge der Spalten = Hero-Reihenfolge). */
function applyBoards(gs, prep, cards) {
  const stacks = prep.players.map(ps => Rules.abilityStacks(ps));
  prep.players.forEach((ps, seat) => {
    const p = gs.players[seat];
    const cols = usedColumns(ps);
    const pick3 = (arr, fill) => { const out = cols.map(hi => arr[hi]); while (out.length < 3) out.push(fill()); return out; };
    p.abilityZones = cols.map(hi => stacks[seat][hi].map(s => [...s]));
    p.supportZones = pick3(ps.supportZones, () => [[], [], []]).map(col => col.map(z => [...z]));
    p.surpriseZones = pick3(ps.surpriseZones, () => null).map(z => (z ? [z] : []));
    p.hand = [...ps.hand];
    p.mainDeck = []; p.potionDeck = []; p.sideDeck = [];
    p.gold = ps.recycled * CONFIG.RECYCLE_GOLD;
    // Heroes: Werte direkt aus der Kartendatenbank (wie setupGameState).
    p.heroes.forEach((h, j) => { const c = cards[h.name]; if (c) { h.hp = h.maxHp = c.hp || 0; h.atk = h.baseAtk = c.atk || 0; } });
    gs.areaZones[seat] = [...ps.areaZone];
  });
}

/** Zustände, die die Engine bei normal gespielten Karten selbst anlegt (aus dem Puzzle-Start übernommen). */
function applyPresetFixups(engine, cards) {
  const gs = engine.gs;
  for (const inst of engine.cardInstances) {
    if (inst.zone === 'support') {
      const cd = cards[inst.name];
      if (cd && cd.hp) { inst.counters = inst.counters || {}; inst.counters.maxHp = cd.hp; }
    }
    if (inst.zone !== 'support' || inst.heroIdx == null || inst.heroIdx < 0) continue;
    let scr = null;
    try { scr = engine._loadCardEffect ? engine._loadCardEffect(inst.name) : require('../cards/effects/_loader').loadCardEffect(inst.name); } catch { /* egal */ }
    if (!scr) continue;
    if (scr.unaffectedByOthers) { inst.counters = inst.counters || {}; inst.counters._cardinalImmune = true; }
    const statusName = scr.attachmentStatus, buffName = scr.attachmentBuff;
    if (!statusName && !buffName) continue;
    const owner = inst.controller ?? inst.owner;
    const hero = gs.players[owner] && gs.players[owner].heroes && gs.players[owner].heroes[inst.heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) continue;
    if (statusName && !(hero.statuses && hero.statuses[statusName])) {
      hero.statuses = hero.statuses || {};
      hero.statuses[statusName] = { appliedTurn: 0, permanent: true, _fromAttachment: inst.name };
    }
    if (buffName && !(hero.buffs && hero.buffs[buffName])) {
      hero.buffs = hero.buffs || {};
      hero.buffs[buffName] = { permanent: true, _fromAttachment: inst.name };
    }
  }
  if (typeof engine.syncAlleAtkAuren === 'function') engine.syncAlleAtkAuren();
  for (const ps of gs.players) {
    ps.summonLocked = false; ps.handLocked = false; ps.damageLocked = false;
    ps.dealtDamageToOpponent = false; ps.potionLocked = false; ps.oppHandLocked = false;
    ps.supportSpellLocked = false; ps.supportSpellUsedThisTurn = false;
    ps.potionsUsedThisTurn = 0; ps.attacksPlayedThisTurn = 0; ps.spellsPlayedThisTurn = 0;
    ps.comboLockHeroIdx = null; ps.heroesActedThisTurn = []; ps.heroesAttackedThisTurn = [];
    ps._creaturesSummonedThisTurn = 0; ps.bonusActions = null; ps._bonusMainActions = 0;
    ps._actionsPlayedThisPhase = 0; ps.abilityGivenThisTurn = [false, false, false];
    ps._discardNamesAtTurnStart = new Set(ps.discardPile || []);
  }
}

async function start(room, host, prep) {
  const cards = getCardDB();
  const n = room.players.length;
  const starter = pickStarter(prep);

  // 1) Identitäten & Grundzustand über das normale Setup (N-fähig), dann das Brett überschreiben.
  room._currentDecks = prep.players.map(ps => pseudoDeck(ps, cards));
  room._originalDecks = room._currentDecks.map(d => JSON.parse(JSON.stringify(d)));
  await host.setupGameState(room);
  const gs = room.gameState;
  gs.areaZones = Array.from({ length: n }, () => []);
  applyBoards(gs, prep, cards);
  gs.turn = 0; gs.activePlayer = starter; gs.currentPhase = 0;
  gs.awaitingFirstChoice = false; gs.mulliganPending = false; delete gs.mulliganDecisions;
  const st = room.skillTest;
  st.phase = 'battle';
  st.starter = starter;
  gs.skillTest = {
    phase: 'battle', round: 0, firstStarter: starter, starter, order: [], turnSeat: null,
    exhaustedHeroes: {}, exhaustedCreatures: {}, passed: {}, eliminated: [], eliminatedRound: {}, eliminatedWith: {},
    turnsTaken: {}, busy: false, botSeats: room.players.map((p, i) => (p.isBot ? i : -1)).filter(i => i >= 0),
    recycled: prep.players.map(p => p.recycled), startedAt: Date.now(),
    turnTimerSec: st.turnTimerDisabled ? 0 : st.turnTimerSec,
  };
  const skillGs = gs.skillTest;
  // CPU-Sitze spielen mit einem gelernten Spielstil (Persona aus der Liga), falls ein Profil existiert.
  try {
    const L = require('./learn/profile');
    const prof = L.get();
    skillGs.botWeights = {};
    for (const seat of skillGs.botSeats) {
      const per = L.samplePersona(prof);
      if (per) skillGs.botWeights[seat] = per.weights;
    }
  } catch (e) { console.error('[skilltest] Profil:', e && e.message); }

  // 2) Engine
  const engine = new host.GameEngine(room, host.io, host.sendGameState, (r, winnerIdx, reason) => finishGame(r, winnerIdx, reason, host), host.sendSpectatorGameState);
  room.engine = engine;
  ext.installBotSeats(engine, (pi) => skillGs.botSeats.includes(pi));
  ext.installBotBrain(engine);
  ext.installPlayerChoice(engine);
  ext.installElimination(engine);
  ext.installMeter(engine);
  ext.installTurnEnd(engine, host);
  ext.installSnapshotGuard(engine);
  engine._stOnTurn = (seat) => { if (skillGs.botSeats.includes(seat)) host.scheduleBotTurn(room, seat); armTurnTimer(room, host); };
  engine.init();
  ext.relaxRules(engine);
  applyPresetFixups(engine, cards);

  host.io.to('room:' + room.id).emit('game_started', host.sanitizeRoom(room));
  host.io.emit('rooms', host.getRoomList());

  // 3) Spielbeginn-Hooks wie im normalen Spiel: vor der Starthand, dann Spielstart.
  await engine.runHooks('onBeforeHandDraw', {});
  engine._resetTerrorTracking && engine._resetTerrorTracking();
  await engine.runHooks('onGameStart', { _skipReactionCheck: true });
  for (let pi = 0; pi < n; pi++) {
    const ps = gs.players[pi];
    for (let i = 0; i < ps.hand.length; i++) engine._autoRevealOnEnterHand && engine._autoRevealOnEnterHand(pi, i, ps.hand[i]);
  }
  try { require('../cards/effects/calm-diatribe').ensureCalmProviders(engine); } catch { /* optional */ }

  startPromptWatchdog(room, host);

  // 4) Erste Round und erster Zug
  await rounds.startRound(engine, host);
  if (!gs.result) await rounds.advance(engine, host, null);
  engine.sync();
  console.log(`[skilltest] Raum ${room.id}: Kampf beginnt (${n} Spieler, Startspieler ${room.players[starter].username})`);
}

/** Eigenschaft NICHT aufzählbar setzen: Timer-Handles dürfen nie in JSON-Kopien des Spielzustands (Kartenskripte klonen `gs`) landen. */
function hide(obj, key, value) {
  Object.defineProperty(obj, key, { value, writable: true, configurable: true, enumerable: false });
  return value;
}

// ── Turn-Timer ─────────────────────────────────────────────────────
function armTurnTimer(room, host) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st) return;
  if (st._timer) { clearTimeout(st._timer); st._timer = null; }
  if (!st.turnTimerSec || gs.result) return;
  const seat = gs.activePlayer;
  if (st.botSeats.includes(seat)) return;
  const token = (st._timerToken = (st._timerToken || 0) + 1);
  st.turnDeadline = Date.now() + st.turnTimerSec * 1000;
  hide(st, '_timer', setTimeout(() => {
    if (gs.result || st._timerToken !== token || gs.activePlayer !== seat) return;
    // Zeit abgelaufen: der Bot-Verstand übernimmt den Zug (sonst blockiert ein Spieler alle anderen).
    host.scheduleBotTurn(room, seat, { forced: true });
  }, st.turnTimerSec * 1000 + 500));
}

// ── Hängende Prompts ───────────────────────────────────────────────
// Wartet ein offener Prompt zu lange auf einen Menschen (Reaktionsfenster, Zielwahl …), blockiert er
// alle anderen. Bei aktivem Zug-Timer wird er nach Ablauf mit der Standardantwort der CPU beantwortet
// (freiwillige Prompts: ablehnen, Pflicht-Prompts: erste Option). Ohne Timer (Raum-Einstellung) wartet
// das Spiel beliebig lange.
function startPromptWatchdog(room, host) {
  const gs = room.gameState, st = gs.skillTest;
  const timed = !!st.turnTimerSec;                       // ohne Zug-Timer wartet das Spiel auf Menschen beliebig lange
  const limitMs = (timed ? Math.max(st.turnTimerSec, 45) : 120) * 1000;
  hide(st, '_watch', setInterval(() => {
    if (gs.result) return clearInterval(st._watch);
    // Letzte Sicherung: eine Aktion, die weit über das Limit hinaus hängt (aus welchem Grund auch immer),
    // wird aufgegeben, damit das Spiel weiterläuft.
    if (st.busy) {
      if (!st._busySeen || st._busySeen.token !== st.actToken) st._busySeen = { token: st.actToken, since: Date.now() };
      else if (Date.now() - st._busySeen.since > limitMs + 30000 && (timed || st.botSeats.includes(gs.activePlayer))) {
        console.warn(`[skilltest] Raum ${room.id}: Aktion von Sitz ${gs.activePlayer} aufgegeben (hängt > ${Math.round((limitMs + 30000) / 1000)} s)`);
        const seat = gs.activePlayer;
        st.actToken = (st.actToken || 0) + 1; st.busy = false; st._busySeen = null; gs.effectPrompt = null;
        require('./rounds').passRound(room, seat, host).catch(() => {});
        return;
      }
    } else st._busySeen = null;
    const ep = gs.effectPrompt;
    if (!ep) { st._promptSeen = null; return; }
    if (!st._promptSeen || st._promptSeen.id !== ep.promptId) { st._promptSeen = { id: ep.promptId, since: Date.now() }; return; }
    if (Date.now() - st._promptSeen.since < limitMs) return;
    if (!timed && !st.botSeats.includes(ep.ownerIdx)) return;   // Mensch ohne Timer: warten
    try {
      const owner = ep.ownerIdx;
      const resp = room.engine._getCpuGenericResponse(ep, owner);
      console.warn(`[skilltest] Prompt ${ep.type} von Sitz ${owner} abgelaufen — Standardantwort`);
      st._promptSeen = null;
      room.engine.resolveGenericPrompt(resp === undefined ? null : resp, ep.promptId);
    } catch (e) { console.error('[skilltest] Prompt-Watchdog:', e && e.message); }
  }, 2000));
  if (st._watch.unref) st._watch.unref();
}

// ── Spielende ──────────────────────────────────────────────────────

/** Plätze: Sieger 1., dann die Ausgeschiedenen in umgekehrter Reihenfolge (Gleichzeitige teilen sich den Platz). */
function placementsOf(gs, winnerIdx) {
  const st = gs.skillTest, n = gs.players.length;
  const place = {};
  place[winnerIdx] = 1;
  let next = 2;
  const byRound = {};
  for (const seat of st.eliminated) { if (seat === winnerIdx) continue; (byRound[st.eliminatedRound[seat]] = byRound[st.eliminatedRound[seat]] || []).push(seat); }
  // Reihenfolge der Ausscheidens-Liste ist chronologisch; gleichzeitig = gleiche Gruppe
  const order = st.eliminated.filter(s => s !== winnerIdx).reverse();
  const groups = [];
  for (const seat of order) {
    const last = groups[groups.length - 1];
    if (last && st.eliminatedRound[last[0]] === st.eliminatedRound[seat] && st.eliminatedWith[seat] > 1 && st.eliminatedWith[last[0]] === st.eliminatedWith[seat]) last.push(seat);
    else groups.push([seat]);
  }
  for (const g of groups) { for (const s of g) place[s] = next; next += g.length; }
  for (let s = 0; s < n; s++) if (place[s] == null) place[s] = n;
  return place;
}

/** SC-Bestandteile eines Sitzes (für Anzeige und Summe). */
function scParts(gs, seat, winnerIdx, place) {
  const st = gs.skillTest, n = gs.players.length;
  const survivedRounds = st.eliminatedRound[seat] != null ? st.eliminatedRound[seat] : st.round;
  const outlasted = n - place[seat];                 // so viele Spieler haben diesem Platz den Vortritt gelassen
  return {
    rounds: survivedRounds, roundsSc: survivedRounds * CONFIG.SC_PER_ROUND,
    outlasted, outlastedSc: outlasted * CONFIG.SC_PER_OUTLASTED_PLAYER,
    winSc: seat === winnerIdx ? CONFIG.SC_WIN_BONUS : 0,
  };
}

function scFor(gs, seat, winnerIdx, place) {
  const p = scParts(gs, seat, winnerIdx, place);
  return p.roundsSc + p.outlastedSc + p.winSc;
}

async function finishGame(room, winnerIdx, reason, host) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const st = gs.skillTest;
  const place = placementsOf(gs, winnerIdx);
  const sc = gs.players.map((_, seat) => scFor(gs, seat, winnerIdx, place));
  const scDetail = gs.players.map((_, seat) => scParts(gs, seat, winnerIdx, place));
  gs.result = { winnerIdx, reason, skillTest: { rounds: st.round, placements: place, sc, scDetail } };
  st.phase = 'over'; room.skillTest.phase = 'over';
  if (st._timer) clearTimeout(st._timer);
  if (st._watch) clearInterval(st._watch);
  if (room.engine) { room.engine._aborted = false; }
  console.log(`[skilltest] Raum ${room.id}: Ende nach ${st.round} Rounds, Sieger ${gs.players[winnerIdx].username} (${reason})`);
  // SC an Menschen (Spieler-Vorgabe 6.10.): 1/Round + 5 je überlebtem Gegner + 5 für den Sieg.
  for (let seat = 0; seat < room.players.length; seat++) {
    const p = room.players[seat];
    if (p.isBot || !p.userId || !sc[seat]) continue;
    try { await host.db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [sc[seat], p.userId]); }
    catch (e) { console.error('[skilltest] SC-Vergabe fehlgeschlagen:', e.message); }
  }
  for (let i = 0; i < gs.players.length; i++) host.sendGameState(room, i);
  host.sendSpectatorGameState(room);
  host.io.to('room:' + room.id).emit('st_game_over', { winnerIdx, reason, placements: place, sc, rounds: st.round });
  for (const p of room.players) host.activeGames.delete(p.userId);
  host.io.to('room:' + room.id).emit('room_update', host.sanitizeRoom(room));
  host.io.emit('rooms', host.getRoomList());
}

// ── Sitzwechsel im Kampf ───────────────────────────────────────────

/** Einen hängenden Prompt des Sitzes mit der CPU-Standardantwort auflösen. */
function answerPromptAsCpu(room, seat) {
  const gs = room.gameState, ep = gs && gs.effectPrompt;
  if (!ep || ep.ownerIdx !== seat || !room.engine) return;
  try {
    const resp = room.engine._getCpuGenericResponse(ep, seat);
    gs.skillTest._promptSeen = null;
    room.engine.resolveGenericPrompt(resp === undefined ? null : resp, ep.promptId);
  } catch (e) { console.error('[skilltest] Prompt-Übernahme:', e && e.message); }
}

/** Mensch weg (Verbindung weg / verlassen): die CPU übernimmt den Sitz. `permanent`: kommt nicht zurück. */
function seatAway(room, seat, host, { permanent = false } = {}) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result || seat < 0 || !gs.players[seat]) return;
  if (!st.botSeats.includes(seat)) st.botSeats.push(seat);
  gs.players[seat].disconnected = true;
  if (permanent) {
    gs.players[seat].left = true;
    const uid = room.players[seat] && room.players[seat].userId;
    if (uid) host.activeGames.delete(uid);
  }
  answerPromptAsCpu(room, seat);
  if (gs.activePlayer === seat && !st.busy) host.scheduleBotTurn(room, seat, { forced: true });
  if (room.engine) room.engine.sync();
}

/** Mensch zurück: er spielt wieder selbst (außer er hat den Raum endgültig verlassen). */
function seatBack(room, seat, host) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result || seat < 0 || !gs.players[seat]) return;
  if (room.players[seat].isBot || gs.players[seat].left) return;
  st.botSeats = st.botSeats.filter(s => s !== seat);
  gs.players[seat].disconnected = false;
  if (gs.activePlayer === seat) armTurnTimer(room, host);
  if (room.engine) room.engine.sync();
}

/** Aufgeben: der Sitz scheidet sofort aus (Helden fallen, Creatures handeln nicht mehr). */
async function surrender(room, seat, host) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result || !gs.players[seat] || st.eliminated.includes(seat)) return;
  (st.surrendered = st.surrendered || []).push(seat);
  for (const h of gs.players[seat].heroes || []) if (h && h.name) h.hp = 0;
  room.engine.log('skilltest_surrender', { seat, name: gs.players[seat].username });
  answerPromptAsCpu(room, seat);
  await room.engine.checkAllHeroesDead();
  if (gs.result) return;
  if (gs.activePlayer === seat && !st.busy) await rounds.passRound(room, seat, host);
  else room.engine.sync();
}

module.exports = { start, pickStarter, finishGame, placementsOf, armTurnTimer, seatAway, seatBack, surrender };
