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
    // Als Ruling (Demo vs Cute Commando): die gemillten Karten fliegen
    // NACHEINANDER Deck → Bildschirmmitte (Flip, kurzer Hold) →
    // Discard — Chaos-Magic-Prozedere, nur schneller (Engine-Default
    // MILL_CENTER_REVEAL_MS statt 2000 ms). Vorher gingen alle
    // gleichzeitig direkt Deck → Discard.
    centerReveal: true,
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

      // SYNC FIRST so Cute Cat is visible in the support slot before
      // anything else fires. The engine-default `summon_effect` glow
      // was already broadcast by `doPlayCreature` (BEFORE our onPlay
      // ran) — if we open the `card_reveal` overlay first, the glow's
      // CSS animation has been running for a few frames on a still-
      // empty slot and the player perceives "reveal first, summon
      // animation last". Syncing first commits the slot's render
      // while the glow is still mid-animation, so the glow visibly
      // plays UNDERNEATH the reveal in parallel with the effect.
      engine.sync();
      // Brief beat for React to commit the slot render before the
      // overlay zooms up — without this the overlay can win the same
      // frame and obscure the visible-Cute-Cat moment.
      await engine._delay(80);
      engine._broadcastEvent('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
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
    // "your deck" = the deck of the player whose discard pile the
    // dying Cat lands in (= the corpse's `originalOwner`). Listeners
    // on either side observe the death, but they ALL target the
    // dying Cat's owner — multiple Cute Cat instances reading the
    // same event redirect onto the SAME player's deck, where the
    // per-turn HOPT (`_cuteCatMillUsed`) dedupes. This fixes the
    // cross-side leak where OPP's Cute Cat in OPP's discard milled
    // OPP's deck whenever MY Cute Cat died (each listener was
    // milling its OWN controller).
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;
      const millOwner = death.originalOwner ?? death.owner;
      if (millOwner == null) return;
      // Skip during the self-discard-on-summon path — onPlay handles
      // the mill manually AFTER the discard push so the ordering is
      // observable to the player. The flag tracks the dying Cat's
      // owner, so the compare is against `millOwner` (not the
      // listener's `cardOwner`).
      if (ctx._engine.gs._cuteCatSelfDiscardSkipOwner === millOwner) return;
      await tryMillCuteCat(ctx._engine, millOwner);
    },

    // ── 2b. Mill trigger: Cute Cat discarded from hand ───────────
    // `ctx.playerIdx` is the player whose HAND the Cat came from —
    // the discard lands in that player's pile, so the mill targets
    // that side. Cross-side listeners use the same event payload and
    // re-target onto the same player; HOPT dedupes.
    onDiscard: async (ctx) => {
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx == null) return;
      await tryMillCuteCat(ctx._engine, ctx.playerIdx);
    },

    // ── 2c. Mill trigger: Cute Cat milled from deck ──────────────
    // `ctx.playerIdx` is the player whose DECK was milled — that's
    // the deck the Cat landed in. Mill on the SAME side; cross-side
    // listeners re-target onto the milled side, HOPT dedupes.
    onMill: async (ctx) => {
      if (!Array.isArray(ctx.milledCards) || !ctx.milledCards.includes(CARD_NAME)) return;
      if (ctx.playerIdx == null) return;
      await tryMillCuteCat(ctx._engine, ctx.playerIdx);
    },
  },

  // CPU hint: a self-killing Cat is a deck-thinning engine. Make own
  // copies very attractive sacrifice fodder, opp copies neutral (they
  // mill themselves, which actually helps us — don't waste an Attack).
  // `preferDead: true` keeps the CPU from spending defensive resources
  // (heal, cleanse, buff) on Cute Cat — the on-summon self-discard is
  // the whole point of the card, so any "save it" play is wasted
  // tempo on a creature that wants to die. Heal / buff target pickers
  // honour the flag and skip such creatures.
  cpuMeta: {
    onDeathBenefit: 18,
    preferDead: true,
  },
};
