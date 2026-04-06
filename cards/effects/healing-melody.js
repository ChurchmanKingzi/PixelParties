// ═══════════════════════════════════════════
//  CARD EFFECT: "Healing Melody"
//  Spell (Support Magic Lv2, Normal)
//  Heal ALL targets you control (Heroes and
//  Creatures) for 100/150/200 HP based on the
//  caster's total Support Magic level.
//
//  No targeting required — automatically heals
//  every friendly hero and creature.
//
//  Animation: staggered music notes around all
//  friendly targets (even if they can't be healed),
//  followed by heal sparkles on impact.
// ═══════════════════════════════════════════

module.exports = {
  includesHealing: true,
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroOwner = ctx.cardHeroOwner;
      const heroIdx = ctx.cardHeroIdx;
      const heroPs = gs.players[heroOwner];
      const hero = heroPs?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Calculate Support Magic level on the caster hero's ability zones
      const abZones = heroPs.abilityZones[heroIdx] || [[], [], []];
      const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
      const healAmount = smLevel >= 3 ? 200 : smLevel >= 2 ? 150 : 100;

      // Confirm prompt (no targeting, just confirm/cancel)
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Healing Melody',
        message: `Heal ALL your Heroes and Creatures for ${healAmount} HP each. (Support Magic Lv${smLevel})`,
        confirmLabel: `🎵 Play Melody! (${healAmount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // ── Collect all friendly targets (heroes + creatures) ──
      // "Friendly" = own heroes + charmed opponent heroes
      const ps = gs.players[pi];
      const allTargets = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        allTargets.push({ type: 'hero', heroIdx: hi, zoneSlot: -1, ownerIdx: pi });

        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          const inst = engine.cardInstances.find(c =>
            c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
          );
          if (!inst) continue;
          const cd = engine._getCardDB()[inst.name];
          if (!cd || (cd.cardType !== 'Creature' && !(cd.subtype || '').toLowerCase().includes('creature'))) continue;
          allTargets.push({ type: 'creature', heroIdx: hi, zoneSlot: si, inst, ownerIdx: pi });
        }
      }

      // Also include charmed opponent heroes (and their creatures)
      const oi = pi === 0 ? 1 : 0;
      const ops = gs.players[oi];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const h = ops.heroes[hi];
        if (!h?.name || h.hp <= 0 || h.charmedBy !== pi) continue;
        allTargets.push({ type: 'hero', heroIdx: hi, zoneSlot: -1, ownerIdx: oi });
      }

      // ── Phase 1: Music notes on ALL friendly targets (staggered) ──
      let delay = 0;
      for (const t of allTargets) {
        setTimeout(() => {
          engine._broadcastEvent('play_zone_animation', {
            type: 'music_notes', owner: t.ownerIdx, heroIdx: t.heroIdx, zoneSlot: t.zoneSlot,
          });
        }, delay);
        delay += 120;
      }

      await engine._delay(delay + 600);

      // ── Phase 2: Heal sparkles on all targets ──
      for (const t of allTargets) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'heal_sparkle', owner: t.ownerIdx, heroIdx: t.heroIdx, zoneSlot: t.zoneSlot,
        });
      }

      await engine._delay(400);

      // ── Phase 3: Apply healing to all hero targets ──
      for (const t of allTargets) {
        if (t.type !== 'hero') continue;
        const h = gs.players[t.ownerIdx]?.heroes?.[t.heroIdx];
        if (!h?.name || h.hp <= 0) continue;
        await ctx.healHero(h, healAmount);
      }

      // ── Phase 4: Apply healing to all creatures ──
      for (const t of allTargets) {
        if (t.type !== 'creature' || !t.inst) continue;
        await ctx.healCreature(t.inst, healAmount);
      }

      engine.log('healing_melody', {
        player: ps.username,
        hero: hero.name,
        amount: healAmount,
        smLevel,
      });
      engine.sync();
    },
  },
};
