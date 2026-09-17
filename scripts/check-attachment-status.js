#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ANHÄNGSEL, DIE EINEN STATUS AUFLEGEN, MÜSSEN IHN NENNEN
//
//  Anlass (v1112, Als Vorgabe 15.9.: „Wird im Puzzle Mode einem Hero
//  Decisive Defeat in die Support Zone getan, soll er automatisch das
//  Puzzle negiert beginnen. Dasselbe gilt für ALLE Attachments, die
//  Statuseffekte applyen!")
//
//  Im Puzzle läuft KEIN `onPlay` — die Karten werden direkt in die
//  Zonen gesetzt. Anhängsel zerfallen dadurch in zwei Gruppen:
//
//    ① PASSIVE (Siege):
//       ihre Wirkung wird bei jeder Abfrage neu aus dem Brett gelesen.
//       Die wirken im Puzzle von selbst — nichts zu tun.
//
//    ② STATUS-SETZENDE (Berserk → `berserked`, Curse → `cursed`):
//       ihr Effekt hängt an einem Status, den sonst `onPlay` anlegt.
//       Ohne Deklaration beginnt das Puzzle OHNE den Effekt — die
//       Karte liegt sichtbar da und tut nichts.
//
//  Dieses Skript findet Gruppe ② und verlangt `attachmentStatus` bzw.
//  `attachmentBuff` — Buffs („Alliance", „Anti Magic Enchantment")
//  gehen im Puzzle genauso verloren wie Status.
//
//  Aufruf:  node scripts/check-attachment-status.js
//  Rückgabe 0 = sauber, 1 = Anhängsel ohne Deklaration.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));

function slug(n) {
  return n.toLowerCase().replace(/['’.,:]/g, '').replace(/\s+/g, '-');
}

// Anhängsel, die BEWUSST keinen Status setzen.
const AUSNAHMEN = new Map([
  ['Love Shot',
   'kein Anhängsel — leiht sich `charmed` nur für die Dauer EINER Aktion'],
]);

const fehlt = [];
for (const c of KARTEN) {
  if (c.subtype !== 'Attachment') continue;
  if (AUSNAHMEN.has(c.name)) continue;
  const p = path.join(EFFEKTE, slug(c.name) + '.js');
  if (!fs.existsSync(p)) continue;

  const src = fs.readFileSync(p, 'utf8');
  // Legt die Karte einen HELDEN-Status auf? (Kreaturen-Status gehören
  // nicht hierher — Anhängsel hängen an Helden.)
  // Status ODER Buff — beide gehen im Puzzle sonst verloren.
  const setztStatus = /addHeroStatus\(/.test(src);
  const setztBuff = /addHeroBuff\(\s*[^,]+,\s*[^,]+,\s*'[a-z_]+'/.test(src)
    || /buffs\.[a-z_]+\s*=/.test(src);
  if (!setztStatus && !setztBuff) continue;
  if (setztStatus && !/attachmentStatus:/.test(src)) {
    fehlt.push(`  ✗ ${c.name}  (${path.basename(p)}) — braucht \`attachmentStatus\``);
    continue;
  }
  if (setztBuff && !/attachmentBuff:/.test(src)) {
    fehlt.push(`  ✗ ${c.name}  (${path.basename(p)}) — braucht \`attachmentBuff\``);
  }
}

if (fehlt.length === 0) {
  console.log('[check-attachment-status] OK — jedes status-setzende Anhängsel nennt seinen Status.');
  process.exit(0);
}
console.log(`[check-attachment-status] ${fehlt.length} Anhängsel ohne \`attachmentStatus\`:\n`);
console.log(fehlt.join('\n'));
console.log('\n  Im Puzzle läuft kein `onPlay`. Ohne die Deklaration beginnt das Puzzle');
console.log('  OHNE den Effekt: die Karte liegt sichtbar in der Support Zone und tut');
console.log('  nichts. Setze `attachmentStatus: \'<statusname>\'` am Kartenskript.');
console.log('  Wirkt die Karte PASSIV (ohne Status), gehört sie in die Ausnahmeliste.\n');
process.exit(1);
