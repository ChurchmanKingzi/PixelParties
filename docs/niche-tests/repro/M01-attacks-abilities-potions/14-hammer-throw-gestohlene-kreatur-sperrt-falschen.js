'use strict';
// M01-14 · Hammer Throw auf eine gestohlene Kreatur sperrt den ANGREIFER selbst statt des Kontrolleurs
// Kartentext: „… The TARGET'S CONTROLLER must delete a card from their hand whenever they play an Artifact during their next turn."
// Aufbau: Seed 1234, Zug 5; Sitz 1 hat eine Kreatur von Sitz 0 gestohlen (Besitzer 0, Kontrolleur 1, steht physisch weiter bei Sitz 0 / Held 1);
// Sitz 0 trifft diese Kreatur mit Hammer Throw.
// Erwartet: Sitz 1 (Kontrolleur) ist „itemLocked" (muss im nächsten Zug bei jedem Artefakt eine Karte löschen); Sitz 0 nicht.
// Beobachtet: Sitz 0 (der Angreifer selbst) ist itemLocked, Sitz 1 nicht.
// Ursache: `hammer-throw.js` (~Z. 140): `const oppIdx = tgtOwner;` – `target.owner` ist die physische Brettseite, nicht der Kontrolleur.
// Harness-Hinweis: `actionStealCreature` von außen hinterlässt `gs._chainResolvingLock`; wird hier gelöscht, sonst lehnt der Server jede Karte ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Hammer Throw', 'ZZ Filler'], ['ZZ Filler']], hp: 800 });
  const c = t.put(0, 1, 0, H.INERT.creature);
  await t.engine.actionStealCreature(1, c);
  delete t.gs._chainResolvingLock;
  R.note(`Kreatur: Besitzer ${c.owner}, Kontrolleur ${c.controller}, physische Seite ${t.engine.physicalSide(c)}`);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip').id];
  const r = await t.play(0, 'Hammer Throw', { hero: 0 });
  R.note(`r=${r}; itemLocked Sitz 0 (Angreifer) = ${t.gs.players[0].itemLocked}; itemLocked Sitz 1 (Kontrolleur) = ${t.gs.players[1].itemLocked}`);
  R.check('Kontrolleur (Sitz 1) ist itemLocked', t.gs.players[1].itemLocked === true, t.gs.players[1].itemLocked);
  R.check('Angreifer (Sitz 0) ist NICHT itemLocked', !t.gs.players[0].itemLocked, t.gs.players[0].itemLocked);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
