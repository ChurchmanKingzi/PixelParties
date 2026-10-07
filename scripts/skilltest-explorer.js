#!/usr/bin/env node
'use strict';
// Erzeugt aus den Meilenstein-Listen des Nachttrainings eine einzelne HTML-Seite (sortier-/filterbare Kartenwerte, Verlauf, Partner,
// Vergleich trainiert gegen untrainiert). Standard: docs/skilltest-night/*.json → docs/skilltest-night/kartenwerte.html
//
//   node scripts/skilltest-explorer.js [Meilenstein-Ordner] [Ausgabedatei]
//
// Optional: <Ordner>/analyse.json  { "titel": "...", "zeilen": [{ "label": "...", "siege": 187, "partien": 598, "erwartet": 186.8, "platzierung": 0.017 }], "notiz": "..." }
// erscheint als Abschnitt „Woher kommt der Vorsprung?". Die Benchmark-Datei heißt bench.jsonl im selben Ordner.
const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs', 'skilltest-night'));
const out = path.resolve(process.argv[3] || path.join(dir, 'kartenwerte.html'));

const lists = fs.readdirSync(dir).filter(f => /^milestone-\d+\.json$/.test(f))
  .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), { encoding: 'utf-8' })))
  .filter(m => !m.final).sort((a, b) => a.games - b.games);
if (!lists.length) { console.error('Keine Meilenstein-Dateien in', dir); process.exit(1); }

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const byName = new Map();
lists.forEach((m, li) => {
  for (const r of m.rows) {
    let c = byName.get(r.n);
    if (!c) { c = { n: r.n, t: r.t, v: Array(lists.length).fill(null), vn: Array(lists.length).fill(0) }; byName.set(r.n, c); }
    c.v[li] = r.v; c.vn[li] = r.vn;
    if (li === lists.length - 1) { c.pc = r.pc; c.b = r3(r.b); c.bn = r.bn; c.k = r.k; c.p = r3(r.p); c.pn = r.pn; c.pr = (r.pr || []).map(x => [x[0], r3(x[1]), x[2], r3(x[3])]); }
  }
});
// Nur Karten, die in der letzten Liste stehen (inzwischen gesperrte Karten aus frühen Listen entfallen).
const cards = [...byName.values()].filter(c => c.v[lists.length - 1] != null);

let bench = [];
try {
  bench = fs.readFileSync(path.join(dir, 'bench.jsonl'), { encoding: 'utf-8' }).trim().split('\n').map(l => JSON.parse(l)).filter(r => !r.kind)
    .map(r => ({ g: r.trainedGames, n: r.total.games, w: r.total.wins, e: r3(r.total.expectedWinRate * r.total.games), s: r3(r.total.meanPlaceScore), p: r.persona || '' }));
} catch { /* ohne Vergleichsspiele */ }
let analyse = null;
try { analyse = JSON.parse(fs.readFileSync(path.join(dir, 'analyse.json'), { encoding: 'utf-8' })); } catch { /* optional */ }

const data = {
  lists: lists.map(m => ({ games: m.games, t: m.t })),
  types: [...new Set(cards.map(c => c.t))],
  cards, bench, analyse,
};
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const latest = lists[lists.length - 1];

const html = `<title>Skill-Test Kartenwerte</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: ruhiges Hauptbuch — Kopf mit Kennzahlen der letzten Liste, darunter eine dichte, sortierbare Tabelle, ganz unten Vergleichsspiele. */
:root {
  --bg: #f5f6f8; --surface: #ffffff; --ink: #1a2230; --ink-2: #4b5667; --ink-3: #7a8494; --line: #dfe3ea; --line-2: #eceff4;
  --accent: #1f5fae; --accent-soft: #e3edf9; --pos: #1b7f5c; --pos-soft: #d9f0e7; --neg: #b4472f; --neg-soft: #f6e0da;
  --spark: #5d6b82; --focus: #1f5fae;
  --font-body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-num: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #11161f; --surface: #181f2b; --ink: #e6eaf1; --ink-2: #a9b3c3; --ink-3: #7d889a; --line: #2a3445; --line-2: #222b3a;
  --accent: #6aa6ec; --accent-soft: #1f3250; --pos: #4cc79a; --pos-soft: #17382d; --neg: #ee8b72; --neg-soft: #432720;
  --spark: #8f9db4; --focus: #6aa6ec; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #11161f; --surface: #181f2b; --ink: #e6eaf1; --ink-2: #a9b3c3; --ink-3: #7d889a; --line: #2a3445; --line-2: #222b3a;
  --accent: #6aa6ec; --accent-soft: #1f3250; --pos: #4cc79a; --pos-soft: #17382d; --neg: #ee8b72; --neg-soft: #432720;
  --spark: #8f9db4; --focus: #6aa6ec; color-scheme: dark; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-body); font-size: 14px; line-height: 1.45; padding-inline: 16px; padding-block: 20px 48px; }
* { box-sizing: border-box; }
.wrap { max-width: 1180px; margin-inline: auto; display: flex; flex-direction: column; gap: 18px; }
h1 { font-size: 1.55rem; font-weight: 600; letter-spacing: -0.01em; margin: 0; text-wrap: balance; }
h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 8px; }
p { margin: 0; }
.sub { color: var(--ink-2); max-width: 70ch; margin-top: 6px; }
.num { font-family: var(--font-num); font-variant-numeric: tabular-nums; }
header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 24px; align-items: flex-end; }
.head-meta { color: var(--ink-3); font-size: 0.85rem; text-align: right; }
.cols2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; min-width: 0; }
.panel h2 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); font-weight: 500; }
.rank-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.rank-list li { display: grid; grid-template-columns: 2.7rem minmax(0, 1fr) auto; gap: 8px; align-items: baseline; }
.rank-list .nm { overflow-wrap: anywhere; }
.rank-list .rk { color: var(--ink-3); font-size: 0.8rem; }
.pos { color: var(--pos); } .neg { color: var(--neg); } .dim { color: var(--ink-3); }
.toolbar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); padding-block: 8px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; border-bottom: 1px solid var(--line); }
.toolbar label { color: var(--ink-3); font-size: 0.8rem; display: flex; align-items: center; gap: 6px; }
input[type="search"], select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 6px 9px; min-height: 34px; }
input[type="search"] { min-width: 0; width: 15rem; max-width: 100%; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: inherit; font-size: 0.82rem; color: var(--ink-2); background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 4px 11px; cursor: pointer; min-height: 30px; }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 500; }
.count { margin-left: auto; color: var(--ink-3); font-size: 0.82rem; }
.tablebox { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 760px; }
th, td { padding: 7px 10px; text-align: left; border-bottom: 1px solid var(--line-2); vertical-align: middle; }
th { position: sticky; top: 0; background: var(--surface); font-weight: 500; font-size: 0.76rem; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; cursor: pointer; user-select: none; border-bottom: 1px solid var(--line); }
th[aria-sort="ascending"]::after { content: " ▲"; font-size: 0.65rem; } th[aria-sort="descending"]::after { content: " ▼"; font-size: 0.65rem; }
th.r, td.r { text-align: right; }
tbody tr.row { cursor: pointer; }
tbody tr.row:hover td { background: var(--line-2); }
td.card { min-width: 14rem; overflow-wrap: anywhere; font-weight: 500; }
.typ { font-size: 0.75rem; color: var(--ink-3); }
.valcell { display: grid; grid-template-columns: 4.2rem 90px; gap: 8px; align-items: center; }
.bar { position: relative; height: 10px; background: var(--line-2); border-radius: 2px; }
.bar::before { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--line); }
.bar i { position: absolute; top: 0; bottom: 0; border-radius: 2px; }
.bar i.p { left: 50%; background: var(--pos); } .bar i.n { right: 50%; background: var(--neg); }
svg.spark { display: block; }
.detail td { background: var(--bg); padding: 12px 14px; }
.detail-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
.detail h3 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); font-weight: 500; margin: 0 0 6px; }
.mini { width: 100%; min-width: 0; border-collapse: collapse; }
.mini td, .mini th { padding: 3px 6px; border-bottom: 1px solid var(--line-2); cursor: default; position: static; }
.more { display: flex; justify-content: center; padding: 10px; }
.btn { font: inherit; color: var(--accent); background: var(--surface); border: 1px solid var(--accent); border-radius: 6px; padding: 7px 14px; cursor: pointer; min-height: 36px; }
.note { color: var(--ink-2); font-size: 0.88rem; max-width: 75ch; }
.benchbox { overflow-x: auto; }
.benchbox table { min-width: 520px; }
.hint { color: var(--ink-3); font-size: 0.8rem; }
@media (max-width: 760px) {
  .cols2, .detail-grid { grid-template-columns: minmax(0, 1fr); }
  .head-meta { text-align: left; }
  .col-opt { display: none; }
  table { min-width: 520px; }
  td.card { min-width: 9rem; }
}
</style>
<div class="wrap">
  <header>
    <div>
      <h1>Skill-Test Kartenwerte</h1>
      <p class="sub">Welchen Wert die CPUs einer Karte beim Aufbau geben: mittlere Platzierungsgüte (+1 Sieg, −1 Letzter), wenn die Karte ausgeteilt wurde, zum Nullpunkt geschrumpft. Berechnet aus dem Selbstspiel-Training mit 2 bis 8 Spielern.</p>
    </div>
    <div class="head-meta num" id="meta"></div>
  </header>

  <section class="cols2" aria-label="Spitze und Schluss">
    <div class="panel"><h2>Höchster Wert</h2><ol class="rank-list" id="topList"></ol></div>
    <div class="panel"><h2>Niedrigster Wert</h2><ol class="rank-list" id="botList"></ol></div>
  </section>

  <section aria-label="Kartenliste">
    <div class="toolbar">
      <label for="q">Suche <input id="q" type="search" placeholder="Kartenname" autocomplete="off"></label>
      <div class="chips" id="chips" role="group" aria-label="Kartentyp"></div>
      <label for="listSel">Liste <select id="listSel"></select></label>
      <span class="count num" id="count"></span>
    </div>
    <div class="tablebox" style="margin-top:10px">
      <table>
        <thead><tr id="head"></tr></thead>
        <tbody id="body"></tbody>
      </table>
      <div class="more" id="moreBox"><button class="btn" id="more" type="button">Mehr anzeigen</button></div>
    </div>
    <p class="hint" style="margin-top:8px">Zeile anklicken für Verlauf und Partner. „Δ Vorliste“ und „Δ Erste“ vergleichen mit der Liste davor bzw. der ersten Liste; der Verlauf zeigt alle Listen. Aufgestellt, Behalten und Partner stammen aus der letzten Liste.</p>
  </section>

  <section id="benchSec" aria-label="Trainiert gegen untrainiert">
    <h2>Trainiert gegen untrainiert</h2>
    <p class="note" id="benchNote"></p>
    <div class="panel benchbox" style="margin-top:10px"><table id="benchTable"></table></div>
  </section>
  <section id="analyseSec" hidden aria-label="Aufschlüsselung">
    <h2 id="analyseTitle"></h2>
    <p class="note" id="analyseNote"></p>
    <div class="panel benchbox" style="margin-top:10px"><table id="analyseTable"></table></div>
  </section>
</div>
<script>
const D = ${json};
const $ = (id) => document.getElementById(id);
const fmt = (v, d = 2) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d);
const dfmt = (v) => v == null ? '–' : (Math.abs(v) < 0.0005 ? '±0.000' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const cls = (v) => v == null ? 'dim' : v > 0.004 ? 'pos' : v < -0.004 ? 'neg' : 'dim';
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = D.lists.length, LAST = L - 1;
const state = { list: LAST, type: 'Alle', q: '', sort: 'v', dir: -1, shown: 60, open: null };

function ranks(li) {
  const rows = D.cards.filter(c => c.v[li] != null).sort((a, b) => b.v[li] - a.v[li] || b.vn[li] - a.vn[li]);
  const m = new Map(); rows.forEach((c, i) => m.set(c.n, i + 1)); return m;
}
let rankCache = {};
const rankOf = (li) => rankCache[li] || (rankCache[li] = ranks(li));

function spark(c, w = 90, h = 22, big) {
  const pts = c.v.map((v, i) => v == null ? null : [i, v]).filter(Boolean);
  if (pts.length < 2) return '';
  const lo = big ? Math.min(-0.05, ...pts.map(p => p[1])) : -0.6, hi = big ? Math.max(0.05, ...pts.map(p => p[1])) : 0.6;
  const x = (i) => 3 + (w - 6) * (L === 1 ? 0 : i / (L - 1)), y = (v) => 3 + (h - 6) * (1 - (v - lo) / (hi - lo));
  const d = pts.map((p, k) => (k ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
  const last = pts[pts.length - 1];
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Verlauf über ' + pts.length + ' Listen">'
    + '<line x1="0" x2="' + w + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>'
    + '<path d="' + d + '" fill="none" stroke="var(--spark)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + x(last[0]).toFixed(1) + '" cy="' + y(last[1]).toFixed(1) + '" r="2.6" fill="var(--accent)"/></svg>';
}

function valCell(v) {
  if (v == null) return '–';
  const w = Math.min(50, Math.abs(v) / 0.55 * 50);
  return '<div class="valcell"><span class="num ' + cls(v) + '">' + fmt(v) + '</span><div class="bar"><i class="' + (v >= 0 ? 'p' : 'n') + '" style="width:' + w.toFixed(1) + '%"></i></div></div>';
}

const COLS = [
  { k: 'rank', t: '#', cls: 'r' },
  { k: 'n', t: 'Karte' },
  { k: 't', t: 'Typ', opt: true },
  { k: 'v', t: 'Wert' },
  { k: 'trend', t: 'Verlauf', nosort: true },
  { k: 'dPrev', t: 'Δ Vorliste', cls: 'r' },
  { k: 'dFirst', t: 'Δ Erste', cls: 'r', opt: true },
  { k: 'vn', t: 'Austeilungen', cls: 'r', opt: true },
  { k: 'pc', t: 'Aufgestellt', cls: 'r', opt: true },
  { k: 'k', t: 'Behalten', cls: 'r', opt: true },
];

function rowData(c) {
  const li = state.list, v = c.v[li];
  const prev = li > 0 ? c.v[li - 1] : null, first = c.v[0];
  return { c, v, rank: rankOf(li).get(c.n), dPrev: v != null && prev != null ? v - prev : null, dFirst: v != null && first != null && li > 0 ? v - first : null, vn: c.vn[li] };
}

function render() {
  const li = state.list;
  let rows = D.cards.filter(c => c.v[li] != null).map(rowData);
  const q = state.q.trim().toLowerCase();
  if (q) rows = rows.filter(r => r.c.n.toLowerCase().includes(q));
  if (state.type !== 'Alle') rows = rows.filter(r => r.c.t === state.type);
  const key = state.sort, dir = state.dir;
  const get = (r) => key === 'n' ? r.c.n.toLowerCase() : key === 't' ? r.c.t : key === 'rank' ? r.rank : (key === 'pc' || key === 'k') ? r.c[key] : r[key];
  rows.sort((a, b) => { const x = get(a), y = get(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  $('count').textContent = rows.length + ' Karten';
  $('head').innerHTML = COLS.map(c => '<th class="' + (c.cls || '') + (c.opt ? ' col-opt' : '') + '" data-k="' + c.k + '"' + (c.nosort ? '' : ' tabindex="0" role="button"') + (state.sort === c.k ? ' aria-sort="' + (state.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '>' + c.t + '</th>').join('');
  const shown = rows.slice(0, state.shown);
  let html = '';
  for (const r of shown) {
    const c = r.c, o = state.open === c.n;
    html += '<tr class="row" data-n="' + esc(c.n) + '" tabindex="0" aria-expanded="' + o + '"><td class="r num dim">' + r.rank + '</td><td class="card">' + esc(c.n) + '</td><td class="col-opt typ">' + esc(c.t) + '</td><td>' + valCell(r.v) + '</td><td>' + spark(c) + '</td>'
      + '<td class="r num ' + cls(r.dPrev) + '">' + dfmt(r.dPrev) + '</td><td class="r num col-opt ' + cls(r.dFirst) + '">' + dfmt(r.dFirst) + '</td><td class="r num col-opt dim">' + r.vn + '</td>'
      + '<td class="r num col-opt">' + (c.pc == null ? '–' : Math.round(c.pc * 100) + ' %') + '</td><td class="r num col-opt">' + (c.k == null ? '–' : Math.round(c.k * 100) + ' %') + '</td></tr>';
    if (o) html += '<tr class="detail"><td colspan="' + COLS.length + '">' + detail(c) + '</td></tr>';
  }
  $('body').innerHTML = html;
  $('moreBox').hidden = rows.length <= state.shown;
  $('more').textContent = 'Mehr anzeigen (' + Math.min(60, rows.length - state.shown) + ' von ' + (rows.length - state.shown) + ')';
}

function detail(c) {
  const partners = c.pr && c.pr.length ? '<table class="mini"><thead><tr><th>Partner</th><th class="r">Vorsprung</th><th class="r">Basen</th><th class="r">z</th></tr></thead><tbody>'
    + c.pr.map(p => '<tr><td>' + esc(p[0]) + '</td><td class="r num pos">' + fmt(p[1]) + '</td><td class="r num dim">' + p[2] + '</td><td class="r num dim">' + (p[3] == null ? '–' : p[3].toFixed(1)) + '</td></tr>').join('') + '</tbody></table>'
    : '<p class="dim">Kein klarer Partner (Vorsprung ≥ 0,08 und z ≥ 2,5 bei mindestens 20 Basen).</p>';
  const hist = '<table class="mini"><thead><tr><th>Liste</th><th class="r">Wert</th><th class="r">Austeilungen</th></tr></thead><tbody>'
    + D.lists.map((l, i) => c.v[i] == null ? '' : '<tr><td class="num">' + l.games + ' Partien</td><td class="r num ' + cls(c.v[i]) + '">' + fmt(c.v[i], 3) + '</td><td class="r num dim">' + c.vn[i] + '</td></tr>').join('') + '</tbody></table>';
  const extra = [];
  if (c.b != null) extra.push('Wert, wenn auf dem Brett: <span class="num ' + cls(c.b) + '">' + fmt(c.b) + '</span> (' + c.bn + ' Basen)');
  if (c.p != null) extra.push('Behalten statt Recyceln (Rest): <span class="num ' + cls(c.p) + '">' + fmt(c.p) + '</span>, ' + c.pn + ' Entscheidungen');
  return '<div class="detail-grid"><div><h3>Verlauf</h3>' + spark(c, 360, 70, true) + '<div style="margin-top:8px">' + hist + '</div><p class="hint" style="margin-top:6px">' + extra.join('<br>') + '</p></div><div><h3>Gemeinsam stark mit</h3>' + partners + '</div></div>';
}

function fillRank(ul, rows) { ul.innerHTML = rows.map(c => '<li><span class="rk num">' + rankOf(LAST).get(c.n) + '</span><span class="nm">' + esc(c.n) + '</span><span class="num ' + cls(c.v[LAST]) + '">' + fmt(c.v[LAST]) + '</span></li>').join(''); }
const sorted = D.cards.filter(c => c.v[LAST] != null).sort((a, b) => b.v[LAST] - a.v[LAST] || b.vn[LAST] - a.vn[LAST]);
fillRank($('topList'), sorted.slice(0, 8)); fillRank($('botList'), sorted.slice(-8).reverse());
$('meta').innerHTML = 'Letzte Liste: ' + D.lists[LAST].games.toLocaleString('de-DE') + ' Partien<br>' + sorted.length + ' Karten · ' + L + ' Listen';

$('chips').innerHTML = ['Alle', ...D.types].map(t => '<button class="chip" type="button" data-t="' + esc(t) + '" aria-pressed="' + (t === 'Alle') + '">' + esc(t) + '</button>').join('');
$('listSel').innerHTML = D.lists.map((l, i) => '<option value="' + i + '"' + (i === LAST ? ' selected' : '') + '>' + l.games.toLocaleString('de-DE') + ' Partien</option>').join('');
$('chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (!b) return; state.type = b.dataset.t; state.shown = 60; for (const x of $('chips').children) x.setAttribute('aria-pressed', x === b); render(); });
$('q').addEventListener('input', (e) => { state.q = e.target.value; state.shown = 60; render(); });
$('listSel').addEventListener('change', (e) => { state.list = +e.target.value; state.shown = 60; render(); });
$('more').addEventListener('click', () => { state.shown += 60; render(); });
function sortBy(th) { if (!th || th.dataset.k === 'trend') return; const k = th.dataset.k; if (state.sort === k) state.dir *= -1; else { state.sort = k; state.dir = (k === 'n' || k === 't' || k === 'rank') ? 1 : -1; } render(); }
$('head').addEventListener('click', (e) => sortBy(e.target.closest('th')));
$('head').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(e.target.closest('th')); } });
function toggle(tr) { if (!tr || !tr.dataset.n) return; state.open = state.open === tr.dataset.n ? null : tr.dataset.n; render(); }
$('body').addEventListener('click', (e) => toggle(e.target.closest('tr.row')));
$('body').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const tr = e.target.closest('tr.row'); if (tr) { e.preventDefault(); toggle(tr); } } });

// Vergleichsspiele
(function () {
  const B = D.bench;
  if (!B.length) { $('benchSec').hidden = true; return; }
  let g = 0, w = 0, e = 0, s = 0, v = 0;
  B.forEach(r => { g += r.n; w += r.w; e += r.e; s += r.s * r.n; });
  $('benchNote').textContent = 'Ein trainierter Sitz (Profil und beste Persona der Liga) spielt gegen untrainierte Standard-Bots an Tischen mit 2, 3, 4 und 6 Sitzen. Ohne Vorsprung wäre die Siegquote 1/Sitze. Jeder Vergleich hat nur etwa 80 Spiele und schwankt entsprechend (± 5 Prozentpunkte). Zusammen: ' + w + ' Siege in ' + g + ' Spielen bei ' + e.toFixed(1) + ' erwarteten, mittlerer Platzierungswert ' + (s / g >= 0 ? '+' : '−') + Math.abs(s / g).toFixed(3) + '.';
  $('benchTable').innerHTML = '<thead><tr><th>Nach Partien</th><th>Persona</th><th class="r">Spiele</th><th class="r">Siegquote</th><th class="r">Erwartung</th><th class="r">Platzierung</th></tr></thead><tbody>'
    + B.map(r => '<tr><td class="num">' + r.g.toLocaleString('de-DE') + '</td><td>' + esc(r.p) + '</td><td class="r num">' + r.n + '</td><td class="r num ' + (r.w > r.e ? 'pos' : 'neg') + '">' + (100 * r.w / r.n).toFixed(1) + ' %</td><td class="r num dim">' + (100 * r.e / r.n).toFixed(1) + ' %</td><td class="r num ' + cls(r.s) + '">' + fmt(r.s, 3) + '</td></tr>').join('') + '</tbody>';
})();
(function () {
  const A = D.analyse; if (!A || !A.zeilen) return;
  $('analyseSec').hidden = false; $('analyseTitle').textContent = A.titel || 'Woher kommt der Vorsprung?'; $('analyseNote').textContent = A.notiz || '';
  $('analyseTable').innerHTML = '<thead><tr><th>Variante</th><th class="r">Siege</th><th class="r">Erwartet</th><th class="r">Platzierung</th></tr></thead><tbody>'
    + A.zeilen.map(r => '<tr><td>' + esc(r.label) + '</td><td class="r num">' + r.siege + ' / ' + r.partien + '</td><td class="r num dim">' + r.erwartet + '</td><td class="r num ' + cls(r.platzierung) + '">' + fmt(r.platzierung, 3) + '</td></tr>').join('') + '</tbody>';
})();
render();
</script>
`;
fs.writeFileSync(out, html, { encoding: 'utf-8' });
console.log(`✓ ${path.relative(process.cwd(), out)} (${Math.round(html.length / 1024)} KB, ${cards.length} Karten, ${lists.length} Listen, ${bench.length} Vergleiche)`);
