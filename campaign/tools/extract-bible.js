#!/usr/bin/env node
// Entschlüsselt die Story-Bibel aus dem alten KI-Artefakt "Pixel Academy" und legt sie
// als lesbare JSON-Dateien unter campaign/bible/ ab. Einmalige Migration; danach ist
// campaign/bible/ die Quelle der Wahrheit (nicht mehr das Artefakt).
//
//   node campaign/tools/extract-bible.js <pfad/zur/index.html des Artefakts>
//
// Wirtsspezifisches (Kandidatenlisten, Gast-Blätter) landet in campaign/bible/spoilers/.
'use strict';
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('usage: extract-bible.js <artifact index.html>'); process.exit(1); }
const html = fs.readFileSync(src, 'utf8');

// Der größte Base64-Block im Bündel ist die verschleierte Datenbank (XOR mit (91 + i*11) & 255).
let best = '';
for (const m of html.matchAll(/"([A-Za-z0-9+/=]{200000,})"/g)) if (m[1].length > best.length) best = m[1];
if (!best) { console.error('Datenblock nicht gefunden'); process.exit(1); }
const raw = Buffer.from(best, 'base64');
const out = Buffer.alloc(raw.length);
for (let i = 0; i < raw.length; i++) out[i] = raw[i] ^ ((91 + i * 11) & 255);
const Z = JSON.parse(out.toString('utf8'));

const root = path.join(__dirname, '..', 'bible');
const write = (rel, data) => {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data, null, 1) + '\n', { encoding: 'utf8' });
};
const safe = (id) => String(id).replace(/[^A-Za-z0-9_.-]/g, '_');

// Wirtsspezifisch -> spoilers/
const hosts = Z.plot.HOSTS;
write('spoilers/hosts.json', hosts);
write('spoilers/guest.json', Z.plot.GUEST);
for (const [id, c] of Object.entries(Z.cast.CAST)) {
  const copy = { ...c };
  if (copy.guest !== undefined) { write(`spoilers/guest-sheets/${safe(id)}.json`, c.guest); delete copy.guest; }
  write(`cast/${safe(id)}.json`, copy);
}
write('cast/_housing.json', Z.cast.HOUSING);
write('cast/_functions.json', Z.cast.FUNCTIONS);

for (const [id, p] of Object.entries(Z.places.PLACES)) write(`places/${safe(id)}.json`, p);
for (const k of ['ABOARD', 'CURFEW', 'MAP', 'REGIONS']) write(`places/_${k.toLowerCase()}.json`, Z.places[k]);

for (const k of ['ACTS', 'CHARTER', 'CLUES', 'COUPLES_GM', 'ENDINGS', 'FLAGS', 'HOOKS', 'MYSTERIES', 'PREVENTION', 'QUESTS', 'RUMORS', 'TIMELINE']) {
  write(`plot/${k.toLowerCase()}.json`, Z.plot[k]);
}
write('plot/guest-free-note.txt', 'GUEST and HOSTS live in spoilers/. Texts here use {H...} placeholders.\n');

for (const k of Object.keys(Z.calendar)) write(`calendar/${k.toLowerCase()}.json`, Z.calendar[k]);
for (const k of Object.keys(Z.curriculum)) write(`curriculum/${k.toLowerCase()}.json`, Z.curriculum[k]);
for (const [id, d] of Object.entries(Z.decks.DECKS)) write(`decks/${safe(id)}.json`, d);
write('decks/_matchups.json', Z.decks.MATCHUPS);
write('decks/_stances.json', Z.decks.STANCES);
for (const k of Object.keys(Z.rules)) write(`rules/${k.toLowerCase()}.txt`, Z.rules[k] + '\n');
write('system.json', Z.system);
write('intro.txt', Z.intro.INTRO + '\n');

let n = 0, bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; } } })(root);
console.log(`bible: ${n} Dateien, ${(bytes / 1048576).toFixed(1)} MB`);
