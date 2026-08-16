// ═══════════════════════════════════════════
//  CARD EFFECT: "Aligning Goals"
//  Spell (Decay Magic + Magic Arts, Lv 1) —
//  Normal. Inherent additional Action.
//
//  Choose a Creature your opponent controls,
//  spend 5 Gold, and take control of it for the
//  rest of the turn (its active effect becomes
//  yours to fire). Standard temp-steal mechanism
//  (`engine.actionStealCreature`) — `inst.stolenBy`
//  + `inst.controller` flip to the caster, the
//  Creature stays physically on opp's side, and
//  the engine's `_revertStolenCreatures` cleanup
//  at the next turn-start automatically restores
//  the original controller.
//
//  Cost is paid even when the steal fizzles on
//  an Omni-Immune (Cardinal Beast / Golden Wings)
//  target — same contract every other gold-paying
//  Spell honours.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Aligning Goals';
const GOLD_COST = 5;

/**
 * Eligible targets — every face-up opp Creature with an active effect.
 *
 *   • `engine.getCreatureTargets` uses `hasCardType` under the hood, so
 *     Artifact-Creature hybrids (Powder Keg etc.) qualify.
 *   • `script.creatureEffect === true` is the engine's flag for "this
 *     Creature has an activatable effect" (matches the activatable-
 *     creatures scan at `_engine.js:17447`). Passive-only Creatures
 *     (Splashy Slime, Powder Keg, Sparkfly Worker, …) fail this check
 *     and drop out — the card text grants control of the active effect,
 *     so a target with no active effect would just burn 5 Gold for no
 *     gameplay benefit.
 *   • `inst.counters._effectOverride` (Living Illusion, Megu's spell-
 *     transform, …) can redirect a Creature's active effect to a
 *     different script; honour the override so a transformed Creature
 *     remains targetable through its current effect's script.
 *   • Already-stolen Creatures filtered out so chained Aligning Goals
 *     can't try to re-steal the same Creature.
 */
function _getEligibleTargets(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  return engine.getCreatureTargets(oppIdx).filter(t => {
    const inst = t.cardInstance;
    if (inst && inst.stolenBy != null) return false;
    const effectName = inst?.counters?._effectOverride || t.cardName;
    const script = loadCardEffect(effectName);
    return !!script?.creatureEffect;
  });
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,

  /**
   * Play-time gate: the playing player must have at least 5 Gold AND
   * at least one un-stolen opp Creature available. The Gold check here
   * is what makes the card unplayable at <5 Gold per the card text;
   * `requiresTarget` + an empty target list would already hide it when
   * opp has no Creatures.
   */
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.gold || 0) < GOLD_COST) return false;
    return _getEligibleTargets(engine, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Re-validate gold + targets — state may have shifted between
      // the play gate and resolution (chained discard cost, reactive
      // gold loss, target died inside a chain, etc.).
      if ((ps.gold || 0) < GOLD_COST) {
        gs._spellCancelled = true;
        return;
      }
      const targets = _getEligibleTargets(engine, pi);
      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const selectedIds = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: `Choose an opponent's Creature to commandeer for the rest of the turn. Costs ${GOLD_COST} Gold; you may use its active effect as if you controlled it.`,
        confirmLabel: '⚖️ Align!',
        confirmClass: 'btn-info',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const target = targets.find(t => t.id === selectedIds[0]);
      const inst = target?.cardInstance
        || engine.cardInstances.find(c =>
          c.owner === target?.owner && c.zone === 'support'
          && c.heroIdx === target?.heroIdx && c.zoneSlot === target?.slotIdx);
      if (!inst || inst.zone !== 'support') {
        gs._spellCancelled = true;
        return;
      }

      // Pay the 5-Gold cost up front. Done BEFORE the steal so a
      // post-steal failure path (rare) leaves the gold spent — that
      // matches the card text "Spend 5 Gold" reading as paid on cast,
      // not on success.
      await engine._payCardCost(pi, GOLD_COST);
      engine.log('gold_spent', {
        player: ps.username, amount: GOLD_COST, reason: CARD_NAME,
      });
      engine._broadcastEvent('gold_change', { owner: pi, amount: -GOLD_COST });

      // Flip control via the engine's standard temp-steal primitive.
      // Auto-reverts at the next turn-start cleanup.
      //
      // `skipTakeControlHook: true` — Aligning Goals reads "you may use
      // that Creature's active effect AS IF you controlled it" as a
      // permission grant, not a take-over. The mechanical implementation
      // still flips `inst.controller` (the engine's only way to surface
      // an active effect to a different side), but reaction triggers
      // keyed on take-control events (Very Special Prisoner) must NOT
      // fire — the card text doesn't describe an actual control change.
      const stolen = engine.actionStealCreature(pi, inst, {
        sourceName: CARD_NAME,
        skipTakeControlHook: true,
      });
      if (!stolen) {
        // Omni-immune fizzle (Cardinal Beast, Golden Wings wearer).
        // Gold already spent, card resolves to discard normally.
        engine.log('aligning_goals_fizzle', {
          player: ps.username, target: inst.name, reason: 'immune',
        });
        engine.sync();
        return;
      }

      // Dark control animation anchored on the stolen Creature's
      // slot — same visual Controlled Attack uses, just slot-targeted
      // (the client `dark_control` handler accepts an optional
      // `zoneSlot` and queries the Support Zone instead of the Hero
      // zone when set).
      engine._broadcastEvent('dark_control', {
        owner: target.owner, heroIdx: target.heroIdx,
        zoneSlot: inst.zoneSlot,
      });
      await engine._delay(900);

      engine.log('aligning_goals', {
        player: ps.username, target: inst.name,
        opponent: gs.players[target.owner]?.username,
      });
      engine.sync();
    },
  },
};
