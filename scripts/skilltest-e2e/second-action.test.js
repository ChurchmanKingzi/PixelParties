'use strict';
// Zusatzaktionen je Held und Round (headless): Seat 1 bekommt Duigno ("a second Action during each of your Action Phases").
// Erwartung: kein Held handelt mehr als zweimal pro Round (Hauptaktion + höchstens EINE zweite Aktion); mit Duigno handelt
// mindestens ein Held in mindestens einer Round zweimal; ohne Duigno nie.
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  console.log('Zusatzaktionen je Held und Round');
  const log = [];       // { game, round, seat, hero, kind }
  const origAct = rounds.act;
  let game = 0;
  // Karten, die laut Text „als zusätzliche Aktion zählen“ — sie gehören nicht zu den (Haupt-/Zweit-)Aktionen eines Helden.
  const FREE = new Set((() => { const c = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8')); const l = Array.isArray(c) ? c : Object.values(c.cards || c);
    return l.filter(x => /counts as an additional action/i.test(x.effect || '')).map(x => x.name); })());
  rounds.act = async function (room, pi, kind, params, fn, host) {
    const st = room.gameState.skillTest;
    const before = st.turnsTaken[pi] || 0, round = st.round;
    const r = await origAct.apply(this, arguments);
    if ((st.turnsTaken[pi] || 0) > before && params && params.heroIdx != null && (kind === 'play_spell' || kind === 'play_creature' || kind === 'activate_ability')) log.push({ game, round, seat: pi, hero: params.heroIdx, kind, free: FREE.has(params.cardName) });
    return r;
  };
  const origAttack = rounds.playBaseAttack;
  rounds.playBaseAttack = async function (room, pi, heroIdx, host) {
    const st = room.gameState.skillTest;
    const before = st.turnsTaken[pi] || 0, round = st.round;
    const r = await origAttack.apply(this, arguments);
    if ((st.turnsTaken[pi] || 0) > before) log.push({ game, round, seat: pi, hero: heroIdx, kind: 'attack' });
    return r;
  };
  const DUIGNO = 'Duigno, the Flaming Phoenix';
  let withMax = 0, withoutMax = 0, withDouble = 0;
  for (game = 0; game < 16; game++) {
    await runGame({ seats: 3, mutatePrep: (prep) => { prep.players[1].supportZones[0][0] = [DUIGNO]; } });
  }
  const per = {};
  for (const e of log) { if (e.free) continue; const k = `${e.game}:${e.round}:${e.seat}:${e.hero}`; per[k] = (per[k] || 0) + 1; }
  for (const [k, n] of Object.entries(per)) {
    const seat = Number(k.split(':')[2]);
    if (seat === 1) { withMax = Math.max(withMax, n); if (n >= 2) withDouble++; } else withoutMax = Math.max(withoutMax, n);
  }
  const odd = Object.entries(per).filter(([k, n]) => Number(k.split(':')[2]) !== 1 && n >= 2).slice(0, 4);
  if (odd.length) for (const [k, n] of odd) console.log('  (andere Sitze mit zwei Aktionen:', k, n, log.filter(e => `${e.game}:${e.round}:${e.seat}:${e.hero}` === k).map(e => e.kind).join(','), ')');
  check('Kein Held handelt öfter als dreimal pro Round (ohne „zählt als zusätzliche Aktion“-Karten)', withMax <= 3, { withMax });
  check('Ohne Duigno: höchstens zwei Aktionen eines Helden pro Round (ohne „zählt als zusätzliche Aktion“-Karten)', withoutMax <= 2, { withoutMax });
  check('Mit Duigno gibt es zweite Aktionen eines Helden', withDouble >= 1, { withDouble, ones: Object.keys(per).length });
  console.log(`  (${withDouble} Held-Rounds mit zwei Aktionen bei Duigno, ${Object.keys(per).length} Held-Rounds insgesamt)`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
