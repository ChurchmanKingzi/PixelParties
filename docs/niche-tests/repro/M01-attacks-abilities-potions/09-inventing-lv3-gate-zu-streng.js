'use strict';
// M01-09 · Inventing Lv3: die Aktivierung wird verweigert, obwohl nach dem Abwurf einer anderen Handkarte ein Treffer im Deck läge
// Kartentext Inventing 3): „You may once per turn discard a card to search your deck for a card with a different name, reveal it and add it to your hand. You cannot play cards with that name this turn."
// Skript: `onFreeActivate` vergleicht mit dem ABGEWORFENEN Namen (`cn === discardName`), `canFreeActivate` (inventing.js ~Z. 40-45) verlangt dagegen
//   `(ps.mainDeck).some(cn => !handNames.has(cn) || cn !== cn)` – eine Deckkarte, deren Name auf KEINER Handkarte steht (der `|| cn !== cn`-Zweig ist immer falsch).
// Aufbau: Held 0 mit Inventing Lv3; Hand [Fireball, Heal]; Deck [Heal, Heal, Heal].
// Erwartet: aktivierbar – Fireball abwerfen, dann Heal (anderer Name als „Fireball") suchen.
// Beobachtet: `doActivateFreeAbility` lehnt ab (false), Hand/Deck unverändert, HOPT nicht verbraucht.
// Kontrollen: Hand [Fireball], Deck [Heal] → aktivierbar (✓); Hand [Fireball], Deck [Fireball] → nicht aktivierbar (✓, wirklich kein anderer Name).
const H = require('../../lib/h.js');
const free = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
(async () => {
  const R = H.runner();
  for (const [label, hand, deck, soll] of [
    ['Hand [Fireball, Heal], Deck [Heal×3]', ['Fireball', 'Heal'], ['Heal', 'Heal', 'Heal'], true],
    ['Hand [Fireball, Heal], Deck [Fireball, Heal]', ['Fireball', 'Heal'], ['Fireball', 'Heal'], true],
    ['Kontrolle: Hand [Fireball], Deck [Heal]', ['Fireball'], ['Heal'], true],
    ['Kontrolle: Hand [Fireball], Deck [Fireball]', ['Fireball'], ['Fireball'], false],
  ]) {
    const t = await H.fresh({ hand: [hand, []], deck: [deck, []], abilities: { 0: { 0: [['Inventing', 'Inventing', 'Inventing'], [], []] } } });
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(0, 'hand').indexOf('Fireball') }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await free(t, 0, 0, 0);
    R.check(`${label}: ${soll ? 'aktivierbar' : 'nicht aktivierbar'}`, (r === true) === soll, { r, hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck') });
  }
  R.finish();
})();
