'use strict';
// N4-archetypen-16 · Slime Rancher verdoppelt die Einsatz-Effekte ALLER Slimes, auch der vom Gegner beschworenen (Al, Welle 24: Lesart A)
// Kartentext (Slime Rancher): „While you control this Creature, the effects of "Slime" Creatures that activate when they are summoned are activated an additional time."
//   (Vergleich Sandy Blob: „… of a Creature **you control** …" – der Rancher-Text schränkt NICHT auf eigene Slimes ein.)
// Al: „Sagt der Kartentext 'you control' oder nicht? Strikt an diesen angleichen" → der Text sagt es bei den Slimes nicht: Lesart A. Sandy Blob bleibt unverändert („a Creature you control").
// Aufbau: Sitz 0 hat einen Slime Rancher. Sitz 1 beschwört einen Icy Slime (Einsatz-Effekt: Ziel einfrieren).
// Erwartung (Exit 0): 2 Zielwahlen des Icy Slime (Sitz 1) – gegnerischer Rancher verdoppelt. Gegenproben: ohne Rancher 1 Zielwahl; eigener Slime bei eigenem Rancher 2 Zielwahlen;
//   Sandy Blob (Sitz 0) bleibt bei einem gegnerischen Slime stumm (nur „a Creature you control").
const H = require('../../lib/h.js');
async function lauf(s) {
  const t = await H.fresh({ hand: [['ZZ Filler'], ['Icy Slime']], deckSize: 30, active: 1 });
  t.setAbilities(1, 0, [['Summoning Magic'], [], []]);
  if (s.rancher) { const r = t.put(0, 0, 0, 'Slime Rancher'); r.turnPlayed = 1; }
  if (s.blob) { const b = t.put(0, 2, 0, 'Sandy Blob'); b.turnPlayed = 1; }
  t.put(0, 1, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(1, 'Icy Slime', { hero: 0, slot: 0 });
  const n = t.targets.filter(x => x.config && x.config.title === 'Icy Slime').length;
  const blob = t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  return { t, n, blob };
}
(async () => {
  const R = H.runner();
  const g = await lauf({ rancher: true });
  R.check('Rancher (Sitz 0) doppelt den Einsatz-Effekt eines gegnerischen Slimes: 2 Zielwahlen', g.n === 2, g.n);
  R.check('keine Engine-Fehler / Zustand sauber', g.t.errors.length === 0 && g.t.audit().length === 0, { e: g.t.errors, a: g.t.audit() });
  const k = await lauf({ rancher: false });
  R.check('Gegenprobe: ohne Rancher genau 1 Zielwahl', k.n === 1, k.n);
  // eigener Slime, eigener Rancher: Sitz 1 hat den Rancher und beschwört selbst
  const t = await H.fresh({ hand: [['ZZ Filler'], ['Icy Slime']], deckSize: 30, active: 1 });
  t.setAbilities(1, 0, [['Summoning Magic'], [], []]);
  const r1 = t.put(1, 1, 0, 'Slime Rancher'); r1.turnPlayed = 1;
  t.put(0, 1, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(1, 'Icy Slime', { hero: 0, slot: 0 });
  const n2 = t.targets.filter(x => x.config && x.config.title === 'Icy Slime').length;
  R.check('Gegenprobe: eigener Rancher + eigener Slime: 2 Zielwahlen', n2 === 2, n2);
  const b = await lauf({ rancher: false, blob: true });
  R.check('Gegenprobe: Sandy Blob (Sitz 0) bietet für den gegnerischen Slime nichts an („a Creature you control")', b.blob === 0, b.blob);
  R.finish();
})();
