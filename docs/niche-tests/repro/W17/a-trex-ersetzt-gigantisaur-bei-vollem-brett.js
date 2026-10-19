'use strict';
// W17a · Gigantisaur King Trex ersetzt bei vollem Brett (Al, 19.10.2026: generelle Regel für alle Creatures, die andere Karten in Support Zonen ersetzen)
//
// Kartentext: „You can only summon this Creature by sacrificing a "Gigantisaur" Creature you control, except "Gigantisaur King Trex"." (Zusatzaktion)
// Erwartung: sind alle Support Zonen belegt und steht ein opferbarer Gigantisaur in einer Zone mit exakt EINER Karte, kann Trex dort hinein geworfen werden:
//   der Gigantisaur wird geopfert (Ablage), Trex landet in dessen Zone. Ohne opferbaren Gigantisaur (oder nur ein anderer Trex) ist er bei vollem Brett nicht spielbar.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const TREX = 'Gigantisaur King Trex', ANK = 'Gigantisaur Ankylos';
const D = H.INERT.creature;
async function brett(plan, opts = {}) {
  const t = await H.fresh({ hand: [[TREX], []] });
  for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) { const i = t.put(0, hi, z, plan[`${hi},${z}`] || D); i.turnPlayed = 1; }
  return t;
}
const trexIn = (t, hi, z) => t.inst(c => c.name === TREX && c.zone === 'support' && c.owner === 0 && c.heroIdx === hi && c.zoneSlot === z).length === 1;
(async () => {
  const R = H.runner();

  R.section('(a) volles Brett, ein Gigantisaur: Trex ersetzt ihn');
  { const t = await brett({ '1,1': ANK });
    const r = await t.play(0, TREX, { hero: 1, slot: 1 });
    R.check('gespielt, Trex steht in der Zone des Gigantisaurs', r === true && trexIn(t, 1, 1), { r, hand: t.pile(0, 'hand') });
    R.check('Gigantisaur in der Ablage, Trex nicht mehr auf der Hand', t.pile(0, 'discardPile').includes(ANK) && !t.pile(0, 'hand').includes(TREX), { abl: t.pile(0, 'discardPile'), hand: t.pile(0, 'hand') });
    R.check('übrige 8 Dummies unberührt', t.inst(c => c.name === D && c.zone === 'support' && c.owner === 0).length === 8);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit()); }

  R.section('(b) volles Brett, kein Gigantisaur: nicht spielbar');
  { const t = await brett({});
    const r = await t.play(0, TREX, { hero: 0, slot: 0 });
    R.check('abgelehnt, Karte bleibt auf der Hand', r === false && t.pile(0, 'hand').includes(TREX), { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(c) volles Brett, nur ein anderer Trex (nicht opferbar): nicht spielbar');
  { const t = await brett({ '2,2': TREX });
    const r = await t.play(0, TREX, { hero: 2, slot: 2 });
    R.check('abgelehnt, der andere Trex bleibt', r === false && t.pile(0, 'hand').includes(TREX) && trexIn(t, 2, 2), { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(d) Wurf auf einen Dummy statt auf den Gigantisaur: abgelehnt');
  { const t = await brett({ '1,1': ANK });
    const r = await t.play(0, TREX, { hero: 0, slot: 0 });
    R.check('abgelehnt, nichts geopfert', r === false && t.pile(0, 'hand').includes(TREX) && t.pile(0, 'discardPile').length === 0, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(e) Held des Gigantisaurs gefroren: Trex kann nicht ersetzen (Opferung ist eine Handlung des Helden)');
  { const t = await brett({ '1,1': ANK });
    t.heroStatus(0, 1, 'frozen');
    const r = await t.play(0, TREX, { hero: 1, slot: 1 });
    R.check('abgelehnt', r === false && t.pile(0, 'hand').includes(TREX) && t.pile(0, 'discardPile').length === 0, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.section('(f) Kontrolle: freie Zone beim Helden mit Gigantisaur - bisheriger Weg (Gigantisaur wird geopfert, Trex in die freie Zone)');
  { const t = await brett({ '1,1': ANK });
    t.gs.players[0].supportZones[1][2] = []; for (const i of t.inst(c => c.zone === 'support' && c.heroIdx === 1 && c.zoneSlot === 2)) t.engine._untrackCard(i.id);
    const r = await t.play(0, TREX, { hero: 1, slot: 2 });
    R.check('gespielt in die freie Zone, Gigantisaur geopfert', r === true && trexIn(t, 1, 2) && t.pile(0, 'discardPile').includes(ANK), { r, abl: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})();
