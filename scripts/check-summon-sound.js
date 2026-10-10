'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — DAS ERSCHEINEN EINER CREATURE BRAUCHT SEINEN KLANG
//
//  `creature_summoned` spielt `summon` im Sammel-Slot 'effect' (ein Klang je Wirkung, 400 ms Sperre). Eine
//  Animation, die VOR der Beschwoerung als KOSTEN laeuft (Opfer-Messer), darf diesen Slot nicht belegen — sonst
//  verschluckt ihr Schlag den Beschwoerungs-Klang, und die Creature erscheint stumm (Blue-Ice Dragon über
//  Pinta, 10.10.). Solche Animationen stehen in `ZONE_ANIM_NONEFFECT` (public/app-shared.jsx) oder nennen
//  `category: null`.
//
//  Aufruf:  node scripts/check-summon-sound.js        Rückgabe 0 = sauber, 1 = Verstöße.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const shared = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-shared.jsx'), 'utf8');

// Animationen, die als Beschwoerungs-KOSTEN laufen (jede, die `resolveSacrificeCost` standardmaessig zeigt).
const KOSTEN_ANIMATIONEN = ['knife_sacrifice'];

const nonEffect = (shared.match(/const ZONE_ANIM_NONEFFECT = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '';
const fehler = [];
if (!/case 'creature_summoned':[\s\S]{0,80}playSFX\('summon', \{ category: 'effect' \}\)/.test(shared)) {
  fehler.push("`creature_summoned` spielt `summon` nicht mehr im Slot 'effect' — Annahme dieses Tests prüfen und anpassen.");
}
for (const typ of KOSTEN_ANIMATIONEN) {
  const eintrag = (shared.match(new RegExp(`^\\s*${typ}:\\s*(\\{[^\\n]*\\}|\\[[\\s\\S]*?\\n  \\]),`, 'm')) || [])[1] || '';
  const ohneSlot = new RegExp(`'${typ}'`).test(nonEffect) || /category:\s*null/.test(eintrag);
  if (!ohneSlot) fehler.push(`Kosten-Animation '${typ}' belegt den 'effect'-Slot und verschluckt den Beschwoerungs-Klang: in ZONE_ANIM_NONEFFECT eintragen.`);
}
// Der Aufdeck-Flug auf einen Brettplatz (`mill_center_reveal`, dest 'support') ist kein Abwurf: sein `discard` bei 75 %
// verschluckte den Beschwoerungs-Klang der gelandeten Creature (10.10.).
const board = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-board.jsx'), 'utf8');
if (!/dest === 'support' \? 0 : setTimeout\(\(\) => sfx\('discard'\)/.test(board)) {
  fehler.push("`KassaranFlipCard` spielt bei `dest: 'support'` wieder `discard` und verschluckt damit den Beschwoerungs-Klang (app-board.jsx).");
}
if (fehler.length) {
  for (const f of fehler) console.error('[check-summon-sound] ' + f);
  process.exit(1);
}
console.log(`[check-summon-sound] OK — ${KOSTEN_ANIMATIONEN.length} Kosten-Animation(en) lassen den Beschwoerungs-Klang durch.`);
