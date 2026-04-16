// ═══════════════════════════════════════════
//  CARD EFFECT: "Resistance"
//  Ability — Passive. Blocks non-damage effects
//  targeting the attached Hero.
//
//  Lv1: Block the first 1 status/effect per turn.
//  Lv2: Block the first 2 statuses/effects per turn.
//  Lv3: Block ALL statuses/effects (permanent).
//
//  "Except damage" — only status application is
//  intercepted, not HP/ATK changes from damage.
//
//  Block counter tracked on gs._resistanceBlocks
//  (keyed by "playerIdx:heroIdx") and reset each
//  turn via onTurnStart. Multiple Resistance
//  instances in the same slot all share one key;
//  the "status already gone" guard ensures only
//  the first instance acts per application.
// ═══════════════════════════════════════════

const CARD_NAME = 'Resistance';

module.exports = {
  activeIn: ['ability'],
  bypassStatusFilter: true, // Must fire even after the status is set on the hero

  hooks: {
    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      // Reset this hero's block budget at the start of each turn
      const key = `${ctx.cardOwner}:${ctx.cardHeroIdx}`;
      if (ctx._engine.gs._resistanceBlocks) {
        delete ctx._engine.gs._resistanceBlocks[key];
      }
    },

    // ── Intercept buffs and healing BEFORE they apply ────────────────────
    beforeHeroEffect: (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only react to effects targeting THIS hero
      if (ctx.playerIdx !== pi || ctx.heroIdx !== heroIdx) return;

      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Compute level
      const abZones = gs.players[pi]?.abilityZones?.[heroIdx] || [];
      let level = 0;
      for (const slot of abZones) {
        if ((slot || []).length > 0 && slot[0] === CARD_NAME) { level = slot.length; break; }
      }
      if (level === 0) return;

      // Check block budget
      if (!gs._resistanceBlocks) gs._resistanceBlocks = {};
      const key = `${pi}:${heroIdx}`;
      const used = gs._resistanceBlocks[key] || 0;
      const maxBlocks = level >= 3 ? Infinity : level;
      if (used >= maxBlocks) return;

      // Cancel the effect
      ctx.cancel();
      gs._resistanceBlocks[key] = used + 1;

      engine.log('resistance_block', {
        player: gs.players[pi]?.username,
        hero: hero.name, effectType: ctx.effectType,
        level, blocksUsed: used + 1,
      });
      engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1 });
      engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1 });
      engine.sync();
    },

    onStatusApplied: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only react to statuses applied to THIS hero
      if (ctx.heroOwner !== pi || ctx.heroIdx !== heroIdx) return;

      const statusName = ctx.statusName;
      if (!statusName) return;

      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // If another Resistance instance already removed this status, skip
      if (!hero.statuses?.[statusName]) return;

      // Compute level from the ability zone slot
      const abZones = gs.players[pi]?.abilityZones?.[heroIdx] || [];
      let level = 0;
      for (const slot of abZones) {
        if ((slot || []).length > 0 && slot[0] === CARD_NAME) {
          level = slot.length;
          break;
        }
      }
      if (level === 0) return;

      // Check block budget (Lv3 = unlimited)
      if (!gs._resistanceBlocks) gs._resistanceBlocks = {};
      const key = `${pi}:${heroIdx}`;
      const used = gs._resistanceBlocks[key] || 0;
      const maxBlocks = level >= 3 ? Infinity : level;

      if (used >= maxBlocks) return;

      // Remove the status — it is now blocked
      await engine.removeHeroStatus(pi, heroIdx, statusName);
      gs._resistanceBlocks[key] = used + 1;

      engine.log('resistance_block', {
        player: gs.players[pi]?.username,
        hero: hero.name, status: statusName,
        level, blocksUsed: used + 1,
      });

      // Gold sparkle on the hero zone as visual feedback
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine.sync();
    },
  },
};
