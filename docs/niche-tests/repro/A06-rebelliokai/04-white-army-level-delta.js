'use strict';
// A06-rebelliokai-04 · The White Army zählt „level 0 Creatures" nur nach gedrucktem Level, nicht mit Level-Delta
// Kartentext (The White Army): „… If you control at least 2 level 0 Creatures, this counts as an additional Action."
// Kartentext (Calamitusk): „…summon a "Chaorc" Creature … If you do, that Creature has its level reduced by 1."
// Aufbau: eine echte Level-0-Kreatur (ZZ Dummy) + Chaorc Cannon Fodder (gedruckt Lv1), dessen Level durch Calamitusks
//   Effekt über `counters.level = -1` (engine.actionChangeLevel) auf 0 steht (engine.kreaturLevelJetzt = 0).
// Erwartung: Fodder ist ein Level-0-Creature → The White Army zählt 2 → Zusatzaktion (Phase bleibt Aktion, 3).
// Beobachtung: `countOwnLv0Creatures` (_mischief-militia-shared.js) liest nur `cd.level` → 1 Kreatur → normale Aktion
//   (Phase → 4). Board of Kings (_of-kings-shared.js `boardLevel`) rechnet das Delta dagegen mit.
// Gegenprobe: zwei echte Lv0-Kreaturen → Zusatzaktion (✓).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const lauf = async (zweite, delta) => {
    const t = await H.fresh({ hand: [['The White Army'], []] });
    t.put(0, 0, 0, D);
    const s = t.put(0, 0, 1, zweite);
    if (delta) s.counters.level = delta;
    t.put(1, 0, 0, D);
    t.targetFn = (valid) => [valid.find(v => v.owner === 1 && v.type === 'equip').id];
    await t.play(0, 'The White Army', { hero: 0 });
    return { phase: t.gs.currentPhase, lvl: t.engine.kreaturLevelJetzt ? t.engine.kreaturLevelJetzt(s) : null, errs: t.errors.length + t.audit().length };
  };
  const a = await lauf(D, 0);
  R.check('Gegenprobe: zwei echte Lv0-Kreaturen → Zusatzaktion', a.phase === 3 && a.errs === 0, a);
  const b = await lauf('Chaorc Cannon Fodder', -1);
  R.check('Cannon Fodder (Lv1, Delta -1 = effektiv Lv0) zählt als Level-0-Kreatur → Zusatzaktion', b.phase === 3 && b.lvl === 0, b);
  R.finish();
})();
