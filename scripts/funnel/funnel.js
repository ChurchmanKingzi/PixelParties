#!/usr/bin/env node
'use strict';
// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES – SPIELER-TRICHTER, AUSWERTUNG (laeuft beim Betreiber, nicht im Spiel)
//
//  Holt den Bericht von  <PP_URL>/api/funnel/report  (Header x-funnel-token = FUNNEL_TOKEN) und zeigt ihn an.
//  Das Token bleibt auf deinem Rechner: der Browser spricht nur mit diesem lokalen Werkzeug (127.0.0.1), nie direkt mit dem Spiel.
//
//    PP_URL=https://pixelpartiestcg.com FUNNEL_TOKEN=... node scripts/funnel/funnel.js            Oberflaeche: http://127.0.0.1:8787
//    ... node scripts/funnel/funnel.js --text 14                                                 Tabelle im Terminal (letzte 14 Tage)
//    ... node scripts/funnel/funnel.js --json 30 > funnel.json                                   Rohdaten
//    ... node scripts/funnel/funnel.js --export 30 ./funnel-export                               sechs flache JSON-Dateien (Zeilenlisten) fuer das Claude-Dashboard
//
//  Statt der Umgebungsvariablen geht auch eine Datei ~/.pp-funnel.json: { "url": "...", "token": "..." }.
//  Auf dem Server selbst (Token steht dort in .env): PP_URL=http://127.0.0.1:3000.
//  Das Token legst du in der .env des Servers an:  FUNNEL_TOKEN=<mindestens 24 zufaellige Zeichen>  (z. B. `openssl rand -hex 24`).
// ═══════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.pp-funnel.json'), 'utf8')); } catch { /* optional */ }
const URL_ = (process.env.PP_URL || cfg.url || '').replace(/\/+$/, ''), TOKEN = process.env.FUNNEL_TOKEN || cfg.token || '';
const PORT = Number(process.env.PORT) || 8787;
if (!URL_ || !TOKEN) { console.error('PP_URL und FUNNEL_TOKEN fehlen (Umgebung oder ~/.pp-funnel.json). Kopfkommentar dieser Datei lesen.'); process.exit(1); }

async function fetchReport(fromMs, toMs) {
  const r = await fetch(`${URL_}/api/funnel/report?from=${fromMs}&to=${toMs}`, { headers: { 'x-funnel-token': TOKEN } });
  if (r.status === 404) throw new Error('404: auf dem Server ist FUNNEL_TOKEN nicht gesetzt (oder die Version ist noch nicht ausgerollt).');
  if (r.status === 401) throw new Error('401: Token stimmt nicht.');
  if (!r.ok) throw new Error('Server antwortet ' + r.status);
  return r.json();
}
const days = (d) => { const to = Date.now(); return [to - d * 86400000, to]; };
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '–';

function text(R) {
  const L = [], pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
  L.push(`Zeitraum: ${new Date(R.from).toISOString().slice(0, 10)} bis ${new Date(R.to).toISOString().slice(0, 10)} (UTC, Tageszaehler)`);
  const land = (R.steps[0] || {}).count || 0;
  L.push('', pad('Schritt', 62) + num('Anzahl', 8) + num('von Landing', 13));
  for (const s of R.steps) L.push(pad(s.label, 62) + num(s.count, 8) + num(pct(s.count, land), 13));
  L.push('', 'Tutorial-Missionen:  gestartet (je Sitzung) → erstmals geschafft (je Konto)');
  for (const t of R.tutorial) L.push(`  Mission ${t.n}: ${num(t.started, 5)} → ${num(t.completed, 5)}   (${pct(t.completed, t.started)})`);
  const s = R.signups;
  L.push('', `Konten angelegt: ${s.total}`, `  aus einer Gast-Sitzung, Gast hatte CPU-Partien gespielt: ${s.viaGuestPlayed}`, `  aus einer Gast-Sitzung, nichts gespielt: ${s.viaGuestOnly}`, `  nicht aus einer Gast-Sitzung (direkt oder spaeter wiedergekommen): ${s.direct}`, `  Weg: Formular ${s.byMethod.form}, Gast-Fenster ${s.byMethod.guest_modal}, Google ${s.byMethod.google}`);
  L.push('', `Gast-Partien beendet: ${R.guestGames.games}, davon gewonnen: ${R.guestGames.wins}`);
  L.push('', 'Quellen (utm_source bzw. Referrer-Host der Sitzung):');
  for (const [k, v] of Object.entries(R.bySource).sort((a, b) => (b[1].landing || 0) - (a[1].landing || 0))) L.push(`  ${pad(k, 18)} Landing ${num(v.landing || 0, 5)}  Gast ${num(v.guest || 0, 5)}  Tutorial ${num(v.tutorial_start || 0, 5)}  Gast-Partie ${num(v.cpu_guest || 0, 5)}  Konto ${num(v.signup_done || 0, 4)}`);
  L.push('', 'Hinweis: Es werden nur Zaehler gespeichert, keine IDs - es gibt keine eindeutigen Besucher.');
  return L.join('\n');
}

function exportFiles(R, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const land = (R.steps[0] || {}).count || 0, w = (name, rows) => fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(rows, null, 1));
  w('funnel_steps', R.steps.map((s, i) => ({ order: i + 1, step: s.label, count: s.count, share_of_landing_pct: land ? Math.round(1000 * s.count / land) / 10 : null })));
  w('funnel_tutorial', R.tutorial.map(t => ({ mission: 'Mission ' + t.n, started: t.started, completed: t.completed, completion_pct: t.started ? Math.round(1000 * t.completed / t.started) / 10 : null })));
  const S = R.signups;
  w('funnel_signups', [['Gast-Sitzung, CPU-Partien gespielt', S.viaGuestPlayed], ['Gast-Sitzung, nichts gespielt', S.viaGuestOnly], ['Nicht aus Gast-Sitzung', S.direct]].map(([group, count]) => ({ group, count })));
  w('funnel_sources', Object.entries(R.bySource).map(([source, v]) => ({ source, landing: v.landing || 0, guest: v.guest || 0, tutorial: v.tutorial_start || 0, guest_game: v.cpu_guest || 0, accounts: v.signup_done || 0 })));
  const dm = {}; R.daily.forEach(r => { (dm[r.day] = dm[r.day] || { day: r.day, landing: 0, guest: 0, tutorial: 0, accounts: 0 })[{ landing: 'landing', guest_start: 'guest', tutorial_start: 'tutorial', signup_done: 'accounts' }[r.ev]] = r.c; });
  w('funnel_daily', Object.values(dm).sort((a, b) => a.day.localeCompare(b.day)));
  w('funnel_range', [{ from: new Date(R.from).toISOString().slice(0, 10), to: new Date(R.to).toISOString().slice(0, 10), guest_games_finished: R.guestGames.games, guest_games_won: R.guestGames.wins, accounts_total: S.total, accounts_via_form: S.byMethod.form, accounts_via_guest_window: S.byMethod.guest_modal, accounts_via_google: S.byMethod.google }]);
  console.log('Geschrieben nach', path.resolve(dir), '- sechs Dateien (funnel_*.json)');
}
const args = process.argv.slice(2);
if (args[0] === '--export') {
  const [f, t] = days(Number(args[1]) || 7);
  fetchReport(f, t).then(R => exportFiles(R, args[2] || './funnel-export')).catch(e => { console.error(e.message); process.exit(1); });
} else if (args[0] === '--text' || args[0] === '--json') {
  const [f, t] = days(Number(args[1]) || 7);
  fetchReport(f, t).then(R => console.log(args[0] === '--json' ? JSON.stringify(R, null, 1) : text(R))).catch(e => { console.error(e.message); process.exit(1); });
} else {
  const PAGE = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/data') {
      try { const d = Number(u.searchParams.get('days')) || 7; const [f, t] = days(d); const R = await fetchReport(f, t); res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(R)); }
      catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(PAGE);
  }).listen(PORT, '127.0.0.1', () => console.log(`Funnel-Oberflaeche: http://127.0.0.1:${PORT}  (Quelle: ${URL_})`));
}
