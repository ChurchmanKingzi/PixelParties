'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-20 · Nomu (dauerhaft übernommen): Extra-Zug und Handlimit-Freiheit gehören weiter dem ALTEN Besitzer, nicht dem Kontrolleur
//
//  Karte: Nomu, Wanderer of Worlds (`cards/effects/nomu-wanderer-of-worlds.js`, `isNomuHero`/`bypassHandLimit`), Engine-Leser `_hasActiveNomu` (`_engine.js:28839`) und
//         `_shouldBypassHandLimit` (`_engine.js:28895`)
//  Kartentext: „Up to 3 times per turn, when **you** draw exactly 1 card, except through this effect: Draw 1 additional card from your deck. **You** have no hand size limit."
//  Aufbau: Sitz 1 besitzt Nomu (Held 0); Sitz 0 übernimmt ihn dauerhaft (`actionTakeHeroPermanently`, Paraseed-Weg). „You" = der Spieler, der Nomu kontrolliert (Sitz 0).
//  Erwartung: Sitz 0 zieht 1 Karte → 2; Sitz 0 hat am Zugende kein Handlimit; Sitz 1 (hat Nomu nicht mehr) zieht normal und unterliegt dem Handlimit.
//  Beobachtung (✗): Beide Leser laufen über `gs.players[playerIdx].heroes` (die Brettseite): Sitz 1 behält den Extra-Zug und die Handlimit-Freiheit, Sitz 0 bekommt sie nicht.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/20-nomu-uebernommen-wirkt-fuer-den-alten-besitzer.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const NOMU = 'Nomu, Wanderer of Worlds';
  const t = await H.fresh({ heroes: [['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Demigod'], [NOMU, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief']], hp: 600,
    deck: [Array(30).fill('Heal'), Array(30).fill('Heal')], hand: [Array(10).fill('Heal'), Array(10).fill('Heal')] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));
  R.note('Kontrolleur von Nomu', t.engine.heroSideOf(1, t.hero(1, 0)));
  const vor0 = t.pile(0, 'hand').length, vor1 = t.pile(1, 'hand').length;
  await t.run(() => t.engine.actionDrawCards(0, 1, { source: 'ZZ' }));
  await t.run(() => t.engine.actionDrawCards(1, 1, { source: 'ZZ' }));
  const g0 = t.pile(0, 'hand').length - vor0, g1 = t.pile(1, 'hand').length - vor1;
  R.note('gezogen', { sitz0: g0, sitz1: g1 });
  R.check('Sitz 0 (Kontrolleur) bekommt den Extra-Zug (2 Karten)', g0 === 2, g0);
  R.check('Sitz 1 (alter Besitzer) bekommt ihn nicht mehr (1 Karte)', g1 === 1, g1);
  R.note('Handlimit-Freiheit', { sitz0: t.engine._shouldBypassHandLimit(0), sitz1: t.engine._shouldBypassHandLimit(1) });
  R.check('Sitz 0 hat kein Handlimit', t.engine._shouldBypassHandLimit(0) === true, t.engine._shouldBypassHandLimit(0));
  R.check('Sitz 1 hat wieder ein Handlimit', t.engine._shouldBypassHandLimit(1) === false, t.engine._shouldBypassHandLimit(1));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
