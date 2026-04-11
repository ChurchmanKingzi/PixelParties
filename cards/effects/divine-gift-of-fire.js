// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Fire"
//  Spell (Destruction Magic Lv1) — Inherent
//  additional Action. Once per game (Divine Gift).
//  Choose a player. All targets that player
//  controls are Burned for the rest of the game.
//
//  Uses generic ctx.aoeHit() for target collection
//  and Ida single-target override.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Check Ida single-target override first
      const heroFlags = gs.heroFlags?.[`${pi}-${heroIdx}`];
      if (heroFlags?.forcesSingleTarget) {
        // ── Ida mode: single-target burn via aoeHit ──
        const result = await ctx.aoeHit({
          side: 'both',
          types: ['hero', 'creature'],
          damage: 0,
          sourceName: 'Divine Gift of Fire',
          animationType: 'flame_avalanche',
          animDelay: 600,
          singleTargetPrompt: {
            title: 'Divine Gift of Fire',
            description: 'Choose a target to Burn.',
            confirmLabel: '🔥 Burn!',
            cancellable: true,
          },
        });

        if (result.cancelled) return;

        // Apply burn to the single target
        for (const { hero, heroIdx: hi, owner } of result.heroes) {
          if (hero && hero.hp > 0 && !hero.statuses?.burned) {
            await engine.addHeroStatus(owner, hi, 'burned', { permanent: true });
          }
        }
        for (const { inst } of result.creatures) {
          if (inst && !inst.counters.burned && !inst.faceDown && !inst.counters._cardinalImmune) {
            inst.counters.burned = true;
            engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Divine Gift of Fire' });
          }
        }

        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: result.heroes[0]?.owner ?? result.creatures[0]?.inst?.owner ?? pi,
          heroIdx: result.heroes[0]?.heroIdx ?? result.creatures[0]?.inst?.heroIdx ?? 0,
          zoneSlot: result.creatures[0]?.inst?.zoneSlot ?? -1,
        });
        await engine._delay(300);
        engine.sync();
        return;
      }

      // ── Normal mode: player picker, then AoE burn ──
      const pickerResult = await engine.promptGeneric(pi, {
        type: 'playerPicker',
        title: 'Divine Gift of Fire',
        description: 'Choose a player. All targets they control are Burned.',
        cancellable: true,
      });

      if (!pickerResult) {
        gs._spellCancelled = true;
        return;
      }
      const targetPlayerIdx = pickerResult.playerIdx;
      if (targetPlayerIdx === undefined || targetPlayerIdx < 0 || targetPlayerIdx > 1) return;

      // Use aoeHit with damage: 0 to collect targets and play animations
      const side = targetPlayerIdx === pi ? 'own' : 'enemy';
      const result = await ctx.aoeHit({
        side,
        types: ['hero', 'creature'],
        damage: 0,
        sourceName: 'Divine Gift of Fire',
        animationType: 'flame_avalanche',
        animDelay: 600,
      });

      // Apply Burned status to all collected heroes (batch — no individual reaction windows)
      for (const { hero, heroIdx: hi, owner } of result.heroes) {
        if (!hero || hero.hp <= 0 || hero.statuses?.burned) continue;
        await engine.addHeroStatus(owner, hi, 'burned', { permanent: true, _skipReactionCheck: true });
      }

      // Apply Burned to all collected creatures
      for (const { inst } of result.creatures) {
        if (inst.counters.burned || inst.faceDown || inst.counters._cardinalImmune) continue;
        inst.counters.burned = true;
        engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Divine Gift of Fire' });
      }

      // Single reaction window for the entire batch
      await engine._checkReactionCards('onStatusApplied', { status: 'burned', batchSource: 'Divine Gift of Fire' });

      engine.sync();
      await engine._delay(400);

      // Second wave of flame animations
      for (const { heroIdx: hi, owner } of result.heroes) {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner, heroIdx: hi, zoneSlot: -1 });
      }
      for (const { inst } of result.creatures) {
        engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
      }
      await engine._delay(300);
      engine.sync();
    },
  },
};
