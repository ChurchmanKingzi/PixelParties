// A08-18 · Trial of Coolness: Zielwahl einer seitenfremden Kreatur (Besitzer ≠ Brettseite) legt das Extraleben auf eine ANDERE Kreatur des Gegners
//
// Kartentext: „Choose a target you control, except the user. The next time that target is defeated, immediately revive it and fully heal its HP."
// Aufbau: Sitz 0 hat „ZZ Dummy" (Held 0 / Slot 0) und spielt Plant Golem (Besitzer 0, Kontrolleur 1, steht auf Seite 1 / Held 0 / Slot 0). Echter Zugwechsel zu Sitz 1.
//   Sitz 1 spielt Trial of Coolness mit Held 1 (Held 0 trägt den Golem und ist gesperrt) und wählt den Plant Golem (Id `equip-0-0-0`, weil `owner` 0 als Brettspalte dient).
// Erwartung: der Golem (von Sitz 1 kontrolliert) trägt das Extraleben; Sitz 0 erhält nichts.
// Beobachtet: `trial-of-coolness.js` ~Z. 164 sucht die Instanz mit `c.zone === 'support' && c.owner === target.owner && heroIdx && zoneSlot` – ohne Kontrolleur, ohne Name – und trifft
//   die gleichnamig-koordinierte EIGENE Kreatur von Sitz 0. Sie erhält die Marke (und der Golem nicht). (Hinweis: audit() meldet hier Fehlalarme für seitenfremde Kreaturen, nicht auswerten.)
// Aufruf: node docs/niche-tests/repro/A08-pacman/18-coolness-extraleben-auf-falsche-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [[], []] });
  const own = t.put(0, 0, 0, D); own.turnPlayed = 1;
  t.grantFor(0, 0, 'Plant Golem');
  await t.play(0, 'Plant Golem', { hero: 0, slot: 1 });
  const g = t.inst(x => x.name === 'Plant Golem' && x.zone === 'support')[0];
  R.check('Aufbau: Golem gehört 0, wird von 1 kontrolliert', g && g.owner === 0 && g.controller === 1, g && [g.owner, g.controller, g.heroIdx, g.zoneSlot]);
  await t.endTurn();
  t.targetFn = (v) => [v.find(x => x.cardName === 'Plant Golem').id];
  const r = await t.play(1, 'Trial of Coolness', { hero: 1 });
  R.note('Spielweg', JSON.stringify({ r }));
  R.check('Golem (Ziel) trägt das Extraleben', !!(g.counters && g.counters._extraLife), JSON.stringify(g.counters));
  R.check('die fremde Kreatur von Sitz 0 trägt KEIN Extraleben', !(own.counters && own.counters._extraLife), JSON.stringify(own.counters));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
