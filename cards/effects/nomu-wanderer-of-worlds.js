// ═══════════════════════════════════════════
//  CARD EFFECT: "Nomu, Wanderer of Worlds"
//  Hero — Passive draw enhancer + hand limit bypass
//
//  Whenever you draw exactly 1 card (except
//  through this effect), draw 1 additional card
//  from your deck. You have no hand size limit.
//
//  Tracking is handled by the engine:
//  _hasActiveNomu() + auto extra draw in actionDrawCards
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  isNomuHero: true,
  bypassHandLimit: true,

  // Purely passive — the engine handles the draw bonus
  // via _hasActiveNomu() in actionDrawCards() and
  // hand limit bypass in enforceHandLimit / _checkReactiveHandLimits.
};
