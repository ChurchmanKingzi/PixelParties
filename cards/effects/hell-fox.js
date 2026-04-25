// ═══════════════════════════════════════════
//  CARD EFFECT: "Hell Fox"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  When this Creature is defeated, delete it and
//  search your deck for any card, reveal it, and
//  add it to your hand.
//
//  Wiring: listens for `onCreatureDeath` while in
//  the support zone. The engine fires the hook
//  AFTER splicing the dying creature out of its
//  slot but BEFORE flipping inst.zone to 'discard'
//  (and BEFORE untracking the instance) — so this
//  script (which lives on the dying instance) is
//  still active in 'support'. We re-route the
//  corpse from discard → deleted to honour the
//  "delete it" wording, then run a standard any-
//  card deck search.
//
//  Triggers on BOTH normal damage-kills AND
//  sacrifices: the engine treats sacrifice as a
//  sub-type of dying and fires ON_CREATURE_DEATH
//  via actionMoveCard's death-hook step regardless
//  of how the creature got destroyed.
//
//  Self-detection: the global `onCreatureDeath`
//  fires for every listener with the hook, so we
//  match on the dying instance's `instId` (added
//  by both the damage-batch death path and the
//  destroyCard death path) against ctx.card.id.
//  Robust against multiple Hell Foxes on board,
//  and against post-move state where heroIdx /
//  zoneSlot might already be -1.
// ═══════════════════════════════════════════

const CARD_NAME = 'Hell Fox';

module.exports = {
  activeIn: ['support'],

  // ── CPU evaluation hint ───────────────────────────────────────────
  // When this Creature dies, its owner gets a deck-search → hand
  // payload (≈ +20 hand value) but the corpse is deleted (no
  // discard recursion). Net benefit to owner ≈ +12 score. The CPU
  // eval reads `cpuMeta.onDeathBenefit` generically — sets the
  // discount on this slot's "alive value" so:
  //   • CPU-owned Hell Fox is ~12 less painful to lose than a vanilla
  //     creature → preferred sacrifice fodder.
  //   • Opp-owned Hell Fox is ~12 less attractive to attack → CPU
  //     avoids feeding the opponent's tutor.
  // Future on-death Creatures just declare their own number here
  // and the CPU brain picks them up automatically.
  cpuMeta: {
    onDeathBenefit: 12,
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;

      // Self-only: match by instance id so this only fires for THIS
      // Hell Fox. Falls back to position-based matching for any older
      // call site that hasn't been updated to stamp instId on
      // deathInfo (defensive — both core death paths set it now).
      if (death.instId != null) {
        if (death.instId !== ctx.card.id) return;
      } else {
        if (death.owner !== ctx.cardOriginalOwner) return;
        if (death.heroIdx !== ctx.cardHeroIdx) return;
        if (death.zoneSlot !== ctx.card.zoneSlot) return;
      }

      const engine = ctx._engine;
      const gs     = engine.gs;
      // Discard pile lives on the ORIGINAL owner. The engine pushed
      // the corpse there a moment ago (line ~12131 in actionApplyDamageBatch).
      const ownerPs = gs.players[death.originalOwner ?? death.owner];
      if (!ownerPs) return;

      // ── Black-flame eruption animation on the slot the fox just left ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'hell_fox_death',
        owner: death.owner,
        heroIdx: death.heroIdx,
        zoneSlot: death.zoneSlot,
      });

      // ── Step 1: re-route corpse from discard → deleted ──
      // Walk the discard pile from the back (the engine pushed it
      // last, so the most-recent copy of the name is the dying one).
      const discardIdx = ownerPs.discardPile.lastIndexOf(CARD_NAME);
      if (discardIdx >= 0) {
        ownerPs.discardPile.splice(discardIdx, 1);
        ownerPs.deletedPile.push(CARD_NAME);
      } else {
        // Defensive: if some other reaction already pulled the corpse
        // out (Beato-style "send to top of deck" effects), still push
        // a deleted entry so the card text resolves consistently.
        ownerPs.deletedPile.push(CARD_NAME);
      }

      engine.log('hell_fox_deleted', {
        player: ownerPs.username,
        hero: death.heroIdx,
        slot: death.zoneSlot,
      });

      await engine._delay(700);

      // ── Step 2: search the controller's deck for any card ──
      // The "your deck" wording refers to the controller of the
      // dying creature at the time of death — not always the
      // original owner (consider stolen creatures). We use cardOwner
      // (effective controller per _createContext, accounting for
      // charm/steal). Their discard/deleted pile, however, is on
      // originalOwner — that's why the corpse routing above used
      // ownerPs and the deck search below uses controllerPs.
      const controllerIdx = ctx.cardOwner;
      const controllerPs  = gs.players[controllerIdx];
      if (!controllerPs) {
        engine.sync();
        return;
      }
      if (controllerPs.handLocked) {
        engine.log('hell_fox_search_skipped', { reason: 'hand_locked' });
        engine.sync();
        return;
      }
      if ((controllerPs.mainDeck || []).length === 0) {
        engine.log('hell_fox_search_skipped', { reason: 'empty_deck' });
        engine.sync();
        return;
      }

      // Build deduplicated gallery (same shape as Idol of Crestina /
      // Navigation).
      const deckCounts = {};
      for (const cn of controllerPs.mainDeck) {
        deckCounts[cn] = (deckCounts[cn] || 0) + 1;
      }
      const galleryCards = Object.entries(deckCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      if (galleryCards.length === 0) {
        engine.sync();
        return;
      }

      const searchResult = await engine.promptGeneric(controllerIdx, {
        type: 'cardGallery',
        cards: galleryCards,
        title: CARD_NAME,
        description: 'Choose a card from your deck to add to your hand.',
        cancellable: true,
      });

      if (!searchResult || searchResult.cancelled || !searchResult.cardName) {
        // Even on cancel, "search your deck" implies a shuffle —
        // mirrors Elven Rider's tutor behaviour.
        engine.shuffleDeck(controllerIdx, 'main');
        engine.sync();
        return;
      }

      const pickedName = searchResult.cardName;
      const deckIdx = controllerPs.mainDeck.indexOf(pickedName);
      if (deckIdx < 0) {
        engine.shuffleDeck(controllerIdx, 'main');
        engine.sync();
        return;
      }

      controllerPs.mainDeck.splice(deckIdx, 1);
      controllerPs.hand.push(pickedName);

      engine._broadcastEvent('deck_search_add', { cardName: pickedName, playerIdx: controllerIdx });
      engine.log('hell_fox_search', { player: controllerPs.username, card: pickedName });

      // Standard reveal-to-opponent + shuffle.
      engine.shuffleDeck(controllerIdx, 'main');
      engine.sync();
      await engine._delay(400);
      const oi = controllerIdx === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: pickedName,
        searcherName: controllerPs.username,
        title: CARD_NAME,
        cancellable: false,
      });
    },
  },
};
