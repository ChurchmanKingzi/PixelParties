'use strict';
// Befristete Effekte im Skill Test: „bis zum Ende des nächsten gegnerischen Zuges" (Pink Sky) und alle anderen Fristen in Spielerzügen
// (gs.turn + 1/+2/+3) betreffen genau den REST DER LAUFENDEN ROUND — nicht eine Round länger.
//   node scripts/skilltest-e2e/duration.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 34 });
  console.log = oL; console.error = oE;
  const { host, gs, engine } = out;
  const st = gs.skillTest;
  // Der Test misst Fristen, keine Surprises: eine verdeckte Karte der Gegner (z. B. Skull Carpet Bombing) löst beim Rundenwechsel
  // zufällig aus und zerstört die Test-Kreaturen. Welche Surprises der Seed-Pool verteilt, ist Zufall (jede neue Karte mit Bild
  // verschiebt ihn) — deshalb sind die Surprise-Zonen hier leer.
  for (const ps of gs.players) ps.surpriseZones = (ps.surpriseZones || []).map(() => []);
  for (const i of engine.cardInstances.filter(c => c.zone === 'surprise')) engine._untrackCard(i.id);
  const place = (seat, name, hi, slot) => {
    for (const i of engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat && c.heroIdx === hi && c.zoneSlot === slot)) engine._untrackCard(i.id);
    gs.players[seat].supportZones[hi][slot] = [name];
    return engine._trackCard(name, seat, 'support', hi, slot);
  };
  const nextRound = async () => { await rounds.endRound(engine); await rounds.startRound(engine, host); };

  console.log('Zähler');
  check('gs.turn zählt 2 je Round (Round 1 → 1)', gs.turn === 1 && st.round === 1, { turn: gs.turn, round: st.round });

  console.log('Pink Sky (+2, Wirker)');
  const caster = gs.activePlayer;
  const mine = place(caster, 'Skeleton Reaper', 0, 0);
  const theirs = place((caster + 1) % 3, 'Skeleton Reaper', 0, 0);
  const third = place((caster + 2) % 3, 'Skeleton Reaper', 0, 0);
  const pinkSky = require('../../cards/effects/pink-sky');
  await pinkSky.resolve(engine, caster);
  check('alle drei Kreaturen sind negiert', [mine, theirs, third].every(i => i.counters.negated), [mine, theirs, third].map(i => i.counters.negated));
  check('Frist: genau die nächste Round (Wirker-Zug)', mine.counters.buffs._pink_sky_negated.expiresAtTurn === gs.turn + 2);
  // Mitten in der Round: weitere Züge ändern nichts
  gs.activePlayer = (caster + 1) % 3;
  await engine._processBuffExpiry({ beforeStatusDamage: false });
  check('im Rest der Round bleibt die Negation', [mine, theirs, third].every(i => i.counters.negated));
  gs.activePlayer = caster;
  await nextRound();
  check('zu Beginn der nächsten Round ist die Negation weg (nicht erst eine Round später)', [mine, theirs, third].every(i => !i.counters.negated),
    [mine, theirs, third].map(i => i.counters.negated));
  check('Round zählt weiter', st.round === 2 && gs.turn === 3, { round: st.round, turn: gs.turn });

  console.log('Fristen +1 / +2 / +3 (Hero-Buffs)');
  // Der Test-Buff wird per `actionRemoveBuff` abgelöst — und das fragt `BEFORE_HERO_EFFECT`: ein Held mit Resistance (Lizbeth,
  // Resistance-Ability) blockt solche Effekte auf sich bis zu seinem Budget. Wer als erster Held des Wirkers aus dem Seed-Pool
  // kommt, ist Zufall (jede neue Karte mit Bild verschiebt den Pool) — der Test nimmt deshalb einen Helden ohne Resistance.
  const heroIdx = gs.players[caster].heroes.findIndex(h => h && h.name && !/^Lizbeth/.test(h.name));
  gs.players[caster].abilityZones[heroIdx] = (gs.players[caster].abilityZones[heroIdx] || []).map(z => (z || []).filter(a => a !== 'Resistance'));
  const hero = gs.players[caster].heroes[heroIdx];
  const t0 = gs.turn;
  const setBuff = (key, d) => { hero.buffs = hero.buffs || {}; hero.buffs[key] = { expiresAtTurn: t0 + d, expiresForPlayer: caster, source: 'test' }; };
  setBuff('t_plus1', 1); setBuff('t_plus2', 2); setBuff('t_plus3', 3);
  await nextRound();
  check('+1 (bis zum Ende dieses Zuges) endet mit der Round', !hero.buffs.t_plus1);
  check('+2 (bis zum Ende des nächsten Zuges) endet mit der Round', !hero.buffs.t_plus2);
  check('+3 (zwei Spielerzüge später) hält eine weitere Round', !!hero.buffs.t_plus3);
  await nextRound();
  check('+3 endet in der Round darauf', !hero.buffs.t_plus3);

  console.log('Normalspiel unberührt');
  const saved = gs.skillTest; delete gs.skillTest;
  check('Normalspiel: nur genau im benannten Zug', engine._ablaufFaellig(5, 0, 5, 0) === true && engine._ablaufFaellig(4, 0, 5, 0) === false
    && engine._ablaufFaellig(5, 1, 5, 0) === false && engine._ablaufFaellig(undefined, 0, 5, 0) === false);
  gs.skillTest = saved;

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Fristen-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
