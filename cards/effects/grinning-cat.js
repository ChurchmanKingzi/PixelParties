// ═══════════════════════════════════════════
//  CARD EFFECT: "Grinning Cat"
//  Creature (Normal, Lv0 Summoning Magic) — Crystals
//  HP 50
//
//  Auto-reveal in hand. While a copy is in your
//  hand, you cannot summon any Creatures except
//  "Grinning Cat". Big Gwen Guard's suppression
//  aura lifts the restriction.
//
//  Implementation:
//   • `revealOnEnterHand: true` — engine auto-
//     stamps `_permanentlyRevealedHandIndices` on
//     every canonical add-to-hand path.
//   • Summon-lock — centrally wired in
//     `engine.getSummonBlocked(playerIdx)`. While
//     a copy is in the player's hand AND BGG isn't
//     suppressing, every non-Grinning-Cat Creature
//     in that hand is pushed onto the blocked list.
//
//  The Creature itself has no on-summon effect —
//  it's a vanilla 50 HP body once it lands.
// ═══════════════════════════════════════════

const CARD_NAME = 'Grinning Cat';

module.exports = {
  activeIn: ['support'],
  revealOnEnterHand: true,
  // Generic opt-in honoured by `engine.getSummonBlocked(pi)`. While
  // any copy of this card is in `pi`'s hand, every Creature in that
  // hand whose name is NOT this card's name is added to the blocked
  // list. Big Gwen Guard's self-reveal suppression lifts it.
  handSummonLockExceptSelf: true,
  // Empty hooks bag keeps the loader from culling this module — the
  // gate above is read via `loadCardEffect`, and the loader rejects
  // modules with no recognised type/hook flag.
  hooks: {},
};
