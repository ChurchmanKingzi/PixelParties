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
  { why: 'Curse: setzt die ATK des Ziels auf 0 — ein Held ohne Angriff kann in diesem Modus nichts mehr bewirken und führt zu unschönen, kaum lösbaren Lagen.',
    cards: ['Curse'] },
  { why: 'Gorinthian War Counselor: betäubt ein Ziel für 2 Turns und setzt allen Schaden an ihm auf 0; wird der Stun vor dem Ablauf erneuert (in Skill-Test-Rounds immer möglich), heilt das Ziel nie, und der eingebaute Schutz „Immune nach Ablauf des Stuns" greift nie — der letzte Gegner ist dauerhaft gesperrt, die Partie endet nie (Nachttraining, Seed 233).',
    cards: ['Gorinthian War Counselor'] },
  { why: 'Tri Ad und Tri Fecta (Puppet Mistress / Puppet Master): Tri Fecta spawnt zu Spielbeginn Puppet-Tokens in seine Support Zones (geteilter HP-Pool, sonst keine Karten dort erlaubt), Tri Ad darf kein Start-Hero sein und stapelt sich auf Tri Fecta — das ist im Skill Test nicht abgebildet (auf Wunsch aus dem Pool genommen).',
    cards: ['Tri Ad, the Puppet Mistress', 'Tri Fecta, the Puppet Master'] },
  { why: 'Reine Zieh-/Such-Karten: ihre einzigen Effekte sind Ziehen, Suchen, Tutoren oder „oberste Karten aufdecken und auf die Hand nehmen“. Der Skill Test hat kein Deck, die Karten wären wirkungslos (oder schaden, z. B. „Hand ablegen und gleich viele ziehen“). Erkannt über die Zieh-/Such-Sperren der Engine (`blockedByHandLock`, `blockedByDrawLock`, `blockedBySearchLock`) und über den Zieh-Block-Helfer (Wheels, Haste, …), von Hand geprüft. NICHT gesperrt: Karten, die auch etwas anderes bewirken, sowie reine Ablage-Rückholer (Shooting Star, Boomerang, Relic in the Sky, Magic Sapphire, Elixir of Mana, Shard of Chaos, Spontaneous Reappearance …) — die Ablage gibt es im Skill Test.',
    cards: [
      // per Sperr-Flag erkannt (Hand-/Zieh-/Such-Sperre)
      'Alchemic Journal', 'Alchemy', 'Angry Cheese', 'Aurora Borealis', 'Bifab, Bridge to Coolness', 'Birthday Present', 'Brainstorming',
      'Brilliant Idea', 'Cool Cheese', 'Cute Cheese', 'Cuteness Sensor', 'Divine Gift of Creation', 'Elixir of Quickness', 'Graveyard Gathering',
      'Heart of Cards', 'Heart of the Mountain', 'Holy Cheese', 'Horn in a Bottle', 'Idol of Crestina', 'Magic Lamp', 'Magnetic Glove',
      'Magnetic Potion', 'Mass Multiplication', 'Navigation', 'Nerdy Cheese', 'Perilous Journey', "Philosopher's Stone", 'Potion of Greed',
      'Sickly Cheese', 'Staff of the Teleporter', 'Staff of Uncontrollable Destruction', 'Tanuki Escape', 'Teleportal', 'The Sacred Jewel',
      'The Sacred Mirror', 'Trial of Loyalty',
      // ohne Flag, aber ebenfalls nur Ziehen/Suchen
      'Haste', 'Supply Chain', 'Voice in your Head', 'Wheels', 'Glimpse of the Future', 'Grasp the Future', 'Prophecy of Coolness', 'Cool Rescue',
      'Pawn Sacrifice', 'Mystery Box', 'Glass of Marbles', 'Ice Sculpture Garden', 'Divine Gift of Balance', 'Divine Gift of Edge', 'Crushing Defeat',
      'Unlikely Encounter', 'Spatial Crevice', 'Premonition', 'Inventing', 'Leadership', 'Creativity', 'Luck', 'Amazing Finding', 'Draw',
      'Deepsea Treasure', 'Charm of Balance', 'Prayer', "Smuggler's Pier", 'Wanted Poster', "The Brewer's Blade", 'Bluff', 'Spider Silk Bridge',
      'Cell Escape', 'Infiltration', 'Spice Mortar', 'Salute to the Fallen', 'Crystal Well', 'Pillar of Light', "Tarleinn's Floating Island",
      'Temple of Sacrifice', 'Snake Race Boat', 'Rain Viola', 'Lunatic Cycle - New Moon', 'Lunatic Cycle - Crescent Moon', 'Bow of the Hunt Goddess',
    ] },
  { why: 'Coolness-Stack-Karten: wirken nur aus dem Coolness Stack („This card has no effect, unless you play it from your Coolness Stack“) oder verlangen dessen Inhalt. Der Skill Test hat keinen Coolness Stack (in 6 Probepartien an allen 24 Sitzen immer leer) — die Karten sind unspielbar (Nachttraining: 0 % Nutzung bei 80–165 behaltenen Exemplaren je Karte).',
    cards: ['Coolness Overcharge', 'Glorious Rebirth', 'String of Fine', 'Modnir, Hammer of Coolness', 'Swellpnir, Mount of Coolness', 'Ragnarock'] },
  { why: 'Deckbau-Regelkarten („Für je 2 Exemplare in deinem Deck darf dein Deck …“, „Hast du 4 Exemplare in deinem Deck …“): ihre einzige Wirkung ist eine Deckbau-Regel; der Skill Test hat kein Deck.',
    cards: ['Secret Blue Spice', 'Secret Golden Spice', 'Secret Green Spice', 'Secret Red Spice', 'Secret Spice Jar', 'The Sacred Blade'] },
  { why: 'Karten, deren Wirkung aus dem Deck kommt (Suchen, Aufdecken, Karte aus dem Deck ausrüsten/beschwören): der Skill Test hat kein Deck, die Karten sind wirkungslos oder kosten nur (Opfer, Zugende). In den Probepartien nie erfolgreich ausspielbar, im Nachttraining 0–2 % Nutzung.',
    cards: ['Arrival from the Cosmic Depths', 'Create Illusion', 'Living Illusion', 'Surprise Party', 'Overcharge', 'Ladder to the Sky', "Treasure Hunter's Backpack", 'The Eye of Ren', 'Muscle Training', 'Lesson in the Arts', 'Kitsune Transformation', 'Ultimate Weapon Experiment'] },
  { why: 'Karten für Ascended Heroes (im Skill Test gesperrt): ohne Ascended Hero auf dem Brett oder in der Hand haben sie kein Ziel.',
    cards: ['Audience with a hostile King', 'Open Invitation'] },
  { why: 'Idej Projection: kann nur durch den Effekt der Idej Lords an einen Hero gehängt werden („by its own effect“). Im Skill Test spawnen die Lords ihre Projections jetzt beim Aufstellen selbst (siehe skilltest/README.md); als Handkarte wäre sie ein Fremdkörper.',
    cards: ['Idej Projection'] },
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
