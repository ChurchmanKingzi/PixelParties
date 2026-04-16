// ═══════════════════════════════════════════
//  CARD EFFECT: "Shanty Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① If this is the first Creature summoned
//    this turn, it counts as an additional
//    Action (inherentAction).
//
//  ② On summon: may search deck for a
//    "Navigation" Ability, reveal it, add
//    it to hand.
//
//  ③ Once per turn (creature effect):
//    Discard a "Navigation" Ability from hand,
//    then reveal 1 card from hand to search
//    the deck for a copy of it, reveal it,
//    and add it to hand.
//    Grayed out while no Navigation Ability
//    is in hand.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');

const CARD_NAME = 'Shanty Harpyformer';
const ABILITY_NAME = 'Navigation';

/** Returns Navigation Ability cards currently in the player's hand. */
function navigationInHand(ps) {
  const cardDB = ps._cardDB; // not available this way — use engine instead
  return (ps.hand || []).filter(cn => cn === ABILITY_NAME);
}

module.exports = {
  // ── ① First-creature-of-turn = additional action ──────────────────────────
  inherentAction: harpyformerInherentAction,

  // ── ② On summon: search deck for Navigation Ability ───────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Check if any Navigation Ability exists in deck
      const hasCopy = (ps.mainDeck || []).includes(ABILITY_NAME);
      if (!hasCopy) return;

      // Ask if the player wants to search
      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── ③ Once-per-turn creature effect ───────────────────────────────────────
  creatureEffect: true,

  /** Gray out the button while no Navigation Ability is in hand. */
  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Step 1: prompt player to pick a Navigation Ability from hand to discard
    const navCardsInHand = (ps.hand || [])
      .map((cn, i) => ({ name: cn, handIndex: i }))
      .filter(c => c.name === ABILITY_NAME);

    // Build gallery for the discard pick (deduplicated display, but we need index)
    const discardResult = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard a "${ABILITY_NAME}" Ability from your hand, then reveal a card to search for a copy.`,
      confirmLabel: '🗑️ Discard Navigation',
      confirmClass: 'btn-danger',
      cancellable: true,
    });

    if (!discardResult || discardResult.cancelled) return false;

    // Remove one copy of Navigation from hand
    const navIdx = ps.hand.indexOf(ABILITY_NAME);
    if (navIdx < 0) return false; // safety check
    ps.hand.splice(navIdx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('shanty_discard', { player: ps.username, card: ABILITY_NAME });
    engine.sync();

    // ── Step 2: prompt player to reveal a card from their (remaining) hand
    if ((ps.hand || []).length === 0) {
      // Nothing left to reveal — effect spent but fizzles here
      engine.log('shanty_no_hand', { player: ps.username });
      return true;
    }

    const cardDB = engine._getCardDB();
    const handGallery = [];
    const seenReveal = new Set();
    for (const cn of ps.hand) {
      if (seenReveal.has(cn)) continue;
      seenReveal.add(cn);
      const cd = cardDB[cn];
      if (!cd) continue;
      handGallery.push({ name: cn, source: 'hand' });
    }
    handGallery.sort((a, b) => a.name.localeCompare(b.name));

    const revealResult = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: handGallery,
      title: CARD_NAME,
      description: 'Reveal a card from your hand to search the deck for a copy of it.',
      confirmLabel: '🔍 Reveal & Search',
      confirmClass: 'btn-info',
      cancellable: false, // Navigation already discarded — must reveal
    });

    if (!revealResult || !revealResult.cardName) return true;

    const revealedName = revealResult.cardName;

    // Broadcast the reveal to the opponent
    engine._broadcastEvent('deck_search_add', { cardName: revealedName, playerIdx: pi });
    engine.sync();
    await engine._delay(400);

    // ── Step 3: search deck for a copy and add to hand
    const found = await engine.searchDeckForNamedCard(pi, revealedName, CARD_NAME);

    if (!found) {
      engine.log('shanty_not_found', { player: ps.username, card: revealedName });
    }

    engine.sync();
    return true;
  },
};
