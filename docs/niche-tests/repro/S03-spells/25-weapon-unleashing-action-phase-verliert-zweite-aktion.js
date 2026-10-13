'use strict';
// S03-25 · Weapon Unleashing in der ACTION PHASE gespielt: der Spielvorgang verbraucht die erste Aktion, die „zweite Aktion" bringt netto nichts
// Kartentext: „You may perform a second Action with the user during your Action Phase this turn. This counts as an additional Action."
// Ruling CARD_API.md ~Z. 7378–7415: „inherente Zusatzaktion (`inherentAction: true`) — das Spielen kostet keine Aktion, der Grant gibt die zweite."
// Aufbau: Held 0: Fighting ×3 (Opfer) + Destruction Magic ×2; Hand [Weapon Unleashing, Fireball ×3]; Gegner 800 HP.
//   A) Weapon Unleashing in Main Phase 1, dann Action Phase betreten → 2 Fireballs (Kontrolle).
//   B) Weapon Unleashing als erste Karte der Action Phase → erwartet ebenfalls 2 Fireballs (reguläre Aktion + zweite Aktion).
// Beobachtet: B) nach dem Spielen steht `_actionsPlayedThisPhase` auf 1; der erste Fireball verbraucht den Grant, danach springt die Phase auf Main 2 ⇒ nur 1 Fireball.
// Ursache (vermutet): `weapon-unleashing.js` setzt bei `_actionsPlayedThisPhase === 1` `gs._preventPhaseAdvance = true`; dadurch läuft in `server.js` (~8918) der Zweig nicht,
//   der den Zähler der kostenlosen ersten Aktion wieder zurücknimmt.
const H = require('../../lib/h.js');
async function lauf(wuPhase) {
  const t = await H.fresh({ hand: [['Weapon Unleashing', 'Fireball', 'Fireball', 'Fireball'], []], hp: 800, deckSize: 20 });
  t.setAbilities(0, 0, [['Fighting', 'Fighting', 'Fighting'], ['Destruction Magic', 'Destruction Magic'], []]);
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'hero' && q.owner === 1 && q.heroIdx === 0); return [(v || valid[0]).id]; };   // Fireball: Gegner-Held 0; Weapon Unleashing: erster Stapel
  const r = await t.play(0, 'Weapon Unleashing', { hero: 0, noGrant: true, phase: wuPhase });
  if (wuPhase === 2) await t.run(() => t.engine.advanceToPhase(0, 3, { manual: true }));
  let gespielt = 0;
  for (let i = 0; i < 3; i++) {
    const ok = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true, phase: t.gs.currentPhase });
    if (ok === true) gespielt++; else break;
  }
  return { t, r, gespielt };
}
(async () => {
  const R = H.runner();
  const a = await lauf(2);
  R.check('A) Weapon Unleashing in Main 1: 2 Fireballs möglich', a.gespielt === 2, a.gespielt);
  const b = await lauf(3);
  R.check('B) Weapon Unleashing in der Action Phase: 2 Fireballs möglich', b.gespielt === 2, { gespielt: b.gespielt, oppHP: b.t.hp(1, 0) });
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [a.t.errors, b.t.errors]);
  R.finish();
})();
