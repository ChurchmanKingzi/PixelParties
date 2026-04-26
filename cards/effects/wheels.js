// ═══════════════════════════════════════════
//  CARD EFFECT: "Wheels"
//  Artifact — Two modes:
//    Draw 3: Draw 3 cards, then discard 1.
//    Draw 4: Draw 4 cards, then delete 2.
//  Hard once per turn.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

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

    // Compute the hand index of THIS Wheels copy so we can exclude it
    // from the prompts below — Wheels is mid-resolution and shouldn't
    // be a valid target of its own forced-discard / forced-delete cost.
    // The natural cleanup at the end of doUseArtifactEffect moves it
    // to discard; allowing the CPU (or a confused human) to pick it
    // here just sends Wheels to the deletedPile by mistake.
    const resolvingHandIdx = () => {
      const r = ps._resolvingCard;
      if (!r || r.name !== 'Wheels') return -1;
      const target = r.nth || 1;
      let count = 0;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] !== 'Wheels') continue;
        count++;
        if (count === target) return i;
      }
      return -1;
    };
    const buildEligibleIndices = () => {
      const exclude = resolvingHandIdx();
      if (exclude < 0) return undefined;
      const out = [];
      for (let i = 0; i < ps.hand.length; i++) if (i !== exclude) out.push(i);
      return out.length > 0 ? out : undefined;
    };

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
        eligibleIndices: buildEligibleIndices(),
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
          eligibleIndices: buildEligibleIndices(),
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
