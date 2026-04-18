// ═══════════════════════════════════════════
//  CARD EFFECT: "Teppes, the Deepsea Vampire"
//  Hero (400 HP, 40 ATK, Necromancy + Necromancy)
//
//  Up to 5 times per turn, when 1 or more cards
//  are added from your Heroes' Support Zones to
//  your hand, draw 1 card. Auto-fires with no
//  dialogue so bounce-heavy Deepsea turns stay
//  uninterrupted.
//
//  Listens to the custom hook
//  `onCardsReturnedToHand` (fired from
//  _deepsea-shared.returnSupportCreatureToHand
//  and Shu'Chaku's artifact bounce) and draws
//  once per event.
// ═══════════════════════════════════════════

const CARD_NAME = 'Teppes, the Deepsea Vampire';
const MAX_DRAWS_PER_TURN = 5;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardsReturnedToHand: async (ctx) => {
      if (ctx.ownerIdx !== ctx.cardOriginalOwner) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOriginalOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Up-to-5 per turn.
      const count = hero._teppesReturnDrawsThisTurn || 0;
      if (count >= MAX_DRAWS_PER_TURN) return;
      hero._teppesReturnDrawsThisTurn = count + 1;

      await engine.actionDrawCards(pi, 1);
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: -1,
      });
      engine.log('teppes_draw', {
        player: gs.players[pi]?.username,
        drawsThisTurn: hero._teppesReturnDrawsThisTurn,
      });
      engine.sync();
    },
  },
};
