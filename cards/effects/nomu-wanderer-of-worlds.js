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
  // Ladungsanzeige am Heldenportrait (Als Vorgabe 16.8.).
  //
  // SONDERFALL: Nomus Zaehler gehoert der ENGINE, nicht der Karte —
  // `actionDrawCards` fuehrt ihn unter `gs._nomuDrawCount` je Spieler
  // (die Karte selbst ist rein passiv, sie hat gar keinen Hook). Der
  // Zaehler wird beim Rundenbeginn fuer BEIDE Seiten genullt, ist also
  // schon nach Als Regel gebaut; er bleibt deshalb, wo er ist, und die
  // Anzeige liest ihn nur.
  chargesPerTurn: 3,
  remainingCharges: (inst, gs) => {
    const pi = inst?.controller ?? inst?.owner;
    if (pi == null) return null;
    const benutzt = gs?._nomuDrawCount?.[`nomu_draws:${pi}`] || 0;
    return { remaining: Math.max(0, 3 - benutzt), max: 3 };
  },
  activeIn: ['hero'],
  isNomuHero: true,
  bypassHandLimit: true,

  // Purely passive — the engine handles the draw bonus
  // via _hasActiveNomu() in actionDrawCards() and
  // hand limit bypass in enforceHandLimit / _checkReactiveHandLimits.
};
