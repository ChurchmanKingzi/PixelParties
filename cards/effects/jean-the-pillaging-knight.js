// ═══════════════════════════════════════════
//  CARD EFFECT: "Jean, the Pillaging Knight"
//  Hero — 400 HP, 50 ATK — BANNED
//  Starting abilities: Pillage × 2
//
//  Whenever 1 or more cards are milled from the
//  opponent's deck to the discard pile (by any
//  effect EXCEPT Jean's own), the opponent must
//  also send 2 additional cards from their deck
//  to the discard pile.
//
//  Uses the onMill hook. Guards against infinite
//  loops with a _jeanTriggered flag on the mill
//  hookCtx so Jean's own 2-card mill does not
//  re-trigger Jean.
// ═══════════════════════════════════════════

const CARD_NAME = 'Jean, the Pillaging Knight';
const BONUS_MILL = 2;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onMill: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;

      // Must be the opponent's deck being milled
      if (ctx.playerIdx !== (pi === 0 ? 1 : 0)) return;

      // Prevent Jean's own bonus mill from re-triggering Jean
      if (ctx._jeanTriggered) return;

      // Jean must be alive and not incapacitated
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const oppIdx = ctx.playerIdx;
      const oppPs  = gs.players[oppIdx];
      if ((oppPs?.mainDeck || []).length === 0) return;

      // Stream Jean's hero card to both players before the bonus mill
      engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
      await engine._delay(400);

      // Mill 2 additional cards, flagged so this doesn't re-trigger Jean
      await engine.actionMillCards(oppIdx, BONUS_MILL, {
        source:        CARD_NAME,
        _jeanTriggered: true,
      });

      engine.log('jean_bonus_mill', {
        player:  gs.players[pi]?.username,
        hero:    hero.name,
        trigger: ctx.source || 'unknown',
        bonus:   BONUS_MILL,
      });
    },
  },
};
