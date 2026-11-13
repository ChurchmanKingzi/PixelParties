#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — Kartenvokabular für das CPU-Wertnetz (data/cpu-value/vocab.json)
//
//  Der Zustandslog (cards/effects/_value-encode.js) schreibt Karten als Zahl. Die Zuordnung Name → Zahl muss über die Zeit STABIL
//  bleiben, sonst bedeuten alte Logs etwas anderes als neue: das Vokabular ist deshalb nur anhängend. Neue Karten bekommen die
//  nächste freie Nummer, vorhandene behalten ihre. Nummer 0 = leer/unbekannt.
//
//    node scripts/value/build-vocab.js          → legt die Datei an oder hängt neue Karten aus data/cards.json an
//    node scripts/value/build-vocab.js --check  → meldet nur, welche Karten fehlen (Exit 1, wenn welche fehlen)
//
//  Eine Karte, die im Vokabular fehlt, wird als 0 geloggt und im Log als „unbekannt" gezählt — das Spiel läuft weiter, nur ist
//  diese Karte für das Netz unsichtbar, bis das Vokabular ergänzt ist.
// ═══════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VOCAB = path.join(ROOT, 'data', 'cpu-value', 'vocab.json');
const check = process.argv.includes('--check');

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), { encoding: 'utf-8' }));
const cards = Array.isArray(raw) ? raw : Object.values(raw);
const names = [...new Set(cards.map(c => c && c.name).filter(Boolean))].sort();

let vocab = { version: 1, statuses: [], names: [''] };
if (fs.existsSync(VOCAB)) vocab = JSON.parse(fs.readFileSync(VOCAB, { encoding: 'utf-8' }));

// Statuseffekte der Engine (Bitmaske der Zustandskodierung): ebenfalls nur anhängend.
const { STATUS_EFFECTS } = require(path.join(ROOT, 'cards', 'effects', '_engine.js'));
const statuses = Object.keys(STATUS_EFFECTS);
const haveStatus = new Set(vocab.statuses);
const newStatuses = statuses.filter(s => !haveStatus.has(s));
if (vocab.statuses.length + newStatuses.length > 32) { console.error('Mehr als 32 Statuseffekte — die u32-Maske reicht nicht mehr, Formatversion erhöhen.'); process.exit(2); }

const have = new Set(vocab.names);
const missing = names.filter(n => !have.has(n));
if (check) {
  console.log(`Vokabular: ${vocab.names.length - 1} Karten, ${vocab.statuses.length} Status; fehlend: ${missing.length} Karten, ${newStatuses.length} Status`);
  if (missing.length) console.log('  ' + missing.slice(0, 20).join(', ') + (missing.length > 20 ? ' …' : ''));
  process.exit(missing.length || newStatuses.length ? 1 : 0);
}
vocab.names.push(...missing);
vocab.statuses.push(...newStatuses);
fs.mkdirSync(path.dirname(VOCAB), { recursive: true });
fs.writeFileSync(VOCAB, JSON.stringify(vocab) + '\n', { encoding: 'utf-8' });
console.log(`Vokabular: ${vocab.names.length - 1} Karten (+${missing.length}), ${vocab.statuses.length} Status (+${newStatuses.length}) → ${path.relative(ROOT, VOCAB)}`);
