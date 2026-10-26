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
  // ★ Als Ruling (Al 26.10., Flame Avalanche: „Wenn du andere Schadenskarten unspielbar machst, müssen das Vial und Rockfall auch sein!"): die Karte richtet NUR Schaden an Zielen an (alle Kreaturen beider Seiten) —
  // unter der Schadenssperre (`ps.damageLocked`) unspielbar (Karte bleibt auf der Hand, keine Aktion/Kosten; Sperr-Stutzen `engine._cardBlockedBySearchLock`).
  blockedByDamageLock: true,
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
