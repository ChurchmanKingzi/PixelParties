// ═══════════════════════════════════════════
//  HERO EFFECT: "Freshya, Beauty of Coolness"
//  Once per turn: place a card from your hand on
//  top of your Coolness Stack, then draw 3 cards.
//
//  Gated on having a Stack — without Wowhalla in
//  play there's nothing to push onto.
// ═══════════════════════════════════════════

// Als Ruling 16.8. ("Tuscan Artist"): ist der 2er-/3er-Zug der EINZIGE
// Nutzen dieser Karte, wird sie gesperrt statt wirkungslos zu feuern.
// Die Auslegung steht in `_draw-block-shared.js`.
const { drawWouldBeBlocked } = require('./_draw-block-shared');

const CARD_NAME = 'Freshya, Beauty of Coolness';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Ohne den 3er-Zug bliebe nur der Verlust einer Handkarte an den
    // Coolness Stack — Als Ruling: dann nicht aktivierbar.
    if (drawWouldBeBlocked(engine, pi, 3)) return false;
    if (!engine.hasCoolnessStack(pi)) return false;
    const ps = engine.gs.players[pi];
    return Array.isArray(ps?.hand) && ps.hand.length > 0;
  },

  onHeroEffect: async (ctx) => {
    // No custom HOPT — engine stamps hero-effect HOPT after this
    // returns cleanly. Cancel paths return `false` to tell the engine
    // "not activated" → no HOPT, no opponent reveal.
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps?.hand?.length) return false;
    if (!engine.hasCoolnessStack(pi)) return false;

    // Direct in-hand picker (no gallery popup) — same UX as the
    // forced-discard prompt: the hand row stays visible and the player
    // clicks the card to place on the Stack.
    const handPick = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: 'Click a card in your hand to place on top of your Coolness Stack. You will then draw 3 cards.',
      confirmLabel: '🆒 Place on Stack',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!handPick || handPick.cancelled || !handPick.cardName) return false;
    const ok = await ctx.pushHandCardToCoolnessStack(pi, handPick.cardName, handPick.handIndex);
    if (!ok) return false;
    await ctx.drawCards(pi, 3);
  },
};
