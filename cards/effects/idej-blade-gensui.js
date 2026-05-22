// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Blade - Gensui"
//  Artifact / Equipment (Idej) — Cost 4
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   Any Decay Magic Spells the equipped Hero uses have their Decay
//   Magic level reduced by 1."
//
//  Built from the shared Idej Blade factory — `canEquipToHero` (Idej
//  Heroes only) + a `reduceCardLevel` rebate for Decay Magic Spells
//  cast by the equipped Hero.
// ═══════════════════════════════════════════

module.exports = require('./_idej-shared').makeIdejBlade('Decay Magic');
