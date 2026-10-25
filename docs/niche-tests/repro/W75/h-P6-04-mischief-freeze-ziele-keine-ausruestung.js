'use strict';
// W75 · Darion · P6 (`_mischief-militia-shared.enumerateFreezableNonFrozenTargets`, benutzt von Mischief Invasion) — „Freeze X targets": Ziele sind Helden und Kreaturen. Ausruestung (und Anhaengsel)
// in einer Support Zone ist kein Ziel — vorher bot die Liste JEDE Karte einer Support Zone an; im Equip-Stapel von Darion standen dann drei Ziele mit derselben ID (`equip-S-H-Platz`).
// Kartentext Mischief Invasion: „… Freeze as many targets as Creatures summoned …"  Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: In der Freeze-Zielliste stehen die Helden und die Kreatur — keine Karte des Stapels und keine einzelne Ausruestung eines normalen Helden.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-04-mischief-freeze-ziele-keine-ausruestung.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const MM = require(H.ROOT + '/cards/effects/_mischief-militia-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, namen, hi = 0, slot = 1) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[D, T, null], ['Rick, the Trigger Happy Undertaker', null, null]], hand: [[F], [F]] });
  stapel(t, 0, NAMEN);
  t.put(1, 0, 0, 'Club of Gobbo');                   // Ausruestung bei einem normalen Helden
  const krea = t.put(1, 0, 1, H.INERT.creature);      // eine Kreatur
  const ziele = MM.enumerateFreezableNonFrozenTargets(t.engine);
  R.note('ziele', ziele.map(z => z.id + ':' + z.cardName));
  R.check('keine Karte des Stapels als Ziel', !ziele.some(z => z.type === 'equip' && z.owner === 0), ziele.map(z => z.id));
  R.check('keine Ausruestung eines normalen Helden als Ziel', !ziele.some(z => z.id === 'equip-1-0-0'), ziele.map(z => z.id));
  R.check('die Kreatur bleibt Ziel', ziele.some(z => z.id === 'equip-1-0-1' && z.cardInstance === krea), ziele.map(z => z.id));
  R.check('die Helden bleiben Ziele', ziele.filter(z => z.type === 'hero').length === 3, ziele.filter(z => z.type === 'hero').map(z => z.id));
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
