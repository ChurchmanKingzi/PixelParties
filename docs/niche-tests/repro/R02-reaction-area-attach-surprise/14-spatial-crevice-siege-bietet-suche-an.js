'use strict';
// R02-14 · Spatial Crevice bietet unter Siege (Such-Sperre) die Deck-Suche an – Ja/Nein-Frage wird nicht unterdrückt
// Kartentexte: Spatial Crevice – „At the end of each turn, the turn player may search their deck for an Area, reveal it and add it to their hand."
//              Siege – „… your opponent cannot add cards from their deck or discard pile to their hand outside their Resource Phase (but they can still draw cards)."
// Engine-Vorgabe (_engine.js ~30080, v1117/v1121, Al 15.9.): „Under siege sollten ALLE Search-Galerien/Dialoge unterdrückt sein … Karten wie Deepsea Witch sollten nicht mal ihren optionalen Effekt ANBIETEN."
//   Ein `confirm`, das nur fragt „möchtest du suchen?", muss dafür `searchToHand: true` (+ `searchPile`) tragen (`_suchQuelleDerAbfrage`).
// Aufbau: Sitz 0 trägt Siege (Held 0). Sitz 1 kontrolliert Spatial Crevice; sein Deck enthält Areas. Sitz 1 beendet seinen Zug (`t.endTurn()`), Crevice löst aus.
// Erwartet: Sitz 1 wird nicht gefragt, ob er sein Deck nach einer Area durchsuchen will (er darf nichts hinzufügen).
// Beobachtet: Die Frage „Search your deck for an Area and add it to your hand?" kommt trotz Sperre. (Die folgende Galerie trägt `searchToHand` und würde in der echten Engine unterdrückt;
//   die Harness-Hülle um `promptGeneric` umgeht diese zentrale Stelle, deshalb ist hier nur die Ja/Nein-Frage als „angeboten" belegt – gegengeprüft durch direkten Aufruf der Klassenmethode: confirm → nicht unterdrückt, Galerie → `search_prompt_suppressed`.)
// Ursache: `spatial-crevice.js` onTurnEnd (~Z. 106) setzt am `confirm` weder `searchToHand` noch `searchPile` (nur die Galerie, Z. 118, trägt sie); geprüft wird nur `ps.handLocked`, nicht die Such-Sperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Siege'], []], hp: 800, deck: [[H.INERT.creature], ['Rioting Village', 'Stinky Stables', H.INERT.creature]] });
  t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
  await t.play(0, 'Siege', { hero: 0, noGrant: true });
  t.putArea(1, 'Spatial Crevice');
  t.gs.activePlayer = 1; t.phase(4);
  R.check('Aufbau – Siege sperrt die Deck-Suche von Sitz 1 außerhalb seiner Resource Phase', t.engine._isSearchBlocked(1, {}, 'deck') === true);
  t.policy.confirm = false;
  t.reset();
  await t.endTurn();
  const angeboten = t.prompts.some(p => p.d.type === 'confirm' && p.d.title === 'Spatial Crevice');
  R.check('Sitz 1 wird NICHT gefragt, ob er sein Deck nach einer Area durchsuchen will', !angeboten, t.prompts.map(p => p.d.type + ':' + (p.d.title || '')));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
