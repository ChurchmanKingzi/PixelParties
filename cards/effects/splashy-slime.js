// ═══════════════════════════════════════════
//  CARD EFFECT: "Splashy Slime"
//  Creature — On summon (HOPT, mandatory):
//  Gain 4 Gold × number of unique lv 0
//  Creatures (by original level) you control.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Hard Once Per Turn — mandatory, not optional
      if (!ctx.hardOncePerTurn('splashy-slime-summon')) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = ctx.players[pi];

      // Load card database for original level lookup
      const allCards = require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8');
      const cardDB = {};
      JSON.parse(allCards).forEach(c => { cardDB[c.name] = c; });

      // Count unique Creature names with original level 0 across all support zones
      const uniqueNames = new Set();
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        for (const slot of (ps.supportZones[hi] || [])) {
          for (const cardName of (slot || [])) {
            const c = cardDB[cardName];
            if (c && c.cardType === 'Creature' && (c.level || 0) === 0) {
              uniqueNames.add(cardName);
            }
          }
        }
      }

      const count = uniqueNames.size;
      if (count === 0) return; // Shouldn't happen since Splashy Slime itself is lv 0

      const goldAmount = 4 * count;
      engine.log('splashy_gold', { player: ps.username, count, amount: goldAmount, creatures: [...uniqueNames] });

      // Use standard gold gain action — triggers the +X animation automatically
      await engine.actionGainGold(pi, goldAmount);
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
