// ═══════════════════════════════════════════
//  CARD EFFECT: "Poison Pollen"
//  Spell (Decay Magic Lv1, Normal)
//
//  Snapshot all targets on the board, then:
//  - Both Poisoned AND Stunned → +1 Poison stack
//  - Poisoned only → Stun 1 turn
//  - Stunned only → Poison 1 stack
//
//  Animation: purple+yellow spore rain on all
//  targets that qualify, even if immune.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const cardDB = engine._getCardDB();

      // ── Snapshot all targets on the board ──
      const targets = []; // { type, owner, heroIdx, slotIdx?, inst?, isPoisoned, isStunned }

      for (let pIdx = 0; pIdx < 2; pIdx++) {
        const ps = gs.players[pIdx];

        // Heroes
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          targets.push({
            type: 'hero', owner: pIdx, heroIdx: hi,
            isPoisoned: !!hero.statuses?.poisoned,
            isStunned: !!hero.statuses?.stunned,
          });
        }

        // Creatures in support zones
        for (const inst of engine.cardInstances) {
          if (inst.owner !== pIdx || inst.zone !== 'support') continue;
          if (inst.faceDown) continue;
          const cd = cardDB[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          targets.push({
            type: 'creature', owner: pIdx, heroIdx: inst.heroIdx,
            slotIdx: inst.zoneSlot, inst,
            isPoisoned: !!inst.counters.poisoned,
            isStunned: !!inst.counters.stunned,
          });
        }
      }

      // ── Determine which targets are affected ──
      const affected = targets.filter(t => t.isPoisoned || t.isStunned);

      if (affected.length === 0) {
        engine.sync();
        return;
      }

      // ── Play animation on all affected targets ──
      for (const t of affected) {
        const slot = t.type === 'hero' ? -1 : t.slotIdx;
        engine._broadcastEvent('play_zone_animation', {
          type: 'poison_pollen_rain', owner: t.owner,
          heroIdx: t.heroIdx, zoneSlot: slot,
        });
      }
      await engine._delay(600);

      // ── Apply effects based on snapshot ──
      for (const t of targets) {
        const isBoth = t.isPoisoned && t.isStunned;
        const poisonedOnly = t.isPoisoned && !t.isStunned;
        const stunnedOnly = t.isStunned && !t.isPoisoned;

        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!hero?.name || hero.hp <= 0) continue;

          if (isBoth) {
            // +1 Poison stack
            await engine.addHeroStatus(t.owner, t.heroIdx, 'poisoned', {
              addStacks: 1, appliedBy: pi,
            });
            engine.log('poison_pollen_boost', { target: hero.name, by: 'Poison Pollen' });
          } else if (poisonedOnly) {
            // Stun 1 turn
            await engine.addHeroStatus(t.owner, t.heroIdx, 'stunned', {
              duration: 1, appliedBy: pi,
            });
          } else if (stunnedOnly) {
            // Poison 1 stack (fresh application)
            await engine.addHeroStatus(t.owner, t.heroIdx, 'poisoned', {
              stacks: 1, appliedBy: pi,
            });
          }
        } else if (t.type === 'creature') {
          const inst = t.inst;
          if (!inst || inst.zone !== 'support') continue;

          if (isBoth) {
            // +1 Poison stack
            if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
              inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
              inst.counters.poisonAppliedBy = pi;
              engine.log('poison_pollen_boost', { target: inst.name, by: 'Poison Pollen' });
            }
          } else if (poisonedOnly) {
            // Stun 1 turn
            if (engine.canApplyCreatureStatus(inst, 'stunned')) {
              inst.counters.stunned = 1;
              inst.counters.stunnedAppliedBy = pi;
              engine.log('status_add', { target: inst.name, status: 'stunned', owner: t.owner });
            }
          } else if (stunnedOnly) {
            // Poison 1 stack
            if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
              if (inst.counters.poisoned) {
                inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
              } else {
                inst.counters.poisoned = 1;
                inst.counters.poisonStacks = 1;
              }
              inst.counters.poisonAppliedBy = pi;
              engine.log('poison_applied', { target: inst.name, stacks: inst.counters.poisonStacks, by: 'Poison Pollen' });
            }
          }
        }
      }

      engine.log('poison_pollen', { player: gs.players[pi]?.username, affected: affected.length });
      engine.sync();
    },
  },
};
