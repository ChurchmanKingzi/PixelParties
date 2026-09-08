// ═══════════════════════════════════════════
//  CARD EFFECT: "The Eye of Ren"
//  Artifact (Normal)
//
//  „Choose a card from your deck and send it to your discard pile. You
//   cannot move cards out of your discard pile for the rest of the
//   turn unless you pay an additional 6 Gold."
//
//  ── Als Ruling (29.8.) ────────────────────────────────────────
//  Die 6 Gold sind EINMALIG: die erste Bewegung aus dem Discard im
//  Rest des Zuges kostet 6 (egal, wie viele Karten sie bewegt), jede
//  weitere ist frei. Pflichteffekte (The First Circle of Hell) zahlen,
//  was der Spieler hat — auch 0 — und laufen trotzdem.
//
//  ── Umsetzung ─────────────────────────────────────────────────
//  · Deck-Wahl per Galerie (Magnetic-Glove-Muster), dann
//    `actionMillCards(pi, 1, { targetCardName })` — Flug, Rettungs-
//    fenster (Rebelliokai-Umleitung), `onMill` kommen von dort;
//    `selfInflicted`, sonst wuerde der Erstzug-Schutz das eigene Deck
//    schuetzen.
//  · Die Sperre ist die bestehende Discard-out-Sperre der Staebe
//    (`ps._discardLockedTurn = gs.turn`), erweitert um den FREIKAUF
//    `ps._discardLockBuyout = { cost: 6, turn, source }` — ausgewertet
//    an EINER Stelle, `engine._discardOutAllowed` (v626), die alle
//    Wege aus dem Discard fragen.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Eye of Ren';
const BUYOUT_COST = 6;

module.exports = {
  isTargetingArtifact: true,
  animationType: 'none',
  cpuMeta: { evaluateThroughTurnEnd: true },

  canActivate(gs, pi) {
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },
  getValidTargets: () => [],
  targetingConfig: {
    description: `Choose a card from your deck and send it to your discard pile. For the rest of the turn, moving cards out of your discard pile costs an additional ${BUYOUT_COST} Gold (paid once).`,
    confirmLabel: '👁️ Look!',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };
    const countMap = {};
    for (const n of (ps.mainDeck || [])) countMap[n] = (countMap[n] || 0) + 1;
    const cards = Object.entries(countMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (cards.length === 0) return { aborted: true };

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards,
      title: CARD_NAME,
      description: 'Choose a card from your deck to send to your discard pile.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return { aborted: true };

    const milled = await engine.actionMillCards(pi, 1, {
      targetCardName: picked.cardName, source: CARD_NAME, selfInflicted: true,
    });

    // Sperre + Freikauf fuer den Rest des Zuges.
    ps._discardLockedTurn = gs.turn;
    ps._discardLockBuyout = { cost: BUYOUT_COST, turn: gs.turn, source: CARD_NAME, paidTurn: null };
    engine.log('eye_of_ren', {
      player: ps.username, sent: milled[0] || picked.cardName, buyout: BUYOUT_COST,
    });
    engine.sync();
    return true;
  },
};
