// H02-heroes-35 · Lethe-Sperre: wer Lethes Effekt erst nach dem Tod gewinnt (Shapeshifter), ist nicht gesperrt
//
// Kartentext Lethe: „This Hero cannot perform Actions if a target you control was defeated since the end of your last turn."
// Kartentext Shapeshifter: gewinnt für den Zug die Effekte des angelegten Helden (Held heißt dann „Lethe, the Forgetful Fixer").
// Skript (`lethe-the-forgetful-fixer.js` `lockLethe`): stempelt `_actionLockedTurn` im MOMENT des Todes bei jedem Helden namens Lethe – ein Held, der erst danach zu Lethe wird, trägt keinen Stempel.
// Aufbau: (a) echte Lethe als Held 0; (b) Shapeshifter als Held 0. Eigene Kreatur stirbt im Gegnerzug; im eigenen Zug wird (b) per Heldeneffekt zu Lethe; danach Fireball.
// Erwartung (Lesart A, Text als Zustand „seit dem Ende deines letzten Zuges"): beide Lethe-Helden sind gesperrt. Beobachtung: (a) gesperrt ✓, (b) Fireball läuft durch.
// Aufruf: node docs/niche-tests/repro/H02-heroes/35-lethe-spaet-gewonnen-ohne-sperre.js   (✗ = Lesart A wird nicht erfüllt)
const H = require('../../lib/h.js');
const SHAPE = '???, the Shapeshifter', LE = 'Lethe, the Forgetful Fixer';
(async () => {
  const R = H.runner();
  for (const echt of [true, false]) {
    const t = await H.fresh({ heroes: [[echt ? LE : SHAPE, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Fireball'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const c = t.put(0, 1, 0, H.INERT.frail);
    await t.endTurn();
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 999, 'spell'));
    await t.endTurn();
    if (!echt) {
      t.addHand(0, LE);
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === SHAPE, answer: () => ({ cardName: LE, source: 'hand' }), once: true });
      await t.activateHero(0, 0, { phase: 2 });
    }
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1).id];
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check(`${echt ? 'echte Lethe' : 'Shapeshifter erst jetzt als Lethe'} (Held heißt ${t.hero(0, 0).name}): Fireball nach Kreaturentod im Gegnerzug gesperrt`, r === false, { r });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
