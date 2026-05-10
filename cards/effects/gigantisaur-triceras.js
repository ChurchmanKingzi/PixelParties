// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Triceras"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//
//  ① UNIQUENESS — A Hero can only have 1
//    "Gigantisaur"-archetype Creature in its
//    Support Zones at a time. (Engine `canSummon`
//    gate scoped per-hero, not per-side.)
//
//  ② ACTIVE — Once per turn, discard 1 card to
//    draw 3 cards. Standard creature-effect HOPT
//    via the engine's `creatureEffect` machinery.
//
//  Notes:
//   • The discard cost is paid via
//     `actionPromptForceDiscard(pi, 1,
//     { selfInflicted: true })`, which lets the
//     player pick which card to pitch and skips
//     the first-turn protection (it's a chosen
//     cost, not damage).
//   • `canActivateCreatureEffect` gates on
//     hand-not-empty AND not hand-locked — a
//     locked hand can't draw, so the activation
//     would just burn a card for nothing.
// ═══════════════════════════════════════════

const { gigantisaursCanSummon } = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Triceras';

module.exports = {
  activeIn: ['support'],

  // Shared archetype gate — handles BOTH the per-Hero summon check
  // AND the card-wide grey-out signal that drives `getSummonBlocked`.
  // See `_gigantisaurs-shared.js` for the dispatch logic.
  canSummon: gigantisaursCanSummon,

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;          // locked hand can't draw — wasteful
    if ((ps.hand?.length || 0) < 1) return false; // need 1 card to pay the discard cost
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Pay the discard cost first so the drawn cards can't accidentally
    // be discarded by the same prompt (otherwise the player could
    // discard a freshly-drawn card and the cost loses its bite).
    const handBefore = ps.hand.length;
    await engine.actionPromptForceDiscard(pi, 1, {
      title: CARD_NAME,
      source: CARD_NAME,
      selfInflicted: true,
    });
    if (ps.hand.length >= handBefore) {
      // Discard didn't actually shrink the hand — fizzle without
      // drawing (defensive: the prompt should always succeed when
      // hand-len >= 1, but if a hook intercepted it, we don't want
      // a free draw).
      engine.log('triceras_fizzle', { player: ps.username });
      engine.sync();
      return false;
    }

    // Breathing room between the discard's final sync and the draw
    // loop. Without this, React on the client can batch the
    // post-discard state (hand shrinks by 1) with the post-iter-0
    // draw state (hand grows by 1) into a single render — net zero
    // delta — and the first drawn card's hand-fly-in animation is
    // skipped. Iters 1 and 2 already get separated by the
    // `actionDrawCards` 300ms inter-draw stagger, so only the first
    // draw needed a leading buffer here.
    await engine._delay(300);

    await engine.actionDrawCards(pi, 3);
    engine.log('triceras_draw', { player: ps.username, drew: 3 });
    engine.sync();
    return true;
  },
};
