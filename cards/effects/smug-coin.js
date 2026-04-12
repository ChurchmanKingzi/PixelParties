// ═══════════════════════════════════════════
//  CARD EFFECT: "Smug Coin"
//  Artifact (Equipment, 10 Gold) — Equip to
//  a Hero. When lethal damage from an opponent's
//  source or a status effect (Burn, Poison)
//  would drop the equipped Hero to 0 HP, cap
//  at 1 HP instead. Then delete this card.
//
//  Only 1 Smug Coin can be played per game.
//
//  The actual lethal protection is handled in
//  the engine's damage path (after capAtHPMinus1)
//  so it runs after all damage modifiers.
// ═══════════════════════════════════════════

module.exports = {
  isEquip: true,
  oncePerGame: true,
};
