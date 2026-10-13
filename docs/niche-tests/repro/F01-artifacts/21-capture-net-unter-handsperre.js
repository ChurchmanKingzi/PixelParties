'use strict';
// F01-artifacts-21 · Capture Net holt die Kreatur trotz Hand-Sperre auf die Hand (und kassiert die Kosten)
// Kartentext Capture Net: „Choose a Creature on the board and add it to your hand. …"; Hand-Sperre (z. B. Ice Sculpture Garden / Rain of Spores): „You cannot draw or add cards to your hand for the rest of the turn afterwards."
// Aufbau: Sitz 0 steht unter Hand-Sperre (`ps.handLocked`, wie nach Ice Sculpture Garden), Hand [Capture Net], 100 Gold; Sitz 1 hat Albrecht auf dem Brett.
// Erwartung: Capture Net ist wie Cute Cheese/Cool Cheese/Boomerang/Birthday Present unter Hand-Sperre nicht spielbar bzw. holt nichts (Gegenprobe im Repro: diese Karten bleiben auf der Hand, kein Gold weg).
// Beobachtet: Capture Net wird gespielt (4 Gold), Albrecht liegt auf der Hand von Sitz 0.
// Ursache: `capture-net.js` Z. 185 ruft `stealBoardCardToHand` (`_sparkfly-shared.js` Z. 289, auch von Sparkfly Queen/Worker und Winged Skeleton genutzt), das `handZugangGesperrt` nicht prüft; Capture Net selbst hat kein `blockedByHandLock`, `canActivate` ohne Sperre; `handZugang` trägt die Sperre dem Aufrufer auf (`_engine.js` Z. 11626–11634).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const karte of ['Cute Cheese', 'Boomerang', 'Capture Net']) {
    const t = await H.fresh({ hand: [[karte], []], deck: [['Albrecht, the Nerd', 'ZZ Dummy', 'ZZ Dummy'], undefined], discard: [['Beer'], []], gold: [100, 100] });
    t.put(1, 0, 0, 'Albrecht, the Nerd');
    t.gs.players[0].handLocked = true;
    t.targetFn = (v) => (karte === 'Capture Net' ? [v.find(x => x.type === 'equip').id] : [v[0].id]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const g0 = t.gs.players[0].gold;
    await t.play(0, karte, { hero: 0 });
    const zusatz = t.pile(0, 'hand').filter(n => n !== karte);
    R.check(karte + ' unter Hand-Sperre: keine Karte auf die Hand, kein Gold bezahlt', zusatz.length === 0 && t.gs.players[0].gold === g0, { hand: t.pile(0, 'hand'), gold: g0 - t.gs.players[0].gold });
    R.check(karte + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
