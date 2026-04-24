// ═══════════════════════════════════════════
//  CARD EFFECT: "Planet in a Bottle"
//  Potion (Normal) — No cost, no school, no level.
//
//  Choose a level 3 or lower Area from your deck,
//  hand or discard pile and bring it directly
//  into play.
//
//  Gated by the "one Area per player" rule —
//  cannot be activated while the player already
//  controls an Area. There is no replace option:
//  the existing Area is NOT sent to the discard.
//
//  Flow (mirrors monster-in-a-bottle.js for the
//  bottle frame + reality-crack.js for the Area
//  fetch-and-place):
//    1. Build gallery of eligible Areas across
//       hand / deck / discard.
//    2. Player picks one.
//    3. Remove from source (shuffle if deck).
//    4. Track as a fresh CardInstance in 'hand'
//       zone so the Area's own onPlay self-
//       placement hook runs normally.
//    5. Fall back to engine.placeArea if the
//       Area script has no self-placement hook.
//    6. If sourced from deck, reveal to opponent
//       via the standard deckSearchReveal flow.
// ═══════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────
//  HELPERS — card-local, intentionally NOT in a shared module.
//  The "fetch an Area from any pile and place it" logic is specific
//  enough to this card (and the superficially-similar Reality Crack
//  already rolls its own) that extracting a shared helper now would
//  be premature. If a second "bring an Area into play" card arrives,
//  consider promoting `buildAreaGallery` + `bringAreaIntoPlay` into
//  a new `_area-fetch-shared.js`.
// ───────────────────────────────────────────────────────────────────

/** Lv3-or-lower Area (Spells or Attacks with subtype 'Area'). */
function isEligibleArea(cd) {
  if (!cd) return false;
  if ((cd.subtype || '').toLowerCase() !== 'area') return false;
  if ((cd.level || 0) > 3) return false;
  return true;
}

/** Player already controls an Area → Planet in a Bottle is locked out. */
function playerControlsArea(gs, pi) {
  return (gs.areaZones?.[pi] || []).length > 0;
}

/**
 * Build the eligible-Area gallery from hand + deck + discard, deduplicated
 * by (name, source) so the same name from multiple piles gets one entry
 * per pile. Ordered by level then name, matching Reality Crack's sort.
 */
function buildAreaGallery(ps, cardDB) {
  const gallery = [];
  const seen = new Set();

  const checkSrc = (list, source) => {
    for (const name of (list || [])) {
      const key = name + ':' + source;
      if (seen.has(key)) continue;
      const cd = cardDB[name];
      if (!isEligibleArea(cd)) continue;
      seen.add(key);
      gallery.push({ name, source, level: cd.level || 0 });
    }
  };

  checkSrc(ps.hand,        'hand');
  checkSrc(ps.mainDeck,    'deck');
  checkSrc(ps.discardPile, 'discard');

  gallery.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return gallery;
}

module.exports = {
  isPotion: true,

  // Defer the card reveal until AFTER the player has picked an Area,
  // matching Monster in a Bottle. The opponent sees "Planet in a Bottle"
  // and the chosen Area in the same beat.
  deferBroadcast: true,

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;

    // Hard gate: one Area per player. No replace option — if the player
    // already controls an Area, Planet in a Bottle is grayed out.
    if (playerControlsArea(gs, pi)) return false;

    const cardDB = engine ? engine._getCardDB() : null;
    if (!cardDB) return true; // Fallback: let resolve() re-check.

    return buildAreaGallery(ps, cardDB).length > 0;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Re-check the one-Area gate: game state can change between canActivate
    // and resolve (reaction chains, etc.).
    if (playerControlsArea(gs, pi)) return { cancelled: true };

    const cardDB = engine._getCardDB();
    const gallery = buildAreaGallery(ps, cardDB);
    if (gallery.length === 0) return { cancelled: true };

    // ── Step 1: Player picks an Area ──
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: 'Planet in a Bottle',
      description: 'Choose a level 3 or lower Area from your deck, hand or discard pile.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) {
      return { cancelled: true };
    }

    const chosenName   = picked.cardName;
    const chosenEntry  = gallery.find(g => g.name === chosenName && g.source === picked.source)
                     ?? gallery.find(g => g.name === chosenName);
    if (!chosenEntry) return { cancelled: true };
    const chosenSource = chosenEntry.source;

    // ── Step 2: All decisions made — reveal the potion card to opponent NOW ──
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;
    if (oppSid && engine.io) {
      engine.io.to(oppSid).emit('card_reveal', { cardName: 'Planet in a Bottle' });
    }
    await engine._delay(100);

    // ── Step 3: Remove the chosen Area from its source pile ──
    let found = false;
    if (chosenSource === 'hand') {
      const idx = (ps.hand || []).indexOf(chosenName);
      if (idx >= 0) { ps.hand.splice(idx, 1); found = true; }
    } else if (chosenSource === 'deck') {
      const idx = (ps.mainDeck || []).indexOf(chosenName);
      if (idx >= 0) {
        ps.mainDeck.splice(idx, 1);
        found = true;
        engine.shuffleDeck(pi, 'main');
      }
    } else if (chosenSource === 'discard') {
      const idx = (ps.discardPile || []).indexOf(chosenName);
      if (idx >= 0) { ps.discardPile.splice(idx, 1); found = true; }
    }
    if (!found) {
      // Extremely edge-case — card disappeared between gallery build and
      // selection. Fizzle gracefully like Reality Crack does.
      return { cancelled: true };
    }

    // ── Step 4: Deck-search reveal (broadcast only) — if from deck ──
    if (chosenSource === 'deck') {
      engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
    }

    // ── Step 5: Create an instance and bring the Area into play ──
    //
    // Track the card in 'hand' zone first — the Area's own onPlay hook
    // (e.g. acid-rain.js) gates on cardZone === 'hand' and playedCard.id
    // matching ctx.card.id to self-place itself. This mirrors Reality
    // Crack's approach for max compatibility with every existing Area.
    const newInst = engine._trackCard(chosenName, pi, 'hand', -1, -1);

    await engine.runHooks('onPlay', {
      _onlyCard: newInst,
      playedCard: newInst,
      cardName: chosenName,
      zone: 'hand',
      heroIdx: -1,
      _skipReactionCheck: true,
    });

    // Safety fallback: if the Area has no self-placement onPlay hook,
    // place it directly. Well-written Areas handle this themselves.
    if (newInst.zone !== 'area') {
      await engine.placeArea(pi, newInst);
    }

    engine.log('planet_in_a_bottle', {
      player: ps.username,
      area: chosenName,
      source: chosenSource,
    });

    // ── Step 6: Opponent-side deck-search reveal modal — if from deck ──
    if (chosenSource === 'deck') {
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: chosenName,
        searcherName: ps.username,
        title: 'Planet in a Bottle',
        cancellable: false,
      });
    }

    engine.sync();
    return true;
  },
};
