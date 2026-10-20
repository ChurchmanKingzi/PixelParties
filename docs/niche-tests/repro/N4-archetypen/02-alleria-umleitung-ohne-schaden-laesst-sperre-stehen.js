'use strict';
// N4-archetypen-02 · Alleria: Umleitung eines Effekts OHNE Schaden lässt die Marke „nicht verringerbar/negierbar" stehen – der nächste fremde Treffer wird davon erfasst
// Kartentext (Alleria, the Queen of Spiders): „Once per turn, when your opponent chooses exactly 1 target you control for an Attack, Spell or Creature effect, you may redirect
//   that Attack, Spell or effect to any of your Heroes that has a Surprise in its Surprise Zone. If you do, that Attack's or Spell's damage cannot be reduced or negated, except by a Surprise."
// Erwartung: die Sperre betrifft nur den Schaden DIESER umgeleiteten Attacke/dieses Zaubers. Wird ein Effekt ohne Schaden umgeleitet (hier: Burning Skeleton brennt), gibt es keinen
//   solchen Schaden; ein späterer, unabhängiger Treffer (hier: Attacke von Sitz 0 gegen Carris, „Any damage this Hero would take becomes 0") bleibt von Carris auf 0 gesetzt.
// Beobachtet: Alleria setzt `gs._redirectedOnlyReducibleBySurprise = true` (alleria-the-queen-of-spiders.js:146); gelöscht wird sie nur vom NÄCHSTEN Heldenschaden irgendwo (_engine.js:8688).
//   Der trifft hier Carris als „nicht verringerbar/negierbar" (_engine.js:8897: Carris gilt nicht bei cannotBeNegated) – 150 Schaden statt 0.
// Gegenprobe: ohne die vorherige Umleitung setzt Carris die Attacke auf 0.
const H = require('../../lib/h.js');
async function lauf(mitUmleitung) {
  const heroes = [['Alleria, the Queen of Spiders', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], ['Carris, the Time Keeper', H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  const t = await H.fresh({ heroes, hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });
  t.gs.activePlayer = 1;
  t.putSurprise(0, 1, 'Spider Avalanche');                           // Surprise in Zone von Held 1 → gültiges Umleitungsziel
  t.put(0, 2, 0, H.INERT.big);
  if (mitUmleitung) {
    const bs = t.put(1, 1, 0, 'Burning Skeleton'); bs.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'confirm' && /Alleria/.test(d.title || ''), answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 1; t.phase(2);
    await t.activateCreature(1, 1, 0);
  }
  const vorher = t.hp(1, 0);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.hero(0, 2).atk = 150; t.hero(0, 2).baseAtk = 150;
  await t.play(0, 'Attack', { hero: 2 });   // Sitz 0, Held 2: „deal damage equal to the attacker's Attack stat" (150) gegen Carris
  return { t, verloren: vorher - t.hp(1, 0), umgeleitetGebrannt: !!t.hero(0, 1).statuses.burned, flag: t.gs._redirectedOnlyReducibleBySurprise };
}
(async () => {
  const R = H.runner();
  const k = await lauf(false);
  R.check('Gegenprobe (ohne Umleitung): Carris setzt die Attacke auf 0', k.verloren === 0, k.verloren);
  const u = await lauf(true);
  R.check('Aufbau: Umleitung hat stattgefunden (Held 1 brennt, nicht Alleria)', u.umgeleitetGebrannt, u.umgeleitetGebrannt);
  R.check('spätere, unabhängige Attacke: Carris setzt sie weiter auf 0 (nicht 150)', u.verloren === 0, { verloren: u.verloren });
  R.check('keine Engine-Fehler', u.t.errors.length === 0, u.t.errors);
  R.finish();
})();
