'use strict';
// A04-cute-25 (B) · Wildur: die umgeleitete Karte lässt eine "Waise" (Instanz in Zone "discard" ohne Eintrag in der Ablage) zurück
//
// Kartentext (Wildur): "The first card that would be sent to your discard pile every turn while you control this Creature is placed on top of your Coolness Stack instead."
// Erwartung: die Karte hat danach genau EINE Instanz, und zwar im Coolness Stack (Zone ↔ Instanz konsistent).
// Beobachtet: bei Handabwurf (ZZ Filler, Fireball, Cute Cat, Cute Bunny) entsteht neben der Stack-Instanz eine zweite Instanz mit zone 'discard', obwohl die Ablage die Karte nicht enthält.
//   `t.audit()` meldet das nicht. Betroffen sind Suchen über `cardInstances` nach `zone === 'discard'` + Name (`_engine.js` 7611/7662/19207/37001).
// Ursache: wildur-the-shining-coolness.js `pile.push`-Override legt `_trackCard(first, pi, 'coolnessStack')` NEU an, die Quell-Instanz (hand→discard) wird nicht ausgebucht.
//   (Bei Kreaturentod untrackt die Engine die Leiche selbst – dort entsteht keine Waise.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Wildur, the Shining Coolness';
  for (const nm of [H.INERT.filler, 'Fireball']) {
    const t = await H.fresh({ hand: [[nm, nm], []], deck: [Array(8).fill(H.INERT.creature), []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; ps.coolnessStack.push('Cute Phoenix'); t.engine._trackCard('Cute Phoenix', 0, 'coolnessStack');
    const w = t.put(0, 0, 0, WI); w.turnPlayed = 0;
    await t.turnStart(0);
    await t.run(() => t.engine.actionDiscardHandCard(0, nm, 0, { source: 'Test', selfInflicted: true }));
    R.check(nm + ': Karte liegt auf dem Coolness Stack (Umleitung)', ps.coolnessStack[ps.coolnessStack.length - 1] === nm, ps.coolnessStack);
    const waisen = t.inst(c => c.name === nm && c.zone === 'discard').length - t.pile(0, 'discardPile').filter(x => x === nm).length;
    R.check(nm + ': keine Instanz in Zone "discard" ohne Ablage-Eintrag', waisen <= 0, { waisen, zonen: t.inst(c => c.name === nm).map(c => c.zone) });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
