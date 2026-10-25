'use strict';
// W75 · Darion — Audit P3b: Knife Throw zahlt als Kosten genau das im Stapel GEWAEHLTE Artefakt (auch bei gleichnamigen Karten mit eigenen Countern).
// Kartentext Knife Throw: „Send 1 Artifact equipped to the user to the discard pile to play this card. This Attack deals twice the user's ATK … This can be the only Attack you play this turn." (Kosten = ein ausgeruestetes Artefakt)
// Erwartet: Stapel Club / Blade / Club(oben, Counter „oben") bei Darion. Die Karten werden per instancePick (Bild + Counter) angeboten; gewaehlt wird die OBERSTE Club: genau diese wandert
//          in die Ablage, die unterste Club (ohne Counter) und Blade bleiben. Ohne Rueckfrage nach der Instanz (nur Namens-Galerie) laesst sich die obere Club nicht waehlen -> Fehler.
//          Zweiter Lauf (drei verschiedene Namen, Mitte gewaehlt): nur Blade geht.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-02-knife-throw-kosten-gewaehlte-karte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
async function lauf(namen, wahlIdx) {
  const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Knife Throw', F], [F]], gold: 500 });
  const ps = t.gs.players[0];
  ps.supportZones[0][1] = [];
  const insts = namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; return i; });
  insts[insts.length - 1].counters.markiert = 'oben';
  const fragen = [];
  t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { fragen.push('instancePick'); return { instId: insts[wahlIdx].id }; } });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Knife Throw', answer: (d) => { fragen.push('cardGallery'); return { cardName: insts[wahlIdx].name }; } });
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
  t.policy.confirm = true;
  await t.play(0, 'Knife Throw', { hero: 0 });
  await t.drain();
  return { t, ps, insts, fragen };
}
(async () => {
  const R = H.runner();

  R.section('Knife Throw: gleichnamige Karten, die OBERSTE Club wird gewaehlt');
  let r = await lauf(['Club of Gobbo', 'Blade of the Frostbringer', 'Club of Gobbo'], 2);
  R.note('lauf', JSON.stringify({ fragen: r.fragen, zone: r.ps.supportZones[0][1], ablage: r.t.pile(0, 'discardPile'), inst: r.insts.map(i => i.name + ':' + i.zone + ':' + (i.counters.markiert || '')) }));
  R.check('es wurde nach der Instanz gefragt (instancePick)', r.fragen.includes('instancePick'), r.fragen);
  R.check('die obere Club (mit Counter) ist abgeworfen, die untere bleibt', r.insts[2].zone !== 'support' && r.insts[0].zone === 'support' && r.insts[1].zone === 'support', r.insts.map(i => i.name + ':' + i.zone));
  R.check('Zone haelt noch Club + Blade (Reihenfolge gleichnamiger Namen ist nicht gesichert)', JSON.stringify([...r.ps.supportZones[0][1]].sort()) === JSON.stringify(['Blade of the Frostbringer', 'Club of Gobbo']), r.ps.supportZones[0][1]);
  R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);

  R.section('Knife Throw: drei verschiedene Namen, Mitte gewaehlt');
  r = await lauf(['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'], 1);
  R.check('nur Blade abgeworfen', r.insts[1].zone !== 'support' && r.insts[0].zone === 'support' && r.insts[2].zone === 'support', r.insts.map(i => i.name + ':' + i.zone));
  R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);
  R.finish();
})();
