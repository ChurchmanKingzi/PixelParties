// ═══════════════════════════════════════════
//  CARD EFFECT: "Phoenix Tackle"
//  Spell (Destruction Magic Lv1) — Choose a
//  target and deal 100/200/300 damage based on
//  the caster's Destruction Magic level (with
//  Performance). Then the caster takes half that
//  damage as recoil (type 'other'). Caster CAN
//  die to recoil.
//
//  Damage scaling:
//    Lv 0 → 100  (shouldn't happen, needs Lv1)
//    Lv 1 → 100
//    Lv 2 → 200
//    Lv 3+ → 300
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = ctx.players[pi];
      const heroIdx = ctx.cardHeroIdx;
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Count Destruction Magic level on this hero (with Performance)
      const abZones = ps.abilityZones[heroIdx] || [];
      let dmLevel = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        const base = slot[0];
        for (const ab of slot) {
          if (ab === 'Destruction Magic') dmLevel++;
          else if (ab === 'Performance' && base === 'Destruction Magic') dmLevel++;
        }
      }

      // Calculate damage: 100/200/300
      const damage = dmLevel >= 3 ? 300 : dmLevel >= 2 ? 200 : 100;
      const recoil = Math.floor(damage / 2);

      // Target picker
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: damage,
        title: 'Phoenix Tackle',
        description: `Deal ${damage} damage to a target. You take ${recoil} recoil damage.`,
        confirmLabel: `🔥 ${damage} Tackle!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      // Play phoenix ram animation: hero engulfed in flames, charges to target, returns
      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Engulf caster in flames
      engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });
      await engine._delay(200);

      // Ram: hero flies to target and back
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200,
      });
      await engine._delay(150); // Hero reaches target at ~12% of 1200ms

      // Fire impact on target at moment of contact
      if (target.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: -1 });
      } else {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: target.slotIdx });
      }
      await engine._delay(200);

      // Deal damage to target
      if (target.type === 'hero') {
        const tgtHero = ctx.players[tgtOwner].heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, damage, 'destruction_spell');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Phoenix Tackle', owner: pi, heroIdx },
            inst, damage, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true }
          );
        }
      }

      engine.sync();
      await engine._delay(300);

      // Recoil damage to caster
      if (hero.hp > 0) {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1 });
        await engine._delay(200);
        await ctx.dealDamage(hero, recoil, 'other');
        engine.sync();
      }
    },
  },
};
