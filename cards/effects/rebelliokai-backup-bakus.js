// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Backup Bakus"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai
//
//  Self-deletes when sent to discard from
//  outside hand or board (engine redirect via
//  selfDeleteOnExternalDiscard).
//
//  Trigger: while sitting in the discard pile,
//  any time the controller discards a Rebelliokai
//  Creature OTHER than Backup Bakus, may recur
//  this card from discard → hand AND draw 1.
//
//  Per-turn lock: only ONE Backup Bakus can
//  return per turn (player-shared HOPT). Other
//  copies in the discard sit dormant until next
//  turn.
//
//  Wiring:
//    • Listens broadly across `hand`, `support`,
//      `discard`, `deleted`, `deck`. Some discard
//      paths in the engine don't synchronise
//      `inst.zone` when a card lands in
//      discardPile (Magenta's manual hand-splice
//      doesn't update it; mill of a card without
//      an `onMill` hook doesn't track an instance
//      at all). Listening from any zone + a
//      state-based discard-presence check makes
//      the trigger fire reliably regardless of
//      where the engine has Bakus's instance
//      tracked.
//    • Multi-copy dedup via a hookCtx flag — only
//      one Bakus listener prompts per discard
//      event, even if the controller has more
//      than one tracked Bakus instance.
// ═══════════════════════════════════════════

const {
  isRebelliokaiCreature,
} = require('./_rebelliokai-shared');

const CARD_NAME = 'Rebelliokai Backup Bakus';
const HOPT_KEY  = 'rebelliokai-backup-bakus-recur';

module.exports = {
  selfDeleteOnExternalDiscard: true,
  // Broad activeIn: see header comment. The state-based discardPile
  // check below is the real "am I in the discard pile?" gate, so the
  // listener fires regardless of how the engine has the inst zoned.
  activeIn: ['hand', 'support', 'discard', 'deleted', 'deck'],
  // Bypass the runHooks dead-hero filter so the onCreatureDeath
  // re-track below still fires even when the AoE that killed Bakus
  // also killed Bakus's hosting hero. Without this, mass-damage
  // events that wipe a hero AND its creature board would silently
  // drop every dying Bakus's listener and leave the discard-pile
  // copies completely silent for the rest of the game.
  bypassDeadHeroFilter: true,

  cpuMeta: {
    // Backup Bakus is a graveyard recursion engine — it dies cheap and
    // wants to die. Owner gets a card-tutor + draw on every Rebelliokai
    // hand discard. ≈+18 score per cycle (one card recovered + one
    // card drawn ≈ 9 each at the conservative end). Capped at one
    // cycle per turn so the on-death benefit is the per-turn upside,
    // not a stacking value.
    onDeathBenefit: 18,
  },

  hooks: {
    // ── Combat-death re-track ──
    // The damage-batch death path untracks the dying creature's
    // instance (`actionApplyDamageBatch` ~L15976). After that, Bakus
    // has no listener at all — the discardPile contains the cardName
    // but the engine has no instance to dispatch onDiscard to. Re-
    // track a fresh discard-zone instance here so Bakus can recur
    // when subsequent Rebelliokai Creatures are discarded.
    //
    // Matches Cute Familiar's onCreatureDeath re-track pattern. We
    // self-detect via instId so this only fires for THIS Bakus death
    // event. Skips when the death source is a self-sacrifice or
    // non-damage destroy (those paths preserve the original inst with
    // zone='discard' through actionMoveCard, so re-tracking would
    // double up).
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;
      if (death.instId !== ctx.card.id) return;
      const engine = ctx._engine;
      const ownerPs = engine.gs.players[death.originalOwner ?? death.owner];
      if (!ownerPs) return;
      // Only re-track if Bakus actually landed in the discard pile.
      // Mill / external-source discards route to deletedPile via the
      // selfDeleteOnExternalDiscard redirect — no listener needed
      // there (the recur trigger is "from your discard pile").
      if ((ownerPs.discardPile || []).indexOf(CARD_NAME) < 0) return;
      // Always re-track for THIS dying instance, even when other
      // Bakus instances exist elsewhere (hand, deck, another discard
      // entry). Each Bakus card in the discard pile needs its own
      // listener so it can independently respond when that specific
      // copy is the one the player wants to recur. The previous
      // "stillTracked → bail" guard caused dying-Bakus listeners to
      // disappear whenever any other Bakus was still on the roster,
      // leaving the discard-pile copies silent.
      //
      // The actionMoveCard death path leaves the dying inst tracked
      // with zone='discard' AFTER our hook returns; in that case we
      // accept a brief double-track. The dedup flag on the onDiscard
      // ctx ensures only one prompt fires per discard event, and the
      // state-based discardPile check makes redundant trackers
      // harmless.
      engine._trackCard(CARD_NAME, death.originalOwner ?? death.owner, 'discard');
    },

    onDiscard: async (ctx) => {
      // Only react to a discard owned by Bakus's controller.
      if (ctx.playerIdx !== ctx.cardOwner) return;

      // Trigger source must be a Rebelliokai Creature.
      // NB: `ctx.cardName` is rebound by `_createContext` to the
      // LISTENER's name (Bakus), so we must use `ctx.discardedCardName`
      // exclusively — falling back to `ctx.cardName` would always
      // hit the carve-out and silently bail.
      const discardedName = ctx.discardedCardName;
      if (!discardedName) return;
      const engine = ctx._engine;
      if (!isRebelliokaiCreature(discardedName, engine)) return;
      // ... but NOT another Backup Bakus (rule's explicit carve-out).
      if (discardedName === CARD_NAME) return;

      // Multi-copy dedup. The first listener to reach this point sets
      // the flag; subsequent listeners in the same `runHooks` dispatch
      // (e.g. when the player has more than one Bakus tracked) bail.
      if (ctx._bakusRecurPromptFired) return;

      // State-based discard-pile presence check. This is the real
      // "am I in the discard pile?" gate — works whether the inst is
      // tracked at zone='discard' (canonical), zone='hand' (Magenta-
      // style manual splice), or no inst exists at all (we listen
      // from another zone's tracker — own copy in deck / hand / etc.).
      const ps = engine.gs.players[ctx.cardOwner];
      if (!ps) return;
      if ((ps.discardPile || []).indexOf(CARD_NAME) < 0) return;

      // Per-turn shared lock across all Bakus copies in this player's
      // discard. Note we PEEK at the lock first (without claiming) —
      // the trigger is "you may", so the player gets to decline
      // without burning the slot. We claim it only after they confirm.
      const hoptKey = `${HOPT_KEY}:${ctx.cardOwner}`;
      if (engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn) return;

      // Hand-lock gate: if the controller can't add cards to hand
      // right now (Vacation, Wisdom block, etc.), don't even prompt
      // — the recur half would silently fizzle and we'd waste the
      // player's "do you want to?" dialog.
      if (ps.handLocked) return;

      // Claim the dedup slot before awaiting the prompt. `ctx.setFlag`
      // mutates the shared `hookCtx` (NOT just this listener's ctx
      // copy), so subsequent listeners in the same `runHooks` dispatch
      // — whose ctx objects are freshly built via `...hookCtx` — see
      // the flag in their initial spread and bail at the early return
      // above.
      ctx.setFlag('_bakusRecurPromptFired', true);

      const confirmed = await engine.promptGeneric(ctx.cardOwner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${discardedName} was just discarded! Return ${CARD_NAME} from your discard pile to your hand and draw 1 card?`,
        confirmLabel: '🪆 Recur!',
        cancelLabel:  'No',
        cancellable:  true,
        gerrymanderEligible: true,
      });
      if (!confirmed) return;

      // Claim the per-turn lock now that the player has committed.
      if (!engine.claimHOPT(HOPT_KEY, ctx.cardOwner)) return;

      // Discard pile may have shifted during the prompt. Re-locate.
      if ((ps.discardPile || []).indexOf(CARD_NAME) < 0) return;

      // Stream Bakus's image to both players via the standard
      // `card_reveal` overlay. Activating from the discard pile is a
      // played-card moment as far as visibility goes — the opponent
      // gets the same big card-flash they'd see when an Artifact or
      // Spell is played from hand, so the recur reads as a deliberate
      // play instead of a silent splice. Fired BEFORE the pile-
      // transfer flight + state mutations so the reveal overlay
      // dismisses just as Bakus visibly takes off from the discard
      // pile.
      engine._broadcastEvent('card_reveal', {
        cardName:  CARD_NAME,
        playerIdx: ctx.cardOwner,
      });
      await engine._delay(800);

      // Untrack ONLY the listener that fired this prompt — leaving
      // every other Bakus tracker alone. Crucially, the OTHER copies
      // of Bakus in the discard pile (the ones not being recurred
      // right now) need to keep their listeners so future Rebelliokai
      // discards still trigger their own recur prompts. The previous
      // "untrack ALL" cleanup silenced those siblings and made the
      // listener appear broken whenever there were multiple Bakus
      // copies in discard.
      //
      // Stale trackers — e.g. an inst at zone='hand' from Magenta's
      // manual splice — also stay. The state-based discardPile check
      // at the top of this hook makes them harmless: they fire, see
      // no Bakus in discard, and bail.
      if (ctx.card?.id != null) engine._untrackCard(ctx.card.id);

      // Explicit pile-transfer animation for Bakus's discard → hand
      // leg. Without this, the client's hand-grew auto-detector would
      // see BOTH the recur (discard -1, hand +1) AND the draw below
      // (deck -1, hand +1) in one combined sync window — its branch
      // chain takes the deck path first and ends up animating BOTH
      // new hand cards as flying from the deck. Broadcasting
      // `play_pile_transfer` with `to: 'hand'` pre-registers the
      // upcoming hand arrival on `pileTransferToHandPendingMeRef`,
      // so the auto-detector consumes one slot and skips its phantom
      // for THIS card — the explicit transfer handles Bakus's flight
      // from the discard pile, and the draw below gets a clean
      // deck-flight animation of its own.
      engine._broadcastEvent('play_pile_transfer', {
        owner:     ctx.cardOwner,
        cardName:  CARD_NAME,
        from:      'discard',
        to:        'hand',
        toHandIdx: (ps.hand || []).length, // landing slot — end of hand
      });

      const handInst = await engine.addCardFromDiscardToHand(
        ctx.cardOwner, CARD_NAME, ctx.cardOwner,
        { source: CARD_NAME },
      );
      if (!handInst) return;

      // Draw 1 — standard draw flow fires onDraw + Nomu doubler etc.
      // The hand-grew auto-detector now sees only this single deck →
      // hand transition (the discard → hand step was handled by the
      // pile-transfer above), so the drawn card animates from the
      // deck as expected.
      await engine.actionDrawCards(ctx.cardOwner, 1, { source: CARD_NAME });

      engine.log('rebelliokai_backup_bakus_recur', {
        player:    ps.username,
        triggered: discardedName,
      });
      engine.sync();
    },
  },
};
