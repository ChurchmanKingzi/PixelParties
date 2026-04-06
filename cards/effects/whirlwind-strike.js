// ═══════════════════════════════════════════
//  CARD EFFECT: "Whirlwind Strike"
//  Attack (Fighting Lv3, Normal)
//  Choose up to 2 opponent Heroes. Deal ATK
//  damage to those Heroes AND all Creatures
//  in their Support Zones.
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
      const oppIdx = pi === 0 ? 1 : 0;
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atkDamage = hero.atk || 0;

      // Use generic targeting: up to 2 enemy heroes
      const selectedHeroes = await ctx.promptMultiTarget({
        types: ['hero'],
        side: 'enemy',
        max: 2,
        title: 'Whirlwind Strike',
        description: `Deal ${atkDamage} damage to up to 2 Heroes and all their Creatures.`,
        confirmLabel: `🌪️ Whirlwind! (${atkDamage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (selectedHeroes.length === 0) return;

      // ── ANIMATION: spin up on attacker ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'whirlwind_spin', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      const attackSource = { name: 'Whirlwind Strike', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const cardDB = engine._getCardDB();

      // ── Collect ALL damage targets first, then process ──
      const heroDamageTargets = [];
      const allCreatureEntries = [];

      for (const tgt of selectedHeroes) {
        const tgtHero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          heroDamageTargets.push({ hero: tgtHero, tgt });
        }

        // Find Creatures in this hero's support zone via cardInstances
        for (const inst of engine.cardInstances) {
          if (inst.owner !== tgt.owner) continue;
          if (inst.zone !== 'support') continue;
          if (inst.heroIdx !== tgt.heroIdx) continue;
          // Check cardType from DB
          const cd = cardDB[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          allCreatureEntries.push({
            inst, amount: atkDamage, type: 'attack',
            source: attackSource, sourceOwner: pi,
            canBeNegated: true,
            tgtHeroIdx: tgt.heroIdx,
          });
        }
      }

      // ── RAM + DAMAGE per hero target ──
      for (let ti = 0; ti < heroDamageTargets.length; ti++) {
        const { hero: tgtHero, tgt } = heroDamageTargets[ti];

        // Fast ram
        engine._broadcastEvent('play_ram_animation', {
          sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
          targetOwner: tgt.owner, targetHeroIdx: tgt.heroIdx,
          cardName: hero.name, duration: 800,
        });
        await engine._delay(100);

        // Explosion on hero
        engine._broadcastEvent('play_zone_animation', {
          type: 'explosion', owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: -1,
        });

        // Deal damage to the hero
        await engine.actionDealDamage(attackSource, tgtHero, atkDamage, 'attack');

        // Brief pause before second target
        if (ti < heroDamageTargets.length - 1) {
          await engine._delay(200);
        }
      }

      // ── Creature damage (all at once via batch) ──
      if (allCreatureEntries.length > 0) {
        // Play explosion on each creature zone
        for (const e of allCreatureEntries) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'explosion', owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot,
          });
        }
        await engine.processCreatureDamageBatch(allCreatureEntries);
      }

      // Wait for ram return + spin down
      await engine._delay(500);

      engine.log('whirlwind_strike', {
        player: ps.username,
        targets: selectedHeroes.map(t => t.cardName),
        atkDamage,
        heroCount: heroDamageTargets.length,
        creatureCount: allCreatureEntries.length,
      });
      engine.sync();
    },
  },
};
