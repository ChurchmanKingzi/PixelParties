'use strict';
// W75 · Darion — Karten, die MEHRERE Ausruestungen waehlen lassen, duerfen auch mehrere Karten AUS DEMSELBEN Stapel nehmen (Al: „unbedingt erweitern").
// Kartentexte: Fire Bomb „Select 1 Ability or any number of Equip Artifacts to destroy."; Surprising Opportunity „Choose up to 2 cards from that Hero's Support Zones and add them to your hand before the Hero is defeated."
// Erwartet: Stapel Club / Blade / Crown. Fire Bomb: Mitte + Unterste zerstoert, oberste bleibt. Surprising Opportunity: zwei Karten (Mitte + oberste) kommen auf die Hand, die dritte bleibt; nie mehr als 2.
// Aufruf: node docs/niche-tests/repro/W75/g-06-mehrfachwahl-im-stapel-fire-bomb-surprising-opportunity.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  return NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  for (const eigene of [false, true]) {
    const wo = eigene ? 'eigener' : 'gegnerischer';
    R.section('Fire Bomb, ' + wo + ' Stapel: Mitte + Unterste');
    const seite = eigene ? 0 : 1;
    const heroes = eigene ? [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]] : [['Tushu, the Knowledge Keeper', null, null], [D, null, null]];
    const t = await H.fresh({ active: 0, heroes, hand: [['Fire Bomb', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, seite);
    const reihenfolge = [insts[1], insts[0]];
    let n = 0;
    const gefragt = [];
    t.script.push({ match: d => d.type === 'instancePick', answer: (d) => { gefragt.push({ n: d.instances.length, done: !!d.doneLabel }); const a = reihenfolge[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => {
      const eq = valid.find(v => v.type === 'equip' && v.owner === seite && v.slotIdx === 1);
      return [(eq || valid.find(v => v.type === 'hero' && v.owner === 0) || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Fire Bomb', { hero: 0 });
    await t.drain();
    const ps = t.gs.players[seite];
    R.note('lauf', JSON.stringify({ gefragt, zone: ps.supportZones[0][1], ablage: t.pile(seite, 'discardPile'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Mitte und Unterste zerstoert, oberste bleibt', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([NAMEN[2]]), [ps.supportZones[0][1], t.pile(seite, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Surprising Opportunity: zwei Karten aus demselben Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[F, null, null], [D, null, null]], hand: [['Surprising Opportunity'], [F]], deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 1);
    const wahl = [insts[1], insts[2]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = wahl[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1) || valid[0]).id];
    t.policy.confirm = true;
    t.engine.isCpuPlayer = () => false; t.engine._fastMode = false;   // der Mensch-Weg (Auswahl per Klick), nicht die CPU-Heuristik
    // Die Harness beantwortet `promptEffectTarget` ausserhalb von Spielwegen nicht selbst: ein Klick auf den Stapel-Platz, dann der echte Abschluss der Engine (Rueckfrage im Stapel).
    t.engine.promptEffectTarget = async (pi, ziele, cfg) => {
      const id = ziele.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1).id;
      const res = await t.engine._zielwahlAbschliessen(pi, ziele, cfg, [id]);
      return Array.isArray(res) ? res : [id];
    };
    const SO = require('../../../../cards/effects/surprising-opportunity.js');
    const hero = t.gs.players[1].heroes[0];
    await t.run(() => SO.heroDefeatWindowResolve(t.engine, 0, { heroOwner: 1, heroIdx: 0, hero }));
    await t.drain();
    const hand = t.pile(0, 'hand');
    R.note('lauf', JSON.stringify({ ziele: t.targets.map(x => ({ who: x.who, v: x.valid.length, t: x.valid.map(v => v.id) })), zone: t.gs.players[1].supportZones[0][1], hand, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Mitte und oberste auf der Hand von Sitz 0, die unterste bleibt', hand.includes(NAMEN[1]) && hand.includes(NAMEN[2]) && !hand.includes(NAMEN[0]) && JSON.stringify(t.gs.players[1].supportZones[0][1]) === JSON.stringify([NAMEN[0]]), [hand, t.gs.players[1].supportZones[0][1]]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Pressure Projectile: Mitte + Unterste aus dem Stapel des getroffenen Helden');
  {
    const t = await H.fresh({ active: 0, heroes: [['Tushu, the Knowledge Keeper', null, null], [D, null, null]], hand: [['Pressure Projectile', F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 1);
    const reihenfolge = [insts[1], insts[0]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = reihenfolge[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => {
      const eq = valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1);
      return [(eq || valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Pressure Projectile', { hero: 0 });
    await t.drain();
    const ps = t.gs.players[1];
    R.note('lauf', JSON.stringify({ zone: ps.supportZones[0][1], ablage: t.pile(1, 'discardPile'), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Mitte und Unterste weg, oberste bleibt', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([NAMEN[2]]), [ps.supportZones[0][1], t.pile(1, 'discardPile')]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Inheritance Ceremony: Mitte + Unterste aus dem Stapel des Nutzers zum Zielhelden');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [['Inheritance Ceremony', F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)] });
    t.setAbilities?.(0, 0, [['Support Magic'], [], []]);
    const insts = stapel(t, 0);
    const reihenfolge = [insts[1], insts[0]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = reihenfolge[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.script.push({ match: d => d.type === 'slider' || d.type === 'amountPicker' || /slider/i.test(d.type || ''), answer: () => ({ amount: 0, value: 0 }) });
    t.targetFn = (valid) => {
      const eq = valid.find(v => v.type === 'equip' && v.owner === 0 && v.slotIdx === 1);
      return [(eq || valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1) || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Inheritance Ceremony', { hero: 0 });
    await t.drain();
    const z = t.gs.players[0].supportZones;
    R.note('lauf', JSON.stringify({ darion: z[0], tushu: z[1], prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    const beiTushu = z[1].flat();
    R.check('Mitte und Unterste liegen jetzt beim Zielhelden, die oberste bleibt bei Darion', JSON.stringify(z[0][1]) === JSON.stringify([NAMEN[2]]) && beiTushu.includes(NAMEN[0]) && beiTushu.includes(NAMEN[1]), z);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.finish();
})();
