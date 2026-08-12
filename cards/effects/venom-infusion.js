// ═══════════════════════════════════════════
//  CARD EFFECT: "Venom Infusion"
//  Spell (Decay Magic Lv1)
//
//  Apply 1 stack of Poison to a target Hero
//  or Creature. If the caster has Decay Magic
//  Lv3, the Poison becomes "Unhealable Poison"
//  — it cannot be removed by any effect
//  (cleanse, status removal, blanket purge).
//  Only the afflicted target dying or leaving
//  the game removes it.
//
//  Animation: thick sickly green fog.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  cpuMeta: { scalesWithSchool: 'Decay Magic' },
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Prompt for target — Hero or Creature, either side
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'status',
        dealsDamage: false, // Poison only — no damage; don't wake damage-mitigation Reactions (Spectral Armor)
        title: 'Venom Infusion',
        // Statusangabe fuer den LERNKANAL (Als Vorgabe 9.8.): diese Karte
        // traegt Schaden UND Status. Das Ziel-Gate filtert deshalb NICHT —
        // `classifyTargetTags` stempelt stattdessen `stat:sticks` bzw.
        // `stat:blocked`, damit `targetPriors` je Karte lernt, wie stark
        // das Haften die Schadens-Rangfolge verschiebt.
        appliesStatus: 'poisoned',
        description: 'Apply 1 stack of Poison to a Hero or Creature.',
        confirmLabel: '☠️ Infuse!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (!target) return;

      // Caster-aware Decay Magic level — honours engine overrides
      // (Demon's Gate "as if Decay Magic 3").
      const decayLevel = engine.effectiveSchoolLevelForCaster('Decay Magic', pi, heroIdx);
      const isUnhealable = decayLevel >= 3;

      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (!tgtHero || tgtHero.hp <= 0) return;

        // Green fog animation on target hero
        engine._broadcastEvent('play_zone_animation', {
          type: 'venom_fog', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: -1,
        });
        await engine._delay(500);

        await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', {
          addStacks: 1,
          appliedBy: pi,
          unhealable: isUnhealable || undefined,
        });

        engine.log('venom_infusion', {
          player: ps.username, hero: hero.name,
          target: tgtHero.name,
          unhealable: isUnhealable,
        });

        if (isUnhealable) {
          engine._broadcastEvent('play_skull_burst', {
            owner: target.owner, heroIdx: target.heroIdx,
          });
          await engine._delay(1200);
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (!inst) return;

        // Green fog animation on target creature's zone
        engine._broadcastEvent('play_zone_animation', {
          type: 'venom_fog', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
        await engine._delay(500);

        await engine.actionApplyCreaturePoison(
          { name: 'Venom Infusion', owner: pi, heroIdx }, inst,
        );

        // Stamp unhealable flag on the creature (same semantics as heroes —
        // once unhealable, always unhealable).
        if (isUnhealable && inst.counters?.poisoned) {
          inst.counters.poisonedUnhealable = true;
        }

        engine.log('venom_infusion', {
          player: ps.username, hero: hero.name,
          target: inst.name,
          unhealable: isUnhealable,
        });

        if (isUnhealable) {
          engine._broadcastEvent('play_skull_burst', {
            owner: target.owner, heroIdx: target.heroIdx,
            zoneSlot: target.slotIdx,
          });
          await engine._delay(1200);
        }
      }

      engine.sync();
    },
  },
};
