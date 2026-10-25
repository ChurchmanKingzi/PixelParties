'use strict';
// W75 · Darion · P6 (`_equip-shared.umhaengFreieZonen` / `fuehreUmhaengenAus`, Baustein von Slippery Fridge UND Inheritance Ceremony) — Werden MEHRERE Equips in einem Zug zu einem Darion umgehaengt,
// kommen sie alle in EINEN Platz (den liegenden Stapel, sonst den Platz des ersten Equips dieses Zuges); vorher blockierte der reservierte Stapelplatz das zweite Equip (Fridge) bzw. die
// Equips verteilten sich auf verschiedene freie Zonen (zwei, drei Plaetze statt einem).
// Kartentext Slippery Fridge: „Choose any number of Equip Artifacts on the board and move them to a different Hero of the same controller (without paying Cost again)."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: (1) Fridge: Club/Blade/Crown von Tushu zu einem leeren Darion -> alle drei in EINEM Platz; (2) Darion hat schon einen Stapel und ein volles Brett, zwei weitere Equips wandern
// hin -> beide im Stapel; (3) Namen-Array und Instanzen bleiben konsistent (`t.audit()`).
// Aufruf: node docs/niche-tests/repro/W75/h-P6-05-umhaengen-mehrere-equips-zu-darion-ein-platz.js   (Exit 0 = korrekt)
const U = require('../../lib/umhaengen.js');
const { H } = U;
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper';
const EQ = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
const belegt = (t, hi) => t.gs.players[0].supportZones[hi].map(z => z.slice());
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
(async () => {
  const R = H.runner();

  R.section('1) Fridge: drei Equips von Tushu zu einem leeren Darion -> ein Platz');
  {
    const t = await U.fresh(0, { heroes: { 0: [T, D, 'Zwei, the Lucky Thief'] } });
    EQ.forEach((n, i) => { const x = t.put(0, 0, i, n); x.turnPlayed = 1; });
    const r = await U.bewege(t, 0, 'fridge', { nach: 1 });
    await t.drain();
    R.note('lauf', JSON.stringify({ r, tushu: belegt(t, 0), darion: belegt(t, 1), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }));
    const d = belegt(t, 1);
    const plaetze = d.filter(z => z.length);
    R.check('alle drei Equips liegen bei Darion', d.flat().length === 3 && EQ.every(n => d.flat().includes(n)), d);
    R.check('in EINEM Platz', plaetze.length === 1, d);
    R.check('Tushu ist leer', belegt(t, 0).flat().length === 0, belegt(t, 0));
    R.check('Instanzen: drei, alle im selben Platz bei Darion', (() => { const i = t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 1); return i.length === 3 && new Set(i.map(c => c.zoneSlot)).size === 1; })());
    R.check('Sauber', sauber(t), [t.errors, t.audit()]);
  }

  R.section('2) Fridge: Darion hat Stapel + volles Brett, zwei weitere Equips wandern hin');
  {
    const t = await U.fresh(0, { heroes: { 0: [T, D, 'Zwei, the Lucky Thief'] } });
    // Darion: Stapel in Platz 0, Kreaturen in Platz 1 und 2 (kein freier Platz)
    t.gs.players[0].supportZones[1][0] = [];
    for (const n of ['Glass Sword']) { t.gs.players[0].supportZones[1][0].push(n); const i = t.engine._trackCard(n, 0, 'support', 1, 0); i.turnPlayed = 1; }
    t.put(0, 1, 1, H.INERT.creature); t.put(0, 1, 2, H.INERT.creature);
    ['Club of Gobbo', 'Cute Crown'].forEach((n, i) => { const x = t.put(0, 0, i, n); x.turnPlayed = 1; });
    // gewaehlt werden nur die Equips von Tushu (Held 0); Ziel ist jeweils ein Klick auf Darion (Held 1)
    t.targetFn = (v, cfg) => {
      const ti = (cfg && cfg.title) || '';
      if (ti === 'Slippery Fridge') return v.filter(x => x.type === 'equip' && x.owner === 0 && x.heroIdx === 0).map(x => x.id);
      const h = v.find(x => x.type === 'hero' && x.heroIdx === 1) || v.find(x => x.type === 'equip' && x.heroIdx === 1);
      return h ? [h.id] : undefined;
    };
    await t.play(0, 'Slippery Fridge', { hero: 0, active: 0 });
    await t.drain();
    const d = belegt(t, 1);
    R.note('lauf', JSON.stringify({ tushu: belegt(t, 0), darion: d }));
    R.check('beide Equips im Stapel von Darion (Platz 0)', JSON.stringify(d[0]) === JSON.stringify(['Glass Sword', 'Club of Gobbo', 'Cute Crown']) || JSON.stringify(d[0]) === JSON.stringify(['Glass Sword', 'Cute Crown', 'Club of Gobbo']), d);
    R.check('Tushu ist leer', belegt(t, 0).flat().length === 0, belegt(t, 0));
    R.check('Sauber', sauber(t), [t.errors, t.audit()]);
  }
  R.finish();
})();
