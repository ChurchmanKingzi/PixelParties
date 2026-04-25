// ═══════════════════════════════════════════
//  CARD EFFECT: "Idol of Crestina"
//  Artifact (Reaction, Cost 4)
//
//  Play this card immediately at the start of your
//  Resource Phase. Instead of drawing a card, search
//  your deck for any card, reveal it, and add it to
//  your hand. You can't play other cards or activate
//  effects during this Resource Phase.
//
//  Wiring: opts in via `isResourcePhaseReaction`,
//  picked up by `_checkResourcePhaseReactions` in the
//  engine (fires once at the very start of the
//  Resource Phase, before the standard draw).
//
//  The resolve sets `gs._skipResourceDraw = true` so
//  the Resource Phase code skips the auto-draw, and
//  the deck search is performed via the standard
//  cardGallery prompt. Card is sent to discard after
//  resolution by the reaction window itself (Idol is
//  a normal Reaction Artifact — not a potion, not
//  deleteOnUse).
// ═══════════════════════════════════════════

const CARD_NAME = 'Idol of Crestina';

module.exports = {
  isResourcePhaseReaction: true,

  // Strictly reactive: never directly playable, never a chain
  // candidate. Hand cards stay dimmed.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Optional gate before the prompt is shown. We require:
   *  - the player has at least one card in deck (otherwise the
   *    "search deck for any card" half is a no-op),
   *  - the player isn't hand-locked (search-into-hand needs to land),
   *  - no other Resource-Phase-reaction has already fired this phase.
   * The engine separately enforces gold cost and first-turn lockout.
   */
  resourcePhaseCondition(gs, pi /*, engine */) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;
    if ((ps.mainDeck || []).length === 0) return false;
    if (gs._resourcePhaseLocked) return false;
    return true;
  },

  /**
   * Resolution: skip the Resource Phase draw, search deck for any card,
   * reveal + add to hand, lock the rest of the Resource Phase.
   */
  async resourcePhaseResolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    // Replace the standard Resource-Phase draw with our search.
    gs._skipResourceDraw = true;
    // "You can't play other cards or activate effects during this
    // Resource Phase." — only really applicable to other Idol-style
    // reactions, since Resource Phase has no normal play window.
    gs._resourcePhaseLocked = true;

    if ((ps.mainDeck || []).length === 0) {
      engine.log('idol_of_crestina_empty_deck', { player: ps.username });
      engine.sync();
      return;
    }

    // Build a deduplicated gallery from deck (same shape Navigation /
    // Treasure Hunter's Backpack use).
    const deckCounts = {};
    for (const cn of ps.mainDeck) {
      deckCounts[cn] = (deckCounts[cn] || 0) + 1;
    }
    const galleryCards = Object.entries(deckCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) {
      engine.sync();
      return;
    }

    const searchResult = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: 'Choose a card from your deck to add to your hand.',
      cancellable: false,
    });

    const pickedName = searchResult?.cardName;
    if (!pickedName) {
      engine.sync();
      return;
    }

    const deckIdx = ps.mainDeck.indexOf(pickedName);
    if (deckIdx < 0) {
      engine.sync();
      return;
    }

    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(pickedName);

    engine._broadcastEvent('deck_search_add', { cardName: pickedName, playerIdx: pi });
    engine.log('idol_of_crestina_search', { player: ps.username, card: pickedName });
    engine.sync();

    // Standard tutor etiquette: shuffle + reveal to opponent.
    engine.shuffleDeck(pi, 'main');
    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: pickedName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });
  },
};
