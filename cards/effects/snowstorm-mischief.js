// ═══════════════════════════════════════════
//  CARD EFFECT: "Snowstorm Mischief"
//  Spell — Decay Magic Lv1
//
//  Freeze all Creatures on the board for 2 turns.
//  Hero targets are ignored (rules text reads
//  "all Creatures"). Iterates every face-up
//  Creature in a support zone and applies the
//  status via the standard creature-status gate
//  (Cardinal/omni-immune/Gate-shield/freeze_immune
//  / Sparkfly opp-immune all honoured).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Snowstorm Mischief';

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // Collect every face-up Creature in support zones on both sides.
      const targets = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push(inst);
      }

      if (targets.length === 0) {
        engine.log('snowstorm_mischief_no_targets', { player: engine.gs.players[pi]?.username });
        engine.sync();
        return;
      }

      // Per-target freeze via the centralised helper (handles immunity,
      // animation, and onStatusApplied hook fire so listeners like
      // Bear Rider's hand-level recompute and Chilly Wizard's mirror
      // observe each freeze).
      let frozenCount = 0;
      for (const inst of targets) {
        const applied = await engine.applyCreatureStatus(inst, 'frozen', {
          duration: 2,
          sourceOwner: pi,
          source: CARD_NAME,
          animationType: 'ice_encase',
        });
        if (applied) frozenCount++;
      }
      await engine._delay(400);

      engine.log('snowstorm_mischief', {
        player: engine.gs.players[pi]?.username,
        frozen: frozenCount,
      });
      engine.sync();
    },
  },
};
