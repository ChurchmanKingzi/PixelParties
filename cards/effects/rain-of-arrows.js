// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Arrows"
//  Spell (Destruction Magic Lv1) — Deals damage
//  equal to 30 × total Creatures you control to
//  ALL targets the opponent controls.
//  Damage type: destruction_spell.
//  No damage lock or restrictions.
//
//  If played through a Hero with forcesSingleTarget
//  (Ida), becomes single-target instead of AoE.
//
//  Animation: arrows raining from the sky.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs = ctx.players[oppIdx];
      const heroIdx = ctx.cardHeroIdx;

      // Count ALL creatures the player controls
      const creatureCount = engine.cardInstances.filter(inst =>
        inst.owner === pi && inst.zone === 'support'
      ).length;

      const damage = 30 * creatureCount; // Can be 0 — spell still visually happens

      // Check Ida's single-target override
      const gs = ctx.gameState;
      const heroFlags = gs.heroFlags?.[`${pi}-${heroIdx}`];
      const singleTarget = heroFlags?.forcesSingleTarget;

      if (singleTarget) {
        // ── SINGLE-TARGET MODE (Ida) ──
        const target = await ctx.promptDamageTarget({
          side: 'enemy',
          types: ['hero', 'creature'],
          damageType: 'destruction_spell',
          title: 'Rain of Arrows',
          description: damage > 0
            ? `Ida has to concentrate on one target — choose! Deal ${damage} damage (30 × ${creatureCount} Creature${creatureCount !== 1 ? 's' : ''}).`
            : 'Ida has to concentrate on one target — choose! (0 Creatures — no damage)',
          confirmLabel: damage > 0 ? `⬇️ ${damage} Damage!` : '⬇️ Fire!',
          confirmClass: 'btn-danger',
          cancellable: false,
        });

        if (!target) return;

        // Play arrow rain animation on single target (always, even at 0 damage)
        if (target.type === 'hero') {
          engine._broadcastEvent('play_zone_animation', { type: 'arrow_rain', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1 });
        } else {
          engine._broadcastEvent('play_zone_animation', { type: 'arrow_rain', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
        }
        await engine._delay(400);

        // Deal damage (only if > 0)
        if (damage > 0) {
          if (target.type === 'hero') {
            const hero = oppPs.heroes?.[target.heroIdx];
            if (hero && hero.hp > 0) {
              await ctx.dealDamage(hero, damage, 'destruction_spell');
            }
          } else if (target.type === 'equip') {
            const inst = target.cardInstance || engine.cardInstances.find(c =>
              c.owner === target.owner && c.zone === 'support' &&
              c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
            );
            if (inst) {
              await engine.actionDealCreatureDamage(
                { name: 'Rain of Arrows', owner: pi, heroIdx },
                inst, damage, 'destruction_spell',
                { sourceOwner: pi, canBeNegated: true }
              );
            }
          }
        }
      } else {
        // ── AoE MODE (normal) ──
        // Collect ALL opponent targets for animation (including shielded)
        const allHeroes = [];
        const damageableHeroes = [];
        for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
          const hero = oppPs.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          allHeroes.push({ heroIdx: hi, hero });
          if (!hero.statuses?.shielded) damageableHeroes.push({ heroIdx: hi, hero });
        }

        const creatureEntries = [];
        for (const inst of engine.cardInstances) {
          if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
          creatureEntries.push({
            inst,
            amount: damage,
            type: 'destruction_spell',
            source: { name: 'Rain of Arrows', owner: pi, heroIdx },
            sourceOwner: pi,
            canBeNegated: true,
            isStatusDamage: false,
            animType: 'arrow_rain',
          });
        }

        // Play arrow rain on ALL targets (including shielded — animation always plays)
        for (const { heroIdx: hi } of allHeroes) {
          engine._broadcastEvent('play_zone_animation', { type: 'arrow_rain', owner: oppIdx, heroIdx: hi, zoneSlot: -1 });
        }
        // Creature animations handled by batch animType, but if 0 damage, play manually
        if (damage === 0) {
          for (const e of creatureEntries) {
            engine._broadcastEvent('play_zone_animation', { type: 'arrow_rain', owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot });
          }
        }
        if (allHeroes.length > 0 || creatureEntries.length > 0) {
          await engine._delay(400);
        }

        // Deal damage to damageable heroes (only if > 0)
        if (damage > 0) {
          for (const { hero } of damageableHeroes) {
            await ctx.dealDamage(hero, damage, 'destruction_spell');
            engine.sync();
            await engine._delay(150);
          }

          // Deal damage to all opponent creatures via batch
          if (creatureEntries.length > 0) {
            await engine.processCreatureDamageBatch(creatureEntries);
          }
        }
      }

      engine.log('rain_of_arrows', { damage, creatureCount, player: ctx.players[pi].username });
      engine.sync();
    },
  },
};
