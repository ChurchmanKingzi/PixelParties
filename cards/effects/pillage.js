// ═══════════════════════════════════════════
//  CARD EFFECT: "Pillage"
//  Ability — Free activation once per turn.
//
//  Mill the top N cards of the opponent's deck:
//    Lv1: 1 card
//    Lv2: 3 cards
//    Lv3: 5 cards
//
//  Milling sends cards directly from deck to
//  discard — this is NOT discarding and does
//  NOT fire onDiscard hooks. It fires onMill.
//  Uses engine.actionMillCards (centralised).
// ═══════════════════════════════════════════

const MILL_BY_LEVEL = [1, 3, 5];

module.exports = {
  // Spielgestalter-Entscheidung 16.11.2026: trifft nur die Gegnerseite. Der Erste-Runden-Schutz des Gegners sperrt die Karte NICHT mehr (aktivierbar, die Wirkung verpufft) — die Markierung dient nur noch der CPU (`engine.nutzlosErsteRunde`: sie aktiviert sie nicht gegen den Geschuetzten).
  blockedByFirstTurnProtection: true,
  activeIn: ['ability'],
  freeActivation: true,

  canFreeActivate(ctx, level) {
    const pi     = ctx.cardOwner;
    const oppIdx = ctx._engine.opponentOf(pi);
    const oppPs  = ctx.players[oppIdx];
    // Turn-1 protection: milling the top of a shielded opp's deck
    // is blocked. Same gate Thieving / Infiltration / Enigma apply.
    // ★ Spielgestalter-Entscheidung 16.11.2026: ÜBERHOLT — aktivierbar, der Mill verpufft (`onFreeActivate`).
    if (ctx._engine.cpuMeidetErsteRunde(ctx.cardOwner)) return false;   // CPU (Spielgestalter-Entscheidung 16.11.2026): der Mensch darf die nutzlose Aktivierung gegen den Erste-Runden-Geschuetzten wählen, die CPU nicht
    return (oppPs?.mainDeck || []).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const oppIdx  = engine.opponentOf(pi);

    // Spielgestalter-Entscheidung 16.11.2026: gegen den Erste-Runden-Geschuetzten gespielt (Einsatz verbraucht), der Mill verpufft.
    if (gs.firstTurnProtectedPlayer === oppIdx) { engine.log('pillage_fizzle', { player: gs.players[pi]?.username, reason: 'first-turn protection' }); engine.sync(); return true; }

    const count = MILL_BY_LEVEL[Math.min(level, 3) - 1] ?? 1;

    // Stream Pillage's card image to both players before the mill,
    // then clear the pending reveal so the server doesn't fire it again after resolution.
    engine.commitAppearance();   // W64b: zentral (nicht zusätzlich ein eigenes card_reveal — das zeigte die Karte doppelt)
    await engine._delay(400);

    await ctx.millCards(oppIdx, count, { source: 'Pillage' });

    engine.log('pillage_activated', {
      player: gs.players[pi]?.username,
      hero:   ctx.heroName(),
      level,
      count,
    });
  },
};
