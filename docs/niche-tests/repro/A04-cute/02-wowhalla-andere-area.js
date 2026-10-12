'use strict';
// A04-cute-02 · Verlässt eine ANDERE eigene Area das Brett, wird der Coolness Stack gelöscht
//
// Kartentext (Wowhalla): "If this card is removed from the board, delete all cards in your Coolness Stack."
// Erwartung: nur wenn WOWHALLA selbst das Brett verlässt, wird der Stack gelöscht.
// Beobachtet: Wowhalla + Spatial Crevice (Limit 3) + Slippery Ice liegen. Slippery Ice wird entfernt (z. B. durch
//   The Yeeting / Hammer Skeleton / Coolness Overcharge) → der gesamte Coolness Stack wandert in den Gelöscht-Stapel,
//   obwohl Wowhalla weiter liegt.
// Ursache: cards/effects/wowhalla-the-hall-of-the-cool.js `onCardLeaveZone` (Zeile 124) prüft nur fromZone === 'area'
//   und fromOwner, NICHT ob die gehende Karte Wowhalla selbst ist (ctx.leavingCard / ctx.card.id).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Wowhalla, the Hall of the Cool';
  const t = await H.fresh({ deck: [[H.INERT.creature, H.INERT.creature, H.INERT.creature], []] });
  t.putArea(0, W);
  t.putArea(0, 'Spatial Crevice');
  const ice = t.putArea(0, 'Slippery Ice');
  const ps = t.gs.players[0];
  for (const n of ['Cute Bunny', 'Cute Cat', 'Cute Dog']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  await t.run(() => t.engine.removeArea(ice, 'Test'));
  R.check('Slippery Ice liegt in der Ablage', t.pile(0, 'discardPile').includes('Slippery Ice'));
  R.check('Wowhalla liegt noch auf dem Brett', t.gs.areaZones[0].includes(W), t.gs.areaZones[0]);
  R.check('Coolness Stack ist unverändert (3 Karten)', ps.coolnessStack.length === 3, { stack: ps.coolnessStack.slice(), deleted: t.pile(0, 'deletedPile').slice() });
  R.check('keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
