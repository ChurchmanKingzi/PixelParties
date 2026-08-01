// ═══════════════════════════════════════════
//  CARD EFFECT: "The Warlord's Bite"
//  Spell (Decay Magic Lv1)
//
//  Choose a target (Hero or Creature, friend
//  or foe) that is NOT already Poisoned and
//  inflict Poison Stacks based on the caster's
//  combined Decay Magic + Performance level:
//    Lv1: 1 stack
//    Lv2: 2 stacks
//    Lv3: 4 stacks
//
//  Animation: snake bite → purple poison liquid.
// ═══════════════════════════════════════════

module.exports = {

  /**
   * Als Venom-Swamp-Befund: die CPU castete Bite, wenn NUR die eigenen
   * Helden unvergiftet waren, und musste sich dann selbst vergiften
   * (Iter1: 102 von 421 Zielen eigene Seite). CPU-ONLY-Gate über
   * cpuShouldPlay — bewusst NICHT spellPlayCondition, das würde die
   * Karte auch für MENSCHEN grauen (Client-Regel "unplayable must look
   * unplayable") und die legitime absichtliche Selbstvergiftung
   * (Fiona-Selbst-Status-Synergie) verbieten. Die CPU spielt Bite erst,
   * wenn mindestens EIN gegnerisches Ziel unvergiftet ist; mit
   * verfügbarem Gegner-Ziel wägt die Zielwahl weiter frei ab.
   */
  cpuShouldPlay(engine, pi) {
    try {
      const gs = engine.gs;
      const opp = 1 - pi;
      const ops = gs.players?.[opp];
      if (!ops) return true;
      for (const h of (ops.heroes || [])) {
        if (h && h.name && h.hp > 0 && !h.statuses?.poisoned) return true;
      }
      for (const inst of (engine.cardInstances || [])) {
        if (inst.owner !== opp || inst.zone !== 'support' || inst.faceDown) continue;
        if (!inst.counters?.poisoned) return true;
      }
      return false;
    } catch { return true; }
  },
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

      // Determine combined Decay Magic + Performance level. Decay
      // Magic is caster-aware (Demon's Gate sets a "as if Decay Magic 3"
      // override) — Performance is read from the actual host hero's
      // ability zones, never overridden.
      const decayLevel = engine.effectiveSchoolLevelForCaster('Decay Magic', pi, heroIdx);
      const abZones = ps.abilityZones[heroIdx] || [];
      const perfLevel = engine.countAbilitiesForSchool('Performance', abZones);
      const combinedLevel = decayLevel + perfLevel;
      const stacks = combinedLevel >= 3 ? 4 : combinedLevel >= 2 ? 2 : 1;

      // Prompt for target — only unpoisoned heroes/creatures.
      // This effect deals NO damage (Poison only), so it must NOT
      // wake damage-mitigation post-target Reactions like Spectral
      // Armor ("when a target you control would take damage").
      // `dealsDamage:false` is the load-bearing signal the single-
      // target post-target reaction gate honours; `damageType:'status'`
      // is the documented convention for status-application pickers.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'status',
        dealsDamage: false,
        title: "The Warlord's Bite",
        description: `Inflict ${stacks} Poison Stack${stacks > 1 ? 's' : ''} to an unpoisoned target.`,
        confirmLabel: `🐍 Bite! (${stacks} stack${stacks > 1 ? 's' : ''})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => {
          // Filter out already-poisoned targets
          if (t.type === 'hero') {
            const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
            return h && !h.statuses?.poisoned;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.poisoned;
          }
          return true;
        },
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Snake/bat bite animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'warlord_bite', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(600);

      // Purple poison ooze animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'poison_ooze', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(400);

      // Apply poison
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
            addStacks: stacks,
            appliedBy: pi,
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          const applied = await engine.applyCreatureStatus(inst, 'poisoned', {
            stacks,
            sourceOwner: pi,
            source: "The Warlord's Bite",
          });
          if (applied) engine.log('poison_applied', {
            target: inst.name, by: "The Warlord's Bite", stacks,
          });
        }
      }

      engine.log('warlords_bite', {
        player: ps.username, hero: hero.name,
        target: target.cardName, stacks, combinedLevel,
      });

      engine.sync();
    },
  },
};
