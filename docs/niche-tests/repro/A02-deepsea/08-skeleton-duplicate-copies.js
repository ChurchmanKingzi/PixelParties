'use strict';
// A02-deepsea-08 · Deepsea Skeleton: zwei Exemplare derselben Karte lassen sich nicht gemeinsam wählen
//
// Kartentext (Deepsea Skeleton): „When you summon this Creature, you may choose up to 2 cards from your deck and send them to your discard pile."
// Erwartung: „up to 2 cards" – zwei gleichnamige Karten sind erlaubt (z. B. beide Kopien einer Karte, die man in der Ablage braucht).
// Beobachtet: Die Galerie (`cardGalleryMulti`) wird nach Namen dedupliziert (`seen`-Menge, eine Kachel je Name); der Client wählt nach Galerie-INDEX
//   (`CardGalleryMultiPrompt`, „duplicate names … can be checked independently") – bei einer Kachel je Name sind zwei Kopien nie gemeinsam anwählbar.
//   Der Kommentar im Skript („two picks of the same name mill two copies") trifft daher nicht zu.
// Ursache: `deepsea-skeleton.js` onPlay, Galerie-Aufbau (`seen.has(cn)`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Deepsea Skeleton'], []], deck: [['Deepsea Primordium', 'Deepsea Primordium', 'Deepsea Bats', H.INERT.creature], []] });
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Deepsea Skeleton', answer: (d) => { galerie = d.cards.map(c => c.name); return { cancelled: true }; } });
  await t.play(0, 'Deepsea Skeleton', { hero: 0, slot: 0 });
  R.note('Galerie', galerie);
  const prim = (galerie || []).filter(n => n === 'Deepsea Primordium').length;
  R.check('Beide Exemplare von Deepsea Primordium sind einzeln wählbar (2 Kacheln)', prim === 2, galerie);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
