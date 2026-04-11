// ═══════════════════════════════════════════
//  CARD EFFECT: "Controlled Attack"
//  Spell (Decay Magic Lv1) — Inherent additional
//  Action. Choose an opponent's Hero. You may
//  use that Hero's Abilities and active effect
//  this turn as if you controlled it.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx = pi === 0 ? 1 : 0;

      // Prompt to choose an opponent's hero
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero'],
        damageType: null,
        title: 'Controlled Attack',
        description: 'Choose an opponent\'s Hero to control its Abilities and active effect this turn.',
        confirmLabel: '🔮 Control!',
        confirmClass: 'btn-danger',
        cancellable: true,
        _skipRedirectCheck: true,
      });

      if (!target) return;

      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!tgtHero) return;

      // Apply controlled status
      tgtHero.controlledBy = pi;

      // Dark control energy animation
      engine._broadcastEvent('dark_control', {
        owner: target.owner,
        heroIdx: target.heroIdx,
      });
      await engine._delay(900);

      engine.log('controlled_attack', {
        player: gs.players[pi]?.username,
        target: tgtHero.name,
        opponent: gs.players[target.owner]?.username,
      });

      engine.sync();
    },
  },
};
