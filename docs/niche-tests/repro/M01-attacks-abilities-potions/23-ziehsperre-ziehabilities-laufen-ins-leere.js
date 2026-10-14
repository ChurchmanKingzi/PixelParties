'use strict';
// M01-23 · Zieh-Sperre (`drawLocked`, Sacred Jewel/Prayer): Alchemy, Leadership, Inventing sind aktivierbar, zahlen aber (Gold/Karten) und ziehen nichts
// Kartentext Alchemy 1: „You may once per turn spend 8 Gold in order to draw a card from your Potion Deck." · Leadership: „shuffle 1 card … and draw 1 card" · Inventing: „discard a card to draw a card".
// Sacred Jewel: „…but if you do, you cannot draw any cards for the rest of the turn afterwards." Engine: `actionDrawFromPotionDeck`/`actionDrawCards` liefern bei `ps.drawLocked` [] zurück.
// Aufbau: Sitz 0 hat die Ability (Lv1; Hand [Fireball, Heal], Deck 10, Potion Deck 3, 100 Gold) und `drawLocked = true`; freie Aktivierung (Main Phase 1).
// Erwartet (Konvention der Engine: `blockedByHandLock` graut Alchemy bei Hand-Sperre aus, `blockedByDrawLock` ist für „wertlose" Karten gedacht): die Aktivierung wird abgelehnt oder zumindest ist nichts bezahlt.
// Beobachtet: Alchemy: `true`, Gold 100 → 92, nichts gezogen, HOPT verbraucht; Leadership: `true`, Hand 2 → 1, Karte im Deck, nichts gezogen; Inventing Lv1: `true`, Karte abgeworfen, nichts gezogen.
// ★ ENTSCHIEDEN (Regel von Al, Welle 3 / D1): unter einer Zieh-Sperre bleibt eine Aktivierung spielbar, solange NICHT der komplette Effekt nur Ziehen ist
//   (Abwerfen, Zurückmischen, Löschen aus der Ablage … sind eigenständig – „es gibt Decks, die abwerfen wollen“); gesperrt sind nur reine Zieher.
//   Alchemy („spend Gold … to draw“) = reiner Zieher mit Gold als Preis: gesperrt. Leadership (zurückmischen), Inventing Lv1 (abwerfen), Horn in a Bottle (zurückmischen) = Mischeffekte: bleiben aktivierbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const free = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
  for (const ab of ['Alchemy', 'Leadership', 'Inventing']) {
    const t = await H.fresh({ hand: [['Fireball', 'Heal'], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('Fireball')], potionDeck: [Array(3).fill('Healing Potion'), []], gold: 100, abilities: { 0: { 0: [[ab], [], []] } } });
    t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'handPick' || d.type === 'forceDiscardCancellable', answer: (d) => d.type === 'handPick' ? { selectedCards: [{ cardName: t.pile(0, 'hand')[0], handIndex: 0 }] } : { cardName: t.pile(0, 'hand')[0], handIndex: 0 } });
    const g0 = t.gs.players[0].gold, h0 = t.pile(0, 'hand').length;
    const r = await free(t, 0, 0, 0);
    const kostenGezahlt = r === true && (t.gs.players[0].gold < g0 || t.pile(0, 'hand').length < h0);
    const erwartet = ab === 'Alchemy' ? !kostenGezahlt : kostenGezahlt;   // Alchemy gesperrt, die anderen laufen (Kosten fallen an)
    R.check(ab + (ab === 'Alchemy' ? ' unter drawLocked: reiner Zieher – nicht aktivierbar, kein Gold weg' : ' unter drawLocked: Mischeffekt bleibt aktivierbar (Kosten fallen an)'), erwartet, { r, gold: g0 + '→' + t.gs.players[0].gold, hand: h0 + '→' + t.pile(0, 'hand').length });
    R.check(ab + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // Trank: Horn in a Bottle („Shuffle any number of cards from your hand back into your deck to draw the same number of cards +1")
    const t = await H.fresh({ hand: [['Horn in a Bottle', 'Fireball', 'Heal'], []], deckSize: 20 });
    t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ cardName: 'Fireball', handIndex: 1 }, { cardName: 'Heal', handIndex: 2 }] }) });
    const h0 = t.pile(0, 'hand').length, d0 = t.pile(0, 'mainDeck').length;
    const r = await t.play(0, 'Horn in a Bottle');
    const verlust = r === true && t.pile(0, 'hand').length < h0 - 1;   // der Trank selbst zählt als −1
    R.check('Horn in a Bottle unter drawLocked: Mischeffekt bleibt spielbar (Karten werden zurückgemischt)', verlust, { r, hand: h0 + '→' + t.pile(0, 'hand').length, deck: d0 + '→' + t.pile(0, 'mainDeck').length });
  }
  R.finish();
})();
