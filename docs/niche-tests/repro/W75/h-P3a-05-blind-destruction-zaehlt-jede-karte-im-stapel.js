'use strict';
// W75 · Darion (Audit P3a) — Blind Destruction zaehlt JEDE Karte eines Equip-Stapels (nicht je Zone).
// Kartentext Blind Destruction: „Send all Artifacts equipped to all Heroes on the board, except the user, to the discard pile. Every Hero takes 50 damage times the number of their Artifacts discarded by this effect."
// Erwartet: Darion (Gegner) traegt Club / Blade / Crown in EINER Zone: alle drei gehen in die Ablage, Darion nimmt 3 × 50 = 150 Schaden. Ist Darion selbst der Nutzer, bleibt sein Stapel unberuehrt
//   („except the user"), der andere Held mit einem Equip verliert es und nimmt 50.
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-05-blind-destruction-zaehlt-jede-karte-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, hi) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][1] = [];
  return NAMEN.map(n => { ps.supportZones[hi][1].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, 1); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('Darion (Gegner) mit Dreier-Stapel');
  {
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Blind Destruction', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    stapel(t, 1, 0);
    const vorher = t.hp(1, 0);
    t.policy.confirm = true;
    await t.play(0, 'Blind Destruction', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zone: t.gs.players[1].supportZones[0], ablage: t.pile(1, 'discardPile'), hp: [vorher, t.hp(1, 0)] }));
    R.check('Zone leer, alle drei in der Ablage', t.gs.players[1].supportZones[0].every(z => z.length === 0) && NAMEN.every(n => t.pile(1, 'discardPile').includes(n)), [t.gs.players[1].supportZones[0], t.pile(1, 'discardPile')]);
    R.check('Darion nimmt 3 × 50 = 150 Schaden', vorher - t.hp(1, 0) === 150, [vorher, t.hp(1, 0)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  R.section('Darion ist der Nutzer: eigener Stapel bleibt, anderer Held verliert sein Equip');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, T, null], [F, null, null]], hand: [['Blind Destruction', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    stapel(t, 0, 0);
    t.gs.players[0].supportZones[1][0] = ['Glass Sword'];
    const g = t.engine._trackCard('Glass Sword', 0, 'support', 1, 0); g.turnPlayed = 1;
    const hp = [t.hp(0, 0), t.hp(0, 1)];
    t.policy.confirm = true;
    await t.play(0, 'Blind Destruction', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ darion: t.gs.players[0].supportZones[0], tushu: t.gs.players[0].supportZones[1], ablage: t.pile(0, 'discardPile'), hp: [hp, t.hp(0, 0), t.hp(0, 1)] }));
    R.check('Darions Stapel bleibt vollstaendig', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(NAMEN), t.gs.players[0].supportZones[0]);
    R.check('Glass Sword (anderer Held) in der Ablage, 50 Schaden', t.pile(0, 'discardPile').includes('Glass Sword') && hp[1] - t.hp(0, 1) === 50 && t.hp(0, 0) === hp[0], [hp, t.hp(0, 0), t.hp(0, 1)]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
