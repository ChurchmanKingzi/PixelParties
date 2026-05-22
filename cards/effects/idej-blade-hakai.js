// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Blade - Hakai"
//  Artifact / Equipment (Idej) — Cost 4
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   Any Destruction Magic Spells the equipped Hero uses have their
//   Destruction Magic level reduced by 1."
//
//  Built from the shared Idej Blade factory — `canEquipToHero` (Idej
//  Heroes only) + a `reduceCardLevel` rebate for Destruction Magic
//  Spells cast by the equipped Hero.
// ═══════════════════════════════════════════

module.exports = require('./_idej-shared').makeIdejBlade('Destruction Magic');
