'use strict';
// S02-07 · Laser Volley: Der Gegner verschont gleichnamige Ziele immer in Reihenfolge, nicht nach seiner Wahl
// Kartentext: „Deal 200 damage to all targets your opponent controls. Your opponent may discard any number of cards from their hand,
//   and if they do, they choose that many of their targets. The chosen targets take no damage from this Spell."
// Aufbau: Gegner (Sitz 1) kontrolliert zwei gleichnamige Kreaturen (ZZ Dummy Big) auf Held 0 und Held 1 (je 1000 HP). Sitz 0 spielt Laser Volley,
//   Sitz 1 wirft eine Karte ab und klickt in der Galerie den ZWEITEN Eintrag an (Kreatur auf Held 1). Die Antwort hat die Form, die der Client
//   sendet (`public/dist/app-board.js` ~62130: `respondToPrompt({ cardName: entry.name, source: entry.source })` – ohne heroIdx/Slot).
// Erwartet: Die angeklickte Kreatur (Held 1) bleibt bei 1000, die andere nimmt 200.
// Beobachtet: Die ERSTE gleichnamige Kreatur (Held 0) wird verschont, die angeklickte (Held 1) nimmt den Schaden.
// Ursache: `cards/effects/laser-volley.js` Z. 126-131: `remaining.find(t => t.cardName === sparePick.cardName)` – der Kommentar darüber verspricht
//   „Match by name AND slot", der Code vergleicht nur den Namen; der Client liefert in der Antwort keinen Slot. Gleichnamige Ziele (zwei Kopien
//   derselben Kreatur auf verschiedenen Helden) sind darum nicht unterscheidbar wählbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Laser Volley'], [H.INERT.filler]] });
  const A = t.put(1, 0, 0, H.INERT.big); A.counters.currentHp = 1000; A.counters.maxHp = 1000;
  const B = t.put(1, 1, 0, H.INERT.big); B.counters.currentHp = 1000; B.counters.maxHp = 1000;
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: H.INERT.filler, handIndex: 0 }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Laser Volley', once: true, answer: (d) => {
    const second = d.cards.filter(e => e.name === H.INERT.big)[1];
    return { cardName: second.name, source: second.source };      // exakt die Client-Antwortform
  } });
  const r = await t.play(0, 'Laser Volley', { hero: 0 });
  t.say('gespielt:', r, '| Kreatur Held 0:', A.counters.currentHp, '| Kreatur Held 1 (angeklickt):', B.counters.currentHp);
  R.check('Gegner hat genau eine Kreatur verschont', (A.counters.currentHp === 1000) !== (B.counters.currentHp === 1000), [A.counters.currentHp, B.counters.currentHp]);
  R.check('die ANGEKLICKTE (zweite, Held 1) Kreatur ist verschont', B.counters.currentHp === 1000, [A.counters.currentHp, B.counters.currentHp]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
