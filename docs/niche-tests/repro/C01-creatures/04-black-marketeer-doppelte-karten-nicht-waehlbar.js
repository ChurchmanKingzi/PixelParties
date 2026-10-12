'use strict';
// C01-creatures-04 · Black Marketeer: gleiche Karten in der Ablage sind nur einmal waehlbar
// Kartentext: „When you play this Creature, you may choose up to 5 cards from your discard pile, shuffle them back into your deck and gain 4 Gold per card."
// Aufbau: Ablage = 5x dieselbe Karte (Zz Filler) + Fireball + Heal; Marketeer aus der Hand spielen, die Galerie vollstaendig auswaehlen.
// Erwartung: bis zu 5 Karten waehlbar (hier: 5 Kopien der Fuellkarte) -> Galerie bietet jede Kopie einzeln an oder traegt `count` (wie Boomerang, Lone Survivor, Layn, Cecilia, _priest-shared).
// Beobachtet: Die Galerie hat nur 3 Eintraege (je Name einer); maximal 3 Karten recycelbar (12 Gold), 4 Fuellkarten bleiben in der Ablage.
// Ursache: black-marketeer.js `ablageGalerie()` entdoppelt per Set und liefert `{name, source}` ohne `count`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Black Marketeer'], []], discard: [[H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler, 'Fireball', 'Heal'], []] });
  const ps = t.gs.players[0];
  let waehlbar = 0;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => { waehlbar = d.cards.reduce((s, c) => s + (c.count || 1), 0); return { selectedCards: d.cards.map(c => c.name) }; } });
  await t.play(0, 'Black Marketeer');
  R.check('mindestens 5 Karten waehlbar (5 identische + 2 weitere in der Ablage)', waehlbar >= 5, { waehlbar, ablageNachher: ps.discardPile });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
