'use strict';
// F01-artifacts-01 · Cool Repair ignoriert die Ausrüstregeln (`canEquipToHero`) der geholten Ausrüstung
// Kartentext (Cool Repair): „Choose an equippable Artifact from your discard pile and equip it to a Hero you control without paying its Cost."
// Kartentext (Crusader's …): „You can only equip this card to "Cecilia, the Harrowing Crusader". A Hero can only be equipped with 1 "Crusader's" Artifact."
// Kartentext (Forbidden Grimoire …): „A Hero can only be equipped with 1 "Forbidden Grimoire of a Forgotten Sorceress"."
// Kartentext (Cloak of Edge): Ein Held trägt höchstens EINE Cloak (Skriptkopf: „nur ein Stack pro Ability").
// Aufbau: Sitz 0 hat Cool Repair auf der Hand und die Ausrüstung in der Ablage (100 Gold), alle Zonen des Zielhelden frei bzw. mit der ersten Kopie belegt.
// Erwartung: Der Handweg (`doPlayArtifact`) lehnt diese Fälle über `canEquipToHero` ab; Cool Repair darf sie ebenso nicht anlegen
//   (CARD_API.md: `engine.canEquipCardToHero` / `equipDestinations` sind der gemeinsame Weg).
// Beobachtet: Cool Repair legt (A) Crusader's Cutlass an Tushu (kein Cecilia), (B) ein zweites Grimoire, (C) eine zweite Cloak am selben Helden,
//   (D) ein zweites „Crusader's"-Artefakt an Cecilia an.
// Ursache: `cards/effects/cool-repair.js` `destTargets` (Schritt 3) prüft nur lebend/nicht eingefroren/freie Zone, nie `canEquipCardToHero`.
//   CARD_API.md (Z. 3793) vermerkt Cool Repair als „noch handgestrickt — bei der nächsten Berührung umstellen".
const H = require('../../lib/h.js');
const heroT = (owner, hi) => (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === hi); return h ? [h.id] : [valid[0].id]; };
(async () => {
  const R = H.runner();
  const GRIM = 'Forbidden Grimoire of a Forgotten Sorceress';
  R.section("A) Crusader's Cutlass an einen Nicht-Cecilia-Helden");
  {
    const t = await H.fresh({ hand: [['Cool Repair'], []], discard: [["Crusader's Cutlass"], []], gold: [100, 100] });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: "Crusader's Cutlass" }) });
    t.targetFn = heroT(0, 0);
    await t.play(0, 'Cool Repair', { hero: 0 });
    R.check("Crusader's Cutlass liegt NICHT an Tushu (nur Cecilia erlaubt)", !t.gs.players[0].supportZones[0].flat().includes("Crusader's Cutlass"), t.gs.players[0].supportZones[0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('B) zweites Forbidden Grimoire am selben Helden');
  {
    const t = await H.fresh({ hand: [['Cool Repair', GRIM], []], discard: [[GRIM], []], gold: [100, 100] });
    await t.play(0, GRIM, { hero: 0 });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: GRIM }) });
    t.targetFn = heroT(0, 0);
    await t.play(0, 'Cool Repair', { hero: 0 });
    const n = t.gs.players[0].supportZones[0].flat().filter(x => x === GRIM).length;
    R.check('höchstens 1 Grimoire je Held', n === 1, n);
  }
  R.section('C) zweite Cloak of Edge am selben Helden');
  {
    const t = await H.fresh({ hand: [['Cool Repair', 'Cloak of Edge'], []], discard: [['Cloak of Edge'], []], gold: [100, 100] });
    await t.play(0, 'Cloak of Edge', { hero: 0 });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Cloak of Edge' }) });
    t.targetFn = heroT(0, 0);
    await t.play(0, 'Cool Repair', { hero: 0 });
    const n = t.gs.players[0].supportZones[0].flat().filter(x => x === 'Cloak of Edge').length;
    R.check('höchstens 1 Cloak je Held', n === 1, n);
  }
  R.section(`D) zweites „Crusader's"-Artefakt an Cecilia`);
  {
    const t = await H.fresh({ heroes: [['Cecilia, the Harrowing Crusader', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined],
      hand: [['Cool Repair', "Crusader's Cutlass"], []], discard: [["Crusader's Hookshot"], []], gold: [100, 100] });
    await t.play(0, "Crusader's Cutlass", { hero: 0 });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: "Crusader's Hookshot" }) });
    t.targetFn = heroT(0, 0);
    await t.play(0, 'Cool Repair', { hero: 0 });
    const n = t.gs.players[0].supportZones[0].flat().filter(x => x.includes("Crusader's")).length;
    R.check(`höchstens 1 „Crusader's"-Artefakt je Held`, n === 1, t.gs.players[0].supportZones[0]);
  }
  R.finish();
})();
