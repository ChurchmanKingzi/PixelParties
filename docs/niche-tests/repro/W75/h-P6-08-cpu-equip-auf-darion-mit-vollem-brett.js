'use strict';
// W75 · Darion · P6 (`_cpu.js` `pickHeroForEquip`) — Die CPU waehlt den Traeger fuer eine Handausruestung nur unter Helden mit einer FREIEN Basis-Zone. Ein Darion mit Equip-Stapel braucht fuer ein
// weiteres Equip keine freie Zone (der Stapel nimmt es auf, Regel „kein Zonenwahl-Prompt ab dem 2. Equip"); die CPU soll ihn deshalb auch bei vollem Brett als Traeger sehen.
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Darion (Held 0) hat den Stapel in Platz 0 und Kreaturen in Platz 1 und 2 (kein Platz frei); der zweite Held steht auch voll. `pickHeroForEquip` fuer „Cute Wings" liefert Held 0.
// Gegenprobe: derselbe Aufbau OHNE Stapel (normaler Held, drei Kreaturen) -> kein Traeger (-1). Und der echte Spielweg (doPlayArtifact mit zoneSlot -1, wie die CPU ihn aufruft) legt das Equip
// in den Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P6-08-cpu-equip-auf-darion-mit-vollem-brett.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const CPU = require(H.ROOT + '/cards/effects/_cpu.js')._test;
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
(async () => {
  const R = H.runner();
  R.section('Darion mit Stapel und vollem Brett');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [T, null, null]], hand: [['Cute Wings'], []], gold: 100 });
    t.gs.players[0].supportZones[0][0] = [];
    for (const n of ['Club of Gobbo', 'Cute Crown']) { t.gs.players[0].supportZones[0][0].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 0); i.turnPlayed = 1; }
    t.put(0, 0, 1, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
    const cd = t.engine._getCardDB()['Cute Wings'];
    const wahl = CPU.pickHeroForEquip(t.engine, 0, 'Cute Wings', cd);
    R.check('Darion ist Traeger', wahl === 0, wahl);
    await t.play(0, 'Cute Wings', { hero: 0, slot: -1 });
    R.check('Cute Wings liegt im Stapel (Platz 0)', t.gs.players[0].supportZones[0][0].includes('Cute Wings') && t.gs.players[0].supportZones[0][0].length === 3, t.gs.players[0].supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Gegenprobe: normaler Held mit drei Kreaturen');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [T, null, null]], hand: [['Cute Wings'], []], gold: 100 });
    for (let s = 0; s < 3; s++) t.put(0, 0, s, H.INERT.creature);
    const cd = t.engine._getCardDB()['Cute Wings'];
    R.check('kein Traeger (-1)', CPU.pickHeroForEquip(t.engine, 0, 'Cute Wings', cd) === -1);
  }
  R.finish();
})();
