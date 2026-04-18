// ═══════════════════════════════════════════
//  Shared helpers for the "sacrifice summon" pattern.
//
//  A Creature is said to have a sacrifice cost when
//  it can only be summoned by destroying some of
//  the controller's own Creatures that satisfy a
//  spec (minimum count, minimum combined max HP,
//  optional custom filter). Steam Dwarf Dragon
//  Pilot is the first card using it, but the
//  mechanism is intentionally generic — any future
//  "tribute summon" / "sacrifice summon" Creature
//  should build on top of this.
//
//  The spec's two halves:
//    • canSummon — cheap boolean check. Used for
//      gating play from hand AND for filtering
//      summon effects (Living Illusion, etc.).
//    • beforeSummon — async pre-placement hook.
//      Prompts for sacrifices, destroys them, runs
//      a `spec.onResolved(ctx, sacrifices)` callback
//      (for card-specific riders like Dragon Pilot's
//      "all Lv1 → bonus action"). Returning false
//      aborts the summon entirely, which is the
//      point of doing this BEFORE placement — a
//      failed sacrifice never leaves a ghost
//      creature briefly on the board.
//
//  Loader ignores files starting with "_", so this
//  module is private infrastructure and never gets
//  registered as a card.
// ═══════════════════════════════════════════

const { getSacrificableCreatures } = require('./_steam-dwarf-shared');

/**
 * Greedy check: given candidate creatures, could you assemble a subset of
 * `minCount` of them whose combined max HP meets `minMaxHp`?
 *
 * Since we only care whether ANY valid set exists, sort by max HP desc
 * and grab the top `minCount` — if those don't clear the bar, no other
 * combination does either. O(n log n).
 */
function hasValidSacrificeSet(candidates, minCount, minMaxHp = 0) {
  if (!candidates || candidates.length < minCount) return false;
  if (minMaxHp <= 0) return true; // Only the count threshold matters.
  const sorted = [...candidates].sort((a, b) => b.maxHp - a.maxHp);
  let sum = 0;
  for (let i = 0; i < minCount; i++) sum += sorted[i].maxHp || 0;
  return sum >= minMaxHp;
}

/**
 * Collect sacrificable candidates for the given player, with optional
 * card-specific filter. Always excludes the CURRENT creature itself (a
 * Creature can't sacrifice itself as part of its own summon cost) via
 * the `selfId` arg — pass the freshly-played card instance's id.
 *
 * Filter signature: (candidate) → bool. Candidate shape matches
 * _steam-dwarf-shared's `getSacrificableCreatures`:
 *   { inst, cardName, maxHp, level }
 */
function collectCandidates(engine, playerIdx, spec, selfId) {
  let cs = getSacrificableCreatures(engine, playerIdx);
  if (selfId != null) cs = cs.filter(c => c.inst.id !== selfId);
  if (spec?.filter) cs = cs.filter(c => spec.filter(c));
  return cs;
}

/**
 * Pure gate: could we satisfy this sacrifice spec RIGHT NOW?
 *
 * Used by both canSummon (hand + summon effects) and by Living-Illusion-
 * style filters to exclude the Creature from galleries if its cost
 * can't be paid.
 */
function canSatisfySacrifice(engine, playerIdx, spec, selfId) {
  const candidates = collectCandidates(engine, playerIdx, spec, selfId);
  return hasValidSacrificeSet(candidates, spec.minCount, spec.minMaxHp || 0);
}

/**
 * Interactive sacrifice resolution. Runs the full loop:
 *   1. Re-verify a valid set still exists (state may have shifted).
 *   2. Prompt the player to pick a valid subset. Re-prompts on
 *      invalid selections (too few, or insufficient combined HP).
 *   3. Destroy the chosen creatures in order. Each destroy fires
 *      onCreatureDeath naturally.
 *   4. Invoke `spec.onResolved(ctx, sacrifices)` for card-specific
 *      side effects (e.g. Dragon Pilot's all-Lv1 bonus action).
 *
 * Returns `true` when sacrifices were paid, `false` when not possible
 * (summon should be aborted by the caller). Exceptions in the
 * onResolved callback don't abort — they're logged and swallowed so
 * failures in a rider can't brick the whole summon.
 *
 * Intended to be called from a card's `beforeSummon(ctx)` hook.
 */
async function resolveSacrificeCost(ctx, spec) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const selfId = ctx.card?.id;

  const candidates = collectCandidates(engine, pi, spec, selfId);
  if (!hasValidSacrificeSet(candidates, spec.minCount, spec.minMaxHp || 0)) {
    // Shouldn't reach here if the gate worked, but bail safely.
    engine.log('sacrifice_fizzle', {
      card: ctx.cardName, player: engine.gs.players[pi]?.username,
      reason: 'no_valid_set',
    });
    return false;
  }

  const targets = candidates.map(c => ({
    id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
    type: 'equip',
    owner: c.inst.owner,
    heroIdx: c.inst.heroIdx,
    slotIdx: c.inst.zoneSlot,
    cardName: c.cardName,
    cardInstance: c.inst,
    _meta: { maxHp: c.maxHp, level: c.level },
  }));

  const defaultDesc = `Sacrifice ${spec.minCount}+ of your Creatures (not summoned this turn)` +
    (spec.minMaxHp ? ` with combined max HP ≥ ${spec.minMaxHp}` : '') + '.';

  let picked = null;
  while (true) {
    const ids = await engine.promptEffectTarget(pi, targets, {
      title: spec.title || `${ctx.cardName} — Sacrifice`,
      description: spec.description || defaultDesc,
      confirmLabel: spec.confirmLabel || '🗡️ Sacrifice!',
      confirmClass: spec.confirmClass || 'btn-danger',
      cancellable: false, // Cost must be paid — the summon gate already said it's possible.
      maxTotal: targets.length,
      minRequired: spec.minCount,
      // Tells the frontend to keep the confirm button disabled until the
      // sum of the selected targets' `_meta.maxHp` reaches this floor.
      // Matches the server-side validation in the re-prompt loop below,
      // so the user gets visual feedback instead of seeing the prompt
      // silently re-open on an invalid click.
      minSumMaxHp: spec.minMaxHp || undefined,
    });
    if (!ids || ids.length < spec.minCount) continue;
    const chosen = ids.map(id => targets.find(t => t.id === id)).filter(Boolean);
    if (chosen.length < spec.minCount) continue;
    if (spec.minMaxHp) {
      const sumMax = chosen.reduce((s, t) => s + (t._meta.maxHp || 0), 0);
      if (sumMax < spec.minMaxHp) continue; // Re-prompt — insufficient HP.
    }
    picked = chosen;
    break;
  }

  for (const t of picked) {
    try {
      await engine.actionDestroyCard(
        { name: ctx.cardName, owner: pi, heroIdx: ctx.cardHeroIdx },
        t.cardInstance,
      );
    } catch (err) {
      console.error(`[${ctx.cardName}] sacrifice destroy failed:`, err.message);
    }
  }

  engine.log('sacrifice_paid', {
    card: ctx.cardName,
    player: engine.gs.players[pi]?.username,
    victims: picked.map(t => t.cardName),
    count: picked.length,
  });

  if (spec.onResolved) {
    try {
      await spec.onResolved(ctx, picked);
    } catch (err) {
      console.error(`[${ctx.cardName}] sacrifice onResolved rider failed:`, err.message);
    }
  }

  return true;
}

module.exports = {
  hasValidSacrificeSet,
  canSatisfySacrifice,
  resolveSacrificeCost,
  // Re-export for convenience so sacrifice-using cards only import this module.
  getSacrificableCreatures,
};
