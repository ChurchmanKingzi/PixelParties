#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
//  BANDBREITEN-MESSSTAND — bequemer Aufruf
//
//  Startet `server.js` im Messmodus (PP_NETTEST=1) und laesst es CPU-
//  gegen-CPU-Partien spielen, waehrend jede Nachricht mitgezaehlt wird,
//  die an echte Clients rausginge. Gemessen wird der Rahmen, den
//  socket.io tatsaechlich schickt, plus die Leitungsbytes nach
//  permessage-deflate — also genau das, was Render als „WebSocket
//  Responses" berechnet.
//
//  BEISPIELE
//    node scripts/netbench.js
//    node scripts/netbench.js --games 20
//    node scripts/netbench.js --games 10 --spectators 3
//    node scripts/netbench.js --deck-a "Heal Burn" --deck-b "Deepsea Terror"
//    node scripts/netbench.js --games 30 --low        (neben einem Training)
//
//  AUSGABE
//    Eine Zeile je fertiger Partie (wie beim Training), dazwischen ein
//    Lebenszeichen mit Halbzug und Nachrichtenzahl. Die Engine-Ausgabe
//    wird unterdrueckt und nur gezeigt, wenn eine Partie haengt oder
//    abbricht. Der volle Bericht landet als .txt UND .json in
//    data/netbench/.
//
//  NEBEN EINEM LAUFENDEN TRAINING
//    `--low` senkt die Prozesspriorität, damit `train-iterative` den
//    Vortritt hat. Beide Prozesse sind voneinander unabhaengig: der
//    Messstand oeffnet weder Datenbank noch Socket-Server und schreibt
//    nur seinen eigenen Bericht nach data/netbench/. Rechne trotzdem
//    mit einem Kern und ~1 GB extra.
//
//  OPTIONEN
//    --games N        Partien (Vorgabe 5)
//    --spectators N   zusaetzliche Zuschauer je Partie (Vorgabe 0)
//    --deck-a NAME    Deckname, Teiltreffer genuegt (sonst zufaellig)
//    --deck-b NAME
//    --horizon N      MCTS-Rollout-Horizont (Vorgabe 2; kleiner = schneller)
//    --realtime       Animationspausen NICHT ueberspringen
//    --verbose        Engine-/CPU-Ausgabe NICHT unterdruecken (laut!)
//    --no-profiles    Deck-Profile abschalten. Vorgabe ist AN, weil das
//                     dem Live-Spiel entspricht — gelernte Entscheidungen
//                     wie Barkers Start-Griff sparen dort ganze Suchen.
//    --max-turns N    Obergrenze an Halbzuegen je Partie (Vorgabe 400).
//                     Partien, die das reissen, sind Endlos-Paarungen und
//                     werden aus der Wertung genommen.
//    --game-ms N      Zeitlimit je Partie in Millisekunden (Vorgabe 600000)
//    --cpu-turn-ms N  Denkzeit je LIVE-Zug (Vorgabe 30000, 0 = Engine-Vorgabe
//                     von 90 s). Kappt NUR pathologische Zuege — ein
//                     gesunder Zug ist laut Engine unter 10 s durch.
//    --brain NAME     Rollout-Brain: evalGreedy (Vorgabe) oder heuristic.
//                     heuristic ist deutlich schneller, spielt aber anders.
//    --stall-ms N     ab wann eine Partie als haengend gilt (Vorgabe 90000).
//                     Grosszuegig, weil eine einzelne MCTS-Entscheidung
//                     neben einem laufenden Training lange dauern darf.
//    --low            eigene Prozesspriorität senken
//    --out DATEI      Zielpfad des JSON-Berichts
// ═══════════════════════════════════════════════════════════════════

const { spawnSync } = require('child_process');
const path = require('path');

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(require('fs').readFileSync(__filename, 'utf-8')
    .split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(0);
}
const wert = (name, vorgabe) => {
  const i = argv.indexOf(name);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : vorgabe;
};
const schalter = (name) => argv.includes(name);

const env = { ...process.env, PP_NETTEST: '1', PP_NO_WATCH: '1' };
env.PP_NETTEST_GAMES = wert('--games', '5');
env.PP_NETTEST_SPECTATORS = wert('--spectators', '0');
env.PP_NETTEST_HORIZON = wert('--horizon', '2');
if (wert('--deck-a', null)) env.PP_NETTEST_DECK_A = wert('--deck-a', '');

// ── Gegnerdeck (v395: Vorgabe entfernt) ─────────────────────────────
// Bis v394 stand hier "Gates to Hell" fest verdrahtet, damit die
// `ohne-spielende`-Abbrueche reproduzierbar auftraten. Die Ursache ist
// gefunden (verschlucktes Promise in `normalizeConfirm`), also wird
// wieder zufaellig gepaart.
if (wert('--deck-b', null)) env.PP_NETTEST_DECK_B = wert('--deck-b', '');
if (wert('--out', null)) env.PP_NETTEST_OUT = wert('--out', '');
if (schalter('--realtime')) env.PP_NETTEST_REALTIME = '1';
if (schalter('--verbose')) env.PP_NETTEST_VERBOSE = '1';
if (schalter('--no-profiles')) env.PP_NETTEST_NO_PROFILES = '1';
env.PP_NETTEST_MAX_TURNS = wert('--max-turns', '400');
env.PP_NETTEST_GAME_MS = wert('--game-ms', '600000');
env.PP_NETTEST_STALL_MS = wert('--stall-ms', '90000');
env.PP_NETTEST_CPU_TURN_MS = wert('--cpu-turn-ms', '30000');
if (wert('--brain', null)) env.PP_NETTEST_BRAIN = wert('--brain', '');
if (schalter('--low')) env.PP_NETTEST_LOW = '1';

const root = path.join(__dirname, '..');
const r = spawnSync('node', ['server.js'], { cwd: root, env, stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
