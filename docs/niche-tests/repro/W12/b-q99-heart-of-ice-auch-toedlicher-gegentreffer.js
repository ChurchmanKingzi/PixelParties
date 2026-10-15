// W12b · Q99 (F02-19) · Heart of Ice: auch tödliche Gegentreffer frieren den Angreifer ein
// Al: „Auch tödliche Gegentreffer sollten einfrieren."
// Erwartung: (a) Träger überlebt den Attack-Treffer → Angreifer-Held eingefroren (genau einmal); (b) Träger stirbt am Attack-Treffer → Angreifer-Held trotzdem eingefroren (genau einmal);
//   (c) Kreatur trifft den Träger mit ihrem Effekt tödlich → die Kreatur friert ein; (d) Gegenprobe: Treffer auf einen Helden OHNE Heart of Ice friert nichts ein.
//   Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [fall, hp] of [['a) Träger überlebt', 800], ['b) Träger stirbt am Treffer', 30]]) {
    const t = await H.fresh({ hand: [['Attack'], ['Heart of Ice']], gold: [100, 100] });
    await t.play(1, 'Heart of Ice', { hero: 0 });
    t.gs.activePlayer = 0; t.reset();
    t.hero(1, 0).hp = hp;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, 'Attack', { hero: 0 });
    R.check(`${fall}: Angriff ausgeführt`, r === true, r);
    R.check(`${fall}: Angreifer eingefroren`, !!t.hero(0, 0).statuses.frozen, { hpTraeger: t.hp(1, 0), ablage1: t.pile(1, 'discardPile') });
    R.check(`${fall}: genau einmal vergolten (Log heart_of_ice)`, t.logs.filter(l => l.type === 'heart_of_ice').length === 1, t.logs.map(l => l.type).filter(x => /ice/.test(x)));
    R.check(`${fall}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (c) Kreatur tötet den Träger
    const t = await H.fresh({ hand: [[], ['Heart of Ice']], gold: [100, 100] });
    await t.play(1, 'Heart of Ice', { hero: 0 });
    const kr = t.put(0, 1, 0, H.INERT.creature);
    t.reset();
    t.hero(1, 0).hp = 30;
    await t.run(() => t.engine.actionDealDamage({ name: H.INERT.creature, id: kr.id, owner: 0, controller: 0, heroIdx: 1, zoneSlot: 0 }, t.gs.players[1].heroes[0], 100, 'creature'));
    R.check('c) Träger gefallen', t.hp(1, 0) === 0, t.hp(1, 0));
    R.check('c) tödlich treffende Kreatur eingefroren', !!(kr.counters && kr.counters.frozen) || !!(kr.statuses && kr.statuses.frozen), { counters: kr.counters, statuses: kr.statuses });
    R.check('c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // (d) Gegenprobe ohne Heart
    const t = await H.fresh({ hand: [['Attack'], []], gold: [100, 100] });
    t.hero(1, 0).hp = 30;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    await t.play(0, 'Attack', { hero: 0 });
    R.check('d) ohne Heart of Ice friert der Angreifer nicht', !t.hero(0, 0).statuses.frozen, t.hero(0, 0).statuses);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
