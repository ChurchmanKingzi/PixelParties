// H02-heroes-32 · Kit: Modus „Add the Creature to your hand" ignoriert Hand- und Such-Sperre
//
// Kartentext Kit: „Whenever an Ability is attached to this Hero, you may reveal a Creature from your deck and choose one of these effects: - Add the Creature to your hand. …"
// Sperren (CARD_API.md „Cats of the Pharaoh (v1068)", `handLocked` = „You cannot draw or add cards to your hand for the rest of the turn", `searchLocked` = „Deck-Suche und Adds"): Karten dürfen dann nicht aus dem Deck auf die Hand.
// Kit nimmt die Karte mit `takeFromPile` aus dem Deck und legt sie per `engine.handZugangSync(...)` auf die Hand, ohne `ps.handLocked`/`_isSearchBlocked` zu fragen (kit-the-shark-researcher.js, Modus A).
// Aufbau: Kit als Held 0, Hand [Fighting], Deck [ZZ Dummy, Fireball, Fireball]; `ps.handLocked = true` (bzw. `ps.searchLocked = true`); Sitz 0 legt Fighting an Kit an, wählt ZZ Dummy und Modus A.
// Erwartung: das Creature kommt nicht auf die Hand (Kontrolle: ohne Sperre kommt es). Beobachtung: Creature liegt auf der Hand, Deck −1.
// Aufruf: node docs/niche-tests/repro/H02-heroes/32-kit-modus-a-handsperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KT = 'Kit, the Shark Researcher';
async function lauf(sperre) {
  const t = await H.fresh({ heroes: [[KT, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fighting'], []], deck: [[H.INERT.creature, 'Fireball', 'Fireball'], []] });
  if (sperre) t.gs.players[0][sperre] = true;
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === KT, answer: () => ({ cardName: H.INERT.creature }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === KT, answer: () => ({ optionId: 'A' }) });
  t.script.push({ match: d => d.type === 'deckSearchReveal', answer: () => ({}) });
  await t.play(0, 'Fighting', { hero: 0 });
  return t;
}
(async () => {
  const R = H.runner();
  { const t = await lauf(null);
    R.check('Kontrolle ohne Sperre: Creature kommt auf die Hand', t.pile(0, 'hand').includes(H.INERT.creature), t.pile(0, 'hand')); }
  for (const s of ['handLocked', 'searchLocked']) {
    const t = await lauf(s);
    R.check(`unter ${s} kommt das Creature nicht auf die Hand`, !t.pile(0, 'hand').includes(H.INERT.creature), { hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck').length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
