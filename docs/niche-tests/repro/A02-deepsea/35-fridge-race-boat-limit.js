'use strict';
// A02-deepsea-35 · Slippery Fridge umgeht „A Hero can only have 1 Race Boat": zwei Boote an einem Helden
//
// Kartentext (Race Boats): „A Hero can only have 1 "Race Boat" Artifact equipped to it." · Slippery Fridge „… equip them to a different Hero the same player controls (without paying their Cost again)."
// Aufbau: Held 0 trägt Frog Race Boat, Held 1 trägt Whale Race Boat (beide über den echten Ausrüst-Weg). Fridge verschiebt das Frog Race Boat von Held 0 an Held 1.
// Erwartung: Ziel Held 1 wird nicht angeboten bzw. der Zug scheitert (Boot bleibt bei Held 0), wie beim zweiten Boot per Hand (`canEquipToHero`).
// Beobachtet (✗): Held 1 trägt danach zwei Race Boats. Gleiche Wurzel wie F03-08 (Wanted Poster, Vampiric Sword); dort steht „Race Boats … nicht einzeln durchprobiert".
// Ursache: `slippery-fridge.js` Schritt 3 (`destTargets`) fragt weder `engine.canEquipCardToHero` noch `canEquipToHero` des Boots (`_race-boat-shared.js` heroHasRaceBoat).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SF = 'Slippery Fridge';
  const t = await H.fresh({ hand: [['Frog Race Boat', 'Whale Race Boat', SF], []], gold: 200 });
  const a = await t.play(0, 'Frog Race Boat', { hero: 0, slot: 0 });
  const b = await t.play(0, 'Whale Race Boat', { hero: 1, slot: 0 });
  const count = (hi) => [0, 1, 2, 3].filter(s => /Race Boat$/.test(t.zone(0, hi, s) || '')).length;
  R.check('Aufbau: Held 0 und Held 1 tragen je 1 Race Boat', a === true && b === true && count(0) === 1 && count(1) === 1, [count(0), count(1)]);
  t.targetFn = (valid, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === SF) { const v = valid.find(v => v.type === 'equip' && v.cardName === 'Frog Race Boat' && v.heroIdx === 0); return v ? [v.id] : undefined; }
    if (/Slippery Fridge — Move/.test(ti)) { const v = valid.find(v => v.type === 'equip' && v.heroIdx === 1) || valid.find(v => v.type === 'hero' && v.heroIdx === 1); return v ? [v.id] : undefined; }
    return undefined;
  };
  await t.play(0, SF);
  R.check('kein Held trägt 2 Race Boats', [0, 1, 2].every(h => count(h) <= 1), [0, 1, 2].map(count));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
