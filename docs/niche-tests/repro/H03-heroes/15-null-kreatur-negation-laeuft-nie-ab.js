'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-15 · Null, the Mage Slayer: eine von Null getroffene KREATUR bleibt für immer negiert („for 2 turns" läuft nie ab)
//
//  Karte: Null, the Mage Slayer (`cards/effects/null-the-mage-slayer.js`, `afterCreatureDamageBatch` → `engine.applyCreatureStatus(inst, 'negated', { duration: 2 })`)
//  Kartentext: „Negate the effects of any targets hit by this Hero's Attacks **for 2 turns**. This counts as a status effect."
//  Skriptkopf: „… `applyCreatureStatus` mit `duration` ist der Weg, den Iceage für seinen Zwei-Runden-Frost geht – die Dauer landet in `counters.negatedDuration`
//  und wird angezeigt UND heruntergezählt."
//  Erwartung: Die Negation endet nach 2 Zügen (wie der Held in der Kontrolle a und wie ein Zwei-Runden-Frost auf einer Kreatur in Kontrolle c).
//  Beobachtung (✗): `counters.negated = 1` und `negatedDuration = 2` bleiben unverändert über beliebig viele Zugwechsel; `isCreatureEffectSuppressed` bleibt true.
//  Der Zugende-Abbau in `_engine.js` (~Z. 45158–45210) zählt nur `frozenDuration` und `stunnedDuration` herunter, `negatedDuration` hat keinen Leser.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/15-null-kreatur-negation-laeuft-nie-ab.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const NULL = 'Null, the Mage Slayer';
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  const mk = async () => { const t = await H.fresh({ heroes: [[NULL, ...fill], null], hp: 600, hand: [['Attack'], []] }); await t.run(() => t.engine.runHooks('onGameStart', {})); return t; };

  R.section('a) Kontrolle: Held wird getroffen -> 2 Züge negiert');
  let t = await mk();
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Held ist negiert', !!t.hero(1, 0).statuses.negated);
  for (let i = 0; i < 4; i++) await t.endTurn();
  R.check('Held nach 4 Zugwechseln nicht mehr negiert', !t.hero(1, 0).statuses.negated, t.hero(1, 0).statuses);

  R.section('b) Befund: Kreatur wird getroffen');
  t = await mk();
  const c = t.put(1, 0, 0, H.INERT.big); c.turnPlayed = 0;
  t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 1).id];
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Kreatur ist negiert (Aufbau)', !!c.counters.negated, c.counters);
  for (let i = 0; i < 8; i++) await t.endTurn();
  R.note('nach 8 Zugwechseln', { negated: c.counters.negated, negatedDuration: c.counters.negatedDuration, unterdrueckt: t.engine.isCreatureEffectSuppressed(c) });
  R.check('Kreatur nach 8 Zugwechseln nicht mehr negiert (Text: „for 2 turns")', !c.counters.negated, c.counters);

  R.section('c) Kontrolle: Zwei-Runden-Frost auf Kreatur läuft ab');
  const c2 = t.put(1, 0, 1, H.INERT.big); c2.turnPlayed = 0;
  await t.run(() => t.engine.applyCreatureStatus(c2, 'frozen', { duration: 2, sourceOwner: 0 }));
  for (let i = 0; i < 6; i++) await t.endTurn();
  R.check('Frost (duration 2) ist abgelaufen', !c2.counters.frozen, c2.counters);

  R.section('d) Verwandter Befund (anderer Besitzer: Sparky Slime): „negate its effects … until your next turn" über denselben Weg ohne Buff');
  const t2 = await H.fresh({ hp: 600, hand: [['Sparky Slime'], []] });
  const c3 = t2.put(1, 0, 0, H.INERT.big); c3.turnPlayed = 0;
  t2.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 1).id];
  await t2.play(0, 'Sparky Slime', { hero: 0 });
  R.check('Sparky Slime: Kreatur ist negiert (Aufbau)', !!c3.counters.negated, c3.counters);
  for (let i = 0; i < 4; i++) await t2.endTurn();
  R.check('Sparky Slime: Negation endet bis zum nächsten eigenen Zug', !c3.counters.negated, { negated: c3.counters.negated });
  R.check('keine Engine-Fehler', t.errors.length === 0 && t2.errors.length === 0, [t.errors, t2.errors]);
  R.finish();
})();
