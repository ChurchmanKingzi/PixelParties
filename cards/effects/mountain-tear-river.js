// ═══════════════════════════════════════════
//  CARD EFFECT: "Mountain Tear River"
//  Spell (Destruction Magic Lv 1, Surprise)
//
//  Activate when the user (or a Creature in one
//  of the user's Surprise Zones) is chosen by an
//  Attack, Spell, or Creature effect. Burn the
//  attacker. With Destruction Magic 3 on the
//  user, Burn up to 2 additional targets
//  afterwards.
//
//  Implementation
//  ──────────────
//  • Standard Surprise lifecycle (Booby Trap
//    pattern) MINUS the negation behaviour —
//    Mountain Tear River does NOT cancel the
//    triggering effect even if the burn would
//    eventually finish off the attacker. The
//    incoming Attack / Spell / Creature effect
//    resolves normally; Burn is the only thing
//    we add.
//  • Burns are always until end-of-turn or
//    healed (cards.json text reflects that —
//    no `permanent: true` flag here).
//  • Creature attackers get `inst.counters.burned`
//    + `burnAppliedBy` directly; Hero attackers
//    go through `engine.addHeroStatus`. Both are
//    standard Burn application.
//  • Self-bounce guard: an attacker whose effect
//    is a passive "Mountain Tear River triggers
//    you" path can't be itself the user (the
//    surpriseTrigger refuses sourceInfo with no
//    owner / hero idx) — same shape Booby Trap
//    uses, no extra check needed here.
//  • DM-3 bonus: count the user's Destruction
//    Magic level (Performance copies count toward
//    the base) and prompt up to 2 additional
//    targets. Already-Burned candidates are
//    filtered out so the prompt doesn't waste
//    the player's pick on a no-op.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mountain Tear River';
const REQUIRED_DM_LEVEL = 3;
const EXTRA_BURNS = 2;

function countDestructionMagic(ps, heroIdx) {
  let n = 0;
  for (const slot of (ps.abilityZones?.[heroIdx] || [])) {
    if (!slot || slot.length === 0) continue;
    const base = slot[0];
    for (const ab of slot) {
      if (ab === 'Destruction Magic') n++;
      else if (ab === 'Performance' && base === 'Destruction Magic') n++;
    }
  }
  return n;
}

async function burnHero(engine, owner, heroIdx, appliedBy) {
  await engine.addHeroStatus(owner, heroIdx, 'burned', {
    appliedBy,
    _skipReactionCheck: true,
  });
}

function burnCreature(inst, appliedBy) {
  if (!inst.counters) inst.counters = {};
  inst.counters.burned = 1;
  inst.counters.burnAppliedBy = appliedBy;
}

function isAlreadyBurned(target, engine) {
  if (target.type === 'hero') {
    const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    return !!h?.statuses?.burned;
  }
  if (target.cardInstance) return !!target.cardInstance.counters?.burned;
  return false;
}

module.exports = {
  isSurprise: true,

  /**
   * Trigger condition — fires when the host hero is targeted by an
   * Attack / Spell / Creature effect with a valid owner + hero idx.
   * Mirrors Booby Trap's gate: passive sources without an actor
   * (e.g. board-state effects) don't qualify.
   */
  surpriseTrigger(gs, ownerIdx, heroIdx, sourceInfo, engine) {
    if (!sourceInfo) return false;
    if (sourceInfo.owner < 0 || sourceInfo.heroIdx < 0) return false;

    // Source must be alive — burning a corpse is meaningless.
    const srcInst = sourceInfo.cardInstance;
    if (srcInst?.zone === 'support') {
      const cd = engine._getCardDB()[srcInst.name];
      const hp = srcInst.counters?.currentHp ?? cd?.hp ?? 1;
      return hp > 0;
    }
    const attacker = gs.players[sourceInfo.owner]?.heroes?.[sourceInfo.heroIdx];
    return attacker && attacker.hp > 0;
  },

  /**
   * Apply Burn to the attacker, then optionally Burn 2 extra targets
   * (Destruction Magic ≥ 3). Returns null — does NOT negate the
   * triggering effect (deliberately distinct from Booby Trap).
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const ps     = gs.players[pi];
    if (!ps) return null;

    const srcInst = sourceInfo.cardInstance;
    const isCreatureSource = srcInst?.zone === 'support';

    // Steam-like overlay on the attacker — re-using existing fire
    // visual is fine, the burn itself plays its own status icon.
    const attackerOwner    = sourceInfo.owner;
    const attackerHeroIdx  = sourceInfo.heroIdx;
    const attackerSlot     = isCreatureSource ? srcInst.zoneSlot : -1;

    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike',
      owner: attackerOwner,
      heroIdx: attackerHeroIdx,
      zoneSlot: attackerSlot,
    });
    await engine._delay(500);

    // ── Burn the attacker ──
    if (isCreatureSource) {
      const cd = engine._getCardDB()[srcInst.name];
      const hp = srcInst.counters?.currentHp ?? cd?.hp ?? 0;
      if (hp > 0 && engine.canApplyCreatureStatus?.(srcInst, 'burned') !== false) {
        burnCreature(srcInst, pi);
        engine.log('mountain_tear_river_burn', {
          target: srcInst.name, type: 'creature',
          player: ps.username,
        });
      }
    } else {
      const attacker = gs.players[attackerOwner]?.heroes?.[attackerHeroIdx];
      if (attacker?.name && attacker.hp > 0) {
        await burnHero(engine, attackerOwner, attackerHeroIdx, pi);
        engine.log('mountain_tear_river_burn', {
          target: attacker.name, type: 'hero',
          player: ps.username,
        });
      }
    }
    engine.sync();

    // ── DM-3 bonus: up to 2 additional Burns ──
    const dmLevel = countDestructionMagic(ps, ctx.cardHeroIdx);
    if (dmLevel >= REQUIRED_DM_LEVEL) {
      const extra = await ctx.promptMultiTarget({
        side: 'any',
        types: ['hero', 'creature'],
        min: 0,
        max: EXTRA_BURNS,
        title: CARD_NAME,
        description: `Choose up to ${EXTRA_BURNS} additional targets to Burn.`,
        confirmLabel: '🔥 Burn!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t, eng) => !isAlreadyBurned(t, eng),
      });
      if (Array.isArray(extra) && extra.length > 0) {
        for (const t of extra) {
          const tSlot = t.type === 'hero' ? -1 : t.slotIdx;
          engine._broadcastEvent('play_zone_animation', {
            type: 'flame_strike',
            owner: t.owner, heroIdx: t.heroIdx, zoneSlot: tSlot,
          });
          await engine._delay(220);
          if (t.type === 'hero') {
            const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
            if (h?.name && h.hp > 0) await burnHero(engine, t.owner, t.heroIdx, pi);
          } else if (t.cardInstance && engine.canApplyCreatureStatus?.(t.cardInstance, 'burned') !== false) {
            burnCreature(t.cardInstance, pi);
          }
        }
        engine.log('mountain_tear_river_extra_burns', {
          count: extra.length, player: ps.username,
        });
        engine.sync();
      }
    }

    // Explicitly NOT { effectNegated: true } — Mountain Tear River
    // never cancels the triggering effect.
    return null;
  },
};
