// ═══════════════════════════════════════════
//  CARD EFFECT: "Rain of Spores"
//  Spell (Normal, Lv3, Decay Magic)
//
//  Discard any number of cards from your hand.
//  Then look at your opponent's hand and discard
//  the same number of cards +1 from there. You
//  cannot draw or add cards to your hand for the
//  rest of the turn afterwards (handLocked).
// ═══════════════════════════════════════════

const CARD_NAME = 'Rain of Spores';

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // Spreading-Rumor lock — Rain of Spores reads/discards from
      // opp's hand, so it's gated.
      if (ps._oppHandInteractionLockedTurn === gs.turn) {
        engine.log('rain_of_spores_locked', { player: ps.username });
        gs._spellCancelled = true;
        return;
      }

      // Stream the card image to the opponent NOW — without this,
      // doPlaySpell's `_firePendingCardReveal` only runs AFTER the
      // discard prompts finish, leaving the opponent staring at a
      // mystery cast for the entire Phase A loop.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // Titular rain animation — full-board yellow spore shower
      // (rendered via the `rain_of_spores_rain` game-anim renderer in
      // app-board.jsx). Broadcast event mirrors the `deepsea_spores_-
      // activated` precedent.
      engine._broadcastEvent('rain_of_spores_activated', {});
      await engine._delay(300);

      // Phase A: caster picks how many of their own cards to discard.
      // Cap at `oppHandSize - 1` because the next phase forces the
      // caster to discard `ownDiscarded + 1` from opp's hand — if
      // opp doesn't have that many, the quota was unreachable, so
      // there's no point letting the caster discard beyond it. Caps
      // at the START before any self-discard since opp's hand size
      // is fixed for the duration of Phase A.
      const oppHandSizeAtStart = ops.hand?.length || 0;
      const maxOwnDiscard = Math.max(0, oppHandSizeAtStart - 1);
      let ownDiscarded = 0;
      while ((ps.hand?.length || 0) > 0 && ownDiscarded < maxOwnDiscard) {
        const eligible = (ps.hand || []).map((_, i) => i);
        const remaining = maxOwnDiscard - ownDiscarded;
        const result = await engine.promptGeneric(pi, {
          type: 'forceDiscardCancellable',
          title: CARD_NAME,
          description: `Discard cards from your hand. ${ops.username} will discard the same number + 1 afterwards. (${ownDiscarded} discarded so far, up to ${remaining} more) — Cancel to stop.`,
          instruction: 'Click a card in your hand to discard it.',
          eligibleIndices: eligible,
          cancellable: true,
          cancelLabel: 'Done',
        });
        if (!result || result.cancelled || result.cardName == null) break;
        const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
          source: CARD_NAME,
        });
        if (!ok) break;
        ownDiscarded++;
      }

      const oppToDiscard = ownDiscarded + 1;
      engine.log('rain_of_spores_resolve', {
        player: ps.username, opponent: ops.username,
        ownDiscarded, oppQuota: oppToDiscard,
      });

      // Phase B: caster looks at opp's hand and picks N+1 cards from
      // it to discard. The cardGallery prompt itself reveals every
      // card in opp's hand to the caster (the gallery options ARE
      // the opp hand contents) — so no separate per-card reveal
      // stream. Picks are mandatory (`cancellable: false`).
      const oppHandSize = ops.hand?.length || 0;
      const cap = Math.min(oppToDiscard, oppHandSize);
      if (cap > 0) {
        // Iterate cardGallery so the caster sees each remaining card
        // and picks one at a time (matches the reveal pacing).
        for (let n = 0; n < cap; n++) {
          if ((ops.hand?.length || 0) === 0) break;
          const cards = (ops.hand || []).map((cn, i) => ({
            name: cn, source: 'hand', _oppHandIdx: i,
          }));
          // Deduplicate display by name+slot — show every slot
          // distinctly so duplicate-named cards appear as separate
          // tiles. We give the gallery the FULL list (one entry per
          // physical slot) so the caster picks a specific copy.
          const pick = await engine.promptGeneric(pi, {
            type: 'cardGallery',
            cards,
            title: CARD_NAME,
            description: `Choose a card from ${ops.username}'s hand to discard. (${n + 1}/${cap})`,
            confirmLabel: '🍄 Discard',
            confirmClass: 'btn-danger',
            cancellable: false,
          });
          if (!pick?.cardName) break;
          const idx = (ops.hand || []).indexOf(pick.cardName);
          if (idx < 0) break;
          await engine.actionDiscardHandCard(oi, pick.cardName, idx, {
            source: CARD_NAME,
          });
        }
      }

      // Hand-lock for the rest of the turn — standard `handLocked`
      // flag the engine respects in actionDrawCards / actionAddCard-
      // FromDeckToHand / actionAddCardFromDiscardToHand.
      ps.handLocked = true;
      engine.log('rain_of_spores_hand_lock', { player: ps.username });

      engine.sync();
    },
  },
};
