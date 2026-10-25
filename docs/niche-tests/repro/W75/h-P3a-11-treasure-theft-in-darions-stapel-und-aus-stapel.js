'use strict';
// W75 · Darion (Audit P3a) — Treasure Theft: (A) Darion als NUTZER bekommt das gestohlene Equip in seinen Stapel, ohne Zonenfrage und auch ohne freie Zone; (B) aus einem gegnerischen Darion-Stapel
// wird genau die gewaehlte Karte gestohlen (unterste / mittlere / oberste), die uebrigen bleiben liegen.
// Kartentext Treasure Theft: „Choose an Artifact equipped to a Hero your opponent controls and equip it to the user."
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-11-treasure-theft-in-darions-stapel-und-aus-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
const T = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();

  R.section('A: Darion (Nutzer) mit Stapel Club/Blade und ohne freie Zone stiehlt Cute Crown von Tushu');
  {
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [T, null, null]], hand: [['Treasure Theft', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const ps = t.gs.players[0];
    ps.supportZones[0][1] = [];
    for (const n of NAMEN.slice(0, 2)) { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; }
    t.put(0, 0, 0, K); t.put(0, 0, 2, K);
    const c = t.put(1, 0, 0, 'Cute Crown'); c.turnPlayed = 1;
    const zonenFragen = [];
    t.script.push({ match: d => d.type === 'zonePick', answer: () => { zonenFragen.push(1); return null; } });
    t.targetFn = (valid, cfg) => {
      zonenFragen.push(cfg && cfg.title);
      return [(valid.find(v => v.type === 'equip' && v.owner === 1) || valid[0]).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Treasure Theft', { hero: 0 });
    await t.drain();
    R.note('lauf', JSON.stringify({ zonen: ps.supportZones[0], tushu: t.gs.players[1].supportZones[0], fragen: zonenFragen }));
    R.check('Cute Crown liegt als dritte Karte in Darions Stapel', JSON.stringify(ps.supportZones[0][1]) === JSON.stringify(NAMEN), ps.supportZones[0]);
    R.check('Tushu hat sie verloren', t.gs.players[1].supportZones[0].every(z => z.length === 0), t.gs.players[1].supportZones[0]);
    R.check('keine Zonenfrage fuer den Stapel (nur die Artefaktwahl)', zonenFragen.filter(x => typeof x === 'string' && /Equip/.test(x)).length === 0, zonenFragen);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }

  for (let wahl = 0; wahl < 3; wahl++) {
    R.section(`B: aus Darions gegnerischem Stapel wird die ${['unterste', 'mittlere', 'oberste'][wahl]} Karte gestohlen`);
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [['Treasure Theft', F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const ps1 = t.gs.players[1];
    ps1.supportZones[0][1] = [];
    const insts = NAMEN.map(n => { ps1.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; return i; });
    t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: insts[wahl].id }) });
    t.targetFn = (valid) => [(valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1) || valid[0]).id];
    t.policy.confirm = true;
    await t.play(0, 'Treasure Theft', { hero: 0 });
    await t.drain();
    const rest = NAMEN.filter((_, i) => i !== wahl);
    R.note('lauf', JSON.stringify({ darion: ps1.supportZones[0][1], tushu: t.gs.players[0].supportZones[0] }));
    R.check('genau die gewaehlte Karte liegt jetzt bei Tushu', t.gs.players[0].supportZones[0].flat().join() === NAMEN[wahl], t.gs.players[0].supportZones[0]);
    R.check('die beiden anderen bleiben in Darions Stapel', JSON.stringify(ps1.supportZones[0][1]) === JSON.stringify(rest), ps1.supportZones[0][1]);
    R.check('Instanz der gestohlenen Karte gehoert Tushu (Sitz 0)', insts[wahl].heroIdx === 0 && insts[wahl].owner === 0, [insts[wahl].heroIdx, insts[wahl].owner]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
