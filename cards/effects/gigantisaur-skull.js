// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Skull"
//  Artifact (Reaction, cost 4)
//
//  Dual-mode (mirrors Juice's proactive/reactive
//  artifact pattern):
//
//  PROACTIVE (own turn) — plays like a Normal
//    Artifact. Target any Creature on the board
//    and Freeze it for 1 turn.
//
//  REACTIVE (opp's turn, in response to an opp
//    Creature activating its active effect) — the
//    target MUST be that activating Creature.
//    Freezes it AND negates the in-flight effect
//    via `negateChainLink` (Cute Camera pattern).
//
//  Freeze duration: `frozenDuration: 1` (standard
//  Elixir-of-Cold semantics). Reactive use gets
//  most of its value from `negateChainLink` —
//  the in-flight activation is cancelled outright
//  — so a single-tick freeze is enough to round it
//  off. Proactive use on your own turn locks the
//  chosen Creature through the opp's next turn:
//  the duration survives our turn-end (foreign-
//  owner instances aren't ticked by us) and clears
//  at the opp's turn-end tick.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Gigantisaur Skull';

/**
 * Every Creature on the board that can legally be targeted by Freeze —
 * alive support-zone occupant, not face-down, not freeze_immune. Uses
 * the TARGETING-side gate so omni-immune Creatures (Cardinal Beasts,
 * Golden-Wings wearers, …) stay selectable; the actual Freeze
 * application fizzles silently in `_freezeCreature` via the
 * application-side `canApplyCreatureStatus`. Used by both the
 * proactive target picker and the proactive playability gate.
 */
function _allFreezeableCreatureTargets(engine) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (!ps.heroes[hi]?.name) continue;
      for (let si = 0; si < 3; si++) {
        const slot = (ps.supportZones?.[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const cd = cardDB[cardName];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        const inst = engine.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support'
          && c.heroIdx === hi && c.zoneSlot === si,
        );
        if (!inst) continue;
        if (inst.faceDown) continue;
        if (!engine.canTargetForStatus(inst, 'frozen')) continue;
        out.push({
          id: `equip-${pi}-${hi}-${si}`,
          type: 'equip', owner: pi, heroIdx: hi, slotIdx: si,
          cardName, cardInstance: inst,
        });
      }
    }
  }
  return out;
}

/** Apply the Freeze on a creature inst. Shared by both flows. */
async function _freezeCreature(engine, inst, byPi) {
  if (!inst || inst.zone !== 'support') return false;
  if (!engine.canApplyCreatureStatus(inst, 'frozen')) return false;

  engine._broadcastEvent('play_zone_animation', {
    type: 'cold_coffin_encase',
    owner: inst.owner,
    heroIdx: inst.heroIdx,
    zoneSlot: inst.zoneSlot,
  });
  await engine._delay(400);

  return await engine.applyCreatureStatus(inst, 'frozen', {
    sourceOwner: byPi,
    duration: 1,
    source: 'Gigantisaur Skull',
  });
}

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,
  proactivePlay: true,

  // ── Reactive mode ──────────────────────────────────────────────────
  /**
   * Eligible iff the initial chain link is an opponent's CreatureEffect
   * activation, it's the opponent's turn, AND the activating instance
   * can actually be Frozen. (`gs._creatureEffectActivationContext` is
   * stashed by the server wrap before the chain is opened.)
   */
  reactionCondition(gs, pi, engine, chainCtx) {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const initial = chainCtx.chain.find(l => l.isInitialCard);
    if (!initial) return false;
    if (initial.cardType !== 'CreatureEffect') return false;
    if (initial.owner === pi) return false;
    if (gs.activePlayer === pi) return false;
    const ctx = gs._creatureEffectActivationContext;
    if (!ctx?.activatingInst) return false;
    const inst = ctx.activatingInst;
    if (!inst || inst.zone !== 'support') return false;
    if (!engine.canApplyCreatureStatus(inst, 'frozen')) return false;
    return true;
  },

  // ── Proactive mode ─────────────────────────────────────────────────
  /**
   * Proactive play needs at least one freezeable Creature anywhere on
   * the board. Mirrors Juice's optimistic check — the real targeting
   * gate is `getValidTargets`.
   */
  canActivate(gs, pi, engine) {
    if (!engine) {
      // No engine — optimistic fallback: as long as ANY support slot is
      // occupied by something, assume the play might work. Real filter
      // runs in getValidTargets at picker time.
      for (let phi = 0; phi < 2; phi++) {
        const ps = gs.players[phi];
        if (!ps) continue;
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          for (let si = 0; si < 3; si++) {
            if (((ps.supportZones?.[hi] || [])[si] || []).length > 0) return true;
          }
        }
      }
      return false;
    }
    return _allFreezeableCreatureTargets(engine).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    return _allFreezeableCreatureTargets(engine);
  },

  targetingConfig: {
    description: 'Choose any Creature on the board to Freeze for 1 turn.',
    confirmLabel: '🦴 Freeze!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  /**
   * Branches on `selectedIds` presence — same dispatch as Juice.
   *   • selectedIds set → proactive play: freeze the chosen Creature.
   *   • selectedIds null → reactive play: freeze the activating
   *     Creature (chain[0]) AND negate the link below us (the in-
   *     flight CreatureEffect).
   */
  async resolve(engine, pi, selectedIds, validTargets, chain, myIndex) {
    const gs = engine.gs;

    // Reactive flow: no targeting UI fired, this is the in-chain path.
    if (!selectedIds) {
      const ctx = gs._creatureEffectActivationContext;
      if (!ctx?.activatingInst) {
        engine.log('skull_fizzle', { reason: 'no_activation_ctx' });
        return false;
      }
      const inst = ctx.activatingInst;
      const ok = await _freezeCreature(engine, inst, pi);
      if (!ok) {
        engine.log('skull_fizzle', { reason: 'cannot_freeze', target: inst?.name });
        return false;
      }
      // Negate the in-flight CreatureEffect link directly below us.
      // Cute Camera pattern — engine.negateChainLink stamps `negated:
      // true` and the server's `if (chainResult.negated)` branch in
      // doActivateCreatureEffect bails out of `script.onCreatureEffect`
      // entirely.
      if (chain && typeof myIndex === 'number' && myIndex > 0) {
        engine.negateChainLink(chain, myIndex - 1, { negationStyle: 'ice' });
      }
      engine.log('skull_reactive', {
        target: inst.name, owner: inst.owner,
        by: gs.players[pi]?.username,
      });
      engine.sync();
      return true;
    }

    // Proactive flow: selectedIds + validTargets passed in.
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target?.cardInstance) {
      engine.log('skull_fizzle', { reason: 'no_target' });
      return false;
    }
    const ok = await _freezeCreature(engine, target.cardInstance, pi);
    if (!ok) {
      engine.log('skull_fizzle', { reason: 'cannot_freeze_proactive', target: target.cardName });
      return false;
    }
    engine.log('skull_proactive', {
      target: target.cardName, owner: target.owner,
      by: gs.players[pi]?.username,
    });
    engine.sync();
    return true;
  },
};
