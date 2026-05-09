// ═══════════════════════════════════════════
//  SPELL: "Bifab, Bridge of Coolness"
//  Has no effect from your hand.
//
//  When it is the top of your Coolness Stack, you
//  may delete it from there to search your deck
//  for any card and add it to your hand. This
//  counts as an additional Action. 1/turn.
//
//  The 'noDefaultPlay' flag below makes the card
//  fizzle if cast normally from hand — only the
//  Stack-play path resolves the effect.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bifab, Bridge of Coolness';
const HOPT_KEY  = 'bifabUsedThisTurn';

module.exports = {
  playableFromCoolnessStack: true,
  // Greys out the card in hand — it has no effect when played from
  // there. Stack-top play remains available via the dedicated
  // `play_from_coolness_stack` socket flow, which doesn't consult
  // this flag.
  neverPlayable: true,

  // Hand cast: no-op (the card text says "no effect when you play it,
  // except from your Coolness Stack"). We let the spell resolve and
  // hit the discard pile via the standard funnel.
  hooks: {
    onPlay: async (ctx) => {
      // Cast from hand → effect fizzles on purpose. No state change.
      if (ctx.cardZone === 'hand') {
        ctx._engine.log('bifab_no_effect_from_hand', { player: ctx._engine.gs.players[ctx.cardOwner]?.username });
        return;
      }
    },
  },

  /**
   * Stack-top resolve. Engine calls this when the player triggers the
   * "play from Stack" UI hook. The card pops itself off (delete) and
   * grants the deck-search.
   */
  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Pre-check the HOPT WITHOUT claiming — the engine stores HOPT
    // state at `gs.hoptUsed[key:pi]`. If we claimed up-front and the
    // player cancelled the deck-search, the slot would be wasted.
    if (engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn) {
      return { aborted: true, reason: 'hopt' };
    }
    if (!engine.hasCoolnessStack(pi)) return { aborted: true, reason: 'no_stack' };
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };
    const ps = engine.gs.players[pi];
    if (!ps?.mainDeck?.length) return { aborted: true, reason: 'empty_deck' };

    // Search the deck (any card).
    const cards = [...new Set(ps.mainDeck)].map(name => ({ name, source: 'deck' }));
    const choice = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards,
      title: CARD_NAME,
      description: 'Choose any card from your deck to reveal and add to your hand.',
      confirmLabel: '🌉 Bridge!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!choice?.cardName) return { aborted: true, reason: 'cancelled' };

    // Commit: claim the HOPT now, pay the cost, resolve the effect.
    ctx.hardOncePerTurn(HOPT_KEY);

    // Pay the cost: delete the top-of-Stack copy of Bifab.
    await ctx.popCoolnessStackTo(pi, 'delete', { source: CARD_NAME });

    // Move chosen card from deck to hand.
    const deckIdx = ps.mainDeck.indexOf(choice.cardName);
    if (deckIdx >= 0) {
      ps.mainDeck.splice(deckIdx, 1);
      ps.hand.push(choice.cardName);
      engine._trackCard(choice.cardName, pi, 'hand');
      // Shuffle the remaining deck.
      for (let i = ps.mainDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps.mainDeck[i], ps.mainDeck[j]] = [ps.mainDeck[j], ps.mainDeck[i]];
      }
      engine.log('bifab_search', { player: ps.username, card: choice.cardName });
    }

    // Grant additional Action.
    engine.gs._spellFreeAction = true;
    engine.sync();
    return { played: true, additionalAction: true };
  },
};
