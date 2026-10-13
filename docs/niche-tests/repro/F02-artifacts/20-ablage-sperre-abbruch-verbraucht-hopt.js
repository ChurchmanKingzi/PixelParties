'use strict';
// F02-20 · Eye-of-Ren-Freikauf abgelehnt = Ausspielen abgebrochen – aber der „1 pro Zug"-Stempel von Relic in the Sky / Magic Sapphire bleibt verbraucht
// Ruling (_engine.js ~Z. 2610-2626, Als Regel 29.8. / v627): Ablehnen des Freikaufs gilt als ABGEBROCHEN – die Karte bleibt in der Hand, die Kosten kommen zurück (Regel 23.9: „Abbruch heißt: nichts ist passiert").
// Kartentexte: Relic in the Sky „Add the bottom card of your discard pile to your hand. You can only play 1 "Relic in the Sky" per turn."; Magic Sapphire „Choose a Spell from your discard pile and add it to your hand. … You can only play 1 "Magic Sapphire" per turn."
// Aufbau: Sitz 0: Hand [Karte ×2, ZZ Filler], Ablage [Fireball, Attack], 100 Gold; Ablage-Sperre mit Freikauf 6 Gold (wie The Eye of Ren: `_discardLockedTurn`, `_discardLockBuyout`).
// Schritte: 1. Karte spielen, die Freikauf-Frage mit „No" (null) beantworten. 2. Dieselbe Karte erneut spielen, Freikauf diesmal bezahlen.
// Erwartet: nach dem Abbruch ist nichts verbraucht (Karte in der Hand, kein Stempel in `gs.hoptUsed`); der zweite Versuch gelingt und holt eine Karte aus der Ablage.
// Beobachtet: Karte in der Hand und Gold zurück ✓, aber `gs.hoptUsed['<Karte>:0']` steht auf dem Zug: der zweite Versuch wird abgelehnt (`false`), die Karte ist für den Rest des Zuges gesperrt.
// Vermutete Ursache: relic-in-the-sky.js `resolve` ruft `claimHOPT` VOR `takeFromPile`; die Gems (`_magic-gem-shared.js maybeKeepGemInHand`) claimen am Ende von `resolve`; `_applyDiscardOutDecline` (_engine.js:2619) macht aus dem Ergebnis `{cancelled: true}`, gibt den Stempel aber nicht frei.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const name of ['Relic in the Sky', 'Magic Sapphire']) {
    const t = await H.fresh({ hand: [[name, name, 'ZZ Filler'], []], gold: [100, 100], discard: [['Fireball', 'Attack'], []] });
    const ps = t.gs.players[0];
    ps._discardLockedTurn = t.gs.turn;
    ps._discardLockBuyout = { cost: 6, turn: t.gs.turn, source: 'The Eye of Ren', paidTurn: null };
    let ja = false;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Eye of Ren', answer: () => (ja ? { confirmed: true } : null) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
    t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => null });
    const g0 = ps.gold;
    await t.play(0, name);
    const hand1 = t.pile(0, 'hand'), hopt = Object.keys(t.gs.hoptUsed || {});
    R.check(`${name}: nach abgelehntem Freikauf Karte in der Hand und Gold zurück`, hand1.filter(n => n === name).length === 2 && ps.gold === g0, { hand1, goldDelta: ps.gold - g0 });
    R.check(`${name}: kein „1 pro Zug"-Stempel nach dem Abbruch`, hopt.length === 0, hopt);
    ja = true;
    const r2 = await t.play(0, name);
    R.check(`${name}: zweiter Versuch (Freikauf bezahlt) wird gespielt`, r2 === true && t.pile(0, 'hand').includes('Fireball'), { r2, hand: t.pile(0, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
