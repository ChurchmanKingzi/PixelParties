'use strict';
// A07-23 · Such-Kreaturen (Guardian Beast Shu, Shanty Harpyformer, Ska Harpyformer) zahlen ihre Kosten unter Such-/Hand-Sperre und bekommen nichts
//
// Kartentexte: Shu „delete a multiple of 4 cards … Choose as many copies of that Creature from your deck and/or discard pile … and add them
//   to your hand"; Shanty „discard a Navigation Ability … and reveal 1 card from your hand to search your deck for a copy of that card, reveal
//   it, and add it to your hand"; Ska „discard a Performance Ability from your hand to attach an Ability from your deck to a Hero you control".
// Sperre: Cats of the Pharaoh „you cannot search or add cards to your hand for the rest of the turn" (`ps.searchLocked`), Hand-Sperre `ps.handLocked`.
// Vorbild für die Lesart: A09-05 (Cecilia zahlt unter Hand-/Such-Sperre, „genau die im Skript beschriebene Falle") und die Ruling-Reihe
//   „Effekt, der so nicht feuern kann, ist nicht aktivierbar / verbraucht kein Once-per-turn" (`_draw-block-shared.js`, `_gold-block-shared.js`).
// Erwartung: unter der Sperre nicht aktivierbar bzw. Abbruch vor der Zahlung (Kosten bleiben unberührt, kein Once-per-turn-Stempel).
// Beobachtet: alle drei bezahlen (Shu löscht 4 Karten; Shanty/Ska werfen die Ability ab) und erhalten nichts; Once-per-turn gestempelt.
const H = require('../../lib/h.js');
const D = H.INERT.creature, F = H.INERT.filler;
const put = (t, hi, slot, name) => { const i = t.put(0, hi, slot, name); i.turnPlayed = 1; return i; };
const act = async (t) => { t.gs.activePlayer = 0; t.phase(2); return t.activateCreature(0, 0, 0); };
const disc = (t) => t.script.push({ match: d => d && d.type === 'forceDiscardCancellable', answer: (d) => ({ handIndex: d.eligibleIndices[0], cardName: t.pile(0, 'hand')[d.eligibleIndices[0]] }) });
const gal1 = (t) => t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });

(async () => {
  const R = H.runner();
  for (const sperre of ['none', 'searchLocked', 'handLocked']) {
    R.section(sperre === 'none' ? 'Kontrolle ohne Sperre (Wirkung tritt ein)' : `Sperre: ${sperre}`);
    const frei = sperre === 'none';
    { // Shu
      const t = await H.fresh({ discard: [Array(4).fill(F), []], deck: [['Guardian Beast Hu', ...Array(8).fill(D)], []] });
      put(t, 0, 0, 'Guardian Beast Shu'); put(t, 1, 0, 'Guardian Beast Hu');
      if (!frei) t.gs.players[0][sperre] = true;
      t.script.push({ match: d => d && d.type === 'cardGalleryMulti', answer: (d) => { const idx = [0, 1, 2, 3]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
      t.targetFn = (v) => [v.find(x => x.cardName === 'Guardian Beast Hu').id];
      const r = await act(t);
      if (frei) R.check('Kontrolle Shu: Kopie auf der Hand', t.pile(0, 'hand').includes('Guardian Beast Hu'), { r, hand: t.pile(0, 'hand') });
      else R.check('Shu: Ablage bleibt unberührt (4 Füllkarten nicht gelöscht)', t.pile(0, 'deletedPile').length === 0, { r, geloescht: t.pile(0, 'deletedPile').length, hand: t.pile(0, 'hand') });
    }
    { // Shanty
      const t = await H.fresh({ hand: [['Navigation', 'Fireball'], []], deck: [['Fireball', 'Fireball', ...Array(8).fill(D)], []] });
      put(t, 0, 0, 'Shanty Harpyformer');
      if (!frei) t.gs.players[0][sperre] = true;
      disc(t); gal1(t);
      const r = await act(t);
      if (frei) R.check('Kontrolle Shanty: zweite Fireball auf der Hand', t.pile(0, 'hand').filter(x => x === 'Fireball').length === 2, { r, hand: t.pile(0, 'hand') });
      else R.check('Shanty: Navigation bleibt auf der Hand (nicht abgeworfen)', t.pile(0, 'hand').includes('Navigation'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
    }
    { // Ska
      const t = await H.fresh({ hand: [['Performance'], []], deck: [['Fighting', 'Fighting', ...Array(8).fill(D)], []] });
      put(t, 0, 0, 'Ska Harpyformer');
      if (!frei) t.gs.players[0][sperre] = true;
      disc(t); gal1(t); t.script.push({ match: d => d && d.type === 'optionPicker', answer: () => ({ optionId: '0' }) });
      const r = await act(t);
      if (frei) R.check('Kontrolle Ska: Fighting am Helden angelegt', JSON.stringify(t.gs.players[0].abilityZones).includes('Fighting'), { r, ab: t.gs.players[0].abilityZones });
      else R.check('Ska: Suche läuft bewusst trotz Sperre (W5b-B11, Al: kein Hand-Ziel) – Fighting am Helden angelegt', JSON.stringify(t.gs.players[0].abilityZones).includes('Fighting'), { r, ab: t.gs.players[0].abilityZones });
    }
  }
  R.section('Nebenfall (C): Shanty, nur „Navigation" auf der Hand – das „reveal 1 card" ist nach dem Abwurf nicht mehr möglich');
  {
    const t = await H.fresh({ hand: [['Navigation'], []], deck: [['Navigation', ...Array(9).fill(D)], []] });
    put(t, 0, 0, 'Shanty Harpyformer');
    disc(t); gal1(t);
    const r = await act(t);
    R.check('Shanty ist ohne zweite Handkarte nicht aktivierbar (Navigation bleibt auf der Hand)', t.pile(0, 'hand').includes('Navigation'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  }
  R.finish();
})();
