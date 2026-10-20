'use strict';
// W25b · N2-04 · Forbidden Curse of Aging sperrt nur das ENTFERNEN von Status DURCH EFFEKTE (Heilen/Cleanse); befristete Status laufen normal aus (Al, Welle 25: „ja, die sollen normal auslaufen").
// (a) Betäubung (stunned, Dauer 1) läuft am Ende des Trägerzuges normal ab und der Held bekommt `immune`, das zu Beginn seines nächsten Zuges ebenfalls normal endet.
// (b) Ein Cleanse-Effekt (`cleanseHeroStatuses`) entfernt Frost/Betäubung am gealterten Helden weiterhin NICHT.
// (c) Mehrrunden-Frost (Dauer 2) zählt am gealterten Helden herunter und endet nach zwei Trägerzügen.
const H = require('../../lib/h.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} verflucht Sitz ${op}`);
    const t = await H.fresh({ hand: me === 0 ? [['Forbidden Curse of Aging'], []] : [[], ['Forbidden Curse of Aging']], deckSize: 30 });
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0).id];
    await t.play(me, 'Forbidden Curse of Aging', { hero: 0 });
    R.check('Aufbau: Held ist aged', !!t.hero(op, 0).statuses.aged, Object.keys(t.hero(op, 0).statuses));
    // (b) Cleanse bleibt gesperrt
    await t.engine.addHeroStatus(op, 0, 'frozen', { duration: 3, appliedBy: me }); await sleep(50);
    await t.run(() => t.engine.cleanseHeroStatuses({ name: 'Heiler', owner: op }, op, 0, ['frozen'], 'Test'));
    R.check('(b) Cleanse-Effekt entfernt den Frost am gealterten Helden NICHT', !!t.hero(op, 0).statuses.frozen, Object.keys(t.hero(op, 0).statuses));
    delete t.hero(op, 0).statuses.frozen;
    // (a) Betäubung, Dauer 1, über echte Zugwechsel
    await t.engine.addHeroStatus(op, 0, 'stunned', { duration: 1, appliedBy: me }); await sleep(50);
    for (let i = 0; i < 4; i++) await t.endTurn();
    const st = Object.keys(t.hero(op, 0).statuses);
    R.check('(a) Betäubung ist nach zwei vollen Runden abgelaufen', !st.includes('stunned'), st);
    R.check('(a) Schutzstatus `immune` ist nach dem eigenen Zugbeginn ebenfalls weg, Aging bleibt', !st.includes('immune') && st.includes('aged'), st);
    // (c) Frost Dauer 2
    await t.engine.addHeroStatus(op, 0, 'frozen', { duration: 2, appliedBy: me }); await sleep(50);
    for (let i = 0; i < 2; i++) await t.endTurn();
    R.check('(c) Frost Dauer 2 hält nach einer Runde noch', !!t.hero(op, 0).statuses.frozen, Object.keys(t.hero(op, 0).statuses));
    for (let i = 0; i < 2; i++) await t.endTurn();
    R.check('(c) Frost Dauer 2 ist nach zwei Runden abgelaufen', !t.hero(op, 0).statuses.frozen, Object.keys(t.hero(op, 0).statuses));
    R.check('keine Engine-Fehler / sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
