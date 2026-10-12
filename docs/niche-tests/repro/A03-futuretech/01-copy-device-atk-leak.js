'use strict';
// A03-futuretech-01 · Future Tech Copy Device als Laser Cannon / Gun: Attack-Bonus bleibt nach Zugende dauerhaft
//
// Kartentext Copy Device: „Choose a "Future Tech" Artifact from your discard pile, except "Future Tech Copy Device",
//   and shuffle it back into your deck. This Artifact's name, Cost and effect become that Artifact's original name,
//   Cost and effect for the rest of the turn."
// Erwartung: Nach dem Zugende fällt die Identität ab, die Ausrüstung geht in die Ablage, der Held hat wieder seinen
//   Basis-Attack (die kopierte Laser Cannon gibt +100, Gun +40 je Gun in der Ablage - nur solange sie ausgerüstet ist).
// Beobachtet: Der Held behält den Bonus dauerhaft (ATK 140 statt 40). Mitten im Zug zerstört wird der Bonus korrekt
//   zurückgenommen (Kontrolle) - nur der Zugende-Pfad `onIdentityExpire` verliert ihn.
// Ursache: cards/effects/future-tech-copy-device.js:553-562 nimmt `_effectOverride` ab, BEVOR `actionDestroyCard` läuft;
//   das `onCardLeaveZone` (revokeAtk) der kopierten Karte wird deshalb nicht mehr gelesen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [name, bonusErwartet] of [['Future Tech Laser Cannon', 100], ['Future Tech Gun', 80]]) {
    R.section('Copy Device kopiert ' + name);
    const t = await H.fresh({ hand: [['Future Tech Copy Device'], []], discard: [[name, name, name], []], gold: [100, 100] });
    const atk0 = t.hero(0, 0).atk;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: name }), once: true });
    await t.play(0, 'Future Tech Copy Device', { hero: 0 });
    R.check('Kopie ausgerüstet, Bonus +' + bonusErwartet, t.zone(0, 0, 0) === 'Future Tech Copy Device' && t.hero(0, 0).atk === atk0 + bonusErwartet, [t.zone(0, 0, 0), t.hero(0, 0).atk]);
    await t.endTurn();                      // Zugende des Besitzers: Identität fällt ab, Karte geht in die Ablage
    R.check('Copy Device liegt in der Ablage', t.pile(0, 'discardPile').includes('Future Tech Copy Device') && t.zone(0, 0, 0) === null);
    R.check('Held hat wieder den Basis-Attack (Bonus der geliehenen Ausrüstung weg)', t.hero(0, 0).atk === atk0, { atk: t.hero(0, 0).atk, erwartet: atk0 });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
