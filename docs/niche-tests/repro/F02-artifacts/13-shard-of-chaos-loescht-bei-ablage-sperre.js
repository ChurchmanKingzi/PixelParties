'use strict';
// F02-13 · Shard of Chaos: unter der Ablage-Ausgangssperre werden Handkarten gelöscht, ohne dass etwas geholt wird
// Kartentext: „Delete up to 3 cards from your hand. Then, choose the same number of cards of the same type … from your discard pile and add them to your hand. Delete this card."
// Ruling (_engine.js ~Z. 2610-2626, Als Regel 29.8. / v627): lehnt der Spieler den Eye-of-Ren-Freikauf ab, gilt das Ausspielen als ABGEBROCHEN – Karte bleibt in der Hand, Kosten kommen zurück;
//   Karten, die VOR der Ablagebewegung schon etwas Bleibendes getan haben, setzen `discardOutDeclineConsumes` (dann ist die Karte verbraucht). Kein Skript setzt das Flag.
// Aufbau: Sitz 0: Hand [Shard of Chaos, Fireball, Attack], Ablage [Fireball, Attack, Fireball], 100 Gold; `ps._discardLockedTurn = Zug` + `_discardLockBuyout` {cost 6, source The Eye of Ren} (so setzt es the-eye-of-ren.js).
// Schritte: 1. Shard spielen, Fireball + Attack löschen. 2. Menschlicher Abbruch (`null`) auf die Freikauf-Frage „Pay 6 Gold?". (Fall b: harte Sperre der Stäbe, kein Freikauf.)
// Erwartet: entweder ist das Ausspielen ein sauberer Abbruch (nichts gelöscht, Shard in der Hand) – oder die Karte ist verbraucht (Shard gelöscht). Nicht: Handkarten gelöscht UND Shard zurück in der Hand (a) bzw. Handkarten gelöscht und nichts geholt (b, Rückfrage).
// Beobachtet: (a) Fireball und Attack liegen im Gelöscht-Stapel, Shard ist zurück in der Hand, Gold zurückerstattet, nichts geholt. (b) Fireball + Attack + Shard gelöscht, die Ablage bleibt unberührt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const baue = async (hart) => {
    const t = await H.fresh({ hand: [['Shard of Chaos', 'Fireball', 'Attack'], []], gold: [100, 100], discard: [['Fireball', 'Attack', 'Fireball'], []] });
    const ps = t.gs.players[0];
    ps._discardLockedTurn = t.gs.turn;
    if (!hart) ps._discardLockBuyout = { cost: 6, turn: t.gs.turn, source: 'The Eye of Ren', paidTurn: null };
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Eye of Ren', answer: () => null });   // Mensch: „No" = cancelled → null
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [{ handIndex: t.pile(0, 'hand').indexOf('Fireball') }, { handIndex: t.pile(0, 'hand').indexOf('Attack') }] }), once: true });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ selectedCards: ['Fireball', 'Attack'] }) });
    return t;
  };
  let t = await baue(false);
  const g0 = t.gs.players[0].gold;
  await t.play(0, 'Shard of Chaos');
  const hand = t.pile(0, 'hand'), del = t.pile(0, 'deletedPile');
  R.check('(a) Eye-Freikauf abgelehnt: nicht „Handkarten gelöscht UND Shard zurück in der Hand"', !(hand.includes('Shard of Chaos') && del.length > 0), { hand, del, goldDelta: t.gs.players[0].gold - g0 });
  t = await baue(true);
  await t.play(0, 'Shard of Chaos');
  R.check('(b) harte Ablage-Sperre (Stäbe): nicht „Handkarten gelöscht und nichts geholt" (Stufe C)', t.pile(0, 'deletedPile').length === 0 || t.pile(0, 'discardPile').length < 3, { hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile'), disc: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
