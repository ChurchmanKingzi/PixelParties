'use strict';
// A02-deepsea-23 · The Cosmic Depths: die zurückgemischte Karte (alle Exemplare gleichen Namens) fällt aus der Suche heraus – Angebot da, Effekt entfällt, Kosten bezahlt
//
// Kartentext (The Cosmic Depths): „Both players may once per turn shuffle a card from their hand back into their deck to
// search their deck for a Creature with a different level from all Creatures they currently control and summon it with one
// of their Heroes as an additional Action, but negate its effects until the end of the turn."
// Der Text schließt die zurückgemischte Karte nicht aus. Das Skript tut es (`getEligibleDeckCreatures(…, shuffledName)`,
// „name-based exclusion … with multiple copies, none of them are searchable this activation"), prüft die Aktivierbarkeit
// (`canActivateAreaEffect`) aber OHNE diesen Ausschluss.
//
// Aufbau: Seat 0 – Area The Cosmic Depths, Held 0 mit Summoning Magic Lv2, Hand: Gatherer (Lv2), Brett: Deepsea Skeleton (Lv1),
//   Deck: 3× Gatherer (2 im Deck + die zurückgemischte), Füllkarten. Aktivierung: Gatherer aus der Hand zurückmischen.
// Erwartung: Der Gatherer (Lv2 ≠ Lv1 auf dem Brett) ist suchbar und wird beschworen (Effekte negiert).
// Beobachtet: Es erscheint gar keine Galerie (`cosmic_depths_no_target`); die Karte ist gemischt, die Aktion verbraucht, der Platz bleibt leer.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Gatherer from the Cosmic Depths'], []],
    deck: [['Gatherer from the Cosmic Depths', 'Gatherer from the Cosmic Depths', H.INERT.filler, H.INERT.filler], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  t.putArea(0, 'The Cosmic Depths');
  t.put(0, 2, 0, 'Deepsea Skeleton');
  const s = {};
  t.script.push({ match: d => d.type === 'handPick', answer: () => ({ cancelled: false, selectedCards: [{ cardName: 'Gatherer from the Cosmic Depths', handIndex: 0 }] }) });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { s.gallery = d.cards.map(c => c.name); return { cardName: d.cards[0].name }; } });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }) });
  t.phase(2);
  const r = await t.run(() => t.engine.activateAreaEffect(0, 0, 'The Cosmic Depths'));
  const board = t.gs.players[0].supportZones.map(h => h.map(z => z[0] || null));
  R.check('Aktivierung wurde angeboten und durchlief (Vorbedingung)', r === true, r);
  R.check('Der Gatherer wird als Suchergebnis angeboten', Array.isArray(s.gallery) && s.gallery.includes('Gatherer from the Cosmic Depths'), { gallery: s.gallery || null, log: t.logs.map(l => l.type).filter(x => /cosmic/.test(x)) });
  R.check('Ein Gatherer steht danach auf dem Brett (Held 0)', board[0].includes('Gatherer from the Cosmic Depths'), board);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
