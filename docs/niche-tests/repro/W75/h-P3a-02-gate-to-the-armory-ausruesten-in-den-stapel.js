'use strict';
// W75 · Darion (Audit P3a) — Gate to the Armory rüstet direkt in den Equip-Stapel aus, auch wenn KEINE Zone mehr frei ist.
// Kartentext Gate to the Armory: „Choose an Artifact from your deck or discard pile and add it to your hand. If the Artifact can be equipped to a Hero, you may immediately equip it to the user
// of this Spell without paying its cost."
// Erwartet: Darion hat einen Stapel Club / Blade in Zone 1; Zone 0 und 2 sind mit Kreaturen belegt (keine freie Zone). Das Direkt-Ausruesten wird trotzdem angeboten (der Stapel nimmt weitere Equips auf),
//   die Karte (Cute Crown) landet als dritte im Stapel, ohne Zonenwahl; die Animation zeigt auf den Stapelplatz. Mit freier Zone 0 passiert dasselbe (nie ein zweiter Platz). Ohne Stapel eroeffnet das erste Equip einen.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-02-gate-to-the-armory-ausruesten-in-den-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
async function szene({ voll, stapel }) {
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Gate to the Armory', F], [F]], gold: 500, deck: [['Cute Crown', ...Array(10).fill(F)], Array(15).fill(F)] });
  const ps = t.gs.players[0];
  if (stapel) {
    ps.supportZones[0][1] = [];
    for (const n of ['Club of Gobbo', 'Blade of the Frostbringer']) { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; }
  }
  if (voll) { t.put(0, 0, 0, K); t.put(0, 0, 2, K); }
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Gate to the Armory', answer: (d) => ({ cardName: 'Cute Crown', source: 'deck' }) });
  t.policy.confirm = true;
  await t.play(0, 'Gate to the Armory', { hero: 0 });
  await t.drain();
  return { t, ps };
}
(async () => {
  const R = H.runner();

  R.section('Stapel Club/Blade in Zone 1, Zone 0 und 2 belegt (keine freie Zone)');
  {
    const { t, ps } = await szene({ voll: true, stapel: true });
    const tor = t.evs('play_zone_animation').filter(e => e.type === 'ruestkammer_tor').map(e => e.zoneSlot);
    R.note('lauf', JSON.stringify({ zonen: ps.supportZones[0], hand: t.pile(0, 'hand'), tor, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '') + ':' + (p.d.message || '')) }));
    R.check('Cute Crown liegt als dritte Karte im Stapel (Zone 1)', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']), ps.supportZones[0]);
    R.check('nicht auf der Hand gelandet', !t.pile(0, 'hand').includes('Cute Crown'), t.pile(0, 'hand'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Stapel in Zone 1, Zone 0 frei: trotzdem in den Stapel, Animation am Stapelplatz');
  {
    const { t, ps } = await szene({ voll: false, stapel: true });
    const tor = t.evs('play_zone_animation').filter(e => e.type === 'ruestkammer_tor').map(e => e.zoneSlot);
    R.note('lauf', JSON.stringify({ zonen: ps.supportZones[0], tor }));
    R.check('Cute Crown im Stapel, Zone 0 bleibt leer', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']) && ps.supportZones[0][0].length === 0, ps.supportZones[0]);
    R.check('Animation des Tors am Stapelplatz (Zone 1)', tor.length === 1 && tor[0] === 1, tor);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Ohne Stapel: das erste Equip eroeffnet ihn in der ersten freien Zone');
  {
    const { t, ps } = await szene({ voll: false, stapel: false });
    R.check('Cute Crown in Zone 0', JSON.stringify(ps.supportZones[0][0]) === JSON.stringify(['Cute Crown']), ps.supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
