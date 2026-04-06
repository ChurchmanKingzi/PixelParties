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
// ═══════════════════════════════════════════

/**
 * Count free support zones for a player.
 * A zone is free if the sub-array is empty.
 */
function countFreeZones(gs, playerIdx) {
  const ps = gs.players[playerIdx];
  let count = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) count++;
    }
  }
  return count;
}

/**
 * Get list of free support zone descriptors for zone picking.
 */
function getFreeZones(gs, playerIdx) {
  const ps = gs.players[playerIdx];
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) {
        zones.push({ heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
      }
    }
  }
  return zones;
}

module.exports = {
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

      // ── Place Pollution Tokens ──
      const tokensToPlace = hitTargets.length;
      const ps = gs.players[pi];

      for (let t = 0; t < tokensToPlace; t++) {
        const freeZones = getFreeZones(gs, pi);
        if (freeZones.length === 0) break;

        let chosenZone;
        if (freeZones.length === 1) {
          chosenZone = freeZones[0];
        } else {
          const picked = await ctx.promptZonePick(freeZones, {
            title: 'Pyroblast — Pollution',
            description: `Place Pollution Token ${t + 1}/${tokensToPlace} into a free Support Zone.`,
            cancellable: false,
          });
          chosenZone = (picked && freeZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx)) || freeZones[0];
        }

        const hi = chosenZone.heroIdx;
        const si = chosenZone.slotIdx;
        if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
        if (!ps.supportZones[hi][si]) ps.supportZones[hi][si] = [];
        ps.supportZones[hi][si].push('Pollution Token');

        const inst = engine._trackCard('Pollution Token', pi, 'support', hi, si);

        await engine.runHooks('onPlay', {
          _onlyCard: inst, playedCard: inst,
          cardName: 'Pollution Token', zone: 'support', heroIdx: hi, zoneSlot: si,
          _skipReactionCheck: true,
        });
        await engine.runHooks('onCardEnterZone', {
          enteringCard: inst, toZone: 'support', toHeroIdx: hi,
          _skipReactionCheck: true,
        });

        engine.log('pollution_placed', { player: ps.username, heroIdx: hi, zoneSlot: si, by: 'Pyroblast' });
        engine.sync();
        await engine._delay(300);
      }

      await engine._checkReactiveHandLimits(pi);

      engine.log('pyroblast', {
        player: gs.players[pi].username,
        targets: hitTargets.map(t => t.cardName),
        tokensPlaced: tokensToPlace,
      });

      engine.sync();
    },
  },
};
