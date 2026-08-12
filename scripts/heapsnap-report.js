#!/usr/bin/env node
// ═══════════════════════════════════════════
//  HEAP-SNAPSHOT AUSWERTEN — ohne Chrome, ohne den Speicher zu sprengen
//
//  V8 schreibt beim OOM (PP_TRAIN_HEAPSNAP=1) eine .heapsnapshot-Datei.
//  Die ist so groß wie der geplatzte Heap — bei 1536 MB Limit also rund
//  1,5 GB. Chrome DevTools kann das öffnen, braucht dafür aber selbst
//  mehrere GB und scheitert auf einer Arbeitsmaschine gern.
//
//  Dieses Skript LIEST DIE DATEI STRÖMEND und hält nie mehr als eine
//  Zusammenfassung im Speicher. Es beantwortet die eine Frage, die der
//  Absturz stellt: WELCHE Objektsorte hat den Heap gefüllt?
//
//  Nutzung:
//    node heapsnap-report.js Heap.20260810.231720.10312.0.001.heapsnapshot
//
//  Ausgabe: die größten Klassen nach belegten Bytes und nach Anzahl.
//  Das ist die FLACHE Größe (self size) — nicht die von DevTools
//  gezeigte "Retained Size". Für die Frage "was hat sich millionenfach
//  angesammelt" reicht das; für "wer hält es fest" braucht es DevTools.
//
//  Kein Projektbestandteil — Wegwerf-Werkzeug, nach Gebrauch löschen.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');

const datei = process.argv[2];
if (!datei) {
  console.error('Aufruf: node heapsnap-report.js <datei.heapsnapshot>');
  process.exit(1);
}
if (!fs.existsSync(datei)) {
  console.error('Datei nicht gefunden:', datei);
  process.exit(1);
}

const groesse = fs.statSync(datei).size;
console.log(`Datei: ${datei}`);
console.log(`Größe: ${(groesse / 1048576).toFixed(0)} MB — wird strömend gelesen, das dauert einen Moment.\n`);

// ── Kopf lesen: Feldreihenfolge und Typnamen ───────────────────────
// Der Kopf steht in den ersten Kilobytes; er sagt, wie viele Zahlen ein
// Knoten hat und an welcher Stelle Typ, Name und Größe stehen. Die
// Reihenfolge ist NICHT über alle Node-Versionen gleich, deshalb wird
// sie gelesen statt angenommen.
const kopfPuffer = Buffer.alloc(Math.min(65536, groesse));
{
  const fd = fs.openSync(datei, 'r');
  fs.readSync(fd, kopfPuffer, 0, kopfPuffer.length, 0);
  fs.closeSync(fd);
}
const kopf = kopfPuffer.toString('utf-8');

const mFields = /"node_fields"\s*:\s*\[([^\]]*)\]/.exec(kopf);
if (!mFields) { console.error('Kein "node_fields" im Kopf gefunden — ist das wirklich ein .heapsnapshot?'); process.exit(1); }
const nodeFields = JSON.parse('[' + mFields[1] + ']');
const idxType = nodeFields.indexOf('type');
const idxName = nodeFields.indexOf('name');
const idxSize = nodeFields.indexOf('self_size');
const felderProKnoten = nodeFields.length;

// node_types ist ein Array, dessen ERSTES Element die Typnamen enthält.
const mTypes = /"node_types"\s*:\s*\[\s*\[([^\]]*)\]/.exec(kopf);
const typNamen = mTypes ? JSON.parse('[' + mTypes[1] + ']') : [];

const mEFields = /"edge_fields"\s*:\s*\[([^\]]*)\]/.exec(kopf);
const edgeFields = mEFields ? JSON.parse('[' + mEFields[1] + ']') : [];
const eIdxType = edgeFields.indexOf('type');
const eIdxName = edgeFields.indexOf('name_or_index');
const felderProKante = edgeFields.length;
const mETypes = /"edge_types"\s*:\s*\[\s*\[([^\]]*)\]/.exec(kopf);
const kantenTypen = mETypes ? JSON.parse('[' + mETypes[1] + ']') : [];
// Bei diesen Kantentypen ist `name_or_index` ein STRING-Index (ein
// Eigenschaftsname); bei 'element'/'hidden' ist es eine Array-Position
// und damit als Name wertlos.
const NAMENSKANTEN = new Set(['property', 'internal', 'shortcut', 'context']);

console.log(`  Knotenfelder: ${nodeFields.join(', ')}  (${felderProKnoten} je Knoten)`);
if (felderProKante) console.log(`  Kantenfelder: ${edgeFields.join(', ')}  (${felderProKante} je Kante)`);

// ── Strömendes Einlesen ────────────────────────────────────────────
// Zwei Abschnitte interessieren: "nodes" (flaches Zahlenfeld) und
// "strings" (die Namen). "strings" steht in V8-Snapshots hinter
// "nodes" — wenn die Knoten fertig sind, steht die Rangliste also
// schon fest und es müssen nur noch die Namen der Spitzenreiter
// herausgefischt werden.
// Schluessel ist Typ + Namensindex, NICHT der Name allein: ein
// Konstruktorname taucht doppelt auf — einmal als Objektknoten
// ("500 000 Objekte der Klasse X") und einmal als String-Knoten, der
// diesen Namen traegt. Beides zusammenzuzaehlen wuerde die Diagnose
// verfaelschen.
const proName = new Map();   // "typ\u0000nameIndex" -> { n, bytes, typ, nameIdx }
const proTyp = new Map();    // typName    -> { n, bytes }

let abschnitt = 'suche';     // suche | nodes | strings | fertig
let feldPos = 0;             // Position innerhalb des aktuellen Knotens
let zahl = '';               // angefangene Zahl über Chunk-Grenzen hinweg
let kType = 0, kName = 0, kSize = 0;
let knoten = 0;

// Zustand des String-Scanners
// Kanten: welche EIGENSCHAFTSNAMEN zeigen auf diese Objekte? Das ist
// der Fingerabdruck der Struktur — millionenfach dieselben Feldnamen
// verraten, welches Objektliteral im Quelltext gebaut wird.
const proKante = new Map();  // "kantentyp\u0000nameIndex" -> { n, nameIdx, typ }
let eFeldPos = 0, eType = 0, eName = 0, kanten = 0;

let sIndex = 0;
let inString = false, escaped = false, roh = '';
let wunschNamen = null;      // Set von nameIndex, deren Text wir brauchen
const namenText = new Map();

function knotenFertig() {
  knoten++;
  const typ = typNamen[kType] || ('typ' + kType);
  let t = proTyp.get(typ);
  if (!t) proTyp.set(typ, t = { n: 0, bytes: 0 });
  t.n++; t.bytes += kSize;

  const schluessel = typ + '\u0000' + kName;
  let e = proName.get(schluessel);
  if (!e) proName.set(schluessel, e = { n: 0, bytes: 0, typ, nameIdx: kName });
  e.n++; e.bytes += kSize;
}

function kanteFertig() {
  kanten++;
  const typ = kantenTypen[eType] || ('typ' + eType);
  if (!NAMENSKANTEN.has(typ)) return;
  const schluessel = typ + '\u0000' + eName;
  let e = proKante.get(schluessel);
  if (!e) proKante.set(schluessel, e = { n: 0, nameIdx: eName, typ });
  e.n++;
}

function nimmKantenZahl() {
  if (zahl === '') return;
  const w = Number(zahl);
  zahl = '';
  if (eFeldPos === eIdxType) eType = w;
  else if (eFeldPos === eIdxName) eName = w;
  eFeldPos++;
  if (eFeldPos === felderProKante) { kanteFertig(); eFeldPos = 0; }
}

function nimmZahl() {
  if (zahl === '') return;
  const w = Number(zahl);
  zahl = '';
  if (feldPos === idxType) kType = w;
  else if (feldPos === idxName) kName = w;
  else if (feldPos === idxSize) kSize = w;
  feldPos++;
  if (feldPos === felderProKnoten) { knotenFertig(); feldPos = 0; }
}

function spitzenNamenBestimmen() {
  const nachBytes = [...proName.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 40);
  const nachAnzahl = [...proName.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
  const kanten40 = [...proKante.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40);
  wunschNamen = new Set([...nachBytes, ...nachAnzahl, ...kanten40].map(([, e]) => e.nameIdx));
}

const strom = fs.createReadStream(datei, { encoding: 'utf-8', highWaterMark: 4 * 1024 * 1024 });
let rest = '';
let gelesen = 0;
let letzteMeldung = Date.now();

strom.on('data', (stueck) => {
  gelesen += Buffer.byteLength(stueck, 'utf-8');
  if (Date.now() - letzteMeldung > 4000) {
    letzteMeldung = Date.now();
    process.stdout.write(`\r  gelesen: ${(gelesen / 1048576).toFixed(0)}/${(groesse / 1048576).toFixed(0)} MB, Knoten: ${knoten}   `);
  }
  let text = rest + stueck;
  rest = '';

  while (text.length > 0) {
    if (abschnitt === 'suche') {
      // Der jeweils früheste Marker gewinnt; nichts gefunden → Schwanz
      // aufheben, damit ein an der Chunk-Grenze zerrissener Marker beim
      // nächsten Stück wieder zusammenfindet.
      const marker = [
        ['nodes', text.indexOf('"nodes":[')],
        ['edges', text.indexOf('"edges":[')],
        ['strings', text.indexOf('"strings":[')],
      ].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
      if (marker.length === 0) { rest = text.slice(-32); return; }
      const [welcher, pos] = marker[0];
      if (welcher === 'nodes') {
        text = text.slice(pos + '"nodes":['.length);
        abschnitt = 'nodes'; feldPos = 0; zahl = '';
      } else if (welcher === 'edges') {
        if (!felderProKante) { rest = text.slice(-32); return; }
        text = text.slice(pos + '"edges":['.length);
        abschnitt = 'edges'; eFeldPos = 0; zahl = '';
      } else {
        if (!wunschNamen) spitzenNamenBestimmen();
        text = text.slice(pos + '"strings":['.length);
        abschnitt = 'strings'; sIndex = 0; inString = false; roh = '';
      }
      continue;
    }

    if (abschnitt === 'edges') {
      let i = 0;
      for (; i < text.length; i++) {
        const c = text[i];
        if (c >= '0' && c <= '9') { zahl += c; continue; }
        if (c === ',') { nimmKantenZahl(); continue; }
        if (c === ']') { nimmKantenZahl(); abschnitt = 'suche'; i++; break; }
        if (c === '-' || c === '.') { zahl += c; continue; }
      }
      text = text.slice(i);
      if (abschnitt === 'edges') return;
      continue;
    }

    if (abschnitt === 'nodes') {
      let i = 0;
      for (; i < text.length; i++) {
        const c = text[i];
        if (c >= '0' && c <= '9') { zahl += c; continue; }
        if (c === ',') { nimmZahl(); continue; }
        if (c === ']') { nimmZahl(); abschnitt = 'suche'; i++; break; }
        // Leerzeichen, Zeilenumbrüche, Minus (kommt in nodes nicht vor)
        if (c === '-' || c === '.') { zahl += c; continue; }
      }
      text = text.slice(i);
      if (abschnitt === 'nodes') return;   // Chunk aufgebraucht
      continue;
    }

    if (abschnitt === 'strings') {
      let i = 0;
      for (; i < text.length; i++) {
        const c = text[i];
        if (inString) {
          roh += c;
          if (escaped) { escaped = false; continue; }
          if (c === '\\') { escaped = true; continue; }
          if (c === '"') {
            inString = false;
            if (wunschNamen && wunschNamen.has(sIndex)) {
              let wert;
              try { wert = JSON.parse(roh); } catch { wert = roh.slice(1, -1); }
              namenText.set(sIndex, wert);
            }
            sIndex++; roh = '';
          }
          continue;
        }
        if (c === '"') { inString = true; roh = '"'; continue; }
        if (c === ']') { abschnitt = 'fertig'; i++; break; }
      }
      text = text.slice(i);
      if (abschnitt === 'strings') return;
      continue;
    }

    return;   // fertig
  }
});

strom.on('end', () => {
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  if (!wunschNamen) spitzenNamenBestimmen();

  const mb = (b) => (b / 1048576).toFixed(1);
  const gesamtBytes = [...proTyp.values()].reduce((s, t) => s + t.bytes, 0);
  console.log(`Knoten insgesamt: ${knoten.toLocaleString('de-DE')}   flache Größe insgesamt: ${mb(gesamtBytes)} MB\n`);

  console.log('═══ Nach Typ ═══');
  console.log('       Bytes    Anteil     Anzahl  Typ');
  for (const [typ, t] of [...proTyp.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12)) {
    const anteil = gesamtBytes ? (100 * t.bytes / gesamtBytes).toFixed(1) : '0.0';
    console.log(`  ${mb(t.bytes).padStart(9)} MB ${(anteil + '%').padStart(7)} ${String(t.n).padStart(10)}  ${typ}`);
  }

  const zeile = ([, e]) => {
    const anteil = gesamtBytes ? (100 * e.bytes / gesamtBytes).toFixed(1) : '0.0';
    const name = namenText.has(e.nameIdx) ? namenText.get(e.nameIdx) : `(Name #${e.nameIdx})`;
    const kurz = name.length > 52 ? name.slice(0, 49) + '…' : name;
    return `  ${mb(e.bytes).padStart(9)} MB ${(anteil + '%').padStart(7)} ${String(e.n).padStart(10)}  ${kurz}  [${e.typ}]`;
  };

  console.log('\n═══ Nach Name — größte Byte-Summe ═══');
  console.log('       Bytes    Anteil     Anzahl  Name  [Typ]');
  for (const eintrag of [...proName.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 25)) {
    console.log(zeile(eintrag));
  }

  if (proKante.size > 0) {
    console.log('\n═══ Eigenschaftsnamen, die auf diese Objekte zeigen ═══');
    console.log(`(${kanten.toLocaleString('de-DE')} Kanten insgesamt — millionenfach derselbe Feldname = der Fingerabdruck der Struktur)`);
    console.log('(nur echte Eigenschaften; V8-interne Kanten wie map/first/second sind ausgeblendet.');
    console.log(' Zahlen- und Boolean-Felder erzeugen KEINE Kante — sie fehlen hier zwangsläufig.)');
    console.log('      Anzahl  Feldname');
    const nurEigenschaften = [...proKante.entries()].filter(([, e]) => e.typ === 'property');
    for (const [, e] of nurEigenschaften.sort((a, b) => b[1].n - a[1].n).slice(0, 30)) {
      const name = namenText.has(e.nameIdx) ? namenText.get(e.nameIdx) : `(Name #${e.nameIdx})`;
      const kurz = name.length > 52 ? name.slice(0, 49) + '…' : name;
      console.log(`  ${String(e.n).padStart(10)}  ${kurz}`);
    }
  }

  console.log('\n═══ Nach Name — größte Stückzahl ═══');
  console.log('       Bytes    Anteil     Anzahl  Name  [Typ]');
  for (const eintrag of [...proName.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 25)) {
    console.log(zeile(eintrag));
  }
  console.log();
});

strom.on('error', (err) => {
  console.error('Lesefehler:', err.message);
  process.exit(1);
});
