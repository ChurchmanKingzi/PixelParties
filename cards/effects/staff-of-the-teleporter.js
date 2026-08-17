// ═══════════════════════════════════════════
//  CARD EFFECT: "Staff of the Teleporter"
//  Artifact (Normal, Cost 4)
//
//  Shuffle any number of cards from your hand
//  into your deck and draw the same number of
//  cards. If you shuffle your entire hand, draw
//  that number +1 instead. You cannot draw
//  cards or move any cards out of your discard
//  pile for the rest of the turn.
//
//  Picker: in-hand click-to-mark via the
//  `handPick` prompt — same UX Leadership uses.
//  `eligibleIndices` excludes the resolving
//  staff's own slot so the player can't include
//  it in the shuffle (the server's post-resolve
//  splice routes it to discard cleanly).
//
//  Sequencing:
//    1. handPick prompt with minSelect: 0
//       (true "any number"), max = number of
//       eligible hand cards, cancellable.
//       Cancellation refunds the gold cost via
//       the standard `{ cancelled: true }` path.
//    2. actionMulliganCards routes the picked
//       cards back to their original owners'
//       decks (potions → potionDeck, others →
//       mainDeck, stolen cards → opponent's
//       deck) and shuffles. Returns potionCount
//       so we can split the redraw between
//       pools the same way Leadership does.
//    3. Draw `count` (or `count + 1` if the
//       full non-staff hand was committed)
//       BEFORE setting `handLocked` — the
//       engine's actionDrawCards short-circuit
//       on `handLocked` would otherwise eat
//       this staff's own draws.
//    4. Apply handLocked + _discardLockedTurn.
//       Engine helpers (actionRecycleCards /
//       addCardFromDiscardToHand /
//       actionPlaceCreature{source:'discard'})
//       enforce the discard-out lock.
// ═══════════════════════════════════════════

const CARD_NAME = 'Staff of the Teleporter';

module.exports = {
  // Hand-lock greys-out: when the controller is hand-locked, the staff's
  // own draws would silently fizzle and the player would be 4 gold poorer
  // for nothing. Tagging this opts into the standard 🚫-and-dim treatment
  // (server.js builds `handLockBlockedCards`, app-board.jsx renders the
  // overlay). The loader's auto-tagger missed it because the header
  // comment mentions `actionPlaceCreature` — a NON_DRAW substring match.
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Hand-locked → the staff's own draws would silently fizzle, so
    // there's no value in activating. Mirrors Leadership / similar.
    if (ps.handLocked) return false;
    return true;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // ── Locate the resolving staff copy in hand (server's
    //    getResolvingHandIndex bookkeeping). _resolvingCard.nth is the
    //    1-based index of the activating copy.
    const resolvingNth = ps._resolvingCard?.nth || 1;
    let nameCount = 0, staffIdx = -1;
    for (let i = 0; i < ps.hand.length; i++) {
      if (ps.hand[i] === CARD_NAME) {
        nameCount++;
        if (nameCount === resolvingNth) { staffIdx = i; break; }
      }
    }

    // ── Eligible indices: every hand slot EXCEPT the resolving staff
    //    itself. Empty hand (or hand of just the staff) → no shuffle
    //    options, but the player can still confirm with 0 picks (which
    //    triggers the "shuffled the entire hand = 0 cards = +1 bonus"
    //    edge of the rules text — a free draw for 4 gold + lock).
    const eligibleIndices = [];
    for (let i = 0; i < ps.hand.length; i++) {
      if (i === staffIdx) continue;
      eligibleIndices.push(i);
    }

    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: 'Click cards in your hand to mark them. They will be shuffled into your deck and you will draw the same number — +1 if you commit your entire hand.',
      eligibleIndices,
      maxSelect: eligibleIndices.length,
      minSelect: 0,
      confirmLabel: '🌀 Teleport!',
      cancellable: true,
    });

    if (!result || result.cancelled) return { cancelled: true };

    // selectedCards is `[{ handIndex, cardName }, ...]` per the
    // handPick prompt contract. Defensive validation: drop any entries
    // that don't reference an eligible slot (a desynced client could
    // send phantom indices).
    const eligibleSet = new Set(eligibleIndices);
    const selected = (result.selectedCards || [])
      .filter(s => Number.isInteger(s?.handIndex) && eligibleSet.has(s.handIndex));

    const count = selected.length;
    const isAllHand = eligibleIndices.length > 0 && count === eligibleIndices.length;

    // Sort by descending hand index — actionMulliganCards iterates by
    // name and re-resolves the index each iteration, so technically
    // ordering only matters for log readability. Match Leadership's
    // convention.
    const cardNamesToReturn = [...selected]
      .sort((a, b) => b.handIndex - a.handIndex)
      .map(s => s.cardName);

    let potionCount = 0;
    let totalReturned = 0;
    if (cardNamesToReturn.length > 0) {
      const mulliganResult = await engine.actionMulliganCards(pi, cardNamesToReturn);
      potionCount = mulliganResult.potionCount || 0;
      totalReturned = mulliganResult.totalReturned || 0;
    }

    // Bonus +1 always lands on the main-deck pool (same as Leadership
    // Lv3's bonus draw — there's no rules basis for routing it
    // specifically to the potion deck).
    const bonusDraw = isAllHand ? 1 : 0;
    // ★ Als Regel (17.8.): "the same number" meint ALLE
    // zurueckgemischten Karten — auch gestohlene, die ins
    // GEGNER-Deck gingen. `totalReturned` zaehlt beide Decks;
    // die frueher benutzte Auswahlmenge haette bei einem
    // fehlgeschlagenen Rueckweg zu viel gezogen.
    const mainToDraw = (totalReturned - potionCount) + bonusDraw;

    if (mainToDraw > 0) {
      await engine.actionDrawCards(pi, mainToDraw, { source: CARD_NAME });
    }
    // Replenish from the potion deck for each potion that was shuffled
    // back. This mirrors Leadership's split — potions in / potions out.
    for (let i = 0; i < potionCount; i++) {
      if ((ps.potionDeck || []).length === 0) break;
      const potionCard = ps.potionDeck.shift();
      ps.hand.push(potionCard);
      engine.sync();
      await engine._delay(200);
    }

    // Locks land AFTER our own draws complete.
    ps.handLocked = true;
    ps._discardLockedTurn = gs.turn;

    engine.log('staff_of_the_teleporter', {
      player: ps.username,
      shuffled: count,
      drawn: mainToDraw + potionCount,
      bonus: bonusDraw,
    });
    engine.sync();
    return true;
  },
};
