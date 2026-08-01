// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Time"
//  Spell (Magic Arts Lv2, Reaction)
//
//  Once per game (shared "Divine Gift" key).
//  Triggers from hand when 1+ cards are sent to
//  the controller's discard pile from anywhere.
//  Adds those cards to hand instead.
//
//  Triggering paths covered:
//    • Mill (deck → discard) — `onMill` hook,
//      delivered as a batch from `actionMillCards`
//      so multi-card mills coalesce naturally.
//    • Discard (hand → discard) — `onDiscard`
//      hook, fired per-card by
//      `actionDiscardHandCard` and
//      `actionDiscardCards`. Multi-card forced
//      discards funnel through the same `setTimeout
//      (0)` queue and resolve as one batch.
//    • Creature death (board → discard) —
//      `onCreatureDeath` hook fires per dead
//      creature; same queue.
//
//  Single-prompt-per-batch:
//  -------------------------
//  Multiple per-card hook fires from the same
//  engine action are queued and resolved together
//  via the next `setTimeout(0)` tick. The player
//  sees ONE confirmation listing all rescuable
//  cards; on confirm, the entire batch is spliced
//  out of discard and pushed to hand.
//
//  Time has no proactive hand-play path —
//  `spellPlayCondition` refuses normal hand plays
//  so the player never spends an Action playing it
//  from hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Divine Gift of Time';

/**
 * Push card names into the player's pending rescue queue and schedule
 * a single async resolver. Subsequent calls within the same task add
 * to the same queue, so an entire engine operation that funnels
 * multiple cards into the discard pile (mill batch, multi-discard,
 * mass kill) gets one consolidated prompt at task end.
 */
function queueTimeRescue(engine, ps, pi, names) {
  if (!ps) return;
  if (ps._oncePerGameUsed?.has('divineGift')) return;
  // Time must still be in hand to spend.
  if ((ps.hand || []).indexOf(CARD_NAME) < 0) return;
  // Defensive — bail if there are no rescuable names.
  const cleaned = (names || []).filter(n => n && n !== CARD_NAME);
  if (cleaned.length === 0) return;

  if (!ps._timeRescueQueue) ps._timeRescueQueue = [];
  for (const n of cleaned) ps._timeRescueQueue.push(n);

  if (ps._timeRescueScheduled) return;
  // Don't queue from inside MCTS rollouts — the macrotask fires AFTER
  // snapshot/restore on the live state, and the live state has its
  // own discard events that will queue their own setTimeout. See
  // CARD_API.md "Deferred side-effects".
  if (engine._fastMode) return;
  ps._timeRescueScheduled = true;
  // setTimeout(0) defers past the remainder of the current engine
  // task — the discard-loop / mill batch / death cleanup completes
  // first, then the queued names are processed as one batch.
  setTimeout(async () => {
    const batch = ps._timeRescueQueue || [];
    ps._timeRescueQueue = [];
    ps._timeRescueScheduled = false;
    if (batch.length === 0) return;
    try {
      await tryTimeRescue(engine, pi, ps, batch);
    } catch (err) {
      engine.log('divine_gift_time_error', { err: err?.message });
    }
  }, 0);
}

async function tryTimeRescue(engine, pi, ps, names) {
  // Re-validate each guard before the prompt — board could have
  // shifted since the events that filled the queue.
  if (ps._oncePerGameUsed?.has('divineGift')) return;
  if ((ps.hand || []).indexOf(CARD_NAME) < 0) return;

  // Only names actually still in discard are rescuable. A name might
  // have landed in discard and then been moved out again by another
  // effect (e.g. Spontaneous Reappearance) before the prompt opens.
  const inDiscard = [];
  for (const name of names) {
    if (ps.discardPile.includes(name)) inDiscard.push(name);
  }
  if (inDiscard.length === 0) return;

  // Build a clean message naming every rescuable card. Multi-card
  // batches list them; a single card uses the original wording.
  const message = inDiscard.length === 1
    ? `${inDiscard[0]} was sent to your discard pile! Use Divine Gift of Time to add it to your hand instead?`
    : `${inDiscard.length} cards (${inDiscard.join(', ')}) were sent to your discard pile! Use Divine Gift of Time to add them all to your hand instead?`;

  const confirmed = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message,
    confirmLabel: '⏳ Rewind!',
    cancelLabel: 'No',
    cancellable: true,
  });
  if (!confirmed || confirmed.cancelled) return;

  // Re-validate post-prompt.
  if (ps._oncePerGameUsed?.has('divineGift')) return;
  const timeHandIdx = (ps.hand || []).indexOf(CARD_NAME);
  if (timeHandIdx < 0) return;

  // Mark Divine Gift used now to block re-entry.
  if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
  ps._oncePerGameUsed.add('divineGift');

  // Screen-wide clock-rewinding burst — fires once per activation,
  // regardless of batch size. Plays in parallel with the per-card
  // discard→hand flights below; the clock visual sits at the center
  // while the cards stream out from the discard pile.
  engine._broadcastEvent('divine_time_rewind');
  await engine._delay(300);

  // Per-card discard→hand flight. Broadcasting BEFORE the state
  // mutation lets the client capture both source (discard pile) and
  // target (hand) DOM rects synchronously — the overlay then animates
  // independently while we mutate. The hand-grew watcher's
  // suppression counter (`pileTransferToHandPendingMeRef` /
  // `Opp`Ref`) is bumped automatically by the `play_pile_transfer`
  // handler, so the auto-flight watcher won't double up the visual.
  const rescued = [];
  for (let i = 0; i < inDiscard.length; i++) {
    const name = inDiscard[i];
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: name,
      from: 'discard', to: 'hand',
      toHandIdx: (ps.hand || []).length + rescued.length,
    });
  }

  // Move each rescuable name from discard to hand. Use `lastIndexOf`
  // so we splice the most recently added copy (matches the natural
  // "the card that just landed" semantics for duplicates).
  for (const name of inDiscard) {
    const idx = ps.discardPile.lastIndexOf(name);
    if (idx < 0) continue;
    ps.discardPile.splice(idx, 1);
    ps.hand.push(name);
    // Re-anchor a tracked instance from 'discard' to 'hand'. If none
    // exists (e.g. raw push paths that don't call _trackCard), create
    // a fresh hand instance.
    const discardInst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'discard' && c.name === name
    );
    if (discardInst) discardInst.zone = 'hand';
    else engine._trackCard(name, pi, 'hand');
    rescued.push(name);
  }

  // Send Time itself to the discard pile (no hook fire — direct push,
  // matching the pattern used by other once-per-game spells that
  // self-discard outside the standard play flow).
  const ti = (ps.hand || []).indexOf(CARD_NAME);
  if (ti >= 0) {
    // Einsatz-Beleg für den Trainings-Recorder. Genau die Lücke, die
    // Cosmic Malfunction (v81), Demon's Gate (v86) und Quetzahuitl
    // (v87) hatten: die Karte spielt sich in ihrem EIGENEN Hook aus der
    // Hand — direktes splice + push, "außerhalb des Standard-Play-Flows"
    // wie der Kommentar oben sagt. Damit läuft sie an beiden Zählwegen
    // vorbei (kein afterSpellResolved, kein asPlay-Transfer), und
    // `divine_gift_time` steht nicht in ACT_EVENTS — die Karte stünde
    // also selbst bei echten Feuerungen mit 0 Einsätzen im Report.
    // `asPlay: 'sole'` ist das etablierte Signal dafür; `true` würde
    // Spells bewusst überspringen (Doppelzählung mit afterSpellResolved),
    // die es hier gerade NICHT gibt.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: CARD_NAME,
      from: 'hand', to: 'discard',
      fromHandIdx: ti, asPlay: 'sole',
    });
    ps.hand.splice(ti, 1);
    ps.discardPile.push(CARD_NAME);
    const timeInst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME
    );
    if (timeInst) timeInst.zone = 'discard';
  }

  engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
  engine.log('divine_gift_time', {
    player: ps.username,
    rescued,
    count: rescued.length,
  });
  engine.sync();
  // Hold long enough for the discard→hand flights (≈700ms) to land
  // before the engine resumes. The screen-wide clock keeps animating
  // for ~1s more on its own — no need to block the engine that long.
  await engine._delay(800);
}

module.exports = {
  // CPU: confirm this reaction's "rewind?" prompt — the default brain
  // declines cancellable confirms outside a card-cast (discard trigger), so
  // without this it never fires. Recovering discarded cards to hand is pure
  // upside. (Title must equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  oncePerGame: true,
  oncePerGameKey: 'divineGift',
  activeIn: ['hand'],

  // Time has no proactive hand-play path. The reactive hooks below
  // are the only way to activate it — keep it locked out of normal
  // Spell play UI.
  spellPlayCondition: () => false,

  hooks: {
    /**
     * Mill (deck → discard). `actionMillCards` fires this hook ONCE
     * per mill operation with the full `milledCards` array, so a
     * single multi-card mill produces one prompt naturally.
     */
    onMill: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const names = ctx.milledCards || [];
      if (names.length === 0) return;
      queueTimeRescue(ctx._engine, ctx.players[ctx.cardOwner], ctx.cardOwner, names);
    },

    /**
     * Discard (hand → discard). Fires per-card from
     * `actionDiscardHandCard` / `actionDiscardCards`. Multi-card
     * forced discards funnel through the queue's setTimeout(0) tick
     * so the player sees one consolidated prompt.
     */
    onDiscard: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const name = ctx.cardName || ctx.discardedCardName;
      if (!name) return;
      queueTimeRescue(ctx._engine, ctx.players[ctx.cardOwner], ctx.cardOwner, [name]);
    },

    /**
     * Creature death (board → discard). The corpse lands in the
     * ORIGINAL owner's discard pile, regardless of who controlled
     * the creature when it died. We rescue only when that landing
     * pile is Time's controller's pile.
     */
    onCreatureDeath: async (ctx) => {
      const c = ctx.creature;
      if (!c) return;
      const corpseOwner = c.originalOwner ?? c.owner;
      if (corpseOwner !== ctx.cardOwner) return;
      const name = c.name || c.cardName;
      if (!name) return;
      queueTimeRescue(ctx._engine, ctx.players[ctx.cardOwner], ctx.cardOwner, [name]);
    },
  },
};
