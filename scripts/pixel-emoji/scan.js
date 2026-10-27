'use strict';
// Sammelt alle Emojis/Symbole, die das Spiel als TEXT anzeigt (Kommentare ausgenommen), die der Pixel-Schrift 'Pixel Intv' fehlen.
//   node scripts/pixel-emoji/scan.js            → schreibt scripts/pixel-emoji/zeichen.json
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

// Kommentare entfernen, Strings/Templates unangetastet lassen (grob, aber genug fuer die Zeichensuche).
function ohneKommentare(t) {
  let out = '', i = 0, st = null;
  const n = t.length;
  while (i < n) {
    const c = t[i];
    if (st === null) {
      if (c === '/' && t[i + 1] === '/') { const j = t.indexOf('\n', i); i = j < 0 ? n : j; continue; }
      if (c === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
      if (c === "'" || c === '"' || c === '`') st = c;
      out += c; i++;
    } else {
      out += c;
      if (c === '\\' && i + 1 < n) { out += t[i + 1]; i += 2; continue; }
      if (c === st) st = null;
      i++;
    }
  }
  return out;
}

// Von 'Pixel Intv' selbst gezeichnet — bleiben Text.
const EIGENE = new Set(['×', '∆', '−', '≈', '≤', '≥']);
const MUSTER = /(?:[\u{1F000}-\u{1FAFF}]|[←-⇿∀-⋿⌀-⏿①-⓿■-◿☀-➿⤀-⥿⬀-⯿])️?/gu;

function dateien() {
  const out = [];
  const add = (dir, re, rekursiv) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'dist' || e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (rekursiv) add(p, re, rekursiv); }
      else if (re.test(e.name)) out.push(p);
    }
  };
  add('public', /\.(jsx|js|css|html)$/, true);
  add('cards/effects', /\.js$/, false);
  for (const f of ['server.js', 'bot-api.js', 'db.js', 'unlock-rules.js', 'sc-rewards.js', 'card-of-day.js']) if (fs.existsSync(path.join(ROOT, f))) out.push(f);
  return out;
}

function scan() {
  const zaehler = new Map();
  for (const f of dateien()) {
    let t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (/\.(jsx|js)$/.test(f)) t = ohneKommentare(t);
    else if (/\.css$/.test(f)) t = t.replace(/\/\*[\s\S]*?\*\//g, '');
    else t = t.replace(/<!--[\s\S]*?-->/g, '');
    for (const m of t.matchAll(MUSTER)) {
      const z = m[0];
      if (EIGENE.has(z)) continue;
      zaehler.set(z, (zaehler.get(z) || 0) + 1);
    }
  }
  return [...zaehler.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z);
}

module.exports = { scan, MUSTER, EIGENE };
if (require.main === module) {
  // `zusatz.json`: Zeichen, die das Spiel (noch) nicht als Text zeigt, die aber fertig in der Schrift stehen sollen (Vorrat für neue Karten/Animationen).
  const zusatz = fs.existsSync(path.join(__dirname, 'zusatz.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'zusatz.json'), 'utf8')) : [];
  const liste = [...new Set([...scan(), ...zusatz])];
  fs.writeFileSync(path.join(__dirname, 'zeichen.json'), JSON.stringify(liste, null, 0) + '\n', 'utf8');
  console.log(liste.length + ' Zeichen → scripts/pixel-emoji/zeichen.json');
}
