'use strict';
// W75 · Audit P5 · Darion × Jenny, the Class Fairy — Cloak of Edge zaehlt im Support-Platz als Ability; liegt sie in einem Equip-Stapel, muss Jenny genau DIESE Karte zurueckholen.
// Kartentext: „Once per turn, return any number of Abilities you control to your hand. Draw 1 card for each. You cannot draw or add cards from your deck for the rest of the turn." (Cloak of Edge zaehlt in der Support Zone als Ability.)
// Befund (vorher): (1) die Engine fragte „welches Equip?" unter ALLEN Karten des Stapels, (2) Jenny zaehlte die Karten des ganzen Platzes als „Kopien" der Cloak (Rueckfrage „1–3 Kopien"), (3) zurueck kam die OBERSTE Karte des Platzes (Cute Crown), nicht die Cloak.
// Erwartet: Stapel Club / Cloak of Edge / Crown (Seite 0, Darion): nur die Cloak ist ein Ziel (kein „welches Equip?", keine Kopien-Frage), nur die Cloak kommt auf die Hand (1 Karte gezogen); Club und Crown bleiben. Gegenprobe: eine einzelne Cloak ohne Darion wie bisher.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-04-jenny-cloak-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, J = 'Jenny, the Class Fairy', CLOAK = 'Cloak of Edge';
(async () => {
  const R = H.runner();

  R.section('Cloak im Darion-Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[J, D, null], [F, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const ps = t.gs.players[0];
    ps.supportZones[1][1] = [];
    const insts = ['Club of Gobbo', CLOAK, 'Cute Crown'].map(n => { ps.supportZones[1][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 1, 1); i.turnPlayed = 1; return i; });
    let ziele = null;
    t.targetFn = (valid) => { ziele = valid.map(v => v.id + ':' + v.cardName); return [valid.find(v => v.type === 'equip').id]; };
    const r = await t.activateHero(0, 0, { phase: 2 });
    await t.drain();
    const zone = ps.supportZones[1][1], hand = t.pile(0, 'hand');
    const fragen = t.prompts.filter(p => p.d.type === 'instancePick' || p.d.type === 'optionPicker');
    R.note('lauf', JSON.stringify({ r, ziele, zone, hand, fragen: fragen.map(f => f.d.type + ':' + f.d.title) }));
    R.check('Effekt gewirkt', r === true, r);
    R.check('nur die Cloak ist ein Ziel', ziele && ziele.length === 1 && ziele[0].endsWith(CLOAK), ziele);
    R.check('keine Rueckfrage (welches Equip / wie viele Kopien)', fragen.length === 0, fragen.map(f => f.d.title + ':' + f.d.description));
    R.check('die Cloak ist auf der Hand, Club und Crown nicht', hand.includes(CLOAK) && !hand.includes('Club of Gobbo') && !hand.includes('Cute Crown'), hand);
    R.check('Club und Crown bleiben im Stapel', JSON.stringify(zone) === JSON.stringify(['Club of Gobbo', 'Cute Crown']), zone);
    R.check('Instanzen passen (2 im Platz)', t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1 && c.zoneSlot === 1).length === 2);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Gegenprobe: einzelne Cloak ohne Darion');
  {
    const t = await H.fresh({ active: 0, heroes: [[J, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    t.put(0, 1, 0, CLOAK);
    t.targetFn = (valid) => [valid.find(v => v.type === 'equip').id];
    const r = await t.activateHero(0, 0, { phase: 2 });
    await t.drain();
    R.check('Cloak kommt auf die Hand, Zone leer', r === true && t.pile(0, 'hand').includes(CLOAK) && t.gs.players[0].supportZones[1][0].length === 0, [r, t.pile(0, 'hand'), t.gs.players[0].supportZones[1]]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
