'use strict';
// W13 / Q119 (H02-heroes-34) · Layn, Defender of Deri: „Increase the current and max HP of any Creature you summon by 100."
// Al: „Nein, nur solche, die neu aufs Board kommen." → Bonus für beschworene UND platzierte Kreaturen; NICHT für per Capture/Diplomacy/Dark Gear
// übernommene oder zwischen Zonen verschobene. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const LD = 'Layn, Defender of Deri';
const D = H.INERT.creature;
(async () => {
  const R = H.runner();
  const heroes = [[LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null];
  { const t = await H.fresh({ heroes, hand: [[D], []] });
    await t.play(0, D, { hero: 0 });
    const c = t.inst(x => x.zone === 'support' && x.owner === 0)[0];
    R.check('beschworen: 300/300', c && c.counters.maxHp === 300, c && c.counters); }
  { const t = await H.fresh({ heroes });
    await t.run(() => t.engine.actionPlaceCreature(D, 0, 0, 1, { source: 'external', sourceName: 'Test' }));
    const c = t.inst(x => x.zone === 'support' && x.owner === 0)[0];
    R.check('platziert (Effekt-Beschwörung): 300/300', c && c.counters.maxHp === 300, c && c.counters); }
  { const t = await H.fresh({ heroes });   // Umsetzen zwischen eigenen Zonen
    const c = t.put(0, 1, 0, D);
    await t.run(() => t.engine.actionTransferCreature(c, 0, 2, 0));
    R.check('zwischen eigenen Zonen verschoben: kein Bonus (200/200)', !c.counters._laynBonus && (c.counters.maxHp ?? 200) === 200, c.counters); }
  { const t = await H.fresh({ heroes });   // Übernahme einer Gegnerkreatur
    const c = t.put(1, 0, 0, D);
    await t.run(() => t.engine.actionTransferCreature(c, 0, 1, 0));
    R.check('übernommen (Gegnerkreatur): kein Bonus (200/200)', (c.controller ?? c.owner) === 0 && !c.counters._laynBonus && (c.counters.maxHp ?? 200) === 200, c.counters); }
  { const t = await H.fresh({ heroes: [[LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Capture'], []] });   // echter Spielweg
    const opp = t.put(1, 0, 0, D);
    t.targetFn = (v) => { const z = v.find(x => x.type === 'equip' && x.owner === 1); return z ? [z.id] : null; };
    t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const z = (d.zones || d.options || [])[0]; return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : {}; } });
    const r = await t.play(0, 'Capture', { hero: 0 });
    R.check('Capture: übernommen, ohne Layn-Bonus', r === true && (opp.controller ?? opp.owner) === 0 && !opp.counters._laynBonus, { r, c: opp.counters });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
