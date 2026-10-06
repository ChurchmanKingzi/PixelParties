'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — KARTEN-RANGLISTE UND LERN-VERLAUF
//
//  Aus dem Profil (learn/profile.js) entsteht eine nach Wert sortierte Liste ALLER Karten, die im Training
//  vorkamen — mit
//    value       Hauptwert „Wert ausgeteilt": mittlere Platzierungsgüte (+1 Sieg … −1 Letzter) aller Spiele, in denen die Karte
//                in der Starthand oder im Recycler-Auswurf lag — vergleichbar über alle Kartentypen, zum Nullpunkt
//                geschrumpft (sum / (n + PRIOR))
//    baseValue   „Aufbauwert": mittlere Platzierungsgüte (+1 Sieg … −1 Letzter) aller Basen mit dieser Karte,
//                zum Nullpunkt hin geschrumpft (sum / (n + PRIOR)) — wenige Beobachtungen zählen wenig
//    baseN       in wie vielen Basen die Karte stand
//    playValue   mittlerer Stellungsgewinn beim Ausspielen/Aktivieren (alle Aktionsarten der Karte)
//    lift        Aufbauwert minus Mittel ihres Kartentyps (was ist besser/schlechter als ihresgleichen?)
//    keepEdge    gelernter Vorteil „Karte behalten statt recyceln" (nur die Karte selbst; Kontext-Effekte stehen in
//                keepPairs/keepContext), keepN = Beobachtungen — siehe learn/keepmodel.js
//    delta/trend Veränderung seit dem letzten Prüfpunkt bzw. die letzten Prüfpunkte
//
//  Dateien (neben dem Profil, siehe profile.FILE()):
//    <profil>.ranking.json            aktuelle Liste (wird bei jedem Speichern des Trainers neu geschrieben)
//    <profil>.ranking-history.jsonl   ein Eintrag je Prüfpunkt: { games, t, v: { Karte: Aufbauwert } }
//    <profil>.bench.jsonl             Vergleichsspiele trainiert vs. untrainiert (learn/benchmark in train.js)
//    <profil>.status.json             Lebenszeichen des Trainers (Partien, Rate)
//
//  Abruf: GET /api/skilltest/ranking, /api/skilltest/benchmark, Seite /skilltest-learning.html,
//         `node scripts/skilltest-report.js`.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const profileMod = require('./profile');

const PRIOR = 20;                 // „Phantom-Beobachtungen" bei Null (Schrumpfung)
const MIN_N_FOR_HISTORY = 8;
const TREND_POINTS = 12;
const HISTORY_MAX_BYTES = 6 * 1024 * 1024;

const baseOf = () => profileMod.FILE().replace(/\.json$/i, '');
const files = () => ({
  ranking: baseOf() + '.ranking.json',
  history: baseOf() + '.ranking-history.jsonl',
  bench: baseOf() + '.bench.jsonl',
  status: baseOf() + '.status.json',
});

function cardInfo(name) {
  try {
    const c = require('../../cards/effects/_card-db').getCardDB()[name];
    return c ? { type: c.cardType, subtype: c.subtype || '' } : { type: '?', subtype: '' };
  } catch { return { type: '?', subtype: '' }; }
}

/** Kartenname aus einem Aktionsschlüssel („spell:Fireball" → „Fireball"). */
function cardOfKey(key) { const i = key.indexOf(':'); return i < 0 ? key : key.slice(i + 1); }

/**
 * Rangliste aufbauen. `history`: Liste früherer Prüfpunkte (neueste zuletzt) für Trend/Verlauf.
 * Gibt { rows, types, games, version, updated } zurück; rows sind absteigend nach baseValue sortiert.
 */
function buildRanking(profile, history = []) {
  const play = {};                                        // Karte → { n, sum }
  for (const [k, e] of Object.entries(profile.playValue || {})) {
    if (k.startsWith('react-hold:')) continue;      // „Reaktion bewusst gehalten": Vergleichsarm, kein Spielwert der Karte
    const nm = cardOfKey(k);
    const t = play[nm] || (play[nm] = { n: 0, sum: 0 });
    t.n += e.n; t.sum += e.sum;
  }
  const dealt = profile.dealtValue || {};
  const km = profile.keepModel || null;
  const names = new Set([...Object.keys(profile.cardValue || {}), ...Object.keys(dealt)]);
  const rows = [];
  for (const name of names) {
    const b = (profile.cardValue || {})[name], d = dealt[name];
    if (!(b && b.n > 0) && !(d && d.n > 0)) continue;
    const info = cardInfo(name);
    const p = play[name];
    const baseN = b ? b.n : 0, dealtN = d ? d.n : 0;
    const baseValue = baseN ? b.sum / (baseN + PRIOR) : 0;
    const dealtValue = dealtN ? d.sum / (dealtN + PRIOR) : null;
    rows.push({
      name, type: info.type, subtype: info.subtype,
      // Hauptwert: Ausgeteilt (vergleichbar über alle Typen); ohne Austeilungsdaten (altes Profil) der Aufbauwert.
      value: dealtValue != null ? dealtValue : baseValue, valueN: dealtN || baseN,
      dealtValue, dealtN,
      baseN, baseMean: baseN ? b.sum / baseN : null, baseValue, baseSE: baseN ? 0.6 / Math.sqrt(baseN) : null,
      playN: p ? p.n : 0, playValue: p && p.n ? p.sum / p.n : null,
      keepEdge: km && km.w['c:' + name] ? Math.round(2 * km.w['c:' + name][0] * 1e4) / 1e4 : null,
      keepN: km && km.w['c:' + name] ? km.w['c:' + name][1] : 0,
    });
  }
  // Lift gegenüber dem Mittel des eigenen Kartentyps (gewichtet nach Beobachtungen)
  const typeAgg = {};
  for (const r of rows) { const t = typeAgg[r.type] || (typeAgg[r.type] = { n: 0, sum: 0, cards: 0 }); t.n += r.valueN; t.sum += r.value * r.valueN; t.cards++; }
  for (const r of rows) { const t = typeAgg[r.type]; r.lift = r.value - (t.n ? t.sum / t.n : 0); }
  rows.sort((a, b) => b.value - a.value || b.valueN - a.valueN);
  rows.forEach((r, i) => { r.rank = i + 1; });
  const typeRank = {};
  for (const r of rows) { typeRank[r.type] = (typeRank[r.type] || 0) + 1; r.typeRank = typeRank[r.type]; }

  // Trend aus den Prüfpunkten
  if (history.length) {
    const last = history[history.length - 1];
    for (const r of rows) {
      const series = history.slice(-TREND_POINTS).map(h => (h.v && h.v[r.name] != null ? h.v[r.name] : null));
      r.trend = series;
      const prev = last.v && last.v[r.name];
      r.delta = prev != null ? r.value - prev : null;
    }
  }
  return {
    keepPairs: keepPairs(km), keepContext: keepContext(km),
    updated: new Date().toISOString(), games: profile.games || 0, version: profile.version || 0, prior: PRIOR,
    types: Object.fromEntries(Object.entries(typeAgg).map(([t, a]) => [t, { cards: a.cards, mean: a.n ? a.sum / a.n : 0 }])),
    historyPoints: history.map(h => h.games),
    rows,
  };
}

/** Stärkste Paar-Effekte des Behalten/Recyceln-Modells: „Karte | Mitspieler" → Vorteil des Behaltens, wenn der Mitspieler dabei ist. */
function keepPairs(km, top = 60, minN = 4) {
  if (!km) return [];
  return Object.entries(km.w).filter(([f, e]) => f.startsWith('p:') && e[1] >= minN)
    .map(([f, e]) => { const [card, other] = f.slice(2).split('|'); return { card, other, edge: Math.round(2 * e[0] * 1e4) / 1e4, n: e[1] }; })
    .sort((a, b) => Math.abs(b.edge) * Math.sqrt(b.n) - Math.abs(a.edge) * Math.sqrt(a.n)).slice(0, top);
}

/** Kontext-Effekte ohne Kartennamen (Typ × Stufen-Erfüllbarkeit, Synergie, Recycler-Stand …): was zählt über Karten hinweg? */
function keepContext(km, top = 60, minN = 20) {
  if (!km) return [];
  return Object.entries(km.w).filter(([f, e]) => /^(fit|fitH|syn|ab|rc|free|ty|a):/.test(f) && e[1] >= minN)
    .map(([f, e]) => ({ feature: f, edge: Math.round(2 * e[0] * 1e4) / 1e4, n: e[1] }))
    .sort((a, b) => Math.abs(b.edge) * Math.sqrt(b.n) - Math.abs(a.edge) * Math.sqrt(a.n)).slice(0, top);
}

function readHistory(max = 400) {
  const f = files().history;
  try {
    const lines = fs.readFileSync(f, { encoding: 'utf-8' }).split('\n').filter(Boolean);
    return lines.slice(-max).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Prüfpunkt festhalten (Verlauf je Karte). */
function appendHistory(profile) {
  const f = files().history;
  const v = {};
  const src = Object.keys(profile.dealtValue || {}).length ? profile.dealtValue : (profile.cardValue || {});
  for (const [name, e] of Object.entries(src)) {
    if (e && e.n >= MIN_N_FOR_HISTORY) v[name] = Math.round((e.sum / (e.n + PRIOR)) * 1000) / 1000;
  }
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({ games: profile.games || 0, t: Date.now(), v }) + '\n', { encoding: 'utf-8' });
    if (fs.statSync(f).size > HISTORY_MAX_BYTES) {                       // Älteste Hälfte verwerfen
      const lines = fs.readFileSync(f, { encoding: 'utf-8' }).split('\n').filter(Boolean);
      fs.writeFileSync(f, lines.slice(Math.floor(lines.length / 2)).join('\n') + '\n', { encoding: 'utf-8' });
    }
  } catch (e) { console.error('[skilltest-ranking] Verlauf:', e && e.message); }
}

/** Rangliste neu berechnen und atomar schreiben (bei jedem Speichern des Trainers). */
function writeRanking(profile, opts = {}) {
  try {
    if (opts.checkpoint) appendHistory(profile);
    const data = buildRanking(profile, readHistory(TREND_POINTS + 2));
    const f = files().ranking;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = f + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(data), { encoding: 'utf-8' });
    fs.renameSync(tmp, f);
    return data;
  } catch (e) { console.error('[skilltest-ranking]', e && e.message); return null; }
}

let _rcache = null;
/** Aktuelle Rangliste lesen (nach mtime zwischengespeichert); fehlt die Datei, wird sie aus dem Profil berechnet. */
function readRanking() {
  const f = files().ranking;
  try {
    const st = fs.statSync(f);
    if (_rcache && _rcache.mtime === st.mtimeMs) return _rcache.data;
    const data = JSON.parse(fs.readFileSync(f, { encoding: 'utf-8' }));
    _rcache = { mtime: st.mtimeMs, data };
    return data;
  } catch { /* weiter */ }
  const prof = profileMod.load();
  return prof.games ? buildRanking(prof, readHistory(TREND_POINTS + 2)) : { rows: [], types: {}, games: 0, version: 0, updated: null, historyPoints: [] };
}

// ── Vergleichsspiele (Benchmark) ───────────────────────────────────
function appendBench(rec) {
  const f = files().bench;
  try {
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.appendFileSync(f, JSON.stringify(rec) + '\n', { encoding: 'utf-8' });
  } catch (e) { console.error('[skilltest-ranking] Benchmark:', e && e.message); }
}

/** Benchmark-Verlauf lesen; `withGames: false` lässt die Einzelspiele weg (außer im letzten Eintrag). */
function readBench({ max = 300, withGames = false } = {}) {
  try {
    const lines = fs.readFileSync(files().bench, { encoding: 'utf-8' }).split('\n').filter(Boolean).slice(-max);
    const recs = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return recs.map((r, i) => (withGames || i === recs.length - 1 ? r : { ...r, games: undefined }));
  } catch { return []; }
}

function writeStatus(st) {
  try { fs.writeFileSync(files().status, JSON.stringify({ ...st, t: Date.now() }), { encoding: 'utf-8' }); } catch { /* egal */ }
}
function readStatus() {
  try { return JSON.parse(fs.readFileSync(files().status, { encoding: 'utf-8' })); } catch { return null; }
}

module.exports = { PRIOR, files, buildRanking, writeRanking, readRanking, appendHistory, readHistory, appendBench, readBench, writeStatus, readStatus };
