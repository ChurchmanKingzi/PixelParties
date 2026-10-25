'use strict';
// W75 · Darion (Audit P3a) — Sun Beam („up to 3 cards") trifft auch mehrere Karten AUS DEMSELBEN Equip-Stapel.
// Kartentext Sun Beam: „Choose up to 3 cards on the board that aren't Heroes and send them to the discard pile. Place the same number of Pollution Tokens into your free Support Zones."
// Erwartet: Darion (Gegner) traegt Club / Blade / Crown in einer Zone. Gewaehlt werden Club und Crown (Rueckfrage Karte fuer Karte, die zweite mit „Done"): beide gehen in die Ablage, Blade bleibt,
//   der Zaubernde legt 2 Pollution Tokens. Eigener Stapel (alle drei, keine freie Zone sonst): alle drei zerstoert, Zone wird frei und nimmt genau 1 Token (kein Absturz bei zu wenig Platz).
//   Fremde Karten sind durch die freien Zonen des Zaubernden begrenzt: bei nur 1 freier Zone trifft eine Zweier-Wahl aus dem gegnerischen Stapel nur 1 Karte.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-07-sun-beam-mehrere-karten-aus-einem-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][1] = [];
  return NAMEN.map(n => { ps.supportZones[hi][1].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, 1); i.turnPlayed = 1; return i; });
}
const tokens = (t, seite) => t.gs.players[seite].supportZones.flat(2).filter(n => n === 'Pollution Token').length;
(async () => {
  const R = H.runner();

  R.section('gegnerischer Stapel: Club + Crown gewaehlt');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Sun Beam', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 1, 0);
    const wahl = [insts[0], insts[2]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = wahl[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1) || valid[0]).id];
    t.policy.confirm = true;
    await t.play(0, 'Sun Beam', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zone: t.gs.players[1].supportZones[0][1], ablage: t.pile(1, 'discardPile'), tokens: tokens(t, 0) }));
    R.check('Club und Crown in der Ablage, Blade bleibt', JSON.stringify(t.gs.players[1].supportZones[0][1]) === JSON.stringify([NAMEN[1]]) && t.pile(1, 'discardPile').includes(NAMEN[0]) && t.pile(1, 'discardPile').includes(NAMEN[2]), [t.gs.players[1].supportZones[0][1], t.pile(1, 'discardPile')]);
    R.check('2 Pollution Tokens beim Zaubernden', tokens(t, 0) === 2, tokens(t, 0));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('gegnerischer Stapel, nur 1 freie Zone: Zweier-Wahl trifft nur 1 fremde Karte');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Sun Beam', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 1, 0);
    t.put(0, 0, 0, K); t.put(0, 0, 1, K);   // Tushu: nur Zone 2 frei
    const wahl = [insts[0], insts[2]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = wahl[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1) || valid[0]).id];
    t.policy.confirm = true;
    await t.play(0, 'Sun Beam', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zone: t.gs.players[1].supportZones[0][1], ablage: t.pile(1, 'discardPile'), tokens: tokens(t, 0) }));
    R.check('hoechstens 1 Karte weg (freie Zonen = 1), Token = Zahl der zerstoerten Karten', (3 - t.gs.players[1].supportZones[0][1].length) <= 1 && tokens(t, 0) === (3 - t.gs.players[1].supportZones[0][1].length), [t.gs.players[1].supportZones[0][1], tokens(t, 0)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('eigener Stapel (alle drei) bei Darion, andere Zonen belegt');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [['Sun Beam', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const insts = stapel(t, 0, 0);
    t.put(0, 0, 0, K); t.put(0, 0, 2, K);
    const wahl = [insts[0], insts[1], insts[2]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = wahl[n++]; return a ? { instId: a.id } : { done: true }; } });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 0 && v.slotIdx === 1) || valid[0]).id];
    t.policy.confirm = true;
    await t.play(0, 'Sun Beam', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zonen: t.gs.players[0].supportZones[0], ablage: t.pile(0, 'discardPile'), tokens: tokens(t, 0) }));
    R.check('alle drei weg, die Zone ist frei bzw. traegt den Token', NAMEN.every(n => t.pile(0, 'discardPile').includes(n)) && !t.gs.players[0].supportZones[0].flat().some(n => NAMEN.includes(n)), [t.gs.players[0].supportZones[0], t.pile(0, 'discardPile')]);
    R.check('Tokens = freie Zonen (1)', tokens(t, 0) === 1, tokens(t, 0));
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
