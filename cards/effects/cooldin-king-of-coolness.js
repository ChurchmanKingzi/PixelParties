// ═══════════════════════════════════════════
//  CARD EFFECT: "Cooldin, King of Coolness"
//  Hero — Activated effect, once per turn.
//
//  Choose a level 3 or lower Area from your HAND or
//  DECK and play it as an additional Action, regardless
//  of its level. Immediately end your turn afterwards.
//
//  Flow:
//    1. Build the eligible pool — all Area subtype
//       Spells with level ≤ 3 in hand and deck.
//    2. Gallery prompt: player picks one (with source
//       badge so "from deck" is clear).
//    3. If the pick came from the deck, splice it out
//       and shuffle the deck (search-from-deck ritual).
//    4. Drive the Area play directly: reaction chain
//       window → onPlay → placeArea. The level gate is
//       bypassed because we call executeCardWithChain /
//       runHooks directly rather than going through
//       validateActionPlay, which is where the school
//       / level check lives.
//    5. On successful play (or negation — the hero
//       effect was "used"), immediately end the turn
//       via advanceToPhase(..., END).
//    6. Cancelled before step 3 → return false so the
//       hero-effect HOPT is NOT consumed (Cooldin can
//       try again later if they wanted to back out).
//
//  Animation: `cooldin_terraform` — a reality-warping
//  terraforming wave sweeps the entire battlefield as
//  Cooldin reshapes the world. Fires once before the
//  Area descends. The standard `area_descend` animation
//  still plays on top.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cooldin, King of Coolness';

/** Collect eligible Areas (lv ≤ 3) from a source array. Preserves duplicates. */
function collectAreasFromSource(names, cardDB, source) {
  const out = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    if ((cd.subtype || '').toLowerCase() !== 'area') continue;
    if ((cd.level || 0) > 3) continue;
    out.push({ name, source, sourceIdx: i });
  }
  return out;
}

/**
 * Drive the Area play pipeline for a pre-chosen card. Replicates the
 * essential parts of the server's play_spell handler — reaction chain
 * window + onPlay + placement cleanup — without the level/school gate
 * (which is the whole point of this effect).
 */
async function playCooldinArea(engine, pi, heroIdx, cardName, fromDeck) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  // Step A: Source handling. If the Area was picked from the deck, pull
  // it out and drop it onto the end of the hand, then shuffle the deck
  // (search-from-deck convention). Pull AFTER we've committed, so a
  // cancelled prompt earlier doesn't leak.
  if (fromDeck) {
    const deckIdx = ps.mainDeck.indexOf(cardName);
    if (deckIdx < 0) return false;
    ps.mainDeck.splice(deckIdx, 1);
    // Shuffle the deck — standard Fisher-Yates.
    for (let i = ps.mainDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ps.mainDeck[i], ps.mainDeck[j]] = [ps.mainDeck[j], ps.mainDeck[i]];
    }
    ps.hand.push(cardName);
  }

  const handIndex = ps.hand.lastIndexOf(cardName);
  if (handIndex < 0) return false;

  // Step B: Reaction chain. Gives the opponent a window to negate (The
  // Master's Plan, Anti Magic Shield, etc.). If negated, the Area is
  // discarded — Cooldin's hero effect still counts as "used".
  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, heroIdx, cardType: 'Spell', goldCost: 0,
  });
  if (chainResult.negated) {
    ps.hand.splice(handIndex, 1);
    ps.discardPile.push(cardName);
    engine.log('cooldin_area_negated', { player: ps.username, card: cardName });
    return true;
  }

  // Step C: Splice from hand + track a fresh in-hand instance so onPlay
  // sees it exactly the way the normal spell-play handler would.
  ps.hand.splice(handIndex, 1);
  const inst = engine._trackCard(cardName, pi, 'hand', heroIdx, -1);

  // _immediateActionContext lets downstream hooks know this was driven
  // by a hero effect rather than a normal action, mirroring what
  // performImmediateAction does. Some cards (e.g. Bartas second-cast
  // tracking) look at this flag.
  gs._immediateActionContext = true;

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName, zone: 'hand', heroIdx,
      _skipReactionCheck: true,
    });
  } finally {
    delete gs._immediateActionContext;
  }

  // Step D: If the Area didn't place itself on the board (unexpected —
  // every Area's onPlay routes through placeArea which sets this flag),
  // fall back to discarding. If it did place itself, _spellPlacedOnBoard
  // is set; clear it so future plays aren't affected.
  if (!gs._spellPlacedOnBoard) {
    ps.discardPile.push(cardName);
    engine._untrackCard(inst.id);
    engine.log('cooldin_area_fizzle', { player: ps.username, card: cardName });
  }
  delete gs._spellPlacedOnBoard;
  delete gs._spellCancelled;

  return true;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    // Can only cast an Area if the caster's own Area zone is empty
    // (generic Area rule, enforced by validateActionPlay). We enforce it
    // here too so Cooldin's button grays out when the zone is occupied.
    if ((gs.areaZones?.[pi] || []).length > 0) return false;
    // Reality Crack's turn-long area lock also blocks Cooldin.
    if (ps._cantPlayAreaThisTurn === gs.turn) return false;

    const cardDB = engine._getCardDB();
    const fromHand = collectAreasFromSource(ps.hand || [], cardDB, 'hand');
    if (fromHand.length > 0) return true;
    const fromDeck = collectAreasFromSource(ps.mainDeck || [], cardDB, 'deck');
    return fromDeck.length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();
    const fromHand = collectAreasFromSource(ps.hand || [], cardDB, 'hand');
    const fromDeck = collectAreasFromSource(ps.mainDeck || [], cardDB, 'deck');
    const all = [...fromHand, ...fromDeck];
    if (all.length === 0) return false;

    // Build the gallery. Each row distinguishes source so the player
    // sees which Areas are public (hand) vs. searched (deck). We don't
    // dedupe by name — multiple copies in the deck are legitimately
    // different draws once chosen.
    const galleryCards = all.map(entry => ({
      name: entry.name,
      source: entry.source, // 'hand' or 'deck'
    }));

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: 'Choose a level 3 or lower Area from your hand or deck to reshape the world. Your turn ends afterwards.',
      confirmLabel: '🌍 Terraform!',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) {
      // Cancelled before commitment — don't consume HOPT.
      return false;
    }

    const picked = all.find(a => a.name === result.cardName && a.source === result.source)
      || all.find(a => a.name === result.cardName);
    if (!picked) return false;

    // ── Battlefield-wide terraforming wave — Cooldin reshapes reality ──
    engine._broadcastEvent('cooldin_terraform', {
      owner: pi, heroIdx, cardName: picked.name,
    });
    await engine._delay(1200);

    // ── Play the Area ──
    const played = await playCooldinArea(engine, pi, heroIdx, picked.name, picked.source === 'deck');

    // ── End the turn, win or lose the reaction chain ──
    // advanceToPhase validates that MAIN1/ACTION/MAIN2 → END is a legal
    // transition and runs the END phase (status expiry, switchTurn, etc.).
    // If the game has already ended (e.g. negated effect killed a hero),
    // gs.result is set and advance is a no-op.
    if (!gs.result) {
      const currentPhase = gs.currentPhase;
      if (currentPhase === 2 || currentPhase === 3 || currentPhase === 4) {
        await engine.advanceToPhase(pi, 5);
      }
    }

    engine.log('cooldin_terraform', {
      player: ps.username, card: picked.name, source: picked.source,
    });

    // Return true to consume HOPT regardless of play outcome — Cooldin's
    // effect "fired" the moment the player confirmed the pick.
    return played !== false;
  },
};
