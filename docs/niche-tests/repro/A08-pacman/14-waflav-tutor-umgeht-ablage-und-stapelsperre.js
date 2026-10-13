// A08-14 · Waflav-Tutoren („Add … Ascended Hero from your deck/discard pile to your hand") umgehen die Stapel-Sperren (Ablage-Sperre, Knight of Kings [B])
//
// Kartentext Deep-Drowned Waflav: „On Ascension: Choose up to 2 Ascended Heroes from your discard pile and add them to your hand."
// Kartentext Stormkissed Waflav:  „On Ascension: Add 1 Ascended Hero from your deck to your hand."
// Kartentext The Eye of Ren: „… You cannot move cards out of your discard pile for the rest of the turn unless you spend an additional 6 Gold."
// Kartentext Knight of Kings [B]: „… your opponent cannot move cards from their deck or discard pile to anywhere else (but they can still draw)."
// Ruling CARD_API.md „Die Stapel-Schicht (v820)": Karten bewegen sich nie per Splice aus Deck/Ablage; Sperren (`pileOutAllowed`, `_discardOutAllowed`) hängen in der Schicht.
//
// Erwartung: Nach The Eye of Ren (Gold danach 0, die 6 Gold sind nicht zahlbar) bleibt die Ablage zu: Deep-Drowned holt beim Aufstieg nichts zurück.
//   Unter Knight of Kings [B] + Rook of Kings + Board of Kings holt Stormkissed keine Karte aus dem Deck.
// Beobachtet: Beide Tutoren laufen durch (`_waflav-shared.js tutorAscendedHeroes`: `pile.splice(idx, 1)` + `handZugangSync`; der Wächter `check-no-splice.js` sucht
//   nur `discardPile.splice(` o. ä. und übersieht den Alias `pile`). Nur `ps.handLocked` wird beachtet.
// Aufruf: node docs/niche-tests/repro/A08-pacman/14-waflav-tutor-umgeht-ablage-und-stapelsperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  const neu = () => H.fresh({
    heroes: [[WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null],
    gold: [4, 100], hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)],
  });
  const steigAuf = async (t, name) => {
    t.gs.activePlayer = 0; t.phase(2);
    t.engine.handZugangSync(0, name);
    return t.run(() => t.engine.performAscension(0, 0, name, t.pile(0, 'hand').indexOf(name), {}));
  };
  {   // (a) The Eye of Ren sperrt die Ablage (6 Gold Freikauf, Gold ist 0)
    const t = await neu();
    t.hero(0, 0)._evolutionCounters = 4;
    t.setDiscard(0, ['Stormkissed Waflav', 'Flamebathed Waflav']);
    t.script.push({ match: d => d.type === 'cardGallery' && /Eye of Ren/.test(d.title || ''), once: true, answer: (d) => ({ cardName: d.cards[0].name }) });
    t.policy.confirm = false;     // Freikauf-Frage (falls gestellt) ablehnen
    await t.play(0, 'The Eye of Ren');
    R.check('Aufbau: Ablage-Sperre steht, Gold 0', t.gs.players[0]._discardLockedTurn === t.gs.turn && t.gs.players[0].gold < 6, { sperre: t.gs.players[0]._discardLockedTurn, gold: t.gs.players[0].gold });
    t.script.push({ match: d => d.type === 'cardGallery' && /Deep-Drowned/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await steigAuf(t, 'Deep-Drowned Waflav');
    R.check('Aufstieg lief', r && r.success === true, r);
    R.check('Deep-Drowned holt NICHTS aus der gesperrten Ablage', !t.pile(0, 'hand').some(n => n === 'Stormkissed Waflav' || n === 'Flamebathed Waflav'), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
    R.check('(a) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {   // (b) Knight of Kings [B] sperrt Deck und Ablage des Gegners (= Sitz 0)
    const t = await neu();
    t.hero(0, 0)._evolutionCounters = 4;
    t.setDeck(0, ['Flamebathed Waflav', F, F, F, F, F]);
    t.put(1, 0, 0, 'Knight of Kings [B]').turnPlayed = 1; t.put(1, 0, 1, 'Rook of Kings [B]').turnPlayed = 1; t.putArea(1, 'Board of Kings');
    R.check('Aufbau: Stapelsperre gegen Sitz 0 aktiv', t.engine.pileOutAllowed(0, 'deck', { sourceOwner: 0 }) === false, t.engine.pileOutAllowed(0, 'deck', { sourceOwner: 0 }));
    t.script.push({ match: d => d.type === 'cardGallery' && /Stormkissed/.test(d.title || ''), answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await steigAuf(t, 'Stormkissed Waflav');
    R.check('Aufstieg lief', r && r.success === true, r);
    R.check('Stormkissed holt NICHTS aus dem gesperrten Deck', !t.pile(0, 'hand').includes('Flamebathed Waflav'), { hand: t.pile(0, 'hand'), deck: t.pile(0, 'mainDeck').length });
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
