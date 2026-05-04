// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Edge"
//  Spell (Magic Arts Lv1, Reaction)
//
//  Once per game (shared "Divine Gift" key).
//
//  Two play paths (mirrors Juice / Cure pattern):
//    • Proactive: cast from hand on the player's
//      own turn as an inherent additional Action.
//    • Reactive: chained onto a card on the
//      opponent's turn through the standard
//      reaction window.
//
//  Choose any card from your Side Deck, reveal it,
//  and add it to your hand.
//
//  Side-Deck plumbing: each player's side deck is
//  exposed on player state at game start (see
//  server.js where playerStates are pushed).
//  This card consumes names from `ps.sideDeck`
//  directly — no engine helper required.
//
//  "Reveal" goes through the standard
//  `card_reveal` broadcast.
// ═══════════════════════════════════════════

const CARD_NAME = 'Divine Gift of Edge';

/**
 * Pull a card from the player's Side Deck into their hand.
 * `cancellable` controls whether the picker offers a cancel button —
 * true for proactive plays (player can back out before committing),
 * false for the reaction-resolve path (the chain has committed by
 * the time we get here).
 */
async function doSideDeckPick(engine, pi, { cancellable }) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return false;
  const sideDeck = ps.sideDeck || [];
  if (sideDeck.length === 0) {
    engine.log('edge_fizzle', { player: ps.username, reason: 'empty side deck' });
    return false;
  }

  const cardDB = engine._getCardDB();
  const seen = new Set();
  const gallery = [];
  for (const cn of sideDeck) {
    if (seen.has(cn)) continue;
    if (!cardDB[cn]) continue;
    seen.add(cn);
    gallery.push({ name: cn, source: 'side' });
  }
  gallery.sort((a, b) => a.name.localeCompare(b.name));

  if (gallery.length === 0) return false;

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: 'Choose a card from your Side Deck to reveal and add to your hand.',
    confirmLabel: '⚔️ Take!',
    confirmClass: 'btn-info',
    cancellable,
  });
  if (!picked || picked.cancelled || !picked.cardName) return false;
  const chosen = picked.cardName;

  // Pop the chosen name from the side deck (one copy).
  const idx = sideDeck.indexOf(chosen);
  if (idx < 0) return false;
  sideDeck.splice(idx, 1);

  // Broadcast BEFORE the sync so both clients pre-suppress their
  // hand-grew auto-flight watchers. The handler also queues the
  // shine + sparkle overlay on the new hand card after React commits.
  engine._broadcastEvent('side_deck_appear', { cardName: chosen, playerIdx: pi });

  // Add to hand and track.
  ps.hand.push(chosen);
  engine._trackCard(chosen, pi, 'hand');

  // Mark Divine Gift as used. Idempotent — the proactive play path's
  // engine-side `oncePerGame` consumption may also fire, but we set
  // here so the reaction path is covered too.
  if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
  ps._oncePerGameUsed.add('divineGift');

  engine.log('divine_gift_edge', {
    player: ps.username, card: chosen,
  });
  engine.sync();
  // Hold for the shine/sparkle to play out before opening the
  // opponent's reveal modal — avoids stacking the modal on top of
  // the visual.
  await engine._delay(900);

  // Open the opponent's dismissable face-up reveal — same modal type
  // every search effect uses. The reveal is one-time: dismissing it
  // closes the modal and the card is no longer face-up to the
  // opponent (no permanent reveal flag is set).
  const oi = pi === 0 ? 1 : 0;
  await engine.promptGeneric(oi, {
    type: 'deckSearchReveal',
    cardName: chosen,
    searcherName: ps?.username || 'Opponent',
    title: CARD_NAME,
    cancellable: false,
  });

  return true;
}

module.exports = {
  isReaction: true,
  proactivePlay: true,
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  /**
   * Proactive play gate — the card greys out in hand when the side
   * deck is empty (no valid pick anyway).
   */
  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    return (ps.sideDeck || []).length > 0;
  },

  /**
   * Reaction eligibility — only fires from the chain window during the
   * opponent's turn. Card text: "You may play this card between phases
   * on your opponent's turn." The reaction chain is the engine's
   * quick-speed channel; gating on `gs.activePlayer !== pi` restricts
   * the reactive path to opponent's turn while the proactive `onPlay`
   * covers the player's own turn.
   */
  reactionCondition: (gs, pi) => {
    if (gs.activePlayer === pi) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.sideDeck || []).length === 0) return false;
    if (ps._oncePerGameUsed?.has('divineGift')) return false;
    return true;
  },

  hooks: {
    /**
     * Proactive play path (cast from hand on own turn). Cancelling the
     * picker refunds the spell — the player hasn't committed yet.
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ok = await doSideDeckPick(engine, pi, { cancellable: true });
      if (!ok) gs._spellCancelled = true;
    },
  },

  /**
   * Reaction resolve — fires when Edge is added to the chain. The chain
   * has committed by this point, so the picker is non-cancellable.
   */
  async resolve(engine, pi) {
    return await doSideDeckPick(engine, pi, { cancellable: false });
  },
};
