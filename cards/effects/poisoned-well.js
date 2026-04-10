// ═══════════════════════════════════════════
//  CARD EFFECT: "Poisoned Well"
//  Spell (Decay Magic Lv3, Normal)
//
//  Inflict 1 Stack of Poison to all targets
//  your opponent controls (Heroes + Creatures).
//
//  Animation: purple water + steam on all
//  affected targets.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs = gs.players[oppIdx];
      const cardDB = engine._getCardDB();

      // Collect all opponent targets
      const targets = [];

      // Opponent heroes
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const h = oppPs.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        targets.push({ type: 'hero', owner: oppIdx, heroIdx: hi });
      }

      // Opponent creatures
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({ type: 'creature', owner: oppIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, inst });
      }

      if (targets.length === 0) return;

      // Play purple water animation on all targets simultaneously
      for (const t of targets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'poisoned_well',
          owner: t.owner,
          heroIdx: t.heroIdx,
          zoneSlot: t.type === 'creature' ? t.slotIdx : -1,
        });
      }
      await engine._delay(600);

      // Apply 1 stack of Poison to each target
      for (const t of targets) {
        if (t.type === 'hero') {
          await engine.addHeroStatus(t.owner, t.heroIdx, 'poisoned', {
            addStacks: 1,
            appliedBy: pi,
          });
        } else if (t.type === 'creature' && t.inst) {
          if (engine.canApplyCreatureStatus(t.inst, 'poisoned')) {
            if (t.inst.counters.poisoned) {
              t.inst.counters.poisonStacks = (t.inst.counters.poisonStacks || 1) + 1;
            } else {
              t.inst.counters.poisoned = 1;
              t.inst.counters.poisonStacks = 1;
            }
            t.inst.counters.poisonAppliedBy = pi;
            engine.log('poison_applied', {
              target: t.inst.name, stacks: t.inst.counters.poisonStacks,
              by: hero.name,
            });
          }
        }
      }

      engine.log('poisoned_well', {
        player: ps.username, hero: hero.name,
        targets: targets.length,
      });

      engine.sync();
    },
  },
};
