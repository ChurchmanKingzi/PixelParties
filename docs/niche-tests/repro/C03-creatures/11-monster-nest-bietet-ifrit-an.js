'use strict';
// C03-creatures-11 · Monster Nest bietet Ifrit aus dem Deck an („cannot be summoned from anywhere, except your hand"); die Wahl scheitert still und mischt das Deck
// Kartentext (Monster Nest): „You may once per turn choose a level 3 or lower Creature from your deck and place it on top of this card. This counts as that Creature being summoned."
// Kartentext (Ifrit, Lv 2): „This Creature cannot be summoned from anywhere, except your hand."
// Aufbau: Sitz 0: Monster Nest (Held 0 / Slot 0, nicht frisch); Deck = [Ifrit, Fireball, Slow]; Nest aktivieren, Ifrit wählen.
// Erwartung: Ifrit erscheint nicht in der Galerie (Kommentar in monster-nest.js: „die Galerie soll aber gar nicht erst lügen"; Vorbild: Pinta/Slave Trader filtern `summonOnlyFromHand`).
// Beobachtet: Die Galerie enthält Ifrit; die Wahl wird vom Engine-Riegel (`summon_blocked`/`hand_only`) abgelehnt, das Nest hebt sich wieder, die Karte geht ins Deck zurück –
//   dabei wird das Deck neu gemischt (Reihenfolge Ifrit/Fireball/Slow → Fireball/Slow/Ifrit), ohne dass etwas passiert. Ist Ifrit die einzige taugliche Karte, ist das Nest trotzdem „aktivierbar".
// Ursache: cards/effects/monster-nest.js `eligibleFromDeck()` prüft `summonOnlyFromHand` nicht (Filter: Kreatur, kein Artifact-Creature, Level ≤ 3).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [['Ifrit', 'Fireball', 'Slow'], []] });
  const nest = t.put(0, 0, 0, 'Monster Nest'); nest.turnPlayed = 1;
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Ifrit' }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  const angeboten = t.prompts.flatMap(p => (p.d.cards || []).map(c => c.name));
  R.note('Galerie', angeboten);
  R.check('Ifrit steht nicht in der Galerie', !angeboten.includes('Ifrit'), angeboten);
  R.note('Deck danach (vorher: Ifrit, Fireball, Slow)', t.pile(0, 'mainDeck'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
