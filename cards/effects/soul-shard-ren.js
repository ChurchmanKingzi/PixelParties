// ═══════════════════════════════════════════
//  CARD EFFECT: "Soul Shard Ren" (Name)
//  Creature (Summoning Magic Lv1, Normal, 50 HP)
//  Archetype: Soul Shards.
//
//  PASSIVE: This Creature's effects don't get
//    negated when it's summoned by the effect
//    of Necromancy.
//
//  ON SUMMON FROM DISCARD: you MAY search your
//    deck for any card, reveal it, and add it
//    to your hand OR send it to your discard
//    pile.
//
//  HARD 1/TURN by name.
// ═══════════════════════════════════════════

const {
  canSummonSoulShard, markSoulShardSummoned,
  SOUL_SHARD_PILE_FUEL,
} = require('./_soul-shards-shared');

const CARD_NAME = 'Soul Shard Ren';

module.exports = {
  activeIn: ['support'],
  bypassNecromancyNegation: true,
  canSummon: canSummonSoulShard,
  cpuMeta: { pileFuel: SOUL_SHARD_PILE_FUEL },

  /**
   * CPU prompt response for Ren's two prompts:
   *   1. cardGallery (deck) — pick the candidate whose move from
   *      deck → (best of {hand, discard}) yields the highest eval.
   *      For Soul-Shard-armed boards this naturally picks a Soul
   *      Shard since pileFuel rewards Shards-in-discard so heavily
   *      that "send Shard to discard" is the highest-scoring path.
   *   2. optionPicker (hand vs discard) — score each path via
   *      eval delta, pick higher. Hand path = card moves to hand;
   *      discard path = card moves to discard. With pileFuel the
   *      discard path wins for Shards; for non-Shards the hand path
   *      typically wins (hand-card value > discard-pile value).
   *
   * Both branches snapshot, mutate, score, restore — no permanent
   * state changes. Skipped during MCTS rollouts (re-entry guard).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (engine._inMctsSim) return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    const evalState = engine._cpuEvaluateState;
    if (typeof evalState !== 'function') return undefined;
    const pi = engine._cpuPlayerIdx;
    const ps = engine.gs.players?.[pi];
    if (!ps) return undefined;

    // Gallery: card-from-deck. For each candidate, project the BEST
    // destination (hand vs discard) and score; pick best overall.
    if (promptData.type === 'cardGallery') {
      const cards = promptData.cards || [];
      if (!cards.length) return undefined;
      let best = null;
      let bestScore = -Infinity;
      for (const c of cards) {
        const name = c.name;
        const idx = (ps.mainDeck || []).indexOf(name);
        if (idx < 0) continue;
        ps.mainDeck.splice(idx, 1);
        // Project send-to-discard
        ps.discardPile.push(name);
        let scoreDiscard = -Infinity;
        try { scoreDiscard = evalState(pi); } catch {}
        ps.discardPile.pop();
        // Project add-to-hand
        ps.hand.push(name);
        let scoreHand = -Infinity;
        try { scoreHand = evalState(pi); } catch {}
        ps.hand.pop();
        // Restore deck position
        ps.mainDeck.splice(idx, 0, name);
        const score = Math.max(scoreDiscard, scoreHand);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) return undefined;
      return { cardName: best.name, source: best.source };
    }

    // Option picker: hand vs discard for the already-chosen card.
    // The chosen-card name comes from the prompt's description (the
    // engine formats it as `What should happen to "${chosenName}"?`).
    if (promptData.type === 'optionPicker') {
      const m = /"([^"]+)"/.exec(promptData.description || '');
      const name = m && m[1];
      if (!name) return undefined;
      const deckIdx = (ps.mainDeck || []).indexOf(name);
      if (deckIdx < 0) return undefined;
      ps.mainDeck.splice(deckIdx, 1);
      ps.discardPile.push(name);
      let scoreDiscard = -Infinity;
      try { scoreDiscard = evalState(pi); } catch {}
      ps.discardPile.pop();
      ps.hand.push(name);
      let scoreHand = -Infinity;
      try { scoreHand = evalState(pi); } catch {}
      ps.hand.pop();
      ps.mainDeck.splice(deckIdx, 0, name);
      return { optionId: scoreDiscard > scoreHand ? 'discard' : 'hand' };
    }

    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      markSoulShardSummoned(gs, pi, CARD_NAME);
      if (!ctx._summonedFromDiscard) return;

      const ps = gs.players[pi];
      if (!ps?.mainDeck?.length) return;

      // Build deduped gallery over the WHOLE deck (any card type).
      const cardDB = engine._getCardDB();
      const counts = {};
      for (const name of ps.mainDeck) counts[name] = (counts[name] || 0) + 1;
      const gallery = Object.entries(counts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));
      if (gallery.length === 0) return;

      const pick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose any card from your deck — you\'ll then decide whether to add it to your hand or send it to your discard pile.',
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.cardName) return;
      const chosenName = pick.cardName;
      const cd = cardDB[chosenName];
      if (!cd) return;
      // Defensive — re-validate the deck still holds it.
      if (ps.mainDeck.indexOf(chosenName) < 0) return;

      // Step 2: hand-vs-discard choice.
      const dest = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `What should happen to "${chosenName}"?`,
        options: [
          { id: 'hand',    label: 'Add it to your hand' },
          { id: 'discard', label: 'Send it to your discard pile' },
        ],
        cancellable: false,
        // Distinct effect paths — Gerrymander redirect eligible. Hand
        // is generally better for the searcher; discard fuels future
        // Necromancy / Soul Shard revivals. Either choice is a real
        // decision that opp's Gerrymander would want to flip.
        gerrymanderEligible: true,
      });
      const destId = dest?.optionId || 'hand';

      if (destId === 'hand') {
        // Route through the canonical helper so ON_CARD_ADDED_TO_HAND
        // fires (Cosmic-Depths counter generators key off this hook).
        await engine.actionAddCardFromDeckToHand(pi, chosenName, {
          source: CARD_NAME, reveal: true,
        });
        engine.log('soul_shard_ren_to_hand', {
          player: ps.username, card: chosenName,
        });
      } else {
        // Send to discard. Splice + push directly — discard pile
        // adds don't fire ON_CARD_ADDED_TO_HAND.
        const idx = ps.mainDeck.indexOf(chosenName);
        if (idx < 0) return;
        ps.mainDeck.splice(idx, 1);
        ps.discardPile.push(chosenName);
        engine._broadcastEvent('deck_to_discard_animation', {
          owner: pi, cardNames: [chosenName], source: CARD_NAME,
        });
        engine.log('soul_shard_ren_to_discard', {
          player: ps.username, card: chosenName,
        });
        // Reveal to opp — same disclosure as a normal tutor.
        engine.sync();
        await engine._delay(500);
        const oi = pi === 0 ? 1 : 0;
        await engine.promptGeneric(oi, {
          type: 'deckSearchReveal',
          cardName: chosenName,
          searcherName: ps.username,
          title: CARD_NAME,
          cancellable: false,
        });
      }
      engine.sync();
    },
  },
};
