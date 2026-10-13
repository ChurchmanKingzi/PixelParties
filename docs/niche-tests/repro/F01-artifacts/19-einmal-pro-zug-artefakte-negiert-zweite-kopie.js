'use strict';
// F01-artifacts-19 · „You can only play 1 X per turn": ein per Rusty Touch negiertes Artefakt verbraucht das Zug-Limit nicht – die zweite Kopie wirkt im selben Zug
// Kartentexte: Book of Doom „You can only play 1 "Book of Doom" per turn."; Burned Contract „…play 1 "Burned Contract" per turn."; Capture Net „…play 1 "Capture Net" per turn.";
//   Cute Cheese „You can only activate 1 "Cute Cheese" per turn."; Rusty Touch „Negate that Artifact (but your opponent still has to pay its Cost)."
// Aufbau: Sitz 0 hat zwei Kopien in der Hand und 100 Gold; Sitz 1 hält Rusty Touch (negiert die erste Kopie, Kosten werden bezahlt). Danach spielt Sitz 0 die zweite Kopie (`keepActions`).
// Erwartung: Die erste Kopie war „gespielt" (Präzedenz: A01-pollution-14/-04 Eraser Beam/Pyroblast, B-Stufe); die zweite ist im selben Zug nicht spielbar.
// Beobachtet: Die zweite Kopie wird gespielt und wirkt (Book of Doom 50 Schaden, Burned Contract besiegt die Kreatur, Capture Net holt sie, Cute Cheese holt eine Kreatur).
// Ursache: Der Einmal-pro-Zug-Stempel steht jeweils erst in `resolve` (`book-of-doom.js` Z. 70 `engine.claimHOPT('book-of-doom', pi)`; `burned-contract.js`, `capture-net.js`, `cute-cheese.js` analog) –
//   `resolve` läuft bei einer Negation in der Kette nie. (Gegenbeispiel mit richtiger Auslegung: Speerkämpfer-Regel CARD_API.md Z. 19709 „Gestempelt wird beim Aktivieren … wird der Stich selbst negiert, ist er verbraucht".)
const H = require('../../lib/h.js');
const FAELLE = {
  'Book of Doom': { setup: () => {}, ziele: (v) => v.filter(x => x.type === 'hero' && x.owner === 1).slice(0, 1).map(x => x.id), wirkung: (t) => 800 - t.hp(1, 0) === 50 },
  'Burned Contract': { setup: (t) => { t.c = t.put(1, 0, 0, H.INERT.creature); }, ziele: (v) => [v.find(x => x.type === 'equip').id], wirkung: (t) => t.c.zone !== 'support' },
  'Capture Net': { setup: (t) => { t.c = t.put(1, 0, 0, H.INERT.creature); }, ziele: (v) => [v.find(x => x.type === 'equip').id], wirkung: (t) => t.pile(0, 'hand').includes(H.INERT.creature) },
  'Cute Cheese': { setup: () => {}, ziele: () => [], wirkung: (t) => t.pile(0, 'hand').includes('Albrecht, the Nerd') },
};
(async () => {
  const R = H.runner();
  for (const [karte, f] of Object.entries(FAELLE)) {
    const t = await H.fresh({ hand: [[karte, karte], ['Rusty Touch']], deck: [['Albrecht, the Nerd', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
    t.grantFor(1, 0, 'Rusty Touch'); t.policy.confirm = true;
    f.setup(t);
    t.targetFn = f.ziele;
    await t.play(0, karte, { hero: 0 });
    const negiert = t.pile(1, 'discardPile').includes('Rusty Touch') && !f.wirkung(t);
    t.setHand(1, []);
    t.reset();
    const r2 = await t.play(0, karte, { hero: 0, keepActions: true });
    const wirkt = f.wirkung(t);
    R.check(karte + ': erste Kopie negiert (Voraussetzung)', negiert, { rusty: t.pile(1, 'discardPile') });
    R.check(karte + ': zweite Kopie im selben Zug wirkungslos / nicht spielbar', !wirkt, { r2, wirkt });
    R.check(karte + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
