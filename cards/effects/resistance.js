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
  // Lizbeth/Smugbeth: same `ps.abilityZones[heroIdx]` re-walk pattern
  // as Smugness — auto-mirror finds no Resistance on the borrower's
  // own slot and aborts. Phase 3 punch list.
  disableLizbethMirror: true,

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

      // Compute level + slot
      const abZones = gs.players[pi]?.abilityZones?.[heroIdx] || [];
      let level = 0;
      let zoneSlot = -1;
      for (let z = 0; z < abZones.length; z++) {
        const slot = abZones[z] || [];
        if (slot.length > 0 && slot[0] === CARD_NAME) { level = slot.length; zoneSlot = z; break; }
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
      // White flash on Resistance's ability slot — visible to both
      // players, makes "an effect was just absorbed" obvious without
      // hunting through the log.
      if (zoneSlot >= 0) {
        engine._broadcastEvent('ability_block_flash', { owner: pi, heroIdx, zoneIdx: zoneSlot });
      }
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
      let zoneSlot = -1;
      for (let z = 0; z < abZones.length; z++) {
        const slot = abZones[z] || [];
        if (slot.length > 0 && slot[0] === CARD_NAME) {
          level = slot.length;
          zoneSlot = z;
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

      // Play the source's intended status animation BEFORE removing
      // the status — only the EFFECT is blocked; the visual still
      // "hits" the target. The engine surfaces the source's
      // `animationType` (or a per-status default — freeze /
      // flame_strike / electric_strike) on `ctx.animationType`; without
      // this broadcast the diff-detector misses the animation because
      // the status never appears in synced state (Resistance removes
      // it inline on the apply hook before any sync fires).
      if (ctx.animationType) {
        engine._broadcastEvent('play_zone_animation', {
          type: ctx.animationType, owner: pi, heroIdx, zoneSlot: -1,
        });
      }

      // Remove the status — it is now blocked. `bypassUnhealable`
      // makes Resistance correctly absorb Venom Infusion Lv3's
      // unhealable Poison: Venom's "unhealable" prevents the Poison
      // from being HEALED off later, but it doesn't bar a protection
      // effect firing in the same apply window.
      await engine.removeHeroStatus(pi, heroIdx, statusName, { bypassUnhealable: true });
      gs._resistanceBlocks[key] = used + 1;

      engine.log('resistance_block', {
        player: gs.players[pi]?.username,
        hero: hero.name, status: statusName,
        level, blocksUsed: used + 1,
      });

      // White flash on Resistance's ability slot — clearer "this got
      // absorbed by Resistance" signal than the previous gold sparkle
      // on the hero zone (which read like an activation, not a block).
      if (zoneSlot >= 0) {
        engine._broadcastEvent('ability_block_flash', { owner: pi, heroIdx, zoneIdx: zoneSlot });
      }
      engine.sync();
    },
  },
};
