'use strict';
// W75 · Darion (Audit P3a) — Inheritance Ceremony mit DARION ALS ZIELHELD: umgehaengte Equips kommen in EINEN Stapel, nicht in mehrere freie Zonen; ein vorhandener Stapel braucht keine freie Zone.
// Kartentext Inheritance Ceremony: „Choose another Hero you control. Move any number of cards attached or equipped to the user to the target's free Support Zones. Then, you may decrease the user's HP
// by any amount to heal the target's HP by the same amount. ..."
// Erwartet: (A) Tushu traegt Club / Blade / Crown in drei Zonen, Darion (ohne Stapel) bekommt alle drei in EINER Zone (die erste freie), Namen und Instanzen passen. (B) Darion hat schon einen Stapel (Glass Sword),
//   Zone 0 ist frei: die umgehaengten Equips kommen in den Stapel, Zone 0 bleibt leer. (C) Darion hat einen Stapel und KEINE freie Zone (Zonen 0 und 2 belegt): die Equips wandern trotzdem in den Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-04-inheritance-ceremony-zielheld-darion.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
async function szene({ darionStapel, darionVoll }) {
  const t = await H.fresh({ active: 0, heroes: [[T, D, null], [F, null, null]], hand: [['Inheritance Ceremony', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  t.setAbilities?.(0, 0, [['Support Magic'], [], []]);
  const ps = t.gs.players[0];
  const insts = NAMEN.map((n, i) => { ps.supportZones[0][i] = [n]; const x = t.engine._trackCard(n, 0, 'support', 0, i); x.turnPlayed = 1; return x; });
  if (darionStapel) {
    ps.supportZones[1][1] = ['Glass Sword'];
    const x = t.engine._trackCard('Glass Sword', 0, 'support', 1, 1); x.turnPlayed = 1;
  }
  if (darionVoll) { t.put(0, 1, 0, K); t.put(0, 1, 2, K); }
  t.script.push({ match: d => d.type === 'slider' || d.type === 'amountPicker' || /slider/i.test(d.type || ''), answer: () => ({ amount: 0, value: 0 }) });
  t.targetFn = (valid) => {
    const eq = valid.filter(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 0);
    return eq.length ? eq.map(v => v.id) : [(valid.find(v => v.type === 'hero' && v.heroIdx === 1) || valid[0]).id];
  };
  t.policy.confirm = true;
  await t.play(0, 'Inheritance Ceremony', { hero: 0 });
  await t.drain();
  return { t, ps, insts };
}
const bei = (ps, hi) => ps.supportZones[hi].map((z, i) => z.length ? `${i}:${z.join('+')}` : null).filter(Boolean);
(async () => {
  const R = H.runner();

  R.section('A: Darion ohne Stapel bekommt alle drei Equips in EINE Zone');
  {
    const { t, ps, insts } = await szene({});
    R.note('lauf', JSON.stringify({ tushu: bei(ps, 0), darion: bei(ps, 1), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    const belegt = ps.supportZones[1].filter(z => z.length);
    R.check('alle drei Karten liegen bei Darion in genau einer Zone', belegt.length === 1 && NAMEN.every(n => belegt[0].includes(n)), bei(ps, 1));
    R.check('Tushus Zonen sind leer', ps.supportZones[0].every(z => z.length === 0), bei(ps, 0));
    R.check('Instanzen zeigen auf Darion und dieselbe Zone', insts.every(i => i.heroIdx === 1 && i.zoneSlot === insts[0].zoneSlot && i.zone === 'support'), insts.map(i => [i.heroIdx, i.zoneSlot]));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('B: Darion hat einen Stapel (Glass Sword in Zone 1), Zone 0 frei: Equips kommen in den Stapel');
  {
    const { t, ps, insts } = await szene({ darionStapel: true });
    R.note('lauf', JSON.stringify({ tushu: bei(ps, 0), darion: bei(ps, 1) }));
    R.check('Stapel enthaelt Glass Sword + die drei Equips; Zone 0 und 2 bleiben leer', ps.supportZones[1][1].length === 4 && NAMEN.every(n => ps.supportZones[1][1].includes(n)) && ps.supportZones[1][0].length === 0 && ps.supportZones[1][2].length === 0, bei(ps, 1));
    R.check('Instanzen alle in Zone 1 von Darion', insts.every(i => i.heroIdx === 1 && i.zoneSlot === 1), insts.map(i => [i.heroIdx, i.zoneSlot]));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('C: Darion hat einen Stapel und keine freie Zone: die Equips wandern trotzdem in den Stapel');
  {
    const { t, ps, insts } = await szene({ darionStapel: true, darionVoll: true });
    R.note('lauf', JSON.stringify({ tushu: bei(ps, 0), darion: bei(ps, 1), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Stapel enthaelt Glass Sword + die drei Equips', ps.supportZones[1][1].length === 4 && NAMEN.every(n => ps.supportZones[1][1].includes(n)), bei(ps, 1));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
