'use strict';
// C04-01 · Sleeping Beauty ist nie aktivierbar: sie liest den alten Held-HOPT-Schlüssel
// Kartentext: „When you summon this Creature, choose a Hero you permanently control. Once per turn, if that Hero has used its active effect this turn,
//   this Creature may use that effect as if it was its own. …"
// Erwartung: Hat der verlinkte Held (hier Elana, the Rocky Rebel) seinen aktiven Effekt in diesem Zug benutzt, ist die Beauty aktivierbar und führt den Effekt aus.
// Beobachtet: Die Beauty ist NIE aktivierbar. `canActivateCreatureEffect` prüft `gs.hoptUsed['hero-effect:<Name>:<pi>:<heroIdx>']` (alter Schlüssel mit Held-Index),
//   der Server stempelt seit v1275 aber `engine.heroHoptKey(name, pi)` = `hero-effect:<Name>:<pi>` (ohne Index). Gegenprobe: stempelt man zusätzlich den alten
//   Schlüssel, läuft die Beauty durch.
// Ursache: cards/effects/sleeping-beauty.js:161 (und der Kopfkommentar Z. 20); Schlüsselbildung in cards/effects/_engine.js:29770 (`heroHoptKey`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ELANA = 'Elana, the Rocky Rebel';   // einfacher aktiver Heldeneffekt (Hand zurückmischen, +1 ziehen)
  const t = await H.fresh({ heroes: [[ELANA, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], hand: [['Sleeping Beauty', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []] });
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return v ? [v.id] : undefined; };   // Link auf Elana
  await t.play(0, 'Sleeping Beauty', { hero: 1 });
  const sb = t.find('Sleeping Beauty', 'support');
  sb.turnPlayed = 1;                                   // keine Beschwörungsstarre
  R.check('Aufbau: Beauty ist mit Elana (Held 0) verlinkt', sb.counters._linkedHeroIdx === 0, sb.counters);
  const hr = await t.activateHero(0, 0, {});            // Elana benutzt ihren Effekt (echter Weg)
  R.check('Aufbau: Elana hat ihren Effekt benutzt', hr === true && Object.keys(t.gs.hoptUsed).some(k => k.startsWith('hero-effect:' + ELANA)), { hr, hopt: Object.keys(t.gs.hoptUsed) });
  t.setHand(0, ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']);
  t.gs.activePlayer = 0; t.phase(2);
  const handVorher = t.pile(0, 'hand').length;
  const ar = await t.activateCreature(0, 1, sb.zoneSlot);
  R.check('Beauty führt den Elana-Effekt aus (Aktivierung gelingt, Hand wird neu gezogen)', ar === true, { ar, hopt: Object.keys(t.gs.hoptUsed) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
