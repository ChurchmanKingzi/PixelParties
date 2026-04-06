// ═══════════════════════════════════════════
//  CARD EFFECT: "Shiny Slime"
//  Creature — On summon (HOPT, mandatory):
//  Draw 1 card for each unique lv 0 Creature
//  (by original level) you control, including
//  this one. Cards drawn 1 by 1 with delay.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Hard Once Per Turn — mandatory, not optional
      if (!ctx.hardOncePerTurn('shiny-slime-summon')) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = ctx.players[pi];

      // Use engine's cached card database
      const cardDB = engine._getCardDB();

      // Count unique Creature names with original level 0 across all support zones
      const uniqueNames = new Set();
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        for (const slot of (ps.supportZones[hi] || [])) {
          for (const cardName of (slot || [])) {
            const c = cardDB[cardName];
            if (c && hasCardType(c, 'Creature') && (c.level || 0) === 0) {
              uniqueNames.add(cardName);
            }
          }
        }
      }

      const count = uniqueNames.size;
      if (count === 0) return;

      engine.log('shiny_draw', { player: ps.username, count, creatures: [...uniqueNames] });

      // Draw cards 1 by 1 with small delays
      for (let i = 0; i < count; i++) {
        await engine.actionDrawCards(pi, 1);
        engine.sync();
        if (i < count - 1) await engine._delay(250);
      }
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
