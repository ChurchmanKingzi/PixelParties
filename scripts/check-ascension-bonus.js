#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ASCENSION-BONUS-VERTRAG
//
//  ANLASS (v1264, Als Befund 22.9.): „True Fairy Crestina" stieg auf,
//  bekam aber ihren Bonus „Wisdom 3" nie. Die Engine vergibt den
//  Ascension Bonus AUSSCHLIESSLICH über den Hook `onAscensionBonus`
//  der Ascended-Karte (`performAscension`) — es gibt keinen Rückfall
//  auf `cards.json`. Fehlt der Hook, steigt der Held still ohne Bonus
//  auf: kein Fehler beim Laden, keiner im Spiel, nur ein Tester merkt
//  es irgendwann.
//
//  Geprüft wird für jedes Ascended mit Skript:
//
//    1. BONUS NUR MIT HOOK — steht in `startingAbility1/2` überhaupt
//       ein Bonus (bei Ascended Heroes beschreiben diese Felder den
//       Bonus, nicht Starting Abilities), muss das Skript
//       `onAscensionBonus` tragen.
//
//    2. ABILITY-BONUS MIT NAMEN — hat der Bonus die Form „<Ability> N"
//       (Fighting 3, Wisdom 3 …) und ist <Ability> eine Karte vom Typ
//       Ability, muss ihr Name im Code als Zeichenkette vorkommen und
//       `performAscensionBonus(` aufgerufen werden. Als Zeichenkette
//       irgendwo, nicht zwingend im Aufruf: Cecilia reicht ihn über
//       eine Konstante (`BONUS_ABILITY = 'Charme'`).
//
//  Aufruf:  node scripts/check-ascension-bonus.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Ascended ohne Bonus.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');

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

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const abilities = new Set(karten.filter(k => k.cardType === 'Ability').map(k => k.name));

const maengel = [];
let geprueft = 0;

for (const karte of karten) {
  if (karte.cardType !== 'Ascended Hero') continue;
  const datei = path.join(EFFEKTE, nameZuDatei(karte.name) + '.js');
  if (!fs.existsSync(datei)) continue;   // noch nicht implementiert — nicht Sache dieses Wächters
  geprueft++;

  const code = ohneKommentare(fs.readFileSync(datei, 'utf8'));
  const boni = [karte.startingAbility1, karte.startingAbility2]
    .map(t => String(t || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (boni.length === 0) continue;

  const hatHook = /\bonAscensionBonus\b/.test(code);
  if (!hatHook) {
    maengel.push(`${karte.name}: Bonus „${boni.join(' / ')}" in cards.json, aber kein \`onAscensionBonus\` im Skript`);
    continue;
  }

  for (const bonus of boni) {
    const m = bonus.match(/^(.+?) (\d+)$/);
    if (!m || !abilities.has(m[1])) continue;   // kein Ability-Bonus (z.B. „Any 2 Spells …")
    const ability = m[1];
    const literal = new RegExp(`(['"\`])${ability.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`);
    if (!/\bperformAscensionBonus\s*\(/.test(code)) {
      maengel.push(`${karte.name}: Bonus „${bonus}", aber kein Aufruf von \`performAscensionBonus(\``);
    } else if (!literal.test(code)) {
      maengel.push(`${karte.name}: Bonus „${bonus}", aber „${ability}" steht nirgends als Zeichenkette im Code`);
    }
  }
}

if (maengel.length) {
  console.error(`[check-ascension-bonus] ${maengel.length} Mangel/Mängel bei ${geprueft} Ascended Heroes:`);
  for (const z of maengel) console.error('  ✗ ' + z);
  process.exit(1);
}
console.log(`[check-ascension-bonus] sauber — ${geprueft} Ascended Heroes mit Skript geprüft.`);
