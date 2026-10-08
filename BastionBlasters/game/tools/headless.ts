// Bot gegen Bot im Terminal: npm run sim -- --seed 1 --games 5 [--verbose]
import { existsSync, readFileSync } from 'node:fs';
import { TPS } from '../src/sim/constants';
import { Match } from '../src/sim/match';
import { operatingDegree } from '../src/sim/systems';
import { UNITS } from '../src/sim/data';

const args = process.argv.slice(2);
const arg = (n: string, d: string) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const seed0 = Number(arg('seed', '1'));
const games = Number(arg('games', '1'));
const verbose = args.includes('--verbose');
const maxMin = Number(arg('max', '40'));

let ponds: number[][] | undefined;
const pj = new URL('../public/assets/bg_field.json', import.meta.url);
if (existsSync(pj)) ponds = JSON.parse(readFileSync(pj, 'utf-8')).ponds;

const summary = { w0: 0, w1: 0, draw: 0, core: 0, conq: 0, mins: [] as number[] };
for (let g = 0; g < games; g++) {
  const m = new Match({ seed: seed0 + g, bots: [true, true], ponds });
  const w = m.world;
  m.startLoadout();
  const t0 = Date.now();
  let lastLog = -1;
  let idle = 0;
  while (w.phase !== 'over' && w.battleTime < maxMin * 60) {
    if (w.phase !== 'battle' && ++idle > 1000) { console.log('stuck in phase', w.phase); break; }
    m.tick();
    w.events.length = 0;
    if (verbose && w.phase === 'battle' && Math.floor(w.battleTime / 10) !== lastLog) {
      lastLog = Math.floor(w.battleTime / 10);
      const c0 = w.modules.get(w.coreMod[0])!, c1 = w.modules.get(w.coreMod[1])!;
      const cnt = (t: number) => w.units.filter((u) => !u.dead && u.team === t && u.cat !== 'citizen').length;
      console.log(`t=${w.battleTime.toFixed(0).padStart(4)}s wave ${w.waveNo} | core ${c0.hp.toFixed(0)}/${c1.hp.toFixed(0)} | conq ${w.conquest[0].toFixed(0)}/${w.conquest[1].toFixed(0)} | units ${cnt(0)}/${cnt(1)} | ops ${(operatingDegree(w, 0) * 100).toFixed(0)}%/${(operatingDegree(w, 1) * 100).toFixed(0)}%`);
    }
    if (w.tick > TPS * 60 * 60 * 3) break;
  }
  const mins = w.battleTime / 60;
  const res = w.winner === 0 ? 'P1' : w.winner === 1 ? 'P2' : 'draw/none';
  console.log(`game ${g + 1} seed ${seed0 + g}: ${res} by ${w.winType || 'timeout'} after ${mins.toFixed(1)} min, pauses ${w.pauseNo}, waves ${w.waveNo} (${((Date.now() - t0) / 1000).toFixed(1)}s real)`);
  const s = w.stats;
  console.log(`   kills ${s.kills.join('/')}  civ killed ${s.civKilled.join('/')}  retreats ${s.retreats.join('/')}  healed ${s.healed.map((x) => x.toFixed(0)).join('/')}  walls broken ${s.wallsBroken.join('/')}  modules lost ${s.modulesLost.join('/')}  struct dmg ${s.dmgStruct.map((x) => x.toFixed(0)).join('/')}  shots ${s.shots.join('/')}`);
  if (verbose) for (const t of [0, 1]) console.log(`   P${t + 1} contingent: ${w.players[t as 0 | 1].contingent.map((e) => `${UNITS[e.card].name}${e.star > 1 ? '*' + e.star : ''}`).join(', ')} | modules: ${[...w.modules.values()].filter((x) => x.owner === t && !x.destroyed && x.kind !== 'core').map((x) => x.card).join(' ')}`);
  if (w.winner === 0) summary.w0++; else if (w.winner === 1) summary.w1++; else summary.draw++;
  if (w.winType === 'core') summary.core++; else if (w.winType === 'conquest') summary.conq++;
  summary.mins.push(mins);
}
if (games > 1) {
  const avg = summary.mins.reduce((a, b) => a + b, 0) / games;
  console.log(`\nP1 ${summary.w0} / P2 ${summary.w1} / draw ${summary.draw}; core ${summary.core}, conquest ${summary.conq}; avg ${avg.toFixed(1)} min`);
}
