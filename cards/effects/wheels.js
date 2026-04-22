// ═══════════════════════════════════════════
//  CARD EFFECT: "Wheels"
//  Artifact — Two modes:
//    Draw 3: Draw 3 cards, then discard 1.
//    Draw 4: Draw 4 cards, then delete 2.
//  Hard once per turn.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  // MCTS gate undervalues Wheels because the evaluator sees hand churn as
  // near-zero immediate delta (draw → discard nets ≈0 "eval units"), but
  // Wheels is a strict tempo upgrade: HOPT-limited, cost-effective, never
  // a trap. Always fire when legal — bypass the variation search.
  cpuSkipMctsGate: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `wheels:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    return true;
  },

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return { cancelled: true };

    // Prompt for mode selection (with cancel)
    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: 'Wheels',
      description: 'Choose your ride:',
      options: [
        { id: 'draw3', label: 'Draw 3, Discard 1', description: 'Draw 3 cards, then discard 1 from your hand.', color: '#44cc88' },
        { id: 'draw4', label: 'Draw 4, Delete 2', description: 'Draw 4 cards, then delete 2 from your hand.', color: '#ff8844' },
      ],
      cancellable: true,
    });

    if (!choice || choice.cancelled) return { cancelled: true };

    // Claim HOPT only after confirming a mode (cancel doesn't consume it)
    if (!engine.claimHOPT('wheels', pi)) return;

    if (choice.optionId === 'draw3') {
      // ── Mode A: Draw 3, Discard 1 ──
      await engine.actionDrawCards(pi, 3);

      if ((ps.hand || []).length === 0) return;

      const result = await engine.promptGeneric(pi, {
        type: 'forceDiscard',
        count: 1,
        title: 'Wheels — Draw 3',
        description: 'You must discard 1 card from your hand.',
        cancellable: false,
      });

      if (!result || !result.cardName) return;
      const handIdx = result.handIndex;
      if (handIdx == null || handIdx < 0 || handIdx >= ps.hand.length || ps.hand[handIdx] !== result.cardName) return;
      ps.hand.splice(handIdx, 1);
      ps.discardPile.push(result.cardName);
      engine.log('force_discard', { player: ps.username, card: result.cardName, by: 'Wheels' });
      engine.sync();

    } else if (choice.optionId === 'draw4') {
      // ── Mode B: Draw 4, Delete 2 ──
      await engine.actionDrawCards(pi, 4);

      for (let d = 0; d < 2; d++) {
        if ((ps.hand || []).length === 0) break;

        const result = await engine.promptGeneric(pi, {
          type: 'forceDiscard',
          count: 1,
          title: 'Wheels — Draw 4',
          description: `You must delete ${2 - d} more card${2 - d > 1 ? 's' : ''} from your hand.`,
          instruction: 'Click a card in your hand to delete it.',
          cancellable: false,
        });

        if (!result || !result.cardName) {
          // Safety fallback: auto-delete from end
          const cardName = ps.hand.pop();
          if (cardName) {
            ps.deletedPile.push(cardName);
            engine.log('force_delete', { player: ps.username, card: cardName, by: 'Wheels' });
          }
          engine.sync();
          continue;
        }

        const handIdx = result.handIndex;
        if (handIdx != null && handIdx >= 0 && handIdx < ps.hand.length && ps.hand[handIdx] === result.cardName) {
          ps.hand.splice(handIdx, 1);
        } else {
          const fallbackIdx = ps.hand.indexOf(result.cardName);
          if (fallbackIdx >= 0) ps.hand.splice(fallbackIdx, 1);
          else continue;
        }
        ps.deletedPile.push(result.cardName);
        engine.log('force_delete', { player: ps.username, card: result.cardName, by: 'Wheels' });
        engine.sync();
      }
    }
  },
};
