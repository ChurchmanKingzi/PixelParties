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
    for (const k of f.pairs) profileMod.addObs(profile.pairValue, k, sc);
    const per = profile.personas.find(p => p.id === personaIds[seat]);
    if (per) { per.games++; per.scoreSum += sc; per.fitness = fitnessOf(per); }
  });
}

/** Tabellen klein halten: seltene Paare fallen heraus. */
function prune(profile, maxPairs = 150000) {
  const keys = Object.keys(profile.pairValue);
  if (keys.length <= maxPairs) return;
  const sorted = keys.map(k => [k, profile.pairValue[k].n]).sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < keys.length - maxPairs; i++) delete profile.pairValue[sorted[i][0]];
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

async function playOne(profile, opts = {}, rng = Math.random) {
  const { runGame } = require('../sim');
  const n = pickSeatCount(opts, rng);
  const chosen = Array.from({ length: n }, () => pickPersona(profile, rng));
  const rec = await runGame({ seats: n, weights: chosen.map(p => p.weights), record: true, maxTurns: opts.maxTurns || 3000, watchdogMs: opts.watchdogMs });
  if (rec.reason === 'sim_turn_limit') rec.placements = null;      // nicht zu Ende gespielt: keine Wertung
  return { rec, n, personaIds: chosen.map(p => p.id) };
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
  let done = 0, failed = 0;
  const t0 = Date.now();
  while (done + failed < total && !(opts.shouldStop && opts.shouldStop())) {
    const g0 = Date.now();
    try {
      const game = await playOne(profile, opts, rng);
      if (game.rec && game.rec.placements) { learnFrom(profile, game); done++; } else failed++;
    } catch (e) { failed++; if (!opts.quiet) console.error('[skilltest-train] Partie fehlgeschlagen:', e && e.message); }
    if (done > 0 && done % evolveEvery === 0) evolve(profile, rng);
    if (done > 0 && done % saveEvery === 0) { prune(profile); profileMod.save(profile); }
    if (opts.onGame) opts.onGame({ done, failed, profile });
    // Last begrenzen: nach jeder Partie so lange ruhen, dass der Rechenanteil `dutyCycle` bleibt.
    if (opts.dutyCycle && opts.dutyCycle > 0 && opts.dutyCycle < 1) {
      const busy = Date.now() - g0;
      await new Promise(r => setTimeout(r, Math.round(busy * (1 / opts.dutyCycle - 1))));
    } else await new Promise(r => setImmediate(r));
  }
  prune(profile);
  profileMod.save(profile);
  if (!opts.quiet) console.log(`[skilltest-train] ${done} Partien gelernt (${failed} verworfen) in ${Math.round((Date.now() - t0) / 1000)} s — Profil v${profile.version}, ${Object.keys(profile.playValue).length} Spielwerte, ${Object.keys(profile.cardValue).length} Kartenwerte, ${Object.keys(profile.pairValue).length} Paare`);
  return profile;
}

/**
 * Vergleichslauf: Sitz 0 spielt mit gelerntem Profil + bester Persona gegen Gegner ohne Profil mit Standard-Gewichten.
 * Liefert die mittlere Platzierungsgüte von Sitz 0 (0 = erwartet, > 0 = besser als Zufall).
 */
async function evaluate(opts = {}) {
  const { runGame } = require('../sim');
  const profile = profileMod.load();
  const best = [...(profile.personas || [])].sort((a, b) => fitnessOf(b) - fitnessOf(a))[0];
  const rng = opts.rng || Math.random;
  let sum = 0, cnt = 0, wins = 0;
  for (let g = 0; g < (opts.games || 50); g++) {
    const n = typeof opts.seats === 'number' ? opts.seats : 4;
    const seat = Math.floor(rng() * n);
    const weights = Array.from({ length: n }, (_, i) => (i === seat && best ? best.weights : null));
    const noProfile = Array.from({ length: n }, (_, i) => i).filter(i => i !== seat);
    const rec = await runGame({ seats: n, weights, noProfileSeats: noProfile, maxTurns: opts.maxTurns || 3000 });
    if (!rec.placements) continue;
    sum += placeScore(rec.placements[seat], n); cnt++;
    if (rec.winnerIdx === seat) wins++;
  }
  return { games: cnt, meanPlaceScore: cnt ? sum / cnt : 0, winRate: cnt ? wins / cnt : 0, persona: best && best.name };
}

module.exports = { train, evaluate, learnFrom, baseFeatures, placeScore, seedPopulation, evolve, pickPersona, playOne, PLAY_VALUE_SCALE };
