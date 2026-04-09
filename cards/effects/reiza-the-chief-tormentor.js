// ═══════════════════════════════════════════
//  CARD EFFECT: "Reiza, the Chief Tormentor"
//  Hero — Decay Magic / Fighting
//
//  1) Whenever this Hero hits exactly 1 target
//     with an Attack, Stun that target for 1
//     turn and apply 1 stack of Poison.
//     Stun and Poison are applied independently
//     (stun immunity does NOT block the Poison).
//
//  2) If ALL living targets the opponent controls
//     are Poisoned, this Hero may perform a
//     second Action after the player's main
//     Action during the Action Phase (once/turn).
//     Player declines by advancing the phase.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ADDITIONAL_TYPE = 'reiza_second_action';

/**
 * Check whether every living target (heroes + creatures) the opponent
 * controls is currently Poisoned. Returns false if no living targets exist.
 */
function allOpponentTargetsPoisoned(gs, oppIdx, engine) {
  const oppPs = gs.players[oppIdx];
  if (!oppPs) return false;

  let hasLivingTarget = false;

  // Heroes
  for (const hero of (oppPs.heroes || [])) {
    if (!hero?.name || hero.hp <= 0) continue;
    hasLivingTarget = true;
    if (!hero.statuses?.poisoned) return false;
  }

  // Creatures in support zones
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    hasLivingTarget = true;
    if (!inst.counters.poisoned) return false;
  }

  return hasLivingTarget;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // ── Effect 1: Single-target Attack → Stun + Poison (independent) ──
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only trigger for cards cast BY this hero
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Must be an Attack
      const spellData = ctx.spellCardData;
      if (!spellData || !hasCardType(spellData, 'Attack')) return;

      // Hero must still be alive
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Exactly 1 unique target was hit
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      const target = targets[0];

      if (target.type === 'hero') {
        const tHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!tHero || tHero.hp <= 0) return;

        // Stun and Poison are INDEPENDENT — one failing doesn't block the other
        await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', {
          duration: 1, appliedBy: pi,
        });
        await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', {
          addStacks: 1, appliedBy: pi,
        });

        engine.log('reiza_torment', {
          target: tHero.name, by: hero.name,
        });
      } else if (target.type === 'equip') {
        const inst = engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst) return;

        // Stun creature (independent of poison)
        if (engine.canApplyCreatureStatus(inst, 'stunned')) {
          inst.counters.stunned = 1;
          inst.counters.stunnedAppliedBy = pi;
          engine.log('status_add', {
            target: inst.name, status: 'stunned', owner: target.owner,
          });
        }

        // Poison creature (independent of stun)
        if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
          if (inst.counters.poisoned) {
            inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
          } else {
            inst.counters.poisoned = 1;
            inst.counters.poisonStacks = 1;
          }
          inst.counters.poisonAppliedBy = pi;
          engine.log('poison_applied', {
            target: inst.name, stacks: inst.counters.poisonStacks,
            by: hero.name,
          });
        }

        engine.log('reiza_torment', {
          target: inst.name, by: hero.name,
        });
      }

      engine.sync();
    },

    // ── Effect 2: Second Action when all opponent targets are Poisoned ──
    onActionUsed: async (ctx) => {
      // Only trigger on the controller's main action (not additional actions)
      if (ctx.isAdditional) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Hero must be alive
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // HOPT — one second action per turn
      if (!ctx.hardOncePerTurn('reiza_second_action')) return;

      // Condition: ALL living opponent targets must be Poisoned
      const oppIdx = pi === 0 ? 1 : 0;
      if (!allOpponentTargetsPoisoned(gs, oppIdx, engine)) return;

      // Register and grant the additional action (hero-restricted to Reiza)
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: hero.name,
        allowedCategories: ['creature', 'spell', 'attack', 'ability_activation'],
        heroRestricted: true,
      });
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);

      // Prevent phase advance so the player stays in Action Phase
      gs._preventPhaseAdvance = true;

      // Show a brief announcement to both players
      engine._broadcastEvent('hero_announcement', {
        text: `${hero.name} may act again!`,
      });

      engine.log('reiza_second_action', {
        player: ps.username, hero: hero.name,
      });

      engine.sync();
    },
  },
};
