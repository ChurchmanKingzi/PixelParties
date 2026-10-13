'use strict';
// M01-15 · Charme Lv1 kann „Infiltration" des Gegners nie ausleihen (Vorprüfung ohne Held-Index liest „kein Held" = false)
// Kartentext Charme 1): „You may once per turn choose an Ability attached to an opponent's Hero and use it as if it was attached to this Hero."
// Aufbau: Seed 1234, Zug 5, Main Phase 1; Sitz 0 Held 0: Charme (Lv1); Sitz 1 Held 0: die Ability X (Lv1), Gegner-Deck 10 Karten, eigene Hand 2 Karten.
// Erwartet: Charme ist aktivierbar und leiht X aus (wie bei Leadership/Inventing/Alchemy, Kontrollen unten); bei Infiltration kommt die Karte vom Gegnerdeck auf die Hand.
// Beobachtet: bei Infiltration `doActivateFreeAbility` = false, keine Abfrage; bei den Kontrollen true.
// Ursache: `charme.js` `_getOpponentActivatableAbilities` (~Z. 255-275) prüft die geliehene Ability mit einem Kontext OHNE `cardHeroIdx` („bleibt bewusst offen"); nur ein explizites `false`
// schließt aus – `infiltration.js` `canFreeActivate` (Z. 34-38) liest aber `heroes[ctx.cardHeroIdx]`, findet keinen Helden und liefert `false`.
const H = require('../../lib/h.js');
const free = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
(async () => {
  const R = H.runner();
  for (const ab of ['Leadership', 'Inventing', 'Alchemy', 'Infiltration']) {
    const t = await H.fresh({ hand: [['ZZ Filler', 'ZZ Filler'], ['ZZ Filler']], deck: [Array(10).fill('Fireball'), Array(10).fill('Heal')], potionDeck: [['Healing Potion', 'Elixir of Quickness'], []], gold: 100,
      abilities: { 0: { 0: [['Charme'], [], []] }, 1: { 0: [[ab], [], []] } } });
    t.script.push({ match: d => d.type === 'handPick' || d.type === 'forceDiscardCancellable', answer: (d) => d.type === 'handPick' ? { selectedCards: [{ cardName: t.pile(0, 'hand')[0], handIndex: 0 }] } : { cardName: t.pile(0, 'hand')[0], handIndex: 0 } });
    const opp0 = t.pile(1, 'mainDeck').length;
    const r = await free(t, 0, 0, 0);
    R.note(`${ab}: Charme Lv1 r=${r}, Gegnerdeck ${opp0} -> ${t.pile(1, 'mainDeck').length}, Hand Sitz 0 = ${JSON.stringify(t.pile(0, 'hand'))}`);
    R.check(`Charme Lv1 leiht ${ab} des Gegners aus`, r === true, r);
    R.check(`${ab}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
