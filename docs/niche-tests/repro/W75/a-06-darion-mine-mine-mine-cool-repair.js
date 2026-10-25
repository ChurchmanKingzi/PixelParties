'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Mine! Mine! Mine! gegen einen Gegner-Darion nimmt nur das gewaehlte Equip; Cool Repair legt in den Stapel.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-06-darion-mine-mine-mine-cool-repair.js   (Exit 0 = korrekt)
const U = require('../../lib/umhaengen.js');
const { H } = U;
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const eq = (t, s, hi) => JSON.stringify(t.gs.players[s].supportZones[hi]);
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat];
  ps.supportZones[hi][slot] = [];
  const out = [];
  for (const n of namen) { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; out.push(i); }
  return out;
}
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Mine! Mine! Mine! gegen einen Gegner-Darion: Rueckfrage welches Equip, nur dieses auf die Hand');
  t = await H.fresh({ active: 0, heroes: [null, [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief']], hand: [['Mine! Mine! Mine!'], [F]], gold: 500 });
  t.grantFor(0, 0, 'Mine! Mine! Mine!');
  const ins = stapel(t, 1, ['Club of Gobbo', 'Glass Sword', 'Blade of the Frostbringer']);
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1); return [(v || valid[0]).id]; };
  t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: ins[2].id }) });
  t.script.push({ match: d => d.type === 'confirm', answer: () => false });
  await t.play(0, 'Mine! Mine! Mine!', { hero: 0 });
  R.note('mmm', JSON.stringify({ opp: t.gs.players[1].supportZones[0], hand0: t.pile(0, 'hand'), prompts: t.prompts.map(p => p.pi + ':' + p.d.type + ':' + (p.d.title || '')) }));
  R.check('Blade bei Seat 0 auf der Hand, Rest bleibt gestapelt', t.pile(0, 'hand').includes('Blade of the Frostbringer') && JSON.stringify(t.gs.players[1].supportZones[0][1]) === '["Club of Gobbo","Glass Sword"]', [t.pile(0, 'hand'), t.gs.players[1].supportZones[0]]);
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('2) Weapon Collecting Wight / Looting / Cool Repair auf eigenen Darion mit Stapel');
  t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hand: [['Cool Repair'], [F]], discard: [['Club of Gobbo', 'Glass Sword'], []], gold: 500 });
  stapel(t, 0, ['Blade of the Frostbringer'], 1, 0);
  t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'cardGalleryMulti', answer: (d) => ({ cardName: 'Club of Gobbo', selectedCards: ['Club of Gobbo'], source: 'discard' }) });
  t.targetFn = (valid) => [valid[0].id];
  const rr = await t.play(0, 'Cool Repair', { hero: 0 });
  R.note('cr', JSON.stringify(rr) + eq(t, 0, 0) + JSON.stringify(t.prompts.map(p => p.d.type + ':' + (p.d.title || ''))));
  R.check('Cool Repair: Club im Stapel bei Darion (nur ein Equip-Platz)', t.gs.players[0].supportZones[0].filter(z => z.length).length === 1, eq(t, 0, 0));
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);
  R.finish();
})();
