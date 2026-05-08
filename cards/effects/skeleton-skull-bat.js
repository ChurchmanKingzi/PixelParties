// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Skull Bat"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn make your opponent discard 1 card of their
//  choice from their hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Skull Bat';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    const oppPs = ctx._engine.gs.players[oi];
    return (oppPs?.hand || []).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    await engine.actionPromptForceDiscard(oi, 1, {
      title: CARD_NAME,
      description: 'Discard 1 card from your hand.',
      source: CARD_NAME,
    });
    engine.log('skeleton_skull_bat', {
      player: engine.gs.players[ctx.cardOwner]?.username,
    });
    return true;
  },
};
