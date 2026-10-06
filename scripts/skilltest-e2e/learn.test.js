'use strict';
// Lernsystem: ein paar Selbstspiel-Partien, Profil-Struktur, Persistenz, Persona-Evolution, Basisaufbau mit Recycling.
// Läuft headless (ohne Server-Port) und braucht kein socket.io-client.
const path = require('path');
const os = require('os');
const fs = require('fs');
process.env.PP_ST_SIM = '1';
process.env.PP_ST_PROFILE = path.join(os.tmpdir(), 'st-learn-test-' + process.pid + '.json');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const profileMod = require('../../skilltest/learn/profile');
  const train = require('../../skilltest/learn/train');
  const personas = require('../../skilltest/learn/personas');
  console.log('Lernsystem');

  // Personas
  const w = personas.mutate(personas.DEFAULT_WEIGHTS, Math.random, 0.5, 1);
  check('Mutation bleibt in den Grenzen', personas.KEYS.every(k => w[k] >= personas.SPACE[k][0] && w[k] <= personas.SPACE[k][1]), w);
  const c = personas.crossover(personas.randomWeights(), personas.randomWeights());
  check('Kreuzung liefert alle Gewichte', personas.KEYS.every(k => Number.isFinite(c[k])), c);

  // Platzierungsgüte
  check('Sieger +1, Letzter −1', train.placeScore(1, 4) === 1 && train.placeScore(4, 4) === -1 && train.placeScore(2, 3) === 0);

  // Kurzer Lernlauf
  const profile = await train.train({ games: 6, seats: [2, 4], quiet: true, saveEvery: 3 });
  check('Profil gespeichert', fs.existsSync(process.env.PP_ST_PROFILE));
  const disk = profileMod.load();
  check('Version hochgezählt, Partien gezählt', disk.version >= 1 && disk.games === 6, { v: disk.version, g: disk.games });
  check('Spielwerte gelernt', Object.keys(disk.playValue).length > 0 && disk.totals.plays > 0);
  check('Kartenwerte gelernt', Object.keys(disk.cardValue).length > 20);
  check('Paarwerte gelernt', Object.keys(disk.pairValue).length > 20);
  check('Persona-Population vorhanden (inkl. Anker)', disk.personas.length >= 4 && disk.personas.some(p => p.id === 'default'), disk.personas.length);
  check('Persona-Statistik zählt Sitze', disk.personas.reduce((a, p) => a + p.games, 0) >= 6 * 2);

  // Evolution (erzwungen)
  for (const p of disk.personas) { p.games = 30; p.scoreSum = (Math.random() - 0.5) * 20; }
  const evolved = train.evolve(disk);
  check('Evolution ersetzt Personas, Anker bleibt', evolved && disk.personas.length >= 4 && disk.personas.some(p => p.id === 'default'));

  // Profil wird vom Bot gelesen
  profileMod.reset();
  const got = profileMod.get();
  check('Bot-Sicht auf das Profil (get)', got.version === profile.version && got.games === 6, { v: got.version });
  const per = profileMod.samplePersona(got);
  check('Persona ziehbar', per && per.weights && Number.isFinite(per.weights.aggression));

  // Basisaufbau mit Recycling
  const { getCardDB } = require('../../cards/effects/_card-db');
  const Rules = require('../../public/skilltest-rules.js');
  const { CardPool, dealHand } = require('../../skilltest/pool');
  const { CONFIG } = require('../../skilltest/config');
  const { buildWithRecycling } = require('../../skilltest/autoprep');
  const cards = getCardDB();
  const env = { cards, areaLimitOf: () => 1 };
  const pool = new CardPool(cards);
  let totalRec = 0, boardsOk = true, handOk = true, ejects = 0;
  const before = pool.remaining();
  for (let i = 0; i < 6; i++) {
    const ps0 = Rules.emptyPlayer(); ps0.hand = dealHand(pool).hand;
    const mark = pool.remaining();
    const built = buildWithRecycling(env, ps0, { pool, config: CONFIG });
    totalRec += built.recycled;
    ejects += mark - pool.remaining();
    if (!(Rules.boardFull(built) && built.ready === true)) boardsOk = false;
    if (built.hand.length > 8) handOk = false;
  }
  check('Basen stehen (volles Board, bereit)', boardsOk);
  check('Es wurde recycelt', totalRec >= 1, totalRec);
  check('Pool schrumpft nur durch Auswürfe (jede 2. Karte)', ejects <= Math.ceil(totalRec / CONFIG.RECYCLE_EVERY) + 6, { ejects, totalRec });
  check('Hand bleibt klein', handOk);

  try { fs.unlinkSync(process.env.PP_ST_PROFILE); } catch { /* egal */ }
  console.log(fails ? `\n${fails} Prüfung(en) FEHLGESCHLAGEN` : '\nAlles bestanden');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
