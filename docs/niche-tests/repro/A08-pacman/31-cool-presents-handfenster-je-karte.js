// A08-31 · Cool Presents: das Hand-Interaktionsfenster (Ambush the Scout) öffnet sich für JEDE verschenkte Karte einzeln
//
// Kartentexte: Cool Presents: „Add any number of cards with different names from your hand to your opponent's hand. …"; Ambush the Scout: „Play this card immediately when your opponent activates an effect
// that would interact with your hand. Negate that effect. Then, your opponent discards 2 cards of their choice from their hand."
// Engine-Vorbild: `_engine.js` ~Z. 25325 (Live Show, 12.10.): „der Aufrufer verschenkt MEHRERE Karten in einem Zug und hat das Fenster einmal für das ganze Geben geöffnet — ein Fenster je Karte würde den
// Gegner mit derselben Frage mehrfach unterbrechen" → `actionTransferCardToOppHand(…, { windowChecked: true })`.
// Aufbau: Sitz 0 hält Cool Presents + drei verschiedene Karten (24 Gold) und verschenkt alle drei; Sitz 1 hält Ambush the Scout (Heldenstufe vorhanden) und antwortet auf das Fenster mit Nein (`null`).
// Erwartung: Der Gegner wird EINMAL gefragt (ein Effekt, ein Fenster).
// Beobachtet: Er wird dreimal gefragt (je Karte); `cool-presents.js` ~Z. 158 ruft `actionTransferCardToOppHand` ohne `windowChecked`. Antwortet er mit Ja, ist nach der ersten Karte Schluss (Effekt negiert),
//   die Kosten (3 × 4 Gold) sind aber vorab für alle Karten bezahlt.
// Aufruf: node docs/niche-tests/repro/A08-pacman/31-cool-presents-handfenster-je-karte.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature, F = H.INERT.filler, A = H.INERT.artifact;
  const t = await H.fresh({ gold: [24, 100], hand: [[], []], deck: [Array(10).fill(F), Array(10).fill(F)] });
  t.engine.handZugangSync(0, 'Cool Presents');
  for (const n of [F, A, D]) t.engine.handZugangSync(0, n);
  t.engine.handZugangSync(1, 'Ambush the Scout'); t.grantFor(1, 0, 'Ambush the Scout');
  let fenster = 0;
  t.script.push({ match: d => d && d.type === 'confirm' && /Ambush/.test((d.title || '') + (d.message || '') + (d.description || '')), answer: () => { fenster++; return null; } });   // echtes „Nein"
  await t.play(0, 'Cool Presents', { noAutoConfirm: true });
  const ids = t.gs.potionTargeting.validTargets.map(v => v.id);
  await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: ids }));
  R.note('Fenster', String(fenster));
  R.check('drei verschenkte Karten: der Gegner wird nur einmal gefragt', fenster === 1, { fenster });
  R.check('alle drei Karten beim Gegner (Nein auf alles)', t.pile(1, 'hand').filter(n => [F, A, D].includes(n)).length === 3, t.pile(1, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  // Zusatz: Such-Sperre des Gegners (`searchLocked`, z. B. Cats of the Pharaoh/Siege) – `actionTransferCardToOppHand` lehnt ab, Cool Presents prüft nur `handLocked`
  const u = await H.fresh({ gold: [24, 100], hand: [[], []], deck: [Array(10).fill(F), Array(10).fill(F)] });
  u.engine.handZugangSync(0, 'Cool Presents');
  for (const n of [F, A, D]) u.engine.handZugangSync(0, n);
  u.gs.players[1].searchLocked = true;
  await u.play(0, 'Cool Presents', { noAutoConfirm: true });
  const g0 = u.gs.players[0].gold;
  await u.run(() => u.host.doConfirmPotion(u.room, 0, { selectedIds: u.gs.potionTargeting.validTargets.map(v => v.id) }));
  const bezahlt = g0 - u.gs.players[0].gold, geliefert = u.pile(1, 'hand').length;
  R.note('Such-Sperre des Gegners', JSON.stringify({ bezahlt, geliefert }));
  R.check('Such-Sperre des Gegners: nichts geliefert ⇒ nichts bezahlt', geliefert > 0 || bezahlt === 0, { bezahlt, geliefert });
  R.finish();
})();
