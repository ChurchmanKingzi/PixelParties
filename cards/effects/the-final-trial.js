// ═══════════════════════════════════════════
//  CARD EFFECT: "The Final Trial"
//  Attack (Fighting Lv0, Normal, Trials)
//
//  "This card has no effect unless you have played at least 1
//   \"Trial of Dominance\", 1 \"Trial of Loyalty\", 1 \"Trial of
//   Knowledge\", 1 \"Trial of Annoyance\" and 1 \"Trial of Coolness\"
//   this game. This must be the first Action you perform this turn.
//   You win the game."
//
//  Die einzige ALTERNATIVE SIEGBEDINGUNG im Kartenpool ausser den
//  Cardinal Beasts (vier auf dem Brett) und der Doom Clock (20 Zaehler).
//
//  ── „played … this game" ── ist keine neue Buchfuehrung noetig: die
//  fuenf Pruefungen sind alle `oncePerGame` und stempeln beim
//  Ausspielen ihren Schluessel in `ps._oncePerGameUsed`. Genau dieses
//  Set beantwortet die Frage — und zwar exakt, weil der Stempel erst
//  faellt, wenn die Karte wirklich gespielt wurde. Abgelesen ueber
//  `hasPlayedTrial` aus `_trials-shared.js`, damit die Schluesselliste
//  nur an einer Stelle steht.
//
//  ── „first Action you perform this turn" ── Das Spiel kennt EINE
//  Hauptaktion je Runde; wer sie verbraucht hat, steht in
//  `ps.heroesActedThisTurn` (bei Rundenbeginn geleert, von jeder
//  echten Aktion befuellt). Leer heisst also: noch keine Aktion
//  verbraucht. Freie und zusaetzliche Aktionen schreiben dort
//  ABSICHTLICH nicht hinein — sie sind in der Sprache dieses Spiels
//  keine „Action", und der Kartentext meint dieselbe Sprache.
//  Dieselbe Abfrage nutzt die Engine in `hasSpendableActionFor`.
//
//  ── Warum `spellPlayCondition` und nicht nur eine Pruefung in
//  `onPlay` ── Beides. Die Bedingung haelt die Karte gar nicht erst
//  spielbar, solange sie nichts bewirken wuerde (kein Deckplatz
//  verschwendet, und die CPU sieht sie nicht als Option). Im `onPlay`
//  steht die Pruefung ein zweites Mal, weil sich zwischen Freigabe
//  und Aufloesung noch etwas verschieben kann. Der Text sagt
//  ausdruecklich „has no effect unless" — die Karte darf also auch
//  wirkungslos abgelegt werden, sie fizzelt dann nur.
//
//  ── KEIN Attack/Spell-Riegel ── Die fuenf Pruefungen sperren die
//  Runde; The Final Trial tut das nicht. Sein Text nennt keinen
//  Riegel, er hat stattdessen die Erste-Aktion-Bedingung. Das ist
//  auch stimmig: das Spiel endet ohnehin.
//
//  ── Sieg-Aufruf ── Muster von `_doom-clock-shared.js`, nicht von
//  den Cardinal Beasts: im Schnelllauf und in MCTS-Rollouts wird nur
//  `gs.result` gestempelt. `onGameOver` aus einer Simulation heraus
//  wuerde das ECHTE Spiel beenden (die Engine warnt an
//  `checkAllHeroesDead` ausdruecklich davor — Phantom-Niederlagen).
// ═══════════════════════════════════════════

const {
  TRIAL_NAMES, hasPlayedTrial, missingTrials,
} = require('./_trials-shared');

const CARD_NAME = 'The Final Trial';
const WIN_REASON = 'final_trial';
const CELEBRATION_MS = 2500;

/** Alle fuenf Pruefungen dieses Spiel gespielt? */
function allTrialsPlayed(ps) {
  return TRIAL_NAMES.every(n => hasPlayedTrial(ps, n));
}

/** Noch keine Aktion diese Runde verbraucht? */
function isFirstActionOfTurn(ps) {
  return (ps?.heroesActedThisTurn || []).length === 0;
}

module.exports = {
  // Beide Bedingungen VOR dem Spielen. Ohne sie waere die Karte eine
  // dauerhaft tote Handkarte, die der Pilot trotzdem als Option
  // bewertet.
  spellPlayCondition(gs, pi) {
    const ps = gs?.players?.[pi];
    if (!ps) return false;
    if (!isFirstActionOfTurn(ps)) return false;
    return allTrialsPlayed(ps);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Zweite Pruefung bei der Aufloesung — „has no effect unless".
      // Kein `_spellCancelled`: die Karte fizzelt und wird abgelegt,
      // sie wird nicht zurueckgenommen.
      if (!isFirstActionOfTurn(ps)) {
        engine.log('final_trial_fizzle', { player: ps.username, reason: 'not_first_action' });
        return;
      }
      const missing = missingTrials(ps);
      if (missing.length > 0) {
        engine.log('final_trial_fizzle', {
          player: ps.username, reason: 'trials_missing', missing,
        });
        return;
      }

      // Schon entschieden? (Doppelaufloesung, paralleler Sieg.)
      if (gs.result) return;

      engine.log('final_trial_win', {
        player: ps.username,
        loser: gs.players[pi === 0 ? 1 : 0]?.username,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: pi, heroIdx: -1, zoneSlot: -1,
      });
      engine.sync();

      // Feier nur im echten Spiel — `_delay` ist im Schnelllauf stumm.
      await engine._delay(CELEBRATION_MS);

      if (engine._fastMode || engine._inMctsSim) {
        if (!gs.result) gs.result = { winnerIdx: pi, reason: WIN_REASON };
      } else if (engine.onGameOver) {
        await engine.onGameOver(engine.room, pi, WIN_REASON);
      }
    },
  },
};
