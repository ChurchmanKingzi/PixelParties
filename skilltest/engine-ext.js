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
  engine.switchTurn = async function () {
    const gs = this.gs;
    if (gs.result || !gs.skillTest) return;
    const seat = gs.activePlayer;
    gs.skillTest.turnsTaken[seat] = (gs.skillTest.turnsTaken[seat] || 0) + 1;
    await rounds.advance(this, host, seat);
  };
}

/** Prompts für CPU-Sitze automatisch beantworten (die Engine hat dafür `isCpuPlayer`). */
function installBotSeats(engine, isBotSeat) {
  engine.isCpuPlayer = (pi) => !!isBotSeat(pi);
}

/** Bot-Zielwahl über die Policy (die Engine ruft sie für CPU-Sitze statt eines Prompts). */
function installBotBrain(engine) {
  const bot = require('./bot');
  const base = engine._getCpuTargetResponse.bind(engine);
  engine._getCpuTargetResponse = (validTargets, config = {}, pi) => bot.chooseTargets(engine, pi, validTargets, config, base);
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
  engine._getCpuGenericResponse = (promptData, promptedPlayerIdx) => {
    if (promptData && promptData.type === 'playerPicker') {
      const pool = (promptData.allowedPlayers && promptData.allowedPlayers.length) ? promptData.allowedPlayers : living(engine.gs, promptedPlayerIdx);
      return { playerIdx: require('./bot').choosePlayer(engine, promptedPlayerIdx, pool) };
    }
    return baseGeneric(promptData, promptedPlayerIdx);
  };
}

/** Kein Handlimit, keine Deck-Out-Niederlage (es gibt keine Decks). */
function relaxRules(engine) {
  for (const ps of engine.gs.players) ps._noHandLimitUntilTurn = Infinity;
}

module.exports = { installPlayerChoice, installElimination, installMeter, installTurnEnd, installBotSeats, installBotBrain, relaxRules };
