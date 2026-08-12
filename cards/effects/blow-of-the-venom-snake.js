// ═══════════════════════════════════════════
//  CARD EFFECT: "Blow of the Venom Snake"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  If the target is NOT already Poisoned,
//  inflict Poison (1 stack, 2 if 2nd Attack,
//  3 if 3rd Attack this turn).
//
//  Animation: ram + 🐍 + impact particles.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
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
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const poisonStacks = attackNumber >= 3 ? 3 : attackNumber >= 2 ? 2 : 1;

      let desc = `Deal ${baseAtk} base ATK damage. Poison target (${poisonStacks} stack${poisonStacks > 1 ? 's' : ''} = ${poisonStacks * 30} dmg/turn).`;

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        baseDamage: baseAtk,
        title: 'Blow of the Venom Snake',
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'poisoned',
        description: desc,
        confirmLabel: `🐍 Strike! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: 'Blow of the Venom Snake', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, baseAtk);

      // Ram animation
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200,
      });
      await engine._delay(150);

      // Impact
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', { type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      engine._broadcastEvent('play_zone_animation', { type: 'snake_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      await engine._delay(200);

      // Deal base ATK damage. Capture cancellation so the poison
      // rider below skips when the hit was fully negated (Idej
      // Projection discard, Spectral Armor zero-cap, Anti Magic
      // magic_immune void, Spider Silk Bridge redirect-to-nowhere,
      // etc.). The "and all associated effects" clause on full-
      // negation reactions covers riders attached to the same Attack.
      let damageCancelled = false;
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          const r = await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
          damageCancelled = !!r?.cancelled;
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          const r = await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
          damageCancelled = !!r?.cancelled;
        }
      }

      // Wait for ram return
      await engine._delay(500);

      // Skip the poison rider when the damage was fully negated by a
      // reaction — "negate that damage AND all associated effects".
      if (damageCancelled) {
        engine.log('venom_snake_rider_skipped', { reason: 'damage_cancelled' });
        engine.sync();
        return;
      }

      // Poison the target if not already Poisoned
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0 && !targetHero.statuses?.poisoned) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
            appliedBy: pi,
            stacks: poisonStacks,
            animationType: 'poison_splash',
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && !inst.counters.poisoned) {
          // Animation plays unconditionally — visible splash on
          // Cardinal-immune / shielded targets even when the status
          // application fizzles in the gate below.
          engine._broadcastEvent('play_zone_animation', {
            type: 'poison_splash', owner: tgtOwner,
            heroIdx: tgtHeroIdx, zoneSlot: target.slotIdx,
          });
          const applied = await engine.applyCreatureStatus(inst, 'poisoned', {
            stacks: poisonStacks,
            sourceOwner: pi,
            source: 'Blow of the Venom Snake',
          });
          if (applied) engine.log('poison_applied', { target: inst.name, by: 'Blow of the Venom Snake', stacks: poisonStacks });
        }
      }

      engine.log('venom_snake', { player: ps.username, target: target.cardName, baseAtk, attackNumber, poisonStacks });
      engine.sync();
    },
  },
};
