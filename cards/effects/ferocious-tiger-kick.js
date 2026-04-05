// ═══════════════════════════════════════════
//  CARD EFFECT: "Ferocious Tiger Kick"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  Stuns the target for 1 turn.
//
//  2nd Attack this turn: heal attacker for
//    the full damage dealt.
//  3rd Attack this turn: Stun bypasses the
//    Immune status (post-CC immunity).
//
//  Animation: ram into target + 🐯 fade.
// ═══════════════════════════════════════════

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

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1; // +1 for this attack
      const is2nd = attackNumber === 2;
      const is3rd = attackNumber === 3;

      let desc = `Deal ${baseAtk} base ATK damage and Stun.`;
      if (is2nd) desc += '\n🌟 2nd Attack: Heal for damage dealt!';
      if (is3rd) desc += '\n🌟 3rd Attack: Stun bypasses Immune!';

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        title: 'Ferocious Tiger Kick',
        description: desc,
        confirmLabel: `🐯 Tiger Kick! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return; // Cancelled

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Ram animation: hero charges to target and back
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200,
      });
      await engine._delay(150); // Hero reaches target

      // Impact effect on target at moment of contact
      const impactZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', { type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactZoneSlot });
      engine._broadcastEvent('play_zone_animation', { type: 'tiger_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactZoneSlot });
      await engine._delay(200);

      // Deal base ATK damage with type 'attack' (equipment hooks fire)
      const attackSource = { name: 'Ferocious Tiger Kick', owner: pi, heroIdx, controller: pi };
      let dealt = 0;

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const result = await engine.actionDealDamage(attackSource, targetHero, baseAtk, 'attack');
          dealt = result?.dealt || 0;
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, baseAtk, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          dealt = baseAtk;
        }
      }

      // 2nd Attack bonus: heal attacker for damage dealt
      if (is2nd && dealt > 0 && hero.hp > 0) {
        const healAmount = Math.min(dealt, hero.maxHp - hero.hp);
        if (healAmount > 0) {
          hero.hp += healAmount;
          engine._broadcastEvent('play_zone_animation', { type: 'heal_sparkle', owner: pi, heroIdx, zoneSlot: -1 });
          engine.log('tiger_kick_heal', { hero: hero.name, amount: healAmount });
        }
      }

      // Apply Stun to target
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'stunned', {
            appliedBy: pi,
            animationType: 'electric_strike',
            bypassImmune: is3rd, // 3rd Attack: bypass Immune status
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && engine.canApplyCreatureStatus(inst, 'stunned')) {
          inst.counters.stunned = 1;
          engine._broadcastEvent('play_zone_animation', {
            type: 'electric_strike', owner: tgtOwner,
            heroIdx: tgtHeroIdx, zoneSlot: target.slotIdx,
          });
          engine.log('stun', { target: inst.name, by: 'Ferocious Tiger Kick', type: 'creature' });
        }
      }

      // Wait for ram return animation
      await engine._delay(600);

      engine.log('tiger_kick', {
        player: ps.username, target: target.cardName,
        baseAtk, dealt, attackNumber, healed: is2nd, bypassedImmune: is3rd,
      });
      engine.sync();
    },
  },
};
