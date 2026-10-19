'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Deck-Dateien im Textformat des Spiels ("=== PIXEL PARTIES DECK ===", siehe data/SampleDecks/*.txt)
//  und Decks aus der Datenbank (bot-api.js: /decks).
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

/** @returns {{name:string, cover:string, heroes:string[], main:{n:number,name:string}[], potion:{n:number,name:string}[], side:{n:number,name:string}[]}|null} */
function parseDeckText(text, fallbackName = 'Deck') {
  const lines = String(text || '').split(/\r?\n/);
  if (!lines[0] || !lines[0].includes('PIXEL PARTIES DECK')) return null;
  const deck = { name: fallbackName, cover: '', heroes: [], main: [], potion: [], side: [] };
  let section = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('Name:')) { deck.name = line.slice(5).trim() || deck.name; continue; }
    if (line.startsWith('Cover:')) { deck.cover = line.slice(6).trim(); continue; }
    if (line.startsWith('===')) continue;
    const sec = { '== HEROES ==': 'heroes', '== MAIN DECK ==': 'main', '== POTION DECK ==': 'potion', '== SIDE DECK ==': 'side' }[line];
    if (sec) { section = sec; continue; }
    if (section === 'heroes') { if (line !== '(empty)') deck.heroes.push(line); continue; }
    const m = /^(\d+)x\s+(.+)$/.exec(line);
    if (m && section) deck[section].push({ n: parseInt(m[1], 10), name: m[2].trim() });
  }
  return deck.heroes.length || deck.main.length ? deck : null;
}

function loadSampleDecks(dir) {
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort(); } catch { return []; }
  const out = [];
  for (const f of files) {
    try {
      const d = parseDeckText(fs.readFileSync(path.join(dir, f), 'utf8'), f.replace(/\.txt$/, ''));
      if (d) out.push(d);
    } catch { /* kaputte Datei überspringen */ }
  }
  return out;
}

/** Deck aus der Datenbank (Namenslisten, auch Wiederholungen) → dasselbe Format. Tolerant gegenüber der Form der Einträge. */
function fromDb(row) {
  const nameOf = x => (typeof x === 'string' ? x : x && (x.name || x.card || x.cardName)) || null;
  const count = list => {
    const m = new Map();
    for (const x of list || []) { const n = nameOf(x); if (n) m.set(n, (m.get(n) || 0) + (Number(x && x.count) || 1)); }
    return [...m].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name));
  };
  return {
    name: row.name, cover: row.cover || '',
    heroes: (row.heroes || []).map(h => (typeof h === 'string' ? h : h && h.hero)).filter(Boolean),
    main: count(row.main), potion: count(row.potion), side: count(row.side),
  };
}

const total = list => list.reduce((s, c) => s + c.n, 0);
const lines = list => list.map(c => `${c.n}x ${c.name}`);

module.exports = { parseDeckText, loadSampleDecks, fromDb, total, lines };
