#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — A/B ÜBER ALLE PROFILE (Spiegel-Bestandsaufnahme)
//
//  Lässt JEDES trainierte Deck-Profil gegen seine eigene untrainierte
//  Form antreten: gleiches Deck auf beiden Seiten, eine Seite mit
//  Profil, eine mit dem nackten MCTS-Piloten. Die Deckstärke kürzt
//  sich damit heraus — gemessen wird ausschließlich, was das Profil
//  taugt.
//
//  Ein Aufruf für alle Decks, mehrere Läufe PARALLEL, unterbrechbar
//  und fortsetzbar.
//
//    node scripts/ab-all.js                     → alle Profile, 200 Spiele, 3 Jobs
//    node scripts/ab-all.js --games 400
//    node scripts/ab-all.js --jobs 2            → weniger parallel (RAM!)
//    node scripts/ab-all.js --only "Deepsea,Mawstruck"
//    node scripts/ab-all.js --skip "Big Stomp"
//    node scripts/ab-all.js --fast 0            → volles Suchbudget (3-4× langsamer)
//    PP_PROFILE_OFF=tutorPickRules node scripts/ab-all.js --tag ohne-tutor \
//                                               → Ablation: Kanal abklemmen und messen
//    node scripts/ab-all.js --watch             → Zwischenstand live mitlesen
//    node scripts/ab-all.js --watch --interval 15
//    node scripts/ab-all.js --report            → nur Bericht, nichts spielen
//    node scripts/ab-all.js --list              → nur auflisten, was anstünde
//
//  ── WARUM PARALLEL DIE RAM-FRAGE IST, NICHT DIE KERN-FRAGE ────────
//  Das Heap-Limit ist bei diesem Projekt ein QUALITÄTSparameter: der
//  Heap-Wächter bricht MCTS ab 60 % des Limits ab, die CPU entscheidet
//  dann ohne Suche. Ein Worker mit halbem Heap pilotiert also messbar
//  schlechter — und Läufe mit verschiedenen Limits sind nicht
//  vergleichbar. Deshalb bekommt JEDER Worker dieselben 4096 MB
//  (`--heap` überschreibt das nur, wenn man weiß, was man tut), und
//  die Parallelität wird stattdessen über `--jobs` begrenzt.
//
//  ── ZWEI FALLEN, DIE HIER SCHON ENTSCHÄRFT SIND ───────────────────
//  1. QUARANTÄNE-SCHLEIFE: Der Profil-Loader lädt ein Profil nicht
//     mehr, dessen `abResult` unter 48 % liegt. Ohne Gegenmaßnahme
//     würde ein zweiter A/B-Lauf für so ein Deck Baseline GEGEN
//     Baseline messen, ~50 % herausbekommen und das schädliche Profil
//     damit stillschweigend rehabilitieren. Dieses Skript setzt
//     deshalb `PP_FORCE_PROFILES=1` — gemessen wird immer das echte
//     Profil.
//  2. ABGEBROCHENE LÄUFE SIND NICHT REPRÄSENTATIV: der Bericht weist
//     die Spielzahl je Deck aus und markiert alles unter der Zielzahl
//     ausdrücklich als unvollständig.
//
//  Ergebnis je Deck landet zusätzlich als `abResult` im Profil-JSON
//  (das macht server.js am Ende jedes A/B-Batches selbst) und der
//  Gesamtbericht unter data/training/ab/REPORT-<stempel>.txt/.json
// ═══════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DECK_DIR = path.join(ROOT, 'data', 'SampleDecks');
const PROFILE_DIR = path.join(ROOT, 'data', 'cpu-profiles');
const OUT_DIR = path.join(ROOT, 'data', 'training', 'ab');

// ── CLI ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(name);

const GAMES = parseInt(getArg('--games', '200'), 10);
const JOBS = Math.max(1, parseInt(getArg('--jobs', String(Math.min(3, Math.max(1, os.cpus().length - 1)))), 10));
const HEAP = parseInt(getArg('--heap', '4096'), 10);
const FAST = getArg('--fast', '1') !== '0';
const MAX_ATTEMPTS = parseInt(getArg('--attempts', '10'), 10);
const ONLY = getArg('--only', '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP = getArg('--skip', '').split(',').map(s => s.trim()).filter(Boolean);
// --tag: haengt ein Kuerzel an die Ergebnisdateien. Noetig fuer
// Ablations-Laeufe (PP_PROFILE_OFF=…), damit sie nicht in denselben
// Topf laufen wie die Grundmessung.
const TAG = getArg('--tag', '').trim().replace(/[^A-Za-z0-9_-]/g, '');
const REPORT_ONLY = hasFlag('--report');
const LIST_ONLY = hasFlag('--list');
// --watch: reiner Beobachter neben einem laufenden Lauf. Spielt nichts,
// startet nichts, schreibt KEINE Berichtsdateien — liest nur die
// Ergebnisdateien und zeichnet die Tabelle neu. Genau dafuer taugt das
// jsonl-Format: jedes fertige Spiel wird sofort angehaengt.
const WATCH = hasFlag('--watch');
const INTERVAL = Math.max(5, parseInt(getArg('--interval', '30'), 10));

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ── Deckliste: jedes Profil, zu dem es ein Sample-Deck gibt ──────────
function sampleDeckNames() {
  return fs.readdirSync(DECK_DIR).filter(f => f.endsWith('.txt')).map(f => {
    const t = fs.readFileSync(path.join(DECK_DIR, f), { encoding: 'utf-8' });
    const m = t.match(/^Name:\s*(.+)$/m);
    return m ? m[1].trim() : f.replace(/\.txt$/, '');
  });
}

function buildJobs() {
  const decks = sampleDeckNames();
  const jobs = [];
  const ohneDeck = [];
  for (const f of fs.readdirSync(PROFILE_DIR).filter(f => f.endsWith('.json')).sort()) {
    let prof;
    try { prof = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, f), { encoding: 'utf-8' })); }
    catch (err) { console.error(`[ab-all] ${f} nicht lesbar: ${err.message}`); continue; }
    const name = prof.deck;
    if (!name) continue;
    // Das Sample-Deck muss existieren — sonst bricht server.js mit exit 1 ab.
    const treffer = decks.find(d => norm(d).includes(norm(name)) || norm(name).includes(norm(d)));
    if (!treffer) { ohneDeck.push(name); continue; }
    if (ONLY.length && !ONLY.some(o => norm(name).includes(norm(o)))) continue;
    if (SKIP.length && SKIP.some(s => norm(name).includes(norm(s)))) continue;
    jobs.push({
      deck: name,
      profil: f,
      slug: slug(name),
      out: path.join(OUT_DIR, `${slug(name)}${TAG ? '.' + TAG : ''}.jsonl`),
      log: path.join(OUT_DIR, `${slug(name)}${TAG ? '.' + TAG : ''}.log`),
      // Vorheriges Urteil, damit der Bericht Veränderungen zeigen kann
      vorher: prof.abResult || null,
    });
  }
  if (ohneDeck.length) {
    console.warn(`[ab-all] ⚠️  ${ohneDeck.length} Profil(e) ohne passendes Sample-Deck, übersprungen: ${ohneDeck.join(', ')}`);
  }
  return jobs;
}

// ── Bilanz einer Ergebnisdatei (identische Zählweise wie server.js) ──
function bilanz(file) {
  let W = 0, L = 0, T = 0, zeilen = 0;
  let text;
  try { text = fs.readFileSync(file, { encoding: 'utf-8' }); } catch { return { W, L, T, zeilen }; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    zeilen++;
    try {
      const g = JSON.parse(line);
      if (g.outcome === 1) W++; else if (g.outcome === 0) L++; else T++;
    } catch { /* halbe Zeile nach hartem Abbruch — zählt nicht */ }
  }
  return { W, L, T, zeilen };
}

const wald = (W, L) => {
  const n = W + L;
  if (!n) return { n: 0, p: 0, ci: 0 };
  const p = W / n;
  return { n, p, ci: 1.96 * Math.sqrt(p * (1 - p) / n) };
};

/** Urteil in derselben Sprache wie die Quarantäne-Schwelle im Loader. */
function urteil(W, L, ziel) {
  const { n, p, ci } = wald(W, L);
  if (n < 20) return { text: 'zu wenig Daten', kurz: '—' };
  if (n < ziel) return { text: `unvollständig (${n}/${ziel})`, kurz: '?' };
  if (p - ci > 0.5) return { text: 'HILFT (CI über 50 %)', kurz: '++' };
  if (p < 0.48 && n >= 50) return { text: 'SCHÄDLICH → Quarantäne', kurz: '--' };
  if (p + ci < 0.5) return { text: 'schadet (CI unter 50 %)', kurz: '-' };
  return { text: 'kein Nachweis (CI schließt 50 % ein)', kurz: '0' };
}

/** Eine Zeile Gesamtstand über ALLE Decks — die Nordstern-Zahl im Werden. */
function zwischenstand(jobs) {
  let spiele = 0, mitDaten = 0, summe = 0;
  for (const j of jobs) {
    const { W, L, T } = bilanz(j.out);
    spiele += W + L + T;
    if (W + L >= 20) { mitDaten++; summe += W / (W + L); }
  }
  const mittel = mitDaten > 0 ? `${(100 * summe / mitDaten).toFixed(1)} % über ${mitDaten} Decks` : 'noch keine belastbaren Decks';
  return `gesamt ${spiele}/${jobs.length * GAMES} Spiele · Spiegel-Winrate im Mittel: ${mittel}`;
}

// ── Ein Deck fahren (mit Wiederanlauf, resumiert über die Zeilenzahl) ─
function fahre(job) {
  return new Promise((resolve) => {
    let attempts = 0;
    const starte = () => {
      const { zeilen } = bilanz(job.out);
      if (zeilen >= GAMES) return resolve({ job, ok: true, attempts });
      if (attempts >= MAX_ATTEMPTS) return resolve({ job, ok: false, attempts, grund: 'zu viele Neustarts' });
      attempts++;
      const env = {
        ...process.env,
        PP_TRAIN: '1',
        PP_TRAIN_AB: '1',
        PP_TRAIN_DECK: job.deck,
        PP_TRAIN_GAMES: String(GAMES),
        PP_TRAIN_HORIZON: '1',
        PP_TRAIN_OUT: job.out,
        PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
        // Siehe Kopf, Falle 1 — ohne das misst ein zweiter Lauf für ein
        // quarantänisiertes Profil Baseline gegen Baseline.
        PP_FORCE_PROFILES: '1',
      };
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      // Exploration hat im Messlauf nichts verloren (server.js ignoriert
      // sie in A/B ohnehin — hier zusätzlich entfernt, damit die Absicht
      // an der Aufrufstelle steht).
      delete env.PP_TRAIN_EXPLORE;

      const logStream = fs.createWriteStream(job.log, { flags: 'a' });
      logStream.write(`\n═══ Versuch ${attempts} — ${new Date().toISOString()} ═══\n`);
      const kind = spawn(process.execPath,
        [`--max-old-space-size=${HEAP}`, '--expose-gc', path.join(ROOT, 'server.js')],
        { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      kind.stdout.pipe(logStream);
      kind.stderr.pipe(logStream);
      kind.on('exit', (code) => {
        logStream.end();
        if (code === 2) return resolve({ job, ok: false, attempts, grund: 'Konfiguration (exit 2)' });
        setTimeout(starte, 250);      // Resume greift über die Zeilenzahl
      });
      kind.on('error', (err) => {
        logStream.end();
        resolve({ job, ok: false, attempts, grund: err.message });
      });
    };
    starte();
  });
}

// ── Bericht ──────────────────────────────────────────────────────────
function bericht(jobs, dauerMs, opt = {}) {
  const schreiben = opt.schreiben !== false;
  const kompakt = !!opt.kompakt;
  const zeilen = [];
  const daten = [];
  for (const job of jobs) {
    const { W, L, T, zeilen: n } = bilanz(job.out);
    const { p, ci } = wald(W, L);
    const u = urteil(W, L, GAMES);
    daten.push({
      deck: job.deck, profil: job.profil, wins: W, losses: L, ties: T, spiele: n,
      winrate: W + L ? Math.round(p * 1000) / 1000 : null,
      ci: Math.round(ci * 1000) / 1000, urteil: u.text,
      vorher: job.vorher ? job.vorher.winrate : null,
    });
  }
  daten.sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));

  const b = (s, n) => String(s).padEnd(n);
  zeilen.push('═══════════════════════════════════════════════════════════════════════════');
  zeilen.push(`  A/B-SPIEGEL — ALLE PROFILE GEGEN IHRE UNTRAINIERTE FORM`);
  zeilen.push(`  ${new Date().toISOString()} · Ziel ${GAMES} Spiele/Deck · ${FAST ? 'reduziertes' : 'volles'} Suchbudget`);
  if (TAG) zeilen.push(`  Lauf-Kuerzel: ${TAG}`);
  if (process.env.PP_PROFILE_OFF) zeilen.push(`  ABLATION — abgeklemmt: ${process.env.PP_PROFILE_OFF}`);
  if (dauerMs != null) zeilen.push(`  Laufzeit: ${(dauerMs / 3600000).toFixed(1)} h`);
  zeilen.push('═══════════════════════════════════════════════════════════════════════════');
  zeilen.push(`${b('Deck', 34)}${b('W-L-T', 14)}${b('Winrate', 18)}Urteil`);
  zeilen.push('───────────────────────────────────────────────────────────────────────────');
  let unberuehrt = 0;
  for (const d of daten) {
    // Im Beobachter-Modus die noch gar nicht begonnenen Decks zu EINER
    // Zeile buendeln — sonst scrollt die interessante Haelfte weg.
    if (kompakt && d.spiele === 0) { unberuehrt++; continue; }
    const wr = d.winrate == null ? '—'
      : `${(100 * d.winrate).toFixed(1)}% ±${(100 * d.ci).toFixed(1)}`;
    zeilen.push(`${b(d.deck.slice(0, 33), 34)}${b(`${d.wins}-${d.losses}-${d.ties}`, 14)}${b(wr, 18)}${d.urteil}`);
  }
  if (unberuehrt > 0) zeilen.push(`${b('… ' + unberuehrt + ' Decks noch nicht begonnen', 34)}`);
  zeilen.push('───────────────────────────────────────────────────────────────────────────');
  const hilft = daten.filter(d => d.urteil.startsWith('HILFT')).length;
  const schaedlich = daten.filter(d => d.urteil.startsWith('SCHÄDLICH')).length;
  const schadet = daten.filter(d => d.urteil.startsWith('schadet')).length;
  const ohne = daten.filter(d => d.urteil.startsWith('kein Nachweis')).length;
  const offen = daten.filter(d => d.urteil.startsWith('unvollständig') || d.urteil.startsWith('zu wenig')).length;
  zeilen.push(`  ${hilft} helfen · ${ohne} ohne Nachweis · ${schadet} schaden · ${schaedlich} in Quarantäne · ${offen} unvollständig`);
  const messbar = daten.filter(d => d.winrate != null);
  if (messbar.length) {
    const mittel = messbar.reduce((s, d) => s + d.winrate, 0) / messbar.length;
    zeilen.push(`  MITTLERE SPIEGEL-WINRATE (Nordstern): ${(100 * mittel).toFixed(1)} % über ${messbar.length} Decks`);
  }
  zeilen.push('═══════════════════════════════════════════════════════════════════════════');
  zeilen.push('  „kein Nachweis" heißt NICHT „wirkungslos" — bei n=200 ist ±7 Punkte normal.');
  zeilen.push('  Decks nahe der Entscheidungsgrenze mit --games 600 nachmessen.');

  const text = zeilen.join('\n');
  console.log('\n' + text + '\n');
  if (!schreiben) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = (TAG ? TAG + '-' : '') + new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(OUT_DIR, `REPORT-${stamp}.txt`), text, { encoding: 'utf-8' });
  fs.writeFileSync(path.join(OUT_DIR, `REPORT-${stamp}.json`),
    JSON.stringify({ erstellt: new Date().toISOString(), ziel: GAMES, fast: FAST, decks: daten }, null, 2),
    { encoding: 'utf-8' });
  console.log(`Bericht → data/training/ab/REPORT-${stamp}.txt (+ .json)`);
}

// ── Hauptlauf ────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const jobs = buildJobs();
  if (jobs.length === 0) { console.error('[ab-all] Keine Profile zu messen.'); process.exit(1); }

  if (WATCH) {
    const zeichne = () => {
      if (process.stdout.isTTY) console.clear();
      console.log(`[ab-all] BEOBACHTER · ${new Date().toLocaleTimeString('de-DE')} · alle ${INTERVAL} s · Strg-C beendet nur die Anzeige`);
      console.log(`[ab-all] ${zwischenstand(jobs)}`);
      bericht(jobs, null, { schreiben: false, kompakt: true });
    };
    zeichne();
    setInterval(zeichne, INTERVAL * 1000);
    return;
  }

  if (REPORT_ONLY) { bericht(jobs, null); return; }

  const offen = jobs.filter(j => bilanz(j.out).zeilen < GAMES);
  const fertig = jobs.length - offen.length;

  // Speicher-Ehrlichkeit: 4096 MB je Worker sind eine OBERGRENZE, im
  // Normalbetrieb liegt ein Lauf bei 150-500 MB RSS. Gefährlich wird es
  // erst, wenn mehrere Worker GLEICHZEITIG in eine MCTS-Spitze laufen.
  const ramGB = os.totalmem() / 1024 ** 3;
  console.log(`[ab-all] ${jobs.length} Profile · ${fertig} bereits vollständig · ${offen.length} offen`);
  console.log(`[ab-all] ${JOBS} parallele Läufe · Heap ${HEAP} MB je Lauf · ${os.cpus().length} Kerne · ${ramGB.toFixed(1)} GB RAM`);
  if (JOBS * (HEAP / 1024) > ramGB - 1.5) {
    console.warn(`[ab-all] ⚠️  ${JOBS} × ${HEAP} MB übersteigt den freien Speicher. Das ist im Normalfall unkritisch`);
    console.warn(`[ab-all]    (ein Lauf braucht real 150-500 MB), aber zwei gleichzeitige MCTS-Spitzen können`);
    console.warn(`[ab-all]    einen Worker per OOM killen. Der Wiederanlauf fängt das ab — es kostet nur Zeit.`);
    console.warn(`[ab-all]    Bei häufigen Neustarts: --jobs ${Math.max(1, JOBS - 1)}.`);
  }
  const proSpiel = FAST ? 20 : 70;    // grobe Sekunden je Spiel
  const stunden = (offen.length * GAMES * proSpiel) / 3600 / JOBS;
  console.log(`[ab-all] Grobe Schätzung: ${stunden.toFixed(1)} h (${proSpiel} s/Spiel angenommen)`);

  if (LIST_ONLY) {
    offen.forEach(j => console.log(`   offen: ${j.deck} (${bilanz(j.out).zeilen}/${GAMES})`));
    return;
  }
  if (offen.length === 0) { console.log('[ab-all] Nichts zu tun — Bericht folgt.'); bericht(jobs, null); return; }

  const t0 = Date.now();
  let idx = 0, fertigGezaehlt = 0;
  const laufend = new Map();

  const fortschritt = setInterval(() => {
    // Nicht nur „wie viele Spiele", sondern der Zwischenstand — sonst
    // sieht man 16 Stunden lang Zahlen, aber kein Ergebnis.
    const zeilen = [...laufend.values()].map(j => {
      const { W, L, T } = bilanz(j.out);
      const { n, p } = wald(W, L);
      const stand = n > 0 ? ` (${(100 * p).toFixed(0)}%)` : '';
      return `${j.deck.slice(0, 22)} ${W + L + T}/${GAMES}${stand}`;
    });
    const min = ((Date.now() - t0) / 60000).toFixed(0);
    console.log(`[ab-all] ${min} min · fertig ${fertigGezaehlt}/${offen.length} · läuft: ${zeilen.join(' | ') || '—'}`);
    console.log(`[ab-all]    ${zwischenstand(jobs)}`);
  }, 60000);
  fortschritt.unref?.();

  async function arbeiter() {
    while (idx < offen.length) {
      const job = offen[idx++];
      laufend.set(job.slug, job);
      const r = await fahre(job);
      laufend.delete(job.slug);
      fertigGezaehlt++;
      const { W, L, T } = bilanz(job.out);
      const { p, ci } = wald(W, L);
      const u = urteil(W, L, GAMES);
      console.log(`[ab-all] ✔ ${job.deck}: ${W}W-${L}L-${T}T → ${(100 * p).toFixed(1)}% ±${(100 * ci).toFixed(1)} — ${u.text}`
        + (r.ok ? '' : `  (ABBRUCH: ${r.grund})`));
    }
  }

  await Promise.all(Array.from({ length: Math.min(JOBS, offen.length) }, arbeiter));
  clearInterval(fortschritt);
  bericht(jobs, Date.now() - t0);
})().catch(err => {
  console.error('[ab-all] ABBRUCH:', err && err.stack || err);
  process.exit(1);
});
