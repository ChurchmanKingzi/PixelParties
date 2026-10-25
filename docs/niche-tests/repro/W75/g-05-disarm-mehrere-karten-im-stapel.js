'use strict';
// W75 · Darion — Disarm loescht „any number of Artifacts" auch INNERHALB eines Equip-Stapels (Al: „unbedingt erweitern").
// Kartentext Disarm: „Choose any number of Artifacts equipped to one Hero (at least 1) and delete them. This counts as an additional Action."
// Erwartet: Stapel Club / Blade / Crown; gewaehlt werden Mitte und Unterste -> beide im Geloescht-Stapel, die oberste bleibt; Abbruch nach der ersten ("Done") loescht nur eine.
// Aufruf: node docs/niche-tests/repro/W75/g-05-disarm-mehrere-karten-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
async function szene(antworten, eigene) {
  const heroes = eigene ? [[D, null, null], [F, null, null]] : [[F, null, null], [D, null, null]];
  const t = await H.fresh({ active: 0, heroes, hand: [['Disarm', F], [F]], gold: 500 });
  const seite = eigene ? 0 : 1;
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
  let n = 0;
  const gefragt = [];
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { gefragt.push({ n: d.instances.length, done: !!d.doneLabel }); const a = antworten[n++]; return a == null ? { done: true } : { instId: insts[a].id }; } });
  t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === seite && v.slotIdx === 1) || valid.find(v => v.type === 'hero' && v.owner === seite) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, 'Disarm', { hero: 0 });
  await t.drain();
  return { t, ps, insts, gefragt, seite };
}
(async () => {
  const R = H.runner();
  for (const eigene of [false, true]) {
    R.section((eigene ? 'eigener' : 'gegnerischer') + ' Stapel: Mitte + Unterste loeschen');
    let r = await szene([1, 0], eigene);
    R.note('gefragt', JSON.stringify(r.gefragt) + ' | Zone ' + JSON.stringify(r.ps.supportZones[0][1]) + ' | geloescht ' + JSON.stringify(r.t.pile(r.seite, 'deletedPile')));
    R.check('Mitte und Unterste geloescht, oberste bleibt', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify([NAMEN[2]]) && r.t.pile(r.seite, 'deletedPile').includes(NAMEN[1]) && r.t.pile(r.seite, 'deletedPile').includes(NAMEN[0]), [r.ps.supportZones[0][1], r.t.pile(r.seite, 'deletedPile')]);
    R.check('erste Frage ohne Done (Pflicht), zweite mit Done', r.gefragt[0] && !r.gefragt[0].done && r.gefragt[1] && r.gefragt[1].done, r.gefragt);
    R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);

    R.section((eigene ? 'eigener' : 'gegnerischer') + ' Stapel: nur eine, dann Done');
    r = await szene([2, null], eigene);
    R.check('nur die oberste geloescht', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify([NAMEN[0], NAMEN[1]]) && r.t.pile(r.seite, 'deletedPile').join() === NAMEN[2], [r.ps.supportZones[0][1], r.t.pile(r.seite, 'deletedPile')]);
    R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);

    R.section((eigene ? 'eigener' : 'gegnerischer') + ' Stapel: alle drei');
    r = await szene([0, 1, 2], eigene);
    R.check('Zone leer, alle drei geloescht', r.ps.supportZones[0][1].length === 0 && r.t.pile(r.seite, 'deletedPile').length === 3, [r.ps.supportZones[0][1], r.t.pile(r.seite, 'deletedPile')]);
    R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);
  }
  R.finish();
})();
