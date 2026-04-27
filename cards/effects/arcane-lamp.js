// ═══════════════════════════════════════════
//  CARD EFFECT: "Arcane Lamp"
//  Artifact (Normal, Cost 6)
//
//  Choose a target your opponent controls and
//  Burn it for the rest of the game. "Target"
//  covers both Heroes and face-up Creatures on
//  the opponent's side. Burn is permanent —
//  doesn't auto-expire at end of turn — but is
//  still cleansable by Beer / Tea / Cure (same
//  rule Heat Wave / Mountain Tear River apply).
//
//  Wiring:
//    • Targeting Artifact — `getValidTargets`
//      enumerates opponent heroes (alive, not
//      already burned, not burn-immune) and
//      opponent face-up Creatures that can
//      receive Burn per `canApplyCreatureStatus`.
//    • Already-Burned targets are filtered out
//      so the player can't waste the play.
//    • Hero burn applies via `addHeroStatus(...,
//      { permanent: true })` — fires
//      `onStatusApplied` so Luna Pele's
//      draw-on-burn picks it up.
//    • Creature burn writes `inst.counters.burned
//      = true` directly, matching Heat Wave's
//      creature path. (Creature status writes
//      don't fire `onStatusApplied` today, so
//      Luna Pele's hook won't trigger on creature
//      targets — same scope limitation noted in
//      her file.)
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Arcane Lamp';

function heroCanBeBurned(hero) {
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.burned) return false;
  if (hero.statuses?.immune) return false;
  if (hero.statuses?.charmed) return false;
  if (hero.statuses?.burn_immune) return false;
  return true;
}

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    if (!ops) return false;

    // At least one hero target?
    for (const h of (ops.heroes || [])) {
      if (heroCanBeBurned(h)) return true;
    }
    // Or at least one creature target? Use the targeting-side gate
    // so Cardinal Beasts (and other omni-immune creatures) appear as
    // valid targets — the actual Burn application fizzles silently
    // in `resolve` via `canApplyCreatureStatus`.
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oi) continue;
        if (inst.counters?.burned) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (engine.canTargetForStatus(inst, 'burned')) return true;
      }
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    const targets = [];
    if (!ops) return targets;

    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const h = ops.heroes[hi];
      if (!heroCanBeBurned(h)) continue;
      targets.push({
        id: `hero-${oi}-${hi}`,
        type: 'hero', owner: oi, heroIdx: hi,
        cardName: h.name,
      });
    }
    if (engine) {
      const cardDB = engine._getCardDB();
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if ((inst.controller ?? inst.owner) !== oi) continue;
        if (inst.counters?.burned) continue;
        const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (!engine.canTargetForStatus(inst, 'burned')) continue;
        targets.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: "Choose a target your opponent controls to Burn for the rest of the game.",
    confirmLabel: '🔥 Burn!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds /*, validTargets */) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  animationType: 'flame_strike',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { cancelled: true };

    const ps = engine.gs.players[pi];

    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || !heroCanBeBurned(hero)) return { cancelled: true };
      await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
        permanent: true,
        appliedBy: pi,
      });
    } else if (target.cardInstance) {
      const inst = engine.cardInstances.find(c => c.id === target.cardInstance.id);
      if (!inst || inst.zone !== 'support') return { cancelled: true };
      // The `canApplyCreatureStatus` gate now includes the generic
      // omni-immune check (Cardinal Beasts, future omni-immune
      // creatures), so failed applications fizzle here without
      // cancelling the resolve. The standard `potion_resolved`
      // broadcast still plays the flame_strike animation on the picked
      // target — animation always happens, only the Burn write is
      // skipped on omni-immune targets.
      if (engine.canApplyCreatureStatus(inst, 'burned')) {
        inst.counters.burned = true;
        inst.counters.burnAppliedBy = pi;
        engine.log('creature_burned', {
          card: inst.name, owner: inst.owner, by: CARD_NAME,
        });
      } else {
        engine.log('arcane_lamp_fizzle', {
          card: inst.name, owner: inst.owner, by: CARD_NAME,
        });
      }
    }

    engine.log('arcane_lamp', {
      player: ps?.username, target: target.cardName,
    });
    engine.sync();
    return true;
  },
};
