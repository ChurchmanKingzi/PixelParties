// ═══════════════════════════════════════════
//  CARD EFFECT: "War Chest"
//  Artifact (Normal, 0 Gold)
//
//  EFFECT: "Gain 15 Gold for every \"War Counselor\"
//           Creature you control."
//
//  Zaehlt EXEMPLARE, nicht verschiedene Namen — bei
//  vier Ratgebern auf dem Feld also 60 Gold. Ohne
//  Ratgeber bringt die Karte nichts; sie loest
//  trotzdem auf (0 Gold), weil der Text keine
//  Bedingung stellt.
//
//  Aufbau nach Vorbild treasure-chest.js: `resolve`
//  plus Muenzanimation.
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

const { countWarCounselors } = require('./_war-counselor-shared');

const CARD_NAME = 'War Chest';
const GOLD_PER = 15;

module.exports = {
  hooks: {},

  // Der Gewinn (15 Gold je War Counselor) IST die ganze Karte — ohne ihn bleibt nichts.
  canActivate(gs, pi, engine) {
    return !goldGainWouldBeBlocked(engine, pi);
  },

  // CPU-Hinweis wie bei Treasure Chest: der ganze Wert der Karte ist das
  // Gold. Ohne diese Angabe bewertet der Bewerter sie als generische
  // 0-Gold-Karte und spielt sie nie. Der Betrag haengt am Board, deshalb
  // als Funktion — 15 je Ratgeber, wie der Text sagt.
  cpuMeta: {
    handValueAsGoldGain: (engine, pi) => GOLD_PER * countWarCounselors(engine, pi),
    evaluateThroughTurnEnd: true,
    activationGateThreshold: 0,
  },

  resolve: async (engine, pi) => {
    const counselors = countWarCounselors(engine, pi);
    const gold = GOLD_PER * counselors;

    engine._broadcastEvent('play_gold_coins', { owner: pi });
    await engine._delay(300);

    if (gold > 0) await engine.actionGainGold(pi, gold);

    engine.log('war_chest', {
      player: engine.gs.players[pi]?.username,
      counselors, goldGained: gold,
    });
    return true;
  },
};
