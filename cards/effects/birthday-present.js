// ═══════════════════════════════════════════
//  CARD EFFECT: "Birthday Present"
//  Artifact (Normal, Cost 4) — Banned base
//
//  Reveal the top 3 cards of your deck. Your
//  opponent chooses 1 of them. Add that card
//  to your opponent's hand and add the other 2
//  cards to your hand.
//
//  Implementation
//  ──────────────
//  • Custom four-phase reveal animation (see
//    `app-board.jsx`'s `birthday_present_reveal_start`
//    + `birthday_present_pick_resolved` handlers
//    and the `.bday-present-reveal-card` CSS). The
//    flow:
//      Phase 1 — three cards slide into viewport
//                centre face-down, staggered ~250ms
//                each, with a horizontal layout
//                (-1, 0, +1 slots around centre).
//      Phase 2 — each card flips face-up (delay-
//                chained off the slide-in so the
//                flip lands once the card has
//                settled).
//      Phase 3 — cards hold at centre. Opp clicks
//                one directly (no separate picker
//                modal) — the click maps to a
//                `promptGeneric` response.
//      Phase 4 — the chosen card pulses + glows
//                for 200ms; then all three cards
//                fly to their target hand slots
//                (chosen → opp's hand, others →
//                activator's hand).
//
//  • Two server broadcasts drive this:
//      `birthday_present_reveal_start` — phases 1/2/3
//      `birthday_present_pick_resolved` — phase 4
//    Between them, `engine.promptGeneric(oppIdx,
//    { type: 'birthdayPresentPick', ... })` opens
//    the click prompt on opp's side. The custom
//    prompt type has no fallback UI in the
//    renderer; opp's click on a floating reveal
//    card is what responds.
//
//  • State-mutation order matches Kassaran's
//    pattern: broadcast `pick_resolved` BEFORE
//    pushing to hands so the client receives the
//    animation cue first; the subsequent
//    `engine.sync()` grows the hand at the
//    pre-computed indices, and the client's
//    `bounceReturnHidden` set hides those new
//    slots until the floating reveal cards finish
//    flying into them — no double-render / no
//    cards popping in mid-flight.
//
//  • Origin tracking: opp's gifted card carries
//    `originalOwner = pi` so when opp plays it,
//    its discard / deleted disposition routes back
//    to the activator's pile (the card came out
//    of MY deck). Cards returning to the
//    activator's own hand keep the default.
// ═══════════════════════════════════════════

const CARD_NAME    = 'Birthday Present';
const REVEAL_COUNT = 3;

// Client animation budget — matches the CSS keyframes for slide-in
// (600ms) + per-card stagger (3 × 250ms) + flip (600ms, chained off
// the slide). The +200ms tail is a small buffer so the cards have
// visibly settled in their face-up centre position before the click
// prompt opens.
const REVEAL_ANIM_MS = 600 + (REVEAL_COUNT * 250) + 600 + 200;
// Highlight (200ms) + fly-out runtime. The opp-bound chosen card and
// the FIRST activator-bound card start flying together; the SECOND
// activator-bound card waits one flight-duration (700ms) before its
// flight begins, giving the "one by one" landing into the activator's
// hand. Total runtime = 200 (highlight) + 700 (delay for user card 2)
// + 700 (flight duration) + small unhide buffer.
const USER_BOUND_INTER_DELAY = 700;
const FLIGHT_DURATION = 700;
const RESOLVE_ANIM_MS = 200 + USER_BOUND_INTER_DELAY + FLIGHT_DURATION + 200;

module.exports = {
  blockedByHandLock: true,
  deferBroadcast: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    return (ps.mainDeck?.length || 0) >= REVEAL_COUNT;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs  = gs.players[oppIdx];
    if (!ps || !oppPs) return { cancelled: true };
    if ((ps.mainDeck?.length || 0) < REVEAL_COUNT) return { cancelled: true };

    // ── Step 1: take the top 3 cards off the deck ────────────────────────
    const revealed = ps.mainDeck.splice(0, REVEAL_COUNT);
    engine.sync();

    // ── Step 2: reveal the Birthday Present artifact itself to opp ───────
    // `deferBroadcast: true` suppressed the engine's auto-reveal. Emit
    // manually so opp sees "Birthday Present is being played" before the
    // 3-card slide-in animation kicks off.
    const oppSid = oppPs.socketId;
    if (oppSid && engine.io) {
      engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
    }
    if (engine.room?.spectators) {
      for (const spec of engine.room.spectators) {
        if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: CARD_NAME });
      }
    }
    await engine._delay(400);

    // ── Step 3: broadcast Phase 1/2/3 — slide-in + flip + hold ───────────
    // The client's `birthday_present_reveal_start` handler spawns the 3
    // floating reveal cards on BOTH players' screens. The activator
    // watches; the opponent will get clickable cards once the prompt
    // opens below.
    engine._broadcastEvent('birthday_present_reveal_start', {
      ownerIdx: pi,
      oppIdx,
      cards: revealed,
    });
    await engine._delay(REVEAL_ANIM_MS);

    // ── Step 4: prompt opp to click one of the floating cards ────────────
    // The custom prompt type `birthdayPresentPick` has no fallback UI in
    // the renderer — the opp's click handler on the already-floating
    // reveal cards (gated on `gameState.effectPrompt?.type === 'birthday-
    // PresentPick'`) is what calls `respondToPrompt({ cardName })`.
    const oppResult = await engine.promptGeneric(oppIdx, {
      type: 'birthdayPresentPick',
      cards: revealed,
      title: CARD_NAME,
      cancellable: false,
    });

    let oppChoice;
    if (oppResult && typeof oppResult.cardName === 'string'
        && revealed.includes(oppResult.cardName)) {
      oppChoice = oppResult.cardName;
    } else {
      if (oppResult && oppResult.cardName) {
        engine.log('birthday_present_off_list_pick', {
          player: oppPs.username,
          picked: oppResult.cardName,
          offered: revealed,
        });
      }
      oppChoice = revealed[0];
    }

    // The other two cards go to the activator. Splice exactly one copy
    // of opp's pick so duplicate names (unshuffled adjacent copies)
    // don't double-drop.
    const playerCards = (() => {
      const out = revealed.slice();
      const idx = out.indexOf(oppChoice);
      if (idx >= 0) out.splice(idx, 1);
      return out;
    })();

    // ── Step 5: compute destination hand indices BEFORE state mutation ───
    // The client's `pick_resolved` handler needs to know exactly which
    // hand slot each card flies to. We snapshot the current hand lengths
    // (= where the pushed cards will live after the upcoming push) and
    // include those in the broadcast.
    const oppHandIdx        = oppPs.hand.length;
    const playerHandStartIdx = ps.hand.length;
    const playerHandIdxs    = playerCards.map((_, i) => playerHandStartIdx + i);

    // ── Step 6: broadcast Phase 4 — highlight + fly-out ──────────────────
    // Emitted BEFORE the state mutation below so the client receives the
    // animation cue first; the subsequent `engine.sync()` then grows the
    // hand at the pre-announced indices and the client's
    // `bounceReturnHidden` set keeps those new slots invisible until the
    // floating reveal cards finish flying into them.
    engine._broadcastEvent('birthday_present_pick_resolved', {
      ownerIdx: pi,
      oppIdx,
      chosen: oppChoice,
      // `delay` is the per-flight pre-flight wait (ms) relative to the
      // post-highlight moment. Chosen card and first activator-bound
      // card start at delay=0 (concurrent — matches the spec's "flies
      // to opp's hand while the other two fly to your hand"). Second
      // activator-bound card starts at delay=USER_BOUND_INTER_DELAY so
      // it lands AFTER the first activator-bound card — the "one by
      // one" landing the user asked for.
      flights: [
        { cardName: oppChoice, toOwner: oppIdx, toHandIdx: oppHandIdx, delay: 0 },
        ...playerCards.map((name, i) => ({
          cardName: name, toOwner: pi, toHandIdx: playerHandIdxs[i],
          delay: i * USER_BOUND_INTER_DELAY,
        })),
      ],
    });

    // ── Step 7: mutate state ─────────────────────────────────────────────
    // Opp's gifted card carries `originalOwner = pi` so its eventual
    // discard / deleted disposition routes back to the activator.
    // Reaktionsfenster (Ambush the Scout), Kategorie 'insert'.
    if (await engine.checkHandInteractionReaction(oppIdx, 'insert',
          { byPi: pi, count: 1, sourceName: 'Birthday Present' })) {
      engine.log('birthday_present_negated', { player: gs.players[pi]?.username });
      engine.sync();
      return;
    }
    oppPs.hand.push(oppChoice);
    const oppInst = engine._trackCard(oppChoice, oppIdx, 'hand');
    oppInst.originalOwner = pi;
    engine.log('card_added_to_hand', { card: oppChoice, player: oppPs.username, by: CARD_NAME });

    for (const name of playerCards) {
      ps.hand.push(name);
      // originalOwner defaults to pi (own deck → own hand) — no override.
      engine._trackCard(name, pi, 'hand');
      engine.log('card_added_to_hand', { card: name, player: ps.username, by: CARD_NAME });
    }

    engine.sync();

    // ── Step 8: wait for client highlight + fly-out animation ────────────
    // The `bounceReturnHidden` keys the client set when receiving
    // `pick_resolved` keep the new hand slots invisible during this
    // window. They auto-unhide on the client side after RESOLVE_ANIM_MS.
    await engine._delay(RESOLVE_ANIM_MS);
  },
};
