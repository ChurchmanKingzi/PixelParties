'use strict';
// W75 · Audit P4a · Deepsea Poltergeister × Darion (geteilte Equip-Zone)
// Kartentext: „… When you summon this Creature, you may choose any Artifact on the board and send it to the discard pile."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Stapel Club / Blade / Crown (gegnerisch UND eigen): gewaehlt wird die MITTLERE Karte (Blade) — nur sie geht in die Ablage, Club und Crown bleiben im Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-02-deepsea-poltergeister-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, P = 'Deepsea Poltergeister';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite) {
  const ps = t.gs.players[seite]; ps.supportZones[0][1] = [];
  return NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  for (const eigene of [false, true]) {
    const wo = eigene ? 'eigener' : 'gegnerischer';
    R.section('Deepsea Poltergeister, ' + wo + ' Stapel: die mittlere Karte');
    const seite = eigene ? 0 : 1;
    const heroes = eigene ? [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]] : [['Tushu, the Knowledge Keeper', null, null], [D, null, null]];
    const t = await H.fresh({ active: 0, heroes, hand: [[P, F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, seite);
    let gefragt = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { gefragt++; return { instId: insts[1].id }; } });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === seite && v.slotIdx === 1 && v.heroIdx === 0).id];
    t.policy.confirm = true;
    await t.play(0, P, { hero: 0 });
    await t.drain();
    const z = t.gs.players[seite].supportZones[0][1];
    R.note('lauf', JSON.stringify({ gefragt, zone: z, ablage: t.pile(seite, 'discardPile'), ziele: t.targets.map(x => x.valid.map(v => v.id)), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    const ids = (t.targets[0] || { valid: [] }).valid.map(v => v.id);
    R.check('Der Stapel ist in der Zielwahl EIN Ziel (keine doppelte ID)', ids.length === new Set(ids).size && ids.length >= 1, ids);
    R.check('Rueckfrage "welche Karte?" kam', gefragt > 0, gefragt);
    R.check('Nur die mittlere Karte (Blade) ist weg', JSON.stringify(z) === JSON.stringify([NAMEN[0], NAMEN[2]]), z);
    R.check('Blade liegt in der Ablage des Besitzers', t.pile(seite, 'discardPile').includes(NAMEN[1]), t.pile(seite, 'discardPile'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
