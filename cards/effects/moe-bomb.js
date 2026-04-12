// ═══════════════════════════════════════════
//  CARD EFFECT: "MOE Bomb"
//  Artifact (Normal, 20 Gold) — Deal 999 damage
//  to ALL Creatures both players control.
//
//  Can be played even with no Creatures on board.
//  Uses actionAoeHit so post-target reactions
//  (Divine Gift of Rain, etc.) can fire.
//
//  Animation: giant pulsating ❤️ then cute
//  explosion with hearts, glitter, confetti.
// ═══════════════════════════════════════════

module.exports = {
  resolve: async (engine, pi) => {
    // ── Heart bomb animation ──
    engine._broadcastEvent('moe_bomb_animation', {});
    await engine._delay(3200);

    // ── Deal 999 damage to ALL creatures on both sides via AoE pipeline ──
    // Using actionAoeHit ensures post-target reactions (Divine Gift of Rain)
    // can intercept if the opponent controls creatures.
    const mockInst = { name: 'MOE Bomb', controller: pi, owner: pi, heroIdx: -1 };
    await engine.actionAoeHit(mockInst, {
      damage: 999,
      damageType: 'other',
      side: 'both',
      types: ['creature'],
      animationType: null,
      hitDelay: 0,
      animDelay: 0,
      _skipSurpriseCheck: false,
    });

    engine.sync();
    return true;
  },
};
