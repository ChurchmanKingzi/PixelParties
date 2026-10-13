'use strict';
// S01-10 · Calm Diatribe: die zweite Aktion des gewählten Helden wird im nächsten Zug nie eingerichtet
// Kartentext: „Choose a Hero you control, except the user. You may perform a second Action with that Hero during your Action Phase next turn. This counts as an additional Action."
// Aufbau: Sitz 0 spielt Calm Diatribe (Nutzer Held 0, gewählt Held 1), danach zwei echte Zugwechsel (Gegner, dann wieder Sitz 0). Held 1 spielt in der Action Phase zwei Fireballs.
// Erwartet: beide Fireballs sind spielbar (Haupt-Aktion + zweite Aktion); der Held trägt in diesem Zug den Status `calm_ready`.
// Beobachtet: nur der erste; der Held behält den angekündigten Status `calm` (nie `calm_ready`), es gibt keine zweite Aktion.
// Ursache: `calm-diatribe.js` `hooks.onTurnStart` bricht ab, wenn `ctx.playerIdx !== ctx.cardOwner` – der Hook-Kontext von `onTurnStart` trägt aber `activePlayer`/`isMyTurn`
//   (CARD_API „Game Flow": `turn`, `activePlayer`), kein `playerIdx` (Wert `undefined`) → die Bedingung ist immer wahr, `richteZusageEin` läuft nie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Calm Diatribe', 'Fireball', 'Fireball'], []] });
  t.targetFn = (v) => { const x = v.find(z => z.type === 'hero' && z.owner === 0 && z.heroIdx === 1); return [(x || v[0]).id]; };
  await t.play(0, 'Calm Diatribe', { hero: 0 });
  await t.endTurn(); await t.endTurn();                     // Gegner-Zug, dann wieder Sitz 0 (Zug 7)
  const buffs = Object.keys(t.gs.players[0].heroes[1].buffs || {});
  R.check('im eigenen nächsten Zug trägt Held 1 „calm_ready"', buffs.includes('calm_ready'), buffs);
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const r1 = await t.play(0, 'Fireball', { hero: 1 });
  const r2 = await t.play(0, 'Fireball', { hero: 1, keepActions: true });
  R.check('Held 1 darf in der Action Phase zwei Aktionen ausführen', r1 === true && r2 === true, { r1, r2, hp: t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
