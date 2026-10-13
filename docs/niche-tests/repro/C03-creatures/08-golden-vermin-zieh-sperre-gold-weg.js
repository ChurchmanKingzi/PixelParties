'use strict';
// C03-creatures-08 · Golden Vermin bietet „1 Karte statt Gold" auch dann an, wenn nichts gezogen werden kann (Gold UND Karte gehen verloren)
// Kartentext: „Up to 5 times per turn, when you would gain Gold through an effect, you may draw 1 card instead."
// Vorbild-Ruling im Skript von Golden Ladybug (Als Bestätigung 24.9.): „Leerlauf: eine Option, die nichts bewirken kann, entfällt (Zieh-/Handsperre oder leeres Deck)."
// Aufbau: Sitz 0: Golden Vermin (Held 0 / Slot 0); Zieh-Sperre `drawLocked` bzw. `handLocked` (gesetzt z. B. von The Sacred Jewel / Slow); Sitz 0 gewinnt per Effekt 10 Gold
//   (`actionGainGold`); die Rückfrage wird mit Ja beantwortet (Harness-Standard).
// Erwartung: Entweder wird der Tausch gar nicht angeboten (Gold +10) oder die Karte kommt wirklich (Hand +1). Nie beides weg.
// Beobachtet: Die Rückfrage „Draw 1 card instead of gaining 10 Gold?" erscheint, Ja streicht das Gold, das Ziehen wird von der Sperre verschluckt: Gold ±0, Hand ±0.
// Ursache: cards/effects/golden-vermin.js `onResourceGain`: keine Prüfung auf `ps.drawLocked || ps.handLocked` / leeres Deck vor dem Angebot; `ctx.cancel()` läuft vor dem Zug.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lock of ['drawLocked', 'handLocked']) {
    R.section(`Sperre ${lock}`);
    const t = await H.fresh({ deckSize: 30 });
    const v = t.put(0, 0, 0, 'Golden Vermin'); v.turnPlayed = 1;
    t.gs.players[0][lock] = true;
    const g0 = t.gs.players[0].gold, h0 = t.pile(0, 'hand').length;
    await t.run(() => t.engine.actionGainGold(0, 10, { source: 'x' }));
    const dg = t.gs.players[0].gold - g0, dh = t.pile(0, 'hand').length - h0;
    R.note('Rückfragen', t.prompts.map(p => p.d.message));
    R.check('weder Gold noch Karte gehen ersatzlos verloren (Gold +10 oder Hand +1)', dg === 10 || dh === 1, { dGold: dg, dHand: dh });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
