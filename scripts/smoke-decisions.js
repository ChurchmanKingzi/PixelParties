#!/usr/bin/env node
// Liest einen frisch gesammelten Trainings-Satz und beantwortet die eine
// Frage, die vor einem mehrtägigen Sammellauf zählt: KOMMT DER
// ENTSCHEIDUNGS-KANAL ÜBERHAUPT AN?
//
//   node scripts/smoke-decisions.js data/training/_smoke.jsonl
//
// Uninstrumentierte Spiele lassen sich nicht nachträglich
// instrumentieren — deshalb diese Prüfung VOR dem großen Lauf.
'use strict';
const fs = require('fs');
const datei = process.argv[2] || 'data/training/_smoke.jsonl';
// ★ ZEILENWEISE parsen, kaputte ueberspringen. Wird der Sammellauf
// mitten in einem `appendFileSync` abgebrochen (Abmeldung, Absturz,
// Strg-C), ist die LETZTE Zeile abgeschnitten — und ein Parser, der
// alles auf einmal liest, wirft dann die ganze Datei weg. Genau das ist
// mir bei der ersten Auswertung passiert.
let zeilen = [], kaputt = 0;
try {
  for (const l of fs.readFileSync(datei, 'utf-8').split('\n')) {
    if (!l.trim()) continue;
    try { zeilen.push(JSON.parse(l)); } catch { kaputt++; }
  }
} catch (err) { console.error(`Kann ${datei} nicht lesen: ${err.message}`); process.exit(1); }
if (!zeilen.length) { console.error(`${datei} enthaelt keine lesbare Zeile.`); process.exit(1); }
if (kaputt) console.log(`  (${kaputt} unvollstaendige Zeile(n) uebersprungen — Lauf wurde abgebrochen)`);

const summe = { gen: 0, tgt: 0, roll: 0, fremd: 0, voll: 0, schrieb: 0 };
const wrapper = {}; const arten = {}; let mitFeld = 0, zeilenGesamt = 0, mitDEval = 0, mitEnde = 0;
for (const g of zeilen) {
  const d = g.decisionDiag;
  if (d) {
    mitFeld++;
    for (const k of Object.keys(summe)) summe[k] += (d[k] || 0);
    wrapper[d.wrapper || '—'] = (wrapper[d.wrapper || '—'] || 0) + 1;
  }
  for (const z of (g.decisions || [])) {
    zeilenGesamt++;
    arten[z.a] = (arten[z.a] || 0) + 1;
    if (z.r && Number.isFinite(z.r.dEval)) { mitDEval++; if (z.r.end) mitEnde++; }
  }
}
const n = zeilen.length;
const pf = (b) => (b ? '✓' : '✗');
console.log('═'.repeat(64));
console.log(`  RAUCHTEST ENTSCHEIDUNGS-KANAL — ${n} Spiele aus ${datei}`);
console.log('═'.repeat(64));
console.log(`  Spiele mit decisionDiag ... ${mitFeld}/${n}`);
console.log(`  Wrapper-Status ............ ${Object.entries(wrapper).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.log(`  Trichter durchlaufen ...... promptGeneric ${summe.gen}, promptEffectTarget ${summe.tgt}`);
console.log(`  Rollouts ausgeschlossen ... ${summe.roll}`);
console.log(`  Gegnerseite gefiltert ..... ${summe.fremd}`);
console.log(`  Am 4000er-Deckel .......... ${summe.voll}`);
console.log(`  Zeilen geschrieben ........ ${summe.schrieb}  (${(zeilenGesamt / n).toFixed(1)} je Spiel)`);
console.log(`  Arten ..................... ${Object.entries(arten).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}`);
console.log(`  Verzögert bewertet ........ ${mitDEval}/${zeilenGesamt} (davon ${mitEnde} gegen den Endstand)`);
// -- KONTRAST: hat jeder Kanal seinen Gegenarm? --------------------
// ACHTUNG, hier steckte in v594 ein Denkfehler von mir: ich habe
// 》100 % ja = kein Gegenarm《 auf ALLE Kanaele angewandt. Das gilt aber
// nur fuer JA/NEIN-Entscheidungen. `gallery`, `discard`, `mode`,
// `hand`, `zone` sind PFLICHTWAHLEN — man MUSS eine Karte abwerfen,
// eine Zone waehlen, eine Option nehmen. Dort ist `f=1` per
// Konstruktion immer wahr, und der Kontrast liegt in der Frage WELCHE.
// Der Test meldete deshalb sechs gesunde Kanaele als kaputt.
//
// Zweiter Fehler: er faellte ein Urteil bei EINER Zeile. Eine Karte,
// die im geprueften Deck gar nicht vorkommt, ist kein Defekt, sondern
// fehlende Datenlage.
const BINAER = new Set(['optIn', 'gerryNegate']);   // echte Ja/Nein-Tore
const MIN_URTEIL = 30;   // darunter wird nur berichtet, nicht geurteilt

const proArt = {};
for (const g of zeilen) {
  for (const z of (g.decisions || [])) {
    const a = (proArt[z.a] = proArt[z.a] || { n: 0, ja: 0, wahlen: new Set(), karten: {} });
    a.n++; if (z.f === 1) a.ja++;
    a.wahlen.add(z.w === null || z.w === undefined ? '(abgelehnt)' : String(z.w));
    if (z.c) {
      const k = (a.karten[z.c] = a.karten[z.c] || { ja: 0, nein: 0 });
      if (z.f === 1) k.ja++; else k.nein++;
    }
  }
}
console.log('-'.repeat(64));
console.log('  KONTRAST — hat jeder Kanal seinen Gegenarm?');
const ohneKontrast = [], zuDuenn = [];
for (const [art, a] of Object.entries(proArt).sort((x, y) => y[1].n - x[1].n)) {
  const quote = a.n ? Math.round(100 * a.ja / a.n) : 0;
  const binaer = BINAER.has(art);
  // Ja/Nein-Tor: beide Arme noetig. Pflichtwahl: mindestens zwei
  // verschiedene Wahlen (》abgelehnt《 zaehlt als eine davon).
  const ok = binaer ? (a.ja > 0 && a.ja < a.n) : (a.wahlen.size >= 2);
  const genug = a.n >= MIN_URTEIL;
  if (genug && !ok) ohneKontrast.push(art);
  if (!genug) zuDuenn.push(`${art} (${a.n})`);
  const zeichen = !genug ? '·' : ok ? 'ok' : 'XX';
  console.log(`  ${zeichen.padEnd(2)} ${art.padEnd(28)} ${String(a.n).padStart(5)} Zeilen · `
    + (binaer ? `${String(quote).padStart(3)} % ja / ${String(100 - quote).padStart(3)} % nein`
              : `${String(a.wahlen.size).padStart(4)} versch. Wahlen`));
}
if (zuDuenn.length) {
  console.log(`  ·  zu wenig Daten fuer ein Urteil (< ${MIN_URTEIL} Zeilen): ${zuDuenn.join(', ')}`);
  console.log(`     Kein Defekt — diese Karten kommen im geprueften Deck kaum vor.`);
}
// optIn wird PRO KARTE gelernt — dort muss der Kontrast je Karte stehen.
const oi = proArt.optIn;
let optInDuenn = false;
if (oi) {
  const karten = Object.entries(oi.karten);
  const reif = karten.filter(([, k]) => k.ja + k.nein >= 10);
  const beide = reif.filter(([, k]) => k.ja > 0 && k.nein > 0).length;
  optInDuenn = reif.length < 3;
  console.log(`  ${optInDuenn ? '·' : beide === reif.length ? 'ok' : 'XX'} optIn je Karte: `
    + `${beide}/${reif.length} Karten mit BEIDEN Armen (von ${karten.length}, ab 10 Zeilen beurteilt)`);
  if (optInDuenn) console.log(`     Zu wenig Zeilen je Karte fuer ein Urteil — im grossen Lauf sind es`
    + ` rund ${Math.round(karten.length ? oi.n / karten.length : 0)} x 143 mal so viele.`);
  else if (beide < reif.length) ohneKontrast.push('optIn (einzelne Karten)');
}
console.log('-'.repeat(64));

const proben = [
  ['decisionDiag in jedem Spiel', mitFeld === n,
    'Der Recorder liefert das Feld nicht — läuft ein alter Build?'],
  ['Hülle nirgends überschrieben', !!wrapper.ok && Object.keys(wrapper).length === 1,
    'Jemand hüllt promptGeneric NACH dem Recorder ein — genau die v589-Lage.'],
  ['Trichter werden durchlaufen', summe.gen > 0,
    'promptGeneric wurde nie erreicht. Ohne das kann nichts geschrieben werden.'],
  ['Zeilen kommen an', summe.schrieb > 0,
    summe.fremd > summe.schrieb
      ? 'Fast alles fiel auf die Gegnerseite — pinnedIdx prüfen.'
      : 'Trichter laufen, aber nichts wird geschrieben.'],
  ['Rollouts werden ausgeschlossen', summe.roll > 0,
    'roll=0 heißt: der Ausschluss hatte nichts zu tun. Bei 24–80 Pulls je Zug ist das unplausibel.'],
  ['Deckel nicht gerissen', summe.voll === 0,
    'Der 4000-Zeilen-Deckel greift — das Protokoll ist unvollständig.'],
  ['Ablehnungen werden erfasst', zeilenGesamt === 0 || (zeilen.some(g => (g.decisions || []).some(z => z.f === 0))),
    'Keine einzige abgelehnte Entscheidung. Ohne Nullen gibt es keine Grundrate.'],
  ['Verzögerte Bewertung greift', mitDEval > 0,
    'Kein r.dEval — der Nachtrag am Zugbeginn läuft nicht.'],
  ['Jeder Kanal hat einen Gegenarm', ohneKontrast.length === 0,
    `Ohne Kontrast unlernbar: ${ohneKontrast.join(', ')}. `
    + 'Exploration prüfen (PP_OPTIN_EXPLORE, PP_OPTION_EXPLORE, PP_GERRY_EXPLORE, '
    + 'PP_MENU_EXPLORE, PP_GALLERY_EXPLORE) — im Sammelmodus muss PP_TRAIN gesetzt sein.'],
];
let rot = 0;
for (const [name, ok, hinweis] of proben) {
  console.log(`  ${pf(ok)} ${name}`);
  if (!ok) { console.log(`      → ${hinweis}`); rot++; }
}
console.log('─'.repeat(64));
if (rot === 0) console.log('  ALLES GRÜN — der große Sammellauf kann starten.');
else console.log(`  ${rot} Prüfung(en) rot — NICHT sammeln, erst klären.`);
process.exit(rot === 0 ? 0 : 1);
