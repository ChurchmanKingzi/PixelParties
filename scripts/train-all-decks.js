#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — TRAIN ALL DECKS (Orchestrator)
//  Läuft nacheinander über alle Sample-Decks und führt pro Deck die
//  komplette Pipeline aus:
//    1. Datensammlung (spawnt server.js im PP_TRAIN-Modus, Profile AUS)
//    2. Profil-Training (scripts/train-deck-profile.js)
//
//  Vollständig idempotent & resumierbar: Die Sammlung pro Deck schreibt
//  in eine feste Datei (data/training/all/<slug>.jsonl). Bricht der
//  Lauf ab (Strg+C, Absturz, Neustart), einfach denselben Befehl noch
//  einmal ausführen — fertige Decks werden übersprungen, angefangene
//  setzen dank Resume-Mechanik des Batch-Runners fort.
//
//  Verwendung (aus dem Projekt-Root):
//    node scripts/train-all-decks.js                  → 300 Spiele/Deck, alle Decks
//    node scripts/train-all-decks.js --games 1000     → mehr Spiele pro Deck
//    node scripts/train-all-decks.js --only "Heal Burn,Bone Rush"
//    node scripts/train-all-decks.js --skip "Suicide Bombers"
//    node scripts/train-all-decks.js --list           → nur Decks auflisten
//    node scripts/train-all-decks.js --fast 0         → volles MCTS-Budget
//                                                       (Default: 1 = reduziert,
//                                                       3-4× Durchsatz)
//
//    node scripts/train-all-decks.js --collect-only   → nur sammeln (kein Profiltraining, nichts in data/cpu-profiles)
//    node scripts/train-all-decks.js --net 0          → Datensammlung mit dem alten Evaluator
//                                                       (Standard: Wertnetz, siehe scripts/train-net.js;
//                                                       Ausnahmeliste je Deck: data/cpu-value/net-aus.json)
//    node scripts/train-all-decks.js --games 10000 --segment 1000
//                                                     → große Sammlungen in Segmenten à 1000 Spiele
//                                                       (data/training/all-net/<deck>.seg/seg-0000.jsonl.gz …),
//                                                       fertige Segmente werden gepackt (--gzip 0 lässt sie roh);
//                                                       der Trainer liest den Ordner als EINE Iteration und dünnt auf
//                                                       --max-games N (Standard 8000) Spiele aus
//
//  Zeitbudget grob überschlagen: ~15-25 s/Spiel mit --fast 1 (Evaluator); mit Netz rund 10 s je Spiel und Kern. Bei 38
//  Decks × 300 Spielen sind das mehrere Tage Dauerlauf — deshalb ist
//  --only dein Freund: fang mit den Decks an, gegen die Spieler
//  tatsächlich antreten.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const zlib = require('zlib');
const { autoJobs } = require('./train-jobs');
const { netFuer, beschreibung: netBeschreibung } = require('./train-net');
const IO = require('./train-io');

const ROOT = path.join(__dirname, '..');
const DECK_DIR = path.join(ROOT, 'data', 'SampleDecks');
const OUT_ROOT = path.join(ROOT, 'data', 'training');
const outDirFor = (netOn) => path.join(OUT_ROOT, netOn ? 'all-net' : 'all');   // Netz- und Evaluator-Daten werden nie in einer Datei gemischt
const PROFILE_DIR = path.join(ROOT, 'data', 'cpu-profiles');

// ── CLI-Argumente ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const GAMES = parseInt(getArg('--games', '300'), 10);
const FAST = getArg('--fast', '1') !== '0';
// --explore ε: aktiviert die ε-Exploration der Datensammlung (siehe
// _cpu.js exploreRoll). Empfohlen 0.1–0.15 für Engine-Decks, deren
// Baseline-Pilot Teile des Decks nie anfasst.
const EXPLORE = parseFloat(getArg('--explore', '0')) || 0;
// --ab N: nach jedem erfolgreichen Profil-Training N Spiegel-Spiele
// (Profil vs Baseline, gleiches Deck) als automatischer Wirksamkeits-
// Nachweis. Ergebnis + 95%-CI landet im Konsolen-Log des Laufs.
const AB_GAMES = parseInt(getArg('--ab', '0'), 10) || 0;
// --opp-profiles: Datensammlung gegen trainierte Gegner (Self-Play-
// Iteration). Empfehlung: pro Generation eine frische Ausgabedatei.
const OPP_PROFILES = getArg('--opp-profiles', '0') === '1';
const NET_FLAG = getArg('--net', null);                       // '0' = aus, '1' = an (auch für Decks der Ausnahmeliste), sonst Standard
const SEGMENT = Math.max(2, parseInt(getArg('--segment', '1000'), 10) || 1000);   // Spiele je Segmentdatei
const GZIP = getArg('--gzip', '1') !== '0';
const MAX_GAMES = getArg('--max-games', null);                // an den Trainer durchgereicht (Standard dort: 8000)
const TRAINER_HEAP_MB = process.env.PP_TRAIN_TRAINER_HEAP_MB || '4096';
const COLLECT_ONLY = args.includes('--collect-only');         // nur sammeln, kein Profil trainieren (schreibt nichts nach data/cpu-profiles)
const LIST_ONLY = args.includes('--list');
const only = getArg('--only', null);
const skip = getArg('--skip', null);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Substring-Semantik wie beim PP_TRAIN_DECK-Matching im Batch-Runner:
// "--only 'Bone Rush'" trifft auch "Structure Deck Bone Rush".
const matchesAny = (deckName, set) => {
  if (!set) return false;
  const n = norm(deckName);
  for (const entry of set) if (n.includes(entry) || entry.includes(n)) return true;
  return false;
};
const onlySet = only ? new Set(only.split(',').map(norm)) : null;
const skipSet = skip ? new Set(skip.split(',').map(norm)) : null;

// ── Decks einsammeln ─────────────────────────────────────────────────
if (!fs.existsSync(DECK_DIR)) {
  console.error(`Kein SampleDecks-Ordner unter ${DECK_DIR}`);
  process.exit(1);
}
let decks = fs.readdirSync(DECK_DIR)
  .filter(f => f.endsWith('.txt'))
  .map(f => f.replace(/\.txt$/, ''))
  .sort();
if (onlySet) decks = decks.filter(d => matchesAny(d, onlySet));
if (skipSet) decks = decks.filter(d => !matchesAny(d, skipSet));

// ── Ablage je Deck ───────────────────────────────────────────────────
// Eine Datei `<deck>.jsonl`, solange die Sammlung in ein Segment passt; sonst ein Ordner `<deck>.seg/` mit `seg-0000.jsonl[.gz]` …
// (je SEGMENT Spiele). Segment k beginnt bei Gesamtspiel k × SEGMENT (`PP_TRAIN_GAME_OFFSET`), die Rotation von Gegner und Sitz läuft
// also durch alle Segmente wie in einer einzigen Datei. Fertige Segmente werden gepackt (Faktor ~9–10). Die Daten mit Netz liegen in
// `all-net`, die mit dem Evaluator in `all` — nie in einer Datei gemischt.
const segName = (k) => `seg-${String(k).padStart(4, '0')}.jsonl`;
function ablage(deck, netOn) {
  const dir = outDirFor(netOn), slug = norm(deck);
  const single = path.join(dir, `${slug}.jsonl`), segDir = path.join(dir, `${slug}.seg`);
  return { dir, single, segDir, segmented: GAMES > SEGMENT || fs.existsSync(segDir) };
}
// Spiele, die für das Deck schon vorliegen (Einzeldatei und/oder Segmente)
function vorhanden(a) {
  let n = fs.existsSync(a.single) ? IO.countLines(a.single) : 0;
  if (fs.existsSync(a.segDir)) for (const f of IO.segmentFiles(a.segDir)) n += IO.countLines(f);
  return n;
}

if (LIST_ONLY) {
  for (const d of decks) {
    const net = netFuer(d, { flag: NET_FLAG });
    const hier = vorhanden(ablage(d, net.on)), andere = vorhanden(ablage(d, !net.on));
    const prof = fs.existsSync(path.join(PROFILE_DIR, `${d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`));
    console.log(`${hier >= GAMES ? '✅' : hier > 0 ? '⏳' : '  '} ${d}  (${hier}/${GAMES} Spiele ${net.on ? 'mit Netz' : 'mit Evaluator'}${andere ? `, ${andere} im anderen System` : ''}${prof ? ', Profil vorhanden' : ''})`);
  }
  process.exit(0);
}

console.log(`═══ Training für ${decks.length} Decks — ${GAMES} Spiele/Deck, ${FAST ? 'reduziertes' : 'volles'} MCTS-Budget`
  + `${GAMES > SEGMENT ? `, Segmente à ${SEGMENT}` : ''} ═══`);

// Sammelt eine Datei bis `need` Spiele voll sind (Neustart nach Absturz; die Sammlung setzt über die Zeilenzahl fort). Gibt die Zahl der Spiele zurück.
function sammle(deck, file, need, offset, netEnv) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let attempts = 0;
  while (IO.countLines(file) < need && attempts < 10) {
    attempts++;
    const env = {
      ...process.env,
      PP_TRAIN: '1',
      PP_TRAIN_DECK: deck,
      PP_TRAIN_GAMES: String(need),
      PP_TRAIN_GAME_OFFSET: String(offset),
      PP_TRAIN_HORIZON: '1',
      PP_TRAIN_OUT: file,
      PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
      PP_TRAIN_JOBS: String(autoJobs()),   // parallele Sammlung (siehe scripts/train-jobs.js; PP_TRAIN_JOBS=1 = ein Prozess, PP_TRAIN_JOBS_MAX hebt den Deckel von 8)
      ...netEnv,
    };
    if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
    if (EXPLORE > 0) env.PP_TRAIN_EXPLORE = String(EXPLORE);
    if (OPP_PROFILES) env.PP_TRAIN_OPP_PROFILES = '1';
    const r = spawnSync(process.execPath,
      ['--max-old-space-size=4096', '--expose-gc', path.join(ROOT, 'server.js')],
      { cwd: ROOT, env, stdio: 'inherit' });
    if (r.status === 0) break;
    if (r.status === 3) { console.error('[all] Ausgabedatei zu groß — Abbruch ohne Neustart (siehe Meldung oben).'); break; }
    if (r.status === 4) { console.error('[all] Spiele brechen systematisch mit einem Fehler ab — Abbruch ohne Neustart (siehe Fehlermeldung oben).'); break; }
    console.error(`[all] server.js beendet mit Code ${r.status} — Neustart (Versuch ${attempts}/10, Resume greift)`);
  }
  return IO.countLines(file);
}

// Packt ein fertiges Segment (roh → .gz) und räumt die Reste der Sammlung weg.
function packe(file) {
  const gzFile = file + '.gz', tmp = gzFile + '.tmp';
  fs.writeFileSync(tmp, zlib.gzipSync(fs.readFileSync(file), { level: 6 }));
  fs.renameSync(tmp, gzFile);
  fs.unlinkSync(file);
  for (const rest of ['.inflight.json', '.done.json', '.crash.json']) { try { fs.unlinkSync(file + rest); } catch { /* war nicht da */ } }
}

let done = 0, failed = [];
for (const deck of decks) {
  const netR = netFuer(deck, { flag: NET_FLAG });
  const A = ablage(deck, netR.on);
  const netEnv = netR.env;
  const t0 = Date.now();
  fs.mkdirSync(A.dir, { recursive: true });
  console.log(netBeschreibung(deck, netR));

  // ── Schritt 1: Datensammlung (überspringen, wenn schon voll) ──
  let eingabe, have;
  if (!A.segmented) {
    eingabe = A.single;
    have = IO.countLines(eingabe);
    if (have < GAMES) {
      console.log(`\n━━━ [${++done}/${decks.length}] "${deck}" — sammle ${GAMES - have} weitere Spiele (${have} vorhanden) ━━━`);
      have = sammle(deck, eingabe, GAMES, 0, netEnv);
    } else {
      console.log(`\n━━━ [${++done}/${decks.length}] "${deck}" — ${have} Spiele vorhanden, Sammlung übersprungen ━━━`);
    }
  } else {
    eingabe = A.segDir;
    fs.mkdirSync(A.segDir, { recursive: true });
    // Eine frühere Einzeldatei ist Segment 0 (gleiche Spielindizes ab 0), sofern sie in ein Segment passt.
    if (fs.existsSync(A.single) && IO.segmentFiles(A.segDir).length === 0) {
      const n = IO.countLines(A.single);
      if (n > SEGMENT) { console.error(`[all] "${deck}": vorhandene Einzeldatei hat ${n} Spiele (> --segment ${SEGMENT}) — mit größerem --segment aufrufen oder die Datei wegsortieren.`); failed.push(deck); continue; }
      fs.renameSync(A.single, path.join(A.segDir, segName(0)));
      console.log(`[all] "${deck}": vorhandene Einzeldatei (${n} Spiele) ist jetzt Segment 0`);
    }
    const nSeg = Math.ceil(GAMES / SEGMENT);
    console.log(`\n━━━ [${++done}/${decks.length}] "${deck}" — ${GAMES} Spiele in ${nSeg} Segmenten (${vorhanden(A)} vorhanden) ━━━`);
    have = 0;
    let abgebrochen = false;
    for (let k = 0; k < nSeg && !abgebrochen; k++) {
      const need = Math.min(SEGMENT, GAMES - k * SEGMENT);
      const roh = path.join(A.segDir, segName(k)), gz = roh + '.gz';
      // Ein gepacktes Segment, das für den neuen Umfang zu klein ist (--games wurde erhöht), wird wieder aufgemacht und fortgesetzt.
      if (fs.existsSync(gz)) {
        const n = IO.countLines(gz);
        if (n >= need) { have += n; continue; }
        fs.writeFileSync(roh, zlib.gunzipSync(fs.readFileSync(gz)));
        fs.unlinkSync(gz);
      }
      const n = fs.existsSync(roh) && IO.countLines(roh) >= need ? IO.countLines(roh) : sammle(deck, roh, need, k * SEGMENT, netEnv);
      have += n;
      if (n < need) { abgebrochen = true; break; }
      if (GZIP) packe(roh);
    }
    if (abgebrochen) console.error(`[all] "${deck}": Segmentsammlung unvollständig (${have}/${GAMES}) — Wiederanlauf setzt fort.`);
  }
  if (have < 20 && !COLLECT_ONLY) {
    // Der Trainer verweigert unter 20 entschiedenen Spielen (zu Recht).
    console.error(`[all] "${deck}": nur ${have} Spiele — zu wenig für ein Profil (min. 20), Training übersprungen. Sammlung ist gespeichert und wird beim nächsten Lauf fortgesetzt.`);
    failed.push(deck);
    continue;
  }

  // ── Schritt 2: Profil trainieren ──
  if (COLLECT_ONLY) { console.log(`[all] "${deck}": ${have} Spiele gesammelt (--collect-only, kein Profiltraining) in ${((Date.now() - t0) / 60000).toFixed(1)} min`); continue; }
  const trainerArgs = [`--max-old-space-size=${TRAINER_HEAP_MB}`, path.join(ROOT, 'scripts', 'train-deck-profile.js'), eingabe];
  if (MAX_GAMES != null) trainerArgs.push('--max-games', String(MAX_GAMES));
  const t = spawnSync(process.execPath, trainerArgs, { cwd: ROOT, stdio: 'inherit' });
  if (t.status !== 0) {
    console.error(`[all] Trainer für "${deck}" fehlgeschlagen (Code ${t.status})`);
    failed.push(deck);
    continue;
  }
  console.log(`[all] "${deck}" fertig in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // ── Schritt 3 (optional, --ab N): Spiegel-A/B Profil vs Baseline ──
  // Bewusst OHNE Netz: im Livespiel pilotiert der Evaluator; an dieser Spielweise muss ein Profil seinen Wirksamkeitstest bestehen
  // (Qualitäts-Schranke unter 48 %). Eine eigene PP_VALUE_NET der Umgebung bleibt davon unberührt.
  if (AB_GAMES > 0) {
    const abOut = path.join(A.dir, `${norm(deck)}-AB.jsonl`);
    let abAttempts = 0;
    while (IO.countLines(abOut) < AB_GAMES && abAttempts < 10) {
      abAttempts++;
      const env = {
        ...process.env,
        PP_TRAIN: '1', PP_TRAIN_AB: '1',
        PP_TRAIN_DECK: deck,
        PP_TRAIN_GAMES: String(AB_GAMES),
        PP_TRAIN_HORIZON: '1',
        PP_TRAIN_OUT: abOut,
        PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
        PP_TRAIN_JOBS: String(autoJobs()),   // parallele Sammlung (siehe scripts/train-jobs.js; PP_TRAIN_JOBS=1 = ein Prozess)
      };
      delete env.PP_TRAIN_EXPLORE; // A/B misst die echte Policy
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      const r = spawnSync(process.execPath,
        ['--max-old-space-size=4096', '--expose-gc', path.join(ROOT, 'server.js')],
        { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status === 0) break;
      console.error(`[all] A/B für "${deck}" beendet mit Code ${r.status} — Neustart (Resume greift)`);
    }
  }
}

// ── Kollisionscheck: gleiche Helden-Trios in zwei Profilen? ──────────
// Das Laufzeit-Matching läuft über das sortierte Helden-Trio. Sollten
// zwei Sample-Decks dasselbe Trio fahren, würde nur das zuletzt geladene
// Profil greifen — das muss man wissen.
try {
  const seen = new Map();
  for (const f of fs.readdirSync(PROFILE_DIR).filter(f => f.endsWith('.json'))) {
    const p = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, f), { encoding: 'utf-8' }));
    const key = (p.heroes || []).slice().sort().join('||');
    if (!key) continue;
    if (seen.has(key)) {
      console.warn(`⚠️  Helden-Trio-Kollision: "${p.deck}" (${f}) und "${seen.get(key)}" teilen sich das Trio — nur eines der Profile wird zur Laufzeit greifen!`);
    } else seen.set(key, `${p.deck}`);
  }
} catch {}

console.log(`\n═══ FERTIG: ${decks.length - failed.length}/${decks.length} Decks ${COLLECT_ONLY ? 'gesammelt (ohne Profiltraining)' : 'trainiert'} ═══`);
if (failed.length) console.log(`Fehlgeschlagen/übersprungen: ${failed.join(', ')}`);
if (COLLECT_ONLY) { console.log('Daten liegen unter data/training/' + (NET_FLAG === '0' ? 'all' : 'all-net') + '/ (je Deck ein Segmentordner); Profile unverändert.'); process.exit(failed.length ? 1 : 0); }
console.log('Profile liegen in data/cpu-profiles/ und sind nach dem nächsten Serverstart aktiv.');
console.log('Empfehlung: Stichproben-Eval pro wichtigem Deck — set PP_TRAIN_EVAL=1 und denselben Deck-Batch nochmal laufen lassen, Win-Rate mit dem Trainer-Report vergleichen.');
