'use strict';
// C03-creatures-10 · Mr. Jiggles (gestohlen/geliehen): die geliehene Kreatur selbst wird als „Ziel, das dein Gegner kontrolliert" angeboten
// Kartentext: „You may once per turn choose up to 2 targets your opponent controls and inflict 100 damage to them."
// Aufbau: Sitz 0 besitzt Mr. Jiggles (Held 0 / Slot 0) und eine ZZ Dummy; Sitz 1 stiehlt Jiggles (`actionStealCreature`, wie Lovely Teddy) und aktiviert ihn.
// Erwartung: Der Kontrolleur (Sitz 1) kontrolliert Jiggles selbst – er ist KEIN Ziel „das dein Gegner kontrolliert"; angeboten werden nur die Ziele des Besitzers (Sitz 0).
// Beobachtet: `side: 'enemy'` wird nach der Brettseite aufgelöst; Jiggles (Kontrolleur Sitz 1) steht auf Brettseite 0 und wird mit angeboten; der Dieb kann sich damit
//   selbst (90 HP, 100 Schaden) zerstören bzw. eine Fremd-Kreatur-Auswahl „verbrauchen" (Ziel 1 von 2).
// Ursache: cards/effects/mr-jiggles.js `ctx.promptMultiTarget({ side: 'enemy' … })` – kein Filter auf `inst.controller` (vgl. C01-05/-07: Brettseite statt Kontrolle).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const j = t.put(0, 0, 0, 'Mr. Jiggles'); j.turnPlayed = 1;
  t.put(0, 1, 0, H.INERT.creature);
  t.engine.actionStealCreature(1, j);
  t.gs.activePlayer = 1; t.phase(2);
  t.targetFn = (valid) => valid.filter(v => v.type === 'hero').slice(0, 1).map(v => v.id);
  await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
  const angeboten = (t.targets[0]?.valid || []).filter(v => v.type === 'equip').map(v => v.cardName);
  R.note('angebotene Kreaturen', angeboten);
  R.check('die geliehene Kreatur selbst wird NICHT als Gegnerziel angeboten', !angeboten.includes('Mr. Jiggles'), angeboten);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
