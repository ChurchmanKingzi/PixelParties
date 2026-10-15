'use strict';
// W13 / Q122 (H03-heroes-05) · Omikron, the Faceless Illusionist: seine Illusion löst fremde „Creature placed"-Trigger aus (Nero Zira, Maya, …)
// Al: „Ja, sollen sie!" (wie Create Illusion / Staff of Illusions). Negiert sind nur die EIGENEN Effekte der Illusion (HP 1, negiert). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Nero Zira, the Mastermind', 'Omikron, the Faceless Illusionist', 'Maya, the Nature Fairy'], null], hp: 400 });
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Skeleton Healer' }) });
  t.targetFn = (valid) => [valid[0].id];
  const atk0 = t.hero(0, 0).atk;
  const r = await t.activateHero(0, 1, { effect: 'Omikron, the Faceless Illusionist' });
  const ill = t.inst(x => x.zone === 'support' && x.owner === 0 && x.name === 'Skeleton Healer')[0];
  R.check('Illusion liegt auf dem Brett, HP 1, negiert', r && t.zone(0, 1, 0) === 'Skeleton Healer' && ill && ill.counters.maxHp === 1, { r, zone: t.zone(0, 1, 0), c: ill && ill.counters });
  R.check('Nero Zira: +30 ATK für das platzierte Creature', t.hero(0, 0).atk === atk0 + 30, [atk0, t.hero(0, 0).atk]);
  R.check('Maya: Zielwahl „+50 HP" wird angeboten', t.targets.length > 0, t.targets.length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
