#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  ALLE TRAINIERTEN DECKS GEGEN EIN NEUES DECK
//
//  Kommt ein neues Structure Deck dazu, kennen die 42 vorhandenen
//  Profile dieses Matchup nicht — sie wurden gegen ein Feld trainiert,
//  in dem es noch nicht vorkam. Dieses Skript sammelt fuer JEDES
//  trainierte Deck zusaetzliche Spiele AUSSCHLIESSLICH gegen das neue
//  Deck und trainiert sein Profil aus den zusammengelegten Daten neu.
//
//  Das Werkzeug darunter gab es schon: `PP_TRAIN_OPP` (Gegnerfilter,
//  Substring) im Batch-Runner von server.js. Was fehlte, war der
//  Durchstich — `train-all-decks.js` reicht die Variable nicht durch,
//  und die Resume-Logik ueber die Zeilenzahl braucht eine
//  AUFSTOCKENDE Zielzahl statt einer festen.
//
//  ── Warum in DIESELBE Sammeldatei geschrieben wird ────────────────
//  `data/training/<deck>.jsonl` ist die Grundlage, aus der
//  `train-deck-profile.js` das Profil baut. Wer die neuen Spiele in
//  eine eigene Datei legt, trainiert das Profil entweder NUR aus dem
//  neuen Matchup (und verliert alles Bisherige) oder muss zwei Dateien
//  zusammenfuehren. Angehaengt wird deshalb an die vorhandene Datei:
//  das Profil entsteht danach aus altem Feld PLUS neuem Matchup, genau
//  das ist „die Profile erweitern".
//
//  Aufruf (lokal):
//    node scripts/train-vs-deck.js --deck "Hellfire Battery" --games 120
//
//  Auf dem Server (nie als root, nie ohne systemd — siehe unten):
//    sudo systemd-run --unit=pp-vsdeck --collect \
//      --slice=pixelparties-training.slice \
//      --uid=pixelparties --gid=pixelparties \
//      --working-directory=/opt/pixelparties \
//      $(command -v node) scripts/train-vs-deck.js --deck "Hellfire Battery" --games 120
//    verfolgen: journalctl -fu pp-vsdeck
//    abbrechen: sudo systemctl stop pp-vsdeck   (Resume greift)
//
//  Schalter:
//    --deck <name>    PFLICHT. Das neue Deck (Substring genuegt).
//    --games N        zusaetzliche Spiele je Deck (Default 120)
//    --jobs N         parallele Worker (Default min(3, Kerne−1))
//    --only a,b       nur diese Decks trainieren (Substring)
//    --skip a,b       diese Decks auslassen
//    --all            auch Decks OHNE vorhandenes Profil aufnehmen
//    --fast 0         volles MCTS-Budget statt 4000 ms/24 Pulls
//    --no-retrain     nur sammeln, Profile nicht neu bauen
//    --list           zeigen, was zu tun waere, und beenden
//    --heap MB        Heap je Worker (Default 4096)
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DECK_DIR = path.join(ROOT, 'data', 'SampleDecks');
const OUT_DIR = path.join(ROOT, 'data', 'training');
const PROFILE_DIR = path.join(ROOT, 'data', 'cpu-profiles');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] != null ? args[i + 1] : fallback;
};
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// ── Welches Deck hat ein Profil? ─────────────────────────────────────
// NICHT aus dem Dateinamen ableiten. Die Sammeldecks heissen
// „Structure Deck Bamboo Warrior.txt" (und tragen intern
// „Name: Structure Deck: Bamboo Warrior"), das Profil heisst aber
// `bamboo-warrior.json` und fuehrt `deck: "Bamboo Warrior"`. Jede
// geratene Umformung geht bei irgendeiner Schreibweise daneben — beim
// ersten Anlauf fielen so 39 von 42 Decks als „ohne Profil" durch.
// Stattdessen den Deckbezug AUS den Profilen lesen und ueber den
// normalisierten Namen zuordnen.
function profilDeckNamen() {
  const namen = new Set();
  let dateien = [];
  try { dateien = fs.readdirSync(PROFILE_DIR).filter(f => f.endsWith('.json')); } catch { return namen; }
  for (const f of dateien) {
    let deck = null;
    try { deck = JSON.parse(fs.readFileSync(path.join(PROFILE_DIR, f), 'utf8'))?.deck; } catch { /* kaputtes Profil ignorieren */ }
    if (deck) namen.add(norm(deck));
    namen.add(norm(f.replace(/\.json$/, '')));   // Dateiname als zweiter Schluessel
  }
  return namen;
}
const PROFIL_NAMEN = profilDeckNamen();
const hatProfil = (deckDatei) => {
  const n = norm(deckDatei);
  for (const p of PROFIL_NAMEN) if (n.includes(p) || p.includes(n)) return true;
  return false;
};

const ZIEL_ROH   = getArg('--deck', null);
const GAMES      = parseInt(getArg('--games', '120'), 10);
const JOBS       = parseInt(getArg('--jobs', String(Math.max(1, Math.min(3, os.cpus().length - 1)))), 10);
const FAST       = getArg('--fast', '1') !== '0';
const HEAP       = getArg('--heap', '4096');
const NO_RETRAIN = args.includes('--no-retrain');
const LIST_ONLY  = args.includes('--list');
const ALLE       = args.includes('--all');
const only = getArg('--only', null);
const skip = getArg('--skip', null);

if (!ZIEL_ROH) {
  console.error('Pflichtangabe fehlt: --deck "<Name des neuen Decks>"');
  console.error('Beispiel: node scripts/train-vs-deck.js --deck "Hellfire Battery" --games 120');
  process.exit(2);
}
if (!(GAMES > 0)) { console.error('--games muss > 0 sein'); process.exit(2); }

// ── Decks einsammeln ─────────────────────────────────────────────────
if (!fs.existsSync(DECK_DIR)) {
  console.error(`Kein SampleDecks-Ordner unter ${DECK_DIR}`);
  process.exit(2);
}
const alleDecks = fs.readdirSync(DECK_DIR)
  .filter(f => f.endsWith('.txt'))
  .map(f => f.replace(/\.txt$/, ''))
  .sort();

// Das neue Deck aufloesen — Substring, wie der Batch-Runner es macht.
const zielTreffer = alleDecks.filter(d => norm(d).includes(norm(ZIEL_ROH)) || norm(ZIEL_ROH).includes(norm(d)));
if (zielTreffer.length === 0) {
  console.error(`--deck "${ZIEL_ROH}" trifft kein Sample-Deck. Vorhanden:`);
  for (const d of alleDecks) console.error(`   ${d}`);
  process.exit(2);
}
if (zielTreffer.length > 1) {
  console.error(`--deck "${ZIEL_ROH}" ist mehrdeutig: ${zielTreffer.join(', ')}`);
  process.exit(2);
}
const ZIEL = zielTreffer[0];

const matchesAny = (deckName, set) => {
  if (!set) return false;
  const n = norm(deckName);
  for (const entry of set) if (n.includes(entry) || entry.includes(n)) return true;
  return false;
};
const onlySet = only ? new Set(only.split(',').map(norm)) : null;
const skipSet = skip ? new Set(skip.split(',').map(norm)) : null;

let trainees = alleDecks.filter(d => d !== ZIEL);          // nie gegen sich selbst
if (onlySet) trainees = trainees.filter(d => matchesAny(d, onlySet));
if (skipSet) trainees = trainees.filter(d => !matchesAny(d, skipSet));
if (!ALLE) {
  const ohneProfil = trainees.filter(d => !hatProfil(d));
  trainees = trainees.filter(d => hatProfil(d));
  if (ohneProfil.length > 0) {
    console.log(`[vs] ${ohneProfil.length} Deck(s) ohne Profil uebersprungen (mit --all einbeziehen): ${ohneProfil.join(', ')}`);
  }
}

const zeilen = (p) => {
  try { return fs.readFileSync(p, { encoding: 'utf-8' }).split('\n').filter(l => l.trim()).length; }
  catch { return 0; }
};
const outPfad = (deck) => path.join(OUT_DIR, `${norm(deck)}.jsonl`);

// Zielzahl je Deck: vorhandene Zeilen + die gewuenschten neuen Spiele.
// Der Batch-Runner resumiert ueber die Zeilenzahl, also stockt er damit
// genau um `GAMES` auf — ohne die vorhandenen Daten anzutasten.
const plan = trainees.map(d => {
  const p = outPfad(d);
  const vorher = zeilen(p);
  return { deck: d, pfad: p, vorher, ziel: vorher + GAMES };
});

if (LIST_ONLY) {
  console.log(`═══ Neues Deck: "${ZIEL}" — ${plan.length} Deck(s) wuerden je ${GAMES} Spiele dagegen sammeln ═══`);
  for (const e of plan) {
    console.log(`   ${e.deck.padEnd(34)} ${String(e.vorher).padStart(5)} vorhanden → ${e.ziel}`);
  }
  const stunden = (plan.length * GAMES * (FAST ? 20 : 90)) / 3600 / Math.max(1, JOBS);
  console.log(`\nGrobschaetzung: ~${stunden.toFixed(1)} h bei ${JOBS} Worker(n), ${FAST ? 'reduziertem' : 'vollem'} Budget.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`═══ "${ZIEL}" gegen ${plan.length} trainierte Deck(s) — je ${GAMES} neue Spiele, ${JOBS} Worker, ${FAST ? 'reduziertes' : 'volles'} Budget ═══`);
console.log(`    Gesammelt wird in die VORHANDENEN Sammeldateien; die Profile entstehen danach aus altem Feld PLUS neuem Matchup.\n`);

// ── Ein Deck abarbeiten ──────────────────────────────────────────────
function sammle(eintrag) {
  return new Promise((fertig) => {
    let versuche = 0;
    const runde = () => {
      if (zeilen(eintrag.pfad) >= eintrag.ziel) return fertig({ ok: true });
      if (versuche >= 10) return fertig({ ok: false, grund: 'zu viele Neustarts' });
      versuche++;
      const env = {
        ...process.env,
        PP_TRAIN: '1',
        PP_TRAIN_DECK: eintrag.deck,
        PP_TRAIN_OPP: ZIEL,                       // ← der ganze Zweck
        PP_TRAIN_GAMES: String(eintrag.ziel),     // aufstockend, nicht absolut
        PP_TRAIN_HORIZON: '1',
        PP_TRAIN_OUT: eintrag.pfad,
        PP_TRAIN_HEAP_MB: process.env.PP_TRAIN_HEAP_MB || '2000',
      };
      if (FAST) { env.PP_MCTS_BUDGET_MS = '4000'; env.PP_MCTS_PULLS = '24'; }
      const kind = spawn(process.execPath,
        [`--max-old-space-size=${HEAP}`, '--expose-gc', path.join(ROOT, 'server.js')],
        { cwd: ROOT, env, stdio: 'inherit' });
      kind.on('exit', (code) => {
        // exit 2 = Konfigurationsfehler (Gegnerfilter trifft nichts) —
        // ein Neustart wuerde nur denselben Fehler wiederholen.
        if (code === 2) return fertig({ ok: false, grund: 'Konfigurationsfehler (exit 2)' });
        if (code !== 0) console.error(`[vs] "${eintrag.deck}": Code ${code} — Neustart (${versuche}/10, Resume greift)`);
        runde();
      });
    };
    runde();
  });
}

function trainiere(eintrag) {
  const vorhanden = zeilen(eintrag.pfad);
  if (vorhanden < 20) return { ok: false, grund: `nur ${vorhanden} Spiele (Trainer verlangt 20)` };
  const t = spawnSync(process.execPath,
    [path.join(ROOT, 'scripts', 'train-deck-profile.js'), eintrag.pfad],
    { cwd: ROOT, stdio: 'inherit' });
  return t.status === 0 ? { ok: true } : { ok: false, grund: `Trainer Code ${t.status}` };
}

// ── Worker-Pool ──────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  const warteschlange = plan.slice();
  const ergebnisse = [];
  let laufend = 0;

  await new Promise((alleFertig) => {
    const naechstes = () => {
      if (warteschlange.length === 0 && laufend === 0) return alleFertig();
      while (laufend < JOBS && warteschlange.length > 0) {
        const e = warteschlange.shift();
        laufend++;
        if (e.vorher >= e.ziel) {
          ergebnisse.push({ ...e, status: 'schon voll' });
          laufend--; continue;
        }
        console.log(`[vs] ▶ "${e.deck}" — ${e.vorher} → ${e.ziel} Spiele gegen "${ZIEL}"`);
        sammle(e).then((r) => {
          const nachher = zeilen(e.pfad);
          if (!r.ok) {
            ergebnisse.push({ ...e, nachher, status: `Sammlung fehlgeschlagen: ${r.grund}` });
          } else if (NO_RETRAIN) {
            ergebnisse.push({ ...e, nachher, status: 'gesammelt (ohne Retrain)' });
          } else {
            const t = trainiere(e);
            ergebnisse.push({ ...e, nachher, status: t.ok ? 'fertig' : `Training fehlgeschlagen: ${t.grund}` });
          }
          console.log(`[vs] ◀ "${e.deck}" — ${ergebnisse[ergebnisse.length - 1].status} (${nachher} Spiele gesamt)`);
          laufend--;
          naechstes();
        });
      }
    };
    naechstes();
  });

  // ── Bericht ────────────────────────────────────────────────────────
  console.log(`\n═══ FERTIG nach ${((Date.now() - t0) / 60000).toFixed(1)} min ═══`);
  console.log(`${'Deck'.padEnd(34)}${'vorher'.padStart(8)}${'nachher'.padStart(9)}   Status`);
  let gut = 0;
  for (const e of ergebnisse.sort((a, b) => a.deck.localeCompare(b.deck))) {
    if (e.status === 'fertig' || e.status === 'schon voll') gut++;
    console.log(`${e.deck.slice(0, 33).padEnd(34)}${String(e.vorher).padStart(8)}${String(e.nachher ?? e.vorher).padStart(9)}   ${e.status}`);
  }
  console.log(`\n${gut}/${ergebnisse.length} Deck(s) sauber durch.`);
  console.log(`Naechster Schritt: Wirksamkeit nachmessen —`);
  console.log(`  node scripts/ab-all.js --games 400 --tag vs-${norm(ZIEL)}`);
  console.log(`(eigener --tag, damit die Messung nicht in den Topf der Grundmessung laeuft)`);
  process.exit(ergebnisse.some(e => String(e.status).includes('fehlgeschlagen')) ? 1 : 0);
})();
