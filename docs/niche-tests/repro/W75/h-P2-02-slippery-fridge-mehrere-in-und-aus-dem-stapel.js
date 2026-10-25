'use strict';
// W75 · Darion — Audit P2: Slippery Fridge mit einem Equip-Stapel. Kartentext: „Choose any number of Equip Artifacts on the board and move them to a different Hero of the same controller."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: (1) aus Darions Stapel (Club / Blade / Cute Crown) werden genau die gewaehlten Karten (Mitte + unterste) umgehaengt, die oberste bleibt; bei gleichnamigen Karten
//           (Club, Club, Crown) trifft es die gewaehlte Kopie. (2) Zwei Equips eines anderen Helden ziehen BEIDE zu Darion (ohne Stapel: in EINE Zone, nicht in zwei).
//           (3) Zu Darion MIT Stapel und lauter belegten Zonen: beide kommen oben auf den Stapel. Keine Rueckfrage „welches Equip?" fuer den Zielplatz.
// Aufruf: node docs/niche-tests/repro/W75/h-P2-02-slippery-fridge-mehrere-in-und-aus-dem-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, TU = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi = 0, slot = 1, namen = NAMEN) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const szenen = () => H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [['Slippery Fridge'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });

(async () => {
  const R = H.runner();
  let t;

  for (const [titel, namen, wahlIdx, rest] of [
    ['Club / Blade / Crown: Mitte + unterste ziehen um', NAMEN, [1, 0], ['Cute Crown']],
    ['Club / Club / Crown: die zweite Kopie + Crown ziehen um', ['Club of Gobbo', 'Club of Gobbo', 'Cute Crown'], [1, 2], ['Club of Gobbo']],
  ]) {
    R.section('1) ' + titel);
    t = await szenen();
    const insts = stapel(t, 0, 0, 1, namen);
    const gewaehlt = wahlIdx.map(i => insts[i]);
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = gewaehlt[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid, cfg) => {
      if (cfg && cfg.title === 'Slippery Fridge') return [valid.find(v => v.type === 'equip').id];
      return [(valid.find(v => v.type === 'equip' && v.heroIdx === 1) || valid.find(v => v.type === 'hero' && v.heroIdx === 1)).id];
    };
    await t.play(0, 'Slippery Fridge', { hero: 0 });
    const z = t.gs.players[0].supportZones;
    R.check('bei Darion bleibt nur ' + rest.join('+'), JSON.stringify(z[0][1]) === JSON.stringify(rest), z[0]);
    R.check('die gewaehlten liegen bei Tushu', z[1].flat().length === 2 && gewaehlt.every(g => g.heroIdx === 1 && g.zone === 'support'), z[1]);
    R.check('Instanz-Zustand passt (gewaehlte Instanzen sind umgezogen, die ungewaehlten nicht)', insts.filter(i => i.heroIdx === 0).length === 1 && insts.filter(i => i.heroIdx === 1).length === 2, insts.map(i => i.name + '@' + i.heroIdx));
    R.check('Sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('2) Zwei Equips von Tushu zu Darion (kein Stapel): EINE gemeinsame Zone');
  t = await szenen();
  t.put(0, 1, 0, 'Club of Gobbo'); t.put(0, 1, 1, 'Cute Crown');
  t.engine.cardInstances.forEach(c => { c.turnPlayed = 1; });
  t.targetFn = (valid, cfg) => {
    if (cfg && cfg.title === 'Slippery Fridge') return valid.filter(v => v.type === 'equip').map(v => v.id);
    return [valid.find(v => v.type === 'equip' && v.heroIdx === 0).id];
  };
  await t.play(0, 'Slippery Fridge', { hero: 0 });
  let z = t.gs.players[0].supportZones;
  R.check('beide bei Darion in einer Zone', z[0].filter(s => s.length).length === 1 && z[0].flat().length === 2 && z[1].flat().length === 0, z);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section('3) Zwei Equips von Tushu zu Darion MIT Stapel, alle Zonen belegt');
  t = await szenen();
  stapel(t, 0, 0, 1, ['Blade of the Frostbringer']);
  t.put(0, 0, 0, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
  t.put(0, 1, 0, 'Club of Gobbo'); t.put(0, 1, 1, 'Cute Crown');
  t.engine.cardInstances.forEach(c => { c.turnPlayed = 1; });
  t.targetFn = (valid, cfg) => {
    if (cfg && cfg.title === 'Slippery Fridge') return valid.filter(v => v.type === 'equip' && v.heroIdx === 1).map(v => v.id);
    return [valid.find(v => v.type === 'equip' && v.heroIdx === 0).id];
  };
  await t.play(0, 'Slippery Fridge', { hero: 0 });
  z = t.gs.players[0].supportZones;
  R.check('beide oben auf dem Stapel', JSON.stringify(z[0][1]) === JSON.stringify(['Blade of the Frostbringer', 'Club of Gobbo', 'Cute Crown']) && z[1].flat().length === 0, z);
  R.check('keine Rueckfrage „welches Equip?" fuer den Zielplatz', t.prompts.filter(p => p.d.type === 'instancePick').length === 0, t.prompts.map(p => p.d.type));
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.finish();
})();
