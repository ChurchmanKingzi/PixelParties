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
  /**
   * CPU (W82b, Al 27.10.2026 — ersetzt die Schwelle von W80a): wie Hole in the Sky. Gespielt wird genau dann, wenn Σ Wert der gegnerischen Kreaturen, die durch die 999 Schaden WIRKLICH sterben und
   * NICHT geschuetzt sind, > Σ Wert der verbrauchten Ressourcen (diese Karte, 20 Gold nach Rabatten, die Hauptaktion) + Σ Wert der eigenen Kreaturen, die sterben und nicht geschuetzt sind
   * (`_kreaturen-bilanz.js` `flaechenEntscheidung`). Schadensart 'other': Dark Ocean schuetzt alle Kreaturen vor der Bombe.
   */
  cpuPlayVeto(engine, pi, heroIdx, opts) {
    try {
      const KB = require('./_kreaturen-bilanz');
      const r = KB.flaechenEntscheidung(engine, pi, {
        kartenName: 'MOE Bomb', quelle: { name: 'MOE Bomb', owner: pi, controller: pi, heroIdx: -1 },
        additional: KB.alsZusatzaktion(engine, module.exports, pi, heroIdx, opts),
        art: 'damage', amount: 999, damageType: 'other',
      });
      return !r.spielen;
    } catch {
      return false;   // die Heuristik darf nie einen legalen Play verhindern
    }
  },
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
