'use strict';
// M01-22 · Capture: eine vom Gegner kontrollierte Kreatur auf der EIGENEN Brettseite (z. B. gestohlen) ist nicht wählbar, obwohl die Karte spielbar erscheint
// Kartentext: „Choose a level 1/2/3 or lower Creature your opponent controls and take permanent control of it. Place it in one of the user's free Support Zones."
// Aufbau: Sitz 0 Held 0 mit Fighting Lv1 und Capture auf der Hand. Sitz 0 besitzt „Arcane Eyes" (Lv1, Brett Seite 0 / Held 1); Sitz 1 stiehlt sie (`actionStealCreature(1, X)`: Besitzer 0, Kontrolleur 1).
// Erwartet: Capture ist spielbar, X wird zur Wahl angeboten und Sitz 0 kontrolliert sie danach wieder (Kontrolle statt Brettseite).
// Beobachtet: `canPlayWithHero` meldet „spielbar" (ihre `istZiel`-Prüfung nutzt den Kontrolleur), aber die Zielwahl (`promptDamageTarget({ side: 'enemy' })`) kennt nur die physische Gegnerseite: es wird kein Ziel angeboten, die Karte geht zurück auf die Hand, X bleibt beim Dieb.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const capture = require('../../../../cards/effects/capture.js');
  const t = await H.fresh({ hand: [['Capture'], []], hp: 800, abilities: { 0: { 0: [['Fighting'], [], []] } } });
  const x = t.put(0, 1, 0, 'Arcane Eyes');
  await t.engine.actionStealCreature(1, x); delete t.gs._chainResolvingLock;
  R.check('Vorbedingung: Besitzer 0, Kontrolleur 1', x.owner === 0 && x.controller === 1, { owner: x.owner, controller: x.controller });
  R.check('Gate: Capture gilt als spielbar', capture.canPlayWithHero(t.gs, 0, 0, {}, t.engine) === true);
  let offered = null;
  t.targetFn = (valid) => { offered = valid.filter(v => v.type === 'equip').map(v => v.id); return offered.slice(0, 1); };
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
  const r = await t.play(0, 'Capture', { hero: 0, noGrant: true });
  R.check('gespielt (vom Server behandelt)', r === true, r);
  R.check('die gestohlene Kreatur wird zur Wahl angeboten', Array.isArray(offered) && offered.length === 1, offered);
  R.check('Sitz 0 kontrolliert X wieder', x.controller === 0, x.controller);
  R.check('Capture liegt nicht mehr in der Hand', !t.pile(0, 'hand').includes('Capture'), t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
