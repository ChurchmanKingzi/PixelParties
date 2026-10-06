'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — ENGINE-ERWEITERUNGEN (auf der INSTANZ, nicht in der Klasse)
//
//  Alles, was nur im Modus gilt, hängt hier an der einen Engine-Instanz
//  des Skill-Test-Raums. Die Engine-Klasse bleibt (bis auf wenige, im
//  2-Spieler-Spiel wirkungsgleiche Stellen) unberührt.
// ═══════════════════════════════════════════════════════════════════
const rounds = require('./rounds');
const { loadCardEffect } = require('../cards/effects/_loader');

/**
 * Eliminierung statt Spielende: Wer alle Heroes verloren hat, scheidet aus (seine Creatures
 * handeln weiter). Das Spiel endet, wenn höchstens ein Spieler übrig ist.
 * Die Prüfung der „ausgelöschten Seite" ist dieselbe wie in der Engine (Kontrolle, Elixir, Teleport).
 */
function installElimination(engine) {
  engine.checkAllHeroesDead = async function () {
    const gs = this.gs, st = gs.skillTest;
    if (gs.result || gs._endGameLaeuft) return;
    if (gs._deferGameOverCheck > 0) { gs._gameOverCheckPending = true; return; }
    gs._gameOverCheckPending = false;

    const newly = [];
    for (let pi = 0; pi < gs.players.length; pi++) {
      if (st.eliminated.includes(pi)) continue;
      const ps = gs.players[pi];
      const controlled = this.heroesControlledBy(pi, { permanentOnly: true });
      const hatSpalte = (ps.heroes || []).length > 0;
      const allDead = (hatSpalte || controlled.length > 0) && controlled.every(({ hero }) => hero.hp <= 0);
      if (!allDead) continue;
      const hasSuspender = (ps.permanents || []).some(p => { const s = loadCardEffect(p.name); return s && s.preventsAllHeroesDeadLoss; });
      const teleported = (ps._teleportedAway || 0) > 0;
      if (!hasSuspender && !teleported) newly.push(pi);
    }
    if (!newly.length) return;

    for (const pi of newly) {
      st.eliminated.push(pi);
      st.eliminatedRound[pi] = st.round;
      st.eliminatedWith[pi] = newly.length;     // gleichzeitig Ausgeschiedene teilen sich den Platz
      this.log('skilltest_eliminated', { seat: pi, name: gs.players[pi].username, round: st.round });
    }
    const alive = gs.players.map((_, i) => i).filter(i => !st.eliminated.includes(i));
    if (alive.length <= 1) {
      // Letzter Überlebender gewinnt; fallen die letzten gleichzeitig, entscheidet ein Hinweis (Bunny Bombs) oder der Zufall.
      let winner = alive[0];
      if (winner == null) {
        const hint = gs._drawLoserIdx;
        const cands = newly.filter(i => i !== hint);
        winner = (cands.length ? cands : newly)[Math.floor(Math.random() * (cands.length || newly.length))];
      }
      if (this.onGameOver) this.onGameOver(this.room, winner, 'last_standing');
      return;
    }
    this.sync();
  };
}

/** Meter für die Zugerkennung: sieht Aktions-Hooks vorbeigehen. */
function installMeter(engine) {
  const orig = engine.runHooks.bind(engine);
  engine.runHooks = async function (hookName, hookCtx = {}) {
    const m = engine._stMeter;
    if (m && m.active && rounds.METER_HOOKS.has(hookName)) m.events.push({ name: hookName, data: hookCtx });
    return orig(hookName, hookCtx);
  };
}

/** Jede Beendigung des Zuges (Ascension, Terror, `advanceToPhase(5)` …) läuft in den Round-Treiber. */
function installTurnEnd(engine, host) {
  // Effekte, die „den Zug beenden" (Terror, Aufstieg, Gate to the Armory …), beenden hier die ROUND des Sitzes:
  // was im Normalspiel „pro Turn" gilt, gilt im Skill Test pro Round.
  engine.switchTurn = async function () {
    const gs = this.gs;
    if (gs.result || !gs.skillTest) return;
    const seat = gs.activePlayer;
    gs.skillTest.turnsTaken[seat] = (gs.skillTest.turnsTaken[seat] || 0) + 1;
    gs.skillTest.passed[seat] = true;
    await rounds.advance(this, host, seat);
  };
  // Phasenwechsel durch den Spieler gibt es nicht: nach jeder Aktion ruft der Server `advanceToPhase(Main 2)`. Die Action
  // Phase des Sitzes dauert die ganze Round (Zusatzaktionen, Gewährungen und Zähler bleiben bis zum Rundenende stehen,
  // siehe rounds.js). Nur das Turn-Ende (Phase 5) läuft weiter durch.
  const origAdvance = engine.advanceToPhase.bind(engine);
  engine.advanceToPhase = async function (playerIdx, targetPhase, opts) {
    if (this.gs.skillTest && targetPhase !== 5) return true;
    return origAdvance(playerIdx, targetPhase, opts);
  };
}

/** Prompts für CPU-Sitze automatisch beantworten (die Engine hat dafür `isCpuPlayer`). */
function installBotSeats(engine, isBotSeat) {
  engine.isCpuPlayer = (pi) => !!isBotSeat(pi);
}

/**
 * Kartenskripte (`cpuResponse`) lesen den CPU-Sitz aus `engine._cpuPlayerIdx` (Normalspiel: genau ein CPU-Sitz).
 * Im Skill Test gibt es mehrere — für die Dauer der Antwort steht dort der gefragte Sitz, danach wieder -1.
 */
function withCpuSeat(engine, seat, fn) {
  const prev = engine._cpuPlayerIdx;
  engine._cpuPlayerIdx = seat;
  let out;
  try { out = fn(); } catch (e) { engine._cpuPlayerIdx = prev; throw e; }
  if (out && typeof out.then === 'function') return out.finally(() => { engine._cpuPlayerIdx = prev; });
  engine._cpuPlayerIdx = prev;
  return out;
}

/** Bot-Zielwahl über die Policy (die Engine ruft sie für CPU-Sitze statt eines Prompts). */
function installBotBrain(engine) {
  const bot = require('./bot');
  const base = engine._getCpuTargetResponse.bind(engine);
  engine._getCpuTargetResponse = (validTargets, config = {}, pi) => withCpuSeat(engine, pi, () => bot.chooseTargets(engine, pi, validTargets, config, base));
}

/**
 * Flächenschaden gegen „den Gegner": mit mehreren Gegnern wählt der Wirker EINEN Spieler,
 * dessen Ziele getroffen werden (wie bei „Divine Gift of Fire"). Die Wahl wird zum Fokus
 * des Wirkers (`gs.stFocus`), damit `opponentOf` danach denselben Spieler meint.
 */
function installPlayerChoice(engine) {
  const living = (gs, pi) => gs.players.map((_, i) => i).filter(i => i !== pi
    && (gs.players[i].heroes || []).some(h => h && h.name && h.hp > 0));
  engine._stChooseAoePlayer = async function (pi, config, cardInst) {
    const gs = this.gs;
    const cands = living(gs, pi);
    if (cands.length <= 1) { if (cands.length === 1) this.setFocusOpponent(pi, cands[0]); return; }
    const title = (cardInst && cardInst.name) || config.sourceName || 'Choose a player';
    const res = await this.promptGeneric(pi, {
      type: 'playerPicker', title, description: 'Choose a player. All their targets are hit.',
      allowedPlayers: cands, cancellable: false,
    });
    const idx = res && Number.isInteger(res.playerIdx) && cands.includes(res.playerIdx) ? res.playerIdx : cands[0];
    this.setFocusOpponent(pi, idx);
  };
  engine.setFocusOpponent = function (pi, idx) {
    const gs = this.gs;
    if (!gs.skillTest) return;
    (gs.stFocus || (gs.stFocus = {}))[pi] = idx;
  };
  // Bots beantworten die Spielerwahl über die Policy (schwächster bzw. stärkster Gegner).
  const baseGeneric = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, promptedPlayerIdx) => withCpuSeat(engine, promptedPlayerIdx, () => {
    if (promptData && promptData.type === 'playerPicker') {
      const pool = (promptData.allowedPlayers && promptData.allowedPlayers.length) ? promptData.allowedPlayers : living(engine.gs, promptedPlayerIdx);
      return { playerIdx: require('./bot').choosePlayer(engine, promptedPlayerIdx, pool, promptData) };
    }
    return baseGeneric(promptData, promptedPlayerIdx);
  });
}

/**
 * Reaktionen der Bots (Hand, Surprise, Held): Die Standard-CPU entscheidet nach Karten-Heuristik; hier kommen Persona,
 * gelernter Wert und Neugier dazu (bot.shapeReaction). Am Ende jeder Aktion werden die vorgemerkten Entscheidungen bewertet.
 */
function installReactions(engine) {
  const prev = engine._getCpuGenericResponse.bind(engine);
  engine._getCpuGenericResponse = (promptData, seat) => {
    const r = prev(promptData, seat);
    try { return withCpuSeat(engine, seat, () => require('./bot').shapeReaction(engine, seat, promptData, r, prev)); }
    catch (e) { console.error('[skilltest] Reaktionslogik:', e && e.message); return r; }
  };
  engine._stFlushReactions = () => { try { require('./bot').flushReactions(engine.room); } catch { /* Lernhilfe */ } };
}

/**
 * `engine.restore(snap)` ersetzt `gs.skillTest` durch eine KOPIE (die Identität geht verloren, nicht aufzählbare
 * Felder wie die Timer-Handles gehen mit). Der Rundentreiber, Wächter und Timer halten aber das lebende Objekt:
 * nach jedem Restore bekommt es die Werte der Kopie, bleibt selbst aber dasselbe Objekt.
 */
function installSnapshotGuard(engine) {
  const orig = engine.restore.bind(engine);
  engine.restore = function (snap) {
    const live = this.gs.skillTest;
    const r = orig(snap);
    const restored = this.gs.skillTest;
    if (live && restored && restored !== live) {
      for (const k of Object.keys(live)) if (!(k in restored)) delete live[k];
      Object.assign(live, restored);
      this.gs.skillTest = live;
    }
    return r;
  };
}

/**
 * Schrittbudget je Aktion: Karten mit „darf erneut"-Schleifen (Skeleton Reaper …) laufen ohne Grenze, wenn der
 * Spieler nie abbricht (ein Bot bricht freiwillige Ziel-Prompts nie ab, eine Karte lässt Ziele zurückkehren …).
 * Jede Animationspause (`_delay`) zählt; über dem Budget wird die Aktion mit einem Fehler beendet.
 */
const MAX_DELAYS_PER_ACTION = 6000;
function installRunawayBreaker(engine) {
  const orig = engine._delay.bind(engine);
  engine._delay = (ms) => {
    const st = engine.gs && engine.gs.skillTest;
    if (st && st.busy && ++st._delays > MAX_DELAYS_PER_ACTION) {
      st._delays = -1e9;                                    // nur einmal werfen
      throw new Error('ST_RUNAWAY: die Aktion überschreitet ihr Schrittbudget (Endlosschleife einer Karte?)');
    }
    return orig(ms);
  };
}

/** Kein Handlimit, keine Deck-Out-Niederlage (es gibt keine Decks). */
function relaxRules(engine) {
  for (const ps of engine.gs.players) ps._noHandLimitUntilTurn = Infinity;
}

module.exports = { installReactions, installRunawayBreaker, installSnapshotGuard, installPlayerChoice, installElimination, installMeter, installTurnEnd, installBotSeats, installBotBrain, relaxRules };
