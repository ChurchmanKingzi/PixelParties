'use strict';
// W75 · Darion — Audit P2: Cloak of Edge (Equip, das im Support Zone als ABILITY gilt) liegt im Equip-Stapel (Club / Cloak of Edge / Cute Crown).
// Kartentexte: Weird Doll „Choose an Ability attached to a Hero you control and send it to the discard pile."; Fire Bomb „Select 1 Ability or any number of Equip Artifacts to destroy."
// Erwartet: als Ability-Ziel ist nur das CLOAK gemeint — die Rueckfrage „welches Equip?" bietet nicht die Nachbarn Club / Crown an (bei genau einem Cloak entfaellt sie), und es verlaesst nur das Cloak den Stapel.
// Bei zwei Cloaks im Stapel trifft Weird Doll die in der Rueckfrage gewaehlte (die zweite) Kopie.
// Aufruf: node docs/niche-tests/repro/W75/h-P2-04-cloak-of-edge-im-stapel-weird-doll-fire-bomb.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, TU = 'Tushu, the Knowledge Keeper';
function stapel(t, seite, namen) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  return namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const szene = (karte) => H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [[karte], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
const fragen = (t) => t.prompts.filter(p => p.d.type === 'instancePick');

(async () => {
  const R = H.runner();
  let t;

  for (const karte of ['Weird Doll', 'Fire Bomb']) {
    R.section(karte + ': ein Cloak im Stapel');
    t = await szene(karte);
    stapel(t, 0, ['Club of Gobbo', 'Cloak of Edge', 'Cute Crown']);
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => ({ instId: d.instances[0].instId }) });   // wuerde ein Nachbar angeboten, waere die ERSTE Antwort der Club
    t.targetFn = (valid) => [valid.find(v => v.cardName === 'Cloak of Edge').id];
    await t.play(0, karte, { hero: 0 });
    R.check('nur das Cloak ist weg, Club + Crown bleiben im Stapel', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(['Club of Gobbo', 'Cute Crown']) && t.pile(0, 'discardPile').includes('Cloak of Edge'), [t.gs.players[0].supportZones[0], t.pile(0, 'discardPile')]);
    R.check('keine Rueckfrage mit den Nachbarn', fragen(t).every(p => p.d.instances.every(i => i.name === 'Cloak of Edge')), fragen(t).map(p => p.d.instances.map(i => i.name)));
    R.check('Sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('Weird Doll: zwei Cloaks im Stapel — die gewaehlte (zweite) Kopie geht');
  t = await szene('Weird Doll');
  const ins = stapel(t, 0, ['Cloak of Edge', 'Club of Gobbo', 'Cloak of Edge']);
  ins[2].counters.marke = 'zweite';
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => ({ instId: ins[2].id }) });
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Cloak of Edge').id];
  await t.play(0, 'Weird Doll', { hero: 0 });
  R.check('die zweite Kopie ist weg, die erste bleibt', ins[2].zone !== 'support' && ins[0].zone === 'support' && ins[0].heroIdx === 0 && t.gs.players[0].supportZones[0][1].length === 2, [ins.map(i => i.zone), t.gs.players[0].supportZones[0]]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.finish();
})();
