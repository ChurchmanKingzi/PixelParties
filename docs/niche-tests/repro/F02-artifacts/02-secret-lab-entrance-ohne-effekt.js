'use strict';
// F02-02 · Secret Lab Entrance: weder Ausrüst-Beschränkung noch die zusätzliche Inventing-Aktivierung sind umgesetzt
// Kartentext: „You can only equip this card to a Hero you control with the Inventing Ability. Once per turn, when you use that Hero's Inventing Ability, you may immediately use it an additional time after that."
// Aufbau: (a) Held 0 OHNE Inventing; (b) Held 0 mit Inventing Lv1, Lab liegt am Helden, 5 Handkarten.
// Schritte: (a) Lab ausspielen. (b) Inventing frei aktivieren (doActivateFreeAbility), danach ein zweites Mal.
// Erwartet: (a) das Ausrüsten wird abgelehnt (Held hat kein Inventing). (b) die zweite Aktivierung ist (einmal pro Zug) zusätzlich erlaubt.
// Beobachtet: (a) wird ausgerüstet. (b) die zweite Aktivierung wird abgelehnt (Inventing ist „once per turn"); das Lab ändert nichts.
//   `cards/effects/secret-lab-entrance.js` enthält nur `{ isEquip: true, equipOwnSideOnly: true }`; kein Skript liest die Karte (grep „Secret Lab Entrance" – nur die Datei selbst).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // (a) Ausrüsten auf einen Helden ohne Inventing
  let t = await H.fresh({ hand: [['Secret Lab Entrance'], []] });
  const rA = await t.play(0, 'Secret Lab Entrance', { hero: 0 });
  R.check('(a) Ausrüsten auf Held ohne Inventing wird abgelehnt', rA === false && t.zone(0, 0, 0) === null, { rA, zone: t.zone(0, 0, 0) });
  // (b) zusätzliche Aktivierung
  t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []], abilities: { 0: { 0: [['Inventing'], [], []] } } });
  t.put(0, 0, 0, 'Secret Lab Entrance');
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'ZZ Filler', handIndex: 0 }) });
  const frei = async () => { t.gs.activePlayer = 0; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 })); };
  const a1 = await frei();
  // W16e: „immediately use it an additional time AFTER THAT" — die Zusatznutzung folgt SOFORT auf die erste Nutzung (Ja/Nein-Angebot im selben Zug
  // der Aktivierung), kein zweiter Aktivierungsaufruf; die Tagessperre der Ability selbst bleibt (ein weiterer Aufruf wird abgelehnt).
  R.check('(b) erste Aktivierung ok', a1 === true, a1);
  R.check('(b) Zusatznutzung durch das Lab: zwei Abwürfe', t.pile(0, 'discardPile').length === 2, t.pile(0, 'discardPile'));
  const a2 = await frei();
  R.check('(b) ein weiterer Aufruf bleibt gesperrt (Ability once per turn; Lab nur einmal pro Zug)', a2 === false && t.pile(0, 'discardPile').length === 2, { a2, ablage: t.pile(0, 'discardPile').length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
