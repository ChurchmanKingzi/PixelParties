// ═══════════════════════════════════════════
//  CARD EFFECT: "Sol Rym, the Thunder Djinn"
//  Hero (300HP, 50ATK) — Can use Chain Lightning
//  regardless of level. Can only perform 1
//  Action per turn total.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onGameStart: (ctx) => {
      const ps = ctx.gameState.players[ctx.cardOriginalOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      // Chain Lightning treated as level 0 for eligibility
      hero.levelOverrideCards = { 'Chain Lightning': 0 };
      // Only 1 action per turn
      hero._maxActionsPerTurn = 1;
    },
  },
};
