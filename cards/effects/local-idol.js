// ═══════════════════════════════════════════
//  CARD EFFECT: "Local Idol"
//  Artifact (Reaction, Cost 0)
//
//  „Play this card immediately when your opponent uses their second Potion
//   during a turn. Negate that Potion and add it to your hand."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Kettenreaktion (wie Tool Freezer / Key): erscheint im Reaktionsfenster, wenn
//    der Gegner einen TRANK spielt, und nur, wenn es sein ZWEITER Trank dieses
//    Zuges ist — der Zaehler `potionsUsedThisTurn` steht beim Spielen des zweiten
//    Tranks auf 1 (er wird erst NACH der Aufloesung hochgezaehlt; negierte Traenke
//    zaehlen nicht mit).
//  • „Negate … and add it to your hand": `negateChainLink(…, { stealToHandOf: pi })` —
//    derselbe Weg wie bei Key, the Cursed Thief: die negierte Initialkarte
//    wandert in die HAND des Idol-Spielers (mit Flug) statt in die Ablage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/** Juengster nicht negierter gegnerischer Trank in der Kette, falls es sein zweiter dieses Zuges ist. */
function zielTrank(gs, chain, pi) {
  if (!chain || chain.length === 0) return null;
  for (let i = chain.length - 1; i >= 0; i--) {
    const link = chain[i];
    if (link.owner === pi || link.negated) continue;
    if (!hasCardType(link, 'Potion')) continue;
    const opp = gs.players[link.owner];
    if ((opp?.potionsUsedThisTurn || 0) !== 1) return null;   // der ZWEITE Trank dieses Zuges
    return { link, index: i };
  }
  return null;
}

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    if (chainCtx.chain.some(l => l.cardName === 'Local Idol' && l.owner === pi)) return false;
    return !!zielTrank(gs, chainCtx.chain, pi);
  },

  // Nur als Reaktion spielbar.
  canActivate: () => false,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Local Idol can only be activated as a Reaction to your opponent\'s second Potion of the turn.',
    confirmLabel: 'OK',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const ziel = zielTrank(engine.gs, chain, pi);
    if (!ziel) return;
    engine.negateChainLink(chain, ziel.index, { negationStyle: 'thief', stealToHandOf: pi });
    engine.log('local_idol', {
      player: engine.gs.players[pi]?.username, potion: ziel.link.cardName,
    });
  },
};
