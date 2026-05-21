// ═══════════════════════════════════════════
//  CARD EFFECT: "Truth-Seeing Eye"
//  Artifact (Equipment, Cost 2)
//
//  "The equipped Hero can choose any target with
//   Attacks and Spells, negating all effects that
//   would prevent those targets from being chosen,
//   and the equipped Hero's Attacks and Spells
//   cannot be redirected."
//
//  This is a PURELY PASSIVE equip — like Diver
//  Helmet it has no hooks / active behaviour of
//  its own. The rule is enforced ENTIRELY by the
//  engine: `engine._sourceHasTruthSeeingEye(src)`
//  returns true when an Attack / Spell's casting
//  Hero has a live Truth-Seeing Eye equipped, and
//  the three target pickers (`promptDamageTarget`,
//  `promptMultiTarget`, `promptTarget`) then set
//  `ignoreUntargetable` + `_truthSeeingEye`
//  (bypassing every "prevent from being chosen"
//  filter — untargetable status / Golden Wings /
//  Perfect Disguise / The Great Wall of Deri /
//  Deepsea Horror Clown taunt / Invisibility
//  Cloak's post-negation lockout) and
//  `cannotBeRedirected` (Challenge / Martyry /
//  Anti-Magnet / Shield of Wisdom are skipped).
//  `_checkTargetRedirect` also short-circuits on
//  the same helper as belt-and-suspenders.
//
//  Deliberately SCOPED to the equipped Hero's
//  Attacks and Spells only — a Creature in its
//  Support Zone whose effect targets is NOT the
//  Hero's "Attack or Spell", so Anti-Magnet /
//  Shield of Wisdom can still redirect that.
//
//  Post-target NEGATION reactions (Invisibility
//  Cloak fully negating, Storm Ring negating a
//  multi-target Spell) are NOT suppressed — they
//  resolve normally; the Eye only governs which
//  targets can be CHOSEN and that the cast can't
//  be REDIRECTED.
//
//  Equipment placement is driven by the card DB
//  subtype ('Equipment') in server.js
//  `doPlayArtifact`, not by this module, so no
//  placement logic is needed here. `isEquip: true`
//  is declared only so the loader recognises the
//  module (it has no hooks) and treats it as an
//  equip consistently.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  // CPU: like Diver Helmet, Truth-Seeing Eye is a binary ON/OFF
  // capability toggle, not a stackable stat stick — a 2nd copy on the
  // same Hero does nothing. `protectiveToggleEquip` tells the CPU equip
  // planner to never double-equip a Hero, skip the card when every
  // eligible Hero already has one, and otherwise send it to the most
  // valuable Hero by the engine's own MCTS hero-value criteria.
  cpuMeta: { protectiveToggleEquip: true },
};
