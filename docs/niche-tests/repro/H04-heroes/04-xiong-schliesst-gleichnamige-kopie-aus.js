'use strict';
// H04-04 · Xiong: die Galerie blendet ALLE Karten mit dem Namen der gespielten Attack aus – auch schon abgelegte Kopien
//
// Kartentext (Xiong, the Bamboo Guardian): „Whenever this Hero defeats a target with an Attack, you may choose a card from
//   either player's discard pile and add it to your hand."
// Erwartung: Die gerade aufgelöste Attack liegt noch nicht in der Ablage (wird nicht angeboten); eine ANDERE Kopie derselben
//   Attack, die schon in der Ablage liegt, ist eine Karte der Ablage und wird angeboten.
// Beobachtet: `tryTutor` baut ein Ausschlussset aus dem NAMEN von `_resolvingCard` und filtert damit jede Karte dieses Namens
//   aus BEIDEN Ablagen – die frühere Kopie fehlt in der Galerie.
// Ursache: xiong-the-bamboo-guardian.js `tryTutor` (exclude.add(resolving) gegen Namen statt gegen die Handkopie).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const XI = 'Xiong, the Bamboo Guardian';
  const t = await H.fresh({ heroes: [[XI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [['Attack'], []], discard: [['Attack', 'Fireball'], ['Icebolt']] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.put(1, 0, 0, H.INERT.frail).turnPlayed = 1;
  t.targetFn = (valid) => { const v = valid.find(x => x.type === 'equip' && x.owner === 1); return v ? [v.id] : null; };
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === XI, answer: (d) => { galerie = d.cards.map(c => c.name); return null; }, once: true });
  const r = await t.play(0, 'Attack', { hero: 0 });
  R.check('Vorbereitung: Attack gespielt, Galerie erschien', r === true && Array.isArray(galerie), { r, galerie });
  R.check('Galerie enthält die schon abgelegte zweite Kopie von „Attack"', galerie && galerie.includes('Attack'), galerie);
  R.check('Galerie enthält Fireball (andere Karte der eigenen Ablage) und Icebolt (Gegner-Ablage)', galerie && galerie.includes('Fireball') && galerie.includes('Icebolt'), galerie);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
