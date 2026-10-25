'use strict';
// W75 · Darion (Audit P1) — Crusader's Flintlock: „If this Attack deals damage to a Hero, discard all Artifacts that Hero is equipped with."
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: Trifft der Schuss einen Darion mit Stapel Club / Blade / Crown, landen ALLE drei in der Ablage (bisher nur die unterste Karte: der Sammler meldet einen Stapel als EIN Ziel).
//           Cloak of Edge im Stapel zaehlt dort als Ability, nicht als Artifact: sie wird nicht abgeworfen.
// Aufruf: node docs/niche-tests/repro/W75/h-P1-02-flintlock-wirft-den-ganzen-stapel-ab.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
async function lauf(darion, namen) {
  const t = await H.fresh({ active: 0, heroes: [['Cecilia, the Harrowing Crusader', null, null], [darion ? D : T, null, null]], hand: [[F], [F]], gold: 900, deckSize: 30 });
  t.put(0, 0, 0, "Crusader's Flintlock").turnPlayed = 1;
  const ps = t.gs.players[1];
  namen.forEach((n, i) => {
    const slot = darion ? 1 : i;
    ps.supportZones[0][slot] = ps.supportZones[0][slot] || [];
    ps.supportZones[0][slot].push(n);
    t.engine._trackCard(n, 1, 'support', 0, slot).turnPlayed = 1;
  });
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : undefined; };
  t.policy.confirm = true;
  const r = await t.activateEquip(0, 0, 0);
  return { t, r, ps };
}
(async () => {
  const R = H.runner();
  for (const darion of [true, false]) {
    R.section(darion ? 'Gegner-Darion mit Stapel' : 'Kontrolle: normaler Held, drei getrennte Plaetze');
    const { t, ps } = await lauf(darion, ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']);
    const abl = t.pile(1, 'discardPile');
    R.check('alle drei Artifacts in der Ablage', ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'].every(n => abl.includes(n)), abl);
    R.check('Held traegt nichts mehr', ps.supportZones[0].every(z => z.length === 0), ps.supportZones[0]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Cloak of Edge im Stapel (zaehlt als Ability) bleibt liegen');
  {
    const { t, ps } = await lauf(true, ['Club of Gobbo', 'Cloak of Edge', 'Cute Crown']);
    const abl = t.pile(1, 'discardPile');
    R.check('Club und Crown abgeworfen', abl.includes('Club of Gobbo') && abl.includes('Cute Crown'), abl);
    R.check('Cloak of Edge bleibt liegen', ps.supportZones[0][1].join() === 'Cloak of Edge' && !abl.includes('Cloak of Edge'), [ps.supportZones[0], abl]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
