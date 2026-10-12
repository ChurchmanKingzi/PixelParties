'use strict';
// A06-rebelliokai-05 · „Can't be chosen"-Schutz (Censpartan-Schirm, Board of Kings) greift nicht bei Karten mit
//   eigener Zielliste über `engine.promptEffectTarget`
// Kartentexte: Censpartan War Counselor: „Other "War Counselor" Creatures you control cannot be chosen by your opponent's
//   cards and effects." · Board of Kings: „Creatures you control can't be chosen and are unaffected by your opponent's
//   cards and effects while there is at least 1 Creature with a lower level in an adjacent Support Zone …"
// Beobachtung: Der Schutz (`counters.untargetable_by_opponent`, Board-Vertrag `guardsCreatureChoice`) wird NUR in den
//   beiden Zielsammlern `promptDamageTarget`/`promptMultiTarget` ausgewertet (_engine.js:5063-5089, 5646-5664).
//   `promptEffectTarget` (der Flaschenhals für selbstgebaute Listen, _engine.js:27934ff.) kennt Thicket,
//   `blocksTargeting` und den Great-Wall-Schutz, aber weder diesen Zähler noch den Board-Vertrag.
//   Betroffene Karten dieser Gruppe: Thaw Blader, Bear Rider (Frozen-Ziele), Mischief Militia - Heli Troopers,
//   The White Army / Mischief Invasion (Freeze-Ziele), Tengu Windstorm, Kappa Sword Slash (Area-Wahl).
// Erwartung: der geschützte Gorinthian bzw. die gedeckte Kreatur ist für den Gegner nicht wählbar.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TB = 'Mischief Militia - Thaw Blader';

  // ── Teil 1: Censpartan-Schirm ──
  let t = await H.fresh({ hand: [[], []] });
  t.setHand(1, ['Censpartan War Counselor', 'Gorinthian War Counselor']);
  await t.play(1, 'Censpartan War Counselor', { hero: 0, slot: 0 });
  await t.play(1, 'Gorinthian War Counselor', { hero: 0, slot: 1 });
  const gor = t.find('Gorinthian War Counselor', 'support');
  R.check('Aufbau: Gorinthian trägt den Censpartan-Schirm', !!gor && !!gor.counters.untargetable_by_opponent, gor && gor.counters);
  await t.run(() => t.engine.applyCreatureStatus(gor, 'frozen', { duration: 2, sourceOwner: 1, source: 'repro' }));
  t.gs.activePlayer = 0; t.gs.currentPhase = 2; t.resetActions(0);
  const blader = t.put(0, 0, 0, TB); blader.turnPlayed = t.gs.turn - 1;
  t.reset();
  const hp0 = gor.counters.currentHp ?? null;
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Gorinthian War Counselor') ? valid.find(v => v.cardName === 'Gorinthian War Counselor').id : valid[0].id];
  await t.activateCreature(0, 0, 0);
  const angeboten = t.targets.some(x => x.valid.some(v => v.cardName === 'Gorinthian War Counselor'));
  R.check('Thaw Blader: der durch Censpartan geschützte Gorinthian ist NICHT wählbar', !angeboten, t.targets.map(x => x.valid.map(v => v.cardName)));
  const live = t.find('Gorinthian War Counselor', 'support');
  R.note('Gorinthian nach Thaw Blader', { lebt: !!live, hp: live && live.counters.currentHp, vorher: hp0, discard1: t.pile(1, 'discardPile') });

  // ── Teil 2: Board of Kings ──
  t = await H.fresh({ hand: [[], []] });
  t.putArea(0, 'Board of Kings');
  const rook = t.put(1, 0, 0, 'Rook of Kings [W]');          // Lv3
  t.put(1, 0, 1, 'Pawn of Kings [W]');                       // Lv0 daneben → deckt den Rook
  await t.run(() => t.engine.applyCreatureStatus(rook, 'frozen', { duration: 2, sourceOwner: 1, source: 'repro' }));
  t.gs.activePlayer = 0; t.gs.currentPhase = 2; t.resetActions(0);
  const b2 = t.put(0, 0, 0, TB); b2.turnPlayed = t.gs.turn - 1;
  t.reset();
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Rook of Kings [W]') ? valid.find(v => v.cardName === 'Rook of Kings [W]').id : valid[0].id];
  await t.activateCreature(0, 0, 0);
  const rookAngeboten = t.targets.some(x => x.valid.some(v => v.cardName === 'Rook of Kings [W]'));
  R.check('Thaw Blader: der durch Board of Kings gedeckte Rook ist NICHT wählbar', !rookAngeboten, t.targets.map(x => x.valid.map(v => v.cardName)));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
