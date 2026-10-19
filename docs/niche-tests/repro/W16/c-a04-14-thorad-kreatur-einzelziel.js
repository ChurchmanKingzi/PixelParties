'use strict';
// W16c · A04-cute-14 (Gegenprobe): Thorads Bonus gilt für EINZELZIEL-Schaden, auch gegen eine einzelne Kreatur (+40 je Stack-Karte);
// der Mehrziel-Schlag (Fireball auf 2 Kreaturen) bekommt ihn nicht (gleiche Auslegung wie Frog Race Boat: „single target").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TH = 'Thorad, Strength of Coolness';
  const mk = async () => {
    const t = await H.fresh({ heroes: [[TH, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [['Fireball'], []], deck: [Array(3).fill(H.INERT.creature), []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Cute Cat', 'Cute Dog']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    t.put(1, 0, 0, H.INERT.big); t.put(1, 0, 1, H.INERT.big);
    return t;
  };
  let t = await mk();
  t.targetFn = (v) => v.filter(x => x.type === 'equip' && x.owner === 1).slice(0, 1).map(x => x.id);
  await t.play(0, 'Fireball', { hero: 0 });
  const eins = t.inst(c => c.name === H.INERT.big && c.zone === 'support').map(c => 1000 - (c.counters.currentHp ?? 1000)).sort((a, b) => b - a);
  R.check('Fireball auf EINE Kreatur: 150 + 120 = 270', eins[0] === 270 && eins[1] === 0, eins);
  t = await mk();
  t.targetFn = (v) => v.filter(x => x.type === 'equip' && x.owner === 1).slice(0, 2).map(x => x.id);
  await t.play(0, 'Fireball', { hero: 0 });
  const zwei = t.inst(c => c.name === H.INERT.big && c.zone === 'support').map(c => 1000 - (c.counters.currentHp ?? 1000));
  R.check('Fireball auf ZWEI Kreaturen: je 150 (kein Einzelziel-Bonus)', zwei.length === 2 && zwei.every(x => x === 150), zwei);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
