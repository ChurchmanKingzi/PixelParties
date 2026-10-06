'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — SPIELSTILE (Personas) DER BOTS
//
//  Eine Persona ist ein Gewichtsvektor für die Policy (policy.js,
//  DEFAULT_WEIGHTS): Aggression, Zielwahl, Neigung zu Effekten/Zaubern,
//  Neugier usw. Die Liga (learn/train.js) hält eine Population davon,
//  lässt sie gegeneinander spielen (2–8 Sitze gemischt) und entwickelt
//  sie per Selektion + Mutation + Kreuzung weiter.
// ═══════════════════════════════════════════════════════════════════
const { DEFAULT_WEIGHTS } = require('../policy');

/** [min, max] je Gewicht — Mutationen bleiben darin. */
const SPACE = {
  aggression: [0.2, 2.5], lowestHp: [0, 3], killBonus: [0, 4], focusLeader: [-1.5, 1.5],
  heroEffect: [0, 2], creatureEffect: [0, 2], spell: [0.2, 2.5], summon: [0.2, 2.5], equip: [0.2, 2.5],
  healBias: [0, 3], friendlyFire: [0, 1.5], learned: [0, 2], explore: [0, 1.5],
};
const KEYS = Object.keys(SPACE);

const clamp = (k, v) => Math.max(SPACE[k][0], Math.min(SPACE[k][1], v));

/** Normalverteilter Zufall (Box-Muller). */
function gauss(rng = Math.random) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gewichte vollständig und innerhalb der Grenzen. */
function normalize(w) {
  const out = {};
  for (const k of KEYS) out[k] = clamp(k, Number.isFinite(w && w[k]) ? w[k] : DEFAULT_WEIGHTS[k]);
  return out;
}

/** Mutation: jedes Gewicht mit Wahrscheinlichkeit `p` um ein Rauschen von `sigma` × Spannweite verschoben. */
function mutate(w, rng = Math.random, sigma = 0.15, p = 0.5) {
  const out = normalize(w);
  for (const k of KEYS) {
    if (rng() < p) out[k] = clamp(k, out[k] + gauss(rng) * sigma * (SPACE[k][1] - SPACE[k][0]));
  }
  return out;
}

/** Kreuzung: je Gewicht zufällig von einem Elternteil (leicht gemischt). */
function crossover(a, b, rng = Math.random) {
  const out = {};
  for (const k of KEYS) { const t = rng(); out[k] = clamp(k, t < 0.4 ? a[k] : t < 0.8 ? b[k] : (a[k] + b[k]) / 2); }
  return out;
}

/** Ein zufälliger Vektor (für Vielfalt am Anfang). */
function randomWeights(rng = Math.random) {
  const out = {};
  for (const k of KEYS) out[k] = SPACE[k][0] + rng() * (SPACE[k][1] - SPACE[k][0]);
  return out;
}

/** Sprechender Name aus den auffälligsten Gewichten (nur Anzeige/Diagnose). */
function nameFor(w) {
  const tags = [];
  if (w.aggression >= 1.5) tags.push('Berserker'); else if (w.aggression <= 0.6) tags.push('Zauderer');
  if (w.focusLeader >= 0.6) tags.push('Königsjäger'); else if (w.focusLeader <= -0.6) tags.push('Aasgeier');
  if (w.killBonus >= 2.8) tags.push('Henker');
  if (w.creatureEffect >= 1.4) tags.push('Beschwörer'); else if (w.heroEffect >= 1.3) tags.push('Zeremonienmeister');
  if (w.explore >= 0.9) tags.push('Tüftler');
  return tags.length ? tags.slice(0, 2).join('-') : 'Allrounder';
}

module.exports = { SPACE, KEYS, DEFAULT_WEIGHTS, normalize, mutate, crossover, randomWeights, gauss, nameFor };
