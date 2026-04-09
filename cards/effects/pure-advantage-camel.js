// ═══════════════════════════════════════════
//  CARD EFFECT: "Pure Advantage Camel"
//  Creature (Surprise) — Summoning Magic Lv0
//
//  Activate when the opponent draws 1+ cards
//  outside their Resource Phase.
//  On activation: draw a card, then summon
//  this Creature into a free Support Zone.
//
//  While in Support Zone: once per turn, if
//  the Hero's Surprise Zone is empty, may
//  move itself back face-down into that
//  Surprise Zone (re-set).
// ═══════════════════════════════════════════

module.exports = {
  isSurprise: true,
  surpriseDrawTrigger: true, // Engine checks this on opponent draws

  /**
   * Trigger condition: fires when the OPPONENT draws outside Resource Phase.
   * The engine calls this with (gs, ownerIdx, heroIdx, drawInfo, engine).
   * drawInfo: { drawingPlayer, count, phase }
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, drawInfo, engine) => {
    // Only trigger on opponent draws
    if (drawInfo.drawingPlayer === ownerIdx) return false;
    // Not during resource phase
    if (drawInfo.phase === 1) return false; // PHASES.RESOURCE = 1
    // Must have drawn at least 1 card
    if ((drawInfo.count || 0) < 1) return false;
    return true;
  },

  /**
   * On activation: draw a card for the owner (NOT an onSummon — this is
   * the surprise activation effect). The creature placement is handled
   * by the engine's _activateSurprise automatically for Creature surprises.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    // Draw a card for the surprise owner
    await engine.actionDrawCards(pi, 1);
    engine.sync();
    await engine._delay(125);

    return null;
  },

  // ── Support Zone creature effect: re-set into Surprise Zone ──
  activeIn: ['support'],
  creatureEffect: true,

  /**
   * Can activate if:
   * - Once per turn (HOPT handled by engine)
   * - The corresponding Hero's Surprise Zone is empty
   * - Hero is alive
   */
  canActivateCreatureEffect(ctx) {
    return ctx._engine.canSurpriseCreatureReset(ctx);
  },

  async onCreatureEffect(ctx) {
    return ctx._engine.surpriseCreatureReset(ctx);
  },
};
