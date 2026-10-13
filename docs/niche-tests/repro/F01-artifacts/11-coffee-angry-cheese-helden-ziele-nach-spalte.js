'use strict';
// F01-artifacts-11 · Coffee / Angry Cheese: „a Hero you control" wird nach Brettspalte statt nach Kontrolle gesammelt (geliehene/übernommene Helden)
// Kartentext: Coffee „…negative status effects … from a Hero you control"; Angry Cheese „Choose a Hero you control and deal 100 damage to it".
// Aufbau: Sitz 1 hat Sitz 0 den Helden 1 geliehen (Charme: `actionStealHero(1, 0, 1)`), Sitz 0 hat den Helden 0 von Sitz 1 dauerhaft übernommen (`actionTakeHeroPermanently(0, 1, 0)`).
//   Alle Helden tragen einen alten Status (burned, appliedTurn 3); Sitz 0 spielt Coffee bzw. Angry Cheese (Deck mit Zerstörungszauber).
// Erwartung (CARD_API.md Z. ~6065: „Wer nach Seiten rechnet, fragt nie die Spalte, sondern `heroSideOf` / `heroesControlledBy`"; Cloud Pillow und Beer halten sich daran): angeboten werden die
//   von Sitz 0 KONTROLLIERTEN Helden 0/0, 0/2 und 1/0 – nicht der entliehene Held 0/1.
// Beobachtet: Coffee bietet 0/0, 0/1, 0/2 (der entliehene Held ja, der übernommene 1/0 nein); Angry Cheese ebenso (0/0, 0/1, 0/2).
// Ursache: `coffee.js` Z. 44–45 und `angry-cheese.js` Z. 37 / 51–52 laufen über `gs.players[pi].heroes`; Gegenbeispiel `beer.js` / `cloud-pillow.js` (`heroesControlledBy`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const card of ['Coffee', 'Angry Cheese']) {
    const t = await H.fresh({ hand: [[card], []], deck: [['Fireball', 'Flame Avalanche', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
    t.engine.actionStealHero(1, 0, 1, {});
    await t.engine.actionTakeHeroPermanently(0, 1, 0, {});
    for (const [s, h] of [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]) t.hero(s, h).statuses.burned = { appliedTurn: 3 };
    let seen = null;
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'hero').map(v => v.owner + '/' + v.heroIdx).sort(); return null; };
    t.policy.cancelTargets = true;
    await t.play(0, card, { hero: 0 });
    const soll = ['0/0', '0/2', '1/0'];
    R.check(card + ': angeboten werden genau die kontrollierten Helden ' + soll.join(', '), JSON.stringify(seen) === JSON.stringify(soll), seen);
    R.check(card + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
