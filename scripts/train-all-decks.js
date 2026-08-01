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
//  Zeitbudget grob überschlagen: ~15-25 s/Spiel mit --fast 1. Bei 38
//  Decks × 300 Spielen sind das mehrere Tage Dauerlauf — deshalb ist
//  --only dein Freund: fang mit den Decks an, gegen die Spieler
//  tatsächlich antreten.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DECK_DIR = path.join(ROOT, 'data', 'SampleDecks');
const OUT_DIR = path.join(ROOT, 'data', 'training', 'all');
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

if (LIST_ONLY) {
  for (const d of decks) {
    const out = path.join(OUT_DIR, `${norm(d)}.jsonl`);
    let have = 0;
    try { have = fs.readFileSync(out, { encoding: 'utf-8' }).split('\n').filter(l => l.trim()).length; } catch {}
    const prof = fs.existsSync(path.join(PROFILE_DIR, `${d.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.json`));
    console.log(`${have >= GAMES ? '✅' : have > 0 ? '⏳' : '  '} ${d}  (${have}/${GAMES} Spiele${prof ? ', Profil vorhanden' : ''})`);
  }
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`═══ Training für ${decks.length} Decks — ${GAMES} Spiele/Deck, ${FAST ? 'reduziertes' : 'volles'} MCTS-Budget ═══`);

const lineCount = (p) => {
  try { return fs.readFileSync(p, { encoding: 'utf-8' }).split('\n').filter(l => l.trim()).length; }
  catch { return 0; }
};

let done = 0, failed = [];
for (const deck of decks) {
  const outPath = path.join(OUT_DIR, `${norm(deck)}.jsonl`);
  const t0 = Date.now();

  // ── Schritt 1: Datensammlung (überspringen, wenn schon voll) ──
  let have = lineCount(outPath);
  if (have < GAMES) {
    console.log(`\n━━━ [${++done}/${decks.length}] "${deck}" — sammle ${GAMES - have} weitere Spiele (${have} vorhanden) ━━━`);
    // Auto-Restart-Schleife: OOM/Absturz kostet nur das laufende Spiel,
    // der Batch-Runner resumiert über die Zeilenzahl von PP_TRAIN_OUT.
    let attempts = 0;
    while (lineCount(outPath) < GAMES && attempts < 10) {
      attempts++;
      const env = {
        ...process.env,
        PP_TRAIN: '1',
        PP_TRAIN_DECK: deck,
        PP_TRAIN_GAMES: String(GAMES),
        PP_TRAIN_HORIZON: '1',
        PP_TRAIN_OUT: outPath,
        PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
      };
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      if (EXPLORE > 0) env.PP_TRAIN_EXPLORE = String(EXPLORE);
      if (OPP_PROFILES) env.PP_TRAIN_OPP_PROFILES = '1';
      const r = spawnSync(process.execPath,
        ['--max-old-space-size=4096', '--expose-gc', path.join(ROOT, 'server.js')],
        { cwd: ROOT, env, stdio: 'inherit' });
      if (r.status === 0) break;
      console.error(`[all] server.js beendet mit Code ${r.status} — Neustart (Versuch ${attempts}/10, Resume greift)`);
    }
    have = lineCount(outPath);
    if (have < 20) {
      // Der Trainer verweigert unter 20 entschiedenen Spielen (zu Recht).
      console.error(`[all] "${deck}": nur ${have} Spiele — zu wenig für ein Profil (min. 20), Training übersprungen. Sammlung ist gespeichert und wird beim nächsten Lauf fortgesetzt.`);
      failed.push(deck);
      continue;
    }
  } else {
    console.log(`\n━━━ [${++done}/${decks.length}] "${deck}" — ${have} Spiele vorhanden, Sammlung übersprungen ━━━`);
  }

  // ── Schritt 2: Profil trainieren ──
  const t = spawnSync(process.execPath,
    [path.join(ROOT, 'scripts', 'train-deck-profile.js'), outPath],
    { cwd: ROOT, stdio: 'inherit' });
  if (t.status !== 0) {
    console.error(`[all] Trainer für "${deck}" fehlgeschlagen (Code ${t.status})`);
    failed.push(deck);
    continue;
  }
  console.log(`[all] "${deck}" fertig in ${((Date.now() - t0) / 60000).toFixed(1)} min`);

  // ── Schritt 3 (optional, --ab N): Spiegel-A/B Profil vs Baseline ──
  if (AB_GAMES > 0) {
    const abOut = path.join(OUT_DIR, `${norm(deck)}-AB.jsonl`);
    let abAttempts = 0;
    while (lineCount(abOut) < AB_GAMES && abAttempts < 10) {
      abAttempts++;
      const env = {
        ...process.env,
        PP_TRAIN: '1', PP_TRAIN_AB: '1',
        PP_TRAIN_DECK: deck,
        PP_TRAIN_GAMES: String(AB_GAMES),
        PP_TRAIN_HORIZON: '1',
        PP_TRAIN_OUT: abOut,
        PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
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

console.log(`\n═══ FERTIG: ${decks.length - failed.length}/${decks.length} Decks trainiert ═══`);
if (failed.length) console.log(`Fehlgeschlagen/übersprungen: ${failed.join(', ')}`);
console.log('Profile liegen in data/cpu-profiles/ und sind nach dem nächsten Serverstart aktiv.');
console.log('Empfehlung: Stichproben-Eval pro wichtigem Deck — set PP_TRAIN_EVAL=1 und denselben Deck-Batch nochmal laufen lassen, Win-Rate mit dem Trainer-Report vergleichen.');
