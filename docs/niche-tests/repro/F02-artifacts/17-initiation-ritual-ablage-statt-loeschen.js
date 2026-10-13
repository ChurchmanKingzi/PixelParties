'use strict';
// F02-17 · Initiation Ritual legt die Fähigkeiten des geopferten Helden in die ABLAGE – der Kartentext sagt „deleting"
// Kartentext: „Choose a defeated Hero you control that wasn't defeated this turn and equip it to another Hero you control, deleting all cards in its Ability Zones. That Hero gains the effect of the Hero equipped to it in addition to its own effect. …"
// Aufbau: Sitz 0: Hand [Initiation Ritual]; Held 1 (Rick) ist tot (seit Zug 5), Zug 7; Ability Zone 0 von Held 1: Fighting ×2, Zone 1: Luck.
// Schritte: Initiation Ritual über den echten Weg auf den toten Helden 1 spielen.
// Erwartet: Fighting, Fighting, Luck liegen im GELÖSCHT-Stapel (Sitz 0); die Ablage enthält nur Initiation Ritual.
// Beobachtet: alle drei liegen in der ABLAGE (`discardPile`), der Gelöscht-Stapel ist leer – sie sind damit z. B. für Pressed Skill („… from your deck, hand or discard pile") wieder verwendbar.
// Vermutete Ursache: initiation-ritual.js (Abschnitt „Discard all Ability-type cards from the dead Hero's zones"): `discardPile.push(cardName)`; Skriptkopf beschreibt die ältere Textfassung („→ discard"), der Text kam mit Commit 4db2f97 auf „deleting".
//   Zusatz: dieselbe Schleife legt auch Ability-TYP-Karten aus den SUPPORT Zones des toten Helden ab – vom Kartentext („its Ability Zones") nicht verlangt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Initiation Ritual'], []], gold: [100, 100], abilities: { 0: { 1: [['Fighting', 'Fighting'], ['Luck'], []] } } });
  await t.run(() => t.engine.actionDealDamage({ name: 'x', owner: 1 }, t.hero(0, 1), 9999, 'true'));
  t.gs.turn = 7; t.hero(0, 1).diedOnTurn = 5;
  const r = await t.play(0, 'Initiation Ritual', { noAutoConfirm: true });
  const pt = t.gs.potionTargeting;
  const v = (pt && pt.validTargets || []).filter(x => !x.ineligible).find(x => x.type === 'hero' && x.heroIdx === 1);
  R.check('Ritual spielbar, toter Held 1 wählbar', !!v, { r });
  if (v) await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [v.id] }));
  const del = t.pile(0, 'deletedPile'), disc = t.pile(0, 'discardPile');
  R.check('Fähigkeiten (Fighting ×2, Luck) im Gelöscht-Stapel', ['Fighting', 'Fighting', 'Luck'].every(n => del.includes(n)), { del, disc });
  R.check('Fähigkeiten NICHT in der Ablage', !disc.includes('Fighting') && !disc.includes('Luck'), { disc });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
