// ═══════════════════════════════════════════
//  CARD EFFECT: "The Great Wall of Deri"
//  Artifact (Equipment, Cost 10)
//
//  Equip this card to a Hero you control. While
//  you control this card, Creatures you control
//  cannot be chosen by your opponent's cards or
//  effects, except if they deal direct damage.
//
//  Implementation
//  ──────────────
//  • Pure declarative shield. The single
//    `isNondamageOpponentShield: true` flag opts
//    this card into the engine's generic per-side
//    non-damage-shield filter — see
//    `_isSideNondamageShielded` in `_engine.js`
//    and the matching filter blocks in
//    `promptDamageTarget` / `promptMultiTarget`.
//
//  • Coverage: the engine's targeting filters
//    walk live `cardInstances` for the flag, so
//    the protection automatically tracks every
//    interaction — equip, transfer, control
//    swap (Diplomacy / Dark Gear), destroy. No
//    hooks needed; the flag IS the contract.
//
//  • Exception ("direct damage"): the filters
//    consult `config.damageType` and
//    `config.baseDamage` on the targeting
//    prompt. When either is set, the shield is
//    bypassed — every targeted damage prompt in
//    the codebase tags one of those, while non-
//    damage targeting (steal, charm, status
//    apply, buff redirect, etc.) leaves both
//    undefined and gets filtered.
//
//  • Multi-wall stacking: idempotent. Two walls
//    on the same side are no stronger than one
//    — the helper short-circuits on the first
//    match.
// ═══════════════════════════════════════════

module.exports = {
  // Live in the support zone (Equipment is placed there). The engine
  // walks tracked instances filtering by zone === 'support' when
  // resolving the shield, so the `activeIn` declaration also gates
  // any future hook fires we add to this script.
  activeIn: ['support'],

  // The generic shield flag. Engine's
  // `_isSideNondamageShielded(side)` returns true whenever `side`
  // controls at least one face-up support-zone instance carrying
  // this flag. `promptDamageTarget` and `promptMultiTarget`
  // consult that helper to filter out the shielded side's
  // Creatures from any non-damage targeting picker. No
  // additional plumbing required.
  isNondamageOpponentShield: true,
};
