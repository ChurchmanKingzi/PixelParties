// ═══════════════════════════════════════════
//  CARD EFFECT: "Inventing"
//  Ability — Free activation once per turn.
//
//  Lv1: Discard 1 card → draw 1 card.
//  Lv2: Discard up to 2 cards → draw that many.
//  Lv3: Discard 1 card → search deck for a card
//       with a DIFFERENT name, reveal it and add
//       it to hand. You cannot play cards with
//       that name for the rest of the turn.
//       Reuses _creationLockedNames (same rule
//       as Alchemic Journal / Divine Gift).
// ═══════════════════════════════════════════

const CARD_NAME = 'Inventing';

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  canFreeActivate(ctx, level) {
    const ps = ctx.players[ctx.cardOwner];
    if ((ps?.hand || []).length === 0) return false;
    // Lv3 also needs at least 1 eligible card in deck
    if (level >= 3) {
      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const handNames = new Set(ps.hand);
      return (ps.mainDeck || []).some(cn => !handNames.has(cn) || cn !== cn); // any different-named card
    }
    return true;
  },

  async onFreeActivate(ctx, level) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    if (!ps || (ps.hand || []).length === 0) return false;

    // ── Lv1 / Lv2: discard N → draw N ───────────────────────────────────

    if (level <= 2) {
      const maxDiscard = level >= 2 ? 2 : 1;
      let count = 0;

      for (let i = 0; i < maxDiscard; i++) {
        if ((ps.hand || []).length === 0) break;

        const result = await engine.promptGeneric(pi, {
          type:        'forceDiscardCancellable',
          title:       `${CARD_NAME} Lv${level}`,
          description: i === 0
            ? `Click a card to discard it and draw 1 card.${maxDiscard > 1 ? ' You may discard a second card.' : ''}`
            : 'Click a second card to discard it and draw 1 more, or cancel.',
          cancellable: true,
        });

        if (!result || result.cancelled) break;
        const { cardName, handIndex } = result;
        if (cardName === undefined || handIndex === undefined) break;

        if (ps.hand[handIndex] === cardName) ps.hand.splice(handIndex, 1);
        else { const fi = ps.hand.indexOf(cardName); if (fi >= 0) ps.hand.splice(fi, 1); }
        ps.discardPile.push(cardName);
        await engine.runHooks('onDiscard', {
          playerIdx: pi, cardName, discardedCardName: cardName,
          _fromHand: true, _skipReactionCheck: true,
        });
        count++;
      }

      if (count === 0) return false;

      engine.log('inventing_discard_draw', { player: ps.username, level, count });
      engine.sync();
      await engine._delay(350); // Let discard state settle before draws start
      await engine.actionDrawCards(pi, count);
      engine.sync();
      return true;
    }

    // ── Lv3: discard 1 → search for a different-named card ──────────────

    // Pick 1 card to discard (cancellable)
    const discardResult = await engine.promptGeneric(pi, {
      type:        'forceDiscardCancellable',
      title:       `${CARD_NAME} Lv3`,
      description: 'Discard 1 card to search your deck for a card with a different name.',
      cancellable: true,
    });

    if (!discardResult || discardResult.cancelled) return false;

    const { cardName: discardName, handIndex } = discardResult;
    if (discardName === undefined || handIndex === undefined) return false;
    if (ps.hand[handIndex] !== discardName) {
      const fi = ps.hand.indexOf(discardName);
      if (fi < 0) return false;
      ps.hand.splice(fi, 1);
    } else {
      ps.hand.splice(handIndex, 1);
    }
    ps.discardPile.push(discardName);
    await engine.runHooks('onDiscard', {
      playerIdx: pi, cardName: discardName, _skipReactionCheck: true,
    });
    engine.sync();

    // Build gallery: deck cards whose name differs from the discarded card
    const cardDB = engine._getCardDB();
    const seen   = new Set();
    const gallery = [];
    for (const cn of (ps.mainDeck || [])) {
      if (seen.has(cn) || cn === discardName) continue;
      seen.add(cn);
      const cd = cardDB[cn];
      if (!cd) continue;
      gallery.push({ name: cn, source: 'deck' });
    }
    gallery.sort((a, b) => a.name.localeCompare(b.name));

    if (gallery.length === 0) {
      // Nothing eligible — discard already happened, effect fizzles
      engine.log('inventing_lv3_fizzle', { player: ps.username, discarded: discardName });
      return true;
    }

    const picked = await engine.promptGeneric(pi, {
      type:          'cardGallery',
      cards:         gallery,
      title:         `${CARD_NAME} Lv3`,
      description:   `Choose a card with a different name than "${discardName}" to add to your hand.`,
      confirmLabel:  '⚙️ Take it!',
      confirmClass:  'btn-success',
      cancellable:   false, // Discard already paid
    });

    if (!picked || !picked.cardName) return true;

    const foundName = picked.cardName;

    // Move from deck to hand + reveal
    await engine.searchDeckForNamedCard(pi, foundName, CARD_NAME);

    // Lock that card name for the rest of the turn (reuses creation lock system)
    if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
    ps._creationLockedNames.add(foundName);

    engine.log('inventing_lv3', {
      player: ps.username, discarded: discardName, found: foundName,
    });
    engine.sync();
    return true;
  },
};
