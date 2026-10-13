'use strict';
// F01-artifacts-09 · Blood-Soaked Coin: dauerhaft (permanent) übernommene Ziele zählen nicht als „target you permanently control" (Frage an Al)
// Kartentext: „Choose a target you permanently control and deal up to 300 damage to it. …" – Dark Gear: „…take permanent control of it."
// Aufbau: (a) Sitz 0 spielt Dark Gear auf Albrecht (Sitz 1) → permanente Kontrolle; danach Blood-Soaked Coin.
//         (b) `actionTakeHeroPermanently(0, 1, 0)` – Held 0 von Sitz 1 (`permaControlBy` = 0); danach Blood-Soaked Coin.
// Beobachtet: (a) die per Dark Gear permanent übernommene Kreatur steht nicht in der Zielliste; (b) der dauerhaft übernommene Held ebenfalls nicht.
// Ursache: `blood-soaked-coin.js` Z. 51–75 / 108–131: „permanently control" wird als „Besitzer UND Kontrolleur" gelesen (`inst.originalOwner === pi`, Heldenschleife nur über `gs.players[pi].heroes`);
//   das Skript sagt es im Kommentar so (Z. 60–64), es widerspricht aber wörtlich dem „permanent control" von Dark Gear.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // (a)
    const t = await H.fresh({ hand: [['Blood-Soaked Coin', 'Dark Gear'], []], gold: [100, 100] });
    t.put(1, 0, 0, 'Albrecht, the Nerd');
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
    t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
    await t.play(0, 'Dark Gear', { hero: 0 });
    const inst = t.find('Albrecht, the Nerd', 'support');
    let seen = null;
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'equip').map(v => v.cardName); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, 'Blood-Soaked Coin', { hero: 0 });
    R.check('(a) per Dark Gear permanent übernommene Kreatur (owner ' + inst.owner + ', controller ' + inst.controller + ', originalOwner ' + inst.originalOwner + ') ist Coin-Ziel', (seen || []).includes('Albrecht, the Nerd'), seen);
  }
  {   // (b)
    const t = await H.fresh({ hand: [['Blood-Soaked Coin'], []], gold: [30, 100] });
    await t.engine.actionTakeHeroPermanently(0, 1, 0, {});
    let seen = null;
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'hero').map(v => v.owner + '/' + v.heroIdx); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, 'Blood-Soaked Coin', { hero: 0 });
    R.check('(b) dauerhaft übernommener Held (permaControlBy ' + t.hero(1, 0).permaControlBy + ') ist Coin-Ziel', (seen || []).includes('1/0'), seen);
  }
  R.finish();
})();
