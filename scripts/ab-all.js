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
//    node scripts/ab-all.js --ablate tutorPickRules --tag ohne-tutor
//                                               → Ablation: Kanal abklemmen und messen
//    node scripts/ab-all.js --conf-cap 0.4 --tag cap040
//                                               → Profil-Gewicht deckeln und messen
//    node scripts/ab-all.js --watch             → Zwischenstand live mitlesen
//    node scripts/ab-all.js --watch --interval 15
//    node scripts/ab-all.js --report            → nur Bericht, nichts spielen
//    node scripts/ab-all.js --write-gates       → Vorschau: abResult aus den Rohdaten
//    node scripts/ab-all.js --write-gates --apply   → und schreiben
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

// ── VARIANTEN-ERKENNUNG (v574) ───────────────────────────────────────
// Der Lauf vom 21.8. hat 12 Decks à 400 Spiele lang gemessen, OHNE dass
// PP_PROFILE_OFF im Kindprozess ankam — in keinem der 12 Logs steht eine
// einzige „ABLATION"-Zeile, obwohl 40 von 42 Profilen tutorPickRules
// tragen. Gemessen wurde also erneut das VOLLE Profil, und das Ergebnis
// landete zu allem Ueberfluss als `abResult` im Profil-JSON und damit im
// Deployment-Gate. Drei Riegel dagegen:
//
//   1. Kanaele werden mit `--ablate` gesetzt, nicht ueber die Shell.
//      `VAR=wert befehl` gibt es unter Windows nicht — genau die Falle.
//      Ein geerbtes PP_PROFILE_OFF wird weiter akzeptiert und gemeldet.
//   2. Jede Abweichung von der Grundkonfiguration ist eine VARIANTE.
//      Ohne `--tag` bricht der Lauf ab (exit 2) — auch bei --list,
//      --report und --watch, denn sonst laese man die Dateien der
//      Grundmessung unter der Ueberschrift der Variante.
//   3. Varianten schreiben KEIN abResult (PP_AB_NO_PROFILE_WRITE=1 an
//      die Kindprozesse; server.js prueft zusaetzlich selbst).
const ABLATE = (getArg('--ablate', '') || process.env.PP_PROFILE_OFF || '')
  .split(',').map(s => s.trim()).filter(Boolean).join(',');
const CONF_CAP = (getArg('--conf-cap', '') || process.env.PP_PROFILE_CONF_CAP || '').trim();
const VARIANTEN = [];
if (ABLATE) VARIANTEN.push(`Ablation=${ABLATE}`);
if (CONF_CAP) VARIANTEN.push(`conf-cap=${CONF_CAP}`);
if (!FAST) VARIANTEN.push('volles Suchbudget (--fast 0)');
if (HEAP !== 4096) VARIANTEN.push(`Heap=${HEAP}`);
const IST_VARIANTE = VARIANTEN.length > 0;
const REPORT_ONLY = hasFlag('--report');
const LIST_ONLY = hasFlag('--list');
// --watch: reiner Beobachter neben einem laufenden Lauf. Spielt nichts,
// startet nichts, schreibt KEINE Berichtsdateien — liest nur die
// Ergebnisdateien und zeichnet die Tabelle neu. Genau dafuer taugt das
// jsonl-Format: jedes fertige Spiel wird sofort angehaengt.
const WATCH = hasFlag('--watch');
const INTERVAL = Math.max(5, parseInt(getArg('--interval', '30'), 10));
// --write-gates: `abResult` in allen Profilen aus den Rohdaten der
// Grundmessung neu berechnen. Ohne --apply nur Vorschau.
const WRITE_GATES = hasFlag('--write-gates');
const APPLY = hasFlag('--apply');

// ── EICHZEILE + RIEGEL (v574) ────────────────────────────────────────
// Die Zeile laeuft IMMER, auch ohne Variante. Ohne diese Nullprobe ist
// „keine ABLATION-Meldung im Log" nicht von „Log unvollstaendig" zu
// unterscheiden — daran ist der 21.8.-Lauf still gescheitert.
console.log(`[ab-all] Konfiguration: ${IST_VARIANTE ? VARIANTEN.join(' · ') : 'GRUNDMESSUNG (keine Variante)'}`
  + ` · Tag: ${TAG || '—'} · abResult-Schreiben: ${IST_VARIANTE ? 'AUS' : 'AN'}`);
if (IST_VARIANTE && !TAG) {
  const vorschlag = ABLATE ? 'ohne-' + slugTag(ABLATE.split(',')[0])
    : CONF_CAP ? 'cap' + CONF_CAP.replace(/[^0-9]/g, '')
    : !FAST ? 'vollbudget' : 'variante';
  console.error('[ab-all] ABBRUCH: Variantenlauf ohne --tag.');
  console.error(`[ab-all]   Variante: ${VARIANTEN.join(' · ')}`);
  console.error('[ab-all]   Ohne Kuerzel liefen die Ergebnisse in dieselben Dateien wie die');
  console.error('[ab-all]   Grundmessung und waeren nicht mehr auseinanderzuhalten.');
  console.error(`[ab-all]   → denselben Befehl noch einmal mit  --tag ${vorschlag}`);
  process.exit(2);
}
if (TAG && !IST_VARIANTE) {
  console.warn(`[ab-all] ⚠️  --tag ${TAG} gesetzt, aber KEINE Variante aktiv — dieser Lauf misst`);
  console.warn('[ab-all]    dieselbe Konfiguration wie die Grundmessung, nur in eigene Dateien.');
  console.warn('[ab-all]    Ablation gewollt? Dann --ablate <kanal> mitgeben (nicht ueber die Shell setzen).');
}
function slugTag(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12); }

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
      // Variante EXPLIZIT an das Kind reichen statt sich auf die Shell
      // zu verlassen (v574). Delete statt undefined: ein geerbtes
      // PP_PROFILE_OFF aus einer frueheren Sitzung darf nicht still
      // mitlaufen, wenn dieser Lauf keine Ablation ist.
      if (ABLATE) env.PP_PROFILE_OFF = ABLATE; else delete env.PP_PROFILE_OFF;
      if (CONF_CAP) env.PP_PROFILE_CONF_CAP = CONF_CAP; else delete env.PP_PROFILE_CONF_CAP;
      if (IST_VARIANTE) env.PP_AB_NO_PROFILE_WRITE = '1'; else delete env.PP_AB_NO_PROFILE_WRITE;
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      // Exploration hat im Messlauf nichts verloren (server.js ignoriert
      // sie in A/B ohnehin — hier zusätzlich entfernt, damit die Absicht
      // an der Aufrufstelle steht).
      delete env.PP_TRAIN_EXPLORE;

      const logStream = fs.createWriteStream(job.log, { flags: 'a' });
      logStream.write(`\n═══ Versuch ${attempts} — ${new Date().toISOString()} ═══\n`);
      logStream.write(`Konfiguration: ${IST_VARIANTE ? VARIANTEN.join(' · ') : 'GRUNDMESSUNG'}`
        + ` · Tag: ${TAG || '—'} · abResult: ${IST_VARIANTE ? 'wird NICHT geschrieben' : 'wird geschrieben'}\n`);
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
  zeilen.push(`  Konfiguration: ${IST_VARIANTE ? VARIANTEN.join(' · ') : 'GRUNDMESSUNG (keine Variante)'}`);
  // Woher die Zahlen kommen. Ohne diese Zeile sieht ein Bericht über den
  // laufenden Variantenlauf genauso aus wie einer über die Grundmessung —
  // der Kopf nennt zwar die Flags, aber nicht die Dateien, die sie
  // auswählen. Genau daran ist eine Runde verlorengegangen.
  zeilen.push(`  Gelesen aus: data/training/ab/<deck>${TAG ? '.' + TAG : ''}.jsonl`);
  if (IST_VARIANTE) zeilen.push('  → Variantenlauf: KEIN abResult in die Profile geschrieben.');
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

// ── GATES AUS DEN ROHDATEN ZURÜCKSCHREIBEN (v587) ────────────────────
//  Das `abResult` im Profil ist ABGELEITETE Größe: es lässt sich jederzeit
//  aus data/training/ab/<deck>.jsonl neu berechnen. Genau das rettet die
//  Lage nach einem `deploy.sh`, das data/cpu-profiles/ hart zurücksetzt —
//  data/training/ steht in der .gitignore und überlebt, die Gates nicht.
//  Deshalb ist dieser Befehl nach JEDEM Ausrollen der richtige Reflex,
//  nicht nur einmalig zur Reparatur.
//
//  Zwei Sicherungen: er läuft NUR auf der Grundmessung (kein Tag, keine
//  Variante — ein Variantenergebnis darf nie ins Deployment-Gate), und er
//  zeigt ohne `--apply` nur, was er täte.
const GATE_MIN_N = 50;   // dieselbe Schwelle, ab der der Loader das Gate beachtet
function schreibeGates(jobs) {
  if (IST_VARIANTE || TAG) {
    console.error('[ab-all] ABBRUCH: --write-gates arbeitet ausschließlich auf der Grundmessung.');
    console.error(`[ab-all]   Aktiv: ${[...VARIANTEN, TAG ? `Tag=${TAG}` : ''].filter(Boolean).join(' · ')}`);
    console.error('[ab-all]   Ein Variantenergebnis darf nie das Deployment-Gate setzen.');
    process.exit(2);
  }
  const b = (s, n) => String(s).padEnd(n);
  console.log(APPLY ? '[ab-all] GATES SCHREIBEN' : '[ab-all] GATES — VORSCHAU (nichts wird geschrieben; --apply führt aus)');
  console.log(`${b('Deck', 32)}${b('bisher', 16)}${b('aus Rohdaten', 20)}Wirkung im Loader`);
  console.log('─'.repeat(88));
  let geschrieben = 0, uebersprungen = 0, unveraendert = 0, quarantaene = 0;
  for (const job of jobs) {
    const { W, L, T } = bilanz(job.out);
    const n = W + L;
    const alt = job.vorher ? `${(100 * job.vorher.winrate).toFixed(1)}% n=${job.vorher.games}` : '—';
    if (n < GATE_MIN_N) {
      uebersprungen++;
      console.log(`${b(job.deck.slice(0, 31), 32)}${b(alt, 16)}${b(`nur ${n} Spiele`, 20)}übersprungen (< ${GATE_MIN_N})`);
      continue;
    }
    const p = W / n;
    // Datum aus der Datei, nicht von heute — der Stempel soll sagen, WANN
    // gemessen wurde, nicht wann nachgetragen wurde.
    let datum = new Date().toISOString().slice(0, 10);
    try { datum = fs.statSync(job.out).mtime.toISOString().slice(0, 10); } catch { /* Fallback heute */ }
    const neu = { winrate: Math.round(p * 1000) / 1000, wins: W, losses: L, ties: T, games: n, date: datum };
    const sperrt = neu.winrate < 0.48;
    if (sperrt) quarantaene++;
    const wirkung = sperrt ? 'QUARANTÄNE (Heuristik übernimmt)' : 'lädt normal';
    const gleich = job.vorher && job.vorher.winrate === neu.winrate && job.vorher.games === neu.games;
    if (gleich) unveraendert++;
    console.log(`${b(job.deck.slice(0, 31), 32)}${b(alt, 16)}${b(`${(100 * p).toFixed(1)}% n=${n}`, 20)}${wirkung}${gleich ? '  (unverändert)' : ''}`);
    if (!APPLY || gleich) continue;
    try {
      const profPath = path.join(PROFILE_DIR, job.profil);
      const prof = JSON.parse(fs.readFileSync(profPath, { encoding: 'utf-8' }));
      prof.abResult = neu;
      fs.writeFileSync(profPath, JSON.stringify(prof, null, 2), { encoding: 'utf-8' });
      geschrieben++;
    } catch (err) {
      console.error(`[ab-all]   ⚠️  ${job.profil}: ${err.message}`);
    }
  }
  console.log('─'.repeat(88));
  console.log(`[ab-all] ${jobs.length} Decks · ${quarantaene} davon unter 48 % → Quarantäne`
    + ` · ${uebersprungen} ohne ausreichende Rohdaten · ${unveraendert} bereits aktuell`);
  if (APPLY) {
    console.log(`[ab-all] ${geschrieben} Profil(e) geschrieben.`);
    console.log('[ab-all] HINWEIS: data/cpu-profiles/ ist getrackt — ein deploy.sh mit `git reset --hard`');
    console.log('[ab-all]   wirft das wieder weg. Entweder einchecken, oder diesen Befehl nach jedem');
    console.log('[ab-all]   Ausrollen erneut fahren (die Rohdaten in data/training/ überleben).');
  } else {
    console.log('[ab-all] Nichts geschrieben. Ausführen mit:  node scripts/ab-all.js --write-gates --apply');
  }
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

  if (WRITE_GATES) { schreibeGates(jobs); return; }

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
