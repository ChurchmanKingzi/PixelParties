// H02-heroes-13 · Fiona, the Empty Vessel – „That Spell's level is reduced by 3" gilt für jede Kopie derselben Karte in der Hand (Ruling: nur die geholte Kopie)
//
// Kartentext: „Once per turn, you may choose any Spell from your deck, reveal it and add it to your hand. That Spell's level is reduced by 3 for the rest of the turn."
// Skriptkopf (fiona-the-empty-vessel-…js): „Die Reduktion gilt NUR fuer die eine geholte Kopie (Als Ruling 30.8.)" – Handindex-Rabatt `_handLevelOffsetsTransient`.
// Aufbau: Held 0 = Fiona (ohne Destruction Magic), Hand [Fireball], Deck mit Fireball. Fiona holt den zweiten Fireball (Index 1, Rabatt −3).
//   Gespielt wird der UNVERBILLIGTE Fireball (handIndex 0).
// Erwartung: Fireball (Lv1, Destruction Magic) ist für diese Kopie nicht spielbar (Held ohne Schule). Beobachtung: wird gespielt (Gegner −150) –
//   `validateActionPlay` (_engine.js ~20690) ruft `heroMeetsLevelReq(heroOwner, heroIdx, cardData)` OHNE `handIdx`; der Offset-Scan (~43649) nimmt die günstigste Kopie nach NAMEN.
//   (Dieselbe Engine-Stelle trägt Rocky Slime, Sparkfly Queen u. a. Kopien-Rabatte.)
// Aufruf: node docs/niche-tests/repro/H02-heroes/13-fiona-vessel-rabatt-gilt-fuer-jede-kopie.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const FV = 'Fiona, the Empty Vessel of a Forgotten Sorceress';
(async () => {
  const R = H.runner();
  // Kontrolle: ohne Fiona-Rabatt ist Fireball für diesen Helden nicht spielbar.
  { const t = await H.fresh({ heroes: [[FV, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Kontrolle: Fireball ohne Rabatt, ohne Schule nicht spielbar', r === false && t.hp(1, 0) === 800, { r, hp: t.hp(1, 0) }); }
  const t = await H.fresh({ heroes: [[FV, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []], deck: [['Fireball', 'ZZ Dummy', 'ZZ Dummy'], []] });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === FV, answer: () => ({ cardName: 'Fireball' }), once: true });
  const a = await t.activateHero(0, 0, { effect: FV });
  R.note('Fiona aktiviert →', a);
  R.note('Hand / Rabatt-Map', [t.pile(0, 'hand'), t.gs.players[0]._handLevelOffsetsTransient]);
  R.check('Fiona hat den Fireball geholt (Hand: 2 Fireball, Rabatt auf Index 1)', t.pile(0, 'hand').length === 2 && t.gs.players[0]._handLevelOffsetsTransient?.[1] === -3, t.gs.players[0]._handLevelOffsetsTransient);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true, handIndex: 0 });   // die Kopie OHNE Rabatt
  R.check('die unverbilligte Kopie (Index 0) bleibt unspielbar', !(r === true && t.hp(1, 0) < 800), { r, gegnerHp: t.hp(1, 0), hand: t.pile(0, 'hand'), rabatt: t.gs.players[0]._handLevelOffsetsTransient });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
