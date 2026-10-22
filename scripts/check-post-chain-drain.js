#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
//  WÄCHTER: Jeder Spielzug-Handler in server.js leert die Nach-Ketten-Aktionen
//
//  `engine._runPostChainActions()` führt Folgeaktionen aus, die Karten NACH ihrer Kette anmelden (`queuePostChainAction`):
//  Silence (Sofort-Zusatz-Spell des Gegners), Master's Plan, Shamanic Curse, Lunar Eclipse, Circles of Hell … Der Aufruf
//  steht NUR in den Socket-Handlern (und im CPU-Dispatcher). Fehlt er in einem Handler, bleibt die Folgeaktion liegen, bis
//  ein anderer Handler sie später leert (Befund W49: Silence gegen Alices Heldeneffekt – activate_hero_effect leerte nicht).
//
//  Geprüft werden alle `socket.on('play_…' | 'use_…' | 'activate_…' | 'cast_…')`-Handler; erlaubt ohne Aufruf sind nur die
//  unten aufgeführten (reine Platzier-/Anzeige-Handler ohne Kette).
//
//  Aufruf: node scripts/check-post-chain-drain.js   (Exit 1 = Handler ohne Aufruf)
// ═══════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const OHNE = new Set([
  'play_ability',            // Ability anlegen (keine Kette)
  'play_surprise',           // Surprise verdeckt legen (keine Kette)
  'trigger_treacherous_crystal',   // Kreaturen leihen, keine Kette
  'activate_hand_card',      // Hand-Karten-Aktivierung (Hand-Reaktionen laufen in ihrer eigenen Kette)
]);
const fails = [];
let n = 0;
for (const m of src.matchAll(/socket\.on\('((?:play|use|activate|cast|trigger)_[a-z_]+)', \(params\) => \{([\s\S]*?)\n  \}\);/g)) {
  n++;
  if (OHNE.has(m[1])) continue;
  if (!/_runPostChainActions/.test(m[2])) fails.push(m[1]);
}
if (fails.length) { console.log('✗ Handler ohne _runPostChainActions:', fails.join(', ')); process.exit(1); }
console.log(`✓ ${n} Spielzug-Handler geprüft – alle leeren die Nach-Ketten-Aktionen (Ausnahmen: ${[...OHNE].join(', ')})`);
