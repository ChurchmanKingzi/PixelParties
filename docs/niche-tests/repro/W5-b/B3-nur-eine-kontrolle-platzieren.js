'use strict';
// W5b-B3 (zu A04-10) · „You can only control 1 …" gilt auch für platzierende Karten – Entscheidung Al (Welle 5): „Nein!" (kein Umgehen).
// Erwartung: Army of the Cute wählt/platziert nie ein zweites Cute Phoenix (Galerie); Glorious Rebirth ist mit so einer Kreatur
//   oben auf dem Coolness Stack nicht spielbar (Karte bleibt auf der Hand, nichts verbraucht); Cute Angel Molinda bietet die Übernahme nicht an.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cnt = (t, n) => t.inst(c => c.name === n && c.zone === 'support' && (c.controller ?? c.owner) === 0).length;
  {   // Army: Phoenix steht schon auf dem Brett -> er ist in der Galerie nicht wählbar, der Bunny schon
    const t = await H.fresh({ hand: [['Army of the Cute', 'Cute Phoenix', 'Cute Bunny'], []], deck: [[H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
    t.put(0, 1, 0, 'Cute Phoenix');
    let galerie = null;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: d => { galerie = d.cards.map(c => c.name); const i = d.cards.findIndex(c => c.name === 'Cute Bunny'); return { selectedCards: ['Cute Bunny'], selectedIndices: [i] }; } });
    await t.play(0, 'Army of the Cute', { hero: 0, noGrant: true });
    R.check('Army: Galerie enthält den schon kontrollierten Phoenix nicht, aber den Bunny', galerie && !galerie.includes('Cute Phoenix') && galerie.includes('Cute Bunny'), galerie);
    R.check('Army: Bunny platziert, weiterhin nur 1 Phoenix', cnt(t, 'Cute Bunny') === 1 && cnt(t, 'Cute Phoenix') === 1, { b: cnt(t, 'Cute Bunny'), p: cnt(t, 'Cute Phoenix') });
    R.check('Army: keine Engine-Fehler, Audit leer', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {   // Glorious Rebirth: nicht spielbar, solange der Phoenix schon kontrolliert wird
    const t = await H.fresh({ hand: [['Glorious Rebirth'], []], deck: [[H.INERT.creature], []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool'); t.put(0, 1, 0, 'Cute Phoenix');
    const ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Cute Phoenix']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    const r = await t.play(0, 'Glorious Rebirth', { hero: 0 });
    R.check('Glorious Rebirth: nicht gespielt, Karte bleibt auf der Hand, Stack unverändert', r !== true || (t.pile(0, 'hand').includes('Glorious Rebirth') && ps.coolnessStack.length === 2), { r, hand: t.pile(0, 'hand'), stack: ps.coolnessStack });
    R.check('Glorious Rebirth: weiterhin nur 1 Cute Phoenix', cnt(t, 'Cute Phoenix') === 1, cnt(t, 'Cute Phoenix'));
  }
  {   // Gegenprobe: ohne eigenen Phoenix funktioniert Rebirth
    const t = await H.fresh({ hand: [['Glorious Rebirth'], []], deck: [[H.INERT.creature], []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Cute Phoenix']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    await t.play(0, 'Glorious Rebirth', { hero: 0 });
    R.check('Gegenprobe: Glorious Rebirth platziert den Phoenix, wenn keiner da ist', cnt(t, 'Cute Phoenix') === 1, cnt(t, 'Cute Phoenix'));
  }
  R.finish();
})();
