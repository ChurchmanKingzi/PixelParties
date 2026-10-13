// H02-heroes-26 · Legendary Explorer Dajan: das Deck-Ausrüsten umgeht Ausrüst-Sperren der Karte („A Hero can only have 1 Race Boat")
//
// Kartentext Dajan: „You may once per turn spend your Action to choose an Artifact from your deck and play it immediately. You must still pay the Artifact's Cost, but it is reduced by 10."
// Kartentext Frog Race Boat: „A Hero can only have 1 "Race Boat" Artifact equipped to it." (Skript-Vertrag `canEquipToHero`, `engine.canEquipCardToHero`)
// Dajans `_playEquip` fragt `canEquipCardToHero` nur für FREMDE Ausrüst-Helden (`fremdAusruestHelden`), nicht für die eigenen.
// Erwartung: Held 0 trägt schon ein Frog Race Boat → seine freien Zonen werden nicht angeboten; ein zweites Race Boat landet nicht an Held 0 (Kontrolle: der Handweg lehnt ab).
// Beobachtung: die Zonen von Held 0 stehen zur Wahl, das zweite Race Boat wird ausgerüstet.
// Aufruf: node docs/niche-tests/repro/H02-heroes/26-dajan-explorer-race-boat-limit.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const DJ = 'Legendary Explorer Dajan';
const BOAT = 'Frog Race Boat';
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ heroes: [[DJ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], gold: 100, hand: [[BOAT], []] });
    t.put(0, 0, 0, BOAT);
    const r = await t.play(0, BOAT, { hero: 0, slot: 1 });
    R.check('Kontrolle: Handweg lehnt ein zweites Race Boat an Held 0 ab', r === false, r); }
  { const t = await H.fresh({ heroes: [[DJ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], gold: 100, deck: [[BOAT, 'ZZ Dummy', 'ZZ Dummy'], []] });
    t.put(0, 0, 0, BOAT);
    let angeboten = [];
    t.targetFn = (valid) => { angeboten = valid.map(v => `${v.heroIdx}.${v.slotIdx ?? 'h'}`); const z = valid.find(v => v.type === 'equip' && v.heroIdx === 0); return z ? [z.id] : null; };
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === DJ, answer: () => ({ cardName: BOAT }) });
    await t.activateHero(0, 0, { effect: DJ, phase: 3 });
    const boote = t.inst(c => c.name === BOAT && c.zone === 'support' && c.owner === 0 && c.heroIdx === 0).length;
    R.check('Dajan: Zonen von Held 0 (mit Race Boat) nicht angeboten', !angeboten.some(a => a.startsWith('0.')), angeboten);
    R.check('Dajan: Held 0 trägt höchstens 1 Race Boat', boote <= 1, { boote });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
