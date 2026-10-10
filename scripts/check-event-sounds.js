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
const shared = fs.readFileSync(path.join(__dirname, '..', 'public', 'app-shared.jsx'), 'utf8');

// Socket-Ereignis → Handlername, geforderter Klang
const KANAELE = [
  { ereignis: 'burning_finger_slash', handler: 'onBurningFingerSlash', klang: 'slash', karte: 'Burning Finger' },
  { ereignis: 'play_heal_beam', handler: 'onHealBeam', klang: 'laser', karte: 'Heal' },
];

// Handler, die ihren Klang ueber die TABELLE holen (`playSFXForZoneAnim('ev_…')`, Eintrag in ZONE_ANIM_SFX) — Sweep 10.10.
const TABELLEN_KANAELE = [
  ['onWillyLeprechaun', 'ev_willy_leprechaun'], ['onAlleriaSpiderRedirect', 'ev_alleria_spider_redirect'], ['onPusherFling', 'ev_pusher_fling'],
  ['onBaihuPetrify', 'ev_baihu_petrify'], ['onCardinalBeastWin', 'ev_cardinal_beast_win'], ['onCooldinTerraform', 'ev_cooldin_terraform'],
  ['onBigGwenClockActivation', 'ev_big_gwen_clock'], ['onTempesteRainStart', 'ev_tempeste_rain_start'], ['onSmugCoinSave', 'ev_smug_coin_save'],
  ['onTearsOfCreation', 'ev_tears_of_creation'], ['onHandSteal', 'ev_hand_steal'], ['onCloakVanish', 'ev_cloak_vanish'], ['onSkullBurst', 'ev_skull_burst'],
  ['onGuardianAngel', 'ev_guardian_angel'], ['onChaosScreen', 'ev_chaos_screen'], ['onBrackleCatapult', 'ev_catapult_fire'],
];
const tabelle = (() => { const a = shared.indexOf('const ZONE_ANIM_SFX = '); return shared.slice(a, shared.indexOf('\n};', a)); })();

const fehler = [];
for (const [handler, key] of TABELLEN_KANAELE) {
  const a = board.indexOf(`const ${handler} = `);
  if (a < 0) { fehler.push(`Handler ${handler} nicht gefunden — Eintrag in TABELLEN_KANAELE prüfen.`); continue; }
  const rumpf = board.slice(a, a + 6000);
  if (!rumpf.includes(`playSFXForZoneAnim('${key}')`)) fehler.push(`${handler}: ruft playSFXForZoneAnim('${key}') nicht mehr — das Bild läuft stumm.`);
  const eintrag = (tabelle.match(new RegExp(`^ {2}${key}:\\s*(.*)$`, 'm')) || [])[1];
  if (eintrag === undefined || /^null\b/.test(eintrag.trim())) fehler.push(`ZONE_ANIM_SFX hat keinen Klang für '${key}' (${handler}).`);
}
// Der Einschlag des Katapults laeuft ueber einen DIREKTEN playAnimation-Aufruf und muss den `explosion`-Klang selbst anstossen.
{
  const a = board.indexOf('const onBrackleCatapult');
  if (!board.slice(a, a + 8000).includes("playSFXForZoneAnim('explosion')")) fehler.push("onBrackleCatapult: der Einschlag (`explosion`) ist stumm.");
}
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
console.log(`[check-event-sounds] OK — ${KANAELE.length} Socket-Animationen mit eigenem Klang (category: null), ${TABELLEN_KANAELE.length} über die Tabelle.`);
