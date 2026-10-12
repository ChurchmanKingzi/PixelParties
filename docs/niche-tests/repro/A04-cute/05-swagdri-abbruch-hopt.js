'use strict';
// A04-cute-05 · Abbruch der Zielwahl verbraucht Swagdris Einmal-pro-Zug-Nutzung
//
// Kartentext: "Once per turn, if the top card of your Coolness Stack is an Artifact, you may immediately play it …"
// Konvention (CARD_API: "Zielende Karten sind immer abbrechbar (Abbruch = nichts ist passiert)"): wer abbricht, hat nichts
//   ausgegeben und seinen Einsatz noch.
// Erwartung: nach Abbruch (Mensch: Zielwahl → null) kann Swagdri im selben Zug erneut aktiviert werden.
// Beobachtet: Karte bleibt auf dem Stack (richtig), aber die Aktivierung ist für den Zug gesperrt (zweiter Versuch → false).
// Ursache: cards/effects/swagdri-forger-of-coolness.js onCreatureEffect stempelt `counters.swagdriPlayedArtifactThisTurn`
//   (Z. ~106) VOR den Abbruchstellen (promptEffectTarget → `return;`), und die Engine stempelt den HOPT bei einer
//   Rückgabe ≠ false (hier `undefined`) ebenfalls.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [['Fireball', H.INERT.creature, H.INERT.creature], []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const sw = t.put(0, 0, 0, 'Swagdri, Forger of Coolness'); sw.turnPlayed = 0;
  const ps = t.gs.players[0];
  for (const n of ['Cute Bunny', 'Angry Cheese']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  t.gs.activePlayer = 0; t.phase(2);
  t.targetFn = () => null;                       // Abbruch wie vom Abbruch-Knopf eines Menschen
  await t.activateCreature(0, 0, 0);
  R.check('Abbruch: Angry Cheese liegt noch oben auf dem Stack', ps.coolnessStack[ps.coolnessStack.length - 1] === 'Angry Cheese', ps.coolnessStack.slice());
  t.reset();
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero').id];
  await t.activateCreature(0, 0, 0);
  R.check('zweiter Versuch im selben Zug klappt (Cheese gespielt: Held −100 HP)', t.hp(0, 0) === 700, { hp: t.hp(0, 0), stack: ps.coolnessStack.slice() });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
