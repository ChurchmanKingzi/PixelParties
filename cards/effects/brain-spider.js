// ═══════════════════════════════════════════
//  CARD EFFECT: "Brain Spider"
//  Creature (Summoning Magic Lv1, Normal) — 50 HP
//
//  "You may send a Surprise you control to the discard pile to summon
//   this Creature as an additional Action. While you control this
//   Creature, all Heroes you control can activate Surprises in any of
//   your other Heroes' Surprise Zones as if they were placed in theirs
//   (but they still need the Abilities necessary to activate them)."
//
//  Mechanics
//  ─────────
//   • Summon-cost path via shared `makeSurpriseCostSummon(1)` mixin.
//   • Cross-host Surprise activation: the engine's
//     `_checkSurpriseWindow` consults `engine._controllerHasBrainSpider(pi)`
//     and, when true, lets the targeted Hero activate Surprises on
//     sibling Heroes' zones — the activator's school / level is
//     checked, and `_activateSurprise(..., { hostHeroIdx })` rebinds
//     the Surprise inst's `heroIdx` to the activator for resolution
//     ("as if placed in theirs"). Brain Spider's own presence /
//     status is the gate, so the card script itself carries no
//     special hook — the engine query owns the logic.
//   • While Brain Spider is Frozen / Stunned / Negated / Nulled the
//     engine helper returns false, naturally silencing the cross-host
//     clause (the `_controllerHasBrainSpider` guard checks `inst.counters`).
// ═══════════════════════════════════════════

const { makeSurpriseCostSummon } = require('./_spider-shared');

const CARD_NAME = 'Brain Spider';
const SURPRISE_COST = 1;

module.exports = {
  activeIn: ['support'],
  // Generic opt-in honoured by `engine._controllerHasBrainSpider(pi)`
  // (which now scans for ANY active support Creature carrying this
  // flag). While at least one source is on `pi`'s side, the engine's
  // `_checkSurpriseWindow` lets the targeted Hero activate Surprises
  // on sibling Heroes' zones as if placed in theirs.
  grantsCrossHeroSurpriseActivation: true,

  // The summon-cost mixin handles the "send 1 Surprise → free Action"
  // path. The persistent cross-host Surprise activation is enforced
  // engine-side — no card hook needed.
  ...makeSurpriseCostSummon(SURPRISE_COST, CARD_NAME),
};
