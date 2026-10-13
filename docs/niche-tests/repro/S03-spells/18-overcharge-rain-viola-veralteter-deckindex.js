'use strict';
// S03-18 · Overcharge + Rain Viola: veralteter Deck-Index – die Aufwertung wird DUPLIZIERT und eine falsche Deckkarte verschwindet
// Kartentexte: Overcharge: „… send it to the discard pile. Then, choose an equippable Artifact with a Cost between 1 and 10 Gold higher … from your deck and equip it to the same Hero."
//   Rain Viola: „When this Artifact equipped to a Hero you control is sent to the discard pile, search your deck for any Attack or Spell, reveal it and add it to your hand."
// Aufbau: Held 0 (Magic Arts 1) trägt „Rain Viola" (Kosten 4); Deck [Fireball, Blade of the Frostbringer (Kosten 5), ZZ Dummy, Meteor Crash]; Galerien: Overcharge → Blade, Rain Viola → Fireball.
// Erwartet: Kartenbilanz ±0 für Blade (Deck → Brett: −1 im Deck, +1 auf dem Brett) und Fireball (Deck → Hand): ZZ Dummy bleibt im Deck, Blade steht GENAU einmal (Brett), nicht mehr im Deck.
// Beobachtet: `overcharge.js` Z. 265 liest `deckIdx` VOR dem Ablegen (Z. 273); Rain Viola sucht und mischt das Deck beim Ablegen, `takeFromPile(ps, 'deck', deckIdx)` (Z. 277) nimmt dann
//   per Index die FALSCHE Karte (ZZ Dummy) – Blade liegt zugleich auf dem Brett und noch im Deck (Bilanz Blade +1, ZZ Dummy −1).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seed of [1234, 1, 7]) {
    const t = await H.fresh({ seed, hand: [['Overcharge'], []], hp: 800, deck: [['Fireball', 'Blade of the Frostbringer', 'ZZ Dummy', 'Meteor Crash'], []] });
    t.setAbilities(0, 0, [['Magic Arts'], [], []]);
    t.put(0, 0, 1, 'Rain Viola');
    t.script.push({ match: d => d.type === 'cardGallery' && /Overcharge/.test(d.title || ''), answer: () => ({ cardName: 'Blade of the Frostbringer' }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: 'Fireball' }) });
    const vorher = t.census();
    const r = await t.play(0, 'Overcharge', { hero: 0, noGrant: true });
    const diff = t.censusDiff(vorher, t.census());
    const deck = t.pile(0, 'mainDeck'), zone = t.gs.players[0].supportZones[0].flat();
    R.check(`Seed ${seed}: Blade liegt nicht zugleich auf dem Brett und im Deck`, !(zone.includes('Blade of the Frostbringer') && deck.includes('Blade of the Frostbringer')), { r, zone, deck });
    R.check(`Seed ${seed}: ZZ Dummy ist nicht aus dem Deck verschwunden`, deck.includes('ZZ Dummy'), { deck });
    R.check(`Seed ${seed}: Kartenbilanz nur Overcharge → Ablage / Spell-Karten (keine Duplikate)`, diff.every(x => !/Blade of the Frostbringer: \+|ZZ Dummy: -/.test(x)), diff);
    R.check(`Seed ${seed}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
