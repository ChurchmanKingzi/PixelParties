// ═══════════════════════════════════════════
//  CARD EFFECT: "Flame Avalanche"
//  Spell (Destruction Magic Lv3) — Deals 150
//  damage to ALL targets the opponent controls.
//  After resolving, the player cannot deal any
//  more damage to opponent's targets this turn
//  (absolute lock — overrides everything).
//
//  Cannot be played if the player already dealt
//  damage to opponent's targets this turn.
//
//  Uses generic ctx.aoeHit() for target collection,
//  Ida override, animations, and damage.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const ps = ctx.players[ctx.cardOwner];

      // Safety: if already dealt damage this turn, fizzle
      if (ps.dealtDamageToOpponent) return;

      const result = await ctx.aoeHit({
        side: 'enemy',
        types: ['hero', 'creature'],
        damage: 150,
        damageType: 'destruction_spell',
        sourceName: 'Flame Avalanche',
        animationType: 'flame_avalanche',
        singleTargetPrompt: {
          title: 'Flame Avalanche',
          description: 'Ida has to concentrate on one target — choose! Deal 150 damage.',
          confirmLabel: '🔥 150 Damage!',
        },
      });

      // Lock: no more damage to opponent's targets this turn (absolute)
      ps.damageLocked = true;
      ctx._engine.log('damage_locked', { player: ps.username, by: 'Flame Avalanche' });
      ctx._engine.sync();
    },
  },

  /**
   * Play condition: cannot play if player already dealt damage
   * to opponent's targets this turn.
   */
  spellPlayCondition(gs, playerIdx) {
    return !gs.players[playerIdx]?.dealtDamageToOpponent;
  },
};
