'use strict';
// F02-22 · Aktive Ausrüstung (equipEffect) an einem übernommenen Helden: der Kontrolleur kann sie nicht aktivieren, der Brettseiten-Besitzer schon
// Kartentext Pocket Catapult: „Equip this card to a Hero you control. You may once per turn deal 40 damage to any target on the board."
// Ruling CARD_API.md ~Z. 18906 (Als Vorgabe 29.9.): Ausrüsten an übernommene Helden ist erlaubt; „Die Karte liegt auf der BRETTSEITE …, `originalOwner` = der Ausrüstende …, Bei `charmedBy` dient sie über `effektiveSeiten` dem Kontrolleur."
// Aufbau: Sitz 0 übernimmt Held 0 von Sitz 1 dauerhaft (`actionTakeHeroPermanently(0, 1, 0)`, wie Paraseed Control/Styx) und rüstet ihm Pocket Catapult an (echter Weg, `targetOwner: 1`).
// Schritte: 1. Sitz 0 (Kontrolleur) aktiviert die Ausrüstung (`doActivateEquipEffect`, Held 0 / Slot 0). 2. Sitz 1 (Brettseite, kontrolliert den Helden nicht) aktiviert sie in seinem Zug.
// Erwartet: Der Kontrolleur (Sitz 0) kann das Katapult abfeuern; Sitz 1 kann es nicht.
// Beobachtet: Sitz 0: abgelehnt (`false`, auch mit `heroOwner: 1`); Sitz 1: gelingt, Sitz 0 verliert 40 HP.
// Vermutete Ursache: `server.js doActivateEquipEffect` (~Z. 11074-11117): `ps = _crossInst ? gs.players[oi] : gs.players[pi]` – nur Karten mit `placesOnOpponentBoard` werden gegenüber adressiert; die Instanz-Suche nimmt `c.owner === pi || c.controller === pi` (die Instanz hat owner/controller = Brettseite 1).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pocket Catapult'], []], gold: [100, 100] });
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));
  const r = await t.play(0, 'Pocket Catapult', { hero: 0, targetOwner: 1 });
  R.check('Katapult an den übernommenen Helden (Sitz 1, Held 0) ausgerüstet', r === true && !!t.zone(1, 0, 0), { r, zone: t.zone(1, 0, 0) });
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 1); return v ? [v.id] : [valid[0].id]; };
  const hp1 = t.hp(1, 1);
  const a = await t.activateEquip(0, 0, 0);
  R.check('Kontrolleur (Sitz 0) kann das Katapult aktivieren', a === true && t.hp(1, 1) === hp1 - 40, { a, dmg: hp1 - t.hp(1, 1) });
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 0 && q.heroIdx === 1); return v ? [v.id] : [valid[0].id]; };
  const hp0 = t.hp(0, 1);
  const b = await t.activateEquip(1, 0, 0);
  R.check('Brettseiten-Besitzer (Sitz 1, kontrolliert den Helden nicht) kann es NICHT aktivieren', b !== true && t.hp(0, 1) === hp0, { b, dmgToSeat0: hp0 - t.hp(0, 1) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
