'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — ROUNDS & TURNS
//
//  Ein Spiel besteht aus ROUNDS. In jeder Round sind die Spieler reihum
//  dran; ein Turn ist GENAU EINE Aktion mit EINEM Akteur (Hero oder
//  Creature mit aktivem Effekt). Danach geht es zum nächsten Spieler,
//  der noch einen Akteur hat. Die Round endet, wenn niemand mehr agieren
//  kann; dann werden alle Akteure wieder frisch.
//
//  Reihenfolge: fest nach Sitzen, aber wer zuerst dran ist, rotiert
//  rückwärts (A-B-C-D → D-A-B-C → C-D-A-B …). Runde 1 beginnt der
//  Spieler mit den meisten recycelten Karten.
//
//  Der Treiber sitzt NEBEN der Engine: `startGame`/`startTurn`/
//  `switchTurn` werden nie aufgerufen; stattdessen ruft er die
//  Einzelteile der Engine selbst (siehe engine._stReset…/_stRun…).
//  `gs.turn` ist die ROUND-Nummer — dadurch gilt jedes „einmal pro Turn"
//  der Karten automatisch „einmal pro Round".
//
//  Zustand (JSON-sicher) in `gs.skillTest`:
//    round, starter, order[], exhaustedHeroes{ "seat:hi": true },
//    exhaustedCreatures{ instId: true }, passed{ seat: true },
//    eliminated[], placements, startedAt …
// ═══════════════════════════════════════════════════════════════════

const { CONFIG } = require('./config');

const PHASE_RESOURCE = 1;
const PHASE_ACTION = 3;

const stOf = (engine) => engine.gs.skillTest;
const seatCount = (engine) => engine.gs.players.length;

// ── Reihenfolge ────────────────────────────────────────────────────
function roundOrder(n, starter) { return Array.from({ length: n }, (_, k) => (starter + k) % n); }
/** Nächster Rundenbeginner: eine Position zurück (A-B-C-D → D-A-B-C). */
function nextStarter(n, prev) { return (prev - 1 + n) % n; }

// ── Akteure ────────────────────────────────────────────────────────
const heroKey = (seat, hi) => seat + ':' + hi;
const heroAlive = (h) => !!(h && h.name && h.hp > 0);

/** Lebende, nicht erschöpfte Heroes dieses Sitzes, die handeln können. */
function heroActors(engine, seat) {
  const st = stOf(engine);
  const ps = engine.gs.players[seat];
  const out = [];
  (ps.heroes || []).forEach((h, hi) => {
    if (!heroAlive(h) || st.exhaustedHeroes[heroKey(seat, hi)]) return;
    if (engine.canHeroPerformAction && !engine.canHeroPerformAction(seat, hi)) return;
    if (isIncapacitated(h)) return;
    out.push(hi);
  });
  return out;
}

/** Zustände, in denen ein Hero keine Aktion ausführen kann. */
function isIncapacitated(h) {
  const s = h.statuses || {};
  return !!(s.frozen || s.stunned || s.webbed || s.bound);
}

/** Creatures mit aktivem Effekt, die jetzt (für diesen Sitz) aktivierbar sind. */
function creatureActors(engine, seat) {
  const st = stOf(engine);
  if ((st.surrendered || []).includes(seat)) return [];   // wer aufgegeben hat, handelt nicht mehr
  let list = [];
  try { list = engine.getActivatableCreatures(seat) || []; } catch (e) { list = []; }
  return list.filter(c => !st.exhaustedCreatures[c.instId ?? c.id]);
}

/**
 * Hat dieser Sitz noch einen Akteur? Die Creature-Liste setzt voraus, dass der Sitz
 * gerade `activePlayer` ist — der Aufrufer stellt das sicher.
 */
function hasActor(engine, seat) {
  return heroActors(engine, seat).length > 0 || creatureActors(engine, seat).length > 0;
}

function withActive(engine, seat, fn) {
  const gs = engine.gs;
  const prev = gs.activePlayer;
  gs.activePlayer = seat;
  try { return fn(); } finally { gs.activePlayer = prev; }
}

function seatHasActor(engine, seat) {
  return !stOf(engine).passed[seat] && withActive(engine, seat, () => hasActor(engine, seat));
}

// ── Eliminierung ───────────────────────────────────────────────────
function seatAlive(engine, seat) {
  return (engine.gs.players[seat].heroes || []).some(heroAlive);
}
function livingSeats(engine) {
  return engine.gs.players.map((_, i) => i).filter(i => seatAlive(engine, i));
}

// ── Round-Ablauf ───────────────────────────────────────────────────

/** Neue Round beginnen: Zähler, Akteure frisch, Zugbeginn-Effekte je Sitz (in Round-Reihenfolge). */
async function startRound(engine, host) {
  const gs = engine.gs, st = stOf(engine), n = seatCount(engine);
  st.round += 1;
  gs.turn = st.round;
  st.starter = st.round === 1 ? st.firstStarter : nextStarter(n, st.starter);
  st.order = roundOrder(n, st.starter);
  st.exhaustedHeroes = {};
  st.exhaustedCreatures = {};
  st.passed = {};
  st.heroEco = {};            // je Held und Round: Aktionszähler (siehe ecoEnter) — Zusatzaktionen gelten pro Round und pro Held
  st.actionPhaseOpen = {};    // Sitze, deren Action Phase in dieser Round schon begonnen hat (Phasenbeginn-Effekte nur einmal je Round)
  engine.log && engine.log('skilltest_round', { round: st.round, order: st.order });

  // `startTurn` setzt (im Skill-Test) alle Per-Turn-Zähler zurück, tickt Status-Schaden des
  // aktiven Spielers und feuert ON_TURN_START — ohne Resource-/Main-/Action-Kette.
  if (st.round === 1) {
    // Spielbeginn: Karten, die jetzt eine Wahl brauchen (Golden Abomination: welcher Gegner wird bestohlen), fragen hier —
    // vor allen Zügen und vor dem Start-Gold-Tick.
    gs.activePlayer = st.order[0];
    try { await engine.runHooks('onSkillTestStart', { _skipReactionCheck: true }); } catch (e) { console.error('[skilltest] onSkillTestStart:', e && e.message); }
  }
  for (const seat of st.order) {
    if (gs.result) return;
    gs.activePlayer = seat;
    await engine.startTurn();
    if (st.round === 1 && CONFIG.START_GOLD_TICK) {
      // Resource-Tick am Spielbeginn (+4 plus Boni wie Wealth/Semi) — nur Round 1. Er läuft in der Resource Phase des
      // Sitzes (Karten wie The Golden Abomination lenken Gold nur dort um).
      gs.currentPhase = PHASE_RESOURCE;
      try { await engine.actionGainGold(seat, CONFIG.START_GOLD_TICK, { _isResourceGain: true }); }
      finally { gs.currentPhase = PHASE_ACTION; }
    }
  }
}

/** Round beenden: Zugende-Abwicklung je Sitz (Status-Ablauf, ON_TURN_END …) ohne Spielerwechsel. */
async function endRound(engine) {
  const gs = engine.gs, st = stOf(engine);
  const { HOOKS } = require('../cards/effects/_hooks');
  const origSwitch = Object.getPrototypeOf(engine).switchTurn;
  for (const seat of st.order) {
    if (gs.result) return;
    gs.activePlayer = seat;
    try {
      if (st.actionPhaseOpen && st.actionPhaseOpen[seat]) {
        // Ende der Action Phase dieses Sitzes: Zusatzaktions-Gewährungen verfallen, Marken werden geräumt.
        await engine.runHooks(HOOKS.ON_PHASE_END, { phase: 'Action Phase', phaseIndex: 3 });
        st.actionPhaseOpen[seat] = false;
      }
      await engine.processStatusExpiry('END');
      await engine.runHooks(HOOKS.ON_PHASE_END, { phase: 'End Phase', phaseIndex: 5 });
      if (engine._flushSurpriseDrawChecks) await engine._flushSurpriseDrawChecks();
      await engine._processForceKills();
      if (engine._handStufenZaehler) await engine._handStufenZaehler(seat);
      engine._turnEndHooksDoneForTurn = null;          // sonst überspringt der Wächter alle Sitze nach dem ersten
      await origSwitch.call(engine);                   // ON_TURN_END usw.; kehrt im Skill Test vor dem Wechsel zurück
    } catch (e) { console.error('[skilltest] Rundenende (Sitz ' + seat + '):', e && e.message); }
  }
}

/** Den nächsten Sitz bestimmen, der noch einen Akteur hat (nach `afterSeat` in der Round-Reihenfolge). */
function pickNextSeat(engine, afterSeat) {
  const st = stOf(engine), order = st.order;
  const startPos = afterSeat == null ? 0 : (order.indexOf(afterSeat) + 1);
  for (let k = 0; k < order.length; k++) {
    const seat = order[(startPos + k) % order.length];
    if (seatHasActor(engine, seat)) return seat;
  }
  return null;
}

/** Den Zug des Sitzes eröffnen (Per-Turn-Flags, Aktionsphase). */
async function beginTurn(engine, seat) {
  const gs = engine.gs, st = stOf(engine);
  gs.activePlayer = seat;
  gs.currentPhase = PHASE_ACTION;
  if (gs.stFocus) delete gs.stFocus[seat];      // der Fokus-Gegner gilt nur für den einen Zug
  st.turnSeat = seat;
  st.turnStartedAt = Date.now();
  const ps = gs.players[seat];
  ps.heroesActedThisTurn = actedHeroesOf(st, seat);   // Round-Stand: wer in dieser Round schon gehandelt hat
  ps._actionsPlayedThisPhase = 0;                      // neutral; im Zug zählt der Held (ecoEnter)
  // Was im Normalspiel „pro Turn" ist, gilt hier pro Round: der Beginn der Action Phase (Phasenbeginn-Effekte,
  // Reaktionsfenster „wenn die Action Phase des Gegners beginnt", Zusatzaktions-Vergabe) läuft nur beim
  // ERSTEN Zug des Sitzes in dieser Round; spätere Züge derselben Round sind weitere Aktionen derselben Action Phase.
  if (!st.actionPhaseOpen[seat]) {
    st.actionPhaseOpen[seat] = true;
    ps.bonusActions = null;
    ps._bonusMainActions = 0;
    ps.comboLockHeroIdx = null;
    if (ps.comboLockHeroOwner !== undefined) delete ps.comboLockHeroOwner;
    try { await engine.runPhase(PHASE_ACTION); } catch (e) { console.error('[skilltest] runPhase(ACTION):', e.message); }
  }
  gs.currentPhase = PHASE_ACTION;
  try { gs.unactivatableArtifacts = engine.getUnactivatableArtifacts(seat); } catch { /* optional */ }
  if (typeof engine._stOnTurn === 'function') engine._stOnTurn(seat);
}

/**
 * Nach einem Zug (oder zu Beginn): zum nächsten Sitz weiterschalten, ggf. Round beenden und
 * eine neue starten. Gibt zurück, ob das Spiel weiterläuft.
 */
async function advance(engine, host, afterSeat) {
  const gs = engine.gs, st = stOf(engine);
  for (let guard = 0; guard < 200; guard++) {
    if (gs.result) return false;
    const seat = pickNextSeat(engine, afterSeat);
    if (seat != null) { await beginTurn(engine, seat); engine.sync(); return true; }
    // Niemand kann mehr agieren → Round vorbei.
    await endRound(engine);
    if (gs.result) return false;
    // Ist überhaupt noch jemand im Rennen, der in der nächsten Round handeln könnte?
    await startRound(engine, host);
    afterSeat = null;
    if (gs.result) return false;
    // Falls auch in der frischen Round niemand handeln kann (alle Sitze ohne Akteure), abbrechen.
    if (!st.order.some(s => seatHasActor(engine, s))) {
      if (!gs.result) engine.onGameOver(engine.room, resolveStalemateWinner(engine), 'no_actors');
      return false;
    }
  }
  return false;
}

/** Niemand kann mehr handeln: wer die meisten lebenden Heroes/HP hat, gewinnt. */
function resolveStalemateWinner(engine) {
  const living = livingSeats(engine);
  if (living.length === 1) return living[0];
  let best = -1, bestHp = -1;
  for (const s of living) {
    const hp = engine.gs.players[s].heroes.reduce((a, h) => a + (heroAlive(h) ? h.hp : 0), 0);
    if (hp > bestHp) { bestHp = hp; best = s; }
  }
  return best;
}

// ═══════════════════════════════════════════════════════════════════
//  PHASE JE EREIGNIS
//
//  Die Engine kennt Main Phase (freie Effekte) und Action Phase (Haupt-Aktion);
//  die Kartenskripte sind auf diese Trennung geschrieben. Im Skill Test gibt es
//  keine Phasenwechsel durch den Spieler — der Server stellt stattdessen vor
//  JEDEM Ereignis die Phase ein, die zu ihm gehört (Ruhephase: Action Phase).
//  Die Listen für die Oberfläche (was ist spielbar?) gelten dagegen für beide
//  (siehe `gs.skillTest` in den Aufzählern der Engine).
// ═══════════════════════════════════════════════════════════════════
const PHASE_MAIN = 2;

const MAIN_EVENTS = new Set([
  'play_artifact', 'use_potion', 'confirm_potion', 'use_artifact_effect', 'activate_free_ability', 'activate_equip_effect',
  'activate_discard_effect', 'activate_permanent', 'activate_area_effect', 'play_surprise', 'play_ability',
  'summon_ushabti', 'play_from_coolness_stack', 'activate_hand_card', 'trigger_treacherous_crystal', 'ascend_hero',
]);

/** Welche Phase braucht dieses Ereignis? (3 = Action, 2 = Main) */
function requiredPhase(room, pi, event, params) {
  const engine = room.engine, gs = room.gameState;
  if (MAIN_EVENTS.has(event)) return PHASE_MAIN;
  try {
    if (event === 'play_spell' || event === 'play_creature') {
      const c = engine._getCardDB()[params && params.cardName];
      if (c && (c.subtype || '').toLowerCase() === 'surprise') return PHASE_MAIN;   // Surprises nur in Main Phasen
      return PHASE_ACTION;
    }
    if (event === 'activate_ability') return PHASE_ACTION;
    if (event === 'activate_hero_effect') {
      const owner = params && params.charmedOwner != null ? params.charmedOwner : pi;
      const hero = gs.players[owner] && gs.players[owner].heroes[params && params.heroIdx];
      const script = hero && engine.heroScript(hero);
      return script && script.heroEffectActionCost ? PHASE_ACTION : PHASE_MAIN;
    }
    if (event === 'activate_creature_effect') {
      const owner = params && params.charmedOwner != null ? params.charmedOwner : pi;
      const inst = engine.cardInstances.find(c => c.owner === owner && c.zone === 'support' && c.heroIdx === params.heroIdx && c.zoneSlot === params.zoneSlot);
      const script = inst && require('../cards/effects/_loader').loadCardEffect((inst.counters && inst.counters._effectOverride) || inst.name);
      return script && script.creatureActionCost ? PHASE_ACTION : PHASE_MAIN;
    }
  } catch { /* im Zweifel Action Phase */ }
  return PHASE_ACTION;
}

/** Vor einem Spielereignis die passende Phase einstellen (nicht, solange eine Aktion läuft). */
function setPhaseFor(room, pi, event, params) {
  const gs = room.gameState, st = gs && gs.skillTest;
  if (!st || st.busy || gs.result || gs.activePlayer !== pi) return;
  gs.currentPhase = requiredPhase(room, pi, event, params);
}

// ═══════════════════════════════════════════════════════════════════
//  AKTIONEN: Zugwächter um die normalen do*-Handler des Servers
//
//  Die Handler (doPlaySpell …) bleiben unverändert. Dieser Wächter prüft, ob
//  der Spieler dran ist, lässt den Handler laufen und misst danach, ob eine
//  Aktion VERBRAUCHT wurde (Hooks, heroesActedThisTurn, HOPT). Dann wird der
//  Akteur erschöpft und der Zug geht weiter.
//
//    play_spell / play_creature / activate_ability   Haupt-Aktion → Hero erschöpft
//                                                    (Zusatz-/Inherent-Aktion: Zug weg, Hero nicht erschöpft)
//    activate_hero_effect                            Zug weg, Hero NICHT erschöpft
//    activate_creature_effect                        Zug weg, Creature erschöpft
// ═══════════════════════════════════════════════════════════════════
const CONSUMING_KINDS = new Set(['play_spell', 'play_creature', 'activate_ability', 'activate_hero_effect', 'activate_creature_effect']);
const METER_HOOKS = new Set(['onAnyActionResolved', 'onActiveEffectUsed', 'afterCreatureEffect']);

function snapshotHopt(gs) { return { ...(gs.hoptUsed || {}) }; }
function changedHopt(gs, before) {
  const out = [];
  for (const [k, v] of Object.entries(gs.hoptUsed || {})) if (before[k] !== v) out.push(k);
  return out;
}

function creatureInstOf(engine, pi, params) {
  if (params.instId != null) return engine.cardInstances.find(c => c.id === params.instId) || null;
  const owner = params.charmedOwner != null ? params.charmedOwner : pi;
  return engine.cardInstances.find(c => c.owner === owner && c.zone === 'support'
    && c.heroIdx === params.heroIdx && c.zoneSlot === params.zoneSlot) || null;
}

// ── Aktionshaushalt je Held ─────────────────────────────────────────
// Die Engine zählt Aktionen je SPIELER und Turn (`_actionsPlayedThisPhase`, `heroesActedThisTurn`): Aktion 1 der Action Phase,
// danach das Zweite-Aktion-Fenster der Zusatzaktions-Gewährungen („Aktion 2"). Im Skill Test hat jeder HELD seine eigene
// Action Phase pro Round: Hauptaktion (erschöpft ihn) und danach höchstens eine zweite Aktion (Gewährung). Damit alle
// Engine-/Server-/Kartenprüfungen unverändert greifen, werden die beiden Zähler für die Dauer einer Aktion auf den Stand
// des handelnden Helden gestellt und danach zurück auf den neutralen Round-Stand.

/** Indizes der Helden dieses Sitzes, die in dieser Round ihre Hauptaktion verbraucht haben. */
function actedHeroesOf(st, seat) {
  const out = [];
  for (const k of Object.keys(st.exhaustedHeroes || {})) {
    const [s, h] = k.split(':');
    if (Number(s) === seat) out.push(Number(h));
  }
  return out;
}

/** Zähler auf den handelnden Helden stellen. Gibt die Daten fürs Zurückstellen zurück. */
function ecoEnter(st, ps, pi, kind, params) {
  const hi = (kind === 'activate_creature_effect' || !params || params.heroIdx == null) ? null : params.heroIdx;
  const key = hi == null ? null : heroKey(pi, hi);
  const eco = key ? (st.heroEco[key] || (st.heroEco[key] = { played: 0, playedTurn: 0 })) : null;
  ps._actionsPlayedThisPhase = eco ? eco.played : 0;
  ps._actionsPlayedThisTurn = eco ? eco.playedTurn : 0;        // zählt (anders als die Phase) auch Main-Phase-Aktionen
  ps.heroesActedThisTurn = key && st.exhaustedHeroes[key] ? [hi] : [];
  return { hi, key, eco };
}

/** Zähler des Helden sichern, dann zurück auf den neutralen Round-Stand. */
function ecoLeave(st, ps, pi, ctx) {
  if (ctx.eco) { ctx.eco.played = ps._actionsPlayedThisPhase || 0; ctx.eco.playedTurn = ps._actionsPlayedThisTurn || 0; }
  ps._actionsPlayedThisPhase = 0; ps._actionsPlayedThisTurn = 0;
  // Neutraler Round-Stand: alle Helden, die in dieser Round gehandelt haben (der Zug des Helden steht dann in exhaustedHeroes).
  const union = new Set(actedHeroesOf(st, pi));
  for (const h of (ps.heroesActedThisTurn || [])) union.add(h);
  ps.heroesActedThisTurn = [...union];
}

/** Läuft ein Handler fertig und gibt dann den Zug weiter, falls eine Aktion verbraucht wurde. */
async function act(room, pi, kind, params, fn, host) {
  const gs = room.gameState, engine = room.engine, st = gs && gs.skillTest;
  if (!st) return fn();
  if (st.phase !== 'battle' || gs.result) return false;
  if (!CONSUMING_KINDS.has(kind)) return fn();
  if (gs.activePlayer !== pi || st.busy) return false;

  gs.currentPhase = requiredPhase(room, pi, kind, params);
  st.busy = true;
  st._delays = 0; engine._stPromptCounts = {};      // Schrittbudget und Wiederholungszähler dieser Aktion (siehe installRunawayBreaker / policy.chooseTargets)
  const token = (st.actToken = (st.actToken || 0) + 1);
  const ps = gs.players[pi];
  const eco = ecoEnter(st, ps, pi, kind, params);
  const actedBefore = (ps.heroesActedThisTurn || []).length;
  const hoptBefore = snapshotHopt(gs);
  const meter = engine._stMeter = { active: true, events: [] };
  let ok = false;
  // Diagnose: hängt eine Aktion (z. B. wartet ein Prompt auf einen Menschen), steht hier, worauf.
  const wd = setTimeout(() => {
    const pend = engine._pendingPrompt || engine._pendingGenericPrompt || gs.effectPrompt || null;
    console.warn(`[skilltest] Aktion ${kind} von Sitz ${pi} hängt seit 8 s; wartet auf:`, JSON.stringify(pend && { type: pend.type, owner: pend.ownerIdx ?? pend.playerIdx, title: pend.title }) || 'unbekannt',
      'chain:', !!gs._chainResolvingLock, 'spellDepth:', gs._spellResolutionDepth || 0);
  }, 8000);
  try { ok = await fn(); }
  catch (err) { console.error(`[skilltest] ${kind} threw:`, err && err.stack || err); }
  clearTimeout(wd);
  if (st.actToken !== token) { ecoLeave(st, ps, pi, eco); return ok; }     // vom Wächter aufgegeben (siehe battle.js startPromptWatchdog)
  meter.active = false;
  st.busy = false;

  const acted = (ps.heroesActedThisTurn || []).slice(actedBefore);
  const actedHeroes = acted.slice();
  if (gs.result) { ecoLeave(st, ps, pi, eco); return ok; }
  const hopt = changedHopt(gs, hoptBefore);
  const ev = (n) => meter.events.some(e => e.name === n);
  let consumed = false;
  if (kind === 'play_spell' || kind === 'play_creature' || kind === 'activate_ability') {
    consumed = acted.length > 0 || meter.events.some(e => e.name === 'onAnyActionResolved' && !(e.data && e.data.isFree)) || ev('onActiveEffectUsed');
  } else if (kind === 'activate_hero_effect') {
    consumed = ev('onActiveEffectUsed') || acted.length > 0 || hopt.some(k => k.startsWith('hero-effect:'));
  } else if (kind === 'activate_creature_effect') {
    consumed = ev('afterCreatureEffect') || acted.length > 0 || hopt.some(k => k.startsWith('creature-effect:'));
  }
  if (!consumed) { ecoLeave(st, ps, pi, eco); return ok; }

  for (const hi of acted) st.exhaustedHeroes[heroKey(pi, hi)] = true;
  ecoLeave(st, ps, pi, eco);
  if (kind === 'activate_creature_effect') {
    const inst = creatureInstOf(engine, pi, params || {});
    if (inst) st.exhaustedCreatures[inst.id] = true;
  }
  st.turnsTaken[pi] = (st.turnsTaken[pi] || 0) + 1;
  engine.log && engine.log('skilltest_turn', { seat: pi, kind, round: st.round });
  await advance(engine, host, pi);
  return ok;
}

/** „Attack" ist im Modus keine Handkarte: ein Klick spielt die echte Karte kurz ein und räumt sie danach weg. */
async function playBaseAttack(room, pi, heroIdx, host) {
  const gs = room.gameState, engine = room.engine, ps = gs.players[pi];
  if (gs.activePlayer !== pi || (gs.skillTest && gs.skillTest.busy)) return false;
  ps.hand.push('Attack');
  const handIndex = ps.hand.length - 1;
  const params = { cardName: 'Attack', handIndex, heroIdx };
  const discardBefore = ps.discardPile.length;
  let ok = false;
  try { ok = await act(room, pi, 'play_spell', params, () => host.doPlaySpell(room, pi, params), host); }
  finally {
    // Die virtuelle Karte darf nirgends zurückbleiben (Hand, Ablage, Instanzen).
    const h = ps.hand.lastIndexOf('Attack');
    if (h >= 0) ps.hand.splice(h, 1);
    for (let i = ps.discardPile.length - 1; i >= discardBefore - 1 && i >= 0; i--) {
      if (ps.discardPile[i] === 'Attack') { ps.discardPile.splice(i, 1); break; }
    }
    const idx = engine.cardInstances.findIndex(c => c.name === 'Attack' && c.owner === pi && (c.zone === 'discard' || c.zone === 'hand'));
    if (idx >= 0) engine.cardInstances.splice(idx, 1);
    engine.sync();
  }
  return ok;
}

/** Spieler beendet seine Round: alle seine übrigen Akteure verfallen bis zur nächsten Round. */
async function passRound(room, pi, host) {
  const gs = room.gameState, engine = room.engine, st = gs.skillTest;
  if (!st || st.phase !== 'battle' || gs.result || gs.activePlayer !== pi || st.busy) return false;
  st.passed[pi] = true;
  engine.log && engine.log('skilltest_pass', { seat: pi, round: st.round });
  await advance(engine, host, pi);
  return true;
}

module.exports = {
  act, playBaseAttack, actedHeroesOf, passRound, CONSUMING_KINDS, METER_HOOKS, requiredPhase, setPhaseFor,
  roundOrder, nextStarter, heroKey, heroAlive, heroActors, creatureActors, hasActor, seatHasActor,
  seatAlive, livingSeats, withActive,
  startRound, endRound, beginTurn, advance, pickNextSeat, isIncapacitated,
  PHASE_ACTION,
};
