// ═══════════════════════════════════════════
//  CARD EFFECT: "Spontaneous Reappearance"
//  Spell (Support Magic Lv0, Normal)
//  Pollution archetype.
//
//  Choose any number of cards from your discard
//  pile and add them to your hand. Place half that
//  many Pollution Tokens (rounded up) into your
//  free Support Zones.
//
//  Inherent additional Action: playable from hand
//  during the Main Phases as well as the Action
//  Phase, and never consumes the turn's Action —
//  the engine reads `inherentAction: true` both
//  as "main-phase-playable without an additional
//  action provider" and as "skip the heroActed
//  bookkeeping that would end the Action Phase."
//  No auto-end-turn: the player continues their
//  turn normally after Reappearance resolves.
// ═══════════════════════════════════════════

const { placePollutionTokens } = require('./_pollution-shared');

module.exports = {
  placesPollutionTokens: true,
  // Free action in both phases — no action cost, no phase advance.
  inherentAction: true,

  spellPlayCondition(gs, pi) {
    const ps = gs.players[pi];
    // Only playable if something can actually happen — no point if discard is empty.
    return (ps?.discardPile || []).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const discard = ps.discardPile || [];

      // ── Build gallery with one entry per copy in the discard pile ──
      // Each discard-pile slot is a distinct instance. The multi-select
      // prompt now tracks selections by gallery INDEX (not by card name),
      // so two copies of the same card name check independently and the
      // Reclaim button reflects "this many specific instances selected."
      const gallery = discard.map((name, idx) => ({
        name, source: 'discard', _discardIdx: idx,
      }));

      if (gallery.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: gallery,
        selectCount: gallery.length, // allow up to every card in the pile
        minSelect: 0, // "any number" — literally zero is also valid
        title: 'Spontaneous Reappearance',
        description: 'Pick any number of cards from your discard to return to hand. Half that many Pollution Tokens (rounded up) will be placed.',
        confirmLabel: '♻️ Reclaim',
        cancellable: true,
      });

      if (!picked || picked.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      const selected = picked.selectedCards || [];

      // ── Move selected cards from discard to hand, ONE BY ONE ──
      // Spacing each splice+sync with a short delay so the client's
      // hand-grew watcher fires per card — each reclaim visibly flies
      // out of the discard pile into its new hand slot rather than
      // teleporting as a batch. Picking the same card name twice must
      // remove two copies from the discard pile, so we splice by value
      // one at a time (peels off exactly `count(name)` copies).
      const movedNames = [];
      for (let i = 0; i < selected.length; i++) {
        const name = selected[i];
        const idx = ps.discardPile.indexOf(name);
        if (idx < 0) continue;
        ps.discardPile.splice(idx, 1);
        ps.hand.push(name);
        movedNames.push(name);

        // Sync + small pause so each card animates in separately, like a
        // staggered Wheels-style draw.
        engine.sync();
        if (i < selected.length - 1) await engine._delay(220);
      }

      engine.log('spontaneous_reappearance_return', {
        player: ps.username, count: movedNames.length, cards: movedNames,
      });

      // Breather after the last card lands before Pollution placement starts.
      if (movedNames.length > 0) await engine._delay(300);

      // ── Place ceil(N/2) Pollution Tokens ──
      const tokenCount = Math.ceil(movedNames.length / 2);
      if (tokenCount > 0) {
        await placePollutionTokens(engine, pi, tokenCount, 'Spontaneous Reappearance', {
          promptCtx: ctx,
        });
      }

      engine.log('spontaneous_reappearance', {
        player: ps.username,
        returned: movedNames.length,
        tokensPlaced: tokenCount,
      });

      engine.sync();
    },
  },
};
