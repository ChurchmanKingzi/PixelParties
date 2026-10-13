'use strict';
// F01-artifacts-12 · Cool Tech Jetpack: nach abgelehntem Angebot wird im selben Zug ein zweites Mal angeboten (Frage an Al)
// Kartentext: „The first time every turn when the equipped Hero is chosen by a card or effect, you may discard 1 card to negate that card or effect."
// Aufbau: Sitz 0 trägt Jetpack an Held 0 (3 Handkarten); Sitz 1 greift im eigenen Zug zweimal mit Fireball auf Held 0 von Sitz 0 an.
// Wörtliche Lesart: „the first time" – das ERSTE Gewähltwerden pro Zug; lehnt man dort ab (oder kann nicht zahlen), ist das Fenster für diesen Zug vorbei.
// Beobachtet: Erstes Angebot abgelehnt (150 Schaden), beim zweiten Fireball im selben Zug kommt das Angebot erneut, wird angenommen und negiert.
// Ursache: `cards/effects/cool-tech-jetpack.js` Z. 40 / 62–63: die Einmal-pro-Zug-Marke `gs.hoptUsed['cool-tech-jetpack:<id>']` wird erst NACH erfolgreichem Abwurf gesetzt, nie beim Ablehnen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ['Fireball', 'Fireball']], gold: [100, 100] });
  t.put(0, 0, 0, 'Cool Tech Jetpack');
  t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [h.id]; };
  t.script.push({ match: d => d.type === 'confirm', answer: () => null, once: true });   // erstes Angebot: Nein (Mensch)
  const hp = t.hp(0, 0);
  await t.play(1, 'Fireball', { hero: 0 });
  R.note('1. Fireball (Angebot abgelehnt): Schaden', hp - t.hp(0, 0));
  const hp2 = t.hp(0, 0); t.reset();
  await t.play(1, 'Fireball', { hero: 0 });
  const angebot = t.prompts.some(p => p.d.type === 'confirm');
  R.check('2. Fireball im selben Zug: Jetpack wird nicht erneut angeboten („the first time every turn")', !angebot && hp2 - t.hp(0, 0) === 150, { angebot, schaden: hp2 - t.hp(0, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
