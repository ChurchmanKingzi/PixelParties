'use strict';
// A06-rebelliokai-01 · Sculpture Theft bietet auch FRÜHER gefrorene Kreaturen an
// Kartentext (Sculpture Theft, Spell/Reaction): „Play this card immediately when one or more Creatures are Frozen.
//   Choose one of those Creatures and add it to your hand."
// Erwartung: wählbar sind nur die Kreaturen, die durch DAS auslösende Ereignis gefroren wurden („those Creatures").
// Beobachtung: Theft sammelt in `resolve` ALLE gefrorenen Kreaturen auf dem Brett (sculpture-theft.js:86-100) –
//   auch eine, die schon vorher gefroren war und mit dem Ereignis nichts zu tun hat.
// Aufbau: Sitz 0 spielt The White Army (friert 1 Ziel für 1 Zug ein: die Beagle von Sitz 1);
//   Sitz 1 hält Sculpture Theft; auf Sitz 1 steht außerdem eine SCHON gefrorene Dummy-Kreatur.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [['The White Army'], ['Sculpture Theft']] });
  t.put(0, 0, 0, D); t.put(0, 0, 1, D);
  const old = t.put(1, 0, 0, D); t.put(1, 0, 1, 'Loyal Beagle');
  await t.run(() => t.engine.applyCreatureStatus(old, 'frozen', { duration: 3, sourceOwner: 1, source: 'repro' }));
  t.grantFor(1, 0, 'Sculpture Theft');
  t.targetFn = (valid) => { const hit = valid.find(v => v.cardName === 'Loyal Beagle'); return hit ? [hit.id] : [valid[0].id]; };
  const r = await t.play(0, 'The White Army', { hero: 0 });
  const theft = t.targets.find(x => x.config && x.config.title === 'Sculpture Theft');
  // W16c: Gibt es nur EIN gültiges Ziel, nimmt Theft es ohne Zielwahl (kein Picker) – dann zählt das Ergebnis: Beagle auf der Hand, alte Dummy bleibt.
  const hand = t.pile(1, 'hand'), altDa = t.gs.players[1].supportZones[0][0].length === 1;
  R.check('The White Army gespielt, Theft ausgelöst', r === true && (!!theft || hand.includes('Loyal Beagle')), { r, hand1: hand });
  R.check('Theft bietet NUR die neu gefrorene Beagle an (nicht die alte Dummy)',
    theft ? (theft.valid.length === 1 && theft.valid[0].cardName === 'Loyal Beagle') : (hand.includes('Loyal Beagle') && !hand.includes(D) && altDa),
    theft ? theft.valid.map(v => v.cardName + '@' + v.slotIdx) : { hand, altDa });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
