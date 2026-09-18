'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — GALERIE-EINTRÄGE (v1189, Als Befund 18.9.)
//
//  Der Vertrag von `cardGallery` / `cardGalleryMulti` ist ASYMMETRISCH:
//
//      HINEIN:  [{ name, source?, count?, cost?, selectable? }]
//      ZURÜCK:  { cardName, source }
//
//  Wer die Antwortform für die Eingabe hält — ein sehr naheliegender
//  Schluss — baut `{ cardName: … }`. Der Client liest `entry.name`,
//  findet `undefined` und zeichnet eine LEERE Galerie. Kein Fehler,
//  keine Meldung, nichts. Genau so sind „Teleportal", „Cleansing of
//  the Land" (v1159, damals die String-Variante) und „Tempeluna"
//  (v1189, die cardName-Variante) aufgelaufen.
//
//  Seit v1189 normalisiert `promptGeneric` die Einträge selbst
//  (`name` / `cardName` / `card` / blosser String) und warnt auf der
//  Konsole, wenn gar kein Name zu holen ist. Dieser Wächter hält den
//  Quelltext trotzdem auf der kanonischen Form: die Normalisierung ist
//  ein Netz, kein Freibrief — wer `cardName` schreibt, meint meist
//  auch sonst die falsche Form.
//
//  Erkannt werden zwei Bauformen:
//    ① das Array steht INLINE im Aufruf,
//    ② das Array wird über eine Variable gefüllt (`x.push({…})` /
//       `const x = […].map(() => ({…}))`) und dann übergeben.
//
//  Aufruf:  node scripts/check-gallery-entries.js
//  Rückgabe 0 = sauber, 1 = Einträge mit `cardName` statt `name`.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// Karten, die BEGRÜNDET abweichen (heute: keine).
const AUSNAHMEN = new Map();

function stripKommentare(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Trägt dieses Objektliteral einen Namen unter dem falschen Schlüssel? */
function falscherSchluessel(inner) {
  if (!inner.includes('cardName:')) return false;
  return !/(^|[,{\s])name\s*:/.test(inner);
}

const fehlt = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js'))) {
  if (AUSNAHMEN.has(datei)) continue;
  const src = stripKommentare(fs.readFileSync(path.join(EFFEKTE, datei), 'utf8'));

  // ① Inline-Array direkt im Aufruf
  for (const m of src.matchAll(/promptCardGallery(?:Multi)?\(\s*\[([^\]]{0,600})\]/g)) {
    if (falscherSchluessel(m.group(1))) fehlt.push(`  ✗ ${datei} — Inline-Galerie`);
  }

  // ② Über eine Variable
  const variablen = new Set();
  for (const m of src.matchAll(/promptCardGallery(?:Multi)?\(\s*([A-Za-z_$][\w$]*)/g)) variablen.add(m[1]);
  for (const m of src.matchAll(/type:\s*'cardGallery(?:Multi)?'\s*,\s*cards:\s*([A-Za-z_$][\w$]*)/g)) variablen.add(m[1]);
  for (const v of variablen) {
    const muster = [
      new RegExp(`${v}\\.push\\(\\s*\\{([^}]*)\\}`, 'g'),
      new RegExp(`const\\s+${v}\\s*=\\s*[^;]{0,600}?\\{([^}]*)\\}`, 'gs'),
    ];
    for (const re of muster) {
      for (const m of src.matchAll(re)) {
        if (falscherSchluessel(m[1])) { fehlt.push(`  ✗ ${datei} — Einträge für \`${v}\``); break; }
      }
    }
  }
}

const einmalig = [...new Set(fehlt)];
if (einmalig.length) {
  console.error('[check-gallery-entries] ✖ Galerie-Einträge mit `cardName` statt `name`:\n');
  for (const z of einmalig) console.error(z);
  console.error('\n  Der Vertrag ist asymmetrisch — merken:');
  console.error('    HINEIN: { name, source }        ZURÜCK: { cardName, source }');
  console.error('  Die Engine fängt es seit v1189 ab, aber der Quelltext soll die');
  console.error('  kanonische Form zeigen (siehe CARD_API „GALERIE-EINTRÄGE").\n');
  process.exit(1);
}
console.log('[check-gallery-entries] ✓ alle Galerie-Einträge tragen `name`.');
process.exit(0);
