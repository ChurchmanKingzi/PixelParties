// H02-heroes-34 · Layn, Defender of Deri: eine per Capture übernommene Gegnerkreatur bekommt +100 HP, obwohl sie nicht „beschworen" wird
//
// Kartentext Layn: „Increase the current and max HP of any Creature you **summon** by 100."  Capture: „… take permanent control of it. Place it in one of the user's free Support Zones."
// Das Skript hängt am Hook `onCardEnterZone` (layn-defender-of-deri.js `onCardEnterZone`): jede Kreatur, die in eine Zone des Kontrolleurs „eintritt", bekommt den Bonus – auch Übernahmen (`actionTransferCreature`: Capture, Diplomacy, Dark Gear, Liberation …) und Umsetzungen zwischen eigenen Zonen (der Zähler `_laynBonus` fängt nur Doppelvergabe ab).
// Aufbau: Layn Defender als Held 0 (Sitz 0), gegnerische ZZ-Dummy-Kreatur (200 HP) auf Sitz 1; Sitz 0 spielt Capture (echter Spielweg), Zielwahl = der Dummy, Zone = erste freie bei Layn.
// Erwartung: die übernommene Kreatur behält 200/200 (nicht beschworen). Kontrolle: eine beschworene Kreatur hat 300/300 ✓.
// Beobachtung: die übernommene Kreatur hat 300/300 (`counters._laynBonus = 100`).
// Aufruf: node docs/niche-tests/repro/H02-heroes/34-layn-defender-uebernommene-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const LD = 'Layn, Defender of Deri';
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ heroes: [[LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[H.INERT.creature], []] });
    await t.play(0, H.INERT.creature, { hero: 0 });
    const c = t.inst(x => x.zone === 'support' && x.owner === 0)[0];
    R.check('Kontrolle: beschworene Kreatur 300/300', c && c.counters.maxHp === 300, c && c.counters); }
  { const t = await H.fresh({ heroes: [[LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Capture'], []] });
    const opp = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = (v) => { const z = v.find(x => x.type === 'equip' && x.owner === 1); return z ? [z.id] : null; };
    t.script.push({ match: d => /zone/i.test(d.type || ''), answer: (d) => { const z = (d.zones || d.options || [])[0]; return z ? { heroIdx: z.heroIdx, slotIdx: z.slotIdx } : {}; } });
    const r = await t.play(0, 'Capture', { hero: 0 });
    R.check('Capture hat die Kreatur übernommen', r === true && (opp.controller ?? opp.owner) === 0, { r, owner: opp.owner, controller: opp.controller, heroIdx: opp.heroIdx });
    R.check('übernommene Kreatur bekommt keinen Layn-Bonus (nicht beschworen)', !(opp.counters._laynBonus), { counters: opp.counters });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
