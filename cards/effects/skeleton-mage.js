// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Mage"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn draw 2 cards and discard 1 card afterwards.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Mage';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  blockedByHandLock: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    // Hand-lock kills the draw side of this effect — gating here
    // keeps the activation UI honest. Empty deck is fine; engine's
    // actionDrawCards just no-ops on an empty deck.
    return !ps.handLocked;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
    // Discard 1 of caster's choice. Skip if the hand emptied (mill-out).
    const ps = engine.gs.players[pi];
    if ((ps.hand || []).length > 0) {
      await engine.actionPromptForceDiscard(pi, 1, {
        title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
      });
    }
    engine.log('skeleton_mage', { player: ps.username });
    return true;
  },
};
