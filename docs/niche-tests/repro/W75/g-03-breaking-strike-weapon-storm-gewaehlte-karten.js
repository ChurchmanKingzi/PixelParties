'use strict';
// W75 · Darion — Abwurf-Kosten (Breaking Strike, Weapon Storm) werfen genau die im Stapel GEWAEHLTEN Karten ab (Befund Al: „entfernt wird IMMER das oberste Equip").
// Kartentext Breaking Strike: „Discard any number of Artifacts equipped to the user and choose a target. This Attack deals the user's Attack stat times the number of discarded Artifacts to that target."
// Erwartet: gewaehlt werden nacheinander die MITTLERE und dann die UNTERSTE Karte; die oberste bleibt im Stapel. Aufruf: node docs/niche-tests/repro/W75/g-03-breaking-strike-weapon-storm-gewaehlte-karten.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  for (const karte of ['Breaking Strike', 'Weapon Storm']) {
    R.section(karte + ': Mitte, dann Unterste abwerfen');
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[karte, F], [F]], gold: 500 });
    const ps = t.gs.players[0];
    ps.supportZones[0][1] = [];
    const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; return i; });
    const reihenfolge = [insts[1], insts[0]];
    let n = 0;
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: (reihenfolge[n++] || insts.find(i => i.zone === 'support')).id }) });
    let ziel = 0;
    t.targetFn = (valid, config) => {
      const eq = valid.filter(v => v.type === 'equip' && v.owner === 0);
      if (config && config._abilityCost) return ziel++ < 2 && eq.length ? [eq[0].id] : null;   // nach zwei Karten: „Done"
      if (eq.length && false) return [eq[0].id];
      return [(valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, karte, { hero: 0 });
    await t.drain();
    R.note('prompts', JSON.stringify(t.prompts.map(p => p.d.type + ':' + (p.d.title || ''))));
    R.note('zone', JSON.stringify(ps.supportZones[0][1]) + ' | Ablage ' + JSON.stringify(t.pile(0, 'discardPile')));
    R.check('Mitte und Unterste abgeworfen, oberste bleibt', insts[1].zone !== 'support' && insts[0].zone !== 'support' && insts[2].zone === 'support', insts.map(i => i.name + ':' + i.zone));
    R.check('Rest des Stapels im Zustand', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify([NAMEN[2]]), ps.supportZones[0][1]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
