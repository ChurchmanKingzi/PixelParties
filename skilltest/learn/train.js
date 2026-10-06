'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — LERNSYSTEM DER BOTS (Selbstspiel, 2–8 Sitze gemischt)
//
//  Bots spielen komplette Partien gegeneinander (headless, skilltest/sim.js)
//  und lernen aus drei Kanälen in EINEM Profil (learn/profile.js):
//
//   Kanal 1 — Spielwerte (`playValue`): nach jeder verbrauchenden Aktion wird die
//     Änderung der Stellungsbewertung gemessen (policy.stateValue: eigene Heroes,
//     Creatures, Gold gegen den Schnitt der Gegner). Mittelwerte je Karte/Aktion
//     („Wann lohnt sich dieser Zauber, dieser Creature-Effekt?"). Die Policy
//     bevorzugt hohe Werte und probiert selten Gespieltes aus (UCB-Neugier).
//
//   Kanal 2 — Aufbauwerte (`cardValue`, `pairValue`): mittlere Platzierungsgüte
//     (+1 Sieg … −1 Letzter) aller Basen, in denen eine Karte bzw. ein Paar
//     (Held+Ability, Held+Creature, Ability+Creature auf einem Helden, Held+Held)
//     stand. Grundlage für Heldenwahl, Ability-/Creature-Verteilung, was im
//     Recycler landet.
//
//   Kanal 3 — Spielstile (`personas`): Population von Gewichtsvektoren
//     (Aggression, Zielwahl, Fokus auf den Führenden, Zauber-/Effekt-Neigung …).
//     Liga: Sitze ziehen Personas nach Fitness (mit etwas Zufall), die schlechtere
//     Hälfte wird regelmäßig durch Kreuzungen/Mutationen der besseren ersetzt.
//
//  Programmatisch:   const { train } = require('./train'); await train({ games: 500 });
//  Kommandozeile:    node scripts/skilltest-train.js --games 500 --seats 2-8
//  Dauerbetrieb:     PP_ST_TRAIN_BG=1 (siehe learn/background.js)
// ═══════════════════════════════════════════════════════════════════
const profileMod = require('./profile');
const personas = require('./personas');
const ranking = require('./ranking');

const PLAY_VALUE_SCALE = 40;      // 40 Punkte Stellungsgewinn = 1 Wertpunkt in der Policy
const MIN_GAMES_FOR_EVOLUTION = 12;
const POPULATION = 12;

/** Platzierungsgüte: Sieger +1, Letzter −1 (linear). */
function placeScore(place, n) { return n > 1 ? (n + 1 - 2 * place) / (n - 1) : 0; }

const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

/** Karten und Paare einer Basis (Zustand der Vorbereitung). */
function baseFeatures(ps) {
  const cards = new Set(), pairs = new Set();
  const heroes = (ps.heroes || []).filter(Boolean);
  (ps.heroes || []).forEach((h, hi) => {
    if (!h) return;
    cards.add(h);
    const col = [];
    for (const z of (ps.abilityZones && ps.abilityZones[hi]) || []) if (z && z.n) col.push({ n: z.n, t: 'a' });
    for (const z of (ps.supportZones && ps.supportZones[hi]) || []) for (const n of (z || [])) col.push({ n, t: 's' });
    const sur = ps.surpriseZones && ps.surpriseZones[hi];
    if (sur) col.push({ n: sur, t: 's' });
    for (const c of col) { cards.add(c.n); pairs.add(pairKey(h, c.n)); }
    // Kombos innerhalb einer Spalte: Ability × Creature/Support
    for (const a of col.filter(c => c.t === 'a')) for (const s of col.filter(c => c.t === 's')) pairs.add(pairKey(a.n, s.n));
  });
  for (const n of ps.areaZone || []) cards.add(n);
  for (let i = 0; i < heroes.length; i++) for (let j = i + 1; j < heroes.length; j++) pairs.add(pairKey(heroes[i], heroes[j]));
  return { cards: [...cards], pairs: [...pairs] };
}

// ── Population ─────────────────────────────────────────────────────
function newPersona(weights, id, rng) {
  const w = personas.normalize(weights);
  return { id, name: personas.nameFor(w), weights: w, games: 0, scoreSum: 0, fitness: 0, born: Date.now() };
}

/** Anfangspopulation: der Standard als Anker plus gestreute Varianten. */
function seedPopulation(profile, rng = Math.random) {
  if (profile.personas && profile.personas.length) return;
  const pop = [newPersona(personas.DEFAULT_WEIGHTS, 'default', rng)];
  for (let i = 1; i < POPULATION; i++) {
    const base = i < 4 ? personas.DEFAULT_WEIGHTS : personas.randomWeights(rng);
    pop.push(newPersona(i < 4 ? personas.mutate(base, rng, 0.3) : base, 'p' + Date.now().toString(36) + i, rng));
  }
  profile.personas = pop;
}

const fitnessOf = (p) => p.scoreSum / (p.games + 5);

/** Selektion: bessere Hälfte bleibt, die schlechtere wird durch Kreuzungen/Mutationen ersetzt. Der Anker `default` bleibt immer. */
function evolve(profile, rng = Math.random) {
  const pop = profile.personas;
  if (pop.length < 4 || pop.some(p => p.games < MIN_GAMES_FOR_EVOLUTION)) return false;
  for (const p of pop) p.fitness = fitnessOf(p);
  const ranked = [...pop].sort((a, b) => b.fitness - a.fitness);
  const keep = ranked.slice(0, Math.ceil(pop.length / 2));
  if (!keep.some(p => p.id === 'default')) keep.push(pop.find(p => p.id === 'default'));
  const next = keep.filter(Boolean);
  while (next.length < POPULATION) {
    const a = keep[Math.floor(rng() * keep.length)], b = keep[Math.floor(rng() * keep.length)];
    const child = rng() < 0.3 ? personas.randomWeights(rng) : personas.mutate(personas.crossover(a.weights, b.weights, rng), rng, 0.12);
    next.push(newPersona(child, 'p' + Date.now().toString(36) + next.length, rng));
  }
  // Überlebende altern: ihre Statistik zählt nur noch halb (die Liga ändert sich).
  for (const p of next) if (p.games > 0 && p.born !== undefined) { p.games = Math.ceil(p.games / 2); p.scoreSum /= 2; }
  profile.personas = next;
  profile.totals.generations = (profile.totals.generations || 0) + 1;
  return true;
}

/** Persona für einen Sitz: meist nach Fitness, manchmal zufällig (Vielfalt). */
function pickPersona(profile, rng = Math.random) {
  const pop = profile.personas;
  if (rng() < 0.15) return pop[Math.floor(rng() * pop.length)];
  return profileMod.samplePersona(profile, rng) || pop[0];
}

// ── Lernen aus einer Partie ────────────────────────────────────────
function learnFrom(profile, game) {
  const { rec, n, personaIds } = game;
  const place = rec.placements || {};
  profile.games++;
  const bp = profile.totals.byPlayers;
  bp[n] = (bp[n] || 0) + 1;
  for (const l of rec.learnLog || []) {
    profileMod.addObs(profile.playValue, l.key, l.dv / PLAY_VALUE_SCALE);
    profile.totals.plays++;
  }
  (rec.bases || []).forEach((base, seat) => {
    const sc = placeScore(place[seat] != null ? place[seat] : n, n);
    const f = baseFeatures(base);
    for (const c of f.cards) profileMod.addObs(profile.cardValue, c, sc);
    if (!profile.dealtValue) profile.dealtValue = {};
    for (const c of new Set([...(base.dealt || []), ...(base.ejected || [])])) profileMod.addObs(profile.dealtValue, c, sc);
    for (const k of f.pairs) profileMod.addObs(profile.pairValue, k, sc);
    // Behalten/Recyceln: jede Entscheidung samt Kontext-Merkmalen lernt aus dem Ergebnis des Sitzes
    if (base.keepLog && base.keepLog.length) {
      const KM = require('./keepmodel');
      if (!profile.keepModel) profile.keepModel = KM.newModel();
      for (const d of base.keepLog) KM.update(profile.keepModel, d.f, d.a, sc);
    }
    const per = profile.personas.find(p => p.id === personaIds[seat]);
    if (per) { per.games++; per.scoreSum += sc; per.fitness = fitnessOf(per); }
  });
}

/** Tabellen klein halten: seltene Paare fallen heraus. */
function prune(profile, maxPairs = 150000) {
  if (profile.keepModel) require('./keepmodel').prune(profile.keepModel);
  const keys = Object.keys(profile.pairValue);
  if (keys.length <= maxPairs) return;
  const sorted = keys.map(k => [k, profile.pairValue[k].n]).sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < keys.length - maxPairs; i++) delete profile.pairValue[sorted[i][0]];
}

// ── Worker-Pool ────────────────────────────────────────────────────
// Jede Partie läuft in einem Worker-Thread: eine Karte mit Endlosschleife legt dann nur diesen Worker lahm — der Pool
// beendet ihn nach `timeoutMs` und startet einen frischen. Mehrere Worker spielen parallel.
class WorkerPool {
  constructor(size, timeoutMs) {
    this.size = Math.max(1, size | 0);
    this.timeoutMs = timeoutMs || 240000;
    this.idle = [];            // bereite Worker
    this.waiting = [];         // wartende Aufträge
    this.nextId = 1;
    this.closed = false;
    this.count = 0;            // lebende Worker
  }

  _spawn() {
    const { Worker } = require('worker_threads');
    const w = new Worker(require('path').join(__dirname, 'worker.js'), { resourceLimits: { maxOldGenerationSizeMb: 2048 } });
    this.count++;
    w._ready = false; w._pool = this;
    w.on('message', (m) => { if (m && m.ready) { w._ready = true; this._dispatch(); } });
    w.on('error', (e) => { if (w._job) { const j = w._job; w._job = null; clearTimeout(j.timer); j.reject(e); } });
    w.on('exit', () => {
      this.count--;
      this.idle = this.idle.filter(x => x !== w);
      if (w._job) { const j = w._job; w._job = null; clearTimeout(j.timer); j.reject(new Error('Worker beendet')); }
      if (!this.closed && this.waiting.length) this._ensureWorkers();
    });
    return w;
  }

  _ensureWorkers() {
    const wanted = Math.min(this.size, this.count + this.waiting.length);
    while (this.count < wanted) this.idle.push(this._spawn());
  }

  _dispatch() {
    while (this.waiting.length) {
      const w = this.idle.find(x => x._ready && !x._job);
      if (!w) break;
      const job = this.waiting.shift();
      w._job = job;
      job.timer = setTimeout(() => { job.reject(new Error('Zeitüberschreitung')); w._job = null; w.terminate(); }, this.timeoutMs);
      w.once('message', function onMsg(m) {
        if (!m || m.id !== job.id) { w.once('message', onMsg); return; }
        clearTimeout(job.timer); w._job = null;
        if (m.ok) job.resolve(m.rec); else job.reject(new Error(m.error));
        w._pool._dispatch();
      });
      w.postMessage({ id: job.id, opts: job.opts });
    }
  }

  /** Eine Partie spielen lassen. Wirft bei Fehler oder Zeitüberschreitung. */
  run(opts) {
    return new Promise((resolve, reject) => {
      this.waiting.push({ id: this.nextId++, opts, resolve, reject });
      this._ensureWorkers();
      this._dispatch();
    });
  }

  close() {
    this.closed = true;
    for (const w of this.idle) w.terminate();
    this.idle = [];
  }
}

// ── Eine Trainings-Partie ──────────────────────────────────────────
function pickSeatCount(opts, rng) {
  if (opts.seats && typeof opts.seats === 'number') return opts.seats;
  const [lo, hi] = opts.seats || [2, 8];
  // Mittlere Tischgrößen kommen öfter vor als die Extreme.
  const bag = [];
  for (let s = lo; s <= hi; s++) { const mid = (lo + hi) / 2; const wgt = 1 + Math.round(3 - Math.abs(s - mid)); for (let k = 0; k < Math.max(1, wgt); k++) bag.push(s); }
  return bag[Math.floor(rng() * bag.length)];
}

async function playOne(profile, opts = {}, rng = Math.random, pool = null) {
  const n = pickSeatCount(opts, rng);
  const chosen = Array.from({ length: n }, () => pickPersona(profile, rng));
  const simOpts = { seats: n, weights: chosen.map(p => p.weights), record: true, maxTurns: opts.maxTurns || 3000, watchdogMs: opts.watchdogMs };
  const rec = pool ? await pool.run(simOpts) : await require('../sim').runGame(simOpts);
  if (rec.reason === 'sim_turn_limit') rec.placements = null;      // nicht zu Ende gespielt: keine Wertung
  return { rec, n, personaIds: chosen.map(p => p.id) };
}

// ── Vergleichsspiele: trainiert gegen untrainiert ───────────────────
function bestPersona(profile) {
  return [...(profile.personas || [])].sort((a, b) => fitnessOf(b) - fitnessOf(a))[0] || null;
}

/**
 * Einzelne Testspiele: EIN trainierter Sitz (Profil + beste Persona) gegen untrainierte Standard-Bots
 * (Standard-Gewichte, ohne Profil) an Tischen mit 2, 3, 4 und 6 Sitzen. Jedes Spiel wird einzeln festgehalten;
 * der Verlauf liegt in `<profil>.bench.jsonl` (ranking.readBench). Erwartung ohne Vorsprung: Siegquote 1/Sitze.
 */
async function benchmark(profile, pool, opts = {}) {
  const rng = opts.rng || Math.random;
  const best = bestPersona(profile);
  const seatsList = opts.seatCounts || [2, 3, 4, 6];
  const total = opts.games || 40;
  const jobs = Array.from({ length: total }, (_, i) => { const n = seatsList[i % seatsList.length]; return { n, seat: Math.floor(rng() * n) }; });
  const one = async (j) => {
    const simOpts = {
      seats: j.n, maxTurns: opts.maxTurns || 3000, reloadProfile: true,
      weights: Array.from({ length: j.n }, (_, i) => (i === j.seat && best ? best.weights : null)),
      noProfileSeats: Array.from({ length: j.n }, (_, i) => i).filter(i => i !== j.seat),
    };
    try {
      const rec = pool ? await pool.run(simOpts) : await require('../sim').runGame(simOpts);
      if (!rec || !rec.placements || rec.reason === 'sim_turn_limit') return null;
      return { seats: j.n, seat: j.seat, place: rec.placements[j.seat], won: rec.winnerIdx === j.seat, rounds: rec.rounds, score: placeScore(rec.placements[j.seat], j.n) };
    } catch { return null; }
  };
  const results = (await Promise.all(jobs.map(one))).filter(Boolean);
  const agg = {};
  for (const r of results) {
    const a = agg[r.seats] || (agg[r.seats] = { seats: r.seats, games: 0, wins: 0, scoreSum: 0 });
    a.games++; a.wins += r.won ? 1 : 0; a.scoreSum += r.score;
  }
  const bySeats = Object.values(agg).sort((a, b) => a.seats - b.seats).map(a => ({
    seats: a.seats, games: a.games, wins: a.wins, winRate: a.wins / a.games, expectedWinRate: 1 / a.seats, meanPlaceScore: a.scoreSum / a.games,
  }));
  const wins = results.filter(r => r.won).length;
  const expected = results.reduce((s, r) => s + 1 / r.seats, 0);
  const variance = results.reduce((s, r) => s + (1 / r.seats) * (1 - 1 / r.seats), 0);
  const rec = {
    t: Date.now(), trainedGames: profile.games || 0, version: profile.version || 0, persona: best && best.name,
    total: {
      games: results.length, wins, winRate: results.length ? wins / results.length : 0,
      expectedWinRate: results.length ? expected / results.length : 0,
      edge: results.length ? (wins - expected) / results.length : 0,
      z: variance > 0 ? (wins - expected) / Math.sqrt(variance) : 0,
      meanPlaceScore: results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0,
    },
    bySeats,
    games: results.map(r => ({ seats: r.seats, seat: r.seat, place: r.place, won: r.won, rounds: r.rounds })),
  };
  ranking.appendBench(rec);
  return rec;
}

/**
 * Trainieren. opts: { games, seats (Zahl oder [min,max]), evolveEvery, saveEvery, profile, onGame, shouldStop, dutyCycle, quiet }
 * Gibt das (gespeicherte) Profil zurück.
 */
async function train(opts = {}) {
  const rng = opts.rng || Math.random;
  const profile = opts.profile || profileMod.load();
  seedPopulation(profile, rng);
  const total = opts.games == null ? Infinity : opts.games;
  const evolveEvery = opts.evolveEvery || 150;
  const saveEvery = opts.saveEvery || 25;
  const workers = opts.workers == null ? 1 : opts.workers;
  const pool = workers > 0 ? new WorkerPool(workers, opts.gameTimeoutMs) : null;
  const benchEvery = opts.benchEvery == null ? 300 : opts.benchEvery;      // 0 = keine Vergleichsspiele
  const benchGames = opts.benchGames || 40;
  const rankingEvery = opts.rankingEvery || 100;                           // Prüfpunkt für den Verlauf der Kartenwerte
  let done = 0, failed = 0, started = 0, benchRunning = false, lastStatus = 0;
  const t0 = Date.now();

  const runBench = async () => {
    if (benchRunning || !benchEvery) return;
    benchRunning = true;
    try {
      profileMod.save(profile);                                           // Worker sehen den aktuellen Stand
      const rec = await benchmark(profile, pool, { games: benchGames, rng });
      if (!opts.quiet) console.log(`[skilltest-train] Vergleich nach ${rec.trainedGames} Partien: Siegquote ${(rec.total.winRate * 100).toFixed(1)} % (Erwartung ${(rec.total.expectedWinRate * 100).toFixed(1)} %), z=${rec.total.z.toFixed(2)}`);
    } catch (e) { if (!opts.quiet) console.error('[skilltest-train] Vergleich fehlgeschlagen:', e && e.message); }
    finally { benchRunning = false; }
  };
  if (benchEvery && (profile.games || 0) === 0 && opts.benchAtStart !== false) await runBench();   // Ausgangspunkt: noch nichts gelernt

  const runner = async () => {
    while (started < total && !(opts.shouldStop && opts.shouldStop())) {
      started++;
      const g0 = Date.now();
      try {
        const game = await playOne(profile, opts, rng, pool);
        if (game.rec && game.rec.placements) { learnFrom(profile, game); done++; } else failed++;
      } catch (e) { failed++; if (!opts.quiet) console.error('[skilltest-train] Partie fehlgeschlagen:', e && e.message); }
      if (done > 0 && done % evolveEvery === 0) evolve(profile, rng);
      if (done > 0 && done % saveEvery === 0) { prune(profile); profileMod.save(profile); ranking.writeRanking(profile, { checkpoint: done % rankingEvery === 0 }); }
      if (benchEvery && done > 0 && done % benchEvery === 0) await runBench();
      if (Date.now() - lastStatus > 5000) { lastStatus = Date.now(); ranking.writeStatus({ pid: process.pid, startedAt: t0, session: done, failed, games: profile.games, ratePerMin: Math.round(done / Math.max(1, (Date.now() - t0) / 60000)) }); }
      if (opts.onGame) opts.onGame({ done, failed, profile });
      // Last begrenzen: nach jeder Partie so lange ruhen, dass der Rechenanteil `dutyCycle` bleibt.
      if (opts.dutyCycle && opts.dutyCycle > 0 && opts.dutyCycle < 1) {
        const busy = Date.now() - g0;
        await new Promise(r => setTimeout(r, Math.round(busy * (1 / opts.dutyCycle - 1))));
      } else await new Promise(r => setImmediate(r));
    }
  };
  try { await Promise.all(Array.from({ length: Math.max(1, workers) }, runner)); }
  finally { if (pool) pool.close(); }
  prune(profile);
  profileMod.save(profile);
  ranking.writeRanking(profile, { checkpoint: true });
  if (!opts.quiet) console.log(`[skilltest-train] ${done} Partien gelernt (${failed} verworfen) in ${Math.round((Date.now() - t0) / 1000)} s — Profil v${profile.version}, ${Object.keys(profile.playValue).length} Spielwerte, ${Object.keys(profile.cardValue).length} Kartenwerte, ${Object.keys(profile.pairValue).length} Paare`);
  return profile;
}

/**
 * Vergleichslauf: Sitz 0 spielt mit gelerntem Profil + bester Persona gegen Gegner ohne Profil mit Standard-Gewichten.
 * Liefert die mittlere Platzierungsgüte von Sitz 0 (0 = erwartet, > 0 = besser als Zufall).
 */
async function evaluate(opts = {}) {
  const profile = profileMod.load();
  const best = [...(profile.personas || [])].sort((a, b) => fitnessOf(b) - fitnessOf(a))[0];
  const rng = opts.rng || Math.random;
  const workers = opts.workers == null ? 1 : opts.workers;
  const pool = workers > 0 ? new WorkerPool(workers, opts.gameTimeoutMs) : null;
  let sum = 0, cnt = 0, wins = 0, started = 0;
  const total = opts.games || 50;
  const runner = async () => {
    while (started < total) {
      started++;
      const n = typeof opts.seats === 'number' ? opts.seats : 4;
      const seat = Math.floor(rng() * n);
      const mode = opts.mode || 'full';          // 'full' = Profil + beste Persona, 'profile' = nur Profil, 'persona' = nur beste Persona
      const simOpts = {
        seats: n, maxTurns: opts.maxTurns || 3000,
        weights: Array.from({ length: n }, (_, i) => (i === seat && best && mode !== 'profile' ? best.weights : null)),
        noProfileSeats: Array.from({ length: n }, (_, i) => i).filter(i => i !== seat || mode === 'persona'),
      };
      let rec = null;
      try { rec = pool ? await pool.run(simOpts) : await require('../sim').runGame(simOpts); } catch { rec = null; }
      if (!rec || !rec.placements || rec.reason === 'sim_turn_limit') continue;
      sum += placeScore(rec.placements[seat], n); cnt++;
      if (rec.winnerIdx === seat) wins++;
    }
  };
  try { await Promise.all(Array.from({ length: Math.max(1, workers) }, runner)); }
  finally { if (pool) pool.close(); }
  return { games: cnt, meanPlaceScore: cnt ? sum / cnt : 0, winRate: cnt ? wins / cnt : 0, persona: best && best.name, mode: opts.mode || 'full' };
}

/**
 * Kompakte Fassung zum Einchecken/Ausliefern: seltene Beobachtungen fallen heraus, Mittelwerte werden gerundet.
 * `minN`: Mindestzahl Beobachtungen je Eintrag.
 */
function exportCompact(profile, minN = 4) {
  const keep = (table, n) => {
    const out = {};
    for (const [k, e] of Object.entries(table || {})) if (e.n >= n) out[k] = { n: e.n, sum: Math.round(e.sum * 1000) / 1000 };
    return out;
  };
  return {
    version: profile.version, games: profile.games, updated: profile.updated,
    playValue: keep(profile.playValue, minN), cardValue: keep(profile.cardValue, minN), dealtValue: keep(profile.dealtValue, minN), pairValue: keep(profile.pairValue, Math.max(minN, 6)),
    keepModel: profile.keepModel ? require('./keepmodel').compact(profile.keepModel) : null,
    personas: profile.personas, totals: profile.totals,
  };
}

module.exports = { benchmark, bestPersona, exportCompact, WorkerPool, train, evaluate, learnFrom, baseFeatures, placeScore, seedPopulation, evolve, pickPersona, playOne, PLAY_VALUE_SCALE };
