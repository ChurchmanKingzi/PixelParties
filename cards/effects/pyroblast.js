// ═══════════════════════════════════════════
//  CARD EFFECT: "Pyroblast"
//  Spell (Destruction Magic Lv0) — HOPT
//
//  Choose up to N targets (where N = free
//  Support Zones you control) and deal 100
//  Destruction Spell damage to each.
//  Then place one Pollution Token per target
//  hit into your free Support Zones.
//
//  The player picks zones one-by-one for each
//  Pollution Token placement.
//
//  Refactored to use _pollution-shared.js for
//  zone counting and token placement — no
//  card-specific Pollution logic remains here.
// ═══════════════════════════════════════════

const { countFreeZones, placePollutionTokens } = require('./_pollution-shared');

module.exports = {
  placesPollutionTokens: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // HOPT check
      if (!ctx.hardOncePerTurn('pyroblast')) return;

      // Count free support zones — this caps the number of targets
      const maxTargets = countFreeZones(gs, pi);
      if (maxTargets === 0) {
        engine.log('pyroblast_fizzle', { player: gs.players[pi].username, reason: 'no_free_zones' });
        return;
      }

      // ── Multi-target selection ──
      const hitTargets = await ctx.promptMultiTarget({
        side: 'any',
        types: ['hero', 'creature'],
        max: maxTargets,
        min: 1,
        title: 'Pyroblast',
        description: `Select up to ${maxTargets} target${maxTargets > 1 ? 's' : ''} to deal 100 damage each.`,
        confirmLabel: '🔥 Pyroblast!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (hitTargets.length === 0) return; // Cancelled

      // ── Fire animations on all targets simultaneously ──
      for (const target of hitTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: target.owner,
          heroIdx: target.heroIdx,
          zoneSlot: target.type === 'equip' ? target.slotIdx : -1,
        });
      }

      await engine._delay(400);

      // ── Deal damage to ALL targets — heroes individually, creatures batched ──
      const creatureBatch = [];
      for (const target of hitTargets) {
        if (target.type === 'hero') {
          const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (hero && hero.hp > 0) {
            await ctx.dealDamage(hero, 100, 'destruction_spell');
          }
        } else if (target.type === 'equip') {
          const inst = target.cardInstance || engine.cardInstances.find(c =>
            c.owner === target.owner && c.zone === 'support' &&
            c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
          );
          if (inst) {
            creatureBatch.push({
              inst, amount: 100, type: 'destruction_spell',
              source: { name: 'Pyroblast', owner: pi, heroIdx },
              sourceOwner: pi, canBeNegated: true,
              isStatusDamage: false, animType: null,
            });
          }
        }
      }

      // Process all creature damage as a single batch
      if (creatureBatch.length > 0) {
        await engine.processCreatureDamageBatch(creatureBatch);
      }

      // Single sync after all damage — damage numbers appear simultaneously
      engine.sync();
      await engine._delay(400);

      // ── Place Pollution Tokens (shared helper handles zone-pick loop,
      //    hook firing, logging, and _checkReactiveHandLimits) ──
      const { placed } = await placePollutionTokens(engine, pi, hitTargets.length, 'Pyroblast', {
        promptCtx: ctx,
      });

      engine.log('pyroblast', {
        player: gs.players[pi].username,
        targets: hitTargets.map(t => t.cardName),
        tokensPlaced: placed,
      });

      engine.sync();
    },
  },
};
