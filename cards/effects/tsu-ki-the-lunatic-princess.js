// ═══════════════════════════════════════════
//  CARD EFFECT: "Tsu'Ki, the Lunatic Princess"
//  Hero (400 HP / 40 ATK — Magic Arts + Support
//  Magic starting abilities)
//
//  "This Hero can summon 'Lunatic' Creatures
//   regardless of their level. 'Lunatic Cycle'
//   cards that are equipped to this Hero have
//   their Cost reduced by 10."
//
//  Both effects are PASSIVE gate/cost functions
//  the engine consults — no hooks needed:
//
//   • `canBypassLevelReqForCard` — engine's
//     `heroMeetsLevelReq` consults this hero-side
//     gate (same path Cute Princess Mary uses).
//     Returning true skips the school/level check
//     for Lunatic Creatures (Lunatic Golem / Hawk)
//     so Tsu'Ki can drop them without Summoning
//     Magic of her own.
//
//   • `equipCostReduction` — consulted in
//     server.js `doPlayArtifact` for the TARGET
//     Hero of an equip (the small additive hook
//     added there). −10 gold for any Lunatic
//     Cycle card equipped onto Tsu'Ki.
// ═══════════════════════════════════════════

const { isLunaticCreature, isLunaticCycle } = require('./_lunatic-shared');

module.exports = {
  activeIn: ['hero'],

  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData /* , engine */) {
    return isLunaticCreature(cardData);
  },

  // Called by doPlayArtifact only for the equip's TARGET Hero, so we
  // just need to recognise the card. Lunatic Cycle cards cost 10 less
  // when equipped to Tsu'Ki.
  equipCostReduction(gs, playerIdx, heroIdx, cardData /* , engine */) {
    return (cardData && isLunaticCycle(cardData.name)) ? 10 : 0;
  },
};
