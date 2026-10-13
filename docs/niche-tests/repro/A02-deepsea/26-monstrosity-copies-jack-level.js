'use strict';
// A02-deepsea-26 · Deepsea Monstrosity kopiert Jack O' Lantern: die gezogene Kartenzahl hängt davon ab, wie die Monstrosity selbst ins Spiel kam
//
// Kartentext (Jack O' Lantern): „You may add a "Deepsea" Creature that was not summoned this turn from one of your Heroes'
// Support Zones to your hand to place this Creature into the same Support Zone. Then, draw cards equal to the returned Creature's level."
// Kartentext (Monstrosity): „… Add it back to your hand. Then, this Creature activates that Creature's on-summon effect as if it was its own."
// `deepsea-jack-o-lantern.js` liest `ctx.card.counters._bouncedFromLevel` – das ist eine Marke der Instanz, auf der der Effekt läuft,
// bei der Kopie also der MONSTROSITY: gesetzt nur, wenn die Monstrosity selbst per Bounce-Place kam (dann: Stufe des dabei zurückgenommenen
// Wesens), sonst fehlt sie (dann zieht die Kopie nichts).
//
// Lesart (offen): Die „returned Creature" der kopierten Wirkung ist die von der Monstrosity für die Kopie zurückgenommene Jack (Stufe 1).
//   Es gibt dann in beiden Fällen 1 Karte. Das Repro prüft diese Lesart (✗ = Abweichung); die Frage steht im Bericht.
// Beobachtet: normal beschworen → 0 Karten; per Bounce-Place über Deepsea Witch (Lv2) → 2 Karten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const via of ['normal', 'bounce über Witch (Lv2)']) {
    R.section('Monstrosity ' + via);
    const t = await H.fresh({ hand: [['Deepsea Monstrosity'], []], deck: [['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
    const jack = t.put(0, 1, 0, "Deepsea Jack O' Lantern"); jack.turnPlayed = 1;
    if (via !== 'normal') { const w = t.put(0, 0, 0, 'Deepsea Witch'); w.turnPlayed = 1; }
    t.script.push({ match: d => d.type === 'zonePick' && /Monstrosity/.test(d.title || '') && /Bounce a Deepsea Creature to place/.test(d.description || ''), answer: (d) => { const z = d.zones.find(z => /Witch/.test(z.label)) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
    t.script.push({ match: d => d.type === 'zonePick' && /Monstrosity/.test(d.title || ''), answer: (d) => { const z = d.zones.find(z => /Jack/.test(z.label)) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
    const hand0 = t.pile(0, 'hand').length;
    await t.play(0, 'Deepsea Monstrosity', { hero: 0, slot: 0 });
    const gezogen = t.pile(0, 'hand').filter(n => n === 'ZZ Dummy').length;
    R.note('Hand danach', t.pile(0, 'hand'));
    R.check('Die kopierte Jack-Wirkung zieht 1 Karte (Stufe der zurückgenommenen Jack), unabhängig vom Weg der Monstrosity', gezogen === 1, { gezogen, hand0 });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
