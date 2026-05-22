// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Blade - Manabi"
//  Artifact / Equipment (Idej) — Cost 4
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   Any Magic Arts Spells the equipped Hero uses have their Magic
//   Arts level reduced by 1."
//
//  Built from the shared Idej Blade factory — `canEquipToHero` (Idej
//  Heroes only) + a `reduceCardLevel` rebate for Magic Arts Spells
//  cast by the equipped Hero.
// ═══════════════════════════════════════════

module.exports = require('./_idej-shared').makeIdejBlade('Magic Arts');
