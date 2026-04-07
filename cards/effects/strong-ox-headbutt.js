// ═══════════════════════════════════════════
//  CARD EFFECT: "Strong Ox Headbutt"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  Forces opponent to discard 1 card (2 if 2nd
//  Attack this turn). If 3rd Attack and target
//  is a Hero with Abilities, may remove one.
//
//  Animation: ram + 𖤍 + impact particles.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const oppIdx = pi === 0 ? 1 : 0;
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const is2nd = attackNumber === 2;
      const is3rd = attackNumber === 3;

      let desc = `Deal ${baseAtk} base ATK damage. Opponent discards ${is2nd ? 2 : 1}.`;
      if (is3rd) desc += '\n🌟 3rd Attack: May remove an Ability from target!';

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        title: 'Strong Ox Headbutt',
        description: desc,
        confirmLabel: `𖤍 Headbutt! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

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
      engine._broadcastEvent('play_zone_animation', { type: 'ox_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      await engine._delay(200);

      // Deal base ATK damage
      const attackSource = { name: 'Strong Ox Headbutt', owner: pi, heroIdx, controller: pi };

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, baseAtk, 'attack');
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
        }
      }

      // Wait for ram return
      await engine._delay(500);

      // Force opponent to discard (1 normally, 2 if 2nd Attack)
      const discardCount = is2nd ? 2 : 1;
      const oppPs = gs.players[oppIdx];
      if (oppPs && (oppPs.hand || []).length > 0) {
        await engine.actionPromptForceDiscard(oppIdx, discardCount, {
          title: 'Strong Ox Headbutt',
          source: 'Strong Ox Headbutt',
        });
      }

      // 3rd Attack bonus: remove an Ability from target Hero
      if (is3rd && target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          // Check if target hero has any abilities
          const abZones = gs.players[tgtOwner].abilityZones[tgtHeroIdx] || [];
          const abilityTargets = [];
          for (let z = 0; z < abZones.length; z++) {
            const slot = abZones[z] || [];
            if (slot.length > 0) {
              abilityTargets.push({
                id: `ability-${tgtOwner}-${tgtHeroIdx}-${z}`,
                type: 'ability',
                owner: tgtOwner,
                heroIdx: tgtHeroIdx,
                slotIdx: z,
                cardName: slot[slot.length - 1], // Top copy
              });
            }
          }

          if (abilityTargets.length > 0) {
            // Ask player if they want to remove an ability
            const wantsRemove = await engine.promptGeneric(pi, {
              type: 'confirm',
              title: 'Strong Ox Headbutt',
              message: `Remove an Ability from ${targetHero.name}?`,
              confirmLabel: '⚒️ Yes, remove!',
              cancelLabel: 'No',
              cancellable: true,
            });

            if (wantsRemove) {
              // Highlight abilities and let player pick one
              const picked = await engine.promptEffectTarget(pi, abilityTargets, {
                title: 'Strong Ox Headbutt',
                description: `Select an Ability on ${targetHero.name} to remove.`,
                confirmLabel: '⚒️ Remove!',
                confirmClass: 'btn-danger',
                cancellable: true,
                exclusiveTypes: true,
                maxPerType: { ability: 1 },
              });

              if (picked && picked.length > 0) {
                const abilityTarget = abilityTargets.find(t => t.id === picked[0]);
                if (abilityTarget) {
                  const zone = abZones[abilityTarget.slotIdx] || [];
                  if (zone.length > 0) {
                    const removed = zone.pop();
                    const inst = engine.cardInstances.find(c =>
                      c.owner === tgtOwner && c.zone === 'ability' &&
                      c.heroIdx === tgtHeroIdx && c.zoneSlot === abilityTarget.slotIdx && c.name === removed
                    );
                    if (inst) {
                      await engine.runHooks('onCardLeaveZone', { _onlyCard: inst, card: inst, fromZone: 'ability', fromHeroIdx: tgtHeroIdx });
                      engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);
                      gs.players[inst.originalOwner].discardPile.push(removed);
                    } else {
                      gs.players[tgtOwner].discardPile.push(removed);
                    }
                    engine.log('ability_removed', { card: removed, by: 'Strong Ox Headbutt', from: targetHero.name });
                  }
                }
              }
            }
          }
        }
      }

      engine.log('ox_headbutt', { player: ps.username, target: target.cardName, baseAtk, attackNumber });
      engine.sync();
    },
  },
};
