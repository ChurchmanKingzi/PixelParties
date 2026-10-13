'use strict';
// R01-04 · Chasing the Legend legt einen Token („Mummy Token") als Karte in die Hand
// Kartentext: „Play this card immediately when a Creature would take damage. Add that Creature to its owner's hand before the damage is applied."
// Engine-Konvention (README §4 Familie 4; CARD_API `_enforceSupportZoneLock` Z. ~45370: „Tokens → Deleted"): ein Token wird nie zur Handkarte.
// Aufbau: Sitz 0 Fireball auf der Hand; Sitz 1 hält Chasing the Legend (Summoning Magic 1 per `grantFor`) und hat einen „Mummy Token" in Held 1 / Slot 0.
// Schritte: 1. Sitz 0 wirkt Fireball auf den Token. 2. Sitz 1 antwortet mit Chasing the Legend.
// Erwartet: Der Token verschwindet (gelöscht), in der Hand von Sitz 1 liegt keine Token-Karte.
// Beobachtet: „Mummy Token" liegt als normale Karte in der Hand von Sitz 1.
// Ursache: `chasing-the-legend.js` `rettung()` ruft `engine.actionMoveCard(inst, 'hand', …)` ohne Token-Sonderfall; `actionMoveCard` (`_engine.js` ~13308) wandelt Token nur auf dem Ablage-Weg (Z. ~47686) in „deleted" um.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball'], ['Chasing the Legend']] });
  t.grantFor(1, 0, 'Chasing the Legend');
  t.put(1, 1, 0, 'Mummy Token');
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : undefined; };
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Chasing the Legend wurde gespielt (Karte in der Ablage von Sitz 1)', t.pile(1, 'discardPile').includes('Chasing the Legend'), t.pile(1, 'discardPile'));
  R.check('Der Token liegt nicht als Karte in der Hand', !t.pile(1, 'hand').includes('Mummy Token'), t.pile(1, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
