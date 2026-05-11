// ═══════════════════════════════════════════
//  ARCHETYPE HELPER: "Crystals"
//
//  Centralized helpers for the Crystal archetype.
//
//  Big Gwen Guard's passive — "While you control
//  this Creature, ignore the effects of all cards
//  that are revealed in your hand by their own
//  effects." — needs to be queried from many
//  unrelated code paths (the cost-doubling check
//  for Rusting Crystal, the summon-lock for
//  Grinning Cat, the hero-effect-negation for
//  Weakening Crystal, the shuffle-into-deck lock
//  for Distracting Crystal, the +1-Spell-level
//  for Mana Absorbing Crystal, the
//  control-handoff for Treacherous Crystal, …).
//
//  Each call site consults `selfRevealEffectsSuppressed(pi)`
//  and short-circuits if it returns true. That keeps
//  the "ignore" rule in one place and lets new self-
//  reveal Crystals plug into the same gate without
//  re-deriving the suppression list.
// ═══════════════════════════════════════════

const BIG_GWEN_GUARD = 'Big Gwen Guard';

/**
 * Does `pi` control a non-negated, non-nulled Big Gwen Guard in a
 * Support Zone? If yes, every "while in hand" effect from auto-
 * revealing Crystals on `pi`'s side is suppressed for the lifetime
 * of that BGG instance.
 *
 * Negation / nullification are honored — a negated BGG provides no
 * suppression aura (matches the engine-wide convention that negated
 * Creatures stop firing their hooks AND don't project passive auras).
 *
 * Returns true if the suppression is active for `pi`.
 */
function controlsBigGwenGuard(engine, pi) {
  if (!engine?.cardInstances) return false;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== BIG_GWEN_GUARD) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.counters?.negated) continue;
    if (inst.counters?.nulled) continue;
    return true;
  }
  return false;
}

/**
 * Alias surfacing the intent at the call site — most readers see
 * "self-reveal effects suppressed" and immediately know to bypass
 * their gate. Same semantics as `controlsBigGwenGuard`.
 */
function selfRevealEffectsSuppressed(engine, pi) {
  return controlsBigGwenGuard(engine, pi);
}

module.exports = {
  BIG_GWEN_GUARD,
  controlsBigGwenGuard,
  selfRevealEffectsSuppressed,
};
