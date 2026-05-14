// ═══════════════════════════════════════════
//  CARD EFFECT: "Acid Vial"
//  Potion — Deal 150 unreducible, unredirectable,
//  unnegatable damage to any target (Hero or
//  Creature). Breaks through all protection
//  EXCEPT turn-1 protection.
//  Damage type: 'other'.
//  Hard once per turn.
//  Animation: red acid splash on target.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    // Hard once per turn
    const hoptKey = `acid-vial:${playerIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // At least one targetable hero must exist (not turn-1 protected)
    for (let pi = 0; pi < 2; pi++) {
      if (gs.firstTurnProtectedPlayer === pi) continue;
      for (const hero of (gs.players[pi]?.heroes || [])) {
        if (hero?.name && hero.hp > 0) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, playerIdx, engine) {
    if (!engine) return [];
    const targets = [];
    // Heroes — alive only, and not turn-1-protected. `getHeroTargets`
    // already filters by alive; the first-turn-protection check stays
    // here as the only Acid-Vial-specific gate.
    // Creatures — `getCreatureTargets` already iterates every Support
    // Zone regardless of host-Hero state (creatures are independent
    // of their Hero) and filters by `hasCardType(cd, 'Creature')`,
    // which keeps Artifact-Creature hybrids (Powder Keg, Pollution
    // Spewer, …) included.
    for (let pi = 0; pi < 2; pi++) {
      if (gs.firstTurnProtectedPlayer !== pi) {
        targets.push(...engine.getHeroTargets(pi));
      }
      targets.push(...engine.getCreatureTargets(pi));
    }
    return targets;
  },

  targetingConfig: {
    title: 'Acid Vial',
    description: 'Deal 150 unreducible damage to any target. Bypasses all protection.',
    confirmLabel: '🧪 Splash! (150)',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
    // Per-target damage hint — read by the CPU's `inferDamage` so the
    // simulate-and-score targeting branch can correctly evaluate kill
    // shots and high-value picks. Without this the CPU treats Acid
    // Vial as 0-damage, all targets score 0, and tiebreaker randomness
    // wastes the splash on whichever hero rolls highest.
    baseDamage: 150,
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'acid_splash',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    const gs = engine.gs;
    const DAMAGE = 150;

    // Claim HOPT
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`acid-vial:${pi}`] = gs.turn;

    const source = { name: 'Acid Vial', owner: pi, heroIdx: -1 };

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || hero.hp <= 0) return;

      const { dealt } = await engine.actionDealTrueDamage(source, hero, DAMAGE, {
        type: 'other',
        _skipReactionCheck: true,
      });

      // SC tracking — specific to Acid Vial's context, not part of the
      // generic true-damage helper.
      if (dealt > 0 && gs._scTracking && pi >= 0 && pi < 2) {
        const t = gs._scTracking[pi];
        if (dealt > t.maxDamageInstance) t.maxDamageInstance = dealt;
      }

    } else if (target.type === 'equip') {
      // Creature damage — dealTrueDamage wraps the batch internally, so
      // Monia can still react and the _damagedOnTurn tracker is set.
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) return;

      await engine.actionDealTrueDamage(source, inst, DAMAGE, { type: 'other' });
    }

    engine.sync();
  },
};
