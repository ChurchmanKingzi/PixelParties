'use strict';
// Opferwahl der CPU (headless): gültige Teilmenge statt Endlos-Nachfragen (Nachttraining: Steam Dwarf Dragon Pilot → ST_RUNAWAY).
//   node scripts/skilltest-e2e/sacrifice.test.js
const Rules = require('../../public/skilltest-rules.js');
const { getCardDB } = require('../../cards/effects/_card-db');
const { runGame } = require('../../skilltest/sim');
const policy = require('../../skilltest/policy');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };
const T = (id, maxHp, level, heroIdx = 0, owner = 0) => ({ id, type: 'equip', owner, heroIdx, _meta: { maxHp, level } });

console.log('chooseTribute (Policy)');
let cands = [T('a', 50, 0), T('b', 80, 1), T('c', 200, 1), T('d', 150, 1)];
let r = policy.chooseTribute(cands, { minRequired: 2, minSumMaxHp: 300, maxTotal: 4 }, 0);
const sel = (ids) => cands.filter(t => ids.includes(t.id));
check('Mindest-Max-HP 300 mit ≥ 2 Kreaturen erfüllt', r.length >= 2 && sel(r).reduce((s, t) => s + t._meta.maxHp, 0) >= 300, r);
check('…und nicht teurer als die zwei größten (200 + 150, Kosten 470)', sel(r).reduce((s, t) => s + t._meta.maxHp + 60 * t._meta.level, 0) <= 470, r);
r = policy.chooseTribute([T('a', 50, 0), T('b', 80, 1)], { minRequired: 2, minSumMaxHp: 300, maxTotal: 2 }, 0);
check('Unerfüllbar → leere Wahl (die Engine bricht ab)', Array.isArray(r) && r.length === 0, r);
cands = [T('a', 100, 1, 0), T('b', 100, 1, 1), T('c', 40, 0, 2)];
r = policy.chooseTribute(cands, { minRequired: 1, maxTotal: 3, mustIncludeFromHeroIdx: 1 }, 0);
check('„Mindestens ein Opfer von Hero 1": gewählt wird die Kreatur von Hero 1', r.length === 1 && r[0] === 'b', r);
cands = [T('a', 100, 2), T('b', 100, 1), T('c', 40, 1)];
r = policy.chooseTribute(cands, { minRequired: 2, minSumLevel: 3, maxTotal: 3 }, 0);
check('Mindest-Level 3 erfüllt', sel(r).reduce((s, t) => s + t._meta.level, 0) >= 3 && r.length >= 2, r);

console.log('Spiel: Dragon Pilot in der Hand, zwei dicke Kreaturen auf dem Brett — keine Endlosschleife');
const cards = getCardDB(); const env = { cards, areaLimitOf: () => undefined };
let runaway = 0; const origErr = console.error;
console.error = (...a) => { if (/ST_RUNAWAY/.test(a.join(' '))) runaway++; };
const big = Object.values(cards).filter(c => c.cardType === 'Creature' && c.skilltestLegal && (c.hp || 0) >= 150 && !/Cosmic|Cardinal|Quetza/.test(c.name)).map(c => c.name);
(async () => {
  let games = 0, pilots = 0;
  for (let g = 0; g < 40; g++) {
    const out = await runGame({ seats: 4, maxTurns: 1500, noProfileSeats: [0, 1, 2, 3], returnRoom: true,
      mutatePrep: (prep) => {
        const ps = prep.players[0]; ps.ready = false;
        for (let slot = 0; slot < 2; slot++) if (!ps.supportZones[1][slot].length) {
          ps.hand.push(big[Math.floor(Math.random() * big.length)]);
          const r2 = Rules.applyMove(env, ps, { type: 'place', from: { kind: 'hand', idx: ps.hand.length - 1 }, to: { kind: 'support', hi: 1, slot } });
          if (r2.ok) Object.assign(ps, r2.ps);
        }
        ps.hand.push('Steam Dwarf Dragon Pilot'); ps.ready = true;
      } });
    games++;
    pilots += out.room.engine.cardInstances.filter(c => c.name === 'Steam Dwarf Dragon Pilot').length + (out.room.gameState.players[0].discardPile || []).filter(n => n === 'Steam Dwarf Dragon Pilot').length;
  }
  console.error = origErr;
  check('Keine ST_RUNAWAY-Abbrüche in 40 Spielen', runaway === 0, runaway);
  check('Der Pilot wurde dabei tatsächlich beschworen (Brett oder Ablage)', pilots > 0, pilots);
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Opferwahl-Tests grün');
  process.exit(fails ? 1 : 0);
})();
