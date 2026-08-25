#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — KOMPLETTES NEUTRAINING ALLER DECKS (Wellen-Modus)
//
//  Ein Befehl, der alles von vorn aufbaut: alte Daten beiseite, dann
//  W Wellen, in jeder Welle spielt JEDES Deck gegen JEDES andere je
//  `--mult` Spiele, danach wird JEDES Deck auf allen bisherigen Wellen
//  neu trainiert. Ab Welle 2 sammelt jedes Deck mit dem Profil, das aus
//  den Daten der Vorwelle entstanden ist (DAgger).
//
//  ── WARUM WELLENWEISE UND NICHT DECKWEISE ─────────────────────────
//  `train-iterative.js` faehrt EIN Deck durch alle Iterationen, bevor
//  das naechste beginnt. Das ist fuer ein einzelnes Deck richtig, fuer
//  einen Gesamtlauf aber nicht: Deck 1 durchlaeuft seine sieben
//  Iterationen zu einem Zeitpunkt, an dem noch KEIN anderes Deck ein
//  Profil hat, Deck 42 dagegen, wenn alle anderen laengst trainiert
//  sind. Die Decks lernen dann gegen unterschiedlich starke Gegner —
//  ein Stoerfaktor, der genau wie die DAgger-Iteration unbeobachtet in
//  die Daten laeuft. Wellenweise sind alle Decks in derselben Welle im
//  selben Regime.
//
//  ── WAS 》WIE GEHABT《 HEISST ───────────────────────────────────────
//  Die GEGNER pilotieren weiterhin OHNE Profil (Baseline-MCTS), so wie
//  bisher. Das ist eine bewusste Entscheidung und mit `--opp-profiles`
//  umschaltbar: Gegner mit Profil waeren ein anderes, schwereres
//  Regime, und ein Regimewechsel mitten in einem Lauf, der Tage
//  dauert, macht die Wellen untereinander unvergleichbar.
//
//  ── RECHENZEIT, EHRLICH ───────────────────────────────────────────
//  42 Decks x 41 Gegner x 10 Spiele = 17 220 Spiele je Welle, bei
//  7 Wellen also rund 120 000 Spiele. Bei gemessenen ~20 s je Spiel
//  und reduziertem Suchbudget sind das auf 3 parallelen Auftraegen
//  ueber NEUN TAGE Dauerlauf. Der Befehl gibt vor dem Start eine
//  Schaetzung aus und will eine Bestaetigung.
//
//  ── RESUMIERBAR ───────────────────────────────────────────────────
//  Jedes Deck jeder Welle schreibt in eine eigene Datei. Ein Neustart
//  mit DEMSELBEN Befehl ueberspringt, was fertig ist, und setzt an der
//  Abbruchstelle fort — server.js zaehlt die Zeilen der Ausgabedatei
//  und richtet die Gegner-Rotation am selben Index aus. Ein Absturz
//  kostet also hoechstens das laufende Spiel.
//
//  ── VERWENDUNG ────────────────────────────────────────────────────
//    node scripts/retrain-all.js --plan          nur rechnen, nichts tun
//    node scripts/retrain-all.js --yes           loslegen (Standard 7x10)
//    node scripts/retrain-all.js --yes --waves 7 --mult 10 --jobs 3
//    node scripts/retrain-all.js --yes --only "Heal Burn,Mawstruck"
//    node scripts/retrain-all.js --yes --fast 0  volles Suchbudget
//
//  Nach dem Lauf liegt der ALTE Profilsatz unter
//  data/cpu-profiles-vor-<stempel>/ — genau der Vergleichsmassstab fuer
//      node scripts/ab-all.js --vs data/cpu-profiles-vor-<stempel> \
//        --tag neu-gegen-alt
//  Das ist der einzige Vergleich, der etwas taugt: beide Saetze im
//  selben Spiel, auf demselben Code, immun gegen Engine-Drift.
// ═══════════════════════════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DECK_DIR = path.join(ROOT, 'data', 'SampleDecks');
const TRAIN_DIR = path.join(ROOT, 'data', 'training');
const PROFILE_DIR = path.join(ROOT, 'data', 'cpu-profiles');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };

const WAVES = Math.max(1, parseInt(arg('--waves', '7'), 10));
const MULT = Math.max(1, parseInt(arg('--mult', '10'), 10));
const JOBS = Math.max(1, parseInt(arg('--jobs', '3'), 10));
const FAST = arg('--fast', '1') !== '0';
const HEAP = parseInt(arg('--heap', '4096'), 10);
const OPP_PROFILES = flag('--opp-profiles');
const PLAN_ONLY = flag('--plan');
const YES = flag('--yes');
const PURGE = flag('--purge');          // loeschen statt archivieren
const ONLY = (arg('--only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const SKIP = (arg('--skip', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const MAX_ATTEMPTS = parseInt(arg('--attempts', '6'), 10);

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Deckliste ────────────────────────────────────────────────────────
function deckNames() {
  let dateien = [];
  try { dateien = fs.readdirSync(DECK_DIR).filter(f => f.endsWith('.txt')); }
  catch { return []; }
  const namen = [];
  for (const f of dateien.sort()) {
    // ★ DEN NAMEN AUS DER DATEI LESEN, nicht aus dem Dateinamen.
    // `loadSampleDecks()` nimmt die Zeile 》Name: …《 und faellt nur ohne
    // sie auf den Dateinamen zurueck. Der Unterschied ist real:
    // 》Structure Deck Big Stomp.txt《 heisst intern 》Structure Deck: Big
    // Stomp!《. `PP_TRAIN_DECK` matcht per Teilstring in BEIDE
    // Richtungen — mit dem falschen Namen kann also ein ANDERES Deck
    // gewinnen, und der ganze Lauf trainiert still das falsche Profil.
    try {
      const text = fs.readFileSync(path.join(DECK_DIR, f), 'utf-8');
      const zeilen2 = text.split(/\r?\n/);
      if (!zeilen2[0] || !zeilen2[0].includes('PIXEL PARTIES DECK')) continue;
      const m = zeilen2.slice(1, 8).map(l => /^Name:\s*(.+)$/.exec(l.trim())).find(Boolean);
      namen.push(m ? m[1].trim() : path.basename(f, '.txt'));
    } catch { /* unlesbare Datei ueberspringen */ }
  }
  // Eindeutigkeit pruefen: matcht ein Name als Teilstring in einen
  // anderen, waehlt server.js womoeglich das falsche Deck.
  for (const a of namen) {
    for (const b of namen) {
      if (a === b) continue;
      if (norm(b).includes(norm(a))) {
        console.warn(`[retrain] ⚠️  Deckname 》${a}《 steckt in 》${b}《 — `
          + `PP_TRAIN_DECK koennte das falsche Deck treffen.`);
      }
    }
  }
  return namen;
}
let DECKS = deckNames();
if (ONLY.length) DECKS = DECKS.filter(d => ONLY.some(o => norm(d).includes(norm(o)) || norm(o).includes(norm(d))));
if (SKIP.length) DECKS = DECKS.filter(d => !SKIP.some(o => norm(d).includes(norm(o))));
if (DECKS.length === 0) { console.error('[retrain] Keine Decks gefunden/uebrig.'); process.exit(1); }

// Spiele je Deck und Welle = mult x Gegnerzahl. Die Gegnerzahl ist die
// Zahl ALLER Sample-Decks minus eins — auch wenn --only den Lauf
// einschraenkt, spielt jedes Deck weiterhin gegen alle anderen.
const ALLE = deckNames().length;
const PRO_DECK = MULT * (ALLE - 1);
const PRO_WELLE = PRO_DECK * DECKS.length;
const GESAMT = PRO_WELLE * WAVES;

// ── Lauf-Verzeichnis / Zustand ───────────────────────────────────────
const STATE = path.join(TRAIN_DIR, 'retrain-lauf.json');
function ladeZustand() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf-8')); } catch { return null; }
}
function speichereZustand(z) {
  fs.mkdirSync(TRAIN_DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(z, null, 2), { encoding: 'utf-8' });
}

function zeilen(f) {
  try { return fs.readFileSync(f, 'utf-8').split('\n').filter(Boolean).length; } catch { return 0; }
}
const stunden = (sek) => `${Math.floor(sek / 3600)} h ${Math.round((sek % 3600) / 60)} min`;

// ── Plan ausgeben ────────────────────────────────────────────────────
const sekJeSpiel = FAST ? 20 : 100;
console.log('═'.repeat(72));
console.log('  PIXEL PARTIES — KOMPLETTES NEUTRAINING');
console.log('═'.repeat(72));
console.log(`  Decks im Lauf ........ ${DECKS.length}${ONLY.length || SKIP.length ? ` (von ${ALLE})` : ''}`);
console.log(`  Gegner je Deck ....... ${ALLE - 1} (jedes gegen jedes)`);
console.log(`  Spiele je Paarung .... ${MULT} pro Welle · ${MULT * WAVES} insgesamt`);
console.log(`  Wellen ............... ${WAVES} (Welle 1 Baseline, ab Welle 2 mit Profil der Vorwelle)`);
console.log(`  Spiele je Deck/Welle . ${PRO_DECK}`);
console.log(`  Spiele je Welle ...... ${PRO_WELLE.toLocaleString('de-DE')}`);
console.log(`  Spiele gesamt ........ ${GESAMT.toLocaleString('de-DE')}`);
console.log(`  Suchbudget ........... ${FAST ? 'reduziert (4000 ms / 24 Pulls)' : 'VOLL (--fast 0)'}`);
console.log(`  Parallele Auftraege .. ${JOBS}`);
console.log(`  Gegner-Profile ....... ${OPP_PROFILES ? 'AN (anderes Regime!)' : 'aus (wie gehabt)'}`);
console.log(`  Geschaetzte Laufzeit . ${stunden(GESAMT * sekJeSpiel / JOBS)}`
  + `  (${sekJeSpiel} s/Spiel, ${JOBS} parallel)`);
console.log('═'.repeat(72));

if (PLAN_ONLY) {
  console.log('  --plan: nichts ausgefuehrt.');
  process.exit(0);
}
if (!YES) {
  console.log('  ABBRUCH: dieser Lauf VERWIRFT alle vorhandenen Trainingsdaten und');
  console.log('  ersetzt alle Profile. Zum Starten erneut mit  --yes  aufrufen.');
  process.exit(1);
}

// ── Alte Daten beiseite ──────────────────────────────────────────────
// Nur EINMAL je Lauf, nicht bei jedem Wiederanlauf — sonst waere der
// zweite Aufruf nach einem Absturz ein Datenverlust.
let zustand = ladeZustand();
if (!zustand) {
  const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const laufDir = path.join(TRAIN_DIR, `retrain-${stempel}`);
  fs.mkdirSync(laufDir, { recursive: true });

  // Alte Trainingsdaten
  let verschoben = 0;
  const archiv = path.join(TRAIN_DIR, `_archiv-${stempel}`);
  try {
    const alt = fs.readdirSync(TRAIN_DIR).filter(f =>
      f !== path.basename(laufDir) && f !== path.basename(STATE) && !f.startsWith('_archiv-'));
    if (alt.length) {
      if (PURGE) {
        for (const f of alt) { fs.rmSync(path.join(TRAIN_DIR, f), { recursive: true, force: true }); verschoben++; }
        console.log(`[retrain] ${verschoben} alte Datei(en)/Ordner GELOESCHT (--purge).`);
      } else {
        fs.mkdirSync(archiv, { recursive: true });
        for (const f of alt) { fs.renameSync(path.join(TRAIN_DIR, f), path.join(archiv, f)); verschoben++; }
        console.log(`[retrain] ${verschoben} alte Datei(en)/Ordner nach ${path.relative(ROOT, archiv)} verschoben.`);
      }
    }
  } catch (err) { console.warn(`[retrain] Alte Daten nicht vollstaendig geraeumt: ${err.message}`); }

  // Alte Profile SICHERN, nicht loeschen — sie sind der Vergleichs-
  // massstab fuer `ab-all.js --vs`. Ohne sie gibt es nach dem Lauf
  // nichts mehr, wogegen sich das neue Set gepaart messen liesse.
  const altProfile = path.join(ROOT, 'data', `cpu-profiles-vor-${stempel}`);
  try {
    if (fs.existsSync(PROFILE_DIR) && fs.readdirSync(PROFILE_DIR).length) {
      fs.cpSync(PROFILE_DIR, altProfile, { recursive: true });
      for (const f of fs.readdirSync(PROFILE_DIR).filter(x => x.endsWith('.json'))) {
        fs.rmSync(path.join(PROFILE_DIR, f));
      }
      console.log(`[retrain] Alter Profilsatz gesichert nach ${path.relative(ROOT, altProfile)} und geleert.`);
      console.log(`[retrain]   Vergleich nach dem Lauf:`);
      console.log(`[retrain]   node scripts/ab-all.js --vs data/cpu-profiles-vor-${stempel} --tag neu-gegen-alt`);
    }
  } catch (err) { console.warn(`[retrain] Profile nicht gesichert: ${err.message}`); }

  zustand = { stempel, laufDir: path.relative(ROOT, laufDir), altProfile: path.relative(ROOT, altProfile),
    waves: WAVES, mult: MULT, fertig: {} };
  speichereZustand(zustand);
} else {
  console.log(`[retrain] WIEDERANLAUF des Laufs ${zustand.stempel} — fertige Arbeit wird uebersprungen.`);
}
const LAUF = path.join(ROOT, zustand.laufDir);
fs.mkdirSync(LAUF, { recursive: true });

const datei = (deck, welle) => path.join(LAUF, `${slugOf(deck)}-w${welle}.jsonl`);

// ── Eine Sammlung (ein Deck, eine Welle) ─────────────────────────────
function sammle(deck, welle) {
  return new Promise((resolve) => {
    const out = datei(deck, welle);
    const profil = path.join(PROFILE_DIR, `${slugOf(deck)}.json`);
    const mitProfil = welle > 1 && fs.existsSync(profil);
    let versuch = 0;
    const starte = () => {
      if (zeilen(out) >= PRO_DECK) return resolve({ deck, welle, ok: true, versuche: versuch });
      if (versuch >= MAX_ATTEMPTS) return resolve({ deck, welle, ok: false, versuche: versuch });
      versuch++;
      const env = {
        ...process.env,
        PP_TRAIN: '1',
        PP_TRAIN_DECK: deck,
        PP_TRAIN_GAMES_MULT: String(MULT),
        PP_TRAIN_OUT: out,
        PP_TRAIN_HORIZON: process.env.PP_TRAIN_HORIZON || '2',
        PP_GAME_TIMEOUT_MS: process.env.PP_GAME_TIMEOUT_MS || '600000',
      };
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      else { delete env.PP_MCTS_BUDGET_MS; delete env.PP_MCTS_PULLS; }
      // Ab Welle 2: MIT Profil sammeln (DAgger). Genau das ist der Sinn
      // der Wellen — die naechste Datenrunde entsteht in dem Zustandsraum,
      // den das aktuelle Profil tatsaechlich besucht.
      if (mitProfil) env.PP_TRAIN_EVAL = '1'; else delete env.PP_TRAIN_EVAL;
      if (OPP_PROFILES && welle > 1) env.PP_TRAIN_OPP_PROFILES = '1';
      else delete env.PP_TRAIN_OPP_PROFILES;
      const log = fs.createWriteStream(path.join(LAUF, `${slugOf(deck)}-w${welle}.log`), { flags: 'a' });
      log.write(`\n═══ Welle ${welle} · Versuch ${versuch} · ${new Date().toISOString()} `
        + `· ${mitProfil ? 'MIT Profil' : 'Baseline'} ═══\n`);
      const kind = spawn(process.execPath,
        [`--max-old-space-size=${HEAP}`, '--expose-gc', path.join(ROOT, 'server.js')],
        { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
      kind.stdout.pipe(log); kind.stderr.pipe(log);
      kind.on('exit', (code) => {
        // exit 2 = saubere Konfigurationsabsage, kein Wiederanlauf.
        if (code === 2) return resolve({ deck, welle, ok: false, versuche: versuch, grund: 'Konfiguration' });
        starte();
      });
    };
    starte();
  });
}

// ── Auftraege mit Parallelitaets-Deckel abarbeiten ───────────────────
async function parallel(aufgaben, n) {
  const ergebnisse = [];
  let i = 0;
  const arbeiter = async () => {
    while (i < aufgaben.length) {
      const k = i++;
      ergebnisse[k] = await aufgaben[k]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, aufgaben.length) }, arbeiter));
  return ergebnisse;
}

// ── Hauptlauf ────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  for (let welle = 1; welle <= WAVES; welle++) {
    console.log(`\n${'═'.repeat(72)}\n  WELLE ${welle}/${WAVES} — Sammlung (${DECKS.length} Decks à ${PRO_DECK} Spiele)\n${'═'.repeat(72)}`);
    const offen = DECKS.filter(d => zeilen(datei(d, welle)) < PRO_DECK);
    if (offen.length < DECKS.length) {
      console.log(`[retrain] ${DECKS.length - offen.length} Deck(s) dieser Welle bereits fertig — uebersprungen.`);
    }
    const res = await parallel(offen.map(d => () => sammle(d, welle)), JOBS);
    const kaputt = res.filter(r => r && !r.ok);
    for (const r of kaputt) console.warn(`[retrain] ⚠️  ${r.deck} Welle ${welle}: unvollstaendig (${r.grund || 'zu viele Neustarts'})`);

    console.log(`\n  WELLE ${welle}/${WAVES} — Training (kumulativ ueber Welle 1..${welle})`);
    for (const deck of DECKS) {
      // Kumulativ: der Trainer sieht ALLE bisherigen Wellen dieses Decks.
      // Die Herkunftsmarke je Datei (argv-Index) macht die Welle im
      // Modell zu einem beobachteten Faktor statt zu einem Stoerfaktor.
      const files = [];
      for (let w = 1; w <= welle; w++) { const f = datei(deck, w); if (zeilen(f) > 0) files.push(f); }
      if (!files.length) { console.warn(`[retrain] ${deck}: keine Daten — kein Training.`); continue; }
      const log = path.join(LAUF, `${slugOf(deck)}-train-w${welle}.log`);
      const r = spawnSync(process.execPath, [path.join(__dirname, 'train-deck-profile.js'), ...files],
        { cwd: ROOT, encoding: 'utf-8' });
      try { fs.writeFileSync(log, (r.stdout || '') + (r.stderr || ''), { encoding: 'utf-8' }); } catch { /* egal */ }
      const zeile = (r.stdout || '').split('\n').find(l => l.includes('HOLDOUT (Spiel-Modell)')) || '';
      console.log(`   ${r.status === 0 ? '✓' : '✗'} ${deck.padEnd(38)} ${zeile.trim().slice(0, 60)}`);
    }
    zustand.fertig[`welle${welle}`] = new Date().toISOString();
    speichereZustand(zustand);
    const verstrichen = (Date.now() - t0) / 1000;
    console.log(`\n[retrain] Welle ${welle} fertig nach ${stunden(verstrichen)}`
      + (welle < WAVES ? ` — geschaetzt noch ${stunden(verstrichen / welle * (WAVES - welle))}` : ''));
  }

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  FERTIG — ${WAVES} Wellen, ${GESAMT.toLocaleString('de-DE')} Spiele, ${stunden((Date.now() - t0) / 1000)}`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Neue Profile:  data/cpu-profiles/`);
  console.log(`  Alter Satz:    ${zustand.altProfile}`);
  console.log(`  Gepaart messen (der einzige driftfeste Vergleich):`);
  console.log(`    node scripts/ab-all.js --vs ${zustand.altProfile} --tag neu-gegen-alt`);
  console.log(`  Danach die Quarantaene-Gates neu setzen:`);
  console.log(`    node scripts/ab-all.js --write-gates --apply`);
})();
