'use strict';
// W75 · Darion — Audit P3b: Anti Magic Enchantment verzaubert genau das NEU angelegte Equip im Stapel; jedes verzauberte Equip hat seine eigene Negier-Ladung.
// Kartentext Anti Magic Enchantment: „Play this card immediately when an Artifact is equipped to a Hero by placing 1 Pollution Token into your free Support Zone. While equipped, the Artifact gains: Once per turn, the controlling player may negate the effects of a Spell that hits this Artifact's equipped Hero."
// Erwartet: Darion (Sitz 0) traegt Blade im Platz 2. (a) Cute Crown wird angelegt -> Angebot -> Crown ist verzaubert (Counter), Blade nicht; das Pollution-Token liegt in einer FREIEN Zone (nicht im Stapel).
//          (b) Ist KEINE andere Zone frei (Zonen 1 und 3 belegt), wird AME fuers zweite Equip nicht angeboten (das Token braucht eine freie Zone).
//          (c) Zwei verzauberte Equips: zwei gegnerische Spells im selben Zug koennen beide negiert werden (je Equip eine Ladung); der dritte nicht.
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-05-anti-magic-enchantment-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const AME = 'Anti Magic Enchantment';
function stapel(t, seat, namen) {
  const ps = t.gs.players[seat];
  ps.supportZones[0][1] = [];
  return namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seat, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('(a) Crown wird zum Stapel gelegt, AME angeboten und verzaubert genau Crown');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Cute Crown', AME, F], [F]], gold: 500 });
    const [blade] = stapel(t, 0, ['Blade of the Frostbringer']);
    let angeboten = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === AME, answer: () => { angeboten++; return { confirmed: true }; } });
    await t.play(0, 'Cute Crown', { hero: 0 });
    await t.drain();
    const crown = t.find('Cute Crown', 'support');
    R.note('lauf', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], angeboten, crown: crown && crown.counters, blade: blade.counters }));
    R.check('AME wurde angeboten', angeboten === 1, angeboten);
    R.check('Crown ist verzaubert', !!(crown && crown.counters.antiMagicEnchanted), crown && crown.counters);
    R.check('Blade ist NICHT verzaubert', !blade.counters.antiMagicEnchanted, blade.counters);
    R.check('Stapel bleibt im Platz 2, das Pollution-Token liegt in einer freien Zone', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(['Blade of the Frostbringer', 'Cute Crown']) && t.gs.players[0].supportZones[0].flat().filter(n => /Pollution/.test(n)).length === 1, t.gs.players[0].supportZones[0]);
    R.check('AME liegt in der Ablage', t.pile(0, 'discardPile').includes(AME), t.pile(0, 'discardPile'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(b) Keine freie Zone fuer das Token: AME wird nicht angeboten');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Cute Crown', AME, F], [F]], gold: 500 });
    stapel(t, 0, ['Blade of the Frostbringer']);
    t.put(0, 0, 0, 'ZZ Dummy'); t.put(0, 0, 2, 'ZZ Dummy');
    let angeboten = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === AME, answer: () => { angeboten++; return { confirmed: true }; } });
    await t.play(0, 'Cute Crown', { hero: 0 });
    await t.drain();
    R.check('Crown liegt im Stapel (kein freier Platz noetig)', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(['Blade of the Frostbringer', 'Cute Crown']), t.gs.players[0].supportZones[0]);
    R.check('AME nicht angeboten (kein Platz fuer das Token)', angeboten === 0, angeboten);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(c) Zwei verzauberte Equips: zwei Negationen pro Zug');
  {
    const t = await H.fresh({ active: 1, heroes: [[D, null, null], [F, null, null]], hand: [[F], ['Burning Finger', 'Burning Finger', 'Burning Finger']], gold: 500, hp: 800 });
    const insts = stapel(t, 0, ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']);
    for (const i of [insts[0], insts[2]]) i.counters.antiMagicEnchanted = { ownerPi: 0, charges: 1 };
    t.grantFor(1, 0, 'Burning Finger');
    let negiert = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === AME, answer: () => { negiert++; return { confirmed: true }; } });
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    const hp0 = t.hp(0, 0);
    for (let k = 0; k < 3; k++) { await t.play(1, 'Burning Finger', { hero: 0, noGrant: true, keepActions: false }); await t.drain(); }
    R.note('lauf', JSON.stringify({ negiert, hpVerlust: hp0 - t.hp(0, 0) }));
    R.check('genau zwei Negationen (je verzaubertem Equip eine Ladung)', negiert === 2, negiert);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
