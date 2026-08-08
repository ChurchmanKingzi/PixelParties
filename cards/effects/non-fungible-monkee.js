// ═══════════════════════════════════════════
//  CARD EFFECT: "Non-Fungible Monkee"
//  Artifact (Equipment, 8 Gold)
//
//  "Whenever a "Monkee" Creature is placed into one of your Heroes'
//   Support Zones or leaves the board, you gain 4 Gold."
//
//  ── Zwei Ausloeser, unterschiedliche Reichweite (Als Ruling 8.8.) ──
//   • EINTRITT: nur auf der EIGENEN Seite ("one of YOUR Heroes'
//     Support Zones").
//   • VERLASSEN: **alle** Monkees, auch gegnerische. Al ausdruecklich:
//     „leaves the board zaehlt ALLE Monkees".
//
//  Was eine "Monkee"-Kreatur ist, steht in `_monkee-shared.js` — die
//  Namensregel ist dort die einzige Auslegungsstelle. Diese Karte selbst
//  ist ein ARTEFAKT und faellt damit durch die Kreatur-Pruefung; sie
//  loest sich also nicht selbst aus.
//
//  ── Der Gewinn ist ein Effekt-Gewinn ──
//  `actionGainGold` ohne `_isResourceGain` — die vier Gold zaehlen also
//  als „gained through an effect" und koennen ihrerseits Cheeky, Nimble
//  und Resilient Monkee ausloesen. Genau das ist der Motor des
//  Archetyps. Begrenzt wird die Kette allein durch deren
//  Once-per-turn-Klauseln.
//
//  Ein Zonenwechsel (`_isMove`) ist weder ein Platzieren noch ein
//  Verlassen des Bretts — die Kreatur war vorher da und ist es danach.
// ═══════════════════════════════════════════

const { isMonkeeCreature } = require('./_monkee-shared');

const CARD_NAME = 'Non-Fungible Monkee';
const REWARD = 4;

/** Gold gutschreiben und protokollieren. */
async function zahleAus(engine, ownerIdx, anlass, monkee) {
  engine._broadcastEvent('play_gold_coins', { owner: ownerIdx });
  await engine.actionGainGold(ownerIdx, REWARD);
  engine.log('non_fungible_monkee', {
    player: engine.gs.players[ownerIdx]?.username,
    trigger: anlass, monkee, gold: REWARD,
  });
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /** Ein Monkee betritt eine EIGENE Support Zone. */
    onCardEnterZone: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.toZone !== 'support') return;
      if (ctx._isMove) return;
      const inst = ctx.enteringCard;
      if (!inst) return;
      if (!isMonkeeCreature(engine, inst)) return;
      // "one of YOUR Heroes' Support Zones" — nur die eigene Seite.
      const seite = inst.controller ?? inst.owner;
      if (seite !== ctx.cardOwner) return;
      await zahleAus(engine, ctx.cardOwner, 'placed', inst.name);
    },

    /** Ein Monkee verlaesst das Brett — egal auf welcher Seite. */
    onCardLeaveZone: async (ctx) => {
      const engine = ctx._engine;
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone === 'support') return;      // reiner Zonenwechsel
      const inst = ctx.leavingCard || ctx.card;
      if (!inst) return;
      if (!isMonkeeCreature(engine, inst)) return;
      await zahleAus(engine, ctx.cardOwner, 'left_board', inst.name);
    },
  },
};
