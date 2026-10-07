'use strict';
// Skeleton Reaper im erzwungenen Modus (Spirit of the Forbidden Grimoire): ein stornierter Schlag (Dark Ocean) darf die „erneut"-Kette nicht endlos weiterlaufen lassen.
//   node scripts/skilltest-e2e/reaper.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const origErr = console.error; const errs = [];
  console.error = (...a) => { errs.push(a.join(' ')); };
  const hits = { n: 0, cancelled: 0 };
  async function chain(darkOceanSeat) {
    const out = await runGame({ seats: 5, setupOnly: true, noProfileSeats: [0, 1, 2, 3, 4], seed: 7 });
    const { room, host, gs, engine } = out;
    const seat = gs.activePlayer;
    gs.players[seat].supportZones[0][0] = ['Skeleton Reaper'];
    const inst = engine._trackCard('Skeleton Reaper', seat, 'support', 0, 0);
    // Gegner-Kreaturen frisch (ohne currentHp), wie nach dem Prep
    for (const c of engine.cardInstances) if (c.zone === 'support' && c.owner !== seat && c.counters) delete c.counters.currentHp;
    if (darkOceanSeat != null) { gs.areaZones[darkOceanSeat] = ['Dark Ocean']; }
    let delays = 0;
    const od = engine._delay; engine._delay = (ms) => { delays++; return od(ms); };
    const oa = engine.actionDealCreatureDamage.bind(engine);
    engine.actionDealCreatureDamage = async (...args) => { const r = await oa(...args); hits.n++; if (r && r.cancelled) hits.cancelled++; return r; };
    let res;
    try {
      res = await rounds.act(room, seat, 'activate_creature_effect', { heroIdx: 0, zoneSlot: 0, instId: inst.id },
        async () => { await engine.reactivateCreatureEffect(inst, seat, { ignoreEffectLock: true }); return true; }, host);
    } catch (e) { res = 'ERR ' + e.message.slice(0, 60); }
    return { res, delays };
  }

  console.log('Reaper-Kette im erzwungenen Modus (nicht abbrechbar)');
  const normal = await chain(null);
  check('ohne Dark Ocean endet die Kette (Schrittbudget bleibt weit unter dem Limit)', normal.res === true && normal.delays < 600, normal);
  hits.n = hits.cancelled = 0;
  const dark = await chain(1);
  check('unter Dark Ocean (Sitz 1) wird jeder Schlag storniert', hits.n >= 1 && hits.cancelled === hits.n, hits);
  check('…und die Kette endet nach dem ersten stornierten Schlag (keine Endlosschleife)', dark.res === true && dark.delays < 600, dark);
  hits.n = hits.cancelled = 0;
  const dark3 = await chain(3);
  check('Dark Ocean eines hinteren Sitzes (3 von 5) wirkt ebenfalls', dark3.res === true && dark3.delays < 600 && hits.n >= 1 && hits.cancelled === hits.n, { dark3, hits });

  console.error = origErr;
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Reaper-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
