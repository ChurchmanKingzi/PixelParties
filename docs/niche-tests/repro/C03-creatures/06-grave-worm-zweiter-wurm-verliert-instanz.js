'use strict';
// C03-creatures-06 · Grave Worm: ein ZWEITER Grave Worm (auf dem Brett / in der Hand) verliert seine Instanz, wenn der Ablage-Wurm wiederbelebt wird
// Kartentext: „When a Creature you control, except "Grave Worm", is defeated and sent to the discard pile while this Creature is in your discard pile, you may summon
//   this Creature into the same Support Zone from your discard pile as an additional Action. … When this Creature is summoned, draw 1 card."
// Aufbau: Sitz 0: Grave Worm in der Ablage UND ein Grave Worm auf dem Brett (Held 1 / Slot 0); zusätzlich eine eigene Kreatur (Held 0 / Slot 1), die stirbt.
//   Die Rückfrage („Crawl out!") wird mit Ja beantwortet (Harness-Standard).
// Erwartung: Der Ablage-Wurm kommt in den Platz der gestorbenen Kreatur; der Wurm auf dem Brett bleibt eine ganz normale Karte (Zone ↔ Instanz konsistent,
//   Schaden/Zerstörung wirken auf ihn).
// Beobachtet: Der Name „Grave Worm" steht weiter in Held 1 / Slot 0, aber seine Instanz ist getilgt (audit: „0 Instanzen"). Er wird als Ziel angeboten, aber
//   Schaden (Haressassin 150) wirkt nicht auf ihn: unzerstörbarer Platzhalter. Ebenso verliert ein Grave Worm auf der HAND seine Instanz.
// Ursache: cards/effects/grave-worm.js Z. ~255–260: `const listenerId = ctx.card?.id; … engine._untrackCard(listenerId);` – gedacht ist der Ablage-Zuhörer, aber `activeIn`
//   enthält auch hand/support/deck/deleted; welcher Wurm den Haken ausführt, hängt von der Reihenfolge der Instanzen ab. Der Brett-/Hand-Wurm räumt sich dann selbst ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const wo of ['support', 'hand']) {
    R.section(`zweiter Grave Worm liegt auf: ${wo}`);
    const t = await H.fresh({ discard: [['Grave Worm'], []] });
    t.grantFor(0, 0, 'Grave Worm');
    if (wo === 'support') { const w = t.put(0, 1, 0, 'Grave Worm'); w.turnPlayed = 1; }
    else t.setHand(0, ['Grave Worm']);
    const opfer = t.put(0, 0, 1, H.INERT.frail); opfer.turnPlayed = 1;
    const zweiter = t.inst(c => c.name === 'Grave Worm' && c.zone === wo)[0];
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, opfer));
    R.check('Rückfrage „Grave Worm" wurde gestellt', t.prompts.some(p => p.d.title === 'Grave Worm'), t.prompts.map(p => p.d.title));
    R.check('Ablage-Wurm steht im Platz der gestorbenen Kreatur', t.zone(0, 0, 1) === 'Grave Worm', t.zone(0, 0, 1));
    R.check(`der zweite Wurm (${wo}) hat seine Instanz behalten`, t.engine.cardInstances.some(c => c.id === zweiter.id), t.inst(c => c.name === 'Grave Worm').map(c => c.zone));
    R.check('Zustand sauber (Zone ↔ Instanz)', t.audit().length === 0, t.audit());
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
