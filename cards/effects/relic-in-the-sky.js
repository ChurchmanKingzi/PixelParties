'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Relic in the Sky"  (v1353)
//  Artifact — Normal, Cost 0
//
//  "Add the bottom card of your discard pile to your hand. You can only
//   play 1 "Relic in the Sky" per turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  · „bottom card" = `discardPile[0]` (oben liegt das zuletzt Abgelegte).
//    Relic selbst liegt beim Aufloesen noch in der Hand, kann sich also
//    nie selbst holen.
//  · „You can only play 1 … per turn" = HART, pro Spieler (v249-Regel):
//    `canActivate` graut die zweite Kopie aus, `claimHOPT` beim Aufloesen.
//  · Leere Ablage → nichts zu holen → ausgegraut. Die Entnahme ist der
//    einzige Effekt → `blockedByPileLock` (Stapel-Ausgangssperre) und die
//    Such-Sperre (`toHand: true`) greifen wie bei Shooting Star.
//
//  ── BILDER (Als Vorgabe: wie Shooting Star) ───────────────────────
//  Beide Karten fliegen GLEICHZEITIG: Relic Hand → Ablage, die unterste
//  Karte Ablage → Hand. Bauform von Shooting Star (v1312):
//   ⓪ Karte aus der Ablage nehmen (Sperren);
//   ① ihren Anflug ansagen — mit `flightStyle: 'glitzer'`: die
//     zurueckkehrende Karte glitzert unterwegs mit Partikeln;
//   ② Zustand senden; ③ Relic verlaesst JETZT die Hand in die Ablage
//     (`aufloesenderSpellInDieAblage` — gilt fuer jede aufloesende
//     Handkarte, der Artefakt-Weg im Server wiederholt dann nichts);
//   ④ nach der Flugzeit landet die Karte in der Hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Relic in the Sky';
const HOPT_KEY = 'relic-in-the-sky';

module.exports = {
  blockedByPileLock: true,

  canActivate(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return (gs.players[pi]?.discardPile || []).length > 0;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };
    if (!engine.claimHOPT(HOPT_KEY, pi)) return { cancelled: true };
    if ((ps.discardPile || []).length === 0) return true;

    // ⓪ die UNTERSTE Karte (Index 0) — ueber die Stapel-Schicht, damit
    // Ablage- und Such-Sperren greifen.
    const genommen = await engine.takeFromPile(pi, 'discard', 0, { source: CARD_NAME, toHand: true });
    if (!genommen) return true;   // gesperrt: Relic ist trotzdem gespielt
    const karte = genommen.name;

    // ① Anflug, solange Relic noch in der Hand liegt: sie geht gleich
    // hinaus, die Hand ist danach also so gross wie jetzt.
    const bleibtInHand = (ps.hand || []).includes(CARD_NAME) && !ps._resolvingCard?.fromCreation;
    const endGroesse = bleibtInHand ? ps.hand.length : ps.hand.length + 1;
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: karte, from: 'discard', to: 'hand',
      toHandIdx: endGroesse - 1, finalHandSize: endGroesse,
      flightStyle: 'glitzer',
    });
    // ② + ③
    engine.sync();
    await engine.aufloesenderSpellInDieAblage(pi);
    await engine._delay(650);

    // ④
    engine.handZugangSync(ps, karte, { source: CARD_NAME });
    engine._broadcastEvent('card_reveal', { cardName: karte, playerIdx: pi });
    await engine.runHooks('onCardAddedFromDiscardToHand', {
      playerIdx: pi, cardName: karte, addedCardName: karte, _skipReactionCheck: true,
    });
    engine.log('relic_in_the_sky', { player: ps.username, card: CARD_NAME, target: karte });
    engine.sync();
    return true;
  },
};
