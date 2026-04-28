// ═══════════════════════════════════════════
//  CARD EFFECT: "Perfect Disguise"
//  Artifact (Normal, 4 Gold, once per game)
//
//  Choose a target you control. That target
//  cannot be chosen by your opponent during their
//  next turn, except if it is your only legal
//  target.
//
//  Implementation
//  ──────────────
//  • Hero target: stamps `hero.statuses.untargetable
//    = true` — the engine's hero targeting filter
//    already implements the per-side "all-untar
//    getable → keep" rule that matches the card's
//    "only legal target" exception. Same flag
//    Butterfly Cloud uses; cleared at the START
//    phase of the caster's next turn (engine
//    line ~13290). The opponent's whole turn sits
//    between the stamp and the cleanup, which is
//    exactly the "during their next turn" window.
//  • Creature target: stamps the new soft-
//    untargetable counter pair on the inst —
//      inst.counters.softUntargetable_by_opponent = 1
//      inst.counters.softUntargetable_by_opponent_pi = oppIdx
//    The engine filters (promptDamageTarget +
//    promptMultiTarget) drop tagged creatures
//    when other non-tagged creatures remain on
//    the same side, and keep them when they're
//    the only options — same per-side semantics
//    as the hero filter. Cleared at the same
//    START-phase pass as hero untargetable.
//  • AoE auto-targeting (Heat Wave, Cataclysm,
//    Spawn Mother's board mode, …) is NOT
//    blocked: those don't "choose" a target,
//    they fan out across every legal one. Card
//    text says "cannot be chosen", which the
//    targeting filters cover; AoE is out of
//    scope by design.
//  • Once per game enforced by the engine's
//    standard `oncePerGame` + `oncePerGameKey`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Perfect Disguise';
const ONCE_PER_GAME_KEY = 'perfectDisguise';

module.exports = {
  isTargetingArtifact: true,
  oncePerGame: true,
  oncePerGameKey: ONCE_PER_GAME_KEY,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // At least one own alive Hero OR at least one own face-up Creature.
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0) return true;
    }
    // (Creatures handled below — searching cardInstances requires the
    // engine reference which `canActivate` doesn't get; getValidTargets
    // covers it. The hero check alone is enough to greenlight the
    // Artifact in hand whenever the caster has any live hero, which
    // they normally always do.)
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const ps = gs.players[pi];
    const targets = [];
    if (!ps) return targets;

    // Own alive Heroes.
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    // Own Creatures in support zones (controller-side, face-up).
    if (engine) {
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== pi) continue;
        if (inst.faceDown) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose one of your Heroes or Creatures to disguise from your opponent until your next turn.',
    confirmLabel: '🎭 Disguise!',
    confirmClass: 'btn-info',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
    maxTotal: 1,
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const oi = pi === 0 ? 1 : 0;
    const gs = engine.gs;
    const ps = gs.players[pi];

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;
      if (!hero.statuses) hero.statuses = {};
      // Reuse the existing hero-side untargetable flag — same per-side
      // semantics, same start-phase cleanup. The "from this opponent
      // specifically" detail isn't needed here because hero
      // untargetable already filters opponent-side picks only (own-
      // side picks bypass via the `if (owner === pi) continue` skip).
      hero.statuses.untargetable = true;
      engine.log('perfect_disguise', {
        player: ps.username, target: hero.name, type: 'hero',
      });
    } else if (target.type === 'equip') {
      // Re-resolve the inst from cardInstances (defensive — the inst
      // stashed in validTargets should still be live, but a chain
      // reaction between target-pick and resolve could in theory
      // remove it).
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      ) || target.cardInstance;
      if (!inst || inst.zone !== 'support') return false;
      if (!inst.counters) inst.counters = {};
      inst.counters.softUntargetable_by_opponent = 1;
      inst.counters.softUntargetable_by_opponent_pi = oi;
      engine.log('perfect_disguise', {
        player: ps.username, target: inst.name, type: 'creature',
      });
    } else {
      return false;
    }

    engine.sync();
    return true;
  },
};
