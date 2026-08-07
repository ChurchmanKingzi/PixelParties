// ═══════════════════════════════════════════
//  CARD EFFECT: "Enigma, the Seller of Secrets"
//  Hero — Hero Effect (once per turn)
//
//  "You may once per turn reveal the top 5 cards
//   of your opponent's deck. Then, choose one of
//   them and add it to your hand two times. Your
//   opponent then rearranges the remaining cards
//   on top of their deck in any order."
//
//  Implementation:
//   • Peek the top up to 5 of opp's deck (no
//     upfront broadcast — the activator sees them
//     in the gallery picker, opp learns the 2
//     picks via the per-pick reveal stream and
//     the 3 unpicked via the rearrange prompts).
//   • Activator picks a card, it's added to
//     their hand AND streamed to both players via
//     a card_reveal broadcast. Then picks again
//     from the remainder ("two times" = two
//     consecutive picks, NOT the same card twice).
//   • Opponent then orders the remaining peeked
//     cards on top of their deck — prompted one
//     card at a time, top-of-deck first (the
//     last card has no choice and is placed
//     automatically).
//   • Per-turn HOPT is auto-stamped by the
//     server's hero-effect activation handler.
// ═══════════════════════════════════════════

const CARD_NAME = 'Enigma, the Seller of Secrets';

module.exports = {
  // BORIS-SPERRE (Klausel 1): nimmt eine Karte aus dem Gegnerdeck auf die eigene Hand.
  // Bei wirksamem Boris beim Gegner nicht aktivierbar.
  stealsOpponentCards: true,

  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Gate: opp must have at least 1 card in deck (otherwise nothing to
   * reveal). Hand-locked controllers can't add to hand → core effect
   * can't be performed, mirrors Infiltration's gate for the same reason.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps || ps.handLocked) return false;
    const oi = pi === 0 ? 1 : 0;
    // Turn-1 protection: opp's deck is shielded from any effect that
    // peeks / touches the top while protection is active. Mirrors
    // Thieving / Charme Lv2 / etc. — gates here AND in onHeroEffect
    // so the activation can't be sneaked in via a stale UI flash.
    if (gs.firstTurnProtectedPlayer === oi) return false;
    const ops = gs.players[oi];
    if (!ops || (ops.mainDeck || []).length === 0) return false;
    return true;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const ps = gs.players[pi];
    const ops = gs.players[oi];
    if (!ps || !ops || ps.handLocked) return false;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    if ((ops.mainDeck || []).length === 0) return false;

    // ── Step 1: peek the top up to 5 cards ────────────────────────────
    // mainDeck[0] is the top (drawn next). slice() preserves top-first
    // order. The peek itself is silent — the activator sees the cards
    // through the gallery picker below, and opp will learn the 2 picks
    // via per-pick card_reveal broadcasts and the 3 unpicked via the
    // rearrange prompts. No upfront 5-card flash.
    const peekCount = Math.min(5, ops.mainDeck.length);
    const peeked = ops.mainDeck.slice(0, peekCount);

    // Snapshot opp's pre-effect deckTopVisible so we can preserve any
    // visibility that sat BELOW the peek window (Premonition stashes
    // deeper than position peekCount). The peek-window entries
    // themselves are moot — the cards either go to the activator's
    // hand or get re-stacked by the opp, and we re-mark the re-stacked
    // ones as visible after the rearrange below.
    const oldVisible = (ops.deckTopVisible || []).slice();
    const beyondPeek = oldVisible.slice(peekCount);

    engine.log('enigma_reveal', {
      player: ps.username, opponent: ops.username,
      cards: peeked, count: peekCount,
    });

    // ── Step 2: activator picks 2 cards consecutively ─────────────────
    // remainingPeeked starts as the full 5; each pick removes from it
    // and from opp's deck. maxPicks is min(2, peeked) — strictly two
    // when possible; degrades to one if opp's deck only had 1 card.
    const remainingPeeked = peeked.slice();
    const maxPicks = Math.min(2, peeked.length);
    let picksTaken = 0;

    for (let p = 0; p < maxPicks; p++) {
      const choice = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: remainingPeeked.map(name => ({ name, source: 'deck' })),
        title: CARD_NAME,
        description: `Choose a card from the top ${peekCount} of ${ops.username}'s deck to add to your Hand. (${p + 1}/${maxPicks})`,
        confirmLabel: '🎯 Take',
        confirmClass: 'btn-info',
        cancellable: false,
      });
      if (!choice?.cardName) break;
      const idx = remainingPeeked.indexOf(choice.cardName);
      if (idx < 0) break;

      const pickedName = remainingPeeked[idx];
      remainingPeeked.splice(idx, 1);

      // Pre-broadcast the deck→hand flight so the client can mask the
      // imminent hand-grew diff for this card and avoid a double draw
      // animation (same rationale as Infiltration).
      engine._broadcastEvent('play_pile_transfer', {
        fromOwner: oi, toOwner: pi, cardName: pickedName,
        from: 'deck', to: 'hand',
        toHandIdx: ps.hand.length,
      });
      await engine._delay(700);

      // Mutate state. Remove the first matching name from the front of
      // opp's deck — duplicates within the peeked window are
      // interchangeable (cards are name-only in mainDeck).
      const deckIdx = ops.mainDeck.indexOf(pickedName);
      if (deckIdx >= 0) ops.mainDeck.splice(deckIdx, 1);
      ps.hand.push(pickedName);
      engine._trackCard(pickedName, pi, 'hand');
      picksTaken++;

      engine.log('enigma_take', {
        player: ps.username, card: pickedName, opponent: ops.username,
      });

      // Steal hook so Lilly et al. can react to cards taken from opp's
      // deck — same surface Infiltration uses.
      await engine.runHooks('onCardTakenFromOpponent', {
        takerPi: pi, fromZone: 'deck', cardName: pickedName,
      });

      engine.sync();
    }

    // ── Step 3: opp rearranges the remaining peeked cards ─────────────
    // After the picks, the cards still sitting in remainingPeeked are
    // still at the top of opp's deck (the picks removed only the
    // picked names). Strip them so we can re-insert in the chosen
    // order.
    if (remainingPeeked.length === 0) {
      // All peeked cards went to the activator's hand. Whatever was
      // visible below the peek window is now at the top.
      ops.deckTopVisible = beyondPeek.slice();
      engine.sync();
      return true;
    }

    const stripped = [];
    for (const name of remainingPeeked) {
      const idx = ops.mainDeck.indexOf(name);
      if (idx >= 0) {
        ops.mainDeck.splice(idx, 1);
        stripped.push(name);
      }
    }

    // Single card left → no rearrangement choice, place on top.
    if (stripped.length === 1) {
      ops.mainDeck.unshift(stripped[0]);
      // Both players have seen this card during the picks gallery and
      // its trivial placement here, so it inherits the publicly-known
      // top trait until drawn / removed / shuffled.
      ops.deckTopVisible = [stripped[0]].concat(beyondPeek);
      engine.log('enigma_rearranged', {
        player: ops.username, count: 1, by: ps.username,
      });
      engine.sync();
      return true;
    }

    // Multiple cards → opp picks the order top-down, one card per
    // prompt. Position 1 = drawn next. The last card has no choice and
    // is placed automatically.
    const orderedTopFirst = [];
    const pool = stripped.slice();
    while (pool.length > 1) {
      const slotNum = orderedTopFirst.length + 1;
      const choice = await engine.promptGeneric(oi, {
        type: 'cardGallery',
        cards: pool.map(name => ({ name, source: 'deck' })),
        title: CARD_NAME,
        description: `Choose which card sits at position ${slotNum} of ${stripped.length} on top of your deck (position 1 is drawn next).`,
        confirmLabel: '📚 Place',
        confirmClass: 'btn-info',
        cancellable: false,
      });
      if (!choice?.cardName) {
        // Defensive: opp somehow declined a non-cancellable prompt.
        // Fall back to current pool order so the deck doesn't lose
        // cards.
        orderedTopFirst.push(...pool);
        pool.length = 0;
        break;
      }
      const idx = pool.indexOf(choice.cardName);
      if (idx < 0) {
        orderedTopFirst.push(...pool);
        pool.length = 0;
        break;
      }
      orderedTopFirst.push(pool[idx]);
      pool.splice(idx, 1);
    }
    if (pool.length === 1) orderedTopFirst.push(pool[0]);

    // Place ordered cards on top of opp's deck — orderedTopFirst[0]
    // becomes mainDeck[0] (drawn next). unshift in reverse so the
    // resulting prefix matches orderedTopFirst exactly.
    for (let i = orderedTopFirst.length - 1; i >= 0; i--) {
      ops.mainDeck.unshift(orderedTopFirst[i]);
    }
    // Both players have seen these cards during the picks gallery and
    // the rearrange prompts, so they inherit the publicly-known top
    // trait until drawn / removed / shuffled. Concatenate with any
    // pre-effect visibility that sat below the original peek window so
    // a deeper Premonition stash isn't accidentally hidden.
    ops.deckTopVisible = orderedTopFirst.concat(beyondPeek);

    engine.log('enigma_rearranged', {
      player: ops.username, count: orderedTopFirst.length, by: ps.username,
    });

    engine.sync();
    return true;
  },
};
