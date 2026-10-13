'use strict';
// R02-19 · Very Special Prisoner holt „Divinity" per direktem Splice aus dem Deck – an der Stapel-Sperre (Knight of Kings [B]) vorbei
// Kartentexte: Very Special Prisoner – „Play this card immediately when you take control of an opponent's target. Attach a Divinity Ability from your hand or deck to a Hero you control. …"
//              Knight of Kings [B] – „While you control at least 1 "Rook of Kings" and "Board of Kings" is on the board, your opponent cannot move cards from their deck or discard pile to anywhere else (but they can still draw)."
// CARD_API: „Kein direktes Splicen an Deck und Ablage" / Stapel-Primitive `pileOutAllowed` (Tutor, Mill, Bewegungen aus Deck/Ablage, Platzierung aus der Ablage).
// Aufbau: Sitz 1: Knight of Kings [B] + Rook of Kings [B] auf dem Brett, Board of Kings als Area (⇒ `pileOutAllowed(0,'deck')` = false). Sitz 0 (Magic Arts 1) hat Very Special Prisoner auf der Hand, ein Divinity im Deck
//   und übernimmt eine Kreatur von Sitz 1 (`actionStealCreature`). (Variante B: Divinity auf der Hand – Kontrolle.)
// Erwartet: Das Deck ist als Quelle gesperrt: Divinity darf nicht aus dem Deck geholt werden (Variante A: Karte bleibt wirkungslos/nicht angeboten); Variante B (Hand) funktioniert.
// Beobachtet: A: Divinity wird aus dem Deck gezogen und an Held 0 angehängt (Deck 3 → 2), obwohl die Sperre gilt. B ✓.
// Ursache: `very-special-prisoner.js` `resolve` splict `ps.mainDeck` direkt (`removeFromPile`, ~Z. 168) und prüft `engine.pileOutAllowed(pi, 'deck', …)` weder in `reactionCondition` (`_availableDivinitySources`) noch in `resolve`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const quelle of ['A: Divinity im Deck', 'B: Divinity auf der Hand (Kontrolle)']) {
    const t = await H.fresh({ hand: [['Very Special Prisoner', ...(quelle.startsWith('B') ? ['Divinity'] : [])], []], hp: 800, deck: [quelle.startsWith('A') ? ['Divinity', H.INERT.creature, H.INERT.creature] : [H.INERT.creature, H.INERT.creature, H.INERT.creature], []] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    const ziel = t.put(1, 0, 0, H.INERT.creature);
    t.put(1, 1, 0, 'Knight of Kings [B]'); t.put(1, 2, 0, 'Rook of Kings [B]'); t.putArea(1, 'Board of Kings');
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'optionPicker' && /Divinity/.test(d.description || ''), answer: d => ({ optionId: d.options[0].id }) });
    R.check(`${quelle}: Aufbau – Deck von Sitz 0 ist als Quelle gesperrt`, t.engine.pileOutAllowed(0, 'deck', {}) === false);
    const deck0 = t.pile(0, 'mainDeck').length;
    await t.run(() => t.engine.actionStealCreature(0, ziel));
    await new Promise(r => setTimeout(r, 300));   // onTakeControl läuft im Mikro-Task-Nachlauf
    const angehaengt = t.gs.players[0].abilityZones[0].flat().includes('Divinity');
    if (quelle.startsWith('A')) R.check('A: Divinity wird NICHT aus dem gesperrten Deck geholt', !angehaengt && t.pile(0, 'mainDeck').length === deck0, { angehaengt, deck: [deck0, t.pile(0, 'mainDeck').length] });
    else R.check('B: Divinity von der Hand wird angehängt', angehaengt, { abil: t.gs.players[0].abilityZones[0] });
    R.check(`${quelle}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
