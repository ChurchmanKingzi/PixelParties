// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Bear Rider"
//  Creature — Summoning Magic Lv2, 100 HP
//
//  Two effects:
//
//  1) HAND-LEVEL REDUCTION — This card's level
//     in your hand is reduced by 1 for every
//     Frozen target on the board. The engine's
//     `_handLevelOffsetsTransient` map is the
//     standard channel for in-hand level
//     overrides — the frontend reads it for
//     display AND `heroMeetsLevelReq` reads it
//     for play-eligibility, so writing there
//     unifies both. Recompute fires on every
//     hook that could change the Frozen count.
//
//  2) FREE-SUMMON GATE — When this card's
//     effective level reaches 0, summoning it
//     becomes an additional Action. Implemented
//     via `inherentAction(gs, pi, heroIdx,
//     engine)` consulted by the play handler
//     each cast.
//
//  3) HOPT CREATURE EFFECT — Once per turn per
//     instance, choose a Frozen target on the
//     board and deal 150 damage to it. Engine
//     default soft HOPT on `creature-effect:
//     ${inst.id}` is exactly per-instance.
// ═══════════════════════════════════════════

const {
  BEAR_RIDER_NAME,
  countFrozenTargets,
  recomputeBearRiderHandLevel,
  recomputeBearRiderHandLevelAllPlayers,
} = require('./_mischief-militia-shared');

const DAMAGE = 150;
const BASE_LEVEL = 2;

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.
  activeIn: ['hand', 'support'],
  creatureEffect: true,

  /**
   * Free-summon gate. The engine's `heroMeetsLevelReq` ALSO consults
   * the `_handLevelOffsetsTransient` map our hooks maintain, so the
   * level check naturally clears at 0 Frozen-aware level — but the
   * Action-cost gate is independent, so we mirror the same arithmetic
   * here. `engine` is passed by `validateActionPlay`; without it (CPU
   * speculative gating during MCTS), we fall back to "not an inherent
   * action" so the speculation doesn't over-count free actions.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    const frozenCount = countFrozenTargets(engine);
    const effLevel = Math.max(0, BASE_LEVEL - frozenCount);
    return effLevel === 0;
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    // Need at least one Frozen target to hit.
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.frozen) return true;
    }
    for (let pi = 0; pi < 2; pi++) {
      const ps = engine.gs.players[pi];
      if (!ps) continue;
      for (const hero of (ps.heroes || [])) {
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen) return true;
      }
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const sourceOwner = ctx.cardHeroOwner;

    // Frozen-only target list.
    const candidates = [];
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const ps = gs.players[pIdx];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (!hero.statuses?.frozen) continue;
        candidates.push({
          id: `hero-${pIdx}-${hi}`,
          type: 'hero',
          owner: pIdx,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (!inst.counters?.frozen) continue;
      candidates.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
    if (candidates.length === 0) return false;

    const picked = await engine.promptEffectTarget(pi, candidates, {
      title: BEAR_RIDER_NAME,
      description: `Choose a Frozen target. Deal ${DAMAGE} damage to it.`,
      confirmLabel: `🐻 ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) return false;

    const target = candidates.find(t => t.id === picked[0]);
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

    // Ram animation — Bear Rider physically charges from its Support
    // Zone to the target, mirrors Phoenix Tackle / The Yeeting but
    // originates on the CREATURE slot (sourceZoneSlot >= 0) so the
    // Creature itself moves rather than its host hero.
    const RAM_DURATION = 1200;
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card.zoneSlot,
      targetOwner: target.owner, targetHeroIdx: target.heroIdx,
      targetZoneSlot: target.type === 'hero' ? undefined : target.slotIdx,
      cardName: BEAR_RIDER_NAME, duration: RAM_DURATION,
    });
    // Bear reaches the target around 12% of the duration — same beat
    // Phoenix Tackle uses to time the impact VFX.
    await engine._delay(150);
    engine._broadcastEvent('play_zone_animation', {
      type: 'strike', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(200);

    if (target.type === 'hero') {
      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (tgtHero && tgtHero.hp > 0) {
        await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
      }
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: BEAR_RIDER_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('bear_rider', {
      player: gs.players[pi]?.username,
      target: target.cardName,
      damage: DAMAGE,
    });
    engine.sync();
    // Hold for the ram to return to Bear Rider's slot before the
    // turn continues. (Impact fired at ~150 + 200 ms, damage takes
    // its own moment; this trailing wait covers the remaining return
    // half of the 1200 ms ram so the Creature visibly settles back.)
    await engine._delay(450);
    return true;
  },

  // ── Frozen-count change listeners ───────────────────────────────
  // The Frozen count drives both the visible hand-card level AND the
  // play-eligibility gate. Every hook that could shift the count
  // triggers a recompute for BOTH players. Idempotent — multiple Bear
  // Rider instances triggering the same recompute converge on the
  // same map state.
  //
  // Coverage:
  //   onStatusApplied / onStatusRemoved — HERO freeze toggles.
  //   afterSpellResolved                — Icebolt, Snow Cannon, Snowstorm
  //                                       Mischief, etc. (spell-applied
  //                                       creature freeze).
  //   afterPotionUsed                   — Elixir of Cold and future
  //                                       freeze-via-potion paths.
  //   onActionUsed                      — Thaw Blader / Cure / Beer /
  //                                       creature-effect-driven thaws.
  //   onCreatureDeath / onHeroKO        — Frozen target leaving the
  //                                       board drops the count.
  //   onCardEnterZone                   — Bear Rider drawn into hand;
  //                                       new index needs an offset.
  //   onTurnStart / onTurnEnd           — duration-based thaws.
  //
  // Gap (acceptable): creature-effect freezes that DON'T fire
  // onActionUsed (free-activation creature effects) lag one observable
  // event behind. Practical impact is negligible — the next user click
  // or turn-boundary cleans up the display.
  hooks: {
    onStatusApplied: async (ctx) => {
      const sn = ctx.statusName || ctx.status;
      if (sn !== 'frozen') return;
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onStatusRemoved: async (ctx) => {
      const sn = ctx.statusName || ctx.status;
      if (sn !== 'frozen') return;
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    afterSpellResolved: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    afterPotionUsed: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onActionUsed: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onCreatureDeath: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onHeroKO: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'hand') return;
      // Drawn into hand — recompute this side only (faster than both).
      const pi = ctx.cardOwner;
      if (pi != null) recomputeBearRiderHandLevel(ctx._engine, pi);
    },
    onTurnStart: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
    onTurnEnd: async (ctx) => {
      recomputeBearRiderHandLevelAllPlayers(ctx._engine);
    },
  },
};
