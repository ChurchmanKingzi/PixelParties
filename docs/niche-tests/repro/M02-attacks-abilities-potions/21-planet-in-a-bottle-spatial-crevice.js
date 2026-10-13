'use strict';
// M02-21 · Planet in a Bottle ist mit Spatial Crevice (Area-Limit 3) gesperrt, obwohl die Engine eine weitere Area erlaubt
// Kartentext Planet in a Bottle: „Choose a level 3 or lower Area from your deck, hand or discard pile and bring it directly into play."
// Regel (CARD_API.md ~Z. 11950–11965 „Area-Limit"): `engine.canPlaceAnotherArea(pi, name)` ist das EINE Gate; Spatial Crevice hebt das Limit auf 3 („up to 3 DIFFERENT Areas").
// Erwartung: mit Spatial Crevice auf dem Brett (1 von 3 Plätzen belegt, `canPlaceAnotherArea` = true) ist Planet in a Bottle spielbar, die gewählte Area kommt als zweite hinzu.
// Beobachtet: Karte nicht spielbar (`false`), bleibt auf der Hand. Ohne Area ✓ spielbar, mit Slippery Ice (Limit 1) korrekt gesperrt.
// Ursache: `planet-in-a-bottle.js` `playerControlsArea(gs, pi)` (Z. 53, benutzt in Z. 102 und 117) = „irgendeine Area liegt" – hartes Limit 1 statt `canPlaceAnotherArea`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [label, areas, soll] of [['keine Area', [], true], ['Spatial Crevice (Limit 3)', ['Spatial Crevice'], true], ['Slippery Ice (Limit 1)', ['Slippery Ice'], false]]) {
    const t = await H.fresh({ hand: [['Planet in a Bottle'], []], hp: 800, deck: [['Dark Ocean', 'ZZ Dummy', 'Fighting'], []], gold: 100 });
    for (const a of areas) t.putArea(0, a);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Dark Ocean', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    const gate = t.engine.canPlaceAnotherArea(0, 'Dark Ocean');
    const r = await t.play(0, 'Planet in a Bottle', { hero: 0 });
    const gespielt = !t.pile(0, 'hand').includes('Planet in a Bottle') && (t.gs.areaZones[0] || []).includes('Dark Ocean');
    R.check(`${label}: Gate der Engine = ${gate}; Planet in a Bottle ${soll ? 'spielbar' : 'gesperrt'}`, gespielt === soll && gate === soll, { gate, r, areas: t.gs.areaZones[0] });
  }
  R.finish();
})();
