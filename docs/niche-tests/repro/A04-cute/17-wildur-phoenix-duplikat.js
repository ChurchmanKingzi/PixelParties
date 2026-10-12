'use strict';
// A04-cute-17 · Wildur + Cute Phoenix: Phoenix steht nach dem Revive doppelt im Spiel (Brett UND Coolness Stack)
//
// Kartentexte: Wildur: "The first card that would be sent to your discard pile every turn while you control this Creature is placed on top
//   of your Coolness Stack instead."  Cute Phoenix: "If this Creature is defeated by an opponent's card or effect, you may discard 2 cards to
//   revive it and place it into the same Support Zone it occupied before with full HP."
// Erwartung: Es gibt genau EIN Cute Phoenix (er wurde wiederbelebt, also nicht mehr als Leiche irgendwo).
// Beobachtet: Die Leiche wird von Wildur (erste Ablage-Karte des Zuges) auf den Coolness Stack gelegt; der Revive sucht sie in der Ablage,
//   findet sie nicht und beschwört trotzdem eine frische Instanz → Phoenix auf dem Brett UND auf dem Stack (Kartenbilanz +1).
// Ursache: Revive-Pfad der Engine (`_wiederbelebungNachTod`/`_reviveAfterDeath`) nimmt die Leiche aus der Ablage, ohne zu prüfen, ob sie dort
//   überhaupt liegt; wildur-the-shining-coolness.js lenkt das Ablegen per `discardPile.push` um, bevor der Revive läuft.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Wildur, the Shining Coolness';
  for (const mitWildur of [false, true]) {
    const t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    const ps = t.gs.players[0]; ps.coolnessStack.push('Cute Bunny'); t.engine._trackCard('Cute Bunny', 0, 'coolnessStack');
    if (mitWildur) { const w = t.put(0, 0, 2, WI); w.turnPlayed = 0; }
    const ph = t.put(0, 0, 0, 'Cute Phoenix');
    t.script.push({ match: d => d.type === 'forceDiscard', answer: (d, pi, tt) => { const h = tt.pile(0, 'hand'); const i = h.indexOf(H.INERT.filler); return { cardName: h[i], handIndex: i }; } });
    await t.turnStart(0);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, ph, 999, 'creature', { sourceOwner: 1 }));
    const gesamt = t.census().get('Cute Phoenix') || 0;
    R.check((mitWildur ? 'MIT Wildur' : 'Gegenprobe ohne Wildur') + ': genau 1 Cute Phoenix im Spiel (Brett/Stack/Ablage)', gesamt === 1, { gesamt, stack: ps.coolnessStack.slice(), brett: t.inst(c => c.name === 'Cute Phoenix' && c.zone === 'support').length });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
