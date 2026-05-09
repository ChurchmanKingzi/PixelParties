// ═══════════════════════════════════════════
//  CARD EFFECT: "The Bonegrinder"
//  Spell (Magic Arts Lv3, Area, Skeletons)
//
//  Three effects:
//
//    1. Hand-level reduction — this Spell's level in your hand is
//       reduced by the number of "Skeleton" Creatures in your discard
//       pile (capped at the spell's base level via the engine's
//       max(0, raw - reduction) clamp).
//
//    2. Optional sacrifice for additional Action — at cast time,
//       you may delete a Skeleton from your discard pile to make
//       this Spell count as an additional Action. Implemented via
//       `gs._spellFreeAction = true` after the deletion.
//
//    3. Reactive draw on Skeleton-to-discard — up to 5 times per turn,
//       when one of your Skeleton Creatures would be sent to your
//       discard pile, you may delete it instead and draw 1 card.
//       Implemented via the generic `_redirectToDeleted` flag on the
//       leaving instance + a draw at `onCardLeaveZone` time.
// ═══════════════════════════════════════════

const { isSkeletonCreature, findSkeletonsInDiscard } = require('./_skeleton-shared');

const CARD_NAME = 'The Bonegrinder';
const MAX_DRAWS_PER_TURN = 5;

module.exports = {
  activeIn: ['hand', 'area'],

  /**
   * Inherent-additional-Action gate. Returns true during a Main Phase
   * iff there's at least one Skeleton in the caster's discard pile —
   * because the only reason this Spell can self-provide its
   * additional Action IS deleting one of those Skeletons. The engine
   * (server.js doPlaySpell) consults this gate before deciding
   * whether the Spell needs an external additional-action provider:
   * a `true` here means "no provider needed, this Spell pays its own
   * cost." When this branch is the path used (Main Phase + this gate
   * was true), `onPlay` MUST collect the Skeleton-deletion cost
   * because no other Action was paid — that's enforced below.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isMainPhase) return false;
    const ps = gs.players[pi];
    if (!ps || !engine) return false;
    return findSkeletonsInDiscard(ps, engine).length > 0;
  },

  /**
   * In-hand level rebate: -1 for each Skeleton in this player's
   * discard pile. Card text scopes the reduction strictly:
   *   • Only Bonegrinders IN HAND reduce — area-zone copies do NOT.
   *   • Each hand-copy independently reduces its OWN level, with no
   *     stacking when multiple Bonegrinders sit in hand at once.
   *
   * The engine passes the contributing instance as the 4th arg, so
   * we filter on `inst.zone === 'hand'` to exclude area copies, and
   * dedupe across multiple hand-copies by only crediting the FIRST
   * tracked hand instance with the rebate. heroMeetsLevelReq treats
   * the level-check as one question per card NAME, so a single -N
   * contribution is exactly what the card text asks for ("each
   * Bonegrinder in hand independently reduces its own level, nothing
   * more" → effective rebate = N regardless of hand-copy count).
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    if (!inst || inst.zone !== 'hand') return 0;
    // Dedupe across multiple hand-copies — only the first contributes.
    const firstHandCopy = engine.cardInstances.find(c =>
      c.zone === 'hand'
      && (c.controller ?? c.owner) === ownerIdx
      && c.name === CARD_NAME,
    );
    if (firstHandCopy?.id !== inst.id) return 0;

    const ps = engine.gs.players[ownerIdx];
    if (!ps) return 0;
    let count = 0;
    for (const name of (ps.discardPile || [])) {
      if (isSkeletonCreature(name, engine)) count++;
    }
    return count;
  },

  hooks: {
    /**
     * On cast: optional Skeleton-deletion → free action, then place
     * into the caster's Area zone. The placement step mirrors Acid
     * Rain's self-cast pattern (`engine.placeArea`). Filters via
     * `cardZone === 'hand'` + `playedCard.id === card.id` so only
     * THIS card's own onPlay fires the placement (not the in-area
     * instance reacting to other plays).
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Decide which path this cast took:
      //   • Main Phase + Skeleton(s) in discard → INHERENT branch.
      //     server.js's `doPlaySpell` consulted `inherentAction()` and
      //     skipped the additional-action provider check — meaning the
      //     ONLY way this cast was even legal is the Skeleton deletion.
      //     The deletion is therefore mandatory: no opt-out prompt.
      //   • Otherwise (Action Phase, or via an external provider) →
      //     the deletion is optional. Player gets the same opt-in
      //     prompt as before.
      const candidates = findSkeletonsInDiscard(ps, engine);
      const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
      const inherentBranch = isMainPhase && candidates.length > 0;

      const consumeSkeleton = async (chosenName) => {
        const idx = ps.discardPile.indexOf(chosenName);
        if (idx < 0) return;
        ps.discardPile.splice(idx, 1);
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(chosenName);
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: chosenName, from: 'discard', to: 'deleted',
        });
        engine.log('bonegrinder_delete', { player: ps.username, deleted: chosenName });
      };

      if (inherentBranch) {
        // FORCED: pick which Skeleton is consumed. Auto-pick when
        // there's only one option, otherwise non-cancellable picker.
        let chosenName = candidates.length === 1 ? candidates[0].name : null;
        if (!chosenName) {
          const pick = await engine.promptGeneric(pi, {
            type: 'cardGallery',
            cards: candidates.map(c => ({ name: c.name, source: 'discard', count: c.count })),
            title: CARD_NAME,
            description: 'Delete a "Skeleton" Creature from your discard pile — paying for this Spell\'s self-provided additional Action.',
            cancellable: false,
          });
          chosenName = pick?.cardName || candidates[0].name;
        }
        await consumeSkeleton(chosenName);
        // No `gs._spellFreeAction` here — the inherent-Action path
        // already skipped the regular Action consumption upstream;
        // setting `_spellFreeAction` would refund a non-existent Action.
      } else if (candidates.length > 0) {
        // OPTIONAL: cast went through a regular Action / external
        // provider; the deletion is a "may" — refunds the consumed
        // Action via `gs._spellFreeAction`.
        const wantsRefund = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: CARD_NAME,
          message: 'Delete a "Skeleton" Creature from your discard pile to make this Spell count as an additional Action?',
          showCard: CARD_NAME,
          confirmLabel: '🦴 Sacrifice + cast free!',
          cancelLabel: 'Cast normally',
          cancellable: true,
        });
        if (wantsRefund) {
          let chosenName = null;
          if (candidates.length === 1) {
            chosenName = candidates[0].name;
          } else {
            const pick = await engine.promptGeneric(pi, {
              type: 'cardGallery',
              cards: candidates.map(c => ({ name: c.name, source: 'discard', count: c.count })),
              title: CARD_NAME,
              description: 'Pick a Skeleton in your discard pile to delete.',
              cancellable: false,
            });
            chosenName = pick?.cardName || candidates[0].name;
          }
          await consumeSkeleton(chosenName);
          // Refund the consumed Action via the standard hook.
          gs._spellFreeAction = true;
        }
      }

      // Place into the caster's Area zone (also self-deletes the card
      // from hand → area transition, so the hand instance is gone for
      // future turns' reduceCardLevel calls).
      await engine.placeArea(pi, ctx.card);
    },

    /**
     * Reactive draw — up to 5/turn, when an own Skeleton would be sent
     * to own discard, may delete it instead and draw 1.
     *
     * Why `onCardLeaveZone` not `onCreatureDeath`: this hook fires at
     * line 5160 in actionMoveCard, BEFORE the `_redirectToDeleted`
     * block at line 5185 — so setting the flag here intercepts the
     * destination switch cleanly. `onCreatureDeath` fires later, by
     * which point the destination has already been finalized (well,
     * almost — but the redirect block runs first). Using leave-zone
     * keeps the redirect path symmetrical with Vacarn's hero hook.
     */
    onCardLeaveZone: async (ctx) => {
      // Filter:
      //   • leaving from support → discard.
      //   • leaving creature is owned by Bonegrinder's controller.
      //   • leaving creature is a Skeleton.
      //   • we're not already redirecting (Vacarn ran first, etc.).
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone !== 'discard') return;
      const leaving = ctx.leavingCard;
      if (!leaving) return;
      if (leaving._redirectToDeleted) return;
      const myController = ctx.cardController ?? ctx.cardOwner;
      const targetController = leaving.controller ?? leaving.owner;
      if (targetController !== myController) return;
      const engine = ctx._engine;
      if (!isSkeletonCreature(leaving.name, engine)) return;

      // Per-turn cap on this Bonegrinder instance.
      const inst = ctx.card;
      const turn = engine.gs.turn || 0;
      if (!inst.counters._bonegrinderDrawsTurn || inst.counters._bonegrinderDrawsTurn !== turn) {
        inst.counters._bonegrinderDrawsTurn = turn;
        inst.counters._bonegrinderDrawsCount = 0;
      }
      if ((inst.counters._bonegrinderDrawsCount || 0) >= MAX_DRAWS_PER_TURN) return;

      // Hand-lock makes the draw worthless — silently skip rather
      // than waste the prompt.
      const ps = engine.gs.players[myController];
      if (!ps || ps.handLocked) return;

      const confirmed = await engine.promptGeneric(myController, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${leaving.name} is heading to your discard pile. Delete it instead and draw 1 card?`,
        showCard: CARD_NAME,
        confirmLabel: '🦴 Grind!',
        cancelLabel: 'Send to discard',
        cancellable: true,
      });
      if (!confirmed) return;

      inst.counters._bonegrinderDrawsCount = (inst.counters._bonegrinderDrawsCount || 0) + 1;
      // Redirect to deleted via the engine's generic flag.
      leaving._redirectToDeleted = true;
      // Draw 1.
      await engine.actionDrawCards(myController, 1, { source: CARD_NAME });
      engine.log('bonegrinder_draw', {
        player: ps.username,
        deletedSkeleton: leaving.name,
        usedThisTurn: inst.counters._bonegrinderDrawsCount,
      });
    },

    /**
     * Hand → discard reactive draw. Inventing, Magenta's discard
     * cost, forced discards, and any other hand-discard path push
     * the card directly into `ps.discardPile` and fire `onDiscard`
     * AFTER the splice — by the time we see the event the card is
     * already in the discard pile, so the redirect happens
     * post-hoc: pop the card back off the discard pile, push it
     * onto the deleted pile, draw 1. The card text scopes to
     * "Skeleton Creature would be sent to your discard pile",
     * which covers ANY source zone, not just support.
     *
     * Per-turn cap and hand-lock guard match the support-side
     * path. Same `_redirectToDeleted` flag isn't usable here —
     * the discarder splice doesn't consult the inst (often there
     * isn't even a tracked inst for hand cards), so we mutate the
     * pile arrays ourselves.
     */
    onDiscard: async (ctx) => {
      const engine = ctx._engine;
      const myController = ctx.cardController ?? ctx.cardOwner;
      // Only react when the discard happened on the SAME side as
      // this Bonegrinder. Cross-player discards (a future opp-
      // induced discard) don't qualify.
      if (ctx.playerIdx !== myController) return;
      const cardName = ctx.cardName || ctx.discardedCardName;
      if (!cardName) return;
      if (!isSkeletonCreature(cardName, engine)) return;

      // The support-side `onCardLeaveZone` handler runs FIRST for
      // support → discard transitions and uses `_redirectToDeleted`
      // to flip the destination before this `onDiscard` would fire
      // for that path (engine fires onCardLeaveZone before onDiscard
      // in the discard pipeline). To avoid double-handling, we skip
      // when `ctx._fromSupport` is set — the support path owns the
      // animation + redirect for board-creature deaths. Hand-driven
      // discards (Inventing, Magenta, force-discard) explicitly tag
      // `_fromHand: true` and don't carry `_fromSupport`, so they
      // route here.
      if (ctx._fromSupport) return;

      // Verify the card is actually still in the discard pile (a
      // chained reaction could have pulled it back out — Bamboo
      // Shield reveal etc.). If something else already moved it,
      // there's nothing to redirect.
      const ps = engine.gs.players[myController];
      if (!ps) return;
      const discardIdx = ps.discardPile?.lastIndexOf(cardName);
      if (discardIdx == null || discardIdx < 0) return;

      // Per-turn cap on this Bonegrinder instance.
      const inst = ctx.card;
      const turn = engine.gs.turn || 0;
      if (!inst.counters._bonegrinderDrawsTurn || inst.counters._bonegrinderDrawsTurn !== turn) {
        inst.counters._bonegrinderDrawsTurn = turn;
        inst.counters._bonegrinderDrawsCount = 0;
      }
      if ((inst.counters._bonegrinderDrawsCount || 0) >= MAX_DRAWS_PER_TURN) return;

      // Hand-lock makes the draw worthless — silently skip.
      if (ps.handLocked) return;

      const confirmed = await engine.promptGeneric(myController, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${cardName} just hit your discard pile. Delete it instead and draw 1 card?`,
        showCard: CARD_NAME,
        confirmLabel: '🦴 Grind!',
        cancelLabel: 'Leave in discard',
        cancellable: true,
      });
      if (!confirmed) return;

      // Re-verify position (a parallel reaction during the prompt
      // could have shifted the pile).
      const finalIdx = ps.discardPile.lastIndexOf(cardName);
      if (finalIdx < 0) return;

      ps.discardPile.splice(finalIdx, 1);
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(cardName);
      engine._broadcastEvent('play_pile_transfer', {
        owner: myController, cardName, from: 'discard', to: 'deleted',
      });

      inst.counters._bonegrinderDrawsCount = (inst.counters._bonegrinderDrawsCount || 0) + 1;
      await engine.actionDrawCards(myController, 1, { source: CARD_NAME });
      engine.log('bonegrinder_draw', {
        player: ps.username,
        deletedSkeleton: cardName,
        usedThisTurn: inst.counters._bonegrinderDrawsCount,
      });
      engine.sync();
    },

    /**
     * Mill (deck → discard) reactive draw. `actionMillCards` pushes
     * milled cards directly into `ps.discardPile` and fires `onMill`
     * with `milledCards: string[]`. Walk the array, prompt per
     * Skeleton, and redirect each confirmed one from discard →
     * deleted pile. Per-turn cap is shared with the other two
     * paths (one Bonegrinder = max 5 grinds/turn across hand,
     * support, and deck sources combined).
     *
     * Skips `deleteMode` mills — those went straight to deletedPile,
     * never visited discardPile, so the trigger condition ("would be
     * sent to your discard pile") doesn't apply.
     */
    onMill: async (ctx) => {
      if (ctx.deleteMode) return;
      const engine = ctx._engine;
      const myController = ctx.cardController ?? ctx.cardOwner;
      if (ctx.playerIdx !== myController) return;

      const milled = Array.isArray(ctx.milledCards) ? ctx.milledCards : [];
      if (milled.length === 0) return;

      const inst = ctx.card;
      const turn = engine.gs.turn || 0;
      if (!inst.counters._bonegrinderDrawsTurn || inst.counters._bonegrinderDrawsTurn !== turn) {
        inst.counters._bonegrinderDrawsTurn = turn;
        inst.counters._bonegrinderDrawsCount = 0;
      }

      const ps = engine.gs.players[myController];
      if (!ps) return;

      for (const cardName of milled) {
        if ((inst.counters._bonegrinderDrawsCount || 0) >= MAX_DRAWS_PER_TURN) break;
        if (!isSkeletonCreature(cardName, engine)) continue;
        // Card might have been pulled out of discard already by a
        // chained mill effect (e.g., self-delete redirect runs
        // after onMill via Phase B/C). Skip if it's no longer
        // sitting in discardPile.
        const idx = ps.discardPile?.lastIndexOf(cardName);
        if (idx == null || idx < 0) continue;
        if (ps.handLocked) continue;

        const confirmed = await engine.promptGeneric(myController, {
          type: 'confirm',
          title: CARD_NAME,
          message: `${cardName} was just milled to your discard pile. Delete it instead and draw 1 card?`,
          showCard: CARD_NAME,
          confirmLabel: '🦴 Grind!',
          cancelLabel: 'Leave in discard',
          cancellable: true,
        });
        if (!confirmed) continue;

        const finalIdx = ps.discardPile.lastIndexOf(cardName);
        if (finalIdx < 0) continue;

        ps.discardPile.splice(finalIdx, 1);
        if (!ps.deletedPile) ps.deletedPile = [];
        ps.deletedPile.push(cardName);
        engine._broadcastEvent('play_pile_transfer', {
          owner: myController, cardName, from: 'discard', to: 'deleted',
        });

        inst.counters._bonegrinderDrawsCount = (inst.counters._bonegrinderDrawsCount || 0) + 1;
        await engine.actionDrawCards(myController, 1, { source: CARD_NAME });
        engine.log('bonegrinder_draw', {
          player: ps.username,
          deletedSkeleton: cardName,
          usedThisTurn: inst.counters._bonegrinderDrawsCount,
        });
        engine.sync();
      }
    },

    /** Reset per-turn counters at start of own turn. */
    onTurnStart: (ctx) => {
      const inst = ctx.card;
      if (inst.counters?._bonegrinderDrawsCount) {
        inst.counters._bonegrinderDrawsCount = 0;
        inst.counters._bonegrinderDrawsTurn = ctx._engine.gs.turn || 0;
      }
    },
  },
};
