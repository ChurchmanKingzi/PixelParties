// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Princess Mary"
//  Hero (250 HP, 30 ATK — Charme + Leadership
//  starting abilities)
//
//  Two complementary effects:
//
//  1. POSITIVE — Mary may summon "Cute"
//     Creatures regardless of their level. The
//     engine's `heroMeetsLevelReq` consults
//     `canBypassLevelReqForCard` on the hero
//     script; we return true for any Creature
//     whose name contains "Cute" as a WHOLE
//     WORD (so "Cuteness Drone" doesn't
//     qualify — see `_cute-shared.js`).
//
//  2. NEGATIVE — Mary may NOT summon
//     non-Cute Creatures at all. Implemented
//     via `canPlayCard`, which the engine
//     consults from `getHeroPlayableCards` and
//     `validateActionPlay`. Spells, Attacks,
//     Abilities, Artifacts pass through
//     unchanged — only Creatures are gated.
//
//  Together these make Mary a Cute-tribal
//  hero — she can drop high-level Cute
//  Creatures from hand without Summoning
//  Magic levels, but she has no access to
//  any other Creature pool.
// ═══════════════════════════════════════════

const { hasCuteInName, heroHasCuteWings } = require('./_cute-shared');

module.exports = {
  activeIn: ['hero'],

  /**
   * Hero-side play gate. Returning false here makes the engine treat
   * the card as un-playable on Mary, dimming it client-side and
   * rejecting any direct play attempt. Non-Creature cards pass
   * through unchanged.
   *
   * "Cute Wings" makes EVERY Creature Mary summons count as "Cute", so
   * while she wears it her "can only summon Cute Creatures" restriction
   * opens up to any Creature.
   */
  canPlayCard(gs, playerIdx, heroIdx, cardData, engine) {
    if (cardData.cardType !== 'Creature') return true;
    return hasCuteInName(cardData.name) || heroHasCuteWings(engine, playerIdx, heroIdx);
  },

  /**
   * Hero-side level-req bypass. Mary skips the school / level check
   * (and any Wisdom-paid coverage) when summoning a Cute Creature —
   * she'll happily host a Lv3 Cute Phoenix despite having no
   * Summoning Magic of her own. With "Cute Wings" equipped, every
   * Creature she summons counts as Cute, so the bypass extends to ANY
   * Creature regardless of level.
   */
  canBypassLevelReqForCard(gs, playerIdx, heroIdx, cardData, engine) {
    if (cardData.cardType !== 'Creature') return false;
    return hasCuteInName(cardData.name) || heroHasCuteWings(engine, playerIdx, heroIdx);
  },
};
