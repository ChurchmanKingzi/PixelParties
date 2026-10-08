'use strict';
// Dream Lander (Creatures mit `attachableHeroes`) starten im Skill Test mit ihrem Hero angelegt — beim Ausspielen im Kampf und wenn sie schon im Aufbau auf dem Brett stehen.
//   node scripts/skilltest-e2e/dream-lander.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error; console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 53,
    mutatePrep: (prep) => { prep.players[1].supportZones[0][0] = ['Goff, the Burnbringer']; } });
  console.log = oL; console.error = oE;
  const { gs, engine } = out;
  const find = (name, owner) => engine.cardInstances.find(c => c.name === name && c.zone === 'support' && c.owner === owner);

  console.log('im Aufbau platziert');
  const goff = find('Goff, the Burnbringer', 1);
  check('Goff steht auf dem Brett', !!goff);
  check('Gon ist bereits angelegt', goff && goff.counters.attachedHero === 'Gon, the Frostbringer', goff && goff.counters);
  const base = require('../../skilltest/pool') && require('../../data/cards.json').find(c => c.name === 'Goff, the Burnbringer').hp;
  check('Bonus greift sofort (+200 HP)', goff && (goff.counters.maxHp || 0) >= base + 200, { maxHp: goff && goff.counters.maxHp, base });

  console.log('im Kampf ausgespielt');
  const seat = 2;
  const heroes = gs.players[seat].heroes;
  const hi = heroes.findIndex(h => h && h.name && h.hp > 0);
  // freien Platz suchen
  let slot = -1; for (let z = 0; z < 3; z++) if (!(gs.players[seat].supportZones[hi][z] || []).length) { slot = z; break; }
  if (slot < 0) { gs.players[seat].supportZones[hi][2] = []; slot = 2; }
  const r = engine.summonCreature('Wolflesia, the Canine Flower', seat, hi, slot);
  const w = r && r.inst;
  check('Wolflesia beschworen', !!w);
  check('Rafflesia ist angelegt, ohne dass sie auf der Hand lag', w && w.counters.attachedHero === 'Rafflesia, the Poison Princess', w && w.counters);
  const script = require('../../cards/effects/_loader').loadCardEffect('Wolflesia, the Canine Flower');
  check('der Anlege-Effekt ist damit verbraucht (canActivateCreatureEffect = false)', w && script.canActivateCreatureEffect({ _engine: engine, card: w, cardOwner: seat }) === false);

  console.log('Normalspiel unberührt');
  const saved = gs.skillTest; delete gs.skillTest;
  const x = engine.summonCreature('Stellin, the Calm Dictator', 0, gs.players[0].heroes.findIndex(h => h && h.name), -1);
  check('ohne Skill Test wird nichts automatisch angelegt', !x || !x.inst || !x.inst.counters.attachedHero, x && x.inst && x.inst.counters);
  gs.skillTest = saved;

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Dream-Lander-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
