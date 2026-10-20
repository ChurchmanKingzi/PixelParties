'use strict';
// N3-18 · Elusive Hind: bricht der Kontrolleur nach dem ERSTEN der zwei Abwürfe ab, ist die Karte weg, die Negation aber nicht eingetreten (Teilzahlung)
// Kartentext: „When this Creature would be affected by a card or effect, its controller may discard 2 cards to negate any effects that card or effect would have on it (including damage)."
// Konvention: Kosten werden ganz oder gar nicht gezahlt (W4b/„Kosten vor dem Fenster", Abbruch VOR der Zahlung kostet nichts; danach nicht mehr abbrechbar). Die Hausregel v718 macht den Abbruch der Abwurf-Auswahl zum „Nein" –
//   gedacht für die erste Wahl. `bezahlen()` (`elusive-hind.js` Z. 53-62) ruft `actionPromptForceDiscard(ctrl, 2, { cancellable: true })`: der Abbruch gilt für JEDEN der zwei Abwürfe.
// Aufbau: Sitz 0 spielt die Hind (liegt bei Sitz 1); Sitz 1 hat 3 Handkarten. Sitz 0 aktiviert Field Cannon auf die Hind. Sitz 1 wirft die erste Karte ab und bricht beim zweiten Abwurf ab.
// Erwartet: entweder ist der Abbruch nach der ersten Karte nicht mehr möglich (Pflicht zu Ende bringen) oder die erste Karte bleibt auf der Hand (Rückabwicklung).
// Beobachtet: 1 Handkarte ist abgeworfen, die Hind nicht negiert (stirbt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(abbruchNachErster) {
    const t = await H.fresh({ hand: [['Elusive Hind'], ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    await t.play(0, 'Elusive Hind', { hero: 0 });
    const hind = t.find('Elusive Hind', 'support'); hind.turnPlayed = 1;
    let n = 0;
    t.script.push({
      match: d => d.type === 'forceDiscard' && d.title === 'Elusive Hind',
      answer: (d) => { n++; if (n === 1 || !abbruchNachErster) { const idx = (d.eligibleIndices && d.eligibleIndices[0]) ?? 0; return { handIndex: idx, cardName: t.pile(1, 'hand')[idx] }; } return null; },
    });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.cardName === 'Elusive Hind').id];
    t.put(0, 1, 0, 'Field Cannon').turnPlayed = 1;
    t.gs.activePlayer = 0; t.phase(2); t.resetActions(0); t.reset();
    const h0 = t.pile(1, 'hand').length;
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 0 }));
    return { handVerlust: h0 - t.pile(1, 'hand').length, hindLebt: !!t.find('Elusive Hind', 'support'), errors: t.errors };
  }
  const voll = await lauf(false);
  R.check('Gegenprobe: beide Karten abgeworfen → Hind negiert den Schaden und lebt', voll.handVerlust === 2 && voll.hindLebt, voll);
  const teil = await lauf(true);
  R.check('Abbruch nach der ersten Karte: nie „Karte weg, Wirkung nicht eingetreten"', !(teil.handVerlust === 1 && !teil.hindLebt), teil);
  R.check('keine Engine-Fehler', voll.errors.length + teil.errors.length === 0);
  R.finish();
})();
