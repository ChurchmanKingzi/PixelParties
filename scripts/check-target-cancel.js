'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — ABBRUCH-WÄCHTER FÜR ZIELWAHLEN (v1296, Als Regel 23.9.)
//
//  „Zielende Attacks/Spells/Creature Effects sollten immer abbrechbar
//   sein." (CARD_API ★ „ZIELENDE KARTEN SIND IMMER ABBRECHBAR")
//
//  Gemeldet wird jede Zielwahl (`promptEffectTarget`, `promptDamageTarget`,
//  `promptMultiTarget`) mit `cancellable: false` in einem Skript einer
//  Spell-, Attack- oder Creature-Karte. Nicht jede davon ist falsch:
//  nach dem Zusagepunkt (Kosten bezahlt, Karte verbraucht), in Reaktionen
//  und Surprises oder bei einer vom Text erzwungenen Wahl ist ein Abbruch
//  sinnlos. Solche Stellen tragen den Kommentar `// pflichtwahl: <Grund>`
//  innerhalb der Aufruf-Klammern oder in der Zeile davor.
//
//  RATCHET wie `check-no-splice`: `target-cancel-baseline.json` hält den
//  ungeprüften Altbestand (v1296: 68 Dateien). Neue Dateien oder mehr
//  Stellen je Datei → Exit 1. Nach dem Durchsehen einer Altdatei:
//  begründen (`pflichtwahl:`) oder abbrechbar machen, dann `--update`.
//
//  Aufruf:
//    node scripts/check-target-cancel.js            Ratchet prüfen
//    node scripts/check-target-cancel.js --all      alle Stellen listen
//    node scripts/check-target-cancel.js --update   Baseline setzen
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'cards', 'effects');
const BASELINE = path.join(__dirname, 'target-cancel-baseline.json');
const TYPEN = new Set(['Spell', 'Attack', 'Creature']);

const nameZuDatei = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.js';
const typJeDatei = new Map();
for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'))) {
  typJeDatei.set(nameZuDatei(c.name), c.cardType);
}

function stellen(src) {
  const out = [];
  const re = /(promptEffectTarget|promptDamageTarget|promptMultiTarget)\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    // Klammerinhalt bis zur passenden schliessenden Klammer.
    let tiefe = 0, i = m.index + m[0].length - 1, ende = -1;
    for (; i < src.length; i++) {
      if (src[i] === '(') tiefe++;
      else if (src[i] === ')') { tiefe--; if (tiefe === 0) { ende = i; break; } }
    }
    if (ende < 0) continue;
    const rumpf = src.slice(m.index, ende);
    if (!/cancellable\s*:\s*false/.test(rumpf)) continue;
    const zeilenStart = src.lastIndexOf('\n', src.lastIndexOf('\n', m.index) - 1);
    const davor = src.slice(Math.max(0, zeilenStart), m.index);
    if (/pflichtwahl:/.test(rumpf) || /pflichtwahl:/.test(davor)) continue;
    out.push(src.slice(0, m.index).split('\n').length);
  }
  return out;
}

const ist = {};
for (const f of fs.readdirSync(DIR).sort()) {
  if (!f.endsWith('.js') || f.startsWith('_')) continue;
  if (!TYPEN.has(typJeDatei.get(f))) continue;
  const z = stellen(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (z.length) ist[f] = z;
}

const arg = process.argv[2];
if (arg === '--update') {
  const bl = Object.fromEntries(Object.entries(ist).map(([f, z]) => [f, z.length]));
  fs.writeFileSync(BASELINE, JSON.stringify(bl, null, 2) + '\n');
  console.log(`[check-target-cancel] Baseline gesetzt: ${Object.keys(bl).length} Dateien.`);
  process.exit(0);
}
if (arg === '--all') {
  for (const [f, z] of Object.entries(ist)) console.log(`${f}: Zeile ${z.join(', ')}`);
  process.exit(0);
}
const bl = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
let fehler = 0;
for (const [f, z] of Object.entries(ist)) {
  if (z.length > (bl[f] || 0)) {
    console.error(`[check-target-cancel] ${f}: Zielwahl ohne Cancel (Zeile ${z.join(', ')}) — abbrechbar machen oder mit \`// pflichtwahl: <Grund>\` begründen.`);
    fehler++;
  }
}
if (fehler) process.exit(1);
console.log(`[check-target-cancel] OK — ${Object.keys(ist).length} Altdatei(en) im Ratchet, nichts Neues.`);
