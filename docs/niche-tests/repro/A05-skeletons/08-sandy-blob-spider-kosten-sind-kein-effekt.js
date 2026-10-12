'use strict';
// A05-skeletons-08 · Sandy Blob löst auf Spinnen ohne On-Summon-Effekt aus (beforeSummon = Kosten, kein Effekt)
// Kartentext (Sandy Blob): „Up to 3 times per turn, when the on-summon effect of a Creature you control activates, you may choose a target your
//   opponent controls and deal 50 damage to it."
// Brain/Box/Diamond/Crimson Skull/Baby Spider haben KEINEN On-Summon-Effekt; ihr `beforeSummon` bezahlt nur Kosten bzw. markiert die Zusatzaktion.
// Erwartung: kein Blob-Fenster (und keine der 3 Ladungen verbraucht), wenn so eine Spinne beschworen wird.
// Beobachtet: Blob öffnet für jede der fünf Spinnen sein Ziel-Fenster.
// Ursache: sandy-blob.js `hasOnSummon` zählt jedes `typeof script.beforeSummon === 'function'` als On-Summon-Effekt (gedacht für Dark Deepsea God).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const name of ['Brain Spider', 'Baby Spider', 'Diamond Spider', 'Box Spider', 'Crimson Skull Spider']) {
    const t = await H.fresh({ hand: [[name], []] });
    t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
    const blob = t.put(0, 0, 2, 'Sandy Blob'); blob.turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid[0].id];
    await t.play(0, name, { hero: 0, slot: 0 });
    const n = t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
    R.check(name + ': kein Sandy-Blob-Fenster (Karte hat keinen On-Summon-Effekt)', n === 0, n);
  }
  R.finish();
})();
