// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Arrows"
//  Spell (Destruction Magic Lv1) — Deals damage
//  equal to 30 × total Creatures you control to
//  ALL targets the opponent controls.
//  Damage type: destruction_spell.
//  Hard once per turn (1 Rain of Arrows per turn).
//
//  Uses generic ctx.aoeHit() for target collection,
//  Ida override, animations, and damage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const HOPT_KEY = 'rain-of-arrows';

module.exports = {
  /**
   * Hand-dim + cast gate. The engine reads this both when computing
   * "blocked from hand" (greys the card if false) and when
   * validating a play attempt server-side, so a HOPT'd Rain of
   * Arrows can't sneak past either path.
   */
  spellPlayCondition(gs, pi) {
    return gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] !== gs.turn;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Stamp HOPT at the start of resolve. A negated cast (Cute
      // Camera, Ragnarock, etc.) prevents `onPlay` from firing
      // entirely, so the slot stays free — matching the codebase's
      // existing convention for spell HOPT (Acid Vial does the same).
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      engine.gs.hoptUsed[`${HOPT_KEY}:${pi}`] = engine.gs.turn;

      // Count ALL creatures the player controls (Creature/Token types only)
      const cardDB = engine._getCardDB();
      const creatureCount = engine.cardInstances.filter(inst => {
        if (inst.controller !== pi || inst.zone !== 'support') return false;
        if (inst.faceDown) return false;
        const cd = cardDB[inst.name];
        return cd && hasCardType(cd, 'Creature');
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
