'use strict';
// H01-heroes-17 · Brackle: das Opfer selbst ist als Schadensziel wählbar – danach liegt die Karte doppelt in der Ablage
//
// Kartentext: „You may once per turn sacrifice a Creature you control that was not summoned this turn to choose a target and deal damage to it equal
//   to the sacrificed Creature's current HP, to a maximum of 300. This is treated as an Attack."
// Erwartet: Das Opfer verlässt das Brett VOR der Zielwahl (und ist damit kein mögliches Ziel); die Kartenbilanz stimmt (1 Karte → 1 Ablageeintrag).
// Beobachtet: Die Zielliste (`valid`) der Schadenswahl enthält das zu opfernde Wesen (`equip` Sitz 0 / Held 1 / Slot 0). Wählt man es, nimmt es seinen eigenen
//   Schaden (stirbt, `creature_destroyed` → Ablage) und das anschließende Opfern (`destroy`) legt es ein zweites Mal ab: „ZZ Dummy" liegt 2× in der
//   Ablage, `censusDiff` meldet „+1".
// Ursache: `brackle-the-catapulting-turtle.js` – „destroyCard fires AFTER the damage lands" (Kopfkommentar): das Opfer bleibt während Zielwahl und Schaden auf dem Brett;
//   weder die Zielliste filtert es heraus noch prüft das spätere `destroy`, ob es schon tot/abgelegt ist.
const H = require('../../lib/h.js');
const BR = 'Brackle, the Catapulting Turtle';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[BR, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
  t.setAbilities(0, 0, [[], [], []]);
  const cr = t.put(0, 1, 0, H.INERT.creature); cr.turnPlayed = 1; cr.counters.currentHp = 200;
  const vorher = t.census();
  let angeboten = null;
  t.targetFn = (valid) => {
    if (valid.every(v => v.type === 'equip')) return [valid[0].id];                         // Opferwahl
    const selbst = valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 1);
    angeboten = !!selbst;
    return [(selbst || valid.find(v => v.type === 'hero' && v.owner === 1)).id];           // Schadenswahl: das Opfer selbst
  };
  const r = await t.activateHero(0, 0, {});
  R.check('Aufbau: Heldeneffekt lief', r === true, r);
  R.check('das Opfer ist in der Schadenswahl NICHT mehr als Ziel angeboten', angeboten === false, angeboten);
  R.check('Kartenbilanz: genau 1 Karte in der Ablage (keine Duplikate)', t.pile(0, 'discardPile').length === 1, t.pile(0, 'discardPile'));
  R.check('Bilanz ohne Differenz', t.censusDiff(vorher, t.census()).length === 0, t.censusDiff(vorher, t.census()));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
