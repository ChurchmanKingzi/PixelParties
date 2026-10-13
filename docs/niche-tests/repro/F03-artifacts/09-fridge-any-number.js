'use strict';
// F03-artifacts-09 · Slippery Fridge verschiebt genau EINE Ausrüstung, der Kartentext sagt „any number"
// Kartentext (data/cards.json): „Choose any number of Artifacts equipped to a Hero and equip them to a different Hero the same player controls (without paying their Cost again)."
// Skriptkopf (slippery-fridge.js): „Choose an Equip Artifact … move it" / „Moves exactly ONE Equip Artifact" – der Wortlaut des Skripts ist älter als der Kartentext.
// Erwartung: Held 0 trägt Warhorse + The Master's Sword; mit einer Fridge lassen sich beide (any number) an Held 1 hängen.
// Beobachtet (✗): Die Auswahl ist auf 1 begrenzt (`maxTotal: 1`, `maxPerType.equip: 1`); selbst wenn zwei IDs gewählt werden, wandert nur die erste; Held 0 behält die zweite.
// Ursache: `cards/effects/slippery-fridge.js` resolve() (Schritt 2, Z. ~227: `maxTotal: 1`, danach `pickedIds[0]`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SF = 'Slippery Fridge';
  const t = await H.fresh({ hand: [['Warhorse', "The Master's Sword", SF], []], gold: 100 });
  await t.play(0, 'Warhorse', { hero: 0, slot: 0 });
  await t.play(0, "The Master's Sword", { hero: 0, slot: 1 });
  let cfgMax = null;
  t.targetFn = (valid, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === SF) { cfgMax = cfg.maxTotal; return valid.filter(v => v.type === 'equip' && v.heroIdx === 0).map(v => v.id); }   // beide wünschen
    if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
    return undefined;
  };
  await t.play(0, SF);
  const n0 = [0, 1, 2].filter(s => t.zone(0, 0, s)).length, n1 = [0, 1, 2].filter(s => t.zone(0, 1, s)).length;
  R.check('Fridge erlaubt die Wahl mehrerer Ausrüstungen (maxTotal > 1)', (cfgMax ?? 1) > 1, cfgMax);
  R.check('beide Ausrüstungen liegen danach bei Held 1', n0 === 0 && n1 === 2, { n0, n1 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
