// ═══════════════════════════════════════════
//  CARD EFFECT: "Blackstache, Scourge of the Pixel Seas"
//  Hero (400 HP, 80 ATK)
//  Starting abilities: Terror, Terror.
//
//  Two passive board effects, both enforced
//  engine-side via `_blackstacheBlocksTurnEnd`:
//
//  1. UNAFFECTED BY TERROR — even Blackstache's
//     OWN Terror copies don't trigger the
//     end-turn force on his side. The check in
//     `_checkTerrorThreshold` skips the
//     `_terrorForceEndTurn` flag when Blackstache
//     is alive on the active player's side.
//
//  2. OPP CANNOT END YOUR TURN VIA EFFECTS —
//     Flashbang, future force-end-turn cards from
//     the opponent are no-ops while Blackstache
//     is alive on the receiving side. Cards that
//     end their own turn (Cooldin's "skip to End
//     Phase," Quick Attack's natural advance) are
//     unaffected — the gate only triggers on
//     opponent-source turn-ending effects.
//
//  Script body is empty — the Hero exists as a
//  state marker the engine reads.
// ═══════════════════════════════════════════

const CARD_NAME = 'Blackstache, Scourge of the Pixel Seas';

module.exports = {
  activeIn: ['hero'],

  // Engine-level opt-ins honoured by `_blackstacheBlocksTurnEnd`:
  //   • `immuneToTerror: true` — Terror sources (any side) are
  //     blocked from force-ending this Hero's controller's turn while
  //     this Hero is alive.
  //   • `immuneToOpponentTurnEnd: true` — opponent-source turn-end
  //     effects (Flashbang etc.) are blocked while this Hero is
  //     alive. Same-side / self sources still resolve normally.
  immuneToTerror: true,
  immuneToOpponentTurnEnd: true,

  hooks: {},
};
