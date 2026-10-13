'use strict';
// C01-creatures-08 · Candlestick Squire: ist ein Brand auf dem Brett, gibt es KEINEN normalen Beschwörungsweg mehr (Heilung ist Pflicht)
// Kartentext: „You may choose a Burned target either player controls and heal it from its Burn to summon this Creature as an additional Action."
//   (Die Karte ist Summoning Magic Lv1 – „may" beschreibt einen ALTERNATIVEN Weg; die gewöhnliche Beschwörung für 1 Aktion bleibt sonst möglich.)
// Aufbau: Seed 1234, Held 0 mit Summoning Magic Lv1, Hand [Candlestick Squire]; Gegner-Held 0 ist verbrannt (ich will den Brand behalten).
//   Aktionsphase, Aktion unverbraucht. Hostzone wird gewählt, die Heilungs-Zielwahl wird abgebrochen (null).
// Erwartung: Squire lässt sich auch ohne Heilung für die normale Aktion beschwören (Brand bleibt, Aktion verbraucht) – oder die Frage wird dem Spieler gestellt.
// Beobachtet: `inherentAction` ist wahr, sobald irgendwo ein Brand liegt; `beforeSummon` verlangt dann die Heilung; Abbruch = die Karte bleibt auf der Hand.
//   Der gewöhnliche Weg (Aktion statt Heilung) wird nie angeboten – solange der gegnerische Brand liegt, ist Squire nur mit Heilung beschwörbar.
// Ursache: cards/effects/candlestick-squire.js `inherentAction()` Z. ~108 (wahr bei jedem Brand) + `beforeSummon` Z. ~149 (Heilung ist Pflicht auf dem inhärenten Weg).
// Stufe C (Skript-Kopf: „With no Burned targets in play, the card falls back to the standard summon path" – offenbar bewusst).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const S = 'Candlestick Squire';
  const t = await H.fresh({ hand: [[S], []] });
  const gs = t.gs, ps = gs.players[0];
  await t.engine.addHeroStatus(1, 0, 'burned', { duration: 5, appliedBy: 0 });
  t.grantFor(0, 0, S);
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { const z = d.zones[0]; return { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
  t.targetFn = () => null;                       // „ich will NICHT heilen"
  const r = await t.play(0, S);
  const onBoard = !!t.find(S, 'support');
  R.note('Ergebnis', { r, onBoard, hand: ps.hand, brandBleibt: !!gs.players[1].heroes[0].statuses.burned, aktionVerbraucht: ps.heroesActedThisTurn });
  R.check('Squire lässt sich ohne Heilung (für die normale Aktion) beschwören, der Brand bleibt', onBoard && !!gs.players[1].heroes[0].statuses.burned, { onBoard });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
