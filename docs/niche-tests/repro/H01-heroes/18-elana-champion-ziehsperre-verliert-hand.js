'use strict';
// H01-heroes-18 · Elana / Champion unter Zieh- bzw. Handsperre: Hand geht verloren, nachgezogen wird nichts (Aktivierung nicht gesperrt)
//
// Kartentext Elana: „You may once per turn shuffle your entire hand back into the deck and then draw the same number of cards +1."
// Kartentext Champion: „You may spend your Action to discard up to 5 cards from your hand, then draw that many cards. …"
// Konvention: Heldeneffekte, deren Kern an der Handsperre scheitert, sind nicht aktivierbar (Enigma: `if (ps.handLocked) return false;`, Kommentar „mirrors
//   Infiltration's gate"; Beato Eternal / Throne Robber / Dajan: Ascension-Bonus fizzelt bei `handLocked`).
// Aufbau: Sitz 0 mit Elana bzw. Champion, 3–4 Handkarten, Deck 12; `ps.drawLocked = true` (Sacred Jewel) bzw. `ps.handLocked = true`.
// Erwartet (Lesart A – gesperrt wie Enigma): Aktivierung nicht möglich, Hand bleibt. (Lesart B – erlaubt): dann zumindest kein stiller Totalverlust.
// Beobachtet: Elana ist aktivierbar, die ganze Hand wandert ins Deck (4 → 0 Handkarten, Deck 12 → 16), gezogen wird nichts. Champion: wirft 3 Karten ab, zieht keine.
// Ursache: `elana-the-rocky-rebel.js` / `champion-the-stormbringer.js` `canActivateHeroEffect` prüfen `drawLocked`/`handLocked` nicht.
// ★ ENTSCHIEDEN (Regel von Al, Welle 3 / D1): unter einer Zieh-Sperre bleibt eine Aktivierung spielbar, solange NICHT der komplette Effekt nur Ziehen ist
//   (Abwerfen, Zurückmischen, Löschen aus der Ablage … sind eigenständig – „es gibt Decks, die abwerfen wollen“); gesperrt sind nur reine Zieher.
//   Elana (Hand zurückmischen) und Champion (Karten abwerfen) sind Mischeffekte: sie bleiben unter drawLocked/handLocked aktivierbar (Hand-Verlust ist dann ERWARTET).
const H = require('../../lib/h.js');
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  async function elana(sperre) {
    const t = await H.fresh({ heroes: [['Elana, the Rocky Rebel', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []], deck: [Array(12).fill(D), Array(12).fill(D)] });
    t.gs.players[0][sperre] = true;
    const r = await t.activateHero(0, 0, {});
    return { r, hand: t.pile(0, 'hand').length, deck: t.pile(0, 'mainDeck').length, t };
  }
  for (const s of ['drawLocked', 'handLocked']) {
    const x = await elana(s);
    R.check(`Elana unter ${s}: Mischeffekt bleibt aktivierbar (Hand wird zurückgemischt)`, x.hand < 4, { aktiviert: x.r, hand: x.hand, deck: x.deck });
    R.check(`Elana unter ${s}: keine Engine-Fehler`, x.t.errors.length === 0, x.t.errors);
  }
  async function champion() {
    const t = await H.fresh({ heroes: [['Champion, the Stormbringer', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], ['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']], deck: [Array(10).fill(D), Array(10).fill(D)] });
    t.gs.players[0].drawLocked = true;
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.slice(0, 3).map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    t.resetActions(0);
    const r = await t.activateHero(0, 0, { phase: 3 });
    return { r, hand: t.pile(0, 'hand').length };
  }
  const c = await champion();
  R.check('Champion unter drawLocked: Mischeffekt bleibt aktivierbar (Karten werden abgeworfen)', c.hand < 4, { aktiviert: c.r, hand: c.hand });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
