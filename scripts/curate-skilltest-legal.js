#!/usr/bin/env node
'use strict';
// Setzt in data/cards.json `skilltestLegal: false` für Karten, die im Skill Test
// (N Spieler, kein „der Gegner") vorerst nicht sinnvoll funktionieren, und schreibt
// die Begründungen nach docs/skilltest-illegal-cards.md. Idempotent; arbeitet auf
// dem Rohtext (kleiner Diff). Spätere Freigabe: Feld in cards.json wieder auf true.
//
//   node scripts/curate-skilltest-legal.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'cards.json');
const DOC = path.join(__dirname, '..', 'docs', 'skilltest-illegal-cards.md');

const cardsAll = JSON.parse(fs.readFileSync(FILE, { encoding: 'utf-8' }));
const futureTech = cardsAll.filter(c => (c.archetype || '') === 'Future Tech').map(c => c.name);

// Von Hand gesperrte Gruppen (Begründung → Karten).
const GROUPS = [
  { why: 'Sofortiger Spielsieg („You win the game“) ohne passende Wertung bei mehreren Spielern. (Die vier Cardinal Beasts sind NICHT gesperrt: je Partie fehlt eine zufällige von ihnen, siehe CONFIG.CARDINAL_BEASTS — so sind nie alle vier gleichzeitig im Spiel.)',
    cards: ['The Final Trial', 'Carris, the Time Keeper'] },
  { why: 'Doom-Clock-Familie: leitet Sieger/Verlierer als „der andere Spieler“ ab (`winnerIdx = byPi === 0 ? 1 : 0`); mit mehr als zwei Sitzen ist der Verlierer nicht gleich „Spielende“.',
    cards: ['Doom Clock', 'Doom Prophecy', 'Basketskull', 'Ferocious Jaguar Warrior', 'Swift Eagle Warrior', 'Warrior of Teocuilatl'] },
  { why: 'Zählen/löschen aus BEIDEN Ablagen (`players[0]` / `players[1]`): mit mehr als zwei Sitzen unvollständig, die Auswahl über alle Ablagen braucht eine eigene Oberfläche.',
    cards: ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu', 'Guardian Beast Ji', 'Guardian Beast Long', 'Guardian Beast Ma', 'Guardian Beast Niu', 'Guardian Beast She', 'Guardian Beast Shu', 'Guardian Beast Tu', 'Guardian Beast Yang', 'Guardian Beast Zhu', 'Mao, the Vengeful Guardian'] },
  { why: 'Alle Future-Tech-Karten (Archetyp „Future Tech“): sie brauchen eine gefüllte Ablage, um gut zu funktionieren — im Skill Test gibt es keine Decks und kaum Ablage.',
    cards: futureTech },
];

// Freigegeben (einmalig von Hand in cards.json auf true gesetzt, das Skript schreibt nie zurück): Quetzahuitl, The Golden Abomination
// und die vier Cardinal Beasts (je Partie fehlt zufällig eines davon, siehe skilltest/config.js CARDINAL_BEASTS).

let raw = fs.readFileSync(FILE, { encoding: 'utf-8' });
const cards = JSON.parse(raw);
const byName = new Map(cards.map(c => [c.name, c]));
let changed = 0;
for (const g of GROUPS) for (const name of g.cards) {
  const c = byName.get(name);
  if (!c) { console.error('Karte nicht gefunden:', name); process.exitCode = 1; continue; }
  if (c.skilltestLegal === false) continue;
  const key = `"name": ${JSON.stringify(name)},`;
  const at = raw.indexOf(key);
  if (at < 0) { console.error('Namenszeile nicht gefunden:', name); process.exitCode = 1; continue; }
  const from = raw.indexOf('"skilltestLegal": true', at);
  const nextName = raw.indexOf('"name":', at + key.length);
  if (from < 0 || (nextName >= 0 && from > nextName)) { console.error('skilltestLegal-Zeile fehlt bei', name); process.exitCode = 1; continue; }
  raw = raw.slice(0, from) + '"skilltestLegal": false' + raw.slice(from + '"skilltestLegal": true'.length);
  changed++;
}
if (changed) fs.writeFileSync(FILE, raw, { encoding: 'utf-8' });
JSON.parse(raw);   // Sicherheitsnetz: bleibt gültiges JSON

const md = ['# Skill Test — vorerst gesperrte Karten',
  '',
  '> Erzeugt von `node scripts/curate-skilltest-legal.js`. Das Feld `skilltestLegal` in `data/cards.json` ist die Quelle der Wahrheit;',
  '> zur Freigabe einer Karte dort auf `true` setzen (Skript überschreibt nichts zurück).',
  '> Zusätzlich gesperrt per Regel: Divinity, Performance, Attack, Flying Island in the Sky, alle Ascended Heroes, alle Tokens.',
  ''];
for (const g of GROUPS) { md.push('## ' + g.why, '', ...g.cards.map(n => '- ' + n), ''); }
fs.writeFileSync(DOC, md.join('\n'), { encoding: 'utf-8' });
console.log(`✓ ${changed} Karte(n) auf skilltestLegal:false gesetzt, ${path.relative(process.cwd(), DOC)} geschrieben.`);
