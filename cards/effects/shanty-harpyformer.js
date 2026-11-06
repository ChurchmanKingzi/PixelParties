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

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

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
      if (!hasCopy) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4 (Al)

      // Ask if the player wants to search
      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return ctx._engine.summonEffektFizzelt(ctx.card, ctx.cardName, { stumm: true });   // W11/R4 (Al): abgelehntes „you may" → Blob stumm

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── ③ Once-per-turn creature effect ───────────────────────────────────────
  creatureEffect: true,

  /** Gray out the button while no Navigation Ability is in hand. */
  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    // Z6 (A07-23): die Kopie kommt aus dem DECK auf die Hand - unter Hand-/Such-Sperre bliebe nur der Abwurf.
    if (ctx._engine._isSearchBlocked(ctx.cardOwner, {}, 'deck')) return false;
    // W5b-Z6 (Al, Welle 5: "Shanty braucht die zweite Karte unbedingt"): nach dem Abwurf der Navigation muss noch mindestens
    // eine Handkarte zum Aufdecken da sein - sonst nicht aktivierbar, nichts verbraucht.
    return (ps?.hand || []).includes(ABILITY_NAME) && (ps.hand || []).length >= 2;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ── Step 1: discard a Navigation Ability from hand (in-hand click)
    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      costKind: 'tutor',        // ★ v1038: Lernkanal-Lage passend zur Gegenleistung
      title: CARD_NAME,
      description: `Discard a "${ABILITY_NAME}" Ability from your hand, then reveal a card to search for a copy.`,
      source: CARD_NAME,
      logType: 'shanty_discard',
    });
    if (!ok) return false;
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
        searchToHand: true,   // v1119: Suche AUF DIE HAND
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
    // W85c (Atta, Al 29.10.): ZWEI getrennte Aufdeck-Ereignisse in Textreihenfolge: (1) die aufgedeckte Handkarte, (2) die gesuchte Kopie (`searchDeckForNamedCard`, VOR dem Verschieben).
    await engine.aufdeckEreignis(pi, [revealedName], { zone: 'hand', source: CARD_NAME });
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
