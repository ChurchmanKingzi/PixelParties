#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: „counts as a status effect" MUSS AUCH EINER SEIN
//
//  Anlass (v1102, Als Sweep-Auftrag 15.9.: „Gibt es Effekte, die als
//  Status gelten, aber noch nicht wahrgenommen werden (etwa Curse)?")
//
//  21 Karten sagen in ihrem Text, dass sie als Statuseffekt zählen.
//  Damit das keine leere Behauptung ist, muss die Karte einen von zwei
//  Wegen gehen:
//
//    (a) sie legt einen ECHTEN Engine-Status an (`addHeroStatus`,
//        `applyCreatureStatus`, `actionAddStatus`) — dann greifen
//        Heilung, Anzeige und alle „ist betroffen von"-Abfragen von
//        selbst. Das ist der Normalfall: Berserk hängt seine Regeln an
//        `berserked`, Curse an `cursed`, beide cleansbar.
//
//    (b) sie trägt `countsAsNegativeStatus` (v1092) — für Anhängsel,
//        die als Karte am Helden liegen und gar keinen Status setzen
//        (Decisive Defeat).
//
//    (c) sie trägt `declaresStatus: '<name>'` — wenn der MOTOR den
//        Status für sie anlegt, weil die Karte keinen eigenen
//        Auflösungspunkt hat (Weakening Crystal liegt in der Hand).
//
//  Wer keinen von beiden geht, hat einen Text, der lügt: die Karte
//  taucht in keiner Heil-Liste auf und zählt für keine Abfrage.
//
//  Aufruf:  node scripts/check-status-claims.js
//  Rückgabe 0 = sauber, 1 = Behauptungen ohne Deckung.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));

function slug(n) {
  return n.toLowerCase().replace(/['’.,:]/g, '').replace(/\s+/g, '-');
}

// Karten mit einem BEGRÜNDETEN Sonderweg.
const AUSNAHMEN = new Map([
  ['Unwanted Audience',
   'wirkt auf KREATUREN und hängt an `getCleansableCreatureStatusKeys` — der Kreatur-Seite des Heil-Systems'],

]);

const fehlt = [];
const ohneSkript = [];

for (const c of KARTEN) {
  const e = c.effect || '';
  if (!/counts as a (negative )?status effect/i.test(e)) continue;
  if (AUSNAHMEN.has(c.name)) continue;

  const p = path.join(EFFEKTE, slug(c.name) + '.js');
  if (!fs.existsSync(p)) { ohneSkript.push(c.name); continue; }

  const src = fs.readFileSync(p, 'utf8');
  // ★ v1238 (Als Befund 19.9. zu „Pink Sky": „sie funktioniert in der
  // Praxis exakt so, wie sie soll"). Stimmt — der Wächter kannte nur
  // die drei Standardwege und hat den VIERTEN übersehen:
  // `actionNegateCreature` legt den Status `negated` selbst an (samt
  // ON_STATUS_APPLIED-Hook, `cleansable`-Behandlung und Ablauf-Sweep),
  // er steht in STATUS_EFFECTS als negativ und cleansbar. Eine Karte,
  // die dort hineingeht, behauptet also nichts Leeres.
  // Anti Magic Zone fiel nur deshalb nicht auf, weil sie NEBENBEI noch
  // einen Heldenstatus setzt; Pink Sky negiert ausschließlich Kreaturen
  // und hatte damit keinen der bekannten Marker.
  const legtStatus = /addHeroStatus\(|applyCreatureStatus\(|actionAddStatus\(|actionNegateCreature\(/.test(src);
  const traegtFlag = /countsAsNegativeStatus/.test(src);
  // (c) Die Karte legt ihren Status nicht SELBST an, sondern der Motor
  // tut es für sie — „Weakening Crystal" liegt in der HAND und hat gar
  // keinen eigenen Auflösungspunkt. `declaresStatus: '<name>'` benennt
  // den Status und macht die Zuständigkeit im Kartenskript sichtbar.
  const deklariert = /declaresStatus:\s*'[^']+'/.test(src)
    // (d) v1143: ein Anhaengsel, das seinen Status ueber
    // `attachmentStatus` deklariert und selbst anlegt („Forbidden Curse
    // of Aging" → `aged`, ueber `setzeAnhaengselStatus`).
    || /attachmentStatus:\s*(STATUS_NAME|'[^']+')/.test(src);
  if (!legtStatus && !traegtFlag && !deklariert) fehlt.push(`  ✗ ${c.name}  (${path.basename(p)})`);
}

if (fehlt.length === 0) {
  const zusatz = ohneSkript.length
    ? `  (${ohneSkript.length} noch ohne Skript: ${ohneSkript.join(', ')})`
    : '';
  console.log('[check-status-claims] OK — jede Karte, die sich Statuseffekt nennt, ist auch einer.');
  if (zusatz) console.log(zusatz);
  process.exit(0);
}
console.log(`[check-status-claims] ${fehlt.length} Karte(n) behaupten einen Status, den es nicht gibt:\n`);
console.log(fehlt.join('\n'));
console.log('\n  Entweder einen echten Status anlegen (addHeroStatus / applyCreatureStatus),');
console.log('  ODER `countsAsNegativeStatus: true` + `negativeStatusLabel` setzen, wenn die');
console.log('  Karte als Anhängsel am Helden liegt. Sonst steht der Satz nur auf dem Papier:');
console.log('  die Karte taucht in keiner Heil-Auswahl auf und zählt für keine Abfrage.\n');
process.exit(1);
