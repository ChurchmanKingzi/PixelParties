'use strict';
// A02-deepsea-10 · Cosmic Manipulation reagiert schon auf das PLATZIEREN (1. Hälfte von Arrival) – und kann Arrivals 2. Hälfte zerstören
//
// Kartentext (Cosmic Manipulation): „Play this card immediately when you SUMMON a Creature directly from your deck. Draw cards equal to the Creature's level …"
// Kartentext (Arrival): „Choose a "Cosmic Depths" Creature from your deck and PLACE it into the free Support Zone of a Hero your opponent controls. Then, choose a
//   "Cosmic Depths" Creature 1 level higher … and SUMMON it …" (beide aus dem Deck)
// WELLE 9 (Al, Q9): „place ist auch eine Subform von summon“ – das Fensterverhalten bleibt; die Erwartung unten prüft den Fall, dass man das 1. Fenster ABLEHNT (Absicherung: W9/a-10).
// Beobachtet: Das Reaktionsfenster von Cosmic Manipulation öffnet schon beim Platzieren der ersten Kreatur (Analyzer, Lv1 → zieht 1, mischt 0 zurück, kein Zähler).
//   Zieht die Reaktion dabei die Aufwertungs-Karte (hier: Gatherer ist die oberste Karte), findet Arrival für den 2. Schritt nichts mehr: `arrival_fizzle`
//   (Grund `no_upgrade`), die Arrival ist verbraucht (HOPT gestempelt), die 2. Kreatur kommt nicht. Lehnt man die Reaktion beim 1. Fenster ab, läuft alles
//   (CM feuert dann am 2. Schritt: Gatherer Lv2 → zieht 2, mischt 1, +1 Zähler).
//   Frage: Soll Cosmic Manipulation auf das PLATZIEREN reagieren („summon" vs. „place")? Und sollte Arrival die Wahl der 2. Karte VOR dem 1. Schritt festlegen?
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const AN = 'Analyzer from the Cosmic Depths', GA = 'Gatherer from the Cosmic Depths', LS = 'Life-Searcher from the Cosmic Depths', INV = 'Invader from the Cosmic Depths';
  const deck = [AN, GA, LS, INV, ...Array(10).fill(H.INERT.creature)];
  const t = await H.fresh({ hand: [['Arrival from the Cosmic Depths', 'Cosmic Manipulation', H.INERT.filler], []], deck: [deck] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic']]);
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => { const i = t.pile(0, 'hand').indexOf(H.INERT.filler); return { cardName: H.INERT.filler, handIndex: i, selectedCards: [{ cardName: H.INERT.filler, handIndex: i }] }; } });
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Cosmic Manipulation', answer: () => null, once: true });   // Welle 9: 1. Fenster (Platzieren) bewusst ablehnen – nimmt man es an und zieht den Gatherer, fizzelt Arrival (Spielerwahl)
  t.targetFn = (valid) => [valid[0].id];
  await t.play(0, 'Arrival from the Cosmic Depths', { hero: 0 });
  const fizzle = t.logs.some(l => l.type === 'arrival_fizzle');
  R.note('Log', t.logs.map(l => l.type).filter(x => /cosmic|arrival/.test(x)));
  R.check('Arrival führt den 2. Schritt aus (Gatherer steht auf meinem Brett)', t.gs.players[0].supportZones[0].some(z => z[0] === GA), { board0: t.gs.players[0].supportZones[0], hand: t.pile(0, 'hand'), fizzle });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
