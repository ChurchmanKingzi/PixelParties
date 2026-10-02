// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sacred Blade"
//  Artifact (Cost 0)
//
//  „If you have 4 copies of this card in your deck, your deck may contain
//   5 copies of every Attack, Spell and Creature."
//
//  Reine DECKBAU-Klausel (`hasSacredBladeBonus` / `getCardMax` in
//  app-shared.jsx, Gegenstueck zu Sacred Jewel und Cecilia). Im Kampf tut
//  die Karte nichts — sie ist daher nicht spielbar (`neverPlayable`, graut
//  auf der Hand aus, Server und CPU respektieren das).
// ═══════════════════════════════════════════

module.exports = {
  neverPlayable: true,
  hooks: {},   // der Lader ignoriert Skripte ohne `hooks`
};
