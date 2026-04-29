// ═══════════════════════════════════════════
//  CARD EFFECT: "Alchemic Journal"
//  Artifact (Normal, Cost 8) — Draw a Potion,
//  or pay 5 extra Gold to search Potion Deck
//  for a specific card (locked for the turn).
//  Hard once per turn.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,
  deferBroadcast: true,
  // Both modes (draw + search) move a Potion from deck to hand —
  // hand-locked controllers can't do either. Blocks the artifact
  // entirely while the lock is active.
  blockedByHandLock: true,

  // Gerrymander redirect — pick `draw` (random) instead of `choose`
  // (search, +5G), denying opp the targeted Potion they wanted.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'draw' };
  },

  canActivate(gs, pi) {
    if (gs.hoptUsed?.[`alchemic-journal:${pi}`] === gs.turn) return false;
    const ps = gs.players[pi];
    return (ps?.potionDeck || []).length > 0;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps || (ps.potionDeck || []).length === 0) return { cancelled: true };
    if (!engine.claimHOPT('alchemic-journal', pi)) return { cancelled: true };

    const baseCost = 8;
    const extraGold = (ps.gold || 0) - baseCost;

    // Check if "Choose" option is available: 5+ extra gold AND 2+ different potions in deck
    const uniquePotions = new Set(ps.potionDeck);
    const canChoose = extraGold >= 5 && uniquePotions.size >= 2;

    let mode = 'draw';
    if (canChoose) {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: 'Alchemic Journal',
        description: 'How would you like to get your Potion?',
        options: [
          { id: 'draw', label: '🎲 Draw 1 Potion', description: 'Draw the top card of your Potion Deck.', color: '#44bb44' },
          { id: 'choose', label: '🔍 Choose 1 Potion (+5G)', description: 'Search your Potion Deck for a specific card. It cannot be used this turn.', color: '#ddaa22' },
        ],
        cancellable: true,
        gerrymanderEligible: true, // Random draw vs targeted search are distinct effects.
      });
      if (!choice || choice.cancelled) return { cancelled: true };
      mode = choice.optionId || 'draw';
    }

    if (mode === 'choose') {
      // Deduct extra 5 gold
      ps.gold -= 5;

      // Build gallery of unique potions in deck
      const seen = new Set();
      const galleryCards = [];
      for (const cn of ps.potionDeck) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        galleryCards.push({ name: cn, source: 'potion_deck' });
      }
      galleryCards.sort((a, b) => a.name.localeCompare(b.name));

      const result = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: 'Alchemic Journal — Choose a Potion',
        description: 'Select a Potion to add to your hand. It will be locked for this turn.',
        cancellable: false,
      });

      if (!result || !result.cardName) return;
      const chosenName = result.cardName;

      // Remove from potion deck
      const idx = ps.potionDeck.indexOf(chosenName);
      if (idx < 0) return;
      ps.potionDeck.splice(idx, 1);
      ps.hand.push(chosenName);

      // Lock chosen potion name for the turn
      if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
      ps._creationLockedNames.add(chosenName);

      // Reveal to opponent (opponent confirms)
      await engine.revealSearchedCards(pi, [chosenName], 'Alchemic Journal');
      engine.log('alchemic_journal_choose', { player: ps.username, card: chosenName });
    } else {
      // Draw 1 potion from top of deck
      const drawn = await engine.actionDrawFromPotionDeck(pi, 1);
      if (drawn.length > 0) {
        engine.log('alchemic_journal_draw', { player: ps.username, card: drawn[0] });
      }
      // Sync to trigger draw animation, then delay to let it finish
      engine.sync();
      await engine._delay(700);
    }

    return true;
  },
};
