'use strict';
// A04-cute-18 · Cute Familiar: die Rückkehr am Zugende klappt nicht, wenn Wildur die Leiche auf den Coolness Stack gelegt hat
//
// Kartentext (Cute Familiar): "When this Creature is defeated, place it into the free Support Zone of a Hero you control with at least
//   Charme 2 at the end of the turn, if possible."
// Erwartung: Der Familiar kehrt am Zugende zurück (Gegenprobe ohne Wildur ✓). "Place it" nennt keine Ablage als Voraussetzung.
// Beobachtet: Wildur (erste Ablage-Karte des Zuges → Coolness Stack) nimmt die Leiche; die Rückkehr sucht sie in der Ablage
//   (`ablageEntnahme`), findet nichts und tut nichts. Der Familiar bleibt auf dem Stack liegen.
// Ursache: cards/effects/cute-familiar.js onTurnEnd (Z. ~330) nimmt die Leiche per `engine.ablageEntnahme(pi, pi, CARD_NAME)` aus der Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FA = 'Cute Familiar';
  for (const mitWildur of [false, true]) {
    const t = await H.fresh({ deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
    t.setAbilities(0, 1, [['Charme', 'Charme'], [], []]);
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; ps.coolnessStack.push('Cute Bunny'); t.engine._trackCard('Cute Bunny', 0, 'coolnessStack');
    if (mitWildur) { const w = t.put(0, 2, 0, 'Wildur, the Shining Coolness'); w.turnPlayed = 0; }
    const fam = t.put(0, 0, 0, FA);
    await t.turnStart(0);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, fam, 999, 'creature', { sourceOwner: 1 }));
    await t.endTurn();
    R.check((mitWildur ? 'MIT Wildur' : 'Gegenprobe ohne Wildur') + ': Familiar ist am Zugende wieder auf dem Brett', !!t.find(FA, 'support'), { stack: ps.coolnessStack.slice(), ablage: ps.discardPile.slice() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
