'use strict';
// Garius, the Great Reformer: eine Karte, die in der Galerie steht, muss auch wählbar sein (Artifact-Creatures wie Pollution Spewer) — sonst schickt die CPU
// den Effekt endlos zurück zur Opferwahl.
//   node scripts/skilltest-e2e/garius.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const origErr = console.error; const errs = [];
  console.error = (...a) => { errs.push(a.join(' ')); };
  async function reform(deck) {
    let out, seed = 3;
    for (; seed < 40; seed++) {
      out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed });
      const hs = out.gs.players.map(p => p.heroes.map(h => h && h.name));
      // Heragas zieht beim Tod einer Kreatur und nähme die Deck-Karte vor Garius weg (der Hook gehört der ursprünglichen Karteninstanz).
      if (!hs.some(row => row.includes('Heragas, the Monster Slayer'))) break;
    }
    const { room, host, gs, engine } = out;
    const seat = gs.activePlayer, ps = gs.players[seat];
    gs.turn = 5;
    ps.heroes[0] = { name: 'Garius, the Great Reformer', hp: 450, maxHp: 450, atk: 80, baseAtk: 80, statuses: {} };
    const hi = engine.cardInstances.find(c => c.zone === 'hero' && c.owner === seat && c.heroIdx === 0);
    if (hi) hi.name = 'Garius, the Great Reformer';
    // Das Brett des Sitzes leeren: Garius opfert die schwächste Kreatur — es soll genau unsere sein.
    for (const c of engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat)) engine._untrackCard(c.id);
    for (const hz of ps.supportZones) for (let i = 0; i < hz.length; i++) hz[i] = [];
    ps.supportZones[0][0] = ['Cute Bunny'];
    const sac = engine._trackCard('Cute Bunny', seat, 'support', 0, 0);
    sac.turnPlayed = 1;
    ps.mainDeck = deck.slice();
    let delays = 0; const od = engine._delay; engine._delay = (ms) => { delays++; return od(ms); };
    let res;
    try { res = await rounds.act(room, seat, 'activate_hero_effect', { heroIdx: 0 }, () => host.doActivateHeroEffect(room, seat, { heroIdx: 0 }), host); }
    catch (e) { res = 'ERR ' + e.message.slice(0, 60); }
    const placed = engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0).map(c => c.name);
    const sacrificed = !placed.includes('Cute Bunny');
    return { res, delays, placed, sacrificed, runaway: errs.some(e => /ST_RUNAWAY/.test(e)) };
  }

  console.log('Garius tauscht ein Opfer gegen eine Deck-Kreatur');
  const normal = await reform(['Rocky Slime']);
  check('normale Kreatur: Tausch gelingt ohne Schleife', normal.delays < 600 && normal.placed.includes('Rocky Slime') && normal.sacrificed, normal);
  errs.length = 0;
  const art = await reform(['Pollution Spewer']);
  check('Artifact-Creature im Deck (Pollution Spewer): keine Endlosschleife', !art.runaway && art.delays < 600, art);
  check('…und Garius opfert nichts, was er nicht ersetzen kann (Wirkung nicht verfügbar)', !art.sacrificed && art.placed.includes('Cute Bunny'), art);
  errs.length = 0;
  const mixed = await reform(['Pollution Spewer', 'Rocky Slime']);
  check('neben der Artifact-Creature bleibt die normale Kreatur wählbar', !mixed.runaway && mixed.sacrificed && mixed.placed.includes('Rocky Slime'), mixed);

  console.error = origErr;
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Garius-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
