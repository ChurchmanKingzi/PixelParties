'use strict';
// S01-27 · Such-Sperre („cannot search … cards") greift nicht bei Deck-Suchen, die auf das Brett führen
// Kartentext Cats of the Pharaoh (setzt `ps.searchLocked`): „…you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)."
// CARD_API.md ~Z. 15805-15830: `searchLocked` sperrt „Deck-Suche und Adds". Das Tor sitzt in `_isSearchBlocked` (Aufrufer: Tutor-Primitive wie `actionAddCardFromDeckToHand`) und in der Loader-Marke
//   `blockedBySearchLock` (`_cardBlockedBySearchLock`, _engine.js ~Z. 10766).
// Aufbau: `ps.searchLocked = true`; Sitz 0 spielt (a) Create Illusion („Choose a … Creature from your deck and place it into a free Support Zone"), (b) Create Secret Room („Choose a card from your deck and place it …
//   Surprise Zone face-down"), (c) Divine Gift of the Deepsea (Ersatzkreatur „from your deck or hand"). Kontrolle: Brainstorming (Deck → Hand) ist gesperrt.
// Lesart A (verworfen): auch das Suchen im Deck ohne Hand-Add ist „search" ⇒ gesperrt. Lesart B: nur Suchen-und-auf-die-Hand ⇒ erlaubt.
// ★ W18b (Entscheidung Al, 19.10.2026, S01-27: „Soll ‚cannot search' auch Deck-Suchen sperren, die aufs Brett führen?" – „Nein, nur Deck -> Hand"): Die Such-Sperre sperrt nur
//   Deck-Suchen, die auf die HAND führen. Suchen aufs Brett (Create Illusion, Create Secret Room, Divine Gift of the Deepsea) bleiben erlaubt (Deck −1 Karte, Karte auf dem Brett /
//   in der Surprise Zone); nur Brainstorming wird abgelehnt. Das Repro prüft jetzt diese Regel (Ist-Zustand, Skript unverändert).
const H = require('../../lib/h.js');
async function lauf(card, deck, setup, match, pick) {
  const t = await H.fresh({ hand: [[card], []], deck: [deck, ['ZZ Dummy']], abilities: { 0: { 0: [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Summoning Magic', 'Summoning Magic'], ['Support Magic']] } }, gold: [100, 100] });
  setup && setup(t);
  t.gs.players[0].searchLocked = true;
  t.script.push({ match, answer: () => ({ cardName: pick }) });
  t.script.push({ match: (d) => d.type === 'zonePick', answer: (d) => { const z = (d.zones || [])[0]; return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner ?? 0 } : null; } });   // W18b: Zonenwahl (seit W16g abbrechbar) beantworten
  const d0 = t.pile(0, 'mainDeck').length;
  const r = await t.play(0, card, { hero: 0, noGrant: true });
  return { r, deckVerloren: d0 - t.pile(0, 'mainDeck').length };
}
(async () => {
  const R = H.runner();
  const k = await lauf('Brainstorming', ['Fireball'], (t) => t.setDiscard(0, ['Fireball', 'Fireball', 'Fireball', 'Fireball']), (d) => d.type === 'cardGallery', 'Fireball');
  R.check('Kontrolle: Brainstorming (Deck → Hand) ist unter der Such-Sperre nicht spielbar', k.r === false, k);
  const a = await lauf('Create Illusion', ['Elven Archer', 'Fireball'], null, (d) => d.type === 'cardGallery' && d.title === 'Create Illusion', 'Elven Archer');
  R.check('(a) Create Illusion (Deck → Brett) ist unter der Such-Sperre erlaubt', a.r === true && a.deckVerloren === 1, a);
  const b = await lauf('Create Secret Room', ['Fireball', 'Fireball'], null, (d) => d.type === 'cardGallery' && d.title === 'Create Secret Room', 'Fireball');
  R.check('(b) Create Secret Room (Deck → Surprise Zone) ist unter der Such-Sperre erlaubt', b.r === true && b.deckVerloren === 1, b);
  const c = await lauf('Divine Gift of the Deepsea', ['Aggressive Town Guard', 'Fireball'], (t) => { t.put(0, 0, 0, 'Elven Archer').turnPlayed = 1; }, (d) => d.type === 'cardGallery' && d.title === 'Divine Gift of the Deepsea', 'Aggressive Town Guard');
  R.check('(c) Divine Gift of the Deepsea (Ersatzkreatur Deck → Brett) ist unter der Such-Sperre erlaubt', c.r === true && c.deckVerloren === 1, c);
  R.finish();
})();
