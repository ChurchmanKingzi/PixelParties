#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: FREISCHALTBARE SKINS BLEIBEN AUS SHOP UND CPU-HAND
//
//  Skins in `cards/skins/unlockable/` stehen NICHT im Shop, sondern
//  werden über Ereignisse frei (Regeln: unlockable-skins.js):
//    • Bills Worst Nightmare → Tutorial geschafft
//    • Dr. Heinz N. Stein    → am 31.10. (lokale Uhr) eine Partie gewonnen
//  CPUs/Bots dürfen sie NIEMALS tragen.
//
//  Geprüft wird:
//   1. Jede Regel hat ihr Bild in unlockable/ und einen Eintrag in
//      data/skins.json — und jedes Bild dort hat eine Regel.
//   2. Kein freischaltbarer Skin liegt zusätzlich in cards/skins/
//      (sonst stünde er im Shop).
//   3. server.js: `scanSkinFiles()` wird nur von `shopSkinNames()`
//      verwendet (Shop-Katalog, Kauf, Zufallskauf, CPU-Würfel nehmen
//      den Shop-Bestand); jede CPU-Deckkopie filtert die Skins.
//   4. Die Datums-Logik („31.10. nach der lokalen Uhr“) stimmt in
//      allen Zeitzonen.
//
//  Aufruf:  node scripts/check-unlockable-skins.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Befund.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');
const U = require('../unlockable-skins');

const WURZEL = path.join(__dirname, '..');
let funde = 0;
const fehler = (msg) => { funde++; console.error('✗ ' + msg); };
const ok = (cond, msg) => { if (!cond) fehler(msg); };

// 1 + 2: Dateien und Regeln
const skinsData = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'skins.json'), 'utf-8'));
const dateien = U.unlockableSkinNames();
for (const name of Object.keys(U.RULES)) {
  ok(dateien.has(name), `Regel „${name}“ hat kein Bild in cards/skins/unlockable/`);
  ok(U.heroOfSkin(skinsData, name), `„${name}“ steht in keiner Heldenliste von data/skins.json`);
}
for (const name of dateien) ok(U.RULES[name], `cards/skins/unlockable/${name} hat keine Freischalt-Regel (unlockable-skins.js RULES)`);
const oben = new Set(fs.readdirSync(U.SKINS_DIR).map(f => path.basename(f, path.extname(f))));
for (const name of dateien) ok(!oben.has(name), `„${name}“ liegt auch direkt in cards/skins/ und wäre im Shop kaufbar`);
ok(U.allTutorialIds().length > 0, 'keine Tutorial-Stufen gefunden (data/puzzles/tutorial/)');

// 3: Quelltext von server.js
const server = fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf-8');
const scanNutzer = [...server.matchAll(/(?<!function )scanSkinFiles\(\)/g)].length;
ok(scanNutzer === 1, `scanSkinFiles() wird ${scanNutzer}x aufgerufen (erlaubt: genau 1, in shopSkinNames) — Shop und CPU müssen shopSkinNames() nehmen`);
ok(/function shopSkinNames\(\)\s*\{[^}]*scanSkinFiles\(\)/s.test(server), 'shopSkinNames() fehlt oder nutzt scanSkinFiles() nicht');
const rohkopien = [...server.matchAll(/skins:\s*d\.skins\s*\|\|\s*\{\}/g)].length;
ok(rohkopien === 1, `${rohkopien} Deckkopien übernehmen d.skins ungefiltert (erlaubt: genau 1, die geteilte in createCpuBattle, deren CPU-Seite danach gefiltert wird)`);
ok(/cpuSnapshot\.skins\s*=\s*withoutUnlockableSkins\(cpuSnapshot\.skins\)/.test(server), 'createCpuBattle filtert die Skins der CPU-Seite nicht');
ok(/deckSkins:\s*String\(userId\)\.startsWith\('cpu-'\)\s*\?\s*withoutUnlockableSkins/.test(server), 'Puzzle: die CPU-Seite filtert freischaltbare Skins nicht');
ok(/pool\s*=\s*\(SKINS_DATA\[heroName\]\s*\|\|\s*\[\]\)\.filter\(n\s*=>\s*skinHasImage\(n,\s*skinFiles\)\s*&&\s*!isUnlockableSkin\(n\)\)/.test(server), 'rollCpuSkin filtert freischaltbare Skins nicht');
for (const aufruf of ['onHumanWonGame(winner.userId)', "onHumanWonGame(room.players?.[0]?.userId)", 'grantTutorialSkinIfDone(userId)']) {
  ok(server.includes(aufruf), `server.js: Freischalt-Aufruf fehlt: ${aufruf}`);
}
const skilltest = fs.readFileSync(path.join(WURZEL, 'skilltest', 'battle.js'), 'utf-8');
ok(skilltest.includes('host.onHumanWon'), 'skilltest/battle.js: der Sieg eines Menschen wird nicht gemeldet (host.onHumanWon)');

// 4: Datums-Logik
const T = (y, m, d, h, min) => Date.UTC(y, m - 1, d, h, min);
const faelle = [
  ['UTC+2, 23:30 am 31.10.', T(2026, 10, 31, 21, 30), -120, true],
  ['UTC-5, 21:00 am 31.10. (UTC schon 1.11.)', T(2026, 11, 1, 2, 0), 300, true],
  ['UTC-5, 21:00 am 30.10. (UTC schon 31.10.)', T(2026, 10, 31, 2, 0), 300, false],
  ['UTC+9, 00:30 am 1.11. (UTC 31.10.)', T(2026, 10, 31, 15, 30), -540, false],
  ['UTC+9, 00:30 am 31.10. (UTC 30.10.)', T(2026, 10, 30, 15, 30), -540, true],
  ['30.10. mittags', T(2026, 10, 30, 12, 0), -60, false],
  ['31.10. in einem anderen Jahr', T(2030, 10, 31, 12, 0), -60, true],
];
for (const [name, jetztClient, tz, soll] of faelle) {
  const serverJetzt = T(2026, 1, 1, 0, 0);                         // Serveruhr beliebig: nur der Abstand zählt
  const uhr = U.parseClientClock({ now: jetztClient, tz }, serverJetzt);
  const ist0 = U.isHalloween(U.localDate(uhr, serverJetzt));
  ok(ist0 === soll, `Datum: ${name} → ${ist0} (erwartet ${soll})`);
}
// Mitternachtswechsel nach der Meldung: gemeldet um 23:58 am 31.10., Sieg 5 Minuten später → schon 1.11.
{
  const server0 = T(2026, 10, 31, 12, 0);
  const uhr = U.parseClientClock({ now: T(2026, 10, 31, 21, 58), tz: -120 }, server0);   // lokal 23:58
  ok(U.isHalloween(U.localDate(uhr, server0)), 'Datum: um 23:58 ist es noch der 31.10.');
  ok(!U.isHalloween(U.localDate(uhr, server0 + 5 * 60000)), 'Datum: fünf Minuten später (nach Mitternacht) ist es der 1.11.');
}
ok(U.parseClientClock({ now: 'x', tz: 1 }) === null && U.parseClientClock({ now: 1, tz: 99999 }) === null, 'ungültige Uhrmeldungen werden nicht angenommen');
ok(U.localDate(null) === null, 'ohne Uhrmeldung gibt es kein Datum');
ok(JSON.stringify(U.withoutUnlockableSkins({ 'Visionary Genius Heinz': 'Dr. Heinz N. Stein', 'Xal, the Animated Armor': 'Alchemic Xal' })) === JSON.stringify({ 'Xal, the Animated Armor': 'Alchemic Xal' }), 'withoutUnlockableSkins entfernt nicht genau die freischaltbaren Skins');

if (funde) { console.error(`\n${funde} Befund(e).`); process.exit(1); }
console.log('Freischaltbare Skins: alles in Ordnung.');
