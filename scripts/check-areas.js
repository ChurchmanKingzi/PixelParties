// ════════════════════════════════════════════════════════════════
//  WÄCHTER: AREA-VERTRAG
//
//  Eine Area-Karte ist erst dann fertig, wenn drei Dinge stimmen.
//  Zwei davon fehlten bei „Pangaia, the Dino Domain" monatelang
//  unbemerkt, weil beide nur beim Spielen auffallen — nicht beim
//  Laden, nicht in der Syntaxprüfung und nicht im Puzzle-Mode, wo
//  die Karte schon in der Zone liegt:
//
//    1. SELBSTLEGEN — Areas landen nicht von selbst im Slot. Die
//       Karte muss sich in ihrem `onPlay` (bzw. `resolve` bei
//       Artefakten) per `placeArea` dorthin bringen und damit
//       `gs._spellPlacedOnBoard` stempeln. Ohne das greift in JEDEM
//       Spielpfad die Standard-Entsorgung Hand → Ablage.
//       (Lehre aus dem Cottage-Fall v186, gebrochen von Pangaia.)
//
//    2. HOOKS AUS DER HAND — `activeIn` muss 'hand' enthalten (oder
//       ganz fehlen = alle Zonen), sonst feuert der onPlay-Hook beim
//       Spielen gar nicht erst. Genau hier lag Pangaias zweiter
//       Defekt: `activeIn: ['area']`.
//
//    3. HINTERGRUND — Eintrag in `AREA_OVERLAYS` (seit v1410 im
//       eigenen Modul public/app-areas.jsx), ★-Regel vom 7.9.: jede
//       Area definiert einen Hintergrund, solange sie liegt.
//
//    4. PIXELART-DATEIEN (v1410) — jede Datei unter `/areas/…`, die
//       app-areas.jsx anspricht, muss in public/areas/ liegen. Ein
//       Tippfehler im Pfad faellt sonst erst auf, wenn die Area liegt
//       und der Hintergrund leer bleibt.
//
//  Aufruf:  node scripts/check-areas.js
//  Rückgabe 0 = sauber, 1 = mindestens eine Area unvollständig.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');
const BOARD = path.join(WURZEL, 'public', 'app-areas.jsx');

/** Kartenname → Dateiname, identisch zu `nameToFile` im Loader. */
function nameZuDatei(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Kommentare raus — geprüft wird nur CODE (wie in `_loader.js`). */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

/** Die Schlüssel aus der AREA_OVERLAYS-Registry in app-areas.jsx. */
function registrierteHintergruende() {
  const src = fs.readFileSync(BOARD, 'utf8');
  const start = src.indexOf('const AREA_OVERLAYS');
  if (start < 0) return null;
  const block = src.slice(start, src.indexOf('\n};', start));
  const namen = new Set();
  const re = /^\s*(['"])(.+?)\1\s*:/gm;
  let m;
  while ((m = re.exec(block)) !== null) namen.add(m[2]);
  return namen;
}

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const hintergruende = registrierteHintergruende();
if (!hintergruende) {
  console.error('[check-areas] AREA_OVERLAYS in app-areas.jsx nicht gefunden.');
  process.exit(1);
}

const maengel = [];
let geprueft = 0;

for (const karte of karten) {
  if ((karte.subtype || '').trim().toLowerCase() !== 'area') continue;
  const datei = path.join(EFFEKTE, nameZuDatei(karte.name) + '.js');
  if (!fs.existsSync(datei)) continue;   // noch nicht implementiert — nicht Sache dieses Wächters
  geprueft++;

  const roh = fs.readFileSync(datei, 'utf8');
  const code = ohneKommentare(roh);
  const fehlt = [];

  // 1. Selbstlegen
  if (!/\bplaceArea\s*\(/.test(code)) {
    fehlt.push('ruft nie `placeArea` — die Karte landet beim Spielen in der Ablage');
  }

  // 2. Hooks aus der Hand. `resolve`-Module (Artefakte/Potions) gehen
  //    nicht über die Hook-Kette und brauchen das nicht.
  const activeIn = code.match(/activeIn\s*:\s*\[([^\]]*)\]/);
  const hatResolve = /\bresolve\s*[:(]/.test(code);
  if (activeIn && !/'hand'|"hand"/.test(activeIn[1]) && !hatResolve) {
    fehlt.push(`activeIn: [${activeIn[1].trim()}] enthält kein 'hand' — der onPlay-Hook feuert beim Spielen nicht`);
  }

  // 3. Hintergrund
  if (!hintergruende.has(karte.name)) {
    fehlt.push('kein Eintrag in AREA_OVERLAYS (app-areas.jsx) — die Area zeigt keinen Hintergrund');
  }

  if (fehlt.length) maengel.push({ name: karte.name, fehlt });
}

// 4. Pixelart-Dateien. Pfade entstehen im Code aus einem Praefix
//    (`const BR = '/areas/blood-rock/'`) plus Dateiname (`BR + 'tile.png'`
//    bzw. `${BR}bat.png`) — beides wird hier aufgeloest.
{
  const src = fs.readFileSync(BOARD, 'utf8');
  const praefixe = {};
  const reP = /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*'(\/areas\/[^']+\/)'/g;
  let m;
  while ((m = reP.exec(src)) !== null) praefixe[m[1]] = m[2];
  const pfade = new Set();
  const reA = /(['"`])(\/areas\/[^'"`$]+\.png)\1/g;
  while ((m = reA.exec(src)) !== null) pfade.add(m[2]);
  for (const [name, pre] of Object.entries(praefixe)) {
    const reB = new RegExp(`\\b${name}\\s*\\+\\s*'([^']+\\.png)'|\\$\\{${name}\\}([\\w.-]+\\.png)`, 'g');
    while ((m = reB.exec(src)) !== null) pfade.add(pre + (m[1] || m[2]));
  }
  const fehlend = [...pfade].filter(p => !fs.existsSync(path.join(WURZEL, 'public', p)));
  if (fehlend.length) maengel.push({ name: 'Pixelart-Dateien', fehlt: fehlend.map(p => `public${p} fehlt`) });
  else if (pfade.size) console.log(`[check-areas] ${pfade.size} Pixelart-Datei(en) vorhanden.`);
}

if (maengel.length === 0) {
  console.log(`[check-areas] OK — ${geprueft} implementierte Area(s), Vertrag vollständig.`);
  process.exit(0);
}

console.error(`[check-areas] ${maengel.length} von ${geprueft} Area(s) unvollständig:\n`);
for (const m of maengel) {
  console.error(`  ✗ ${m.name}`);
  for (const f of m.fehlt) console.error(`      · ${f}`);
}
console.error('');
process.exit(1);
