// ═══════════════════════════════════════════
//  CARD EFFECT: "Hatusbal, the Leader of Tusca"
//  Hero (500 HP / 80 ATK) — Starting Abilities: Diplomacy, Leadership
//
//  "Your opponent cannot shuffle cards back into their deck with card
//   effects. Whenever you shuffle 2 or more cards back into your deck
//   with an effect, draw 1 card after the effect resolves."
//
//  ── TEIL 1: DIE SPERRE ────────────────────────────────────────────
//  Deklarativ ueber `blocksOpponentShuffleBack`. Die Engine leitet
//  daraus `shuffleBackIntoOwnDeckBlocked(pi, opts)` ab.
//
//  ALS RULING (16.8.) — REICHWEITE gegenueber Distracting Crystal:
//  Der Krystall sperrt NUR Hand und Ablage. Hatusbal sperrt ALLE
//  Quellen, also auch Brett und Loeschstapel. Deshalb liest die Engine
//  fuer Hand/Ablage-Karten die Fahne
//  `shufflesFromHandOrDiscardIntoDeck` (die beide Sperren teilen), und
//  Brettkarten fragen zusaetzlich zur Aufloesungszeit nach.
//
//  ★ GEWOLLTE FOLGE (Al ausdruecklich): blockt Hatusbal das
//  Zurueckmischen bei "Staff of Illusions", bleibt die nur geliehene
//  Creature liegen und wird PERMANENT. Das ist kein Bug — nicht
//  "reparieren".
//
//  ── WAS HATUSBAL NICHT SPERRT ─────────────────────────────────────
//  Sein Text sagt "into THEIR deck". Der Gegner darf also sehr wohl
//  GESTOHLENE Karten in das Deck des Hatusbal-Kontrolleurs
//  zurueckmischen — das ist nicht sein Deck. Bei Mulligan-artigen
//  Auswahlen duerfen dann nur diese Karten anwaehlbar sein.
//  ⚠ NOCH NICHT UMGESETZT: die Hand ist ein reines NAMENS-Array, eine
//  gestohlene Karte traegt dort keine Herkunft. Das braucht erst eine
//  Besitzmarkierung fuer Handkarten. An Al gemeldet.
//
//  Ebenfalls NICHT gesperrt, weil der Mischende dort der
//  Hatusbal-Kontrolleur selbst ist: "Divine Gift of Forgetting"
//  ("YOUR OPPONENT shuffles all Abilities ... back into THEIR deck").
//  Spielt Hatusbals Gegner die Karte, mischt Hatusbals Seite — erlaubt.
//  Der Riegel haengt korrekt am MISCHENDEN Spieler, nicht am Caster.
//
//  ── TEIL 2: DER ZIEH-BONUS ────────────────────────────────────────
//  ALS VORGABE: "2 or more" heisst durch EINEN Effekt — auch wenn die
//  Karten einzeln ausgewaehlt und nacheinander zurueckgeschickt werden
//  (Leadership Lv2/Lv3). Wo ein Effekt anfaengt und aufhoert, weiss nur
//  die Karte; die Engine saehe bei sequentieller Auswahl mehrfach "1".
//  Deshalb meldet die Karte EINMAL ihre Gesamtzahl ueber
//  `engine.noteShuffledBack(pi, count, name)`, und dieser Hook hoert zu.
//
//  "after the effect resolves" faellt daraus von selbst richtig heraus:
//  die Meldung steht am Ende der Kartenaufloesung.
//
//  Seine eigene Startability "Leadership" mischt selbst zurueck und
//  speist damit genau diesen Bonus — auf Lv2/Lv3 mit 2 bzw. 3 Karten.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hatusbal, the Leader of Tusca';
const SCHWELLE = 2;

module.exports = {
  // Engine-Vertrag, ausgewertet in `_opponentBlocksShuffleBack`.
  blocksOpponentShuffleBack: true,

  hooks: {
    onShuffledBackToDeck: async (ctx) => {
      // Nur die EIGENE Seite. `cardOwner` ist auf den effektiven
      // Kontrolleur aufgeloest.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (!(ctx.count >= SCHWELLE)) return;

      const engine = ctx._engine;
      await engine.actionDrawCards(ctx.cardOwner, 1);
      engine.sync();

      ctx.log('hatusbal_draw', {
        card: CARD_NAME,
        player: ctx.players?.[ctx.cardOwner]?.username,
        shuffledBack: ctx.count,
        source: ctx.source || null,
      });
    },
  },
};
