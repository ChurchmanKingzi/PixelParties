// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Bananas"
//  Artifact (Normal, 4 Gold) — "Gain 4 Gold three times."
//
//  DREI getrennte Gewinn-Ereignisse, nicht einmal 12. Genau darin liegt
//  der Sinn der Karte: der ganze Monkee-Archetyp haengt an „when you gain
//  4 or more Gold through an effect", und jedes der drei Ereignisse ist
//  ein eigenes Auslöse-Fenster. `actionGainGold` feuert je Aufruf
//  `ON_RESOURCE_GAIN` (plus das Gold-Trap-Surprise-Fenster), also einmal
//  je Bananenportion.
//
//  Zwischen den Portionen eine kurze Pause: die Auslöser der Monkees
//  oeffnen Abfragen, und ohne Takt liefen Animation und Prompts
//  uebereinander. Vorbild fuer Aufbau und CPU-Hinweise ist
//  `treasure-chest.js`.
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

const CARD_NAME = 'Golden Bananas';
const PORTION = 4;
const PORTIONEN = 3;

module.exports = {
  hooks: {},

  // Der Gewinn (3× 4 Gold) IST die ganze Karte — ohne ihn bleibt nichts.
  canActivate(gs, pi, engine) {
    return !goldGainWouldBeBlocked(engine, pi);
  },

  // CPU-Hinweis wie bei Treasure Chest: der Wert der Karte IST das Gold.
  // Ohne `handValueAsGoldGain` bewertet `estimateHandCardValueFor` sie als
  // generische Handkarte, und das Apply-vs-Skip-Gate sieht einen negativen
  // Delta. `evaluateThroughTurnEnd` laesst die Recon den Rest des Zuges
  // spielen — erst dort wird das Gold tatsaechlich AUSGEGEBEN und der
  // Gewinn sichtbar.
  cpuMeta: {
    handValueAsGoldGain: PORTION * PORTIONEN,
    evaluateThroughTurnEnd: true,
    activationGateThreshold: 0,
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    for (let i = 0; i < PORTIONEN; i++) {
      engine._broadcastEvent('play_gold_coins', { owner: pi });
      await engine._delay(300);
      await engine.actionGainGold(pi, PORTION);
      // Takt zwischen den Portionen — nicht nach der letzten.
      if (i < PORTIONEN - 1) await engine._delay(350);
    }
    engine.log('golden_bananas', {
      player: ps?.username, goldGained: PORTION * PORTIONEN, portions: PORTIONEN,
    });
    return true;
  },
};
