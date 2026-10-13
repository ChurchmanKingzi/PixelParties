'use strict';
// A07-21 · Kreaturen, deren Wirkung „Ziehen" ist, ignorieren die Zieh-Sperren uneinheitlich (Kosten verbrannt, nichts gezogen)
//
// Kartentexte: Triceras „discard a card to draw 3 cards", Pteranos „discard … Gigantisaur Creatures … to draw twice that many",
//   Raptoren „draw cards equal to the number of Gigantisaur Creatures you control", Guardian Beast Tu „delete 3, 6 or 9 cards …
//   to draw a card for every 3 cards deleted", Techno Harpyformer „discard an Inventing Ability to draw 2 cards".
// Sperren: `ps.handLocked` („sperrt ALLES: Draws UND Suchen", _engine.js ~10627; z. B. Ice Sculpture Garden, Smuggler's Pier) und
//   `ps.drawLocked` („sperrt NUR Draws", The Sacred Jewel / Prayer).
// Konvention: Triceras kommentiert im Gate „locked hand can't draw — wasteful"; Prayer fragt `!ps.drawLocked && !ps.handLocked`.
// Erwartung (Lesart „Effekt, der so nicht feuern kann, ist nicht aktivierbar", Ruling Tuscan Artist 16.8.): bei gesetzter Sperre ist die
//   Aktivierung nicht möglich, es werden keine Kosten gezahlt.
// Beobachtet: Triceras/Pteranos/Raptoren prüfen nur `handLocked` (nicht `drawLocked`); Tu und Techno prüfen keine von beiden. Unter der
//   jeweiligen Sperre werden die Kosten bezahlt (Abwurf/Löschen/Once-per-turn), gezogen wird nichts.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const put = (t, hi, slot, name) => { const i = t.put(0, hi, slot, name); i.turnPlayed = 1; return i; };
const disc = (t) => t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
const act = async (t) => { t.gs.activePlayer = 0; t.phase(2); return t.activateCreature(0, 0, 0); };

const FAELLE = [
  ['Triceras', 'drawLocked', (t) => { put(t, 0, 0, 'Gigantisaur Triceras'); t.setHand(0, [F]); disc(t); }, (t) => t.pile(0, 'hand').length === 1],
  ['Pteranos', 'drawLocked', (t) => { put(t, 0, 0, 'Gigantisaur Pteranos'); t.setHand(0, ['Gigantisaur Spinor', 'Gigantisaur Triceras']); disc(t); }, (t) => t.pile(0, 'hand').length === 2],
  ['Raptoren', 'drawLocked', (t) => { put(t, 0, 0, 'Gigantisaur Raptoren'); put(t, 1, 0, 'Gigantisaur Spinor'); }, (t) => Object.keys(t.gs.hoptUsed || {}).length === 0],
  ['Guardian Beast Tu', 'handLocked', (t) => { put(t, 0, 0, 'Guardian Beast Tu'); t.setDiscard(0, Array(6).fill(F)); t.setDiscard(1, Array(6).fill(F));
      t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => { const idx = [0, 1, 2]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } }); },
    (t) => t.pile(0, 'deletedPile').length + t.pile(1, 'deletedPile').length === 0],
  ['Guardian Beast Tu', 'drawLocked', null, null],
  ['Techno Harpyformer', 'handLocked', (t) => { put(t, 0, 0, 'Techno Harpyformer'); t.setHand(0, ['Inventing']); disc(t); }, (t) => t.pile(0, 'hand').length === 1],
  ['Techno Harpyformer', 'drawLocked', null, null],
];

(async () => {
  const R = H.runner();
  let last = null;
  for (const [name, sperre, setup, unberuehrt] of FAELLE) {
    const f = setup ? { setup, unberuehrt } : last;
    last = f;
    const t = await H.fresh({ deckSize: 10, discard: [[], []] });
    f.setup(t);
    t.gs.players[0][sperre] = true;
    const r = await act(t);
    R.check(`${name} bei ${sperre}: nicht aktivierbar / keine Kosten gezahlt`, f.unberuehrt(t), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile').length, geloescht: t.pile(0, 'deletedPile').length + t.pile(1, 'deletedPile').length, hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
