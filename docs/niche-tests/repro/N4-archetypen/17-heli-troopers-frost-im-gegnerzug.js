'use strict';
// N4-archetypen-17 · Mischief Militia - Heli Troopers: „Freeze it for 1 turn" bei Tod im Zug des Gegners (Al, Welle 24: heutiges Verhalten stimmt)
// Kartentext (Heli Troopers): „When this Creature is defeated, you may choose a target on the board and Freeze it for 1 turn."
// Al: „Frost soll nur am Ende der Runde des Besitzers des gefrorenen Ziels enden, also bei applied Freeze gegen ein Ziel von Spieler A während des laufenden Zugs von Spieler A nur bis zum Ende des Zugs."
// Grundsatz (CARD_API.md, Welle 24): Frost endet am Ende des Zuges des Besitzers des gefrorenen Ziels. Wirkung im Zug des Zielbesitzers = bis zu dessen Zugende; Wirkung im Zug des Gegners = bis Ende des
//   nächsten Zuges des Zielbesitzers („1 turn").
// Erwartung (Exit 0): (a) Troopers sterben im Zug des Gegners (Sitz 1, Zug 5), Sitz 0 friert dessen Held 0 ein → gefroren nur für den Rest von Zug 5 (Zug 6 und 7: frei).
//   (b) Gegenprobe: Troopers sterben im EIGENEN Zug (Sitz 0 am Zug), friert den Gegnerheld ein → gefroren in dessen nächstem Zug (Zug 6), frei zu Beginn von Zug 7.
const H = require('../../lib/h.js');
async function lauf(imGegnerzug) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: imGegnerzug ? 1 : 0 });
  const heli = t.put(0, 0, 0, 'Mischief Militia - Heli Troopers'); heli.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.gs.activePlayer = imGegnerzug ? 1 : 0;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'X', owner: imGegnerzug ? 1 : 0, heroIdx: 0 }, heli, 500, 'creature', { sourceOwner: imGegnerzug ? 1 : 0 }));
  const f = () => !!t.hero(1, 0).statuses.frozen;
  const v = { z5: f() };
  await t.endTurn(); v.z6 = f();
  await t.endTurn(); v.z7 = f();
  return { t, v };
}
(async () => {
  const R = H.runner();
  const a = await lauf(true);
  R.check('(a) Aufbau: Gegnerheld wurde eingefroren (Zug 5, Zug des Gegners)', a.v.z5, a.v);
  R.check('(a) Frost endet am Ende des Zuges des Zielbesitzers: Zug 6 und Zug 7 frei', !a.v.z6 && !a.v.z7, a.v);
  const b = await lauf(false);
  R.check('(b) Aufbau: Gegnerheld wurde im eigenen Zug eingefroren', b.v.z5, b.v);
  R.check('(b) Gegenprobe: bis Ende des nächsten Zuges des Zielbesitzers: Zug 6 gefroren, Zug 7 frei', b.v.z6 && !b.v.z7, b.v);
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [a.t.errors, b.t.errors]);
  R.finish();
})();
