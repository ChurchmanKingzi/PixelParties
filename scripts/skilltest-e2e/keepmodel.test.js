'use strict';
// Gelerntes Behalten/Recyceln mit Kontext (headless): Das Modell muss Abhängigkeiten von der restlichen Hand und vom Brett
// erkennen — ein Zauber ist nur mit passender Schulstufe etwas wert, zwei Karten nur zusammen —, die Entscheidung muss sich mit
// dem Kontext ändern, und im Training müssen Entscheidungen samt Merkmalen im Lernprotokoll landen.
process.env.PP_ST_SIM = '1';
const KM = require('../../skilltest/learn/keepmodel');
const Rules = require('../../public/skilltest-rules.js');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

// ── Künstliche Welt: Karten und eine Regel, die das Ergebnis bestimmt ──
const cards = {
  H1: { name: 'H1', cardType: 'Hero', hp: 300 }, H2: { name: 'H2', cardType: 'Hero', hp: 300 }, H3: { name: 'H3', cardType: 'Hero', hp: 300 },
  'Destruction Magic': { name: 'Destruction Magic', cardType: 'Ability' },
  'Big Bolt': { name: 'Big Bolt', cardType: 'Spell', subtype: 'Normal', spellSchool1: 'Destruction Magic', level: 2 },
  'Filler X': { name: 'Filler X', cardType: 'Spell', subtype: 'Normal', level: 0 },
  'Filler Y': { name: 'Filler Y', cardType: 'Spell', subtype: 'Normal', level: 0 },
  'Combo A': { name: 'Combo A', cardType: 'Spell', subtype: 'Normal', archetype: 'Combo', level: 0 },
  'Combo B': { name: 'Combo B', cardType: 'Spell', subtype: 'Normal', archetype: 'Combo', level: 0 },
};
const env = { cards };
const usable = () => true;

function board(withDestruction) {
  const ps = Rules.emptyPlayer();
  ps.heroes = ['H1', 'H2', 'H3'];
  if (withDestruction) ps.abilityZones[0][0] = { n: 'Destruction Magic', s: 2, c: false };
  return ps;
}
const rng = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; })();

(async () => {
  console.log('Merkmale und Kontext');
  const ps0 = board(true); ps0.hand = ['Big Bolt', 'Combo A'];
  const ctx = KM.buildContext(env, ps0, ps0.hand);
  const fBolt = KM.featuresFor(env, 'Big Bolt', ctx);
  check('Stufenanforderung erfüllt → Merkmal fit:…:0', fBolt.includes('fit:Spell/Normal:0'), fBolt);
  const ps1 = board(false); ps1.hand = ['Big Bolt', 'Destruction Magic'];
  const f1 = KM.featuresFor(env, 'Big Bolt', KM.buildContext(env, ps1, ps1.hand));
  check('Lücke wird erkannt (2) und von der Ability auf der Hand geschlossen (fitH 1)', f1.includes('fit:Spell/Normal:2') && f1.includes('fitH:Spell/Normal:1'), f1);
  const f2 = KM.featuresFor(env, 'Combo A', KM.buildContext(env, { ...board(false), hand: ['Combo A', 'Combo B'] }, ['Combo A', 'Combo B']));
  check('Paar- und Synergie-Merkmale kennen den Mitspieler auf der Hand', f2.includes('p:Combo A|Combo B') && f2.includes('syn:Combo:1'), f2);

  console.log('Lernen aus Partien (künstliche Abhängigkeiten)');
  // Je Partie: Brett mit oder ohne Destruction Magic Stufe 2, zufällige Hand, zufällige Entscheidung je Karte (50/50).
  // Ergebnis: Big Bolt behalten lohnt nur mit Stufe 2; Combo A + B nur zusammen; Filler behalten kostet etwas (Gold fehlt).
  const model = KM.newModel();
  const N = 30000;
  for (let g = 0; g < N; g++) {
    const withD = rng() < 0.5;
    const ps = board(withD);
    const pool = ['Big Bolt', 'Filler X', 'Filler Y', 'Combo A', 'Combo B'].filter(() => rng() < 0.75);
    ps.hand = pool;
    const ctx2 = KM.buildContext(env, ps, pool);
    const act = {};
    for (const n of pool) act[n] = rng() < 0.5 ? 1 : -1;
    let y = (rng() - 0.5) * 0.6;
    if (act['Big Bolt'] === 1) y += withD ? 0.5 : -0.3;
    if (act['Combo A'] === 1 && act['Combo B'] === 1) y += 0.6;
    for (const n of ['Filler X', 'Filler Y']) if (act[n] === 1) y -= 0.1;
    if (rng() < 0.3) y += (rng() - 0.5) * 0.4;
    for (const n of pool) KM.update(model, KM.featuresFor(env, n, ctx2), act[n], Math.max(-1, Math.min(1, y)));
  }
  const edgeOf = (ps, n) => KM.edge(model, KM.featuresFor(env, n, KM.buildContext(env, ps, ps.hand)));
  const withBolt = (w) => { const p = board(w); p.hand = ['Big Bolt', 'Filler X']; return p; };
  const eBoltYes = edgeOf(withBolt(true), 'Big Bolt'), eBoltNo = edgeOf(withBolt(false), 'Big Bolt');
  check('Big Bolt: behalten lohnt mit Stufe 2 auf dem Brett (Kontrast > 0,2)', eBoltYes > 0.2, eBoltYes);
  check('Big Bolt: ohne passende Stufe lieber recyceln (Kontrast < −0,1)', eBoltNo < -0.1, eBoltNo);
  const pAB = board(false); pAB.hand = ['Combo A', 'Combo B'];
  const pA = board(false); pA.hand = ['Combo A', 'Filler X'];
  const eWith = edgeOf(pAB, 'Combo A'), eAlone = edgeOf(pA, 'Combo A');
  check('Combo A: mit Combo B auf der Hand deutlich wertvoller als allein (Unterschied > 0,3)', eWith - eAlone > 0.3, { eWith, eAlone });
  const pF = board(true); pF.hand = ['Filler X'];
  check('Füllkarte: behalten kostet etwas', edgeOf(pF, 'Filler X') < 0, edgeOf(pF, 'Filler X'));

  console.log('Entscheidung mit Kontext');
  const decide = KM.makeDecider({ env, model, usable, maxKeep: 10, bias: 0, explore: 0, rng });
  const names = (ps, r) => r.recycle.map(i => ps.hand[i]).sort();
  const d1 = board(true); d1.hand = ['Big Bolt', 'Filler X', 'Filler Y', 'Combo A', 'Combo B'];
  const r1 = decide(d1);
  check('Mit Stufe 2: Big Bolt bleibt, Combo A + B bleiben zusammen, Füllkarten gehen', !names(d1, r1).includes('Big Bolt') && !names(d1, r1).includes('Combo A') && !names(d1, r1).includes('Combo B') && names(d1, r1).includes('Filler X'), names(d1, r1));
  const d2 = board(false); d2.hand = ['Big Bolt', 'Combo A', 'Filler Y'];
  const r2 = decide(d2);
  check('Ohne Stufe: Big Bolt geht, auch die Füllkarte', names(d2, r2).includes('Big Bolt') && names(d2, r2).includes('Filler Y'), names(d2, r2));
  const dAlone = board(true); dAlone.hand = ['Combo A', 'Filler X'];
  const dPair = board(true); dPair.hand = ['Combo A', 'Combo B'];
  const eA = (p) => KM.edge(model, KM.featuresFor(env, 'Combo A', KM.buildContext(env, p, p.hand)));
  check('Derselbe Zauber (Combo A) wird mit Partner auf der Hand höher bewertet als ohne', eA(dPair) - eA(dAlone) > 0.3, { mit: eA(dPair), ohne: eA(dAlone) });
  const d3 = board(false); d3.hand = ['Combo A', 'Combo B'];
  check('Combo A + B zusammen bleiben', names(d3, decide(d3)).length === 0, names(d3, decide(d3)));
  const capped = KM.makeDecider({ env, model, usable, maxKeep: 1, bias: 0, explore: 0, rng })(d1);
  check('Obergrenze der Persona wird eingehalten (höchstens 1 Karte bleibt)', d1.hand.length - capped.recycle.length <= 1, capped.recycle);
  const log = r1.log;
  check('Entscheidungsprotokoll enthält Merkmale und Arm je Karte', log.length === 5 && log.every(e => Array.isArray(e.f) && e.f.length > 3 && (e.a === 1 || e.a === -1)), log.map(e => [e.c, e.a, e.f.length]));
  const forcedAll = KM.makeDecider({ env, model, usable, maxKeep: 10, bias: 0, explore: 1, rng })(d1);
  check('Neugier erzwingt Entscheidungen gegen das Modell (Markierung x)', forcedAll.log.every(e => e.x === 1), forcedAll.log.map(e => e.x));

  console.log('Vorgabe ohne Daten, Speicherung');
  const empty = KM.newModel();
  const dp = KM.makeDecider({ env: { cards: { ...cards, Junk: { name: 'Junk', cardType: 'Hero' } } }, model: empty, usable: (c) => c.cardType !== 'Hero', maxKeep: 10, explore: 0, rng });
  const d4 = board(true); d4.hand = ['Filler X', 'Junk'];
  const r4 = dp(d4);
  check('Ohne Daten gilt die feste Vorgabe: Brauchbares bleibt, Unbrauchbares (Hero bei vollem Brett) geht', r4.recycle.length === 1 && d4.hand[r4.recycle[0]] === 'Junk', r4.recycle);
  const d5 = board(true); d5.heroes[2] = null; d5.hand = ['Filler X', 'Junk'];
  check('Hero lässt sich nur bei vollem Brett recyceln — sonst bleibt er', dp(d5).recycle.length === 0, dp(d5).recycle);
  const comp = KM.compact(model);
  check('Kompakte Fassung bleibt lesbar (Gewichte [w, n])', Array.isArray(Object.values(comp.w)[0]) && comp.n === model.n);
  const pruned = JSON.parse(JSON.stringify(model));
  KM.prune(pruned, 20, 1);
  check('Beschneiden hält die Tabelle klein', new Set([...Object.keys(pruned.u), ...Object.keys(pruned.w)]).size <= 20);

  console.log('Im Training: Entscheidungen landen im Lernprotokoll');
  const os = require('os'), path = require('path');
  process.env.PP_ST_PROFILE = path.join(os.tmpdir(), 'st-keep-test-' + process.pid + '.json');
  const { runGame } = require('../../skilltest/sim');
  const rec = await runGame({ seats: 3, record: true });
  const logs = rec.bases.map(b => b.keepLog || []);
  check('Jede Basis hat ein Entscheidungsprotokoll (Behalten und Recyceln)', logs.every(l => l.length > 0) && logs.some(l => l.some(e => e.a === -1)) && logs.some(l => l.some(e => e.a === 1)), logs.map(l => l.length));
  const train = require('../../skilltest/learn/train');
  const profile = await train.train({ games: 6, seats: [2, 4], quiet: true, saveEvery: 3 });
  const disk = require('../../skilltest/learn/profile').load();
  check('Das Profil enthält ein Behalten/Recyceln-Modell mit Beobachtungen', disk.keepModel && disk.keepModel.n > 50 && Object.keys(disk.keepModel.w).length > 50, disk.keepModel && disk.keepModel.n);
  void profile;
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
