'use strict';
// A04-cute-14 · Thorad: „single target" wird bei Helden nicht geprüft (bei Kreaturen schon)
//
// Kartentext (Thorad): "Any damage this Hero deals to a single target with Attacks or Spells is increased by 40 times the number of
//   cards in your Coolness Stack."
// Erwartung: Spells/Attacks, die mehrere Ziele treffen (Fireball auf 2 Ziele, Flame Avalanche auf alle), bekommen den Bonus nicht –
//   oder, wenn „single target" = jede Schadensinstanz, ALLE Ziele bekommen ihn (auch Kreaturen). Auf jeden Fall einheitlich.
// Beobachtet (Stack 3 Karten = +120): Fireball auf 1 Held 270 · auf 2 Helden je 270 (Bonus) · auf 2 Kreaturen je 150 (kein Bonus) ·
//   Flame Avalanche auf 3 Helden je 270. Der Heldenzweig prüft nicht auf Einzelziel, der Kreaturenzweig (entries.length === 1) schon.
// Ursache: cards/effects/thorad-strength-of-coolness.js beforeDamage (kein Einzelziel-Tor) vs beforeCreatureDamageBatch (Tor).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TH = 'Thorad, Strength of Coolness';
  const mk = async (hand) => {
    const t = await H.fresh({ heroes: [[TH, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [hand, []], deck: [Array(3).fill(H.INERT.creature), []] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; for (const n of ['Cute Bunny', 'Cute Cat', 'Cute Dog']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
    return t;
  };
  const heroIds = (v) => v.filter(x => x.type === 'hero' && x.owner === 1).map(x => x.id);
  let t = await mk(['Fireball']);
  t.targetFn = (v) => [heroIds(v)[0]];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Fireball auf 1 Held: 150 + 120 = 270', 800 - t.hp(1, 0) === 270, 800 - t.hp(1, 0));
  t = await mk(['Fireball']);
  t.targetFn = (v) => heroIds(v).slice(0, 2);
  await t.play(0, 'Fireball', { hero: 0 });
  const zwei = [800 - t.hp(1, 0), 800 - t.hp(1, 1)];
  t = await mk(['Fireball']);
  t.put(1, 0, 0, H.INERT.big); t.put(1, 0, 1, H.INERT.big);
  t.targetFn = (v) => v.filter(x => x.type === 'equip' && x.owner === 1).slice(0, 2).map(x => x.id);
  await t.play(0, 'Fireball', { hero: 0 });
  const kreat = t.inst(c => c.name === H.INERT.big && c.zone === 'support').map(c => 1000 - c.counters.currentHp);
  R.note('Fireball auf 2 Helden → Schaden je', zwei);
  R.note('Fireball auf 2 Kreaturen → Schaden je', kreat);
  R.check('Zwei-Ziele-Fireball: Helden und Kreaturen werden gleich behandelt (beide mit oder beide ohne Bonus)', (zwei[0] === 270) === (kreat[0] === 270), { helden: zwei, kreaturen: kreat });
  R.check('Zwei-Ziele-Fireball bekommt keinen Einzelziel-Bonus (Text: "to a single target")', zwei[0] === 150, { helden: zwei });
  t = await mk(['Flame Avalanche']);
  await t.play(0, 'Flame Avalanche', { hero: 0 });
  R.check('Flame Avalanche (alle Ziele) bekommt keinen Einzelziel-Bonus', 800 - t.hp(1, 0) === 150, [800 - t.hp(1, 0), 800 - t.hp(1, 1), 800 - t.hp(1, 2)]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
