// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Cat"
//  Creature (Summoning Magic Lv 1, 20 HP — Cute archetype)
//
//  Two effects:
//
//  1. SELF-DISCARD ON SUMMON — when summoned,
//     Cute Cat is briefly visible on the board:
//     `card_reveal` streams its image to both
//     players, then ~1s later she destroys
//     herself into the discard pile. The visual
//     beat exists so the player can SEE that
//     she landed and removed herself.
//
//  2. MILL-ON-DISCARD — the FIRST time each turn
//     a "Cute Cat" hits its controller's discard
//     pile FROM ANYWHERE (own self-destruct,
//     death from damage, milled from deck,
//     forced discard from hand), send the top 3
//     cards of that controller's deck to their
//     discard pile.
//
//  IMPORTANT — for the SELF-DISCARD-ON-SUMMON
//  path, the controller's mill fires AFTER the
//  Cat lands in the discard pile (manual call
//  in onPlay, deferred past `onCreatureDeath`
//  which fires DURING `actionMoveCard` BEFORE
//  the discardPile push). A `gs._cuteCatSelfDiscardSkipOwner`
//  flag tells the on-death listener to stay
//  quiet for that owner during the destroy.
//  Cross-side Cute Cats observing the death
//  still mill normally during onCreatureDeath.
//
//  Per-controller per-turn gate stored on the
//  player state — `_cuteCatMillTurn` /
//  `_cuteCatMillUsed`. Flag isn't reset by
//  hand at end of turn; the turn-stamp check
//  rolls it forward implicitly.
//
//  All four "into discard" paths are routed
//  through `tryMillCuteCat` so adding a future
//  trigger source (e.g. exile-then-discard) is
//  one new hook listener away.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Cat';
const MILL_AMOUNT = 3;
const ON_BOARD_HOLD_MS = 1000;

function tryMarkUsed(engine, pi) {
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;
  const turn = engine.gs.turn || 0;
  if (ps._cuteCatMillTurn !== turn) {
    ps._cuteCatMillTurn = turn;
    ps._cuteCatMillUsed = false;
  }
  if (ps._cuteCatMillUsed) return false;
  ps._cuteCatMillUsed = true;
  return true;
}

async function tryMillCuteCat(engine, pi) {
  if (!tryMarkUsed(engine, pi)) return;
  await engine.actionMillCards(pi, MILL_AMOUNT, {
    source: CARD_NAME,
    selfInflicted: true,
  });
}

module.exports = {
  // Listen in support (self-destruct trigger) AND discard (the dead Cat
  // is still around to fire its on-death listener — which it does from
  // 'support' anyway — but a milled / forced-discarded Cat lives in
  // discard and needs to fire from there).
  activeIn: ['support', 'discard'],

  hooks: {
    // ── 1. Self-discard on summon ────────────────────────────────
    // Fires for our own summon only (`playedCard.id === ctx.card.id`).
    // Visual beat: stream the card image (`card_reveal` overlay), pause
    // ~1s while Cute Cat sits on the board, THEN destroy. The
    // controller's mill fires AFTER the destroy completes so the
    // ordering matches the spec: summon → reveal → on-board pause →
    // moves to discard → mill 3.
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;

      const engine = ctx._engine;
      const pi     = ctx.cardOwner;

      // Reveal the card to both players. `card_reveal` triggers the
      // CardRevealOverlay (same overlay used by attached-Hero reveals,
      // deck searches, etc.) so the player actually notices Cute Cat
      // landed before it bounces.
      engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
      engine.sync();
      await engine._delay(ON_BOARD_HOLD_MS);

      // Defer the OWN-side mill: onCreatureDeath fires during the
      // destroy, BEFORE the card lands in discardPile. Cross-side
      // Cute Cats still observe the death normally; only this Cat's
      // controller is gated.
      engine.gs._cuteCatSelfDiscardSkipOwner = pi;
      try {
        await ctx.destroyCard(inst);
      } finally {
        delete engine.gs._cuteCatSelfDiscardSkipOwner;
      }

      // Cat is now in the discard pile — fire the controller's mill.
      await tryMillCuteCat(engine, pi);
    },

    // ── 2a. Mill trigger: Cute Cat dies on the board ─────────────
    // "your deck" → the LISTENER's controller's deck. Each Cute Cat
    // independently observes the death event and fires its own once-
    // per-turn mill on its own deck.
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;
      // Skip the dying Cat's own controller during a self-discard-on-
      // summon — onPlay handles that mill manually AFTER the discard
      // push so the ordering is observable to the player.
      if (ctx._engine.gs._cuteCatSelfDiscardSkipOwner === ctx.cardOwner) return;
      await tryMillCuteCat(ctx._engine, ctx.cardOwner);
    },

    // ── 2b. Mill trigger: Cute Cat discarded from hand ───────────
    onDiscard: async (ctx) => {
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      await tryMillCuteCat(ctx._engine, ctx.cardOwner);
    },

    // ── 2c. Mill trigger: Cute Cat milled from deck ──────────────
    onMill: async (ctx) => {
      if (!Array.isArray(ctx.milledCards) || !ctx.milledCards.includes(CARD_NAME)) return;
      await tryMillCuteCat(ctx._engine, ctx.cardOwner);
    },
  },

  // CPU hint: a self-killing Cat is a deck-thinning engine. Make own
  // copies very attractive sacrifice fodder, opp copies neutral (they
  // mill themselves, which actually helps us — don't waste an Attack).
  cpuMeta: {
    onDeathBenefit: 18,
  },
};
