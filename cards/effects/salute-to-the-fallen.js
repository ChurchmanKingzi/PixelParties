// ═══════════════════════════════════════════
//  CARD EFFECT: "Salute to the Fallen"
//  Spell (Magic Arts Lv1, Normal)
//
//  „Send the top 5 cards of your deck to the discard pile. For every
//   Creature among those cards, draw 2 cards."
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Das Abwerfen laeuft ueber `engine.actionMillCards` (KEIN Discard —
//    milled cards feuern ON_MILL, nicht ON_DISCARD; Umlenkungen in den
//    Deleted-Stapel, Rettungen und Erstzug-Schutz kommen von dort).
//    `selfInflicted: true`, weil es das eigene Deck ist — sonst wuerde
//    der Erstzug-Schutz den Effekt still verschlucken. `centerReveal`
//    zeigt jede Karte kurz in der Mitte (Cute-Cat-Muster), damit man
//    SIEHT, welche Kreaturen gezaehlt werden.
//  · Gezaehlt wird nach `hasCardType(cd, 'Creature')` — Artifact
//    Creatures (Subtyp Creature) zaehlen mit, Spells/Artifacts nicht.
//    Gezaehlt werden die Karten, die die Mill-Funktion ZURUECKGIBT,
//    d.h. auch solche, die unterwegs in den Deleted-Stapel umgelenkt
//    wurden: „among those cards" meint die fuenf gesendeten Karten,
//    nicht ihren Landeplatz.
//  · Hat das Deck weniger als 5 Karten, werden alle gesendet; ein
//    leeres Deck ergibt 0 Kreaturen und 0 Ziehungen — der Spell ist
//    trotzdem spielbar (kein `canPlayCard`-Gate; Al bindet Spells
//    nicht an „muss etwas bewirken").
//  · Ziehen mit `actionDrawCardsAnimated` in EINEM Zug (2 × Anzahl),
//    Hand-Limit-Behandlung kommt von dort.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Salute to the Fallen';
const MILL_COUNT = 5;
const DRAW_PER_CREATURE = 2;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      const milled = await engine.actionMillCards(pi, MILL_COUNT, {
        source: CARD_NAME,
        selfInflicted: true,
        centerReveal: true,
      });

      const db = engine._getCardDB();
      const creatures = milled.filter(name => hasCardType(db[name], 'Creature')).length;
      const draws = creatures * DRAW_PER_CREATURE;

      engine.log('salute_to_the_fallen', {
        player: ps.username, milled: milled.length, creatures, draws,
      });

      if (draws > 0) {
        await engine.actionDrawCardsAnimated(pi, draws, { source: CARD_NAME });
      }
      engine.sync();
    },
  },
};
