'use strict';
// S03-14 · Ultimate Weapon Experiment: ein per Charme/Diebstahl kontrollierter Held ist kein gültiger Wirt (der normale Aufstieg aus der Hand erlaubt ihn)
// Kartentext: „Search your deck for an Ascended Hero whose Ascension Conditions are fulfilled by a Hero **you control** and play it on top of that Hero."
// Vorgabe 29.9. (_engine.js ~49013 `performAscension`): „auch aus der HAND auf einen geliehenen Helden – bei JEDER echten Übernahme (Charme, Golden Apple, Styx …)".
// Aufbau: Sitz 1 hat „Legendary Explorer Dajan" in Held 0; Sitz 0 übernimmt ihn (`actionStealHero`), Gold 100 (Bedingung: 60+ Gold);
//   Sitz 0 hat „Dajan, Conqueror of the Treasure Cave" im Deck (Lauf A) bzw. auf der Hand (Lauf B, Kontrolle).
// Erwartet: In beiden Läufen steigt der geliehene Held auf.
// Beobachtet: Lauf B (Hand, `performAscension(…, { heroOwner: 1 })`) klappt; Lauf A: UWE ist nicht spielbar (`spellPlayCondition` ⇒ `kandidaten()` kennt nur `ps.heroes` der eigenen Spalte
//   und ruft `ascensionCondition(gs, pi, hi, engine, pi)` mit eigener Brettseite).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Dajan, Conqueror of the Treasure Cave'], []], hp: 800, gold: 100, deck: [['ZZ Dummy'], []] });
    t.setHero(1, 0, 'Legendary Explorer Dajan', 300);
    R.check('Ausgangslage: Held übernommen', t.engine.actionStealHero(0, 1, 0, {}) === true);
    await new Promise(r => setTimeout(r, 80));
    const res = await t.run(() => t.engine.performAscension(0, 0, 'Dajan, Conqueror of the Treasure Cave', 0, { heroOwner: 1 }));
    R.check('Kontrolle: normaler Aufstieg aus der Hand auf den geliehenen Helden klappt', res && res.success === true && t.gs.players[1].heroes[0].name === 'Dajan, Conqueror of the Treasure Cave', { res, name: t.gs.players[1].heroes[0].name });
  }
  {
    const t = await H.fresh({ hand: [['Ultimate Weapon Experiment'], []], hp: 800, gold: 100, deck: [['ZZ Dummy', 'Dajan, Conqueror of the Treasure Cave'], []] });
    t.setHero(1, 0, 'Legendary Explorer Dajan', 300);
    R.check('Ausgangslage: Held übernommen', t.engine.actionStealHero(0, 1, 0, {}) === true);
    await new Promise(r => setTimeout(r, 80));
    t.grantFor(0, 1, 'Ultimate Weapon Experiment');
    const r = await t.play(0, 'Ultimate Weapon Experiment', { hero: 1 });
    R.check('Ultimate Weapon Experiment steigt den übernommenen Helden auf', r === true && t.gs.players[1].heroes[0].name === 'Dajan, Conqueror of the Treasure Cave',
      { r, name: t.gs.players[1].heroes[0].name, hand: t.pile(0, 'hand'), grund: t.gs._cpuPlayFailReason });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
