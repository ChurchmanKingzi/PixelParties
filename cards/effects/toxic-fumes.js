// ═══════════════════════════════════════════
//  CARD EFFECT: "Toxic Fumes"
//  Spell (Decay Magic Lv1, Normal)
//
//  Apply 1 Stack of Poison to every Creature on
//  the board (both sides). "Creature" covers any
//  card whose cardType OR subtype contains
//  'Creature' — vanilla Creatures, Token Creatures,
//  Artifact Creatures, etc. Each creature's normal
//  poison-immunity rules still apply.
//
//  Inherent additional Action: while the caster
//  owns at least one non-face-down Creature that
//  currently accepts a Poison stack, the cast
//  doesn't consume the Main/Action-Phase Action.
//
//  Animation: swirling purple gas cloud on every
//  creature instance, via the shared
//  `toxic_fumes_gas` zone animation.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

// Scan own support-zone card instances for any that would currently accept
// a poison stack — that's the trigger for the "additional Action" clause.
function hasPoisonableOwnCreature(gs, pi, engine) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support' || inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (engine.canApplyCreatureStatus(inst, 'poisoned')) return true;
  }
  return false;
}

module.exports = {
  // Inherent action while the caster has at least one non-immune Creature
  // on their board — the effect will land a stack on it, satisfying the
  // "additional Action" clause.
  inherentAction: (gs, pi, _heroIdx, engine) => hasPoisonableOwnCreature(gs, pi, engine),

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // Collect every face-up Creature instance on the board.
      const creatureInsts = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support' || inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        creatureInsts.push(inst);
      }

      if (creatureInsts.length === 0) {
        engine.sync();
        return;
      }

      // Purple toxic gas on every creature — even immune ones still get
      // the visual so the area-wide nature of the effect reads clearly.
      for (const inst of creatureInsts) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'toxic_fumes_gas',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(700);

      // Apply the stacks. actionApplyCreaturePoison respects
      // canApplyCreatureStatus internally, so immune creatures just no-op.
      const source = { name: 'Toxic Fumes', owner: pi };
      for (const inst of creatureInsts) {
        if (inst.zone !== 'support') continue; // could have moved mid-resolve
        await engine.actionApplyCreaturePoison(source, inst);
      }

      engine.log('toxic_fumes', {
        player: gs.players[pi]?.username,
        affected: creatureInsts.length,
      });
      engine.sync();
    },
  },
};
