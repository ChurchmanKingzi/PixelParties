#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — ITERATIVES PROFIL-TRAINING (DAgger-Schleife)
//
//  Problem: Sammelt man alle Daten mit dem BASELINE-Piloten, trainiert
//  ein Profil und lässt DIESES dann spielen, sieht der Profil-Pilot im
//  Einsatz Zustände, die im Training nie vorkamen (Distribution Shift).
//  Lösung: iterieren — sammeln → trainieren → MIT Profil sammeln →
//  retrainieren. Iteration 1 läuft ohne Profil (Baseline), alle
//  weiteren mit dem jeweils letzten Profil (PP_TRAIN_EVAL=1). Der
//  Trainer sieht am Ende jeder Iteration ALLE bisherigen Daten.
//
//  Usage:
//    node scripts/train-iterative.js "<Deckname>" <SpieleProIteration> [Iterationen=3]
//  Beispiel:
//    node scripts/train-iterative.js "Frozen Mischief" 350
//
//  Optional per Env durchgereicht (Defaults in Klammern):
//    PP_TRAIN_HORIZON (2), PP_MCTS_BUDGET_MS (4000), PP_MCTS_PULLS (24),
//    PP_GAME_TIMEOUT_MS (600000), PP_TRAIN_OPP (Rotation über alle Decks)
// ═══════════════════════════════════════════

'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , deckName, arg3, arg4, arg5] = process.argv;
if (!deckName) {
  console.error('Usage:');
  console.error('  node scripts/train-iterative.js "<Deckname>"');
  console.error('    → NEUES SCHEMA (Default): 1 große Baseline (10 × Gegnerzahl Spiele)');
  console.error('      + 6 DAgger-Iterationen à 4 × Gegnerzahl Spiele.');
  console.error('      Spielzahlen sind exakte Rotations-Vielfache (jeder Gegner gleich oft).');
  console.error('  node scripts/train-iterative.js "<Deckname>" <BaselineMult> [DaggerIters=6] [DaggerMult=4]');
  console.error('    → Multiplikatoren anpassen (Werte ≤ 20 werden als Mult gelesen).');
  console.error('  node scripts/train-iterative.js "<Deckname>" <SpieleProIteration> [Iterationen=3]');
  console.error('    → LEGACY (Werte > 20): feste Spielzahl, alle Iterationen gleich groß.');
  console.error('  node scripts/train-iterative.js "<Deckname>" resume [Iterationen=4] [Mult=4]');
  console.error('    → RESUME: bestehendes Profil sammelt (keine neue Baseline), Training');
  console.error('      nur auf den frischen Daten dieses Laufs — für Nachtraining nach Fixes.');
  process.exit(1);
}
// Argument-Deutung: Zahlen ≤ 20 sind Multiplikatoren (neues Schema),
// Zahlen > 20 absolute Spielzahlen (Legacy-Verhalten wie bisher).
// RESUME-Modus: vorhandenes Profil als Sammel-Pilot behalten, KEINE
// neue Baseline — nur frische DAgger-Iterationen sammeln und daraus
// (regime-sauber, z. B. nach Engine-Fixes) ein stärkeres Profil bauen.
const resumeMode = arg3 === 'resume';
const a3 = (!resumeMode && arg3 !== undefined) ? parseInt(arg3, 10) : NaN;
const legacyMode = Number.isFinite(a3) && a3 > 20;
let gamesPerIter = 0, iterations, baselineMult = 10, daggerMult = 4;
if (resumeMode) {
  iterations = Math.max(1, parseInt(arg4 || '4', 10));
  daggerMult = Math.max(1, parseInt(arg5 || '4', 10));
} else if (legacyMode) {
  gamesPerIter = a3;
  iterations = parseInt(arg4 || '3', 10);
} else {
  if (Number.isFinite(a3)) baselineMult = Math.max(1, a3);
  const daggerIters = Math.max(1, parseInt(arg4 || '6', 10));
  daggerMult = Math.max(1, parseInt(arg5 || '4', 10));
  iterations = 1 + daggerIters; // Iteration 1 = Baseline, danach DAgger
}

const root = path.join(__dirname, '..');
const slug = deckName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const outDir = path.join(root, 'data', 'training');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const iterFiles = [];

const _resumeProfilePath = path.join(root, 'data', 'cpu-profiles', `${slug}.json`);
if (resumeMode && !fs.existsSync(_resumeProfilePath)) {
  console.error(`RESUME unmöglich: kein Profil unter ${_resumeProfilePath}.`);
  console.error('  Der Deckname muss dem des Original-Laufs entsprechen — vorhandene Profile: ls data/cpu-profiles/');
  process.exit(1);
}
if (resumeMode) console.log(`RESUME: bestehendes Profil bleibt Sammel-Pilot; ${iterations} Iterationen à ${daggerMult} × Gegnerzahl, Training nur auf frischen Daten.`);
for (let it = 1; it <= iterations; it++) {
  const outFile = path.join(outDir, `${slug}-iter${it}-${stamp}.jsonl`);
  iterFiles.push(outFile);
  const profilePath = path.join(root, 'data', 'cpu-profiles', `${slug}.json`);
  const withProfile = (resumeMode || it > 1) && fs.existsSync(profilePath);
  if (it > 1 && !withProfile) console.warn('  (Kein Profil aus Voriteration vorhanden — diese Sammlung läuft erneut Baseline.)');
  const mult = legacyMode ? 0 : ((it === 1 && !resumeMode) ? baselineMult : daggerMult); // Resume: nie Baseline-Größe
  const sizeLabel = legacyMode ? `${gamesPerIter} Spiele` : `${mult} × Gegnerzahl Spiele`;
  console.log(`\n═══ Iteration ${it}/${iterations} — Sammlung: ${sizeLabel} ${withProfile ? 'MIT Profil (DAgger)' : 'Baseline (ohne Profil)'} ═══`);

  // Sammlung als EIN durchgehender server.js-Lauf pro Iteration (auf
  // Als Wunsch ohne Chunking — die Stückelung stammte aus Sandbox-
  // Limits und störte im echten Training). Stirbt der Prozess vorzeitig,
  // wird mit dem bis dahin Geschriebenen weitertrainiert.
  const countLines = f => { try { return fs.readFileSync(f, 'utf-8').split('\n').filter(Boolean).length; } catch { return 0; } };
  const env = {
    ...process.env,
    PP_TRAIN: '1',
    PP_TRAIN_DECK: deckName,
    PP_TRAIN_GAMES: String(gamesPerIter || 200),
    PP_TRAIN_OUT: outFile,
    PP_TRAIN_HORIZON: process.env.PP_TRAIN_HORIZON || '2',
    PP_MCTS_BUDGET_MS: process.env.PP_MCTS_BUDGET_MS || '4000',
    PP_MCTS_PULLS: process.env.PP_MCTS_PULLS || '24',
    PP_GAME_TIMEOUT_MS: process.env.PP_GAME_TIMEOUT_MS || '600000',
  };
  if (withProfile) env.PP_TRAIN_EVAL = '1';
  else delete env.PP_TRAIN_EVAL;
  // Neues Schema: exakte Rotations-Vielfache via server.js-MULT-Modus.
  if (!legacyMode) env.PP_TRAIN_GAMES_MULT = String(mult);
  else delete env.PP_TRAIN_GAMES_MULT;

  // ── ABSTURZ-RESILIENTER SAMMELLAUF (31.7.) ─────────────────────────
  // Ein OOM tötet den node-Prozess hart. Bisher lief die Iteration
  // danach einfach mit dem Teilbestand weiter — beim Mawstruck-Lauf
  // zweimal in Folge mit 34 statt 400 Spielen, und das daraus
  // trainierte Profil steuerte dann die nächste Iteration. Ein Absturz
  // verdarb also nicht nur den Datensatz, sondern die ganze Kette.
  //
  // server.js ist bereits RESUMIERBAR (zählt die Zeilen der Ausgabedatei
  // und setzt dort fort; die Gegner-Rotation ist über denselben Index
  // ausgerichtet). Es fehlte nur der Wiederanlauf. Zusätzlich liest der
  // Wrapper die Brotkrume `<outFile>.inflight.json`, die server.js VOR
  // jedem Spiel schreibt: bleibt sie nach einem Absturz liegen, steht
  // darin exakt das Match, das den Prozess getötet hat.
  //
  // Bringt ein Anlauf KEINEN Fortschritt, ist dasselbe Match erneut
  // gestorben — dann wird sein Gegner für die restlichen Versuche
  // übersprungen (PP_TRAIN_SKIP_OPP), statt endlos dagegenzulaufen.
  const inflightFile = outFile + '.inflight.json';
  const readInflight = () => {
    try { return JSON.parse(fs.readFileSync(inflightFile, 'utf-8')); }
    catch { return null; }
  };
  try { fs.unlinkSync(inflightFile); } catch { /* nicht vorhanden */ }

  const MAX_ATTEMPTS = parseInt(process.env.PP_TRAIN_MAX_ATTEMPTS || '6', 10);
  // Gegner-Filter dieses Laufs. PP_TRAIN_OPP enthält SUBSTRINGS, nicht
  // volle Decknamen ("steamdwarf" matcht "Steam Dwarf Mines") — deshalb
  // dieselbe Normalisierung wie in server.js.
  const normOpp = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const oppFiltersForRun = (process.env.PP_TRAIN_OPP || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const filtersAllMatch = (name) => {
    if (oppFiltersForRun.length === 0) return false;
    const n = normOpp(name);
    return oppFiltersForRun.every(f => {
      const nf = normOpp(f);
      return nf && (n.includes(nf) || nf.includes(n));
    });
  };
  const skipped = [];
  let collect = null, collected = countLines(outFile), attempt = 0;
  while (attempt < MAX_ATTEMPTS) {
    attempt++;
    if (skipped.length > 0) {
      env.PP_TRAIN_SKIP_OPP = [process.env.PP_TRAIN_SKIP_OPP, ...skipped]
        .filter(Boolean).join(',');
    }
    // PP_TRAIN_HEAPSNAP=1 → V8 schreibt beim OOM einen Heap-Snapshot.
    // Das ist das einzige Werkzeug, das einen VOLLSTÄNDIG SYNCHRONEN
    // Allokations-Burst noch sieht: es läuft in V8 selbst, nicht im
    // Event-Loop. Kostet beim Absturz eine ~4-GB-Datei, deshalb nur auf
    // Anforderung. Kleinerer Heap (PP_TRAIN_HEAP_MAX) macht den Dump
    // handhabbar und den Absturz schneller.
    const heapMax = process.env.PP_TRAIN_HEAP_MAX || '4096';
    const nodeArgs = [`--max-old-space-size=${heapMax}`, '--expose-gc'];
    // PP_TRAIN_INSPECT=1 → Debugger-Port. Das einzige Werkzeug, das bei
    // einem SYNCHRON blockierten Haupt-Thread noch etwas sagt: der
    // Inspector laeuft in einem eigenen Thread. Beim Haenger in
    // chrome://inspect verbinden und auf Pause druecken — der Call Stack
    // zeigt die laufende Schleife. Funktioniert auch unter Windows, wo
    // es kein SIGUSR2 fuer Diagnoseberichte gibt.
    if (process.env.PP_TRAIN_INSPECT === '1') {
      nodeArgs.unshift(`--inspect=${process.env.PP_TRAIN_INSPECT_PORT || '9229'}`);
      if (attempt === 1) {
        console.log('  [inspect] Debugger-Port offen — beim Haenger chrome://inspect oeffnen,');
        console.log('            "inspect" klicken und im Sources-Tab auf Pause druecken.');
      }
    }
    if (process.env.PP_TRAIN_HEAPSNAP === '1') {
      nodeArgs.push('--heapsnapshot-near-heap-limit=1');
      if (attempt === 1) console.log(`  [heapsnap] V8 schreibt beim OOM einen Heap-Snapshot (Heap-Limit ${heapMax} MB).`);
    }
    collect = spawnSync('node', [...nodeArgs, 'server.js'],
      { cwd: root, env, stdio: 'inherit' });
    const before = collected;
    collected = countLines(outFile);
    if (collect.status === 0) break;
    // exit 2 = server.js hat sauber abgebrochen (Konfiguration, z.B. alle
    // Gegner ausgefiltert). Kein Absturz, kein Wiederanlauf.
    if (collect.status === 2) {
      console.warn('  Sammlung sauber abgebrochen (Konfiguration) — kein Wiederanlauf.');
      break;
    }

    const crashed = readInflight();
    // SOFORT sichern: die Brotkrume wird am Ende jedes Schleifendurchlaufs
    // gelöscht und vom nächsten Anlauf überschrieben — nach einem
    // erfolgreichen Wiederanlauf wäre die Forensik sonst weg.
    let crashFileSaved = null;
    if (crashed) {
      try {
        crashFileSaved = outFile + '.crash.json';
        fs.writeFileSync(crashFileSaved, JSON.stringify(crashed), { encoding: 'utf-8' });
      } catch { crashFileSaved = null; }
    }
    console.warn(`  ⚠️  Sammlung starb mit exit ${collect.status} bei ${collected} Spielen`
      + (crashed ? ` — abgestürztes Match: ${crashed.pinned} vs ${crashed.opponent} (Spiel ${crashed.game}, Sitz ${crashed.pinnedIdx})` : ' — keine Brotkrume gefunden'));
    // ── HEAP-SPUR AUSWERTEN ──────────────────────────────────────────
    // Die Brotkrume trägt die letzten ~40 s Speicher-Telemetrie. Bei
    // einem OOM steht hier, WELCHER Zähler explodiert ist — ohne das
    // muss man den Absturz erneut provozieren, um überhaupt etwas zu
    // sehen.
    const trail = Array.isArray(crashed?.heapTrail) ? crashed.heapTrail : null;
    const probes = Array.isArray(crashed?.heapProbes) ? crashed.heapProbes : null;
    // ── SYNCHRONE SONDE ZUERST ───────────────────────────────────────
    // Sie meldet je 100 MB Heap-Zuwachs aus der Engine heraus und läuft
    // auch bei blockiertem Event-Loop. Wenn sie Treffer hat, IST das die
    // Antwort — der zeitgesteuerte Trail ist dann nur noch Kontext.
    if (probes && probes.length > 0) {
      console.warn(`     ★ SYNCHRONE HEAP-SONDE: ${probes.length} Treffer (je +100 MB)`);
      console.warn('       Heap  Auslöser                      Zug Ph Sp  Snapshots Hooks Sim Inst Chain Pend');
      for (const p of probes.slice(-14)) {
        console.warn(`       ${String(p.heap).padStart(5)}  ${String(p.tag).padEnd(28)}`
          + `${String(p.t).padStart(3)} ${String(p.ph).padStart(2)} ${String(p.ap).padStart(2)}`
          + `${String(p.snaps).padStart(11)}${String(p.hooks).padStart(6)}${String(p.sim).padStart(4)}`
          + `${String(p.inst).padStart(5)}${String(p.chain).padStart(6)}${String(p.pend).padStart(5)}`);
      }
      // Der Auslöser, der die Liste dominiert, ist der Verdächtige.
      const byTag = {};
      for (const p of probes) byTag[p.tag] = (byTag[p.tag] || 0) + 1;
      const top = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
      console.warn(`       → Dominanter Auslöser: ${top.map(([k, v]) => `${k}×${v}`).slice(0, 4).join(', ')}`);
      const last = probes[probes.length - 1];
      const first = probes[0];
      if (last.snaps === first.snaps) {
        console.warn('       → Snapshot-Zähler steht STILL: die Allokation läuft NICHT über snapshot().');
      }
      if (last.hooks === first.hooks) {
        console.warn('       → Hook-Zähler steht STILL: die Allokation läuft NICHT über die Hook-Kette.');
      }
    }
    if (trail && trail.length > 1) {
      const first = trail[0], last = trail[trail.length - 1];
      const d = (k) => (last[k] == null || first[k] == null) ? null : last[k] - first[k];
      const secs = ((last.ms - first.ms) / 1000) || 1;
      console.warn(`     Heap-Spur (${trail.length} Messpunkte über ${secs.toFixed(0)}s vor dem Einfrieren):`);
      console.warn(`       Heap  ${first.heap} → ${last.heap} MB  (${(d('heap') / secs).toFixed(1)} MB/s)`
        + `   RSS ${first.rss} → ${last.rss} MB`);
      console.warn(`       zuletzt: Zug ${last.t} Phase ${last.ph} aktiv p${last.ap}`
        + `   Hooks ${last.hooks}   Hooks-abgewürgt=${last.killed}`);
      // ── JSON-RÜCKFALLPFAD ────────────────────────────────────────
      // structuredClone bewahrt Objekt-Identität, JSON dupliziert. Läuft
      // der Rückfallpfad häufig, ist er der wahrscheinlichste Ort einer
      // exponentiellen Vervielfältigung — und zwar INNERHALB eines
      // einzigen Aufrufs, also unsichtbar für jede Klammer-Messung.
      if (last.fb != null) {
        const fbRate = ((last.fb - (first.fb || 0)) / secs);
        console.warn(`       JSON-Klon-Rückfälle: ${last.fb} gesamt (${fbRate.toFixed(0)}/s)`
          + (last.fb > 0 ? '   ← strukturell gefährlich' : '   (0 = strukturell unauffällig)'));
      }
      // Welcher Zähler ist mitgewachsen? Der mit dem stärksten Anstieg
      // ist der erste Verdächtige.
      const growth = [
        ['Aktionslog', d('log'), last.log],
        ['Karteninstanzen', d('inst'), last.inst],
        ['MCTS-Snapshots', d('snaps'), last.snaps],
      ].filter(([, g]) => g != null);
      for (const [name, g, val] of growth.sort((a, b) => (b[1] || 0) - (a[1] || 0))) {
        console.warn(`       ${name.padEnd(18)} +${g}  (zuletzt ${val})`);
      }
      const heapRate = (d('heap') || 0) / secs;
      if (last.killed) {
        console.warn('       → Hooks waren bereits abgewürgt (_turnHooksKilled): der Inline-Heap-Check');
        console.warn('         von runHooks war zu diesem Zeitpunkt STUMM. Erklärt, warum kein Wächter griff.');
      }
      if (heapRate > 50) console.warn(`       → Anstieg ${heapRate.toFixed(0)} MB/s = Burst, kein schleichendes Leck.`);
      // ── SYNCHRONER BURST ─────────────────────────────────────────
      // Steht im letzten Messpunkt noch WENIG Speicher, obwohl der
      // Prozess am Heap-Limit gestorben ist, dann lag alles dazwischen:
      // der Event-Loop war blockiert, der 500-ms-Sampler kam nie wieder
      // dran. Kein Intervall-Wächter kann so etwas sehen — und die
      // Inline-Checks in runHooks/snapshot() auch nicht, wenn die
      // Allokation weder Hooks feuert noch weitere Snapshots zieht.
      // Dann ist der V8-Heap-Snapshot das einzige Werkzeug, das greift.
      if (last.heap != null && last.heap < 500 && !(probes && probes.length)) {
        console.warn(`       → ⚠️ VOLLSTÄNDIG SYNCHRONER BURST: letzter Messpunkt bei nur ${last.heap} MB,`);
        console.warn('         gestorben ist der Prozess am Heap-Limit. Der Event-Loop war dazwischen');
        console.warn('         durchgehend blockiert — Intervall-Sampling kann diesen Fall NICHT sehen.');
        console.warn('         Und die synchrone Sonde hat NICHTS gemeldet: die Allokation läuft weder');
        console.warn('         über runHooks noch über snapshot(). Dann hilft nur der V8-Heap-Snapshot:');
        console.warn('           set PP_TRAIN_HEAPSNAP=1   (dann denselben Lauf erneut starten)');
        console.warn('         Ergebnis: Heap.*.heapsnapshot im Projektordner, in Chrome DevTools');
        console.warn('         (F12 → Memory → Load) nach "Retained Size" sortieren.');
      }
      console.warn(`     Volle Spur: ${crashFileSaved || inflightFile}`);
    } else if (crashed && !probes) {
      // Genau der Fall vom Absturz "Spiel 2, Sitz 1": das Spiel starb,
      // bevor irgendeine Messung geschrieben war.
      console.warn('     Keine Heap-Spur — das Spiel starb binnen Sekundenbruchteilen nach dem Start.');
      console.warn('     Ab dieser Version schreibt der Sampler sofort und bei jedem Tick;');
      console.warn('     zusätzlich meldet die synchrone Sonde je 100 MB Zuwachs aus der Engine.');
    }
    if (attempt >= MAX_ATTEMPTS) {
      console.warn(`  Nach ${MAX_ATTEMPTS} Anläufen aufgegeben — Training läuft mit ${collected} Spielen.`);
      break;
    }
    if (collected <= before) {
      // Kein Fortschritt → dasselbe Match ist erneut gestorben.
      if (crashed && crashed.opponent && !skipped.includes(crashed.opponent)) {
        // Wenn das Überspringen NICHTS übrig ließe, ist Überspringen
        // sinnlos — der nächste Anlauf hätte 0 Gegner und stürbe an
        // `opponents[i % 0]`. Genau das passierte beim gezielten
        // Repro-Lauf (PP_TRAIN_OPP=Steam Dwarf Mines, also genau ein
        // Gegner). Dann lieber ehrlich abbrechen.
        const remaining = !filtersAllMatch(crashed.opponent);
        if (!remaining) {
          console.warn(`  → "${crashed.opponent}" ist der EINZIGE Gegner dieses Laufs — Überspringen`);
          console.warn('     würde die Sammlung leeren. Abbruch der Wiederanläufe.');
          console.warn('     Das ist der gezielte Repro-Fall: der Absturz IST das Messergebnis.');
          break;
        }
        skipped.push(crashed.opponent);
        console.warn(`  → "${crashed.opponent}" wird für den Rest dieser Iteration ÜBERSPRUNGEN.`);
        // Repro-Befehl in der Syntax der LAUFENDEN Shell ausgeben. Die
        // bash-Präfixform (VAR=wert befehl) ist unter Windows cmd ein
        // Syntaxfehler ("Der Befehl PP_TRAIN_DECK ist entweder falsch
        // geschrieben oder konnte nicht gefunden werden") — und ohne
        // PP_TRAIN startet server.js als normaler Webserver statt
        // headless zu sammeln. MCTS-Budget/Pulls gehören dazu, sonst
        // läuft der Repro mit den 5× größeren Engine-Defaults und ist
        // nicht derselbe Fall.
        const reproVars = [
          ['PP_TRAIN', '1'],
          ['PP_TRAIN_DECK', deckName],
          ['PP_TRAIN_OPP', crashed.opponent],
          ['PP_TRAIN_GAMES', '3'],
          ['PP_MCTS_BUDGET_MS', env.PP_MCTS_BUDGET_MS || '4000'],
          ['PP_MCTS_PULLS', env.PP_MCTS_PULLS || '24'],
        ];
        const nodeCmd = `node --max-old-space-size=${process.env.PP_TRAIN_HEAP_MAX || '4096'} --expose-gc server.js`;
        console.warn('     Gezielt reproduzieren:');
        if (process.platform === 'win32') {
          for (const [k, v] of reproVars) console.warn(`       set ${k}=${v}`);
          console.warn(`       ${nodeCmd}`);
        } else {
          console.warn(`       ${reproVars.map(([k, v]) => `${k}="${v}"`).join(' ')} ${nodeCmd}`);
        }
      } else {
        console.warn('  → Kein Fortschritt und kein zuordenbares Match — Abbruch der Wiederanläufe.');
        break;
      }
    } else {
      console.warn(`  → Wiederanlauf ${attempt + 1}/${MAX_ATTEMPTS}, setze bei Spiel ${collected + 1} fort.`);
    }
    try { fs.unlinkSync(inflightFile); } catch { /* egal */ }
  }
  try { fs.unlinkSync(inflightFile); } catch { /* egal */ }
  if (skipped.length > 0) {
    console.warn(`  ⚠️  Diese Iteration hat ${skipped.length} Gegner ausgelassen: ${skipped.join(', ')}`);
  }
  console.log(`  Iteration ${it}: ${collected} Spiele gesammelt${attempt > 1 ? ` (${attempt} Anläufe)` : ''}.`);

  // ── Ausgangs-Summary der Iteration (Als Auftrag) ──────────────────
  // Wins/Losses aufgeschlüsselt nach End-Grund (reason im Record:
  // all_heroes_dead, deck_out, cardinal_beast, ...). Macht auf einen
  // Blick sichtbar, WORAN das Deck gewinnt/verliert — insbesondere ob
  // Deckout-Losses über die Iterationen zurückgehen (Deckout-Guard).
  try {
    const byKey = Object.create(null);
    let wins = 0, losses = 0, other = 0;
    for (const line of fs.readFileSync(outFile, 'utf-8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const g = JSON.parse(line);
        const r = g.reason || 'unbekannt';
        if (g.outcome === 1) { wins++; byKey[`Win  (${r})`] = (byKey[`Win  (${r})`] || 0) + 1; }
        else if (g.outcome === 0) { losses++; byKey[`Loss (${r})`] = (byKey[`Loss (${r})`] || 0) + 1; }
        else other++;
      } catch { /* korrupte Zeile → überspringen */ }
    }
    console.log(`  Ausgang Iteration ${it}: ${wins} Wins / ${losses} Losses${other ? ` / ${other} ohne Wertung` : ''}`);
    for (const [k, v] of Object.entries(byKey).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(v).padStart(4)}× ${k}`);
    }
  } catch { /* Summary ist Komfort, nie Abbruchgrund */ }

  const have = iterFiles.filter(f => fs.existsSync(f));
  if (have.length === 0) { console.error('Keine Daten — Abbruch.'); process.exit(1); }
  console.log(`\n═══ Iteration ${it}/${iterations} — Training über ${have.length} Datei(en) ═══`);
  const train = spawnSync('node', [path.join(__dirname, 'train-deck-profile.js'), ...have],
    { cwd: root, stdio: 'inherit' });
  if (train.status !== 0) {
    // Nicht abbrechen: "zu wenig Spiele" in frühen Iterationen ist ok —
    // die nächste Sammlung (dann eben nochmal Baseline, weil noch kein
    // Profil existiert) füllt den Datensatz auf, und das Abschluss-
    // Training sieht alles.
    console.warn(`Trainer in Iteration ${it} nicht erfolgreich (exit ${train.status}) — Sammlung geht weiter.`);
  }
}

console.log(`\n✔ Fertig: ${iterations} Iterationen. Profil: data/cpu-profiles/${slug}.json`);
console.log(`  Für belastbare Vorher/Nachher-Aussagen: A/B-Spiegellauf (Profil vs. Heuristik) statt Iterationsvergleich —`);
console.log(`  env PP_TRAIN_AB=1 PP_TRAIN_DECK="${deckName}" PP_TRAIN_GAMES=100 node server.js`);console.log(`  Trainingsdaten: ${iterFiles.map(f => path.basename(f)).join(', ')}`);
