// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Arrows"
//  Spell (Destruction Magic Lv1) — Deals damage
//  equal to 30 × total Creatures you control to
//  ALL targets the opponent controls.
//  Damage type: destruction_spell.
//  No damage lock or restrictions.
//
//  Uses generic ctx.aoeHit() for target collection,
//  Ida override, animations, and damage.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Count ALL creatures the player controls (Creature/Token types only)
      const cardDB = engine._getCardDB();
      const creatureCount = engine.cardInstances.filter(inst => {
        if (inst.owner !== pi || inst.zone !== 'support') return false;
        const cd = cardDB[inst.name];
        return cd && (cd.cardType === 'Creature' || cd.cardType === 'Token');
      }).length;

      const damage = 30 * creatureCount; // Can be 0 — spell still visually happens

      await ctx.aoeHit({
        side: 'enemy',
        types: ['hero', 'creature'],
        damage,
        damageType: 'destruction_spell',
        sourceName: 'Rain of Arrows',
        animationType: 'arrow_rain',
        singleTargetPrompt: {
          title: 'Rain of Arrows',
          description: damage > 0
            ? `Ida has to concentrate on one target — choose! Deal ${damage} damage (30 × ${creatureCount} Creature${creatureCount !== 1 ? 's' : ''}).`
            : 'Ida has to concentrate on one target — choose! (0 Creatures — no damage)',
          confirmLabel: damage > 0 ? `⬇️ ${damage} Damage!` : '⬇️ Fire!',
          cancellable: false,
        },
      });

      engine.log('rain_of_arrows', { damage, creatureCount, player: ctx.players[pi].username });
      engine.sync();
    },
  },
};
