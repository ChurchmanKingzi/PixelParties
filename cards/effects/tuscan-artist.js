// ═══════════════════════════════════════════
//  CARD EFFECT: "Tuscan Artist"
//  Creature (Lv2, 100 HP, Summoning Magic)
//
//  "While you control this Creature, any effect
//   that would allow your opponent to draw 2 or
//   3 cards is negated."
//
//  Die Auslegung steht vollstaendig in
//  `_draw-block-shared.js` — hier haengt nur der
//  Hook, der sie anwendet.
//
//  WARUM DAS EINE ZEILE REICHT: `beforeDrawBatch`
//  feuert in BEIDEN Ziehpfaden der Engine
//  (`actionDrawCards` und `actionDrawFromPotion
//  Deck`) und traegt `deckType` mit. Damit sind
//  alle 43 Karten des Pools erfasst, ohne dass
//  eine davon angefasst werden muesste — und
//  jede kuenftige Ziehkarte gratis dazu.
//
//  "While you control this Creature" muss das
//  Skript nicht selbst pruefen: `activeIn:
//  ['support']` laesst den Hook nur aus der Zone
//  feuern, und der Hook-Verteiler in
//  `_engine.js` filtert negierte, genullte,
//  betaeubte, eingefrorene und verdeckte
//  Kreaturen bereits zentral heraus.
// ═══════════════════════════════════════════

const { mengeGesperrt } = require('./_draw-block-shared');

const CARD_NAME = 'Tuscan Artist';

module.exports = {
  activeIn: ['support'],

  // CPU-Einschaetzung: reine Sperrkarte ohne eigenen Ertrag. Sie zu
  // spielen ist fast immer richtig, sobald der Gegner Ziehkarten hat —
  // der MCTS bewertet das ueber den Handkarten-Nachteil des Gegners
  // von selbst, hier braucht es keine Sonderbehandlung.
  cpuMeta: {},

  hooks: {
    beforeDrawBatch: async (ctx) => {
      // Nur GEGNERISCHE Zuege. `cardOwner` ist bereits auf den
      // effektiven Kontrolleur aufgeloest (Charm/Diebstahl).
      const zieher = ctx.playerIdx;
      if (zieher == null || zieher === ctx.cardOwner) return;

      // Genau 2 oder genau 3 — 1 und 4+ laufen durch (Als Ruling).
      // `ctx.amount` ist hier der AKTUELLE Stand: die Engine baut den
      // ctx je Listener neu (`_createContext` in der Listener-Schleife),
      // ein vorher laufender Zaehl-Modifikator ist also schon drin.
      const menge = ctx.amount;
      if (!mengeGesperrt(menge)) return;

      // NUR das Ziehen wird negiert, nicht die ausloesende Karte.
      // `setAmount(0)` ist dafuer der richtige Weg: beide Ziehpfade
      // steigen danach mit `if (count === 0) return []` aus, waehrend
      // `ctx.cancel()` den ganzen Hook-Lauf abbrechen wuerde.
      //
      // NICHT erfasst — und das ist korrekt: Zuege mit
      // `_unpreventable: true` (Champion, the Stormbringer: "this draw
      // cannot be prevented") ueberspringen den Batch-Hook in der
      // Engine komplett. Ebenso setzt `setAmount` nichts herab, wenn
      // ein Effekt `cannotBeReduced` gesetzt hat.
      ctx.setAmount(0);

      ctx.log('tuscan_artist_negate', {
        card: CARD_NAME,
        player: ctx.players?.[ctx.cardOwner]?.username,
        blocked: menge,
        deck: ctx.deckType || 'main',
      });
    },
  },
};
