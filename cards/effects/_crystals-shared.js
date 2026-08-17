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

// Crystal names referenced by hand-passive gates. Every hand-passive
// helper below resolves through `selfRevealEffectsSuppressed` so the
// Big Gwen Guard aura turns them off uniformly.
const WEAKENING_CRYSTAL = 'Weakening Crystal';
const DISTRACTING_CRYSTAL = 'Distracting Crystal';
const TREACHEROUS_CRYSTAL = 'Treacherous Crystal';
const MANA_ABSORBING_CRYSTAL = 'Mana Absorbing Crystal';

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

/**
 * Weakening Crystal hand-passive: while a copy sits in a player's
 * hand, every alive Hero on that player's side is afflicted with
 * `negated` for the duration. The status is stamped with
 * `_byWeakeningCrystal: true` so REMOVAL only takes our auras off
 * — independently-applied negation (Crash Course / Cute Yokai / …)
 * keeps its own marker.
 *
 * Called from `engine.sync()` so every state push is consistent:
 *   • Crystal added or revealed → next sync applies the negated
 *     status to all the controller's heroes.
 *   • Crystal discarded / played / transferred away → next sync
 *     clears the marker-tagged negation; non-Crystal-sourced
 *     negations stay put.
 *
 * Big Gwen Guard's suppression aura turns this off. Idempotent —
 * safe to call repeatedly.
 */
function refreshWeakeningCrystalNegation(engine) {
  const players = engine?.gs?.players;
  if (!Array.isArray(players)) return;
  for (let pi = 0; pi < players.length; pi++) {
    const ps = players[pi];
    if (!ps?.heroes) continue;
    const hasCrystal = (ps.hand || []).includes(WEAKENING_CRYSTAL)
      && !selfRevealEffectsSuppressed(engine, pi);
    for (const hero of ps.heroes) {
      if (!hero?.name) continue;
      if (hasCrystal) {
        const cur = hero.statuses?.negated;
        if (!cur || cur._byWeakeningCrystal === true) {
          if (!hero.statuses) hero.statuses = {};
          hero.statuses.negated = {
            _byWeakeningCrystal: true,
            appliedTurn: cur?.appliedTurn ?? engine.gs?.turn ?? 0,
          };
        }
      } else if (hero.statuses?.negated?._byWeakeningCrystal === true) {
        delete hero.statuses.negated;
      }
    }
  }
}

/**
 * Distracting Crystal hand-passive: while a copy sits in `pi`'s hand,
 * any of their cards/abilities whose script declares `shufflesFromHandOrDiscardIntoDeck:
 * true` (Leadership, Elana the Rocky Rebel, …) cannot be activated.
 * Consulted by the activatable-ability and hero-effect gates, and by
 * the server-side play handler. Big Gwen Guard's suppression turns
 * this off.
 */
function shuffleIntoDeckBlocked(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return false;
  if (!(ps.hand || []).includes(DISTRACTING_CRYSTAL)) return false;
  if (selfRevealEffectsSuppressed(engine, pi)) return false;
  return true;
}

/**
 * Treacherous Crystal eligibility gate. True iff `victimPi` currently
 * holds a Treacherous Crystal in hand AND Big Gwen Guard isn't
 * suppressing self-reveal Crystal effects on the victim's side. Used
 * by the client-side pulse + click affordance and by the server-side
 * trigger handler to validate the click.
 */
function isTreacherousLent(engine, activatorPi, victimPi) {
  if (activatorPi === victimPi) return false;
  const ps = engine?.gs?.players?.[victimPi];
  if (!ps) return false;
  if (!(ps.hand || []).includes(TREACHEROUS_CRYSTAL)) return false;
  if (selfRevealEffectsSuppressed(engine, victimPi)) return false;
  return true;
}

/**
 * Mana Absorbing Crystal hand-passive: while a copy sits in `pi`'s
 * hand, every Spell in their hand has its effective level raised by
 * +1. Returns the offset to add to a Spell's level for `pi`
 * (+1 when active, 0 otherwise). Big Gwen Guard's suppression turns
 * this off. Caller is responsible for checking `cardData.cardType ===
 * 'Spell'` — Spell-only is the rule of this Crystal, not the helper.
 */
function manaAbsorbingHandSpellLevelOffset(engine, pi) {
  const ps = engine?.gs?.players?.[pi];
  if (!ps) return 0;
  if (!(ps.hand || []).includes(MANA_ABSORBING_CRYSTAL)) return 0;
  if (selfRevealEffectsSuppressed(engine, pi)) return 0;
  return 1;
}

module.exports = {
  BIG_GWEN_GUARD,
  WEAKENING_CRYSTAL,
  DISTRACTING_CRYSTAL,
  TREACHEROUS_CRYSTAL,
  MANA_ABSORBING_CRYSTAL,
  controlsBigGwenGuard,
  selfRevealEffectsSuppressed,
  refreshWeakeningCrystalNegation,
  shuffleIntoDeckBlocked,
  isTreacherousLent,
  manaAbsorbingHandSpellLevelOffset,
};
