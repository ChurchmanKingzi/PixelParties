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

const CUTE_RE = /\bCute\b/;

function hasCuteInName(cardName) {
  if (!cardName) return false;
  return CUTE_RE.test(cardName);
}

module.exports = { hasCuteInName };
