// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Banner Bearer"
//  Creature (Surprise) — Decay+Summoning Magic Lv2, 40 HP
//
//  Activate this Surprise when your opponent
//  would deal damage to a target you control
//  (Hero OR Creature). Reduce that damage by
//  150 and Freeze the target for 2 turns. Then
//  place this Creature into one of your free
//  Support Zones (handled by the engine's
//  Creature-surprise placement flow after
//  `onSurpriseActivate` returns).
//
//  Trigger gating — only activatable while the
//  owner has at least one free own-side Support
//  Zone (the engine places Banner Bearer onto
//  the owner's side once activated; no slot =
//  no placement). Mirrors Pure Advantage Camel
//  by checking inside `surpriseTrigger`.
//
//  Wiring — opts into the new engine
//  `_checkDamageSurpriseWindow` via the
//  `firesOnAnyDamageTarget: true` flag. The
//  window scans BOTH hero and creature damage
//  events; existing surprises (Booby Trap,
//  Magic Mirror, Jumpscare, …) don't carry the
//  flag and are unaffected.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mischief Militia - Banner Bearer';
const DAMAGE_REDUCTION = 150;
const FREEZE_DURATION = 2;

/** Does the owner have at least one free Support Zone to host
 *  Banner Bearer's body? */
function _ownerHasFreeSupportZone(gs, ownerIdx) {
  const ps = gs.players[ownerIdx];
  if (!ps) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (const slot of zones) {
      if ((slot || []).length === 0) return true;
    }
  }
  return false;
}

module.exports = {
  isSurprise: true,
  // Opt-in to the engine's _checkDamageSurpriseWindow. Existing
  // surprises (Booby Trap, etc.) do NOT carry this flag and are
  // unaffected by the new window.
  firesOnAnyDamageTarget: true,

  cpuMeta: {
    onDeathBenefit: 30,
  },

  /**
   * Trigger condition. Fires only on opp damage to an own-side target
   * with a free Support Zone available for Banner Bearer's body.
   * The new engine window already filters by target ownership before
   * calling here, but we re-check defensively.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    const tgt = sourceInfo.damageTarget;
    if (!tgt) return false;
    if (tgt.owner !== ownerIdx) return false; // safety
    if ((sourceInfo.damageAmount || 0) <= 0) return false;

    // Source must be opp.
    const srcOwner = sourceInfo.cardInstance?.controller
      ?? sourceInfo.cardInstance?.owner
      ?? sourceInfo.owner;
    if (srcOwner === ownerIdx) return false;

    // Status-tick damage (Burn / Poison) — not a "card or effect"
    // hit per the natural reading. Skip.
    const dmgType = sourceInfo.damageType;
    if (dmgType === 'burn' || dmgType === 'poison' || dmgType === 'status') return false;

    // Banner Bearer's body needs somewhere to land.
    if (!_ownerHasFreeSupportZone(gs, ownerIdx)) return false;

    return true;
  },

  /**
   * Returns { damageReduced, effectNegated } for the engine to apply.
   * Also Freezes the target for 2 turns. Banner Bearer's body is
   * placed by the engine's Creature-surprise post-resolution flow.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const ownerIdx = ctx.cardOwner;
    const target = sourceInfo.damageTarget;
    const incoming = sourceInfo.damageAmount || 0;

    if (!target) return null;

    // ── Banner waving animation on the target ──
    const tgtSlot = target.kind === 'hero' ? -1 : (target.slotIdx ?? -1);
    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_block',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: tgtSlot,
    });
    await engine._delay(500);

    // ── Freeze the target for 2 turns ──
    if (target.kind === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
          appliedBy: ownerIdx,
          duration: FREEZE_DURATION,
          animationType: 'freeze',
        });
      }
    } else if (target.inst) {
      const inst = engine.cardInstances.find(c => c.id === target.inst.id);
      if (inst && inst.zone === 'support') {
        await engine.applyCreatureStatus(inst, 'frozen', {
          duration: FREEZE_DURATION,
          sourceOwner: ownerIdx,
          source: CARD_NAME,
          animationType: 'ice_encase',
        });
      }
    }

    engine.log('banner_bearer', {
      player: engine.gs.players[ownerIdx]?.username,
      reduced: DAMAGE_REDUCTION,
      target: target.cardName || (target.kind === 'hero' ? 'Hero' : 'Creature'),
      incoming,
    });

    // ── Return reduction directives to the engine ──
    // The window applies `damageReduced` to `entry.amount`; if amount
    // drops to 0, `effectNegated` short-circuits the rest of the batch
    // entry. Use explicit negation when 150 ≥ incoming so the engine
    // skips the residual zero-damage path entirely (animations stay
    // sane).
    const effectNegated = DAMAGE_REDUCTION >= incoming;
    return { damageReduced: DAMAGE_REDUCTION, effectNegated };
  },
};
