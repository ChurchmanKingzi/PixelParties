'use strict';
// F01-artifacts-16 · Flying Island in the Sky: ein Token in der Inselzone landet beim Abbau in der Ablage
// Kartentext: „…When this card is removed from a Hero, any Creatures in those Support Zones are defeated." – Tokens kommen nie in die Ablage (README §4 Familie 4; Gegenprobe: Schadenstod → Gelöscht-Stapel).
// Aufbau: Insel an Held 0 von Sitz 0, ein Mummy Token in Slot 3; die Insel geht in die Ablage.
// Erwartung: Der Token geht in den Gelöscht-Stapel (wie beim Schadenstod), Ablage = nur die Insel.
// Beobachtet: „Mummy Token" liegt in der Ablage von Sitz 0 (Phantom-Karte, kann von Ablage-Effekten wieder auf die Hand geholt werden).
// Ursache: `_engine.js` `removeIslandZones` (Z. 47831–47832): `islandDiscardPs.discardPile.push(cardName)` ohne Token-Weiche (eigener Codepfad, nicht der `actionDestroyCard`-Befund M01-08).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FI = 'Flying Island in the Sky';
  {   // Gegenprobe: normale Zerstörung eines Tokens
    const t = await H.fresh({ hand: [[FI], []], hp: 800 });
    const tk = t.put(0, 0, 0, 'Mummy Token');
    await t.engine.actionDealCreatureDamage({ name: 'test', owner: 1 }, tk, 9999, 'other');   // Schadenstod = korrekter Weg (nicht actionDestroyCard: das ist M01-08)
    R.check('Gegenprobe: durch Schaden gestorbener Token liegt nicht in der Ablage, sondern im Gelöscht-Stapel', !t.pile(0, 'discardPile').includes('Mummy Token') && t.pile(0, 'deletedPile').includes('Mummy Token'), { ablage: t.pile(0, 'discardPile'), geloescht: t.pile(0, 'deletedPile') });
  }
  {
    const t = await H.fresh({ hand: [[FI], []], hp: 800 });
    await t.play(0, FI, { hero: 0 });
    t.put(0, 0, 3, 'Mummy Token');
    await t.engine.actionMoveCard(t.find(FI, 'support'), 'discard');
    R.check('Inselabbau: Token kommt nicht in die Ablage', !t.pile(0, 'discardPile').includes('Mummy Token'), t.pile(0, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
