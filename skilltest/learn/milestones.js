'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — MEILENSTEIN-BERICHTE (Kartenliste je N Partien)
//
//  Alle `--milestone-every` Partien (z. B. 5000) schreibt der Trainer eine Kartenliste, sortiert nach dem Wert, den die CPUs der Karte
//  in der Vorbereitung geben, samt
//    • Veränderung zur VORLISTE und zur ERSTEN Liste (Wert und Rang),
//    • Bewertung beim Aufbau: Mittel des Werts, den die Behalten/Recyceln-Entscheidung gab (positiv = behalten), und Behalten-Quote,
//    • den PARTNERN, mit denen die Karte gemeinsam am besten abschneidet — nur bei klarem Befund (siehe partnersOf).
//
//  Dateien (neben dem Profil): <profil>.milestones/
//    milestone-<Partien>.json   Rohdaten des Meilensteins (Grundlage der Vergleiche; so überleben Vergleiche einen Neustart)
//    report-<Partien>.md        die lesbare Liste
//    index.md                   Überblick über alle Meilensteine
//
//  „Wert" (Spalte Wert): mittlere Platzierungsgüte (+1 Sieg … −1 Letzter) aller Partien, in denen die Karte in der Starthand oder im
//  Recycler-Auswurf lag, zum Nullpunkt geschrumpft — vergleichbar über alle Kartentypen (ranking.js, `value`).
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ranking = require('./ranking');

const MIN_VALUE_N = 12;        // Karten mit weniger Austeilungen stehen nicht in der Liste
const PAIR_MIN_N = 20;         // Paare brauchen mindestens so viele Basen
const PAIR_SD = 0.6;           // Streuung der Platzierungsgüte je Beobachtung (wie ranking.js baseSE)
const PAIR_MIN_LIFT = 0.08;    // Partner zählen erst ab diesem Vorsprung gegenüber dem Mittel der beiden Einzelwerte …
const PAIR_MIN_Z = 2.5;        // … und wenn er sich deutlich vom Zufall abhebt (Vorsprung / Standardfehler)
const MAX_PARTNERS = 3;
const NEUTRAL = 0.004;         // Änderungen darunter gelten als „unverändert"

const dirOf = () => ranking.files().ranking.replace(/\.ranking\.json$/, '.milestones');
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

/** Namen aller Karten, die im Pool vorkommen können (gesperrte und bildlose Karten gehören nicht in die Liste); null, wenn nicht ermittelbar. */
function poolNames() {
  try {
    const { getCardDB } = require('../../cards/effects/_card-db');
    const { bucketOf, imageFilter } = require('../pool');
    const db = getCardDB(), hasImg = imageFilter(db);
    return new Set(Object.values(db).filter(c => bucketOf(c) && hasImg(c.name)).map(c => c.name));
  } catch { return null; }
}

/**
 * Partner je Karte: Paare aus `pairValue` (Held+Ability/Creature, Ability+Creature einer Spalte, Held+Held). Verglichen wird das Ergebnis
 * MIT dem Partner gegen das Ergebnis der Karte (und des Partners) OHNE den anderen — so fallen Paare heraus, die immer zusammen auftreten
 * (Held und seine feste Start-Ability) und keinen Vergleich zulassen. Vorsprung = Mittel mit Partner minus das bessere der beiden
 * Einzelergebnisse ohne den Partner; „klar" heißt Vorsprung ≥ PAIR_MIN_LIFT und z ≥ PAIR_MIN_Z.
 */
function partnersOf(profile) {
  const cm = profile.cardValue || {};
  const all = new Map();
  const push = (a, b, lift, n, z) => { const l = all.get(a) || []; l.push({ other: b, lift, n, z }); all.set(a, l); };
  for (const [key, e] of Object.entries(profile.pairValue || {})) {
    if (!e || e.n < PAIR_MIN_N) continue;
    const i = key.indexOf('|');
    if (i < 0) continue;
    const a = key.slice(0, i), b = key.slice(i + 1);
    const ca = cm[a], cb = cm[b];
    if (!ca || !cb) continue;
    const nA = ca.n - e.n, nB = cb.n - e.n;                      // Beobachtungen ohne den jeweils anderen
    if (nA < PAIR_MIN_N || nB < PAIR_MIN_N) continue;           // kein Vergleich möglich (fast immer zusammen)
    const withMean = e.sum / e.n;
    const meanA = (ca.sum - e.sum) / nA, meanB = (cb.sum - e.sum) / nB;
    const lift = withMean - Math.max(meanA, meanB);
    const nBase = meanA >= meanB ? nA : nB;
    const se = PAIR_SD * Math.sqrt(1 / e.n + 1 / nBase);
    const z = lift / se;
    push(a, b, lift, e.n, z); push(b, a, lift, e.n, z);
  }
  const out = new Map();
  for (const [name, list] of all) {
    const clear = list.filter(p => p.lift >= PAIR_MIN_LIFT && p.z >= PAIR_MIN_Z).sort((x, y) => y.z - x.z).slice(0, MAX_PARTNERS);
    if (clear.length) out.set(name, clear.map(p => [p.other, r3(p.lift), p.n, Math.round(p.z * 10) / 10]));
  }
  return out;
}

/** Rohdaten dieses Standes: je Karte Wert, Aufbau-Bewertung, Behalten-Quote, Partner. */
function buildSnapshot(profile, { final = false } = {}) {
  const rk = ranking.buildRanking(profile, []);
  const prep = profile.prepValue || {};
  const partners = partnersOf(profile);
  const inPool = poolNames();
  const rows = rk.rows.filter(r => r.valueN >= MIN_VALUE_N && (!inPool || inPool.has(r.name))).map(r => {
    const p = prep[r.name];
    return {
      n: r.name, t: r.type,
      v: r3(r.value), vn: r.valueN,                                   // Wert (ausgeteilt) und Zahl der Austeilungen
      pc: (r.type === 'Hero' || r.type === 'Creature') && r.dealtN >= 12 ? Math.round(Math.min(1, r.baseN / r.dealtN) * 1000) / 1000 : null,   // Aufgestellt: Anteil der Austeilungen, bei denen die CPU die Karte aufs Brett stellte
      b: r3(r.baseValue), bn: r.baseN,                                 // Aufbauwert (Karte stand in der Basis)
      p: p && p.n ? r3(p.sum / p.n) : null, pn: p ? p.n : 0,          // Aufbau-Bewertung der CPU (Behalten/Recyceln)
      k: p && p.n ? Math.round((p.keep / p.n) * 1000) / 1000 : null,  // Behalten-Quote
      ke: r.keepEdge, pl: r3(r.playValue), pln: r.playN,
      pr: partners.get(r.name) || [],
    };
  });
  rows.sort((a, b) => b.v - a.v || b.vn - a.vn);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const bench = (() => { try { const b = ranking.readBench({ max: 40 }).filter(x => !x.kind).pop(); return b ? { games: b.trainedGames, n: b.total.games, winRate: b.total.winRate, expected: b.total.expectedWinRate, z: b.total.z } : null; } catch { return null; } })();
  return { games: profile.games || 0, t: Date.now(), final, bench, types: rk.types, rows };
}

function readAll() {
  const dir = dirOf();
  try {
    return fs.readdirSync(dir).filter(f => /^milestone-\d+\.json$/.test(f))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), { encoding: 'utf-8' })); } catch { return null; } })
      .filter(Boolean).sort((a, b) => a.games - b.games);
  } catch { return []; }
}

const fmt = (x, d = 3) => (x == null ? '–' : (x > 0 ? '+' : '') + x.toFixed(d));
function deltaCell(cur, old) {
  if (!old) return 'neu';
  const d = cur.v - old.v;
  const rk = old.rank - cur.rank;
  const arrow = rk > 0 ? `↑${rk}` : rk < 0 ? `↓${-rk}` : '=';
  return `${Math.abs(d) < NEUTRAL ? '±0' : fmt(d)} (${arrow})`;
}

/** Lesbare Liste (Markdown). `prev` = vorangegangener, `first` = erster Meilenstein (beide dürfen fehlen). */
function renderMarkdown(cur, prev, first) {
  const byName = (snap) => new Map((snap ? snap.rows : []).map(r => [r.n, r]));
  const P = byName(prev), F = byName(first && first !== cur ? first : null);
  const L = [];
  L.push(`# Skill Test — Kartenliste nach ${cur.games} Partien${cur.final ? ' (Abschluss)' : ''}`, '');
  L.push(`Stand: ${new Date(cur.t).toISOString().slice(0, 16).replace('T', ' ')} UTC · ${cur.rows.length} Karten mit mindestens ${MIN_VALUE_N} Austeilungen`);
  if (prev) L.push(`Vorliste: nach ${prev.games} Partien · Erste Liste: nach ${first.games} Partien`);
  if (cur.bench) L.push(`Vergleich trainiert gegen untrainierte Bots (letzter Stand, ${cur.bench.n} Spiele nach ${cur.bench.games} Partien): Siegquote ${(cur.bench.winRate * 100).toFixed(1)} % bei ${(cur.bench.expected * 100).toFixed(1)} % Erwartung, z = ${cur.bench.z.toFixed(2)}`);
  L.push('', '**Spalten.** *Wert*: mittlere Platzierungsgüte (+1 Sieg … −1 Letzter), wenn die Karte in der Vorbereitung ausgeteilt wurde (Starthand oder Recycler), zum Nullpunkt geschrumpft — der Wert, den die CPUs der Karte beim Aufbau geben; die Liste ist danach sortiert. ' +
    '*Δ Vorliste / Δ Erste*: Änderung des Werts (in Klammern: Rangänderung, ↑ = aufgestiegen). *Aufgestellt* (nur Helden und Creatures): Anteil der Austeilungen, bei denen die CPU die Karte aufs Brett gestellt hat. *Behalten/Recyceln (Rest)*: für Karten, die nach dem Aufbau übrig sind, der Mittelwert der Bewertung dieser Entscheidung (positiv = behalten, negativ = recyceln) und die Behalten-Quote; bei Helden betrifft das nur überzählige. ' +
    '*Gemeinsam stark mit*: Karten, mit denen sie auf dem Brett deutlich besser abschneidet als erwartet (Ergebnis mit dem Partner minus das bessere Einzelergebnis ohne ihn; nur bei klarem Befund: Vorsprung ≥ ' + PAIR_MIN_LIFT + ' und z ≥ ' + PAIR_MIN_Z + ', mindestens ' + PAIR_MIN_N + ' Basen).', '');

  if (prev) {
    const moves = cur.rows.filter(r => P.has(r.n) && r.vn >= 40).map(r => ({ r, d: r.v - P.get(r.n).v }));
    const up = [...moves].sort((a, b) => b.d - a.d).slice(0, 12), down = [...moves].sort((a, b) => a.d - b.d).slice(0, 12);
    const line = (m) => `${m.r.n} (${fmt(m.d)}, jetzt Rang ${m.r.rank})`;
    L.push('## Größte Veränderungen seit der Vorliste (Karten mit ≥ 40 Austeilungen)', '', '**Aufsteiger:** ' + up.map(line).join(' · '), '', '**Absteiger:** ' + down.map(line).join(' · '), '');
  }
  const typeMean = Object.entries(cur.types || {}).map(([t, a]) => `${t} ${fmt(a.mean)} (${a.cards})`).join(' · ');
  if (typeMean) L.push('Mittel je Kartentyp (Wert, Zahl der Karten): ' + typeMean, '');

  L.push('## Alle Karten, sortiert nach Wert', '');
  L.push('| # | Karte | Typ | Wert | n | Δ Vorliste | Δ Erste | Aufgestellt | Behalten/Recyceln (Rest) | Gemeinsam stark mit |', '|---:|---|---|---:|---:|---|---|---:|---|---|');
  for (const r of cur.rows) {
    const part = r.pr.length ? r.pr.map(([o, lift, n]) => `${o} (${fmt(lift, 2)}, n=${n})`).join('; ') : '';
    const prep = r.p == null ? '–' : `${fmt(r.p, 2)} · ${Math.round(r.k * 100)} % behalten (n=${r.pn})`;
    L.push(`| ${r.rank} | ${r.n.replace(/\|/g, '/')} | ${r.t} | ${fmt(r.v)} | ${r.vn} | ${prev ? deltaCell(r, P.get(r.n)) : '–'} | ${first && first !== cur ? deltaCell(r, F.get(r.n)) : '–'} | ${r.pc == null ? '–' : Math.round(r.pc * 100) + ' %'} | ${prep} | ${part.replace(/\|/g, '/')} |`);
  }
  return L.join('\n') + '\n';
}

function renderIndex(snaps) {
  const L = ['# Skill Test — Meilensteine der Kartenlisten', '', '| Partien | Stand (UTC) | Karten | Siegquote vs. untrainiert | Bericht | Spitze | Schluss |', '|---:|---|---:|---|---|---|---|'];
  for (const s of snaps) {
    const top = s.rows.slice(0, 5).map(r => r.n).join(' · '), bot = s.rows.slice(-5).map(r => r.n).join(' · ');
    const b = s.bench ? `${(s.bench.winRate * 100).toFixed(1)} % (Erwartung ${(s.bench.expected * 100).toFixed(1)} %, z ${s.bench.z.toFixed(1)})` : '–';
    L.push(`| ${s.games}${s.final ? ' (Abschluss)' : ''} | ${new Date(s.t).toISOString().slice(0, 16).replace('T', ' ')} | ${s.rows.length} | ${b} | [report-${s.games}.md](report-${s.games}.md) | ${top} | ${bot} |`);
  }
  return L.join('\n') + '\n';
}

/** Meilenstein schreiben (Rohdaten, Liste, Überblick). Gibt { games, mdFile, jsonFile } zurück. */
function writeMilestone(profile, { final = false } = {}) {
  const dir = dirOf();
  fs.mkdirSync(dir, { recursive: true });
  const cur = buildSnapshot(profile, { final });
  const all = readAll();
  // Zwischenstände von Neustarts (final) zählen nicht als Liste; sie verschwinden, sobald der nächste echte Meilenstein da ist.
  if (!final) for (const s of all) if (s.final && s.games !== cur.games) for (const f of [`milestone-${s.games}.json`, `report-${s.games}.md`]) { try { fs.unlinkSync(path.join(dir, f)); } catch { /* weg */ } }
  const existing = all.filter(s => s.games !== cur.games && !s.final);
  const before = existing.filter(s => s.games < cur.games);
  const prev = before.length ? before[before.length - 1] : null;
  const first = before.length ? before[0] : null;
  const jsonFile = path.join(dir, `milestone-${cur.games}.json`), mdFile = path.join(dir, `report-${cur.games}.md`);
  fs.writeFileSync(jsonFile, JSON.stringify(cur), { encoding: 'utf-8' });
  fs.writeFileSync(mdFile, renderMarkdown(cur, prev, first), { encoding: 'utf-8' });
  fs.writeFileSync(path.join(dir, 'index.md'), renderIndex(readAll()), { encoding: 'utf-8' });
  return { games: cur.games, mdFile, jsonFile };
}

module.exports = { poolNames, writeMilestone, buildSnapshot, renderMarkdown, renderIndex, partnersOf, readAll, dirOf, MIN_VALUE_N };
