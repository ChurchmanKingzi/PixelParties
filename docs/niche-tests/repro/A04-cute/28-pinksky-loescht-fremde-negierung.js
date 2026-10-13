'use strict';
// A04-cute-28 (B) · Pink Sky: beim Ablauf wird der `negated`-Zähler gelöscht, obwohl eine andere, längere Negierung noch läuft
//
// Kartentext (Pink Sky): "Negate the effects of all Creatures both players currently control until the end of your opponent's next turn, except "Cute" Creatures. This counts as a negative status effect."
// Erwartung: nach Ablauf von Pink Sky bleibt eine Kreatur negiert, solange eine zweite Negierung (hier: eine, die bis Zug 8 läuft, wie Lockes
//   „negate … until your next turn" oder Necromancy/Omikron: `expiresAtTurn = gs.turn + 2`) noch aktiv ist.
// Beobachtet: Zu Beginn von Zug 7 räumt Pink Skys Buff `clearCountersOnExpire: ['negated']` den gemeinsamen Zähler ab; der Buff der anderen Negierung bleibt
//   liegen, aber `counters.negated` ist weg → die Kreatur ist wieder aktiv (isCreatureEffectSuppressed = false), ein Zug zu früh.
// Ursache: `_engine.js:17938` (`actionRemoveCreatureBuff`) löscht die Zähler ohne zu prüfen, ob ein anderer Negations-Buff noch läuft; es gibt nur EIN Zählerfeld `negated`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pink Sky'], []], deck: [Array(10).fill(H.INERT.creature), Array(10).fill(H.INERT.creature)] });
  const d = t.put(1, 0, 0, H.INERT.big);                     // Kreatur des Gegners
  R.check('Pink Sky gespielt (Zug 5, Sitz 0)', (await t.play(0, 'Pink Sky', { hero: 0 })) === true);
  R.check('Kreatur ist negiert', !!d.counters.negated);
  await t.endTurn();                                        // Zug 6 (Sitz 1)
  await t.run(() => t.engine.actionNegateCreature(d, 'Locke-Muster', { expiresAtTurn: t.gs.turn + 2, expiresForPlayer: 1 }));   // läuft bis Zug 8
  const bis = t.gs.turn + 2;
  await t.endTurn();                                        // Zug 7 (Sitz 0): Pink Sky läuft zu Beginn ab
  R.note('Zug / Zähler negated / Buffs', [t.gs.turn, d.counters.negated, Object.keys(d.counters.buffs || {})]);
  R.check('Zug 7: die zweite Negierung (bis Zug ' + bis + ') hält die Kreatur noch stumm', !!t.engine.isCreatureEffectSuppressed(d), { negated: d.counters.negated, buffs: Object.keys(d.counters.buffs || {}) });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
