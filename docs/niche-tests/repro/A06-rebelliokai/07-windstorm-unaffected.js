'use strict';
// A06-rebelliokai-07 · Tengu Windstorm trifft Kreaturen, die „unaffected by your opponent's cards and effects" sind
// Kartentexte: Board of Kings: „Creatures you control … are unaffected by your opponent's cards and effects while there is
//   at least 1 Creature with a lower level in an adjacent Support Zone to them …" · Tengu Windstorm: „Choose any card on the
//   board that is not a Hero and place it on top or bottom of its controller's deck."
// Beobachtung: `_bounceToDeck` (tengu-windstorm.js) schiebt die Karte per `_removeCardFromState` ins Deck, ohne
//   `engine.isOppEffectImmuneFrom` o. Ä. zu fragen; zusammen mit A06-rebelliokai-05 (Auswahl nicht gesperrt) wird die durch das
//   Board gedeckte Kreatur tatsächlich vom Brett genommen. Schaden-/Status-/Zerstören-Primitive prüfen die Immunität dagegen selbst.
// Aufbau: Board of Kings (Area von Sitz 0 – ein Board BEIDER Seiten zählt); auf Sitz 1: Rook of Kings [W] (Lv3) neben Pawn of
//   Kings [W] (Lv0) → Rook ist gedeckt. Sitz 0 spielt Tengu Windstorm (Terror Tengu als Kosten) auf den Rook.
// Erwartung: der gedeckte Rook bleibt auf dem Brett.
// Gegenprobe: dieselbe Kreatur, per Schaden getroffen, ist unberührt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Source', owner: 0, heroIdx: 0 };
  let t = await H.fresh({});
  t.putArea(0, 'Board of Kings');
  let rook = t.put(1, 0, 0, 'Rook of Kings [W]'); t.put(1, 0, 1, 'Pawn of Kings [W]');
  await t.run(() => t.engine.actionDealCreatureDamage(src, rook, 500, 'creature', { sourceOwner: 0 }));
  R.check('Gegenprobe: Schaden des Gegners trifft den gedeckten Rook nicht', t.zone(1, 0, 0) === 'Rook of Kings [W]', t.zone(1, 0, 0));

  t = await H.fresh({ hand: [['Tengu Windstorm'], []], discard: [['Rebelliokai Terror Tengu'], []] });
  t.putArea(0, 'Board of Kings');
  t.put(1, 0, 0, 'Rook of Kings [W]'); t.put(1, 0, 1, 'Pawn of Kings [W]');
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'top' }) });
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Rook of Kings [W]').id];
  const r = await t.play(0, 'Tengu Windstorm', { hero: 0 });
  R.check('Tengu Windstorm ausgeführt', r === true, r);
  R.check('gedeckter Rook bleibt auf dem Brett (unaffected)', t.zone(1, 0, 0) === 'Rook of Kings [W]', { slot: t.zone(1, 0, 0), deck1Top: t.pile(1, 'mainDeck')[0] });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
