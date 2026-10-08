'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — GEPAARTER VERGLEICH AUF SIEG
//
//  Misst, ob eine Spielweise (Gewichte der Policy, Lookahead an/aus) öfter GEWINNT als eine andere. Gepaart heißt:
//  für jeden Seed werden Tisch, Austeilung, Aufbau und Sitzplatz festgelegt (geseedete Partien, siehe sim.js),
//  und nur der EINE Sitz („Fokus-Sitz") spielt je Variante anders; alle anderen Sitze spielen mit Standard-Gewichten
//  (mit Profil, wie im Live-Spiel). Der Unterschied zweier Varianten wird so nicht von der Austeilung überlagert —
//  die Austeilung (Helden, Karten) ist der größte Rauschfaktor des Modus.
//
//  Zielgröße ist der Sieg (1/0). Platzierungsgüte läuft als Nebenmaß mit.
//
//  Nur Kampfgewichte in den Varianten ändern (nicht keepCards/keepBias/heroHp/heroAtk), sonst baut der Fokus-Sitz anders auf
//  und die Paarung geht verloren. `battleOnly()` filtert das.
// ═══════════════════════════════════════════════════════════════════
const { mulberry32 } = require('../sim');

/** Gewichte, die den Aufbau (Vorbereitung) verändern — in Kampf-Vergleichen tabu. */
const PREP_KEYS = ['keepCards', 'keepBias', 'heroHp', 'heroAtk'];
const battleOnly = (w) => { const o = { ...(w || {}) }; for (const k of PREP_KEYS) delete o[k]; return o; };

/**
 * Tisch zu einem Seed: Sitzzahl und Fokus-Sitz (gleichmäßig 2 … maxSeats; bei Listen aus `seatCounts`).
 */
function tableFor(seed, opts = {}) {
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const counts = opts.seatCounts || [2, 3, 4, 5, 6, 7, 8];
  const n = counts[Math.floor(rnd() * counts.length)];
  return { seats: n, seat: Math.floor(rnd() * n) };
}

/**
 * Die Persona eines Sitzes zu einem Seed (wie im Live-Spiel: aus der Population des Profils gezogen, bessere öfter) — hier aus dem Seed
 * abgeleitet, damit Fokus-Sitz UND Gegner in beiden Varianten dieselben Spielstile haben. `null` ohne Profil.
 */
function personaFor(seed, seat, raw) {
  const L = require('./profile');
  const rnd = mulberry32(((seed * 2654435761) ^ (seat * 40503 + 0x51ed270b)) >>> 0);
  const per = L.samplePersona(L.get(), rnd);
  if (!per) return null;
  // Standard: wie im Live-Spiel, mit der ausgelieferten Zielwahl (policy.shipped); `raw` = die Persona unverändert (Vergleiche mit dem Stand davor).
  return raw ? per.weights : require('../policy').shipped(per.weights);
}

/** Ein Partieauftrag (für WorkerPool.run / runGame) zu Seed und Variante. */
function jobFor(seed, variant, opts = {}) {
  const t = tableFor(seed, opts);
  // Fokus-Sitz: `variant.weights`; alle anderen: `variant.oppWeights` (Standard: keine = Standard-Policy). So lässt sich auch prüfen, ob die Standard-Policy
  // gegen eine Gegnerschaft aus dem Kandidaten verliert (der Kandidat also nicht nur gegen die Standard-Bots gewinnt).
  //
  // `variant.persona`: Persona-Basis wie im Live-Spiel. Der Fokus-Sitz spielt SEINE Persona (aus dem Seed), `variant.weights` überschreibt nur
  // die Kampfgewichte darauf (der Aufbau bleibt der der Persona, die Paarung bleibt erhalten); jeder Gegner spielt ebenfalls seine Persona
  // (aus dem Seed), `variant.oppWeights` überschreibt auch dort nur Kampfgewichte („was, wenn wir das an alle CPUs ausliefern?").
  // Ohne `persona` gilt die alte Messung: Fokus-Sitz = Standardgewichte, Gegner = zufällige Live-Personas.
  const weights = Array.from({ length: t.seats }, (_, i) => {
    const focal = i === t.seat;
    if (variant.persona) {
      const base = personaFor(seed, i, variant.persona === 'raw') || {};
      const over = focal ? variant.weights : variant.oppWeights;
      return Object.assign({}, base, over ? battleOnly(over) : {});
    }
    if (focal) return battleOnly(variant.weights);
    return variant.oppWeights ? battleOnly(variant.oppWeights) : null;
  });
  const job = {
    seats: t.seats, seed, weights, maxTurns: opts.maxTurns || 1200,
    mcts: variant.mcts ? [t.seat] : false,
  };
  if (variant.mctsCfg) job.mctsCfg = variant.mctsCfg;
  if (opts.noProfile) job.noProfileSeats = Array.from({ length: t.seats }, (_, i) => i);
  return { job, table: t };
}

const placeScore = (place, n) => (n <= 1 ? 0 : 1 - 2 * (place - 1) / (n - 1));

/** Eine Variante über alle Seeds spielen; Ergebnis je Seed (null bei Fehler/Patt). Reihenfolge wie `seeds`. */
async function runVariant(pool, variant, seeds, opts = {}) {
  const run = pool ? (j) => pool.run(j) : (j) => require('../sim').runGame(j);
  const out = await Promise.all(seeds.map(async (seed) => {
    const { job, table } = jobFor(seed, variant, opts);
    try {
      const rec = await run(job);
      if (!rec || !rec.placements) return { seed, seats: table.seats, seat: table.seat, void: true, reason: rec && rec.reason };
      const stalemate = rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit' || rec.reason === 'no_actors';
      return { seed, seats: table.seats, seat: table.seat, won: !stalemate && rec.winnerIdx === table.seat, place: rec.placements[table.seat],
        score: stalemate ? 0 : placeScore(rec.placements[table.seat], table.seats), rounds: rec.rounds, reason: rec.reason, stalemate };
    } catch (e) { return { seed, seats: table.seats, seat: table.seat, void: true, error: String(e && e.message || e) }; }
  }));
  return out;
}

/** Kennzahlen einer Variante (ungepaart): Siegquote gegen die Erwartung 1/Sitze. */
function summarize(results) {
  const ok = results.filter(r => r && !r.void);
  const wins = ok.filter(r => r.won).length;
  const exp = ok.reduce((s, r) => s + 1 / r.seats, 0);
  const vr = ok.reduce((s, r) => s + (1 / r.seats) * (1 - 1 / r.seats), 0);
  return {
    games: ok.length, voided: results.length - ok.length, wins, winRate: ok.length ? wins / ok.length : 0,
    expected: ok.length ? exp / ok.length : 0, z: vr > 0 ? (wins - exp) / Math.sqrt(vr) : 0,
    meanScore: ok.length ? ok.reduce((s, r) => s + r.score, 0) / ok.length : 0,
    stalemates: ok.filter(r => r.stalemate).length,
  };
}

/**
 * Gepaarter Vergleich A gegen B über dieselben Seeds. Nur Seeds, in denen beide Läufe gültig sind.
 * Rückgabe: Siegquoten, Differenz B − A, McNemar-z (Vorzeichen: >0 = B gewinnt öfter), mittlere Platzierungsdifferenz mit Standardfehler.
 */
function compare(A, B) {
  const pairs = [];
  for (let i = 0; i < A.length; i++) if (A[i] && B[i] && !A[i].void && !B[i].void && A[i].seed === B[i].seed) pairs.push([A[i], B[i]]);
  const n = pairs.length;
  let b = 0, c = 0, wa = 0, wb = 0;
  const d = [];
  for (const [x, y] of pairs) {
    if (x.won) wa++;
    if (y.won) wb++;
    if (x.won && !y.won) b++;
    if (!x.won && y.won) c++;
    d.push(y.score - x.score);
  }
  const md = n ? d.reduce((s, v) => s + v, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - md) ** 2, 0) / (n - 1)) : 0;
  return {
    pairs: n, winsA: wa, winsB: wb, winRateA: n ? wa / n : 0, winRateB: n ? wb / n : 0,
    delta: n ? (wb - wa) / n : 0, discordant: { aOnly: b, bOnly: c },
    z: (b + c) > 0 ? (c - b) / Math.sqrt(b + c) : 0,
    scoreDelta: md, scoreSE: n > 1 ? sd / Math.sqrt(n) : 0,
  };
}

/** Siegquote nach Sitzzahl (für Berichte). */
function bySeats(results) {
  const m = new Map();
  for (const r of results) { if (!r || r.void) continue; const a = m.get(r.seats) || { seats: r.seats, games: 0, wins: 0 }; a.games++; if (r.won) a.wins++; m.set(r.seats, a); }
  return [...m.values()].sort((a, b) => a.seats - b.seats).map(a => ({ ...a, winRate: a.wins / a.games, expected: 1 / a.seats }));
}

module.exports = { PREP_KEYS, battleOnly, tableFor, personaFor, jobFor, runVariant, summarize, compare, bySeats, placeScore };
