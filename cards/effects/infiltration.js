// ═══════════════════════════════════════════
//  CARD EFFECT: "Infiltration"
//  Ability — Free activation (Main Phase)
//
//  Lv1: Add the top card of opponent's deck to
//       your hand. Opponent draws 1 card.
//  Lv2: Look at top 3 of opponent's deck, choose
//       1 to add to your hand. Place the other 2
//       at the bottom of their deck in any order.
//       Opponent draws 1 card.
//  Lv3: Same as Lv2, but opponent does NOT draw.
//
//  Standard free-ability HOPT covers shared lock
//  (all Infiltration copies share one name).
// ═══════════════════════════════════════════

const CARD_NAME = 'Infiltration';

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  /**
   * Gate: opp must have at least 1 card in their deck and our hand
   * must not be locked. Lv2/3 prefer ≥3 in opp's deck but degrade
   * gracefully to whatever they have.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    const ps = gs.players[pi];
    if (!ps || ps.handLocked) return false;
    const oi = pi === 0 ? 1 : 0;
    // Turn-1 protection: peeking / taking from a shielded opp's deck
    // is blocked. Same rule applies in onFreeActivate as a defensive
    // re-check in case the activation reached the engine despite the
    // greyed-out UI.
    if (gs.firstTurnProtectedPlayer === oi) return false;
    const ops = gs.players[oi];
    if (!ops || (ops.mainDeck || []).length === 0) return false;
    return true;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name) return false;
    const oi = pi === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    const ops = gs.players[oi];
    if (!ops || (ops.mainDeck || []).length === 0) return false;

    if (level >= 2) return _activateLv2or3(engine, gs, pi, oi, ps, ops, level);
    return _activateLv1(engine, gs, pi, oi, ps, ops);
  },
};

// ═══════════════════════════════════════════
//  LEVEL 1: take top card of opp's deck
// ═══════════════════════════════════════════

async function _activateLv1(engine, gs, pi, oi, ps, ops) {
  if (ops.mainDeck.length === 0) return false;
  const cardName = ops.mainDeck[0];

  // Broadcast the deck→hand flight FIRST so the card visibly comes
  // from OPP's deck pile. `play_pile_transfer` pre-registers
  // `pileTransferToHandPendingMeRef` on the client, which masks
  // exactly one slot of the upcoming hand-grew diff so the auto
  // draw-anim skips this stolen card. Any chained Lilly-draw still
  // gets its deck-flight animation from OUR deck. Without this
  // pre-broadcast both cards would appear to come from the
  // controller's deck pile.
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: oi, toOwner: pi, cardName, from: 'deck', to: 'hand',
    // Target slot the card will land in. Broadcast fires BEFORE the
    // state mutation, so the slot doesn't exist yet on the client —
    // the resolver falls back to a synthetic "right of last slot"
    // rect so the flight aims at where the new card actually appears.
    toHandIdx: ps.hand.length,
  });
  await engine._delay(700);

  // Now apply the state mutation.
  ops.mainDeck.shift();
  ps.hand.push(cardName);
  engine.log('infiltration_take', { player: ps.username, card: cardName, level: 1 });

  // Reveal the taken card to OUR side only — the opp didn't see
  // their own deck top, so neither side has prior knowledge; they
  // just see a card leave their deck.
  const mySid = ps.socketId;
  if (mySid && engine.io) engine.io.to(mySid).emit('card_reveal', { cardName });

  // Fire the steal hook so Lilly et al. can react.
  await engine.runHooks('onCardTakenFromOpponent', {
    takerPi: pi, fromZone: 'deck', cardName,
  });

  // Lv1 cost: opp draws 1.
  await engine.actionDrawCards(oi, 1);

  engine.sync();
  return true;
}

// ═══════════════════════════════════════════
//  LEVEL 2 / 3: peek top 3, pick 1, bottom the others
// ═══════════════════════════════════════════

async function _activateLv2or3(engine, gs, pi, oi, ps, ops, level) {
  const peekCount = Math.min(3, ops.mainDeck.length);
  if (peekCount === 0) return false;
  // Top of deck is `mainDeck[0]` (shift() pulls the top), so the
  // peeked slice is in top-first order.
  const peeked = ops.mainDeck.slice(0, peekCount);

  // Gallery picker. Cancellable: false — by activating Infiltration
  // the player has already committed to taking one of the peeked
  // cards. The free-ability HOPT only stamps if we return truthy,
  // so a stuck prompt would still refund — but conceptually no
  // backout once you've seen the cards.
  const choice = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: peeked.map(name => ({ name, source: 'deck' })),
    title: CARD_NAME,
    description: `Choose 1 card from the top ${peekCount} of ${ops.username}'s deck. The rest go to the bottom of their deck.`,
    confirmLabel: '🎯 Take',
    confirmClass: 'btn-info',
    cancellable: false,
  });
  if (!choice?.cardName) return false;
  const pickedName = choice.cardName;
  const pickedIdx = peeked.indexOf(pickedName);
  if (pickedIdx < 0) return false;

  // Broadcast the picked card's flight from opp's deck → our hand
  // FIRST — same rationale as Lv1. Without it, any chained Lilly
  // draw lumps with the steal under the diff-detector and both
  // cards animate from our deck.
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: oi, toOwner: pi, cardName: pickedName, from: 'deck', to: 'hand',
    // Target slot the new card will land in — see Lv1 for the same
    // rationale (broadcast precedes the push, so the slot at this
    // index doesn't exist yet; the resolver projects "right of last
    // slot").
    toHandIdx: ps.hand.length,
  });
  await engine._delay(700);

  // Strip the peekCount cards off the top, then re-bottom the
  // un-picked ones in their original (top-first) order. The card
  // text says "any order" — preserving deck order is the natural
  // default; an explicit ordering prompt would be added if a
  // future card actually needs control here.
  ops.mainDeck.splice(0, peekCount);
  for (let i = 0; i < peeked.length; i++) {
    if (i === pickedIdx) continue;
    ops.mainDeck.push(peeked[i]);
  }

  // Add the picked card to our hand.
  ps.hand.push(pickedName);
  engine.log('infiltration_take', { player: ps.username, card: pickedName, level });

  // Reveal to OUR side only — same rationale as Lv1.
  const mySid = ps.socketId;
  if (mySid && engine.io) engine.io.to(mySid).emit('card_reveal', { cardName: pickedName });

  // Fire the steal hook so Lilly et al. can react.
  await engine.runHooks('onCardTakenFromOpponent', {
    takerPi: pi, fromZone: 'deck', cardName: pickedName,
  });

  // Lv2 cost: opp draws 1. Lv3: free.
  if (level === 2) {
    await engine.actionDrawCards(oi, 1);
  }

  engine.sync();
  return true;
}
