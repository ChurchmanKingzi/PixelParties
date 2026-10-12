'use strict';
// A02-deepsea-18 · Slippery Narw: Die gewählte Quelle (Ablage) wird ignoriert, wenn dieselbe Kreatur auch im Deck liegt
//
// Kartentext (Slippery Narw): „… If it was a Creature you control, you may choose any Creature from your deck or discard pile, reveal it and add it to your hand."
// Das Skript bietet die Galerie mit getrennten Kacheln je Quelle („Deepsea Bats/deck", „Deepsea Bats/discard") und der Client antwortet mit `{ cardName, source }`.
// Erwartung: Wähle ich die Kachel „Ablage", verlässt die Karte die ABLAGE (das Deck bleibt unberührt, wird nicht gemischt).
// Beobachtet: Das Skript liest nur `picked.cardName` und nimmt zuerst aus dem Deck (`takeFromPile(ps, 'deck', …)`), die Ablage nur als Rückfall → die Deck-Kopie wandert
//   auf die Hand, die Ablage-Kopie bleibt liegen, das Deck wird gemischt.
// Ursache: `slippery-narw.js` ~Z. 126–146 (`removedFromDeck`-Logik nach Namen statt nach `picked.source`).
const H = require('../../lib/h.js');
const SH = require('../../../../cards/effects/_slippery-shared.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [['Deepsea Bats', H.INERT.creature, H.INERT.creature]], discard: [['Deepsea Bats', 'Fireball']] });
  const narw = t.put(0, 0, 0, 'Slippery Narw'); narw.turnPlayed = 1;
  const f = t.put(0, 1, 0, H.INERT.creature); f.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0 && v.heroIdx === 1).id];
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Deepsea Bats', source: 'discard' }) });
  await t.run(() => SH.moveSlipperyCreature(t.engine, 0, narw, 2, 0));
  R.check('Vorbedingung: Bats auf der Hand', t.pile(0, 'hand').includes('Deepsea Bats'), t.pile(0, 'hand'));
  R.check('Die gewählte Ablage-Kopie wurde genommen (Bats nicht mehr in der Ablage)', !t.pile(0, 'discardPile').includes('Deepsea Bats'), { ablage: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck') });
  R.check('Das Deck blieb unberührt (Bats noch im Deck)', t.pile(0, 'mainDeck').includes('Deepsea Bats'), t.pile(0, 'mainDeck'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
