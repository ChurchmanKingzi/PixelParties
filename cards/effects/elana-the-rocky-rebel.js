// ═══════════════════════════════════════════
//  CARD EFFECT: "Elana, the Rocky Rebel"
//  Hero — Active effect (once per turn, Main Phase).
//  Shuffle your entire hand back into the deck,
//  then draw the same number of cards +1.
//  Requires at least 1 card in hand.
//  Animation: big burst of music notes over Elana.
// ═══════════════════════════════════════════

module.exports = {
  // CPU: confirm this Hero's activated-effect "you may" prompt — the default
  // brain declines cancellable confirms raised outside a card-cast (Hero
  // effect activations don't set _resolvingCard), which would otherwise make
  // the effect a no-op even after the CPU chose to activate it. (Title must
  // equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  activeIn: ['hero'],
  heroEffect: true,
  // Shuffles hand back into deck — flagged for "No Retreat!"
  // detection.
  shufflesFromHandOrDiscardIntoDeck: true,

  // CPU threat assessment: net +1 draw per activation (refills hand + 1).
  supportYield() {
    return { drawsPerTurn: 1 };
  },

  /**
   * Can activate if the player has at least 1 card in hand.
   */
  canActivateHeroEffect(ctx) {
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    return (ps.hand || []).length >= 1;
  },

  /**
   * Execute: confirm → play music note animation → return hand to deck
   * one by one → shuffle → draw (handSize + 1) one by one.
   * Returns true if resolved, false if cancelled.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];

    const handSize = (ps.hand || []).length;
    if (handSize < 1) return false;

    const drawCount = handSize + 1;

    // Confirm
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Elana, the Rocky Rebel',
      message: `Shuffle ${handSize} card${handSize !== 1 ? 's' : ''} back into your deck to draw ${drawCount}?`,
    });
    if (!confirmed) return false;

    // Play music notes animation on Elana
    engine._broadcastEvent('play_zone_animation', {
      type: 'music_notes', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Return all hand cards to deck
    // ── Zurueckmisch-Sperre (Hatusbal) ──
    // Elana mischt die GANZE Hand, hat also keine Auswahl-Abfrage zum
    // Vorfiltern. Sperrt Hatusbal, bleiben nur die GESTOHLENEN Karten
    // uebrig. Ihr Text sagt "draw the SAME NUMBER of cards +1" — die
    // Zahl haengt also an dem, was TATSAECHLICH zurueckging, nicht an
    // der urspruenglichen Handgroesse. `drawCount` wird deshalb unten
    // neu berechnet.
    const cardNamesToReturn = engine.shuffleBackEligibleHandCards(pi);
    const { ownDeckCount, potionCount, totalReturned } =
      await engine.actionMulliganCards(pi, cardNamesToReturn);

    // "the same number of cards +1" — gemessen an dem, was wirklich
    // zurueckging, ★ ueber BEIDE Decks (Als Regel 17.8.): eine
    // gestohlene Karte wandert ins Gegner-Deck und zaehlt trotzdem mit.
    // `ownDeckCount` ist bewusst NICHT die Zahl hier — die gehoert
    // Hatusbals Bonus-Schwelle.
    const tatsaechlichGezogen = totalReturned + 1;

    await engine._delay(400);

    engine.log('elana_shuffle', {
      player: ps.username, returned: totalReturned, ownDeck: ownDeckCount,
      drawing: tatsaechlichGezogen, fromPotionDeck: potionCount,
    });

    await engine._delay(300);

    // ★ AUFTEILUNG NACH DECK (Als Ruling 17.8., war ein Bug):
    // Karten, die ins POTION DECK zurueckgemischt wurden, muessen auch
    // VON DORT nachgezogen werden. Elana zog vorher alles aus dem
    // Hauptdeck — bei Potions in der Hand haetten sich die Deckgroessen
    // dauerhaft verschoben. Leadership, Horn in a Bottle, Crescent Moon
    // und Staff of the Teleporter machen es seit jeher so; Elana war die
    // einzige Ausnahme. Der +1-Bonus kommt wie dort aus dem Hauptdeck.
    const mainToDraw = tatsaechlichGezogen - potionCount;
    await engine.actionDrawCards(pi, mainToDraw);
    for (let i = 0; i < potionCount; i++) {
      if ((ps.potionDeck || []).length === 0) break;
      const potionCard = ps.potionDeck.shift();
      ps.hand.push(potionCard);
      engine.sync();
      await engine._delay(200);
    }

    engine.sync();
    return true;
  },
};
