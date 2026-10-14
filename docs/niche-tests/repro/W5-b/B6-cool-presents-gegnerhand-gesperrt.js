'use strict';
// W5b-B6 (zu A08-31, Teil Sperre) · Cool Presents ist nicht aktivierbar, wenn die Gegnerhand gesperrt ist – Entscheidung Al (Welle 5):
//   „In dem Fall sollte Cool Presents gar nicht aktivierbar sein; das Geben der Karten ist ja der einzige Effekt und würde versagen."
// Kartentext: „Add any number of cards with different names from your hand to your opponent's hand. This Artifact's Cost is multiplied by the number of cards you give your opponent."
// Erwartung: bei `searchLocked` oder `handLocked` des Gegners: Aktivierung abgelehnt (play → false), Karte bleibt auf der Hand, Gold unverändert, keine Zielwahl offen;
//   Gegenprobe ohne Sperre: aktivierbar (Zielwahl öffnet sich).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  for (const modus of ['searchLocked', 'handLocked', 'keine Sperre']) {
    const t = await H.fresh({ gold: [24, 100], hand: [[], []], deck: [Array(10).fill(F), Array(10).fill(F)] });
    t.engine.handZugangSync(0, 'Cool Presents'); t.engine.handZugangSync(0, F);
    if (modus !== 'keine Sperre') t.gs.players[1][modus] = true;
    const r = await t.play(0, 'Cool Presents', { noAutoConfirm: true });
    if (modus === 'keine Sperre') {
      R.check('Gegenprobe: ohne Sperre aktivierbar (Zielwahl offen)', r === true && !!t.gs.potionTargeting, { r });
    } else {
      R.check(`Gegnerhand ${modus}: nicht aktivierbar`, r === false, r);
      R.check(`Gegnerhand ${modus}: Karte bleibt auf der Hand, kein Gold bezahlt, keine Zielwahl`, t.pile(0, 'hand').includes('Cool Presents') && t.gs.players[0].gold === 24 && !t.gs.potionTargeting, { hand: t.pile(0, 'hand'), gold: t.gs.players[0].gold });
    }
    R.check(`(${modus}): keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // Sperre erst NACH der Zielwahl (Auflösung): kein Verbrauch
  {
    const t = await H.fresh({ gold: [24, 100], hand: [[], []], deck: [Array(10).fill(F), Array(10).fill(F)] });
    t.engine.handZugangSync(0, 'Cool Presents'); t.engine.handZugangSync(0, F);
    await t.play(0, 'Cool Presents', { noAutoConfirm: true });
    t.gs.players[1].searchLocked = true;
    await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: t.gs.potionTargeting.validTargets.map(v => v.id) }));
    R.check('Sperre erst bei der Auflösung: nichts bezahlt, nichts geliefert', t.gs.players[0].gold === 24 && t.pile(1, 'hand').length === 0, { gold: t.gs.players[0].gold, h1: t.pile(1, 'hand') });
  }
  R.finish();
})();
