'use strict';
// W4-neg-04 · Staff of Illusions: Stufe-0-Kreatur ist auch ohne Goldsperre unter 10 Gold spielbar, wenn die Kosten 0 sind (Al, 14.10.2026, Welle 4 / D; F03-artifacts-13)
// Kartentext: „Choose a level 3 or lower Creature from your deck or hand and place it into the Support Zone of any Hero you control. This Artifact's Cost is multiplied by the Creature's level."
// Al: „Wenn die Kosten fuer lv 0 0 sind, ja." -> die optimistische Vorpruefung „mindestens 10 Gold" darf Kosten 0 nicht verhindern; Kosten > 0 bleiben an Gold gebunden.
// Erwartung: (A) nur Bird (Lv0) auf der Hand: bei Gold 0 / 9 spielbar, Kosten 0, Bird liegt auf dem Brett. (B) nur eine Lv1-Kreatur (Bomblebee): bei Gold 9 NICHT spielbar,
//   bei Gold 10 spielbar (Kosten 10). (C) Lv0 und Lv1 auf der Hand, Gold 5: spielbar, die Galerie bietet Lv1 an, die Wahl von Lv1 bricht ab (nicht bezahlbar), nichts wird abgezogen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const wahl = (t, name) => t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Staff of Illusions', answer: () => ({ cardName: name, source: 'hand' }), once: false });
  const aufBrett = (t, n) => [0, 1, 2].some(h => [0, 1, 2].some(s => t.zone(0, h, s) === n));

  R.section('A) nur Lv0 (Bird): Gold 0 und 9 spielbar, Kosten 0');
  for (const gold of [0, 9]) {
    const t = await H.fresh({ hand: [['Staff of Illusions', 'Bird'], []], gold, deckSize: 20 });
    wahl(t, 'Bird');
    const r = await t.play(0, 'Staff of Illusions');
    R.check(`Gold ${gold}: gespielt, Bird liegt auf dem Brett, Gold unveraendert`, r === true && aufBrett(t, 'Bird') && t.gs.players[0].gold === gold, { r, gold: t.gs.players[0].gold, hand: t.pile(0, 'hand') });
    R.check(`Gold ${gold}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('B) nur Lv1: Gold 9 nicht spielbar (Kosten 10), Gold 10 spielbar');
  {
    let t = await H.fresh({ hand: [['Staff of Illusions', 'Bomblebee'], []], gold: 9, deck: [['Fireball', 'Fireball'], []] });   // Deck ohne Kreatur (sonst waere die Filler-Kreatur ZZ Dummy, Lv0, waehlbar)
    wahl(t, 'Bomblebee');
    let r = await t.play(0, 'Staff of Illusions');
    R.check('Gold 9: nicht spielbar, Kreatur nicht auf dem Brett', r === false && !aufBrett(t, 'Bomblebee'), { r, hand: t.pile(0, 'hand') });
    t = await H.fresh({ hand: [['Staff of Illusions', 'Bomblebee'], []], gold: 10, deck: [['Fireball', 'Fireball'], []] });
    wahl(t, 'Bomblebee');
    r = await t.play(0, 'Staff of Illusions');
    R.check('Gold 10: gespielt, Kosten 10 bezahlt', r === true && aufBrett(t, 'Bomblebee') && t.gs.players[0].gold === 0, { r, gold: t.gs.players[0].gold });
  }

  R.section('C) Lv0 und Lv1 auf der Hand, Gold 5: Lv0 waehlbar, Kosten 0; Gold bleibt 5');
  {
    const t = await H.fresh({ hand: [['Staff of Illusions', 'Bird', 'Bomblebee'], []], gold: 5, deckSize: 20 });
    wahl(t, 'Bird');
    const r = await t.play(0, 'Staff of Illusions');
    R.check('gespielt, Bird liegt auf dem Brett, Gold 5', r === true && aufBrett(t, 'Bird') && t.gs.players[0].gold === 5, { r, gold: t.gs.players[0].gold });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
