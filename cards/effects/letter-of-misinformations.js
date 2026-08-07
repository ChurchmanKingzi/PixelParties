// ═══════════════════════════════════════════
//  CARD EFFECT: "Letter of Misinformations"
//  Artifact (Normal, cost 0) — Crystals
//
//  This card has no effect when you play it from
//  your hand. When this card is added from your
//  hand to your opponent's hand, you may look at
//  your opponent's hand and choose up to 2 cards
//  from it (except other Letter of Misinformations
//  copies). Add those cards to your hand. Once
//  per turn.
//
//  Trigger uses the new
//  `onCardTransferredToOppHand` hook. The
//  trigger fires on the ORIGINAL OWNER's side
//  when their Letter lands in opp's hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Letter of Misinformations';

module.exports = {
  // While in hand AND while in opp's hand (so the trigger still fires
  // when the card has just been transferred over), the script's hooks
  // need to be active. `activeIn: ['hand']` covers the original-owner
  // side. After transfer, the inst's owner is the OPP — but the
  // trigger fires once during the transfer hook itself, BEFORE any
  // zone-status filter would kick in, so listing 'hand' is sufficient.
  activeIn: ['hand'],

  // Standard "no effect when played from hand" — the artifact play
  // path resolves the card for its 0G cost and discards.
  isTargetingArtifact: true,
  canActivate: () => true,
  getValidTargets: () => [],
  targetingConfig: {
    description: 'Letter of Misinformations has no effect when played from hand.',
    confirmLabel: '✉️ Discard',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },
  validateSelection: () => true,
  animationType: 'none',

  async resolve(engine, pi) {
    engine.log('letter_of_misinformations_no_effect', {
      player: engine.gs.players[pi]?.username,
    });
    engine.sync();
  },

  hooks: {
    /**
     * Trigger when THIS Letter is added from the giver's hand to
     * their opponent's hand (Crystal Well, any future hand-give
     * mechanic). The effect runs for the GIVER — the listener inst
     * itself is on the recipient's side after the transfer, so we
     * deliberately don't use `ctx.cardOwner` to identify the player.
     *
     * Identity gate: `ctx.card.id === ctx.transferredInstId` filters
     * to ONLY the just-transferred Letter inst. Without this, every
     * Letter inst with `activeIn: 'hand'` would fire (sibling copies
     * still in either hand), causing duplicate / wrong-side
     * activations.
     *
     * HOPT per-giver — each side can fire this trigger at most once
     * per turn (matches "Once per turn" on the card text).
     */
    onCardTransferredToOppHand: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (ctx.cardName !== CARD_NAME) return;
      if (ctx.card?.id !== ctx.transferredInstId) return;

      const pi = ctx.fromPi;          // Giver — the side this effect runs for.
      const oi = ctx.toPi;             // Recipient.
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // Per-turn HOPT — once per turn per original-owner side.
      const hoptKey = `letter-of-misinformations:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;
      // Spreading-Rumor lock — Letter reads/takes from opp's hand.
      if (ps._oppHandInteractionLockedTurn === gs.turn) return;
      // Hand-locked controller can't add cards back.
      if (ps.handLocked) return;

      // Build the eligible-index list — every slot in opp's hand
      // except other copies of Letter of Misinformations (per card
      // text). Indices are stable across the picking loop because
      // we DEFER the splice until after all picks are made.
      const eligibleIndices = [];
      for (let i = 0; i < (ops.hand || []).length; i++) {
        if (ops.hand[i] === CARD_NAME) continue;
        eligibleIndices.push(i);
      }
      if (eligibleIndices.length === 0) return;

      // Reveal those slots on opp's side so the activator sees opp's
      // hand face-up for the duration of the picker. The client
      // already streams `_revealedHandIndices` → `revealedHandCards`
      // for the cross-side view (see server.js per-player serializer
      // and `revealedHandCards.find(...)` in app-board.jsx's opp-hand
      // render). We track which entries we ADDED so they can be
      // cleared in the finally block below — preserving any
      // pre-existing reveals (Luna Kiai, etc.).
      // Reaktionsfenster (Ambush the Scout), Kategorie 'reveal' — VOR
      // dem Aufdecken, weil schon das Ansehen die Hand-Interaktion ist.
      // Wird negiert, entfaellt Ansehen UND Wegnehmen.
      if (await engine.checkHandInteractionReaction(oi, 'reveal',
            { byPi: pi, count: (ops.hand || []).length, sourceName: 'Letter of Misinformations' })) {
        engine.log('letter_of_misinformations_negated', { player: gs.players[pi]?.username });
        engine.sync();
        return;
      }

      if (!ops._revealedHandIndices) ops._revealedHandIndices = {};
      const revealedKeysAdded = [];
      for (const idx of eligibleIndices) {
        if (!ops._revealedHandIndices[idx]) {
          ops._revealedHandIndices[idx] = true;
          revealedKeysAdded.push(idx);
        }
      }
      engine.sync();

      // Stamp HOPT now so re-entries (chained transfers, etc.) can't
      // re-fire the trigger mid-resolution. Opening the prompt
      // counts as activating the "may" — even a full cancel still
      // burns the once-per-turn slot.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      const maxPicks = Math.min(2, eligibleIndices.length);
      const pickedIndices = [];

      try {
        for (let n = 0; n < maxPicks; n++) {
          const remaining = eligibleIndices.filter(i => !pickedIndices.includes(i));
          if (remaining.length === 0) break;
          const result = await engine.promptGeneric(pi, {
            type: 'pickFromOppHand',
            title: CARD_NAME,
            description: `Click a card in ${ops.username}'s hand to take it.`,
            instruction: n === 0
              ? `You may take up to ${maxPicks} cards. (${n + 1}/${maxPicks})`
              : `(${n + 1}/${maxPicks})`,
            eligibleIndices: remaining,
            cancellable: true,
            cancelLabel: pickedIndices.length === 0 ? 'Take none' : 'Done',
          });
          if (!result || result.cancelled || result.handIndex == null) break;
          if (!remaining.includes(result.handIndex)) break; // defensive
          pickedIndices.push(result.handIndex);
        }
      } finally {
        for (const idx of revealedKeysAdded) {
          delete ops._revealedHandIndices[idx];
        }
      }

      // Resolve the picks AFTER the loop — splice in descending
      // order so each splice doesn't shift the indices of pending
      // picks. Each transferred card preserves its `originalOwner`
      // via the existing inst on opp's side when available.
      pickedIndices.sort((a, b) => b - a);
      for (const idx of pickedIndices) {
        const cardName = ops.hand[idx];
        if (!cardName) continue;
        ops.hand.splice(idx, 1);
        ps.hand.push(cardName);
        const newHandIdx = ps.hand.length - 1;
        const inst = engine._trackCard(cardName, pi, 'hand');
        const existing = engine.cardInstances.find(c =>
          c.owner === oi && c.zone === 'hand' && c.name === cardName && c.id !== inst.id,
        );
        if (existing) {
          inst.originalOwner = existing.originalOwner ?? oi;
          engine._untrackCard(existing.id);
        } else {
          inst.originalOwner = oi;
        }
        engine._broadcastEvent('play_pile_transfer', {
          fromOwner: oi, toOwner: pi, cardName,
          from: 'hand', to: 'hand',
          toHandIdx: newHandIdx,
        });
        engine.log('letter_take', { player: ps.username, card: cardName });
        await engine.runHooks('onCardAddedToHand', {
          playerIdx: pi, card: inst, cardName,
          source: CARD_NAME, _skipReactionCheck: true,
        });
        engine.sync();
        await engine._delay(200);
      }

      // Shuffle the remainder of opp's hand. Per card text, opp's
      // hand is shuffled after the effect resolves so the activator
      // can't continue reading the layout in subsequent turns. In-
      // place Fisher-Yates swap on the array directly — no
      // splice/reassign so we don't perturb the splice interceptor
      // (length is unchanged). Tracked card instances are keyed by
      // name not slot, so they continue to resolve correctly.
      if ((ops.hand?.length || 0) > 1) {
        const arr = ops.hand;
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        engine.log('letter_shuffle', { opponent: ops.username });
      }
      engine.sync();
    },
  },
};
