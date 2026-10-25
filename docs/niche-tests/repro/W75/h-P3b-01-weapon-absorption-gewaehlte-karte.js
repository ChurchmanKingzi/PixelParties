'use strict';
// W75 · Darion — Audit P3b: Weapon Absorption (Reaction) schickt genau die im Stapel GEWAEHLTE Ausruestung ab (nicht die oberste).
// Kartentext Weapon Absorption: „… send any number of Abilities attached and Artifacts equipped to the user to the discard pile; the user heals 80 HP for each card sent …" (Reaktion auf einen Treffer des Nutzers).
// Erwartet: Stapel Club / Blade / Crown bei Darion (Sitz 1, getroffen). Gewaehlt wird die MITTLERE Karte (danach „Done"): nur Blade wandert in die Ablage, Club + Crown bleiben im Stapel.
//          Zweiter Lauf: oberste (Crown), dann Mitte (Blade) -> Club bleibt.
//          Dritter Teil (CPU-Heuristik): drei Equips im Stapel zaehlen als DREI Karten (mit den 2 Magic-Arts-Karten 5 x 80 HP), nicht als eine — die CPU feuert bei 100 HP und 400 Schaden (100 + 400 > 400).
// Aufruf: node docs/niche-tests/repro/W75/h-P3b-01-weapon-absorption-gewaehlte-karte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
async function lauf(reihenfolgeIdx) {
  const t = await H.fresh({ hand: [['Burning Finger'], ['Weapon Absorption', F, F]], deckSize: 30, active: 0 });
  t.grantFor(0, 0, 'Burning Finger');
  t.setHero(1, 0, D, 800);
  t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]);
  const ps = t.gs.players[1];
  ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; return i; });
  ps.heroes[0].hp = 300;
  let n = 0;
  t.script.push({ match: d => d.type === 'instancePick', answer: () => { const a = reihenfolgeIdx[n++]; return a == null ? { done: true } : { instId: insts[a].id }; } });
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Weapon Absorption', answer: () => ({ confirmed: true }) });
  let kosten = 0;
  t.targetFn = (valid, config) => {
    if (config && config._abilityCost) {   // Weapon-Absorption-Schleife: so viele Karten wie in der Reihenfolge, dann „Done"
      const eq = valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1);
      return kosten++ < reihenfolgeIdx.length && eq ? [eq.id] : [];
    }
    const h = valid.find(x => x.id === 'hero-1-0');
    return h ? [h.id] : [valid[0].id];
  };
  await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
  await t.drain();
  return { t, ps, insts };
}
(async () => {
  const R = H.runner();
  R.section('Weapon Absorption: Mitte gewaehlt, dann Done');
  let r = await lauf([1]);
  R.note('lauf', JSON.stringify({ zone: r.ps.supportZones[0][1], ablage: r.t.pile(1, 'discardPile'), hp: r.t.hp(1, 0), prompts: r.t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
  R.check('Reaktion wurde gewirkt (Weapon Absorption in der Ablage)', r.t.pile(1, 'discardPile').includes('Weapon Absorption'), r.t.pile(1, 'discardPile'));
  R.check('nur die MITTLERE Karte (Blade) liegt in der Ablage', r.t.pile(1, 'discardPile').includes(NAMEN[1]) && !r.t.pile(1, 'discardPile').includes(NAMEN[0]) && !r.t.pile(1, 'discardPile').includes(NAMEN[2]), r.t.pile(1, 'discardPile'));
  R.check('Club und Crown bleiben im Stapel', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify([NAMEN[0], NAMEN[2]]), r.ps.supportZones[0][1]);
  R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);

  R.section('Weapon Absorption: oberste, dann Mitte');
  r = await lauf([2, 1]);
  R.check('Crown und Blade weg, die unterste (Club) bleibt', JSON.stringify(r.ps.supportZones[0][1]) === JSON.stringify([NAMEN[0]]) && r.t.pile(1, 'discardPile').includes(NAMEN[2]) && r.t.pile(1, 'discardPile').includes(NAMEN[1]), [r.ps.supportZones[0][1], r.t.pile(1, 'discardPile')]);
  R.check('Sauber', r.t.errors.length === 0 && r.t.audit().length === 0, [r.t.errors, r.t.audit()]);

  R.section('CPU-Heuristik: ein Stapel mit drei Equips zaehlt mit drei Karten');
  {
    const t = await H.fresh({ hand: [[F], ['Weapon Absorption', F, F]], deckSize: 30, active: 0 });
    t.setHero(1, 0, D, 800);
    t.setAbilities(1, 0, [['Magic Arts', 'Magic Arts'], [], []]);
    const ps = t.gs.players[1];
    ps.supportZones[0][1] = [];
    NAMEN.forEach(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; });
    ps.heroes[0].hp = 100;
    const WA = H.loadCardEffect('Weapon Absorption');
    const feuert = WA.cpuMeta.reactionHeuristic(t.engine, { _preDamageContext: { targetOwner: 1, targetHeroIdx: 0, amount: 400, targetSeite: 1 } });
    R.check('die Heuristik rechnet mit allen fuenf Karten (100 + 5 x 80 = 500 > 400) und feuert', feuert === true, feuert);
  }
  R.finish();
})();
