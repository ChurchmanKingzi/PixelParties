// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Fire"
//  Spell (Destruction Magic Lv1) — Inherent
//  additional Action. Once per game (Divine Gift).
//  Choose a player. All targets that player
//  controls are Burned for the rest of the game.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Check if casting hero forces single-target (Ida)
      const heroKey = `${pi}-${heroIdx}`;
      const forcesSingle = gs.heroFlags?.[heroKey]?.forcesSingleTarget;

      if (forcesSingle) {
        // ── Ida mode: single-target picker, burn one target ──
        const target = await ctx.promptDamageTarget({
          side: 'any',
          types: ['hero', 'creature'],
          damageType: 'other',
          title: 'Divine Gift of Fire',
          description: 'Choose a target to Burn.',
          confirmLabel: '🔥 Burn!',
          confirmClass: 'btn-danger',
          cancellable: true,
        });
        if (!target) return;

        const tgtOwner = target.owner;
        const tgtHeroIdx = target.heroIdx;
        const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;

        engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot });
        await engine._delay(600);

        if (target.type === 'hero') {
          const hero = gs.players[tgtOwner].heroes?.[tgtHeroIdx];
          if (hero && hero.hp > 0) {
            await engine.actionAddStatus(hero, 'burned', { permanent: true });
          }
        } else if (target.type === 'equip' && target.cardInstance) {
          if (!target.cardInstance.counters.burned) {
            target.cardInstance.counters.burned = true;
            engine.log('creature_burned', { card: target.cardInstance.name, owner: tgtOwner, by: 'Divine Gift of Fire' });
          }
        }

        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot });
        await engine._delay(300);
        engine.sync();
        return;
      }

      // ── Normal mode: player picker, burn all their targets ──
      const result = await engine.promptGeneric(pi, {
        type: 'playerPicker',
        title: 'Divine Gift of Fire',
        description: 'Choose a player. All targets they control are Burned.',
        cancellable: true,
      });

      if (!result) {
        gs._spellCancelled = true;
        return;
      }
      const targetPlayerIdx = result.playerIdx;
      if (targetPlayerIdx === undefined || targetPlayerIdx < 0 || targetPlayerIdx > 1) return;

      const targetPs = gs.players[targetPlayerIdx];
      if (!targetPs) return;

      // Collect all targets: heroes + creatures
      const targets = [];
      for (let hi = 0; hi < (targetPs.heroes || []).length; hi++) {
        const hero = targetPs.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        targets.push({ type: 'hero', heroIdx: hi });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== targetPlayerIdx || inst.zone !== 'support') continue;
        targets.push({ type: 'creature', heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, inst });
      }

      if (targets.length === 0) return;

      // Fire animation on ALL targets simultaneously
      for (const t of targets) {
        const slot = t.type === 'hero' ? -1 : t.zoneSlot;
        engine._broadcastEvent('play_zone_animation', { type: 'flame_avalanche', owner: targetPlayerIdx, heroIdx: t.heroIdx, zoneSlot: slot });
      }
      await engine._delay(600);

      // Apply Burned status to all heroes (actionAddStatus handles protection/immunity)
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = targetPs.heroes[t.heroIdx];
          if (!hero || hero.hp <= 0) continue;
          if (hero.statuses?.burned) continue;
          await engine.actionAddStatus(hero, 'burned', { permanent: true });
        }
      }

      // Apply Burned status to all creatures
      for (const t of targets) {
        if (t.type === 'creature' && t.inst) {
          if (t.inst.counters.burned) continue;
          t.inst.counters.burned = true;
          engine.log('creature_burned', { card: t.inst.name, owner: targetPlayerIdx, by: 'Divine Gift of Fire' });
        }
      }

      engine.sync();
      await engine._delay(400);

      // Second wave of flame animations
      for (const t of targets) {
        const slot = t.type === 'hero' ? -1 : t.zoneSlot;
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: targetPlayerIdx, heroIdx: t.heroIdx, zoneSlot: slot });
      }
      await engine._delay(300);
      engine.sync();
    },
  },
};
