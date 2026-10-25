'use strict';
// W75 · Audit P4a · The Weather Orchestra × Darion (geteilte Equip-Zone)
// Kartentext: „When you summon this Creature, you may choose up to 3 different Artifacts with a combined Cost of exactly 12 from your hand, deck or discard pile and equip them to Heroes on the board
//   without paying their Costs. You may once per turn choose an Artifact equipped to a Hero and send it to the discard pile."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet:
//   (a) Aktiver Effekt: im Stapel Club / Blade / Crown (gegnerisch UND eigen) geht genau die GEWAEHLTE (mittlere) Karte in die Ablage, die anderen bleiben im Stapel.
//   (b) Beschwoerung: der einzige Held mit Platz fuer Ausruestungen ist Darion mit Stapel, alle anderen Zonen sind belegt. Drei Artefakte (4+4+4 = 12) kommen ALLE in den Stapel
//       (kein Zonenwahl-Prompt, keine freie Zone noetig) — frueher zaehlte der Deckel „freie Zonen der eigenen Helden" = 0 und der Effekt feuerte gar nicht.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-03-weather-orchestra-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, O = 'The Weather Orchestra', DUMMY = H.INERT.creature;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi, slot, namen) {
  const ps = t.gs.players[seite]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  for (const eigene of [false, true]) {
    const wo = eigene ? 'eigener' : 'gegnerischer';
    R.section('(a) Aktiver Effekt, ' + wo + ' Stapel: die mittlere Karte');
    const seite = eigene ? 0 : 1;
    const heroes = eigene ? [['Tushu, the Knowledge Keeper', D, null], [F, null, null]] : [['Tushu, the Knowledge Keeper', null, null], [D, null, null]];
    const t = await H.fresh({ active: 0, heroes, hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const dh = eigene ? 1 : 0;
    const insts = stapel(t, seite, dh, 1, NAMEN);
    const orch = t.put(0, 0, 0, O); orch.turnPlayed = 1;
    t.phase(2); t.gs.activePlayer = 0;   // Kreatur-Effekte ohne Aktionskosten laufen in der Main Phase
    let gefragt = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { gefragt++; return { instId: insts[1].id }; } });
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === seite && v.heroIdx === dh && v.slotIdx === 1).id];
    t.policy.confirm = true;
    const res = await t.activateCreature(0, 0, 0);
    await t.drain();
    const z = t.gs.players[seite].supportZones[dh][1];
    R.note('lauf', JSON.stringify({ res, gefragt, zone: z, ablage: t.pile(seite, 'discardPile'), ziele: t.targets.map(x => x.valid.map(v => v.id)) }));
    R.check('Nur die mittlere Karte (Blade) ist weg', JSON.stringify(z) === JSON.stringify([NAMEN[0], NAMEN[2]]), z);
    R.check('Blade liegt in der Ablage', t.pile(seite, 'discardPile').includes(NAMEN[1]), t.pile(seite, 'discardPile'));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('(b) Beschwoerung: drei Artefakte (4+4+4) in Darions Stapel, obwohl keine Zone frei ist');
  {
    const A = ['Club of Gobbo', 'Excavator Bucket', 'Pocket Catapult'];
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], ['Tushu, the Knowledge Keeper', null, null]], hand: [[O, ...A], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    stapel(t, 0, 0, 0, ['Blade of the Frostbringer']);
    t.put(0, 0, 1, DUMMY); t.put(0, 0, 2, DUMMY);       // Darion: nur der Stapel, sonst belegt
    t.put(0, 1, 0, DUMMY); t.put(0, 1, 1, DUMMY);       // Tushu: Zone 2 ist fuer die Orchestra frei
    for (let s = 0; s < 3; s++) t.put(1, 0, s, DUMMY);  // Gegner: nichts frei
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedIndices: A.map(n => d.cards.findIndex(c => c.name === n && c.source === 'hand')) }) });
    t.policy.confirm = true;
    await t.play(0, O, { hero: 1, slot: 2 });
    await t.drain();
    const z = t.gs.players[0].supportZones[0];
    R.note('lauf', JSON.stringify({ darion: z, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')), hand: t.pile(0, 'hand') }));
    R.check('Alle drei Artefakte liegen im Stapel [Blade, Club, Bucket, Catapult]', JSON.stringify(z[0]) === JSON.stringify(['Blade of the Frostbringer', ...A]), z);
    R.check('Kein Zonenwahl-Prompt', !t.prompts.some(p => p.d.type === 'zonePick' || /Support Zone/.test(p.d.description || '') && p.d.type !== 'cardGalleryMulti'), t.prompts.map(p => p.d.type + ':' + (p.d.description || '').slice(0, 60)));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('(c) Beschwoerung mit Zonenwahl: Darions Stapel ist einer der Plaetze — kein "welches Equip?" bei der PLATZwahl');
  {
    const A = ['Club of Gobbo', 'Cute Crown'];   // 4 + 8 = 12
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], ['Tushu, the Knowledge Keeper', null, null]], hand: [[O, ...A], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    stapel(t, 0, 0, 0, ['Blade of the Frostbringer']);
    t.put(0, 0, 1, DUMMY); t.put(0, 0, 2, DUMMY);
    t.put(0, 1, 0, DUMMY); t.put(0, 1, 1, DUMMY);       // Tushu: Zone 2 ist fuer die Orchestra frei
    // Gegner (Sitz 1, Held 0) hat drei freie Zonen: es gibt also eine echte Platzwahl
    let platzwahlen = 0;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedIndices: A.map(n => d.cards.findIndex(c => c.name === n && c.source === 'hand')) }) });
    t.targetFn = (valid, cfg) => { if (/Equip /.test((cfg && cfg.title) || '')) { platzwahlen++; return [valid.find(v => v.owner === 0 && v.heroIdx === 0 && v.slotIdx === 0).id]; } return undefined; };
    t.policy.confirm = true;
    await t.play(0, O, { hero: 1, slot: 2 });
    await t.drain();
    const z = t.gs.players[0].supportZones[0];
    const equipFragen = t.prompts.filter(p => p.d.type === 'instancePick').length;
    R.note('lauf', JSON.stringify({ darion: z, platzwahlen, equipFragen, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    R.check('Eine Platzwahl fand statt', platzwahlen >= 1, platzwahlen);
    R.check('Keine Rueckfrage "welches Equip?" bei der Platzwahl', equipFragen === 0, equipFragen);
    R.check('Beide Artefakte liegen im Stapel [Blade, Club, Crown]', JSON.stringify(z[0].slice().sort()) === JSON.stringify(['Blade of the Frostbringer', ...A].sort()) && z[0].length === 3, z);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
