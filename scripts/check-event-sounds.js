'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — EIGENE SOCKET-ANIMATIONEN BRAUCHEN IHREN KLANG
//
//  `check-anim-sounds` deckt nur die Zonen-Animationen der `ANIM_REGISTRY` ab. Einige Zauber laufen über EIGENE
//  Socket-Kanäle mit einem Handler in `public/app-board.jsx` (`socket.on('<ereignis>', handler)`), die nicht in
//  `ZONE_ANIM_SFX` stehen — ihr Klang gehört in den Handler. Fehlt er, läuft das Bild stumm (Befund 10.10.: Heal und
//  Burning Finger). Hier stehen diese Kanäle mit dem Klang, den sie spielen müssen.
//
//  Nimmt ein Handler `category: 'effect'`, kann ein anderer Effektklang der Sammelkategorie (400-ms-Sperre) seinen
//  Klang verschlucken — die Einträge unten verlangen deshalb ausdrücklich `category: null`.
//
//  Neuer Zauber mit eigenem Socket-Kanal und Bild? Hier eintragen.
//
//  Aufruf:  node scripts/check-event-sounds.js        Rückgabe 0 = sauber, 1 = Verstöße.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const board = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-board.jsx'), 'utf8');

// Socket-Ereignis → Handlername, geforderter Klang
const KANAELE = [
  { ereignis: 'burning_finger_slash', handler: 'onBurningFingerSlash', klang: 'slash', karte: 'Burning Finger' },
  { ereignis: 'play_heal_beam', handler: 'onHealBeam', klang: 'laser', karte: 'Heal' },
];

const fehler = [];
for (const k of KANAELE) {
  const a = board.indexOf(`const ${k.handler} = `);
  const b = board.indexOf(`socket.on('${k.ereignis}', ${k.handler})`, a);
  if (a < 0 || b < 0) { fehler.push(`Kanal '${k.ereignis}' (${k.karte}): Handler ${k.handler} oder seine Anmeldung nicht gefunden — Eintrag in check-event-sounds.js prüfen.`); continue; }
  const rumpf = board.slice(a, b);
  const aufruf = rumpf.match(new RegExp(`playSFX\\('${k.klang}',\\s*\\{([^}]*)\\}`));
  if (!aufruf) { fehler.push(`Kanal '${k.ereignis}' (${k.karte}): der Handler spielt keinen '${k.klang}'-Klang — das Bild läuft stumm.`); continue; }
  if (!/category:\s*null/.test(aufruf[1])) fehler.push(`Kanal '${k.ereignis}' (${k.karte}): '${k.klang}' ohne \`category: null\` — die Sammelkategorie 'effect' kann ihn verschlucken.`);
}

if (fehler.length) {
  for (const f of fehler) console.error('[check-event-sounds] ' + f);
  process.exit(1);
}
console.log(`[check-event-sounds] OK — ${KANAELE.length} Socket-Animationen mit eigenem Klang (category: null).`);
