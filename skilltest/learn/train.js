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

// ── Nutzung behaltener Karten ──────────────────────────────────────
const USAGE_TYPES = new Set(['Spell', 'Attack', 'Creature', 'Artifact', 'Potion', 'Ability']);

/**
 * Wurde eine behaltene Handkarte im Kampf auch gespielt? `profile.usage[Karte]` zählt behaltene Exemplare und gespielte (n, sum), `profile.usageClass`
 * dasselbe je Typ und Nutzbarkeit beim Aufbau (`Spell:now`, `Spell:no` …) sowie je Typ (`*:Spell`). Daraus liest der Behalten/Recyceln-Entscheider
 * (keepmodel.usagePrior), welche Karten tatsächlich zum Zug kommen. Reaktionen/Surprises zählen nicht (sie werden nicht als Zug „gespielt").
 */
function learnUsage(profile, keepLog, learnLog, seat) {
  const db = require('../../cards/effects/_card-db').getCardDB();
  const played = new Set();
  for (const l of learnLog || []) if (l.seat === seat && l.key) played.add(l.key.slice(l.key.indexOf(':') + 1));
  if (!profile.usage) profile.usage = {};
  if (!profile.usageClass) profile.usageClass = {};
  for (const d of keepLog) {
    if (d.a !== 1) continue;                                             // nur behaltene Karten
    const c = db[d.c];
    const sub = c && (c.subtype || '').toLowerCase();
    if (!c || !USAGE_TYPES.has(c.cardType) || !(sub === 'normal' || sub === '' || sub === 'equipment' || sub === 'area' || sub === 'attachment' || sub === 'creature')) continue;
    const used = played.has(d.c) ? 1 : 0;
    profileMod.addObs(profile.usage, d.c, used);
    profileMod.addObs(profile.usageClass, c.cardType + ':' + (d.u || '-'), used);
    profileMod.addObs(profile.usageClass, '*:' + c.cardType, used);
  }
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
  // Kanal „Wann Mulligans durchführen?“: Ergebnis des Sitzes je Mulligan-Entscheidung (mulligan.js)
  if (rec.mullLog && rec.mullLog.length) require('../mulligan').learn(profile, rec.mullLog, (seat) => placeScore(place[seat] != null ? place[seat] : n, n));
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
      if (!profile.prepValue) profile.prepValue = {};
      for (const d of base.keepLog) {
        if (d.x !== 1 && Number.isFinite(d.d)) {                         // Bewertung der CPU beim Aufbau (ohne erkundete Fälle)
          const e = profile.prepValue[d.c] || (profile.prepValue[d.c] = { n: 0, sum: 0, keep: 0 });
          e.n++; e.sum += d.d; if (d.a === 1) e.keep++;
        }
        KM.update(profile.keepModel, d.f, d.a, sc);
      }
      learnUsage(profile, base.keepLog, rec.learnLog, seat);
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
  constructor(size, timeoutMs, memMb) {
    this.size = Math.max(1, size | 0);
    this.timeoutMs = timeoutMs || 240000;
    this.memMb = memMb || 2048;
    this.idle = [];            // bereite Worker
    this.waiting = [];         // wartende Aufträge
    this.nextId = 1;
    this.closed = false;
    this.count = 0;            // lebende Worker
    this.hangs = 0;            // Zeitüberschreitungen (jede mit Ablaufspur in <profil>.hangs.jsonl)
    this.durations = [];       // Dauer der letzten erfolgreichen Partien (ms) — daraus ergibt sich das wirksame Zeitlimit
  }

  /** Wirksames Zeitlimit: ein Vielfaches der üblichen Partiedauer (90. Perzentil), mindestens 60 s, höchstens `timeoutMs`. */
  _timeoutFor() {
    if (this.durations.length < 20) return this.timeoutMs;
    const sorted = [...this.durations].sort((a, b) => a - b);
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    return Math.min(this.timeoutMs, Math.max(60000, 12 * p90));
  }
  _noteDuration(ms) { this.durations.push(ms); if (this.durations.length > 200) this.durations.shift(); }

  _spawn() {
    const { Worker } = require('worker_threads');
    const w = new Worker(require('path').join(__dirname, 'worker.js'), { resourceLimits: { maxOldGenerationSizeMb: this.memMb } });
    this.count++;
    w._ready = false; w._pool = this;
    w.on('message', (m) => {
      if (m && m.ready) { w._ready = true; this._dispatch(); }
      else if (m && m.trace && w._job) { const t = w._job.trace || (w._job.trace = []); t.push(...m.trace); if (t.length > 80) t.splice(0, t.length - 80); }
    });
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
      job.start = Date.now();
      const limit = this._timeoutFor();
      job.timer = setTimeout(() => {
        this.hangs++;
        try { ranking.appendHang({ t: Date.now(), limitMs: limit, seats: job.opts && job.opts.seats, mcts: job.opts && job.opts.mcts, weightsGiven: !!(job.opts && job.opts.weights), trace: job.trace || [] }); } catch { /* Diagnose darf nie stören */ }
        job.reject(new Error('Zeitüberschreitung')); w._job = null; w.terminate();
      }, limit);
      w.once('message', function onMsg(m) {
        if (!m || m.id !== job.id) { w.once('message', onMsg); return; }
        clearTimeout(job.timer); w._job = null;
        if (m.ok) { w._pool._noteDuration(Date.now() - job.start); job.resolve(m.rec); } else job.reject(new Error(m.error));
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

// Mulligan-Quellen, die ohne Ability-Platz von der Hand wirken. Der Kanal „Wann Mulligans?“ (mulligan.js) bräuchte sonst Zehntausende Partien,
// bis eine Quelle zufällig auf einer Hand liegt — im Training bekommt darum ein Teil der Sitze eine Quelle zusätzlich auf die Kampfhand
// (nach dem Aufbau; nur Training, nie im Live-Spiel).
const MULL_SOURCES = ['Horn in a Bottle', 'Staff of the Teleporter'];
const MULL_BOOST = 0.3;

async function playOne(profile, opts = {}, rng = Math.random, pool = null) {
  const n = pickSeatCount(opts, rng);
  const chosen = Array.from({ length: n }, () => pickPersona(profile, rng));
  const simOpts = { seats: n, weights: chosen.map(p => require('../policy').shipped(p.weights)), record: true, maxTurns: opts.maxTurns || 3000, watchdogMs: opts.watchdogMs };
  const boost = opts.mullBoost != null ? opts.mullBoost : MULL_BOOST;
  if (boost > 0) {
    const forceHand = {};
    for (let i = 0; i < n; i++) if (rng() < boost) forceHand[i] = [MULL_SOURCES[Math.floor(rng() * MULL_SOURCES.length)]];
    if (Object.keys(forceHand).length) simOpts.forceHand = forceHand;
  }
  const rec = pool ? await pool.run(simOpts) : await require('../sim').runGame(simOpts);
  if (rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit') rec.placements = null;      // nicht zu Ende gespielt (Patt): keine Wertung
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
      if (!rec || !rec.placements || (rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit')) return null;
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
 * Lookahead-Vergleich: Alle Sitze spielen mit Profil und bester Persona; EIN Sitz sucht zusätzlich mit dem Lookahead (skilltest/mcts.js),
 * die übrigen nicht. So misst sich allein der Beitrag der Suche. Festgehalten wird wie beim Vergleich trainiert/untrainiert
 * (`kind: 'mcts'` in <profil>.bench.jsonl); Erwartung ohne Vorsprung: Siegquote 1/Sitze.
 */
async function benchmarkLookahead(profile, pool, opts = {}) {
  const rng = opts.rng || Math.random;
  const best = bestPersona(profile);
  const seatsList = opts.seatCounts || [2, 3, 4];
  const total = opts.games || 40;
  const jobs = Array.from({ length: total }, (_, i) => { const n = seatsList[i % seatsList.length]; return { n, seat: Math.floor(rng() * n) }; });
  const one = async (j) => {
    const simOpts = {
      seats: j.n, maxTurns: opts.maxTurns || 3000, reloadProfile: true,
      weights: Array.from({ length: j.n }, () => (best ? best.weights : null)),
      mcts: [j.seat], mctsCfg: { MAX_MS: 0 },
    };
    try {
      const rec = pool ? await pool.run(simOpts) : await require('../sim').runGame(simOpts);
      if (!rec || !rec.placements || (rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit')) return null;
      return { seats: j.n, seat: j.seat, place: rec.placements[j.seat], won: rec.winnerIdx === j.seat, rounds: rec.rounds, score: placeScore(rec.placements[j.seat], j.n) };
    } catch { return null; }
  };
  const results = (await Promise.all(jobs.map(one))).filter(Boolean);
  const wins = results.filter(r => r.won).length;
  const expected = results.reduce((s, r) => s + 1 / r.seats, 0);
  const variance = results.reduce((s, r) => s + (1 / r.seats) * (1 - 1 / r.seats), 0);
  const rec = {
    kind: 'mcts', t: Date.now(), trainedGames: profile.games || 0, version: profile.version || 0, persona: best && best.name,
    total: {
      games: results.length, wins, winRate: results.length ? wins / results.length : 0,
      expectedWinRate: results.length ? expected / results.length : 0,
      edge: results.length ? (wins - expected) / results.length : 0,
      z: variance > 0 ? (wins - expected) / Math.sqrt(variance) : 0,
      meanPlaceScore: results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0,
    },
  };
  ranking.appendBench(rec);
  return rec;
}

/**
 * Trainieren. opts: { games, seats (Zahl oder [min,max]), evolveEvery, saveEvery, profile, onGame, shouldStop, dutyCycle, quiet,
 *   workers, gameTimeoutMs, workerMemMb, benchEvery, benchGames, mctsBenchEvery, mctsBenchGames, progressEverySec, maxMinutes,
 *   checkpointMinutes }
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
  const pool = workers > 0 ? new WorkerPool(workers, opts.gameTimeoutMs, opts.workerMemMb) : null;
  const benchEvery = opts.benchEvery == null ? 300 : opts.benchEvery;      // 0 = keine Vergleichsspiele
  const mctsBenchEvery = opts.mctsBenchEvery || 0;                         // 0 = keine Lookahead-Vergleiche (kosten viel Rechenzeit)
  const mctsBenchGames = opts.mctsBenchGames || 40;
  const benchGames = opts.benchGames || 40;
  const rankingEvery = opts.rankingEvery || 100;                           // Prüfpunkt für den Verlauf der Kartenwerte
  const milestoneEvery = opts.milestoneEvery || 0;                         // 0 = keine Meilenstein-Berichte (Kartenliste je N Partien, siehe learn/milestones.js)
  let lastMilestone = Math.floor((profile.games || 0) / (milestoneEvery || 1));
  const doMilestone = (final) => {
    try {
      const m = require('./milestones').writeMilestone(profile, { final });
      if (m && !opts.quiet) console.log(`[skilltest-train] Meilenstein ${m.games} Partien: ${m.mdFile}`);
    } catch (e) { console.error('[skilltest-train] Meilenstein-Bericht fehlgeschlagen (Lauf geht weiter):', e && e.stack || e); }
  };
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

  let mctsBenchRunning = false;
  const runMctsBench = async () => {
    if (mctsBenchRunning || !mctsBenchEvery) return;
    mctsBenchRunning = true;
    try {
      profileMod.save(profile);
      const rec = await benchmarkLookahead(profile, pool, { games: mctsBenchGames, rng });
      if (!opts.quiet) console.log(`[skilltest-train] Lookahead-Vergleich nach ${rec.trainedGames} Partien: Siegquote ${(rec.total.winRate * 100).toFixed(1)} % (Erwartung ${(rec.total.expectedWinRate * 100).toFixed(1)} %), z=${rec.total.z.toFixed(2)}`);
    } catch (e) { if (!opts.quiet) console.error('[skilltest-train] Lookahead-Vergleich fehlgeschlagen:', e && e.message); }
    finally { mctsBenchRunning = false; }
  };

  // Sicherungen für lange Läufe: das Profil vor dem ersten Speichern ablegen (<profil>.bak) und alle `checkpointMinutes` eine Kopie
  // (<profil>.ckpt-<Zeit>.json, die letzten 4 bleiben).
  const fs = require('fs');
  try { const f = profileMod.FILE(); if (fs.existsSync(f) && !fs.existsSync(f + '.bak')) fs.copyFileSync(f, f + '.bak'); } catch { /* egal */ }
  let lastCkpt = Date.now();
  const checkpoint = () => {
    if (!opts.checkpointMinutes || Date.now() - lastCkpt < opts.checkpointMinutes * 60000) return;
    lastCkpt = Date.now();
    try {
      const f = profileMod.FILE(), dir = require('path').dirname(f), base = require('path').basename(f, '.json');
      fs.copyFileSync(f, require('path').join(dir, `${base}.ckpt-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16)}.json`));
      const old = fs.readdirSync(dir).filter(n => n.startsWith(base + '.ckpt-')).sort();
      for (const n of old.slice(0, Math.max(0, old.length - 4))) fs.unlinkSync(require('path').join(dir, n));
    } catch (e) { if (!opts.quiet) console.error('[skilltest-train] Sicherung fehlgeschlagen:', e && e.message); }
  };
  const overTime = () => !!opts.maxMinutes && Date.now() - t0 > opts.maxMinutes * 60000;
  const stopNow = () => overTime() || !!(opts.shouldStop && opts.shouldStop());
  let lastProgress = Date.now();

  const runner = async () => {
    while (started < total && !stopNow()) {
      started++;
      const g0 = Date.now();
      try {
        const game = await playOne(profile, opts, rng, pool);
        if (game.rec && game.rec.placements) { learnFrom(profile, game); done++; }
        else {
          failed++;
          // Ursache festhalten (Rundenlimit-Patt? hängende Aktion?): eine Zeile je verworfene Partie in <profil>.discards.jsonl.
          if (game.rec && game.rec.diag) { try { fs.appendFileSync(ranking.files().discards, JSON.stringify(Object.assign({ t: Date.now(), games: profile.games }, game.rec.diag)) + '\n', { encoding: 'utf-8' }); } catch { /* Diagnose darf nie stören */ } }
        }
      } catch (e) { failed++; if (!opts.quiet) console.error('[skilltest-train] Partie fehlgeschlagen:', e && e.message); }
      try {
        if (done > 0 && done % evolveEvery === 0) evolve(profile, rng);
        if (done > 0 && done % saveEvery === 0) { prune(profile); profileMod.save(profile); ranking.writeRanking(profile, { checkpoint: done % rankingEvery === 0 }); checkpoint(); }
        if (milestoneEvery && Math.floor(profile.games / milestoneEvery) > lastMilestone) { lastMilestone = Math.floor(profile.games / milestoneEvery); prune(profile); profileMod.save(profile); doMilestone(false); }
        if (benchEvery && done > 0 && done % benchEvery === 0) await runBench();
        if (mctsBenchEvery && done > 0 && done % mctsBenchEvery === 0) await runMctsBench();
      } catch (e) { console.error('[skilltest-train] Speichern/Auswertung fehlgeschlagen (Lauf geht weiter):', e && e.message); }
      if (opts.progressEverySec && Date.now() - lastProgress > opts.progressEverySec * 1000) {
        lastProgress = Date.now();
        const mins = Math.max(0.01, (Date.now() - t0) / 60000);
        console.log(`[skilltest-train] ${new Date().toISOString().slice(0, 19)}  Sitzung ${done} Partien (${Math.round(done / mins)}/min), gesamt ${profile.games}, verworfen ${failed}, Hänger ${pool ? pool.hangs : 0}, Profil v${profile.version}`);
      }
      if (Date.now() - lastStatus > 5000) { lastStatus = Date.now(); ranking.writeStatus({ pid: process.pid, startedAt: t0, session: done, failed, hangs: pool ? pool.hangs : 0, games: profile.games, ratePerMin: Math.round(done / Math.max(1, (Date.now() - t0) / 60000)) }); }
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
  if (milestoneEvery && done > 0) doMilestone(true);                      // Abschlussbericht des Laufs
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
      if (!rec || !rec.placements || (rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit')) continue;
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
  // Karten, die nicht (mehr) im Pool sind (später gesperrt), kommen nicht ins ausgelieferte Profil.
  let inPool = null;
  try { inPool = require('./milestones').poolNames(); } catch { /* ohne Filter */ }
  const cardOf = (k) => { const i = k.indexOf(':'); return i < 0 ? k : k.slice(i + 1); };
  const allowed = (k) => !inPool || k.split('|').every(part => inPool.has(cardOf(part)) || inPool.has(part));
  const keep = (table, n) => {
    const out = {};
    for (const [k, e] of Object.entries(table || {})) if (e.n >= n && allowed(k)) out[k] = { n: e.n, sum: Math.round(e.sum * 1000) / 1000 };
    return out;
  };
  return {
    version: profile.version, games: profile.games, updated: profile.updated,
    playValue: keep(profile.playValue, minN), cardValue: keep(profile.cardValue, minN), dealtValue: keep(profile.dealtValue, minN), pairValue: keep(profile.pairValue, Math.max(minN, 6)),
    prepValue: Object.fromEntries(Object.entries(profile.prepValue || {}).filter(([k, e]) => e.n >= minN && allowed(k)).map(([k, e]) => [k, { n: e.n, sum: Math.round(e.sum * 1000) / 1000, keep: e.keep }])),
    keepModel: profile.keepModel ? require('./keepmodel').compact(profile.keepModel) : null,
    usage: keep(profile.usage, minN), usageClass: profile.usageClass || {},
    mull: profile.mull || {}, mullX: profile.mullX || {},
    personas: profile.personas, totals: profile.totals,
  };
}

module.exports = { benchmark, benchmarkLookahead, bestPersona, exportCompact, WorkerPool, train, evaluate, learnFrom, learnUsage, baseFeatures, placeScore, seedPopulation, evolve, pickPersona, playOne, PLAY_VALUE_SCALE };
