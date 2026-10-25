'use strict';
// W72a · Control Monitors — „Your opponent may delete all other cards in their hand instead." (BEIDE Sitze; Magnetic Potion als Ausloeser)
// Kartentext: „Play this card immediately when your opponent adds 1 or more cards … Delete the cards your opponent added. Your opponent may delete all other cards in their hand instead."
// Erwartet: Die WAHL liegt beim Hinzufuegenden (optionPicker an ihn); „alle anderen" = Hand ohne die hinzugefuegte Karte (ein gleichnamiges Exemplar bleibt als die hinzugefuegte stehen),
//   Loeschen ist kein Abwurf (Ablage waechst nicht, kein Abwurf-Ereignis), ohne andere Karten entfaellt die Frage.
// Aufruf: node docs/niche-tests/repro/W72/a-15-….js   (Exit 0 = korrekt)
const L = require('../../lib/monitors.js');
const { H, F, MC } = L;

(async () => {
  const R = H.runner();
  for (const M of [0, 1]) {
    const A = 1 - M;
    R.section(`Sitz ${M} haelt Monitors · der Hinzufuegende waehlt „alle anderen loeschen"`);
    let t = await L.szene(M, { handA: [F, 'Cute Hydra', 'Fireball'], deckA: ['Fireball', F, F] });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === MC, answer: () => ({ optionId: 'rest' }) });
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('die Wahl wurde dem HINZUFUEGENDEN gestellt, nicht dem Reaktionsspieler', L.wahlHinzufuegender(t).length === 1 && L.wahlHinzufuegender(t)[0].pi === A, L.wahlHinzufuegender(t).map(p => p.pi));
    R.check('Hand = genau 1 Fireball (die hinzugefuegte Karte), alle anderen geloescht (inkl. dem alten Fireball)', t.pile(A, 'hand').join() === 'Fireball', t.pile(A, 'hand'));
    R.check('Geloescht: Filler, Cute Hydra, das alte Fireball (+ der verbrauchte Trank)', ['ZZ Filler', 'Cute Hydra', 'Fireball'].every(n => t.pile(A, 'deletedPile').includes(n)), t.pile(A, 'deletedPile'));
    R.check('Loeschen ist kein Abwurf: Ablage des Hinzufuegenden unveraendert leer, kein forced_discard', t.pile(A, 'discardPile').length === 0 && t.lg('forced_discard').length === 0, { a: t.pile(A, 'discardPile'), l: t.lg('forced_discard').length });
    R.check('Reaktionsspieler zahlte 1 Karte + Control Monitors', t.pile(M, 'discardPile').length === 2 && t.pile(M, 'discardPile').includes(MC), t.pile(M, 'discardPile'));
    R.check('Log: choice=rest', t.lg('control_monitors').length === 1 && t.lg('control_monitors')[0].choice === 'rest', t.lg('control_monitors'));
    R.check('keine Fehler', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    R.section(`Sitz ${M} haelt Monitors · Hinzufuegender waehlt „die hinzugefuegten Karten" (gleiche Szene)`);
    t = await L.szene(M, { handA: [F, 'Cute Hydra', 'Fireball'], deckA: ['Fireball', F, F] });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === MC, answer: () => ({ optionId: 'added' }) });
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('nur EIN Fireball geloescht (die hinzugefuegte), Rest bleibt auf der Hand', t.pile(A, 'deletedPile').filter(n => n === 'Fireball').length === 1 && t.pile(A, 'hand').length === 3, { g: t.pile(A, 'deletedPile'), h: t.pile(A, 'hand') });

    R.section(`Sitz ${M} haelt Monitors · keine anderen Handkarten → keine Wahl`);
    t = await L.szene(M, { handA: [], deckA: ['Fireball', F, F] });
    await t.play(A, 'Magnetic Potion'); await t.drain();
    R.check('keine Frage an den Hinzufuegenden, hinzugefuegte Karte geloescht', L.wahlHinzufuegender(t).length === 0 && t.pile(A, 'deletedPile').includes('Fireball'), { w: L.wahlHinzufuegender(t).length, g: t.pile(A, 'deletedPile') });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
