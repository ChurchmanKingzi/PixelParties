'use strict';
// M02-23 · Navigation unter der Such-Sperre: die Abwurf-Kosten werden bezahlt, die Suche bleibt wirkungslos (Trapping, Premonition, Training laufen sogar ganz durch)
// Kartentext Navigation Lv2: „You may once per turn discard 2 copies of the same card from your hand to search your deck for a card, reveal it and add it to your hand."
// Such-Sperre (Cats of the Pharaoh: „you cannot search or add cards to your hand"; `_engine.js` ~10630 „sperrt NUR Suchen und Adds"; Ruling v1069 Al 14.9.: Karten, die NUR suchen, sollen nicht spielbar sein).
// Erwartung: unter `ps.searchLocked` ist Navigation nicht aktivierbar (nichts abgeworfen, HOPT frei).
// Beobachtet: die Aktivierung läuft: 2 Kopien werden abgeworfen (Kosten), die Galerie öffnet sich, es kommt keine Karte auf die Hand, die Hand-Sperre-Folge setzt ein.
//   Ursache: Ability-Skripte tragen kein `blockedBySearchLock` (Loader-Auto-Erkennung liefert für keine der 41 Abilities eine Such-Marke; Navigation hat nur `blockedByHandLock`),
//   und der Free-Ability-Weg (`doActivateFreeAbility`, server.js ~9501 / `getFreeActivatableAbilities` _engine.js ~42456) fragt `_cardBlockedBySearchLock` nie
//   (nur die Aktions-Ability-Liste, _engine.js:40890, tut es).
// Nebenbefund derselben Ursache (Beobachtung, nicht in den Checks): Trapping legt die Surprise trotz Sperre ins Spiel, Premonition legt die Karte trotz Sperre obenauf,
//   Training Lv3 (Option B) durchsucht das Deck trotz Sperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [ln, lock] of [['keine Sperre (Kontrolle)', {}], ['searchLocked', { searchLocked: true }]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Fighting', 'Wealth', 'Booby Trap', 'ZZ Dummy'], ['ZZ Dummy']] });
    t.setAbilities(0, 0, [['Navigation', 'Navigation'], [], []]);
    t.setHand(0, ['Fireball', 'Fireball', 'ZZ Filler']);
    Object.assign(t.gs.players[0], lock);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.gs.activePlayer = 0; t.phase(2);
    const r = await t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }));
    const abgeworfen = t.pile(0, 'discardPile').length;
    if (!lock.searchLocked) R.check(`${ln}: Navigation liefert eine Karte`, t.pile(0, 'hand').includes('Booby Trap') || t.pile(0, 'hand').length > 1, { hand: t.pile(0, 'hand') });
    else R.check(`${ln}: Navigation nicht aktivierbar (keine Kosten bezahlt)`, !r && abgeworfen === 0 && t.pile(0, 'hand').length === 3, { r, abgeworfen, hand: t.pile(0, 'hand'), hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
