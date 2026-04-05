// ═══════════════════════════════════════════
//  CARD EFFECT: "Wealth"
//  Ability — Each level of Wealth on any alive
//  Hero adds 4 Gold during the Resource Phase.
//  Lv1: +4, Lv2: +8, Lv3: +12 per Hero.
//
//  Implementation: each Wealth card instance
//  adds 4 Gold independently. Since each copy
//  in a zone = 1 level, the math works out:
//  2 copies on Hero A + 3 on Hero B = 5 hooks
//  firing = +20 Gold total.
//
//  Dead heroes are globally filtered by the
//  engine — their abilities never fire.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],

  hooks: {
    onResourceGain: (ctx) => {
      // Only boost during Resource Phase
      if (ctx.phaseIndex !== 1) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      ctx.modifyAmount(4);
    },
  },
};
