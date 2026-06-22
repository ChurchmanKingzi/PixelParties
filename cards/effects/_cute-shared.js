// ═══════════════════════════════════════════
//  Shared "Cute" archetype helpers.
//
//  Several cards (Cute Princess Mary, future
//  Cute synergy cards) need to differentiate
//  Creatures whose name contains "Cute" as a
//  WHOLE WORD from those where the substring
//  "Cute" is part of a larger word. Examples:
//    • "Cute Phoenix"      → matches  ✓
//    • "Cute Bird"         → matches  ✓
//    • "Cuteness Drone"    → does NOT match
//    • "Acute Vision"      → does NOT match
//
//  `\bCute\b` is the right regex — `\b`
//  enforces a word boundary on both sides, so
//  the embedded substrings ("Cuteness",
//  "Acute") fail. Case-sensitive on purpose:
//  every card in cards.json that opts into the
//  Cute archetype starts with capital "Cute".
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CUTE_RE = /\bCute\b/;
const CUTE_WINGS = 'Cute Wings';

function hasCuteInName(cardName) {
  if (!cardName) return false;
  return CUTE_RE.test(cardName);
}

// ── Dynamic "Cute" membership via "Cute Wings" ─────────────────────
//  "Cute Wings" (Artifact / Equipment): "All Creatures that Hero summons
//  count as 'Cute' Creatures." Like Diver Helmet, Cute Wings is a passive
//  equip whose rule is enforced by every consumer:
//   • SUMMON-DECISION gates (Cute Princess Mary's summon restriction /
//     level bypass; Army of the Cute's "Cute" target pick) add
//     `|| heroHasCuteWings(engine, pi, heroIdx)` for the summoning Hero,
//     so a Wings Hero may summon / pick ANY Creature.
//   • BOARD membership (future "Cute Creatures you control" effects)
//     uses `isCuteCreatureInst` — a Creature in a Wings Hero's Support
//     Zone counts as Cute (summons land in the summoning Hero's zone).
//  Never read `cardData.archetype === 'Cute'` directly for these — the
//  Wings grant would be silently ignored.

/**
 * Is the Hero at (playerIdx, heroIdx) equipped with a "Cute Wings"?
 * Matches on the physical side (owner) AND controller so a
 * control-transferred equip still grants membership on the Hero it sits
 * on. Mirror of `heroHasDiverHelmet`.
 */
function heroHasCuteWings(engine, playerIdx, heroIdx) {
  if (!engine || playerIdx == null || playerIdx < 0) return false;
  if (heroIdx == null || heroIdx < 0) return false;
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.name !== CUTE_WINGS) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (inst.owner !== playerIdx && (inst.controller ?? inst.owner) !== playerIdx) continue;
    return true;
  }
  return false;
}

/**
 * Does this Creature INSTANCE count as a "Cute" Creature right now?
 * True when EITHER (a) its printed archetype is "Cute", OR (b) it sits
 * in the Support Zone of a Hero wearing "Cute Wings". Uses the
 * instance's PHYSICAL side (`owner`) for the zone lookup because Support
 * Zones are physical (a charmed Creature still occupies its owner's zone).
 * Non-Creature instances (equips, etc.) are never "Cute".
 */
function isCuteCreatureInst(engine, inst) {
  if (!engine || !inst) return false;
  const cd = engine._getCardDB?.()[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  if (cd.archetype === 'Cute') return true; // printed Cute-archetype Creature
  if (inst.zone === 'support' && inst.heroIdx != null && inst.heroIdx >= 0
      && heroHasCuteWings(engine, inst.owner, inst.heroIdx)) return true;
  return false;
}

module.exports = { hasCuteInName, CUTE_WINGS, heroHasCuteWings, isCuteCreatureInst };
