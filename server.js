// ── Minimal .env loader (no dependency) ──────────────────────────
//  MUSS VOR ALLEN LOKALEN require() STEHEN. (15.8., netcup-Umzug)
//
//  Dieser Block stand bis v387 UNTER `const db = require('./db')`.
//  Das war ein latenter Fehler: db.js entscheidet BEIM LADEN, in seinem
//  Modulrumpf, ob es sich mit Turso oder mit einer lokalen SQLite-Datei
//  verbindet —
//      const isRemote = !!(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN)
//  — und zu diesem Zeitpunkt war die .env noch nicht eingelesen. Der
//  Server startete dann kommentarlos gegen eine leere lokale Datenbank.
//
//  Auf Render ist das nie aufgefallen, weil die Zugangsdaten dort echte
//  Umgebungsvariablen der Plattform waren und schon vor dem Node-Start
//  existierten. Erst mit dem Umzug auf eine .env-Datei kam es heraus.
//
//  Gleiches gilt fuer cards/effects/_engine.js, das auf Modulebene
//  PP_DMG_CAP liest. Der Loader gehoert deshalb VOR JEDEN require.
//
//  Liest KEY=VALUE aus der .env im Projektwurzelverzeichnis, ohne
//  bereits gesetzte echte Umgebungsvariablen zu ueberschreiben — was in
//  der systemd-Unit steht, gewinnt also weiterhin.
(function loadDotEnv() {
  try {
    const path = require('path');
    const fs = require('fs');
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m || line.trim().startsWith('#')) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch (e) { console.error('[env] .env load failed:', e.message); }
})();

const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const db = require('./db');
const bcrypt = require('bcryptjs');
// const multer = require('multer'); // Replaced by base64 uploads
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const { GameEngine } = require('./cards/effects/_engine');
const { loadCardEffect } = require('./cards/effects/_loader');
const { BUFF_EFFECTS, heroCanBeEquipped, hasSpellSchool } = require('./cards/effects/_hooks');
const { biomancyTokenCounters } = require('./cards/effects/_biomancy-shared');
const { containsProfanity, MESSAGE_MAX_LEN } = require('./public/profanity.js');


const { sendMail } = require('./mailer');

/**
 * Enrich a puzzle-authored buffs object so each entry carries the
 * auto-applied fields the engine reads (e.g. `damageMultiplier`).
 * The puzzle creator stores buffs as bare flags / opt blobs; the
 * runtime `actionAddBuff` / `actionAddCreatureBuff` paths normally
 * pull `BUFF_EFFECTS[buffName].damageMultiplier` onto the buff at
 * apply-time. Without this enrichment, puzzle-loaded `damage_immune`
 * (and any future multiplier-based buff) carries no multiplier and
 * the engine's beforeDamage / processCreatureDamageBatch passes see
 * `damageMultiplier == null` and skip the multiplier — i.e. damage
 * lands at full strength.
 */
function enrichPuzzleBuffs(buffs) {
  if (!buffs || typeof buffs !== 'object') return buffs;
  for (const key of Object.keys(buffs)) {
    // The puzzle creator stores active buffs as bare booleans
    // (`{ damage_immune: true }`) — coerce to a proper opt object so
    // `damageMultiplier` etc. can be attached. A primitive value
    // can't carry properties, so without this step the enrichment
    // below silently no-ops.
    let cur = buffs[key];
    if (cur === null || cur === undefined || typeof cur !== 'object') cur = {};
    const def = BUFF_EFFECTS[key];
    if (def) {
      if (def.damageMultiplier != null && cur.damageMultiplier == null) {
        cur.damageMultiplier = def.damageMultiplier;
      }
    }
    buffs[key] = cur;
  }
  return buffs;
}

// ===== CONFIG =====
const PORT = process.env.PORT || 3000;
// ───────────────────────────────────────────────────────────────
//  BINDEADRESSE (15.8., netcup-Umzug)
//  Hinter Caddy lauscht der Node-Prozess NUR auf dem Loopback. Sonst
//  haengt Port 3000 zusaetzlich offen im Netz und ist unter der nackten
//  IP direkt erreichbar — an TLS, an den Zugriffsprotokollen und an der
//  Firewall vorbei. Ohne gesetztes HOST bleibt es beim bisherigen
//  Verhalten (alle Schnittstellen), damit Tests im LAN weiter gehen.
// ───────────────────────────────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
const PROFILE_SECRET = process.env.PROFILE_SECRET || 'pxlParties_s3cret_k3y_2025!';
const PUZZLE_SECRET = process.env.PUZZLE_SECRET || 'pxlParties_puzzl3_k3y_2025!';
const profileImportUsed = new Set();

// ===== PUZZLE ENCRYPTION =====
function encryptPuzzle(data) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(PUZZLE_SECRET, 'pxl-puzzle-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return iv.toString('base64') + ':' + encrypted;
}
function decryptPuzzle(encryptedStr) {
  const [ivB64, data] = encryptedStr.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const key = crypto.scryptSync(PUZZLE_SECRET, 'pxl-puzzle-salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// ===== DEBUG FLAGS =====
// Reveal the CPU/NPC opponent's hand to the human player during singleplayer
// matches. Useful while debugging CPU behaviour — you can see exactly what
// the CPU is holding and predict its plays. MUST be `false` for public
// builds (leaks opponent information).
const DEBUG_REVEAL_NPC_HAND = false;

// ===== CARD DATABASE CACHE =====
// Module-level card DB cache — loaded once, used everywhere.
// Replaces per-request JSON.parse(fs.readFileSync(...)) calls.
let _cachedCardDB = null;    // { cardName: cardData }
let _cachedCardArray = null;  // [cardData, ...]
function getCardDB() {
  if (!_cachedCardDB) {
    _cachedCardArray = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'));
    _cachedCardDB = {};
    _cachedCardArray.forEach(c => { _cachedCardDB[c.name] = c; });
  }
  return _cachedCardDB;
}
function getCardArray() {
  if (!_cachedCardArray) getCardDB();
  return _cachedCardArray;
}

// ── Geteilte Support-Zonen: die Stapel fuer den Client ───────────────
// „Alice, the Transfer Student" laesst mehrere Kreaturen GLEICHEN
// Namens einen Platz teilen. `creatureCounters` ist je Platz nur EIN
// Eintrag (die Schleife ueberschreibt, die letzte Instanz gewinnt) —
// fuer die Stueckzahl und die Instanz-Galerie braucht der Client die
// Kopien EINZELN. Genau dieselbe Form wie die `instancePick`-Abfrage
// der Engine, damit Brett und Abfrage dieselben Zeilen zeichnen.
// Nur Plaetze mit MEHR als einer Kreatur landen hier; ohne Alice ist
// die Karte leer und kostet nichts.
function buildSupportStacks(room) {
  if (!room?.engine) return {};
  const alice = require('./cards/effects/_alice-shared');
  const engine = room.engine;
  const byKey = {};
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    const physicalSide = (inst.stolenBy != null)
      ? inst.owner
      : (inst.controller ?? inst.owner);
    const key = `${physicalSide}-${inst.heroIdx}-${inst.zoneSlot}`;
    if (byKey[key]) continue; // Platz schon abgearbeitet
    const stack = alice.stackAt(engine, physicalSide, inst.heroIdx, inst.zoneSlot);
    if (stack.length <= 1) { byKey[key] = null; continue; }
    byKey[key] = stack.map(i => alice.describeInstance(engine, i));
  }
  const out = {};
  for (const [k, v] of Object.entries(byKey)) if (v) out[k] = v;
  return out;
}

// Karten, deren Text die Kopienzahl im Deck freigibt („Your deck may
// contain any number of …"). SPIEGEL von `UNLIMITED_COPY_CARDS` in
// public/app-shared.jsx — laufen die beiden Listen auseinander, baut
// der serverseitige Deckgenerator Decks, die der Deckbuilder nicht
// zulaesst (oder umgekehrt).
const UNLIMITED_COPY_CARDS = new Set(['Infinitely Reproducing Slime']);

// ===== DAILY CHALLENGE =====
// The most recent 12:00 Europe/Berlin (CET/CEST), as Unix-seconds ≤ nowSec.
function mostRecentNoonCETSec(nowSec = Math.floor(Date.now() / 1000)) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  });
  const parse = (ts) => {
    const o = {};
    for (const p of fmt.formatToParts(new Date(ts * 1000))) {
      if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10);
    }
    return o;
  };
  let { year: y, month: m, day: d, hour } = parse(nowSec);
  // If we're before noon Berlin today, the most recent noon was yesterday.
  if (hour < 12) {
    const yest = new Date(Date.UTC(y, m - 1, d) - 86400000);
    y = yest.getUTCFullYear(); m = yest.getUTCMonth() + 1; d = yest.getUTCDate();
  }
  // Find Unix-seconds whose Berlin clock reads y-m-d 12:00. Start with the
  // UTC noon candidate and shift by the Berlin-UTC offset (±1h or ±2h).
  let candSec = Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 1000);
  for (let i = 0; i < 4; i++) {
    const c = parse(candSec);
    if (c.year === y && c.month === m && c.day === d && c.hour === 12) return candSec;
    let shift = (c.hour - 12) * 3600;
    if (c.day !== d) shift += (c.day > d ? -24 : 24) * 3600;
    candSec -= shift;
  }
  return candSec;
}

// Cache the pool of legal hero names for the daily roll. Filters to
// non-banned Heroes that have a card image in /cards (i.e. the same pool
// the deckbuilder shows). Computed lazily on first use after boot.
let _cachedDailyHeroPool = null;
function getDailyHeroPool() {
  if (!_cachedDailyHeroPool) {
    const cardsDir = path.join(__dirname, 'cards');
    const haveImage = new Set();
    try {
      const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
      const stripped = {};
      getCardArray().forEach(c => { stripped[c.name.replace(/[^a-zA-Z0-9 ]/g, '')] = c.name; });
      for (const f of fs.readdirSync(cardsDir)) {
        if (!exts.has(path.extname(f).toLowerCase())) continue;
        const stem = path.basename(f, path.extname(f));
        const real = stripped[stem.replace(/[^a-zA-Z0-9 ]/g, '')] || stem;
        haveImage.add(real);
      }
    } catch {}
    _cachedDailyHeroPool = getCardArray()
      .filter(c => c?.cardType === 'Hero' && !c.banned && haveImage.has(c.name))
      .map(c => c.name);
  }
  return _cachedDailyHeroPool;
}

function rollDailyHeroes() {
  const pool = getDailyHeroPool().slice();
  // Fisher-Yates partial shuffle for 3 unique picks.
  const out = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

const DAILY_CHALLENGE_DURATION_SEC = 24 * 60 * 60;

// The next 12:00 Europe/Berlin strictly after `ts` (Unix seconds).
function nextNoonCETAfter(ts) {
  // Probe ~25h ahead so we cross at least one noon even across DST jumps,
  // then snap to the most-recent-noon at the probe.
  const probe = mostRecentNoonCETSec(ts + 25 * 3600);
  return probe > ts ? probe : ts + DAILY_CHALLENGE_DURATION_SEC;
}

// Returns the active challenge for a user-row, or null if expired / never started.
// "Active" means: started after the most recent 12:00 CET tick AND within 24h.
function getActiveDaily(userRow, nowSec = Math.floor(Date.now() / 1000)) {
  if (!userRow) return null;
  const startTs = userRow.daily_start_ts || 0;
  if (!startTs) return null;
  const lastReset = mostRecentNoonCETSec(nowSec);
  if (startTs < lastReset) return null;
  if (nowSec - startTs >= DAILY_CHALLENGE_DURATION_SEC) return null;
  let heroes = [];
  try { heroes = JSON.parse(userRow.daily_heroes || '[]'); } catch {}
  if (!Array.isArray(heroes) || heroes.length === 0) return null;
  return {
    heroes,
    startTs,
    claimedBig: userRow.daily_claimed_big || 0,
    expiresTs: Math.min(startTs + DAILY_CHALLENGE_DURATION_SEC, nextNoonCETAfter(startTs)),
  };
}

// Surface silent async failures — self-play batches will otherwise hang
// indefinitely on a rejected Promise that nobody handled, with no trace
// whatsoever in the log. This at least tells us what threw.
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason?.stack || reason);
  flushSelfPlayTrail('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err?.stack || err);
  flushSelfPlayTrail('uncaughtException');
});
process.on('SIGINT', () => {
  console.error('[SIGINT] flushing trail and exiting');
  flushSelfPlayTrail('SIGINT');
  process.exit(130);
});
process.on('beforeExit', () => flushSelfPlayTrail('beforeExit'));

// Module-level handle for the active self-play trail file. Set by
// debug_self_play_run when a batch starts, cleared on normal completion.
// The flush helper above lets every fatal handler force-sync remaining
// buffered writes — for a hard V8 OOM none of those handlers fire, but
// every per-action sync write already on disk survives the crash.
let _activeSelfPlayTrailFd = null;
function flushSelfPlayTrail(reason) {
  if (_activeSelfPlayTrailFd == null) return;
  try {
    fs.writeSync(_activeSelfPlayTrailFd, `\n=== TRAIL FLUSH (${reason}) at ${new Date().toISOString()} ===\n`);
    fs.fsyncSync(_activeSelfPlayTrailFd);
    fs.closeSync(_activeSelfPlayTrailFd);
  } catch {}
  _activeSelfPlayTrailFd = null;
}

// ───────────────────────────────────────────────────────────────
//  DEBUG-WERKZEUGE: LIVE AUS (12.8., Als Vorgabe)
//
//  Fuenf Socket-Ereignisse sind reine Entwicklerwerkzeuge, die man
//  ueber die Browser-Konsole ausloest — es gibt KEINE Oberflaeche
//  dafuer (im gesamten public/ kein einziger Emitter):
//
//    debug_self_play_run      Selbstspiel-Stapel (bis zu hunderte Partien)
//    debug_self_play_ab       A/B-Vergleich zweier Konfigurationen
//    debug_self_play_config   setzt Rollout-Horizont/Brain global um
//    debug_cpu_vs_cpu         CPU gegen CPU in einem eigenen Raum
//    debug_cpu_snapshot_test  Snapshot/Restore-Selbsttest der Engine
//
//  Sie hingen bisher NUR an `if (!currentUser)` — jeder angemeldete
//  Nutzer (auch ein Gast) konnte damit Trainingslaeufe auf der
//  Live-Instanz starten. Auf einer freien Render-Instanz frisst das
//  Rechenzeit, Speicher UND Bandbreite.
//
//  DAS LOKALE ML-TRAINING IST NICHT BETROFFEN: es laeuft ueber
//  `PP_TRAIN=1 node server.js` → `runTrainingBatch()` auf Modulebene,
//  ganz OHNE Socket-Server (`server.listen` wird dort nie gerufen).
//  scripts/train-iterative.js startet genau diesen Weg. Die Handler
//  hier werden davon nicht angefasst.
//
//  Standard ist AUS. Lokal einschalten mit `PP_DEBUG_TOOLS=1`.
//  Bewusst NICHT-REGISTRIEREN statt Pruefung im Handler: was nicht
//  angemeldet ist, kann auch von einem praeparierten Client nicht
//  erreicht werden — socket.io verwirft unbekannte Ereignisse still.
// ───────────────────────────────────────────────────────────────
const DEBUG_TOOLS_ENABLED = process.env.PP_DEBUG_TOOLS === '1';

const app = express();

// ───────────────────────────────────────────────────────────────
//  BETRIEB HINTER EINEM REVERSE PROXY (15.8., netcup-Umzug)
//
//  Auf dem eigenen Server terminiert Caddy TLS und reicht die Anfrage
//  per einfachem HTTP an 127.0.0.1 weiter. Ohne `trust proxy` sieht
//  Express dann bei JEDER Anfrage die Proxy-IP statt der echten und
//  haelt jede Verbindung fuer unverschluesselt (`req.secure` === false).
//
//  BEWUSST NUR PER UMGEBUNGSVARIABLE: Steht der Server nackt im Netz
//  (lokale Entwicklung), darf X-Forwarded-For NICHT geglaubt werden —
//  sonst kann sich jeder Client eine beliebige Herkunfts-IP andichten.
//  TRUST_PROXY wird deshalb ausschliesslich in der systemd-Unit
//  gesetzt, wo tatsaechlich ein Proxy davorsteht.
// ───────────────────────────────────────────────────────────────
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

const server = http.createServer(app);

// ───────────────────────────────────────────────────────────────
//  WEBSOCKET-KOMPRESSION (12.8.)
//
//  Socket.IO v4 liefert `perMessageDeflate` AUSGESCHALTET aus (in v2
//  war es noch an). Jedes `game_state` ging damit als roher JSON-Text
//  ueber die Leitung — und `game_state` ist der mit Abstand groesste
//  und haeufigste Verkehr, den dieser Server erzeugt.
//
//  GEMESSEN an einer echten Partie (Mid-Game-Brett aus einer
//  Demo-Aufnahme, 200 aufeinanderfolgende Zustaende):
//    roh                                   501 KB
//    je Nachricht einzeln komprimiert       214 KB  (−57 %)
//    permessage-deflate, geteiltes Fenster   61 KB  (−88 %)
//
//  Der grosse Unterschied kommt vom „context takeover": deflate
//  behaelt sein Woerterbuch ueber Nachrichten hinweg. Aufeinander-
//  folgende Spielzustaende sind fast identisch, also schrumpfen sie
//  auf den DIFF zusammen. Genau deshalb wird `serverNoContextTakeover`
//  hier bewusst NICHT gesetzt — das waere der haeufig kopierte
//  „speicherschonende" Vorschlag und wuerde den Gewinn halbieren.
//
//  Kosten: je Verbindung haelt zlib ein Fenster plus Hash-Tabellen,
//  rund 250-300 KB. Bei den Spielerzahlen dieses Servers sind das
//  wenige MB. `threshold` laesst Kleinkram (Pings, kurze Ereignisse)
//  unkomprimiert — die wuerden durch den deflate-Rahmen sonst sogar
//  groesser.
//
//  FUNKTIONAL AENDERT SICH NICHTS: permessage-deflate ist Teil des
//  WebSocket-Standards (RFC 7692) und wird beim Handshake ausgehandelt.
//  Browser, die es nicht koennen, bekommen weiter unkomprimierte
//  Frames; der Client braucht keine Zeile Aenderung.
// ───────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────
//  ERLAUBTE HERKUENFTE (15.8.)
//  Hier stand `origin: '*'` — jede fremde Seite durfte eine
//  Socket-Verbindung zu diesem Server aufbauen und im Namen eines
//  eingeloggten Besuchers mitspielen. Auf Render war das folgenlos,
//  weil dort nur eine einzige Domain existierte. Mit eigener Domain
//  plus Testsubdomain wird daraus eine Liste.
//
//  Ohne PP_ALLOWED_ORIGINS bleibt es bei '*' — an der lokalen
//  Entwicklung aendert sich also nichts.
// ───────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.PP_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : '*' },
  perMessageDeflate: {
    // SCHWELLE 32, NICHT 1024 (12.8., am Messlauf nachgerechnet).
    // Mit der ws-Vorgabe 1024 blieb alles ausser `game_state`
    // ungepackt — und das waren 79 % der Leitungsbytes: `card_reveal`
    // (Ø 49 Byte, 68 % aller Nachrichten) und `action_log` (Ø 127
    // Byte) gingen zu 100 % roh raus. Gerade diese Kleinnachrichten
    // wiederholen sich staendig, das geteilte Woerterbuch frisst sie
    // also besonders gut: nachgerechnet **70 % Ersparnis** auf genau
    // diesem Verkehr. Bei 64 waeren `card_reveal`-Rahmen weiter
    // ungepackt (sie sind kuerzer), deshalb 32.
    // Darunter bleiben nur noch die engine.io-Protokollrahmen
    // (Ping/Pong, 1-2 Byte) — die wuerde Kompression nur aufblaehen.
    threshold: 32,
    zlibDeflateOptions: { level: 6, memLevel: 8 },
    zlibInflateOptions: { chunkSize: 16 * 1024 },
    concurrencyLimit: 10,
  },
});

// ───────────────────────────────────────────────────────────────
//  AUSGANGS-VOLUMEN MESSEN (12.8., standardmaessig AUS)
//
//  Mit `PP_NET_STATS=1` zaehlt der Server, wie viele Bytes je
//  Socket-Ereignis tatsaechlich rausgehen, und schreibt alle 60 s die
//  groessten Posten ins Log. Gehaengt wird am engine.io-Socket, also
//  hinter ALLEN Sendewegen (`socket.emit`, `io.to(...).emit`,
//  `_broadcastEvent`) — die Zahlen sind echte Frame-Groessen, keine
//  Schaetzung.
//
//  Zweck: die Bandbreiten-Spitzen im Render-Report lassen sich damit
//  einem Ereignis zuordnen, statt sie zu erraten. Ohne die Variable
//  passiert hier gar nichts.
// ───────────────────────────────────────────────────────────────
if (process.env.PP_NET_STATS === '1') {
  const netBytes = new Map();   // Ereignisname -> { bytes, count }
  const zaehle = (name, n) => {
    const e = netBytes.get(name) || { bytes: 0, count: 0 };
    e.bytes += n; e.count++;
    netBytes.set(name, e);
  };
  try {
    io.engine.on('connection', (raw) => {
      const _write = raw.write?.bind(raw);
      if (!_write) return;
      raw.write = function (data, opts, cb) {
        try {
          const laenge = typeof data === 'string'
            ? Buffer.byteLength(data)
            : (data?.length || 0);
          // Socket.IO-Rahmen: `42["ereignis",…]` bzw. `42/ns,["…"]`.
          let name = 'sonstiges';
          if (typeof data === 'string') {
            const m = data.match(/^\d+(?:\/[^,]*,)?\["([^"]{1,64})"/);
            if (m) name = m[1];
            else if (/^\d+$/.test(data.slice(0, 2))) name = 'protokoll';
          }
          zaehle(name, laenge);
        } catch { /* Messung darf nie stoeren */ }
        return _write(data, opts, cb);
      };
    });
    setInterval(() => {
      if (netBytes.size === 0) return;
      const top = [...netBytes.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 10);
      const gesamt = [...netBytes.values()].reduce((s, e) => s + e.bytes, 0);
      console.log(`[netstats] ${(gesamt / 1048576).toFixed(2)} MB seit Start — Top:`);
      for (const [name, e] of top) {
        console.log(`  ${(e.bytes / 1048576).toFixed(2).padStart(8)} MB  ${String(e.count).padStart(7)}x  ${name}`);
      }
    }, 60000).unref?.();
  } catch (e) {
    console.error('[netstats] konnte nicht angehaengt werden:', e.message);
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ───────────────────────────────────────────────────────────────
//  Front-end build (public/*.jsx → public/dist/*.js)
//  Compile once at startup so dist is always present/fresh, then
//  watch in dev so the edit-and-refresh loop still works. In
//  production set PP_NO_WATCH=1 (the build step having already run).
// ───────────────────────────────────────────────────────────────
try {
  const { buildAll, watch } = require('./scripts/build');
  buildAll();
  if (!process.env.PP_NO_WATCH && process.env.NODE_ENV !== 'production') watch();
} catch (e) {
  console.error('[build] front-end build failed:', e.message);
}

// ───────────────────────────────────────────────────────────────
//  QUELLTEXT-RIEGEL fuer /cards/effects (17.8.)
//
//  `/cards` ist als Ordner statisch eingehaengt, damit die ~730
//  Kartenbilder ausgeliefert werden. Darin liegt aber auch
//  `cards/effects/` — 858 Dateien Spiellogik. Ueber /cards/effects/
//  war damit der komplette Quelltext oeffentlich abrufbar, inklusive
//  `_engine.js` (1,4 MB) und `_cpu.js` (0,65 MB), und wegen
//  `maxAge: '7d'` auch noch mit langer Cache-Zusage. Bei einem
//  Bandbreitenkontingent ist das doppelt unschoen.
//
//  ZWEI Schichten liefern dort aus, und BEIDE sitzen weiter unten:
//  die gzip-Schicht (GZIP_ROOTS enthaelt '/cards/', GZIP_MIME
//  enthaelt '.js') und danach express.static. Der Riegel steht
//  deshalb HIER, vor beiden.
//
//  Geprueft wird der AUFGELOESTE Pfad, nicht das Praefix: die
//  gzip-Schicht normalisiert `..` selbst und laesst
//  `/cards/x/../effects/_engine.js` durch ihre Traversal-Pruefung
//  (das Ergebnis liegt ja unter cards/). Ein reiner
//  startsWith-Test waere damit umgehbar gewesen.
//
//  Kartenkunst ist NICHT betroffen: `/api/cards/available` listet
//  nur Bilddateien der obersten Ebene, `effects` ist ein Ordner und
//  faellt durch den Extension-Filter. `/cards/skins/` bleibt frei.
// ───────────────────────────────────────────────────────────────
const CARDS_DIR = path.join(__dirname, 'cards');
const CARD_EFFECTS_DIR = path.join(CARDS_DIR, 'effects');

function zeigtAufKarteneffekte(reqPath) {
  if (!reqPath.startsWith('/cards/')) return false;
  let rel;
  try { rel = decodeURIComponent(reqPath.slice('/cards/'.length)); }
  catch { return true; } // kaputte Prozentkodierung — im Zweifel sperren
  const abs = path.resolve(CARDS_DIR, rel).toLowerCase();
  const eff = CARD_EFFECTS_DIR.toLowerCase();
  // Segmentgrenze beachten: ein kuenftiges cards/effectsfoo/ waere frei.
  return abs === eff || abs.startsWith(eff + path.sep);
}

app.use((req, res, next) => {
  if (!zeigtAufKarteneffekte(req.path)) return next();
  // 404 statt 403 — die Existenz muss nicht bestaetigt werden.
  res.status(404).type('text/plain').send('Not Found');
});

// ───────────────────────────────────────────────────────────────
//  On-the-fly gzip for compressible static assets (zero-dep).
//  Compresses .js/.json/.css/.svg/.map from public, /data and
//  /cards. Results are cached in memory keyed by file mtime, so
//  editing cards.json (etc.) is picked up on the next request.
//  Conditional requests (If-Modified-Since) still yield 304s, so
//  repeat visits are not regressed vs express.static.
//  `/cards/effects/` ist durch den Riegel darueber ausgenommen.
// ───────────────────────────────────────────────────────────────
const GZIP_ROOTS = [
  ['/data/', path.join(__dirname, 'data')],
  ['/cards/', path.join(__dirname, 'cards')],
  ['/', path.join(__dirname, 'public')],
];
const GZIP_MIME = {
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.svg': 'image/svg+xml; charset=UTF-8',
  '.map': 'application/json; charset=UTF-8',
};
const _gzCache = new Map(); // absPath -> { mtimeMs, buf }

// ───────────────────────────────────────────────────────────────
//  gzip fuer DYNAMISCHE JSON-Antworten (12.8.)
//
//  Die Schicht darunter komprimiert nur Dateien auf der Platte. Die
//  58 `/api/...`-Endpunkte gehen an ihr vorbei und antworten roh —
//  Kartenlisten, Decks, Sammlung, Shop-Katalog, Bestenliste. JSON
//  komprimiert um 85-90 %.
//
//  Bewusst NUR `res.json` umhuellt, nicht `res.send`/`res.sendFile`:
//  bei `res.json` ist der Inhaltstyp eindeutig und der Koerper
//  vollstaendig, es gibt also keinen Stream, keinen Bereichsabruf und
//  keine Datei-ETags, die man kaputtmachen koennte. Alles andere
//  laeuft unveraendert weiter.
//
//  Sicherheitsnetze: nur mit `Accept-Encoding: gzip`, nur ab 1 KB
//  (darunter waere gzip groesser), nie wenn schon eine Codierung
//  gesetzt ist, nie bei HEAD/204/304 — und bei JEDEM Fehler faellt
//  der Aufruf auf das originale `res.json` zurueck.
// ───────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  const _json = res.json.bind(res);
  res.json = function (obj) {
    try {
      if (req.method === 'HEAD') return _json(obj);
      if (res.statusCode === 204 || res.statusCode === 304) return _json(obj);
      if (res.getHeader('Content-Encoding')) return _json(obj);
      const roh = Buffer.from(JSON.stringify(obj), 'utf8');
      if (roh.length < 1024) return _json(obj);
      const gz = zlib.gzipSync(roh, { level: 6 });
      if (gz.length >= roh.length) return _json(obj);   // nie vergroessern
      // ETag selbst rechnen und bedingte Anfragen bedienen. Express
      // vergibt fuer `res.json` normalerweise einen ETag; wuerde man
      // ihn hier ersatzlos fallen lassen, verloeren die gepollten
      // Endpunkte ihre 304-Antworten und schickten jedes Mal den
      // vollen Koerper — die Kompression haette an dieser Stelle
      // Bandbreite gekostet statt gespart. SCHWACHER ETag, weil sich
      // die Darstellung je nach Codierung unterscheidet.
      const etag = 'W/"' + roh.length.toString(16) + '-'
        + crypto.createHash('sha1').update(roh).digest('base64').slice(0, 27) + '"';
      res.setHeader('ETag', etag);
      res.setHeader('Vary', 'Accept-Encoding');
      const inm = req.headers['if-none-match'];
      if (inm && inm.split(',').some(v => v.trim() === etag)) {
        res.statusCode = 304;
        res.removeHeader('Content-Length');
        return res.end();
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', gz.length);
      return res.end(gz);
    } catch {
      return _json(obj);
    }
  };
  next();
});

app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const ext = path.extname(req.path).toLowerCase();
  if (!GZIP_MIME[ext]) return next();
  if (!/\bgzip\b/.test(req.headers['accept-encoding'] || '')) return next();
  // Resolve the URL against the static roots, guarding traversal.
  let abs = null;
  for (const [mount, dir] of GZIP_ROOTS) {
    if (!req.path.startsWith(mount)) continue;
    const rel = decodeURIComponent(req.path.slice(mount.length));
    const candidate = path.join(dir, rel);
    if (!candidate.startsWith(dir + path.sep)) continue; // path traversal guard
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) { abs = candidate; break; }
  }
  if (!abs) return next();
  const stat = fs.statSync(abs);
  const lastMod = new Date(Math.floor(stat.mtimeMs / 1000) * 1000).toUTCString();
  res.setHeader('Vary', 'Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Last-Modified', lastMod);
  const ims = req.headers['if-modified-since'];
  if (ims && Date.parse(ims) >= Date.parse(lastMod)) { res.statusCode = 304; return res.end(); }
  let ent = _gzCache.get(abs);
  if (!ent || ent.mtimeMs !== stat.mtimeMs) {
    ent = { mtimeMs: stat.mtimeMs, buf: zlib.gzipSync(fs.readFileSync(abs), { level: 6 }) };
    _gzCache.set(abs, ent);
  }
  res.setHeader('Content-Type', GZIP_MIME[ext]);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', ent.buf.length);
  if (req.method === 'HEAD') return res.end();
  res.end(ent.buf);
});

// ───────────────────────────────────────────────────────────────
//  index.html with environment-aware social-share tags.
//  Crawlers (Discord/Twitter/…) don't run JS and need absolute
//  og:/twitter: URLs in the served HTML. index.html ships with the
//  production base hard-coded as a safe default; here we swap it for
//  the host that actually served the request, so link previews
//  resolve from both the live Render site and a local test build.
//  PUBLIC_BASE_URL overrides everything (e.g. a future custom domain).
//  Registered before express.static so it wins for "/" and
//  "/index.html"; the SPA catch-all reuses it too.
// ───────────────────────────────────────────────────────────────
const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');
const SHARE_BASE_DEFAULT = 'https://pixelparties.onrender.com';
let _indexCache = { mtimeMs: -1, html: '' };

function resolveOrigin(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : SHARE_BASE_DEFAULT;
}

function serveIndexHtml(req, res) {
  try {
    const stat = fs.statSync(INDEX_HTML_PATH);
    if (stat.mtimeMs !== _indexCache.mtimeMs) {
      _indexCache = { mtimeMs: stat.mtimeMs, html: fs.readFileSync(INDEX_HTML_PATH, 'utf8') };
    }
    const origin = resolveOrigin(req);
    let html = (origin === SHARE_BASE_DEFAULT)
      ? _indexCache.html
      : _indexCache.html.split(SHARE_BASE_DEFAULT).join(origin);
    // Expose the public Google OAuth client id to the front-end. Empty string
    // when unset, which hides the "Sign in with Google" button client-side.
    html = html.split('__GOOGLE_CLIENT_ID__').join(process.env.GOOGLE_CLIENT_ID || '');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache');
    // 12.8.: index.html ging als einzige Seite ungepackt raus (die
    // gzip-Schicht greift nur fuer .js/.json/.css/.svg/.map). Sie wird
    // bei JEDEM Aufruf UND von jeder SPA-Route ausgeliefert.
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      try {
        const gz = zlib.gzipSync(Buffer.from(html, 'utf8'), { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', gz.length);
        return res.end(gz);
      } catch { /* faellt unten auf den ungepackten Weg zurueck */ }
    }
    return res.send(html);
  } catch (e) {
    return res.sendFile(INDEX_HTML_PATH);
  }
}
app.get(['/', '/index.html'], serveIndexHtml);

// ───────────────────────────────────────────────────────────────
//  SUCHMASCHINEN: robots.txt + sitemap.xml
//
//  Beide fehlten bis v485 — und weil der SPA-Auffangpfad ganz unten
//  (`app.get('*')`) JEDEN Pfad mit der index.html beantwortet, kam
//  auf `/robots.txt` bisher HTML mit Status 200 zurueck statt einer
//  Robots-Datei. Googles Crawler behandelt Unlesbares zwar als
//  „alles erlaubt", aber eine HTML-Seite unter /robots.txt ist ein
//  Fehlsignal, und /sitemap.xml war gar nicht erst zu finden.
//
//  Beide Routen stehen VOR `express.static`, damit sie auch dann
//  gewinnen, wenn spaeter einmal eine gleichnamige Datei in
//  `public/` landet — und sie bauen ihre URLs aus `resolveOrigin`,
//  genau wie die Share-Vorschau. Damit stimmt der Host automatisch,
//  egal ob die Seite unter der eigenen Domain oder unter der
//  Render-Adresse ausgeliefert wird.
//
//  Die Sitemap fuehrt heute genau EINEN Eintrag, weil die App genau
//  eine URL hat („/"). Das ist kein Versehen: Client-Routen gibt es
//  nicht (kein pushState im ganzen Frontend). Kommen oeffentliche
//  Seiten dazu (Kartenliste, Regeln), gehoeren sie hier hinein.
// ───────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  const origin = resolveOrigin(req);
  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send([
    'User-agent: *',
    'Allow: /',
    // Nichts von Wert fuer den Index, aber viel Crawl-Budget:
    // Kartenkunst und Klaenge sind ~800 Dateien.
    'Disallow: /api/',
    'Disallow: /sounds/',
    'Disallow: /music/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n'));
});

app.get('/sitemap.xml', (req, res) => {
  const origin = resolveOrigin(req);
  res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${origin}/</loc>`,
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n'));
});

// ── AUSGEHENDE BANDBREITE / AKTUALITAET (v350, angepasst v351) ──────
// Gemessen am 11.8.: `public/` ist 114 MB und der Sound-Vorlader holte
// ALLE 52 Effektklaenge (damals 16 MB WAV) bei jedem Seitenaufruf. Den
// Loewenanteil erledigt inzwischen die Umstellung auf OGG (0,73 MB).
//
// ALS VORGABE (bindend): geht ein Update live, soll es SOFORT fuer alle
// Spieler gelten — niemand darf stundenlang auf altem Stand sitzen.
// Deshalb ueberall `maxAge: 0`.
//
// Das ist billiger als es klingt: `max-age=0` heisst NICHT „jedes Mal
// neu laden", sondern „jedes Mal nachfragen". Express liefert ETag und
// Last-Modified, der Browser schickt eine bedingte Anfrage und bekommt
// bei unveraenderter Datei ein 304 ohne Inhalt — ein paar hundert Byte
// statt Megabyte. Geaendert wird nur, was sich wirklich geaendert hat,
// und zwar sofort.
//
// `/cards` behaelt bewusst seine 7 Tage: ~730 Kartenbilder, die sich so
// gut wie nie aendern, und dort waeren 730 bedingte Anfragen je
// Seitenaufruf der teurere Weg. Wer Kartenkunst tauscht, muss also bis
// zu 7 Tage einplanen — oder den Dateinamen aendern.
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0, etag: true }));
app.use('/data', express.static(path.join(__dirname, 'data')));
// Card art (~730 immutable-ish PNGs). A long cache lifetime means a full
// reload / re-login serves them straight from disk instead of re-fetching
// or revalidating ~730 files. Paired with the background preloader, art
// effectively never "loads in" after the first visit. (Card images are
// added far more often than existing ones change; if you do replace one
// in place, bump its filename or shorten this during that release.)
app.use('/cards', express.static(path.join(__dirname, 'cards'), { maxAge: '7d' }));

// Database initialization (async — called at startup)
async function initDatabase() {
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    elo INTEGER DEFAULT 1000,
    color TEXT DEFAULT '#00f0ff',
    avatar TEXT DEFAULT NULL,
    cardback TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    main_deck TEXT DEFAULT '[]',
    heroes TEXT DEFAULT '[{"hero":null,"ability1":null,"ability2":null},{"hero":null,"ability1":null,"ability2":null},{"hero":null,"ability1":null,"ability2":null}]',
    potion_deck TEXT DEFAULT '[]',
    side_deck TEXT DEFAULT '[]',
    is_default INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id)');

  // Safe column migrations
  try { await db.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch {}
  // In-game speech-bubble lines shown above the player's avatar on win/loss.
  try { await db.execute("ALTER TABLE users ADD COLUMN victory_msg TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN defeat_msg TEXT DEFAULT ''"); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN wins INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN losses INTEGER DEFAULT 0'); } catch {}
  try { await db.execute("ALTER TABLE decks ADD COLUMN cover_card TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE decks ADD COLUMN skins TEXT DEFAULT '{}'"); } catch {}
  // Cube Draft mode: a deck row with mode='cube' is a 512-card cube list
  // (single section, no heroes / potions / side). Default 'standard' keeps
  // every existing row unchanged.
  try { await db.execute("ALTER TABLE decks ADD COLUMN mode TEXT DEFAULT 'standard'"); } catch {}
  // Separate ELO bucket for Cube Draft tournaments. Constructed games
  // continue to use the original `elo` column; cube-draft tournament
  // results route to `elo_cube` so the two formats don't bleed into
  // each other's leaderboards.
  try { await db.execute("ALTER TABLE users ADD COLUMN elo_cube INTEGER DEFAULT 1000"); } catch {}
  // Drafted-deck metadata. JSON blob: { cubeName, draftedAt, roomId }.
  // Marks decks saved at the end of a Cube Draft run so the deck list
  // can group them under a "Drafted Decks" header. Standard decks
  // leave this NULL.
  try { await db.execute("ALTER TABLE decks ADD COLUMN cube_draft_meta TEXT DEFAULT NULL"); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN sc INTEGER DEFAULT 0'); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN board TEXT DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN hide_tutorial INTEGER DEFAULT 0"); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN play_animations INTEGER DEFAULT 1"); } catch {}
  // Ranked-games counter — incremented when a ranked SET (Bo1/Bo3/Bo5)
  // finishes. Used to filter the leaderboard to "actually competed"
  // players so fresh accounts at the default 1000 ELO don't pollute the
  // top of the list.
  try { await db.execute("ALTER TABLE users ADD COLUMN ranked_games INTEGER DEFAULT 0"); } catch {}
  // Tracks which sample deck (starter or structure) the user has pinned as
  // their default. Null when the default is a custom deck from `decks`.
  try { await db.execute("ALTER TABLE users ADD COLUMN default_sample_deck_id TEXT DEFAULT NULL"); } catch {}
  // Guest accounts: ephemeral, starter-decks-vs-CPU only, and purged on
  // logout / server start (see purgeGuest). Sie schalten seit 8.8. sehr
  // wohl neue Gegner frei — aber nur fuer die laufende Sitzung, weil das
  // Konto samt seiner unlock-Zeilen mit purgeGuest verschwindet.
  try { await db.execute("ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0"); } catch {}
  // Daily Challenge — 3 random Heroes the player must win with for SC bonuses.
  // Resets every 12:00 Europe/Berlin (CET/CEST) globally, or 24h after the
  // player's last `start`, whichever comes first.
  try { await db.execute("ALTER TABLE users ADD COLUMN daily_heroes TEXT DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN daily_start_ts INTEGER DEFAULT 0"); } catch {}
  // 0 = unclaimed, 10 or 20 = big bonus already paid out (subsequent
  // 2+/3 wins during the same challenge only pay 1 SC each).
  try { await db.execute("ALTER TABLE users ADD COLUMN daily_claimed_big INTEGER DEFAULT 0"); } catch {}
  // ── Email verification & password recovery ──
  // `email` is nullable & unique (case-insensitive) among non-null rows.
  // `email_verified` gates nothing for legacy accounts: existing rows
  // (which predate the email column, so email IS NULL) are grandfathered
  // to verified=1 once. New accounts only ever land in `users` AFTER they
  // verify (see pending_signups), so they arrive already verified.
  try { await db.execute("ALTER TABLE users ADD COLUMN email TEXT DEFAULT NULL"); } catch {}
  try { await db.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0"); } catch {}
  try { await db.execute("UPDATE users SET email_verified = 1 WHERE email IS NULL AND email_verified = 0"); } catch {}
  try { await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL"); } catch {}

  // Google sign-in: links a Google account's stable subject id ("sub") to a
  // local user. NULL for password-only accounts. Google-only accounts still
  // carry a random unusable password_hash so the NOT NULL column holds and
  // password login can never match.
  try { await db.execute("ALTER TABLE users ADD COLUMN google_id TEXT DEFAULT NULL"); } catch {}
  try { await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_id) WHERE google_id IS NOT NULL"); } catch {}

  // Holds a not-yet-verified registration. No `users` row exists until the
  // emailed code is confirmed, so unverified attempts never squat a
  // username and never leave orphan decks.
  // ── SITZUNGEN UEBERLEBEN EINEN NEUSTART (Als Befund 17.8.) ────────
  // `sessions` war eine reine In-Memory-Map. Der `pp_token`-Cookie hat
  // sieben Tage Laufzeit, die Gegenstelle im Server war aber nach jedem
  // Neustart weg — jeder Cookie und jede gemerkte Marke also sofort
  // ungueltig. Genau daran scheiterte der neue LOGIN-Knopf: Al startet
  // den Server bei jedem Paket neu.
  //
  // Die Zeilen werden beim Start EINMAL in die Map geladen, damit
  // `authMiddleware` synchron bleiben kann (sie wird an vielen Stellen
  // ohne await benutzt).
  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username TEXT,
    created_at INTEGER NOT NULL
  )`);

  // ── „ANGEMELDET BLEIBEN" UEBERLEBT DAS ABMELDEN (Als Vorgabe 17.8.) ─
  // Getrennt von `sessions`, und das ist der ganze Punkt: eine Sitzung
  // endet beim Abmelden, diese Marke NICHT. Al: „wenn ich mich danach
  // ausloge, soll der Button mich trotzdem sofort wieder in das alte
  // Profil reinladen."
  //
  // `user_id` ist TEXT — die IDs sind UUIDs (`1cd5b9c7-…`), keine
  // Zahlen. Die aeltere `sessions`-Tabelle deklariert INTEGER; dank
  // SQLite-Affinitaet liegt der Text trotzdem heil drin, aber richtig
  // ist es nicht, deshalb hier von vornherein TEXT.
  await db.execute(`CREATE TABLE IF NOT EXISTS remember_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT,
    created_at INTEGER NOT NULL
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS pending_signups (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    color TEXT,
    avatar TEXT,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  )`);

  // One-time codes for password reset and for grandfathered accounts
  // adding an email later. `purpose` is 'reset' | 'add_email'.
  await db.execute(`CREATE TABLE IF NOT EXISTS email_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email)');

  await db.execute(`CREATE TABLE IF NOT EXISTS hero_stats (
    user_id TEXT NOT NULL,
    hero_name TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, hero_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS game_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    hero1 TEXT,
    hero2 TEXT,
    hero3 TEXT,
    won INTEGER NOT NULL,
    opponent_id TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  await db.execute('CREATE INDEX IF NOT EXISTS idx_hero_stats_user ON hero_stats(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id)');

  // Per-opponent win/loss for singleplayer CPU battles. Keyed by the
  // deckId the player faced — sample decks (`sample-<filename>`) and
  // structure decks share this key space since both come from
  // loadSampleDecks().
  await db.execute(`CREATE TABLE IF NOT EXISTS npc_stats (
    user_id TEXT NOT NULL,
    opponent_deck_id TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, opponent_deck_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_npc_stats_user ON npc_stats(user_id)');

  // One-time migration: sample-deck IDs used to be array-index-based
  // (`sample-0`, `sample-1`, ...) which made every win/loss record shift
  // to a DIFFERENT deck whenever a new sample deck was added or the
  // alphabetical order of files changed. IDs are now filename-based
  // (`sample-Heal Burn`, ...). Drop the legacy numeric rows so users
  // don't carry forward mis-attributed stats — starting fresh is
  // better than seeing wins against decks you never played.
  try {
    await db.execute(`DELETE FROM npc_stats
      WHERE opponent_deck_id LIKE 'sample-%'
        AND opponent_deck_id GLOB 'sample-[0-9]*'`);
  } catch (err) {
    console.error('[npc_stats migration] failed:', err.message);
  }

  // Per-user unlocked CPU opponents. New accounts start with only a few
  // random opponents unlocked (see seedInitialOpponents); more unlock as
  // win milestones are hit (see endCpuBattle). The opponent gallery and the
  // structure-deck shop are both filtered to this set. `is_initial` flags
  // the starting opponents, whose FIRST win each grants a bonus unlock.
  await db.execute(`CREATE TABLE IF NOT EXISTS unlocked_opponents (
    user_id TEXT NOT NULL,
    opponent_deck_id TEXT NOT NULL,
    is_initial INTEGER DEFAULT 0,
    unlocked_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, opponent_deck_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_unlocked_opponents_user ON unlocked_opponents(user_id)');

  // Account-initialization flags. `opponents_initialized` marks that a
  // user's unlock set has been seeded; `opponents_regated` marks that the
  // account has been migrated to the starter-deck-only gating policy.
  try { await db.execute('ALTER TABLE users ADD COLUMN opponents_initialized INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE users ADD COLUMN opponents_regated INTEGER DEFAULT 0'); } catch {}

  // One-time re-gate: every account not yet migrated has its opponent
  // roster reset to just the starter-deck opponents (is_initial=1) and its
  // CPU win/loss records wiped, so the unlock progression starts clean for
  // everyone — preexisting accounts included. Runs once per account (the
  // flag flips to 1); new signups arrive already flagged, so a restart
  // never wipes their progress.
  try {
    const toRegate = await db.all('SELECT id FROM users WHERE opponents_regated = 0');
    if (toRegate.length) {
      const starterIds = loadSampleDecks().filter(d => !d.isStructure).map(d => d.id);
      for (const u of toRegate) {
        await db.run('DELETE FROM unlocked_opponents WHERE user_id = ?', [u.id]);
        for (const oid of starterIds) {
          await db.run(
            'INSERT OR IGNORE INTO unlocked_opponents (user_id, opponent_deck_id, is_initial) VALUES (?, ?, 1)',
            [u.id, oid]
          );
        }
        await db.run('DELETE FROM npc_stats WHERE user_id = ?', [u.id]);
      }
      await db.run('UPDATE users SET opponents_regated = 1, opponents_initialized = 1 WHERE opponents_regated = 0');
      console.log(`[unlock re-gate] reset ${toRegate.length} account(s) to starter-deck opponents + cleared CPU win/loss`);
    }
  } catch (err) {
    console.error('[unlock re-gate] failed:', err.message);
  }

  // Cardback storage table (replaces filesystem storage)
  await db.execute(`CREATE TABLE IF NOT EXISTS user_cardbacks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // SC reward log table
  await db.execute(`CREATE TABLE IF NOT EXISTS sc_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    opponent_id TEXT,
    opponent_ip TEXT,
    amount INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sc_log_user ON sc_log(user_id)');
  await db.execute('CREATE INDEX IF NOT EXISTS idx_sc_log_user_date ON sc_log(user_id, created_at)');

  // Shop purchases table
  await db.execute(`CREATE TABLE IF NOT EXISTS user_shop_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    purchased_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, item_type, item_id)
  )`);
  await db.execute('CREATE INDEX IF NOT EXISTS idx_shop_items_user ON user_shop_items(user_id)');

  // Puzzle completions table
  await db.execute(`CREATE TABLE IF NOT EXISTS puzzle_completions (
    user_id TEXT NOT NULL,
    puzzle_id TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, puzzle_id)
  )`);

  // ── KAMPAGNE (Story-Modus) ──
  // Ein Speicherstand je Spieler. Der Inhalt ist bewusst ein JSON-Blob:
  // die Kampagne wächst noch, und jedes neue Feld (Flags, Gegenstände,
  // Variablen) hier als Spalte nachzuziehen wäre reine Reibung. Der
  // Server prüft beim Schreiben nur Größe und Grundform.
  await db.execute(`CREATE TABLE IF NOT EXISTS campaign_progress (
    user_id TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  console.log('[DB] Tables initialized');
}

// ===== AUTH MIDDLEWARE =====

/** Pick a random standard avatar from public/avatars/, or null if none available. */
function getRandomDefaultAvatar() {
  try {
    const dir = path.join(__dirname, 'public', 'avatars');
    const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
    const files = fs.readdirSync(dir).filter(f => exts.has(path.extname(f).toLowerCase()));
    if (files.length === 0) return null;
    return '/avatars/' + encodeURIComponent(files[Math.floor(Math.random() * files.length)]);
  } catch { return null; }
}

/** Pick a random vivid hex color for a brand-new player. The schema's
 *  static `'#00f0ff'` default made every fresh account share the same
 *  cyan in lobby lists / chat / hero accents — this hand-tuned palette
 *  spreads new signups across distinguishable hues that all read
 *  cleanly on the dark UI. The user can still recolour from Profile. */
const DEFAULT_PLAYER_COLORS = [
  '#00f0ff', // cyan (legacy default — keep in the pool)
  '#ff5060', // crimson
  '#ffaa33', // amber
  '#ffd84d', // gold
  '#88ee44', // lime
  '#33dd99', // jade
  '#44aaff', // sky blue
  '#7766ff', // indigo
  '#bb66ff', // violet
  '#ff66cc', // pink
  '#ff7733', // orange
  '#66ddcc', // teal
];
function getRandomDefaultColor() {
  return DEFAULT_PLAYER_COLORS[Math.floor(Math.random() * DEFAULT_PLAYER_COLORS.length)];
}
// Simple token-based auth using cookies
const sessions = new Map(); // token -> { userId, username }

function authMiddleware(req, res, next) {
  const token = req.cookies?.pp_token || req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = sessions.get(token);
  req.authToken = token;
  next();
}

// ===== AUTH HELPERS (email verification & recovery) =====
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000;      // codes valid for 15 minutes
const MAX_CODE_ATTEMPTS = 6;             // wrong guesses before a code dies
const RESEND_COOLDOWN_MS = 30 * 1000;    // min gap between sends to one address
const SEND_WINDOW_MS = 60 * 60 * 1000;   // rolling window for the per-address cap
const MAX_SENDS_PER_WINDOW = 6;          // max emails per address per window

function genCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }
function hashCode(code) { return crypto.createHash('sha256').update(String(code)).digest('hex'); }
function normEmail(e) { return String(e || '').trim(); }

// In-memory send throttle (resets on restart — fine for abuse damping).
const _emailSends = new Map(); // lowercased email -> number[] (timestamps)
function emailSendStatus(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  const hits = (_emailSends.get(key) || []).filter(t => now - t < SEND_WINDOW_MS);
  _emailSends.set(key, hits);
  if (hits.length && now - hits[hits.length - 1] < RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfter: Math.ceil((RESEND_COOLDOWN_MS - (now - hits[hits.length - 1])) / 1000) };
  }
  if (hits.length >= MAX_SENDS_PER_WINDOW) return { ok: false, retryAfter: 0, capped: true };
  return { ok: true };
}
function recordEmailSend(email) {
  const key = email.toLowerCase();
  const hits = _emailSends.get(key) || [];
  hits.push(Date.now());
  _emailSends.set(key, hits);
}

function codeEmail(kind, code) {
  const intro = kind === 'reset'
    ? 'Use this code to reset your Pixel Parties password:'
    : kind === 'add_email'
      ? 'Use this code to confirm this email address for your Pixel Parties account:'
      : 'Welcome to Pixel Parties! Use this code to verify your email and finish creating your account:';
  const subject = kind === 'reset'
    ? 'Your Pixel Parties password reset code'
    : 'Your Pixel Parties verification code';
  const text = `${intro}\n\n    ${code}\n\nThis code expires in 15 minutes. If you didn't request it, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,Segoe UI,sans-serif;background:#0a0a12;color:#e0e0f0;padding:32px;border-radius:12px;max-width:440px;margin:auto">
    <div style="font-size:22px;font-weight:800;letter-spacing:4px;color:#00f0ff;text-transform:uppercase;margin-bottom:16px">Pixel Parties</div>
    <p style="color:#c0c0d8;line-height:1.5">${intro}</p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#00f0ff;background:#12121f;border:1px solid #252540;border-radius:10px;padding:18px;text-align:center;margin:20px 0">${code}</div>
    <p style="color:#8888aa;font-size:13px">This code expires in 15 minutes. If you didn't request it, you can safely ignore this email.</p>
  </div>`;
  return { subject, text, html };
}

// Issue + email a code. Returns { ok } or { ok:false, error, status }.
// `purpose`: 'reset' | 'add_email' (stored in email_codes against a user);
// signup uses pending_signups directly and calls sendMail itself.
async function issueAndSendCode({ userId, email, purpose }) {
  const status = emailSendStatus(email);
  if (!status.ok) {
    return status.capped
      ? { ok: false, status: 429, error: 'Too many emails requested. Please try again later.' }
      : { ok: false, status: 429, error: `Please wait ${status.retryAfter}s before requesting another code.` };
  }
  const code = genCode();
  await db.run('DELETE FROM email_codes WHERE email = ? COLLATE NOCASE AND purpose = ?', [email, purpose]);
  await db.run(
    'INSERT INTO email_codes (id, user_id, email, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), userId || null, email, hashCode(code), purpose, Date.now() + CODE_TTL_MS],
  );
  const { subject, text, html } = codeEmail(purpose, code);
  try {
    await sendMail({ to: email, subject, text, html });
  } catch (e) {
    console.error('[mailer] send failed:', e.message);
    return { ok: false, status: 502, error: 'Could not send the email. Please try again later.' };
  }
  recordEmailSend(email);
  return { ok: true };
}

// Validate a code from email_codes. On success deletes it and returns the row.
async function consumeEmailCode({ email, purpose, code }) {
  const row = await db.get(
    'SELECT * FROM email_codes WHERE email = ? COLLATE NOCASE AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [email, purpose],
  );
  if (!row) return { ok: false, error: 'No code was requested for this email. Please request a new one.' };
  if (Date.now() > row.expires_at) {
    await db.run('DELETE FROM email_codes WHERE id = ?', [row.id]);
    return { ok: false, error: 'That code has expired. Please request a new one.' };
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    await db.run('DELETE FROM email_codes WHERE id = ?', [row.id]);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }
  if (hashCode(code) !== row.code_hash) {
    await db.run('UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return { ok: false, error: 'Incorrect code.' };
  }
  await db.run('DELETE FROM email_codes WHERE id = ?', [row.id]);
  return { ok: true, row };
}

// ───────────────────────────────────────────────────────────────
//  COOKIE-ATTRIBUTE (15.8.)
//  `secure` haengt an COOKIE_SECURE und NICHT an einer Auto-Erkennung
//  ueber req.secure: die schlaegt bei falsch gesetztem `trust proxy`
//  still ins Gegenteil um, und der Fehlerfall waere "niemand kann sich
//  mehr anmelden", ohne dass irgendwo etwas im Log steht. In der
//  systemd-Unit steht COOKIE_SECURE=1; lokal ueber http bleibt es aus,
//  weil der Browser ein secure-Cookie ueber http kommentarlos verwirft.
//
//  sameSite: 'lax' ist die richtige Stufe — 'strict' wuerde bedeuten,
//  dass ein Klick auf einen geteilten Duell-Link von Discord aus als
//  abgemeldet ankommt.
//
//  WICHTIG: clearCookie unten MUSS dieselben Attribute mitgeben, sonst
//  findet der Browser das Cookie nicht wieder und Abmelden tut nichts.
// ───────────────────────────────────────────────────────────────
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.COOKIE_SECURE === '1',
  path: '/',
};

async function startSession(res, user) {
  const token = uuidv4();
  sessions.set(token, { userId: user.id, username: user.username });
  // ── SCHREIBEN MIT AWAIT UND LAUTEM FEHLER (17.8.) ─────────────────
  // Erster Wurf: `.catch(() => {})` ohne await. Das war doppelt falsch.
  // Al meldete `[auth] 0 Sitzung(en) wiederhergestellt` — die Tabelle
  // blieb leer, und WARUM war nicht zu sehen, weil ich den Fehler selbst
  // verschluckt hatte. Ein stiller `catch` an einer gerade erst neu
  // gebauten Stelle kostet genau die Information, die man braucht.
  //
  // Jetzt: await (die Zeile steht, BEVOR die Antwort rausgeht) und der
  // echte Fehlertext in der Konsole. Die Anmeldung scheitert trotzdem
  // nicht daran — sie laeuft ueber die Map weiter.
  try {
    await db.run(
      'INSERT OR REPLACE INTO sessions (token, user_id, username, created_at) VALUES (?, ?, ?, ?)',
      [token, user.id, user.username ?? null, Date.now()],
    );
    console.log(`[auth] Sitzung gespeichert (${user.username || 'ohne Namen'}, id ${user.id})`);
  } catch (err) {
    console.error('[auth] ★ Sitzung konnte NICHT gespeichert werden:', err?.message || err);
    console.error('[auth]   → Schnellanmeldung nach einem Neustart wird nicht funktionieren.');
  }
  res.cookie('pp_token', token, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  // Merk-Marke fuer die Schnellanmeldung. Eigenes Cookie mit langer
  // Laufzeit, das das Abmelden BEWUSST stehen laesst — sonst waere der
  // Knopf nach jedem Logout wieder tot (genau der gemeldete Fall).
  // Gaeste bekommen keine: ihr Konto wird beim Abmelden geloescht.
  if (!user.is_guest) {
    try {
      const merk = uuidv4();
      await db.run(
        'INSERT OR REPLACE INTO remember_tokens (token, user_id, username, created_at) VALUES (?, ?, ?, ?)',
        [merk, user.id, user.username ?? null, Date.now()],
      );
      res.cookie('pp_remember', merk, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
      console.log(`[auth] Merk-Marke gesetzt (${user.username || 'ohne Namen'})`);
    } catch (err) {
      console.error('[auth] ★ Merk-Marke konnte nicht gespeichert werden:', err?.message || err);
    }
  }
  return token;
}

/** Sitzungen aus der Datenbank in die Map holen; abgelaufene wegwerfen. */
async function restoreSessions() {
  const maxAlter = Date.now() - 7 * 24 * 60 * 60 * 1000;   // wie der Cookie
  try {
    const roh = await db.get('SELECT COUNT(*) AS n FROM sessions');
    const abgelaufen = await db.run('DELETE FROM sessions WHERE created_at < ?', [maxAlter]);
    // Waisen (geloeschte Konten, geraeumte Gaeste) fallen hier heraus
    // UND aus der Tabelle — sonst antwortet /auth/me mit „User not found".
    await db.run('DELETE FROM sessions WHERE user_id NOT IN (SELECT id FROM users)');
    const zeilen = await db.all(
      'SELECT s.token AS token, s.user_id AS user_id, s.username AS username '
      + 'FROM sessions s JOIN users u ON u.id = s.user_id');
    for (const z of (zeilen || [])) {
      sessions.set(z.token, { userId: z.user_id, username: z.username });
    }
    // Rohbestand mitmelden: „0 wiederhergestellt" allein sagt nicht, ob
    // nie etwas geschrieben wurde oder ob die Bereinigung alles wegnahm.
    console.log(`[auth] ${(zeilen || []).length} Sitzung(en) wiederhergestellt `
      + `(Tabelle enthielt ${roh?.n ?? '?'}, davon ${abgelaufen?.rowsAffected ?? 0} abgelaufen)`);
  } catch (err) {
    console.error('[auth] Sitzungen konnten nicht geladen werden:', err.message);
  }
}

// Finish setting up a freshly-created `users` row: give them a first deck, pin
// a (non-structure) Starter Deck as their default so they can play immediately,
// and unlock the starting CPU roster. Shared by email signup (/verify-email)
// and Google signup (/auth/google) so both paths produce identical accounts.
async function bootstrapNewAccount(userId, { starterDeckId } = {}) {
  await db.run('INSERT INTO decks (id, user_id, name) VALUES (?, ?, ?)', [uuidv4(), userId, 'My First Deck']);
  try {
    const starters = loadSampleDecks().filter(s => !s.isStructure);
    if (starters.length > 0) {
      const pick = (starterDeckId && starters.find(s => s.id === starterDeckId))
        || starters[Math.floor(Math.random() * starters.length)];
      await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [pick.id, userId]);
    }
  } catch (err) { console.error('[bootstrap] starter-deck pin failed:', err.message); }
  try { await seedInitialOpponents(userId); } catch (err) { console.error('[bootstrap] seedInitialOpponents failed:', err.message); }
}

// Verify a Google ID token (the `credential` from Google Identity Services).
// Dependency-free: hits Google's tokeninfo endpoint over HTTPS, then checks the
// audience (our client id) and issuer. Resolves with the token payload.
//
// Two audiences are accepted: the web client id (GIS browser flow) and the
// desktop client id (the Electron PKCE flow exchanges its own code, so its
// id_token carries the desktop client id as `aud`).
function verifyGoogleIdToken(credential) {
  return new Promise((resolve, reject) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const desktopClientId = process.env.GOOGLE_DESKTOP_CLIENT_ID || '';
    if (!clientId) return reject(new Error('GOOGLE_CLIENT_ID not configured'));
    const allowedAud = [clientId, desktopClientId].filter(Boolean);
    if (!credential) return reject(new Error('missing credential'));
    const req = https.request({
      method: 'GET',
      hostname: 'oauth2.googleapis.com',
      path: '/tokeninfo?id_token=' + encodeURIComponent(credential),
      timeout: 10000,
    }, r => {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', d => { body += d; });
      r.on('end', () => {
        if (r.statusCode !== 200) return reject(new Error(`tokeninfo ${r.statusCode}: ${body.trim()}`));
        let p;
        try { p = JSON.parse(body); } catch { return reject(new Error('bad tokeninfo response')); }
        if (!allowedAud.includes(p.aud)) return reject(new Error('token audience mismatch'));
        const iss = p.iss || '';
        if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
          return reject(new Error('bad token issuer'));
        }
        resolve(p);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('tokeninfo timeout')));
    req.end();
  });
}

// Derive a unique, valid username from a Google display name / email local-part.
async function uniqueUsernameFrom(raw) {
  let base = String(raw || '').replace(/[^A-Za-z0-9 _-]/g, '').trim().replace(/\s+/g, ' ').slice(0, 16).trim();
  if (base.length < 3 || containsProfanity(base)) base = 'Player';
  let name = base;
  let n = 0;
  // username is UNIQUE COLLATE NOCASE — append an incrementing suffix on clash.
  while (await db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', [name])) {
    n++;
    name = (base + n).slice(0, 20);
  }
  return name;
}

// ===== AUTH ROUTES =====
// Step 1 of registration: validate, stash a pending signup, email a code.
// The real `users` row is only created on /verify-email.
app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body;
  const email = normEmail(req.body.email);
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (username.trim().length < 3) return res.status(400).json({ error: 'Username must be 3+ characters' });
  if (username.trim().length > 10) return res.status(400).json({ error: 'Username must be 10 characters or fewer' });
  if (password.length < 3) return res.status(400).json({ error: 'Password must be 3+ characters' });

  const uname = username.trim();
  if (await db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', [uname])) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  if (await db.get('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE', [email])) {
    return res.status(409).json({ error: 'That email is already registered. Try logging in or resetting your password.' });
  }

  const status = emailSendStatus(email);
  if (!status.ok) {
    return res.status(429).json({
      error: status.capped
        ? 'Too many emails requested. Please try again later.'
        : `Please wait ${status.retryAfter}s before requesting another code.`,
    });
  }

  const code = genCode();
  // One pending registration per username/email — replace any prior attempt.
  await db.run('DELETE FROM pending_signups WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE', [uname, email]);
  await db.run(
    'INSERT INTO pending_signups (id, username, email, password_hash, color, avatar, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [uuidv4(), uname, email, bcrypt.hashSync(password, 10), getRandomDefaultColor(), getRandomDefaultAvatar(), hashCode(code), Date.now() + CODE_TTL_MS],
  );
  const { subject, text, html } = codeEmail('signup', code);
  try {
    await sendMail({ to: email, subject, text, html });
  } catch (e) {
    console.error('[mailer] signup send failed:', e.message);
    return res.status(502).json({ error: 'Could not send the verification email. Please try again later.' });
  }
  recordEmailSend(email);
  res.json({ needsVerification: true, email, username: uname });
});

// Step 2 of registration: confirm the code, create the real account, log in.
app.post('/api/auth/verify-email', async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

  const pending = await db.get('SELECT * FROM pending_signups WHERE email = ? COLLATE NOCASE', [email]);
  if (!pending) return res.status(400).json({ error: 'No pending registration for this email. Please sign up again.' });
  if (Date.now() > pending.expires_at) {
    await db.run('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
    return res.status(400).json({ error: 'That code has expired. Please sign up again.' });
  }
  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    await db.run('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
    return res.status(400).json({ error: 'Too many incorrect attempts. Please sign up again.' });
  }
  if (hashCode(code) !== pending.code_hash) {
    await db.run('UPDATE pending_signups SET attempts = attempts + 1 WHERE id = ?', [pending.id]);
    return res.status(400).json({ error: 'Incorrect code.' });
  }

  // Re-check uniqueness in case someone grabbed the name/email meanwhile.
  if (await db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', [pending.username])) {
    await db.run('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
    return res.status(409).json({ error: 'Username already taken. Please sign up again.' });
  }
  if (await db.get('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE', [pending.email])) {
    await db.run('DELETE FROM pending_signups WHERE id = ?', [pending.id]);
    return res.status(409).json({ error: 'That email is already registered.' });
  }

  const id = uuidv4();
  await db.run(
    'INSERT INTO users (id, username, password_hash, avatar, color, email, email_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [id, pending.username, pending.password_hash, pending.avatar, pending.color, pending.email],
  );
  // Give the new account a first deck, a pinned Starter Deck (honouring a
  // specific one if a registering guest passed theirs), and the CPU roster.
  await bootstrapNewAccount(id, { starterDeckId: req.body.starterDeckId });
  await db.run('DELETE FROM pending_signups WHERE id = ?', [pending.id]);

  const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  const token = await startSession(res, user);
  res.json({ token, user: sanitizeUser(user), isNewAccount: true });
});

// Resend the signup verification code for a pending registration.
app.post('/api/auth/resend', async (req, res) => {
  const email = normEmail(req.body.email);
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const pending = await db.get('SELECT * FROM pending_signups WHERE email = ? COLLATE NOCASE', [email]);
  // Don't reveal whether a pending registration exists.
  if (!pending) return res.json({ ok: true });
  const status = emailSendStatus(email);
  if (!status.ok) {
    return res.status(429).json({
      error: status.capped
        ? 'Too many emails requested. Please try again later.'
        : `Please wait ${status.retryAfter}s before requesting another code.`,
    });
  }
  const code = genCode();
  await db.run('UPDATE pending_signups SET code_hash = ?, expires_at = ?, attempts = 0 WHERE id = ?',
    [hashCode(code), Date.now() + CODE_TTL_MS, pending.id]);
  const { subject, text, html } = codeEmail('signup', code);
  try { await sendMail({ to: email, subject, text, html }); }
  catch (e) { console.error('[mailer] resend failed:', e.message); return res.status(502).json({ error: 'Could not send the email. Please try again later.' }); }
  recordEmailSend(email);
  res.json({ ok: true });
});

// Forgot password — always responds ok (no account enumeration).
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = normEmail(req.body.email);
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  const user = await db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1', [email]);
  if (user) {
    const r = await issueAndSendCode({ userId: user.id, email, purpose: 'reset' });
    // Swallow rate-limit/send errors into the generic response except the
    // cooldown hint, which is safe and useful to surface.
    if (!r.ok && r.status === 429) return res.status(429).json({ error: r.error });
  }
  res.json({ ok: true });
});

// Reset password using the emailed code.
app.post('/api/auth/reset-password', async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  const newPassword = req.body.newPassword || '';
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  if (newPassword.length < 3) return res.status(400).json({ error: 'Password must be 3+ characters' });
  const result = await consumeEmailCode({ email, purpose: 'reset', code });
  if (!result.ok) return res.status(400).json({ error: result.error });
  const user = await db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE AND email_verified = 1', [email]);
  if (!user) return res.status(400).json({ error: 'No account found for this email.' });
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), user.id]);
  // Invalidate any live sessions for this account after a reset.
  for (const [tok, sess] of sessions) if (sess.userId === user.id) sessions.delete(tok);
  try { db.run('DELETE FROM sessions WHERE user_id = ?', [user.id]).catch(() => {}); } catch (_) {}
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  // Accept either a username or an email in `identifier` (legacy clients
  // send `username`).
  const identifier = String(req.body.identifier ?? req.body.username ?? '').trim();
  const { password } = req.body;
  if (!identifier || !password) return res.status(400).json({ error: 'Username/email and password required' });

  const looksEmail = identifier.includes('@');
  const user = looksEmail
    ? await db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [identifier])
    : await db.get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [identifier]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  const token = await startSession(res, user);
  // Assign a random default avatar if the user doesn't have one
  if (!user.avatar) {
    const defaultAvatar = getRandomDefaultAvatar();
    if (defaultAvatar) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [defaultAvatar, user.id]);
      user.avatar = defaultAvatar;
    }
  }
  res.json({ token, user: sanitizeUser(user) });
});

// Sign in / sign up with Google. The client sends the ID token ("credential")
// from Google Identity Services. We verify it, then: (1) log in an existing
// google-linked user; (2) else auto-link to an existing account with the same
// verified email; (3) else create a brand-new account. Google has already
// verified the email, so linking is safe and accounts land email_verified.
app.post('/api/auth/google', async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google sign-in is not configured.' });
  }
  let payload;
  try {
    payload = await verifyGoogleIdToken(String(req.body.credential || ''));
  } catch (e) {
    console.error('[auth/google] verify failed:', e.message);
    return res.status(401).json({ error: 'Google sign-in failed. Please try again.' });
  }

  const email = normEmail(payload.email);
  const googleId = String(payload.sub || '');
  if (!email || !googleId) return res.status(400).json({ error: 'Your Google account is missing an email address.' });
  // tokeninfo returns email_verified as the string "true"/"false".
  if (payload.email_verified === false || payload.email_verified === 'false') {
    return res.status(400).json({ error: 'Your Google email address is not verified.' });
  }

  let user = await db.get('SELECT * FROM users WHERE google_id = ?', [googleId]);
  let isNew = false;

  // (2) Auto-link to an existing account sharing this email.
  if (!user) {
    const byEmail = await db.get('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email]);
    if (byEmail) {
      await db.run('UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?', [googleId, byEmail.id]);
      user = await db.get('SELECT * FROM users WHERE id = ?', [byEmail.id]);
    }
  }

  // (3) Create a new account.
  if (!user) {
    const id = uuidv4();
    const username = await uniqueUsernameFrom(payload.name || (payload.given_name) || email.split('@')[0]);
    // Random unusable password so the NOT NULL column holds; password login
    // can never match it (the user authenticates via Google).
    const unusable = bcrypt.hashSync(uuidv4() + uuidv4(), 10);
    try {
      await db.run(
        'INSERT INTO users (id, username, password_hash, avatar, color, email, email_verified, google_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
        [id, username, unusable, getRandomDefaultAvatar(), getRandomDefaultColor(), email, googleId],
      );
    } catch (e) {
      console.error('[auth/google] create failed:', e.message);
      return res.status(500).json({ error: 'Could not create your account. Please try again.' });
    }
    await bootstrapNewAccount(id, {});
    user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    isNew = true;
  }

  if (!user.avatar) {
    const defaultAvatar = getRandomDefaultAvatar();
    if (defaultAvatar) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [defaultAvatar, user.id]);
      user.avatar = defaultAvatar;
    }
  }

  const token = await startSession(res, user);
  res.json({ token, user: sanitizeUser(user), isNewAccount: isNew });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.pp_token || req.headers['x-auth-token'];
  // If this was a guest session, tear the throwaway account + its data down.
  if (token && sessions.has(token)) {
    const sess = sessions.get(token);
    try { await purgeGuest(sess.userId); } catch (err) { console.error('[logout] purgeGuest failed:', err.message); }
  }
  if (token) sessions.delete(token);
  if (token) { try { db.run('DELETE FROM sessions WHERE token = ?', [token]).catch(() => {}); } catch (_) {} }
  res.clearCookie('pp_token', COOKIE_OPTS);
  // `pp_remember` bleibt ABSICHTLICH stehen — das ist der Unterschied
  // zwischen „abgemeldet" und „dieses Geraet vergisst mich". Wer das
  // Zweite will, nimmt „Forget this device" im Login-Bildschirm.
  res.json({ ok: true });
});

// Wer steckt hinter der Merk-Marke? Nur der Name, ohne Anmeldung —
// der Login-Bildschirm entscheidet damit, ob der Knopf aktiv ist.
app.get('/api/auth/remember', async (req, res) => {
  const merk = req.cookies?.pp_remember;
  if (!merk) return res.status(401).json({ error: 'no remembered device' });
  try {
    const row = await db.get(
      'SELECT r.user_id AS user_id, u.username AS username FROM remember_tokens r '
      + 'JOIN users u ON u.id = r.user_id WHERE r.token = ?', [merk]);
    if (!row) return res.status(401).json({ error: 'unknown token' });
    res.json({ username: row.username });
  } catch (err) {
    console.error('[auth/remember] Lesen fehlgeschlagen:', err.message);
    res.status(500).json({ error: 'lookup failed' });
  }
});

// Marke gegen eine frische Sitzung tauschen — das ist der Knopfdruck.
app.post('/api/auth/remember', async (req, res) => {
  const merk = req.cookies?.pp_remember;
  if (!merk) return res.status(401).json({ error: 'no remembered device' });
  try {
    const row = await db.get('SELECT user_id FROM remember_tokens WHERE token = ?', [merk]);
    if (!row) return res.status(401).json({ error: 'unknown token' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', [row.user_id]);
    if (!user) {
      await db.run('DELETE FROM remember_tokens WHERE token = ?', [merk]);
      res.clearCookie('pp_remember', COOKIE_OPTS);
      return res.status(401).json({ error: 'account gone' });
    }
    const token = await startSession(res, user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('[auth/remember] Anmeldung fehlgeschlagen:', err.message);
    res.status(500).json({ error: 'sign-in failed' });
  }
});

// „Dieses Geraet vergessen" — die Marke aktiv wegwerfen.
app.delete('/api/auth/remember', async (req, res) => {
  const merk = req.cookies?.pp_remember;
  if (merk) {
    try { await db.run('DELETE FROM remember_tokens WHERE token = ?', [merk]); } catch (_) {}
  }
  res.clearCookie('pp_remember', COOKIE_OPTS);
  res.json({ ok: true });
});

// Delete a guest account and all of its rows. No-op for real (non-guest)
// accounts — the `is_guest = 1` guard makes this safe to call with any id.
async function purgeGuest(userId) {
  if (!userId) return;
  const row = await db.get('SELECT is_guest FROM users WHERE id = ?', [userId]);
  if (!row || !row.is_guest) return;
  for (const t of ['decks', 'unlocked_opponents', 'npc_stats', 'user_shop_items']) {
    try { await db.run(`DELETE FROM ${t} WHERE user_id = ?`, [userId]); } catch {}
  }
  await db.run('DELETE FROM users WHERE id = ? AND is_guest = 1', [userId]);
}

// Sweep every guest account. Guest sessions live only in the in-memory
// `sessions` map, so any guest row still around at startup is orphaned —
// no one can ever log back into it. Called once on boot.
async function purgeAllGuests() {
  try {
    const guests = await db.all('SELECT id FROM users WHERE is_guest = 1');
    for (const g of guests) await purgeGuest(g.id);
    if (guests.length) console.log(`[guest cleanup] removed ${guests.length} stale guest account(s)`);
  } catch (err) { console.error('[guest cleanup] failed:', err.message); }
}

// Create a throwaway guest account: starter decks vs CPU only, seeded with
// just the starter-deck opponents and pinned to a random starter. Guests
// schalten Gegner nur sitzungsweit frei (siehe endCpuBattle + unlock-rules.js)
// und werden beim Abmelden weggeraeumt.
app.post('/api/auth/guest', async (req, res) => {
  try {
    const id = uuidv4();
    const username = 'Guest-' + id.slice(0, 8);
    const passwordHash = bcrypt.hashSync(uuidv4(), 10); // random; guests can't log in by password
    await db.run(
      // Fixed teal (the login-screen accent) so the guest UI doesn't flicker a
      // new random colour every session.
      'INSERT INTO users (id, username, password_hash, avatar, color, is_guest) VALUES (?, ?, ?, ?, ?, 1)',
      [id, username, passwordHash, getRandomDefaultAvatar(), '#00f0ff']
    );
    try { await seedInitialOpponents(id); } catch (err) { console.error('[guest] seedInitialOpponents failed:', err.message); }
    // Pin a random Starter Deck as the guest's default so a deck is preselected.
    try {
      const starters = loadSampleDecks().filter(s => !s.isStructure);
      if (starters.length > 0) {
        const pick = starters[Math.floor(Math.random() * starters.length)];
        await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [pick.id, id]);
      }
    } catch (err) { console.error('[guest] starter pin failed:', err.message); }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    const token = await startSession(res, user);
    res.json({ token, user: sanitizeUser(user), isGuest: true });
  } catch (err) {
    console.error('[guest] creation failed:', err.message);
    res.status(500).json({ error: 'Could not start a guest session' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  // Assign a random default avatar if the user doesn't have one
  if (!user.avatar) {
    const defaultAvatar = getRandomDefaultAvatar();
    if (defaultAvatar) {
      await db.run('UPDATE users SET avatar = ? WHERE id = ?', [defaultAvatar, user.id]);
      user.avatar = defaultAvatar;
    }
  }
  // Repair the user's default-deck pin if it's missing or illegal. Safe
  // to run on every session check (no-op when the existing default is
  // fine). Re-fetch the user row afterwards so `sanitizeUser` sees the
  // possibly-updated `default_sample_deck_id`.
  let userForResponse = user;
  try {
    await ensureValidDefaultDeck(user.id);
    userForResponse = await db.get('SELECT * FROM users WHERE id = ?', [user.id]) || user;
  } catch (err) {
    console.error('[auth/me] ensureValidDefaultDeck threw:', err.message);
  }
  res.json({ user: sanitizeUser(userForResponse), token: req.authToken });
});

function sanitizeUser(u) {
  return { id: u.id, username: u.username, elo: u.elo, eloCube: u.elo_cube == null ? 1000 : u.elo_cube, color: u.color, avatar: u.avatar, cardback: u.cardback, board: u.board || null, bio: u.bio || '', victoryMsg: u.victory_msg || '', defeatMsg: u.defeat_msg || '', wins: u.wins || 0, losses: u.losses || 0, sc: u.sc || 0, created_at: u.created_at, hide_tutorial: u.hide_tutorial || 0, play_animations: u.play_animations == null ? 1 : (u.play_animations ? 1 : 0), defaultSampleDeckId: u.default_sample_deck_id || null, email: u.email || null, emailVerified: !!u.email_verified, isGuest: !!u.is_guest };
}

// ===== PROFILE ROUTES =====
// Live username-availability check powering the profile name editor's
// green/red feedback. Mirrors the validation in PUT /api/profile so the two
// never disagree. The user's own current name reads as available (id != self).
app.get('/api/profile/check-username', authMiddleware, async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (name.length < 3) return res.json({ available: false, reason: 'Too short (3+ characters)' });
  if (name.length > 10) return res.json({ available: false, reason: 'Too long (max 10 characters)' });
  if (containsProfanity(name)) return res.json({ available: false, reason: 'Inappropriate language' });
  const taken = await db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id != ?', [name, req.user.userId]);
  res.json({ available: !taken, reason: taken ? 'Already taken' : 'Available' });
});

app.put('/api/profile', authMiddleware, async (req, res) => {
  const b = req.body || {};
  // Validate the in-game speech-bubble messages up front (length + a basic
  // profanity gate). Reject outright so nothing offensive is ever stored.
  for (const [key, label] of [['victoryMsg', 'Victory Message'], ['defeatMsg', 'Defeat Message']]) {
    if (b[key] === undefined) continue;
    const msg = String(b[key] || '');
    if (msg.length > MESSAGE_MAX_LEN) return res.status(400).json({ error: `${label} is too long (max ${MESSAGE_MAX_LEN} characters).` });
    if (containsProfanity(msg)) return res.status(400).json({ error: `${label}: please remove inappropriate language.` });
  }
  // Renaming: same rules as signup (3–20 chars), plus a profanity gate and a
  // case-insensitive uniqueness check that excludes the user's own row (so
  // re-saving your current name, or just a case change, is allowed).
  let newUsername;
  if (b.username !== undefined) {
    newUsername = String(b.username || '').trim();
    if (newUsername.length < 3) return res.status(400).json({ error: 'Username must be 3+ characters' });
    if (newUsername.length > 10) return res.status(400).json({ error: 'Username must be 10 characters or fewer' });
    if (containsProfanity(newUsername)) return res.status(400).json({ error: 'Username: please remove inappropriate language.' });
    if (await db.get('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id != ?', [newUsername, req.user.userId])) {
      return res.status(409).json({ error: 'Username already taken' });
    }
  }
  // Update only the fields the client actually sent, so single-field
  // quick-saves (avatar, sleeve, …) never clobber the others.
  const sets = [];
  const vals = [];
  if (b.username !== undefined)   { sets.push('username = ?');     vals.push(newUsername); }
  if (b.color !== undefined)      { sets.push('color = ?');       vals.push(b.color || '#00f0ff'); }
  if (b.avatar !== undefined)     { sets.push('avatar = ?');      vals.push(b.avatar || null); }
  if (b.cardback !== undefined)   { sets.push('cardback = ?');    vals.push(b.cardback || null); }
  if (b.bio !== undefined)        { sets.push('bio = ?');         vals.push((b.bio || '').slice(0, 200)); }
  if (b.board !== undefined)      { sets.push('board = ?');       vals.push(b.board || null); }
  if (b.victoryMsg !== undefined) { sets.push('victory_msg = ?'); vals.push(String(b.victoryMsg || '').slice(0, MESSAGE_MAX_LEN)); }
  if (b.defeatMsg !== undefined)  { sets.push('defeat_msg = ?');  vals.push(String(b.defeatMsg || '').slice(0, MESSAGE_MAX_LEN)); }
  if (sets.length) {
    vals.push(req.user.userId);
    await db.run('UPDATE users SET ' + sets.join(', ') + ' WHERE id = ?', vals);
  }
  // The username is cached in every active session for this user (set at
  // login). A rename must refresh those caches, otherwise sockets/games
  // created later in the same login keep showing the old name.
  if (b.username !== undefined) {
    for (const sess of sessions.values()) {
      if (sess.userId === req.user.userId) sess.username = newUsername;
    }
  }
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ user: sanitizeUser(user) });
});

// Toggle play_animations preference. When 0, the battle client skips
// every animation / transition / particle effect to keep the game
// snappy on low-power machines.
app.put('/api/profile/play-animations', authMiddleware, async (req, res) => {
  const play = req.body.play_animations ? 1 : 0;
  await db.run('UPDATE users SET play_animations = ? WHERE id = ?', [play, req.user.userId]);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ user: sanitizeUser(user) });
});

// Request an email-verification code for the logged-in account (used by
// grandfathered accounts adding an email, or anyone changing it).
app.post('/api/profile/email/request', authMiddleware, async (req, res) => {
  const email = normEmail(req.body.email);
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  const taken = await db.get('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?', [email, req.user.userId]);
  if (taken) return res.status(409).json({ error: 'That email is already in use by another account.' });
  const r = await issueAndSendCode({ userId: req.user.userId, email, purpose: 'add_email' });
  if (!r.ok) return res.status(r.status || 500).json({ error: r.error });
  res.json({ ok: true, email });
});

// Confirm the code and attach the verified email to the account.
app.post('/api/profile/email/confirm', authMiddleware, async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || '').trim();
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  const result = await consumeEmailCode({ email, purpose: 'add_email', code });
  if (!result.ok) return res.status(400).json({ error: result.error });
  // Guard the race on the unique-email index.
  const taken = await db.get('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?', [email, req.user.userId]);
  if (taken) return res.status(409).json({ error: 'That email is already in use by another account.' });
  await db.run('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?', [email, req.user.userId]);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, user: sanitizeUser(user) });
});

// Avatar upload — accepts base64 data URL in JSON body
app.post('/api/profile/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (!avatar || !avatar.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  // Limit ~2MB base64
  if (avatar.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 2MB)' });
  await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.user.userId]);
  res.json({ avatar });
});

// Cardback upload — accepts base64 data URL, stores in DB
app.post('/api/profile/cardback', authMiddleware, async (req, res) => {
  const { cardback } = req.body;
  if (!cardback || !cardback.startsWith('data:image/')) return res.status(400).json({ error: 'Invalid image data' });
  if (cardback.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 2MB)' });
  const id = uuidv4();
  const filename = req.user.userId + '_' + Date.now() + '.png';
  await db.run('INSERT INTO user_cardbacks (id, user_id, filename, data) VALUES (?, ?, ?, ?)', [id, req.user.userId, filename, cardback]);
  res.json({ cardback });
});

// List all cardbacks uploaded by this user (from DB)
app.get('/api/profile/cardbacks', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT data FROM user_cardbacks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  res.json({ cardbacks: rows.map(r => r.data) });
});

// ===== PROFILE EXPORT / IMPORT =====
function encryptProfile(data) {
  const key = crypto.scryptSync(PROFILE_SECRET, 'pixelparties', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  enc += cipher.final('base64');
  const tag = cipher.getAuthTag().toString('base64');
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag, data: enc });
}

function decryptProfile(blob) {
  try {
    const { v, iv, tag, data } = JSON.parse(blob);
    if (v !== 1) throw new Error('Unknown format version');
    const key = crypto.scryptSync(PROFILE_SECRET, 'pixelparties', 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    let dec = decipher.update(data, 'base64', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch (e) {
    return null;
  }
}

app.get('/api/profile/export', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Gather decks
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ?', [req.user.userId]);

  // Gather hero stats
  const heroStats = await db.all('SELECT * FROM hero_stats WHERE user_id = ?', [req.user.userId]);

  // Gather game history
  const gameHistory = await db.all('SELECT * FROM game_history WHERE user_id = ?', [req.user.userId]);

  // Avatar is stored as data URL in DB — just include it directly
  const avatarData = user.avatar || null;

  // Read cardback data from DB
  const cardbackRows = await db.all('SELECT filename, data FROM user_cardbacks WHERE user_id = ?', [req.user.userId]);
  const cardbackFiles = cardbackRows.map(r => ({ name: r.filename, data: r.data }));

  const payload = {
    username: user.username,
    elo: user.elo,
    eloCube: user.elo_cube == null ? 1000 : user.elo_cube,
    color: user.color,
    bio: user.bio || '',
    wins: user.wins || 0,
    losses: user.losses || 0,
    cardback: user.cardback,
    avatar: avatarData,
    cardbacks: cardbackFiles,
    decks: decks.map(d => ({ name: d.name, main_deck: d.main_deck, heroes: d.heroes, potion_deck: d.potion_deck, side_deck: d.side_deck, is_default: d.is_default })),
    heroStats,
    gameHistory: gameHistory.map(g => ({ hero1: g.hero1, hero2: g.hero2, hero3: g.hero3, won: g.won, opponent_id: g.opponent_id, created_at: g.created_at })),
    exportedAt: Date.now(),
  };

  const encrypted = encryptProfile(payload);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${user.username}_profile.ppb"`);
  res.send(encrypted);
});

app.post('/api/profile/import', authMiddleware, express.text({ limit: '20mb' }), async (req, res) => {
  if (profileImportUsed.has(req.user.userId)) {
    return res.status(403).json({ error: 'You cannot import your profile again until the next update!' });
  }

  const data = decryptProfile(req.body);
  if (!data) return res.status(400).json({ error: 'Invalid or corrupted backup file.' });

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Username must match (case-insensitive)
  if (data.username.toLowerCase() !== user.username.toLowerCase()) {
    return res.status(403).json({ error: `This backup belongs to "${data.username}", but you are "${user.username}". You can only import your own profile.` });
  }

  // Restore user fields
  await db.run('UPDATE users SET elo = ?, color = ?, bio = ?, wins = ?, losses = ?, cardback = ? WHERE id = ?',
    [data.elo || 1000, data.color || '#00f0ff', (data.bio || '').slice(0, 200), data.wins || 0, data.losses || 0, data.cardback || null, req.user.userId]);

  // Restore avatar (may be data URL or old-format base64 object)
  if (data.avatar) {
    let avatarUrl = data.avatar;
    if (typeof data.avatar === 'object' && data.avatar.data) {
      // Legacy format: convert base64 to data URL
      const ext = (data.avatar.ext || '.png').replace('.', '');
      avatarUrl = 'data:image/' + ext + ';base64,' + data.avatar.data;
    }
    await db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.userId]);
  }

  // Restore cardbacks to DB
  if (data.cardbacks && data.cardbacks.length) {
    await db.run('DELETE FROM user_cardbacks WHERE user_id = ?', [req.user.userId]);
    for (const cb of data.cardbacks) {
      const cbData = typeof cb.data === 'string' && cb.data.startsWith('data:') ? cb.data : 'data:image/png;base64,' + cb.data;
      await db.run('INSERT INTO user_cardbacks (id, user_id, filename, data) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, cb.name || 'cardback.png', cbData]);
    }
  }

  // Restore decks — delete existing, insert from backup
  await db.run('DELETE FROM decks WHERE user_id = ?', [req.user.userId]);
  for (const d of (data.decks || [])) {
    await db.run('INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user.userId, d.name, d.main_deck, d.heroes, d.potion_deck, d.side_deck, d.is_default ? 1 : 0, Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)]);
  }

  // Restore hero stats
  await db.run('DELETE FROM hero_stats WHERE user_id = ?', [req.user.userId]);
  for (const hs of (data.heroStats || [])) {
    await db.run('INSERT OR REPLACE INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?)',
      [req.user.userId, hs.hero_name, hs.wins || 0, hs.losses || 0]);
  }

  // Restore game history
  await db.run('DELETE FROM game_history WHERE user_id = ?', [req.user.userId]);
  for (const g of (data.gameHistory || [])) {
    await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), req.user.userId, g.hero1, g.hero2, g.hero3, g.won, g.opponent_id, g.created_at]);
  }

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  profileImportUsed.add(req.user.userId);
  res.json({ success: true, user: sanitizeUser(updated) });
});

// ===== CHANGE PASSWORD =====
app.post('/api/profile/password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both old and new password required' });
  if (newPassword.length < 3) return res.status(400).json({ error: 'New password must be 3+ characters' });
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ success: true });
});

// ===== PROFILE DECK STATS =====
app.get('/api/profile/deck-stats', authMiddleware, async (req, res) => {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  let legalCount = 0;
  const deckWall = decks.map(d => {
    const main = JSON.parse(d.main_deck || '[]');
    const heroes = JSON.parse(d.heroes || '[]').filter(h => h && h.hero);
    const potions = JSON.parse(d.potion_deck || '[]');
    const pc = potions.length;
    const mainOk = main.length === 60;
    const heroOk = heroes.length === 3;
    const potionOk = pc === 0 || (pc >= 5 && pc <= 15);
    const legal = mainOk && heroOk && potionOk;
    if (legal) legalCount++;
    // Use cover card if set, otherwise pick a random card
    const allCards = [...main, ...heroes.map(h => h.hero), ...potions];
    const repCard = d.cover_card || (allCards.length > 0 ? allCards[Math.floor(Math.random() * allCards.length)] : null);
    let deckSkins = {};
    try { deckSkins = JSON.parse(d.skins || '{}'); } catch {}
    const repSkin = repCard && deckSkins[repCard] ? deckSkins[repCard] : null;
    return { id: d.id, name: d.name, legal, isDefault: !!d.is_default, repCard, repSkin, cardCount: main.length };
  });
  res.json({ total: decks.length, legal: legalCount, decks: deckWall });
});

// ===== GAME RESULT RECORDING =====
// Called when a game ends — records win/loss for the player and their 3 heroes
app.post('/api/game/result', authMiddleware, async (req, res) => {
  const { won, heroes, opponentId } = req.body;
  if (typeof won !== 'boolean') return res.status(400).json({ error: 'won must be boolean' });
  if (!Array.isArray(heroes) || heroes.length !== 3) return res.status(400).json({ error: 'heroes must be array of 3 names' });

  const userId = req.user.userId;

  // Update user wins/losses
  if (won) {
    await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [userId]);
  } else {
    await db.run('UPDATE users SET losses = losses + 1 WHERE id = ?', [userId]);
  }

  // Update hero stats (aggregate)
  for (const heroName of heroes) {
    if (heroName) {
      await db.run('INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', [userId, heroName, won ? 1 : 0, won ? 0 : 1]);
    }
  }

  // Record in game history
  await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), userId, heroes[0] || null, heroes[1] || null, heroes[2] || null, won ? 1 : 0, opponentId || null]);

  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  res.json({ success: true, user: sanitizeUser(user) });
});

// ===== LEADERBOARD =====
// Returns up to the top 20 ranked players ordered by ELO. A player counts
// as "ranked" once they've finished at least one ranked set (Bo1/Bo3/Bo5)
// — fresh accounts sitting on the default 1000 ELO are filtered out so
// the board reflects actual competitive standing. Public endpoint: no
// auth required, since it appears on the multiplayer lobby screen
// before / regardless of whether the viewer is signed in. Backfill for
// pre-migration accounts: the column defaults to 0 for existing rows,
// so any account that played ranked before the migration won't appear
// until they finish another ranked set — acceptable trade-off vs the
// alternative of showing every default-1000 account.
app.get('/api/leaderboard', async (req, res) => {
  try {
    const rows = await db.all(
      'SELECT username, elo, color FROM users WHERE ranked_games > 0 ORDER BY elo DESC, username ASC LIMIT 20'
    );
    res.json({
      players: rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        elo: r.elo,
        color: r.color || '#00f0ff',
      })),
    });
  } catch (err) {
    console.error('[leaderboard] error:', err.message);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ===== HERO STATS =====
// Smoothing for the "top Heroes" ranking. We rank by a Bayesian-shrinkage
// score rather than raw win-rate so a Hero played once and won (100%) does
// not outrank a Hero with a strong record over many games. The score pulls
// low-sample Heroes toward a neutral 50% prior; PRIOR_GAMES is how many
// "phantom" .500 games each Hero is seeded with — the more real games a
// Hero has, the less the prior matters.
const HERO_RANK_PRIOR_GAMES = 5;
const HERO_RANK_PRIOR_RATE = 0.5;

app.get('/api/profile/hero-stats', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT hero_name, wins, losses FROM hero_stats WHERE user_id = ?', [req.user.userId]);
  // Bayesian-shrinkage score: (wins + prior) / (games + priorGames), then
  // break ties by total games so the more-played Hero wins a dead heat.
  const scored = rows.map(r => {
    const games = r.wins + r.losses;
    const score = (r.wins + HERO_RANK_PRIOR_GAMES * HERO_RANK_PRIOR_RATE) / (games + HERO_RANK_PRIOR_GAMES);
    return {
      name: r.hero_name,
      wins: r.wins,
      losses: r.losses,
      games,
      winRate: games > 0 ? Math.round((r.wins / games) * 100) : 0,
      score,
    };
  });
  scored.sort((a, b) => (b.score - a.score) || (b.games - a.games));
  // Drop the internal score from the payload — clients only show winRate.
  const top = scored.slice(0, 3).map(({ score, ...rest }) => rest);
  res.json({ heroes: top });
});

// ===== DAILY CHALLENGE =====
app.get('/api/daily', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT daily_heroes, daily_start_ts, daily_claimed_big FROM users WHERE id = ?', [req.user.userId]);
    const nowSec = Math.floor(Date.now() / 1000);
    const active = getActiveDaily(user, nowSec);
    const lastResetTs = mostRecentNoonCETSec(nowSec);
    const nextResetTs = nextNoonCETAfter(nowSec);
    res.json({
      active: !!active,
      available: !active, // button is highlighted when the player has no active challenge
      heroes: active ? active.heroes : [],
      startTs: active ? active.startTs : 0,
      expiresTs: active ? active.expiresTs : 0,
      claimedBig: active ? active.claimedBig : 0,
      lastResetTs,
      nextResetTs,
      nowTs: nowSec,
    });
  } catch (err) {
    console.error('[daily/get] error:', err.message);
    res.status(500).json({ error: 'Failed to load daily challenge' });
  }
});

app.post('/api/daily/start', authMiddleware, async (req, res) => {
  try {
    const user = await db.get('SELECT daily_heroes, daily_start_ts, daily_claimed_big FROM users WHERE id = ?', [req.user.userId]);
    const nowSec = Math.floor(Date.now() / 1000);
    if (getActiveDaily(user, nowSec)) {
      return res.status(409).json({ error: 'A daily challenge is already active' });
    }
    const heroes = rollDailyHeroes();
    if (heroes.length < 3) {
      return res.status(500).json({ error: 'Hero pool exhausted' });
    }
    await db.run(
      'UPDATE users SET daily_heroes = ?, daily_start_ts = ?, daily_claimed_big = 0 WHERE id = ?',
      [JSON.stringify(heroes), nowSec, req.user.userId]
    );
    const nextResetTs = nextNoonCETAfter(nowSec);
    res.json({
      active: true,
      available: false,
      heroes,
      startTs: nowSec,
      expiresTs: Math.min(nowSec + DAILY_CHALLENGE_DURATION_SEC, nextResetTs),
      claimedBig: 0,
      lastResetTs: mostRecentNoonCETSec(nowSec),
      nextResetTs,
      nowTs: nowSec,
    });
  } catch (err) {
    console.error('[daily/start] error:', err.message);
    res.status(500).json({ error: 'Failed to start daily challenge' });
  }
});

// ===== AVAILABLE CARDS (based on ./cards folder) =====
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

// Build reverse lookup: filename-safe name (no punctuation) → actual card name
const nameByStripped = {};
getCardArray().forEach(c => { nameByStripped[c.name.replace(/[^a-zA-Z0-9 ]/g, '')] = c.name; });

app.get('/api/cards/available', async (req, res) => {
  const cardsDir = path.join(__dirname, 'cards');
  try {
    const files = fs.readdirSync(cardsDir);
    // Map: actual card name (with commas) → filename for image URLs
    const available = {};
    files
      .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
      .forEach(f => {
        const stem = path.basename(f, path.extname(f));
        const stripped = stem.replace(/[^a-zA-Z0-9 ]/g, '');
        const realName = nameByStripped[stripped] || stem;
        available[realName] = f;
      });
    res.json({ available });
  } catch {
    res.json({ available: {} });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  KAMPAGNE (Story-Modus)
// ═══════════════════════════════════════════════════════════════════
// Sämtliche Inhalte der Kampagne liegen UNVERSCHLÜSSELT unter
// public/campaign/ und werden statisch ausgeliefert:
//   backgrounds/  16:9-Pixelart-Hintergründe (320x180)
//   sprites/      Ganzkörperfiguren
//   avatars/      Portraits für die Dialogbox
//   scenes/       Szenen- und Weltdateien (.js, vom Client ausgewertet)
//   decks/        Kampagnen-Decks im normalen Deck-Textformat
// Der Server steuert nur drei Dinge bei: das Verzeichnis-Verzeichnis
// (damit neue Dateien ohne Codeänderung auftauchen), den Speicherstand
// und die Kampagnen-Duelle (die dürfen NICHT vom Client kommen, sonst
// wäre das Deck frei wählbar).

const CAMPAIGN_DIR = path.join(__dirname, 'public', 'campaign');

// ── TESTSCHALTER (7.8., von Al ausdrücklich als vorläufig markiert) ──
// Solange hier eine Zahl steht, starten ALLE Helden des Kampagnen-
// Gegners mit dieser HP — Duelle sind damit in Sekunden durchgespielt,
// was das Prüfen von Story-Verzweigungen enorm beschleunigt.
// Auf `null` setzen, sobald die Kampagne echt gespielt werden soll.
const CAMPAIGN_TEST_ENEMY_HP = 1;
const CAMPAIGN_STATE_MAX = 512 * 1024;   // Schutz gegen aufgeblähte Speicherstände

function campaignList(sub, exts) {
  try {
    const dir = path.join(CAMPAIGN_DIR, sub);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => exts.has(path.extname(f).toLowerCase()))
      .sort();
  } catch { return []; }
}

/** Deck-Textformat -> Deck-Objekt. Bewusst eigenständig statt in
 *  loadSampleDecks() eingehängt: dieselbe Grammatik, aber ohne die
 *  Shop-/Freischalt-Logik der Beispiel-Decks, und ohne Risiko für den
 *  bestehenden Pfad. */
function parseCampaignDeckText(text, fallbackName) {
  const cardsByName = getCardDB();
  const lines = String(text).split(/\r?\n/);
  let deckName = fallbackName, coverCard = '', section = null;
  const heroNames = [], mainCards = [], potionCards = [], sideCards = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('===')) continue;
    if (line.startsWith('Name:'))  { deckName = line.slice(5).trim(); continue; }
    if (line.startsWith('Cover:')) { coverCard = line.slice(6).trim(); continue; }
    if (line === '== HEROES ==')      { section = 'heroes'; continue; }
    if (line === '== MAIN DECK ==')   { section = 'main';   continue; }
    if (line === '== POTION DECK ==') { section = 'potion'; continue; }
    if (line === '== SIDE DECK ==')   { section = 'side';   continue; }
    if (section === 'heroes') { heroNames.push(line === '(empty)' ? null : line); continue; }
    if (!section) continue;
    const m = line.match(/^(\d+)x\s+(.+)$/);
    if (!m) continue;
    const arr = section === 'main' ? mainCards : section === 'potion' ? potionCards : sideCards;
    for (let j = 0; j < parseInt(m[1], 10); j++) arr.push(m[2].trim());
  }
  const heroes = [0, 1, 2].map(i => {
    const name = heroNames[i] || null;
    if (!name) return { hero: null, ability1: null, ability2: null };
    const card = cardsByName[name];
    return { hero: name, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
  });
  return { name: deckName, coverCard, heroes, mainDeck: mainCards, potionDeck: potionCards, sideDeck: sideCards };
}

/** Lädt public/campaign/decks/<slug>.txt. Der Slug wird hart gefiltert,
 *  damit kein '../' aus dem Kampagnenordner herausführt. */
function loadCampaignDeck(slug) {
  const clean = String(slug || '').replace(/[^A-Za-z0-9 _-]/g, '');
  if (!clean) return null;
  const file = path.join(CAMPAIGN_DIR, 'decks', clean + '.txt');
  if (!file.startsWith(path.join(CAMPAIGN_DIR, 'decks'))) return null;
  if (!fs.existsSync(file)) return null;
  try { return parseCampaignDeckText(fs.readFileSync(file, 'utf-8'), clean); }
  catch (err) { console.error('[Campaign] Deck', clean, 'unlesbar:', err.message); return null; }
}

function campaignDeckLegal(deck) {
  if (!deck) return false;
  if ((deck.mainDeck || []).length !== 60) return false;
  if ((deck.heroes || []).filter(h => h && h.hero).length !== 3) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
//  ANTE (Kartensatz)
// ═══════════════════════════════════════════════════════════════════
// Ein Ante-Duell wird VOR dem Spiel vereinbart (die Szene handelt das
// aus). Danach nimmt sich der Sieger eine Karte aus dem Bestand des
// Verlierers — dauerhaft.
//
// Wählbar ist, was am Ende der Partie SICHTBAR war: alles auf dem
// Feld (Support-, Fähigkeits-, Überraschungs-, Flächenzonen,
// Permanents, Coolness-Stapel) plus Ablage und gelöschte Karten.
// NICHT die Hand und nicht das Restdeck — sonst wählte man blind.
// Ausnahme: wäre die Auswahl dadurch leer (sehr kurze Partie), steht
// das GESAMTE Deck zur Wahl, damit ein Ante nie ins Leere läuft.
//
// Immun sind die drei Starthelden und ihre Start-Fähigkeitskarten:
// ohne sie wäre das Deck nicht mehr spielbar, und der Verlust wäre
// kein Rückschlag, sondern ein Abbruch.

/** Sammelt Kartennamen aus beliebig verschachtelten Zonen. Die Zonen
 *  führen teils Namen (Strings), teils Objekte ({name, id}). */
function campaignCollectNames(value, out) {
  if (!value) return out;
  if (Array.isArray(value)) { for (const v of value) campaignCollectNames(v, out); return out; }
  if (typeof value === 'string') { if (value.trim()) out.add(value); return out; }
  if (typeof value === 'object' && (value.name || value.card)) out.add(value.name || value.card);
  return out;
}

function campaignAntePool(gs, loserIdx, deck) {
  const ps = (gs.players || [])[loserIdx] || {};
  const immune = new Set();
  for (const h of (deck.heroes || [])) {
    if (!h) continue;
    if (h.hero) immune.add(h.hero);
    if (h.ability1) immune.add(h.ability1);
    if (h.ability2) immune.add(h.ability2);
  }

  const seen = new Set();
  campaignCollectNames(ps.supportZones, seen);
  campaignCollectNames(ps.abilityZones, seen);
  campaignCollectNames(ps.surpriseZones, seen);
  campaignCollectNames(ps.permanents, seen);
  campaignCollectNames(ps.coolnessStack, seen);
  campaignCollectNames((gs.areaZones || [])[loserIdx], seen);
  campaignCollectNames(ps.discardPile, seen);
  campaignCollectNames(ps.deletedPile, seen);

  let pool = [...seen].filter(n => n && !immune.has(n));
  let fromDeck = false;
  if (!pool.length) {
    // Nichts sichtbar gewesen -> das komplette Deck wird wählbar.
    const all = new Set();
    campaignCollectNames(deck.mainDeck, all);
    campaignCollectNames(deck.potionDeck, all);
    pool = [...all].filter(n => n && !immune.has(n));
    fromDeck = true;
  }
  // Kopien zählen im Ante nur einmal.
  return { pool: pool.sort((a, b) => a.localeCompare(b)), immune: [...immune], fromDeck };
}

/** Wahl des Gegners. Fähigkeiten sind mit Abstand die häufigsten Karten
 *  im Pool (jede Heldenzone trägt welche bei) — ohne diese Regel nähme
 *  der Gegner fast immer eine Fähigkeit, was sich beliebig anfühlt.
 *  Deshalb: Fähigkeiten NUR, wenn es nichts anderes gibt. */
function campaignAnteCpuPick(pool) {
  if (!pool.length) return null;
  const db = getCardDB();
  const nonAbility = pool.filter(n => (db[n] && db[n].cardType) !== 'Ability');
  const from = nonAbility.length ? nonAbility : pool;
  return from[Math.floor(Math.random() * from.length)];
}

// GET /api/campaign/manifest — was liegt im Kampagnenordner?
// Der Client lädt daraufhin jede Szenendatei einzeln. Dadurch reicht es,
// eine neue Datei in den Ordner zu legen — kein Registrieren nötig.
app.get('/api/campaign/manifest', authMiddleware, (req, res) => {
  const IMG = new Set(['.png', '.gif', '.webp', '.jpg', '.jpeg']);
  res.json({
    scenes:      campaignList('scenes', new Set(['.js'])),
    backgrounds: campaignList('backgrounds', IMG),
    sprites:     campaignList('sprites', IMG),
    avatars:     campaignList('avatars', IMG),
    decks:       campaignList('decks', new Set(['.txt'])).map(f => f.replace(/\.txt$/, '')),
  });
});

// GET /api/campaign/deck/:slug — Kampagnen-Deck als Objekt (für den
// Deck-Editor: das Startdeck des Spielers kommt aus derselben Quelle).
app.get('/api/campaign/deck/:slug', authMiddleware, (req, res) => {
  const deck = loadCampaignDeck(req.params.slug);
  if (!deck) return res.status(404).json({ error: 'Campaign deck not found' });
  res.json({ deck });
});

// GET /api/campaign/state — Speicherstand (oder null für "neu").
app.get('/api/campaign/state', authMiddleware, async (req, res) => {
  try {
    const row = await db.get('SELECT state FROM campaign_progress WHERE user_id = ?', [req.user.userId]);
    if (!row) return res.json({ state: null });
    let parsed = null;
    try { parsed = JSON.parse(row.state); } catch { parsed = null; }
    res.json({ state: parsed });
  } catch (err) {
    console.error('[Campaign] state read error:', err.message);
    res.status(500).json({ error: 'Failed to read campaign state' });
  }
});

// PUT /api/campaign/state — Speicherstand schreiben (Autosave).
app.put('/api/campaign/state', authMiddleware, async (req, res) => {
  const state = req.body && req.body.state;
  if (!state || typeof state !== 'object') return res.status(400).json({ error: 'No state' });
  const json = JSON.stringify(state);
  if (json.length > CAMPAIGN_STATE_MAX) return res.status(413).json({ error: 'Campaign state too large' });
  try {
    await db.run(`INSERT INTO campaign_progress (user_id, state, updated_at)
                  VALUES (?, ?, datetime('now'))
                  ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
                 [req.user.userId, json]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Campaign] state write error:', err.message);
    res.status(500).json({ error: 'Failed to save campaign state' });
  }
});

// POST /api/campaign/reset — Speicherstand löschen (Neustart der Story).
app.post('/api/campaign/reset', authMiddleware, async (req, res) => {
  try {
    await db.run('DELETE FROM campaign_progress WHERE user_id = ?', [req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Campaign] reset error:', err.message);
    res.status(500).json({ error: 'Failed to reset campaign' });
  }
});

// ===== DECK ROUTES =====
app.get('/api/decks', authMiddleware, async (req, res) => {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [req.user.userId]);
  res.json({ decks: decks.map(parseDeck) });
});

app.post('/api/decks', authMiddleware, async (req, res) => {
  const { name, mode } = req.body;
  const id = uuidv4();
  const deckMode = mode === 'cube' ? 'cube' : 'standard';
  await db.run('INSERT INTO decks (id, user_id, name, mode) VALUES (?, ?, ?, ?)', [id, req.user.userId, name || 'New Deck', deckMode]);
  const deck = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [id, req.user.userId]);
  res.json({ deck: parseDeck(deck) });
});

app.put('/api/decks/:id', authMiddleware, async (req, res) => {
  const { name, mainDeck, heroes, potionDeck, sideDeck, isDefault, coverCard, skins } = req.body;
  const deckRow = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!deckRow) return res.status(404).json({ error: 'Deck not found' });

  if (isDefault) await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);

  await db.run('UPDATE decks SET name=?, main_deck=?, heroes=?, potion_deck=?, side_deck=?, is_default=?, cover_card=?, skins=?, updated_at=unixepoch() WHERE id=? AND user_id=?', [
    name || deckRow.name,
    JSON.stringify(mainDeck || JSON.parse(deckRow.main_deck)),
    JSON.stringify(heroes || JSON.parse(deckRow.heroes)),
    JSON.stringify(potionDeck || JSON.parse(deckRow.potion_deck)),
    JSON.stringify(sideDeck || JSON.parse(deckRow.side_deck)),
    isDefault ? 1 : (isDefault === false ? 0 : deckRow.is_default),
    coverCard !== undefined ? (coverCard || '') : (deckRow.cover_card || ''),
    skins !== undefined ? JSON.stringify(skins) : (deckRow.skins || '{}'),
    req.params.id, req.user.userId
  ]);

  const updated = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ deck: parseDeck(updated) });
});

app.post('/api/decks/:id/set-default', authMiddleware, async (req, res) => {
  const deck = await db.get('SELECT id FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);
  await db.run('UPDATE decks SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  // A custom deck is now the default — clear any pinned sample-deck default.
  await db.run('UPDATE users SET default_sample_deck_id = NULL WHERE id = ?', [req.user.userId]);
  res.json({ ok: true });
});

/**
 * Same deck-legality rule the profile "Deck Wall" uses: exactly 60 main
 * cards, exactly 3 heroes, and the potion deck is either empty or sized
 * 5–15. Duplicated inline here rather than refactored because the rule
 * already lives inline at `/api/profile/deck-stats` — keeping them in
 * sync is the maintenance note.
 */
function isCustomDeckRowLegal(row) {
  if (!row) return false;
  try {
    const main = JSON.parse(row.main_deck || '[]');
    const heroes = JSON.parse(row.heroes || '[]').filter(h => h && h.hero);
    const potions = JSON.parse(row.potion_deck || '[]');
    const pc = potions.length;
    return main.length === 60 && heroes.length === 3 && (pc === 0 || (pc >= 5 && pc <= 15));
  } catch { return false; }
}

/**
 * If the user's currently-selected default deck is missing or not legal,
 * pick and persist a replacement:
 *   1. Random LEGAL user-built deck, if any exist.
 *   2. Otherwise, a random Starter (non-structure) sample deck.
 * Idempotent — a no-op when the existing default is already valid.
 *
 * Called on /api/auth/me (every session check) so the client always
 * sees a usable default in its deck picker. Writes go through the same
 * mutually-exclusive convention the two set-default endpoints use:
 *   custom default   → flip `decks.is_default`, null `users.default_sample_deck_id`
 *   sample default   → null all `decks.is_default`, set `users.default_sample_deck_id`
 */
async function ensureValidDefaultDeck(userId) {
  const decks = await db.all('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at', [userId]);
  const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [userId]);

  // 1. Current custom default still legal? No-op.
  const customDefault = decks.find(d => d.is_default);
  if (customDefault && isCustomDeckRowLegal(customDefault)) return;

  // 2. Pinned sample-deck default still valid?
  //    • Starter (non-structure): always legal — content shipped by us.
  //    • Structure: requires the user to still own it in the shop table.
  if (userRow?.default_sample_deck_id) {
    const samples = loadSampleDecks();
    const sample = samples.find(s => s.id === userRow.default_sample_deck_id);
    if (sample) {
      if (!sample.isStructure) return;
      const owned = await db.get(
        "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
        [userId, sample.structureId]
      );
      if (owned) return;
    }
  }

  // 3. Random legal user-built deck, if any.
  const legalCustoms = decks.filter(isCustomDeckRowLegal);
  if (legalCustoms.length > 0) {
    const pick = legalCustoms[Math.floor(Math.random() * legalCustoms.length)];
    await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE decks SET is_default = 1 WHERE id = ? AND user_id = ?', [pick.id, userId]);
    await db.run('UPDATE users SET default_sample_deck_id = NULL WHERE id = ?', [userId]);
    return;
  }

  // 4. Fall back to a random Starter deck. Structure decks are excluded —
  //    they're paywall content; the user may not own them.
  const starters = loadSampleDecks().filter(s => !s.isStructure);
  if (starters.length > 0) {
    const pick = starters[Math.floor(Math.random() * starters.length)];
    await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [userId]);
    await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [pick.id, userId]);
  }
}

app.post('/api/decks/:id/saveas', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    const original = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
    if (!original) return res.status(404).json({ error: 'Deck not found' });

    const newId = uuidv4();
    await db.run(
      'INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, cover_card, skins, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, unixepoch(), unixepoch())',
      [newId, req.user.userId, name || original.name + ' (Copy)',
       original.main_deck, original.heroes, original.potion_deck, original.side_deck,
       original.cover_card || '', original.skins || '{}', original.mode || 'standard']
    );

    const newDeck = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [newId, req.user.userId]);
    if (!newDeck) return res.status(500).json({ error: 'Failed to create deck copy' });
    res.json({ deck: parseDeck(newDeck) });
  } catch (err) {
    console.error('[SaveAs] Error:', err.message);
    res.status(500).json({ error: 'Failed to save deck copy' });
  }
});

app.delete('/api/decks/:id', authMiddleware, async (req, res) => {
  await db.run('DELETE FROM decks WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

// ===== SAMPLE DECKS =====
function loadSampleDecks() {
  const dir = path.join(__dirname, 'data', 'SampleDecks');
  if (!fs.existsSync(dir)) return [];

  const cardsByName = getCardDB();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
  const decks = [];

  for (let fi = 0; fi < files.length; fi++) {
    try {
      const text = fs.readFileSync(path.join(dir, files[fi]), 'utf-8');
      const lines = text.split(/\r?\n/);
      if (!lines[0] || !lines[0].includes('PIXEL PARTIES DECK')) continue;

      const fileBase = files[fi].replace(/\.txt$/, '');
      let deckName = fileBase;
      let coverCard = '';
      let section = null;
      const heroNames = [];
      const mainCards = [];
      const potionCards = [];
      const sideCards = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith('Name:')) { deckName = line.slice(5).trim(); continue; }
        if (line.startsWith('Cover:')) { coverCard = line.slice(6).trim(); continue; }
        if (line.startsWith('===')) continue;
        if (line === '== HEROES ==') { section = 'heroes'; continue; }
        if (line === '== MAIN DECK ==') { section = 'main'; continue; }
        if (line === '== POTION DECK ==') { section = 'potion'; continue; }
        if (line === '== SIDE DECK ==') { section = 'side'; continue; }

        if (section === 'heroes') {
          heroNames.push(line === '(empty)' ? null : line);
        } else if (section) {
          const m = line.match(/^(\d+)x\s+(.+)$/);
          if (!m) continue;
          const count = parseInt(m[1], 10);
          const name = m[2].trim();
          const arr = section === 'main' ? mainCards : section === 'potion' ? potionCards : sideCards;
          for (let j = 0; j < count; j++) arr.push(name);
        }
      }

      const heroes = [0, 1, 2].map(i => {
        const name = heroNames[i] || null;
        if (!name) return { hero: null, ability1: null, ability2: null };
        const card = cardsByName[name];
        return { hero: name, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
      });

      // "Structure Deck …" files are gated behind a shop purchase. Others
      // are "Starter Decks" — always visible in the deck list and used as
      // the initial unlocked opponents for new accounts.
      // The separator after "Deck" varies in the data (space, ":" or a
      // typo'd "_", e.g. "Structure Deck_ Grand Rebellion"), so match
      // "Structure Deck" not directly followed by another letter rather
      // than relying on \b (which treats "_" as a word char and misfires).
      const STRUCTURE_RE = /^Structure Deck(?![A-Za-z])/i;
      const isStructure = STRUCTURE_RE.test(fileBase) || STRUCTURE_RE.test(deckName);
      // Strip the "Structure Deck" / "Starter Deck" prefix (plus any
      // space / ":" / "_" separators) from the stored Name so the deck
      // list / shop show just the real deck title.
      const stripped = deckName.replace(/^(Structure|Starter) Deck[\s:_]*/i, '').trim();
      const displayName = stripped || deckName;

      decks.push({
        // Stable ID derived from the source filename so adding / removing
        // / reordering sample decks never causes stats (npc_stats) to
        // drift onto the wrong opponent. Previously this was 'sample-' +
        // array-index, which shifted every key on any roster change.
        id: 'sample-' + fileBase,
        name: displayName,
        heroes,
        mainDeck: mainCards,
        potionDeck: potionCards,
        sideDeck: sideCards,
        isDefault: false,
        isSample: true,
        isStructure,
        // Stable id used for ownership tracking in user_shop_items.
        structureId: isStructure ? fileBase : null,
        coverCard,
      });
    } catch (err) { console.error('[SampleDecks] Error reading', files[fi], err.message); }
  }
  return decks;
}

// Per-CPU-opponent speech-bubble lines, keyed by sample-deck id
// ('sample-' + filename). Populated with per-opponent flavour text (step 2);
// any opponent missing an entry simply shows no bubble. Human players use
// their own profile's victory_msg / defeat_msg instead of this table.
// Markup: *text* = italic, **text** = bold (rendered client-side). Messages
// type out letter-by-letter in the bubble. Author-defined here, so they are
// NOT run through the profanity filter (that gates only human profile input).
const CPU_MESSAGES = {
  // ── Starter Decks ──
  'sample-Heal Burn': { // Nao, the Barrier Priestess
    greeting: "May the Fairies laugh upon this game!",
    victory: "I hope it doesn't hurt...",
    defeat: "Ouch... I could not shield *that*...",
    heroKilled: "Oh no! Poor soul...",
    middleHeroKilled: "Oh dear...",
  },
  'sample-Suicide Bombers': { // Bomb Berserker Bartas
    greeting: "YOU WANT FUN? I'LL GIVE YOU THE EXPLOSIVE KIND!",
    victory: "BOOM BABY!",
    defeat: "GRAH, THAT BLOWS!",
    heroKilled: "WHA-?! OI, **I** WANTED TO EXPLODE THAT ONE!",
    middleHeroKilled: "HA! OUT WITH A BANG!",
  },
  'sample-Venom Swamp': { // Zsos'Ssar, the Serpent Warlord
    greeting: "Beware of Poissssson!",
    victory: "*Exssssellent*!",
    defeat: "*Impossssssible*!",
    heroKilled: "Unaccsssseptable!",
    middleHeroKilled: "Ssssstop that!",
  },
  // ── Structure Decks ──
  'sample-Structure Deck Bamboo Warrior': { // Xiong, the Bamboo Guardian
    greeting: "Oi - you're not trying to steal my stuff, are you?",
    victory: "There - and don't try me again if you know what's good for you!",
    defeat: "**GRRR...!**",
    heroKilled: "Why you...!",
    middleHeroKilled: "Ouch- hey, a bit gentler!",
  },
  'sample-Structure Deck Big Stomp': { // Kit, the Shark Researcher
    greeting: "This game will be *great* data!",
    victory: "Aaaand that's the study. Thanks for participating.",
    defeat: "Hmm... *not* as expected. Where did I miscalculate...?",
    heroKilled: "Hmm... *not* what the data suggested...",
    middleHeroKilled: "Yikes - so much for that experiment.",
  },
  'sample-Structure Deck Bloody King Zi': { // Timeless King Zi
    greeting: "Time for a challenge.",
    victory: "Tick-Tock - Time's Up!",
    defeat: "... tick-tock. **My** time is up...",
    heroKilled: "This one's time was already up it seems.",
    middleHeroKilled: "Oh no - my time is not over!",
  },
  'sample-Structure Deck Bone Rush': { // Vacarn, the Dark Goblin Necromancer
    greeting: "Rise, my minions, and see this fool who wants to face us!",
    victory: "Rise, rise, RISE, my minions! Khekhekhe!",
    defeat: "NO! My minions, my **beautiful** minions...!",
    heroKilled: "NOOO! My **beautiful** minion!",
    middleHeroKilled: "MINIONS! PROTECT YOUR MASTER!",
  },
  'sample-Structure Deck Burning Inferno': { // Luna Pele, the Flame Dancer
    greeting: "This will be a fiery dance!",
    victory: "Now that was a hot performance if I ever saw one!",
    defeat: "Oh no - looks like I got burned!",
    heroKilled: "Very elegant, I love it!",
    middleHeroKilled: "What a SHOW!",
  },
  'sample-Structure Deck Cool Gang': { // Thorad, Strength of Coolness
    greeting: "Yo dude - this'll be, like, **so cool!**",
    victory: "Coo-hool!",
    defeat: "Not cool!",
    heroKilled: "Yoooo, *cool* hit! Noice!",
    middleHeroKilled: "Yoooo ... not *cool*, dude!",
  },
  'sample-Structure Deck Creepy Crawlies': { // Alleria, the Queen of Spiders
    greeting: "Careful... don't get too tangled up in my pretty nets...",
    victory: "Kch kch kch... A nice dance!",
    defeat: "... let's get out of here!",
    heroKilled: "... right through my webs?",
    middleHeroKilled: "Kch - scatter, my children!",
  },
  'sample-Structure Deck Crystal Gifts': { // Mary Crestmas
    greeting: "Here, sweetie - take a present or five 💕",
    victory: "Mary Crestmas!",
    defeat: "This is my gift to you!",
    heroKilled: "Do you dislike my presents...?",
    middleHeroKilled: "Is that how you thank me...?",
  },
  'sample-Structure Deck Cute Commando': { // Cute Annoyance Mini
    greeting: "Heh - **you** think you could fight me? With *that* face and **that** skill level? What an insult!",
    victory: "A-HAHAHAHA! YOUR FACE! YOUR **STUPID** FACE! WHAT A LOSER!!!",
    defeat: "WHA-?! That... That *so* doesn't count! You're ... you're such a bully!!!",
    heroKilled: "Oh-my-**GOD**! How can you be such a big meanie?!",
    middleHeroKilled: "CHEATER!",
  },
  'sample-Structure Deck Dance of the Butterflies': { // Beato, the Butterfly Witch
    greeting: "Here's to a fun game ahead. Let's both give it our best showing~",
    victory: "*Magical*!",
    defeat: "Huh... that was *quite* elegant!",
    heroKilled: "Beautifully executed!",
    middleHeroKilled: "Hmm-mm - *excellent* maneuver there~",
  },
  'sample-Structure Deck Deepsea Terror': { // Siphem, the Deepsea Demon
    greeting: "GARH-HAR-HAR!",
    victory: "Gre-he-he...",
    defeat: "Grrrr?!",
    heroKilled: "Garr!",
    middleHeroKilled: "GRAARGH!",
  },
  'sample-Structure Deck Depths of the Cosmos': { // Argos, the Eye of the Cosmos
    greeting: "...",
    victory: "...",
    defeat: "...?!",
    heroKilled: "...",
    middleHeroKilled: "...",
  },
  'sample-Structure Deck Elven Vanguard': { // Maya, the Nature Fairy
    greeting: "Hey hey~",
    victory: "Hi-hi, my daughter will be so proud~",
    defeat: "N'awww, what will the trees say now...?",
    heroKilled: "Ah - nooo, that stings!",
    middleHeroKilled: "Welp, back to the earth I go...",
  },
  'sample-Structure Deck Flying Sparks': { // Lilly, the Charming Infiltrator
    greeting: "Heyyyy, sweetie 💕",
    victory: "Hihi... thanks for the win, your cards were *delightful*. Think I'll keep 'em~",
    defeat: "Awww - no fair! Buuuut it was still fun, so I forgive ya~",
    heroKilled: "Buuhhh...!",
    middleHeroKilled: "Booo, what a killjoy you are!",
  },
  'sample-Structure Deck Gates to Hell': { // Silent Water Mizune
    greeting: "A little distraction...? Sure. Why not?",
    victory: "Hmm... A good distraction.",
    defeat: "Welp... Guess that's how it goes.",
    heroKilled: "Hmm... Good job.",
    middleHeroKilled: "Ah. Of course. Ouch.",
  },
  'sample-Structure Deck Gather That Storm': { // Tarleinn the Traveler
    greeting: "Oh, THIS will be hype!",
    victory: "WOOO! Did you **see** that game?! Amazing stuff!",
    defeat: "Woah - you **totally** blew me out! And I loved every bit of it!",
    heroKilled: "YOOO! The battle's getting exciting!",
    middleHeroKilled: "Hahaha - damn, that's *one way* to deal with me!",
  },
  'sample-Structure Deck_ Grand Rebellion': { // Champion, the Stormbringer
    greeting: "A game...? You mean a *slaughter*. But fine. I'll indulge you.",
    victory: "... sorry. That was inevitable. I *am* the strongest after all.",
    defeat: "... *what*? **How**?!",
    heroKilled: "Strong. But I am *stronger*!",
    middleHeroKilled: "No way - how did you beat the strongest of them all?!",
  },
  'sample-Structure Deck Great Weapon Master': { // Toras, Master of all Weapons
    greeting: "I got *just* the weapon for the job - get ready!",
    victory: "Had the right weapons for the fight. Nice try!",
    defeat: "... 60 weapons, and none fit. Surprising. And impressive!",
    heroKilled: "Good hit. *Ready for the counter?!*",
    middleHeroKilled: "I... I just needed a better weapon, that's all!",
  },
  'sample-Structure Deck Guardians of the Treasure Cave': { // Mao, the Vengeful Guardian
    greeting: "Grrr... you know where *they* are...?",
    victory: "One more down ... still twelve to go...!",
    defeat: "KCHHHH!",
    heroKilled: "Chrrr...!",
    middleHeroKilled: "Tssk!",
  },
  'sample-Structure Deck Idej Illusions': { // Idej Lord Daiyo
    greeting: "Sorry. You won't be able to lay a hand on me.",
    victory: "You couldn't touch me. They never can.",
    defeat: "How did you...? You should not even be able to harm me!",
    heroKilled: "What? That one was so easily killable?!",
    middleHeroKilled: "Preposterous...!",
  },
  'sample-Structure Deck Lightning Caller': { // Sol Rym, the Thunder Djinn
    greeting: "Let's have an *electric* battle under the open sky!",
    victory: "Pew-pew!",
    defeat: "My lightning - my gorgeous, majestic, crackling lightning...!",
    heroKilled: "Good, good - give the heavens a show!",
    middleHeroKilled: "HA! That's how you make a ruckus up in the skies!",
  },
  'sample-Structure Deck Mans Best Friends': { // Orthos, the Loyal Guard Dog
    greeting: "I'll protect my pack!",
    victory: "Woof - of course, there was never so much as a possibility I would let you hurt my pack.",
    defeat: "GRRR, no, back off!",
    heroKilled: "No, my pack...!",
    middleHeroKilled: "No...! My pack needs me!",
  },
  'sample-Structure Deck Mawstruck': { // Nero Zira, the Mastermind
    greeting: "INITIATE BOOT SEQUENCE. 10 PERCENT ... 50 PERCENT ... 100 PERCENT. INITIATE ANNIHILATION.EXE ...",
    victory: "Beep-Boop! Do-mi-nate! De-feat all flesh-lings!",
    defeat: "ERROR ERROR ERROR - DOES NOT COMPUTE DOES NOT COMPUTE RESTART DECK.EXE!",
    heroKilled: "WARNING! WARNING! INCONCLUSIVE READINGS!",
    middleHeroKilled: "CRITICAL ERROR! REBOOTING... REBOOTING...",
  },
  'sample-Structure Deck One-Two-Punch': { // Ghuanjun, the Undead Martial Artist
    greeting: "...",
    victory: "...",
    defeat: "...",
    heroKilled: "...",
    middleHeroKilled: "...",
  },
  'sample-Structure Deck Parts of the Soul': { // Thep, the Court Scribe
    greeting: "The quill is ready. Write history!",
    victory: "And so it is written, in the chronicles of eternity.",
    defeat: "Hmm... *that* was not in today's chapter. Now it is.",
    heroKilled: "I will make sure to write *that* down!",
  },
  'sample-Structure Deck Pew-Pew': { // Bow Sniper Darge
    greeting: "Alright - stand *right there*. And put an apple on your head, will ya?",
    victory: "BULLSEYE!",
    defeat: "Can you **PLEASE** stop moving so much so I can hit you cleanly?!",
    heroKilled: "Shoot, right in the head...!",
    middleHeroKilled: "*Yikes*, going straight for the head, are you?",
  },
  'sample-Structure Deck Poison Torture': { // Reiza, the Chief Tormentor
    greeting: "Ohoho... I feel like this will be *great* fun...!",
    victory: "Kikiki... now come, the dungeon awaits...!",
    defeat: "How **DARE** YOU?!",
    heroKilled: "Ouch - I'll feel that one for a while, hihi~",
    middleHeroKilled: "Hmmm... I *like* being handled like that...",
  },
  'sample-Structure Deck Sacrificial Demons': { // Calamitusk, the Chaorc War Chief
    greeting: "Gruh-! Body for pile! Burn it, grill it, add it to the stake!",
    victory: "Chrr, chrr - Chaorcs strong, like always!",
    defeat: "**REEEE!**",
    heroKilled: "Yum! That one, tasty! Grill, now!",
    middleHeroKilled: "GRAH! NO! NO EATING THIS ONE! THIS ONE ME!!!",
  },
  'sample-Structure Deck Shadows over Blackport': { // Arthor, the King of Blackport
    greeting: "You want to play a game...? Sorry, I deal in *plans*. This won't take long.",
    victory: "Quite plain. You will not be a threat to me.",
    defeat: "Just ... *forget it*!",
    heroKilled: "That's fine. Still all according to plan.",
    middleHeroKilled: "Just ... just a *minor* setback... I'm sure...!",
  },
  'sample-Structure Deck Shifting Sandlands': { // Bakhm, the Desert Digger
    greeting: "GRRMMMBB...",
    victory: "GROAARRR!",
    defeat: "GRRRR!",
    heroKilled: "GRRR!",
    middleHeroKilled: "GROAR!",
  },
  'sample-Structure Deck Slimy Infestation': { // Stellan, the Calm Cat
    greeting: "Hmm? Play with me? Sure. Let's do this.",
    victory: "Hmmm-mm. Neat.",
    defeat: "Ah... how unfortunate.",
    heroKilled: "Ah. Good one.",
    middleHeroKilled: "Ah. That's not very nice of you.",
  },
  'sample-Structure Deck Slip n Slide': { // Hel, the Bound Specter
    greeting: "Hihihi... ready for a *chilling* experience?",
    victory: "Huhu... spooky, isn't it?",
    defeat: "Now *you* are scaring *me* - **stop that!**",
    heroKilled: "Ahhhh! Stop it!",
    middleHeroKilled: "Huhuhu... Now *I* am scared!",
  },
  'sample-Structure Deck Spell Industrialization': { // Victorica, the Eternal Empress
    greeting: "Just ... *who* do you think you are, *challenging* the Empress?!",
    victory: "Absolute authority. Of course. Like always.",
    defeat: "Impertinent little...! You should be *grateful* I am not petty enough to have you *punished* on the spot!",
    heroKilled: "How cheeky of you!",
    middleHeroKilled: "Huh - *that's* how dying feels? How unpleasant - why do people *do that*?",
  },
  'sample-Structure Deck Steam Dwarf Mines': { // Layn, Defender of Deri
    greeting: "Throw everything you got at me! Nothing will get through!",
    victory: "HA! You will **NEVER** breach my defenses!",
    defeat: "How... how did you break through?!",
    heroKilled: "That's... that's just a minor setback! Don't think for a second that breached my defenses!",
    middleHeroKilled: "Noooo, my beautiful perfect defenses!",
  },
  'sample-Structure Deck Sun Fencer Frenzy': { // Taio, the Sun Fencer
    greeting: "Another game, another heist!",
    victory: "The perfect heist!",
    defeat: "Shoot, guess I got careless there...",
    heroKilled: "Guess this just got a bit more risky. Just how I like it!",
    middleHeroKilled: "Busted...!",
  },
  'sample-Structure Deck To Attain Divinity': { // Archibald, the Archmage
    greeting: "Get ready - to witness a god!",
    victory: "Bow, for you are talking to a god now!",
    defeat: "My - my *perfect magic*!",
    heroKilled: "Just a small sacrifice for the greater good!",
    middleHeroKilled: "No-no-NOOOO!",
  },
  // ── Nachtrag 4.8.: die drei bis dahin textlosen Gegner ──
  // Interpunktion an die Hausschreibweise angeglichen: Gedankenstriche
  // als " - " wie in den ueber 40 bestehenden Texten (kein Em-Dash — den
  // fuehrt KEIN einziger vorhandener Text, und die Pixel-Schrift muesste
  // die Glyphe erst hergeben), Ellipsen ohne Leerzeichen davor.
  'sample-Structure Deck Join our Cult': { // Klaus, the Cult Leader
    greeting: "Welcome, brother. Please - do stay!",
    victory: "Now... stay with us...!",
    defeat: "No... Please! Don't leave us yet!",
    heroKilled: "Oh, dear brother - your sacrifice will be sung of forever!",
    middleHeroKilled: "Hmm... A temporary setback, isn't it, Lord?",
  },
  'sample-Structure Deck Boom Boom Kaboom': { // Andras, the Human Weapon
    greeting: "What - **another** target I'm supposed to kill? God, I hate this!",
    victory: "Just another job done. Don't take it personally.",
    defeat: "That's how war goes - you'll lose one eventually...",
    heroKilled: "Another one bites the dust...",
    middleHeroKilled: "I'll never get used to that - it **hurts**, damn it!",
  },
  'sample-Structure Deck Metamorphosis': { // Waflav, the Metamorphing Monstrosity
    // `bounce: true` — Als Vorgabe: bei Waflav wackeln ALLE Buchstaben
    // leicht, nicht nur die geschrienen Grossbuchstaben. Der Ruckel
    // traegt die Figur: ein formloses Ding, das nie ganz stillsteht.
    bounce: true,
    greeting: "Grrraaahhh...! Change... you...!",
    victory: "You... *tasty*...!",
    defeat: "NOOOOOO! MORE! I NEED **MORE!**",
    heroKilled: "Hrrrmmm... Yummy...!",
    middleHeroKilled: "Deeeaaad? ...Adapt...! ...Overcome it...!",
  },
};
function getCpuMessages(deckId) {
  const m = CPU_MESSAGES[deckId] || {};
  return { greeting: m.greeting || '', victory: m.victory || '', defeat: m.defeat || '', heroKilled: m.heroKilled || '', middleHeroKilled: m.middleHeroKilled || '', bounce: !!m.bounce };
}

// ═══════════════════════════════════════════════════════════════════
//  CPU OPPONENT UNLOCK SYSTEM
//  Accounts start with only the starter-deck opponents unlocked.
//  More unlock as the player hits win milestones (endCpuBattle):
//    • the first win vs each of the initial opponents → +1 random unlock
//    • reaching THREE_WIN_MILESTONE wins vs ANY opponent → +1 random unlock
//  Gaeste haben eine eigene, grosszuegigere Regel (jeder erste Sieg gegen
//  eine CPU) — alles in `unlock-rules.js`.
//  The gallery and the structure-deck shop are both filtered to a user's
//  unlocked set. Preexisting accounts are re-gated to this same starting
//  point by a one-time migration (see initDatabase).
// ═══════════════════════════════════════════════════════════════════
const { THREE_WIN_MILESTONE, cpuUnlockCount } = require('./unlock-rules');

// Seed an account with its initial opponent roster — the starter-deck
// (non-structure) opponents — flagged is_initial=1, and mark the account
// initialized + re-gated so the startup migration never resets it again.
// Returns the seeded deckIds.
async function seedInitialOpponents(userId) {
  const starterIds = loadSampleDecks().filter(d => !d.isStructure).map(d => d.id);
  for (const oid of starterIds) {
    await db.run(
      'INSERT OR IGNORE INTO unlocked_opponents (user_id, opponent_deck_id, is_initial) VALUES (?, ?, 1)',
      [userId, oid]
    );
  }
  await db.run('UPDATE users SET opponents_initialized = 1, opponents_regated = 1 WHERE id = ?', [userId]);
  return starterIds;
}

// Set of opponent deckIds unlocked for a user. Defensively self-heals an
// account that somehow has no unlock rows yet (e.g. seeding was interrupted)
// by seeding it on first read, so the gallery is never empty.
async function getUnlockedOpponentIds(userId) {
  const rows = await db.all('SELECT opponent_deck_id FROM unlocked_opponents WHERE user_id = ?', [userId]);
  if (rows.length === 0) {
    await seedInitialOpponents(userId);
    const seeded = await db.all('SELECT opponent_deck_id FROM unlocked_opponents WHERE user_id = ?', [userId]);
    return new Set(seeded.map(r => r.opponent_deck_id));
  }
  return new Set(rows.map(r => r.opponent_deck_id));
}

// Unlock one random still-locked opponent for the user. Returns the
// newly-unlocked { id, name, middleHero } or null when nothing is left.
async function unlockRandomOpponent(userId) {
  const all = loadSampleDecks();
  const unlocked = await getUnlockedOpponentIds(userId);
  const locked = all.filter(d => !unlocked.has(d.id));
  if (locked.length === 0) return null;
  const pick = locked[Math.floor(Math.random() * locked.length)];
  await db.run(
    'INSERT OR IGNORE INTO unlocked_opponents (user_id, opponent_deck_id, is_initial) VALUES (?, ?, 0)',
    [userId, pick.id]
  );
  return { id: pick.id, name: pick.name, middleHero: pick.heroes?.[1]?.hero || null };
}

// Only the starter (non-structure) sample decks are returned to every
// client. Structure decks ride on a separate owned-items catalog below.
app.get('/api/sample-decks', async (req, res) => {
  const all = loadSampleDecks();
  res.json({ decks: all.filter(d => !d.isStructure) });
});

// Authenticated variant — includes any structure decks the caller has
// unlocked, so they appear in the deck picker next to starter decks.
app.get('/api/sample-decks/owned', authMiddleware, async (req, res) => {
  const all = loadSampleDecks();
  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  const decks = all.filter(d => !d.isStructure || ownedSet.has(d.structureId));
  res.json({ decks });
});

// Singleplayer opponent-gallery feed. Returns every sample deck the caller
// can face (all Starter + all Structure decks, regardless of shop-ownership),
// each enriched with the middle-hero name and the caller's W/L record vs
// that opponent. The client crops the hero's skin image to render a clean
// portrait tile. Note: structure-deck ownership still gates use of the deck
// in the deckbuilder — this endpoint just opens every AI opponent.
app.get('/api/sample-decks/gallery', authMiddleware, async (req, res) => {
  // Only opponents the caller has unlocked are surfaced in the gallery.
  // Self-heal seeding first, then pull the unlock rows in unlock order so we
  // can order the tiles: always-unlocked Starter Deck opponents come first,
  // the rest follow in the (random, per-account) order they were unlocked.
  await getUnlockedOpponentIds(req.user.userId);
  const unlockRows = await db.all(
    'SELECT opponent_deck_id, is_initial, unlocked_at FROM unlocked_opponents WHERE user_id = ? ORDER BY unlocked_at ASC, rowid ASC',
    [req.user.userId]
  );
  const unlocked = new Set(unlockRows.map(r => r.opponent_deck_id));
  const isInitialMap = new Map(unlockRows.map(r => [r.opponent_deck_id, !!r.is_initial]));
  // Rank by unlock order (ascending) — drives the post-starter ordering.
  const unlockRank = new Map();
  unlockRows.forEach((r, i) => unlockRank.set(r.opponent_deck_id, i));

  const allDecks = loadSampleDecks();
  // Stable fallback order for the starter block (the natural roster order).
  const baseIndex = new Map(allDecks.map((d, i) => [d.id, i]));
  const decks = allDecks.filter(d => unlocked.has(d.id));
  const statRows = await db.all(
    'SELECT opponent_deck_id, wins, losses FROM npc_stats WHERE user_id = ?',
    [req.user.userId]
  );
  const statMap = new Map(statRows.map(r => [r.opponent_deck_id, r]));
  const enriched = decks.map(d => {
    const middleHero = d.heroes?.[1]?.hero || null;
    const stat = statMap.get(d.id);
    return {
      id: d.id,
      name: d.name,
      isStructure: !!d.isStructure,
      middleHero,
      wins: stat?.wins || 0,
      losses: stat?.losses || 0,
    };
  });
  enriched.sort((a, b) => {
    const aInit = isInitialMap.get(a.id) ? 1 : 0;
    const bInit = isInitialMap.get(b.id) ? 1 : 0;
    if (aInit !== bInit) return bInit - aInit;            // starters first
    if (aInit) return baseIndex.get(a.id) - baseIndex.get(b.id); // starters: roster order
    return (unlockRank.get(a.id) ?? 0) - (unlockRank.get(b.id) ?? 0); // rest: unlock order
  });
  res.json({ opponents: enriched });
});

// Structure-deck shop catalog with per-deck ownership flags.
app.get('/api/shop/structure-decks', authMiddleware, async (req, res) => {
  // Restrict the shop to structure decks whose opponent the player has
  // unlocked — locked opponents' decks aren't purchasable yet.
  const unlocked = await getUnlockedOpponentIds(req.user.userId);
  const all = loadSampleDecks().filter(d => d.isStructure && unlocked.has(d.id));
  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  // Which deck is currently flagged as this user's default? Used by the UI
  // to draw the green "this is your active deck" border.
  const defaultRow = await db.get('SELECT id FROM decks WHERE user_id = ? AND is_default = 1', [req.user.userId]);
  const defaultDeckId = defaultRow?.id || null;
  const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [req.user.userId]);
  const defaultSampleId = userRow?.default_sample_deck_id || null;
  res.json({
    decks: all.map(d => ({
      structureId: d.structureId,
      id: d.id,
      name: d.name,
      coverCard: d.coverCard || '',
      owned: ownedSet.has(d.structureId),
      isDefault: defaultSampleId === d.id,
    })),
    price: STRUCTURE_DECK_PRICE,
    randomPrice: STRUCTURE_DECK_RANDOM_PRICE,
    defaultDeckId,
  });
});

// ===== SKINS =====
let SKINS_DATA = {};
try { SKINS_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'skins.json'), 'utf-8')); } catch {}
app.get('/api/skins', (req, res) => res.json({ skins: SKINS_DATA }));

// ===== SHOP SYSTEM =====
const SHOP_PRICES = { avatar: 10, sleeve: 10, board: 10, skin: 10 };
const RANDOM_PRICES = { skin: 5, avatar: 5, sleeve: 5 };
const STRUCTURE_DECK_PRICE = 10;
const STRUCTURE_DECK_RANDOM_PRICE = 5;

// Scan a shop directory and return available items
function scanShopDir(subdir) {
  const dir = path.join(__dirname, 'data', 'shop', subdir);
  try {
    return fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  } catch { return []; }
}

// Scan skins directory
function scanSkinFiles() {
  const dir = path.join(__dirname, 'cards', 'skins');
  try {
    return fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  } catch { return []; }
}

// Build flat list of all skin IDs from skins.json that have images on disk
function getAvailableSkins() {
  const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
  // Only include skins for heroes whose card images exist in ./cards
  const cardsDir = path.join(__dirname, 'cards');
  let heroFiles = [];
  try { heroFiles = fs.readdirSync(cardsDir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())); } catch {}
  const heroSet = new Set(heroFiles.map(f => {
    const stem = path.basename(f, path.extname(f));
    return nameByStripped[stem] || stem;
  }));
  const result = [];
  for (const [heroName, skinNames] of Object.entries(SKINS_DATA)) {
    if (!heroSet.has(heroName)) continue;
    for (const skinName of skinNames) {
      if (skinFiles.has(skinName)) {
        result.push({ heroName, skinName });
      }
    }
  }
  return result;
}

// GET /api/shop/catalog — all available shop items
app.get('/api/shop/catalog', (req, res) => {
  const avatars = scanShopDir('avatars').map(f => ({ id: path.basename(f, path.extname(f)), file: f }));
  const sleeves = scanShopDir('sleeves').map(f => ({ id: path.basename(f, path.extname(f)), file: f }));
  const boards = scanShopDir('boards').filter(f => /^board\d+\./i.test(f)).map(f => ({ id: path.basename(f, path.extname(f)), file: f }));

  // Skins: only for heroes whose cards exist in ./cards
  const cardsDir = path.join(__dirname, 'cards');
  let heroFiles = [];
  try { heroFiles = fs.readdirSync(cardsDir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())); } catch {}
  const heroSet = new Set(heroFiles.map(f => {
    const stem = path.basename(f, path.extname(f));
    return nameByStripped[stem] || stem;
  }));

  const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
  const skins = [];
  for (const [heroName, skinNames] of Object.entries(SKINS_DATA)) {
    if (!heroSet.has(heroName)) continue;
    for (const skinName of skinNames) {
      if (skinFiles.has(skinName)) {
        skins.push({ id: skinName, heroName, skinName });
      }
    }
  }

  res.json({
    avatars, sleeves, boards, skins,
    prices: SHOP_PRICES,
    randomPrices: RANDOM_PRICES
  });
});

// GET /api/shop/owned — user's purchased items
app.get('/api/shop/owned', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT item_type, item_id FROM user_shop_items WHERE user_id = ?', [req.user.userId]);
  const owned = { avatar: [], sleeve: [], board: [], skin: [] };
  for (const r of rows) {
    if (owned[r.item_type]) owned[r.item_type].push(r.item_id);
  }
  res.json({ owned });
});

// POST /api/shop/buy — buy a specific item
app.post('/api/shop/buy', authMiddleware, async (req, res) => {
  const { itemType, itemId } = req.body;
  if (!itemType || !itemId) return res.status(400).json({ error: 'Missing itemType or itemId' });
  const price = SHOP_PRICES[itemType];
  if (price === undefined) return res.status(400).json({ error: 'Invalid item type' });

  // Verify item exists
  if (itemType === 'skin') {
    const skinFiles = new Set(scanSkinFiles().map(f => path.basename(f, path.extname(f))));
    if (!skinFiles.has(itemId)) return res.status(404).json({ error: 'Skin not found' });
  } else {
    const subdir = itemType === 'avatar' ? 'avatars' : itemType === 'sleeve' ? 'sleeves' : 'boards';
    const files = scanShopDir(subdir).map(f => path.basename(f, path.extname(f)));
    if (!files.includes(itemId)) return res.status(404).json({ error: 'Item not found' });
  }

  // Check already owned
  const existing = await db.get('SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = ? AND item_id = ?', [req.user.userId, itemType, itemId]);
  if (existing) return res.status(409).json({ error: 'Already owned' });

  // Check SC balance
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < price) return res.status(400).json({ error: 'Not enough SC' });

  // Deduct and add
  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [price, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, itemType, itemId]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc });
});

// POST /api/shop/buy-random-skin — buy a random unowned skin
app.post('/api/shop/buy-random-skin', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < RANDOM_PRICES.skin) return res.status(400).json({ error: 'Not enough SC' });

  const allSkins = getAvailableSkins();
  const ownedRows = await db.all("SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'skin'", [req.user.userId]);
  const ownedSet = new Set(ownedRows.map(r => r.item_id));

  const unowned = allSkins.filter(s => !ownedSet.has(s.skinName));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all available skins!' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [RANDOM_PRICES.skin, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, 'skin', pick.skinName]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, skinName: pick.skinName, heroName: pick.heroName });
});

// POST /api/shop/buy-random — buy a random unowned item of a given type (avatar or sleeve)
app.post('/api/shop/buy-random', authMiddleware, async (req, res) => {
  const { itemType } = req.body;
  if (!itemType || !RANDOM_PRICES[itemType]) return res.status(400).json({ error: 'Invalid item type for random buy' });
  if (itemType === 'skin') return res.status(400).json({ error: 'Use /api/shop/buy-random-skin for skins' });

  const price = RANDOM_PRICES[itemType];
  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < price) return res.status(400).json({ error: 'Not enough SC' });

  const subdir = itemType === 'avatar' ? 'avatars' : 'sleeves';
  const allItems = scanShopDir(subdir).map(f => path.basename(f, path.extname(f)));
  const ownedRows = await db.all('SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = ?', [req.user.userId, itemType]);
  const ownedSet = new Set(ownedRows.map(r => r.item_id));

  const unowned = allItems.filter(id => !ownedSet.has(id));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all available ' + subdir + '!' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [price, req.user.userId]);
  await db.run('INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)', [uuidv4(), req.user.userId, itemType, pick]);

  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, itemId: pick, itemType });
});

// ───── Structure decks (shop-gated sample decks) ─────

// POST /api/shop/buy-structure-deck — buy a specific structure deck by its file id.
app.post('/api/shop/buy-structure-deck', authMiddleware, async (req, res) => {
  const { structureId } = req.body;
  if (!structureId) return res.status(400).json({ error: 'Missing structureId' });

  const deck = loadSampleDecks().find(d => d.isStructure && d.structureId === structureId);
  if (!deck) return res.status(404).json({ error: 'Structure deck not found' });

  // Can't buy a structure deck whose opponent isn't unlocked yet.
  const unlocked = await getUnlockedOpponentIds(req.user.userId);
  if (!unlocked.has(deck.id)) return res.status(403).json({ error: 'Opponent not unlocked yet' });

  const already = await db.get(
    "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
    [req.user.userId, structureId]
  );
  if (already) return res.status(409).json({ error: 'Already owned' });

  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < STRUCTURE_DECK_PRICE) return res.status(400).json({ error: 'Not enough SC' });

  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [STRUCTURE_DECK_PRICE, req.user.userId]);
  await db.run(
    'INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.user.userId, 'structure_deck', structureId]
  );
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({ ok: true, sc: updated.sc, structureId });
});

// POST /api/shop/buy-random-structure-deck — unlock a random unowned structure deck.
app.post('/api/shop/buy-random-structure-deck', authMiddleware, async (req, res) => {
  // Pool is limited to structure decks whose opponent the player unlocked.
  const unlocked = await getUnlockedOpponentIds(req.user.userId);
  const all = loadSampleDecks().filter(d => d.isStructure && unlocked.has(d.id));
  if (all.length === 0) return res.status(400).json({ error: 'No structure decks available' });

  const ownedRows = await db.all(
    "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
    [req.user.userId]
  );
  const ownedSet = new Set(ownedRows.map(r => r.item_id));
  const unowned = all.filter(d => !ownedSet.has(d.structureId));
  if (unowned.length === 0) return res.status(400).json({ error: 'You already own all Structure Decks!' });

  const user = await db.get('SELECT sc FROM users WHERE id = ?', [req.user.userId]);
  if ((user.sc || 0) < STRUCTURE_DECK_RANDOM_PRICE) return res.status(400).json({ error: 'Not enough SC' });

  const pick = unowned[Math.floor(Math.random() * unowned.length)];
  await db.run('UPDATE users SET sc = sc - ? WHERE id = ?', [STRUCTURE_DECK_RANDOM_PRICE, req.user.userId]);
  await db.run(
    'INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)',
    [uuidv4(), req.user.userId, 'structure_deck', pick.structureId]
  );
  const updated = await db.get('SELECT * FROM users WHERE id = ?', [req.user.userId]);
  res.json({
    ok: true, sc: updated.sc,
    structureId: pick.structureId,
    name: pick.name,
    coverCard: pick.coverCard || '',
  });
});

// POST /api/cheat/unlock-all — Als Cheatcode (Hauptmenü: Tasten 1-2-3-4-5
// nacheinander): schaltet sofort ALLE CPU-Gegner und ALLE Structure
// Decks frei. Zweck: Daten sammeln für/gegen beliebige Decks, ohne den
// regulären Progressions-Weg (Siege → Unlocks → Shop-Käufe) zu gehen.
// Gäste bleiben ausgeschlossen — konsistent mit dem Guest-Design
// ("ephemeral, never unlock"). Idempotent: erneutes Eingeben schaltet
// nichts doppelt frei (INSERT OR IGNORE bzw. Owned-Filter).
app.post('/api/cheat/unlock-all', authMiddleware, async (req, res) => {
  try {
    const u = await db.get('SELECT is_guest FROM users WHERE id = ?', [req.user.userId]);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.is_guest) return res.status(403).json({ error: 'Guests cannot unlock content — please register first!' });

    const decks = loadSampleDecks();

    // Alle CPU-Gegner (jedes Sample-Deck ist ein Gegner).
    const before = await getUnlockedOpponentIds(req.user.userId);
    let newOpponents = 0;
    for (const d of decks) {
      if (before.has(d.id)) continue;
      await db.run(
        'INSERT OR IGNORE INTO unlocked_opponents (user_id, opponent_deck_id, is_initial) VALUES (?, ?, 0)',
        [req.user.userId, d.id]
      );
      newOpponents++;
    }

    // Alle Structure Decks (Shop-Besitz, ohne SC-Kosten).
    const ownedRows = await db.all(
      "SELECT item_id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck'",
      [req.user.userId]
    );
    const owned = new Set(ownedRows.map(r => r.item_id));
    let newStructures = 0;
    for (const d of decks) {
      if (!d.isStructure || !d.structureId || owned.has(d.structureId)) continue;
      await db.run(
        'INSERT INTO user_shop_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?)',
        [uuidv4(), req.user.userId, 'structure_deck', d.structureId]
      );
      newStructures++;
    }

    console.log(`[cheat] unlock-all: user ${req.user.userId} → +${newOpponents} Gegner, +${newStructures} Structure Decks`);
    res.json({ ok: true, newOpponents, newStructures });
  } catch (err) {
    console.error('[cheat] unlock-all failed:', err);
    res.status(500).json({ error: 'Unlock failed' });
  }
});

// POST /api/decks/set-default-sample — pin an unlocked sample/structure deck as default.
app.post('/api/decks/set-default-sample', authMiddleware, async (req, res) => {
  const { sampleDeckId } = req.body;
  if (!sampleDeckId) return res.status(400).json({ error: 'Missing sampleDeckId' });
  const deck = loadSampleDecks().find(d => d.id === sampleDeckId);
  if (!deck) return res.status(404).json({ error: 'Sample deck not found' });

  if (deck.isStructure) {
    const owned = await db.get(
      "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
      [req.user.userId, deck.structureId]
    );
    if (!owned) return res.status(403).json({ error: 'Structure deck not unlocked' });
  }

  // Clear the default flag on all custom decks + pin the sample deck.
  await db.run('UPDATE decks SET is_default = 0 WHERE user_id = ?', [req.user.userId]);
  await db.run('UPDATE users SET default_sample_deck_id = ? WHERE id = ?', [sampleDeckId, req.user.userId]);
  res.json({ ok: true, sampleDeckId });
});

// Standard avatars (free defaults in public/avatars/)
app.get('/api/profile/standard-avatars', (req, res) => {
  const dir = path.join(__dirname, 'public', 'avatars');
  try {
    const files = fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    res.json({ avatars: files });
  } catch { res.json({ avatars: [] }); }
});

// Standard sleeves (shop items in data/shop/sleeves/)
app.get('/api/profile/standard-sleeves', (req, res) => {
  const files = scanShopDir('sleeves');
  res.json({ sleeves: files });
});

function parseDeck(row) {
  let skins = {};
  try { skins = JSON.parse(row.skins || '{}'); } catch {}
  let cubeDraftMeta = null;
  try { cubeDraftMeta = row.cube_draft_meta ? JSON.parse(row.cube_draft_meta) : null; } catch {}
  return {
    id: row.id,
    name: row.name,
    mainDeck: JSON.parse(row.main_deck),
    heroes: JSON.parse(row.heroes),
    potionDeck: JSON.parse(row.potion_deck),
    sideDeck: JSON.parse(row.side_deck),
    isDefault: !!row.is_default,
    coverCard: row.cover_card || '',
    skins,
    mode: row.mode || 'standard',
    cubeDraftMeta,
  };
}

// ===== SMUG COINS (SC) SYSTEM =====
const SC_REWARDS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'sc-rewards.json'), 'utf-8'));
const SC_DAILY_CAP_PER_OPPONENT = 15;
const SC_MIN_GAME_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const SC_MIN_TURNS = 4; // at least turn 4 (each player took 2 turns)
const SC_MIN_CARDS_PLAYED = 3; // each player must play at least 3 cards

function getSocketIP(socket) {
  return socket?.handshake?.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || socket?.handshake?.address
    || 'unknown';
}

async function evaluateSCRewards(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs) return {};
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const tracking = gs._scTracking || [{}, {}];
  const startTime = gs._gameStartTime || Date.now();
  const gameDuration = Date.now() - startTime;
  const turn = gs.turn || 0;
  const isRanked = room.type === 'ranked';

  // ── Safeguard checks ──
  // Same IP → no SC for anyone
  const ip0 = gs._playerIPs?.[0] || 'unknown';
  const ip1 = gs._playerIPs?.[1] || 'unknown';
  if (ip0 !== 'unknown' && ip0 === ip1) return {};

  // Min game duration
  if (gameDuration < SC_MIN_GAME_DURATION_MS) return {};

  // Min turns
  if (turn < SC_MIN_TURNS) return {};

  // Min cards played from hand
  if ((tracking[0].cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return {};
  if ((tracking[1].cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return {};

  // Surrender before any hero takes damage → no SC
  if (reason === 'surrender') {
    const anyDamage = gs.players.some(ps =>
      (ps.heroes || []).some(h => h.name && h.hp < h.maxHp)
    );
    if (!anyDamage) return {};
  }

  // Disconnect wins only get "Player" reward
  const isDisconnectWin = reason === 'disconnect_timeout';

  const todayStart = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);
  const results = {}; // { [playerIdx]: { rewards: [{id,title,amount}], total: N } }

  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    const opp = gs.players[pi === 0 ? 1 : 0];
    const isWinner = pi === winnerIdx;
    const oppIp = pi === 0 ? ip1 : ip0;
    const t = tracking[pi] || {};
    const earned = [];

    for (const reward of SC_REWARDS) {
      // Disconnect winners only get "player" reward
      if (isDisconnectWin && reward.id !== 'player') continue;

      // Check if this reward's condition is met
      let met = false;
      switch (reward.requires) {
        case 'play':
          met = true; // Playing a game
          break;
        case 'win':
          met = isWinner;
          break;
        case 'win_ranked':
          met = isWinner && isRanked;
          break;
        case 'win_all_heroes_alive':
          if (isWinner && (ps.heroes || []).filter(h => h.name).every(h => h.hp > 0)) {
            if (reason === 'surrender') {
              // Only eligible on surrender if opponent lost ≥1 hero AND turn ≥5
              const oppHeroes = opp.heroes || [];
              const oppDead = oppHeroes.filter(h => h.name && h.hp <= 0).length;
              met = oppDead >= 1 && turn >= 5;
            } else {
              met = true;
            }
          }
          break;
        case 'win_last_hero_low':
          if (isWinner) {
            const alive = (ps.heroes || []).filter(h => h.name && h.hp > 0);
            met = alive.length === 1 && alive[0].hp < alive[0].maxHp * 0.5;
          }
          break;
        case 'win_deck_out':
          met = isWinner && reason === 'deck_out';
          break;
        case 'win_support_full':
          met = isWinner && t.allSupportFull;
          break;
        case 'damage_instance_400':
          met = (t.maxDamageInstance || 0) >= 400;
          break;
        case 'gold_earned_99':
          met = (t.totalGoldEarned || 0) >= 99;
          break;
        case 'win_comeback':
          met = isWinner && t.wasFirstToOneHero;
          break;
        case 'win_flawless':
          met = isWinner && !t.heroEverBelow50;
          break;
        case 'creature_overkill':
          met = t.creatureOverkill;
          break;
        case 'all_abilities_filled': {
          // Check ALL heroes (alive AND dead) have all 3 ability slots filled
          let filled = true;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue; // Skip empty hero slots
            const abZ = ps.abilityZones?.[hi] || [];
            for (let z = 0; z < 3; z++) {
              if ((abZ[z] || []).length === 0) { filled = false; break; }
            }
            if (!filled) break;
          }
          met = filled && (ps.heroes || []).some(h => h.name);
          break;
        }
        case 'all_abilities_level3': {
          // Check ALL heroes (alive AND dead) have all 3 ability slots at level 3
          let maxed = true;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue;
            const abZ = ps.abilityZones?.[hi] || [];
            for (let z = 0; z < 3; z++) {
              if ((abZ[z] || []).length < 3) { maxed = false; break; }
            }
            if (!maxed) break;
          }
          met = maxed && (ps.heroes || []).some(h => h.name);
          break;
        }
        case 'win_turn_30':
          met = isWinner && turn >= 30;
          break;
        case 'win_speedrun':
          met = isWinner && turn <= 6 && reason !== 'surrender';
          break;
        case 'unique_opponents_5': {
          // Count unique opponent IPs today (including this game)
          const uniqueToday = await db.get(
            `SELECT COUNT(DISTINCT opponent_ip) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND created_at >= ?`,
            [ps.userId, todayStart]
          );
          // +1 for current game if this is a new IP
          const prevPlayed = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND opponent_ip = ? AND created_at >= ?`,
            [ps.userId, oppIp, todayStart]
          );
          const totalUnique = (uniqueToday?.cnt || 0) + (prevPlayed?.cnt === 0 ? 1 : 0);
          met = totalUnique >= 5;
          break;
        }
        case 'first_win':
          if (isWinner) {
            const prevWins = await db.get(
              `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'first_blood'`,
              [ps.userId]
            );
            met = (prevWins?.cnt || 0) === 0;
          }
          break;
        case 'good_game':
          met = turn >= 7
            && gameDuration >= 5 * 60 * 1000
            && (tracking[0].totalHpLost || 0) >= 400
            && (tracking[1].totalHpLost || 0) >= 400;
          break;
        default:
          break;
      }

      if (!met) continue;

      // Check limit
      let allowed = true;
      switch (reward.limit) {
        case 'daily_per_opponent_ip': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND opponent_ip = ? AND created_at >= ?`,
            [ps.userId, reward.id, oppIp, todayStart]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'daily': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND created_at >= ?`,
            [ps.userId, reward.id, todayStart]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'once': {
          const prev = await db.get(
            `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ?`,
            [ps.userId, reward.id]
          );
          allowed = (prev?.cnt || 0) === 0;
          break;
        }
        case 'unlimited':
          allowed = true;
          break;
      }

      if (!allowed) continue;

      // Check daily cap per opponent
      if (reward.limit !== 'once') {
        const dailyFromOpp = await db.get(
          `SELECT COALESCE(SUM(amount), 0) as total FROM sc_log WHERE user_id = ? AND opponent_ip = ? AND created_at >= ?`,
          [ps.userId, oppIp, todayStart]
        );
        const alreadyEarned = dailyFromOpp?.total || 0;
        if (alreadyEarned >= SC_DAILY_CAP_PER_OPPONENT) continue;
      }

      earned.push({ id: reward.id, title: reward.title, amount: reward.amount, description: reward.description });
    }

    // Record SC earnings
    if (earned.length > 0) {
      let total = 0;
      for (const r of earned) {
        await db.run(
          'INSERT INTO sc_log (id, user_id, reward_id, opponent_id, opponent_ip, amount) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), ps.userId, r.id, opp.userId, oppIp, r.amount]
        );
        total += r.amount;
      }
      await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [total, ps.userId]);
      results[pi] = { rewards: earned, total };
    }
  }

  return results;
}

// ===== DAILY CHALLENGE BONUS (PvP wins) =====
// Awards bonus SC to a winner whose deck contains 2+ of their active daily
// challenge Heroes. Big bonus (10 SC for 2, 20 SC for 3) pays out once per
// challenge; subsequent qualifying wins during the same challenge pay 1 SC.
// Applies the same anti-farm gates as evaluateSCRewards.
async function awardDailyChallengeBonus(room, winnerIdx, reason) {
  const gs = room?.gameState;
  if (!gs) return null;
  const winner = gs.players?.[winnerIdx];
  if (!winner?.userId) return null;
  // Both sides must be human (skip CPU / bot games).
  if (!gs.players?.[winnerIdx === 0 ? 1 : 0]?.userId) return null;

  // Anti-farm gates mirroring evaluateSCRewards.
  const ip0 = gs._playerIPs?.[0] || 'unknown';
  const ip1 = gs._playerIPs?.[1] || 'unknown';
  if (ip0 !== 'unknown' && ip0 === ip1) return null;
  if (reason === 'disconnect_timeout') return null;

  const tracking = gs._scTracking || { 0: {}, 1: {} };
  const startTime = gs._gameStartTime || Date.now();
  if (Date.now() - startTime < SC_MIN_GAME_DURATION_MS) return null;
  if ((gs.turn || 0) < SC_MIN_TURNS) return null;
  if ((tracking[0]?.cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return null;
  if ((tracking[1]?.cardsPlayedFromHand || 0) < SC_MIN_CARDS_PLAYED) return null;
  if (reason === 'surrender') {
    const anyDamage = gs.players.some(ps => (ps.heroes || []).some(h => h.name && h.hp < h.maxHp));
    if (!anyDamage) return null;
  }

  const userRow = await db.get(
    'SELECT daily_heroes, daily_start_ts, daily_claimed_big FROM users WHERE id = ?',
    [winner.userId]
  );
  const active = getActiveDaily(userRow);
  if (!active) return null;

  const winnerHeroNames = new Set((winner.heroes || []).filter(h => h?.name).map(h => h.name));
  const matched = active.heroes.filter(n => winnerHeroNames.has(n)).length;
  if (matched < 2) return null;

  let amount = 0;
  let newClaimed = active.claimedBig;
  if (active.claimedBig === 0) {
    amount = matched >= 3 ? 20 : 10;
    newClaimed = amount;
  } else {
    amount = 1;
  }

  await db.run(
    'UPDATE users SET sc = sc + ?, daily_claimed_big = ? WHERE id = ?',
    [amount, newClaimed, winner.userId]
  );

  return {
    matched,
    amount,
    claimedBig: newClaimed,
    title: matched >= 3
      ? 'Daily Challenge — 3/3 Heroes!'
      : (active.claimedBig === 0 ? 'Daily Challenge — 2 Heroes' : 'Daily Challenge — repeat win'),
    description: `${matched} of your 3 daily Heroes`,
  };
}

// ===== GAME ROOMS (Socket.io) =====
const rooms = new Map();

/**
 * Raum abbauen — IMMER hierueber, nie `rooms.delete` direkt.
 *
 * Legt vorher die Engine stumm. Eine gerade laufende Kette lebt als
 * async-Kaskade weiter, auch wenn der Raum aus der Map verschwindet;
 * ohne `abort()` loest sie zu Ende auf und sendet ihre Ereignisse an
 * den Client, der inzwischen im NEUEN Spiel sitzt (Als Befund 5.8.:
 * nach Escape+Retry landeten Lunar Eclipse und ihr geopferter Lunatic
 * Cycle sofort im frischen Versuch in der Ablage, und die Ketten-
 * anzeige blieb dauerhaft haengen).
 */
function destroyRoom(roomId) {
  const _r = rooms.get(roomId);
  try { _r?.engine?.abort?.(); } catch { /* Abbau darf nie werfen */ }
  return rooms.delete(roomId);
}
const activeGames = new Map(); // userId -> roomId
const disconnectTimers = new Map(); // userId -> timeout handle

// ===== LIVE STATS =====
// Cheap public snapshot for the main-menu hub panels: how many clients
// are currently connected and how many distinct games are in progress.
// Defined here (rather than next to the other /api routes) so it can see
// the `activeGames` map declared just above. Express runs the handler at
// request time, long after the rest of the module has evaluated.
app.get('/api/stats/live', (req, res) => {
  res.json({
    playersOnline: io.engine.clientsCount,
    gamesLive: new Set(activeGames.values()).size,
  });
});

/**
 * After a potion resolves, check if any hero on the player's side
 * has a potionLockAfterN flag and the threshold has been met.
 * Generic replacement for hardcoded hero-name checks.
 */
function checkPotionLock(ps, gs, pi) {
  ps.potionsUsedThisTurn = (ps.potionsUsedThisTurn || 0) + 1;
  // Check own heroes
  for (const hero of (ps.heroes || [])) {
    if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) continue;
    const heroScript = loadCardEffect(hero.name);
    if (heroScript?.potionLockAfterN && ps.potionsUsedThisTurn >= heroScript.potionLockAfterN) {
      ps.potionLocked = true;
      return;
    }
  }
  // Check charmed opponent heroes controlled by this player
  if (gs && pi != null) {
    const oi = pi === 0 ? 1 : 0;
    for (const hero of (gs.players[oi]?.heroes || [])) {
      if (!hero?.name || hero.hp <= 0 || hero.statuses?.negated) continue;
      if (hero.charmedBy !== pi) continue;
      const heroScript = loadCardEffect(hero.name);
      if (heroScript?.potionLockAfterN && ps.potionsUsedThisTurn >= heroScript.potionLockAfterN) {
        ps.potionLocked = true;
        return;
      }
    }
  }
}

/**
 * Find the current hand index of a resolving card tracked by nth-occurrence.
 * Returns -1 if the card was removed from hand (self-discarded).
 */
// Aufgeschobene Handentnahme — liegt seit v414 in einem eigenen Modul,
// weil server.js beim Laden einen Server startet und die Logik dort
// nicht testbar war. Verhalten unveraendert; `getResolvingHandIndex`
// bleibt als lokaler Name erhalten, damit alle Aufrufstellen gleich
// bleiben.
const {
  beginHandResolve,
  getResolvingHandIndex,
  commitHandResolve,
  abortHandResolve,
  eligibleIndicesWithoutResolving,
} = require('./cards/effects/_hand-resolve.js');

function sendGameState(room, playerIdx, extra) {
  if (room.engine?._fastMode) return; // Silent during MCTS simulations.
  // ── STILLGELEGTE ENGINE SENDET NICHTS MEHR ────────────────────────
  // `abort()` hat bisher nur `engine.sync()` und `_broadcastEvent`
  // abgeklemmt — `sendGameState` ist aber eine SERVER-Funktion und
  // lief weiter. Sie schickt an `p.socketId`, also an genau den
  // Socket, der nach einem Puzzle-Retry schon im NEUEN Spiel sitzt:
  // der Client bekam den ALTEN Spielzustand aufgedrueckt (Karten in
  // der Ablage, Kettensperre aktiv) und war handlungsunfaehig.
  //
  // Beleg aus Als Log: `[abort]` und `[destroyRoom]` liefen korrekt,
  // aber das `[lock] Kettenfenster ZU` kam ERST DANACH — die alte
  // Kette war also noch minutenlang am Aufloesen und hat in dieser
  // Zeit weiter Spielzustaende verschickt.
  if (room.engine?._aborted) return;
  const p = room.players[playerIdx];
  if (!p?.socketId) return;
  const gs = room.gameState;
  if (!gs) return;

  // Terror: force end turn if threshold reached.
  //
  // Defer firing while ANY effect, prompt, or chain is still in flight.
  // Without this gate, a sync() emitted from inside a hero/creature/ability
  // effect (e.g. Siphem mid-onHeroEffect, before its prompts resolve) would
  // run runPhase(5) here while the effect is still awaiting a player
  // response — the effect then resumes during the *next* turn. The flag
  // stays set, so the next `sendGameState` after the effect / chain fully
  // resolves picks it up.
  if (gs._terrorForceEndTurn != null && !gs._terrorProcessing && room.engine) {
    const phase = gs.currentPhase;
    const engine = room.engine;
    const heroEffectActive = gs._heroEffectInProgress
      && Object.values(gs._heroEffectInProgress).some(v => v);
    const cardResolving = (gs.players || []).some(p => p?._resolvingCard);
    const promptOpen = !!(engine._pendingPrompt || engine._pendingGenericPrompt);
    const chainOpen = !!engine._inReactionCheck;
    const midEffect = heroEffectActive || cardResolving || promptOpen || chainOpen;
    // Only force during playable phases (Main1, Action, Main2)
    if (phase >= 2 && phase <= 4 && !midEffect) {
      const terrorPi = gs._terrorForceEndTurn;
      const terrorSrc = gs._terrorForceEndSource || { owner: terrorPi };

      // ── ZUG-ENDE-RIEGEL (v436) ────────────────────────────────────
      // Dieser Pfad laeuft NICHT ueber `advanceToPhase` — er ruft
      // `runPhase(5)` direkt. Der Riegel dort greift hier also nicht,
      // und deshalb muss er hier eigens stehen.
      //
      // Als Befund 17.8.: Tuscan Prisoner hielt Doom Prophecy nicht auf.
      // Grund war meine falsche Annahme in v429, Terror werde immer
      // schon an der Schwelle (`_checkTerrorThreshold`) abgefangen. Das
      // stimmt fuer Terror selbst — aber **Doom Prophecy setzt
      // `_terrorForceEndTurn` direkt aus dem Kartenskript** und laeuft
      // an der Schwelle vorbei. Der Verbraucher hier ist der einzige
      // gemeinsame Engpass beider Setzer und damit die richtige Stelle.
      if (room.engine._blackstacheBlocksTurnEnd(terrorPi, terrorSrc)) {
        // NUR die Marken raeumen und weiterlaufen lassen. KEIN `return`
        // und kein eigener Zustandsversand: dieser Block sitzt MITTEN IN
        // `sendGameState`, das direkt darunter den Zustand aufbaut und
        // verschickt. Ein Abbruch hier haette genau diesen Versand
        // verschluckt, ein eigener Versand wuerde sich rekursiv aufrufen.
        delete gs._terrorForceEndTurn;
        delete gs._terrorForceEndSource;
        room.engine.log('turn_end_blocked', {
          player: gs.players[terrorPi]?.username,
          source: terrorSrc.name || null,
          via: 'terrorForceEndTurn',
        });
      } else {
        gs._terrorProcessing = true;
        delete gs._terrorForceEndTurn;
        delete gs._terrorForceEndSource;
        setTimeout(() => {
          gs._terrorProcessing = false;
          room.engine.runPhase(5).then(() => { // PHASES.END = 5
            for (let i = 0; i < 2; i++) sendGameState(room, i);
            sendSpectatorGameState(room);
          }).catch(err => console.error('[Terror] force end error:', err.message));
        }, 500);
      }
    }
  }
  const state = {
    myIndex: playerIdx, roomId: room.id,
    players: gs.players.map((ps, pi) => ({
      username: ps.username, color: ps.color, avatar: ps.avatar, cardback: ps.cardback || null, board: ps.board || null,
      victoryMsg: ps.victoryMsg || '', defeatMsg: ps.defeatMsg || '',
      // ★ Teilt dieser Spieler seine Support-Zonen („Alice, the Transfer
      // Student")? Gehoert HIERHER, in den pro-Spieler-Block neben
      // `heroes` und `supportZones` — der Client liest ihn als
      // `me.sharesSupportZones`. Beim ersten Versuch (v487) stand er auf
      // der TOP-Ebene des Spielstands; `me` ist aber
      // `gameState.players[myIdx]`, also war er dort immer undefined und
      // die ganze Drop-/Klick-Logik lief ins Leere.
      // Aus dem Spielerzustand, nicht vom Brett — die Wirkung ueberlebt
      // Alices Tod.
      sharesSupportZones: !!ps._aliceShareActive,
      heroes: ps.heroes, abilityZones: ps.abilityZones,
      surpriseZones: pi === playerIdx ? ps.surpriseZones : ps.surpriseZones.map((sz, hi) => (sz || []).map(cn => {
        // Puzzle mode: reveal opponent (CPU) surprises so the player can
        // plan around them — they're part of the puzzle's authored setup,
        // not hidden information the player is supposed to discover. The
        // client's BoardZone face-down test keys on the `'?'` placeholder,
        // so returning the real name here is sufficient to flip the
        // rendering to face-up. `surpriseKnown` deliberately stays false
        // so the "semi-transparent re-set" decoration (which means "the
        // opponent has seen this via an effect") doesn't get applied —
        // puzzle reveals are by-design, not by Premonition / similar.
        if (gs.isPuzzle) return cn;
        // Face-up surprises (activated) are visible to opponent
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === cn);
        if (inst && !inst.faceDown) return cn;
        // Known surprises (re-set) are visible but marked as known
        if (inst && inst.knownToOpponent) return cn;
        return '?';
      })),
      surpriseFaceDown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return null;
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return inst ? inst.faceDown : true;
      }),
      surpriseKnown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return false;
        const inst = room.engine?.cardInstances.find(c => c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return !!(inst && inst.faceDown && inst.knownToOpponent);
      }),
      // Effective per-Surprise level after board-wide reductions
      // (Spider Hive's `globalReduceCardLevel`, any future "reduce
      // Surprise level" Area). Per slot: the level the Surprise
      // would actually need to be Activated at right now. `null`
      // when the slot is empty / the card is not visible to the
      // recipient (face-down opp Surprise outside puzzle mode); the
      // client only renders the badge when this differs from the
      // printed level. Computed via the engine's
      // `effectiveCardLevel` so any new level-reduction mechanism
      // composes automatically.
      surpriseEffectiveLevels: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return null;
        const name = sz[0];
        const cardDB = room.engine?._getCardDB?.();
        const cd = cardDB?.[name];
        if (!cd) return null;
        // Hidden opp Surprise outside puzzle mode → don't leak level.
        if (pi !== playerIdx && !gs.isPuzzle) {
          const inst = room.engine?.cardInstances.find(c =>
            c.owner === pi && c.zone === 'surprise' && c.heroIdx === hi && c.name === name);
          if (inst?.faceDown && !inst?.knownToOpponent) return null;
        }
        try { return room.engine.effectiveCardLevel(cd, pi); }
        catch { return null; }
      }),
      supportZones: pi === playerIdx ? ps.supportZones : ps.supportZones.map((heroSlots, hi) => (heroSlots || []).map((slot, si) => {
        if (!slot || slot.length === 0) return slot;
        const inst = room.engine?.cardInstances.find(c =>
          c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.faceDown
        );
        if (inst?.faceDown && !inst.knownToOpponent) return ['?']; // Unknown face-down: show cardback
        return slot;
      })),
      islandZoneCount: ps.islandZoneCount || [0,0,0],
      // Reveal CPU hand in singleplayer games so the human tester can
      // see what the CPU is holding. Has no effect on MP games or the
      // CPU itself (the CPU brain reads from gs directly, not the
      // redacted client-side state).
      hand: (pi === playerIdx
             || (room.type === 'singleplayer' && DEBUG_REVEAL_NPC_HAND)
             || room.type === 'puzzle') ? ps.hand : [], handCount: ps.hand.length,
      revealedHandCards: pi !== playerIdx ? (() => {
        // SINGLEPLAYER debug reveal: show every card in the CPU's hand.
        // The client renders `revealedHandCards` as face-up tiles, so
        // populating all indexes here surfaces the whole hand without
        // requiring client-side changes. Gated on DEBUG_REVEAL_NPC_HAND
        // so public builds don't leak CPU information.
        if (room.type === 'singleplayer' && DEBUG_REVEAL_NPC_HAND) {
          return ps.hand.map((name, index) => ({ index, name }));
        }
        // Puzzle mode reveals the CPU opponent's full hand to the
        // player — solving puzzles requires perfect information about
        // what the opponent can react with. Mark mechanically-revealed
        // slots (auto-reveal Crystals like Treacherous Crystal,
        // Crystal-Well-given cards routed through `revealOnEnterHand`,
        // Bamboo Shield, etc.) with `permanent: true` so the client
        // can paint an extra indicator over them — otherwise the
        // puzzle-wide reveal flattens the visual distinction between
        // "the puzzle exposes everything" and "this card is actually
        // revealed by the rules right now".
        if (room.type === 'puzzle') {
          const permaSet = new Set();
          const permaMap = ps._permanentlyRevealedHandIndices || {};
          for (const kStr of Object.keys(permaMap)) {
            const idx = +kStr;
            if (idx >= 0 && idx < ps.hand.length) permaSet.add(idx);
          }
          // Per-instance `_permanentlyRevealed` → map to hand position
          // via Kth-by-name rank, matching the splice interceptor.
          const trackingRank = {};
          for (const inst of (room.engine?.cardInstances || [])) {
            if (inst.owner !== pi) continue;
            if (inst.zone !== 'hand') continue;
            const rank = trackingRank[inst.name] || 0;
            trackingRank[inst.name] = rank + 1;
            if (inst.counters?._permanentlyRevealed) {
              let seen = 0;
              for (let i = 0; i < ps.hand.length; i++) {
                if (ps.hand[i] !== inst.name) continue;
                if (seen === rank) { permaSet.add(i); break; }
                seen++;
              }
            }
          }
          return ps.hand.map((name, index) => permaSet.has(index)
            ? { index, name, permanent: true }
            : { index, name });
        }
        const result = [];
        const seenIdx = new Set();
        const pushReveal = (idx) => {
          if (seenIdx.has(idx)) return;
          if (idx < 0 || idx >= ps.hand.length) return;
          seenIdx.add(idx);
          result.push({ index: idx, name: ps.hand[idx] });
        };
        // Per-hand-index reveals via the engine's
        // `registerHandIndexedField` registry (Luna Kiai's per-turn
        // `_revealedHandIndices`, Bamboo Shield's permanent
        // `_permanentlyRevealedHandIndices`). The splice interceptor
        // and `reorder_hand` remap keep these maps consistent with
        // the physical copy across every hand mutation.
        const indexMap = ps._revealedHandIndices || {};
        for (const kStr of Object.keys(indexMap)) pushReveal(+kStr);
        const permaMap = ps._permanentlyRevealedHandIndices || {};
        for (const kStr of Object.keys(permaMap)) pushReveal(+kStr);
        // Per-instance reveals (Luna Kiai per-turn via `_revealedThisTurn`,
        // Bamboo Shield permanent via `_permanentlyRevealed`): map each
        // revealed inst to its specific hand position via rank-by-name
        // correspondence (K-th tracked inst of name X ↔ K-th hand
        // position of name X). Inverse of `_findHandInstanceAt`. The
        // earlier "count + mark first N" version always exposed the
        // leftmost matching slot regardless of which copy was actually
        // revealed — visible bug with multiple copies of the same card.
        const revealedRanks = {};
        const trackingRank  = {};
        for (const inst of (room.engine?.cardInstances || [])) {
          if (inst.owner !== pi) continue;
          if (inst.zone !== 'hand') continue;
          const name = inst.name;
          const rank = trackingRank[name] || 0;
          trackingRank[name] = rank + 1;
          if (inst.counters?._permanentlyRevealed || inst.counters?._revealedThisTurn) {
            if (!revealedRanks[name]) revealedRanks[name] = new Set();
            revealedRanks[name].add(rank);
          }
        }
        if (Object.keys(revealedRanks).length > 0) {
          const handRank = {};
          for (let i = 0; i < ps.hand.length; i++) {
            if (seenIdx.has(i)) { /* still need to bump rank */ }
            const name = ps.hand[i];
            const k = handRank[name] || 0;
            handRank[name] = k + 1;
            if (revealedRanks[name]?.has(k) && !seenIdx.has(i)) {
              pushReveal(i);
            }
          }
        }
        // Legacy count-based reveals (Madaga's temporary reveal): pick
        // the last-N matching copies. Skip indices already exposed by
        // the per-index map to avoid double-listing.
        const counts = ps._revealedCardCounts;
        if (counts && Object.keys(counts).length > 0
            && (!ps._revealedCardExpiry || Date.now() < ps._revealedCardExpiry)) {
          const used = new Set(result.map(r => r.index));
          const remaining = { ...counts };
          for (let i = ps.hand.length - 1; i >= 0; i--) {
            if (used.has(i)) continue;
            const name = ps.hand[i];
            if (remaining[name] > 0) {
              result.push({ index: i, name });
              remaining[name]--;
            }
          }
        }
        return result;
      })() : [],
      mainDeckCards: pi === playerIdx ? ps.mainDeck : [], deckCount: ps.mainDeck.length,
      // Public-knowledge top of deck (Premonition stash, etc.) — sent
      // to both players. Validated against `mainDeck` here so any
      // out-of-band shuffle/mutation that didn't update the array
      // gracefully falls back to "no visibility" instead of leaking
      // an outdated name.
      deckTopVisible: (() => {
        const dtv = ps.deckTopVisible || [];
        if (dtv.length === 0) return [];
        const cap = Math.min(dtv.length, ps.mainDeck.length);
        let valid = 0;
        while (valid < cap && dtv[valid] === ps.mainDeck[valid]) valid++;
        return dtv.slice(0, valid);
      })(),
      potionDeckCards: pi === playerIdx ? ps.potionDeck : [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      // Ablage-Eintraege, die gerade eine FREMDE IDENTITAET tragen
      // (Future Tech Copy Device). `{ echterName: aktuelleIdentitaet }`.
      // Der Client zeigt sie beim Ueberfahren an — dieselbe Auskunft,
      // die eine als Equip liegende Kopie ueber ihr Kartenbild gibt
      // (Als Vorgabe 22.8.). Kein verstecktes Wissen: Ablagen sind
      // ohnehin fuer beide Seiten einsehbar.
      discardIdentities: require('./cards/effects/_future-tech-shared')
        .ablageIdentitaeten(gs, pi),
      discardEntries: room.engine ? room.engine.getDiscardEntries(pi) : [],
      // Lethe per-pile +1 stamps — `{ [cardName]: [stampCount, ...] }`
      // sized to combined discard+deleted occurrences. Forwarded to the
      // client so pile-viewer / cardGallery / BoardCard renderings can
      // surface the effective level on stamped Creatures. Shared with
      // both sides (no hidden-info concern: stamps are derived from
      // public actions — every Lethe Necromancy resolution is logged).
      letheStamps: ps._letheStamps || {},
      disconnected: ps.disconnected || false, left: ps.left || false,
      // Gold display can be temporarily frozen for cost-bypass flows
      // (Swagdri's free-play of an X-cost Artifact bumps gold by a
      // headroom buffer so the artifact's internal cost check passes,
      // then restores). `_goldFreeze` exposes the original value to
      // the client during that window so the diff-detector doesn't
      // flash spurious +9999 / -9999 floaters.
      gold: ps._goldFreeze != null ? ps._goldFreeze : (ps.gold || 0),
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false,false,false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      oppHandLocked: ps.oppHandLocked || false,
      itemLocked: ps.itemLocked || false,
      // Boomerang's "no Artifacts for the rest of this turn" lockout —
      // surfaced as a clean boolean so the client can grey out hand
      // Artifacts and show a debuff badge. Self-expires when the turn
      // number rolls over (the underlying flag holds the lock-turn).
      artifactLocked: (ps._artifactLockTurn === gs.turn) || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: room.engine ? room.engine.arePotionsLockedFor(pi) : (ps.potionLocked || false),
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
      handLocked: ps.handLocked || false,
      drawLocked: ps.drawLocked || false,
      flashbanged: ps._flashbangedDebuff || false,
      forsaken: ps._discardToDeleteActive || false,
      // Giga Steroids — owner-wide second-Action grant for effect
      // activations. Set on resolve, cleared on consume / fizzle /
      // expire by Giga Steroids' hooks. Read by the client to render
      // the "On Steroids" buff badge in the top-of-board strip.
      onSteroids: ps.onSteroids || false,
      creationLockedNames: (pi === playerIdx && ps._creationLockedNames) ? [...ps._creationLockedNames] : [],
      // Reiner Zieh-Lock (Sacred Jewel): graut nur Karten mit
      // blockedByDrawLock — Search-Karten bleiben spielbar.
      drawLockBlockedCards: (ps.drawLocked && pi === playerIdx) ? (() => {
        const blocked = new Set();
        const dlDB = getCardDB();
        for (const cn of ps.hand) {
          const scr = loadCardEffect(cn);
          if (!scr?.blockedByDrawLock) continue;
          const cd = dlDB[cn];
          if (cd?.cardType === 'Ability' || cd?.cardType === 'Creature') continue;
          blocked.add(cn);
        }
        return [...blocked];
      })() : [],
      handLockBlockedCards: (ps.handLocked && pi === playerIdx) ? (() => {
        const blocked = new Set();
        const handCardDB = getCardDB();
        for (const cn of ps.hand) {
          const scr = loadCardEffect(cn);
          if (!scr?.blockedByHandLock) continue;
          const cd = handCardDB[cn];
          // Abilities can still be placed in hand — only block on board.
          if (cd?.cardType === 'Ability') continue;
          // Creatures stay summon-eligible under hand-lock. Their
          // draw-only activated effect (e.g. Skeleton Mage's draw 2 /
          // discard 1) is gated separately via
          // `canActivateCreatureEffect`. The Creature itself still has
          // body/HP/triggers/buff potential beyond the draw, so the
          // hand-lock should not gate the summon. Mirrors the
          // server-side `validateActionPlay` exemption for Creatures.
          if (cd?.cardType === 'Creature') continue;
          blocked.add(cn);
        }
        return [...blocked];
      })() : [],
      neverPlayableCards: pi === playerIdx ? ps.hand.filter(cn => loadCardEffect(cn)?.neverPlayable) : [],
      // Karten, deren EIGENES Gate (`canPlayWithHero`) sie gerade
      // sperrt — Debt-O-Tron: „only while you have less than 0 Gold",
      // „only summon 1 per turn", und die Handkarte, die als Kosten
      // geloescht werden muss. Der Client kennt keine Kartenskripte und
      // hat bis 16.8. NUR die Kosten geprueft; die Debt-O-Trons sahen
      // deshalb spielbar aus, obwohl der Server sie ablehnt (Als
      // Report). Geprueft gegen ALLE eigenen Helden: gesperrt ist eine
      // Karte nur, wenn sie bei KEINEM spielbar waere.
      cardGateBlockedCards: pi === playerIdx ? (() => {
        const raus = new Set();
        for (const cn of new Set(ps.hand || [])) {
          let sc = null;
          try { sc = loadCardEffect(cn); } catch { continue; }
          if (typeof sc?.canPlayWithHero !== 'function') continue;
          const cd = getCardDB()[cn];
          let irgendwoSpielbar = false;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            if (!ps.heroes[hi]?.name) continue;
            try {
              if (sc.canPlayWithHero(gs, pi, hi, cd, room.engine)) { irgendwoSpielbar = true; break; }
            } catch { irgendwoSpielbar = true; break; }   // kaputtes Gate sperrt nicht
          }
          if (!irgendwoSpielbar) raus.add(cn);
        }
        return [...raus];
      })() : [],
      // Per-instance hand-card level offsets (Rocky Slime, persistent
      // — carries onto the summoned support instance). Owner-only:
      // the opponent shouldn't see which copies are reduced. Maps
      // hand-index → numeric offset (currently always negative).
      handLevelOffsets: pi === playerIdx ? { ...(ps._handLevelOffsets || {}) } : {},
      // Transient sibling (Sparkfly Queen's "as if levels were reduced
      // by 3" rebate). Same hand-index keying; the offset evaporates
      // when the card leaves the hand.
      handLevelOffsetsTransient: pi === playerIdx ? { ...(ps._handLevelOffsetsTransient || {}) } : {},
      // Per-hand-index hero filter (Sparkfly Queen). When an entry
      // exists for a slot, the corresponding offset only applies to
      // the named hero; the client repaints that slot's level badge
      // dark green to mark the limitation.
      handLevelOffsetHeroFilter: pi === playerIdx ? { ...(ps._handLevelOffsetHeroFilter || {}) } : {},
      // Dynamic-reduction sibling — populated by the same client-side
      // badge logic that already merges `handLevelOffsets` /
      // `handLevelOffsetsTransient`. Sources level reductions from
      // cards that compute their own offset on the fly via the
      // `reduceCardLevel` hook (The Bonegrinder counting Skeletons in
      // discard, plus any future card with similar text), instead of
      // stamping a stored offset onto a specific hand slot. Computed
      // here per sendGameState so the badge stays in sync with the
      // engine's actual gate-check (`_applyCardLevelReductions`) — no
      // separate client-side reproduction of every reduceCardLevel
      // implementation needed. Owner-only: the opponent doesn't see
      // hand contents, so the map is irrelevant to them.
      handLevelOffsetsDynamic: pi === playerIdx ? (() => {
        const out = {};
        if (!room.engine) return out;
        const cardDB = getCardDB();
        for (let i = 0; i < (ps.hand || []).length; i++) {
          const cd = cardDB[ps.hand[i]];
          if (!cd || !cd.level) continue;
          let reduced;
          try { reduced = room.engine._applyCardLevelReductions(cd, cd.level, pi); }
          catch { continue; }
          if (reduced < cd.level) out[i] = reduced - cd.level; // negative offset
        }
        return out;
      })() : {},
      // Per-instance Artifact cost reductions (Play Money). Owner-only:
      // the opponent shouldn't see which copies are discounted. The
      // client renders an effective-cost badge on each tagged hand
      // card, and the play-from-hand path uses the same map to compute
      // what the owner actually pays.
      handCostReductions: pi === playerIdx ? (() => {
        // Per-hand-index reduction the client renders/affordability-
        // checks against = the per-turn map (Play Money) PLUS the
        // permanent map (New Moon's searched card), summed per index.
        const merged = { ...(ps._handCostReductions || {}) };
        const perm = ps._handCostReductionsPermanent || {};
        for (const k of Object.keys(perm)) merged[k] = (merged[k] || 0) + (perm[k] || 0);
        // Namensweiter Nullpreis (Misfire): fuer die ANZEIGE auf jeden
        // Handindex dieses Namens uebersetzt — der Spieler soll auf
        // JEDER Kopie sehen, dass sie gerade nichts kostet. Verbraucht
        // wird trotzdem nur einmal, beim tatsaechlichen Spielen.
        const frei = ps._freeArtifactNames || {};
        const db = room.engine._getCardDB();
        (ps.hand || []).forEach((n, i) => {
          if (frei[n]) merged[i] = Math.max(merged[i] || 0, db[n]?.cost || 0);
          // Selbstrabatt der Karte (Laser Cannon) fuer die ANZEIGE
          // mitrechnen — sonst zeigt die Hand 60 an, der Server nimmt
          // aber 20, und die Oberflaeche graut die Karte faelschlich aus.
          const sk = loadCardEffect(n);
          if (typeof sk?.selfCostReduction === 'function') {
            const r = sk.selfCostReduction(gs, pi, db[n], room.engine) || 0;
            if (r > 0) merged[i] = (merged[i] || 0) + r;
          }
        });
        return merged;
      })() : {},
      supportSpellLocked: ps.supportSpellLocked || false,
      comboLockHeroIdx: ps.comboLockHeroIdx ?? null,
      heroesActedThisTurn: ps.heroesActedThisTurn || [],
      // Kreditrahmen (Debt-O-Tron/Kent). Der Client rechnet ihn beim
      // Ausgrauen der Handkarten mit — sonst sperrt die Oberflaeche
      // Karten, die der Server laengst erlaubt. Ohne den Archetyp 0.
      goldOverdraft: room.engine.goldOverdraftLimit(pi),
      // Karten, die sich SELBST finanzieren („Debt-O-Tron Damage Fees":
      // spielbar auch bei negativem Gold). Der Rahmen darueber gilt
      // kartenunabhaengig und wuerde diese Karten faelschlich ausgrauen;
      // der Client behandelt Namen aus dieser Liste als immer bezahlbar.
      // Nur die eigene Hand, und nur Namen — kein Kartenskript im Client.
      goldSelfOverdraftCards: pi === playerIdx
        ? [...new Set((ps.hand || []).filter(n => {
            try { return !!loadCardEffect(n)?.selfGoldOverdraft; } catch { return false; }
          }))]
        : [],
      permanents: ps.permanents || [],
      coolnessStack: ps.coolnessStack || [],
      // Whether the top of THIS player's Stack is playable from the
      // Stack right now. Clients use this flag to highlight the Stack
      // pile (cyan glow) and route a click into the play-from-Stack
      // confirm dialog instead of the pile viewer.
      coolnessStackTopPlayable: (() => {
        const stack = ps.coolnessStack || [];
        if (stack.length === 0) return false;
        const top = stack[stack.length - 1];
        const scr = loadCardEffect(top);
        return !!(scr && (scr.playableFromCoolnessStack || scr.summonableFromCoolnessStack));
      })(),
      oncePerGameUsed: ps._oncePerGameUsed ? [...ps._oncePerGameUsed] : [],
      resolvingCard: ps._resolvingCard || null,
      deckSkins: ps.deckSkins || {},
      poisonDmgPerStack: room.engine ? room.engine.getPoisonDamagePerStack(pi) : 30,
    })),
    areaZones: gs.areaZones,
    // Doom Counter leben auf der Karten-INSTANZ, die nicht mit
    // geschickt wird — `_doom-clock-shared.syncDisplay` spiegelt den
    // Stand hierher, damit die Zone ihn anzeigen kann (Als Befund
    // 5.8.: "ich sehe immer 0"). Ohne diese Zeile blieb der Spiegel
    // serverseitig stehen und kam nie beim Client an.
    doomCounters: gs.doomCounters || null,
    turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    isPuzzle: gs.isPuzzle || false,
    isTutorial: gs.isTutorial || false,
    // Kampagnen-Duell: das Kampffeld blendet damit Deck-Auswahl und
    // Revanche aus und zeigt stattdessen "Weiter" (der Ausgang gehört
    // der Story, nicht dem Spieler).
    isCampaign: gs.isCampaign || false,
    campaignRetry: gs.campaignRetry !== false,
    campaignAnte: gs.isAnte || false,
    isCpuBattle: room.type === 'singleplayer',
    // Gegnerspezifisches Battle-Theme (Slug ohne 'bgm_'-Präfix und
    // Endung). null → der Client nimmt das generische Kampfthema.
    cpuBgm: cpuBgmForRoom(room),
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    // Compute fresh per-sync so per-turn gates (Deepsea `canSummon`,
    // etc.) flip to "blocked" the moment the first copy is summoned.
    // The phase-start cache alone would miss mid-turn updates and let
    // a second copy slip through.
    summonBlocked: room.engine ? room.engine.getSummonBlocked(playerIdx) : (gs.summonBlocked || []),
    // Boris-Sperre: eigener Kanal, weil summonBlocked clientseitig nur
    // fuer Creatures gilt. Enthaelt auch den heroIdx des blockenden
    // Boris fuer die Hover-Hervorhebung.
    borisBlocked: room.engine ? room.engine.getBorisBlocked(playerIdx) : { cards: [], heroIdx: -1, owner: -1 },
    customPlacementCards: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (s?.customPlacement) names.add(cn);
      }
      // Effect-driven attach prompts (Pressed Skill, Alex's deck
      // tutor, …) can attach an Ability pulled from deck / discard —
      // i.e. NOT in hand — so the hand scan above misses its
      // customPlacement flag. Without this the client treats
      // Performance as a normal Ability and (wrongly) offers empty
      // ability zones; Performance must ONLY stack onto an existing
      // Lv1/2 Ability. Fold in the active abilityAttachTarget
      // prompt's card for this player. Generic — no card-name
      // hardcode; any future customPlacement Ability is covered.
      const ep = gs.effectPrompt;
      if (ep && ep.type === 'abilityAttachTarget'
          && ep.ownerIdx === playerIdx && ep.cardName
          && !names.has(ep.cardName)) {
        const eps = loadCardEffect(ep.cardName);
        if (eps?.customPlacement) names.add(ep.cardName);
      }
      return [...names];
    })(),
    // Cards whose script declares `usesCustomHostPick: true` — the
    // card's own `beforeSummon` runs a richer host picker (zones +
    // heroes clickable) than the generic spellHeroPick panel can
    // offer, so the client SKIPS that panel for these cards on a
    // click play and emits `play_creature` with the first eligible
    // hero as a placeholder. The card's `beforeSummon` then prompts
    // for the real host. Drag-drop bypasses both flows because the
    // explicit drop slot is the player's host pick (signalled via
    // `viaDragDrop` on the play_creature payload).
    customHostPickCards: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (s?.usesCustomHostPick) names.add(cn);
      }
      return [...names];
    })(),
    ascendedOnlyAbilities: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        const s = loadCardEffect(cn);
        if (s?.ascendedHeroOnly) names.add(cn);
      }
      return [...names];
    })(),
    // Reaction-subtype Artifacts that opt into `proactivePlay: true`
    // can be cast on the player's own turn just like a Normal Artifact
    // (they merely retain the chain-reaction window during the
    // opponent's phase changes). Surface them so the client's hand
    // grey-out doesn't blanket-disable every Reaction Artifact.
    // Server's `doUseArtifactEffect` (see server.js ~line 4700) already
    // respects this opt-in; this list mirrors that to the client.
    proactiveReactionArtifacts: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      const cardDB = getCardDB();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const cd = cardDB[cn];
        if (cd?.cardType !== 'Artifact') continue;
        if ((cd.subtype || '').toLowerCase() !== 'reaction') continue;
        const s = loadCardEffect(cn);
        if (s?.proactivePlay) names.add(cn);
      }
      return [...names];
    })(),
    // Abilities flagged with `restrictedAttachment: true` can never be
    // attached to a Hero by normal play / generic tutors — Divinity is
    // the inaugural example. Surface them so the client gray-out logic
    // can refuse the attach immediately rather than letting the player
    // drag the card onto a hero only to be silently denied server-side.
    restrictedAttachmentAbilities: (() => {
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        const s = loadCardEffect(cn);
        if (s?.restrictedAttachment) names.add(cn);
      }
      return [...names];
    })(),
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    // Surfaced so the client can lock the hand whenever a card / chain
    // is mid-resolution. Engine increments on every spell/attack/artifact
    // resolution AND every chain link; decrements when the link finishes.
    // The client uses this together with each player's `resolvingCard`
    // marker to block hand drag/drop during animation windows where no
    // prompt is yet active. Tested via the Nerdy-Cheese-then-Slippery-
    // Fridge ghost-card race.
    _spellResolutionDepth: gs._spellResolutionDepth || 0,
    terrorCount: gs.activePlayer != null ? (gs._terrorTracking?.[gs.activePlayer] || []).length : 0,
    terrorThreshold: room.engine ? (() => {
      let threshold = Infinity;
      for (let sp = 0; sp < 2; sp++) {
        const sps = gs.players[sp]; if (!sps) continue;
        for (let hi = 0; hi < (sps.heroes || []).length; hi++) {
          const h = sps.heroes[hi];
          if (!h?.name || h.hp <= 0 || h.statuses?.negated) continue;
          let tc = 0; for (const z of (sps.abilityZones[hi] || [])) for (const n of (z || [])) if (n === 'Terror') tc++;
          if (tc > 0) { const t = 10 - tc; if (t < threshold) threshold = t; }
        }
      }
      return threshold === Infinity ? null : threshold;
    })() : null,
    bonusActions: gs.players[playerIdx]?.bonusActions || null,
    bonusMainActions: gs.players[playerIdx]?._bonusMainActions || 0,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    handReturnToOppCards: gs.handReturnToOppCards || [],
    potionTargeting: gs.potionTargeting || null,
    effectPrompt: gs.effectPrompt || null,
    surprisePending: gs.surprisePending || false,
    heroEffectPending: gs.heroEffectPending || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      const currentTurn = gs.turn || 0;
      for (const inst of room.engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        // Key by PHYSICAL side. Temporary steals (Deepsea Succubus,
        // `inst.stolenBy != null`) leave the card on its owner's
        // supportZones array — keyed by owner. Permanent cross-side
        // placements (Chilly Wizard) physically move the card to the
        // controller's supportZones array — keyed by controller. Owner
        // never changes (it tracks the card's true owner for discard /
        // deck routing); `_stolenBy` still surfaces the stealer so the
        // client paints the colored border on the un-moved cases.
        const physicalSide = (inst.stolenBy != null)
          ? inst.owner
          : (inst.controller ?? inst.owner);
        const key = `${physicalSide}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn
          && !inst.counters?._hasHaste
          // Chilly Dog (Mischief Militia) lifts summoning sickness for
          // Frozen Creatures the same player controls — the haste
          // grant is now derived live, so puzzle-mode boards with
          // pre-frozen-sick allies under a Chilly Dog correctly drop
          // the sickness overlay on the client too.
          && !(inst.counters?.frozen
               && room.engine._isChillyDogActiveFor(inst.controller ?? inst.owner))
          && (() => {
            const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
            return !!(script?.creatureEffect);
          })();
        const isFaceDown = !!inst.faceDown;
        const isStolen = inst.stolenBy != null && inst.controller !== inst.owner;
        if (hasCounters || hasSummoningSickness || isFaceDown || isStolen) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
          if (isStolen) cc[key]._stolenBy = inst.stolenBy;
        }
      }
      return cc;
    })() : {},
    supportStacks: buildSupportStacks(room),
    additionalActions: room.engine ? room.engine.getAdditionalActions(playerIdx) : [],
    // Per-card level reductions contributed by board-wide `reduceCardLevel`
    // hooks (Elven Forager, …). Map of cardName → non-negative reduction.
    // Client subtracts this from the card's raw level before running the
    // spell-school-count check, so the UI agrees with the server's
    // `heroMeetsLevelReq` — without forcing the client to replay every
    // board-side hook.
    cardLevelReductions: room.engine ? (() => {
      const result = {};
      const ps2 = gs.players[playerIdx];
      const cardDB = getCardDB();
      const seen = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const cd = cardDB[cn];
        if (!cd) continue;
        const raw = cd.level || 0;
        if (raw <= 0) continue;
        const reduced = room.engine._applyCardLevelReductions(cd, raw, playerIdx);
        const delta = raw - reduced;
        if (delta > 0) result[cn] = delta;
      }
      return result;
    })() : {},
    inherentActionCards: (() => {
      if (!room.engine) return [];
      const { loadCardEffect } = require('./cards/effects/_loader');
      const ps2 = gs.players[playerIdx];
      const names = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (names.has(cn)) continue;
        const s = loadCardEffect(cn);
        if (!s) continue;
        if (s.inherentAction === true) { names.add(cn); continue; }
        if (typeof s.inherentAction === 'function') {
          for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
            if (ps2.heroes[hi]?.name && ps2.heroes[hi].hp > 0 && s.inherentAction(gs, playerIdx, hi, room.engine)) { names.add(cn); break; }
          }
        }
      }
      return [...names];
    })(),
    // Per-hero eligibility for function-based inherent actions (Muscle Training, etc.)
    // Maps card name → array of hero indices that satisfy the inherent condition.
    // Cards with inherentAction === true (always inherent) are NOT listed here.
    inherentActionHeroes: (() => {
      if (!room.engine) return {};
      const { loadCardEffect } = require('./cards/effects/_loader');
      const ps2 = gs.players[playerIdx];
      const result = {};
      const seen = new Set();
      for (const cn of (ps2?.hand || [])) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        const s = loadCardEffect(cn);
        if (!s || typeof s.inherentAction !== 'function') continue;
        const heroes = [];
        for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
          if (ps2.heroes[hi]?.name && ps2.heroes[hi].hp > 0 && s.inherentAction(gs, playerIdx, hi, room.engine)) {
            heroes.push(hi);
          }
        }
        if (heroes.length > 0) result[cn] = heroes;
      }
      return result;
    })(),
    unactivatableArtifacts: room.engine ? room.engine.getUnactivatableArtifacts(playerIdx) : [],
    blockedSpells: room.engine ? room.engine.getBlockedSpells(playerIdx) : [],
    activatableAbilities: room.engine ? room.engine.getActivatableAbilities(playerIdx) : [],
    freeActivatableAbilities: room.engine ? room.engine.getFreeActivatableAbilities(playerIdx) : [],
    activeHeroEffects: room.engine ? room.engine.getActiveHeroEffects(playerIdx) : [],
    activatableCreatures: room.engine ? room.engine.getActivatableCreatures(playerIdx) : [],
    // Ladungen von Permanents mit „up to X times per turn" (Als
    // Vorgabe 16.8.). Nur fuer die eigene Seite — der Gegner soll
    // nicht mitlesen, wie oft eine Karte noch feuern kann.
    zoneCharges: room.engine ? room.engine.getZoneCharges(playerIdx) : [],
    // Creatures that can act as Spell casters via Wolflesia-style
    // `bypassesCasterRequirement` additional actions. Each entry has
    // `{ creatureInstId, cardName, heroIdx, zoneSlot, eligibleHandCards }`.
    // Used by the client to highlight the Creature as the visible
    // caster (instead of the host Hero) for matching Spells.
    creatureSpellCasters: room.engine ? room.engine.getCreatureSpellCasters(playerIdx) : [],
    // Hero-side level-req bypass per (heroIdx → list of hand-card names).
    // Populated by Cute Princess Mary's "Cute" bypass and any future
    // `canBypassLevelReqForCard`-exporting hero. Used by the client's
    // `canHeroNormalSummon` empty-slot drop check so Mary's free
    // Support Zones light up under a Cute Phoenix drag.
    heroBypassSummonCards: room.engine ? room.engine.getHeroBypassSummonCards(playerIdx) : {},
    // Saint Nicolas action-tax escrow: if the owner is mid-action with
    // a Potion marked for transfer, send the current hand index so the
    // client can paint the marker. Resolves the inst id to a hand
    // position robustly — the splice interceptor keeps the engine's
    // inst order aligned with the hand array, so the Nth-by-name
    // walk lands the marker on the right slot even with duplicates.
    _stNicolasEscrowedHandIdx: (() => {
      const myPs = gs.players[playerIdx];
      const esc = myPs?._stNicolasEscrow;
      if (!esc) return -1;
      const handArr = myPs.hand || [];
      // Prefer inst-id resolution.
      if (esc.instId != null && room.engine) {
        let rank = 0, seen = 0;
        for (const c of (room.engine.cardInstances || [])) {
          if (c.zone !== 'hand') continue;
          if (c.owner !== playerIdx) continue;
          if (c.name !== esc.cardName) continue;
          if (c.id === esc.instId) { rank = seen; break; }
          seen++;
        }
        let count = 0;
        for (let i = 0; i < handArr.length; i++) {
          if (handArr[i] === esc.cardName) {
            if (count === rank) return i;
            count++;
          }
        }
      }
      // Fallback: first occurrence by name, then the stored handIdx.
      const byName = handArr.indexOf(esc.cardName);
      if (byName >= 0) return byName;
      return Number.isInteger(esc.handIdx) ? esc.handIdx : -1;
    })(),
    // Hand slots with a clickable "activate in hand without playing"
    // effect (Luna Kiai's "reveal to Burn a Hero" — any future card
    // with the same shape). Each entry is `{ cardName, handIndex,
    // label }`, one per eligible hand slot. The client gates activation
    // per-index so a specific copy can be clicked and revealed.
    handActivatableCards: room.engine ? room.engine.getHandActivatableCards(playerIdx) : [],
    // Own-hand revealed indices — the specific hand slots the owner
    // has spent on `handActivatedEffect` this turn. The client marks
    // them semi-transparent and blocks clicks on them. Cleared on
    // turn start along with other reveal state.
    revealedOwnHandIndices: (() => {
      const myPs = gs.players[playerIdx];
      if (!myPs) return [];
      const handLen = myPs.hand?.length || 0;
      const out = new Set();
      const collect = (map) => {
        if (!map) return;
        for (const kStr of Object.keys(map)) {
          const k = +kStr;
          if (k >= 0 && k < handLen) out.add(k);
        }
      };
      // Per-hand-index reveals via the engine's
      // `registerHandIndexedField` registry (Luna Kiai per-turn,
      // Bamboo Shield permanent). Both surfaced here with the same
      // styling — the client renders revealed hand cards semi-
      // transparent regardless of which field flagged them.
      collect(myPs._revealedHandIndices);
      collect(myPs._permanentlyRevealedHandIndices);
      // Per-instance reveals (Luna Kiai per-turn via `_revealedThisTurn`,
      // Bamboo Shield permanent via `_permanentlyRevealed`): walk
      // tracked instances and map EACH revealed inst back to its
      // specific hand position via rank-by-name correspondence.
      //   • Tracked instances are appended in entry order; cards in hand
      //     are appended in the same order. So the K-th tracked inst
      //     of name X corresponds to the K-th hand position of name X.
      //   • For each revealed inst, compute its rank-by-name in tracking
      //     order, then mark the K-th hand position with that name.
      // This is the EXACT inverse of `_findHandInstanceAt(handIndex)`,
      // which is what stamps the reveal flag in the first place — so
      // the round-trip lands on the same physical copy the player clicked.
      // The earlier "count per name → mark first N" version always
      // marked the leftmost copy regardless of which one was actually
      // clicked (visible bug with 3 Luna Kiais — clicking the rightmost
      // revealed the leftmost).
      const revealedRanks = {}; // name -> Set<rankAmongName>
      const trackingRank = {};  // name -> running counter
      for (const inst of (room.engine?.cardInstances || [])) {
        if (inst.owner !== playerIdx) continue;
        if (inst.zone !== 'hand') continue;
        const name = inst.name;
        const rank = trackingRank[name] || 0;
        trackingRank[name] = rank + 1;
        if (inst.counters?._permanentlyRevealed || inst.counters?._revealedThisTurn) {
          if (!revealedRanks[name]) revealedRanks[name] = new Set();
          revealedRanks[name].add(rank);
        }
      }
      if (Object.keys(revealedRanks).length > 0) {
        const handRank = {};
        for (let i = 0; i < handLen; i++) {
          if (out.has(i)) continue;
          const name = myPs.hand[i];
          const k = handRank[name] || 0;
          handRank[name] = k + 1;
          if (revealedRanks[name]?.has(k)) out.add(i);
        }
      }
      return [...out];
    })(),
    // True only while Deepsea Spores' per-turn override is live — the
    // client tints every board Creature dark-red and prefixes "Deepsea"
    // onto the tooltip name. Cleared automatically on the next turn
    // because the engine compares the stored turn against `gs.turn`.
    deepseaSporesActive: !!(gs._deepseaSporesActiveTurn != null && gs._deepseaSporesActiveTurn === gs.turn),
    // Chilly Dog (Mischief Militia) aura side-flags, derived live by
    // the engine helper. Client uses these to skip the
    // `board-zone-dead` gray-out on Frozen Heroes whose ability /
    // hero-effect activations remain available (Chilly Dog lifts the
    // FROZEN-only silence). Index = player side.
    chillyDogActiveSides: room.engine
      ? [room.engine._isChillyDogActiveFor(0), room.engine._isChillyDogActiveFor(1)]
      : [false, false],
    activatableEquips: room.engine ? room.engine.getActivatableEquips(playerIdx) : [],
    // Karten in der eigenen ABLAGE, die gerade benutzt werden koennen
    // (Future Tech Prototypes). Der Client hebt sie im Ablage-Dialog
    // hervor und macht sie anklickbar.
    activatableDiscard: room.engine ? room.engine.getActivatableDiscardCards(playerIdx) : [],
    // ★ Ein Eintrag JE STAPELPLATZ (v585): Instanz, aktuelle Identitaet
    // und Benutzbarkeit. Ersetzt das Abhaken nach Namen im Client, das
    // bei mehreren gleichen Karten geraten hat.
    discardEntries: room.engine ? room.engine.getDiscardEntries(playerIdx) : [],
    activatablePermanents: room.engine ? room.engine.getActivatablePermanents(playerIdx) : [],
    activatableAreas: room.engine ? room.engine.getActivatableAreas(playerIdx) : [],
    heroPlayableCards: room.engine ? room.engine.getHeroPlayableCards(playerIdx) : { own: {}, charmed: {} },
    // Abilities, die als Joker auf einem fremden Schul-Stapel mitzählen
    // (Performance). Der Client spiegelt die Schulzählung der Engine für
    // seine Drop-Zonen-Hervorhebung und kannte diese Regel bisher NICHT —
    // dadurch blieben Zonen dunkel, obwohl der Server den Zug erlaubt
    // (Als Report: Greatmaw Remora Lv2 auf Ingo mit Summoning Magic 1 +
    // Performance; Klick funktionierte, Drag&Drop nicht). Aus den
    // Kartenskripten abgeleitet statt hartkodiert.
    wildcardAbilities: wildcardAbilityNames(),
    // Per-Hero-Liste der Creatures, deren Level-/Schul-Anforderung der
    // Hero OHNE karten-seitigen Platzierungs-Bypass erfüllt. Der
    // Klick-Picker ("welcher Hero beschwört das?") bevorzugt diese
    // Heroes und fällt nur auf `heroPlayableCards` zurück, wenn keiner
    // regulär qualifiziert — sonst listet er bei Karten wie Chilly
    // Wizard alle lebenden Heroes (Als Bugreport).
    heroStrictLevelCards: room.engine ? room.engine.getHeroStrictLevelCards(playerIdx) : {},
    // Cross-side-playable Creature names — cards whose script exports
    // `playOnAnyHeroSide: true` AND at least one OWN Hero appears as a
    // valid host in `heroPlayableCards.own`. The client uses this to
    // light up free Support Zones on BOTH sides during the drag UX
    // (Chilly Wizard summons onto either player's Hero). Empty array
    // when the engine isn't initialised yet.
    crossSidePlayableCards: room.engine ? room.engine.getCrossSidePlayableCards(playerIdx) : [],
    // Cross-side-playable Artifact names — Artifact-Creature hybrids
    // (Powder Keg etc.) whose script exports `placesOnOpponentBoard:
    // true`. The client uses this to enable opp-side Support Zones
    // and Hero zones as drag-drop / click targets during the equip
    // drag UX, and the server's `doPlayArtifact` consults the same
    // flag to route placement onto the opp's side.
    crossSidePlayableArtifacts: room.engine ? room.engine.getCrossSidePlayableArtifacts(playerIdx) : [],
    // Equipment Artifacts with no inherent `canEquipToHero` restriction
    // — equippable to EITHER side's eligible Hero. The client uses this
    // to also light up OPPONENT Hero/Support zones as drag/click equip
    // targets; `doPlayArtifact` honors the chosen `targetOwner`.
    // Artifact Creatures, die auf der EIGENEN Seite beschworen werden.
    // Der Client oeffnet darauf den Helden-Picker beim Klick (Als Vorgabe
    // 17.8.) — Gold und freie Zonen prueft er selbst, hier steht nur, was
    // er nicht wissen kann: die Kartenskript-Fahnen.
    ownSideSummonArtifacts: room.engine ? room.engine.getOwnSideSummonArtifacts(playerIdx) : [],
    // Kartenname → erlaubte eigene Helden, fuer Ausruestung mit EIGENER
    // Beschraenkung (Crusader's: nur Cecilia). Der Client graut damit
    // Heldenkacheln und Support-Zonen beim Drag korrekt aus.
    equipEligibleHeroes: room.engine ? room.engine.getEquipEligibleHeroes(playerIdx) : {},
    freeSideEquipArtifacts: room.engine ? room.engine.getFreeSideEquipArtifacts(playerIdx) : [],
    bouncePlacementTargets: room.engine ? room.engine.getBouncePlacementTargets(playerIdx) : {},
    bakhmSurpriseSlots: room.engine ? (() => {
      const result = [];
      const ps2 = gs.players[playerIdx];
      for (let hi = 0; hi < (ps2?.heroes || []).length; hi++) {
        const hero = ps2.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || (hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.negated || hero.statuses?.bound) continue;
        const heroScript = loadCardEffect(hero.name);
        if (!heroScript?.isBakhmHero) continue;
        const freeSlots = [];
        for (let si = 0; si < 3; si++) {
          if (((ps2.supportZones[hi] || [])[si] || []).length === 0) freeSlots.push(si);
        }
        result.push({ heroIdx: hi, freeSlots });
      }
      return result;
    })() : [],
    ushabtiSummonable: room.engine ? (() => {
      if (playerIdx !== gs.activePlayer) return [];
      const currentTurn = gs.turn || 0;
      const ps2 = gs.players[playerIdx];
      const result = [];
      for (const inst of room.engine.cardInstances) {
        if (inst.owner !== playerIdx || inst.zone !== 'surprise' || !inst.ushabtiPlaced) continue;
        if (inst.ushabtiTurn >= currentTurn) continue; // Can't summon same turn
        const hi = inst.heroIdx;
        const hero = ps2?.heroes?.[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || (hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.negated || hero.statuses?.bound) continue;
        // Check abilities
        const cardData = getCardDB()[inst.name];
        if (!cardData) continue;
        const level = cardData.level || 0;
        if (level > 0 || cardData.spellSchool1) {
          const abZones = ps2.abilityZones?.[hi] || [];
          let ok = true;
          if (cardData.spellSchool1 && room.engine.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) ok = false;
          if (cardData.spellSchool2 && room.engine.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) ok = false;
          if (!ok) continue;
        }
        // Check free support zone
        let hasFreeSlot = false;
        for (let si = 0; si < 3; si++) {
          if (((ps2.supportZones[hi] || [])[si] || []).length === 0) { hasFreeSlot = true; break; }
        }
        if (!hasFreeSlot) continue;
        // Check custom summon conditions
        const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
        if (script?.canSummon && !script.canSummon({ _engine: room.engine, cardOwner: playerIdx, cardHeroIdx: hi })) continue;
        result.push({ heroIdx: hi, cardName: inst.name });
      }
      return result;
    })() : [],
    roomParticipants: {
      players: gs.players.map(ps => ({ username: ps.username, color: ps.color, avatar: ps.avatar })),
      spectators: (room.spectators || []).map(s => ({ username: s.username, color: s.color || '#888', avatar: s.avatar || null })),
    },
    ...extra,
  };
  io.to(p.socketId).emit('game_state', state);
}

function sendToSpectators(room, event, data) {
  if (room.engine?._fastMode) return;
  if (!room.spectators) return;
  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit(event, data);
  }
}

function sendSpectatorGameState(room) {
  if (room.engine?._aborted) return;   // siehe sendGameState
  if (room.engine?._fastMode) return;
  if (!room.spectators || room.spectators.length === 0) return;
  const gs = room.gameState;
  if (!gs) return;

  // Determine who is choosing first (for awaiting first choice overlay)
  let choosingPlayerName = null;
  if (gs.awaitingFirstChoice && room._pendingRematch) {
    const loserPs = gs.players[room._pendingRematch.loserIdx];
    if (loserPs) choosingPlayerName = loserPs.username;
  }

  const state = {
    isSpectator: true,
    myIndex: 0, // Player 0 at bottom, Player 1 at top (host = bottom)
    roomId: room.id,
    players: gs.players.map((ps, spi) => ({
      username: ps.username, color: ps.color, avatar: ps.avatar, cardback: ps.cardback || null, board: ps.board || null,
      victoryMsg: ps.victoryMsg || '', defeatMsg: ps.defeatMsg || '',
      // ★ Teilt dieser Spieler seine Support-Zonen („Alice, the Transfer
      // Student")? Gehoert HIERHER, in den pro-Spieler-Block neben
      // `heroes` und `supportZones` — der Client liest ihn als
      // `me.sharesSupportZones`. Beim ersten Versuch (v487) stand er auf
      // der TOP-Ebene des Spielstands; `me` ist aber
      // `gameState.players[myIdx]`, also war er dort immer undefined und
      // die ganze Drop-/Klick-Logik lief ins Leere.
      // Aus dem Spielerzustand, nicht vom Brett — die Wirkung ueberlebt
      // Alices Tod.
      sharesSupportZones: !!ps._aliceShareActive,
      heroes: ps.heroes, abilityZones: ps.abilityZones,
      surpriseZones: ps.surpriseZones.map((sz, hi) => (sz || []).map(cn => {
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === cn);
        if (inst && !inst.faceDown) return cn;
        if (inst && inst.knownToOpponent) return cn;
        return '?';
      })),
      surpriseKnown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return false;
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return !!(inst && inst.faceDown && inst.knownToOpponent);
      }),
      supportZones: ps.supportZones.map((heroSlots, hi) => (heroSlots || []).map((slot, si) => {
        if (!slot || slot.length === 0) return slot;
        const inst = room.engine?.cardInstances.find(c =>
          c.owner === spi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si && c.faceDown
        );
        if (inst?.faceDown && !inst.knownToOpponent) return ['?'];
        return slot;
      })),
      islandZoneCount: ps.islandZoneCount || [0, 0, 0],
      // CPU-vs-CPU spectator view reveals both hands so the watcher can
      // see every CPU decision in context. Normal spectator view keeps
      // hands hidden (fairness for real-player matches).
      hand: room.type === 'cpu_vs_cpu' ? ps.hand : [], handCount: ps.hand.length,
      revealedHandCards: room.type === 'cpu_vs_cpu'
        ? ps.hand.map((name, index) => ({ index, name }))
        : [],
      mainDeckCards: [], deckCount: ps.mainDeck.length,
      // Public-knowledge top of deck (Premonition stash, etc.) — same
      // validation as the per-player view so spectators see the same
      // semi-transparent overlay both players do.
      deckTopVisible: (() => {
        const dtv = ps.deckTopVisible || [];
        if (dtv.length === 0) return [];
        const cap = Math.min(dtv.length, ps.mainDeck.length);
        let valid = 0;
        while (valid < cap && dtv[valid] === ps.mainDeck[valid]) valid++;
        return dtv.slice(0, valid);
      })(),
      potionDeckCards: [], potionDeckCount: ps.potionDeck.length,
      discardPile: ps.discardPile, deletedPile: ps.deletedPile,
      // Siehe die Zwillingsstelle in der Spieler-Projektion. Die
      // Laufvariable heisst hier `spi` — `check-scope` hat meinen
      // kopierten `pi` sofort gefangen.
      discardIdentities: require('./cards/effects/_future-tech-shared')
        .ablageIdentitaeten(gs, spi),
      discardEntries: room.engine ? room.engine.getDiscardEntries(spi) : [],
      letheStamps: ps._letheStamps || {},
      disconnected: ps.disconnected || false, left: ps.left || false,
      // Gold display can be temporarily frozen for cost-bypass flows
      // (Swagdri's free-play of an X-cost Artifact bumps gold by a
      // headroom buffer so the artifact's internal cost check passes,
      // then restores). `_goldFreeze` exposes the original value to
      // the client during that window so the diff-detector doesn't
      // flash spurious +9999 / -9999 floaters.
      gold: ps._goldFreeze != null ? ps._goldFreeze : (ps.gold || 0),
      abilityGivenThisTurn: ps.abilityGivenThisTurn || [false, false, false],
      summonLocked: ps.summonLocked || false,
      damageLocked: ps.damageLocked || false,
      oppHandLocked: ps.oppHandLocked || false,
      itemLocked: ps.itemLocked || false,
      // Boomerang lockout — see the matching block in sendGameState
      // for the rationale.
      artifactLocked: (ps._artifactLockTurn === gs.turn) || false,
      dealtDamageToOpponent: ps.dealtDamageToOpponent || false,
      potionLocked: room.engine ? room.engine.arePotionsLockedFor(spi) : (ps.potionLocked || false),
      poisonDamagePerStack: room.engine ? room.engine.getPoisonDamagePerStack(spi) : 30,
      handLocked: ps.handLocked || false,
      drawLocked: ps.drawLocked || false,
      flashbanged: ps._flashbangedDebuff || false,
      forsaken: ps._discardToDeleteActive || false,
      // Giga Steroids — owner-wide second-Action grant for effect
      // activations. Set on resolve, cleared on consume / fizzle /
      // expire by Giga Steroids' hooks. Read by the client to render
      // the "On Steroids" buff badge in the top-of-board strip.
      onSteroids: ps.onSteroids || false,
      supportSpellLocked: ps.supportSpellLocked || false,
      permanents: ps.permanents || [],
      coolnessStack: ps.coolnessStack || [],
      // Whether the top of THIS player's Stack is playable from the
      // Stack right now. Clients use this flag to highlight the Stack
      // pile (cyan glow) and route a click into the play-from-Stack
      // confirm dialog instead of the pile viewer.
      coolnessStackTopPlayable: (() => {
        const stack = ps.coolnessStack || [];
        if (stack.length === 0) return false;
        const top = stack[stack.length - 1];
        const scr = loadCardEffect(top);
        return !!(scr && (scr.playableFromCoolnessStack || scr.summonableFromCoolnessStack));
      })(),
      oncePerGameUsed: ps._oncePerGameUsed ? [...ps._oncePerGameUsed] : [],
      resolvingCard: ps._resolvingCard || null,
      deckSkins: ps.deckSkins || {},
      poisonDmgPerStack: room.engine ? room.engine.getPoisonDamagePerStack(spi) : 30,
      // Fields that sendGameState includes per-player but spectators don't interact with
      surpriseFaceDown: ps.surpriseZones.map((sz, hi) => {
        if (!sz || sz.length === 0) return null;
        const inst = room.engine?.cardInstances.find(c => c.owner === spi && c.zone === 'surprise' && c.heroIdx === hi && c.name === sz[0]);
        return inst ? inst.faceDown : true;
      }),
      revealedHandCards: [],
      creationLockedNames: [],
      handLockBlockedCards: [],
      neverPlayableCards: [],
      cardGateBlockedCards: [],
      handLevelOffsets: {},
      handLevelOffsetsTransient: {},
      handLevelOffsetHeroFilter: {},
      handLevelOffsetsDynamic: {},
      handCostReductions: {},
      comboLockHeroIdx: ps.comboLockHeroIdx ?? null,
      heroesActedThisTurn: ps.heroesActedThisTurn || [],
      // Kreditrahmen (Debt-O-Tron/Kent). Der Client rechnet ihn beim
      // Ausgrauen der Handkarten mit — sonst sperrt die Oberflaeche
      // Karten, die der Server laengst erlaubt. Ohne den Archetyp 0.
      goldOverdraft: room.engine.goldOverdraftLimit(spi),
      // Zuschauer sehen keine Haende — die Liste der sich selbst
      // finanzierenden Karten bleibt hier deshalb leer.
      goldSelfOverdraftCards: [],
    })),
    areaZones: gs.areaZones,
    // Doom Counter leben auf der Karten-INSTANZ, die nicht mit
    // geschickt wird — `_doom-clock-shared.syncDisplay` spiegelt den
    // Stand hierher, damit die Zone ihn anzeigen kann (Als Befund
    // 5.8.: "ich sehe immer 0"). Ohne diese Zeile blieb der Spiegel
    // serverseitig stehen und kam nie beim Client an.
    doomCounters: gs.doomCounters || null,
    turn: gs.turn, activePlayer: gs.activePlayer, currentPhase: gs.currentPhase || 0,
    result: gs.result || null, rematchRequests: gs.rematchRequests || [],
    isPuzzle: gs.isPuzzle || false,
    isTutorial: gs.isTutorial || false,
    // Kampagnen-Duell: das Kampffeld blendet damit Deck-Auswahl und
    // Revanche aus und zeigt stattdessen "Weiter" (der Ausgang gehört
    // der Story, nicht dem Spieler).
    isCampaign: gs.isCampaign || false,
    campaignRetry: gs.campaignRetry !== false,
    campaignAnte: gs.isAnte || false,
    isCpuBattle: room.type === 'singleplayer',
    // Gegnerspezifisches Battle-Theme (Slug ohne 'bgm_'-Präfix und
    // Endung). null → der Client nimmt das generische Kampfthema.
    cpuBgm: cpuBgmForRoom(room),
    setScore: room.setScore || [0, 0], format: room.format || 1, winsNeeded: room.winsNeeded || 1,
    summonBlocked: gs.summonBlocked || [],
    customPlacementCards: [],
    customHostPickCards: [],
    ascendedOnlyAbilities: [],
    proactiveReactionArtifacts: [],
    awaitingFirstChoice: gs.awaitingFirstChoice || false,
    choosingPlayerName,
    terrorCount: 0,
    terrorThreshold: null,
    bonusActions: null,
    bonusMainActions: 0,
    mulliganPending: gs.mulliganPending || false,
    handReturnToDeck: gs.handReturnToDeck || false,
    handReturnToOppCards: gs.handReturnToOppCards || [],
    potionTargeting: gs.potionTargeting ? {
      potionName: gs.potionTargeting.potionName,
      ownerIdx: gs.potionTargeting.ownerIdx,
      cardType: gs.potionTargeting.cardType,
      config: gs.potionTargeting.config,
      validTargets: gs.potionTargeting.validTargets,
    } : null,
    effectPrompt: gs.effectPrompt || null,
    surprisePending: gs.surprisePending || false,
    heroEffectPending: gs.heroEffectPending || null,
    creatureCounters: room.engine ? (() => {
      const cc = {};
      const currentTurn = gs.turn || 0;
      for (const inst of room.engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        // Key by PHYSICAL side. Temporary steals (Deepsea Succubus,
        // `inst.stolenBy != null`) leave the card on its owner's
        // supportZones array — keyed by owner. Permanent cross-side
        // placements (Chilly Wizard) physically move the card to the
        // controller's supportZones array — keyed by controller. Owner
        // never changes (it tracks the card's true owner for discard /
        // deck routing); `_stolenBy` still surfaces the stealer so the
        // client paints the colored border on the un-moved cases.
        const physicalSide = (inst.stolenBy != null)
          ? inst.owner
          : (inst.controller ?? inst.owner);
        const key = `${physicalSide}-${inst.heroIdx}-${inst.zoneSlot}`;
        const hasCounters = Object.keys(inst.counters).length > 0;
        const hasSummoningSickness = inst.turnPlayed === currentTurn
          && !inst.counters?._hasHaste
          // Chilly Dog (Mischief Militia) lifts summoning sickness for
          // Frozen Creatures the same player controls — the haste
          // grant is now derived live, so puzzle-mode boards with
          // pre-frozen-sick allies under a Chilly Dog correctly drop
          // the sickness overlay on the client too.
          && !(inst.counters?.frozen
               && room.engine._isChillyDogActiveFor(inst.controller ?? inst.owner))
          && (() => {
            const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
            return !!(script?.creatureEffect);
          })();
        const isFaceDown = !!inst.faceDown;
        const isStolen = inst.stolenBy != null && inst.controller !== inst.owner;
        if (hasCounters || hasSummoningSickness || isFaceDown || isStolen) {
          cc[key] = { ...inst.counters };
          if (hasSummoningSickness) cc[key].summoningSickness = true;
          if (isFaceDown) cc[key].faceDown = true;
          if (isStolen) cc[key]._stolenBy = inst.stolenBy;
        }
      }
      return cc;
    })() : {},
    supportStacks: buildSupportStacks(room),
    additionalActions: [],
    inherentActionCards: [],
    inherentActionHeroes: {},
    unactivatableArtifacts: [],
    blockedSpells: [],
    activatableAbilities: [],
    freeActivatableAbilities: [],
    activeHeroEffects: [],
    activatableCreatures: [],
    zoneCharges: [],
    activatableEquips: [],
    activatableDiscard: [],
    discardEntries: [],
    activatablePermanents: [],
    activatableAreas: [],
    heroPlayableCards: { own: {}, charmed: {} },
    heroStrictLevelCards: {},
    crossSidePlayableCards: [],
    crossSidePlayableArtifacts: [],
    ownSideSummonArtifacts: [],
    equipEligibleHeroes: {},
    freeSideEquipArtifacts: [],
    bouncePlacementTargets: {},
    bakhmSurpriseSlots: [],
    ushabtiSummonable: [],
    roomParticipants: {
      players: gs.players.map(ps => ({ username: ps.username, color: ps.color, avatar: ps.avatar })),
      spectators: (room.spectators || []).map(s => ({ username: s.username, color: s.color || '#888', avatar: s.avatar || null })),
    },
  };

  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit('game_state', state);
  }
}

async function endGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const isRanked = room.type === 'ranked';
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];

  // Update set score
  room.setScore[winnerIdx]++;
  const setOver = room.setScore[winnerIdx] >= room.winsNeeded;

  // Elo only changes when the full set is decided
  let eloChanges = null;
  if (setOver && isRanked) {
    const wUser = await db.get('SELECT * FROM users WHERE id = ?', [winner.userId]);
    const lUser = await db.get('SELECT * FROM users WHERE id = ?', [loser.userId]);
    const wElo = wUser?.elo || 1000; const lElo = lUser?.elo || 1000;
    const K = 32;
    const expectedW = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
    const newWElo = Math.round(wElo + K * (1 - expectedW));
    const newLElo = Math.max(0, Math.round(lElo + K * (0 - (1 - expectedW))));
    await db.run('UPDATE users SET elo = ?, ranked_games = ranked_games + 1 WHERE id = ?', [newWElo, winner.userId]);
    await db.run('UPDATE users SET elo = ?, ranked_games = ranked_games + 1 WHERE id = ?', [newLElo, loser.userId]);
    eloChanges = [{ username: winner.username, oldElo: wElo, newElo: newWElo }, { username: loser.username, oldElo: lElo, newElo: newLElo }];
    // Tell every connected client (lobby browsers, players in other rooms,
    // spectators) that the leaderboard standings just changed so their
    // UI re-fetches. Without this the leaderboard stays stale until the
    // 60s poll fires or the user manually navigates away and back.
    io.emit('leaderboard_updated');
  }

  // Always track wins/losses and hero stats per round
  await db.run('UPDATE users SET wins = wins + 1 WHERE id = ?', [winner.userId]);
  await db.run('UPDATE users SET losses = losses + 1 WHERE id = ?', [loser.userId]);
  for (const ps of [winner, loser]) {
    const won = ps === winner;
    for (const h of ps.heroes) {
      if (h.name) await db.run('INSERT INTO hero_stats (user_id, hero_name, wins, losses) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, hero_name) DO UPDATE SET wins = wins + excluded.wins, losses = losses + excluded.losses', [ps.userId, h.name, won ? 1 : 0, won ? 0 : 1]);
    }
    await db.run('INSERT INTO game_history (id, user_id, hero1, hero2, hero3, won, opponent_id) VALUES (?, ?, ?, ?, ?, ?, ?)', [uuidv4(), ps.userId, ps.heroes[0]?.name||null, ps.heroes[1]?.name||null, ps.heroes[2]?.name||null, won?1:0, (won?loser:winner).userId]);
  }

  gs.result = {
    winnerIdx, reason, winnerName: winner.username, loserName: loser.username, isRanked,
    eloChanges,
    setScore: [...room.setScore], setOver, format: room.format,
  };
  gs.rematchRequests = [];
  if (setOver) room.status = 'finished';
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  io.emit('rooms', getRoomList());

  // ── Emit updated profile stats (wins/losses/elo) to both players ──
  for (let i = 0; i < 2; i++) {
    const userId = gs.players[i]?.userId;
    const sid = gs.players[i]?.socketId;
    if (userId && sid) {
      const updated = await db.get('SELECT wins, losses, elo, elo_cube, sc FROM users WHERE id = ?', [userId]);
      if (updated) io.to(sid).emit('user_stats_updated', updated);
    }
  }

  // ── SC reward evaluation ──
  try {
    const scResults = await evaluateSCRewards(room, winnerIdx, reason);
    // Daily challenge bonus for the winner (merged into the standard payout
    // so the client shows one combined sc_earned toast).
    try {
      const dailyBonus = await awardDailyChallengeBonus(room, winnerIdx, reason);
      if (dailyBonus) {
        const entry = scResults[winnerIdx] || { rewards: [], total: 0 };
        entry.rewards.push({
          id: 'daily_challenge',
          title: dailyBonus.title,
          amount: dailyBonus.amount,
          description: dailyBonus.description,
        });
        entry.total += dailyBonus.amount;
        scResults[winnerIdx] = entry;
      }
    } catch (err) {
      console.error('[Daily] bonus error:', err.message);
    }
    for (let pi = 0; pi < 2; pi++) {
      if (scResults[pi] && scResults[pi].total > 0) {
        const sid = gs.players[pi]?.socketId;
        if (sid) io.to(sid).emit('sc_earned', scResults[pi]);
      }
    }
    // Also tell spectators about SC earnings
    if (Object.keys(scResults).length > 0) {
      sendToSpectators(room, 'sc_earned_spectator', scResults);
    }
  } catch (err) {
    console.error('[SC] Error evaluating rewards:', err.message);
  }

  // Auto-advance to next round after 4 seconds (if set not over)
  if (!setOver) {
    // Check if either player has a side deck
    const hasSideDeck = room._currentDecks && room._currentDecks.some(d => d && (d.sideDeck || []).length > 0);
    room._setAdvanceTimer = setTimeout(async () => {
      delete room._setAdvanceTimer;
      room._pendingLoserIdx = loserIdx;

      if (hasSideDeck && room.format > 1) {
        // Enter side-deck phase
        room._sideDeckDone = [false, false];
        room._sideDeckPhase = true;

        // Auto-done players with empty side decks
        for (let i = 0; i < 2; i++) {
          if ((room._currentDecks[i]?.sideDeck || []).length === 0) {
            room._sideDeckDone[i] = true;
          }
        }

        // Send side-deck state to both players
        for (let i = 0; i < 2; i++) {
          const sid = gs.players[i]?.socketId;
          if (sid) {
            io.to(sid).emit('side_deck_phase', {
              currentDeck: room._currentDecks[i],
              originalDeck: room._originalDecks[i],
              opponentDone: room._sideDeckDone[i === 0 ? 1 : 0],
              setScore: [...room.setScore],
              format: room.format,
              autoDone: room._sideDeckDone[i],
            });
          }
        }

        // If both auto-done (both have empty side decks), proceed immediately
        if (room._sideDeckDone[0] && room._sideDeckDone[1]) {
          room._sideDeckPhase = false;
          delete room._sideDeckDone;
          await advanceToNextGame(room, loserIdx);
        }
      } else {
        // No side decks or bo1 — skip to next game
        await advanceToNextGame(room, loserIdx);
      }
    }, 2000);
  }

  // ── Cube tournament hook ──
  // If this room is a child of a cube-draft tournament parent, report
  // the completed match result up so the bracket can advance. We delay
  // a few seconds so the result panel has time to display before the
  // child room is torn down.
  if (setOver && room.parentCubeRoomId) {
    const parent = rooms.get(room.parentCubeRoomId);
    if (parent?.cubeDraft?.bracket) {
      const round = parent.cubeDraft.bracket.rounds[room.parentCubeRoundIdx];
      const match = round?.find(m => m.matchIdx === room.parentCubeMatchIdx);
      if (match) {
        const winnerSeat = winnerIdx === 0 ? match.p1Seat : match.p2Seat;
        setTimeout(() => {
          cubeMatchEnd(parent, match, winnerSeat, io).catch(err => console.error('[cubeMatchEnd]', err.message));
        }, 4000);
      }
    }
  }
}

/**
 * Server-side mirror of canCardTypeEnterSection (app-shared.jsx).
 * Checks if a card's TYPE is compatible with a deck pool.
 * Only type rules — no copy limits or deck size checks.
 * IMPORTANT: When adding new card effects that modify deckbuilding rules,
 * update BOTH this function AND canCardTypeEnterSection() in app-shared.jsx.
 */
function canCardTypeEnterPool(cardDB, deck, cardName, pool) {
  const card = cardDB[cardName];
  if (!card) return false;
  const ct = card.cardType;
  if (ct === 'Token') return false;
  if (pool === 'main') {
    if (ct === 'Hero') return false;
    if (ct === 'Potion') {
      return (deck.heroes || []).some(h => h?.hero === 'Nicolas, the Hidden Alchemist');
    }
    return true;
  }
  if (pool === 'potion') return ct === 'Potion';
  if (pool === 'hero') return ct === 'Hero';
  if (pool === 'side') return true;
  return false;
}

/**
 * Combined Potion count across main + Potion Deck. Mirrors the client's
 * `isDeckLegal` invariant — never more than 15 Potions across both
 * sections. Side-deck Potions don't count toward the cap.
 */
function countCombinedPotions(cardDB, deck) {
  let n = 0;
  for (const cn of (deck.mainDeck || [])) {
    if (cardDB[cn]?.cardType === 'Potion') n++;
  }
  n += (deck.potionDeck || []).length; // Potion Deck holds Potions only
  return n;
}

async function advanceToNextGame(room, loserIdx) {
  await setupGameState(room);
  // Notify clients that side-deck phase is over
  for (let i = 0; i < 2; i++) {
    const sid = room.gameState.players[i]?.socketId;
    if (sid) io.to(sid).emit('side_deck_complete');
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  const loserPs = room.gameState.players[loserIdx];
  if (loserPs?.socketId) {
    room._pendingRematch = { roomId: room.id, loserIdx };
    io.to(loserPs.socketId).emit('rematch_choose_first', {});
  } else {
    await startGameEngine(room, room.id, loserIdx);
  }
}

/**
 * Lightweight endGame for puzzle/single-player rooms.
 * No DB writes (ELO, wins, losses, SC rewards, game history).
 * Just sets gs.result and syncs to the client.
 */
async function puzzleEndGame(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  const puzzleSuccess = reason !== 'puzzle_failed' && winnerIdx === 0;

  console.log(`[Puzzle] Game ended: reason=${reason}, winner=${winnerIdx}, success=${puzzleSuccess}, phase=${gs.currentPhase}`);

  gs.result = {
    winnerIdx, reason,
    winnerName: winner?.username || '?',
    loserName: loser?.username || '?',
    isRanked: false,
    eloChanges: null,
    setScore: [0, 0], setOver: true, format: 1,
    isPuzzle: true,
    isTutorial: gs.isTutorial || false,
    puzzleResult: puzzleSuccess ? 'success' : 'fail',
    puzzleAttemptId: gs._puzzleAttemptId || null,
    puzzleDifficulty: gs._puzzleDifficulty || null,
    scAwarded: 0,
  };
  gs.rematchRequests = [];
  room.status = 'finished';

  // Award SC for first-time official puzzle completion. AWAITED inline
  // so the result sync at the bottom carries the final scAwarded value
  // — previously this was a fire-and-forget IIFE plus an immediate
  // sync, which let the client see `scAwarded: 0` first and then the
  // real value milliseconds later. If the player dismissed the
  // result view in that window, the SC notification text was
  // generated from the stale zero.
  if (puzzleSuccess && gs._puzzleAttemptId && gs._puzzleDifficulty) {
    const SC_BY_DIFFICULTY = { easy: 3, medium: 6, hard: 10 };
    const scAmount = SC_BY_DIFFICULTY[gs._puzzleDifficulty] || 0;
    const userId = winner?.userId;
    const puzzleId = gs._puzzleAttemptId;

    if (userId && scAmount > 0) {
      try {
        const existing = await db.get(
          'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
          [userId, puzzleId]
        );
        if (!existing) {
          await db.run(
            'INSERT INTO puzzle_completions (user_id, puzzle_id) VALUES (?, ?)',
            [userId, puzzleId]
          );
          await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [scAmount, userId]);
          gs.result.scAwarded = scAmount;
          console.log(`[Puzzle] Awarded ${scAmount} SC to ${winner.username} for first clear of ${puzzleId}`);
        } else {
          console.log(`[Puzzle] ${winner.username} re-cleared ${puzzleId} (no SC)`);
        }
      } catch (err) {
        console.error('[Puzzle] SC award error:', err.message);
      }
    }
  }

  // Track tutorial completion (no SC reward) — also awaited so the
  // sync below carries the up-to-date completion record.
  if (puzzleSuccess && gs.isTutorial && gs._puzzleAttemptId) {
    const userId = winner?.userId;
    const puzzleId = gs._puzzleAttemptId;
    if (userId) {
      try {
        const existing = await db.get(
          'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
          [userId, puzzleId]
        );
        if (!existing) {
          await db.run(
            'INSERT INTO puzzle_completions (user_id, puzzle_id) VALUES (?, ?)',
            [userId, puzzleId]
          );
          console.log(`[Tutorial] ${winner.username} cleared ${puzzleId}`);
        }
      } catch (err) {
        console.error('[Tutorial] completion tracking error:', err.message);
      }
    }
  }

  for (let i = 0; i < 2; i++) sendGameState(room, i);
}

// Singleplayer CPU battle end — no Elo/ranked/hero stats writes, mirrors puzzleEndGame's
// minimal pattern. The human earns a small SC reward on a non-surrender win, gated by
// light anti-farm guards (min turns + min cards played).
const CPU_WIN_SC = 1;
const CPU_WIN_MIN_TURN = 3;
const CPU_WIN_MIN_CARDS = 3;
function endCpuBattle(room, winnerIdx, reason) {
  const gs = room.gameState;
  if (!gs || gs.result) return;
  const loserIdx = winnerIdx === 0 ? 1 : 0;
  const winner = gs.players[winnerIdx];
  const loser = gs.players[loserIdx];
  gs.result = {
    winnerIdx, reason,
    winnerName: winner?.username || '?',
    loserName: loser?.username || '?',
    isRanked: false, eloChanges: null,
    setScore: [0, 0], setOver: true, format: 1,
    isCpuBattle: true,
    scAwarded: 0,
  };
  gs.rematchRequests = [];

  // MCTS rollouts share the live room.gameState (snapshot/restore rolls
  // back gs, but NOT fire-and-forget DB writes or socket emits). Without
  // this guard, every simulated rollout that killed all heroes would
  // stack another npc_stats + SC update on the real user — that's the
  // "60+ wins and multi-stacked SC after a few games" bug. gs.result is
  // still set above so the rollout's termination checks work; restore()
  // then clears it for the next simulation.
  if (room.engine?._fastMode) return;

  room.status = 'finished';

  // Record per-opponent W/L for the human player so the singleplayer
  // gallery can show their record vs this deck. Only counts when a human
  // userId and opponent deckId are both known (skips anon/dev runs).
  // Surrenders count as a loss for the human — bailing out shouldn't be
  // a free escape from the record.
  const humanUserId = room.players?.[0]?.userId;
  const humanSid = room.players?.[0]?.socketId || null;
  const opponentDeckId = room.players?.[1]?.deckId;
  if (humanUserId && opponentDeckId) {
    const humanWon = winnerIdx === 0 ? 1 : 0;
    const humanLost = winnerIdx === 0 ? 0 : 1;
    (async () => {
      try {
        // Read the pre-update win count so we can detect milestone
        // crossings (each happens exactly once since wins climb by 1).
        const prior = await db.get(
          'SELECT wins FROM npc_stats WHERE user_id = ? AND opponent_deck_id = ?',
          [humanUserId, opponentDeckId]
        );
        const preWins = prior?.wins || 0;

        await db.run(`
          INSERT INTO npc_stats (user_id, opponent_deck_id, wins, losses)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, opponent_deck_id) DO UPDATE SET
            wins = wins + excluded.wins,
            losses = losses + excluded.losses
        `, [humanUserId, opponentDeckId, humanWon, humanLost]);

        // Freischaltungen — nur bei einem Sieg. Die Regel selbst steht in
        // `unlock-rules.js`; hier wird nur der Zustand zusammengetragen.
        // GAESTE schalten seit 8.8. ebenfalls frei: jeder erste Sieg gegen
        // eine CPU bringt eine zufaellige neue — fuer die laufende Sitzung.
        const guestRow = await db.get('SELECT is_guest FROM users WHERE id = ?', [humanUserId]);
        if (humanWon) {
          const isGuest = !!guestRow?.is_guest;
          // Das Startaufgebot interessiert nur registrierte Konten; die
          // Abfrage entfaellt fuer Gaeste.
          let isInitial = false;
          if (!isGuest) {
            const initRow = await db.get(
              'SELECT is_initial FROM unlocked_opponents WHERE user_id = ? AND opponent_deck_id = ?',
              [humanUserId, opponentDeckId]
            );
            isInitial = !!(initRow && initRow.is_initial);
          }
          const unlockCount = cpuUnlockCount({ isGuest, isInitial, preWins });

          const newlyUnlocked = [];
          for (let k = 0; k < unlockCount; k++) {
            const u = await unlockRandomOpponent(humanUserId);
            if (u) newlyUnlocked.push(u);
          }
          if (newlyUnlocked.length && humanSid) {
            io.to(humanSid).emit('opponents_unlocked', { opponents: newlyUnlocked });
          }
        }
      } catch (err) {
        console.error('[CPU battle] npc_stats/unlock update error:', err.message);
      }
    })();
  }

  // SC reward: only the human (idx 0), only on an actual victory (no surrender
  // wins), and only if the game reached a real play state.
  const humanPlayed = gs._scTracking?.[0]?.cardsPlayedFromHand || 0;
  const eligible =
    winnerIdx === 0 &&
    reason !== 'surrender' &&
    (gs.turn || 0) >= CPU_WIN_MIN_TURN &&
    humanPlayed >= CPU_WIN_MIN_CARDS;

  if (eligible && winner?.userId) {
    const userId = winner.userId;
    const sid = winner.socketId;
    gs.result.scAwarded = CPU_WIN_SC;
    (async () => {
      try {
        await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [CPU_WIN_SC, userId]);
        if (sid) io.to(sid).emit('sc_earned', {
          rewards: [{ id: 'cpu_win', title: 'CPU Battle Victory', amount: CPU_WIN_SC }],
          total: CPU_WIN_SC,
        });
        const updated = await db.get('SELECT wins, losses, elo, elo_cube, sc FROM users WHERE id = ?', [userId]);
        if (updated && sid) io.to(sid).emit('user_stats_updated', updated);
      } catch (err) {
        console.error('[CPU battle] SC award error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    })();
  }

  for (let i = 0; i < 2; i++) sendGameState(room, i);
}

// CPU turn driver. Delegates to the brain module in cards/effects/_cpu.js.
// Passes the room and the set of action helpers the brain is allowed to call.
const { runCpuTurn, installCpuBrain, shouldMulliganStartingHand, setCpuVerbose, getCpuVerbose, setCpuTranscribeFn, setRolloutHorizon, getRolloutHorizon, setRolloutBrain, getRolloutBrain, seedExploreAttempts } = require('./cards/effects/_cpu');
// ═══════════════════════════════════════════════════════════════════
//  GEGNERSPEZIFISCHE BATTLE-THEMES (1.8.)
// ═══════════════════════════════════════════════════════════════════
// In public/music liegt je CPU-Gegner ein `bgm_<slug>.ogg`. Der Slug ist
// der NAME des mittleren Helden OHNE dessen Titel, kleingeschrieben und
// ohne Leerzeichen.
//
// Der Titel steht dabei mal HINTEN ("Tarleinn the Traveler" → tarleinn,
// "Nero Zira, the Mastermind" → nerozira) und mal VORNE ("Bomb Berserker
// Bartas" → bartas, "Idej Lord Daiyo" → daiyo, "Timeless King Zi" → zi),
// und manche Namen sind zweiteilig ("Luna Pele" → lunapele). Aus dem
// Heldennamen allein ist der Slug also NICHT ableitbar — deshalb wird
// gegen die tatsächlich vorhandenen Dateien gematcht.
//
// VERFAHREN: alle zusammenhängenden Wortfolgen des Heldennamens bilden,
// die längste nehmen, für die eine Datei existiert. Bewusst NICHT über
// Teilstrings des zusammengezogenen Namens — das ergab einen echten
// Fehltreffer ("Ort-hos-the-l-oyal" enthält "hel" und hätte Hels Thema
// für Orthos gespielt). Über alle 220 Helden der Datenbank geprüft:
// keine Fehltreffer; die verbleibenden Mehrfachtreffer sind Varianten
// derselben Figur (Beato → Beato, the Eternal Butterfly) und teilen ihr
// Thema zu Recht.
const BGM_GENERIC = new Set(['battle', 'battle1', 'battle2', 'battle3', 'menu', 'menu_diamond', 'shop', 'shop_diamond', 'login', 'puzzle']);
// Der Ordner wird gecached, aber NICHT eingefroren: kommen Themes dazu
// (z.B. bgm_nao.ogg / bgm_orthos.ogg), sollen sie ohne Serverneustart
// greifen. Ausschlag gibt die mtime des VERZEICHNISSES — die ändert sich
// beim Anlegen oder Löschen einer Datei darin. Der stat-Aufruf ist
// zusätzlich zeitgedrosselt, damit er nicht an jedem Zustands-Sync hängt.
let _bgmSlugCache = null;
let _bgmSlugMtime = -1;
let _bgmSlugCheckedAt = 0;
const BGM_RESCAN_MS = 5000;
function bgmAvailableSlugs() {
  const dir = path.join(__dirname, 'public', 'music');
  const now = Date.now();
  if (_bgmSlugCache && now - _bgmSlugCheckedAt < BGM_RESCAN_MS) return _bgmSlugCache;
  _bgmSlugCheckedAt = now;
  let mtime = -1;
  try { mtime = fs.statSync(dir).mtimeMs; } catch { /* kein Musikordner */ }
  if (_bgmSlugCache && mtime === _bgmSlugMtime) return _bgmSlugCache;
  const out = new Set();
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = /^bgm_(.+)\.(ogg|mp3|wav)$/i.exec(f);
      if (m && !BGM_GENERIC.has(m[1].toLowerCase())) out.add(m[1].toLowerCase());
    }
  } catch { /* kein Musikordner → generisches Thema */ }
  _bgmSlugCache = out;
  _bgmSlugMtime = mtime;
  return out;
}
function bgmSlugForHero(heroName) {
  if (!heroName) return null;
  const slugs = bgmAvailableSlugs();
  if (slugs.size === 0) return null;
  const toks = String(heroName).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let best = null;
  for (let i = 0; i < toks.length; i++) {
    for (let j = i + 1; j <= toks.length; j++) {
      const cand = toks.slice(i, j).join('');
      if (slugs.has(cand) && (!best || cand.length > best.length)) best = cand;
    }
  }
  return best;
}
/** Namen aller Abilities mit `isWildcardAbility` (einmal ermittelt). */
let _wildcardAbilCache = null;
function wildcardAbilityNames() {
  if (_wildcardAbilCache) return _wildcardAbilCache;
  const out = [];
  try {
    for (const c of getCardDB ? Object.values(getCardDB()) : []) {
      if (c.cardType !== 'Ability') continue;
      if (loadCardEffect(c.name)?.isWildcardAbility) out.push(c.name);
    }
  } catch { /* Anzeige-Hilfe, nie Abbruchgrund */ }
  _wildcardAbilCache = out;
  return out;
}

/** Thema des CPU-Gegners in diesem Raum — null bei PvP oder ohne Datei. */
function cpuBgmForRoom(room) {
  try {
    if (!room || room.type !== 'singleplayer' || !room.engine) return null;
    // Einmal je Raum auflösen: der mittlere Held wechselt während einer
    // Partie nicht, und der Zustands-Snapshot läuft sehr oft. `null`
    // wird als '' gemerkt, damit auch der Negativfall nicht bei jedem
    // Sync erneut sucht.
    if (room._cpuBgmMemo !== undefined) return room._cpuBgmMemo || null;
    const cpuIdx = room.engine._cpuPlayerIdx;
    if (!(cpuIdx >= 0)) return null;   // noch nicht initialisiert → nicht merken
    // Mittlerer Held (Index 1) — das ist die Figur, nach der die Dateien
    // benannt sind, und zugleich die im Avatar-Portrait gezeigte.
    const hero = room.gameState?.players?.[cpuIdx]?.heroes?.[1];
    if (!hero?.name) return null;      // Zustand noch nicht aufgebaut
    room._cpuBgmMemo = bgmSlugForHero(hero.name) || '';
    // Einmal je Kampf in die Konsole — macht in einem Blick entscheidbar,
    // ob die Server-Seite liefert. Ohne diese Zeile war beim ersten
    // Feldtest nicht unterscheidbar, ob der Slug fehlt, der Client ihn
    // ignoriert oder schlicht ein alter Serverprozess läuft.
    console.log(`[bgm] CPU-Gegner "${hero.name}" → `
      + (room._cpuBgmMemo ? `Theme "${room._cpuBgmMemo}"` : 'KEIN Theme')
      + ` (${bgmAvailableSlugs().size} Themes im Ordner)`);
    return room._cpuBgmMemo || null;
  } catch { return null; }
}

function makeCpuDriver(room) {

  return async function cpuTurn(engine) {
    // ── v386: STILLER HALT WIRD BENANNT ──────────────────────────────
    // `runCpuTurn` kehrt an dutzenden Stellen still zurueck. Steht der
    // CPU-Zug danach UNVERAENDERT (gleiche Zugnummer, gleicher aktiver
    // Spieler, kein Ergebnis), hat niemand die Uebergabe gemacht — im
    // Self-Play endet damit die ganze Kette, `startGame` loest ohne
    // Sieger auf und der Messstand meldet `ohne-spielende`. Genau
    // dieser Fall wird hier festgehalten, samt der Brotkrume, die der
    // Pilot auf dem Ausstiegspfad hinterlassen hat.
    const _vorher = engine._inMctsSim ? null : {
      zug: engine.gs?.turn, aktiv: engine.gs?.activePlayer,
      phase: engine.gs?.currentPhase,
    };
    if (_vorher) engine._cpuTurnMark = null;
    try {
      await runCpuTurn(engine, {
        room,
        doPlayAbility,
        doPlayArtifact,
        doUseArtifactEffect,
        doUsePotion,
        doConfirmPotion,
        doPlaySurprise,
        doPlaySpell,
        doPlayCreature,
        doActivateFreeAbility,
        doActivateCreatureEffect,
        doActivateHeroEffect,
        doActivateEquipEffect,
        doActivateAreaEffect,
        doActivatePermanent,
        doActivateAbility,
        sendGameState,
        sendSpectatorGameState,
      });
      if (_vorher && !engine._inMctsSim && !engine.gs?.result
          && engine.gs?.turn === _vorher.zug
          && engine.gs?.activePlayer === _vorher.aktiv) {
        const eintrag = {
          zug: _vorher.zug, aktiv: _vorher.aktiv,
          phaseVorher: _vorher.phase, phaseNachher: engine.gs?.currentPhase,
          marke: engine._cpuTurnMark || '(keine Marke — Ausstieg nicht instrumentiert)',
          noops: (engine._switchTurnNoops || []).length,
          reentry: engine._switchTurnReentryBlocked || 0,
        };
        if (!engine._silentTurnExits) engine._silentTurnExits = [];
        engine._silentTurnExits.push(eintrag);
        console.warn(`[CPU] STILLER HALT: Zug ${eintrag.zug} p${eintrag.aktiv} `
          + `Phase ${eintrag.phaseVorher}→${eintrag.phaseNachher} — ${eintrag.marke}`);
      }
    } catch (err) {
      // Record the error so the no-result diagnosis (self-play) can report
      // that the CPU driver crashed instead of resolving cleanly.
      if (!engine._driverErrors) engine._driverErrors = [];
      engine._driverErrors.push({
        turn: engine.gs?.turn,
        player: engine._cpuPlayerIdx,
        phase: engine.gs?.currentPhase,
        message: err.message,
        stack: err.stack,
      });
      console.error('[CPU] turn error:', err.message, err.stack);
      // ── RETTUNG (8.8.) ──────────────────────────────────────────────
      // Bricht runCpuTurn mit einer Ausnahme ab, hat NICHTS die Kontrolle
      // zurueckgegeben: `activePlayer` ist weiterhin die CPU, die Phase
      // steht, der Mensch kann nicht handeln — die Partie friert ein.
      // Genau so endete das gemeldete Spiel (Heap-Waechter warf in
      // switchTurn, direkt am ON_TURN_END des Invader Tokens).
      // Die Rundenende-Effekte sind in der Engine ueber
      // `_turnEndHooksDoneForTurn` gegen doppelte Ausloesung gesichert,
      // die Uebergabe laesst sich hier also gefahrlos nachholen.
      try {
        const gs = engine.gs;
        if (gs && !gs.result && !engine._fastMode && !engine._inMctsSim
            && gs.activePlayer === engine._cpuPlayerIdx) {
          console.warn(`[CPU] Zug ${gs.turn} haengt nach Fehler — erzwinge Zugübergabe.`);
          await engine.switchTurn();
        }
      } catch (err2) {
        console.error('[CPU] Rettungs-Zugübergabe fehlgeschlagen:', err2.message);
      }
    }
  };
}

function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const p of room.players) {
    activeGames.delete(p.userId);
    const t = disconnectTimers.get(p.userId);
    if (t) { clearTimeout(t); disconnectTimers.delete(p.userId); }
  }
  destroyRoom(roomId);
  io.emit('rooms', getRoomList());
}

// ─── Card movement animation ───
// Emits to the OPPONENT's socket so their client can animate a cardback
// flying from the owner's hand slot to the destination zone. Areas are
// excluded per product spec — they use their own central reveal flow.
// Payload is intentionally semantic (not CSS selectors) so the client can
// decide how to render the animation.
function broadcastHandToBoard(room, ownerIdx, payload, forceOwnerAnim = false) {
  if (room.engine?._fastMode) return;
  if (!room?.gameState) return;
  const oppIdx = ownerIdx === 0 ? 1 : 0;
  const oppSid = room.gameState.players[oppIdx]?.socketId;
  if (oppSid) io.to(oppSid).emit('hand_to_board_fly', { ownerIdx, ...payload });
  sendToSpectators(room, 'hand_to_board_fly', { ownerIdx, ...payload });
  // Normally the owner sees their own drag animation, so we don't echo
  // the fly back to them. For click-placed plays there's no drag —
  // `forceOwnerAnim` opts the owner in (the client's `onHandToBoard`
  // honours `_forceOwnerAnim`, same path Kassaran / Raptoren use).
  if (forceOwnerAnim) {
    const ownSid = room.gameState.players[ownerIdx]?.socketId;
    if (ownSid) io.to(ownSid).emit('hand_to_board_fly', { ownerIdx, ...payload, _forceOwnerAnim: true });
  }
}

// ─── Action helpers (shared between socket handlers and the CPU brain) ───
// Each helper contains the action's full logic EXCEPT the socket-level auth and
// "is this really your turn / your hand index" checks. The caller is trusted to
// pass a valid playerIdx. Returns true on success, false on early-return.

async function doPlayAbility(room, pi, { cardName, handIndex, heroIdx, zoneSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false; // Must be Main Phase 1 or 2

  const ps = gs.players[pi];
  if (!ps) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Ability') return false;

  // ── ASCENDED-ONLY-ABILITIES DURCHSETZEN (1.8.) ─────────────────────
  // `ascendedHeroOnly` markiert Abilities, deren Kartentext das Anlegen
  // auf einen Ascended Hero beschränkt ("You can only attach this
  // Ability to an Ascended Hero" — aktuell Smugness). Das Flag wurde
  // bisher NUR gelesen, um dem Client `ascendedOnlyAbilities` zu
  // schicken; dort graut app-board.jsx die Handkarte aus. Serverseitig
  // gab es keine Prüfung — die CPU konsultiert das Flag nicht und legte
  // die Ability an beliebige Helden an, ein manipulierter Client
  // ebenfalls. Dieselbe Signatur wie `neverPlayable`, gefunden im
  // Vertrags-Sweep vom 1.8.
  //
  // Die Prüfung spiegelt exakt die des Clients (Kartentyp des Helden),
  // damit Ausgrauen und Ablehnen nie auseinanderlaufen. Bewusst NUR
  // dieser Hand-Play-Pfad: server-getriebene Attach-Prompts haben ihre
  // eigenen Regeln (vgl. `allowRestricted` beim Client).

  const hero = ps.heroes[heroIdx];
  if (!hero || !hero.name || hero.hp <= 0) return false;
  if (loadCardEffect(cardName)?.ascendedHeroOnly
      && getCardDB()[hero.name]?.cardType !== 'Ascended Hero') return false;
  // Divine Gift of Skill grants up to 4 extra ability attachments to the
  // chosen hero this turn. Standard slot is consumed first; bonuses fill
  // additional plays beyond it.
  const bonusAvailable = (ps._bonusAbilityAttachments?.[heroIdx] || 0) > 0;
  if (ps.abilityGivenThisTurn[heroIdx] && !bonusAvailable) return false;

  const abZones = ps.abilityZones[heroIdx] || [[], [], []];
  const script = loadCardEffect(cardName);

  if (script?.canAttachToHero && !script.canAttachToHero(gs, pi, heroIdx, room.engine)) return false;

  if (script?.customPlacement) {
    if (zoneSlot < 0 || zoneSlot >= 3) return false;
    const zone = abZones[zoneSlot] || [];
    if (!script.customPlacement.canPlace(zone)) return false;
    abZones[zoneSlot].push(cardName);
  } else {
    // Standard placement: stack onto existing same-name zone, or take a free zone
    let existingZoneIdx = -1;
    let existingCount = 0;
    for (let z = 0; z < 3; z++) {
      if ((abZones[z] || []).length > 0 && abZones[z][0] === cardName) {
        existingZoneIdx = z;
        existingCount = abZones[z].length;
        break;
      }
    }
    if (existingZoneIdx >= 0) {
      if (existingCount >= 3) return false;
      abZones[existingZoneIdx].push(cardName);
    } else {
      if (zoneSlot >= 0 && zoneSlot < 3 && (abZones[zoneSlot] || []).length === 0) {
        abZones[zoneSlot] = [cardName];
      } else {
        let freeZ = -1;
        for (let z = 0; z < 3; z++) {
          if ((abZones[z] || []).length === 0) { freeZ = z; break; }
        }
        if (freeZ < 0) return false;
        abZones[freeZ] = [cardName];
      }
    }
  }

  ps.abilityZones[heroIdx] = abZones;
  ps.hand.splice(handIndex, 1);
  room.engine.notePlayedFromHand(pi);
  // Consume the standard slot first; if it's already used, spend a bonus
  // attachment from Divine Gift of Skill instead. Track which slot was
  // consumed so a negation refund can return it cleanly.
  let _consumedBonusSlot = false;
  if (!ps.abilityGivenThisTurn[heroIdx]) {
    ps.abilityGivenThisTurn[heroIdx] = true;
  } else if ((ps._bonusAbilityAttachments?.[heroIdx] || 0) > 0) {
    ps._bonusAbilityAttachments[heroIdx]--;
    _consumedBonusSlot = true;
  }

  // Sync the visible Blessed buff: decrement remaining when a bonus slot
  // was just used and recompute the lock flag (a freshly-attached Magic
  // Arts ability bumps the hero past the Skill threshold and clears the
  // lock — the tooltip should reflect that immediately). Drop the buff
  // when no bonus slots remain.
  if (hero.buffs?.blessed_skill) {
    const blessed = hero.buffs.blessed_skill;
    if (_consumedBonusSlot) blessed.remaining = Math.max(0, blessed.remaining - 1);
    blessed.locked = room.engine.isHeroSkillLocked(pi, heroIdx);
    if (blessed.remaining <= 0) delete hero.buffs.blessed_skill;
  }

  const finalZone = abZones.findIndex(z => (z || []).includes(cardName));
  const inst = room.engine._trackCard(cardName, pi, 'ability', heroIdx, Math.max(0, finalZone));

  room.engine.log('ability_attached', { player: ps.username, card: cardName, hero: hero.name });
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'ability', heroIdx, slotIdx: Math.max(0, finalZone) });

  try {
    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, heroIdx, cardType: 'Ability', goldCost: 0,
    });

    if (chainResult.negated) {
      const abZones2 = ps.abilityZones[heroIdx] || [];
      let zoneSlotFound = null;
      for (let z = 0; z < abZones2.length; z++) {
        const idx = abZones2[z].lastIndexOf(cardName);
        if (idx >= 0) { zoneSlotFound = z; abZones2[z].splice(idx, 1); break; }
      }
      // Foreign-origin abilities (Magic Lamp gifts etc.) discard to
      // the ORIGINAL owner's pile when negated.
      const negatedAbilityOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      // Die Ability liegt beim Negieren schon sichtbar in ihrer
      // Zone — Flug also von DORT statt aus der Hand (Als Befund 5.8.).
      // `zoneSlotFound` merkt sich, aus welchem Slot sie entfernt wurde.
      await room.engine.routeNegatedInitialCard(negatedAbilityOwner, cardName, chainResult, -1,
        { fromZone: 'ability', fromHeroIdx: heroIdx, fromSlotIdx: zoneSlotFound });
      // Refund whichever slot was consumed (regular vs Skill bonus).
      if (_consumedBonusSlot) {
        if (!ps._bonusAbilityAttachments) ps._bonusAbilityAttachments = {};
        ps._bonusAbilityAttachments[heroIdx] = (ps._bonusAbilityAttachments[heroIdx] || 0) + 1;
        // Restore the Blessed buff: re-add the slot to the visible
        // counter, and re-create the buff entry if it was deleted when
        // remaining hit 0 mid-resolve.
        if (!hero.buffs) hero.buffs = {};
        if (!hero.buffs.blessed_skill) {
          hero.buffs.blessed_skill = { remaining: 0, locked: false, source: 'Divine Gift of Skill' };
        }
        hero.buffs.blessed_skill.remaining++;
        hero.buffs.blessed_skill.locked = room.engine.isHeroSkillLocked(pi, heroIdx);
      } else {
        ps.abilityGivenThisTurn[heroIdx] = false;
        // The regular slot was the consumer — Magic Arts level may have
        // dropped back below 1, so re-evaluate the lock flag.
        if (hero.buffs?.blessed_skill) {
          hero.buffs.blessed_skill.locked = room.engine.isHeroSkillLocked(pi, heroIdx);
        }
      }
      room.engine.log('ability_negated', { card: cardName, player: ps.username });
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx });
    await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx });
  } catch (err) {
    console.error('[Engine] doPlayAbility hooks error:', err.message, err.stack);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlayArtifact(room, pi, { cardName, handIndex, heroIdx, zoneSlot, clickPlaced, targetOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  // Hand waehrend einer erzwungenen Abwurf-Stapelabfrage gesperrt —
  // Artefakte laufen nicht ueber validateActionPlay, brauchen den
  // Riegel also eigens.
  if (gs._forceDiscardLock === pi) return false;
  if (gs._chainResolvingLock) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps.itemLocked && (ps.hand || []).length < 2) return false;
  // Boomerang's "no Artifacts for the rest of this turn" lockout —
  // self-expiring (the stored turn number invalidates on the next
  // turn-rollover). Blocks all proactive Artifact plays via this path.
  if (ps._artifactLockTurn === gs.turn) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Artifact') return false;

  // ── KARTENEIGENES SPIELBARKEITS-GATE (16.8.) ───────────────────────
  // `canPlayWithHero` ist der Vertrag, mit dem eine KARTE sagt „ich darf
  // hier gerade nicht gespielt werden". Die Engine fragt ihn beim
  // Auflisten der spielbaren Handkarten (getHeroPlayableCards) — aber
  // ARTEFAKTE laufen nicht ueber `validateActionPlay`, und dieser Pfad
  // hat den Vertrag bisher gar nicht gekannt. Das Gate war damit reine
  // Anzeige: der Client graute die Karte aus, ein direkter Aufruf kam
  // trotzdem durch. Aufgefallen beim Debt-O-Tron-Archetyp — dessen fuenf
  // „Model"-Karten sind nur bei negativem Gold spielbar und „Damage
  // Fees" ist hart einmal pro Zug; beides waere umgehbar gewesen.
  // Gilt ab jetzt fuer JEDES Artefakt mit dem Vertrag.
  {
    const _gate = loadCardEffect(cardName);
    if (_gate?.canPlayWithHero
        && !_gate.canPlayWithHero(gs, pi, heroIdx, cardData, room.engine)) return false;
  }

  // ── HAND-SPERRE DURCHSETZEN (1.8.) ─────────────────────────────────
  // `neverPlayable` markiert Karten, die aus der HAND wirkungslos sind
  // und nur über einen anderen Weg ins Spiel kommen (Coolness-Stapel,
  // Discard, Reaktionsfenster). Bisher wurde das Flag AUSSCHLIESSLICH an
  // den Client gereicht (`neverPlayableCards`), um die Karte auszugrauen
  // — eine reine Anzeige. Weder der Server noch das CPU-Gehirn haben es
  // je geprüft.
  //
  // Folge, belegt in Als Mitschnitt vom 1.8.: die CPU equipte
  // "Swellpnir, Mount of Coolness" in Zug 1 direkt aus der Hand
  // (`artifact_equipped`, cost 0) und bekam die Zusatzaktion
  // (`second_action_granted`) — obwohl der Coolness-Stapel da noch leer
  // war (erster `coolness_stack_push` erst 23 Ereignisse später).
  // Betrifft nicht nur Swellpnir/Modnir, sondern alle 20 Karten mit
  // diesem Flag.
  //
  // Die Prüfung gehört auf den SERVER, nicht nur in die CPU: ein
  // manipulierter Client könnte den Zug sonst genauso schicken.
  if (loadCardEffect(cardName)?.neverPlayable) return false;

  // ── ZIEH-LOCK AUCH FÜR ARTEFAKTE DURCHSETZEN (1.8.) ────────────────
  // `blockedByDrawLock` wird in `validateActionPlay` geprüft — Artefakte
  // laufen dort aber vorbei (dieselbe Lücke wie bei `neverPlayable`).
  // Folge: die CPU spielte unter dem Lock von "The Sacred Jewel" weitere
  // Sacred Jewels, deren Ziehteil garantiert fizzlet.
  //
  // Die Karte deklariert das Flag selbst, und der Client graut sie
  // bereits aus (`drawLockBlockedCards`) — hier fehlte nur die
  // Durchsetzung. Kreaturen sind wie im Engine-Pfad ausgenommen.
  {
    const _scr = loadCardEffect(cardName);
    const _me = gs.players[pi];
    if (_scr?.blockedByDrawLock && _me?.drawLocked && cardData.cardType !== 'Creature') return false;
    if (_scr?.blockedByHandLock && _me?.handLocked && cardData.cardType !== 'Creature') return false;
  }

  // Artifact-Creature hybrids whose script declares
  // `placesOnOpponentBoard: true` (Powder Keg etc.) accept the drag-
  // drop path INTO the opponent's Support Zones. The downstream
  // isArtifactCreature branch checks the same flag to flip the
  // placement owner to opp. Other isTargetingArtifact cards still
  // route exclusively through the click → use_artifact_effect path.
  const _script = loadCardEffect(cardName);
  const _isCrossSideArtifact = !!_script?.placesOnOpponentBoard;
  if (_script?.isTargetingArtifact && !_isCrossSideArtifact) return false;

  // Rusting Crystal aura — doubles the base cost BEFORE reductions
  // so discounts apply to the already-doubled price. Idempotent for
  // multi-copy / suppressed cases (see helper).
  const rawCost = applyRustingCrystalCostMultiplier(
    gs, pi, cardName, cardData.cost || 0, room.engine,
  );
  // Player-wide next-artifact discount (Shu'Chaku) AND per-hand-index
  // discounts (Play Money) both stack, capped at 0.
  const playerReduction = ps._nextArtifactCostReduction || 0;
  const handReduction = (ps._handCostReductions?.[handIndex] || 0)
    + (ps._handCostReductionsPermanent?.[handIndex] || 0)
    // ★ Namensweiter Nullpreis (Misfire, Als Ruling 21.8.): „das
    // NAECHSTE Artefakt mit diesem Namen diese Runde" — egal welche
    // Kopie, also NICHT ueber den Handindex. Der Eintrag wird beim
    // tatsaechlichen Spielen verbraucht und beim Zugbeginn geloescht.
    + ((ps._freeArtifactNames && ps._freeArtifactNames[cardName]) ? rawCost : 0)
    // ★ `selfCostReduction(gs, pi, cardData, engine)` — eine Karte
    // verbilligt SICH SELBST (Future Tech Laser Cannon: −20 je Kopie in
    // der Ablage). Bewusst ein eigener Vertrag und nicht `dynamicCost`:
    // den liest der Server NUR bei Reaktionen. Additiv und
    // rueckwaertskompatibel — kein Artefakt exportiert ihn per Default.
    + (typeof _script?.selfCostReduction === 'function'
      ? (_script.selfCostReduction(gs, pi, cardData, room.engine) || 0) : 0);
  // Target-Hero equip discount: a Hero script may export
  // `equipCostReduction(gs, pi, heroIdx, cardData, engine)` to discount
  // Artifacts equipped ONTO it (Tsu'Ki: Lunatic Cycle cards −10).
  // Additive + backward-compatible — no Hero exports it by default.
  let heroEquipReduction = 0;
  {
    const _eqOwner = _isCrossSideArtifact ? (pi === 0 ? 1 : 0) : pi;
    const _eqHero = gs.players[_eqOwner]?.heroes?.[heroIdx];
    const _eqHeroScript = _eqHero?.name ? loadCardEffect(_eqHero.name) : null;
    if (typeof _eqHeroScript?.equipCostReduction === 'function') {
      heroEquipReduction = _eqHeroScript.equipCostReduction(gs, pi, heroIdx, cardData, room.engine) || 0;
    }
  }
  const costReduction = playerReduction + handReduction + heroEquipReduction;
  const cost = Math.max(0, rawCost - costReduction);
  if (!room.engine.canAffordGold(pi, cost, cardName)) return false;

  // For cross-side artifacts (Powder Keg etc.), the client's `heroIdx`
  // targets the OPPONENT's hero column. Dereference the host hero
  // from opp's `ps` so existence and placement checks line up with
  // the actual placement target. Standard (own-side) artifacts keep
  // the original `ps.heroes[heroIdx]` semantics.
  //
  // FREE-SIDE EQUIP: a pure Equipment Artifact with NO inherent
  // `canEquipToHero` restriction may be equipped to EITHER side's
  // eligible Hero. The client sends the chosen side as `targetOwner`.
  // Such an equip becomes OWNED by the host Hero's controller (the
  // Powder-Keg ownership model — `inst.owner` = host side so that
  // side triggers its effects; `inst.originalOwner` re-stamped to the
  // caster below for discard/return routing). Restricted equips
  // (canEquipToHero present) and cross-side artifacts ignore
  // `targetOwner` and keep their fixed side.
  const _subLowerEarly = (cardData.subtype || '').toLowerCase();
  const _isFreeSideEquip = _subLowerEarly === 'equipment'
    && !_isCrossSideArtifact
    && typeof _script?.canEquipToHero !== 'function'
    && (targetOwner === 0 || targetOwner === 1);
  const placementOwner = _isCrossSideArtifact
    ? (pi === 0 ? 1 : 0)
    : (_isFreeSideEquip ? targetOwner : pi);
  const placementPs = gs.players[placementOwner];
  if (!placementPs) return false;
  const hero = placementPs.heroes[heroIdx];
  if (!hero || !hero.name) return false;
  const subLower = (cardData.subtype || '').toLowerCase();
  const isEquip = subLower === 'equipment';
  const isArtifactCreature = subLower.split('/').some(t => t.trim() === 'creature');

  if (isEquip) {
    // v341: die drei Zustandssperren stehen jetzt in `_hooks.js`, damit
    // Karten, die per `safePlaceInSupport` direkt ausruesten, dieselbe
    // Regel lesen statt sie nachzubauen (und dabei Teile zu vergessen).
    if (!heroCanBeEquipped(hero)) return false;

    const equipScript = loadCardEffect(cardName);
    if (equipScript?.canEquipToHero && !equipScript.canEquipToHero(gs, pi, heroIdx, room.engine)) return false;
    if (equipScript?.oncePerGame) {
      const opgKey = equipScript.oncePerGameKey || cardName;
      if (ps._oncePerGameUsed?.has(opgKey)) return false;
    }

    // Placement zones belong to the HOST side (`placementPs`), which is
    // the caster for own-side / restricted equips and the opponent for
    // a free-side equip targeting their Hero.
    if (!placementPs.supportZones[heroIdx]) placementPs.supportZones[heroIdx] = [[], [], []];
    let finalSlot = zoneSlot;
    if (finalSlot < 0) {
      for (let z = 0; z < 3; z++) {
        if ((placementPs.supportZones[heroIdx][z] || []).length === 0) { finalSlot = z; break; }
      }
      if (finalSlot < 0) return false;
    }
    if (finalSlot < 0 || finalSlot >= 3) return false;
    if ((placementPs.supportZones[heroIdx][finalSlot] || []).length > 0) return false;

    ps.hand.splice(handIndex, 1);
    room.engine.notePlayedFromHand(pi);

    room.engine.log('artifact_equipped', { player: ps.username, card: cardName, hero: hero.name, cost });
    room.engine._trackTerrorResolvedEffect(pi, cardName);
    broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: finalSlot, destOwner: placementOwner }, !!clickPlaced);

    try {
      const oi = pi === 0 ? 1 : 0;
      const oppSid = gs.players[oi]?.socketId;
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
      sendToSpectators(room, 'card_reveal', { cardName });
      await room.engine._delay(100);

      if (ps.itemLocked && (ps.hand || []).length > 0) {
        await room.engine.actionPromptForceDiscard(pi, 1, {
          title: 'Item Lock Cost',
          description: 'You must delete 1 card from your hand to use an Artifact.',
          source: 'Item Lock', deleteMode: true, selfInflicted: true,
        });
      }

      const chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
        resolve: async () => {
          // `cardName` mit: nur so greift `selfGoldOverdraft` (Debt-O-Tron
          // Damage Fees darf sich selbst auch aus dem Minus bezahlen).
          // Namensweiten Nullpreis verbrauchen — er gilt nur EINMAL.
          if (ps._freeArtifactNames && ps._freeArtifactNames[cardName]) {
            delete ps._freeArtifactNames[cardName];
          }
          await room.engine._payCardCost(pi, cost, { cardName });
          if (costReduction > 0) {
            delete ps._nextArtifactCostReduction;
            delete ps._nextArtifactCostReductionTurn;
          }
          const result = room.engine.safePlaceInSupport(cardName, placementOwner, heroIdx, finalSlot);
          if (!result) {
            ps.discardPile.push(cardName);
            room.engine.log('equip_fizzle', { card: cardName, reason: 'zone_occupied_by_chain' });
            return true;
          }
          const { inst, actualSlot } = result;
          // Free-side equip onto the opponent's Hero: the equip is now
          // OWNED/controlled by that Hero's side (so THEY trigger its
          // effects and assign its heal/damage), but the physical card
          // belongs to the caster — re-stamp `originalOwner` so it
          // routes to the caster's discard/return pile (same model
          // Powder Keg uses for cross-side Artifact-Creatures).
          if (placementOwner !== pi && inst) inst.originalOwner = pi;
          await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualSlot });
          await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });
          if (equipScript?.oncePerGame) {
            const opgKey = equipScript.oncePerGameKey || cardName;
            if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
            ps._oncePerGameUsed.add(opgKey);
          }
          return true;
        },
      });

      if (chainResult.negated) await room.engine.routeNegatedInitialCard(pi, cardName, chainResult);
    } catch (err) {
      console.error('[Engine] doPlayArtifact (equip) error:', err.message);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  if (isArtifactCreature) {
    // ── BESCHWOERUNGSSPERREN (Als Ruling 17.8.) ──────────────────────
    // „Ab dem Moment, wo sie beschworen wuerden, waeren sie Creatures.
    //  Das heisst, sie checken vor dem Ausspielen ganz normal wie andere
    //  Creatures auch, ob Sperren existieren."
    //
    // Das war bis hierher NICHT so: die Sperren stehen in
    // `doPlayCreature` (server.js ~Z7753), und eine Artifact Creature
    // laeuft nie dort durch, sondern hier. `getSummonBlocked` hat sie
    // zwar schon ausgegraut — der Server haette den Zug aber trotzdem
    // angenommen. Grauton ohne Durchsetzung.
    //
    // Geprueft wird gegen den SPIELENDEN Spieler `pi`, nicht gegen den
    // Platzierungs-Besitzer: die Sperre haengt am Beschwoerer. Powder Keg
    // legt auf die Gegnerseite, prueft aber die eigene Sperre.
    if (ps.summonLocked) return false;
    try {
      if (room.engine.getSummonBlocked(pi).includes(cardName)) return false;
    } catch (err) {
      console.error('[Engine] getSummonBlocked (artifact creature) error:', err.message);
    }
    // Der per-Held-Teil (`isCreatureSummonable`: Gigantisaurs-Belegung,
    // Chimera & Co.) nur fuer die EIGENE Seite. Bei Cross-Side-Platzierung
    // waere der Zielheld der des Gegners — dort dieselbe Pruefung zu
    // fahren waere eine eigene Regelfrage, die Al nicht beantwortet hat.
    if (placementOwner === pi && !room.engine.isCreatureSummonable(cardName, pi, heroIdx)) return false;

    // For cross-side placement, use opp's supportZones; otherwise own.
    if (!placementPs.supportZones[heroIdx]) placementPs.supportZones[heroIdx] = [[], [], []];
    let finalSlot = zoneSlot;
    if (finalSlot < 0) {
      for (let z = 0; z < 3; z++) {
        if ((placementPs.supportZones[heroIdx][z] || []).length === 0) { finalSlot = z; break; }
      }
      if (finalSlot < 0) return false;
    }
    if (finalSlot < 0 || finalSlot >= 3) return false;
    if ((placementPs.supportZones[heroIdx][finalSlot] || []).length > 0) return false;

    // ── ENTNAHME AUFGESCHOBEN (Als Report 16.8., v414) ──────────────
    // Vorher wurde die Karte HIER aus der Hand genommen — also VOR dem
    // Kettenfenster. Waehrend des Fensters lag sie damit nirgends, und
    // Al sah sie „kurz in die Hand zurueckspringen, gehighlightet
    // werden und dann wieder in die Zone springen".
    //
    // Jetzt bleibt sie — ausgegraut, wie bei `doPlayCreature` — bis zur
    // Aufloesung in der Hand liegen und wandert in EINEM Zug in die
    // Zone. Genau Als Vorgabe: „sollte sofort dort landen, wie eine
    // Creature."
    //
    // Der AUSRUESTUNGS-Zweig weiter oben bleibt bewusst unberuehrt:
    // dort meldet niemand ein Problem, und er haengt an ganz anderen
    // Pfaden (Cross-Side-Equip, Powder Keg, freie Gegner-Helden).
    beginHandResolve(ps, cardName, handIndex);
    let handEntnommen = false;
    /** Nimmt die Karte JETZT aus der Hand. Mehrfachaufruf folgenlos. */
    const entnimmHandkarte = () => {
      const idx = commitHandResolve(ps, {
        onRemoved: () => {
          room.engine.notePlayedFromHand(pi);
        },
      });
      if (idx >= 0) handEntnommen = true;
      return idx;
    };

    room.engine.log('artifact_creature_placed', { player: ps.username, card: cardName, hero: hero.name, cost });
    room.engine._trackTerrorResolvedEffect(pi, cardName);

    try {
      // ── KEIN VORAB-REVEAL, KEINE 100-ms-PAUSE (Als Report 16.8.) ──
      // DAS war die eigentliche Ursache des Zurueckspringens — nicht
      // die Entnahme (die v414 bereits aufgeschoben hat).
      //
      // Der Ablauf war: Karte fallenlassen → Drag-Geist verschwindet →
      // der Client zeigt wieder seinen letzten Serverstand, in dem die
      // Karte noch in der Hand liegt → 100 ms Pause → erst dann laeuft
      // die Kette durch und die Karte landet. Diese 100 ms sind lang
      // genug, um die Karte sichtbar in die Hand zurueckspringen und
      // dort (als aufzuloesende Karte) aufleuchten zu lassen.
      //
      // `doPlayCreature` macht beides NICHT: kein Vorab-Reveal, keine
      // Pause. Ohne Gegner-Reaktion loest `executeCardWithChain` sofort
      // auf („No reactions — resolve normally"), die Karte landet im
      // selben Tick, und genau deshalb sieht Aggressive Town Guard
      // richtig aus. Artefakt-Kreaturen machen es jetzt genauso.
      //
      // Der Gegner verliert nichts: er sieht die Karte weiterhin per
      // `hand_to_board_fly` in die Zone fliegen (dieselbe Information,
      // die ihm eine normale Kreatur gibt), und gibt es tatsaechlich
      // eine Reaktion, oeffnet das Reaktionsfenster ohnehin seine
      // eigene Anzeige.
      //
      // Der AUSRUESTUNGS-Zweig behaelt Reveal und Pause: dort landet
      // die Karte an einem Helden statt in einer Zone, niemand meldet
      // ein Problem, und ich fasse ihn ohne Anlass nicht an.

      // Item Lock laeuft VOR dem Kettenfenster — und seit die Karte
      // dort noch in der Hand liegt, koennte der Spieler ausgerechnet
      // sie selbst loeschen. `eligibleIndicesWithoutResolving` nimmt
      // ihren Slot aus der Auswahl; als FUNKTION uebergeben, weil die
      // Indizes nach jedem Abwurf rutschen (Muster von Wheels).
      // Bleibt danach nichts Loeschbares uebrig, entfaellt die Abgabe.
      if (ps.itemLocked && (ps.hand || []).length > 0) {
        const waehlbar = eligibleIndicesWithoutResolving(ps);
        if (waehlbar().length > 0) {
          await room.engine.actionPromptForceDiscard(pi, 1, {
            title: 'Item Lock Cost',
            description: 'You must delete 1 card from your hand to use an Artifact.',
            source: 'Item Lock', deleteMode: true, selfInflicted: true,
            eligibleIndices: waehlbar,
          });
        }
      }

      const chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
        resolve: async () => {
          // `cardName` mit: nur so greift `selfGoldOverdraft` (Debt-O-Tron
          // Damage Fees darf sich selbst auch aus dem Minus bezahlen).
          // ── ENTNAHME VOR DER ZAHLUNG (Als Report 16.8., v419) ────────
          // DAS war der letzte Rest des Zurueckspringens. `_payCardCost`
          // ruft mitten drin `this.sync()` (damit eine daraus geoeffnete
          // Abfrage den neuen Goldstand zeigt) — und in genau diesem
          // Zustandsversand lag die Karte noch in der Hand, markiert als
          // „loest gerade auf". Der Client zeichnete sie also einen
          // Moment lang aufleuchtend in der Hand, bevor sie in die Zone
          // wanderte. Danach laufen auch noch AFTER_RESOURCE_SPEND-Hooks,
          // die ihrerseits Abfragen oeffnen duerfen (Money Printer) —
          // dieser Moment konnte also beliebig lang werden.
          //
          // `doPlayCreature` hat das Problem nicht, weil Kreaturen gar
          // kein Gold kosten: dort gibt es zwischen Ablegen und Setzen
          // ueberhaupt keinen Zustandsversand.
          //
          // Die Karte verlaesst die Hand deshalb VOR der Zahlung. Sie
          // liegt damit fuer die Dauer der Zahlung nirgends — das ist
          // unsichtbar, weil der Client in dieser Zeit keinen Anlass
          // hat, die Handkarte zu zeichnen, waehrend eine Rueckkehr in
          // die Hand sehr wohl auffaellt.
          //
          // Bewusst NICHT auch das Setzen vorgezogen: dann koennte ein
          // frisch gespieltes Debt-O-Tron-Modell auf seine EIGENE
          // Kostenzahlung triggern (die Modelle verlangen
          // `zone === 'support'`). Das waere eine Regelaenderung, die
          // Al nicht bestellt hat.
          // Reihenfolge: FLUG → ENTNAHME → ZAHLUNG → SETZEN.
          // Der Flug zuerst, weil sein Client-Handler den Quell-Slot per
          // `data-hand-idx` im DOM sucht und still abbricht, wenn er ihn
          // nicht findet (`if (!sourceEl || !destEl) return;`). Nach der
          // Entnahme ist die Hand einen Slot kuerzer — beim letzten
          // Handplatz gaebe es das Element nicht mehr und der Gegner
          // saehe gar keine Flugbahn.
          const handIdxJetzt = getResolvingHandIndex(ps);
          broadcastHandToBoard(room, pi, {
            cardName,
            handIndex: handIdxJetzt >= 0 ? handIdxJetzt : handIndex,
            zoneType: 'support',
            heroIdx, slotIdx: finalSlot,
            destOwner: placementOwner,
          }, !!clickPlaced);
          entnimmHandkarte();
          // Namensweiten Nullpreis verbrauchen — er gilt nur EINMAL.
          if (ps._freeArtifactNames && ps._freeArtifactNames[cardName]) {
            delete ps._freeArtifactNames[cardName];
          }
          await room.engine._payCardCost(pi, cost, { cardName });
          if (costReduction > 0) {
            delete ps._nextArtifactCostReduction;
            delete ps._nextArtifactCostReductionTurn;
          }
          // Cross-side placement marks the Creature instance owned by
          // the opponent (host side) so all "you control" / sacrifice /
          // buff reads on opp's side count it correctly. `isPlacement:
          // true` runs onPlay + onCardEnterZone while skipping host-
          // incapacitation gates (Powder Keg's text explicitly allows
          // dead / Frozen / Stunned hosts).
          // `selfPlacement: true` — DIES IST DER EIGENE SPIELWEG der Karte
          // aus der Hand, nicht ein Fremdeffekt. Ohne die Fahne greift der
          // Artifact-Creature-Riegel in `summonCreatureWithHooks` (v438)
          // und `placed` wird null; der Block darunter legt die Karte dann
          // in den Ablagestapel. Genau so sah Als Regressionsbericht aus:
          // „drag/droppe ich eine in eine Support Zone, geht sie in den
          // Discard, statt beschworen zu werden."
          //
          // Mein v438-Denkfehler: ich hatte behauptet, der Handweg der
          // sieben laufe nicht durch `summonCreatureWithHooks`. Geprueft
          // hatte ich nur die KARTENSKRIPTE (Powder Keg) — nicht diesen
          // Zweig hier, der genau das tut. Dritte Auflage derselben Lehre.
          const placed = await room.engine.summonCreatureWithHooks(
            cardName, placementOwner, heroIdx, finalSlot,
            {
              source: 'Artifact-Creature play',
              isPlacement: _isCrossSideArtifact,
              selfPlacement: true,
              // Zustand SOFORT nach dem Setzen versenden, VOR Glanz und
              // Hooks (Als Report 17.8. zum Drag&Drop). Ohne das zeigt der
              // Client waehrend der ganzen Beschwoerung noch seinen alten
              // Stand — Karte in der Hand, Zone leer — und die Karte
              // „springt zurueck", bis der Versand am Ende sie umsetzt.
              // Die Entnahme ist an dieser Stelle laengst passiert, der
              // eine Versand zeigt also Hand UND Zone in einem Zug.
              syncOnPlacement: true,
            },
          );
          if (!placed) {
            ps.discardPile.push(cardName);
            room.engine.log('artifact_creature_fizzle', { card: cardName, reason: 'no_free_zone_or_canceled' });
            return true;
          }
          // Cross-side artifacts re-stamp `originalOwner` to the
          // playing player so the corpse routes to THEIR discard
          // pile per the engine's standard discard-routing rule —
          // Powder Keg conceptually belongs to whoever fired it.
          if (_isCrossSideArtifact && placed.inst) {
            placed.inst.originalOwner = pi;
          }
          return true;
        },
      });

      if (chainResult.negated) {
        // Negiert: `resolve` lief nie, die Karte liegt also noch in der
        // Hand. Erst entnehmen, dann routen — sonst laege sie doppelt
        // (Hand UND Ablage).
        entnimmHandkarte();
        await room.engine.routeNegatedInitialCard(pi, cardName, chainResult);
      }
    } catch (err) {
      console.error('[Engine] doPlayArtifact (creature) error:', err.message);
    } finally {
      // Sicherheitsnetz. Ist die Karte hier noch nicht entnommen, ging
      // etwas schief, BEVOR bezahlt oder gesetzt wurde — dann bleibt
      // sie in der Hand liegen, nur der Merker faellt weg (sonst waere
      // sie fuer immer ausgegraut). Das ist strikt besser als frueher:
      // dort war die Karte nach einem Fehler verloren, weil die
      // Entnahme laengst passiert war.
      if (!handEntnommen) abortHandResolve(ps);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // Non-equipment, non-creature Artifacts (Normal/Reaction/Area/Surprise) are
  // routed through use_artifact_effect (doUseArtifactEffect) instead.
  return false;
}

/**
 * Distracting Crystal in `pi`'s hand blocks any effect they activate
 * that would shuffle cards from hand / discard / board back into the
 * deck. The card-author tags matching effects with
 * `script.shufflesFromHandOrDiscardIntoDeck: true`; this helper consults the tag and
 * the `pi`-side hand contents. Used as a top-of-handler gate in every
 * `doActivate*` / `doPlay*` / `doUseArtifactEffect` / `doConfirmPotion`
 * path so the play is silently rejected before any state mutation.
 */
/**
 * Rusting Crystal aura — while a copy sits in `pi`'s hand, the cost
 * of every OTHER Artifact the player plays is doubled. The
 * doubling is applied to the base cost BEFORE per-play reductions
 * (Shu'Chaku discount, Play Money rebate). Big Gwen Guard's
 * suppression aura lifts the effect. Idempotent — multiple Rusting
 * Crystals in hand still produce a single ×2, matching "This effect
 * does not stack with itself."
 *
 * Returns the (possibly-doubled) base cost.
 */
// ★ Die Verdopplung selbst lebt seit v573 in `_crystals-shared.js` —
// dort, wo auch ihre Ausnahme (`selfRevealEffectsSuppressed`) steht und
// wo eine KARTE sie erreichen kann (Future Tech Copy Device bezahlt die
// Kosten der Karte, deren Identität sie annimmt). Hier bleibt nur die
// Durchreiche, damit die beiden Aufrufstellen unten unverändert lesen.
function applyRustingCrystalCostMultiplier(gs, pi, cardName, baseCost, engine) {
  const { applyRustingCrystalCostMultiplier: helfer } = require('./cards/effects/_crystals-shared');
  return helfer(gs, pi, cardName, baseCost, engine);
}

function isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, cardName, engine) {
  if (!cardName) return false;
  const ps = gs.players?.[pi];
  if (!ps) return false;
  if (!(ps.hand || []).includes('Distracting Crystal')) return false;
  // Big Gwen Guard's aura suppresses every self-reveal Crystal's
  // in-hand effect for its controller (see _crystals-shared.js).
  if (engine) {
    const { selfRevealEffectsSuppressed } = require('./cards/effects/_crystals-shared');
    if (selfRevealEffectsSuppressed(engine, pi)) return false;
  }
  const sc = loadCardEffect(cardName);
  return !!sc?.shufflesFromHandOrDiscardIntoDeck;
}

async function doPlaySpell(room, pi, { cardName, handIndex, heroIdx, charmedOwner, attachmentZoneSlot, viaCreatureInstId }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  // ── Warum ist der Play gescheitert? (Diagnose, 13.8.) ──────────────
  // `doPlaySpell` steigt an rund einem Dutzend Stellen mit einem
  // stummen `return false` aus, und die Aufloesung kann zusaetzlich
  // abgebrochen werden. Im CPU-Log stand davon bisher nur
  // `shrank=false` — genau so ist Overheal Shock in Als Lauf zweimal
  // hintereinander verpufft, ohne dass irgendwo ein Grund auftauchte.
  // Der Stempel wird bei JEDEM Aufruf zurueckgesetzt und von
  // `diagnoseFailedPlay` (_cpu.js) ausgelesen. Reine Diagnose: kein
  // Zweig liest ihn, das Spielverhalten bleibt unveraendert.
  delete gs._cpuPlayFailReason;
  const _bail = (grund) => { gs._cpuPlayFailReason = grund; return false; };

  const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Spell', 'Attack'], { charmedOwner });
  if (!v) return _bail('validateActionPlay: nein (Level/Schule, Sperre, Handindex oder spellPlayCondition)');
  const { ps, cardData, hero, script, isActionPhase, isMainPhase, wasBerserkGranted } = v;
  // `isInherentAction` is mutable post-onPlay: Curse (and any future
  // card with the same dual-mode shape) sets `gs._spellForcesActionConsume`
  // during its onPlay to flip the engine's "inherent" classification
  // back to "consumes a main Action". The flag is consumed and the
  // local re-bound just before the action-economy hooks fire below.
  let isInherentAction = v.isInherentAction;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, cardName, room.engine)) return _bail('Distracting Crystal sperrt das Zurueckmischen');

  // Wolflesia-style Creature spell-cast routing: the client sends
  // `viaCreatureInstId` when the player picked a Creature as the
  // visible caster (or dropped on her support slot). We:
  //   • set `gs._spellCasterOverride` so the engine's `_broadcastEvent`
  //     anchors caster-side animations on the Creature's slot instead
  //     of the host hero's zone (Heal beam etc. originate from her);
  //   • force-consume the matching `bypassesCasterRequirement`
  //     additional action so the play counts as Wolflesia's free
  //     additional, not the host hero's main action — even when the
  //     host hero could have cast it normally.
  // Cleared in the finally block below so it never leaks into a
  // subsequent spell cast.
  let _viaCreature = null;
  if (viaCreatureInstId != null) {
    const creature = room.engine.cardInstances.find(c => c.id === viaCreatureInstId);
    if (creature && creature.zone === 'support'
        && (creature.controller ?? creature.owner) === pi) {
      _viaCreature = creature;
      gs._spellCasterOverride = {
        owner: creature.owner,
        heroIdx: creature.heroIdx,
        zoneSlot: creature.zoneSlot,
      };
    }
  }

  // Consume Silence's one-use bypass token as soon as validation succeeds.
  // After this point the Spell lock fully applies — any further Spell attempts
  // this turn are blocked.
  if (cardData.cardType === 'Spell'
      && ps._spellLockTurn === gs.turn
      && ps._silenceBonusSpell === gs.turn) {
    ps._silenceBonusSpell = -1;
  }

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const wisdomDiscardCost = room.engine.getWisdomDiscardCost(heroOwner, heroIdx, cardData);

  const actionsPlayedThisPhase = ps._actionsPlayedThisPhase || 0;
  const hasBonusAction = isActionPhase && (
    (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1)
  );
  const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0) && !hasBonusAction;
  // Reaction-subtype Spells / Attacks / Creatures are exempt from the
  // action-economy machinery — they never consume an action slot, never
  // burn an additional-action provider, and never bump
  // `_actionsPlayedThisPhase` (which would otherwise misclassify them
  // as "the second action this Action Phase" and trigger second-action
  // grant fizzles, _bonusMainActions consumption, onActionUsed hooks,
  // etc.). The proactive-play path is the only one a Reaction can
  // reach; non-proactive Reactions go through the chain-reaction
  // window and never touch this counter.
  const isReactionSubtype = (cardData.subtype || '').toLowerCase() === 'reaction';
  // Wolflesia-style Creature spell-cast: force-consume the bypass
  // additional action regardless of phase, so the play never counts
  // as the host hero's main action even when they had a free slot.
  const forceAdditional = _viaCreature != null;
  // Match an additional-action provider up front. A type flagged
  // `preferOverMainAction` (Idej Sword - Muras's free first Attack)
  // is used EVEN when the Hero's main turn-Action is still available
  // — being the free extra is its whole point. Other providers
  // (Friendship, Wolflesia, second-action grants, …) are only
  // consulted when an additional action is genuinely needed
  // (Main Phase / after the Hero has acted).
  const matchedAddlType = isReactionSubtype
    ? null
    : room.engine.findAdditionalActionForCard(pi, cardName, heroIdx);
  const matchedPrefersAddl = !!matchedAddlType
    && !!room.engine._additionalActionTypes?.[matchedAddlType]?.preferOverMainAction;
  // `!isInherentAction` muss BEIDE Terme decken, nicht nur den
  // Main-Phase-Term. Eine inhärente Zusatz-Aktion ist per Definition
  // keine Aktion — sie darf in der Action Phase auch dann noch laufen,
  // wenn die reguläre Aktion schon verbraucht ist. Genau dafür ist sie
  // da. Vorher fiel sie bei `actionAlreadyUsed` in den
  // Provider-Zweig, fand keinen (inhärente Karten bringen ja keinen
  // aaGrant mit), und `doPlaySpell` brach STILL mit `return false` ab:
  // Karte anklickbar, Held wählbar, dann passierte nichts. Betrifft
  // jede Spell/Attack mit `inherentAction` — Coolness Overcharge, die
  // Divine Gifts, Cure, Quick Attack … Der Creature-Pfad
  // (doSummonCreature) macht es seit jeher richtig, daher fiel die
  // Asymmetrie nie auf; die Klammerung hier ist an ihn angeglichen.
  const needsAdditional = !isReactionSubtype
    && (forceAdditional || ((isMainPhase || actionAlreadyUsed) && !isInherentAction) || matchedPrefersAddl);
  let additionalConsumed = false;
  let consumedInst = null;
  if (needsAdditional) {
    const typeId = matchedAddlType;
    if (!typeId) {
      // Clean up the spell-caster override we set above before bailing,
      // otherwise the next spell cast in this turn could pick it up.
      if (_viaCreature) delete gs._spellCasterOverride;
      return _bail('braucht eine Zusatz-Aktion, aber kein Geber passt zur Karte');
    }
    consumedInst = room.engine.consumeAdditionalAction(pi, typeId);
    additionalConsumed = true;
  }

  // Stash the final inherent/non-inherent disposition of this play so
  // card scripts can read it from inside their onPlay handler. True iff
  // the engine is treating this play as the script's inherent grant
  // (no main action consumed, no additional-action source consumed) —
  // Gate to the Armory's "if inherent, end the turn" post-resolve
  // clause and any future card with the same dual-mode disposition
  // read this. Cleared in the finally block below so it never leaks
  // into a subsequent cast.
  gs._spellWasInherent = isInherentAction && !additionalConsumed;
  // Did this play actually spend the caster's MAIN turn Action? FALSE for
  // inherent additional-Action Spells (the Divine Gifts), additional-action
  // provider plays, and Reaction-subtype Spells — none of which consume the
  // main Action. Read during the chain-reaction window by negate-and-refund
  // Reactions (Shamanic Curse) so they only hand back an Action that was
  // genuinely spent; refunding one that wasn't strands the caster with a
  // phantom bonus Action that traps them in the Action Phase (soft-lock).
  gs._spellConsumedMainAction = !isReactionSubtype && !isInherentAction && !additionalConsumed;

  // Track whether THIS play's increment crossed into action-2 and
  // consumed _bonusMainActions, so a cancellation can roll back both
  // the counter and the bonus-action slot.
  let actionCounterIncrementedHere = false;
  let bonusMainActionsConsumedHere = false;
  if (isActionPhase && !isReactionSubtype) {
    ps._actionsPlayedThisPhase = (ps._actionsPlayedThisPhase || 0) + 1;
    actionCounterIncrementedHere = true;
    if (ps._actionsPlayedThisPhase === 2 && (ps._bonusMainActions || 0) > 0) {
      ps._bonusMainActions = 0;
      bonusMainActionsConsumedHere = true;
    }
  }

  // Hero-script pre-action cost (Saint Nicolas Potion pick + mark).
  // Fires AFTER action-economy is set up so we don't prompt the player
  // when the action wouldn't be legal anyway, but BEFORE we set
  // `_resolvingCard` / start the spell — that way the prompt feels
  // pre-action, and any state mutation the hook performs (Potion
  // escrow marker) is reversible via the commit/refund pair below.
  // `payHeroActionCost` is async: it may run a `pickHandCard` prompt.
  // Returns false when the player cancels — we refund action-economy
  // and bail without ever resolving the spell.
  const paidHeroCost = await room.engine.payHeroActionCost(pi, heroIdx);
  if (!paidHeroCost) {
    if (additionalConsumed && consumedInst) {
      room.engine.restoreAdditionalAction(consumedInst);
    }
    if (actionCounterIncrementedHere) {
      ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
    }
    if (bonusMainActionsConsumedHere) {
      ps._bonusMainActions = 1;
    }
    if (_viaCreature) delete gs._spellCasterOverride;
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return _bail('Helden-Aktionskosten wurden nicht bezahlt (payHeroActionCost sagt nein)');
  }
  // From here on the hero cost is in 'pending' state — the try/finally
  // below must call commit (on success) or refund (on cancel/negate)
  // before doPlaySpell returns. The `finally` block is a safety net.
  let _heroCostFinalized = false;

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  // Spell-in-flight counter — gates advancePhase so the turn can't end
  // while a Spell is still mid-resolve (e.g. Rain of Arrows waiting on
  // Ida's single-target prompt). Bumped here before onPlay; released
  // explicitly below the moment effect resolution finishes (so the
  // engine's own auto-advance to Main Phase 2 isn't blocked by its own
  // counter), and the finally serves as a double-release-safe safety net.
    // Stale-flag safety net — mirror of the engine-side resolution starts:
  // clear a leaked `_spellNegatedByEffect` when an OUTERMOST spell
  // resolution begins (see preDamageMultiTargetWindow's depth-0 notes).
  if ((gs._spellResolutionDepth || 0) === 0) delete gs._spellNegatedByEffect;
  gs._spellResolutionDepth = (gs._spellResolutionDepth || 0) + 1;
  // Resolving-Spell name stack: paired with the depth counter so
  // `addHeroStatus` / `actionAddBuff` / `_actionHealHeroImpl` can
  // auto-honor Anti Magic without scripts threading a source
  // argument. Cleared in the same `_releaseSpellDepth` path so all
  // exit branches (cancel / negate / normal / error) pop exactly once.
  // Only Spells push (Anti Magic doesn't block Attacks). cardData
  // is the resolving card; `cardType === 'Spell'` catches Normal,
  // Reaction, Surprise, Attachment, Area subtypes.
  if (cardData.cardType === 'Spell') room.engine._pushResolvingSpell(cardName);
  let _spellDepthReleased = false;
  const _releaseSpellDepth = () => {
    if (_spellDepthReleased) return;
    _spellDepthReleased = true;
    gs._spellResolutionDepth = Math.max(0, (gs._spellResolutionDepth || 1) - 1);
    if (cardData.cardType === 'Spell') room.engine._popResolvingSpell();
  };

  try {
    const inst = room.engine._trackCard(cardName, pi, 'hand', heroIdx, -1);
    if (charmedOwner != null) inst.heroOwner = charmedOwner;

    // Hand-to-board fly animation for Attachment-subtype Spells. The card
    // attaches to heroIdx's hero card — we don't know the exact slot yet
    // (card scripts pick it inside onPlay), so we target the hero card
    // itself and let the client route to a visually sensible destination.
    if ((cardData.subtype || '').toLowerCase() === 'attachment') {
      broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'hero', heroIdx });
    }

    room.engine._setPendingPlayLog('spell_played', { card: cardName, player: ps.username, hero: hero.name, cardType: cardData.cardType });

    if (script?.payActivationCost) {
      try {
        const costCtx = room.engine._createContext(inst, {});
        await script.payActivationCost(costCtx);
      } catch (err) {
        console.error(`[Engine] payActivationCost for ${cardName} failed:`, err.message);
      }
    }

    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, cardType: cardData.cardType, goldCost: 0, heroIdx,
      resolve: null,
    });

    if (chainResult.negated) {
      // Refund the Hero pre-action cost — the spell never actually
      // resolved its effect (a Reaction negated it). Saint Nicolas
      // treats negation as "didn't go through", so the marked Potion
      // stays in hand.
      await room.engine.refundHeroActionCost(pi, heroIdx);
      _heroCostFinalized = true;
      const hi = getResolvingHandIndex(ps);
      ps._resolvingCard = null;
      if (hi >= 0) { ps.hand.splice(hi, 1); room.engine.notePlayedFromHand(pi); }
      // Foreign-origin cards (Magic Lamp gifts etc.) route to the
      // ORIGINAL owner's discard pile, not the caster's. Falls back
      // to `pi` when the card has no foreign-origin tag.
      const discardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      // `hi` = the pre-splice hand slot; the client hasn't synced the
      // splice yet, so the slot still renders → flight starts there.
      await room.engine.routeNegatedInitialCard(discardOwner, cardName, chainResult, hi);
      room.engine._untrackCard(inst.id);
      // Wisdom cost is paid IMMEDIATELY after the spell leaves hand,
      // BEFORE any phase-advance / turn-end mechanics can interrupt.
      // Otherwise a Flashbanged / Terror turn-end fired by the
      // action-used hooks would walk past this discard prompt.
      if (wisdomDiscardCost > 0) {
        await room.engine.actionPromptForceDiscard(pi, wisdomDiscardCost, {
          title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
        });
      }
      if (additionalConsumed && consumedInst) {
        room.engine.restoreAdditionalAction(consumedInst);
      }
      if (cardData.cardType === 'Attack') {
        ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
        if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
        if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
        hero._attacksThisTurn = (hero._attacksThisTurn || 0) + 1;
        // Negated-attack path mirrors the resolved-attack path:
        // attacksPlayedThisTurn / _attacksThisTurn are bumped because
        // the Attack WAS played (the Reaction just negated its
        // effects). By symmetry the Berserk charge — if the
        // inherent grant came from Berserk — is now spent too.
        if (wasBerserkGranted) hero._berserkChargeUsedTurn = gs.turn;
        if (hero.ghuanjunAttacksUsed && !hero.ghuanjunAttacksUsed.includes(cardName)) hero.ghuanjunAttacksUsed.push(cardName);
        // Drop any arrows armed for this negated attack — otherwise a
        // follow-up attack this turn would inherit them.
        const { clearArmedArrows } = require('./cards/effects/_arrows-shared');
        clearArmedArrows(room.engine, pi);
      } else if (cardData.cardType === 'Spell') {
        ps.spellsPlayedThisTurn = (ps.spellsPlayedThisTurn || 0) + 1;
      }
      if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
      if (!isInherentAction && !additionalConsumed && !isReactionSubtype && !ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
      if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;
      if (isActionPhase && !additionalConsumed && !isInherentAction) {
        await room.engine.advanceToPhase(pi, 4);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    gs._spellDamageLog = [];
    gs._spellExcludeTargets = [];
    gs._spellCancelled = false;

    if (!chainResult.chainFormed) {
      gs._pendingCardReveal = { cardName, ownerIdx: pi };
    }

    if (attachmentZoneSlot != null && attachmentZoneSlot >= 0) gs._attachmentZoneSlot = attachmentZoneSlot;
    // For a live CPU cast: stream the card to centre BEFORE its effect
    // resolves (no-op for humans / PvP / MCTS sim). Idempotent — the
    // post-resolution _firePendingCardReveal below then no-ops.
    room.engine.maybeFireCpuRevealEarly();
    await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });
    delete gs._attachmentZoneSlot;
    // Post-onPlay inherency override — Curse's "normal Action mode"
    // (Action Phase pre-acted, picked a non-qualifying target) sets
    // this flag from its onPlay to convert the engine's default
    // inherent classification into a consuming main Action. All three
    // downstream branches (onActionUsed, heroesActedThisTurn push,
    // phase auto-advance) read the rebound `isInherentAction` below.
    if (gs._spellForcesActionConsume) {
      isInherentAction = false;
      delete gs._spellForcesActionConsume;
    }
    await room.engine._flushSurpriseDrawChecks();

    if (gs._spellCancelled && !gs._spellNegatedByEffect) {
      // Player aborted the spell mid-resolve (target cancel, etc.) —
      // refund the Hero pre-action cost. Marked Potion stays in hand.
      await room.engine.refundHeroActionCost(pi, heroIdx);
      _heroCostFinalized = true;
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      ps._resolvingCard = null;
      room.engine._untrackCard(inst.id);
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._spellCancelled;
      // Roll back ALL action-economy bookkeeping — the Spell never
      // resolved, so the Action resource wasn't actually spent. Without
      // this, a cancelled action-2 attempt leaves _actionsPlayedThisPhase
      // stuck at 2, which makes the engine's `_isSecondActionGrantAvailable`
      // gate hide every isSecondActionGrant provider (those require
      // actionsPlayed===1) — the player can't retry their second action.
      if (additionalConsumed && consumedInst) {
        room.engine.restoreAdditionalAction(consumedInst);
      }
      if (actionCounterIncrementedHere) {
        ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
      }
      if (bonusMainActionsConsumedHere) {
        ps._bonusMainActions = 1;
      }
      // Spell was cancelled pre-resolution — release the in-flight lock
      // now (the finally would also catch this, but being explicit makes
      // the intent clear and matches the post-resolution release below).
      _releaseSpellDepth();
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      // Diagnose: die Karte bleibt in der Hand, obwohl `true`
      // zurueckgeht — fuer die CPU sieht das aus wie ein wirkungsloser
      // Play. Der haeufigste Grund ist ein Ziel-Prompt, der leer
      // beantwortet wurde (`_spellCancelled` aus dem Kartenskript).
      gs._cpuPlayFailReason = 'Aufloesung abgebrochen (_spellCancelled) — Ziel-Prompt leer oder keine gueltigen Ziele';
      return true;
    }
    delete gs._spellCancelled;

    // Spell resolved cleanly past the cancel gate — commit the Hero
    // pre-action cost. Saint Nicolas transfers the marked Potion to
    // the opponent's hand here, so the visual flight runs concurrently
    // with the spell's resolution / post-cast bookkeeping.
    await room.engine.commitHeroActionCost(pi, heroIdx);
    _heroCostFinalized = true;

    if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
    else room.engine._firePendingPlayLog();

    const becameFreeAction = gs._spellFreeAction === true;
    delete gs._spellFreeAction;
    if (becameFreeAction && additionalConsumed && consumedInst) {
      room.engine.restoreAdditionalAction(consumedInst);
      additionalConsumed = false;
    }

    const uniqueTargets = [];
    const seenIds = new Set();
    for (const t of (gs._spellDamageLog || [])) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
    }

    if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
    // Additional-action plays (Friendship etc.) do NOT consume the hero's
    // normal turn slot — they're explicitly "extra beyond the normal".
    // Marking the hero here would force any follow-up normal action in
    // Action Phase to need ANOTHER additional action, which isn't the
    // intended semantics of `additionalConsumed`. Reaction-subtype plays
    // are similarly action-economy-exempt (don't spend the Action
    // resource at all).
    if (!isInherentAction && !additionalConsumed && !isReactionSubtype && !ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
    if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;

    if (!gs._spellNegatedByEffect) {
      // Per-player, whole-game record of Spell names whose effect has
      // successfully resolved (negated Spells are excluded — we're
      // inside the not-negated branch). Read by Chaos Magic to skip
      // Spells the player has already resolved this game. Lazy-init so
      // it's empty per fresh game state; deduped by name. Attacks also
      // route through doPlaySpell, so gate strictly on Spell.
      if (cardData.cardType === 'Spell') {
        if (!ps._spellsResolvedThisGame) ps._spellsResolvedThisGame = [];
        if (!ps._spellsResolvedThisGame.includes(cardName)) ps._spellsResolvedThisGame.push(cardName);
      }
      await room.engine.runHooks('afterSpellResolved', {
        spellName: cardName, spellCardData: cardData, heroIdx, casterIdx: pi,
        damageTargets: uniqueTargets, isSecondCast: !!gs._bartasSecondCast,
        // The provider instance whose additional-action token was just
        // consumed by THIS spell-play, or null if the spell was cast as
        // a normal action. Friendship's draw rider gates on this so it
        // only fires for spells played AS the additional action — a
        // normally-cast Support Magic Spell from the same Hero no longer
        // pays the draw bonus.
        viaAdditionalProvider: additionalConsumed ? consumedInst : null,
        _skipReactionCheck: true,
      });
    }

    // Clean up any armed-arrow modifiers that chained onto THIS attack —
    // see `cards/effects/_arrows-shared.js`. Happens regardless of
    // negate, so a negated attack still drops the arrows (otherwise a
    // later same-turn attack would inherit them). Idempotent / no-op
    // when nothing is armed.
    if (cardData.cardType === 'Attack') {
      const { clearArmedArrows } = require('./cards/effects/_arrows-shared');
      clearArmedArrows(room.engine, pi);
    }

    await room.engine.resolveDeferredRecoil();
    await room.engine._executeDeferredSurprises();

    // Effect resolution is complete — release the in-flight lock BEFORE
    // the engine's own auto-advance to Main Phase 2 below, otherwise
    // advanceToPhase would refuse its own call. The finally is idempotent.
    _releaseSpellDepth();

    delete gs._spellDamageLog;
    delete gs._spellExcludeTargets;
    delete gs._bartasSecondCast;
    delete gs._spellNegatedByEffect;
    delete gs._surpriseCheckedHeroes;
    delete gs._deferredRecoil;
    delete gs._ameShieldedHeroes;
    delete gs._ameDeclinedHeroes;

    const resolveHi = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (resolveHi >= 0) { ps.hand.splice(resolveHi, 1); room.engine.notePlayedFromHand(pi); }
    if (gs._spellPlacedOnBoard) {
      delete gs._spellPlacedOnBoard;
    } else if (gs._spellReturnToHand) {
      // Rocket Fist etc. — the resolved Spell/Attack returns to its
      // caster's hand instead of going to the discard pile. Origin
      // tracking is consumed so a re-play routes its piles correctly.
      delete gs._spellReturnToHand;
      if (resolveHi >= 0) {
        room.engine._consumeHandCardOrigin(pi, cardName);
        ps.hand.push(cardName);
      }
      room.engine._untrackCard(inst.id);
    } else {
      if (resolveHi >= 0) {
        // Foreign-origin cards (Magic Lamp etc.) discard to their
        // ORIGINAL owner's pile. `_consumeHandCardOrigin` returns `pi`
        // for normally-owned cards, so the local case is unchanged.
        const discardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
        gs.players[discardOwner].discardPile.push(cardName);
      }
      room.engine._untrackCard(inst.id);
    }

    // Wisdom cost is paid IMMEDIATELY after the spell leaves the
    // caster's hand, BEFORE any onActionUsed / onAnyActionResolved
    // hooks (Flashbang's turn-end, Reiza's bonus action, etc.) and
    // BEFORE any phase-advance. If we leave it at the end of the
    // function the way it used to be, a Flashbanged caster's turn
    // ends mid-flow on the action-used hook, the CPU runs an entire
    // counter-turn while we're still mid-await here, and by the time
    // we resume the player has long since moved on — the prompt
    // either fires too late or gets eaten by stale state. Paying
    // costs upfront matches Wisdom's "always paid even if the spell
    // is negated, interrupted, or fizzles" contract.
    if (wisdomDiscardCost > 0) {
      await room.engine.actionPromptForceDiscard(pi, wisdomDiscardCost, {
        title: 'Wisdom Cost', source: 'Wisdom', selfInflicted: true,
      });
    }

    if (cardData.cardType === 'Spell' && hasSpellSchool(cardData, 'Support Magic')) {
      ps.supportSpellUsedThisTurn = true;
      if (additionalConsumed && consumedInst?.counters?._aaLastConsumed?.startsWith('friendship_support')) {
        // Read ability zones from the HERO OWNER's side — for charmed
        // casts this differs from the acting player. Using ps.abilityZones
        // here would give the wrong level when the hero is on the opponent.
        const heroPs = gs.players[heroOwner];
        const abZones = heroPs?.abilityZones?.[heroIdx] || [];
        let friendshipLevel = 0;
        for (const slot of abZones) {
          if ((slot || []).includes('Friendship')) { friendshipLevel = (slot || []).length; break; }
        }
        // ONLY Lv1 applies the "no more Support Spells this turn" debuff.
        // Strict equality defends against friendshipLevel=0 (detection
        // miss — treat as "no Friendship present, don't add a penalty").
        if (friendshipLevel === 1) {
          ps.supportSpellLocked = true;
          room.engine.log('support_spell_locked', { player: ps.username, by: 'Friendship' });
        }
      }
    }

    if (cardData.cardType === 'Attack') {
      ps.attacksPlayedThisTurn = (ps.attacksPlayedThisTurn || 0) + 1;
      if (!ps.heroesAttackedThisTurn) ps.heroesAttackedThisTurn = [];
      if (!ps.heroesAttackedThisTurn.includes(heroIdx)) ps.heroesAttackedThisTurn.push(heroIdx);
      hero._attacksThisTurn = (hero._attacksThisTurn || 0) + 1;
      // Berserk charge consumed: the validation pass made this Attack
      // inherent on Berserk's behalf (rather than the Attack's own
      // script-level `inherentAction` flag), so the once-per-turn
      // grant is now spent.
      if (wasBerserkGranted) hero._berserkChargeUsedTurn = gs.turn;
    } else if (cardData.cardType === 'Spell') {
      ps.spellsPlayedThisTurn = (ps.spellsPlayedThisTurn || 0) + 1;
    }

    if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction && !isReactionSubtype) {
      await room.engine.runHooks('onActionUsed', {
        actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
        isAdditional: false, _skipReactionCheck: true,
      });
    } else if (additionalConsumed) {
      await room.engine.runHooks('onActionUsed', {
        actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
        isAdditional: true, _skipReactionCheck: true,
      });
      await room.engine.runHooks('onAdditionalActionUsed', {
        actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, playedCardName: cardName, heroIdx,
        _skipReactionCheck: true,
      });
    }
    // ── Universal "any action resolved" hook ──
    // Unlike onActionUsed (which skips inherent + free plays so things
    // like Reiza's bonus-action-on-poison don't fire on Quick Attack),
    // this hook fires for EVERY action play — Spell/Attack/Creature/
    // Ability/HeroEffect, regardless of whether it consumed the main
    // action slot. Flashbang listens here so it correctly ends the
    // turn on the first inherent / additional / free action too.
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: cardData.cardType.toLowerCase(), playerIdx: pi, cardName, heroIdx,
      isAdditional: !!additionalConsumed,
      isInherent: !!isInherentAction,
      isFree: !!becameFreeAction,
      _skipReactionCheck: true,
    });

    // Spell-driven force-end-of-turn rider. A Spell's onPlay sets
    // `gs._spellEndsTurn = true` to request that the turn end as soon
    // as the Spell finishes resolving (Tanuki Escape's "immediately
    // end your turn afterwards" clause). The advance has to happen
    // HERE — not inside onPlay — because `advanceToPhase` short-
    // circuits while `_spellResolutionDepth > 0` (see its guard), and
    // depth is only released by `_releaseSpellDepth()` above. Runs
    // BEFORE the auto-MAIN2 advance below so we skip the transient
    // MAIN2 state when the spell was cast in Action Phase.
    if (gs._spellEndsTurn) {
      delete gs._spellEndsTurn;
      if (!gs.result) {
        const cur = gs.currentPhase;
        // Legal transitions to END are MAIN1 / ACTION / MAIN2 → END.
        if (cur === 2 || cur === 3 || cur === 4) {
          await room.engine.advanceToPhase(pi, 5);
        }
      }
    }
    // Spreading Rumor fumble rider — the inherent path was taken
    // because the casting Hero had Action capacity, but the Spell
    // whiffed (0 cards discarded). Retroactively consume the Action
    // that would have been spent. Order: prefer an additional-action
    // provider; otherwise mark the main Action spent (advance to
    // Action Phase from Main 1, or to Main Phase 2 from an Action-
    // Phase cast — including the "between two actions" case where
    // the engine already consumed _bonusMainActions during the
    // inherent play). `_preventPhaseAdvance` suppresses the engine's
    // auto-MAIN2 below so this rider owns all phase changes.
    if (gs._spreadingRumorFumbled) {
      const fumble = gs._spreadingRumorFumbled;
      delete gs._spreadingRumorFumbled;
      gs._preventPhaseAdvance = true;
      if (!gs.result) {
        const fps = gs.players[fumble.pi];
        const typeId = (typeof room.engine.findAdditionalActionForCard === 'function')
          ? room.engine.findAdditionalActionForCard(fumble.pi, fumble.cardName, fumble.heroIdx)
          : null;
        if (typeId) {
          room.engine.consumeAdditionalAction(fumble.pi, typeId);
          room.engine.log('rumor_fumble_consume_additional', {
            player: fps?.username,
          });
          room.engine.sync();
        } else if (gs.currentPhase === 2) {
          // Main Phase 1 → consume the upcoming main Action: half-
          // second pacing, advance to Action Phase, mark hero acted,
          // then either stay (second-Action grant alive) or advance
          // to Main Phase 2.
          room.engine.log('rumor_fumble_consume_main', {
            player: fps?.username,
          });
          await room.engine._delay(500);
          if (gs.currentPhase === 2) {
            await room.engine.advanceToPhase(fumble.pi, 3);
          }
          const fps2 = gs.players[fumble.pi];
          if (fps2) {
            if (!Array.isArray(fps2.heroesActedThisTurn)) fps2.heroesActedThisTurn = [];
            if (!fps2.heroesActedThisTurn.includes(fumble.heroIdx)) {
              fps2.heroesActedThisTurn.push(fumble.heroIdx);
            }
            // Engine reset _actionsPlayedThisPhase to 0 on ACTION
            // entry — bump back to 1 so the second-Action gate fires
            // correctly for any follow-up plays this phase.
            fps2._actionsPlayedThisPhase = (fps2._actionsPlayedThisPhase || 0) + 1;
          }
          room.engine.sync();
          await room.engine._delay(500);
          const hasSecondAction = !!(fps2 && (
            ((fps2._bonusMainActions || 0) > 0)
            || (fps2.bonusActions?.heroIdx === fumble.heroIdx
                && fps2.bonusActions.remaining > 0)
            || room.engine.cardInstances.some(c => {
              if (c.owner !== fumble.pi || !c.counters?.additionalActionAvail) return false;
              const config = room.engine._additionalActionTypes?.[c.counters.additionalActionType];
              return !!config?.isSecondActionGrant;
            })
          ));
          if (!hasSecondAction && gs.currentPhase === 3) {
            await room.engine.advanceToPhase(fumble.pi, 4);
          }
        } else if (gs.currentPhase === 3) {
          // Action Phase — engine already ticked _actionsPlayedThis-
          // Phase (and consumed _bonusMainActions if relevant) for
          // the inherent play. Mark the hero acted (if not already)
          // and advance to Main Phase 2 — per spec the "between two
          // actions" fumble consumes the second Action, no stay.
          room.engine.log('rumor_fumble_consume_main', {
            player: fps?.username,
          });
          if (fps) {
            if (!Array.isArray(fps.heroesActedThisTurn)) fps.heroesActedThisTurn = [];
            if (!fps.heroesActedThisTurn.includes(fumble.heroIdx)) {
              fps.heroesActedThisTurn.push(fumble.heroIdx);
            }
          }
          room.engine.sync();
          await room.engine._delay(500);
          if (gs.currentPhase === 3) {
            await room.engine.advanceToPhase(fumble.pi, 4);
          }
        }
        // currentPhase 4 (MAIN2) with no additional → defensive
        // no-op. The inherent gate (in spreading-rumor.js) shouldn't
        // have allowed this play in the first place.
      }
    }
    if (isActionPhase && !additionalConsumed && !isInherentAction && !becameFreeAction && !gs._preventPhaseAdvance) {
      await room.engine.advanceToPhase(pi, 4);
    }
    if (isActionPhase && additionalConsumed && !gs._preventPhaseAdvance) {
      // Only `isSecondActionGrant` providers gate the post-action-2
      // advance. Generic additional-action providers (Friendship,
      // Wolflesia, Lizbeth, etc.) are designed for Main Phase use and
      // don't represent unspent Action resource — they shouldn't trap
      // the player in Action Phase after the second Action has been
      // performed.
      const hasMoreSecondAction = room.engine.cardInstances.some(c => {
        if (c.owner !== pi || !c.counters?.additionalActionAvail) return false;
        const config = room.engine._additionalActionTypes?.[c.counters.additionalActionType];
        return !!config?.isSecondActionGrant;
      });
      if (!hasMoreSecondAction) {
        await room.engine.advanceToPhase(pi, 4);
      }
    }
    delete gs._preventPhaseAdvance;

    if (script?.oncePerGame) {
      const opgKey = script.oncePerGameKey || cardName;
      if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
      ps._oncePerGameUsed.add(opgKey);
    }

    // (Wisdom discard is paid earlier — right after the spell leaves
    // the caster's hand. See the comment above that earlier site.)
  } catch (err) {
    console.error('[Engine] doPlaySpell error:', err.message, err.stack);
  } finally {
    // Safety net: if neither commit nor refund ran (uncaught error,
    // unexpected exit), refund so a marked Potion isn't stranded in
    // the player's hand with a stale escrow flag.
    if (!_heroCostFinalized) {
      try { await room.engine.refundHeroActionCost(pi, heroIdx); } catch {}
    }
    // Safety-net release — idempotent via _releaseSpellDepth's flag, so
    // this is a no-op if resolution already released normally above. Only
    // fires on error / early returns that skipped the explicit release.
    _releaseSpellDepth();
    // Always clear the spell-caster animation override so it never
    // leaks into a subsequent cast.
    if (gs._spellCasterOverride) delete gs._spellCasterOverride;
    // Same one-shot semantics for the inherent-disposition stash —
    // delete unconditionally so a subsequent cast computes its own.
    delete gs._spellWasInherent;
    delete gs._spellConsumedMainAction;
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateCreatureEffect(room, pi, { heroIdx, zoneSlot, charmedOwner, instId }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const ps = gs.players[heroOwner];
  if (!ps) return false;
  const hero = ps.heroes?.[heroIdx];
  // Creatures are independent of their slot's Hero — an own-side
  // activation must succeed even when the Hero is dead or the slot
  // is empty (e.g. left behind by Quetzahuitl's mass-delete). For
  // charmed-side activations we still need a real Hero whose charm
  // status this player owns, since an empty slot can't be charmed.
  if (charmedOwner != null && !hero?.name) return false;

  const slot = (ps.supportZones[heroIdx] || [])[zoneSlot] || [];
  if (slot.length === 0) return false;
  const creatureName = slot[0];

  // ★ 18.8. (geteilte Zonen, „Alice, the Transfer Student"): teilen sich
  // mehrere Kreaturen diesen Platz, sagt `instId`, WELCHE gemeint ist —
  // ohne die Angabe traefe das `find(...)` immer nur die unterste Kopie.
  // Die ID wird gegen den Platz geprueft, damit ein manipulierter Aufruf
  // nicht irgendeine fremde Instanz aktiviert.
  const slotInsts = room.engine.cardInstances.filter(c =>
    (c.owner === heroOwner || c.controller === heroOwner) && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
  );
  const inst = instId != null
    ? slotInsts.find(c => c.id === instId)
    : slotInsts[0];
  if (!inst) return false;
  // CC-locked creatures cannot fire their own effects — mirrors the
  // engine-side filter in getActivatableCreatures and the hook gate in
  // runHooks. Defensive: a stale activate request from a client whose
  // UI hasn't seen the freeze/stun yet would otherwise resolve.
  // Chilly Dog (Mischief Militia) lifts the FROZEN-only silence on the
  // activator's own side — same controller-aware check as the engine.
  const instCtrlForCD = inst.controller ?? inst.owner;
  const chillyDogLiftsForCreature = instCtrlForCD === pi
    && room.engine._isChillyDogActiveFor(pi);
  // Universal negative-status immunity (Lunatic Golem 2+) negates the
  // EFFECT of CC it still carries — it can fire its effect despite
  // Frozen / Stunned / Negated / Nulled. Mirrors the engine-side
  // getActivatableCreatures gate so a valid click isn't rejected here.
  if (!room.engine._creatureNegStatusImmune(inst)) {
    if (inst.counters?.stunned || inst.counters?.negated || inst.counters?.nulled) return false;
    if (inst.counters?.frozen && !chillyDogLiftsForCreature) return false;
  }

  if (charmedOwner != null
      && hero.charmedBy !== pi && hero.controlledBy !== pi
      && inst.stolenBy !== pi) return false;
  // Cardinal Beast immunity — Cardinals + Golden-Wings wearers
  // resist Treacherous Crystal's lend. Check by counter AND name:
  // the counter is set in Cardinal Beasts' onPlay hook, which
  // puzzle-placed Cardinals never fire, so the name fallback is
  // the load-bearing gate for puzzle setups.
  const { CARDINAL_NAMES: CARDS_CARDINAL } = require('./cards/effects/_cardinal-shared');
  if (charmedOwner != null && charmedOwner !== pi
      && (inst.counters?._cardinalImmune || CARDS_CARDINAL.includes(inst.name))) return false;

  const effectName = inst.counters?._effectOverride || creatureName;
  const script = loadCardEffect(effectName);
  if (!script?.creatureEffect || !script?.onCreatureEffect) return false;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, effectName, room.engine)) return false;

  // Phase + action-economy gate. The default creature-effect path is
  // Main-Phase-only and free. Creatures that opt into `creatureActionCost`
  // (Adventurousness-style: "spend an Action") follow the ability
  // action-cost rules — Action Phase OR Main Phase with an additional-
  // action provider that covers the 'ability_activation' category.
  const isActionPhase = gs.currentPhase === 3;
  const isMainPhase   = gs.currentPhase === 2 || gs.currentPhase === 4;
  const isActionCost  = !!script.creatureActionCost;
  // Action-resource gate. Creatures with `creatureActionCost: true`
  // consume the player's per-Action-Phase Action — same resource as
  // Spells / Attacks / abilities with `actionCost: true`. By default
  // the player gets one Action per Action Phase; for ANY action 2+
  // (main slot already used, or playing in Main Phase) we need a
  // matching additional-action provider. heroRestricted +
  // isSecondActionGrant are honoured by `findAdditionalActionForCategory`.
  let consumedAdditionalCreatureInst = null;
  // True iff this creature-effect activation will spend the Hero's main
  // Action slot — used in the success branch below to decide whether
  // to push the Hero into `heroesActedThisTurn`.
  let creatureEffectIsMainAction = false;
  if (isActionCost) {
    if (isActionPhase) {
      const acPs = gs.players[pi];
      const actionsPlayedThisPhase = acPs._actionsPlayedThisPhase || 0;
      const hasBonusAlready = (acPs.bonusActions?.heroIdx === heroIdx && acPs.bonusActions.remaining > 0)
        || ((acPs._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1);
      const actionAlreadyUsed = (acPs.heroesActedThisTurn?.length > 0) && !hasBonusAlready;
      if (actionAlreadyUsed) {
        const typeId = room.engine.findAdditionalActionForCategory(pi, 'ability_activation', heroIdx);
        if (!typeId) return false;
        consumedAdditionalCreatureInst = room.engine.consumeAdditionalAction(pi, typeId);
        if (!consumedAdditionalCreatureInst) return false;
      } else if (!hasBonusAlready) {
        // Fresh Action Phase activation — no bonus, no provider — this
        // IS the player's main Action for the phase.
        creatureEffectIsMainAction = true;
      }
    } else if (isMainPhase) {
      const typeId = room.engine.findAdditionalActionForCategory(pi, 'ability_activation', heroIdx);
      if (!typeId) return false;
      consumedAdditionalCreatureInst = room.engine.consumeAdditionalAction(pi, typeId);
      if (!consumedAdditionalCreatureInst) return false;
    } else {
      return false;
    }
  } else {
    if (!isMainPhase) return false;
  }

  // Summoning sickness gate — Creatures can't fire their active
  // effect on the turn they're summoned. `counters._hasHaste` lifts
  // the gate (set by revives that explicitly grant Haste — Vacarn's
  // Necromancy on its Skeletons, Forceful Revival, …). The actual
  // `turnPlayed` stays correct so "was summoned this turn" reads
  // (Alice the Puppeteer Girl, Hive's Crown, etc.) still see the
  // creature as fresh. Chilly Dog also lifts the gate live for a
  // Frozen own-controlled Creature, mirroring the engine helper —
  // this catches puzzle-mode boards where Chilly Dog spawned
  // pre-frozen-sick allies without firing the haste-grant hook.
  if (inst.turnPlayed === (gs.turn || 0) && !inst.counters?._hasHaste) {
    const ctrlForCD = inst.controller ?? inst.owner;
    const chillyDogLiftsSickness = inst.counters?.frozen
      && ctrlForCD === pi
      && room.engine._isChillyDogActiveFor(pi);
    if (!chillyDogLiftsSickness) return false;
  }

  const hoptKey = `creature-effect:${inst.id}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

  // Ergebnis dieser Aktivierung protokollieren — die CPU liest es statt
  // aus der HOPT-Sperre zu raten (siehe noteActivationOutcome im Engine).
  // Vorbelegung "nicht gefeuert"; die Erfolgspfade unten setzen um.
  room.engine.noteActivationOutcome(hoptKey, false);

  if (script.canActivateCreatureEffect) {
    const checkCtx = room.engine._createContext(inst, { event: 'canCreatureEffectCheck' });
    if (!script.canActivateCreatureEffect(checkCtx)) return false;
  }

  // `actionCost` discriminator on the log entry — true iff this
  // activation consumed the player's Action resource (creatureActionCost
  // creatures like Spawn Mother). Cards that scan the action log for
  // "first Action this turn" (Tengu Windstorm) filter on this so a
  // FREE creature-effect activation doesn't poison the count.
  room.engine._setPendingPlayLog('creature_effect_activated', {
    player: gs.players[pi].username, card: creatureName, hero: hero.name,
    actionCost: !!isActionCost,
  });
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts (see HOPT-stamp on cancel
  // below for the Gerrymander veto path).
  room.engine._lastPromptGerryDeclined = false;

  try {
    const isStolenByPi = inst.stolenBy === pi && inst.controller === pi;
    const charmedHeroCreature = charmedOwner != null && !isStolenByPi;

    const origController = inst.controller;
    const origOwner = inst.owner;
    if (charmedHeroCreature) {
      inst.controller = pi;
      inst.owner = pi;
      inst.heroOwner = charmedOwner;
    } else if (isStolenByPi) {
      inst.heroOwner = inst.owner;
    }

    gs._pendingCardReveal = { cardName: creatureName, ownerIdx: pi };

    // Open a reaction window around the creature-effect activation so
    // Reaction Artifacts that target THIS event (Gigantisaur Skull) can
    // chain in. `cardType: 'CreatureEffect'` keeps existing reactions
    // (Tool Freezer / Master's Plan / Cute Camera) out — they all filter
    // on Spell/Attack/Artifact/Reaction cardTypes. The activating inst
    // is stashed on gs so the reaction's resolve can find it without
    // squeezing extra fields through the initialLink filter.
    gs._creatureEffectActivationContext = {
      activatingInst: inst,
      activator: pi,
      creatureName,
      heroIdx,
    };
    let creatureEffectChainResult;
    try {
      creatureEffectChainResult = await room.engine.executeCardWithChain({
        cardName: creatureName, owner: pi, heroIdx, cardType: 'CreatureEffect',
        goldCost: 0, resolve: null, fromBoard: true,
      });
    } finally {
      delete gs._creatureEffectActivationContext;
    }

    // Negation path — Skull doesn't negate today, but future reactions
    // composing on CreatureEffect could. Mirrors the ability-negation
    // policy at line 4184: stamp HOPT (the activation fired and was
    // countered), refund any consumed additional-action provider, and
    // bail without running the script's onCreatureEffect.
    if (creatureEffectChainResult?.negated) {
      if (charmedHeroCreature) {
        inst.controller = origController;
        inst.owner = origOwner;
        delete inst.heroOwner;
      } else if (isStolenByPi) {
        delete inst.heroOwner;
      }
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      if (consumedAdditionalCreatureInst) {
        room.engine.restoreAdditionalAction(consumedAdditionalCreatureInst);
      }
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;
      await room.engine._flushSurpriseDrawChecks();
      await room.engine._executeDeferredSurprises();
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const ctx = room.engine._createContext(inst, {});
    // Mark this Creature as the ambient prompt source so any confirm /
    // optionPicker its activated effect opens via promptGeneric shows its
    // image (general "which card is prompting" rule; ctx helpers already
    // inject directly). Popped in finally so an error can't leave it set.
    room.engine._promptCardStack.push(inst.name);
    // Waehrend der Kreatur-Effekt laeuft, IST diese Creature die
    // aufloesende Quelle — Dark Ocean fragt darueber ab. Der Marker aus
    // `executeCardWithChain` reicht hier NICHT: der Kreatur-Effekt laeuft
    // dort mit `resolve: null`, seine eigentliche Arbeit passiert also
    // erst danach, wenn der Marker schon wieder weg ist (Als Befund 5.8.).
    const prevSrc = room.engine._currentEffectSource;
    room.engine._currentEffectSource = {
      cardName: inst.name, owner: pi, cardType: 'CreatureEffect',
    };
    // v347: Karten-Auftritt links — generelle Regel fuer JEDEN aktiven
    // Effekt (siehe engine.announceActiveEffect).
    room.engine.armEffectAnnounce(inst.name, pi, 'board');
    let resolved;
    try {
      resolved = await script.onCreatureEffect(ctx);
      // Karten mit eigener Zielwahl haben den Auftritt schon selbst
      // ausgeloest; alle anderen bekommen ihn hier, nach dem Effekt.
      if (resolved !== false) room.engine.announceActiveEffect();
    } finally {
      room.engine.clearEffectAnnounce();
      room.engine._promptCardStack.pop();
      room.engine._currentEffectSource = prevSrc;
    }

    if (charmedHeroCreature) {
      inst.controller = origController;
      inst.owner = origOwner;
      delete inst.heroOwner;
    } else if (isStolenByPi) {
      delete inst.heroOwner;
    }

    if (resolved !== false) {
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      // Allow the script to opt out of the standard once-per-turn lock
      // by stamping `ctx._skipCreatureEffectHopt = true` during
      // `onCreatureEffect`. Used by Dream Lander Creatures
      // (Wolflesia / Clausss / Vullary) whose "attach a Hero" mode is
      // a separate, independent gate from the post-attach effect —
      // attaching shouldn't burn the once-per-turn slot the bonus
      // mode also wants to use this turn. Ebenso von Karten mit
      // mehreren Nutzungen pro Runde (3-Headed Giant): sie führen
      // ihren Verbrauch selbst und geben die Engine-Sperre erst mit
      // der letzten Nutzung frei.
      //
      // Die Aktivierung HAT stattgefunden — unabhängig davon, ob die
      // Sperre gestempelt wird. Genau diese Unterscheidung braucht die
      // CPU, deshalb steht die Meldung vor dem Stempel.
      room.engine.noteActivationOutcome(hoptKey, true);
      if (!ctx._skipCreatureEffectHopt) {
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
      }
      // Action-cost creatures consume the Action on success. Mirror
      // the doPlaySpell / doActivateAbility bookkeeping: bump the phase
      // counter, push the activating Hero into `heroesActedThisTurn`
      // (so a follow-up Spell/Attack/Creature/Ability play correctly
      // requires an additional-action provider), then advance phase
      // (which the engine will refuse if a second-action grant is alive).
      if (isActionCost && isActionPhase) {
        const acPs = gs.players[pi];
        acPs._actionsPlayedThisPhase = (acPs._actionsPlayedThisPhase || 0) + 1;
        if (acPs._actionsPlayedThisPhase === 2 && (acPs._bonusMainActions || 0) > 0) {
          acPs._bonusMainActions = 0;
        }
        if (creatureEffectIsMainAction) {
          if (!acPs.heroesActedThisTurn) acPs.heroesActedThisTurn = [];
          if (!acPs.heroesActedThisTurn.includes(heroIdx)) acPs.heroesActedThisTurn.push(heroIdx);
        }
        await room.engine.advanceToPhase(pi, 4);
      }
    } else {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      // Gerrymander veto on a "may" confirm consumes the once-per-turn
      // even though `resolved` came back false — the activator did
      // commit, opp's Gerrymander declined for them. Stamp HOPT so
      // the activation can't be retried this turn.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[hoptKey] = gs.turn;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, creature: creatureName });
      } else if (consumedAdditionalCreatureInst) {
        // Standard cancel — refund the additional-action provider
        // consumed upfront. The action-counter increment / heroesActedThisTurn
        // push live in the success branch above, so they don't need rollback.
        room.engine.restoreAdditionalAction(consumedAdditionalCreatureInst);
      }
    }
    await room.engine._flushSurpriseDrawChecks();
    await room.engine._executeDeferredSurprises();
  } catch (err) {
    console.error('[Engine] doActivateCreatureEffect error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

/**
 * Treacherous Crystal — when the active player clicks an opp-side
 * copy of the Crystal in opp's hand, claim temporary control of EVERY
 * Creature on opp's board (regardless of host Hero state — dead,
 * frozen, stunned, bound, missing, etc.) except those carrying
 * `_cardinalImmune` (Cardinal Beasts, Golden Wings wearers, …).
 *
 * Mechanism: per-instance `stolenBy = pi` flip via `actionStealCreature`,
 * which already wires `inst.controller` over to the borrower and queues
 * the auto-revert through `_revertStolenCreatures` at the next turn
 * start. Identical to Deepsea Succubus's temporary steal, just blanket
 * over the whole board.
 *
 * Gates:
 *   • Must be the active player's turn.
 *   • Opp must currently hold ≥1 Treacherous Crystal in hand.
 *   • Big Gwen Guard suppression on opp's side disables the lend.
 *   • At least one already-unstolen opp Creature must exist (otherwise
 *     the click is a no-op).
 */
function doTriggerTreacherousCrystal(room, pi) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;

  const oi = pi === 0 ? 1 : 0;
  const oppPs = gs.players[oi];
  if (!oppPs) return false;
  if (!(oppPs.hand || []).includes('Treacherous Crystal')) return false;

  // BGG suppression aura on opp's side — same gate the engine's
  // `isTreacherousLent` honors.
  const { selfRevealEffectsSuppressed } = require('./cards/effects/_crystals-shared');
  if (selfRevealEffectsSuppressed(room.engine, oi)) return false;

  // Per-side non-damage shield (The Great Wall of Deri etc.) on the
  // crystal-holder's side. Treacherous Crystal's steal is a non-
  // damage effect "chosen by your opponent" (the triggering player),
  // so a Wall on the crystal-holder's side protects every Creature
  // they control — net result: zero steals possible, abort the
  // entire trigger.
  if (typeof room.engine._isSideNondamageShielded === 'function'
      && room.engine._isSideNondamageShielded(oi)) {
    room.engine.log('treacherous_crystal_blocked', {
      player: gs.players[pi]?.username, reason: 'nondamage_shield',
    });
    return false;
  }

  const cardDB = room.engine._getCardDB();
  // Cardinal Beasts are always exempt — by counter (Golden-Wings
  // grants, onPlay-stamped Cardinals) AND by name. The name-based
  // fallback covers puzzle setups: puzzle-placed Cardinals never
  // fire their onPlay, so `_cardinalImmune` is unset, and the
  // counter check alone would let them be stolen.
  const { CARDINAL_NAMES } = require('./cards/effects/_cardinal-shared');
  let stolenCount = 0;
  for (const inst of room.engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== oi) continue;
    if (inst.faceDown) continue;
    if (inst.stolenBy != null) continue;
    if (inst.counters?._cardinalImmune) continue;
    if (CARDINAL_NAMES.includes(inst.name)) continue;
    // Restrict to Creature card type. Equipment / token instances
    // shouldn't be stealable, even if some future card flagged them
    // as supportable.
    const cd = cardDB[inst.name];
    if (!cd || cd.cardType !== 'Creature') continue;
    const ok = room.engine.actionStealCreature(pi, inst, {
      sourceName: 'Treacherous Crystal',
    });
    if (ok) stolenCount++;
  }

  if (stolenCount === 0) return false;

  room.engine.log('treacherous_crystal_trigger', {
    player: gs.players[pi]?.username, stolenCount,
  });
  for (let i = 0; i < 2; i++) sendGameState(room, i);
  sendSpectatorGameState(room);
  return true;
}

async function doActivateFreeAbility(room, pi, { heroIdx, zoneIdx, charmedOwner, borrowedFromOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;
  const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
  const isActionPhase = gs.currentPhase === 3;
  if (!isMainPhase && !isActionPhase) return false;

  // Lizbeth/Smugbeth borrow: the slot lives on opponent's hero but the
  // activation runs on the borrower's side. Validate via the engine
  // helper; reject if no borrower covers this slot.
  let borrowerHeroIdx = null;
  if (borrowedFromOwner != null) {
    if (charmedOwner != null) return false;
    const borrow = room.engine._getAbilityBorrowerForOppSlot(pi, borrowedFromOwner, heroIdx, zoneIdx);
    if (!borrow) return false;
    borrowerHeroIdx = borrow.borrowerHeroIdx;
  }

  const heroOwner = borrowedFromOwner != null
    ? borrowedFromOwner
    : (charmedOwner != null ? charmedOwner : pi);
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" (Spell/Attack/Creature plays from hand)
  // — NOT Ability activations like Alchemy, Adventurousness, etc.
  // Stunned silences the hero outright. Frozen also silences UNLESS
  // the activator has Chilly Dog (Mischief Militia) in play — its
  // aura lifts the Frozen-only silence on own-side Heroes' Abilities.
  if ((hero.statuses?.stunned || hero.statuses?.webbed)) return false;
  if (hero.statuses?.frozen && !room.engine._isChillyDogActiveFor(pi)) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;

  const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
  if (!abilitySlot || abilitySlot.length === 0) return false;
  const abilityName = abilitySlot[0];
  const level = abilitySlot.length;

  const script = loadCardEffect(abilityName);
  if (!script?.freeActivation || !script?.onFreeActivate) return false;
  if (isActionPhase && !script.actionPhaseEligible) return false;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, abilityName, room.engine)) return false;
  // Boris beim Gegner sperrt Steal-/Kontroll-Effekte. Abilities laufen
  // NICHT ueber validateActionPlay — Charme (Lv2 stiehlt eine Handkarte)
  // brauchte den Riegel deshalb eigens (Als Befund 5.8.).
  if (room.engine.isBorisBlocked(script, pi)) return false;

  const hoptKey = `free-ability:${abilityName}:${pi}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
  // Vorbelegung "nicht gefeuert" — der Erfolgspfad setzt um.
  room.engine.noteActivationOutcome(hoptKey, false);

  const inst = room.engine.cardInstances.find(c =>
    c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
  );
  if (!inst) return false;

  if (script.canFreeActivate) {
    const checkCtx = room.engine._createContext(inst, { event: 'canFreeActivateCheck' });
    if (borrowedFromOwner != null) {
      // Borrow check uses borrower-side ctx so per-hero checks (gold,
      // hand cards, etc.) hit the activator instead of the source side.
      checkCtx.cardOwner = pi;
      checkCtx.cardController = pi;
      checkCtx.cardHeroOwner = pi;
      checkCtx.cardHeroIdx = borrowerHeroIdx;
      checkCtx.attachedHero = gs.players[pi]?.heroes?.[borrowerHeroIdx];
    }
    if (!script.canFreeActivate(checkCtx, level)) return false;
  }

  // Reserve the HOPT slot BEFORE any `await`. Without this, the chain
  // window opened by `executeCardWithChain` below yields to the event
  // loop, and a second `activate_free_ability` socket message from the
  // same client (fired while the chain is still resolving a reaction
  // like Cure on top of Alchemy) passes the HOPT check at line 3043
  // and enters a parallel activation. Reserving at entry and rolling
  // back on cancel closes the race.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;
  let hoptReserved = true;
  const releaseHopt = () => {
    if (hoptReserved) { delete gs.hoptUsed[hoptKey]; hoptReserved = false; }
  };
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines that happen during this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  try {
    // v353: `'board'` — eine Ability liegt im Ability-Slot am Brett,
    // beide Seiten sehen den Auftritt.
    room.engine.armEffectAnnounce(abilityName, pi, 'board');   // v349
    const chainResult = await room.engine.executeCardWithChain({
      cardName: abilityName, owner: pi, heroIdx, cardType: 'Ability', goldCost: 0,
      resolve: null, fromBoard: true,
    });

    // Surprise-Fenster auf die AKTIVIERUNG — Zwilling der Stelle in
    // `doPlayAbility`. Auch eine FREIE Aktivierung ist „activating the
    // active effect of an Ability\", sie muss also dasselbe Fenster
    // oeffnen; sonst haette Cybug LADYBUG eine Luecke, durch die jede
    // freie Ability schluepft.
    const abilitySurprise = chainResult.negated
      ? null
      : await room.engine._checkSurpriseOnAbilityActivation(pi, heroIdx, zoneIdx, abilityName);

    if (chainResult.negated || abilitySurprise?.negateEffect) {
      // Gefeuert und gekontert — der Auftritt gehoert trotzdem dazu,
      // sonst sieht der Gegner nie, WAS seine Negation getroffen hat.
      room.engine.announceActiveEffect();
      room.engine.clearEffectAnnounce();
      // Negation keeps HOPT consumed — the ability fired (and was countered).
      hoptReserved = false;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const origController = inst.controller;
    const origOwner = inst.owner;
    const origHeroIdx = inst.heroIdx;
    if (charmedOwner != null) {
      inst.controller = pi;
      inst.owner = pi;
      inst.heroOwner = charmedOwner;
    } else if (borrowedFromOwner != null) {
      // Borrow: temporarily reroute the inst as if attached to the
      // borrower hero on the activator's side. Restored after the
      // free-activate finishes (success OR cancel).
      inst.controller = pi;
      inst.owner = pi;
      inst.heroIdx = borrowerHeroIdx;
      inst.heroOwner = pi;
    }

    gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };
    room.engine._setPendingPlayLog('ability_activated', { player: gs.players[pi].username, card: abilityName, hero: hero.name, level });

    // Live CPU: stream the Ability AND play its activation flash BEFORE
    // its effect resolves (Trade/Leadership were resolving first, then
    // flashing). Humans/PvP/sim are unchanged — maybeFireCpuRevealEarly
    // returns false for them, so the flash + reveal stay deferred to
    // post-resolution (so a cancelled activation isn't shown early).
    const _cpuEarlyAnnounced = room.engine.maybeFireCpuRevealEarly();
    if (_cpuEarlyAnnounced && !script.noDefaultFlash) {
      room.engine._broadcastEvent('ability_activated', { owner: heroOwner, heroIdx, zoneIdx });
    }

    const ctx = room.engine._createContext(inst, {});
    const resolved = await script.onFreeActivate(ctx, level);
    // ── AUFTRITT ERST HIER (12.8., Als Befund an "Trade") ────────────
    // Vorher stand der Auftritt direkt hinter dem Chain-Fenster, also
    // VOR `onFreeActivate` und damit vor jeder Abfrage der Karte. Bei
    // Trade erschien die Karte deshalb, BEVOR der Bestaetigen-Dialog
    // kam — Ablehnen und neu klicken erzeugte beliebig viele Auftritte.
    // Jetzt gilt hier dieselbe Regel wie an allen anderen Wegen: der
    // Auftritt kommt NACH dem Handler und nur, wenn er nicht abgebrochen
    // wurde. Karten mit eigener Zielwahl haben ihn ggf. schon selbst
    // ausgeloest; die Anmeldung ist dann verfallen und das hier ein No-op.
    if (resolved !== false) room.engine.announceActiveEffect();
    room.engine.clearEffectAnnounce();
    await room.engine._flushSurpriseDrawChecks();

    if (charmedOwner != null) {
      inst.controller = origController;
      inst.owner = origOwner;
      delete inst.heroOwner;
    } else if (borrowedFromOwner != null) {
      inst.controller = origController;
      inst.owner = origOwner;
      inst.heroIdx = origHeroIdx;
      delete inst.heroOwner;
    }

    if (resolved !== false) {
      // Reservation becomes the final consumption — nothing to do.
      hoptReserved = false;
      // Gefeuert — auch wenn die Karte den Schlüssel danach wieder
      // freigibt, weil sie mehrere Nutzungen pro Runde hat (Lethes
      // Necromancy, 3×). Die CPU liest das statt die Sperre zu prüfen.
      room.engine.noteActivationOutcome(hoptKey, true);
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      if (!_cpuEarlyAnnounced && !script.noDefaultFlash) {
        room.engine._broadcastEvent('ability_activated', { owner: heroOwner, heroIdx, zoneIdx });
      }
      // Force-end-of-turn rider — Premonition sets this on its
      // onFreeActivate. Same flag the doPlaySpell / doActivateAbility
      // paths consume; same rationale (advance has to happen here,
      // not inside the script, because of the `_spellResolutionDepth`
      // guard on `advanceToPhase`).
      if (gs._spellEndsTurn) {
        delete gs._spellEndsTurn;
        if (!gs.result) {
          const cur = gs.currentPhase;
          if (cur === 2 || cur === 3 || cur === 4) {
            await room.engine.advanceToPhase(pi, 5);
          }
        }
      } else if (isActionPhase) {
        const actingPs = gs.players[pi];
        actingPs._actionsPlayedThisPhase = (actingPs._actionsPlayedThisPhase || 0) + 1;
        if (actingPs._actionsPlayedThisPhase === 2 && (actingPs._bonusMainActions || 0) > 0) {
          actingPs._bonusMainActions = 0;
        }
        await room.engine.advanceToPhase(pi, 4);
      }
    } else {
      // Ability cancelled (user backed out, no legal target, etc.) — roll
      // back the HOPT reservation so the player keeps their once-per-turn.
      // EXCEPTION: if a Gerrymander redirect on a "you may" confirm caused
      // the cancel, the activator did COMMIT to playing the ability — the
      // opp's Gerrymander vetoed it. The once-per-turn slot is consumed.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        hoptReserved = false; // keep HOPT consumed
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, ability: abilityName });
      } else {
        releaseHopt();
      }
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    }
  } catch (err) {
    console.error('[Engine] doActivateFreeAbility error:', err.message);
    // Unexpected error mid-activation — release the reservation so the
    // player isn't silently robbed of their HOPT by a crash.
    releaseHopt();
    room.engine.clearEffectAnnounce();
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlayCreature(room, pi, { cardName, handIndex, heroIdx, zoneSlot, additionalActionProvider, viaDragDrop }) {
  // ── ABLEHNUNGS-TELEMETRIE (30.7.) ──────────────────────────────────
  // Die CPU sah bisher nur `false` und konnte "server-nein" nicht weiter
  // aufschlüsseln. Genau daran hing die Diagnose der ungeklärten Karten
  // (Werewolf 416, Pirate 272, Mummy 211, Primordium 161 Fehlschläge im
  // v107-Lauf). Statt die Ablehnungsgründe CPU-seitig NACHZUBAUEN — exakt
  // der Fehler, der zu den v103- und v108-Asymmetrien geführt hat —
  // meldet der Server ihn jetzt selbst. Reiner Schreibzugriff auf ein
  // Diagnosefeld, kein Verhaltenseinfluss, Rückgabewert unverändert
  // `false`. In MCTS-Rollouts stumm.
  const _no = (label, detail) => {
    try {
      if (room?.engine && !room.engine._inMctsSim) {
        room.engine._playRefusal = { label, detail: detail || null, cardName };
      }
    } catch { /* Telemetrie darf nie stören */ }
    return false;
  };
  if (!room?.engine || !room.gameState) return _no('kein-raum');
  const gs = room.gameState;
  try { room.engine._playRefusal = null; } catch { }

  const v = room.engine.validateActionPlay(pi, cardName, handIndex, heroIdx, ['Creature'], { zoneSlot });
  if (!v) return _no('validate-nein');
  const { ps, cardData, hero, script, isActionPhase, isMainPhase, isInherentAction } = v;

  if (ps.summonLocked) return _no('summon-locked');
  const freshBlocked = room.engine.getSummonBlocked(pi);
  if (freshBlocked.includes(cardName)) return _no('summon-blocked');
  // Per-Hero `canSummon` gate. `getSummonBlocked` only refuses when
  // NO capable Hero accepts the card (card-wide check, cardHeroIdx
  // = -1) — that lets archetype rules like Gigantisaurs slip through
  // when ONE Hero is occupied but another is free. Re-run the per-
  // Hero check against the specific destination so e.g. Chimera /
  // Pteranos / Spinor refuse a Hero that already hosts a Gigantisaur.
  if (!room.engine.isCreatureSummonable(cardName, pi, heroIdx)) return _no('cansummon-nein');
  const creatureHero = ps.heroes?.[heroIdx];
  if (creatureHero?.statuses?.charmed) return _no('held-charmed');

  // Reaction-subtype Creatures are exempt from the action-economy
  // machinery — see the Spell/Attack path for the rationale.
  const isReactionSubtype = (cardData.subtype || '').toLowerCase() === 'reaction';
  const additionalTypeId = (!isInherentAction && !isReactionSubtype)
    ? room.engine.findAdditionalActionForCard(pi, cardName, heroIdx)
    : null;
  const usingAdditional = !!additionalTypeId;
  const actionsPlayedThisPhase = ps._actionsPlayedThisPhase || 0;
  const hasBonusAction = isActionPhase && (
    (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1)
  );
  const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length > 0) && !hasBonusAction;
  if ((isMainPhase || actionAlreadyUsed) && !usingAdditional && !isInherentAction && !isReactionSubtype) {
    // Feinaufschlüsselung: WARUM stand keine Aktion zur Verfügung?
    // Trennt "Main Phase ohne Grant" von "Aktion schon verbraucht"
    // und hält fest, ob überhaupt ein Grant existierte.
    return _no('keine-aktion', (isMainPhase ? 'mainphase' : 'aktion-verbraucht')
      + (additionalTypeId ? '+grant-da' : '+kein-grant'));
  }

  if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
  const totalZones = ps.supportZones[heroIdx].length;
  if (zoneSlot < 0 || zoneSlot >= totalZones) return _no('slot-ungueltig');
  // Intent flags are PER-PLAY: whichever branch below sets its flag also
  // clears the sibling. Without this, a stale flag from an earlier play
  // (Deepsea Castle / DDG have no tryBouncePlace consumer; the negated /
  // fizzle / cancel exits below never cleaned up either) survived into
  // the next play — and a stale `_requestedNormalSummonSlot` made
  // tryBouncePlace skip an EXPLICIT occupied-slot swap request, so the
  // creature got relocated by summonCreature into a free zone instead
  // (Als Bugreport: swap targeting an occupied slot summoned into a
  // free Support Zone whenever a Primordium grant round had extra
  // plays in flight).
  if ((ps.supportZones[heroIdx][zoneSlot] || []).length > 0) {
    const occCardScript = loadCardEffect(cardName);
    let allowOccupied = false;
    if (typeof occCardScript?.canPlaceOnOccupiedSlot === 'function') {
      try {
        allowOccupied = !!occCardScript.canPlaceOnOccupiedSlot(gs, pi, heroIdx, zoneSlot, room.engine);
      } catch (err) {
        console.error('[canPlaceOnOccupiedSlot]', cardName, err.message);
      }
    }
    // ── Geteilte Zone (Alice, the Transfer Student) ─────────────────
    // ★ 18.8., Als Testbefund: eine normal beschworene Kreatur durfte
    // nicht auf einen Platz, der bereits eine Namensgleiche traegt —
    // der Server lehnte mit „slot-besetzt" ab, noch bevor die Engine
    // ueberhaupt gefragt wurde.
    // Reihenfolge mit Bedacht: `canPlaceOnOccupiedSlot` wird ZUERST
    // gefragt, damit jede bestehende Karte (Deepsea-Tausch) sich
    // exakt wie bisher verhaelt. Alices Teilen ist der Rueckfall.
    let shareOccupied = false;
    if (!allowOccupied) {
      try {
        const { canShareInto } = require('./cards/effects/_alice-shared');
        shareOccupied = canShareInto(room.engine, pi, heroIdx, zoneSlot, cardName);
      } catch (err) {
        console.error('[canShareInto]', cardName, err.message);
      }
    }
    if (!allowOccupied && !shareOccupied) return _no('slot-besetzt');
    if (shareOccupied) {
      // Das ist eine NORMALE Beschwoerung, die sich einen Platz teilt —
      // kein Tausch. Deshalb dasselbe Absichts-Flag wie beim leeren
      // Platz setzen, sonst kaeme `tryBouncePlace` dazwischen.
      delete ps._requestedBouncePlaceSlot;
      ps._requestedNormalSummonSlot = { heroIdx, slotIdx: zoneSlot };
    } else {
      delete ps._requestedNormalSummonSlot;
      ps._requestedBouncePlaceSlot = { heroIdx, slotIdx: zoneSlot };
    }
  } else {
    // Player picked an EMPTY slot — they want a regular summon into this
    // zone, not a bounce-place swap. Set an intent flag so beforeSummon
    // hooks (tryBouncePlace for Deepsea) can short-circuit and let the
    // normal placeCreature path run instead of prompting to bounce an
    // on-board Deepsea. Flag is cleared either by the hook that reads it
    // or, as a safety net, at turn start. The sibling bounce-place flag
    // is cleared here so a stale one from an earlier play can't leak
    // into this fresh empty-slot intent (mirror of the occupied branch
    // above).
    delete ps._requestedBouncePlaceSlot;
    ps._requestedNormalSummonSlot = { heroIdx, slotIdx: zoneSlot };
  }

  let additionalConsumed = false;
  let consumedInst = null;
  if (usingAdditional) {
    consumedInst = room.engine.consumeAdditionalAction(pi, additionalTypeId, additionalActionProvider || null);
    if (!consumedInst) return _no('grant-weg');
    additionalConsumed = true;
    // ── KREDIT-WEITERGABE (31.7.) ─────────────────────────────────────
    // Der Nutzen eines Enablers erscheint in den Daten NIE als sein
    // eigener Play, sondern als der Play der Karte, die er finanziert
    // hat. Die Regression schreibt den Ertrag dem Nutznießer gut — und
    // kann dem Enabler zum Ausgleich sogar ein negatives Gewicht geben.
    // Genau diese Signatur zeigt das Deepsea-Profil: Werewolf 95.5,
    // Deepsea Primordium 8 (Boden), obwohl Primordium die Werewolf-Plays
    // überhaupt erst bezahlt.
    // Hier wird der GEBER festgehalten, damit der Recorder ihn an das
    // Trigger-Ereignis hängen und der Trainer den Ertrag anteilig
    // zurückschreiben kann. Reine Telemetrie.
    try {
      room.engine._grantProvider = {
        name: consumedInst.name || null,
        forCard: cardName,
        turn: room.gameState?.turn || 0,
        owner: pi,
      };
    } catch { /* nie stören */ }
  }

  const nthCreature = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth: nthCreature };

  // Track whether THIS play's increment crossed into action-2 and
  // consumed _bonusMainActions, so a cancellation can roll back both
  // the counter and the bonus-action slot.
  let actionCounterIncrementedHere = false;
  let bonusMainActionsConsumedHere = false;
  if (isActionPhase && !isReactionSubtype) {
    ps._actionsPlayedThisPhase = (ps._actionsPlayedThisPhase || 0) + 1;
    actionCounterIncrementedHere = true;
    if (ps._actionsPlayedThisPhase === 2 && (ps._bonusMainActions || 0) > 0) {
      ps._bonusMainActions = 0;
      bonusMainActionsConsumedHere = true;
    }
  }

  room.engine._trackTerrorResolvedEffect(pi, cardName);

  const commitHandRemoval = () => {
    const idx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (idx >= 0) {
      ps.hand.splice(idx, 1);
      room.engine.notePlayedFromHand(pi);
    }
    return idx;
  };

  // Hero-script pre-action cost (Saint Nicolas Potion pick + mark).
  // Same pattern as doPlaySpell — see that path for the full rationale.
  // If the player cancels the prompt, refund every action-economy
  // mutation we performed above and bail without ever resolving.
  const paidHeroCost = await room.engine.payHeroActionCost(pi, heroIdx);
  if (!paidHeroCost) {
    ps._resolvingCard = null;
    if (additionalConsumed && consumedInst) {
      room.engine.restoreAdditionalAction(consumedInst);
    }
    if (actionCounterIncrementedHere) {
      ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
    }
    if (bonusMainActionsConsumedHere) {
      ps._bonusMainActions = 1;
    }
    delete ps._requestedBouncePlaceSlot;
    delete ps._requestedNormalSummonSlot;
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return _no('summon-fehlgeschlagen');
  }
  let _heroCostFinalized = false;

  try {
    const chainResult = await room.engine.executeCardWithChain({
      cardName, owner: pi, heroIdx, cardType: 'Creature', goldCost: 0,
    });

    if (chainResult.negated) {
      // Negated by a Reaction — the creature never actually summoned,
      // refund the Hero pre-action cost (Saint Nicolas keeps the
      // marked Potion in hand).
      await room.engine.refundHeroActionCost(pi, heroIdx);
      _heroCostFinalized = true;
      // `commitHandRemoval()` returns the pre-splice hand slot; the
      // client hasn't synced the splice yet, so that slot still
      // renders → the delete flight starts from the card's real spot.
      const _negHi = commitHandRemoval();
      // Foreign-origin Creatures (Magic Lamp gifts etc.) discard to
      // the ORIGINAL owner's pile when negated before placement.
      // Once the Creature is on the board, the death path already
      // routes via `inst.originalOwner` (see processCreatureDamageBatch),
      // so we only need the override here on the negate-from-hand path.
      const negatedDiscardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      await room.engine.routeNegatedInitialCard(negatedDiscardOwner, cardName, chainResult, _negHi);
      room.engine.log('creature_negated', { card: cardName, player: ps.username });
      // Mark the casting Hero as having spent their Action — same gate
      // as the spell/attack path. A negated Creature still consumes the
      // Action resource (the spell-school requirement, action-economy,
      // and chain-reaction window all already fired).
      if (!isInherentAction && !additionalConsumed && !isReactionSubtype) {
        if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
        if (!ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
      }
      if (isActionPhase && !usingAdditional) {
        await room.engine.advanceToPhase(pi, 4);
      }
      if (isActionPhase && usingAdditional) {
        // Only `isSecondActionGrant` providers gate the post-action-2
        // advance — see the doPlaySpell counterpart for rationale.
        const hasMoreSecondAction = room.engine.cardInstances.some(c => {
          if (c.owner !== pi || !c.counters?.additionalActionAvail) return false;
          const config = room.engine._additionalActionTypes?.[c.counters.additionalActionType];
          return !!config?.isSecondActionGrant;
        });
        if (!hasMoreSecondAction) await room.engine.advanceToPhase(pi, 4);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    // `zoneSlot` mitgeben: waehrend der Kostenzahlung ist dieser Platz
    // reserviert, damit ein Todes-Trigger (Green Dragoneer) sich nicht in
    // die gerade freigeopferte Zone setzt (Als Ruling 8.8.).
    const beforeSummonOk = await room.engine._runBeforeSummon(cardName, pi, heroIdx, { isInherentAction, viaDragDrop: !!viaDragDrop }, zoneSlot);
    const placementConsumed = ps._placementConsumedByCard === cardName;
    if (placementConsumed) delete ps._placementConsumedByCard;
    if (!beforeSummonOk && !placementConsumed) {
      // beforeSummon refused (tribute cancelled etc.) — refund Hero
      // pre-action cost.
      await room.engine.refundHeroActionCost(pi, heroIdx);
      _heroCostFinalized = true;
      ps._resolvingCard = null;
      // Roll back ALL action-economy bookkeeping — the Creature never
      // resolved (beforeSummon cancelled the play), so the Action
      // resource wasn't actually spent.
      if (additionalConsumed && consumedInst) {
        room.engine.restoreAdditionalAction(consumedInst);
      }
      if (actionCounterIncrementedHere) {
        ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
      }
      if (bonusMainActionsConsumedHere) {
        ps._bonusMainActions = 1;
      }
      room.engine.log('creature_fizzle', { card: cardName, reason: 'beforeSummon_cancelled' });
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }
    // `beforeSummon` may upgrade an engine-decided NORMAL summon into
    // an inherent (additional-Action) summon — used by Big Gwen Guard
    // when the player picks the "Special" branch of its summon-mode
    // prompt. The script stamps `gs._summonModeUpgradedToInherent`
    // with its `cardOwner`; we refund the Action slot the engine
    // consumed upfront and flip the local `effectiveIsInherent`
    // so the downstream gates (heroesActedThisTurn push, phase
    // advance) match the upgraded mode.
    let effectiveIsInherent = isInherentAction;
    if (gs._summonModeUpgradedToInherent === pi) {
      delete gs._summonModeUpgradedToInherent;
      if (!isInherentAction) {
        if (additionalConsumed && consumedInst) {
          room.engine.restoreAdditionalAction(consumedInst);
          additionalConsumed = false;
        }
        if (actionCounterIncrementedHere) {
          ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
          actionCounterIncrementedHere = false;
        }
        if (bonusMainActionsConsumedHere) {
          ps._bonusMainActions = 1;
          bonusMainActionsConsumedHere = false;
        }
        effectiveIsInherent = true;
      }
    }

    let actualZoneSlot = zoneSlot;
    let inst = null;
    if (placementConsumed) {
      commitHandRemoval();
    } else {
      commitHandRemoval();
      const placeResult = room.engine.summonCreature(cardName, pi, heroIdx, zoneSlot);
      if (!placeResult) {
        // Place fizzled (full zone, etc.) — refund Hero pre-action cost.
        await room.engine.refundHeroActionCost(pi, heroIdx);
        _heroCostFinalized = true;
        const fizzleDiscardOwner = room.engine._consumeHandCardOrigin(pi, cardName);
        if (fizzleDiscardOwner === pi) {
          // OWN card that couldn't be placed — return it to HAND, not the
          // discard pile. The board UI only ever offers a full-zoned Hero
          // as a drop/click target through the bounce-place / sacrifice-
          // summon path (Deepsea swap, Suspicious Monster); if that path
          // didn't consume the placement (occupant no longer bounceable,
          // a reaction filled the slot, etc.), summonCreature relocates
          // and — with no free base zone — fizzles here. Discarding silently
          // LOST the player's card (reported: clicking a bounce/sacrifice
          // target sent the creature straight to the discard pile). A no-op
          // refund is the correct outcome; the action-economy rollback
          // below already un-spends the Action.
          ps.hand.push(cardName);
          room.engine.notePlayedFromHand(pi, -1);
        } else {
          // Foreign-origin Creatures (Magic Lamp gifts etc.) still route
          // their fizzle discard back to the original owner's pile.
          gs.players[fizzleDiscardOwner].discardPile.push(cardName);
        }
        // Roll back action-economy bookkeeping — the Creature couldn't
        // be placed, so the Action resource wasn't actually spent.
        if (additionalConsumed && consumedInst) {
          room.engine.restoreAdditionalAction(consumedInst);
        }
        if (actionCounterIncrementedHere) {
          ps._actionsPlayedThisPhase = Math.max(0, (ps._actionsPlayedThisPhase || 0) - 1);
        }
        if (bonusMainActionsConsumedHere) {
          ps._bonusMainActions = 1;
        }
        room.engine.log('creature_fizzle', { card: cardName, reason: 'zone_occupied' });
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        return true;
      }
      actualZoneSlot = placeResult.actualSlot;
      inst = placeResult.inst;
      // Propagate foreign-origin tag from the hand-tracked instance
      // onto the placed-on-board instance, so when the Creature dies
      // the engine's death-path (which already routes via
      // `inst.originalOwner`) returns the card to its true owner.
      const placedOriginOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      if (placedOriginOwner !== pi) {
        inst.originalOwner = placedOriginOwner;
      }

      broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: actualZoneSlot });
      for (let i = 0; i < 2; i++) {
        const sid = gs.players[i]?.socketId;
        if (sid) io.to(sid).emit('summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });
      }
      sendToSpectators(room, 'summon_effect', { owner: pi, heroIdx, zoneSlot: actualZoneSlot, cardName });
    }

    // Creature is on the board — commit the Hero pre-action cost.
    // Saint Nicolas transfers the marked Potion to opp's hand here so
    // the visual flight runs alongside the summon animation.
    await room.engine.commitHeroActionCost(pi, heroIdx);
    _heroCostFinalized = true;

    if (hero._maxActionsPerTurn) hero._actionsThisTurn = (hero._actionsThisTurn || 0) + 1;

    // Mark the summoning Hero as having spent their Action — mirrors
    // the doPlaySpell convention. Skipped for additional-action plays
    // (Friendship-style "extra beyond the normal"), inherent plays,
    // and Reaction-subtype Creatures (action-economy exempt). Without
    // this, summoning a Creature as action 1 leaves
    // `heroesActedThisTurn` empty, so the engine's action-already-used
    // gate would let any other Hero perform action 2 unrestricted —
    // bypassing the heroRestricted gate on Soul Shard Ba's grant etc.
    if (!effectiveIsInherent && !additionalConsumed && !isReactionSubtype) {
      if (!ps.heroesActedThisTurn) ps.heroesActedThisTurn = [];
      if (!ps.heroesActedThisTurn.includes(heroIdx)) ps.heroesActedThisTurn.push(heroIdx);
    }

    if (!placementConsumed) {
      // `_isNormalSummon: true` flags this as a player-driven summon
      // gated against THIS hero's spell-school + level requirements.
      // Distinguishes from card-effect placements (Loyal Rottweiler,
      // Loyal Shepherd's revive, Monster in a Bottle, bounce-place,
      // …) where no hero-level gating happens. Listeners like
      // Orthos's "if THIS Hero summons a Loyal" use the flag to
      // skip non-summon placements.
      // `_tributePaid`: wurde diese Beschwoerung mit einem Opfer bezahlt?
      // Dieser Pfad feuert die beiden Hooks SELBST (statt ueber
      // summonCreatureWithHooks), muss den Stempel aus `_runBeforeSummon`
      // also selbst einloesen — sonst bliebe der Vertrag auf dem
      // Hauptweg des Spiels stumm.
      const _tribExtra = room.engine.takeTributeSummonExtras(cardName, pi);
      await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualZoneSlot, _isNormalSummon: true, ..._tribExtra });
      await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _isNormalSummon: true, ..._tribExtra });
    }
    if (!isReactionSubtype) {
      await room.engine.runHooks('onActionUsed', {
        actionType: 'creature', playerIdx: pi, cardName, heroIdx,
        isAdditional: usingAdditional, _skipReactionCheck: true,
      });
      if (usingAdditional) {
        await room.engine.runHooks('onAdditionalActionUsed', {
          actionType: 'creature', playerIdx: pi, cardName, heroIdx,
          _skipReactionCheck: true,
        });
      }
    }
    // Universal action-resolved hook (see doPlaySpell for rationale).
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: 'creature', playerIdx: pi, cardName, heroIdx,
      isAdditional: !!usingAdditional,
      isInherent: !!effectiveIsInherent,
      isFree: false,
      _skipReactionCheck: true,
    });
    if (isActionPhase && !usingAdditional && !effectiveIsInherent) {
      await room.engine.advanceToPhase(pi, 4);
    }
    if (isActionPhase && usingAdditional) {
      // Only `isSecondActionGrant` providers gate the post-action-2
      // advance — see the doPlaySpell counterpart for rationale.
      const hasMoreSecondAction = room.engine.cardInstances.some(c => {
        if (c.owner !== pi || !c.counters?.additionalActionAvail) return false;
        const config = room.engine._additionalActionTypes?.[c.counters.additionalActionType];
        return !!config?.isSecondActionGrant;
      });
      if (!hasMoreSecondAction) {
        await room.engine.advanceToPhase(pi, 4);
      }
    }
  } catch (err) {
    console.error('[Engine] doPlayCreature error:', err.message);
  } finally {
    // Safety net: if neither commit nor refund ran (unexpected exit),
    // refund so a marked Potion isn't stranded with stale escrow.
    if (!_heroCostFinalized) {
      try { await room.engine.refundHeroActionCost(pi, heroIdx); } catch {}
    }
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateAbility(room, pi, { heroIdx, zoneIdx, charmedOwner, borrowedFromOwner }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;

  // Borrowed activation (Lizbeth / Smugbeth): the slot is on opponent's
  // hero but the activation runs on the borrower's side. Validate via
  // the engine's borrow check; reject if no borrower covers this slot.
  // The borrower's heroIdx is what becomes the activation context.
  let borrowerHeroIdx = null;
  if (borrowedFromOwner != null) {
    if (charmedOwner != null) return false; // charm + borrow combo not supported
    const borrow = room.engine._getAbilityBorrowerForOppSlot(pi, borrowedFromOwner, heroIdx, zoneIdx);
    if (!borrow) return false;
    borrowerHeroIdx = borrow.borrowerHeroIdx;
  }

  const heroOwner = borrowedFromOwner != null
    ? borrowedFromOwner
    : (charmedOwner != null ? charmedOwner : pi);
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;
  if (charmedOwner == null && borrowedFromOwner == null && gs.players[pi].comboLockHeroIdx != null && gs.players[pi].comboLockHeroIdx !== heroIdx) return false;
  // One-turn action lock (Treasure Hunter's Backpack, etc.)
  if (hero._actionLockedTurn === gs.turn) return false;
  // Spielerweite Aktionssperre (Kent bei negativem Gold) — gleicher
  // Geltungsbereich wie der Rundenstempel darueber.
  if (room.engine.areActionsBlocked(pi)) return false;
  // Divine Gift of Skill lock — chosen hero can't act unless they have
  // Magic Arts >= 1. Action-cost ability activations are Actions.
  if (room.engine.isHeroSkillLocked(heroOwner, heroIdx)) return false;
  // Hero-script Action gate (Saint Nicolas no-Potion lock). The
  // engine helper short-circuits to `true` for Heroes without the
  // hook so this is a no-op for everyone else.
  if (!room.engine.canHeroPerformAction(heroOwner, heroIdx)) return false;

  const abilitySlot = ps.abilityZones?.[heroIdx]?.[zoneIdx];
  if (!abilitySlot || abilitySlot.length === 0) return false;
  const abilityName = abilitySlot[0];
  const level = abilitySlot.length;

  const script = loadCardEffect(abilityName);
  if (!script?.actionCost || !script?.onActivate) return false;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, abilityName, room.engine)) return false;
  // Boris beim Gegner sperrt Steal-/Kontroll-Effekte. Abilities laufen
  // NICHT ueber validateActionPlay — Charme (Lv2 stiehlt eine Handkarte)
  // brauchte den Riegel deshalb eigens (Als Befund 5.8.).
  if (room.engine.isBorisBlocked(script, pi)) return false;

  const hoptKey = `ability-action:${abilityName}:${pi}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
  if (script.canActivateAction && !script.canActivateAction(gs, pi, heroIdx, level, room.engine)) return false;

  const isActionPhase = gs.currentPhase === 3;
  const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
  if (!isActionPhase && !isMainPhase) return false;

  // Action-resource gate. Action-cost abilities are an "Action" — same
  // resource as Spells / Attacks / Creatures. By default the player
  // gets one Action per Action Phase; spending it auto-advances them
  // to Main Phase 2 (unless a second-action grant is alive). For ANY
  // action 2+ — main slot already used, or playing in Main Phase — we
  // need a matching additional-action provider. heroRestricted +
  // isSecondActionGrant are honoured by `findAdditionalActionForCategory`,
  // so an unmatched Hero can't sneak past a Soul Shard Ba style grant.
  const actingPs = gs.players[pi];
  const actionsPlayedThisPhase = actingPs._actionsPlayedThisPhase || 0;
  const hasBonusActionAlready = isActionPhase && (
    (actingPs.bonusActions?.heroIdx === heroIdx && actingPs.bonusActions.remaining > 0)
    || ((actingPs._bonusMainActions || 0) > 0 && actionsPlayedThisPhase === 1)
  );
  const actionAlreadyUsed = isActionPhase
    && (actingPs.heroesActedThisTurn?.length > 0)
    && !hasBonusActionAlready;
  const needsAdditional = isMainPhase || actionAlreadyUsed;
  let consumedAdditionalInst = null;
  if (needsAdditional) {
    const typeId = room.engine.findAdditionalActionForCategory(pi, 'ability_activation', heroIdx);
    if (!typeId) return false;
    consumedAdditionalInst = room.engine.consumeAdditionalAction(pi, typeId);
    if (!consumedAdditionalInst) return false;
  }

  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;

  // Track whether THIS activation's bookkeeping needs to be rolled
  // back if the user cancels mid-resolution (no target chosen, etc.).
  let actionCounterIncrementedHere = false;
  let bonusMainActionsConsumedHere = false;
  let heroesActedPushedHere = false;
  if (isActionPhase) {
    actingPs._actionsPlayedThisPhase = (actingPs._actionsPlayedThisPhase || 0) + 1;
    actionCounterIncrementedHere = true;
    if (actingPs._actionsPlayedThisPhase === 2 && (actingPs._bonusMainActions || 0) > 0) {
      actingPs._bonusMainActions = 0;
      bonusMainActionsConsumedHere = true;
    }
    // Mark the activating Hero as having used the Action resource —
    // mirrors the doPlaySpell / doPlayCreature convention. Skip when a
    // matching additional-action provider was consumed (the slot was
    // a bonus, not the hero's main action), and when this play is via
    // _bonusMainActions (also a bonus slot).
    if (!consumedAdditionalInst && !hasBonusActionAlready) {
      if (!actingPs.heroesActedThisTurn) actingPs.heroesActedThisTurn = [];
      if (!actingPs.heroesActedThisTurn.includes(heroIdx)) {
        actingPs.heroesActedThisTurn.push(heroIdx);
        heroesActedPushedHere = true;
      }
    }
  }

  // `doPlayAbility` is the action-cost ability path (Adventurousness,
  // Alchemy with full gold cost, etc.) — always tag with actionCost:
  // true so log scanners can distinguish from the FREE-ability path
  // (`doActivateFreeAbility`) which logs the same `ability_activated`
  // type. Tengu Windstorm's "first Action this turn" check filters
  // on this discriminator; free abilities don't count as Actions.
  room.engine._setPendingPlayLog('ability_activated', {
    player: gs.players[pi].username, card: abilityName, hero: hero.name, level,
    actionCost: true,
  });
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts (see HOPT-keep logic below).
  room.engine._lastPromptGerryDeclined = false;

  // Hero-script pre-action cost (Saint Nicolas Potion pick + mark) —
  // mirrors doPlaySpell / doPlayCreature. If the player cancels the
  // pick, refund every action-economy mutation performed above and
  // bail before the ability actually fires.
  const paidHeroCost = await room.engine.payHeroActionCost(heroOwner, heroIdx);
  if (!paidHeroCost) {
    if (consumedAdditionalInst) {
      room.engine.restoreAdditionalAction(consumedAdditionalInst);
    }
    if (actionCounterIncrementedHere) {
      actingPs._actionsPlayedThisPhase = Math.max(0, (actingPs._actionsPlayedThisPhase || 0) - 1);
    }
    if (bonusMainActionsConsumedHere) {
      actingPs._bonusMainActions = 1;
    }
    if (heroesActedPushedHere && actingPs.heroesActedThisTurn) {
      const idx = actingPs.heroesActedThisTurn.indexOf(heroIdx);
      if (idx >= 0) actingPs.heroesActedThisTurn.splice(idx, 1);
    }
    if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
    delete gs._pendingPlayLog;
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return false;
  }
  let _heroCostFinalized = false;

  try {
    const inst = room.engine.cardInstances.find(c =>
      c.owner === heroOwner && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
    );
    if (!inst) return false;

    // v353: Auftritt auch fuer Abilities MIT Aktionskosten. Bisher hatte
    // nur `doActivateFreeAbility` einen — dass eine Trade-Aktivierung die
    // Karte zeigt und eine Leadership-Aktivierung nicht, war eine
    // Luecke, keine Absicht. `'board'`: beide Seiten sehen sie.
    room.engine.armEffectAnnounce(abilityName, pi, 'board');
    const chainResult = await room.engine.executeCardWithChain({
      cardName: abilityName, owner: pi, heroIdx, cardType: 'Ability', goldCost: 0, resolve: null,
      fromBoard: true,
    });

    // Surprise-Fenster auf die AKTIVIERUNG (Cybug LADYBUG). Reihenfolge
    // wie beim Helden-Effekt: erst die Kette, dann die Surprises — und
    // nur, wenn die Kette die Aktivierung nicht ohnehin schon
    // abgeraeumt hat. Eine Negation von hier laeuft durch denselben
    // Ausgang wie eine Negation aus der Kette.
    const abilitySurprise = chainResult.negated
      ? null
      : await room.engine._checkSurpriseOnAbilityActivation(pi, heroIdx, zoneIdx, abilityName);

    if (chainResult.negated || abilitySurprise?.negateEffect) {
      room.engine.announceActiveEffect();   // gefeuert und gekontert
      room.engine.clearEffectAnnounce();
      // Negated — refund the Hero pre-action cost (Saint Nicolas
      // keeps the marked Potion).
      await room.engine.refundHeroActionCost(heroOwner, heroIdx);
      _heroCostFinalized = true;
      if (isActionPhase) await room.engine.advanceToPhase(pi, 4);
      // (additional-action providers were already consumed upfront before
      // activation, so no manual consume is needed here on negation.)
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const origController = inst.controller;
    const origOwner = inst.owner;
    const origHeroIdx = inst.heroIdx;
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });
    }
    sendToSpectators(room, 'ability_activated', { owner: heroOwner, heroIdx, zoneIdx, abilityName });

    gs._pendingCardReveal = { cardName: abilityName, ownerIdx: pi };
    if (charmedOwner != null) {
      inst.controller = pi; inst.owner = pi; inst.heroOwner = charmedOwner;
    } else if (borrowedFromOwner != null) {
      // Borrowed activation: temporarily pretend the ability instance is
      // attached to the borrower's hero on the activator's side. The
      // script's `ctx.cardOwner / cardHeroIdx / attachedHero` then route
      // benefits to the activator. Restored after onActivate returns.
      inst.controller = pi; inst.owner = pi;
      inst.heroIdx = borrowerHeroIdx;
      inst.heroOwner = pi;
    }

    // Live CPU: announce the ability before its effect resolves
    // (no-op for humans / PvP / MCTS sim; idempotent below).
    room.engine.maybeFireCpuRevealEarly();
    const ctx = room.engine._createContext(inst, {});
    const result = await script.onActivate(ctx, level);
    // Auftritt NACH dem Handler (siehe doActivateFreeAbility) — eine
    // abgebrochene Aktivierung darf keine Karte einblenden.
    if (result !== false) room.engine.announceActiveEffect();
    room.engine.clearEffectAnnounce();

    if (result === false) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    } else if (gs._pendingCardReveal) {
      room.engine._firePendingCardReveal();
    } else {
      room.engine._firePendingPlayLog();
    }

    if (charmedOwner != null) {
      inst.controller = origController; inst.owner = origOwner; delete inst.heroOwner;
    } else if (borrowedFromOwner != null) {
      inst.controller = origController; inst.owner = origOwner;
      inst.heroIdx = origHeroIdx; delete inst.heroOwner;
    }
    if (result === false) {
      // Standard cancel rolls HOPT back. Gerrymander-vetoed "may"
      // confirms keep HOPT consumed — the activator committed; opp's
      // Gerrymander declined for them, the slot is spent.
      if (room.engine._lastPromptGerryDeclined) {
        // Gerrymander veto — Saint Nicolas Potion still goes (the
        // activator committed). Commit the cost.
        await room.engine.commitHeroActionCost(heroOwner, heroIdx);
        _heroCostFinalized = true;
        room.engine._lastPromptGerryDeclined = false;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, ability: abilityName });
      } else {
        // Player cancelled — refund Hero pre-action cost.
        await room.engine.refundHeroActionCost(heroOwner, heroIdx);
        _heroCostFinalized = true;
        delete gs.hoptUsed[hoptKey];
        // Standard cancel ALSO rolls back the action-economy
        // bookkeeping — the ability never resolved, so the Action
        // resource wasn't actually spent. Without this rollback, a
        // cancelled action-2 attempt leaves _actionsPlayedThisPhase
        // stuck at 2 (which makes the engine hide isSecondActionGrant
        // providers) and the consumed additional-action provider lost.
        if (consumedAdditionalInst) {
          room.engine.restoreAdditionalAction(consumedAdditionalInst);
        }
        if (actionCounterIncrementedHere) {
          actingPs._actionsPlayedThisPhase = Math.max(0, (actingPs._actionsPlayedThisPhase || 0) - 1);
        }
        if (bonusMainActionsConsumedHere) {
          actingPs._bonusMainActions = 1;
        }
        if (heroesActedPushedHere && actingPs.heroesActedThisTurn) {
          const idx = actingPs.heroesActedThisTurn.indexOf(heroIdx);
          if (idx >= 0) actingPs.heroesActedThisTurn.splice(idx, 1);
        }
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    // Ability resolved cleanly — commit the Hero pre-action cost so
    // the Potion flight runs alongside the ability's own animations.
    await room.engine.commitHeroActionCost(heroOwner, heroIdx);
    _heroCostFinalized = true;

    // `usingAdditional` reflects whether this activation consumed an
    // additional-action provider (Main-Phase activation, or Action-Phase
    // action-2 via a second-action grant). Hook flag mirrors the
    // doPlaySpell convention.
    const usingAdditional = !!consumedAdditionalInst;
    await room.engine.runHooks('onActionUsed', {
      actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
      isAdditional: usingAdditional, _skipReactionCheck: true,
    });
    if (usingAdditional) {
      await room.engine.runHooks('onAdditionalActionUsed', {
        actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx, _skipReactionCheck: true,
      });
    }
    // Universal action-resolved hook (see doPlaySpell for rationale).
    await room.engine.runHooks('onAnyActionResolved', {
      actionType: 'ability_activation', playerIdx: pi, abilityName, heroIdx,
      isAdditional: !!usingAdditional, isInherent: false, isFree: false,
      _skipReactionCheck: true,
    });

    // Force-end-of-turn rider — same flag the doPlaySpell path consumes
    // (see the comment block there for why the advance has to happen
    // here, after onActivate's depth release, instead of inside the
    // ability script). Premonition's "Immediately end your turn
    // afterwards" clause is the first ability to use this; the flag
    // name is shared because the semantics are identical.
    if (gs._spellEndsTurn) {
      delete gs._spellEndsTurn;
      if (!gs.result) {
        const cur = gs.currentPhase;
        if (cur === 2 || cur === 3 || cur === 4) {
          await room.engine.advanceToPhase(pi, 5);
        }
      }
    } else if (isActionPhase) {
      await room.engine.advanceToPhase(pi, 4);
    }
    // (additional-action providers were already consumed upfront before
    // activation, so no manual consume is needed here on success.)
  } catch (err) {
    console.error('[doActivateAbility]', err.message);
  } finally {
    room.engine.clearEffectAnnounce();
    // Safety net for the Hero pre-action cost — see doPlaySpell.
    if (!_heroCostFinalized) {
      try { await room.engine.refundHeroActionCost(heroOwner, heroIdx); } catch {}
    }
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateHeroEffect(room, pi, { heroIdx, charmedOwner, chosenEffectName }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  // Ergebnis vorbelegen: "nicht gefeuert". Der Erfolgspfad setzt um.
  // Die CPU liest das, statt aus der HOPT-Sperre zu raten.
  room.engine.noteActivationOutcome(`hero-effect:${pi}:${heroIdx}`, false);
  // Hero effects normally fire only in Main Phase. Heroes with
  // `heroEffectActionCost: true` (Champion, the Stormbringer, …) opt in
  // to Action-Phase activation as well, paying with an Action slot.
  // The detailed phase + action-economy gate runs after collecting
  // available effects below — here we just block out-of-bounds phases.
  const isMainPhase   = gs.currentPhase === 2 || gs.currentPhase === 4;
  const isActionPhase = gs.currentPhase === 3;
  if (!isMainPhase && !isActionPhase) return false;
  if (gs.potionTargeting) return false;

  const heroOwner = charmedOwner != null ? charmedOwner : pi;
  const ps = gs.players[heroOwner];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" (Spell/Attack/Creature plays from hand) only.
  // Hero-effect activations are an "effect", not an Action — Bound's
  // text-spec ("ONLY Actions, but not their Abilities or effects")
  // covers hero effects too. Stunned / negated still silence them.
  // Chilly Dog (Mischief Militia) lifts the Frozen-only silence on
  // the activator's own side.
  if ((hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.negated) return false;
  if (hero.statuses?.frozen && !room.engine._isChillyDogActiveFor(pi)) return false;
  if (charmedOwner != null && hero.charmedBy !== pi && hero.controlledBy !== pi) return false;
  // _actionLockedTurn (Treasure Hunter's Backpack, etc.) blocks "Actions"
  // only — Spell/Attack/Creature plays and `actionCost` Ability activations.
  // Hero-effect activations are an "effect", not an Action, so the lock
  // does NOT gate this path. Same rationale as the frozen/stunned/negated
  // comment above (Bound vs. Frozen distinction).

  const availableEffects = [];
  const hasMummyToken = (ps.supportZones[heroIdx] || []).some(slot => (slot || []).includes('Mummy Token'));
  const mummyScript = hasMummyToken ? loadCardEffect('Mummy Token') : null;
  const ownScript = loadCardEffect(hero.name);

  if (hasMummyToken && mummyScript?.heroEffect && mummyScript?.onHeroEffect) {
    const mummyInst = room.engine.cardInstances.find(c =>
      c.owner === heroOwner && c.zone === 'support' && c.heroIdx === heroIdx && c.name === 'Mummy Token'
    );
    const hoptKey = `hero-effect:MummyToken:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] !== gs.turn && mummyInst) {
      // Spielstart-Schutz: rein schaedliche Helden-Effekte sind gesperrt.
      let ok = !room.engine.isHeroEffectBlockedByGraceShield(mummyScript, pi);
      if (mummyScript.canActivateHeroEffect) {
        const ctx = room.engine._createContext(mummyInst, { event: 'canHeroEffectCheck' });
        ok = mummyScript.canActivateHeroEffect(ctx);
      }
      if (ok) availableEffects.push({ name: 'Mummy Token', script: mummyScript, inst: mummyInst, hoptKey });
    }
  } else if (ownScript?.heroEffect && ownScript?.onHeroEffect) {
    const hoptKey = `hero-effect:${hero.name}:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] !== gs.turn) {
      const inst = room.engine.cardInstances.find(c => c.owner === heroOwner && c.zone === 'hero' && c.heroIdx === heroIdx);
      // Spielstart-Schutz: rein schaedliche Helden-Effekte sind gesperrt.
      let ok = !!inst && !room.engine.isHeroEffectBlockedByGraceShield(ownScript, pi);
      if (ok && ownScript.canActivateHeroEffect) {
        const ctx = room.engine._createContext(inst, { event: 'canHeroEffectCheck' });
        ok = ownScript.canActivateHeroEffect(ctx);
      }
      if (ok) availableEffects.push({ name: hero.name, script: ownScript, inst, hoptKey });
    }
  }

  for (const ci of room.engine.cardInstances) {
    if (ci.owner !== heroOwner || ci.zone !== 'support' || ci.heroIdx !== heroIdx) continue;
    if (!ci.counters?.treatAsEquip) continue;
    const eqScript = loadCardEffect(ci.name);
    if (!eqScript?.heroEffect || !eqScript?.onHeroEffect) continue;
    const hoptKey = `hero-effect:${ci.name}:${pi}:${heroIdx}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;
    // Spielstart-Schutz: rein schaedliche Helden-Effekte sind gesperrt.
    let ok = !room.engine.isHeroEffectBlockedByGraceShield(eqScript, pi);
    if (eqScript.canActivateHeroEffect) {
      try {
        const ctx = room.engine._createContext(ci, { event: 'canHeroEffectCheck' });
        ok = eqScript.canActivateHeroEffect(ctx);
      } catch { ok = false; }
    }
    if (ok) availableEffects.push({ name: ci.name, script: eqScript, inst: ci, hoptKey });
  }

  if (availableEffects.length === 0) return false;

  // ── Re-entry guard ─────────────────────────────────────────────────
  // The HOPT for a hero effect is only stamped AFTER `onHeroEffect`
  // resolves below — the choice prompt, the chain-reaction window, and
  // the effect itself all `await`, yielding the event loop in between.
  // A second socket message ("clicked her again") arriving during any
  // of those awaits would otherwise pass the HOPT check above and run
  // a parallel activation. A per-(player, heroIdx) in-progress lock
  // closes that race; cleared in the finally so a crash mid-flight
  // doesn't permanently brick the hero. Mirrors the pre-await
  // reservation pattern doActivateFreeAbility uses, but stamping the
  // chosen HOPT ahead of time is awkward here because the choice isn't
  // known until after the option prompt — so the lock covers the
  // whole activation instead.
  const inProgressKey = `${pi}:${heroIdx}`;
  if (!gs._heroEffectInProgress) gs._heroEffectInProgress = {};
  if (gs._heroEffectInProgress[inProgressKey]) return false;
  gs._heroEffectInProgress[inProgressKey] = true;
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  try {
    let chosen;
    if (availableEffects.length === 1) chosen = availableEffects[0];
    else if (chosenEffectName) {
      chosen = availableEffects.find(e => e.name === chosenEffectName);
    }
    if (!chosen) {
      const response = await room.engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: `${hero.name} — Hero Effect`,
        description: 'Choose which Hero Effect to activate.',
        options: availableEffects.map((e, i) => ({
          id: `effect-${i}`, label: e.name,
          description: e.script.heroEffect || '',
          color: e.inst?.zone === 'support' ? 'var(--warning)' : 'var(--accent)',
        })),
        cancellable: true,
        // Each option is a different Hero Effect — distinct effects.
        // No card-level cpuGerrymanderResponse override; engine falls
        // back to "first option" which usually picks the lower-tier /
        // base hero effect over a board-attached upgrade.
        gerrymanderEligible: true,
      });
      if (!response || response.cancelled) return false;
      const idx = availableEffects.findIndex((_, i) => `effect-${i}` === response.optionId);
      chosen = idx >= 0 ? availableEffects[idx] : null;
    }
    if (!chosen?.inst) return false;
    if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, chosen.name, room.engine)) return false;

    // ── Action-economy gate for `heroEffectActionCost: true` heroes ──
    // Mirror of the doPlaySpell / doPlayCreature / actionCost-Ability
    // path — consume the player's main Action slot in Action Phase, or
    // an additional-action provider in Main Phase. Heroes WITHOUT the
    // flag take the standard free Main-Phase activation path (no
    // bookkeeping below).
    const isActionCost = !!chosen.script.heroEffectActionCost;
    // Action-locking effects (Treasure Hunter's Backpack et al.) block
    // Action plays. Free hero-effect activations skip this check (they
    // aren't "Actions"); action-cost activations DO consume an Action,
    // so the lock applies.
    if (isActionCost && hero._actionLockedTurn === gs.turn) return false;
    // Spielerweite Sperre (Kent bei negativem Gold). Gleiche Scoping-
    // Regel wie die Zeile darueber: FREIE Helden-Effekte bleiben
    // erlaubt, nur solche mit Aktionskosten sind gesperrt (Als Ruling
    // 16.8. — „NUR fuer Heldeneffekte, wenn diese explizit eine Action
    // kosten, z.B. Champion").
    if (isActionCost && room.engine.areActionsBlocked(pi)) return false;
    // Divine Gift of Skill lock — action-cost hero effects are Actions.
    if (isActionCost && room.engine.isHeroSkillLocked(heroOwner, heroIdx)) return false;
    let consumedAdditionalHeroInst = null;
    let actionCounterIncrementedHere = false;
    let bonusMainActionsConsumedHereHE = false;
    let heroesActedPushedHereHE = false;
    let mainSlotConsumedHere = false;
    if (isActionCost) {
      const actingPs = gs.players[pi];
      if (isActionPhase) {
        const actionsPlayed = actingPs._actionsPlayedThisPhase || 0;
        const hasBonus = (actingPs.bonusActions?.heroIdx === heroIdx && actingPs.bonusActions.remaining > 0)
          || ((actingPs._bonusMainActions || 0) > 0 && actionsPlayed === 1);
        const actionAlreadyUsed = (actingPs.heroesActedThisTurn?.length > 0) && !hasBonus;
        if (actionAlreadyUsed) {
          // Action 2+ in Action Phase — needs a matching additional-
          // action provider, otherwise activation is illegal.
          const typeId = room.engine.findAdditionalActionForCategory(pi, 'ability_activation', heroIdx);
          if (!typeId) return false;
          consumedAdditionalHeroInst = room.engine.consumeAdditionalAction(pi, typeId);
          if (!consumedAdditionalHeroInst) return false;
        } else {
          // This activation IS the player's main Action for this
          // Action Phase. Increment the counter + mark hero acted so
          // Tarleinn / second-action-grant interactions stay
          // consistent with Spell/Attack/Creature plays.
          actingPs._actionsPlayedThisPhase = (actingPs._actionsPlayedThisPhase || 0) + 1;
          actionCounterIncrementedHere = true;
          if (actingPs._actionsPlayedThisPhase === 2 && (actingPs._bonusMainActions || 0) > 0) {
            actingPs._bonusMainActions = 0;
            bonusMainActionsConsumedHereHE = true;
          }
          if (!hasBonus) {
            mainSlotConsumedHere = true;
            if (!actingPs.heroesActedThisTurn) actingPs.heroesActedThisTurn = [];
            if (!actingPs.heroesActedThisTurn.includes(heroIdx)) {
              actingPs.heroesActedThisTurn.push(heroIdx);
              heroesActedPushedHereHE = true;
            }
          }
        }
      } else if (isMainPhase) {
        // Main Phase action-cost activation — must come from an
        // additional-action provider (no main slot to spend here).
        const typeId = room.engine.findAdditionalActionForCategory(pi, 'ability_activation', heroIdx);
        if (!typeId) return false;
        consumedAdditionalHeroInst = room.engine.consumeAdditionalAction(pi, typeId);
        if (!consumedAdditionalHeroInst) return false;
      }
    } else if (!isMainPhase) {
      // Standard hero effect attempted outside Main Phase (Action Phase
      // requested, but the script doesn't opt into actionCost). Deny.
      return false;
    }
    const refundActionCost = () => {
      if (!isActionCost) return;
      const actingPs = gs.players[pi];
      if (consumedAdditionalHeroInst) {
        room.engine.restoreAdditionalAction(consumedAdditionalHeroInst);
        consumedAdditionalHeroInst = null;
      }
      if (actionCounterIncrementedHere) {
        actingPs._actionsPlayedThisPhase = Math.max(0, (actingPs._actionsPlayedThisPhase || 0) - 1);
        actionCounterIncrementedHere = false;
      }
      if (bonusMainActionsConsumedHereHE) {
        actingPs._bonusMainActions = (actingPs._bonusMainActions || 0) + 1;
        bonusMainActionsConsumedHereHE = false;
      }
      if (heroesActedPushedHereHE) {
        const arr = actingPs.heroesActedThisTurn || [];
        const idxIn = arr.indexOf(heroIdx);
        if (idxIn >= 0) arr.splice(idxIn, 1);
        heroesActedPushedHereHE = false;
      }
    };

    // `actionCost` discriminator — true iff this hero-effect
    // activation consumed the Action resource (heroEffectActionCost
    // heroes like Champion, the Stormbringer). FREE hero effects
    // (Cooldin's terraform, Magenta's mill, etc.) log the same type
    // but with `actionCost: false`, so log scanners that count
    // "Actions performed this turn" (Tengu Windstorm) only see the
    // ones that actually spent the slot.
    room.engine._setPendingPlayLog('hero_effect_activated', {
      player: gs.players[pi].username, hero: hero.name, effect: chosen.name,
      actionCost: !!isActionCost,
    });

    // Hero-Effekt-Timing-Lernkanal: Aktivierungs-ENTSCHEIDUNG mit
    // Handgrößen-Bucket des Aktivierers stempeln (auch wenn der Gegner
    // gleich negiert — die Timing-Entscheidung war so getroffen).
    // Nur live; MCTS-Rollouts erzeugen keine Lerndaten.
    if (!room.engine._inMctsSim) {
      const _hl = gs.players[pi]?.hand?.length ?? 0;
      const _hb = _hl <= 1 ? '0-1' : _hl <= 3 ? '2-3' : '4+';
      (room.engine._heroEffectLog = room.engine._heroEffectLog || []).push({
        pi, hero: hero.baseName || hero.name, bucket: _hb,
      });
    }

    const chainResult = await room.engine.executeCardWithChain({
      cardName: chosen.name, owner: pi, cardType: 'Hero', goldCost: 0, resolve: null,
      fromBoard: true,
    });

    if (chainResult.negated) {
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[chosen.hoptKey] = gs.turn;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const surprise = await room.engine._checkSurpriseOnHeroEffect(pi, heroIdx, chosen.name);
    if (surprise?.negateEffect) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    const origController = chosen.inst.controller;
    const origOwner = chosen.inst.owner;
    if (charmedOwner != null) {
      chosen.inst.controller = pi;
      chosen.inst.owner = pi;
      chosen.inst.heroOwner = charmedOwner;
    }

    gs._pendingCardReveal = { cardName: chosen.name, ownerIdx: pi };
    // Live CPU: stream the Hero card before its effect resolves
    // (no-op for humans / PvP / MCTS sim; idempotent below).
    room.engine.maybeFireCpuRevealEarly();
    const ctx = room.engine._createContext(chosen.inst, {});
    room.engine.armEffectAnnounce(chosen.name, pi, 'board');   // v349
    const resolved = await chosen.script.onHeroEffect(ctx);
    if (resolved !== false) room.engine.announceActiveEffect();
    room.engine.clearEffectAnnounce();
    await room.engine._flushSurpriseDrawChecks();
    // Aufgeschobene Surprises abarbeiten (Jumpscare: "After the Attack,
    // Spell or effect resolves"). Fehlte hier — ein Helden-Effekt, der
    // einen gegnerischen Helden anvisiert, stellte den Eintrag in die
    // Warteschlange, und niemand loeste sie ein. Er blieb dort liegen,
    // bis IRGENDWANN ein Zauber gespielt wurde, und feuerte dann im
    // falschen Zug (Als Demo vom 9.8.: Zug 3 ausgeloest, Zug 4 aufgeloest).
    await room.engine._executeDeferredSurprises();

    if (charmedOwner != null) {
      chosen.inst.controller = origController;
      chosen.inst.owner = origOwner;
      delete chosen.inst.heroOwner;
    }

    if (resolved !== false) {
      // Aktivierung hat stattgefunden — unabhängig vom Sperr-Stempel.
      room.engine.noteActivationOutcome(`hero-effect:${pi}:${heroIdx}`, true);
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
      // Gegenstück zu `_skipCreatureEffectHopt`: Helden-Effekte mit
      // MEHREREN Nutzungen pro Runde (Kassaran, 3×) führen ihren
      // Verbrauch selbst und lassen die Engine-Sperre offen, bis sie
      // aufgebraucht ist. Vorher gab es dafür nur den Umweg "immer
      // false zurückgeben" — der bedeutet aber gleichzeitig
      // "abgebrochen" und hat deshalb `onAnyActionResolved` und die
      // CPU-Erkennung mit ausgehebelt.
      if (!ctx._skipHeroEffectHopt) {
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[chosen.hoptKey] = gs.turn;
      }
      delete gs._preventPhaseAdvance;
      // Universal action-resolved hook.
      //
      // ALS RULING (4.8.): Ein Helden-Effekt löst diesen Haken NUR aus,
      // wenn er die Ressource "Aktion" tatsächlich VERBRAUCHT — also bei
      // `heroEffectActionCost: true`, egal ob der Haupt-Slot oder eine
      // gewährte Zusatzaktion bezahlt hat. Aktive Effekte, die keine
      // Aktion kosten, SIND regeltechnisch auch keine Aktion.
      //
      // Der frühere Kommentar an dieser Stelle behauptete pauschal, jede
      // Helden-Effekt-Aktivierung zähle für Flashbang als Aktion. Das war
      // falsch und traf zwei Karten wörtlich am Text vorbei:
      //   • Flashbang — "after they perform their first Action"
      //   • Lunatic Cycle - Crescent Moon — "Any time the equipped Hero
      //     performs an Action"
      // Beide feuerten bisher auch auf kostenlose Helden-Effekte.
      //
      // Die Verbraucher, die den Haken für Helden-Effekte WIRKLICH
      // brauchen, hängen alle an `heroEffectActionCost` und laufen
      // unverändert weiter: Giga Steroids' Zweitaktions-Abwicklung
      // (Champion) sowie Güldefaber und Pharaoh, die ohnehin auf
      // actionType attack/spell bzw. creature filtern.
      if (isActionCost) {
        await room.engine.runHooks('onAnyActionResolved', {
          actionType:   'hero_effect',
          playerIdx:    pi,
          cardName:     chosen.name,
          heroIdx,
          isAdditional: !!consumedAdditionalHeroInst,
          // Immer false: der Haken feuert hier nur noch, wenn eine
          // Aktion bezahlt wurde — "inherent" hieße das Gegenteil.
          isInherent:   false,
          isFree:       false,
          _skipReactionCheck: true,
        });
      }
      // Action-cost activation auto-advance: same path as doPlaySpell /
      // doPlayCreature when the main Action slot was the resource.
      // Stays in Action Phase only when a second-action grant is alive
      // (matches the auto-advance gate over there).
      if (isActionCost && isActionPhase && mainSlotConsumedHere && !gs._preventPhaseAdvance) {
        await room.engine.advanceToPhase(pi, 4);
      }
    } else {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      // Gerrymander veto on a "may" confirm consumes the once-per-turn
      // even though `resolved` came back false — the activator did
      // commit, opp's Gerrymander declined for them.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[chosen.hoptKey] = gs.turn;
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, hero: hero.name, effect: chosen.name });
      } else if (isActionCost) {
        // Plain cancellation (no Gerrymander veto, no commitment past
        // chain resolution) — refund the action resource so the player
        // didn't burn their slot for a back-out.
        refundActionCost();
      }
    }
  } catch (err) {
    console.error('[doActivateHeroEffect]', err.message);
  } finally {
    delete gs._heroEffectInProgress[inProgressKey];
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateAreaEffect(room, pi, { areaOwner, areaName }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.potionTargeting) return false;
  try {
    await room.engine.activateAreaEffect(pi, areaOwner, areaName);
  } catch (err) {
    console.error('[doActivateAreaEffect]', err.message);
    return false;
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivatePermanent(room, pi, { permId, ownerIdx }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 3 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const permOwner = ownerIdx;
  const ownerPs = gs.players[permOwner];
  if (!ownerPs) return false;

  const perm = (ownerPs.permanents || []).find(p => p.id === permId);
  if (!perm) return false;

  const script = loadCardEffect(perm.name);
  if (!script?.canActivatePermanent || !script?.onActivatePermanent) return false;
  if (!script.canActivatePermanent(gs, pi, permOwner, room.engine)) return false;

  try {
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: perm.name });
    sendToSpectators(room, 'card_reveal', { cardName: perm.name });
    room.engine.log('permanent_activated', { card: perm.name, player: gs.players[pi].username });
    // v353: Auftritt — ein Permanent liegt am Brett, also `'board'`.
    room.engine.armEffectAnnounce(perm.name, pi, 'board');
    const _ret = await script.onActivatePermanent(room.engine, pi, permOwner, perm);
    if (_ret !== false) room.engine.announceActiveEffect();
  } catch (err) {
    console.error('[doActivatePermanent]', err.message);
  } finally {
    room.engine.clearEffectAnnounce();
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

/**
 * Eine Karte AUS DER ABLAGE benutzen (Future Tech Prototypes, v582).
 *
 * Gegenstueck zu `doActivateEquipEffect`. Die Gates stehen bewusst
 * hier und nicht nur im Sammler: der Sammler treibt die ANZEIGE, diese
 * Funktion die WIRKUNG — ein manipulierter Client darf nicht daran
 * vorbei (dieselbe Begruendung wie bei `neverPlayable`).
 */
async function doActivateDiscardEffect(room, pi, { instId }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;
  if (gs._chainResolvingLock) return false;
  if (gs._forceDiscardLock === pi) return false;

  // Nur, was der Sammler auch anbietet — EINE Auslegungsstelle fuer
  // „darf das gerade benutzt werden?".
  const angebot = room.engine.getActivatableDiscardCards(pi);
  const eintrag = angebot.find(e => e.instId === instId);
  if (!eintrag) return false;

  const inst = room.engine.cardInstances.find(c => c.id === instId);
  if (!inst || inst.zone !== 'discard') return false;
  const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
  if (typeof script?.onDiscardEffect !== 'function') return false;

  room.engine.log('discard_effect_activated', {
    player: gs.players[pi]?.username, card: eintrag.displayName,
  });
  try {
    await script.onDiscardEffect(room.engine, pi, inst);
  } catch (err) {
    console.error('[doActivateDiscardEffect]', err.stack || err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doActivateEquipEffect(room, pi, { heroIdx, zoneSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  // ★ Cross-Side (v565): eine eigene Ausruestung kann auf der
  // GEGNERSEITE liegen (Future Tech Control Device). Dann sind Held und
  // Zone die des Gegners — die Instanz gehoert trotzdem `pi`.
  const oi = pi === 0 ? 1 : 0;
  // ★ Eine Cross-Side-Karte liegt PER DEFINITION auf der Gegenseite
  // ihres Besitzers. Der Besitzer ergibt sich also aus der SEITE, in
  // deren Zone sie steht — `originalOwner` ist nur die Bestaetigung und
  // fehlt bei Karten, die ein PUZZLE vorbelegt hat (Als Befund 21.8.:
  // „ist es bereits zu Beginn equipped, hat es nicht mal das
  // Highlight").
  const _crossInst = room.engine.cardInstances.find(c =>
    c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
    && (gs.players[oi]?.supportZones?.[heroIdx]?.[zoneSlot] || []).includes(c.name)
    // Auch hier ueber das Override: eine Copy Device, die zu einem
    // Control Device geworden ist, liegt cross-side, heisst aber nicht so.
    && loadCardEffect(c.counters?._effectOverride || c.name)?.placesOnOpponentBoard);
  const ps = _crossInst ? gs.players[oi] : gs.players[pi];
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  // Bound blocks "Actions" only — equip-effect activations are an
  // "effect" per the spec and stay alive under Bound. Stunned / Webbed
  // / Frozen silence by default. A script may opt out via
  // `bypassHostStatusFilter: true` (Crimson Web — the untangle
  // discard action must fire even when the host Hero is Webbed by
  // the same card). Defer the script-driven check below.
  const slot = (ps.supportZones[heroIdx] || [])[zoneSlot] || [];
  if (slot.length === 0) return false;
  const cardName = slot[0];

  // ★ Bei Cross-Side gehoert die Instanz der GEGENSEITE der Zone, in
  // der sie liegt — `c.owner === pi` trifft dort nie zu. Ohne diesen
  // Zweig fand der Server die Karte nicht und der Klick verpuffte
  // (Als Befund 21.8.: „wird gehighlightet, Klick tut nichts").
  const inst = _crossInst || room.engine.cardInstances.find(c =>
    (c.owner === pi || c.controller === pi) && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zoneSlot
  );
  if (!inst) return false;

  // ★ Geliehene Identitaet (Future Tech Copy Device): die Karte heisst
  // weiter Copy Device, IST aber die kopierte Ausruestung. Das Skript
  // kommt deshalb aus dem Override — dieselbe Aufloesung, die
  // `CardInstance.getHook` und der Aktivierungs-Sammler benutzen. Ohne
  // diese Zeile war die Karte hervorgehoben und der Klick wirkungslos
  // (der Fehler aus v567, hier vorweggenommen).
  const script = loadCardEffect(inst.counters?._effectOverride || cardName);
  if (!script?.equipEffect || !script?.onEquipEffect) return false;
  if (!script.bypassHostStatusFilter) {
    if ((hero.statuses?.stunned || hero.statuses?.webbed)) return false;
    if (hero.statuses?.frozen && !room.engine._isChillyDogActiveFor(pi)) return false;
  }

  const hoptKey = `equip-effect:${inst.id}`;
  if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;

  if (script.canActivateEquipEffect) {
    const checkCtx = room.engine._createContext(inst, { event: 'canEquipEffectCheck' });
    if (!script.canActivateEquipEffect(checkCtx)) return false;
  }

  // Reserve the HOPT BEFORE any await. `onEquipEffect` may issue prompts
  // that yield the event loop; without the pre-stamp, a second socket
  // call (double-click) passes the check above and runs the effect a
  // second time. Released on cancel (resolved === false) so a backed-out
  // activation doesn't burn the slot.
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[hoptKey] = gs.turn;
  let hoptReserved = true;
  const releaseHopt = () => {
    if (hoptReserved) { delete gs.hoptUsed[hoptKey]; hoptReserved = false; }
  };
  // Clear any leftover Gerrymander-decline marker so we only catch
  // declines from this activation's prompts.
  room.engine._lastPromptGerryDeclined = false;

  room.engine._setPendingPlayLog('equip_effect_activated', { player: gs.players[pi].username, card: cardName, hero: hero.name });

  try {
    gs._pendingCardReveal = { cardName, ownerIdx: pi };
    // Live CPU: stream the equip before its effect resolves
    // (no-op for humans / PvP / MCTS sim; idempotent below).
    room.engine.maybeFireCpuRevealEarly();
    const ctx = room.engine._createContext(inst, {});
    // v353: Auftritt — das Artefakt liegt ausgeruestet am Brett
    // (`'board'`), NICHT in der Hand. Angemeldet vor dem Handler,
    // ausgeloest erst danach.
    room.engine.armEffectAnnounce(cardName, pi, 'board');
    const resolved = await script.onEquipEffect(ctx);
    if (resolved !== false) room.engine.announceActiveEffect();
    room.engine.clearEffectAnnounce();
    if (resolved !== false) {
      hoptReserved = false; // reservation becomes the final consumption
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      else room.engine._firePendingPlayLog();
    } else {
      // Standard cancel rolls HOPT back. Gerrymander veto on a "may"
      // confirm keeps it consumed — the activator committed and opp's
      // Gerrymander declined for them.
      if (room.engine._lastPromptGerryDeclined) {
        room.engine._lastPromptGerryDeclined = false;
        hoptReserved = false; // keep HOPT consumed
        room.engine.log('gerrymander_veto', { player: gs.players[pi].username, equip: cardName });
      } else {
        releaseHopt();
      }
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
    }
    await room.engine._flushSurpriseDrawChecks();
    await room.engine._executeDeferredSurprises();
  } catch (err) {
    console.error('[doActivateEquipEffect]', err.message);
    // Crash mid-activation — release the reservation so a real error
    // doesn't silently brick the player's once-per-turn slot.
    releaseHopt();
    room.engine.clearEffectAnnounce();
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doConfirmPotion(room, pi, { selectedIds }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (!gs.potionTargeting) return false;
  if (pi !== gs.potionTargeting.ownerIdx) return false;

  // Effect prompt (engine-driven from card hooks) resolves the engine promise.
  if (gs.potionTargeting.isEffectPrompt) {
    room.engine.resolveEffectPrompt(selectedIds);
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  const { potionName, handIndex, validTargets, cardType, goldCost } = gs.potionTargeting;
  const script = loadCardEffect(potionName);
  if (!script) { gs.potionTargeting = null; return false; }
  if (script.validateSelection && !script.validateSelection(selectedIds, validTargets)) return false;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, potionName, room.engine)) {
    gs.potionTargeting = null;
    return false;
  }

  const ps = gs.players[pi];
  if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost) {
    if (!room.engine.canAffordGold(pi, goldCost, potionName)) return false;
  }

  gs.potionTargeting = null;
  room.engine._trackTerrorResolvedEffect(pi, potionName);

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === potionName).length;
  ps._resolvingCard = { name: potionName, nth };

  // `deferReveal: true` opts the script into the engine's standard
  // pending-reveal mechanism: stash the card name on
  // `gs._pendingCardReveal` (+ pending play-log) so the first prompt
  // resolution inside resolve fires both at the natural commitment
  // moment, instead of broadcasting immediately on target-confirm.
  // Field Standard uses this so opp doesn't see the card stream when
  // the re-fired Creature effect later aborts and Standard stays in
  // hand. Cards without the opt-in keep the legacy immediate-broadcast
  // behaviour.
  //
  // `deferBroadcast` zählt hier GENAUSO. Die beiden nicht-targetenden
  // Pfade (doUsePotion, doUseArtifactEffect) prüfen `deferBroadcast`,
  // dieser Pfad prüfte nur `deferReveal` — eine Targeting-Karte mit
  // `deferBroadcast: true` (The Yeeting, Hive's Crown) wurde also
  // trotzdem sofort geloggt und aufgedeckt. Bricht ihr resolve danach
  // ab, blieb ein "card_played"-Eintrag über eine Karte stehen, die nie
  // gespielt wurde und in der Hand liegen blieb. Der Stash wird in den
  // `aborted`/`cancelled`-Zweigen unten wieder verworfen und feuert nur
  // bei einer Prompt-Antwort mit nicht-leerer Auswahl.
  const oi = pi === 0 ? 1 : 0;
  if (script.deferReveal || script.deferBroadcast) {
    gs._pendingCardReveal = { cardName: potionName, ownerIdx: pi };
    room.engine._setPendingPlayLog('card_played', {
      player: ps.username, card: potionName, cardType, cost: goldCost || 0,
    });
  } else {
    room.engine.log('card_played', { player: ps.username, card: potionName, cardType, cost: goldCost || 0 });
    const oppSid = gs.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('card_reveal', { cardName: potionName });
    sendToSpectators(room, 'card_reveal', { cardName: potionName });
    await room.engine._delay(100);
  }

  if (cardType === 'Artifact' && ps.itemLocked && (ps.hand || []).length > 0) {
    await room.engine.actionPromptForceDiscard(pi, 1, {
      title: 'Item Lock Cost',
      description: 'You must delete 1 card from your hand to use an Artifact.',
      source: 'Item Lock', deleteMode: true, selfInflicted: true,
    });
  }

  // Pre-broadcast the script's top-level animationType from INSIDE
  // the wrapped resolve so it lands at the same instant as the
  // resolve's first effects (damage, death movement, downstream
  // listener side-effects like Nornstellar pushing the deck top onto
  // the Coolness Stack). Previously this broadcast happened AFTER
  // executeCardWithChain returned — so the visible animation queued
  // up only after every death/state-diff animation had already played
  // out, leaving the player seeing "creature dies, deck card moves to
  // Stack ... THEN acid splash". Placing the emit inside the wrapped
  // resolve means a chain negate is still respected: if the chain
  // negates the card, the wrapped resolve is never called and no
  // animation fires.
  const animationType = script.animationType || 'explosion';
  const broadcastPotionAnim = (animationType !== 'none') ? () => {
    for (let i = 0; i < 2; i++) {
      const sid = gs.players[i]?.socketId;
      if (sid) io.to(sid).emit('potion_resolved', { destroyedIds: selectedIds, animationType });
    }
    sendToSpectators(room, 'potion_resolved', { destroyedIds: selectedIds, animationType });
  } : null;

  // Live CPU: for deferReveal cards, stream the card before its effect
  // resolves (no-op for humans / PvP / MCTS sim and for the immediate-
  // broadcast else-branch above which set no pending reveal).
  room.engine.maybeFireCpuRevealEarly();
  let chainResult;
  try {
    chainResult = await room.engine.executeCardWithChain({
      cardName: potionName, owner: pi, cardType, goldCost: goldCost || 0,
      resolve: script.resolve ? async () => {
        if (broadcastPotionAnim) broadcastPotionAnim();
        // v353: `'hand'` — der Spieler setzt die Karte gerade selbst aus
        // der Hand ein (Book of Doom & Co). Nur der GEGNER sieht sie.
        room.engine.announceActiveEffect(potionName, pi, 'hand');   // v347
        return await script.resolve(room.engine, pi, selectedIds, validTargets);
      } : null,
    });
  } catch (err) {
    console.error('[Engine] doConfirmPotion chain error:', err.message);
    chainResult = { negated: false, chainFormed: false, resolveResult: null };
  }

  if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
    // `cardName` mit — siehe oben (selfGoldOverdraft).
    await room.engine._payCardCost(pi, goldCost, { cardName: potionName });
  }

  if (chainResult.resolveResult?.aborted) {
    // Gold zurück. `aborted` öffnet die Targeting-Session gleich WIEDER,
    // und beim nächsten Confirm zieht der Block oben die Kosten erneut
    // ab — ohne diese Rückbuchung zahlte ein Spieler pro Abbruch-Runde
    // erneut, obwohl die Karte in der Hand bleibt und nichts passiert.
    // (Der `cancelled`-Zweig unten machte es von jeher richtig; nur
    // dieser hier fehlte.)
    if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
      ps.gold += goldCost;
    }
    ps._resolvingCard = null;
    // Drop any stashed pending reveal/log so they don't leak into the
    // next unrelated card play. Only relevant when `deferReveal` was
    // set; harmless no-op otherwise.
    delete gs._pendingCardReveal;
    delete gs._pendingPlayLog;
    const freshTargets = script.getValidTargets ? script.getValidTargets(gs, pi, room.engine, handIndex) : validTargets;
    // `room.engine` als 4. Parameter (16.8.): Karten mit VARIABLEN
    // Kosten rechnen sich aus dem Budget aus, wie viele Ziele sie
    // anbieten duerfen — und dafuer brauchen sie den Kreditrahmen
    // (Kent gibt 20 dazu). Rueckwaertskompatibel: wer den Parameter
    // nicht liest, verhaelt sich unveraendert.
    const config = typeof script.targetingConfig === 'function'
      ? script.targetingConfig(gs, pi, goldCost, room.engine)
      : { ...script.targetingConfig };
    if (script.manualGoldCost && !config.maxTotal) {
      // Auch der Standard-Deckel rechnet mit Budget statt Kontostand —
      // er greift fuer alle X-Kosten-Karten ohne eigenes `maxTotal`
      // (Beer, Cool Presents). Ohne das blieb Als Report an genau
      // diesen Karten bestehen, nur unsichtbarer als bei Book of Doom.
      const budget = room.engine.goldBudget(pi, potionName);
      config.maxTotal = goldCost > 0
        ? (budget === Infinity ? 99 : Math.floor(budget / goldCost))
        : 99;
    }
    gs.potionTargeting = {
      potionName, handIndex, ownerIdx: pi, cardType, goldCost,
      validTargets: freshTargets, config,
    };
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  if (chainResult.resolveResult?.cancelled) {
    if (cardType === 'Artifact' && goldCost > 0 && !script.manualGoldCost && !chainResult.negated) {
      ps.gold += goldCost;
    }
    ps._resolvingCard = null;
    // Same pending-state cleanup as the aborted branch.
    delete gs._pendingCardReveal;
    delete gs._pendingPlayLog;
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  await room.engine._delay(100);

  // Fallback fire of the stashed pending reveal/log for `deferReveal`
  // scripts whose resolve completed without ever firing an inner
  // prompt. The standard prompt-resolution paths inside
  // `resolveEffectPrompt` / `resolveGenericPrompt` already drain the
  // stash on first commit, so this is a no-op when an inner prompt
  // ran.
  if ((script.deferReveal || script.deferBroadcast) && gs._pendingCardReveal) {
    room.engine._firePendingCardReveal();
  }

  const hi = getResolvingHandIndex(ps);
  ps._resolvingCard = null;
  // Magic Gems' "discard another card to keep this in hand" rule —
  // mirrors the same flag in doUseArtifactEffect. Skip the splice +
  // discard pass entirely so the card stays pinned at its hand index.
  // Negated and Potion cards never qualify (the keep-in-hand cost was
  // tied to playing an Artifact normally, and a negated card pays
  // gold but doesn't resolve, so no recycle).
  const keepInHand = !chainResult.negated && cardType === 'Artifact'
    && chainResult.resolveResult?.keepInHand === true;
  if (keepInHand) {
    // Play-Beleg für keepInHand-Gems im TARGETING-Pfad (Magic Amethyst
    // läuft über die potionTargeting-Session hierher — der andere
    // keepInHand-Zweig bei ~8250 deckt nur Nicht-Targeting-Artefakte).
    room.engine.log('gem_kept_in_hand', { player: ps.username, card: potionName });
  }
  if (hi >= 0 && !keepInHand) {
    // ── FLUG VOR ENTNAHME (Als Regel 17.8.) ─────────────────────────
    // „Die Hand soll sich immer ERST verkleinern, wenn die entsprechende
    //  Handkarte visuell beginnt, von der Hand woanders hin zu fliegen."
    // Der Flug wird deshalb HIER ausgeloest, unmittelbar vor dem Splice
    // und damit im selben Zustandsversand — nicht dem Diff-Erkenner des
    // Clients ueberlassen, der die Quelle nur ueber den Kartennamen
    // sucht und bei gleichnamigen Karten den falschen Platz erwischt.
    // Dieselbe Reihenfolge wie im Artefakt-Kreatur-Weg (v419).
    room.engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: potionName,
      from: 'hand', to: (cardType === 'Potion' || script.deleteOnUse) ? 'deleted' : 'discard',
      fromHandIdx: hi,
    });
    ps.hand.splice(hi, 1);
    room.engine.notePlayedFromHand(pi);
    // Foreign-origin cards (Magic Lamp gifts etc.) discard / delete
    // to the ORIGINAL owner's pile. `_consumeHandCardOrigin` returns
    // `pi` for normally-owned cards.
    const pileOwner = room.engine._consumeHandCardOrigin(pi, potionName);
    const pilePs = gs.players[pileOwner];
    if (chainResult.negated) {
      await room.engine.routeNegatedInitialCard(pileOwner, potionName, chainResult);
    } else if (gs._spellPlacedOnBoard) {
      // Targeting Artifact-Creatures (Powder Keg etc.) — the script's
      // resolve placed the card itself onto the board as a tracked
      // instance. Pushing the name to discard here would double-stamp
      // it (one live inst + one phantom discard entry that surfaces
      // the moment the inst dies). Same flag / semantics that the
      // non-targeting `doUseArtifactEffect` path already honours
      // (server.js:6429). Consume the flag so it doesn't leak into
      // the next card play.
      delete gs._spellPlacedOnBoard;
    } else if (cardType === 'Potion') {
      const potionHookCtx = { potionName, potionOwner: pi, placed: false, _skipReactionCheck: true };
      await room.engine.runHooks('afterPotionUsed', potionHookCtx);
      if (!potionHookCtx.placed) pilePs.deletedPile.push(potionName);
      checkPotionLock(ps, gs, pi);
    } else {
      pilePs.discardPile.push(potionName);
      // Targeting Artifacts (Snow Cannon, Magnetic Glove, Golden Ankh,
      // The Yeeting, …) resolve through THIS shared potion-targeting
      // flow, not through doUseArtifactEffect — without this fire they
      // are invisible to afterArtifactUsed observers (training
      // recorder). Board-placing artifacts (_spellPlacedOnBoard) are
      // deliberately excluded above: they get recorded via
      // onCardEnterZone and would double-count here.
      if (cardType === 'Artifact' && !chainResult.negated) {
        try {
          await room.engine.runHooks('afterArtifactUsed', {
            artifactName: potionName, playerIdx: pi, _skipReactionCheck: true,
          });
        } catch (err) {
          console.error('[Engine] afterArtifactUsed hook error:', err.message);
        }
      }
    }
  } else if (hi >= 0 && keepInHand) {
    // Card stays in hand — still counts as a played-from-hand card
    // so per-turn play counters track it.
    room.engine.notePlayedFromHand(pi);
  } else {
    if (!chainResult.negated && cardType === 'Potion') checkPotionLock(ps, gs, pi);
  }

  // The script's top-level animationType is now broadcast at the
  // start of the wrapped resolve (see the broadcast block before
  // executeCardWithChain), so it lands simultaneously with the
  // resolve's first visible effects rather than after them.
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doPlaySurprise(room, pi, { cardName, handIndex, heroIdx, bakhmSlot }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;

  const script = loadCardEffect(cardName);
  if (!script?.isSurprise) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || (cardData.subtype || '').toLowerCase() !== 'surprise') return false;

  // Once-per-game Surprises (Tharxian Horse, etc.) can only be played
  // ONCE per game. The client grays the card out via
  // `getBlockedSpells`, but the server must also enforce it so a
  // hand-jiggle / replay attempt can't bypass the lock.
  if (script.oncePerGame) {
    const opgKey = script.oncePerGameKey || cardName;
    if (ps._oncePerGameUsed?.has(opgKey)) return false;
  }

  const hero = ps.heroes[heroIdx];
  if (!hero || !hero.name || hero.hp <= 0) return false;

  // Bakhm Support-Zone placement: Surprise Creatures can go into Bakhm's own
  // Support Zones instead of the Surprise Zone.
  if (bakhmSlot != null && bakhmSlot >= 0) {
    if (hero.statuses?.frozen || (hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.negated || hero.statuses?.bound) return false;
    const heroScript = loadCardEffect(hero.name);
    if (!heroScript?.isBakhmHero) return false;
    if (cardData.cardType !== 'Creature') return false;
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    if ((ps.supportZones[heroIdx][bakhmSlot] || []).length > 0) return false;

    ps.supportZones[heroIdx][bakhmSlot] = [cardName];
    ps.hand.splice(handIndex, 1);
    room.engine.notePlayedFromHand(pi);

    const inst = room.engine._trackCard(cardName, pi, 'support', heroIdx, bakhmSlot);
    inst.faceDown = true;

    if (script.oncePerGame) {
      if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
      ps._oncePerGameUsed.add(script.oncePerGameKey || cardName);
    }

    room.engine.log('surprise_set', { player: ps.username, hero: hero.name, bakhmSlot: true });
    broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'support', heroIdx, slotIdx: bakhmSlot, faceDown: true });

    try {
      await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });
    } catch (err) {
      console.error('[Engine] doPlaySurprise (bakhm) hooks error:', err.message);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // Regular Surprise-Zone placement. Each Hero has only 1 Surprise Zone.
  if ((ps.surpriseZones[heroIdx] || []).length > 0) return false;

  if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
  ps.surpriseZones[heroIdx] = [cardName];
  ps.hand.splice(handIndex, 1);
  room.engine.notePlayedFromHand(pi);

  const inst = room.engine._trackCard(cardName, pi, 'surprise', heroIdx, 0);
  inst.faceDown = true;

  if (script.oncePerGame) {
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add(script.oncePerGameKey || cardName);
  }

  room.engine.log('surprise_set', { player: ps.username, hero: hero.name });
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'surprise', heroIdx, slotIdx: 0, faceDown: true });

  try {
    await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx, _skipReactionCheck: true });
  } catch (err) {
    console.error('[Engine] doPlaySurprise hooks error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

/**
 * Rewrite `equip`-type validTargets so their `id` and `owner` fields
 * point at the creature's PHYSICAL side rather than `inst.owner`. Two
 * paths produce a controller / owner mismatch:
 *   • Temporary steals (Deepsea Succubus, `inst.stolenBy != null`) —
 *     the card stays on the owner's supportZones array, so physical
 *     side = owner. No rewrite needed.
 *   • Permanent cross-side placements (Chilly Wizard) — the card was
 *     physically moved to the controller's supportZones array, so
 *     physical side = controller. Without this rewrite, target IDs
 *     read `equip-<owner>-…` while the slot is rendered under
 *     `<controller>`, and the client's `t.owner === pi` highlight
 *     match silently fails — the user couldn't burn / freeze / etc.
 *     a cross-side-summoned Chilly Wizard.
 *
 * `owner` field on the validTarget is the slot's render-side from the
 * client's POV; the IDs are owner-derived (`equip-${owner}-…`). The
 * rewrite is a no-op when controller == owner (the common case). All
 * targeting cards that emit `equip-${inst.owner}-…` IDs flow through
 * this helper without per-card changes.
 */
function normalizeValidTargets(validTargets, casterPi, engine, config) {
  if (!Array.isArray(validTargets)) return validTargets;
  // Erst-Runden-Immunität — Gegenstück zum Filter in
  // `promptEffectTarget`. Targeting-Karten (getValidTargets +
  // targetingConfig) laufen NICHT durch diesen Prompt, sondern über die
  // potionTargeting-Session, also muss die Regel auch hier greifen.
  const ftProtected = engine?.gs?.firstTurnProtectedPlayer;
  if (ftProtected != null && casterPi !== ftProtected
      && !config?.ignoreFirstTurnProtection) {
    for (let i = validTargets.length - 1; i >= 0; i--) {
      const t = validTargets[i];
      const inst = t?.cardInstance || t?._cardInstance;
      const side = inst ? (inst.controller ?? inst.owner) : t?.owner;
      if (side === ftProtected) validTargets.splice(i, 1);
    }
  }
  for (const t of validTargets) {
    if (t?.type !== 'equip') continue;
    const inst = t.cardInstance;
    if (!inst) continue;
    if (inst.stolenBy != null) continue; // physical side = owner already
    const physSide = inst.controller ?? inst.owner;
    if (physSide === t.owner) continue;
    t.owner = physSide;
    t.id = `equip-${physSide}-${t.heroIdx}-${t.slotIdx}`;
  }
  // Non-damage opponent shield filter (The Great Wall of Deri, any
  // future "your Creatures can't be chosen by opp's non-damage
  // cards/effects" card). Targeting Artifacts build their own
  // `getValidTargets` list rather than going through the engine's
  // promptDamageTarget / promptMultiTarget chokepoints — so we
  // apply the filter HERE, on the server side, after the script
  // returns its raw target list. Skipped when the targetingConfig
  // tags damage targeting (`damageType` / `baseDamage` set) or when
  // the caller opts out via `ignoreUntargetable: true`.
  if (engine && typeof casterPi === 'number' && config
      && !config.ignoreUntargetable) {
    // See `_isSideNondamageShielded` filter in promptDamageTarget
    // for the rationale — `baseDamage > 0` is the canonical "deals
    // damage" signal; status-application pickers that set
    // `damageType: 'status'` without `baseDamage` are correctly
    // treated as non-damage targeting here.
    const isDamageTargeting = typeof config.baseDamage === 'number' && config.baseDamage > 0;
    if (!isDamageTargeting && typeof engine._isSideNondamageShielded === 'function') {
      for (let i = validTargets.length - 1; i >= 0; i--) {
        const t = validTargets[i];
        if (t?.type !== 'equip' || !t.cardInstance) continue;
        const tgtCtrl = t.cardInstance.controller ?? t.cardInstance.owner;
        if (tgtCtrl === casterPi) continue;
        if (engine._isSideNondamageShielded(tgtCtrl)) {
          validTargets.splice(i, 1);
        }
      }
    }
  }
  return validTargets;
}

async function doUsePotion(room, pi, { cardName, handIndex }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  // Sperre kann auch von einer gegnerischen Karte kommen (Tuscan
  // Mystic) — `arePotionsLockedFor` fasst beide Quellen zusammen.
  if (room.engine.arePotionsLockedFor(pi)) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;
  if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Potion') return false;

  const script = loadCardEffect(cardName);
  if (!script?.isPotion) return false;
  if (script.canActivate && !script.canActivate(gs, pi, room.engine)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;

  // Targeted Potions enter targeting mode; the CPU defers them until 2i (the
  // targeting brain). Callers should pre-filter those — this branch still
  // supports them for the human socket path.
  if (script.getValidTargets && script.targetingConfig) {
    // targetingConfig may be a function (per-call computation) or a
    // static object — normalize so the client always receives a plain
    // config object.
    const cfg = typeof script.targetingConfig === 'function'
      ? script.targetingConfig(gs, pi)
      : script.targetingConfig;
    const validTargets = normalizeValidTargets(
      script.getValidTargets(gs, pi, room.engine), pi, room.engine, cfg,
    );
    gs.potionTargeting = {
      potionName: cardName, handIndex, ownerIdx: pi,
      cardType: 'Potion', validTargets, config: cfg,
    };
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  // No targeting — mark this card instance as resolving and execute.
  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  try {
    const oi = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oi]?.socketId;
    if (!script.deferBroadcast) {
      if (oppSid) io.to(oppSid).emit('card_reveal', { cardName });
      sendToSpectators(room, 'card_reveal', { cardName });
      await room.engine._delay(100);
    }

    room.engine._setPendingPlayLog('card_played', { player: ps.username, card: cardName, cardType: 'Potion', cost: 0 });

    let chainResult;
    try {
      // v353: Auftritt fuer Traenke OHNE Zielwahl. Die Variante MIT
      // Zielwahl laeuft ueber `doConfirmPotion` und hatte ihn schon —
      // hier fehlte er. `'hand'`: nur der Gegner sieht die Karte.
      room.engine.armEffectAnnounce(cardName, pi, 'hand');
      chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Potion', goldCost: 0,
        resolve: script.resolve ? async () => {
          const r = await script.resolve(room.engine, pi, [], []);
          if (r !== false) room.engine.announceActiveEffect();
          return r;
        } : null,
      });
      room.engine.clearEffectAnnounce();
    } catch (err) {
      console.error('[Engine] Potion chain error:', err.message);
      chainResult = { negated: false, chainFormed: false };
    }
    await room.engine._delay(100);

    if (chainResult.resolveResult?.cancelled) {
      ps._resolvingCard = null;
      delete gs._pendingPlayLog;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }
    room.engine._firePendingPlayLog();

    const currentIdx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (currentIdx >= 0) {
      ps.hand.splice(currentIdx, 1);
      room.engine.notePlayedFromHand(pi);
      // Foreign-origin Potions (Magic Lamp gifts etc.) route to the
      // ORIGINAL owner's pile. Resolves to `pi` for normally-owned
      // Potions, so the local-pile case is unchanged.
      const pileOwner = room.engine._consumeHandCardOrigin(pi, cardName);
      const pilePs = gs.players[pileOwner];
      if (chainResult.negated) {
        await room.engine.routeNegatedInitialCard(pileOwner, cardName, chainResult);
      } else if (chainResult.resolveResult?.placed) {
        checkPotionLock(ps, gs, pi);
      } else {
        // `fromHandIndex` carries the pre-splice hand slot the Potion
        // occupied — listeners that re-route the spent Potion (Saint
        // Nicolas's redirect to opp's hand) use it for the source rect
        // of any cross-hand flight animation. Without it, the client
        // falls back to the hand container's center and the visual
        // looks like the card teleported out of the middle of the
        // hand instead of leaving its actual slot.
        const potionHookCtx = {
          potionName: cardName, potionOwner: pi,
          fromHandIndex: currentIdx,
          placed: false, _skipReactionCheck: true,
        };
        await room.engine.runHooks('afterPotionUsed', potionHookCtx);
        if (potionHookCtx.placed) {
          checkPotionLock(ps, gs, pi);
        } else {
          pilePs.deletedPile.push(cardName);
          checkPotionLock(ps, gs, pi);
        }
      }
    } else {
      // Selbst-splicende Potions (Elixir of Quickness räumt sich in
      // resolve() eigenhändig aus der Hand, getResolvingHandIndex ist
      // danach -1): afterPotionUsed muss TROTZDEM feuern — sonst sind
      // Karten-Listener (Saint Nicolas, Lizbeth, Biomancy) und der
      // Trainings-Recorder für diese Potions blind. Kein Pile-Push
      // hier: die Karte hat ihren Zonen-Transfer bereits selbst erledigt.
      if (!chainResult.negated && !chainResult.resolveResult?.cancelled) {
        await room.engine.runHooks('afterPotionUsed', {
          potionName: cardName, potionOwner: pi,
          fromHandIndex: -1,
          placed: !!chainResult.resolveResult?.placed, _skipReactionCheck: true,
        });
      }
      if (!chainResult.negated && !chainResult.resolveResult?.placed) checkPotionLock(ps, gs, pi);
    }
  } catch (err) {
    console.error('[Engine] doUsePotion error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

async function doUseArtifactEffect(room, pi, { cardName, handIndex }) {
  if (!room?.engine || !room.gameState) return false;
  const gs = room.gameState;
  if (pi !== gs.activePlayer) return false;
  if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return false;
  if (gs.potionTargeting) return false;

  const ps = gs.players[pi];
  if (!ps) return false;
  if (ps.itemLocked && (ps.hand || []).length < 2) return false;
  // Boomerang's "no Artifacts for the rest of this turn" lockout —
  // covers Normal / Reaction-with-proactivePlay Artifacts that route
  // through this handler.
  if (ps._artifactLockTurn === gs.turn) return false;
  if (ps._creationLockedNames?.has(cardName)) return false;
  if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return false;
  if (ps._resolvingCard && handIndex === getResolvingHandIndex(ps)) return false;

  const cardData = getCardDB()[cardName];
  if (!cardData || cardData.cardType !== 'Artifact') return false;

  // ── HAND-SPERRE DURCHSETZEN (1.8.) ─────────────────────────────────
  // `neverPlayable` markiert Karten, die aus der HAND wirkungslos sind
  // und nur über einen anderen Weg ins Spiel kommen (Coolness-Stapel,
  // Discard, Reaktionsfenster). Bisher wurde das Flag AUSSCHLIESSLICH an
  // den Client gereicht (`neverPlayableCards`), um die Karte auszugrauen
  // — eine reine Anzeige. Weder der Server noch das CPU-Gehirn haben es
  // je geprüft.
  //
  // Folge, belegt in Als Mitschnitt vom 1.8.: die CPU equipte
  // "Swellpnir, Mount of Coolness" in Zug 1 direkt aus der Hand
  // (`artifact_equipped`, cost 0) und bekam die Zusatzaktion
  // (`second_action_granted`) — obwohl der Coolness-Stapel da noch leer
  // war (erster `coolness_stack_push` erst 23 Ereignisse später).
  // Betrifft nicht nur Swellpnir/Modnir, sondern alle 20 Karten mit
  // diesem Flag.
  //
  // Die Prüfung gehört auf den SERVER, nicht nur in die CPU: ein
  // manipulierter Client könnte den Zug sonst genauso schicken.
  if (loadCardEffect(cardName)?.neverPlayable) return false;

  // ── ZIEH-LOCK AUCH FÜR ARTEFAKTE DURCHSETZEN (1.8.) ────────────────
  // `blockedByDrawLock` wird in `validateActionPlay` geprüft — Artefakte
  // laufen dort aber vorbei (dieselbe Lücke wie bei `neverPlayable`).
  // Folge: die CPU spielte unter dem Lock von "The Sacred Jewel" weitere
  // Sacred Jewels, deren Ziehteil garantiert fizzlet.
  //
  // Die Karte deklariert das Flag selbst, und der Client graut sie
  // bereits aus (`drawLockBlockedCards`) — hier fehlte nur die
  // Durchsetzung. Kreaturen sind wie im Engine-Pfad ausgenommen.
  {
    const _scr = loadCardEffect(cardName);
    const _me = gs.players[pi];
    if (_scr?.blockedByDrawLock && _me?.drawLocked && cardData.cardType !== 'Creature') return false;
    if (_scr?.blockedByHandLock && _me?.handLocked && cardData.cardType !== 'Creature') return false;
  }
  if ((cardData.subtype || '').toLowerCase() === 'equipment') return false;

  // Rusting Crystal aura — doubles the base cost BEFORE reductions.
  const rawCost = applyRustingCrystalCostMultiplier(
    gs, pi, cardName, cardData.cost || 0, room.engine,
  );
  // Same stacked discount as the equip path: Shu'Chaku's next-artifact
  // reduction + Play Money's per-hand-index reduction, capped at 0.
  const playerReduction = ps._nextArtifactCostReduction || 0;
  const handReduction = (ps._handCostReductions?.[handIndex] || 0)
    + (ps._handCostReductionsPermanent?.[handIndex] || 0)
    // ★ Namensweiter Nullpreis (Misfire, Als Ruling 21.8.): „das
    // NAECHSTE Artefakt mit diesem Namen diese Runde" — egal welche
    // Kopie, also NICHT ueber den Handindex. Der Eintrag wird beim
    // tatsaechlichen Spielen verbraucht und beim Zugbeginn geloescht.
    + ((ps._freeArtifactNames && ps._freeArtifactNames[cardName]) ? rawCost : 0)
    // ★ `selfCostReduction(gs, pi, cardData, engine)` — eine Karte
    // verbilligt SICH SELBST (Future Tech Laser Cannon: −20 je Kopie in
    // der Ablage). Bewusst ein eigener Vertrag und nicht `dynamicCost`:
    // den liest der Server NUR bei Reaktionen. Additiv und
    // rueckwaertskompatibel — kein Artefakt exportiert ihn per Default.
    // ★ EIGENE Nachladung statt der Konstante `script` weiter unten:
    // die wird ERST NACH dieser Rechnung deklariert, ein Zugriff hier
    // wirft `Cannot access 'script' before initialization` und legt
    // JEDE Artefakt-Aktivierung lahm (Als Fehlerbericht 21.8.).
    // `loadCardEffect` ist gecached, der zweite Aufruf kostet nichts.
    + (() => {
      const sk = loadCardEffect(cardName);
      return typeof sk?.selfCostReduction === 'function'
        ? (sk.selfCostReduction(gs, pi, cardData, room.engine) || 0) : 0;
    })();
  const costReduction = playerReduction + handReduction;
  const cost = Math.max(0, rawCost - costReduction);

  const script = loadCardEffect(cardName);
  if (!script) return false;
  if (isShuffleIntoDeckBlockedByDistractingCrystal(gs, pi, cardName, room.engine)) return false;
  // `manualGoldCost` Artifacts (Dark Gear's level-scaled cost, Cool
  // Repair / Beer's per-target multiplier, etc.) compute their own
  // actual cost inside `resolve` — the cards.json `cost` is only the
  // BASE / per-unit price for UI display. Skipping the base-cost gate
  // here lets a player use Dark Gear on a Lv0 Creature (actual cost 0)
  // even when they're short on gold; the script's own `canActivate`
  // and `getValidTargets` filter targets by what they can actually
  // afford. Standard Artifacts still gate on the base cost.
  if (!script.manualGoldCost && !room.engine.canAffordGold(pi, cost, cardName)) return false;
  if ((cardData.subtype || '').toLowerCase() === 'reaction' && !script.proactivePlay) return false;
  if (script.canActivate && !script.canActivate(gs, pi, room.engine)) return false;
  if (script.blockedByHandLock && ps.handLocked) return false;

  // Targeting-required Artifacts enter targeting mode. The CPU brain's
  // `playArtifacts` (cards/effects/_cpu.js) detects the `potionTargeting`
  // state opened here and calls `resolveTargetingPrompt`, which routes
  // through `engine._getCpuTargetResponse` to pick targets (cards can
  // export `cpuResponse` for custom heuristics) and finishes via
  // `doConfirmPotion`.
  if (script.getValidTargets && script.targetingConfig) {
    // `handIndex` lets the script exclude its own resolving slot from
    // hand-target picks (Cool Presents gifting). `_resolvingCard` is
    // only stamped after the player confirms (doConfirmPotion), so
    // scripts that need self-exclusion at the targeting-build stage
    // rely on this explicit argument.
    // `room.engine` als 4. Parameter und Budget statt Kontostand — DIE
    // Stelle, an der Book of Doom seine Ziele zaehlt (16.8., Als
    // zweiter Report). Die gleiche Rechnung steht in `doConfirmPotion`;
    // v409 hatte nur DIESE hier uebersehen, weshalb der Ziel-Waehler
    // bei <= 0 Gold weiter nichts anbot.
    const config = typeof script.targetingConfig === 'function'
      ? script.targetingConfig(gs, pi, cost, room.engine)
      : { ...script.targetingConfig };
    if (script.manualGoldCost && !config.maxTotal) {
      const budget = room.engine.goldBudget(pi, cardName);
      config.maxTotal = cost > 0
        ? (budget === Infinity ? 99 : Math.floor(budget / cost))
        : 99;
    }
    const validTargets = normalizeValidTargets(
      script.getValidTargets(gs, pi, room.engine, handIndex), pi, room.engine, config,
    );
    gs.potionTargeting = {
      potionName: cardName, handIndex, ownerIdx: pi,
      cardType: 'Artifact', goldCost: cost, validTargets, config,
    };
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    return true;
  }

  if (!script.resolve) return false;

  const nth = ps.hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };

  // Hand-to-board fly animation for non-equipment, non-creature, non-targeting
  // Artifacts (Normal / Reaction-with-proactivePlay). The destination is the
  // permanents zone (or the board area if none renders yet).
  broadcastHandToBoard(room, pi, { cardName, handIndex, zoneType: 'permanent' });

  try {
    if (!script.deferBroadcast) {
      gs._pendingCardReveal = { cardName, ownerIdx: pi };
    }
    room.engine._setPendingPlayLog('card_played', { player: ps.username, card: cardName, cardType: 'Artifact', cost: cost || 0 });

    // Live CPU: stream the Artifact before its effect resolves
    // (no-op for humans / PvP / MCTS sim; idempotent below).
    room.engine.maybeFireCpuRevealEarly();

    if (ps.itemLocked && (ps.hand || []).length > 0) {
      if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
      await room.engine.actionPromptForceDiscard(pi, 1, {
        title: 'Item Lock Cost',
        description: 'You must delete 1 card from your hand to use an Artifact.',
        source: 'Item Lock', deleteMode: true, selfInflicted: true,
      });
    }

    let chainResult;
    try {
      chainResult = await room.engine.executeCardWithChain({
        cardName, owner: pi, cardType: 'Artifact', goldCost: cost,
        resolve: async () => {
          room.engine.armEffectAnnounce(cardName, pi, 'hand');   // v349
          try {
            const r = await script.resolve(room.engine, pi, [], []);
            if (r !== false) room.engine.announceActiveEffect();
            return r;
          } finally {
            room.engine.clearEffectAnnounce();
          }
        },
      });
    } catch (err) {
      console.error('[Engine] Artifact resolve error:', err.stack || err.message); // Stack statt nur Message — ohne ihn war der Täter (Ushabti) nicht auffindbar
      chainResult = { negated: false, chainFormed: false };
    }
    await room.engine._delay(100);

    if (chainResult.resolveResult?.cancelled) {
      delete gs._pendingCardReveal;
      delete gs._pendingPlayLog;
      ps._resolvingCard = null;
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
      return true;
    }

    if (gs._pendingCardReveal) room.engine._firePendingCardReveal();
    else room.engine._firePendingPlayLog();

    if (ps._freeArtifactNames && ps._freeArtifactNames[cardName] && !chainResult.negated) {
      delete ps._freeArtifactNames[cardName];
    }
    if (cost > 0 && !script.manualGoldCost && !chainResult.negated) await room.engine._payCardCost(pi, cost, { cardName });
    if (!chainResult.negated && costReduction > 0) {
      delete ps._nextArtifactCostReduction;
      delete ps._nextArtifactCostReductionTurn;
    }

    // Universal "artifact resolved" observer hook. One-shot / targeting
    // Artifacts never enter a board zone, so onCardEnterZone can't see
    // them — this is the ONLY signal that e.g. Magnetic Glove or Golden
    // Ankh was actually used. Observers only (training recorder, future
    // passive listeners); _skipReactionCheck so no reaction window opens.
    if (!chainResult.negated) {
      try {
        await room.engine.runHooks('afterArtifactUsed', {
          artifactName: cardName, playerIdx: pi, _skipReactionCheck: true,
        });
      } catch (err) {
        console.error('[Engine] afterArtifactUsed hook error:', err.message);
      }
    }

    const currentIdx = getResolvingHandIndex(ps);
    ps._resolvingCard = null;
    if (currentIdx >= 0) {
      // `keepInHand` (Magic Gems' "discard another card to keep this in
      // hand" rule) skips the standard splice + discard disposition: the
      // card stays at its current hand index and the disposition is a
      // no-op for the play. The pay-for-keep cost was already paid by
      // the script's resolve before it returned the flag, so the play
      // is still counted against `cardsPlayedFromHand` (the player
      // committed to playing the card; the rule just lets them recycle
      // it). Negated cards always go to discard regardless.
      const keepInHand = !chainResult.negated && chainResult.resolveResult?.keepInHand === true;
      if (keepInHand) {
        room.engine.notePlayedFromHand(pi);
        // keepInHand-Gems erzeugen keinen ZoneEnter für die Karte selbst —
        // dieses Event ist die Play-Quelle für Recorder/Einsatz-Report
        // (schloss die Amethyst-Unterzählung: 3/700 trotz realer Plays).
        room.engine.log('gem_kept_in_hand', { player: ps.username, card: cardName });
      } else {
        // Flug vor Entnahme — siehe Regel im Potion-Pfad (doConfirmPotion).
        // Bei einem Artefakt, das sich selbst aufs Brett legt
        // (`_spellPlacedOnBoard`), waere ein Stapelflug falsch: die Karte
        // geht ja nicht in die Ablage. Dort schweigt der Broadcast.
        if (!gs._spellPlacedOnBoard) {
          room.engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName,
            from: 'hand', to: script.deleteOnUse ? 'deleted' : 'discard',
            fromHandIdx: currentIdx,
          });
        }
        ps.hand.splice(currentIdx, 1);
        room.engine.notePlayedFromHand(pi);
        if (chainResult.negated) await room.engine.routeNegatedInitialCard(pi, cardName, chainResult);
        else if (gs._spellPlacedOnBoard) {
          // Area Artifacts (Smuggler's Pier, etc.) and any future
          // "card stays on the board after resolve" Artifact route
          // themselves into a board zone via `placeArea` inside their
          // resolve. The placeArea helper stamps `gs._spellPlacedOnBoard
          // = true`; we consume the flag here so the standard
          // hand-to-discard disposition is skipped. Mirrors the same
          // flag-consume logic in doPlaySpell (~L3853).
          delete gs._spellPlacedOnBoard;
        }
        else if (script.deleteOnUse) ps.deletedPile.push(cardName);
        else ps.discardPile.push(cardName);
      }
    }
  } catch (err) {
    console.error('[Engine] doUseArtifactEffect error:', err.message);
  }
  for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  return true;
}

// ═══════════════════════════════════════════
//  CUBE DRAFT ENGINE
//  ─────────────────
//  Server-authoritative draft state machine. The flow:
//    1. cubeDraftStart()    — load cube, shuffle into 32 packs of 16,
//                             open round 0 (8 packs to 8 seats), start
//                             pick-window timer.
//    2. cubeDraftMakePick() — apply a single human pick. When all 8
//                             pending picks are filled, advance.
//    3. cubeDraftAdvance()  — collapse pending picks into pools, pass
//                             packs (snake direction), bump pickInRound.
//                             At end-of-round (16 picks), open next 8
//                             packs. After 4 rounds, finalizeDraft()
//                             flips phase → 'building' for M3.
//    4. Bots auto-pick on a short randomized delay; humans use a
//       per-pack time bank that ticks down only during open windows.
//    5. Disconnected humans suspend the draft; (re)connect or vote-kick
//       to a bot replacement resumes it. Vote-kicked = treated as a
//       loss for cube ELO purposes (handled in M5).
// ═══════════════════════════════════════════

const CUBE_PACK_SIZE = 16;
const CUBE_PACKS_PER_ROUND = 8;
const CUBE_ROUNDS = 4;
const CUBE_SEATS = 8;
const BOT_PICK_DELAY_MIN_MS = 250;
const BOT_PICK_DELAY_MAX_MS = 900;

function cubeShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Effective remaining-pack-budget for a seat, accounting for time
 *  already elapsed in the open pick window. Returns ms; clamps to 0. */
function cubeDraftSeatRemainingMs(draft, seatIdx) {
  if (!draft) return 0;
  const baseRemaining = draft.timerRemaining[seatIdx] || 0;
  const pickedAt = draft.pickedAtMs[seatIdx];
  if (pickedAt != null) {
    return Math.max(0, baseRemaining - (pickedAt - draft.pickWindowStartedAt));
  }
  return Math.max(0, baseRemaining - (Date.now() - draft.pickWindowStartedAt));
}

async function cubeDraftStart(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  if (!cd) return;

  // Load the host's cube. The cube was validated at create_room time;
  // we re-load here in case the host edited the cube between creation
  // and start (rare but possible). 512 cards is the strict requirement.
  let cube;
  try {
    const deckRow = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [cd.cubeId, cd.cubeOwnerId]);
    if (!deckRow) throw new Error('Cube row missing');
    cube = parseDeck(deckRow);
  } catch (err) {
    console.error('[cubeDraftStart] failed to load cube:', err.message);
    cd.phase = 'lobby';
    io.to('room:' + room.id).emit('room_update', sanitizeRoom(room));
    return;
  }
  const cubeCards = cube.mainDeck || [];
  if (cubeCards.length !== 512 || cube.mode !== 'cube') {
    console.error('[cubeDraftStart] cube no longer legal:', cubeCards.length, cube.mode);
    cd.phase = 'lobby';
    io.to('room:' + room.id).emit('room_update', sanitizeRoom(room));
    return;
  }

  // Shuffle cube into 32 packs of 16. Each cube card appears exactly once.
  const shuffled = cubeShuffle(cubeCards);
  const packs = [];
  for (let i = 0; i < CUBE_PACKS_PER_ROUND * CUBE_ROUNDS; i++) {
    packs.push(shuffled.slice(i * CUBE_PACK_SIZE, (i + 1) * CUBE_PACK_SIZE));
  }
  // Cache the original (unshuffled) cube card list — used by
  // cubeDraftFinalize for the "0 heroes drafted" auto-assign rule
  // (need the cube contents to know which heroes are NOT in the cube).
  cd.cubeCards = [...cubeCards];

  // Random ring order (0..7 → seat indices). The host stays at seat 0
  // physically but the ring position can be anywhere — this only
  // governs which-seat-passes-to-which during the snake.
  const seatOrder = cubeShuffle([0, 1, 2, 3, 4, 5, 6, 7]);

  cd.draftState = {
    seatOrder,                                                        // ring pos → seat idx
    packs,                                                            // 32 starting packs
    round: 0,                                                         // 0..3
    pickInRound: 0,                                                   // 0..15
    direction: 'left',                                                // 'left' | 'right'
    currentPacks: new Array(CUBE_SEATS).fill(null).map(() => []),     // per seat
    pendingPicks: new Array(CUBE_SEATS).fill(null),                   // per seat: card | null
    pools: new Array(CUBE_SEATS).fill(null).map(() => []),            // per seat
    timerRemaining: new Array(CUBE_SEATS).fill(0),                    // per seat: ms
    pickedAtMs: new Array(CUBE_SEATS).fill(null),                     // per seat: ms when they picked
    pickWindowStartedAt: 0,
    timeoutHandle: null,
    botTimeouts: [],                                                  // active bot setTimeout handles
    suspended: false,
    suspendReason: null,
    voteKick: null, // { targetSeat, votes: { [voterSeat]: true } } when active
  };

  cubeDraftOpenRound(room, 0, io);
  cubeDraftBroadcast(room, io);
  cubeDraftScheduleBotPicks(room, db, parseDeck, io);
  cubeDraftScheduleTimeout(room, db, parseDeck, io);
}

function cubeDraftOpenRound(room, round, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  draft.round = round;
  draft.pickInRound = 0;
  draft.direction = round % 2 === 0 ? 'left' : 'right';
  draft.pendingPicks = new Array(CUBE_SEATS).fill(null);
  draft.pickedAtMs = new Array(CUBE_SEATS).fill(null);

  // Each ring position gets one of the 8 packs for this round. The
  // physical seat that owns ring position i is seatOrder[i] — that
  // seat receives packs[round*8 + i].
  for (let ringPos = 0; ringPos < CUBE_SEATS; ringPos++) {
    const seatIdx = draft.seatOrder[ringPos];
    draft.currentPacks[seatIdx] = [...draft.packs[round * CUBE_PACKS_PER_ROUND + ringPos]];
  }

  // Reset per-seat budget at the start of each round. Per the spec:
  // "players start with a per-pack time budget" — round = pack opening.
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    draft.timerRemaining[seatIdx] = (cd.packTimerSec || 60) * 1000;
  }
  draft.pickWindowStartedAt = Date.now();
}

function cubeDraftPlayerView(room, seatIdx) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (!draft) return null;
  return {
    phase: cd.phase,
    seatIdx,
    seatOrder: draft.seatOrder,
    players: room.players.map(p => ({ username: p.username, isBot: !!p.isBot })),
    round: draft.round,
    pickInRound: draft.pickInRound,
    totalPicks: CUBE_ROUNDS * CUBE_PACK_SIZE,
    totalRounds: CUBE_ROUNDS,
    direction: draft.direction,
    myPack: draft.currentPacks[seatIdx] || [],
    myPool: draft.pools[seatIdx] || [],
    myPicked: draft.pendingPicks[seatIdx] != null,
    seatPicked: draft.pendingPicks.map(p => p != null),
    packTimerSec: cd.packTimerSec,
    pickTimerSec: cd.pickTimerSec,
    timerDisabled: !!cd.timerDisabled,
    remainingMs: cd.timerDisabled ? null : cubeDraftSeatRemainingMs(draft, seatIdx),
    suspended: !!draft.suspended,
    suspendReason: draft.suspendReason,
    voteKick: draft.voteKick ? {
      targetSeat: draft.voteKick.targetSeat,
      targetUsername: room.players[draft.voteKick.targetSeat]?.username,
      votes: Object.keys(draft.voteKick.votes).length,
      needed: draft.voteKick.needed,
    } : null,
  };
}

function cubeDraftSpectatorView(room) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (!draft) return null;
  // Spectators see structural state — round, pick number, suspend status —
  // but NEVER pack contents or anyone's pool. Per spec rule #4: "spectators
  // should only see the games themselves, NOT what cards get drafted, to
  // avoid them telling hidden info to participants".
  return {
    phase: cd.phase,
    isSpectator: true,
    seatOrder: draft.seatOrder,
    players: room.players.map(p => ({ username: p.username, isBot: !!p.isBot })),
    round: draft.round,
    pickInRound: draft.pickInRound,
    totalPicks: CUBE_ROUNDS * CUBE_PACK_SIZE,
    totalRounds: CUBE_ROUNDS,
    direction: draft.direction,
    seatPicked: draft.pendingPicks.map(p => p != null),
    suspended: !!draft.suspended,
  };
}

function cubeDraftBroadcast(room, io) {
  const cd = room.cubeDraft;
  if (!cd?.draftState) return;
  for (let seatIdx = 0; seatIdx < room.players.length; seatIdx++) {
    const p = room.players[seatIdx];
    if (p.isBot || !p.socketId) continue;
    io.to(p.socketId).emit('cube_draft_state', cubeDraftPlayerView(room, seatIdx));
  }
  for (const spec of room.spectators) {
    if (spec.socketId) io.to(spec.socketId).emit('cube_draft_state', cubeDraftSpectatorView(room));
  }
}

function cubeDraftScheduleBotPicks(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (!draft || draft.suspended) return;
  // Cancel previous bot pick timers — they get re-scheduled per pick window.
  for (const h of (draft.botTimeouts || [])) clearTimeout(h);
  draft.botTimeouts = [];
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    if (!room.players[seatIdx]?.isBot) continue;
    if (draft.pendingPicks[seatIdx] != null) continue;
    const pack = draft.currentPacks[seatIdx];
    if (!pack || pack.length === 0) continue;
    // Bot picks pure-randomly per the spec — value is intentionally not
    // tied to type/level/cost so humans can't "read" the bot's tendencies.
    const card = pack[Math.floor(Math.random() * pack.length)];
    const delay = BOT_PICK_DELAY_MIN_MS + Math.floor(Math.random() * (BOT_PICK_DELAY_MAX_MS - BOT_PICK_DELAY_MIN_MS));
    const handle = setTimeout(() => {
      cubeDraftHandlePick(room, seatIdx, card, db, parseDeck, io, { fromBot: true });
    }, delay);
    draft.botTimeouts.push(handle);
  }
}

function cubeDraftScheduleTimeout(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (!draft || draft.suspended) return;
  // Host opted to disable the timer — never auto-pick humans on timeout.
  // (Bots still pick on their own short delay; see scheduleBotPicks.)
  if (cd.timerDisabled) {
    if (draft.timeoutHandle) { clearTimeout(draft.timeoutHandle); draft.timeoutHandle = null; }
    return;
  }
  if (draft.timeoutHandle) clearTimeout(draft.timeoutHandle);
  // Find the soonest-expiring human seat that hasn't picked yet.
  let minMs = Infinity;
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    if (room.players[seatIdx]?.isBot) continue;
    if (draft.pendingPicks[seatIdx] != null) continue;
    const remaining = cubeDraftSeatRemainingMs(draft, seatIdx);
    if (remaining < minMs) minMs = remaining;
  }
  if (!Number.isFinite(minMs)) return;
  // Add a small grace buffer so we don't no-op-fire repeatedly on
  // floating-point boundary cases.
  draft.timeoutHandle = setTimeout(() => {
    cubeDraftHandleTimeout(room, db, parseDeck, io);
  }, Math.max(0, minMs) + 25);
}

function cubeDraftHandleTimeout(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (!draft || draft.suspended) return;
  let anyPickedThisCall = false;
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    if (room.players[seatIdx]?.isBot) continue;
    if (draft.pendingPicks[seatIdx] != null) continue;
    const remaining = cubeDraftSeatRemainingMs(draft, seatIdx);
    if (remaining <= 0) {
      const pack = draft.currentPacks[seatIdx];
      if (pack && pack.length > 0) {
        const card = pack[Math.floor(Math.random() * pack.length)];
        draft.pendingPicks[seatIdx] = card;
        draft.pickedAtMs[seatIdx] = Date.now();
        anyPickedThisCall = true;
      }
    }
  }
  if (anyPickedThisCall) {
    cubeDraftCheckAdvance(room, db, parseDeck, io);
  } else {
    cubeDraftScheduleTimeout(room, db, parseDeck, io);
  }
}

function cubeDraftHandlePick(room, seatIdx, cardName, db, parseDeck, io, opts = {}) {
  const cd = room.cubeDraft;
  const draft = cd?.draftState;
  if (!draft || draft.suspended) return;
  if (seatIdx < 0 || seatIdx >= CUBE_SEATS) return;
  const seatPlayer = room.players[seatIdx];
  if (!seatPlayer) return;
  // Bot picks come in via cubeDraftScheduleBotPicks. Reject anything else
  // claiming to pick on a bot's behalf.
  if (seatPlayer.isBot && !opts.fromBot) return;
  if (draft.pendingPicks[seatIdx] != null) return; // already picked
  const pack = draft.currentPacks[seatIdx];
  if (!pack || !pack.includes(cardName)) return;
  draft.pendingPicks[seatIdx] = cardName;
  draft.pickedAtMs[seatIdx] = Date.now();
  cubeDraftCheckAdvance(room, db, parseDeck, io);
}

function cubeDraftCheckAdvance(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (draft.pendingPicks.some(p => p == null)) {
    cubeDraftBroadcast(room, io);
    cubeDraftScheduleTimeout(room, db, parseDeck, io);
    return;
  }
  cubeDraftAdvance(room, db, parseDeck, io);
}

function cubeDraftAdvance(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;

  // Cancel pending timers — we're rolling to the next pick window.
  if (draft.timeoutHandle) { clearTimeout(draft.timeoutHandle); draft.timeoutHandle = null; }
  for (const h of (draft.botTimeouts || [])) clearTimeout(h);
  draft.botTimeouts = [];

  // Apply each pick: remove from pack, add to pool (humans only).
  // Bots discard their picks per spec — they remove a card from the pack
  // but never "keep" it; the card is destroyed for the round. This is
  // why `room.spectators`-side and the pool table only ever grow for
  // human seats. Time-based timeout deductions also happen here.
  const elapsed = Date.now() - draft.pickWindowStartedAt;
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    const card = draft.pendingPicks[seatIdx];
    const pack = draft.currentPacks[seatIdx];
    if (card && pack) {
      const idx = pack.indexOf(card);
      if (idx >= 0) pack.splice(idx, 1);
      if (!room.players[seatIdx].isBot) draft.pools[seatIdx].push(card);
    }
    // Deduct elapsed-since-window-start from the seat's pack budget.
    // Picks made earlier in the window deduct based on their own
    // pickedAtMs; otherwise we use the full window length.
    const pickedAt = draft.pickedAtMs[seatIdx];
    const burned = pickedAt != null ? (pickedAt - draft.pickWindowStartedAt) : elapsed;
    draft.timerRemaining[seatIdx] = Math.max(0, draft.timerRemaining[seatIdx] - burned);
    // Per-pick bonus, awarded after the deduction.
    draft.timerRemaining[seatIdx] += (cd.pickTimerSec || 0) * 1000;
  }

  // Pass packs along the snake direction. Pack at ring position i
  // moves to ring position (i±1) % 8 depending on direction.
  const newPacks = new Array(CUBE_SEATS).fill(null).map(() => []);
  for (let ringPos = 0; ringPos < CUBE_SEATS; ringPos++) {
    const fromSeat = draft.seatOrder[ringPos];
    const toRingPos = draft.direction === 'left'
      ? (ringPos + 1) % CUBE_SEATS
      : (ringPos - 1 + CUBE_SEATS) % CUBE_SEATS;
    const toSeat = draft.seatOrder[toRingPos];
    newPacks[toSeat] = draft.currentPacks[fromSeat];
  }
  draft.currentPacks = newPacks;

  draft.pickInRound++;
  draft.pendingPicks = new Array(CUBE_SEATS).fill(null);
  draft.pickedAtMs = new Array(CUBE_SEATS).fill(null);
  draft.pickWindowStartedAt = Date.now();

  if (draft.pickInRound >= CUBE_PACK_SIZE) {
    // Round done. Open next round if any.
    const nextRound = draft.round + 1;
    if (nextRound >= CUBE_ROUNDS) {
      cubeDraftFinalize(room, io);
      return;
    }
    cubeDraftOpenRound(room, nextRound, io);
  }

  cubeDraftBroadcast(room, io);
  cubeDraftScheduleBotPicks(room, db, parseDeck, io);
  cubeDraftScheduleTimeout(room, db, parseDeck, io);
}

function cubeDraftFinalize(room, io) {
  const cd = room.cubeDraft;
  const draft = cd.draftState;
  if (draft.timeoutHandle) clearTimeout(draft.timeoutHandle);
  for (const h of (draft.botTimeouts || [])) clearTimeout(h);
  draft.timeoutHandle = null;
  draft.botTimeouts = [];

  // ── Hero assignment rule ──
  // Per spec: "If a player drafted NO Heroes, they get one random Hero
  // that is NOT in the cube list assigned to them, if possible. If no
  // such Hero exists, use a random Hero from within the Cube list
  // instead." Bots are skipped (they don't build decks).
  const cardDB = getCardDB();
  const cubeCardSet = new Set(cd.cubeCards || []);
  const allHeroNames = Object.keys(cardDB).filter(n => cardDB[n]?.cardType === 'Hero');
  const nonCubeHeroes = allHeroNames.filter(n => !cubeCardSet.has(n));
  const cubeHeroes = allHeroNames.filter(n => cubeCardSet.has(n));
  cd.assignedHeroes = {}; // seatIdx → heroName (read by build screen + final standings)

  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    const player = room.players[seatIdx];
    if (!player || player.isBot) continue;
    const pool = draft.pools[seatIdx];
    const hasHero = pool.some(name => cardDB[name]?.cardType === 'Hero');
    if (!hasHero) {
      const source = nonCubeHeroes.length > 0 ? nonCubeHeroes : cubeHeroes;
      if (source.length === 0) continue; // no heroes anywhere — give up
      const assigned = source[Math.floor(Math.random() * source.length)];
      pool.push(assigned);
      cd.assignedHeroes[seatIdx] = assigned;
      console.log(`[cube_draft] seat ${seatIdx} (${player.username}) drafted 0 heroes — assigned ${assigned}`);
    }
  }

  cd.phase = 'building';
  // Persist drafted pools to the room so the deck-builder phase (M3)
  // can read them. Bots end up with empty pools — they're skipped in
  // the deck-build round and the tournament bracket too.
  cd.draftedPools = draft.pools.map((pool, seatIdx) => ({
    seatIdx,
    username: room.players[seatIdx]?.username || `Seat ${seatIdx}`,
    isBot: !!room.players[seatIdx]?.isBot,
    pool,
  }));
  // Initialize the build-phase "ready" tracker. Each human seat must
  // submit a deck before the room can advance to the tournament phase.
  cd.builtDecks = {}; // seatIdx → { name, heroes, mainDeck, sideDeck }
  cd.readySeats = {}; // seatIdx → true once that seat clicks Ready
  cubeDraftBroadcast(room, io);
  cubeBuildBroadcast(room, io);
  io.to('room:' + room.id).emit('room_update', sanitizeRoom(room));
  console.log(`[cube_draft] room ${room.id} draft complete — entering build phase`);
}

function cubeDraftSuspend(room, reason, io) {
  const cd = room.cubeDraft;
  const draft = cd?.draftState;
  if (!draft) return;
  draft.suspended = true;
  draft.suspendReason = reason;
  if (draft.timeoutHandle) { clearTimeout(draft.timeoutHandle); draft.timeoutHandle = null; }
  for (const h of (draft.botTimeouts || [])) clearTimeout(h);
  draft.botTimeouts = [];
  // Snapshot pickWindowStartedAt as the resume-point — when we unfreeze,
  // we'll shift pickWindowStartedAt by the suspended duration so the
  // remaining-budget calc resumes where it left off.
  draft.suspendedAt = Date.now();
  cubeDraftBroadcast(room, io);
}

function cubeDraftResume(room, db, parseDeck, io) {
  const cd = room.cubeDraft;
  const draft = cd?.draftState;
  if (!draft || !draft.suspended) return;
  const suspendDur = Date.now() - (draft.suspendedAt || Date.now());
  draft.pickWindowStartedAt += suspendDur;
  for (let seatIdx = 0; seatIdx < CUBE_SEATS; seatIdx++) {
    if (draft.pickedAtMs[seatIdx] != null) draft.pickedAtMs[seatIdx] += suspendDur;
  }
  draft.suspended = false;
  draft.suspendReason = null;
  draft.suspendedAt = null;
  cubeDraftBroadcast(room, io);
  cubeDraftScheduleBotPicks(room, db, parseDeck, io);
  cubeDraftScheduleTimeout(room, db, parseDeck, io);
}

// ═══════════════════════════════════════════
//  CUBE DRAFT — BUILD PHASE
// ═══════════════════════════════════════════

function cubeBuildBroadcast(room, io) {
  const cd = room.cubeDraft;
  if (!cd || cd.phase !== 'building') return;
  const humanCount = room.players.filter(p => !p.isBot).length;
  const readyCount = Object.keys(cd.readySeats || {}).filter(k => cd.readySeats[k]).length;
  const humanSeats = room.players.map((p, i) => ({
    seatIdx: i,
    username: p.username,
    isBot: !!p.isBot,
    ready: !!cd.readySeats?.[i],
  }));

  for (let seatIdx = 0; seatIdx < room.players.length; seatIdx++) {
    const p = room.players[seatIdx];
    if (p.isBot || !p.socketId) continue;
    const pool = cd.draftedPools?.[seatIdx]?.pool || [];
    io.to(p.socketId).emit('cube_build_state', {
      phase: cd.phase,
      seatIdx,
      pool,
      assignedHero: cd.assignedHeroes?.[seatIdx] || null,
      cubeName: cd.cubeName,
      submittedDeck: cd.builtDecks?.[seatIdx] || null,
      ready: !!cd.readySeats?.[seatIdx],
      autoFilled: !!cd.autoFilledSeats?.[seatIdx],
      readyCount,
      humanCount,
      humanSeats,
      buildTimerEndsAt: cd.buildTimerEndsAt || null,
      buildTimerTotalMs: CUBE_BUILD_TIMER_MS,
    });
  }
  for (const spec of room.spectators) {
    if (!spec.socketId) continue;
    io.to(spec.socketId).emit('cube_build_state', {
      phase: cd.phase,
      isSpectator: true,
      cubeName: cd.cubeName,
      readyCount,
      humanCount,
      humanSeats,
      buildTimerEndsAt: cd.buildTimerEndsAt || null,
      buildTimerTotalMs: CUBE_BUILD_TIMER_MS,
    });
  }
}

/** Validate a player-submitted deck against their drafted pool.
 *  Returns { ok: true } or { ok: false, reason }. Rules:
 *   • Hero count must equal min(3, heroesInPool). The "fewer than 3 if
 *     drafted fewer than 3" carve-out is enforced via this min.
 *   • Each Hero / non-Performance Ability / other card consumed by the
 *     deck must be available either in the pool (counted) or via the
 *     infinite-Ability allowance.
 *   • mainDeck size must equal 60 (standard cap). potionDeck stays
 *     0/5-15 (re-using existing rules). sideDeck up to 15.
 */
function validateDraftedDeck(deck, pool, cardDB) {
  if (!deck || typeof deck !== 'object') return { ok: false, reason: 'No deck' };
  const heroes = Array.isArray(deck.heroes) ? deck.heroes : [];
  const mainDeck = Array.isArray(deck.mainDeck) ? deck.mainDeck : [];
  const potionDeck = Array.isArray(deck.potionDeck) ? deck.potionDeck : [];
  const sideDeck = Array.isArray(deck.sideDeck) ? deck.sideDeck : [];

  // Pool counts (every drafted card available by name, plus any
  // assigned hero pushed in by cubeDraftFinalize).
  const poolCounts = {};
  for (const name of pool) poolCounts[name] = (poolCounts[name] || 0) + 1;

  // Heroes-in-pool = heroes drafted (incl. assigned).
  const heroesInPool = pool.filter(n => cardDB[n]?.cardType === 'Hero').length;
  const requiredHeroes = Math.min(3, heroesInPool);
  const filledHeroes = heroes.filter(h => h && h.hero).length;
  if (filledHeroes !== requiredHeroes) {
    return { ok: false, reason: `Need ${requiredHeroes} hero${requiredHeroes === 1 ? '' : 'es'} (you have ${filledHeroes})` };
  }

  // Main deck size — keep standard 60.
  if (mainDeck.length !== 60) {
    return { ok: false, reason: `Main deck must be exactly 60 cards (currently ${mainDeck.length})` };
  }

  // Tally usage against the pool.
  const used = {};
  for (const h of heroes) {
    if (h?.hero) used[h.hero] = (used[h.hero] || 0) + 1;
  }
  for (const n of mainDeck) used[n] = (used[n] || 0) + 1;
  for (const n of potionDeck) used[n] = (used[n] || 0) + 1;
  for (const n of sideDeck) used[n] = (used[n] || 0) + 1;

  for (const [name, count] of Object.entries(used)) {
    const cd = cardDB[name];
    if (!cd) return { ok: false, reason: `Unknown card "${name}"` };
    // Non-Performance Abilities are infinite (drafted pool isn't required).
    if (cd.cardType === 'Ability' && name !== 'Performance') continue;
    const available = poolCounts[name] || 0;
    if (count > available) {
      return { ok: false, reason: `Not enough "${name}" in pool (have ${available}, used ${count})` };
    }
  }

  // Ability abilities under each hero must be the correct ability slots
  // for that hero (matching its startingAbility1 / 2). Enforced loosely —
  // if the player overrides them with valid abilities, accept; the
  // engine's deck-builder normally fills the slots automatically.
  // Skipped here for simplicity.

  return { ok: true };
}

/** Transitions from the build phase to the tournament phase. */
function cubeStartTournament(room, io) {
  const cd = room.cubeDraft;
  if (!cd) return;
  cd.phase = 'tournament';
  cubeTournamentBuild(room, io);
}

// ═══════════════════════════════════════════
//  CUBE DRAFT — TOURNAMENT
// ═══════════════════════════════════════════

const CUBE_ELO_RANDOM_GAP = 50; // see spec: random within ±50 ELO gap

function cubeNextPowerOf2(n) {
  if (n < 2) return 2;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Bracket builder. Seeds by Cube ELO if game is ranked; otherwise
 *  random. Within ±50 ELO of each other, players are shuffled (no
 *  seed advantage). Byes are placed at RANDOM positions even on
 *  seeded brackets — per spec, top seeds shouldn't always inherit
 *  byes. Returns { matches, bracketSize, positions, allRoundMatches }. */
async function cubeBuildSeededBracket(room) {
  const cd = room.cubeDraft;
  const isRanked = room.type === 'ranked';
  const humanSeats = room.players
    .map((p, i) => ({ seat: i, player: p }))
    .filter(e => !e.player.isBot && cd.builtDecks?.[e.seat]);

  let seedList;
  if (isRanked) {
    // Fetch cube ELO for each human seat.
    const elos = {};
    for (const e of humanSeats) {
      try {
        const u = await db.get('SELECT elo_cube FROM users WHERE id = ?', [e.player.userId]);
        elos[e.seat] = u?.elo_cube ?? 1000;
      } catch { elos[e.seat] = 1000; }
    }
    // Sort by elo desc.
    seedList = [...humanSeats].sort((a, b) => (elos[b.seat] || 1000) - (elos[a.seat] || 1000));
    // Within ±50 ELO clusters, shuffle. Walk seedList, group consecutive
    // entries whose elo gap to the leader is ≤ 50, shuffle each group.
    const grouped = [];
    let i = 0;
    while (i < seedList.length) {
      const leadElo = elos[seedList[i].seat];
      let j = i;
      while (j < seedList.length && Math.abs(elos[seedList[j].seat] - leadElo) <= CUBE_ELO_RANDOM_GAP) j++;
      const group = seedList.slice(i, j);
      cubeShuffleInPlace(group);
      grouped.push(...group);
      i = j;
    }
    seedList = grouped;
  } else {
    seedList = cubeShuffle(humanSeats);
  }

  const N = seedList.length;
  const bracketSize = cubeNextPowerOf2(N);
  const numByes = bracketSize - N;

  // Random bye placement: pick random positions out of bracketSize.
  const allSlotIdxs = Array.from({ length: bracketSize }, (_, i) => i);
  cubeShuffleInPlace(allSlotIdxs);
  const byeSlots = new Set(allSlotIdxs.slice(0, numByes));
  // Remaining positions in ascending order — seeded players fill them
  // in seed-list order so the bracket itself preserves seeding around
  // the random bye holes.
  const playerSlots = allSlotIdxs.slice(numByes).sort((a, b) => a - b);

  const positions = new Array(bracketSize).fill(null);
  for (let i = 0; i < seedList.length; i++) {
    positions[playerSlots[i]] = seedList[i].seat;
  }

  // Round 0 matches: pair positions [0,1], [2,3], etc.
  const matches = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const a = positions[i], b = positions[i + 1];
    matches.push({
      matchIdx: i / 2,
      p1Seat: a, // null = bye
      p2Seat: b,
      winnerSeat: null,
      loserSeat: null,
      childRoomId: null,
      bo: cd.prelimsBo,
      // Auto-resolve byes: if either side is null, the other advances.
      resolved: a == null || b == null,
    });
    // Pre-resolve byes
    if (a == null && b != null) matches[matches.length - 1].winnerSeat = b;
    if (b == null && a != null) matches[matches.length - 1].winnerSeat = a;
  }

  return {
    bracketSize,
    positions,
    rounds: [matches],
    currentRoundIdx: 0,
  };
}

function cubeShuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

async function cubeTournamentBuild(room, io) {
  const cd = room.cubeDraft;
  if (!cd) return;
  const bracket = await cubeBuildSeededBracket(room);
  cd.bracket = bracket;
  // Standings: seat → final placement (1=winner, 2=runner-up, etc.).
  // Filled in as players are eliminated.
  cd.standings = {};
  cubeTournamentBroadcast(room, io);
  // Auto-advance any rounds that resolved entirely via byes (rare —
  // typically only relevant if exactly 1 human registers, but we never
  // start with <2 so it's defensive).
  await cubeTournamentAdvanceIfReady(room, io);
  cubeTournamentStartCurrentRound(room, io);
}

function cubeTournamentBroadcast(room, io) {
  const cd = room.cubeDraft;
  if (!cd?.bracket) return;
  const view = {
    phase: cd.phase,
    cubeName: cd.cubeName,
    flow: cd.flow,
    prelimsBo: cd.prelimsBo,
    finaleBo: cd.finaleBo,
    bracketSize: cd.bracket.bracketSize,
    rounds: cd.bracket.rounds.map(round => round.map(m => ({
      matchIdx: m.matchIdx,
      p1Seat: m.p1Seat,
      p2Seat: m.p2Seat,
      p1Username: m.p1Seat != null ? room.players[m.p1Seat]?.username : null,
      p2Username: m.p2Seat != null ? room.players[m.p2Seat]?.username : null,
      winnerSeat: m.winnerSeat,
      childRoomId: m.childRoomId,
      bo: m.bo,
      resolved: m.resolved,
      live: !!m.childRoomId && rooms.get(m.childRoomId)?.status === 'playing',
    }))),
    currentRoundIdx: cd.bracket.currentRoundIdx,
    standings: cd.standings || {},
    players: room.players.map(p => ({ username: p.username, isBot: !!p.isBot })),
    complete: !!cd.tournamentComplete,
    finalStandings: cd.finalStandings || null,
  };
  // Per-recipient: include the active child room they should be
  // playing/spectating, if any. Players in their match's child room
  // play; everyone else gets a list of active child rooms they can
  // tab between as spectators.
  const allMembers = [...room.players, ...room.spectators];
  for (const member of allMembers) {
    if (!member.socketId) continue;
    const seatIdx = room.players.indexOf(member);
    const myActiveMatch = seatIdx >= 0
      ? cd.bracket.rounds[cd.bracket.currentRoundIdx]?.find(m =>
          (m.p1Seat === seatIdx || m.p2Seat === seatIdx) && m.childRoomId && !m.resolved)
      : null;
    const activeChildRooms = (cd.bracket.rounds[cd.bracket.currentRoundIdx] || [])
      .filter(m => m.childRoomId && !m.resolved)
      .map(m => ({
        matchIdx: m.matchIdx,
        childRoomId: m.childRoomId,
        p1Username: m.p1Seat != null ? room.players[m.p1Seat]?.username : null,
        p2Username: m.p2Seat != null ? room.players[m.p2Seat]?.username : null,
      }));
    io.to(member.socketId).emit('cube_tournament_state', {
      ...view,
      mySeat: seatIdx,
      myActiveChildRoomId: myActiveMatch?.childRoomId || null,
      activeChildRooms,
      isSpectator: seatIdx < 0,
    });
  }
}

function cubeTournamentStartCurrentRound(room, io) {
  const cd = room.cubeDraft;
  if (!cd?.bracket) return;
  const round = cd.bracket.rounds[cd.bracket.currentRoundIdx];
  if (!round) return;
  // Match length: prelimsBo for non-final rounds, finaleBo for the final round.
  const isFinalRound = cd.bracket.currentRoundIdx === Math.log2(cd.bracket.bracketSize) - 1;
  const bo = isFinalRound ? cd.finaleBo : cd.prelimsBo;
  for (const m of round) m.bo = bo;

  if (cd.flow === 'consecutive') {
    // Find the first unresolved match without a child room and start it.
    const next = round.find(m => !m.resolved && !m.childRoomId);
    if (next) cubeStartMatch(room, next, io);
  } else {
    // Simultaneous: start every unresolved match that doesn't have one.
    for (const m of round) {
      if (!m.resolved && !m.childRoomId) cubeStartMatch(room, m, io);
    }
  }
  cubeTournamentBroadcast(room, io);
}

async function cubeStartMatch(room, match, io) {
  const cd = room.cubeDraft;
  if (match.resolved || match.childRoomId) return;
  if (match.p1Seat == null || match.p2Seat == null) {
    // Pure bye — already auto-resolved at bracket build. Defensive.
    match.resolved = true;
    if (match.p1Seat != null) match.winnerSeat = match.p1Seat;
    if (match.p2Seat != null) match.winnerSeat = match.p2Seat;
    return;
  }

  const p1 = room.players[match.p1Seat];
  const p2 = room.players[match.p2Seat];
  if (!p1 || !p2) return;

  // Each seat's saved drafted-deck row was created by cubeSaveDraftedDeck;
  // we re-find it by user_id + cube_draft_meta.roomId so we don't have
  // to thread the new deck ID through state. Match decks are read here
  // and snapshotted onto the child room — exactly the same way the
  // standard 1v1 deck-from-id flow works.
  const findDraftedDeckId = async (userId) => {
    const rows = await db.all('SELECT id, cube_draft_meta FROM decks WHERE user_id = ? AND mode = ? ORDER BY created_at DESC', [userId, 'drafted']);
    for (const r of rows) {
      try {
        const meta = JSON.parse(r.cube_draft_meta || '{}');
        if (meta.roomId === room.id) return r.id;
      } catch {}
    }
    return rows[0]?.id || null; // fallback: most recent drafted deck
  };
  const p1DeckId = await findDraftedDeckId(p1.userId);
  const p2DeckId = await findDraftedDeckId(p2.userId);

  // Spawn a child room running the standard 2-player engine.
  const childRoomId = uuidv4().substring(0, 8);
  const childRoom = {
    id: childRoomId,
    host: p1.username,
    hostId: p1.userId,
    type: room.type, // ranked / unranked carries through
    format: match.bo,
    winsNeeded: Math.ceil(match.bo / 2),
    setScore: [0, 0],
    playerPw: null,
    specPw: null,
    maxPlayers: 2,
    players: [
      { username: p1.username, userId: p1.userId, socketId: p1.socketId, deckId: p1DeckId, isBot: false },
      { username: p2.username, userId: p2.userId, socketId: p2.socketId, deckId: p2DeckId, isBot: false },
    ],
    spectators: [],
    status: 'waiting',
    created: Date.now(),
    gameState: null,
    chatHistory: [],
    privateChatHistory: {},
    // Back-pointer so endGame can route results to the parent.
    parentCubeRoomId: room.id,
    parentCubeMatchIdx: match.matchIdx,
    parentCubeRoundIdx: cd.bracket.currentRoundIdx,
  };
  rooms.set(childRoomId, childRoom);
  match.childRoomId = childRoomId;

  // Move both players into the child room socket-wise. They keep
  // membership in the parent room too — `socket.join` is additive.
  // We deliberately do NOT emit `room_joined` for the child here:
  // the tournament screen's embedded GameBoard renders off `gameState`
  // (delivered via the standard sendGameState path) while the parent
  // room stays as the active `lobby` context for the bracket UI.
  for (const player of [p1, p2]) {
    if (player.socketId) {
      const sock = io.sockets.sockets.get(player.socketId);
      if (sock) sock.join('room:' + childRoomId);
      // Track the child room ID on the player so the client knows which
      // game it's in.
      io.to(player.socketId).emit('cube_match_assigned', {
        parentRoomId: room.id,
        childRoomId,
        opponent: player.username === p1.username ? p2.username : p1.username,
        bo: match.bo,
      });
    }
  }

  // Kick off the standard game engine.
  const activePlayer = Math.random() < 0.5 ? 0 : 1;
  try {
    await setupGameState(childRoom);
    await startGameEngine(childRoom, childRoomId, activePlayer);
  } catch (err) {
    console.error('[cubeStartMatch] engine error:', err.message);
    // Fallback: give the win to p1 so the bracket can advance.
    await cubeMatchEnd(room, match, match.p1Seat, io);
    return;
  }

  console.log(`[cube_tournament] room ${room.id} round ${cd.bracket.currentRoundIdx} match ${match.matchIdx} started in child ${childRoomId}: ${p1.username} vs ${p2.username} (Bo${match.bo})`);
  cubeTournamentBroadcast(room, io);
}

async function cubeMatchEnd(room, match, winnerSeat, io) {
  const cd = room.cubeDraft;
  if (!cd?.bracket) return;
  if (match.resolved) return;
  match.winnerSeat = winnerSeat;
  match.loserSeat = winnerSeat === match.p1Seat ? match.p2Seat : match.p1Seat;
  match.resolved = true;
  // Tear down the child room. Notify all subscribers first so their
  // GameBoard clears, then socket.leave them out of the child's room
  // channel and drop the room from the registry.
  if (match.childRoomId) {
    const childRoom = rooms.get(match.childRoomId);
    if (childRoom) {
      io.to('room:' + match.childRoomId).emit('cube_match_ended', {
        parentRoomId: room.id,
        childRoomId: match.childRoomId,
        winnerSeat,
        winnerUsername: winnerSeat != null ? room.players[winnerSeat]?.username : null,
      });
      for (const member of [...childRoom.players, ...childRoom.spectators]) {
        if (!member.socketId) continue;
        const sock = io.sockets.sockets.get(member.socketId);
        if (sock) sock.leave('room:' + match.childRoomId);
      }
      destroyRoom(match.childRoomId);
    }
  }
  // Eliminated player gets a placement (filled in reverse — losers in
  // round X share the same placement bucket, e.g. 5-8 in round-of-16).
  const round = cd.bracket.rounds[cd.bracket.currentRoundIdx];
  const eliminatedThisRound = round.filter(m => m.resolved && m.loserSeat != null).map(m => m.loserSeat);
  // Placement = 1 + bracketSize - (number of round-end survivors)
  // For final round, placement = 2 (runner-up).
  // Simpler: assign placement = 2^(rounds - currentRoundIdx) + 1.
  const totalRounds = Math.log2(cd.bracket.bracketSize);
  const isFinalRound = cd.bracket.currentRoundIdx === totalRounds - 1;
  if (match.loserSeat != null) {
    cd.standings[match.loserSeat] = isFinalRound ? 2 : Math.pow(2, totalRounds - cd.bracket.currentRoundIdx) + 1;
  }

  cubeTournamentBroadcast(room, io);
  await cubeTournamentAdvanceIfReady(room, io);

  // Consecutive flow: when one match ends, start the next in the round.
  if (cd.flow === 'consecutive' && cd.phase === 'tournament') {
    const r = cd.bracket.rounds[cd.bracket.currentRoundIdx];
    const next = r?.find(m => !m.resolved && !m.childRoomId);
    if (next) cubeStartMatch(room, next, io);
  }
}

async function cubeTournamentAdvanceIfReady(room, io) {
  const cd = room.cubeDraft;
  if (!cd?.bracket) return;
  const round = cd.bracket.rounds[cd.bracket.currentRoundIdx];
  if (!round) return;
  if (round.some(m => !m.resolved)) return; // not done yet

  // Round done. Build next round from winners — paired sequentially.
  const winners = round.map(m => m.winnerSeat);
  if (winners.length === 1) {
    // Tournament complete.
    cd.standings[winners[0]] = 1; // 1st place
    cd.tournamentComplete = true;
    cubeFinalizeTournament(room, io);
    return;
  }
  const nextRoundMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i], b = winners[i + 1];
    nextRoundMatches.push({
      matchIdx: i / 2,
      p1Seat: a, p2Seat: b,
      winnerSeat: null, loserSeat: null,
      childRoomId: null,
      bo: cd.prelimsBo, // reset by cubeTournamentStartCurrentRound based on round index
      resolved: a == null || b == null,
    });
    if (a == null && b != null) nextRoundMatches[nextRoundMatches.length - 1].winnerSeat = b;
    if (b == null && a != null) nextRoundMatches[nextRoundMatches.length - 1].winnerSeat = a;
  }
  cd.bracket.rounds.push(nextRoundMatches);
  cd.bracket.currentRoundIdx++;
  cubeTournamentStartCurrentRound(room, io);
}

async function cubeFinalizeTournament(room, io) {
  const cd = room.cubeDraft;
  // Build final standings list ordered by placement asc (1st, 2nd, ...).
  // Includes everyone who built a deck (humans only).
  const standings = [];
  const humansBuilt = room.players
    .map((p, i) => ({ seat: i, player: p }))
    .filter(e => !e.player.isBot && cd.builtDecks?.[e.seat]);
  for (const e of humansBuilt) {
    standings.push({
      seat: e.seat,
      username: e.player.username,
      placement: cd.standings[e.seat] || 99,
      heroes: (cd.builtDecks[e.seat]?.heroes || []).filter(h => h?.hero).map(h => h.hero),
    });
  }
  standings.sort((a, b) => a.placement - b.placement);
  cd.finalStandings = standings;

  // SC + ELO payouts.
  const humanCount = humansBuilt.length;
  const isRanked = room.type === 'ranked';
  for (const s of standings) {
    const player = room.players[s.seat];
    let scAward = 0;
    if (s.placement === 1) scAward = 5 * humanCount;
    else if (s.placement === 2 && humanCount >= 3) scAward = 2 * humanCount;
    if (scAward > 0) {
      try {
        await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [scAward, player.userId]);
        if (player.socketId) io.to(player.socketId).emit('cube_sc_award', { amount: scAward, placement: s.placement });
      } catch (err) { console.error('[cubeFinalize] SC error:', err.message); }
    }
    // Cube ELO update (ranked only): simple K-factor based on placement.
    // Higher placement = bigger gain; lowest = biggest loss.
    if (isRanked) {
      // Placement 1 → +K, 2 → +K/2, etc. Last → -K.
      const K = 24;
      const norm = (humanCount - s.placement) / Math.max(1, humanCount - 1); // 1.0 for 1st, 0.0 for last
      let delta = Math.round(K * (norm - 0.5) * 2); // -K..+K range
      // Vote-kicked players take a flat -K loss regardless of placement.
      if (player.cubeKickLoss) delta = -K;
      try {
        await db.run('UPDATE users SET elo_cube = MAX(0, elo_cube + ?) WHERE id = ?', [delta, player.userId]);
        if (player.socketId) io.to(player.socketId).emit('cube_elo_update', { delta, placement: s.placement });
      } catch (err) { console.error('[cubeFinalize] ELO error:', err.message); }
    }
  }
  cubeTournamentBroadcast(room, io);
  console.log(`[cube_tournament] room ${room.id} complete — winner ${standings[0]?.username}`);
}

/** Auto-build a legal-ish deck from a player's drafted pool. Used by
 *  the build-phase 5-minute auto-ready timer. Picks min(3, heroes-in-
 *  pool) random heroes, then fills 60 main-deck slots with random
 *  drafted cards respecting standard copy limits + the no-Potions-
 *  without-Nicolas rule. Falls back to free non-Performance abilities
 *  if the drafted pool runs out. */
function cubeAutoBuildDeck(pool, cardDB, deckName) {
  const heroes = [
    { hero: null, ability1: null, ability2: null },
    { hero: null, ability1: null, ability2: null },
    { hero: null, ability1: null, ability2: null },
  ];
  const heroNames = pool.filter(n => cardDB[n]?.cardType === 'Hero');
  const reqHeroes = Math.min(3, heroNames.length);
  const shuffledHeroes = cubeShuffle(heroNames);
  const usedHeroNames = new Set();
  let placed = 0;
  for (const name of shuffledHeroes) {
    if (placed >= reqHeroes) break;
    if (usedHeroNames.has(name)) continue;
    usedHeroNames.add(name);
    const cd = cardDB[name];
    heroes[placed] = {
      hero: name,
      ability1: cd?.startingAbility1 || null,
      ability2: cd?.startingAbility2 || null,
    };
    placed++;
  }

  const hasNicolas = heroes.some(h => h.hero === 'Nicolas, the Hidden Alchemist');

  // Pool counts net of heroes-in-slots.
  const counts = {};
  for (const n of pool) counts[n] = (counts[n] || 0) + 1;
  for (const h of heroes) {
    if (h.hero) counts[h.hero] = (counts[h.hero] || 0) - 1;
  }
  const remaining = [];
  for (const [name, c] of Object.entries(counts)) {
    for (let i = 0; i < c; i++) remaining.push(name);
  }
  cubeShuffleInPlace(remaining);

  const mainDeck = [];
  const usedMain = {};
  for (const name of remaining) {
    if (mainDeck.length >= 60) break;
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType === 'Token') continue;
    if (cd.cardType === 'Potion' && !hasNicolas) continue; // no Nicolas → no main-deck Potions
    // Effective copy limit (mirrors getCardMax in app-shared.jsx, simplified).
    let limit;
    // Kartentext schlaegt jede Typregel — Gegenstueck zu
    // UNLIMITED_COPY_CARDS in app-shared.jsx. Beide Listen muessen
    // zusammenpassen, sonst baut der Generator andere Decks als der
    // Deckbuilder erlaubt.
    if (UNLIMITED_COPY_CARDS.has(name)) limit = Infinity;
    else if (cd.maxCopies != null) limit = cd.maxCopies;
    else if (cd.cardType === 'Hero') limit = 4;
    else if (cd.cardType === 'Potion') limit = 2;
    else if (cd.cardType === 'Ability') limit = Infinity;
    else limit = 4;
    if ((usedMain[name] || 0) >= limit) continue;
    mainDeck.push(name);
    usedMain[name] = (usedMain[name] || 0) + 1;
  }

  // Top up with free non-Performance abilities (infinite supply).
  if (mainDeck.length < 60) {
    const freeAbilities = Object.keys(cardDB).filter(n =>
      cardDB[n].cardType === 'Ability' && n !== 'Performance'
    );
    if (freeAbilities.length > 0) {
      while (mainDeck.length < 60) {
        mainDeck.push(freeAbilities[Math.floor(Math.random() * freeAbilities.length)]);
      }
    }
  }

  return { name: deckName, heroes, mainDeck, potionDeck: [], sideDeck: [] };
}

const CUBE_BUILD_TIMER_MS = 5 * 60 * 1000; // 5 minutes once the first player Readies

/** Auto-fill any non-ready human seats with a random legal deck and
 *  flip them to Ready. Called when the build-phase timer expires. */
async function cubeBuildAutoFillNonReady(room, io) {
  const cd = room.cubeDraft;
  if (!cd || cd.phase !== 'building') return;
  const cardDB = getCardDB();
  cd.buildTimerHandle = null;
  let anyAutoFilled = false;
  for (let seatIdx = 0; seatIdx < room.players.length; seatIdx++) {
    const p = room.players[seatIdx];
    if (!p || p.isBot) continue;
    if (cd.readySeats?.[seatIdx]) continue;
    const pool = cd.draftedPools?.[seatIdx]?.pool || [];
    const deckName = `${p.username}'s ${cd.cubeName} Draft (auto)`;
    const deck = cubeAutoBuildDeck(pool, cardDB, deckName);
    try {
      await cubeSaveDraftedDeck(p.userId, deck, cd.cubeName, room.id);
    } catch (err) {
      console.error('[cubeBuildAutoFillNonReady] save error:', err.message);
      continue;
    }
    cd.builtDecks[seatIdx] = deck;
    cd.readySeats[seatIdx] = true;
    cd.autoFilledSeats = cd.autoFilledSeats || {};
    cd.autoFilledSeats[seatIdx] = true;
    anyAutoFilled = true;
    console.log(`[cube_build] auto-filled deck for seat ${seatIdx} (${p.username})`);
  }
  cubeBuildBroadcast(room, io);
  // Advance to tournament now that everyone has a deck.
  if (anyAutoFilled || room.players.every((p, i) => p.isBot || cd.readySeats[i])) {
    cubeStartTournament(room, io);
  }
}

/** Save a finalized cube-drafted deck to the player's deck list. */
async function cubeSaveDraftedDeck(userId, deck, cubeName, roomId) {
  const newId = uuidv4();
  const meta = JSON.stringify({ cubeName, draftedAt: new Date().toISOString(), roomId });
  await db.run(
    "INSERT INTO decks (id, user_id, name, main_deck, heroes, potion_deck, side_deck, is_default, cover_card, skins, mode, cube_draft_meta, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', '{}', 'drafted', ?, unixepoch(), unixepoch())",
    [newId, userId, deck.name || `Drafted Deck`,
     JSON.stringify(deck.mainDeck || []),
     JSON.stringify(deck.heroes || []),
     JSON.stringify(deck.potionDeck || []),
     JSON.stringify(deck.sideDeck || []),
     meta]
  );
  return newId;
}

/** Set up fresh game state: decks, hands, heroes — but don't start the engine or turns. */
async function setupGameState(room) {
  const cardsByName = getCardDB();
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };

  const playerStates = [];
  for (let idx = 0; idx < room.players.length; idx++) {
    const p = room.players[idx];
    let deck = null;

    // Use side-decked override if available (subsequent games in a set)
    if (room._currentDecks && room._currentDecks[idx]) {
      deck = room._currentDecks[idx];
    } else {
      // Check if the selected deck is a sample deck (starter or owned structure).
      if (p.deckId && p.deckId.startsWith('sample-')) {
        const samples = loadSampleDecks();
        const pick = samples.find(s => s.id === p.deckId) || null;
        if (pick && pick.isStructure) {
          // Verify ownership — a structure deck can only be used if unlocked.
          const owned = await db.get(
            "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
            [p.userId, pick.structureId]
          );
          if (owned) deck = pick;
        } else {
          deck = pick;
        }
      }

      if (!deck) {
        let deckRow = p.deckId ? await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [p.deckId, p.userId]) : null;
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? AND is_default = 1', [p.userId]);
        if (!deckRow) deckRow = await db.get('SELECT * FROM decks WHERE user_id = ? ORDER BY created_at LIMIT 1', [p.userId]);
        deck = deckRow ? parseDeck(deckRow) : null;
      }

      // User has a pinned sample/structure default deck but no custom deck —
      // use that pinned one (re-verifying ownership for structures).
      if (!deck) {
        const userRow = await db.get('SELECT default_sample_deck_id FROM users WHERE id = ?', [p.userId]);
        const pinnedId = userRow?.default_sample_deck_id;
        if (pinnedId) {
          const samples = loadSampleDecks();
          const pick = samples.find(s => s.id === pinnedId) || null;
          if (pick && pick.isStructure) {
            const owned = await db.get(
              "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
              [p.userId, pick.structureId]
            );
            if (owned) deck = pick;
          } else if (pick) {
            deck = pick;
          }
        }
      }

      if (!deck || (!deck.mainDeck.length && !deck.heroes.some(h => h.hero))) {
        // New-account fallback uses only STARTER decks (structure decks stay
        // locked until purchased).
        const starters = loadSampleDecks().filter(s => !s.isStructure);
        if (starters.length > 0) {
          const hash = [...p.userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
          deck = starters[Math.abs(hash) % starters.length];
        }
      }

      // Save original deck state at match start (for side-deck reset)
      if (!room._originalDecks) room._originalDecks = [{}, {}];
      room._originalDecks[idx] = JSON.parse(JSON.stringify({
        mainDeck: deck?.mainDeck || [], heroes: deck?.heroes || [],
        potionDeck: deck?.potionDeck || [], sideDeck: deck?.sideDeck || [],
        skins: deck?.skins || {},
      }));
      if (!room._currentDecks) room._currentDecks = [null, null];
      room._currentDecks[idx] = JSON.parse(JSON.stringify(room._originalDecks[idx]));
    }

    const usr = await db.get('SELECT * FROM users WHERE id = ?', [p.userId]);
    // Win/loss speech-bubble lines: a human uses their own profile messages;
    // a CPU (no user record) draws from the per-opponent CPU_MESSAGES table.
    const cpuMsgs = usr ? null : getCpuMessages(p.deckId);
    const victoryMsg = usr ? (usr.victory_msg || '') : cpuMsgs.victory;
    const defeatMsg = usr ? (usr.defeat_msg || '') : cpuMsgs.defeat;
    // CPU-only mid-game barks: general "a Hero was killed" + a higher-priority
    // line for when the CPU's MIDDLE Hero (its avatar) is the one killed.
    const heroKilledMsg = usr ? '' : cpuMsgs.heroKilled;
    const middleHeroKilledMsg = usr ? '' : cpuMsgs.middleHeroKilled;
    const greetingMsg = usr ? '' : cpuMsgs.greeting;
    // Pro Gegner: sollen ALLE Buchstaben leicht wackeln (Waflav)?
    const barkBounce = usr ? false : !!cpuMsgs.bounce;
    const heroes = (deck?.heroes||[]).map(h => {
      const c = h.hero ? cardsByName[h.hero] : null;
      return { name:h.hero, hp:c?.hp||0, maxHp:c?.hp||0, atk:c?.atk||0, baseAtk:c?.atk||0, ability1:h.ability1||null, ability2:h.ability2||null, statuses:{} };
    });
    const abilityZones = heroes.map(h => {
      const z=[[],[],[]];
      if(h.ability1&&h.ability2&&h.ability1===h.ability2){z[1]=[h.ability1,h.ability2];}
      else if(h.ability1&&!h.ability2){z[1]=[h.ability1];}
      else if(!h.ability1&&h.ability2){z[1]=[h.ability2];}
      else{if(h.ability1)z[0]=[h.ability1];if(h.ability2)z[1]=[h.ability2];}
      return z;
    });
    const mainDeck = shuffle(deck?.mainDeck||[]);
    const potionDeck = shuffle(deck?.potionDeck||[]);
    // Side Deck snapshot at game start. The pre-game side-deck phase has
    // already finalized swaps (room._currentDecks reflects post-swap state),
    // so the remaining names are the truly out-of-game pool. Effects like
    // Divine Gift of Edge consume names directly from this list.
    const sideDeck = (room._currentDecks?.[idx]?.sideDeck || []).slice();
    playerStates.push({ userId:p.userId, username:(usr?.username||p.username), socketId:p.socketId,
      color:usr?.color||'#00f0ff', avatar:usr?.avatar||null, cardback:usr?.cardback||null, board:usr?.board||null,
      victoryMsg, defeatMsg, heroKilledMsg, middleHeroKilledMsg, greetingMsg, barkBounce,
      heroes, abilityZones, surpriseZones:[[],[],[]], supportZones:[[[],[],[]],[[],[],[]],[[],[],[]]],
      // Top-first list of card names that are publicly known to be on
      // top of `mainDeck` (Premonition's face-down stash, future similar
      // effects). Index 0 = drawn next. Maintained alongside `mainDeck`
      // shifts (drawn cards drop the front entry) and shuffles (cleared).
      // Sent to BOTH players and rendered semi-transparently on the
      // deck pile. A defensive prefix-match validation runs at state-
      // send time so any unhandled mutation just degrades visibility
      // instead of leaking a stale name.
      deckTopVisible: [],
      hand:[], mainDeck, potionDeck, sideDeck, discardPile:[], deletedPile:[], disconnected:false, left:false, gold:0,
      abilityGivenThisTurn:[false,false,false], islandZoneCount:[0,0,0],
      damageLocked:false, itemLocked:false, dealtDamageToOpponent:false, potionLocked:false, potionsUsedThisTurn:0,
      permanents:[], coolnessStack:[], _oncePerGameUsed: new Set(), _resolvingCard: null, deckSkins: deck?.skins || {} });
  }
  room.gameState = { players:playerStates, areaZones:[[],[]], turn:0, activePlayer:0, currentPhase:0, result:null, rematchRequests:[], awaitingFirstChoice:true,
    _gameStartTime: Date.now(),
    _playerIPs: room.players.map(p => {
      const sock = io.sockets.sockets.get(p.socketId);
      return sock ? getSocketIP(sock) : 'unknown';
    }),
  };
  room.status = 'playing';
  room.players.forEach(p => activeGames.set(p.userId, room.id));
}

/**
 * Ist die Demo-Aufnahme aktiv? **Standard: JA.**
 *
 * Seit dem Live-Betrieb (Render) sollen ALLE Partien aufgezeichnet
 * werden, damit auch fremde Spieler Daten liefern. Abschalten geht
 * ausdrücklich über `PP_DEMO_RECORD=0` (auch `false`/`off`/`no`).
 *
 * Die frühere Logik war umgekehrt (nur AN bei gesetzter Variable) und
 * akzeptierte die Variable zusätzlich als Prozessargument, weil sie
 * einmal per npm-Argument statt als Env gesetzt worden war — beides
 * bleibt kompatibel.
 */
function demoRecordingEnabled() {
  const raw = process.env.PP_DEMO_RECORD
    ?? (process.argv.find(a => /^PP_DEMO_RECORD=/.test(a)) || '').split('=')[1];
  if (raw == null || raw === '') return true;          // Standard: an
  return !/^(0|false|off|no|nein)$/i.test(String(raw).trim());
}

// HINWEIS (1.8.): Diese Funktion stand zunächst weiter unten — mitten im
// `io.on('connection', …)`-Callback. Damit war sie NUR dort sichtbar; das
// Start-Banner und `startGameEngine` (beide auf Modulebene) liefen in
// `ReferenceError: demoRecordingEnabled is not defined`, sichtbar erst
// beim Deploy. Deshalb steht sie jetzt bewusst auf MODULEBENE, direkt vor
// dem einzigen Aufrufer im Spielstart.

async function startGameEngine(room, roomId, activePlayer, afterInit) {
  room.gameState.activePlayer = activePlayer;
  room.gameState.turn = 1;
  room.gameState.awaitingFirstChoice = false;
  room.engine = new GameEngine(room, io, sendGameState, endGame, sendSpectatorGameState);
  room.engine.init();

  // Optional hook: callers (e.g. singleplayer) use this to configure the
  // engine (swap onGameOver, set _cpuPlayerIdx, install the CPU brain)
  // BEFORE onBeforeHandDraw fires — otherwise a Hero with an onBeforeHandDraw
  // prompt (Bill) would try to prompt the CPU's non-existent socket.
  if (afterInit) afterInit(room.engine);

  // ── DEMO-AUFNAHME, ZENTRAL FÜR ALLE SPIELARTEN (1.8.) ─────────────
  // Vorher hing der Recorder nur am Singleplayer-Pfad. PvP-Partien sind
  // für das CPU-Training aber mindestens so wertvoll — zwei Menschen
  // liefern Entscheidungen, die kein Selbstspiel erzeugt.
  //
  // Der Einhängepunkt liegt HIER statt an den fünf Aufrufstellen
  // (start_game, request_rematch, rematch_first_choice,
  // advanceToNextGame, cubeStartMatch): eine Stelle kann nicht
  // vergessen werden. `afterInit` läuft davor, damit der SP-Pfad seine
  // onGameOver-Kette schon gesetzt hat und der Recorder sich daran
  // hängen kann.
  if (demoRecordingEnabled() && !room.engine._demoRecorderAttached) {
    try {
      room.engine._demoRecorderAttached = true;
      require('./cards/effects/_demo-recorder').attachDemoRecorder(room.engine, {
        pilotIdx: 0,
        firstPlayer: activePlayer,
        // 'sp' = Mensch gegen CPU (Spieler 0 ist der Mensch),
        // 'pvp' = zwei Menschen (pilotIdx 0 ist dann schlicht Spieler 0).
        mode: room.type === 'singleplayer' ? 'sp' : 'pvp',
        roomId,
      });
    } catch (e) { console.error('[demo-recorder] Attach fehlgeschlagen:', e.message); }
  }

  // Fire onBeforeHandDraw hook (Bill, etc.) — before starting hands are drawn
  await room.engine.runHooks('onBeforeHandDraw', {});

  // Draw starting hands (5 cards per player)
  for (let pi = 0; pi < 2; pi++) {
    const ps = room.gameState.players[pi];
    const drawn = ps.mainDeck.splice(0, 5);
    ps.hand.push(...drawn);

  }

  room.gameState.mulliganPending = true;
  room.gameState.mulliganDecisions = [null, null];
  for(let i=0;i<2;i++) sendGameState(room, i); sendSpectatorGameState(room);
  io.to('room:' + room.id).emit('game_started', sanitizeRoom(room));
  io.emit('rooms', getRoomList());
}

// ── v385: von der Verbindungs-Closure auf MODULEBENE gehoben ──────
// Die Funktion ist rein (nur room/winnerIdx/reason) und war bisher in
// `io.on('connection')` eingesperrt — der Messstand konnte sie nicht
// rufen und meldete `ohne-spielende` ohne jede Begruendung. Jetzt
// nutzen Selbstspiel UND netbench dieselbe Diagnose.
/**
 * Snapshot engine state for tie/result diagnosis. Called from `finish()`
 * to capture WHY a game ended the way it did — crucial for explaining
 * `no-result` ties, where the turn chain exited cleanly without setting
 * gs.result. Returns a short human-readable string.
 */
function buildGameDiagnosis(room, winnerIdx, reason) {
  const gs = room?.gameState;
  const engine = room?.engine;
  if (!gs) return 'no-gamestate';

  const summarizeSide = (pi) => {
    const ps = gs.players?.[pi];
    if (!ps) return `p${pi}=?`;
    const heroes = (ps.heroes || []).filter(h => h && h.name);
    const alive = heroes.filter(h => (h.hp || 0) > 0).length;
    const totalHp = heroes.reduce((s, h) => s + Math.max(0, h.hp || 0), 0);
    const deck = (ps.mainDeck || []).length;
    const hand = (ps.hand || []).length;
    return `p${pi}(heroes ${alive}/${heroes.length} alive, ${totalHp}hp, deck ${deck}, hand ${hand})`;
  };

  const parts = [summarizeSide(0), summarizeSide(1)];
  parts.push(`turn ${gs.turn} phase ${gs.currentPhase} active p${gs.activePlayer}`);

  // Hypothesize ONLY for unexplained finishes. Named reasons already
  // carry their own meaning.
  if (reason === 'no-result' || !reason) {
    const p0Alive = (gs.players?.[0]?.heroes || []).some(h => h?.name && (h.hp || 0) > 0);
    const p1Alive = (gs.players?.[1]?.heroes || []).some(h => h?.name && (h.hp || 0) > 0);
    const p0Deck = (gs.players?.[0]?.mainDeck || []).length;
    const p1Deck = (gs.players?.[1]?.mainDeck || []).length;
    const pendingPrompt = !!(engine?._pendingPrompt || engine?._pendingGenericPrompt);
    const driverErrors = engine?._driverErrors || [];

    const hypotheses = [];
    if (!p0Alive && !p1Alive) hypotheses.push('both sides wiped (all-heroes-dead never fired?)');
    else if (!p0Alive) hypotheses.push('p0 wiped, win-check skipped');
    else if (!p1Alive) hypotheses.push('p1 wiped, win-check skipped');
    if (p0Deck === 0 && p1Deck === 0) hypotheses.push('both decks empty');
    else if (p0Deck === 0) hypotheses.push('p0 deck empty, deck-out never fired');
    else if (p1Deck === 0) hypotheses.push('p1 deck empty, deck-out never fired');
    if (pendingPrompt) hypotheses.push('pending prompt unresolved');
    if (driverErrors.length) {
      const last = driverErrors.at(-1);
      // Extract the first in-project frame from the stack so the tie log
      // points straight at the thrower (usually a card script).
      const pickFrame = (stack) => {
        if (!stack) return '';
        const lines = stack.split('\n').slice(1);
        const frame = lines.find(l => /cards[\\/]/.test(l) && !/_engine\.js/.test(l))
                   || lines.find(l => /cards[\\/]/.test(l))
                   || lines[0] || '';
        return frame.trim();
      };
      const frame = pickFrame(last.stack);
      hypotheses.push(`CPU driver threw ${driverErrors.length}× (last: t${last.turn} p${last.player}: ${last.message}${frame ? ` @ ${frame}` : ''})`);
    }
    if (!hypotheses.length) hypotheses.push('turn chain exited with both sides alive and decks non-empty');
    parts.push('cause: ' + hypotheses.join('; '));
  }

  return parts.join(' | ');
}

io.on('connection', (socket) => {
  let currentUser = null;
  const socketIP = getSocketIP(socket);

  // Entwicklerwerkzeuge nur anmelden, wenn PP_DEBUG_TOOLS=1 gesetzt ist
  // (siehe Block bei DEBUG_TOOLS_ENABLED). Ohne den Schalter existiert
  // der Zuhoerer gar nicht.
  const onDebug = (ereignis, handler) => {
    if (DEBUG_TOOLS_ENABLED) socket.on(ereignis, handler);
  };

  socket.on('auth', (token) => {
    const session = sessions.get(token);
    if (session) {
      currentUser = { ...session, ip: socketIP };
      socket.emit('auth_ok', session);
      // Reconnect to active game
      const activeRoomId = activeGames.get(session.userId);
      if (activeRoomId) {
        const room = rooms.get(activeRoomId);
        if (room?.gameState) {
          const t = disconnectTimers.get(session.userId);
          if (t) { clearTimeout(t); disconnectTimers.delete(session.userId); }
          const pi = room.gameState.players.findIndex(ps => ps.userId === session.userId);
          if (pi >= 0) {
            // Disconnect previous socket for this user (prevents dual-tab issues)
            const oldSocketId = room.players[pi]?.socketId;
            if (oldSocketId && oldSocketId !== socket.id) {
              const oldSocket = io.sockets.sockets.get(oldSocketId);
              if (oldSocket) {
                oldSocket.leave('room:' + activeRoomId);
                oldSocket.emit('superseded', { reason: 'This session was opened in another tab.' });
                oldSocket.disconnect(true);
              }
            }
            if (room.players[pi]) room.players[pi].socketId = socket.id;
            room.gameState.players[pi].socketId = socket.id;
            room.gameState.players[pi].disconnected = false;
            socket.join('room:' + activeRoomId);
            sendGameState(room, pi, { reconnected: true });
            // Send chat history on reconnect
            if (room.chatHistory?.length || Object.keys(room.privateChatHistory || {}).length) {
              socket.emit('chat_history', { main: room.chatHistory || [], private: room.privateChatHistory || {} });
            }
            const oi = pi === 0 ? 1 : 0;
            sendGameState(room, oi);
            sendSpectatorGameState(room);
          }
        }
      }
    } else { socket.emit('auth_fail'); }
  });

  socket.on('get_rooms', () => socket.emit('rooms', getRoomList()));

  // Re-sync this socket's cached identity from the DB after the user edits
  // their profile (e.g. a rename), so lobby/chat/new rooms made later in the
  // same connection use the fresh name without forcing a relog.
  socket.on('refresh_identity', async () => {
    if (!currentUser) return;
    const u = await db.get('SELECT * FROM users WHERE id = ?', [currentUser.userId]);
    if (u) {
      currentUser.username = u.username;
      currentUser.color = u.color;
      currentUser.avatar = u.avatar;
    }
  });

  socket.on('create_room', async ({ type, playerPw, specPw, deckId, format, cubeDraft }) => {
    if (!currentUser) return;
    const fmt = [1, 3, 5].includes(format) ? format : 1;
    const roomId = uuidv4().substring(0, 8);

    // Cube Draft branch: 8-seat room, host's cube is the source pool, no
    // per-player deck yet (decks are built post-draft). The host is
    // required to own the cube at creation; joiners draft from it.
    let cubeDraftConfig = null;
    if (cubeDraft && cubeDraft.cubeId) {
      try {
        const deckRow = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [cubeDraft.cubeId, currentUser.userId]);
        if (!deckRow) return socket.emit('join_error', 'Cube not found in your deck list.');
        const cube = parseDeck(deckRow);
        if (cube.mode !== 'cube') return socket.emit('join_error', 'Selected deck is not a Cube.');
        const mainSize = (cube.mainDeck || []).length;
        // Match isDeckLegal's CUBE_SIZE (512) — the cube must be exactly
        // 512 cards so the draft can split into 32 packs of 16.
        if (mainSize !== 512) return socket.emit('join_error', `Cube must hold exactly 512 cards (currently ${mainSize}).`);
        cubeDraftConfig = {
          cubeId: cube.id,
          cubeName: cube.name,
          cubeOwnerId: currentUser.userId,
          // Cube cards aren't sent to non-host clients while the room is
          // open; they're only baked into pack lists when the draft starts.
          packTimerSec: Math.max(15, Math.min(600, parseInt(cubeDraft.packTimerSec, 10) || 60)),
          pickTimerSec: Math.max(0, Math.min(60, parseInt(cubeDraft.pickTimerSec, 10) || 5)),
          // When true, the server skips all auto-pick timeout scheduling —
          // drafters can take as long as they want. Bots still pick on
          // their normal short delay so the draft doesn't stall on them.
          timerDisabled: !!cubeDraft.timerDisabled,
          prelimsBo: [1, 3, 5].includes(cubeDraft.prelimsBo) ? cubeDraft.prelimsBo : 1,
          finaleBo: [1, 3, 5].includes(cubeDraft.finaleBo) ? cubeDraft.finaleBo : 3,
          flow: cubeDraft.flow === 'consecutive' ? 'consecutive' : 'simultaneous',
          // Lifecycle phase for the cube run as a whole. `lobby` until
          // the host hits Start; then `drafting`, `building`, `tournament`,
          // `complete`. Mirrors room.status but lives at the cube layer.
          phase: 'lobby',
        };
      } catch (err) {
        console.error('[create_room cubeDraft]', err.message);
        return socket.emit('join_error', 'Failed to load Cube.');
      }
    }

    const isCubeDraft = !!cubeDraftConfig;
    const room = {
      id: roomId,
      host: currentUser.username,
      hostId: currentUser.userId,
      type: type || 'unranked',
      format: isCubeDraft ? (cubeDraftConfig.prelimsBo) : fmt,
      // For cube draft, `winsNeeded` and `setScore` apply per individual
      // tournament match, not to the room. They get reset per match in M4.
      winsNeeded: isCubeDraft ? Math.ceil(cubeDraftConfig.prelimsBo / 2) : Math.ceil(fmt / 2),
      setScore: [0, 0],
      playerPw: playerPw || null,
      specPw: specPw || null,
      // Cube Draft rooms: capacity is 8 (vs the standard 2). Empty seats
      // get filled with bots at start. The host is always at seat 0.
      maxPlayers: isCubeDraft ? 8 : 2,
      players: [{ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: isCubeDraft ? null : (deckId || null), isBot: false }],
      spectators: [],
      status: 'waiting',
      created: Date.now(),
      gameState: null,
      chatHistory: [],
      privateChatHistory: {},
      cubeDraft: cubeDraftConfig,
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.emit('rooms', getRoomList());
  });

  socket.on('join_room', ({ roomId, password, asSpectator, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return socket.emit('join_error', 'Room not found');
    const isPlayer = room.players.some(p => p.username === currentUser.username);
    const isSpec = room.spectators.some(s => s.username === currentUser.username);
    if (isPlayer || isSpec) {
      // Update the player's socketId so subsequent emits land on the
      // fresh socket. Critical for cube-draft reconnect (see disconnect
      // handler — we null out socketId on drop so this branch can
      // detect the seat). Mirrors the existing spec-side behaviour.
      if (isPlayer) {
        const playerEntry = room.players.find(p => p.username === currentUser.username);
        if (playerEntry) playerEntry.socketId = socket.id;
      }
      socket.join('room:' + roomId);
      socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
      // Cube Draft: if the draft was suspended waiting on this seat
      // and ALL human seats now have a live socketId, resume.
      if (room.cubeDraft?.draftState?.suspended && isPlayer) {
        const allHumansBack = room.players.every(p => p.isBot || p.socketId);
        if (allHumansBack) cubeDraftResume(room, db, parseDeck, io);
        else cubeDraftBroadcast(room, io); // re-emit so the rejoiner sees current state
      }
      // Cube Draft: re-send the appropriate phase-specific state to the
      // rejoiner so the client can render the right screen.
      if (room.cubeDraft) {
        if (room.cubeDraft.phase === 'drafting') cubeDraftBroadcast(room, io);
        else if (room.cubeDraft.phase === 'building') cubeBuildBroadcast(room, io);
        else if (room.cubeDraft.phase === 'tournament') cubeTournamentBroadcast(room, io);
      }
      // If spectator re-joins during a game, send them the current game state
      if (isSpec && room.status === 'playing' && room.gameState) {
        // Update the spectator's socketId (they may have reconnected)
        const specEntry = room.spectators.find(s => s.username === currentUser.username);
        if (specEntry) {
          // Disconnect previous socket for this spectator (prevents dual-tab issues)
          const oldSpecSocketId = specEntry.socketId;
          if (oldSpecSocketId && oldSpecSocketId !== socket.id) {
            const oldSocket = io.sockets.sockets.get(oldSpecSocketId);
            if (oldSocket) {
              oldSocket.leave('room:' + roomId);
              oldSocket.emit('superseded', { reason: 'This session was opened in another tab.' });
              oldSocket.disconnect(true);
            }
          }
          specEntry.socketId = socket.id;
        }
        sendSpectatorGameState(room);
        if (room.chatHistory?.length || Object.keys(room.privateChatHistory || {}).length) {
          socket.emit('chat_history', { main: room.chatHistory || [], private: room.privateChatHistory || {} });
        }
      }
      return;
    }
    if (asSpectator) {
      if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Wrong spectator password');
      room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
    } else {
      // Cube Draft rooms seat up to 8 humans (`room.maxPlayers`); standard
      // rooms cap at 2. Joiners past the cap fall through to spectator.
      const maxSeats = room.maxPlayers || 2;
      if (room.players.length >= maxSeats) {
        if (room.specPw && password !== room.specPw) return socket.emit('join_error', 'Game full');
        room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
      } else {
        if (room.playerPw && password !== room.playerPw) return socket.emit('join_error', 'Wrong password');
        // Cube Draft players don't bring their own deck — they draft
        // one from the host's cube, so deckId is intentionally null.
        const isCubeDraftRoom = !!room.cubeDraft;
        room.players.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: isCubeDraftRoom ? null : (deckId || null), isBot: false });
        const hs = room.players[0]?.socketId;
        if (hs) io.to(hs).emit('player_joined', { username: currentUser.username });
      }
    }
    socket.join('room:' + roomId);
    socket.emit('room_joined', sanitizeRoom(room, currentUser.username));
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
    // If the game is already playing, send initial game state to the new spectator
    if (room.status === 'playing' && room.gameState && room.spectators.some(s => s.userId === currentUser.userId)) {
      sendSpectatorGameState(room);
    }
  });

  socket.on('swap_to_spectator', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    room.players = room.players.filter(p => p.username !== currentUser.username);
    room.spectators.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, color: currentUser.color || '#888', avatar: currentUser.avatar || null });
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  socket.on('swap_to_player', ({ roomId, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const cap = room.maxPlayers || 2;
    if (room.players.length >= cap) return socket.emit('join_error', 'No player slot');
    if (room.status === 'playing') return socket.emit('join_error', 'Game in progress');
    // Cube Draft rooms must still be in the lobby phase to accept new
    // seat joiners. Once drafting starts, the seat list is locked.
    if (room.cubeDraft && room.cubeDraft.phase !== 'lobby') return socket.emit('join_error', 'Draft already started');
    room.spectators = room.spectators.filter(s => s.username !== currentUser.username);
    const isCubeDraftRoom = !!room.cubeDraft;
    room.players.push({ username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: isCubeDraftRoom ? null : (deckId || null), isBot: false });
    const hs = room.players[0]?.socketId;
    if (hs) io.to(hs).emit('player_joined', { username: currentUser.username });
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
  });

  socket.on('change_deck', ({ roomId, deckId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const playerIdx = room.players.findIndex(p => p.userId === currentUser.userId);
    if (playerIdx < 0) return;
    const player = room.players[playerIdx];
    const prevDeckId = player.deckId;
    player.deckId = deckId || null;
    // Invalidate the cached deck snapshots when the deck actually
    // changes. `_currentDecks` / `_originalDecks` are populated by the
    // first game's `setupGameState` and re-used for side-decking
    // between games in a set — but the PvP rematch path
    // (`request_rematch`) reuses the SAME room and calls
    // `setupGameState` again, which short-circuits on a non-empty
    // `_currentDecks[idx]` and uses the old deck even after the
    // player picked a new one in the result-overlay dropdown. Wiping
    // the slot for the player who actually changed forces the next
    // setup to re-fetch from `player.deckId`. The opponent's slot
    // is left intact so their side-decking state is preserved.
    if (prevDeckId !== player.deckId) {
      if (room._currentDecks) room._currentDecks[playerIdx] = null;
      if (room._originalDecks) room._originalDecks[playerIdx] = null;
    }
    socket.emit('deck_changed', { deckId: player.deckId });
  });

  socket.on('start_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || room.hostId !== currentUser.userId || room.players.length < 2) return;
    if (room.cubeDraft) return; // Cube Draft rooms use start_cube_draft
    const activePlayer = Math.random() < 0.5 ? 0 : 1;
    await setupGameState(room);
    await startGameEngine(room, roomId, activePlayer);
  });

  // Host-only kickoff for a Cube Draft. Fills empty seats with bots,
  // flips phase to 'drafting', and (in M2) generates packs and assigns
  // them out. For M1 the handler stops at the seat-fill + phase change
  // so the lobby UI can be smoke-tested end-to-end before the actual
  // drafting engine lands.
  socket.on('start_cube_draft', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room.cubeDraft) return;
    if (room.hostId !== currentUser.userId) return;
    if (room.cubeDraft.phase !== 'lobby') return;
    if (room.players.length < 2) return socket.emit('join_error', 'Need at least one challenger.');

    const cap = room.maxPlayers || 8;
    const humanCount = room.players.filter(p => !p.isBot).length;
    // Fill remaining seats with bots. Bot identities are deterministic
    // for the run (Bot 1, Bot 2, …) — the first M2 implementation picks
    // randomly from each pack passed to them, no further state needed.
    let botIdx = 1;
    while (room.players.length < cap) {
      const botName = `Bot ${botIdx}`;
      // Skip any bot name that collides with a human in the room
      // (extremely unlikely but possible). Keep incrementing until clear.
      if (room.players.some(p => p.username === botName)) { botIdx++; continue; }
      room.players.push({
        username: botName,
        userId: `bot:${roomId}:${botIdx}`,
        socketId: null,
        deckId: null,
        isBot: true,
      });
      botIdx++;
    }

    room.cubeDraft.phase = 'drafting';
    room.cubeDraft.humanCount = humanCount;
    room.status = 'playing';
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    io.emit('rooms', getRoomList());
    console.log(`[cube_draft] room ${roomId} starting draft — ${humanCount} humans + ${cap - humanCount} bots`);
    // Kick off the actual draft engine (loads cube, builds packs, opens
    // round 1, starts bot pick + timeout schedulers).
    await cubeDraftStart(room, db, parseDeck, io);
  });

  socket.on('cube_draft_pick', ({ roomId, cardName }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room.cubeDraft || !room.cubeDraft.draftState) return;
    if (room.cubeDraft.phase !== 'drafting') return;
    const seatIdx = room.players.findIndex(p => p.userId === currentUser.userId);
    if (seatIdx < 0) return;
    cubeDraftHandlePick(room, seatIdx, cardName, db, parseDeck, io);
  });

  // Surrender the WHOLE tournament match (not just the current game in
  // a Bo3/5 set). The opponent wins immediately; the bracket advances;
  // the surrendering player keeps their parent-room membership and
  // becomes a spectator like any other eliminated player.
  socket.on('cube_surrender_match', ({ parentRoomId, childRoomId }) => {
    if (!currentUser) return;
    const parent = rooms.get(parentRoomId);
    if (!parent?.cubeDraft?.bracket) return;
    if (parent.cubeDraft.phase !== 'tournament') return;
    const child = rooms.get(childRoomId);
    if (!child || child.parentCubeRoomId !== parentRoomId) return;

    const myParentSeat = parent.players.findIndex(p => p.userId === currentUser.userId);
    if (myParentSeat < 0) return;

    const round = parent.cubeDraft.bracket.rounds[parent.cubeDraft.bracket.currentRoundIdx];
    const match = round?.find(m => m.childRoomId === childRoomId);
    if (!match || match.resolved) return;
    if (match.p1Seat !== myParentSeat && match.p2Seat !== myParentSeat) return;

    const winnerSeat = match.p1Seat === myParentSeat ? match.p2Seat : match.p1Seat;
    console.log(`[cube_tournament] ${currentUser.username} surrendered match ${childRoomId} → ${parent.players[winnerSeat]?.username} wins`);
    cubeMatchEnd(parent, match, winnerSeat, io).catch(err =>
      console.error('[cube_surrender_match]', err.message));
  });

  // Cross-game spectator switcher. The client tells the server which
  // child match they want to spectate; the server moves them between
  // child-room sockets. They keep parent-room membership throughout.
  socket.on('cube_spectate_match', ({ parentRoomId, childRoomId }) => {
    if (!currentUser) return;
    const parent = rooms.get(parentRoomId);
    if (!parent || parent.cubeDraft?.phase !== 'tournament') return;
    const target = childRoomId ? rooms.get(childRoomId) : null;
    if (childRoomId && (!target || target.parentCubeRoomId !== parentRoomId)) return;

    // Leave any current child rooms the user is in.
    for (const [rid, r] of rooms) {
      if (r.parentCubeRoomId !== parentRoomId) continue;
      if (rid === childRoomId) continue;
      const playerInChild = r.players.some(p => p.userId === currentUser.userId);
      if (playerInChild) continue; // never auto-leave a match they're playing
      const specInChild = r.spectators.some(s => s.userId === currentUser.userId);
      if (specInChild) {
        r.spectators = r.spectators.filter(s => s.userId !== currentUser.userId);
        socket.leave('room:' + rid);
      } else {
        socket.leave('room:' + rid);
      }
    }

    // Join the requested child as spectator (if specified and not already
    // a player in it).
    if (target) {
      const isPlayer = target.players.some(p => p.userId === currentUser.userId);
      if (!isPlayer) {
        const isSpec = target.spectators.some(s => s.userId === currentUser.userId);
        if (!isSpec) {
          target.spectators.push({
            username: currentUser.username, userId: currentUser.userId,
            socketId: socket.id, color: currentUser.color || '#888',
            avatar: currentUser.avatar || null,
          });
        }
      }
      socket.join('room:' + childRoomId);
      // Push the current state of that match so the spectator's UI
      // mounts the GameBoard.
      socket.emit('room_joined', sanitizeRoom(target, currentUser.username));
      if (target.gameState) {
        sendSpectatorGameState(target);
      }
    } else {
      // No target → just leave any spectator membership; client returns
      // to bracket view.
      socket.emit('cube_spectate_left');
    }
  });

  // Player submits their built deck during the build phase. Validates
  // against their drafted pool, persists to their deck list under the
  // "Drafted Decks" category, and marks the seat as Ready. When all
  // human seats are Ready, advances to the tournament phase (M4).
  socket.on('cube_draft_ready', async ({ roomId, deck }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room.cubeDraft || room.cubeDraft.phase !== 'building') return;
    const seatIdx = room.players.findIndex(p => p.userId === currentUser.userId);
    if (seatIdx < 0 || room.players[seatIdx].isBot) return;
    if (room.cubeDraft.readySeats[seatIdx]) return; // already ready

    const pool = room.cubeDraft.draftedPools?.[seatIdx]?.pool || [];
    const v = validateDraftedDeck(deck, pool, getCardDB());
    if (!v.ok) return socket.emit('join_error', 'Deck invalid: ' + v.reason);

    // Save the deck to the user's deck list under "Drafted Decks".
    try {
      const newDeckId = await cubeSaveDraftedDeck(
        currentUser.userId, deck, room.cubeDraft.cubeName, roomId
      );
      console.log(`[cube_draft] seat ${seatIdx} (${currentUser.username}) saved drafted deck ${newDeckId}`);
    } catch (err) {
      console.error('[cube_draft_ready] save error:', err.message);
      return socket.emit('join_error', 'Failed to save drafted deck.');
    }

    room.cubeDraft.builtDecks[seatIdx] = deck;
    room.cubeDraft.readySeats[seatIdx] = true;

    // Start the 5-minute auto-ready countdown on the FIRST player's
    // Ready submission. Stragglers get their decks auto-completed when
    // the timer expires (`cubeBuildAutoFillNonReady`).
    if (room.cubeDraft.buildTimerEndsAt == null) {
      room.cubeDraft.buildTimerEndsAt = Date.now() + CUBE_BUILD_TIMER_MS;
      room.cubeDraft.buildTimerHandle = setTimeout(() => {
        cubeBuildAutoFillNonReady(room, io).catch(err =>
          console.error('[cubeBuildAutoFillNonReady]', err.message));
      }, CUBE_BUILD_TIMER_MS);
      console.log(`[cube_build] room ${roomId} build timer started — 5 min`);
    }

    cubeBuildBroadcast(room, io);

    // All humans ready → start the tournament phase immediately and
    // cancel the auto-fill timer.
    const allReady = room.players.every((p, i) => p.isBot || room.cubeDraft.readySeats[i]);
    if (allReady) {
      if (room.cubeDraft.buildTimerHandle) {
        clearTimeout(room.cubeDraft.buildTimerHandle);
        room.cubeDraft.buildTimerHandle = null;
      }
      cubeStartTournament(room, io);
    }
  });

  // Vote-kick a suspended cube-draft seat. Fires when a human player
  // has been disconnected long enough that the rest of the table wants
  // to resume with a bot in their place. Majority of the remaining
  // online humans is the threshold — once met, the seat is converted
  // to a bot, the draft resumes, and the kicked player is marked for
  // an ELO loss (consumed in M5's cube-ELO update path).
  socket.on('cube_draft_vote_kick', ({ roomId, targetSeat }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room.cubeDraft || !room.cubeDraft.draftState) return;
    if (room.cubeDraft.phase !== 'drafting') return;
    const draft = room.cubeDraft.draftState;
    if (!draft.suspended) return;
    const target = room.players[targetSeat];
    if (!target || target.isBot || target.socketId) return; // only kick disconnected humans
    const voterSeat = room.players.findIndex(p => p.userId === currentUser.userId);
    if (voterSeat < 0 || voterSeat === targetSeat) return;
    if (room.players[voterSeat].isBot || !room.players[voterSeat].socketId) return;

    const onlineHumans = room.players.filter(p => !p.isBot && p.socketId).length;
    const needed = Math.ceil(onlineHumans / 2); // simple majority of those still here
    if (!draft.voteKick || draft.voteKick.targetSeat !== targetSeat) {
      draft.voteKick = { targetSeat, votes: {}, needed };
    } else {
      draft.voteKick.needed = needed;
    }
    draft.voteKick.votes[voterSeat] = true;

    if (Object.keys(draft.voteKick.votes).length >= needed) {
      // Consume vote and convert the seat to a bot.
      const oldName = target.username;
      target.username = `Bot (was ${oldName})`;
      target.isBot = true;
      target.socketId = null;
      target.cubeKickLoss = true; // M5 reads this for ELO penalty
      draft.voteKick = null;
      cubeDraftResume(room, db, parseDeck, io);
      io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
    } else {
      cubeDraftBroadcast(room, io);
    }
  });

  // ── MULLIGAN ──
  socket.on('mulligan_decision', ({ roomId, accept }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.mulliganPending) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || gs.mulliganDecisions[pi] !== null) return; // Already decided

    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } };

    const checkBothReady = () => {
      if (!gs.mulliganDecisions) return; // Already processed
      if (gs.mulliganDecisions[0] !== null && gs.mulliganDecisions[1] !== null) {
        console.log(`[SP trace] mulligan both decided — activePlayer=${gs.activePlayer}, calling engine.startGame()`);
        gs.mulliganPending = false;
        delete gs.mulliganDecisions;
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        room.engine.startGame()
          .then(() => console.log('[SP trace] engine.startGame() resolved'))
          .catch(err => console.error('[Engine] startGame error:', err.message));
      }
    };

    gs.mulliganDecisions[pi] = accept;

    if (accept) {
      const ps = gs.players[pi];
      const cardDB = getCardDB();
      (async () => {
        // Separate potions from non-potions for routing
        const handSize = ps.hand.length;
        let potionCount = 0;
        // Return cards to correct deck one by one (reverse draw animation)
        for (let i = 0; i < handSize; i++) {
          const card = ps.hand.shift();
          const cd = cardDB[card];
          if (cd?.cardType === 'Potion') {
            ps.potionDeck.push(card);
            potionCount++;
          } else {
            ps.mainDeck.push(card);
          }
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 180));
        }
        // Wait 1 second
        await new Promise(r => setTimeout(r, 1000));
        // Shuffle both decks
        shuffle(ps.mainDeck);
        shuffle(ps.potionDeck);
        // Draw replacements: potions from potion deck, rest from main deck
        const mainToDraw = handSize - potionCount;
        for (let i = 0; i < mainToDraw; i++) {
          if (ps.mainDeck.length === 0) break;
          const card = ps.mainDeck.shift();
          ps.hand.push(card);
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 200));
        }
        for (let i = 0; i < potionCount; i++) {
          if (ps.potionDeck.length === 0) break;
          const card = ps.potionDeck.shift();
          ps.hand.push(card);
          for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
          await new Promise(r => setTimeout(r, 200));
        }
        checkBothReady();
      })();
    } else {
      sendGameState(room, pi);
      sendSpectatorGameState(room);
      checkBothReady();
    }
  });

  socket.on('leave_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId); if (!room) return;
    const hadResult = !!room.gameState?.result;

    // If game is active and no result yet, surrendering ends the game
    if (room.gameState && !hadResult && room.status === 'playing') {
      const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
      if (pi >= 0) {
        const winnerIdx = pi === 0 ? 1 : 0;
        if (room.type === 'puzzle') {
          puzzleEndGame(room, winnerIdx, 'surrender');
          // Puzzle surrender: clean up immediately so the player can start a new puzzle
          socket.leave('room:' + roomId);
          activeGames.delete(currentUser.userId);
        }
        else if (room.type === 'singleplayer') {
          // Don't cleanup — the client's handleSurrender intentionally keeps
          // the user on the result screen so they can rematch. endCpuBattle
          // sets gs.result and sends a final game_state; the room stays alive
          // until the user explicitly rematches (rematch_cpu_battle) or
          // leaves (post-result leave_game, handled below).
          endCpuBattle(room, winnerIdx, 'surrender');
        }
        else await endGame(room, winnerIdx, 'surrender');
      }
      // Don't mark as left — both players should see Rematch/Leave
      return;
    }

    // Singleplayer post-result: clean up immediately — the CPU never calls leave_game
    // itself, so the "every player left" check used by PvP games can never fire.
    if (hadResult && room.gameState && room.type === 'singleplayer') {
      socket.leave('room:' + roomId);
      cleanupRoom(roomId);
      return;
    }
    // If game already had a result, this is a post-result LEAVE
    if (hadResult && room.gameState) {
      socket.leave('room:' + roomId);
      activeGames.delete(currentUser.userId);
      const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
      if (pi >= 0) room.gameState.players[pi].left = true;
      room.gameState.rematchRequests = room.gameState.rematchRequests.filter(u => u !== currentUser.userId);
      const oi = room.gameState.players.findIndex(ps => ps.userId !== currentUser.userId);
      if (oi >= 0) sendGameState(room, oi);
      sendSpectatorGameState(room);
      if (room.gameState.players.every(ps => ps.left)) cleanupRoom(roomId);
    } else {
      socket.leave('room:' + roomId);
      activeGames.delete(currentUser.userId);
    }
  });

  // Reorder hand (cosmetic, persists across reconnect)
  socket.on('reorder_hand', ({ roomId, hand, indexMap }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Validate: same cards, just reordered.
    const ps = room.gameState.players[pi];
    const current = ps.hand;
    if (hand.length !== current.length) return;
    const sorted1 = [...hand].sort();
    const sorted2 = [...current].sort();
    if (sorted1.some((c, i) => c !== sorted2[i])) return;
    // Validate the optional permutation. `indexMap[newIdx] = oldIdx`.
    // Must be a permutation of [0..n) and each hand entry must match
    // the source-old position (newHand[newIdx] === oldHand[oldIdx]).
    let validMap = null;
    if (Array.isArray(indexMap) && indexMap.length === hand.length) {
      const seen = new Set();
      let ok = true;
      for (let newIdx = 0; newIdx < hand.length; newIdx++) {
        const oldIdx = indexMap[newIdx];
        if (typeof oldIdx !== 'number' || oldIdx < 0 || oldIdx >= current.length || seen.has(oldIdx)) { ok = false; break; }
        if (current[oldIdx] !== hand[newIdx]) { ok = false; break; }
        seen.add(oldIdx);
      }
      if (ok) validMap = indexMap;
    }
    // Per-copy hand-indexed state (Luna Kiai's per-turn reveal flags,
    // Bamboo Shield's permanent reveals, Rocky Slime's level offsets,
    // and any future card-feature that registers via the engine's
    // `_handIndexedFields` registry) gets remapped through the
    // indexMap so each entry follows its physical copy. Both boolean
    // and numeric value-types are preserved by copying through. With
    // no permutation provided, we drop the maps rather than risk
    // misattributing entries — the alternative would silently bind
    // state to the wrong physical copy.
    const remapValueMap = (oldMap) => {
      if (!oldMap) return oldMap;
      if (!validMap) return {}; // Drop on no-permutation; safer than misattribution.
      const out = {};
      for (let newIdx = 0; newIdx < hand.length; newIdx++) {
        const v = oldMap[validMap[newIdx]];
        if (v != null && v !== 0 && v !== false) out[newIdx] = v;
      }
      return out;
    };
    if (room.engine?._handIndexedFields) {
      for (const [fieldName] of room.engine._handIndexedFields) {
        if (ps[fieldName] != null) {
          ps[fieldName] = remapValueMap(ps[fieldName]);
        }
      }
    }
    ps.hand = hand;
    // Array reassignment wiped the splice interceptor — re-install.
    if (room.engine) room.engine._installHandRevealInterceptor(pi);
    // Push a fresh snapshot so the reordering player's client picks up
    // the remapped `handActivatableCards` / `revealedOwnHandIndices`.
    // Without this, per-index UI state (Luna Kiai's clickable halo +
    // revealed semi-transparency) stays pinned to the OLD positions
    // until the next unrelated event drives a snapshot.
    for (let i = 0; i < 2; i++) sendGameState(room, i);
    sendSpectatorGameState(room);
  });

  // Advance phase (player clicks a phase button). The click is
  // ALWAYS manual — bypass the engine's second-action grace gate so
  // the player can voluntarily leave Action Phase even with an unused
  // bonus action (Claussss/Ba/Torchure-style grants). Engine-internal
  // auto-advance call sites (doPlaySpell, doPlayCreature, …) do NOT
  // pass `manual` and keep the grace behavior.
  socket.on('advance_phase', ({ roomId, targetPhase }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    if (targetPhase !== undefined) {
      room.engine.advanceToPhase(pi, targetPhase, { manual: true }).catch(err => console.error('[Engine] advanceToPhase error:', err.message));
    } else {
      room.engine.advancePhase(pi).catch(err => console.error('[Engine] advancePhase error:', err.message));
    }
  });

  // Play an ability from hand onto a hero (thin socket wrapper — logic lives in doPlayAbility)
  socket.on('play_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlayAbility(room, pi, params).catch(err => console.error('[play_ability] error:', err.message));
  });

  // ── Place a Surprise card face-down into a Hero's Surprise Zone ──
  socket.on('play_surprise', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Reaktionsketten-/Abwurf-Sperre (Als Befund 5.8.: Stormkissed
    // Waflav liess sich waehrend Ambush noch aktivieren).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doPlaySurprise(room, pi, params).catch(err => console.error('[play_surprise] error:', err.message));
  });

  // Summon a creature placed by Ushabti from surprise zone
  socket.on('summon_ushabti', ({ roomId, heroIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0 || pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // Main Phase only

    const ps = gs.players[pi];
    const sz = ps.surpriseZones?.[heroIdx] || [];
    if (sz.length === 0) return;
    const cardName = sz[0];
    const inst = room.engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'surprise' && c.heroIdx === heroIdx && c.ushabtiPlaced
    );
    if (!inst) return;
    const currentTurn = gs.turn || 0;
    if (inst.ushabtiTurn >= currentTurn) return; // Can't summon same turn

    const hero = ps.heroes[heroIdx];
    if (!hero?.name || hero.hp <= 0) return;
    if (hero.statuses?.frozen || (hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.negated || hero.statuses?.bound) return;

    // Check abilities
    const cardData = getCardDB()[cardName];
    if (!cardData) return;
    const level = cardData.level || 0;
    if (level > 0 || cardData.spellSchool1) {
      const abZones = ps.abilityZones?.[heroIdx] || [];
      if (cardData.spellSchool1 && room.engine.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) return;
      if (cardData.spellSchool2 && room.engine.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) return;
    }

    // Find free support zone slot
    let freeSlot = -1;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[heroIdx] || [])[si] || []).length === 0) { freeSlot = si; break; }
    }
    if (freeSlot < 0) return;

    // Check custom summon conditions
    const script = loadCardEffect(cardName);
    if (script?.canSummon && !script.canSummon({ _engine: room.engine, cardOwner: pi, cardHeroIdx: heroIdx })) return;

    // Remove from surprise zone
    const szIdx = sz.indexOf(cardName);
    if (szIdx >= 0) sz.splice(szIdx, 1);

    // Place in support zone
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
    ps.supportZones[heroIdx][freeSlot] = [cardName];

    // Update instance
    inst.zone = 'support';
    inst.heroIdx = heroIdx;
    inst.zoneSlot = freeSlot;
    inst.faceDown = false;
    delete inst.ushabtiPlaced;
    delete inst.ushabtiTurn;
    inst.turnPlayed = currentTurn;

    room.engine.notePlayedFromHand(pi);
    room.engine.log('creature_summoned', { player: ps.username, card: cardName, hero: hero.name });
    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;
    room.engine._trackTerrorResolvedEffect(pi, cardName);
    room.engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: freeSlot, cardName });
    room.engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: pi, heroIdx, zoneSlot: freeSlot,
    });

    (async () => {
      try {
        await room.engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: freeSlot, _skipReactionCheck: true });
        await room.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });
        // Fire Bakhm's onSurpriseCreaturePlaced for surprise creature summons
        await room.engine.runHooks('onSurpriseCreaturePlaced', {
          surpriseCardName: cardName, surpriseOwner: pi, heroIdx,
          zoneSlot: freeSlot, cardInstance: inst,
        });
        await room.engine._flushSurpriseDrawChecks();
        // Check summon triggers
        await room.engine._checkSurpriseOnSummon(pi, inst);
      } catch (err) {
        console.error('[Engine] summon_ushabti hooks error:', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
    })();
  });

  // Activate an action-costing ability on the board
  socket.on('activate_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Hand/Brett waehrend Reaktionskette bzw. erzwungenem Abwurf
    // gesperrt (Als Befund 5.8., Spam-Klick).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doActivateAbility(room, pi, params).catch(err => console.error('[activate_ability]', err.message)).finally(() => room.engine?._runPostChainActions?.());
  });

  // Activate a free-activation ability (no action cost, Main Phase only)
  socket.on('activate_free_ability', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateFreeAbility(room, pi, params).catch(err => console.error('[activate_free_ability] error:', err.message));
  });

  // Activate a hero's active effect (Main Phase, no action cost)
  socket.on('activate_hero_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Hand/Brett waehrend Reaktionskette bzw. erzwungenem Abwurf
    // gesperrt (Als Befund 5.8., Spam-Klick).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doActivateHeroEffect(room, pi, params).catch(err => console.error('[activate_hero_effect]', err.message));
  });

  // ── ACTIVE CREATURE EFFECTS ──
  // Generic Area-effect activation — Deepsea Castle etc. The engine's
  // activateAreaEffect validates turn/phase/HOPT, re-runs the card's
  // canActivateAreaEffect gate, and invokes onAreaEffect(ctx).
  socket.on('activate_area_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateAreaEffect(room, pi, params).catch(err => console.error('[activate_area_effect]', err.message));
  });

  socket.on('activate_creature_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Hand/Brett waehrend Reaktionskette bzw. erzwungenem Abwurf
    // gesperrt (Als Befund 5.8., Spam-Klick).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doActivateCreatureEffect(room, pi, params).catch(err => console.error('[activate_creature_effect] error:', err.message));
  });

  // Treacherous Crystal — explicit trigger emitted when the player
  // clicks the Crystal in opp's hand. Steals all eligible opp
  // Creatures for the rest of this turn (Cardinal-immune ones are
  // exempt). The card text says "may take control", so the lend is
  // opt-in: clicking is the consent gesture. Steals revert at the
  // next turn start via the engine's `_revertStolenCreatures`
  // cleanup, same path Deepsea Succubus's temporary steals use.
  socket.on('trigger_treacherous_crystal', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doTriggerTreacherousCrystal(room, pi);
  });

  // Activate an equipped card's active effect (Slippery Skates, etc.)
  socket.on('activate_discard_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivateDiscardEffect(room, pi, params)
      .catch(err => console.error('[activate_discard_effect]', err.message))
      .finally(() => room.engine?._runPostChainActions?.());
  });

  socket.on('activate_equip_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Reaktionsketten-/Abwurf-Sperre (Als Befund 5.8.: Stormkissed
    // Waflav liess sich waehrend Ambush noch aktivieren).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doActivateEquipEffect(room, pi, params).catch(err => console.error('[activate_equip_effect]', err.message));
  });

  // Activate a permanent card's effect
  socket.on('activate_permanent', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doActivatePermanent(room, pi, params).catch(err => console.error('[activate_permanent]', err.message));
  });

  // Play the top of the player's Coolness Stack (Bifab, Modnir,
  // Swellpnir, String of Fine, Hipdall self-summon, Swagdri self-summon).
  socket.on('play_from_coolness_stack', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState || !room.engine) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    (async () => {
      try {
        await room.engine.actionPlayTopOfCoolnessStack(pi);
      } catch (err) {
        console.error('[play_from_coolness_stack]', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      sendSpectatorGameState(room);
    })();
  });

  // Activate a hand card's "handActivatedEffect" without playing it.
  // Luna Kiai's "reveal to Burn" — and any future card with the same shape.
  socket.on('activate_hand_card', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState || !room.engine) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Reaktionsketten-/Abwurf-Sperre (Als Befund 5.8.: Stormkissed
    // Waflav liess sich waehrend Ambush noch aktivieren).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    const cardName = params?.cardName;
    const handIndex = params?.handIndex;
    if (typeof cardName !== 'string') return;
    if (typeof handIndex !== 'number' || handIndex < 0) return;
    (async () => {
      try {
        await room.engine.doHandActivate(pi, cardName, handIndex);
      } catch (err) {
        console.error('[activate_hand_card]', err.message);
      }
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      sendSpectatorGameState(room);
    })();
  });

  // Play a creature from hand to support zone
  socket.on('play_creature', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Cross-side destination hint: stashed on gs (not ps) for the
    // Creature script's onPlay to consume. Only honoured for Creature
    // scripts that opt in via `playOnAnyHeroSide: true`; without that
    // gate, a malicious client could relocate any summoned Creature
    // anywhere. The hint addresses an opp-side Support Zone; same-side
    // values are ignored by the consumer.
    if (params?.crossSideHost
        && typeof params.crossSideHost === 'object'
        && room.engine) {
      const script = loadCardEffect(params.cardName);
      if (script?.playOnAnyHeroSide === true) {
        if (!room.gameState._chillyWizardHint) room.gameState._chillyWizardHint = {};
        room.gameState._chillyWizardHint[pi] = {
          ownerIdx: params.crossSideHost.ownerIdx,
          heroIdx: params.crossSideHost.heroIdx,
          slotIdx: params.crossSideHost.slotIdx,
        };
      }
    }
    doPlayCreature(room, pi, params)
      .catch(err => console.error('[play_creature] error:', err.message))
      .finally(() => {
        // Clear any stale cross-side hint — if the play was negated /
        // fizzled / never fired onPlay, the hint must NOT carry over to
        // the next Creature play. Consumed plays clear it themselves
        // inside `_consumeCrossSideHint`, so this is a defensive sweep.
        if (room.gameState?._chillyWizardHint) {
          delete room.gameState._chillyWizardHint[pi];
        }
        // Handler fully unwound (locks released) → run any reaction-
        // deferred actions (Lunar Eclipse / Master's Plan replacement
        // Action). Self-gated: no-ops if the board isn't idle yet.
        room.engine?._runPostChainActions?.();
      });
  });


  // Play a spell or attack from hand (drag onto a hero)
  socket.on('play_spell', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlaySpell(room, pi, params).catch(err => console.error('[play_spell] error:', err.message)).finally(() => room.engine?._runPostChainActions?.());
  });

  // Play an artifact from hand
  socket.on('play_artifact', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doPlayArtifact(room, pi, params).catch(err => console.error('[play_artifact] error:', err.message)).finally(() => room.engine?._runPostChainActions?.());
  });

  // ── Potion system ──

  // Start using a potion (enters targeting mode if needed)
  socket.on('use_potion', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Hand/Brett waehrend Reaktionskette bzw. erzwungenem Abwurf
    // gesperrt (Als Befund 5.8., Spam-Klick).
    if (room.gameState._chainResolvingLock
        || room.gameState._forceDiscardLock === pi) return;
    doUsePotion(room, pi, params).catch(err => console.error('[use_potion] error:', err.message)).finally(() => room.engine?._runPostChainActions?.());
  });

  // Use a non-equip artifact from hand (targeting mode)
  socket.on('use_artifact_effect', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doUseArtifactEffect(room, pi, params).catch(err => console.error('[use_artifact_effect] error:', err.message)).finally(() => room.engine?._runPostChainActions?.());
  });

  // Confirm potion/artifact targeting selection
  socket.on('confirm_potion', (params) => {
    if (!currentUser) return;
    const room = rooms.get(params?.roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    doConfirmPotion(room, pi, params).catch(err => console.error('[confirm_potion] error:', err.message));
  });

  // Broadcast targeting selections to opponent
  socket.on('targeting_update', ({ roomId, selectedIds }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_targeting', { selectedIds });
    sendToSpectators(room, 'opponent_targeting', { selectedIds });
  });

  // Card ping — broadcast to opponent and spectators
  socket.on('ping_card', ({ roomId, ping, color }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    // Flip perspective for opponent: sender's "me" → opponent's "opp" and vice versa
    const flipped = { ...ping };
    if (flipped.owner === 'me') flipped.owner = 'opp';
    else if (flipped.owner === 'opp') flipped.owner = 'me';
    if (flipped.type === 'hand-me') flipped.type = 'hand-opp';
    else if (flipped.type === 'hand-opp') flipped.type = 'hand-me';
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('ping_card', { ping: flipped, color });
    // Spectators see from player 0's perspective — translate accordingly
    const specPing = pi === 0 ? { ...ping } : { ...flipped };
    sendToSpectators(room, 'ping_card', { ping: specPing, color });
    // Echo back to sender unchanged (their perspective is already correct)
    socket.emit('ping_card', { ping, color });
  });

  // ─── CHAT SYSTEM ──────────────────────────
  socket.on('chat_message', ({ roomId, text }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = (text || '').slice(0, 500).trim();
    if (!msg) return;
    const isPlayer = room.players.some(p => p.userId === currentUser.userId);
    const isSpec = room.spectators.some(s => s.userId === currentUser.userId);
    if (!isPlayer && !isSpec) return;
    // Look up player's in-game color from gameState
    const gsPlayer = room.gameState?.players?.find(ps => ps.userId === currentUser.userId);
    const playerColor = gsPlayer?.color || currentUser.color || '#00f0ff';
    const entry = {
      id: Date.now() + Math.random(),
      username: currentUser.username,
      color: isSpec ? '#888' : playerColor,
      avatar: gsPlayer?.avatar || currentUser.avatar || null,
      isSpectator: isSpec,
      text: msg,
      timestamp: Date.now(),
    };
    if (!room.chatHistory) room.chatHistory = [];
    room.chatHistory.push(entry);
    // Broadcast to all in room
    const allSids = [];
    for (const p of room.players) { if (p.socketId) allSids.push(p.socketId); }
    if (room.gameState) {
      for (const ps of room.gameState.players) { if (ps.socketId && !allSids.includes(ps.socketId)) allSids.push(ps.socketId); }
    }
    for (const s of (room.spectators || [])) { if (s.socketId) allSids.push(s.socketId); }
    for (const sid of new Set(allSids)) { io.to(sid).emit('chat_message', entry); }
    // Check for @pings
    const pingRegex = /@(\S+)/g;
    let match;
    while ((match = pingRegex.exec(msg)) !== null) {
      const target = match[1].toLowerCase();
      // Find target user in room
      let targetSid = null, targetColor = currentUser.color || '#00f0ff';
      for (const p of room.players) { if (p.username.toLowerCase() === target && p.socketId) { targetSid = p.socketId; break; } }
      if (!targetSid && room.gameState) {
        for (const ps of room.gameState.players) { if (ps.username?.toLowerCase() === target && ps.socketId) { targetSid = ps.socketId; break; } }
      }
      if (!targetSid) {
        for (const s of (room.spectators || [])) { if (s.username.toLowerCase() === target && s.socketId) { targetSid = s.socketId; break; } }
      }
      if (targetSid) {
        io.to(targetSid).emit('chat_ping', { from: currentUser.username, color: isSpec ? '#aaaaaa' : (currentUser.color || '#00f0ff') });
      }
    }
  });

  socket.on('chat_private', ({ roomId, targetUsername, text }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = (text || '').slice(0, 500).trim();
    if (!msg) return;
    const entry = {
      id: Date.now() + Math.random(),
      from: currentUser.username,
      to: targetUsername,
      color: currentUser.color || '#00f0ff',
      avatar: currentUser.avatar || null,
      isSpectator: room.spectators.some(s => s.userId === currentUser.userId),
      text: msg,
      timestamp: Date.now(),
    };
    if (!room.privateChatHistory) room.privateChatHistory = {};
    const pairKey = [currentUser.username, targetUsername].sort().join('::');
    if (!room.privateChatHistory[pairKey]) room.privateChatHistory[pairKey] = [];
    room.privateChatHistory[pairKey].push(entry);
    // Send to both participants
    socket.emit('chat_private', entry);
    // Find target socket
    let targetSid = null;
    for (const p of room.players) { if (p.username === targetUsername && p.socketId) { targetSid = p.socketId; break; } }
    if (!targetSid && room.gameState) {
      for (const ps of room.gameState.players) { if (ps.username === targetUsername && ps.socketId) { targetSid = ps.socketId; break; } }
    }
    if (!targetSid) {
      for (const s of (room.spectators || [])) { if (s.username === targetUsername && s.socketId) { targetSid = s.socketId; break; } }
    }
    if (targetSid) io.to(targetSid).emit('chat_private', entry);
  });

  socket.on('request_chat_history', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room) return;
    socket.emit('chat_history', {
      main: room.chatHistory || [],
      private: room.privateChatHistory || {},
    });
  });

  // Relay pending creature placement (for additional action selection visual)
  socket.on('pending_placement', ({ roomId, heroIdx, zoneSlot, cardName }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_pending_placement', { owner: pi, heroIdx, zoneSlot, cardName });
    sendToSpectators(room, 'opponent_pending_placement', { owner: pi, heroIdx, zoneSlot, cardName });
  });
  socket.on('pending_placement_clear', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('opponent_pending_placement', null);
    sendToSpectators(room, 'opponent_pending_placement', null);
  });

  // Cancel potion targeting
  socket.on('cancel_potion', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.potionTargeting) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.potionTargeting.ownerIdx) return;
    room.gameState.potionTargeting = null;
    // Resolve the engine's pending prompt so the play_spell handler can reach its cancel path
    if (room.engine) room.engine.resolveEffectPrompt(null, { cancelled: true });
    for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
  });

  // General-purpose effect prompt response (confirm, card gallery, zone pick)
  socket.on('effect_prompt_response', ({ roomId, response }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine || !room.gameState?.effectPrompt) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi !== room.gameState.effectPrompt.ownerIdx) return;
    // Reject force-discard of the specific resolving card instance
    const epType = room.gameState.effectPrompt.type;
    if ((epType === 'forceDiscard' || epType === 'forceDiscardCancellable') && response?.handIndex != null) {
      const ps = room.gameState.players[pi];
      if (ps._resolvingCard && response.handIndex === getResolvingHandIndex(ps)) return;
    }
    room.engine.resolveGenericPrompt(response);
  });

  // Relay blind-pick selection to the victim so they see highlighted cards
  socket.on('blind_pick_update', ({ roomId, indices }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppSid = room.gameState.players[oppIdx]?.socketId;
    if (oppSid) io.to(oppSid).emit('blind_pick_highlight', { indices: indices || [] });
  });

  // ── Side-Deck Phase Handlers (Bo3/Bo5) ──

  socket.on('side_deck_swap', ({ roomId, from, fromIdx, to, toIdx }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    const deck = room._currentDecks[pi];
    if (!deck) return;

    const getPool = (key) => {
      if (key === 'main') return deck.mainDeck;
      if (key === 'potion') return deck.potionDeck;
      if (key === 'side') return deck.sideDeck;
      if (key === 'hero') return null; // handled separately
      return null;
    };

    // Hero swap: swap entire hero slot with a hero from side deck
    if (from === 'hero' || to === 'hero') {
      const heroKey = from === 'hero' ? from : to;
      const sideKey = from === 'hero' ? to : from;
      const heroSlotIdx = from === 'hero' ? fromIdx : toIdx;
      const sideIdx = from === 'hero' ? toIdx : fromIdx;
      if (sideKey !== 'side') return;
      if (heroSlotIdx < 0 || heroSlotIdx >= (deck.heroes || []).length) return;
      if (sideIdx < 0 || sideIdx >= (deck.sideDeck || []).length) return;

      const cardDB = getCardDB();
      const sideCardName = deck.sideDeck[sideIdx];

      // Side card must be a Hero
      if (!canCardTypeEnterPool(cardDB, deck, sideCardName, 'hero')) return;

      const oldHero = deck.heroes[heroSlotIdx];
      const oldHeroName = oldHero?.hero;

      // Simulate deck state after swap to check Nicolas-dependent rules
      const simHeroes = (deck.heroes || []).map((h, i) =>
        i === heroSlotIdx ? { hero: sideCardName } : h
      );
      const simDeck = { ...deck, heroes: simHeroes };
      // If main deck has potions, Nicolas must still be present after swap
      const mainPotions = (deck.mainDeck || []).filter(n => cardDB[n]?.cardType === 'Potion');
      if (mainPotions.length > 0 && !simDeck.heroes.some(h => h?.hero === 'Nicolas, the Hidden Alchemist')) return;

      // Find starting abilities for the new hero from card data
      const newHeroData = cardDB[sideCardName];
      const newAbility1 = newHeroData.startingAbility1 || null;
      const newAbility2 = newHeroData.startingAbility2 || null;

      // Swap hero into side deck, side card into hero slot
      deck.heroes[heroSlotIdx] = { hero: sideCardName, ability1: newAbility1, ability2: newAbility2 };
      deck.sideDeck[sideIdx] = oldHeroName || '';
      // Remove empty strings from side deck
      deck.sideDeck = deck.sideDeck.filter(c => c);
      if (oldHeroName) deck.sideDeck.push(oldHeroName);
    } else {
      // Card swap between main/potion ↔ side
      const fromPool = getPool(from);
      const toPool = getPool(to);
      if (!fromPool || !toPool) return;
      if (fromIdx < 0 || fromIdx >= fromPool.length) return;
      if (toIdx < 0 || toIdx >= toPool.length) return;

      // No direct main↔potion
      if ((from === 'main' && to === 'potion') || (from === 'potion' && to === 'main')) return;

      const cardDB = getCardDB();
      const fromCardName = fromPool[fromIdx];
      const toCardName = toPool[toIdx];

      // Simulate deck state after swap for Nicolas-dependent checks
      const simDeck = { ...deck, heroes: [...(deck.heroes || [])] };

      // Validate both directions using shared type rules
      if (!canCardTypeEnterPool(cardDB, simDeck, fromCardName, to)) return;
      if (!canCardTypeEnterPool(cardDB, simDeck, toCardName, from)) return;

      // Combined Potion cap. A swap that puts a Potion into main/potion
      // from side, in exchange for a non-Potion, increases the combined
      // count by 1 — reject if that would push the total past 15. The
      // symmetric direction (Potion out of main/potion into side, with
      // a non-Potion coming back) decreases the count and is always
      // fine. Potion-for-Potion or non-Potion-for-non-Potion swaps are
      // count-neutral.
      const fromIsPotion = cardDB[fromCardName]?.cardType === 'Potion';
      const toIsPotion = cardDB[toCardName]?.cardType === 'Potion';
      const enteringMainOrPotion =
        (from === 'side' && (to === 'main' || to === 'potion') && fromIsPotion && !toIsPotion)
        || (to === 'side' && (from === 'main' || from === 'potion') && toIsPotion && !fromIsPotion);
      if (enteringMainOrPotion && countCombinedPotions(cardDB, deck) >= 15) return;

      // Swap the cards
      const tmp = fromPool[fromIdx];
      fromPool[fromIdx] = toPool[toIdx];
      toPool[toIdx] = tmp;
    }

    // Send updated deck back to the player
    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: deck,
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  // Move a card from one pool to another (not swap — add/remove)
  socket.on('side_deck_move', ({ roomId, from, fromIdx, to }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    const deck = room._currentDecks[pi];
    if (!deck) return;

    const getPool = (key) => {
      if (key === 'main') return deck.mainDeck;
      if (key === 'potion') return deck.potionDeck;
      if (key === 'side') return deck.sideDeck;
      return null;
    };

    const fromPool = getPool(from);
    const toPool = getPool(to);
    if (!fromPool || !toPool || from === to) return;
    if (fromIdx < 0 || fromIdx >= fromPool.length) return;

    const cardDB = getCardDB();
    const cardName = fromPool[fromIdx];

    // No direct main↔potion
    if ((from === 'main' && to === 'potion') || (from === 'potion' && to === 'main')) return;
    // Validate using shared type rules
    if (!canCardTypeEnterPool(cardDB, deck, cardName, to)) return;
    // Combined Potion cap (15 across main + Potion Deck). Side→main and
    // side→potion moves are the only side-deck phase paths that can
    // increase the combined count; the move is rejected if it would
    // push the total past 15.
    const cardIsPotion = cardDB[cardName]?.cardType === 'Potion';
    const incomingTo = (to === 'main' || to === 'potion');
    const outgoingFrom = (from === 'main' || from === 'potion');
    if (cardIsPotion && incomingTo && !outgoingFrom) {
      if (countCombinedPotions(cardDB, deck) >= 15) return;
    }

    const card = fromPool.splice(fromIdx, 1)[0];
    toPool.push(card);

    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: deck,
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  socket.on('side_deck_reset', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._originalDecks || !room._currentDecks) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0 || room._sideDeckDone?.[pi]) return;

    // Deep clone original back to current
    room._currentDecks[pi] = JSON.parse(JSON.stringify(room._originalDecks[pi]));

    const sid = room.gameState?.players[pi]?.socketId;
    if (sid) {
      io.to(sid).emit('side_deck_update', {
        currentDeck: room._currentDecks[pi],
        opponentDone: room._sideDeckDone[pi === 0 ? 1 : 0] || false,
      });
    }
  });

  socket.on('side_deck_done', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._sideDeckPhase || !room._sideDeckDone) return;
    const pi = room.players.findIndex(p => p.userId === currentUser.userId);
    if (pi < 0) return;

    room._sideDeckDone[pi] = true;

    // Notify opponent
    const oi = pi === 0 ? 1 : 0;
    const oppSid = room.gameState?.players[oi]?.socketId;
    if (oppSid) io.to(oppSid).emit('side_deck_opponent_done');

    // If both done, proceed to next game
    if (room._sideDeckDone[0] && room._sideDeckDone[1]) {
      room._sideDeckPhase = false;
      delete room._sideDeckDone;
      const loserIdx = room._pendingLoserIdx ?? 0;
      delete room._pendingLoserIdx;
      await advanceToNextGame(room, loserIdx);
    }
  });

  // ── Hero Ascension ──

  socket.on('ascend_hero', async ({ roomId, heroIdx, cardName, handIndex }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState || room.gameState.result) return;
    const gs = room.gameState;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    // Must be active player during Main Phase 1 or 2
    if (pi !== gs.activePlayer) return;
    if (gs.currentPhase !== 2 && gs.currentPhase !== 4) return; // MAIN1=2, MAIN2=4
    // Hand waehrend einer laufenden Reaktionskette / eines erzwungenen
    // Abwurfs gesperrt. Aufstiege laufen NICHT ueber validateActionPlay,
    // sie brauchen den Riegel eigens — Als Befund 5.8.: waehrend Ambush
    // aufloeste, liess sich per Spam-Klick eine Waflav-Form ascenden.
    if (gs._chainResolvingLock || gs._forceDiscardLock === pi) return;
    // Perform ascension via engine
    try {
      const result = await room.engine.performAscension(pi, heroIdx, cardName, handIndex);
      if (!result.success) return;
      // Skip to End Phase if required
      if (result.skipEndPhase) {
        // GRUNDMECHANIK, kein Karteneffekt (Als Ruling 16.8.): der
        // Aufstieg beendet den Zug von Regels wegen. Zug-Ende-Immunitaet
        // (Tuscan Prisoner) greift hier ausdruecklich NICHT.
        await room.engine.advanceToPhase(pi, 5, { baseMechanic: true }); // PHASES.END = 5
      }
    } catch (err) {
      console.error('[Engine] ascend_hero error:', err.message, err.stack);
    }
    for (let i = 0; i < 2; i++) sendGameState(room, i);
    sendSpectatorGameState(room);
  });

  // ── Surrender Game vs Surrender Match (Bo3/Bo5) ──

  socket.on('surrender_game', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState || room.gameState.result) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const winnerIdx = pi === 0 ? 1 : 0;
    if (room.type === 'puzzle') { puzzleEndGame(room, winnerIdx, 'surrender'); return; }
    await endGame(room, winnerIdx, 'surrender');
  });

  socket.on('surrender_match', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState) return;
    const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;
    const winnerIdx = pi === 0 ? 1 : 0;
    // Set the winner's score to winsNeeded to end the set
    room.setScore[winnerIdx] = room.winsNeeded;
    if (!room.gameState.result) {
      await endGame(room, winnerIdx, 'surrender');
    }
  });

  socket.on('request_rematch', async ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.gameState?.result) return;
    if (!room.gameState.rematchRequests.includes(currentUser.userId))
      room.gameState.rematchRequests.push(currentUser.userId);
    if (room.gameState.rematchRequests.length >= 2) {
      const loserIdx = room.gameState.result.winnerIdx === 0 ? 1 : 0;
      // Set up fresh game state FIRST so both players see their new hands
      await setupGameState(room);
      for(let i=0;i<2;i++) sendGameState(room, i); sendSpectatorGameState(room);
      // Now ask the loser who goes first — no time limit
      const loserPs = room.gameState.players[loserIdx];
      if (loserPs?.socketId) {
        room._pendingRematch = { roomId, loserIdx };
        io.to(loserPs.socketId).emit('rematch_choose_first', {});
      } else {
        await startGameEngine(room, roomId, loserIdx);
      }
    } else {
      for (let i=0;i<2;i++) sendGameState(room, i);
    }
  });

  socket.on('rematch_first_choice', async ({ roomId, goFirst }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?._pendingRematch) return;
    const { loserIdx } = room._pendingRematch;
    const loserPs = room.gameState?.players?.[loserIdx];
    if (!loserPs || loserPs.userId !== currentUser.userId) return;
    if (room._rematchTimer) { clearTimeout(room._rematchTimer); delete room._rematchTimer; }
    delete room._pendingRematch;
    const activePlayer = goFirst ? loserIdx : (loserIdx === 0 ? 1 : 0);
    await startGameEngine(room, roomId, activePlayer);
  });

  // ── Puzzle / Single-Player Battle ──────────────────────────────────

  // Shared function: create and start a puzzle game from puzzle data
  async function createPuzzleGame(puzzleData, opts = {}) {
    const roomId = 'pz-' + uuidv4().substring(0, 8);
    const cardsByName = getCardDB();
    const usr = await db.get('SELECT color, avatar, cardback, board FROM users WHERE id = ?', [currentUser.userId]);

    const buildPlayerState = (pz, userId, username, socketId, hand) => {
      // Normalize statuses loaded from the puzzle editor so they behave like
      // statuses applied during normal play. The editor stores statuses as
      // either `true` (non-stacking: frozen, stunned, burned, negated, ...)
      // or `{ stacks: N }` (poisoned). Neither shape carries the `appliedTurn`
      // field that cards like Coffee use to tell "inflicted this turn" apart
      // from "inflicted previously". Since puzzle statuses represent the
      // pre-existing board state before the player's turn begins, they MUST
      // count as "not inflicted this turn" — i.e. have an appliedTurn that
      // is strictly less than the puzzle's starting turn (which is 1).
      //
      // We normalize to appliedTurn: 0 for anything missing one. Any future
      // editor format that writes appliedTurn explicitly is preserved.
      const normalizePuzzleStatuses = (raw) => {
        if (!raw || typeof raw !== 'object') return {};
        const out = {};
        for (const key of Object.keys(raw)) {
          const v = raw[key];
          if (v == null || v === false) continue;
          if (v === true) {
            out[key] = { appliedTurn: 0 };
          } else if (typeof v === 'object') {
            out[key] = { appliedTurn: 0, ...v };
            // If editor explicitly set appliedTurn, the spread above already
            // overrode the default (object props win in right-side spread).
          } else {
            // Unknown shape — coerce to a minimal object form
            out[key] = { appliedTurn: 0, value: v };
          }
        }
        return out;
      };

      const heroes = (pz.heroes || []).map(h => {
        if (!h || !h.name) return { name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} };
        const out = {
          name: h.name, hp: h.hp ?? 0, maxHp: h.maxHp ?? h.hp ?? 0,
          atk: h.atk ?? 0, baseAtk: h.baseAtk ?? h.atk ?? 0,
          statuses: normalizePuzzleStatuses(h.statuses),
          buffs: h.buffs ? enrichPuzzleBuffs(JSON.parse(JSON.stringify(h.buffs))) : undefined,
        };
        // Cursed-on-load ATK snapshot. A puzzle hero authored with
        // `statuses: { cursed: true }` would otherwise enter the game
        // with NO `_cursedAtkSuppressed` baseline — Curse#onPlay never
        // runs, and the post-init() fix-up sweep further down already
        // misses the window where ability `onGameStart` hooks
        // (Fighting, Sacred Hammer, …) route their ATK grants through
        // `_applyHeroAtkDelta`, which deposits them into
        // `_cursedAtkSuppressed` BECAUSE the hero is already cursed.
        // The result: cleanse restores ATK to 0 (or to just the
        // ability-granted slice) instead of the true pre-curse value.
        // Snap the baseline BEFORE engine.init() so the ability
        // grants stack onto the right baseline; cleanse then restores
        // base + grants in one shot.
        //
        // The "true ATK" is taken as the maximum of:
        //   - the authored `atk` (in case the author wrote the live
        //     pre-curse value here),
        //   - the authored `baseAtk` (the natural underlying stat),
        //   - the card-DB `atk` (the hero's default per cards.json).
        // The visible `atk` is then zeroed to match the cursed
        // display contract. Genuine 0-base, 0-card-DB heroes are
        // preserved (cleanse restores to 0 because that IS truth).
        if (out.statuses?.cursed) {
          const cardData = cardsByName?.[out.name];
          out._cursedAtkSuppressed = Math.max(
            out.atk || 0,
            out.baseAtk || 0,
            cardData?.atk || 0,
          );
          out.atk = 0;
        }
        // Cosmic Depths Change Counters on a Hero (Argos) — authored
        // in the puzzle editor as `h._changeCounters`. The shared
        // cosmic helpers (getChangeCounters, removeChangeCounters)
        // read this directly off the Hero object, so propagating the
        // raw value through is sufficient.
        if (typeof h._changeCounters === 'number' && h._changeCounters > 0) {
          out._changeCounters = h._changeCounters;
        }
        // Waflav Evolution Counters on a Hero — authored in the puzzle
        // editor as `h._evolutionCounters`. Same deal as above: the
        // shared Waflav helpers read the raw value off the Hero object,
        // so propagating it through is sufficient. Without this the
        // authored value is dropped and no Ascension is affordable.
        if (typeof h._evolutionCounters === 'number' && h._evolutionCounters > 0) {
          out._evolutionCounters = h._evolutionCounters;
        }
        // Invest Counters (Logan, the Investment Monkee) — gleiche
        // Bauart wie oben: der Held traegt den Rohwert, die Projektion
        // fuer den Client filtert sonst alles Unbekannte weg.
        if (typeof h._investCounters === 'number' && h._investCounters > 0) {
          out._investCounters = h._investCounters;
        }
        // Cecilia „has been defeated at least once this game" — die
        // Aufstiegsbedingung ihrer Ascension, im Puzzle-Editor als
        // `h._ceciliaDefeatedOnce` gesetzt. Ohne diese Zeile faellt der
        // Merker aus der Projektion und die Ascension liesse sich im
        // Puzzle nicht testen.
        if (h._ceciliaDefeatedOnce) {
          out._ceciliaDefeatedOnce = true;
        }
        return out;
      });
      while (heroes.length < 3) heroes.push({ name: null, hp: 0, maxHp: 0, atk: 0, baseAtk: 0, statuses: {} });

      return {
        userId, username, socketId,
        color: '#00f0ff', avatar: null, cardback: null, board: null,
        heroes,
        abilityZones: (pz.abilityZones || [[], [], []]).map(hz => (hz || [[], [], []]).map(slot => [...(slot || [])])),
        surpriseZones: (pz.surpriseZones || [[], [], []]).map(sz => [...(sz || [])]),
        supportZones: (pz.supportZones || [[], [], []]).map(hz => (hz || [[], [], []]).map(slot => [...(slot || [])])),
        hand: [...(hand || [])],
        mainDeck: [...(pz.mainDeck || [])],
        potionDeck: [...(pz.potionDeck || [])],
        sideDeck: [...(pz.sideDeck || [])],
        discardPile: [...(pz.discardPile || [])],
        deletedPile: [...(pz.deletedPile || [])],
        disconnected: false, left: false,
        gold: pz.gold ?? 0,
        abilityGivenThisTurn: [false, false, false],
        islandZoneCount: [...(pz.islandZoneCount || [0, 0, 0])],
        damageLocked: false, itemLocked: false,
        dealtDamageToOpponent: false, potionLocked: false,
        potionsUsedThisTurn: 0,
        permanents: (pz.permanents || []).map(pm => ({ name: pm.name, id: pm.id || ('p' + Date.now() + Math.random()) })),
        coolnessStack: [...(pz.coolnessStack || [])],
        _oncePerGameUsed: new Set(),
        _resolvingCard: null,
        deckSkins: {},
      };
    };

    const p0 = buildPlayerState(puzzleData.players[0], currentUser.userId, currentUser.username, socket.id, puzzleData.hand || []);
    const p1 = buildPlayerState(puzzleData.players[1], 'cpu-puzzle', 'CPU', null, puzzleData.oppHand || []);
    if (usr) {
      p0.color = usr.color || '#00f0ff'; p0.avatar = usr.avatar;
      p0.cardback = usr.cardback; p0.board = usr.board;
      // Apply the player's chosen board skin to the CPU side too so the
      // whole puzzle playfield — including the opponent's Area Zone —
      // uses the same skin as a normal game instead of the default.
      p1.board = usr.board;
      p1.cardback = usr.cardback;
    }

    const gs = {
      players: [p0, p1],
      areaZones: (puzzleData.areaZones || [[], []]).map(az => [...(az || [])]),
      turn: 1, activePlayer: 0, currentPhase: 0,
      result: null, rematchRequests: [],
      awaitingFirstChoice: false,
      isPuzzle: true,
      isTutorial: opts.isTutorial || false,
      _puzzleAttemptId: opts.puzzleAttemptId || null,
      _puzzleDifficulty: opts.puzzleDifficulty || null,
      _puzzleRawData: JSON.parse(JSON.stringify(puzzleData)),
      _gameStartTime: Date.now(),
      _playerIPs: [getSocketIP(socket), 'cpu'],
    };

    const room = {
      id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: 'puzzle', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: null },
        { username: 'CPU', userId: 'cpu-puzzle', socketId: null, deckId: null },
      ],
      spectators: [], status: 'playing', created: Date.now(),
      gameState: gs, chatHistory: [], privateChatHistory: {},
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);
    activeGames.set(currentUser.userId, roomId);

    room.engine = new GameEngine(room, io, sendGameState, (r, winnerIdx, reason) => puzzleEndGame(r, winnerIdx, reason), sendSpectatorGameState);
    room.engine.isPuzzle = true;
    room.engine._cpuPlayerIdx = 1;
    room.engine.init();

    // Pre-placed creatures should behave as if summoned last turn (no summoning sickness,
    // count for Alice's damage, etc.). init() sets turnPlayed = current turn (1), so
    // backdate all support zone instances to turn 0.
    for (const inst of room.engine.cardInstances) {
      if (inst.zone === 'support') inst.turnPlayed = 0;
    }

    // ── Apply player-state starting debuffs ──
    // The Puzzle Creator stores `playerDebuffs` as `[meDebuffs, oppDebuffs]`,
    // each an array of registry keys. Most simply set a player flag the
    // engine and UI already read; `flashbanged` additionally tracks a
    // Flashbang sentinel instance in the deleted pile so its onActionUsed
    // hook fires correctly when the affected player takes their first
    // action of the puzzle.
    if (Array.isArray(puzzleData.playerDebuffs)) {
      const flagByKey = {
        flashbanged:        '_flashbangedDebuff',
        summonLocked:       'summonLocked',
        damageLocked:       'damageLocked',
        oppHandLocked:      'oppHandLocked',
        itemLocked:         'itemLocked',
        potionLocked:       'potionLocked',
        supportSpellLocked: 'supportSpellLocked',
        forsaken:           '_discardToDeleteActive',
        handLocked:         'handLocked',
      };
      for (let pi = 0; pi < 2; pi++) {
        const debuffs = puzzleData.playerDebuffs[pi] || [];
        const ps = gs.players[pi];
        if (!ps) continue;
        for (const key of debuffs) {
          const flag = flagByKey[key];
          if (flag) ps[flag] = true;
          if (key === 'flashbanged') {
            // Sentinel Flashbang in the deleted pile, owned by the
            // OPPONENT (whoever would have used the potion), targeting
            // the affected player and pre-armed for the puzzle's first
            // turn so the trigger fires on their first action.
            const opp = pi === 0 ? 1 : 0;
            const inst = room.engine._trackCard('Flashbang', opp, 'deleted', -1, -1);
            if (!inst.counters) inst.counters = {};
            inst.counters.flashbangTargetIdx = pi;
            inst.counters.flashbangArmedTurn = gs.turn;
          }
        }
      }
    }

    // Apply creature custom HP and statuses
    for (let pi = 0; pi < 2; pi++) {
      const pz = puzzleData.players[pi];
      if (!pz) continue;
      for (let hi = 0; hi < (pz.supportZones || []).length; hi++) {
        for (let slot = 0; slot < (pz.supportZones[hi] || []).length; slot++) {
          const cards = pz.supportZones[hi][slot] || [];
          if (cards.length === 0) continue;
          const inst = room.engine.cardInstances.find(c =>
            c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === slot
          );
          if (!inst) continue;
          // Explicitly stamp max HP from cards.json on every preset
          // creature so downstream readers (sacrifice thresholds, Alice's
          // damage, UI displays) see a populated value instead of
          // undefined. Max HP ALWAYS tracks cards.json in puzzle mode —
          // customHp below only affects CURRENT HP.
          const cd = cardsByName[inst.name];
          if (cd?.hp) inst.counters.maxHp = cd.hp;

          const cs = pz._creatureStatuses?.[hi + '-' + slot];

          // Dream-Landers attach: apply BEFORE customHp so any HP bump
          // from `onAttachHero` lands on the base, then customHp can
          // override `currentHp` to the user's authored value. Stamps
          // `inst.counters.attachedHero` and re-runs the creature
          // script's `onAttachHero` so future attach Creatures inherit
          // the same bookkeeping with no engine edits.
          if (cs?.attachedHero) {
            inst.counters.attachedHero = cs.attachedHero;
            const creatureScript = loadCardEffect(inst.name);
            if (typeof creatureScript?.onAttachHero === 'function') {
              try {
                const ctx = room.engine._createContext(inst, {});
                creatureScript.onAttachHero(room.engine, ctx);
              } catch (err) {
                console.error(`[puzzle attachHero] ${inst.name} onAttachHero threw:`, err.message);
              }
            }
          }

          const customHp = pz._customSupportHp?.[hi]?.[slot];
          if (customHp != null) {
            // customHp is CURRENT HP only — may be above or below the
            // card's max. Effects that check max HP still see cards.json.
            inst.counters.currentHp = customHp;
          }
          if (cs) {
            if (cs.frozen) inst.counters.frozen = 1;
            if (cs.stunned) inst.counters.stunned = 1;
            if (cs.burned) inst.counters.burned = 1;
            if (cs.negated) inst.counters.negated = 1;
            // Death Knight's cosmetic Silenced marker — paired with
            // `cs.negated` by the puzzle editor when the author picks
            // the Silenced toggle on a Creature. The marker tells
            // StatusBadges to render the badge as 🤐 Silenced instead
            // of 🚫 Negated; the functional negation comes from the
            // standard `negated` counter set above.
            if (cs._dkSilenced) inst.counters._dkSilenced = 1;
            if (cs.poisoned) { inst.counters.poisoned = 1; inst.counters.poisonStacks = cs.poisoned.stacks || 1; }
            if (cs.buffs) {
              if (!inst.counters.buffs) inst.counters.buffs = {};
              Object.assign(inst.counters.buffs, cs.buffs);
              // Enrich each newly-merged buff with auto-applied fields
              // (e.g. damageMultiplier) — the puzzle creator only saves
              // the user-authored opts, not the registry-derived fields
              // the engine actually reads for damage modifiers.
              enrichPuzzleBuffs(inst.counters.buffs);
            }
            // Taunt mirror: when a puzzle creature carries the
            // forcesTargeting buff, set the functional counter the engine
            // filter actually reads. No pi restriction (= any opposing
            // caster) and no untilTurn (= permanent).
            if (cs.buffs?.forcesTargeting) {
              inst.counters.forcesTargeting = true;
            }
            // Anti Magic Enchantment buff on an Equip needs its functional
            // counter too — the `antiMagicEnchanted` counter is what the
            // engine reads to offer spell-negation, the buff is just the
            // visible icon. Set both so puzzle-authored equips protect heroes.
            if (cs.buffs?.anti_magic_enchanted) {
              inst.counters.antiMagicEnchanted = { ownerPi: pi, charges: 1 };
            }
            // Biomancy Token: a Potion placed in a Support Zone in the
            // puzzle builder represents a Biomancy Token. Apply the same
            // override counters the runtime Biomancy ability sets up so
            // the in-game behavior (Creature/Token with HP, once-per-turn
            // damage effect) is identical whether the token was created
            // during play or authored into a puzzle.
            if (cs.biomancyLevel) {
              // Seit 16.8. ueber `_biomancy-shared.js` — dieselbe Stelle,
              // aus der `biomancy.js` und Kyli ihre Tokens bauen. Die
              // frueher hier inline gepflegte Kopie hatte das Feld
              // `level` im Override NICHT gesetzt: ein im Editor
              // gesetzter Token las damit die `null` der Potion, ein im
              // Spiel entstandener eine echte Zahl. Das fiel an jeder
              // Stelle auseinander, die effektive Kartendaten auswertet
              // (Dark Gears stufenabhaengiges Kostengatter, das
              // Stufen-Abzeichen, der Tooltip). Jetzt sind beide gleich.
              Object.assign(
                inst.counters,
                biomancyTokenCounters(cardsByName[inst.name], cs.biomancyLevel),
              );
            }
            // Cute Hydra Head Counter — authored in the puzzle editor,
            // mirrors what the live `onPlay` handler stamps after the
            // discard prompt. The board renderer keys off
            // `inst.counters.headCounter` for the badge AND the HOPT
            // creature-effect uses it as the cap on different targets,
            // so a puzzle Hydra with N counters can immediately strike
            // up to N targets on its first activation.
            if (typeof cs.headCounter === 'number' && cs.headCounter > 0) {
              inst.counters.headCounter = cs.headCounter;
            }
            // Cosmic Depths Change Counter — authored in the puzzle
            // editor for Analyzer / Gatherer. Stamped onto
            // `inst.counters.changeCounter`, which the shared cosmic
            // helpers read directly via `getChangeCounters` so
            // downstream activations (move, spawn, draw) can spend
            // these starting counters on turn 1. Argos's counter
            // counterpart lives on the Hero object as
            // `hero._changeCounters` and is loaded straight from the
            // puzzle JSON without needing a translation here.
            if (typeof cs.changeCounter === 'number' && cs.changeCounter > 0) {
              inst.counters.changeCounter = cs.changeCounter;
            }
            // Charm of Balance — authored in the puzzle editor.
            // Stamped onto `inst.counters.balance`, which the board
            // badge renders directly and the once-per-turn draw uses
            // as the draw count.
            if (typeof cs.balance === 'number' && cs.balance > 0) {
              inst.counters.balance = cs.balance;
            }
            // Bunny Bombs — im Puzzle-Editor gesetzte Bomb Counter.
            // Landen auf `inst.counters.bunnyBombCounter`; das Kartenskript
            // rechnet daraus beim Tod 20 Schaden je Zaehler, und das
            // Brett zeigt sie als Abzeichen.
            if (typeof cs.bunnyBombCounter === 'number' && cs.bunnyBombCounter > 0) {
              inst.counters.bunnyBombCounter = cs.bunnyBombCounter;
            }
            // Sleeping Beauty's linked-hero slot — authored in the puzzle
            // editor. The link is per-SLOT (matches in-game behavior:
            // a Hero swapped into the slot inherits the tether). Owner
            // is implicit (= Beauty's controller, `pi`). The script
            // reads these counters in `canActivateCreatureEffect` /
            // `onCreatureEffect` / `onCreatureDeath`.
            if (typeof cs._linkedHeroIdx === 'number'
                && cs._linkedHeroIdx >= 0 && cs._linkedHeroIdx <= 2) {
              inst.counters._linkedHeroOwner = pi;
              inst.counters._linkedHeroIdx   = cs._linkedHeroIdx;
            }
            // Sparkfly Queen's sacrifice gifts — authored in the puzzle
            // editor as `_sparkflyGiftFlags: {architect?, attendant?,
            // worker?}`. Run each set flag through the same
            // `grantInheritedAbility` helper Hive's Crown uses so the
            // gift bookkeeping (engine logic flags, BuffColumn icons,
            // inherited-effect tooltip entries, Attendant absolute-
            // immunity counter) is byte-identical to a live game.
            if (cs._sparkflyGiftFlags && inst.name === 'Sparkfly Queen') {
              const { grantInheritedAbility } = require('./cards/effects/_sparkfly-shared');
              if (cs._sparkflyGiftFlags.architect) grantInheritedAbility(inst, 'Sparkfly Architect');
              if (cs._sparkflyGiftFlags.attendant) grantInheritedAbility(inst, 'Sparkfly Attendant');
              if (cs._sparkflyGiftFlags.worker)    grantInheritedAbility(inst, 'Sparkfly Worker');
            }
            // Anti Magic immunity level — authored in the puzzle editor
            // as `antiMagicLevel: 1|2|3`. Stamps the level on
            // `inst.counters.antiMagicLevel` (the source of truth the
            // card's leave-zone cleanup reads to recompute remaining
            // buffs) AND applies the `magic_immune` buff to the host
            // Hero with the matching `level`, so the target-filter +
            // BuffColumn tooltip both read the authored value.
            // Multiple Anti Magics on the same Hero correctly keep the
            // HIGHEST level — `actionAddBuff` overwrites, so we iterate
            // sup zones with a max-by-level pass after stamping.
            if (inst.name === 'Anti Magic'
                && typeof cs.antiMagicLevel === 'number'
                && cs.antiMagicLevel >= 1 && cs.antiMagicLevel <= 3) {
              inst.counters.antiMagicLevel = cs.antiMagicLevel;
              const hostHero = gs.players[pi]?.heroes?.[hi];
              if (hostHero?.name) {
                if (!hostHero.buffs) hostHero.buffs = {};
                const existing = hostHero.buffs.magic_immune?.level || 0;
                if (cs.antiMagicLevel > existing) {
                  hostHero.buffs.magic_immune = {
                    level: cs.antiMagicLevel,
                    source: 'Anti Magic',
                    appliedTurn: gs.turn || 0,
                  };
                }
              }
            }
          }
          // Berserk pre-placement: live play applies the `berserked`
          // status to the host Hero from Berserk's `onPlay` hook,
          // but the puzzle loader skips onPlay entirely — the card
          // is just dropped into the support zone. Mirror the status
          // apply here so a puzzle-authored Berserk lights up the
          // Hero's overlay + status badge immediately and the
          // engine's Spell/Creature lockout + free-Attack grant
          // gates all fire from turn 1. Idempotent: a second
          // Berserk on the same Hero is the boolean no-op the live
          // path also produces.
          //
          // Lives OUTSIDE the `if (cs)` block above because a plain
          // pre-placed Berserk doesn't carry a creature-statuses
          // entry — keying the apply on `inst.name === 'Berserk'` is
          // enough.
          if (inst.name === 'Berserk') {
            const hostHero = gs.players[pi]?.heroes?.[hi];
            if (hostHero?.name && hostHero.hp > 0) {
              if (!hostHero.statuses) hostHero.statuses = {};
              if (!hostHero.statuses.berserked) {
                hostHero.statuses.berserked = {
                  appliedTurn: gs.turn || 0,
                  appliedBy: pi,
                  source: 'Berserk',
                };
              }
            }
          }
          // Curse pre-placement — mirror of Berserk above. Live play
          // applies the `cursed` status AND zeroes hero.atk in the
          // card's onPlay. The puzzle loader skips onPlay, so we
          // replicate both side-effects here so the host Hero opens
          // the puzzle with a 0 ATK display + status badge active.
          // Boolean: a second Curse on the same Hero just sees the
          // existing status and skips re-snapshotting.
          if (inst.name === 'Curse') {
            const hostHero = gs.players[pi]?.heroes?.[hi];
            if (hostHero?.name && hostHero.hp > 0) {
              if (!hostHero.statuses) hostHero.statuses = {};
              if (!hostHero.statuses.cursed) {
                hostHero.statuses.cursed = {
                  appliedTurn: gs.turn || 0,
                  appliedBy: pi,
                  source: 'Curse',
                };
                // Snapshot the live ATK into the hidden accumulator
                // and zero the visible stat — matches what
                // `Curse#onPlay` would do. Cleanse restores from
                // `_cursedAtkSuppressed`.
                hostHero._cursedAtkSuppressed = hostHero.atk || 0;
                hostHero.atk = 0;
              }
            }
          }
          // Invisibility pre-placement — mirror of Berserk / Curse
          // above. Live play stamps `hero.statuses.invisible` on the
          // host from the Attachment's onPlay, but the puzzle loader
          // skips onPlay entirely. Mirror the stamp here so a puzzle-
          // authored Invisibility immediately lights up the Hero's
          // 👻 status badge AND the engine's hero-targeting filter
          // treats the host as hidden (pool-shared with Untargetable)
          // from turn 1.
          if (inst.name === 'Invisibility') {
            const hostHero = gs.players[pi]?.heroes?.[hi];
            if (hostHero?.name && hostHero.hp > 0) {
              if (!hostHero.statuses) hostHero.statuses = {};
              if (!hostHero.statuses.invisible) {
                hostHero.statuses.invisible = {
                  appliedTurn: gs.turn || 0,
                  appliedBy: pi,
                  source: 'Invisibility',
                };
              }
            }
          }
        }
      }
    }

    // Cursed-hero ATK-snapshot fix-up. Two puzzle-authoring patterns
    // can produce a hero with the `cursed` status but no usable
    // `_cursedAtkSuppressed` snapshot (so cleanse would restore the
    // hero to 0 ATK instead of its true pre-curse value):
    //   (a) The author writes `statuses: { cursed: true }` directly
    //       on a hero, without placing a Curse card in their Support
    //       Zone — the Curse pre-placement above never fires.
    //   (b) The author writes `atk: 0` on a hero already showing the
    //       curse alongside a pre-placed Curse card — the snapshot at
    //       line ~10276 captures `hostHero.atk` = 0.
    // Walk every cursed hero post-placement and pick the largest
    // known "true ATK" candidate as the snapshot: the existing
    // `_cursedAtkSuppressed`, the hero's `baseAtk` (the underlying
    // pre-buff stat tracked from puzzle authoring), or the live
    // `atk` field. Then force `atk` to 0 to keep the status's display
    // contract intact. A genuine 0-base, 0-snapshot hero is preserved
    // (cleanse restores to 0 because that IS the true value).
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || !hero.statuses?.cursed) continue;
        const trueAtk = Math.max(
          hero._cursedAtkSuppressed || 0,
          hero.baseAtk || 0,
          hero.atk || 0,
        );
        hero._cursedAtkSuppressed = trueAtk;
        hero.atk = 0;
      }
    }

    // Populated Island Turtle pre-block: a Turtle authored into a
    // Support Zone takes up 3 zones in live play, but the puzzle
    // builder writes it into a single slot. Walk every Hero on
    // both sides and, for each that hosts a Turtle, fill up to 2
    // of its OTHER currently-free slots with the `_ZoneBlocked`
    // sentinel so the multi-zone occupation matches in-game
    // behavior (the client renders sentinel slots with the red ✕
    // overlay; placement validation reads them as occupied).
    // Already-filled slots are left alone — the puzzle author may
    // have intentionally placed companion cards beside the Turtle.
    {
      const TURTLE_NAME = 'Populated Island Turtle';
      const TURTLE_SENTINEL = '_ZoneBlocked';
      for (let pi = 0; pi < 2; pi++) {
        const ps = gs.players[pi];
        if (!ps?.supportZones) continue;
        for (let hi = 0; hi < ps.supportZones.length; hi++) {
          const sup = ps.supportZones[hi] || [];
          let turtleSlot = -1;
          for (let z = 0; z < sup.length; z++) {
            if ((sup[z] || [])[0] === TURTLE_NAME) { turtleSlot = z; break; }
          }
          if (turtleSlot < 0) continue;
          let blocked = 0;
          for (let z = 0; z < sup.length && blocked < 2; z++) {
            if (z === turtleSlot) continue;
            if ((sup[z] || []).length === 0) {
              sup[z] = [TURTLE_SENTINEL];
              blocked++;
            }
          }
        }
      }
    }

    // Track permanents
    for (let pi = 0; pi < 2; pi++) {
      for (const pm of (gs.players[pi].permanents || [])) {
        room.engine._trackCard(pm.name, pi, 'permanent');
      }
    }

    // Track area cards. Ohne Instanz haengt kein Zaehler und kein
    // Effekt an ihnen — im Puzzle werden die Zonen aber direkt aus den
    // Puzzle-Daten befuellt, ohne dass die Karten je gespielt wurden.
    for (let pi = 0; pi < 2; pi++) {
      for (const areaName of (gs.areaZones?.[pi] || [])) {
        const vorhanden = room.engine.cardInstances.find(c =>
          c.name === areaName && c.zone === 'area' && c.owner === pi);
        if (!vorhanden) room.engine._trackCard(areaName, pi, 'area');
      }
    }

    // Doom Clock: Startzaehler aus den Puzzle-Daten (Als Vorgabe 5.8.).
    // `puzzleData.doomCounters` ist [meineUhr, gegnerUhr].
    if (puzzleData.doomCounters) {
      const DC = require('./cards/effects/_doom-clock-shared');
      for (let pi = 0; pi < 2; pi++) {
        const start = Number(puzzleData.doomCounters[pi]) || 0;
        if (start <= 0) continue;
        const uhr = room.engine.cardInstances.find(c =>
          c.name === 'Doom Clock' && c.zone === 'area' && c.owner === pi);
        if (!uhr) continue;
        if (!uhr.counters) uhr.counters = {};
        // Direkt setzen statt ueber placeCounter: das hier ist der
        // AUFBAU, kein Legen — sonst wuerden Trigger feuern und bei
        // 20 sofort das Spiel beenden.
        uhr.counters.doom = Math.max(0, Math.min(19, start));
      }
      DC.syncDisplay(room.engine);
    }

    // Start the puzzle game — go directly to Main Phase 1
    socket.emit('room_joined', { id: roomId, host: currentUser.username, players: room.players.map(p => ({ username: p.username })), spectators: [], status: 'playing', type: 'puzzle' });
    socket.emit('game_started', { id: roomId, players: room.players.map(p => ({ username: p.username })), status: 'playing', type: 'puzzle' });

    (async () => {
      try {
        for (const ps of gs.players) {
          if (!ps) continue;
          ps.summonLocked = false; ps.handLocked = false; ps.damageLocked = false;
          ps.dealtDamageToOpponent = false; ps.potionLocked = false;
          ps.oppHandLocked = false;
          ps.supportSpellLocked = false; ps.supportSpellUsedThisTurn = false;
          ps.potionsUsedThisTurn = 0; ps.attacksPlayedThisTurn = 0; ps.spellsPlayedThisTurn = 0;
          ps.comboLockHeroIdx = null; ps.heroesActedThisTurn = []; ps.heroesAttackedThisTurn = [];
          ps._creaturesSummonedThisTurn = 0; ps.bonusActions = null; ps._bonusMainActions = 0;
          ps._actionsPlayedThisPhase = 0;
          ps.abilityGivenThisTurn = [false, false, false];
          // Mirror the engine's startTurn discard-snapshot — without
          // this, puzzles start with an empty Set and any "was this
          // card already in discard before this turn?" gate (Thep, the
          // Court Scribe; future same-shape effects) would treat every
          // pre-placed discard card as "freshly added this turn" and
          // filter it out. Universal across card types — discard pile
          // is name-only.
          ps._discardNamesAtTurnStart = new Set(ps.discardPile || []);
          for (const hero of (ps.heroes || [])) {
            if (hero?._actionsThisTurn) hero._actionsThisTurn = 0;
            if (hero?._attacksThisTurn) hero._attacksThisTurn = 0;
          }
        }
        room.engine._resetTerrorTracking();
        await room.engine.runHooks('onGameStart', { _skipReactionCheck: true });
        // Mirror the normal-game pre-draw timing for cards whose
        // effect "triggers at the start of the game, before both
        // players draw their starting hands" (Bill, the Angry
        // Auctioneer; Sid, the King of Thieves; future similar).
        // Puzzles preset the hand instead of drawing, but the hook
        // still has to run so those Heroes' opening effects fire on
        // every puzzle attempt.
        await room.engine.runHooks('onBeforeHandDraw', { _skipReactionCheck: true });
        // Auto-reveal pass for preset hands. Live games route every
        // hand-add through `actionDrawCards` / `actionAddCard-
        // FromDeckToHand` / etc., which call
        // `_autoRevealOnEnterHand` per slot — but puzzle hands are
        // copied directly from `puzzleData` into `ps.hand` and never
        // touch those helpers. Without this pass, a puzzle that
        // starts with a Weakening / Mana Absorbing / Distracting
        // Crystal in hand would NOT have it revealed, which silently
        // disables the Crystal's whole effect set (hero-effect
        // negation, +1 Spell levels, shuffle-into-deck lock).
        for (let pi = 0; pi < (gs.players || []).length; pi++) {
          const ps = gs.players[pi];
          if (!ps?.hand) continue;
          for (let i = 0; i < ps.hand.length; i++) {
            room.engine._autoRevealOnEnterHand(pi, i, ps.hand[i]);
          }
        }
        // Puzzles skip the normal Resource/Action phases and jump straight to Main Phase 1.
        // Fire onTurnStart so cards that rely on it for per-turn setup (Slime Rancher,
        // additional actions, etc.) are correctly initialised before the player acts.
        await room.engine.runHooks('onTurnStart', { playerIdx: 0, _skipReactionCheck: true });
        gs.currentPhase = 2; // PHASES.MAIN1
        gs.unactivatableArtifacts = room.engine.getUnactivatableArtifacts(0);
        room.engine.log('phase_start', { phase: 'Main Phase 1' });
        room.engine.sync();
      } catch (err) {
        console.error('[Puzzle] startup error:', err.message, err.stack);
      }
    })();

    return roomId;
  }

  // Creator test: raw puzzle data from client
  socket.on('start_puzzle', (puzzleData) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }
    if (!puzzleData?.players?.[0] || !puzzleData?.players?.[1]) { socket.emit('puzzle_error', 'Invalid puzzle data'); return; }
    createPuzzleGame(puzzleData).catch(err => {
      console.error('[Puzzle] start_puzzle error:', err.message, err.stack);
      socket.emit('puzzle_error', 'Failed to start puzzle: ' + err.message);
    });
  });

  // Export puzzle: encrypt server-side, send back to client for download
  socket.on('export_puzzle', (puzzleData) => {
    if (!currentUser) return;
    try {
      const encrypted = encryptPuzzle(puzzleData);
      socket.emit('puzzle_exported', { data: encrypted });
    } catch (err) {
      console.error('[Puzzle] export error:', err.message);
      socket.emit('puzzle_error', 'Encryption failed: ' + err.message);
    }
  });

  // Get puzzle list: read puzzle files, check completions
  socket.on('get_puzzles', async () => {
    if (!currentUser) return;
    try {
      const puzzlesDir = path.join(__dirname, 'data', 'puzzles');
      const difficulties = ['easy', 'medium', 'hard'];
      const puzzles = [];

      for (const diff of difficulties) {
        const dir = path.join(puzzlesDir, diff);
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
        for (const file of files) {
          const name = file.replace(/\.json$/, '');
          const puzzleId = diff + '/' + name;
          puzzles.push({ name, difficulty: diff, puzzleId });
        }
      }

      // Check completions for this user
      const completions = await db.all(
        'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ?',
        [currentUser.userId]
      );
      const completedSet = new Set(completions.map(r => r.puzzle_id));

      socket.emit('puzzle_list', puzzles.map(p => ({
        ...p,
        completed: completedSet.has(p.puzzleId),
      })));
    } catch (err) {
      console.error('[Puzzle] get_puzzles error:', err.message);
      socket.emit('puzzle_list', []);
    }
  });

  // Attempt an official puzzle: decrypt file, start game
  socket.on('start_puzzle_attempt', ({ puzzleId, difficulty }) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }

    (async () => {
      try {
        const filePath = path.join(__dirname, 'data', 'puzzles', difficulty, puzzleId.split('/')[1] + '.json');
        if (!fs.existsSync(filePath)) { socket.emit('puzzle_error', 'Puzzle not found'); return; }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const puzzleData = decryptPuzzle(raw.data);

        await createPuzzleGame(puzzleData, {
          puzzleAttemptId: puzzleId,
          puzzleDifficulty: difficulty,
        });
      } catch (err) {
        console.error('[Puzzle] start_puzzle_attempt error:', err.message, err.stack);
        socket.emit('puzzle_error', 'Failed to load puzzle: ' + err.message);
      }
    })();
  });

  // ── Singleplayer CPU battle ──
  // `campaign` (optional) schaltet auf ein KAMPAGNEN-Duell um:
  //   { duelId, opponent, opponentName, retry, bgm }
  // Der Unterschied zum normalen CPU-Kampf ist bewusst klein — dieselbe
  // Raumeinrichtung, dieselbe Mulligan-Choreografie, dasselbe Gehirn.
  // Abweichend sind nur: die Deck-Herkunft (Spielerdeck aus dem
  // Speicherstand, Gegnerdeck aus public/campaign/decks) und der
  // Abschluss (keine SC-Belohnung, keine npc_stats, keine
  // Gegner-Freischaltung — die Story wertet selbst aus).
  async function createCpuBattle({ playerDeckId, cpuDeckId, campaign }) {
    if (!currentUser) { socket.emit('cpu_battle_error', 'Not authenticated'); return; }
    if (activeGames.has(currentUser.userId)) { socket.emit('cpu_battle_error', 'Already in a game'); return; }

    // Player deck must be owned (their own custom deck or owned sample).
    // CPU deck can be ANY sample — the CPU playing a structure deck
    // doesn't grant the human anything, and blocking unowned structure
    // decks for the CPU just breaks rematch flows when the UI dropdown
    // offers them as legal options.
    const fetchDeck = async (deckId, { allowUnownedStructure = false, label = 'deck' } = {}) => {
      if (!deckId) {
        console.warn(`[createCpuBattle] ${label}: no deckId provided`);
        return null;
      }
      if (deckId.startsWith('sample-')) {
        const samples = loadSampleDecks();
        const pick = samples.find(s => s.id === deckId) || null;
        if (!pick) {
          console.warn(`[createCpuBattle] ${label}: sample deck '${deckId}' not found in loadSampleDecks() output (${samples.length} available)`);
          return null;
        }
        if (pick.isStructure && !allowUnownedStructure) {
          const owned = await db.get(
            "SELECT id FROM user_shop_items WHERE user_id = ? AND item_type = 'structure_deck' AND item_id = ?",
            [currentUser.userId, pick.structureId]
          );
          if (!owned) {
            console.warn(`[createCpuBattle] ${label}: structure deck '${pick.name}' (structureId=${pick.structureId}) not owned by ${currentUser.username}`);
            return null;
          }
        }
        return pick;
      }
      const row = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, currentUser.userId]);
      if (!row) {
        console.warn(`[createCpuBattle] ${label}: user deck id='${deckId}' not found in DB for user ${currentUser.username}`);
        return null;
      }
      return parseDeck(row);
    };

    let playerDeck, cpuDeck;
    if (campaign) {
      // Spielerdeck kommt aus dem SPEICHERSTAND, nicht vom Client — sonst
      // könnte man im Story-Modus ein beliebiges Deck einschmuggeln.
      let saved = null;
      try {
        const row = await db.get('SELECT state FROM campaign_progress WHERE user_id = ?', [currentUser.userId]);
        saved = row ? JSON.parse(row.state) : null;
      } catch { saved = null; }
      playerDeck = saved && saved.deck ? saved.deck : null;
      if (!campaignDeckLegal(playerDeck)) {
        socket.emit('cpu_battle_error', 'Your campaign deck is incomplete (3 Heroes, 60 cards).');
        return;
      }
      cpuDeck = loadCampaignDeck(campaign.opponent);
      if (!campaignDeckLegal(cpuDeck)) {
        socket.emit('cpu_battle_error', 'Campaign deck "' + campaign.opponent + '" is missing or incomplete.');
        return;
      }
      playerDeckId = 'campaign-player';
      cpuDeckId = 'campaign-' + campaign.opponent;
      console.log(`[Campaign] Duell '${campaign.duelId}' gegen '${campaign.opponent}' für ${currentUser.username}`);
    } else {
      console.log(`[createCpuBattle] playerDeckId='${playerDeckId}' cpuDeckId='${cpuDeckId}' user=${currentUser.username}`);
      playerDeck = await fetchDeck(playerDeckId, { label: 'player' });
      cpuDeck = await fetchDeck(cpuDeckId, { allowUnownedStructure: true, label: 'cpu' });
      if (!playerDeck) { socket.emit('cpu_battle_error', 'Your deck is not available'); return; }
      if (!cpuDeck) { socket.emit('cpu_battle_error', 'CPU deck is not available'); return; }

      // Opponents are unlock-gated. The gallery only surfaces unlocked ones,
      // but guard the socket path against crafted requests / stale clients.
      if (typeof cpuDeckId === 'string' && cpuDeckId.startsWith('sample-')) {
        const unlocked = await getUnlockedOpponentIds(currentUser.userId);
        if (!unlocked.has(cpuDeckId)) { socket.emit('cpu_battle_error', 'Opponent not unlocked yet'); return; }
      }
    }

    const snapshotDeck = (d) => JSON.parse(JSON.stringify({
      mainDeck: d.mainDeck || [], heroes: d.heroes || [],
      potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
      skins: d.skins || {},
    }));

    const roomId = 'sp-' + uuidv4().substring(0, 8);
    const room = {
      id: roomId, host: currentUser.username, hostId: currentUser.userId,
      type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: currentUser.username, userId: currentUser.userId, socketId: socket.id, deckId: playerDeckId },
        { username: 'CPU', userId: 'cpu-sp-' + roomId, socketId: null, deckId: cpuDeckId },
      ],
      spectators: [], status: 'waiting', created: Date.now(),
      gameState: null, chatHistory: [], privateChatHistory: {},
      // Pre-populate _currentDecks so setupGameState uses our fetched decks
      // directly instead of re-querying per-player (which would fail for the CPU user).
      _currentDecks: [snapshotDeck(playerDeck), snapshotDeck(cpuDeck)],
      // Merker für die Revanche-Behandlung und den Abschluss.
      _campaign: campaign || null,
    };
    rooms.set(roomId, room);
    socket.join('room:' + roomId);

    await setupGameState(room);
    if (campaign) {
      room.gameState.isCampaign = true;
      room.gameState.campaignRetry = campaign.retry !== false;
      room.gameState._campaignDuelId = campaign.duelId || null;
      room.gameState.isAnte = !!campaign.ante;
      // Testschalter (siehe CAMPAIGN_TEST_ENEMY_HP): greift NACH
      // setupGameState und VOR startGameEngine, damit die Engine die
      // gesenkten Werte als Ausgangslage übernimmt.
      if (CAMPAIGN_TEST_ENEMY_HP != null) {
        for (const h of (room.gameState.players?.[1]?.heroes || [])) {
          if (!h || !h.name) continue;
          h.hp = CAMPAIGN_TEST_ENEMY_HP;
          h.maxHp = CAMPAIGN_TEST_ENEMY_HP;
        }
        console.log('[Campaign] TEST: Gegner-Helden auf ' + CAMPAIGN_TEST_ENEMY_HP + ' HP gesetzt.');
      }
      // Name UND Avatar des Gegners stehen in der Story, nicht im Deck.
      // Ohne den Avatar zeigte das Kampffeld den Zuschnitt des mittleren
      // Helden — im Story-Modus sitzt dort aber eine FIGUR, kein Deck.
      // `game-hand-avatar` greift, sobald players[1].avatar gesetzt ist.
      if (room.gameState.players?.[1]) {
        if (campaign.opponentName) room.gameState.players[1].username = campaign.opponentName;
        // Nur Pfade aus dem Kampagnen-Portraitordner zulassen.
        const av = String(campaign.opponentAvatar || '');
        if (/^\/campaign\/avatars\/[^./][^/]*$/.test(av)) {
          room.gameState.players[1].avatar = av;
        }
      }
    }
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    console.log(`[SP trace] firstPlayer=${firstPlayer} (0=human, 1=CPU)`);
    await startGameEngine(room, roomId, firstPlayer, (engine) => {
      engine.onGameOver = (r, winnerIdx, reason) => (campaign
        ? endCampaignBattle(r, winnerIdx, reason)
        : endCpuBattle(r, winnerIdx, reason));
      engine._cpuPlayerIdx = 1;
      installCpuBrain(engine);
      // Demo-Recorder (Als Pilot-Spiele): zeichnet menschlich gespielte
      // Singleplayer-Partien Play-by-Play auf — Aktivierung über
      // PP_DEMO_RECORD=1, Mensch ist Spieler 0. Hängt sich NACH der
      // onGameOver-Zuweisung ein und kettet sich daran.
      // (Die Demo-Aufnahme hängt jetzt zentral in startGameEngine —
      //  siehe dort. Hier nichts mehr zu tun.)
      console.log(`[SP trace] afterInit — brain installed, _cpuPlayerIdx=${engine._cpuPlayerIdx}`);
    });
    console.log(`[SP trace] startGameEngine returned — mulliganPending=${room.gameState.mulliganPending}`);
    room.engine._cpuDriver = makeCpuDriver(room);
    // Opening greeting bark — the very first CPU dialogue of the match.
    // Fired shortly after setup so the board (and avatar) are rendered on
    // the client; reuses the cpu_bark transient-bubble path. Rematches run
    // back through createCpuBattle, so this covers them too.
    {
      const _gIdx = room.engine?._cpuPlayerIdx;
      const _greet = (typeof _gIdx === 'number' && _gIdx >= 0)
        ? room.gameState?.players?.[_gIdx]?.greetingMsg : '';
      if (_greet) setTimeout(() => {
        try { room.engine?._broadcastEvent('cpu_bark', { owner: _gIdx, text: _greet }); } catch {}
      }, 700);
    }
    if (room.gameState.mulliganDecisions) {
      // CPU smart-mulligan: evaluate the opening hand. If too few cards are
      // playable in the first couple of turns, shuffle back and redraw.
      const mull = (() => {
        try { return shouldMulliganStartingHand(room.engine, 1); }
        catch (err) { console.error('[CPU mulligan] check threw:', err.message); return false; }
      })();

      // Show the mulligan prompt to the human immediately (their own
      // hand + the CPU as opponent). The CPU's swap is then ANIMATED in
      // the background — cards fly back to the deck, then new ones are
      // drawn — exactly like a human opponent's mulligan, instead of
      // the old instant synchronous swap.
      for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);

      // Race-free start: we deliberately do NOT set mulliganDecisions[1]
      // until the animation finishes, so the human's mulligan_decision
      // handler can't fire startGame() while the CPU hand is mid-swap.
      // Whichever side finishes last triggers the start (mirrors the
      // human handler's checkBothReady, incl. its single-fire guard).
      const maybeStartAfterCpuMulligan = () => {
        const gs = room.gameState;
        if (!gs || !gs.mulliganDecisions) return; // already started, or aborted
        if (gs.mulliganDecisions[0] === null || gs.mulliganDecisions[1] === null) return;
        console.log(`[SP trace] mulligan both decided — activePlayer=${gs.activePlayer}, calling engine.startGame()`);
        gs.mulliganPending = false;
        delete gs.mulliganDecisions;
        for (let i = 0; i < 2; i++) sendGameState(room, i); sendSpectatorGameState(room);
        room.engine.startGame()
          .then(() => console.log('[SP trace] engine.startGame() resolved'))
          .catch(err => console.error('[Engine] startGame error:', err.message));
      };

      (async () => {
        try {
          if (mull) {
            const ps = room.gameState.players[1];
            const cardDB = getCardDB();
            const handSize = ps.hand.length;
            let potionCount = 0;
            const shuffleArr = (arr) => {
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
            };
            // Return cards to deck one-by-one (reverse-draw animation),
            // broadcasting per card with the same cadence as the human
            // mulligan handler so the client's opponent-mulligan
            // animation triggers identically.
            for (let i = 0; i < handSize; i++) {
              if (!room.gameState) return;
              const card = ps.hand.shift();
              const cd = cardDB[card];
              if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
              else { ps.mainDeck.push(card); }
              for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
              await new Promise(r => setTimeout(r, 180));
            }
            await new Promise(r => setTimeout(r, 1000));
            shuffleArr(ps.mainDeck);
            shuffleArr(ps.potionDeck);
            const mainToDraw = handSize - potionCount;
            for (let i = 0; i < mainToDraw; i++) {
              if (!room.gameState || ps.mainDeck.length === 0) break;
              ps.hand.push(ps.mainDeck.shift());
              for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
              await new Promise(r => setTimeout(r, 200));
            }
            for (let i = 0; i < potionCount; i++) {
              if (!room.gameState || ps.potionDeck.length === 0) break;
              ps.hand.push(ps.potionDeck.shift());
              for (let p = 0; p < 2; p++) sendGameState(room, p); sendSpectatorGameState(room);
              await new Promise(r => setTimeout(r, 200));
            }
            console.log(`[SP trace] CPU mulligan accepted — new hand size=${ps.hand.length}`);
          }
        } catch (err) {
          console.error('[CPU mulligan] animation threw:', err.message);
        } finally {
          if (room.gameState?.mulliganDecisions) {
            room.gameState.mulliganDecisions[1] = mull;
            console.log(`[SP trace] CPU mulligan decided — decisions=${JSON.stringify(room.gameState.mulliganDecisions)}`);
          }
          maybeStartAfterCpuMulligan();
        }
      })();
    } else {
      for (let i = 0; i < 2; i++) sendGameState(room, i);
    }
  }

  // Abschluss eines KAMPAGNEN-Duells. Bewusst mager: kein SC, keine
  // W/L-Statistik, keine Gegner-Freischaltung. Belohnungen und Folgen
  // bestimmt die Szene (onWin/onLose), der Server meldet nur, wie es
  // ausging.
  function endCampaignBattle(room, winnerIdx, reason) {
    const gs = room.gameState;
    if (!gs || gs.result) return;
    const loserIdx = winnerIdx === 0 ? 1 : 0;
    gs.result = {
      winnerIdx, reason,
      winnerName: gs.players[winnerIdx]?.username || '?',
      loserName: gs.players[loserIdx]?.username || '?',
      isRanked: false, eloChanges: null,
      setScore: [0, 0], setOver: true, format: 1,
      isCpuBattle: true, isCampaign: true,
      campaignDuelId: gs._campaignDuelId || null,
      scAwarded: 0,
    };
    gs.rematchRequests = [];
    // Wie bei endCpuBattle: MCTS-Rollouts teilen sich den echten
    // Zustand — ohne diesen Riegel meldet jede Simulation ein
    // Duellergebnis an den Client.
    if (room.engine?._fastMode) return;
    room.status = 'finished';
    const sid = room.players?.[0]?.socketId;
    if (sid) io.to(sid).emit('campaign_duel_result', {
      duelId: gs._campaignDuelId || null,
      won: winnerIdx === 0,
      reason,
    });

    // ── ANTE ──
    // Der Sieger nimmt eine Karte aus dem Bestand des Verlierers.
    // Gewinnt der Mensch, bekommt er die Auswahl geschickt; verliert
    // er, wählt der Gegner sofort und das Ergebnis geht direkt raus.
    if (room._campaign && room._campaign.ante && sid) {
      try {
        const deck = (room._currentDecks || [])[loserIdx] || {};
        const { pool, fromDeck } = campaignAntePool(gs, loserIdx, deck);
        gs._ante = { pool, taken: null, youWon: winnerIdx === 0 };
        if (!pool.length) {
          console.warn('[Campaign] Ante: leerer Pool, übersprungen.');
        } else if (winnerIdx === 0) {
          io.to(sid).emit('campaign_ante_prompt', {
            duelId: gs._campaignDuelId || null, pool, fromDeck,
          });
        } else {
          const pick = campaignAnteCpuPick(pool);
          gs._ante.taken = pick;
          console.log(`[Campaign] Ante: Gegner nimmt "${pick}" (Pool ${pool.length}${fromDeck ? ', aus dem Deck' : ''}).`);
          io.to(sid).emit('campaign_ante_result', {
            duelId: gs._campaignDuelId || null, youWon: false, card: pick,
          });
        }
      } catch (err) {
        console.error('[Campaign] Ante fehlgeschlagen:', err.message, err.stack);
      }
    }

    for (let i = 0; i < 2; i++) sendGameState(room, i);
  }

  // Der Mensch hat gewonnen und eine Karte aus dem Pool gewählt.
  socket.on('campaign_ante_pick', ({ roomId, cardName }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._campaign || !room._campaign.ante) return;
    if (!room.players?.some(p => p.userId === currentUser.userId)) return;
    const gs = room.gameState;
    if (!gs || !gs._ante || gs._ante.taken) return;      // nur EINMAL
    if (!gs._ante.youWon) return;                        // Verlierer wählt nicht
    if (!gs._ante.pool.includes(cardName)) return;       // nur aus dem Pool
    gs._ante.taken = cardName;
    console.log(`[Campaign] Ante: Spieler nimmt "${cardName}".`);
    socket.emit('campaign_ante_result', {
      duelId: gs._campaignDuelId || null, youWon: true, card: cardName,
    });
  });

  // Start eines Kampagnen-Duells. Der Client übergibt NUR die Kennung
  // des Gegnerdecks und die Duell-Id aus der Szene.
  // `opponentAvatar` MUSS hier mit ausgepackt werden — beim ersten
  // Anlauf stand es zwar im Client-Aufruf und wurde weiter unten in
  // createCpuBattle auch ausgewertet, fiel aber genau hier unter den
  // Tisch. Ergebnis: das Kampffeld fiel weiter auf den Zuschnitt des
  // mittleren Helden zurück.
  socket.on('start_campaign_duel', ({ duelId, opponent, opponentName, opponentAvatar, ante }) => {
    if (!currentUser) return;
    createCpuBattle({ campaign: { duelId, opponent, opponentName, opponentAvatar, ante: !!ante } })
      .catch(err => {
        console.error('[Campaign] Duell-Start fehlgeschlagen:', err.message, err.stack);
        socket.emit('cpu_battle_error', 'Could not start duel: ' + (err.message || 'unknown'));
      });
  });

  // ── TESTTASTEN IM KAMPAGNEN-DUELL (7.8.) ──
  // Im Story-Modus beendet "1" das Duell als Sieg und "0" als
  // Niederlage — damit lassen sich Verzweigungen prüfen, ohne jedes
  // Mal ein ganzes Spiel zu spielen. Greift AUSSCHLIESSLICH in Räumen
  // mit `_campaign`; reguläre CPU- und PvP-Kämpfe kennen den Weg nicht.
  socket.on('campaign_debug_end', ({ roomId, win }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room || !room._campaign) return;
    if (!room.players?.some(p => p.userId === currentUser.userId)) return;
    if (!room.gameState || room.gameState.result) return;
    console.log(`[Campaign] Testtaste: Duell '${room.gameState._campaignDuelId}' als ${win ? 'SIEG' : 'NIEDERLAGE'} beendet.`);
    endCampaignBattle(room, win ? 0 : 1, 'debug_key');
  });

  // Debug: snapshot → mutate heavily → restore → compare. Verifies the
  // engine's snapshot/restore methods produce byte-identical state after
  // a round-trip. Client can trigger via:
  //   window.socket.emit('debug_cpu_snapshot_test', { roomId: <current room id> })
  // Results print on the server console AND echo back to the client.
  onDebug('debug_cpu_snapshot_test', ({ roomId }) => {
    if (!currentUser) return;
    const room = rooms.get(roomId);
    if (!room?.engine) {
      const msg = 'no engine for room';
      console.log('[snapshot test]', msg);
      socket.emit('debug_cpu_snapshot_test_result', { ok: false, msg });
      return;
    }
    const engine = room.engine;
    const serialize = (v) => JSON.stringify(v, (_k, val) => {
      if (val instanceof Set) return { __set: [...val].sort() };
      if (val instanceof Map) return { __map: [...val].sort() };
      return val;
    });
    try {
      // 1. Take the snapshot.
      const snap = engine.snapshot();
      const beforeJson = serialize(snap);

      // 2. Mutate the engine heavily — fake some in-place changes.
      const t0 = Date.now();
      const gs = engine.gs;
      // Scramble hand of each player
      for (const ps of gs.players) {
        if (ps?.hand) ps.hand.reverse();
        if (ps) ps.gold = (ps.gold || 0) + 777;
      }
      gs.turn += 42;
      gs.currentPhase = 99;
      gs._dummyField = 'injected';
      engine.eventId += 1000;
      engine.cardInstances.push({
        id: 'sentinel-id', name: 'Sentinel Card', owner: 0,
        originalOwner: 0, controller: 0, zone: 'hand', heroIdx: -1,
        zoneSlot: -1, faceDown: false, statuses: {}, counters: {},
        turnPlayed: 0, activatedThisChain: false, script: null,
      });
      if (engine.cardInstances[0]) engine.cardInstances[0].counters._corrupted = true;

      // 3. Restore.
      engine.restore(snap);
      const afterJson = serialize(engine.snapshot());

      // 4. Compare.
      const ok = beforeJson === afterJson;
      const elapsed = Date.now() - t0;
      const snapSize = (beforeJson.length / 1024).toFixed(1);
      if (ok) {
        console.log(`[snapshot test] PASS — ${elapsed}ms round-trip, snapshot ~${snapSize}KB, ${engine.cardInstances.length} card instances`);
      } else {
        // Find the first divergence for triage.
        let i = 0;
        while (i < beforeJson.length && i < afterJson.length && beforeJson[i] === afterJson[i]) i++;
        const ctx = Math.max(0, i - 40);
        console.log(`[snapshot test] FAIL — state diverged at char ${i}`);
        console.log(`  expected: ...${beforeJson.slice(ctx, i + 80)}`);
        console.log(`  actual:   ...${afterJson.slice(ctx, i + 80)}`);
      }
      socket.emit('debug_cpu_snapshot_test_result', {
        ok, elapsed, snapSize: Number(snapSize), instCount: engine.cardInstances.length,
      });
    } catch (err) {
      console.error('[snapshot test] THREW:', err.message, err.stack);
      socket.emit('debug_cpu_snapshot_test_result', { ok: false, err: err.message });
    }
  });

  // ═══════════════════════════════════════════
  //  SELF-PLAY TEST HARNESS
  //  Trigger from browser console:
  //    socket.emit('debug_self_play_run', { count: 10, deckIdA: <id>, deckIdB: <id> })
  //    socket.on('debug_self_play_progress', console.log)
  //    socket.on('debug_self_play_result', console.log)
  //  Both deckIds are optional — defaults to your first deck for both sides.
  //  Runs N games sequentially (CPU vs CPU, both running the MCTS brain),
  //  reports per-game winner / turn-count / duration plus a final summary.
  //
  //  Three pairing modes:
  //    • Default (no `random`, no `pinDeckName(s)`) — fixed deck A vs deck B.
  //    • `random: true`                              — both decks picked randomly
  //                                                    per game from the pool.
  //    • `pinDeckName: 'Gather That Storm'`          — one slot fixed to the
  //                                                    named deck (substring
  //                                                    match), other slot drawn
  //                                                    randomly from the
  //                                                    remaining pool. Side
  //                                                    assignment (p0 vs p1)
  //                                                    flips 50/50 each game.
  //    • `pinDeckNames: ['A', 'B']` (multi-pin)     — one slot drawn each game
  //                                                    from the named set; other
  //                                                    slot from the rest.
  //
  //  Extra options:
  //    • `samplesOnly: true` — opponent pool is restricted to canonical
  //      Starter / Structure decks; user-saved decks are excluded. Pinned
  //      names also only resolve against samples in this mode.
  //    • `cpuSkipCardNames: ['Lifeforce Howitzer']` — runtime block-list:
  //      the CPU brain refuses to proactively play any of these cards
  //      during the run. Useful for isolating suspected problem cards
  //      without modifying their scripts. Cleared when the game ends.
  //
  //  Examples:
  //    // Single-pin vs the field
  //    socket.emit('debug_self_play_run', { count: 100, pinDeckName: 'Gather That Storm' })
  //    // Multi-pin (rotate the pinned slot between two decks) vs sample
  //    // decks only, blocking Howitzer from CPU's proactive play list
  //    socket.emit('debug_self_play_run', {
  //      count: 300,
  //      pinDeckNames: ["Structure Deck: Man's Best Friends", 'Structure Deck: To Attain Divinity'],
  //      samplesOnly: true,
  //      cpuSkipCardNames: ['Lifeforce Howitzer'],
  //    })
  // ═══════════════════════════════════════════

  // Heal Burn per-game instrumentation removed — every self-play OOM during
  // testing was a Heal Burn match, and even though the diagnostic wrappers
  // short-circuited inside `_inMctsSim`, they still wrapped every heal /
  // damage call in an async layer that compounded under 2-turn rollout on
  // a heal-heavy deck. Win-rate for Heal Burn is tracked via the normal
  // deck table; if synergy-specific debugging is needed again, reinstate
  // from git history.

  async function runOneSelfPlayGame(deckA, deckB, opts = {}) {
    // `cpuSkipCardNames` lives in the caller's destructured options
    // closure (debug_self_play_run handler) — it's NOT in scope here,
    // so it must be passed through. Defaulting to [] keeps the A/B
    // sweep caller, which doesn't expose the option, working too.
    const cpuSkipCardNames = Array.isArray(opts.cpuSkipCardNames) ? opts.cpuSkipCardNames : [];
    const snapshotDeck = (d) => JSON.parse(JSON.stringify({
      mainDeck: d.mainDeck || [], heroes: d.heroes || [],
      potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
      skins: d.skins || {},
    }));
    const deckNames = [deckA.name || 'Unnamed', deckB.name || 'Unnamed'];
    const roomId = 'sp-test-' + uuidv4().substring(0, 8);
    const room = {
      id: roomId, host: 'self-play', hostId: 'self-play',
      type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
      playerPw: null, specPw: null,
      players: [
        { username: 'CPU-A', userId: 'cpu-test-a-' + roomId, socketId: null, deckId: 'self-play-a' },
        { username: 'CPU-B', userId: 'cpu-test-b-' + roomId, socketId: null, deckId: 'self-play-b' },
      ],
      spectators: [], status: 'waiting', created: Date.now(),
      gameState: null, chatHistory: [], privateChatHistory: {},
      _currentDecks: [snapshotDeck(deckA), snapshotDeck(deckB)],
      _deckNames: deckNames,
    };
    rooms.set(roomId, room);

    await setupGameState(room);
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    const startMs = Date.now();

    return new Promise((resolve) => {
      let done = false;
      // We must drain this before resolving — `onGameOver` fires while
      // hook chains are still mid-await, so if we resolve the outer
      // Promise immediately the next game boots and its hooks interleave
      // with the dying engine's tail. That's what was causing games
      // 17/18/19 to log simultaneously and eventually saturate the loop.
      let startGamePromise = null;
      // Captured so finish() can clear them on normal completion. Leaving the
      // 5-min hard timeout dangling kept each game's closure (watchdog, room,
      // engine, cardInstances) alive for the full 5 minutes — ~130MB per game
      // × ~30 fast games = OOM.
      let firstTickTimer = null;
      let hardTimeoutTimer = null;
      let watchdogInterval = null;
      let heapMonitorInterval = null;
      const DRAIN_TIMEOUT_MS = 2000;
      const finish = (winnerIdx, reason, extraDiag) => {
        if (done) return;
        done = true;
        if (firstTickTimer) { clearTimeout(firstTickTimer); firstTickTimer = null; }
        if (hardTimeoutTimer) { clearTimeout(hardTimeoutTimer); hardTimeoutTimer = null; }
        if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
        if (heapMonitorInterval) { clearInterval(heapMonitorInterval); heapMonitorInterval = null; }
        // Self-play's fake user IDs ('cpu-test-a-<roomId>', 'cpu-test-b-...')
        // get added to activeGames via setupGameState but never removed —
        // runOneSelfPlayGame bypasses cleanupRoom. Small per-entry (~80 bytes)
        // but 400+ dangling entries after 200 games; clean up for hygiene.
        for (const p of room.players) activeGames.delete(p.userId);
        const turns = room.gameState?.turn || 0;
        const ms = Date.now() - startMs;
        // Always snapshot the final engine state so the caller can explain
        // ties. Richer detail for `no-result` lets us see WHY the turn chain
        // exited without setting gs.result (driver crash? stuck phase?
        // simultaneous KO? pending prompt?).
        const diagnosis = extraDiag || buildGameDiagnosis(room, winnerIdx, reason);
        drainThenResolve();

        function drainThenResolve() {
          const drain = startGamePromise
            ? Promise.race([
                startGamePromise.catch(() => {}),
                new Promise(r => setTimeout(r, DRAIN_TIMEOUT_MS)),
              ])
            : Promise.resolve();
          drain.then(() => {
            destroyRoom(roomId);
            // ── Tear-down: break the closure refs that capture `room` ──
            // We DON'T null `eng.room` or `room.engine` — V8 GC handles
            // simple 2-cycles natively (mark-and-sweep), and a tail-async
            // chain (switchTurn → cpuTurn → runPhase → log →
            // _broadcastEvent → this.room.spectators) was crashing on
            // those refs being null. The actual leak vectors are the
            // closure captures on onGameOver and _cpuDriver — null those
            // and the room becomes unreachable through everything except
            // the cycle, which V8 reclaims on the next GC pass.
            const eng = room.engine;
            if (eng) {
              eng.onGameOver = null;
              eng._cpuDriver = null;
            }
            room._currentDecks = null;
            room._originalDecks = null;
            resolve({ winnerIdx, reason, turns, ms, firstPlayer, diagnosis });
          });
        }
      };

      startGameEngine(room, roomId, firstPlayer, (engine) => {
        engine._isSelfPlay = true;
        engine._cpuPlayerIdx = firstPlayer;
        // Attach action trail fd if the batch opened one. Engine's
        // _trailWrite sync-writes each entry so the file survives a
        // hard V8 OOM (uncaughtException doesn't fire on FATAL OOM,
        // but writes already on disk persist). null fd → no-op.
        if (opts.trailFd != null) engine._trailFd = opts.trailFd;
        // Per-game runtime CPU skip list: blocks the CPU brain's
        // proactive-play scanner from picking specific cards. Read by
        // _cpu.js next to the per-card `cpuSkipProactive` flag. Used
        // by self-play tests to isolate suspected problem cards
        // (e.g. Lifeforce Howitzer during Loyal/Divinity rebalance
        // testing) without modifying their scripts.
        if (Array.isArray(cpuSkipCardNames) && cpuSkipCardNames.length > 0
            && engine.gs && !engine.gs._cpuSkipProactiveNames) {
          engine.gs._cpuSkipProactiveNames = new Set(cpuSkipCardNames);
        }
        installCpuBrain(engine);
        engine.onGameOver = (_room, winnerIdx, reason) => {
          // The engine's deck-out / all-heroes-dead paths call onGameOver
          // but do NOT set gs.result themselves — the normal SP endCpuBattle
          // handler does that. In self-play we must do it here too, or the
          // engine's stillCpuTurn / !gs.result guards never fire and the
          // CPU driver keeps looping indefinitely (turn 4822+ bug).
          if (room.gameState && !room.gameState.result) {
            room.gameState.result = { winnerIdx, reason };
          }
          finish(winnerIdx, reason);
        };
      }).then(async () => {
        room.engine._cpuDriver = makeCpuDriver(room);
        // Auto-mulligan BOTH sides via the smart-mulligan heuristic.
        if (room.gameState.mulliganDecisions) {
          for (const pi of [0, 1]) {
            let mull = false;
            try {
              room.engine._cpuPlayerIdx = pi; // brain reads its own hand
              mull = shouldMulliganStartingHand(room.engine, pi);
            } catch (err) {
              console.error('[self-play] mulligan check threw:', err.message);
            }
            room.gameState.mulliganDecisions[pi] = mull;
            // Starthand-Lernkanal: finale Hand NACH der Entscheidung
            // stempeln (bei Mulligan unten nach dem Redraw überschrieben).
            room.engine._startHandInfo = room.engine._startHandInfo || {};
            room.engine._startHandInfo[pi] = {
              hand: [...room.gameState.players[pi].hand], mulliganed: mull,
            };
            if (mull) {
              const ps = room.gameState.players[pi];
              const cardDB = getCardDB();
              const handSize = ps.hand.length;
              let potionCount = 0;
              for (const card of ps.hand) {
                const cd = cardDB[card];
                if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
                else { ps.mainDeck.push(card); }
              }
              ps.hand.length = 0;
              const shuf = (arr) => {
                for (let i = arr.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [arr[i], arr[j]] = [arr[j], arr[i]];
                }
              };
              shuf(ps.mainDeck);
              shuf(ps.potionDeck);
              const mainToDraw = handSize - potionCount;
              for (let i = 0; i < mainToDraw; i++) {
                if (ps.mainDeck.length === 0) break;
                ps.hand.push(ps.mainDeck.shift());
              }
              for (let i = 0; i < potionCount; i++) {
                if (ps.potionDeck.length === 0) break;
                ps.hand.push(ps.potionDeck.shift());
              }
              // Redraw abgeschlossen — Starthand-Stempel aktualisieren.
              room.engine._startHandInfo[pi] = { hand: [...ps.hand], mulliganed: true };
            }
          }
          room.gameState.mulliganPending = false;
          delete room.gameState.mulliganDecisions;
        }
        // Enter fast mode for the whole game. Skips pacing delays, log
        // spam, broadcast work, and SC tracking across all turns — drops
        // per-game time from ~100s (real-time pacing) to a few seconds of
        // pure engine work. `_inMctsSim` stays false, so the CPU driver
        // still fires between turns as normal.
        room.engine.enterFastMode();
        // Fire the engine — startGame triggers the first turn's _cpuDriver,
        // which chains via switchTurn through every subsequent turn until
        // gs.result is set. The whole game completes within this await.
        // Captured so finish() can drain it before resolving the outer
        // Promise — this prevents the next game from starting while the
        // dying engine is still fluttering through async hook tails.
        startGamePromise = room.engine.startGame()
          .then(() => {
            // If the game ended without onGameOver firing (shouldn't happen
            // for normal completions), check result and finish manually.
            if (!done) {
              const w = room.gameState?.result?.winnerIdx;
              finish(w != null ? w : -1, room.gameState?.result?.reason || 'no-result');
            }
          })
          .catch(err => {
            console.error('[self-play] engine.startGame error:', err.message);
            if (!done) finish(-1, 'error: ' + err.message);
          });
      }).catch(err => {
        console.error('[self-play] setup error:', err.message);
        if (!done) finish(-1, 'setup-error: ' + err.message);
      });

      // Watchdog: silently tracks turn progress. If the turn counter
      // doesn't advance for STALL_TICKS × WATCHDOG_INTERVAL_MS, aborts
      // the game with a `stalled` reason — saves the batch from hanging
      // if a pathological loop sneaks back in. Also enforces a hard cap
      // on total turns to catch games that advance turns indefinitely
      // without either side pressing lethal (the "both-decks-heal-forever"
      // case that OOM'd a batch at 4GB over ~2 min on Heal Burn vs
      // Lightning Caller).
      let lastWatchdogTurn = -1;
      let stallTicks = 0;
      const WATCHDOG_INTERVAL_MS = 3000;
      const STALL_TICKS_BEFORE_ABORT = 20; // 60s of no turn progress → abort
      const MAX_TURNS = 400; // Realistic hard cap — normal games end well under 50.
      const tick = () => {
        if (done) { clearInterval(watchdog); return; }
        const gs = room.gameState;
        if (!gs) return;
        if ((gs.turn || 0) >= MAX_TURNS) {
          clearInterval(watchdog);
          console.error(`[self-play watchdog] ${roomId} MAX TURNS (${MAX_TURNS}) reached — forcing tie`);
          if (!done) finish(-1, `max-turns@${gs.turn}`);
          return;
        }
        if (gs.turn === lastWatchdogTurn) {
          stallTicks++;
          if (stallTicks >= STALL_TICKS_BEFORE_ABORT) {
            clearInterval(watchdog);
            console.error(`[self-play watchdog] ${roomId} STALLED at turn ${gs.turn} phase ${gs.currentPhase} — forcing stall finish`);
            if (!done) finish(-1, `stalled@turn${gs.turn}phase${gs.currentPhase}`);
          }
        } else {
          stallTicks = 0;
          lastWatchdogTurn = gs.turn;
        }
      };
      // First tick at 2s to confirm the engine is actually running (or stuck).
      firstTickTimer = setTimeout(tick, 2000);
      const watchdog = setInterval(tick, WATCHDOG_INTERVAL_MS);
      watchdogInterval = watchdog;

      // Hard timeout: 5 minutes per game (safety net on top of watchdog).
      hardTimeoutTimer = setTimeout(() => {
        clearInterval(watchdog);
        watchdogInterval = null;
        if (!done) finish(-1, 'timeout');
      }, 5 * 60 * 1000);

      // Heap-growth watchdog: self-play normally sits around 150-500MB
      // heapUsed. Abort games at 2GB heapUsed — gives 6GB of headroom
      // on an 8GB heap for GC to catch up. Tighter (500ms) interval so
      // a fast allocator has more chances to trip. Can't catch purely
      // synchronous loops — for those, runHooks has an inline heap
      // check at 4GB (see _engine.js runHooks).
      const HEAP_ABORT_THRESHOLD_MB = 2000;
      heapMonitorInterval = setInterval(() => {
        if (done) return;
        const mu = process.memoryUsage();
        const heapMB = Math.round(mu.heapUsed / 1024 / 1024);
        if (heapMB >= HEAP_ABORT_THRESHOLD_MB) {
          const gs = room.gameState;
          const diag = `heap-abort: heapUsed=${heapMB}MB at turn ${gs?.turn} phase ${gs?.currentPhase} active p${gs?.activePlayer}. Offending matchup: ${deckNames.join(' vs ')}. Likely card-effect loop allocating unboundedly within this game.`;
          console.error(`[self-play heap-watchdog] ${diag}`);
          if (!done) finish(-1, `heap-abort@${heapMB}MB`, diag);
        }
      }, 500);
    });
  }

  // Configure MCTS settings for self-play. Optional parameters override defaults:
  //   rolloutHorizon: 0-4 (default 2)
  //   rolloutBrain: 'heuristic' | 'evalGreedy' (default 'evalGreedy')
  // Emit BEFORE launching a run to change settings. Persists until
  // changed again or process restarts.
  onDebug('debug_self_play_config', ({ rolloutHorizon, rolloutBrain } = {}) => {
    if (rolloutHorizon != null) setRolloutHorizon(rolloutHorizon);
    if (rolloutBrain != null) setRolloutBrain(rolloutBrain);
    const cfg = { rolloutHorizon: getRolloutHorizon(), rolloutBrain: getRolloutBrain() };
    console.log(`[self-play config] ${JSON.stringify(cfg)}`);
    socket.emit('debug_self_play_config_result', { ok: true, ...cfg });
  });

  onDebug('debug_self_play_run', ({
    count = 5, deckIdA, deckIdB, random, silent = true,
    minMatchupGames = 5, excludeDeckNames = [],
    pinDeckName, pinDeckNames, samplesOnly = false,
    cpuSkipCardNames = [],
  } = {}) => {
    if (!currentUser) {
      socket.emit('debug_self_play_result', { ok: false, msg: 'not authenticated' });
      return;
    }
    // Save verbose state here so both the happy path AND the .catch
    // block below can restore it.
    const _prevVerbose_sp = getCpuVerbose();
    (async () => {
      // ── Deck source ──
      // random=true: pick 2 random legal decks per game from the user's
      // collection. Otherwise: explicit deckIdA / deckIdB (defaults to first
      // deck for both sides if omitted).
      const fetchDeckById = async (deckId) => {
        if (typeof deckId === 'string' && deckId.startsWith('sample-')) {
          const samples = loadSampleDecks();
          return samples.find(s => s.id === deckId) || null;
        }
        const row = await db.get('SELECT * FROM decks WHERE id = ? AND user_id = ?', [deckId, currentUser.userId]);
        return row ? parseDeck(row) : null;
      };
      let allDecks = [];
      let pickerMode = 'fixed';
      let pinnedDeck = null; // Set when pinDeckName resolves to a real deck.
      let _pinnedDecks = null; // Multi-pin variant — array of pinned decks.
      let _pinnedOpponents = null; // Closure-scope opponent pool.
      // Resolve pin spec: accept either a single name (`pinDeckName`) or
      // an array of names (`pinDeckNames`). The multi-pin variant lets
      // tests rotate the pinned side between two or more decks across
      // the run (e.g. "pin {Loyals, Divinity} vs the field").
      const pinNames = Array.isArray(pinDeckNames) && pinDeckNames.length > 0
        ? pinDeckNames
        : (pinDeckName ? [pinDeckName] : null);
      // Pinned mode supersedes the random / fixed branches below — it
      // builds the same broad pool but reserves one slot for the
      // pinned-deck rotation and draws the other slot from the
      // remaining pool each game.
      if (pinNames) {
        const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
        const userDecks = rows.map(parseDeck).filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        const sampleDecks = loadSampleDecks().filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        // `samplesOnly: true` excludes user-saved decks from BOTH the
        // pinned-resolution pool AND the opponent pool. The pinned
        // names still resolve via sample decks (Starter / Structure
        // collections). Useful for "test only against the canonical
        // sample decks" runs that don't want noisy user creations.
        const pool = samplesOnly ? sampleDecks : [...userDecks, ...sampleDecks];
        const resolved = [];
        // Punctuation-insensitive bidirectional matcher: strip
        // apostrophes / colons / spaces / etc., then accept either
        // direction of substring containment. Handles three traps in
        // one:
        //   1. Straight-vs-curly apostrophe (Man's vs Man’s)
        //   2. Missing-colon variants ("Mans Best Friends" matches
        //      the canonical "Structure Deck: Man's Best Friends")
        //   3. Search query is MORE specific than the deck's stored
        //      name (e.g. user types "Structure Deck: To Attain
        //      Divinity" but the file's `Name:` line is just "To
        //      Attain Divinity"). Without bidirectional matching, a
        //      longer query can never resolve a shorter name.
        const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
        const matchesEitherWay = (a, b) => a.includes(b) || b.includes(a);
        for (const name of pinNames) {
          const target = norm(name);
          if (!target) {
            socket.emit('debug_self_play_result', { ok: false, msg: `pinDeckName empty: ${name}` });
            return;
          }
          const found = pool.find(d => matchesEitherWay(norm(d.name), target));
          if (!found) {
            const available = pool.map(d => d.name).filter(Boolean).join(', ');
            socket.emit('debug_self_play_result', {
              ok: false,
              msg: `pinDeckName not found: ${name} — available: ${available}`,
            });
            return;
          }
          if (!resolved.includes(found)) resolved.push(found);
        }
        _pinnedDecks = resolved;
        pinnedDeck = resolved[0]; // legacy reference for stats labels
        // Opponent pool — every legal deck OTHER than any pinned one.
        let opponents = pool.filter(d => !resolved.includes(d));
        if (excludeDeckNames.length > 0) {
          const excludeLc = excludeDeckNames.map(n => n.toLowerCase());
          opponents = opponents.filter(d => {
            const nameLc = (d.name || '').toLowerCase();
            return !excludeLc.some(ex => nameLc.includes(ex) || ex.includes(nameLc));
          });
        }
        if (opponents.length === 0) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'no legal opponents found for pinned deck(s)' });
          return;
        }
        // The full deck list reported in the summary still includes
        // every pinned deck so each deck's W-L line shows up.
        allDecks = [...resolved, ...opponents];
        pickerMode = 'pinned';
        const pinLabel = resolved.map(d => `"${d.name}"`).join(' / ');
        console.log(`[self-play] pinned mode: ${pinLabel} vs ${opponents.length} opponent${opponents.length !== 1 ? 's' : ''}${samplesOnly ? ' (samples only)' : ''}`);
        _pinnedOpponents = opponents;
      } else if (random) {
        // Pool = user's saved decks + ALL sample decks (Starter + Structure).
        // Self-play is a test tool, so we want broad archetype coverage even
        // when the user has only a few decks of their own saved. Pass
        // `samplesOnly: true` to drop user decks entirely — useful for
        // canonical-deck-only sweeps that shouldn't be polluted by
        // personal creations.
        const sampleDecks = loadSampleDecks().filter(d =>
          d && Array.isArray(d.heroes) && d.heroes.length > 0
          && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        let userDecks = [];
        if (!samplesOnly) {
          const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
          userDecks = rows.map(parseDeck).filter(d =>
            d && Array.isArray(d.heroes) && d.heroes.length > 0
            && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
        }
        allDecks = [...userDecks, ...sampleDecks];
        // Apply exclusion list. Matches deck name (case-insensitive,
        // substring-in-either-direction) so 'heal burn' excludes
        // 'Structure Deck: Heal Burn' and anything else containing it.
        if (excludeDeckNames.length > 0) {
          const excludeLc = excludeDeckNames.map(n => n.toLowerCase());
          const before = allDecks.length;
          allDecks = allDecks.filter(d => {
            const nameLc = (d.name || '').toLowerCase();
            return !excludeLc.some(ex => nameLc.includes(ex) || ex.includes(nameLc));
          });
          console.log(`[self-play] excluded ${before - allDecks.length} decks matching: ${excludeDeckNames.join(', ')}`);
        }
        if (allDecks.length === 0) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'no legal decks found' });
          return;
        }
        const structureCount = sampleDecks.filter(d => d.isStructure && allDecks.includes(d)).length;
        const starterCount = allDecks.filter(d => !d.isStructure).length - userDecks.filter(d => allDecks.includes(d)).length;
        console.log(`[self-play] deck pool: ${allDecks.length} total after filtering`);
        pickerMode = 'random';
      } else {
        const da = deckIdA
          ? await fetchDeckById(deckIdA)
          : await (async () => { const r = await db.get('SELECT * FROM decks WHERE user_id = ? LIMIT 1', [currentUser.userId]); return r ? parseDeck(r) : null; })();
        const db2 = deckIdB ? await fetchDeckById(deckIdB) : da;
        if (!da || !db2) {
          socket.emit('debug_self_play_result', { ok: false, msg: 'deck not found' });
          return;
        }
        allDecks = [da, db2];
      }
      const pickPair = () => {
        if (pickerMode === 'fixed') return [allDecks[0], allDecks[1] || allDecks[0]];
        if (pickerMode === 'pinned') {
          // 50/50 side assignment so the pinned deck(s) play p0 and p1
          // an equal number of times across the run — keeps first-
          // player skew from biasing the measured win-rate.
          // For multi-pin: pick a random pinned deck per game so the
          // rotation is even across the pinned set.
          const opponents = _pinnedOpponents;
          const pinned = (_pinnedDecks && _pinnedDecks.length > 0)
            ? _pinnedDecks[Math.floor(Math.random() * _pinnedDecks.length)]
            : pinnedDeck;
          const opp = opponents[Math.floor(Math.random() * opponents.length)];
          return Math.random() < 0.5 ? [pinned, opp] : [opp, pinned];
        }
        if (allDecks.length < 2) return [allDecks[0], allDecks[0]];
        const i = Math.floor(Math.random() * allDecks.length);
        let j = Math.floor(Math.random() * (allDecks.length - 1));
        if (j >= i) j++;
        return [allDecks[i], allDecks[j]];
      };

      // ── Stats accumulators ──
      const byDeck = new Map(); // deckId -> { name, games, wins, losses, winReasons }
      const byMatchup = new Map(); // sortedKey -> { idA, idB, nameA, nameB, gamesAsA, gamesAsB, aWins, bWins }
      const totalWinReasons = Object.create(null);
      // Friendly labels for the reasons the engine emits via onGameOver.
      // New reasons (future game-over paths) fall through to the raw string.
      const REASON_LABELS = {
        deck_out: 'Deck-out',
        all_heroes_dead: 'Heroes dead',
        cardinal_beast: 'Cardinal Beasts',
        puzzle_failed: 'Puzzle failed',
        timeout: 'Timeout',
      };
      const labelReason = (r) => REASON_LABELS[r] || (r || 'unknown');
      const recordDeck = (deck, won, reason) => {
        const key = String(deck.id || deck.name);
        let s = byDeck.get(key);
        if (!s) {
          s = {
            id: key, name: deck.name || 'Unnamed',
            games: 0, wins: 0, losses: 0,
            winReasons: Object.create(null),
          };
          byDeck.set(key, s);
        }
        s.games++;
        if (won === true) {
          s.wins++;
          const label = labelReason(reason);
          s.winReasons[label] = (s.winReasons[label] || 0) + 1;
          totalWinReasons[label] = (totalWinReasons[label] || 0) + 1;
        } else if (won === false) {
          s.losses++;
        }
      };
      const recordMatchup = (deckP0, deckP1, winnerIdx) => {
        if (winnerIdx !== 0 && winnerIdx !== 1) return;
        const id0 = String(deckP0.id || deckP0.name);
        const id1 = String(deckP1.id || deckP1.name);
        const sorted = id0 < id1 ? [deckP0, deckP1, 0, 1] : [deckP1, deckP0, 1, 0];
        const [a, b, aSlot] = sorted;
        const key = String(a.id || a.name) + '|' + String(b.id || b.name);
        let m = byMatchup.get(key);
        if (!m) {
          m = {
            idA: String(a.id || a.name), nameA: a.name || 'Unnamed',
            idB: String(b.id || b.name), nameB: b.name || 'Unnamed',
            games: 0, aWins: 0, bWins: 0,
          };
          byMatchup.set(key, m);
        }
        m.games++;
        if (winnerIdx === aSlot) m.aWins++;
        else m.bWins++;
      };

      // Silence the per-decision [CPU] log spam — it dominates self-play
      // runtime (synchronous stdout flushes block the event loop). Prev
      // state saved outside the IIFE so the .catch block can restore too.
      setCpuVerbose(!silent);
      console.log(`[self-play] starting ${count} games (${pickerMode}, ${allDecks.length} decks, silent=${silent})`);
      const stats = { p0wins: 0, p1wins: 0, draws: 0, totalTurns: 0, totalMs: 0 };
      // Incremental save path so a crash doesn't lose everything. Writes
      // the running summary to disk after each game. On process death,
      // this file is the user's recovery point.
      const batchTimestamp = Date.now();
      const partialSavePath = path.join(__dirname, 'data', `selfplay-partial-${batchTimestamp}.json`);
      console.log(`[self-play] incremental save → ${partialSavePath}`);
      // OOM-survival action trail. Every CPU action / summon / rollout
      // candidate / turn switch is sync-written to this file via the
      // engine's _trailWrite helper. Sync writes survive a hard V8 OOM
      // (which is fatal and can't be caught), so on a crash the disk
      // has the action sequence right up to the moment Node died — the
      // tail of this file names what was running. Costs ~50µs per
      // entry and only a few hundred entries per game, so per-batch
      // overhead is negligible.
      const trailPath = path.join(__dirname, 'data', `selfplay-trail-${batchTimestamp}.log`);
      let trailFd = null;
      try {
        trailFd = fs.openSync(trailPath, 'w');
        _activeSelfPlayTrailFd = trailFd;
        fs.writeSync(trailFd, `=== self-play batch start ${new Date().toISOString()} count=${count} mode=${pickerMode} ===\n`);
        console.log(`[self-play] action trail → ${trailPath}`);
      } catch (err) {
        console.error('[self-play] failed to open trail file:', err.message);
        trailFd = null;
      }
      // Emit a "started" event to the BROWSER side so the user sees
      // immediate confirmation in their dev console rather than
      // staring at silence until the first game completes ~30s later.
      // Includes the picker mode, deck count, and partial-save path
      // so the user can tail the JSON live if they want.
      socket.emit('debug_self_play_started', {
        count, pickerMode, deckCount: allDecks.length,
        pinnedDeckNames: _pinnedDecks ? _pinnedDecks.map(d => d.name) : null,
        partialSavePath,
        cpuSkipCardNames: Array.isArray(cpuSkipCardNames) ? cpuSkipCardNames : [],
        startedAt: new Date().toISOString(),
      });

      // Pick ~10 random game indices for detailed transcription. Selected
      // up front so every batch has a consistent sample size regardless
      // of early termination. Transcription is FREE to set during normal
      // silent play — it just routes cpuLog messages into a buffer.
      const TRANSCRIPT_COUNT = Math.min(10, count);
      const transcriptIndices = new Set();
      while (transcriptIndices.size < TRANSCRIPT_COUNT) {
        transcriptIndices.add(Math.floor(Math.random() * count));
      }
      const transcripts = []; // [{ gameIdx, deckP0, deckP1, firstPlayer, result, lines: [...] }]
      console.log(`[self-play] will transcribe games: ${[...transcriptIndices].sort((a,b)=>a-b).map(i => i+1).join(', ')}`);
      // Tie details: decks + reason + turn/ms for every drawn game. Ties
      // are rare and worth inspecting individually (timeout? simultaneous
      // hero deaths? engine bug?).
      const tieDetails = [];
      const t0 = Date.now();
      const printEvery = count > 1000 ? 100 : count > 100 ? 10 : 1;
      for (let i = 0; i < count; i++) {
        const [deckP0, deckP1] = pickPair();
        const nameP0 = deckP0.name || '?';
        const nameP1 = deckP1.name || '?';
        // Announce decks BEFORE the game runs — if the game hangs, this
        // is the last line in the log and pinpoints the offending matchup.
        console.log(`[self-play] Game ${i + 1}/${count} starting: ${nameP0} vs ${nameP1}`);
        if (trailFd != null) {
          try {
            fs.writeSync(trailFd, `\n=== GAME ${i + 1}/${count}: ${nameP0} vs ${nameP1} @ ${new Date().toISOString()} ===\n`);
          } catch { /* best-effort */ }
        }
        // Browser-side start signal so the dev console gets immediate
        // feedback that the next game has begun. Without this the user
        // only sees output once a game COMPLETES (the
        // `debug_self_play_progress` event fires post-game), which can
        // look like nothing's happening for the first ~10-30s of the
        // run.
        socket.emit('debug_self_play_game_start', {
          i: i + 1, total: count,
          deckP0: nameP0, deckP1: nameP1,
          startedAt: new Date().toISOString(),
        });
        // Set up transcription for this game if selected. Buffer caps at
        // ~500 lines to keep the report readable; older lines drop.
        const isTranscribeGame = transcriptIndices.has(i);
        let transcriptLines = null;
        if (isTranscribeGame) {
          const BUF_CAP = 500;
          transcriptLines = [];
          setCpuTranscribeFn((msg) => {
            transcriptLines.push(msg);
            if (transcriptLines.length > BUF_CAP) transcriptLines.shift();
          });
        }
        try {
          // Race the game against an outer watchdog. The per-game timeout
          // inside runOneSelfPlayGame (5 min) only kicks in AFTER the
          // Promise is returned — if the hang is during setupGameState or
          // inside startGameEngine's hook cascade, the inner timeout never
          // fires. This outer 6-min cap is the last line of defence.
          // Capture the timer handle so it can be cleared on the normal
          // path — otherwise every game leaves a 6-min pending timeout
          // whose closure pins Error + reject fn (small, but adds up).
          const OUTER_TIMEOUT_MS = 6 * 60 * 1000;
          let outerTimeoutHandle = null;
          const outerTimeout = new Promise((_, reject) => {
            outerTimeoutHandle = setTimeout(
              () => reject(new Error(`outer-timeout after ${OUTER_TIMEOUT_MS / 1000}s`)),
              OUTER_TIMEOUT_MS,
            );
          });
          let r;
          try {
            r = await Promise.race([runOneSelfPlayGame(deckP0, deckP1, { cpuSkipCardNames, trailFd }), outerTimeout]);
          } finally {
            if (outerTimeoutHandle) clearTimeout(outerTimeoutHandle);
            // Tear down transcription regardless of game outcome.
            if (isTranscribeGame) {
              setCpuTranscribeFn(null);
              transcripts.push({
                gameIdx: i + 1,
                deckP0: nameP0, deckP1: nameP1,
                firstPlayer: r?.firstPlayer,
                turns: r?.turns,
                reason: r?.reason,
                winnerIdx: r?.winnerIdx,
                lines: transcriptLines,
              });
            }
          }
          if (r.winnerIdx === 0) {
            stats.p0wins++;
            recordDeck(deckP0, true, r.reason); recordDeck(deckP1, false);
          } else if (r.winnerIdx === 1) {
            stats.p1wins++;
            recordDeck(deckP0, false); recordDeck(deckP1, true, r.reason);
          } else {
            stats.draws++;
            recordDeck(deckP0, null); recordDeck(deckP1, null);
            tieDetails.push({
              gameIdx: i + 1,
              deckP0: nameP0,
              deckP1: nameP1,
              firstPlayer: r.firstPlayer,
              turns: r.turns,
              ms: r.ms,
              reason: r.reason || 'unknown',
              diagnosis: r.diagnosis || '',
            });
          }
          recordMatchup(deckP0, deckP1, r.winnerIdx);
          stats.totalTurns += r.turns;
          stats.totalMs += r.ms;
          // Per-game heap log — diagnoses leak vs transient spike. Linear
          // growth = real leak. Flat with spikes on long matches (e.g.
          // Heal Burn vs Lightning Caller) = allocation pressure; rerun
          // node with --max-old-space-size=8192.
          const mu = process.memoryUsage();
          const mb = (n) => Math.round(n / 1024 / 1024);
          console.log(`[self-play] heap after game ${i + 1}: rss=${mb(mu.rss)}MB heapUsed=${mb(mu.heapUsed)}MB heapTotal=${mb(mu.heapTotal)}MB external=${mb(mu.external)}MB turns=${r.turns}`);
          // Per-game result line — name the winner, loser, how it ended,
          // and a running win/loss tally for the participating decks so
          // the user can watch trends as the batch runs.
          const winnerName = r.winnerIdx === 0 ? nameP0 : r.winnerIdx === 1 ? nameP1 : 'DRAW';
          const loserName = r.winnerIdx === 0 ? nameP1 : r.winnerIdx === 1 ? nameP0 : 'DRAW';
          const method = labelReason(r.reason);
          const diagSuffix = (r.winnerIdx === -1 && r.diagnosis) ? `\n    → ${r.diagnosis}` : '';
          // Running w/l line for both participants — sample-size aware.
          const fmtRunning = (deck) => {
            const s = byDeck.get(String(deck.id || deck.name));
            if (!s || s.games === 0) return `${deck.name} 0-0`;
            const wr = ((s.wins / s.games) * 100).toFixed(1);
            return `${deck.name} ${s.wins}-${s.losses} (${wr}%)`;
          };
          console.log(`[self-play] Game ${i + 1}/${count} complete (${nameP0} vs ${nameP1})! Winner: ${winnerName}, Loser: ${loserName}, method of victory: ${method}, game lasted ${r.turns} turns, took ${r.ms} ms.${diagSuffix}`);
          console.log(`[self-play]   running: ${fmtRunning(deckP0)} | ${fmtRunning(deckP1)}`);
          socket.emit('debug_self_play_progress', {
            i: i + 1, total: count,
            deckP0: deckP0.name, deckP1: deckP1.name,
            ...r,
          });
          // Incremental save — fire-and-forget; a failed write here
          // shouldn't stop the batch. Synchronous to guarantee flush
          // to disk before a potential OOM a few seconds later.
          //
          // Snapshot includes:
          //   • stats: aggregate p0/p1 wins, draws, totals.
          //   • decks: per-deck record (games, wins, losses, winRate,
          //     winReasons {Heroes dead, Deck-out, Cardinal Beasts, ...}).
          //     Sorted by winRate so the leaderboard is at the top.
          //   • matchups: every distinct pairing seen so far, with
          //     game count, side splits, and a `dominance` measure
          //     (|aWins-bWins|/games — 0 = even, 1 = whitewash).
          //   • onesidedMatchups: top 10 most-lopsided eligible
          //     pairings (≥ minMatchupGames games), so the user can
          //     watch the "particularly good/bad matchups" narrow
          //     in as more games run.
          //   • aggregateWinReasons: how all wins broke down across
          //     the entire run (Heroes dead vs Deck-out vs Cardinal
          //     Beasts vs Puzzle failed vs Timeout).
          //   • tieDetails: per-tie diagnostics for inspection.
          try {
            const decksSnapshot = [...byDeck.values()].map(d => ({
              ...d,
              winRate: d.games > 0 ? +(d.wins / d.games).toFixed(3) : 0,
            })).sort((a, b) => b.winRate - a.winRate);
            const matchupSnapshot = [...byMatchup.values()].map(m => {
              const dominance = m.games > 0 ? Math.abs(m.aWins - m.bWins) / m.games : 0;
              return {
                ...m,
                dominance: +dominance.toFixed(3),
                dominantSide: m.aWins > m.bWins ? m.nameA : m.nameB,
              };
            });
            const onesidedSnapshot = matchupSnapshot
              .filter(m => m.games >= minMatchupGames)
              .sort((a, b) => b.dominance - a.dominance)
              .slice(0, 10);
            const partial = {
              gamesDone: i + 1, total: count, elapsedMs: Date.now() - t0,
              pickerMode,
              stats: { ...stats },
              aggregateWinReasons: { ...totalWinReasons },
              decks: decksSnapshot,
              matchups: matchupSnapshot,
              onesidedMatchups: onesidedSnapshot,
              tieDetails: [...tieDetails],
              savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(partialSavePath, JSON.stringify(partial, null, 2));
          } catch (werr) {
            // Partial-save failure shouldn't abort batch.
            console.error('[self-play] partial save failed:', werr.message);
          }
        } catch (err) {
          console.error(`[self-play] game ${i + 1} threw:`, err.message);
        }
      }
      if (silent) setCpuVerbose(true);

      // ── Build rankings ──
      const deckList = [...byDeck.values()].map(d => ({
        ...d,
        winRate: d.games > 0 ? +(d.wins / d.games).toFixed(3) : 0,
      }));
      const rankedDecks = [...deckList].sort((a, b) => b.winRate - a.winRate);

      const matchupList = [...byMatchup.values()].map(m => {
        const dominance = m.games > 0 ? Math.abs(m.aWins - m.bWins) / m.games : 0;
        return {
          ...m,
          dominance: +dominance.toFixed(3),
          dominantSide: m.aWins > m.bWins ? m.nameA : m.nameB,
        };
      });
      const eligibleMatchups = matchupList.filter(m => m.games >= minMatchupGames);
      const onesidedMatchups = [...eligibleMatchups]
        .sort((a, b) => b.dominance - a.dominance)
        .slice(0, 10);

      const totalMs = Date.now() - t0;
      // Helper: render a winReasons map as a compact breakdown string.
      const fmtReasons = (winReasons) => {
        const entries = Object.entries(winReasons || {}).sort((a, b) => b[1] - a[1]);
        if (!entries.length) return '';
        return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
      };
      const summary = {
        ok: true,
        count,
        pickerMode,
        deckCount: allDecks.length,
        p0wins: stats.p0wins,
        p1wins: stats.p1wins,
        draws: stats.draws,
        firstPlayerSkew: count > 0 ? +(((stats.p0wins + stats.p1wins) > 0 ? Math.abs(stats.p0wins - stats.p1wins) / (stats.p0wins + stats.p1wins) : 0).toFixed(3)) : 0,
        avgTurns: count > 0 ? +(stats.totalTurns / count).toFixed(1) : 0,
        avgMsPerGame: count > 0 ? Math.round(stats.totalMs / count) : 0,
        totalMs,
        // Aggregate win-condition breakdown across ALL games (both sides).
        winReasons: totalWinReasons,
        // Per-deck rankings (full list, sorted by winRate desc). Each deck
        // now carries a winReasons map showing HOW that deck wins.
        decks: rankedDecks,
        // Per-game detail for every tied game — ties are rare enough that
        // listing them individually is more useful than aggregating.
        tieDetails,
        // Most one-sided matchups (need ≥ minMatchupGames games to qualify).
        onesidedMatchups,
        // Full matchup table (raw).
        matchups: matchupList,
      };
      console.log(`[self-play] DONE — count=${count} p0wins=${stats.p0wins} p1wins=${stats.p1wins} draws=${stats.draws} avgTurns=${summary.avgTurns} avgMs=${summary.avgMsPerGame} totalMs=${totalMs}`);
      if (Object.keys(totalWinReasons).length) {
        console.log(`[self-play] Win conditions: ${fmtReasons(totalWinReasons)}`);
      }

      // ── Full deck table ──
      // Columns: Rank | Deck name | W-L | WR% | Games | Win conditions.
      // Width is computed from the data so long deck names aren't clipped.
      if (rankedDecks.length) {
        const nameW = Math.max(9, ...rankedDecks.map(d => (d.name || '?').length));
        const wlW = Math.max(5, ...rankedDecks.map(d => `${d.wins}-${d.losses}`.length));
        const gW = Math.max(5, ...rankedDecks.map(d => String(d.games).length));
        const pad = (s, w, right = false) => {
          const str = String(s);
          if (str.length >= w) return str;
          return right ? str.padStart(w) : str.padEnd(w);
        };
        const sep = '-'.repeat(4 + 2 + nameW + 2 + wlW + 2 + 6 + 2 + gW + 2 + 30);
        console.log(`[self-play] DECK TABLE (${rankedDecks.length} decks, sorted by win-rate):`);
        console.log(`  ${pad('#', 4, true)}  ${pad('Deck', nameW)}  ${pad('W-L', wlW, true)}  ${pad('WR%', 6, true)}  ${pad('Games', gW, true)}  Win conditions`);
        console.log(`  ${sep}`);
        rankedDecks.forEach((d, i) => {
          const rb = fmtReasons(d.winReasons) || '—';
          const wl = `${d.wins}-${d.losses}`;
          const wrPct = (d.winRate * 100).toFixed(1);
          console.log(`  ${pad(i + 1, 4, true)}  ${pad(d.name || '?', nameW)}  ${pad(wl, wlW, true)}  ${pad(wrPct, 6, true)}  ${pad(d.games, gW, true)}  ${rb}`);
        });
      }

      // ── Tie details ──
      if (tieDetails.length) {
        console.log(`[self-play] TIE DETAILS (${tieDetails.length}):`);
        for (const t of tieDetails) {
          const diag = t.diagnosis ? `\n      ${t.diagnosis}` : '';
          console.log(`  Game ${t.gameIdx}: ${t.deckP0} vs ${t.deckP1} — firstPlayer=p${t.firstPlayer} turns=${t.turns} ms=${t.ms} reason=${t.reason}${diag}`);
        }
      }

      if (summary.onesidedMatchups.length) {
        console.log(`[self-play] MOST ONE-SIDED matchups (≥${minMatchupGames} games):`);
        for (const m of summary.onesidedMatchups) {
          console.log(`  ${m.nameA} vs ${m.nameB} — ${m.aWins}-${m.bWins} (dominance ${(m.dominance * 100).toFixed(1)}%, ${m.dominantSide} winning)`);
        }
      }
      // ── Write a human-readable TXT report ──
      // Mirrors the stdout summary but saved to data/ for easy retrieval
      // after a long run. Unlike the partial JSON (overwritten per game),
      // this is the FINAL report, written once at the end.
      try {
        const lines = [];
        const push = (s) => lines.push(s);
        push(`Pixel Parties self-play report`);
        push(`Generated: ${new Date().toISOString()}`);
        push(`Config: rolloutHorizon=${getRolloutHorizon()} rolloutBrain=${getRolloutBrain()}`);
        push(`Games: ${count}  |  Deck pool: ${allDecks.length} (${pickerMode})`);
        push(`Results: p0 wins=${stats.p0wins}  p1 wins=${stats.p1wins}  draws=${stats.draws}`);
        push(`Timing: avgTurns=${summary.avgTurns}  avgMs=${summary.avgMsPerGame}  totalMs=${totalMs} (${(totalMs / 60000).toFixed(1)} min)`);
        push(`First-player skew: ${summary.firstPlayerSkew}`);
        push('');
        if (Object.keys(totalWinReasons).length) {
          const reasonStr = Object.entries(totalWinReasons).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}: ${v}`).join(', ');
          push(`Win conditions: ${reasonStr}`);
          push('');
        }
        if (rankedDecks.length) {
          const nameW = Math.max(9, ...rankedDecks.map(d => (d.name || '?').length));
          const wlW = Math.max(5, ...rankedDecks.map(d => `${d.wins}-${d.losses}`.length));
          const gW = Math.max(5, ...rankedDecks.map(d => String(d.games).length));
          const pad = (s, w, right = false) => {
            const str = String(s);
            if (str.length >= w) return str;
            return right ? str.padStart(w) : str.padEnd(w);
          };
          const sep = '-'.repeat(4 + 2 + nameW + 2 + wlW + 2 + 6 + 2 + gW + 2 + 30);
          push(`DECK TABLE (${rankedDecks.length} decks, sorted by win-rate):`);
          push(`  ${pad('#', 4, true)}  ${pad('Deck', nameW)}  ${pad('W-L', wlW, true)}  ${pad('WR%', 6, true)}  ${pad('Games', gW, true)}  Win conditions`);
          push(`  ${sep}`);
          rankedDecks.forEach((d, i) => {
            const rb = (() => {
              const e = Object.entries(d.winReasons || {}).sort((a, b) => b[1] - a[1]);
              return e.length ? e.map(([k, v]) => `${k}: ${v}`).join(', ') : '—';
            })();
            const wl = `${d.wins}-${d.losses}`;
            const wrPct = (d.winRate * 100).toFixed(1);
            push(`  ${pad(i + 1, 4, true)}  ${pad(d.name || '?', nameW)}  ${pad(wl, wlW, true)}  ${pad(wrPct, 6, true)}  ${pad(d.games, gW, true)}  ${rb}`);
          });
          push('');
        }
        // ── Full matchup matrix ──
        // All 66 unique matchups (12 choose 2) + up to 12 mirror matches.
        // Sorted alphabetically by pair so readers can scan to find a
        // specific matchup. The `byMatchup` keys are sorted already, so
        // we just sort the entries by nameA then nameB.
        if (matchupList.length) {
          const sortedMatchups = [...matchupList].sort((a, b) => {
            if (a.nameA !== b.nameA) return a.nameA.localeCompare(b.nameA);
            return a.nameB.localeCompare(b.nameB);
          });
          push(`FULL MATCHUP TABLE (${sortedMatchups.length} unique pairings):`);
          const nameW = Math.max(...sortedMatchups.map(m => Math.max((m.nameA || '?').length, (m.nameB || '?').length)));
          for (const m of sortedMatchups) {
            const aName = (m.nameA || '?').padEnd(nameW);
            const bName = (m.nameB || '?').padEnd(nameW);
            const total = m.aWins + m.bWins;
            const aPct = total > 0 ? ((m.aWins / total) * 100).toFixed(1) : '—';
            push(`  ${aName} vs ${bName}  →  ${String(m.aWins).padStart(3)}-${String(m.bWins).padStart(3)} (${m.games} games, ${aName.trim()}: ${aPct}%)`);
          }
          push('');
        }
        if (summary.onesidedMatchups.length) {
          push(`MOST ONE-SIDED matchups (≥${minMatchupGames} games):`);
          for (const m of summary.onesidedMatchups) {
            push(`  ${m.nameA} vs ${m.nameB} — ${m.aWins}-${m.bWins} (dominance ${(m.dominance * 100).toFixed(1)}%, ${m.dominantSide} winning)`);
          }
          push('');
        }
        if (tieDetails.length) {
          push(`TIE DETAILS (${tieDetails.length}):`);
          for (const t of tieDetails) {
            const diag = t.diagnosis ? `\n      ${t.diagnosis}` : '';
            push(`  Game ${t.gameIdx}: ${t.deckP0} vs ${t.deckP1} — firstPlayer=p${t.firstPlayer} turns=${t.turns} ms=${t.ms} reason=${t.reason}${diag}`);
          }
          push('');
        }

        // ── Game transcripts ──
        // Detailed CPU decision traces for the random-sampled games.
        // Shows hand snapshots, MCTS candidate scores, chosen plays,
        // and commit/skip decisions on Main Phase gates. Capped at
        // ~500 lines per game to keep the report readable.
        if (transcripts.length) {
          push(`═══════════════════════════════════════════════════════════`);
          push(`GAME TRANSCRIPTS (${transcripts.length} random samples)`);
          push(`═══════════════════════════════════════════════════════════`);
          push('');
          for (const t of transcripts) {
            const winner = t.winnerIdx === 0 ? t.deckP0 : t.winnerIdx === 1 ? t.deckP1 : 'DRAW';
            push(`─── Game ${t.gameIdx}: ${t.deckP0} (p0) vs ${t.deckP1} (p1) ───`);
            push(`   firstPlayer=p${t.firstPlayer}  turns=${t.turns}  winner=${winner}  reason=${t.reason}`);
            push(`   Transcript (${(t.lines || []).length} lines):`);
            for (const ln of (t.lines || [])) push(`   ${ln}`);
            push('');
          }
        }

        const reportPath = path.join(__dirname, 'data', `selfplay-report-${Date.now()}.txt`);
        fs.writeFileSync(reportPath, lines.join('\n'));
        console.log(`[self-play] final report saved → ${reportPath}`);
      } catch (werr) {
        console.error('[self-play] report write failed:', werr.message);
      }

      // Close the action-trail file. Module-level handle is cleared too
      // so the process-level fatal handlers don't try to flush an fd that
      // might be reassigned by a later batch.
      if (trailFd != null) {
        try {
          fs.writeSync(trailFd, `\n=== self-play batch end ${new Date().toISOString()} ===\n`);
          fs.fsyncSync(trailFd);
          fs.closeSync(trailFd);
        } catch {}
        if (_activeSelfPlayTrailFd === trailFd) _activeSelfPlayTrailFd = null;
      }

      socket.emit('debug_self_play_result', summary);
    })().catch(err => {
      console.error('[self-play] runner threw:', err.message, err.stack);
      setCpuVerbose(_prevVerbose_sp);
      // Close trail on error path too.
      if (_activeSelfPlayTrailFd != null) {
        try { fs.fsyncSync(_activeSelfPlayTrailFd); fs.closeSync(_activeSelfPlayTrailFd); } catch {}
        _activeSelfPlayTrailFd = null;
      }
      socket.emit('debug_self_play_result', { ok: false, msg: err.message });
    });
  });

  // ═══════════════════════════════════════════
  //  A/B sweep — rollout horizon × rollout brain.
  //  Runs `count` games per config on a fixed matchup, alternating first
  //  player 50/50. Default sweep: 4 configs =
  //    (horizon 0, 2) × (brain 'heuristic', 'evalGreedy').
  //    socket.emit('debug_self_play_ab', { count: 50 });
  //    socket.on('debug_self_play_ab_result', console.log);
  //  Optional: { deckNameA, deckNameB, horizons: [0,1,2], brains: ['heuristic','evalGreedy'] }
  // ═══════════════════════════════════════════
  onDebug('debug_self_play_ab', ({
    count = 50,
    deckNameA = 'Heal Burn',
    deckNameB = 'Spell Industrialization',
    horizons = [0, 2],
    brains = ['heuristic', 'evalGreedy'],
    silent = true,
  } = {}) => {
    if (!currentUser) {
      socket.emit('debug_self_play_ab_result', { ok: false, msg: 'not authenticated' });
      return;
    }
    const _prevVerbose_ab = getCpuVerbose();
    (async () => {
      // Find the two decks by name (saved + sample pool).
      const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
      const userDecks = rows.map(parseDeck).filter(Boolean);
      const pool = [...userDecks, ...loadSampleDecks()].filter(d =>
        d && Array.isArray(d.heroes) && d.heroes.length > 0
        && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
      const findByName = (n) => pool.find(d => (d.name || '').toLowerCase() === n.toLowerCase());
      const deckA = findByName(deckNameA);
      const deckB = findByName(deckNameB);
      if (!deckA || !deckB) {
        socket.emit('debug_self_play_ab_result', { ok: false, msg: `deck not found: ${!deckA ? deckNameA : deckNameB}` });
        return;
      }

      setCpuVerbose(!silent);
      const originalHorizon = getRolloutHorizon();
      const originalBrain = getRolloutBrain();

      // Build config matrix (cartesian product of horizons × brains).
      const configs = [];
      for (const h of horizons) for (const b of brains) configs.push({ horizon: h, brain: b });

      console.log(`[self-play A/B] matchup: "${deckA.name}" vs "${deckB.name}", ${count} games per config, ${configs.length} configs → ${configs.length * count} games total`);

      const byConfig = [];
      const t0 = Date.now();
      try {
        for (const cfg of configs) {
          setRolloutHorizon(cfg.horizon);
          setRolloutBrain(cfg.brain);
          const label = `h=${cfg.horizon} brain=${cfg.brain}`;
          console.log(`[self-play A/B] ─── ${label} ─── starting ${count} games`);
          const stats = {
            horizon: cfg.horizon,
            brain: cfg.brain,
            aWins: 0, bWins: 0, draws: 0,
            aWinsWhenFirst: 0, aWinsWhenSecond: 0,
            totalTurns: 0, totalMs: 0,
            // Split by winner-side so we can see HOW each side wins.
            // Heal Burn winning via deck-out ≠ winning via hero kills.
            aWinReasons: Object.create(null),
            bWinReasons: Object.create(null),
            ties: [],
          };
          for (let i = 0; i < count; i++) {
            const aIsP0 = (i % 2 === 0);
            const deckP0 = aIsP0 ? deckA : deckB;
            const deckP1 = aIsP0 ? deckB : deckA;
            const aLabel = deckA.name + (aIsP0 ? ' (p0)' : ' (p1)');
            const bLabel = deckB.name + (aIsP0 ? ' (p1)' : ' (p0)');
            try {
              const r = await runOneSelfPlayGame(deckP0, deckP1);
              stats.totalTurns += r.turns;
              stats.totalMs += r.ms;
              let outcome;
              if (r.winnerIdx === 0 || r.winnerIdx === 1) {
                const aIdx = aIsP0 ? 0 : 1;
                const aWon = r.winnerIdx === aIdx;
                const reason = r.reason || 'unknown';
                if (aWon) {
                  stats.aWins++;
                  outcome = `A (${deckA.name}) won via ${reason}`;
                  if ((aIsP0 && r.firstPlayer === 0) || (!aIsP0 && r.firstPlayer === 1)) stats.aWinsWhenFirst++;
                  else stats.aWinsWhenSecond++;
                  stats.aWinReasons[reason] = (stats.aWinReasons[reason] || 0) + 1;
                } else {
                  stats.bWins++;
                  outcome = `B (${deckB.name}) won via ${reason}`;
                  stats.bWinReasons[reason] = (stats.bWinReasons[reason] || 0) + 1;
                }
              } else {
                stats.draws++;
                outcome = `DRAW (${r.reason || 'unknown'})`;
                stats.ties.push({ gameIdx: i + 1, turns: r.turns, ms: r.ms, reason: r.reason, diagnosis: r.diagnosis });
              }
              console.log(`[self-play A/B] ${label} ${i + 1}/${count}: ${aLabel} vs ${bLabel} → ${outcome} (${r.turns}t, ${r.ms}ms) — running A:${stats.aWins} B:${stats.bWins} D:${stats.draws}`);
              if ((i + 1) % 10 === 0) {
                const mu = process.memoryUsage();
                const mb = (n) => Math.round(n / 1024 / 1024);
                console.log(`[self-play A/B] ${label} heap: rss=${mb(mu.rss)}MB heapUsed=${mb(mu.heapUsed)}MB`);
              }
            } catch (err) {
              console.error(`[self-play A/B] ${label} game ${i + 1} threw:`, err.message);
            }
          }
          const games = stats.aWins + stats.bWins + stats.draws;
          stats.games = games;
          stats.aWR = games ? +(stats.aWins / games).toFixed(3) : 0;
          stats.avgTurns = games ? +(stats.totalTurns / games).toFixed(1) : 0;
          stats.avgMsPerGame = games ? Math.round(stats.totalMs / games) : 0;
          const fmtReasons = (o) => {
            const entries = Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
            return entries.length ? entries.map(([k, v]) => `${k}:${v}`).join(', ') : '—';
          };
          console.log(`[self-play A/B] ${label} DONE — ${deckA.name}: ${stats.aWins}-${stats.bWins}, draws=${stats.draws}, WR=${(stats.aWR * 100).toFixed(1)}%, avgTurns=${stats.avgTurns}, avgMs=${stats.avgMsPerGame}`);
          console.log(`  ${deckA.name} wins via: ${fmtReasons(stats.aWinReasons)}`);
          console.log(`  ${deckB.name} wins via: ${fmtReasons(stats.bWinReasons)}`);
          byConfig.push(stats);
        }
      } finally {
        setRolloutHorizon(originalHorizon);
        setRolloutBrain(originalBrain);
        setCpuVerbose(_prevVerbose_ab);
      }

      const totalMs = Date.now() - t0;
      console.log(`[self-play A/B] ═══ FINAL REPORT (${totalMs}ms total) ═══`);
      console.log(`  Matchup: ${deckA.name} (A) vs ${deckB.name} (B), ${count} games per config`);
      console.log(`  ${'Horizon'.padEnd(8)} ${'Brain'.padEnd(11)} ${'A-Wins'.padStart(7)} ${'B-Wins'.padStart(7)} ${'Draws'.padStart(6)} ${'A-WR'.padStart(7)} ${'A-1st'.padStart(6)} ${'A-2nd'.padStart(6)} ${'AvgTurns'.padStart(9)} ${'AvgMs'.padStart(7)}`);
      const fmtReasonsForReport = (o) => {
        const entries = Object.entries(o || {}).sort((a, b) => b[1] - a[1]);
        return entries.length ? entries.map(([k, v]) => `${k}:${v}`).join(', ') : '—';
      };
      for (const s of byConfig) {
        const wrPct = (s.aWR * 100).toFixed(1);
        console.log(`  ${String(s.horizon).padEnd(8)} ${s.brain.padEnd(11)} ${String(s.aWins).padStart(7)} ${String(s.bWins).padStart(7)} ${String(s.draws).padStart(6)} ${wrPct.padStart(6)}% ${String(s.aWinsWhenFirst).padStart(6)} ${String(s.aWinsWhenSecond).padStart(6)} ${String(s.avgTurns).padStart(9)} ${String(s.avgMsPerGame).padStart(7)}`);
        console.log(`      A wins: ${fmtReasonsForReport(s.aWinReasons)}  |  B wins: ${fmtReasonsForReport(s.bWinReasons)}`);
      }
      const summary = {
        ok: true,
        deckA: deckA.name, deckB: deckB.name,
        gamesPerConfig: count,
        totalMs,
        byConfig,
      };
      socket.emit('debug_self_play_ab_result', summary);
    })().catch(err => {
      console.error('[self-play A/B] runner threw:', err.message, err.stack);
      setCpuVerbose(_prevVerbose_ab);
      try { setRolloutHorizon(2); setRolloutBrain('heuristic'); } catch {}
      socket.emit('debug_self_play_ab_result', { ok: false, msg: err.message });
    });
  });

  // ═══════════════════════════════════════════
  //  CPU vs CPU spectate — both sides controlled by the CPU brain, user
  //  watches at normal pace via the standard spectator UI.
  //    socket.emit('debug_cpu_vs_cpu', { deckNameA: 'Dance of the Butterflies', deckNameB: 'Heal Burn' });
  //    socket.on('cpu_battle_error', console.log);
  // ═══════════════════════════════════════════
  onDebug('debug_cpu_vs_cpu', async ({ deckNameA, deckNameB } = {}) => {
    if (!currentUser) { socket.emit('cpu_battle_error', 'Not authenticated'); return; }
    if (activeGames.has(currentUser.userId)) { socket.emit('cpu_battle_error', 'Already in a game — leave first'); return; }

    // Find decks by name across user + sample decks.
    try {
      const rows = await db.all('SELECT * FROM decks WHERE user_id = ?', [currentUser.userId]);
      const userDecks = rows.map(parseDeck).filter(Boolean);
      const pool = [...userDecks, ...loadSampleDecks()].filter(d =>
        d && Array.isArray(d.heroes) && d.heroes.length > 0
        && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
      const findByName = (n) => pool.find(d => (d.name || '').toLowerCase().includes((n || '').toLowerCase()));
      const deckA = findByName(deckNameA);
      const deckB = findByName(deckNameB);
      if (!deckA) { socket.emit('cpu_battle_error', `Deck A not found: ${deckNameA}`); return; }
      if (!deckB) { socket.emit('cpu_battle_error', `Deck B not found: ${deckNameB}`); return; }

      const snapshotDeck = (d) => JSON.parse(JSON.stringify({
        mainDeck: d.mainDeck || [], heroes: d.heroes || [],
        potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
        skins: d.skins || {},
      }));

      const roomId = 'cvc-' + uuidv4().substring(0, 8);
      const room = {
        id: roomId, host: currentUser.username, hostId: currentUser.userId,
        // Marked as 'cpu_vs_cpu' so sendSpectatorGameState can reveal
        // both hands for the watcher. The CPU driver logic keys off
        // engine._isSelfPlay below, not room.type, so regular SP code
        // paths aren't affected.
        type: 'cpu_vs_cpu', format: 1, winsNeeded: 1, setScore: [0, 0],
        playerPw: null, specPw: null,
        players: [
          { username: `CPU · ${deckA.name}`, userId: 'cpu-a-' + roomId, socketId: null, deckId: 'cvc-a' },
          { username: `CPU · ${deckB.name}`, userId: 'cpu-b-' + roomId, socketId: null, deckId: 'cvc-b' },
        ],
        spectators: [{ socketId: socket.id, userId: currentUser.userId, username: currentUser.username }],
        status: 'waiting', created: Date.now(),
        gameState: null, chatHistory: [], privateChatHistory: {},
        _currentDecks: [snapshotDeck(deckA), snapshotDeck(deckB)],
        _deckNames: [deckA.name, deckB.name],
      };
      rooms.set(roomId, room);
      socket.join('room:' + roomId);
      // Occupy an activeGames slot so the user can't double-launch.
      activeGames.set(currentUser.userId, roomId);

      await setupGameState(room);
      const firstPlayer = Math.random() < 0.5 ? 0 : 1;
      console.log(`[cpu-vs-cpu] ${deckA.name} (p0) vs ${deckB.name} (p1), firstPlayer=p${firstPlayer}`);

      await startGameEngine(room, roomId, firstPlayer, (engine) => {
        engine._isSelfPlay = true; // every turn driven by the CPU brain
        engine._cpuPlayerIdx = firstPlayer;
        installCpuBrain(engine);
        engine.onGameOver = (r, winnerIdx, reason) => {
          if (r.gameState && !r.gameState.result) {
            r.gameState.result = { winnerIdx, reason, isCpuBattle: true };
          }
          for (let i = 0; i < 2; i++) sendGameState(r, i);
          sendSpectatorGameState(r);
          // Free the slot so the user can launch another spectate or rematch.
          setTimeout(() => { activeGames.delete(currentUser.userId); }, 1000);
        };
      });
      room.engine._cpuDriver = makeCpuDriver(room);

      // DELIBERATELY NOT entering fast mode — the whole point is to
      // watch at normal pace. Pacing delays (_delay, broadcasts,
      // animations) fire as they do in a regular CPU battle.

      // Auto-mulligan both sides via the smart-mulligan heuristic, same
      // as self-play batches do (no user interaction needed).
      if (room.gameState.mulliganDecisions) {
        for (const pi of [0, 1]) {
          let mull = false;
          try {
            room.engine._cpuPlayerIdx = pi;
            mull = shouldMulliganStartingHand(room.engine, pi);
          } catch (err) {
            console.error('[cpu-vs-cpu] mulligan check threw:', err.message);
          }
          room.gameState.mulliganDecisions[pi] = mull;
          if (mull) {
            const ps = room.gameState.players[pi];
            const cardDB = getCardDB();
            const handSize = ps.hand.length;
            let potionCount = 0;
            for (const card of ps.hand) {
              const cd = cardDB[card];
              if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
              else { ps.mainDeck.push(card); }
            }
            ps.hand.length = 0;
            const shuf = (arr) => {
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
            };
            shuf(ps.mainDeck);
            shuf(ps.potionDeck);
            const mainToDraw = handSize - potionCount;
            for (let i = 0; i < mainToDraw; i++) {
              if (ps.mainDeck.length === 0) break;
              ps.hand.push(ps.mainDeck.shift());
            }
            for (let i = 0; i < potionCount; i++) {
              if (ps.potionDeck.length === 0) break;
              ps.hand.push(ps.potionDeck.shift());
            }
          }
        }
        room.gameState.mulliganPending = false;
        delete room.gameState.mulliganDecisions;
      }

      // Initial state push so the spectator sees the board immediately.
      sendSpectatorGameState(room);

      // Kick off the engine — it chains through every subsequent turn
      // via _cpuDriver until gs.result is set.
      room.engine.startGame().catch(err => {
        console.error('[cpu-vs-cpu] startGame threw:', err.message, err.stack);
        socket.emit('cpu_battle_error', 'Engine error: ' + err.message);
      });
    } catch (err) {
      console.error('[cpu-vs-cpu] setup threw:', err.message, err.stack);
      socket.emit('cpu_battle_error', 'Setup failed: ' + err.message);
      activeGames.delete(currentUser.userId);
    }
  });

  socket.on('start_cpu_battle', ({ playerDeckId, cpuDeckId }) => {
    if (!currentUser) return;
    createCpuBattle({ playerDeckId, cpuDeckId }).catch(err => {
      console.error('[CPU battle] creation error:', err.message, err.stack);
      socket.emit('cpu_battle_error', 'Failed to start: ' + (err.message || 'unknown'));
    });
  });

  // Rematch: human clicks REMATCH on the singleplayer win/lose screen.
  // Reuses the player's currently-selected deck (as synced via
  // `change_deck` through the dropdown) and re-uses the previous CPU
  // opponent's deck by default — the client sends no cpuDeckId, so
  // "Rematch" means "same opponent, your chosen deck". The current
  // room is destroyed (activeGames cleared) so createCpuBattle can
  // spin up a fresh one without tripping the "already in a game" guard.
  socket.on('rematch_cpu_battle', ({ roomId, cpuDeckId }) => {
    console.log('[CPU rematch] received', { roomId, cpuDeckId, user: currentUser?.username });
    if (!currentUser) { console.warn('[CPU rematch] no currentUser — aborting'); return; }
    const room = rooms.get(roomId);
    if (!room) { console.warn('[CPU rematch] room not found:', roomId); return; }
    if (room.type !== 'singleplayer') { console.warn('[CPU rematch] wrong room type:', room.type); return; }
    const playerEntry = room.players?.find(p => p.userId === currentUser.userId);
    if (!playerEntry) { console.warn('[CPU rematch] playerEntry not found in room', roomId); return; }
    // Kampagnen-Duell: erneut antreten heißt hier "nochmal versuchen" —
    // gleicher Gegner, Deck wieder aus dem Speicherstand.
    if (room._campaign) {
      const camp = room._campaign;
      socket.leave('room:' + roomId);
      cleanupRoom(roomId);
      createCpuBattle({ campaign: camp }).catch(err => {
        console.error('[Campaign] Wiederholung fehlgeschlagen:', err.message);
        socket.emit('cpu_battle_error', 'Retry failed: ' + (err.message || 'unknown'));
      });
      return;
    }
    const playerDeckId = playerEntry.deckId;
    // CPU is always player index 1 in singleplayer rooms (set by
    // createCpuBattle at line ~5617). Fall back to the prior CPU deck
    // when the client doesn't pass one.
    const cpuEntry = room.players?.[1];
    const cpuDeckIdToUse = cpuDeckId || cpuEntry?.deckId;
    console.log('[CPU rematch] resolved decks', { playerDeckId, cpuDeckIdToUse });
    // Clean up the old room synchronously — don't even need to emit a
    // departure; the client is about to receive a brand-new game_state.
    socket.leave('room:' + roomId);
    cleanupRoom(roomId);
    console.log('[CPU rematch] cleanup done, calling createCpuBattle');
    createCpuBattle({ playerDeckId, cpuDeckId: cpuDeckIdToUse })
      .then(() => console.log('[CPU rematch] createCpuBattle resolved'))
      .catch(err => {
        console.error('[CPU rematch] creation error:', err.message, err.stack);
        socket.emit('cpu_battle_error', 'Failed to rematch: ' + (err.message || 'unknown'));
      });
  });

  // ── Tutorial system ──
  socket.on('get_tutorials', async () => {
    if (!currentUser) return;
    try {
      const tutDir = path.join(__dirname, 'data', 'puzzles', 'tutorial');
      if (!fs.existsSync(tutDir)) { socket.emit('tutorial_list', []); return; }
      const files = fs.readdirSync(tutDir).filter(f => f.endsWith('.json')).sort();
      const tutorials = [];
      for (const file of files) {
        const base = file.replace(/\.json$/, '');
        const match = base.match(/^tutorial(\d+)\s+(.+)$/i);
        if (!match) continue;
        const num = parseInt(match[1], 10);
        const name = match[2];
        const tutorialId = 'tutorial/' + base;
        tutorials.push({ num, name, tutorialId, fileName: base });
      }
      tutorials.sort((a, b) => a.num - b.num);

      const completions = await db.all(
        'SELECT puzzle_id FROM puzzle_completions WHERE user_id = ?',
        [currentUser.userId]
      );
      const completedSet = new Set(completions.map(r => r.puzzle_id));
      const completedByNum = new Set(
        tutorials.filter(t => completedSet.has(t.tutorialId)).map(t => t.num)
      );

      // Progression gate: tutorial N is locked until tutorial N-1 is cleared.
      // Tutorial 1 is always unlocked.
      socket.emit('tutorial_list', tutorials.map(t => ({
        num: t.num, name: t.name, tutorialId: t.tutorialId,
        completed: completedSet.has(t.tutorialId),
        locked: t.num > 1 && !completedByNum.has(t.num - 1),
      })));
    } catch (err) {
      console.error('[Tutorial] get_tutorials error:', err.message);
      socket.emit('tutorial_list', []);
    }
  });

  socket.on('start_tutorial_attempt', ({ tutorialId }) => {
    if (!currentUser) return;
    if (activeGames.has(currentUser.userId)) { socket.emit('puzzle_error', 'Already in a game'); return; }

    (async () => {
      try {
        const fileName = tutorialId.replace('tutorial/', '');
        const filePath = path.join(__dirname, 'data', 'puzzles', 'tutorial', fileName + '.json');
        if (!fs.existsSync(filePath)) { socket.emit('puzzle_error', 'Tutorial not found'); return; }

        // Progression gate: parse this tutorial's number out of its file
        // name and require the previous tutorial to already be cleared.
        const numMatch = fileName.match(/^tutorial(\d+)/i);
        const num = numMatch ? parseInt(numMatch[1], 10) : 1;
        if (num > 1) {
          const tutDir = path.dirname(filePath);
          const prevPrefix = `tutorial${num - 1} `;
          const prevFile = fs.readdirSync(tutDir).find(f => f.startsWith(prevPrefix) && f.endsWith('.json'));
          if (prevFile) {
            const prevId = 'tutorial/' + prevFile.replace(/\.json$/, '');
            const cleared = await db.get(
              'SELECT 1 FROM puzzle_completions WHERE user_id = ? AND puzzle_id = ?',
              [currentUser.userId, prevId]
            );
            if (!cleared) { socket.emit('puzzle_error', 'Clear the previous tutorial first.'); return; }
          }
        }

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const puzzleData = decryptPuzzle(raw.data);

        await createPuzzleGame(puzzleData, {
          puzzleAttemptId: tutorialId,
          isTutorial: true,
        });
      } catch (err) {
        console.error('[Tutorial] start_tutorial_attempt error:', err.message, err.stack);
        socket.emit('puzzle_error', 'Failed to load tutorial: ' + err.message);
      }
    })();
  });

  // ── Retry puzzle/tutorial: clean up current game and immediately restart ──
  socket.on('retry_puzzle', () => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (!activeRoomId) return;
    const room = rooms.get(activeRoomId);
    if (!room?.gameState || room.type !== 'puzzle') return;

    const gs = room.gameState;
    const puzzleData = gs._puzzleRawData;
    const attemptId = gs._puzzleAttemptId;
    const difficulty = gs._puzzleDifficulty;
    const isTutorial = gs.isTutorial || false;

    if (!puzzleData) { socket.emit('puzzle_error', 'No puzzle data available for retry'); return; }

    // Clean up old room
    // Laufende Ketten der ALTEN Engine stilllegen, bevor der Raum
    // verschwindet — sonst loest eine angefangene Aufloesung (Lunar
    // Eclipse & Co.) weiter auf und wirkt in den frischen Versuch
    // hinein (Als Befund 5.8.).
    room.engine?.abort?.();
    socket.leave('room:' + activeRoomId);
    activeGames.delete(currentUser.userId);
    destroyRoom(activeRoomId);

    // Restart with stored data (deep clone so original stays clean for future retries)
    const freshData = JSON.parse(JSON.stringify(puzzleData));
    createPuzzleGame(freshData, {
      puzzleAttemptId: attemptId,
      puzzleDifficulty: isTutorial ? null : difficulty,
      isTutorial,
    }).catch(err => {
      console.error('[Puzzle] retry error:', err.message, err.stack);
      socket.emit('puzzle_error', 'Failed to retry: ' + err.message);
    });
  });

  // ── Tutorial mid-game state modifications ──
  socket.on('tutorial_modify', ({ type }) => {
    if (!currentUser) return;
    const activeRoomId = activeGames.get(currentUser.userId);
    if (!activeRoomId) return;
    const room = rooms.get(activeRoomId);
    if (!room?.gameState || !room.gameState.isPuzzle) return;

    const gs = room.gameState;
    const engine = room.engine;
    const pi = gs.players.findIndex(ps => ps.userId === currentUser.userId);
    if (pi < 0) return;

    if (type === 'tutorial3_boost') {
      const ps = gs.players[pi];
      // Find Willy and Reiza by name prefix
      const willyIdx = ps.heroes.findIndex(h => h?.name && h.name.startsWith('Willy'));
      const reizaIdx = ps.heroes.findIndex(h => h?.name && h.name.startsWith('Reiza'));
      console.log(`[Tutorial] tutorial3_boost: Willy=${willyIdx}, Reiza=${reizaIdx}, heroes=${ps.heroes.map(h => h?.name).join(', ')}`);

      // Phase 1: ATK changes + remove Reiza's Fighting + clear Willy's old abilities
      if (willyIdx >= 0) {
        ps.heroes[willyIdx].atk = 9999;
        ps.heroes[willyIdx].baseAtk = 9999;
        // Log an atk_grant so the client plays the buff SFX.
        if (engine) {
          engine.log('atk_grant', {
            hero: ps.heroes[willyIdx].name, amount: 9999, source: 'Tutorial',
          });
        }
        // Clear old ability card instances for Willy
        if (engine) {
          engine.cardInstances = engine.cardInstances.filter(c =>
            !(c.owner === pi && c.zone === 'ability' && c.heroIdx === willyIdx)
          );
        }
        ps.abilityZones[willyIdx] = [[], [], []];
      }

      if (reizaIdx >= 0) {
        ps.heroes[reizaIdx].atk = 0;
        ps.heroes[reizaIdx].baseAtk = 0;
        // Remove Reiza's Fighting abilities
        if (engine) {
          engine.cardInstances = engine.cardInstances.filter(c =>
            !(c.owner === pi && c.zone === 'ability' && c.heroIdx === reizaIdx && c.name === 'Fighting')
          );
        }
        for (let z = 0; z < (ps.abilityZones[reizaIdx] || []).length; z++) {
          ps.abilityZones[reizaIdx][z] = (ps.abilityZones[reizaIdx][z] || []).filter(n => n !== 'Fighting');
        }
      }

      // Sync phase 1
      for (let i = 0; i < 2; i++) sendGameState(room, i);
      sendSpectatorGameState(room);

      // Phase 2: Attach Fighting to Willy after a short delay
      if (willyIdx >= 0) {
        setTimeout(() => {
          if (!room.gameState || room.gameState.result) return;
          ps.abilityZones[willyIdx] = [[], ['Fighting', 'Fighting', 'Fighting'], []];
          if (engine) {
            for (let copy = 0; copy < 3; copy++) {
              engine._trackCard('Fighting', pi, 'ability', willyIdx, 1);
            }
          }
          for (let i = 0; i < 2; i++) sendGameState(room, i);
          sendSpectatorGameState(room);
        }, 600);
      }
    }

    if (type === 'tutorial5_gold') {
      // Antonia's "pocket change" — set the player's Gold to 999 and fire a
      // gold_gain log so the standard SFX + float animation trigger.
      const ps = gs.players[pi];
      if (ps) {
        const prev = ps.gold || 0;
        ps.gold = 999;
        if (engine) {
          engine.log('gold_gain', { player: ps.username, amount: 999 - prev, total: 999 });
        }
        for (let i = 0; i < 2; i++) sendGameState(room, i);
        sendSpectatorGameState(room);
      }
    }

    if (type === 'tutorial4_suppress_reiza') {
      // Strip Reiza's onActionUsed hook (additional action) while keeping her afterSpellResolved (Stun+Poison)
      if (engine) {
        for (const inst of engine.cardInstances) {
          if (inst.owner === pi && inst.zone === 'hero' && inst.name && inst.name.startsWith('Reiza')) {
            const originalScript = inst.loadScript();
            if (originalScript?.hooks?.onActionUsed) {
              inst.script = { ...originalScript, hooks: { ...originalScript.hooks } };
              delete inst.script.hooks.onActionUsed;
              console.log(`[Tutorial] Stripped Reiza onActionUsed hook for player ${pi}`);
            }
          }
        }
      }
    }
  });

  socket.on('leave_room', ({ roomId }) => handleLeaveRoom(socket, roomId, currentUser));

  // Debug: add a card to a player's hand
  socket.on('disconnect', () => {
    if (!currentUser) return;
    // Cube Draft rooms: when a player's socket goes down mid-draft,
    // suspend the engine until they reconnect or the table vote-kicks
    // them. Mark socketId null so reconnect via join_room can pick the
    // seat back up. Doesn't fire activeGames cleanup since draft phase
    // doesn't use that registry.
    for (const room of rooms.values()) {
      if (!room.cubeDraft || room.cubeDraft.phase !== 'drafting') continue;
      const seatIdx = room.players.findIndex(p => p.socketId === socket.id && !p.isBot);
      if (seatIdx < 0) continue;
      room.players[seatIdx].socketId = null;
      if (room.cubeDraft.draftState && !room.cubeDraft.draftState.suspended) {
        cubeDraftSuspend(room, `${room.players[seatIdx].username} disconnected`, io);
      }
    }
    const activeRoomId = activeGames.get(currentUser.userId);
    if (activeRoomId) {
      const room = rooms.get(activeRoomId);
      if (room?.gameState && !room.gameState.result) {
        // Puzzle rooms: preserve existing immediate cleanup.
        if (room.type === 'puzzle') {
          activeGames.delete(currentUser.userId);
          destroyRoom(activeRoomId);
          return;
        }
        // Singleplayer rooms: F5 / browser refresh fires `disconnect`
        // and then re-runs `auth` once the new socket comes up — if we
        // tear the room down immediately, the reconnect grace window
        // in the auth handler has nothing to attach to and the user
        // gets booted to the main menu. Mark the player as disconnected
        // and start a generous cleanup timer instead. The existing
        // reconnect path (auth handler, ~line 5003) clears the timer
        // and restores socketId on return. There's no opponent to
        // declare a winner against, so the only thing that fires on
        // expiry is the room cleanup itself.
        if (room.type === 'singleplayer') {
          const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
          if (pi < 0) { cleanupRoom(activeRoomId); return; }
          // Dual-tab guard: ignore if a newer connection already took
          // this slot (the disconnect we're hearing is the OLD socket
          // closing after `superseded`).
          if (room.players[pi]?.socketId !== socket.id) return;
          room.gameState.players[pi].disconnected = true;
          // Hold onto the room for 5 minutes — plenty for a refresh
          // / brief network blip. Anything longer than that is "the
          // user closed the tab" and we'd rather reclaim resources.
          const SP_RECONNECT_GRACE_MS = 5 * 60 * 1000;
          const timer = setTimeout(() => {
            disconnectTimers.delete(currentUser.userId);
            cleanupRoom(activeRoomId);
          }, SP_RECONNECT_GRACE_MS);
          disconnectTimers.set(currentUser.userId, timer);
          return;
        }
        const pi = room.gameState.players.findIndex(ps => ps.userId === currentUser.userId);
        if (pi >= 0) {
          // Ignore if this socket was superseded by a newer connection (dual-tab)
          if (room.players[pi]?.socketId !== socket.id) return;

          room.gameState.players[pi].disconnected = true;
          const oi = pi===0?1:0;
          sendGameState(room, oi);
          sendSpectatorGameState(room);
          const timer = setTimeout(() => {
            disconnectTimers.delete(currentUser.userId);
            if (room.gameState && !room.gameState.result) endGame(room, oi, 'disconnect_timeout').catch(e => console.error('[endGame] error:', e.message));
            activeGames.delete(currentUser.userId);
          }, 60000);
          disconnectTimers.set(currentUser.userId, timer);
        }
        return;
      }
      // Post-result singleplayer / puzzle rooms: preserve across transient
      // disconnects (socket.io heartbeat blips, tab backgrounding) so the
      // user's rematch opportunity isn't destroyed. Explicit leave_game /
      // rematch_cpu_battle handlers handle cleanup on purpose.
      if (room && (room.type === 'singleplayer' || room.type === 'puzzle')) return;
    }
    for (const [rid, room] of rooms) {
      if (room.players.some(p => p.username === currentUser.username) || room.spectators.some(s => s.username === currentUser.username))
        handleLeaveRoom(socket, rid, currentUser);
    }
  });
});

function handleLeaveRoom(socket, roomId, user) {
  if (!user) return;
  const room = rooms.get(roomId);
  if (!room) return;

  socket.leave('room:' + roomId);

  if (room.hostId === user.userId) {
    // Cube Draft rooms in the LOBBY phase: promote the next-joined human
    // to host instead of destroying the room. The cube itself was
    // captured at create time (cubeDraft.cubeOwnerId points at the
    // original host's user_id and cube card list is loaded later from
    // that user's deck row), so the new host doesn't need to own a
    // legal cube — they just inherit the chair.
    if (room.cubeDraft && room.cubeDraft.phase === 'lobby') {
      const remainingHumans = room.players.filter(p => p.userId !== user.userId && !p.isBot);
      if (remainingHumans.length > 0) {
        // First-joined remaining human becomes host. `room.players` is
        // append-ordered by join, so this is the natural successor.
        room.players = room.players.filter(p => p.userId !== user.userId);
        const newHost = room.players[0];
        room.host = newHost.username;
        room.hostId = newHost.userId;
        room.spectators = room.spectators.filter(s => s.username !== user.username);
        io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
        io.emit('rooms', getRoomList());
        return;
      }
      // No humans left — fall through to room destruction.
    }
    // Standard host-leave: destroy the room. Clean up activeGames for all players.
    for (const p of room.players) activeGames.delete(p.userId);
    destroyRoom(roomId);
    io.to('room:' + roomId).emit('room_closed');
  } else {
    room.players = room.players.filter(p => p.username !== user.username);
    room.spectators = room.spectators.filter(s => s.username !== user.username);
    io.to('room:' + roomId).emit('room_update', sanitizeRoom(room));
  }
  io.emit('rooms', getRoomList());
}

function getRoomList() {
  return Array.from(rooms.values())
    .filter(r => r.type !== 'puzzle')
    // Hide cube-tournament child rooms from the public lobby — they're
    // internal to the tournament and joinable only via the parent room
    // (cross-game spectator UI).
    .filter(r => !r.parentCubeRoomId)
    .map(r => ({
      id: r.id, host: r.host, type: r.type, format: r.format || 1,
      hasPlayerPw: !!r.playerPw, hasSpecPw: !!r.specPw,
      playerCount: r.players.length,
      maxPlayers: r.maxPlayers || 2,
      spectatorCount: r.spectators.length,
      status: r.status, created: r.created,
      players: r.players.map(p => p.username),
      // Lightweight cube-draft summary for the lobby list — name only,
      // never the actual cube card list. Enough for the room card to
      // render "🧊 Cube Draft — <Cube Name>" without leaking the pool.
      cubeDraft: r.cubeDraft ? {
        cubeName: r.cubeDraft.cubeName,
        prelimsBo: r.cubeDraft.prelimsBo,
        finaleBo: r.cubeDraft.finaleBo,
        flow: r.cubeDraft.flow,
        phase: r.cubeDraft.phase,
        timerDisabled: !!r.cubeDraft.timerDisabled,
      } : null,
    }));
}

function sanitizeRoom(room, forUser) {
  return {
    id: room.id, host: room.host, type: room.type, format: room.format || 1,
    hasPlayerPw: !!room.playerPw, hasSpecPw: !!room.specPw,
    maxPlayers: room.maxPlayers || 2,
    players: room.players.map(p => p.username),
    // Cube Draft rooms expose seat-level metadata so the lobby UI can
    // show 8 slots, mark bots, and indicate which seat the viewer
    // occupies. Bot seats won't exist until the host hits Start —
    // before that, empty seats are simply absent from this list.
    seats: (room.maxPlayers || 2) > 2
      ? Array.from({ length: room.maxPlayers || 2 }, (_, i) => {
          const p = room.players[i];
          return p ? { username: p.username, isBot: !!p.isBot, isHost: p.username === room.host } : null;
        })
      : undefined,
    spectators: room.spectators.map(s => s.username),
    status: room.status, created: room.created,
    isHost: forUser === room.host,
    cubeDraft: room.cubeDraft ? {
      cubeName: room.cubeDraft.cubeName,
      packTimerSec: room.cubeDraft.packTimerSec,
      pickTimerSec: room.cubeDraft.pickTimerSec,
      timerDisabled: !!room.cubeDraft.timerDisabled,
      prelimsBo: room.cubeDraft.prelimsBo,
      finaleBo: room.cubeDraft.finaleBo,
      flow: room.cubeDraft.flow,
      phase: room.cubeDraft.phase,
    } : null,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  HEADLESS TRAINING MODE (PP_TRAIN=1)
//  Runs a pinned deck against the full sample-deck field WITHOUT
//  opening a socket server, recording per-game training data via
//  cards/effects/_train-recorder.js. Invoked from the START block
//  below instead of server.listen().
//
//    PP_TRAIN=1 PP_TRAIN_GAMES=300 node server.js
//    PP_TRAIN_DECK="Suicide Bombers"   (default)
//    PP_TRAIN_HORIZON=2                (rollout horizon during training;
//                                       lower = faster games)
//    PP_TRAIN_OUT=data/training/<auto>.jsonl
//
//  Mirrors runOneSelfPlayGame (the socket-triggered test runner) in
//  slimmed form — same room shape, same engine bootstrap, same smart
//  mulligan, same watchdogs — but module-scope so it needs no
//  authenticated socket. PP_DISABLE_PROFILES is forced ON so data
//  collection always reflects the UN-profiled baseline policy (no
//  feedback loop between the profile being trained and its own
//  training data).
// ═══════════════════════════════════════════════════════════════════
const { attachTrainingRecorder } = require('./cards/effects/_train-recorder');

// Tatsächliches V8-Heap-Limit in MB (respektiert --max-old-space-size).
// Grundlage der Trainings-Heap-Wächter: feste Schwellen passten weder zu
// 4-GB- noch zu 8-GB-Läufen.
function _trainHeapLimitMB() {
  try { return Math.round(require('v8').getHeapStatistics().heap_size_limit / 1048576); }
  catch { return 4096; }
}

async function runHeadlessTrainingGame(pinnedDeck, oppDeck, pinnedIdx, gameOpts = {}) {  const snapshotDeck = (d) => JSON.parse(JSON.stringify({
    mainDeck: d.mainDeck || [], heroes: d.heroes || [],
    potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [],
    skins: d.skins || {},
  }));
  const decks = pinnedIdx === 0 ? [pinnedDeck, oppDeck] : [oppDeck, pinnedDeck];
  const roomId = 'train-' + uuidv4().substring(0, 8);
  const room = {
    id: roomId, host: 'training', hostId: 'training',
    type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
    playerPw: null, specPw: null,
    players: [
      { username: 'CPU-A', userId: 'cpu-train-a-' + roomId, socketId: null, deckId: 'train-a' },
      { username: 'CPU-B', userId: 'cpu-train-b-' + roomId, socketId: null, deckId: 'train-b' },
    ],
    spectators: [], status: 'waiting', created: Date.now(),
    gameState: null, chatHistory: [], privateChatHistory: {},
    _currentDecks: [snapshotDeck(decks[0]), snapshotDeck(decks[1])],
    _deckNames: [decks[0].name || '?', decks[1].name || '?'],
  };
  rooms.set(roomId, room);
  await setupGameState(room);
  const firstPlayer = Math.random() < 0.5 ? 0 : 1;

  return new Promise((resolve) => {
    let done = false;
    let recorder = null;
    let startGamePromise = null;
    let watchdogInterval = null;
    let hardTimeoutTimer = null;
    const finish = (winnerIdx, reason) => {
      if (done) return;
      done = true;
      if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
      if (trailInterval) { clearInterval(trailInterval); trailInterval = null; }
      if (hardTimeoutTimer) { clearTimeout(hardTimeoutTimer); hardTimeoutTimer = null; }
      for (const p of room.players) activeGames.delete(p.userId);
      const record = recorder
        ? recorder.finish(winnerIdx, reason)
        : { outcome: null, reason: 'recorder-missing' };
      const drain = startGamePromise
        ? Promise.race([startGamePromise.catch(() => {}), new Promise(r => setTimeout(r, 2000))])
        : Promise.resolve();
      drain.then(() => {
        const eng = room.engine;
        if (eng) { eng.onGameOver = null; eng._cpuDriver = null; }
        room._currentDecks = null;
        destroyRoom(roomId);
        resolve(record);
      });
    };

    // ── HEAP-SPUR AUF PLATTE (31.7.) ─────────────────────────────────
    // Ein OOM tötet den Prozess ohne catch/finally — alles, was nur im
    // Speicher steht, ist weg. Die Brotkrume nennt bereits das Match;
    // sie bekommt jetzt zusätzlich eine ROLLIERENDE SPUR der letzten ~40
    // Sekunden. Damit ist nach dem Absturz ablesbar, WELCHER Zähler
    // explodiert ist (Aktionslog, Karteninstanzen, Snapshots, Hooks) und
    // ab welchem Zug / welcher Phase.
    //
    // Warum das nötig ist, obwohl es Heap-Wächter GIBT: der Inline-Check
    // in runHooks liegt HINTER `if (this._turnHooksKilled) return;`.
    // Sobald das CPU-Zeitlimit oder die Hook-Obergrenze einmal getroffen
    // hat, ist er für den Rest des Zuges stumm — jede weitere Allokation
    // läuft dann unbeobachtet bis zum Prozesstod. Der Sampler hängt an
    // keiner dieser Bedingungen.
    //
    // Ein blockierter Event-Loop kann während des Bursts selbst nicht
    // mehr samplen — die Spur zeigt dann den ANLAUF bis zum Einfrieren,
    // und genau der beantwortet die Frage.
    let trailInterval = null;
    if (gameOpts.trailPath) {
      const RING = 80;               // 80 × 500 ms ≈ 40 s Rückschau
      const samples = [];
      const probes = [];             // synchrone Sonden-Treffer (Burst)
      const t0 = Date.now();
      const flush = () => {
        try {
          fs.writeFileSync(gameOpts.trailPath, JSON.stringify({
            ...(gameOpts.trailHead || {}),
            heapTrail: samples,
            ...(probes.length ? { heapProbes: probes } : {}),
          }), { encoding: 'utf-8' });
        } catch { /* Forensik darf nie stören */ }
      };
      const sample = () => {
        if (done) return;
        try {
          const mu = process.memoryUsage();
          const eng = room.engine, gs = room.gameState;
          samples.push({
            ms: Date.now() - t0,
            heap: Math.round(mu.heapUsed / 1048576),
            rss: Math.round(mu.rss / 1048576),
            t: gs?.turn ?? null,
            ph: gs?.currentPhase ?? null,
            ap: gs?.activePlayer ?? null,
            log: eng?.actionLog?.length ?? null,
            inst: eng?.cardInstances?.length ?? null,
            snaps: eng?._snapshotsTaken ?? null,
            hooks: eng?._hooksFiredThisTurn ?? null,
            fb: eng?._cloneFallbacks ?? null,
            killed: eng?._turnHooksKilled ? 1 : 0,
          });
          if (samples.length > RING) samples.splice(0, samples.length - RING);
          flush();
        } catch { /* Forensik darf nie stören */ }
      };
      // SOFORT einen Punkt setzen und JEDEN Tick schreiben. Der Absturz
      // vom 31.7. (Spiel 2, Sitz 1) hinterließ GAR KEINE Spur, weil der
      // alte Takt erst nach 4 Ticks = 2 s schrieb und das Spiel vorher
      // starb. Eine ~10-KB-Datei zweimal je Sekunde ist billiger als ein
      // verlorener Absturz.
      sample();
      trailInterval = setInterval(sample, 500);
      if (trailInterval.unref) trailInterval.unref();
      // SYNCHRONE SONDE: die Engine meldet je 100 MB Heap-Zuwachs — auch
      // dann, wenn der Event-Loop blockiert ist und `sample()` nie wieder
      // drankommt. Das ist der einzige Kanal, der einen synchronen Burst
      // von innen beschreibt (mit Hook-Namen, Zug, Phase, Snapshot-Zahl).
      gameOpts.attachProbeSink = (engine) => {
        engine._crashTrailSink = (rec) => {
          probes.push({ ms: Date.now() - t0, ...rec });
          if (probes.length > 60) probes.splice(0, probes.length - 60);
          flush();
        };
      };
    }

    startGameEngine(room, roomId, firstPlayer, (engine) => {
      engine._isSelfPlay = true;
      engine._cpuPlayerIdx = firstPlayer;
      // Sonden-Sink so früh wie möglich anhängen — der Burst kann schon
      // in den ersten Sekunden zuschlagen (gemessen: Spiel 2 starb, bevor
      // der zeitgesteuerte Sampler überhaupt geschrieben hatte).
      if (typeof gameOpts.attachProbeSink === 'function') gameOpts.attachProbeSink(engine);
      // Spiegel-A/B (PP_TRAIN_AB): Profil nur für die designierte Seite
      // aktivieren — die Gegenseite pilotiert mit dem reinen
      // MCTS-Baseline-Gehirn. Muss VOR der ersten Profil-Abfrage
      // (Mulligan / Zug 1) gesetzt sein.
      if (gameOpts.profileAllowedSide != null) {
        engine._profileAllowedSide = gameOpts.profileAllowedSide;
      }
      // ── GEPAARTES MESSEN (PP_PROFILE_DIR_A / _B) ──────────────────
      // Beide Seiten laden Profile, aber aus VERSCHIEDENEN
      // Verzeichnissen: Seite A das neue Set, Seite B das alte. Damit
      // laufen die beiden Profil-Generationen im SELBEN Spiel
      // gegeneinander, auf demselben Code. Der Vergleich ist gegen
      // Engine-Drift immun — die Drift wirkt auf beide Arme gleich.
      //
      // Hintergrund: A/B-Ergebnisse ueber verschiedene Codestaende sind
      // NICHT vergleichbar (gemessen: ein Deck bewegte sich allein
      // durch Engine-Aenderungen um 8.7 Punkte), und eine vollstaendige
      // Neumessung der 42 Profile kostet rund 61 Stunden.
      if (process.env.PP_PROFILE_DIR_A || process.env.PP_PROFILE_DIR_B) {
        const a = process.env.PP_PROFILE_DIR_A || process.env.PP_PROFILE_DIR_B;
        const b = process.env.PP_PROFILE_DIR_B || process.env.PP_PROFILE_DIR_A;
        engine._profileDirBySide = pinnedIdx === 0 ? [a, b] : [b, a];
        // Die Seiten-Maske wuerde die Gegenseite stumm schalten — genau
        // das Gegenteil dessen, was hier gemessen werden soll.
        engine._profileAllowedSide = null;
      }
      installCpuBrain(engine);
      recorder = attachTrainingRecorder(engine, {
        pinnedIdx,
        pinnedName: pinnedDeck.name,
        opponentName: oppDeck.name,
        firstPlayer,
        // Card-pool allowlist — see recorder for why controller-based
        // attribution alone is not enough.
        allowedNames: new Set([
          ...(pinnedDeck.mainDeck || []),
          ...(pinnedDeck.potionDeck || []),
        ]),
      });
      engine.onGameOver = (_room, winnerIdx, reason) => {
        if (room.gameState && !room.gameState.result) {
          room.gameState.result = { winnerIdx, reason };
        }
        finish(winnerIdx, reason);
      };
    }).then(async () => {
      room.engine._cpuDriver = makeCpuDriver(room);
      // Smart auto-mulligan for both sides — same flow as self-play.
      if (room.gameState.mulliganDecisions) {
        for (const pi of [0, 1]) {
          let mull = false;
          try {
            room.engine._cpuPlayerIdx = pi;
            mull = shouldMulliganStartingHand(room.engine, pi);
          } catch (err) {
            console.error('[train] mulligan check threw:', err.message);
          }
          room.gameState.mulliganDecisions[pi] = mull;
          if (mull) {
            const ps = room.gameState.players[pi];
            const cardDB = getCardDB();
            const handSize = ps.hand.length;
            let potionCount = 0;
            for (const card of ps.hand) {
              const cd = cardDB[card];
              if (cd?.cardType === 'Potion') { ps.potionDeck.push(card); potionCount++; }
              else { ps.mainDeck.push(card); }
            }
            ps.hand.length = 0;
            const shuf = (arr) => {
              for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
              }
            };
            shuf(ps.mainDeck);
            shuf(ps.potionDeck);
            const mainToDraw = handSize - potionCount;
            for (let i = 0; i < mainToDraw; i++) {
              if (ps.mainDeck.length === 0) break;
              ps.hand.push(ps.mainDeck.shift());
            }
            for (let i = 0; i < potionCount; i++) {
              if (ps.potionDeck.length === 0) break;
              ps.hand.push(ps.potionDeck.shift());
            }
          }
          // Starthand-Lernkanal: finale Hand nach Entscheidung/Redraw
          // stempeln — der Trainings-Recorder liest das in finish().
          room.engine._startHandInfo = room.engine._startHandInfo || {};
          room.engine._startHandInfo[pi] = {
            hand: [...room.gameState.players[pi].hand], mulliganed: mull,
          };
        }
        room.gameState.mulliganPending = false;
        delete room.gameState.mulliganDecisions;
      }
      room.engine.enterFastMode();
      startGamePromise = room.engine.startGame()
        .then(() => {
          if (!done) {
            const w = room.gameState?.result?.winnerIdx;
            finish(w != null ? w : -1, room.gameState?.result?.reason || 'no-result');
          }
        })
        .catch(err => {
          console.error('[train] engine.startGame error:', err.message);
          if (!done) finish(-1, 'error: ' + err.message);
        });
    }).catch(err => {
      console.error('[train] setup error:', err.message);
      if (!done) finish(-1, 'setup-error: ' + err.message);
    });

    // Watchdogs — turn-stall + max-turns + hard timeout, mirroring self-play.
    let lastTurn = -1, stallTicks = 0;
    watchdogInterval = setInterval(() => {
      if (done) return;
      const gs = room.gameState;
      if (!gs) return;
      if ((gs.turn || 0) >= 400) { finish(-1, `max-turns@${gs.turn}`); return; }
      if (gs.turn === lastTurn) {
        // 80 Ticks (~120 s) statt 20 (~30 s): Die alte Schwelle lag exakt
        // auf dem 30-s-Karten-Hardcap — beide feuerten zeitgleich und der
        // Watchdog beendete das GANZE Spiel, bevor der Hardcap den
        // hängenden Play abandonnen und das Spiel retten konnte
        // (beobachtet: Slip 'n Slide „stalled@turn4"). Mit 120 s greift
        // die Kette Hardcap → Aufräumen → Weiterspielen zuerst; echte
        // Deadlocks räumt der Watchdog weiterhin ab.
        if (++stallTicks >= 80) finish(-1, `stalled@turn${gs.turn}`);
      } else { stallTicks = 0; lastTurn = gs.turn; }
      // Heap watchdog — abort the game before the OS OOM-killer takes the
      // whole batch. Schwelle leitet sich aus dem TATSÄCHLICHEN
      // V8-Heap-Limit ab (31.7.): der feste Default 2000 passte weder zu
      // 4-GB- noch zu 8-GB-Läufen. 55% des Limits lässt genug Luft, damit
      // GC den abgebrochenen Spielzustand noch einräumen kann.
      // PP_TRAIN_HEAP_MB überschreibt weiterhin hart.
      const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      const heapCap = parseInt(process.env.PP_TRAIN_HEAP_MB || '', 10)
        || Math.round(_trainHeapLimitMB() * 0.55);
      if (heapMB >= heapCap) {
        console.error(`[train heap-watchdog] abort at ${heapMB}MB (cap ${heapCap}) — ${room._deckNames.join(' vs ')}`);
        finish(-1, `heap-abort@${heapMB}MB`);
      }
    }, 1500);
    // Env-konfigurierbar (PP_GAME_TIMEOUT_MS): Mirror-Matches mit vollem
    // MCTS-Budget können die 5 Minuten allein durch Wandzeit pro Zug
    // reißen, obwohl die Zuglänge normal ist — für Benchmark-Duelle/
    // langsame Maschinen anhebbar. Default bleibt 5 Minuten.
    const gameTimeoutMs = (() => {
      const env = parseInt(process.env.PP_GAME_TIMEOUT_MS || '', 10);
      return Number.isFinite(env) && env > 0 ? env : 5 * 60 * 1000;
    })();
    hardTimeoutTimer = setTimeout(() => { if (!done) finish(-1, 'timeout'); }, gameTimeoutMs);
  });
}

async function runTrainingBatch() {
  // Force-off learned profiles during data collection (see header note) —
  // EXCEPT in eval mode (PP_TRAIN_EVAL=1), which runs the identical batch
  // WITH profiles active so a trained profile can be A/B-verified against
  // the same opponent field that produced its training data. Eval-mode
  // games are written to a separate file and should NOT be fed back into
  // training (off-baseline policy).
  const evalMode = process.env.PP_TRAIN_EVAL === '1';
  // Spiegel-A/B (PP_TRAIN_AB=1): gleiches Deck auf beiden Seiten, eine
  // Seite MIT Profil, die andere mit dem nackten MCTS-Baseline-Gehirn.
  // Deckstärke kürzt sich raus — gemessen wird reine Pilotenqualität.
  // Profile müssen laden (keine PP_DISABLE_PROFILES), die Seiten-Maske
  // im Game-Runner beschränkt sie auf die designierte Seite.
  const abMode = process.env.PP_TRAIN_AB === '1';
  // PP_TRAIN_OPP_PROFILES=1: Self-Play-Iteration — die GEGNER pilotieren
  // mit ihren trainierten Profilen (sofern vorhanden und nicht
  // quarantänisiert), die gepinnte Sammel-Seite bleibt Baseline +
  // Exploration. Stärkere Gegner → härtere Trainingsdaten. Bewusst NUR
  // gegner-seitig: Die eigene Seite mit Profil sammeln zu lassen (echte
  // Policy-Iteration) würde Konfundierungs-Bias über Generationen
  // VERSTÄRKEN statt korrigieren. Records werden mit oppProfiles
  // gestempelt — Generationen nicht in derselben Resume-Datei mischen.
  const oppProfiles = process.env.PP_TRAIN_OPP_PROFILES === '1' && !evalMode && !abMode;
  if (!evalMode && !abMode && !oppProfiles) process.env.PP_DISABLE_PROFILES = '1';
  // ε-Exploration (siehe _cpu.js exploreRoll): nur für Datensammlung.
  // In Eval-Läufen wird sie vom Helper ohnehin hart ignoriert — hier
  // zusätzlich laut warnen, damit ein versehentlich gesetztes Flag
  // nicht stillschweigend wirkungslos bleibt.
  const exploreEps = parseFloat(process.env.PP_TRAIN_EXPLORE || '0') || 0;
  if ((evalMode || abMode) && exploreEps > 0) {
    console.warn('[train] ⚠️  PP_TRAIN_EXPLORE ist in EVAL-/A/B-Läufen deaktiviert (gemessen wird die echte Policy)');
    delete process.env.PP_TRAIN_EXPLORE;
  }
  setCpuVerbose(process.env.PP_TRAIN_VERBOSE === '1');
  const horizon = parseInt(process.env.PP_TRAIN_HORIZON || '2', 10);
  setRolloutHorizon(horizon);
  let count = parseInt(process.env.PP_TRAIN_GAMES || '200', 10); // ggf. unten via PP_TRAIN_GAMES_MULT überschrieben
  const pinName = process.env.PP_TRAIN_DECK || 'Suicide Bombers';

  const samples = loadSampleDecks().filter(d =>
    d && Array.isArray(d.heroes) && d.heroes.length > 0
    && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const pinned = samples.find(d => norm(d.name).includes(norm(pinName)) || norm(pinName).includes(norm(d.name)));
  if (!pinned) {
    console.error(`[train] pinned deck not found: "${pinName}" — available: ${samples.map(d => d.name).join(', ')}`);
    process.exit(1);
  }
  // PP_TRAIN_OPP: optionaler Gegner-Filter (Substring, kommasepariert) —
  // für gezielte Matchup-Tests und Bug-Reproduktion.
  const oppFilter = (process.env.PP_TRAIN_OPP || '').split(',').map(norm).filter(Boolean);
  let opponents = abMode ? [pinned] : samples.filter(d => d !== pinned);
  if (!abMode && oppFilter.length > 0) {
    opponents = opponents.filter(d => oppFilter.some(f => norm(d.name).includes(f) || f.includes(norm(d.name))));
    if (opponents.length === 0) { console.error('[train] PP_TRAIN_OPP matcht keinen Gegner'); process.exit(1); }
    console.log(`[train] Gegner-Filter aktiv: ${opponents.map(d => d.name).join(', ')}`);
  }
  // PP_TRAIN_SKIP_OPP: Gegner per Substring AUSSCHLIESSEN — für Matchups,
  // die das Sandbox-Zeitfenster sprengen (Big Stomp/Slip) und separat
  // mit reduziertem Budget bewertet werden. Kommasepariert.
  const skipFilter = (process.env.PP_TRAIN_SKIP_OPP || '').split(',').map(norm).filter(Boolean);
  if (!abMode && skipFilter.length > 0) {
    opponents = opponents.filter(d => !skipFilter.some(f => norm(d.name).includes(f)));
    console.log(`[train] Gegner uebersprungen: ${skipFilter.join(', ')} — ${opponents.length} verbleiben`);
    // Ohne diesen Guard lief die Schleife mit leerer Gegnerliste weiter:
    // `opponents[i % 0]` ist undefined → "Cannot read properties of
    // undefined (reading 'name')". Sauber aussteigen statt zu werfen —
    // der Aufrufer (train-iterative) unterscheidet exit 2 von einem
    // echten Absturz.
    if (opponents.length === 0) {
      console.error('[train] PP_TRAIN_SKIP_OPP hat ALLE Gegner ausgeschlossen — nichts zu sammeln.');
      process.exit(2);
    }
  }
  // Vielfachen-Modus: PP_TRAIN_GAMES_MULT=k → Spiele = k × Gegnerzahl.
  // Garantiert exakte Rotations-Vielfache (jeder Gegner gleich oft),
  // auch wenn sich der Deck-Pool ändert — sonst bekommen die ersten
  // Gegner des letzten Teilzyklus systematisch mehr Spiele.
  const gamesMult = parseInt(process.env.PP_TRAIN_GAMES_MULT || '0', 10);
  if (gamesMult > 0 && opponents.length > 0) {
    count = gamesMult * opponents.length;
    console.log(`[train] PP_TRAIN_GAMES_MULT=${gamesMult} → ${count} Spiele (${gamesMult} × ${opponents.length} Gegner)`);
  }
  console.log(abMode
    ? `[train] A/B-SPIEGEL: "${pinned.name}" (Profil) vs "${pinned.name}" (Baseline), ${count} games, horizon=${horizon}`
    : `[train] "${pinned.name}" vs ${opponents.length} opponents, ${count} games, horizon=${horizon}${(!evalMode && exploreEps > 0) ? `, explore ε=${exploreEps}` : ''}${oppProfiles ? ', GEGNER-PROFILE AN (Self-Play-Iteration)' : ''}`);

  const outDir = path.join(__dirname, 'data', 'training');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = process.env.PP_TRAIN_OUT
    || path.join(outDir, `${norm(pinned.name)}-${abMode ? 'AB-' : evalMode ? 'EVAL-' : ''}${stamp}.jsonl`);
  console.log(`[train] ${abMode ? 'A/B MODE (Profil vs Baseline im Spiegel)' : evalMode ? 'EVAL MODE (profiles ON)' : 'data collection (profiles OFF)'} — writing → ${outPath}`);

  // ── Resumability ──
  // If the output file already exists, continue from its line count.
  // Completed games are appendFileSync'd one-by-one, so a crash (OOM,
  // power loss) only costs the in-flight game: relaunching with the same
  // PP_TRAIN_OUT picks up where the batch died, and the opponent
  // round-robin stays aligned because it's indexed by the same counter.
  let startIdx = 0;
  // Bilanz der bereits in der Datei stehenden Spiele. Ohne diese Zählung
  // startet die laufende W/L-Anzeige nach jedem Wiederanlauf bei 0 und
  // die DONE-Zeile meldet nur die Spiele DIESES Prozesses — nach einem
  // OOM also grob zu wenig (gemessen: Datei 1W-3L, DONE meldete 0W-2L).
  // Die Spiele selbst waren nie weg, nur die Anzeige.
  let resumedWins = 0, resumedLosses = 0, resumedTies = 0;
  try {
    if (fs.existsSync(outPath)) {
      const lines = fs.readFileSync(outPath, { encoding: 'utf-8' })
        .split('\n').filter(l => l.trim());
      startIdx = lines.length;
      if (startIdx > 0) {
        for (const line of lines) {
          try {
            const g = JSON.parse(line);
            if (g.outcome === 1) resumedWins++;
            else if (g.outcome === 0) resumedLosses++;
            else resumedTies++;
          } catch { /* korrupte Zeile → ignorieren */ }
        }
        console.log(`[train] resuming — ${startIdx} games already in output `
          + `(${resumedWins}W-${resumedLosses}L-${resumedTies}T übernommen)`);
      }
      // ε-Exploration: Novelty-Zähler mit den historischen Play-Summen
      // aus der Resume-Datei seeden, damit "novel" wirklich "über den
      // ganzen Datensatz nie gespielt" heißt — nicht bloß "seit dem
      // letzten Prozessstart nicht dran gewesen".
      if (exploreEps > 0 && !evalMode && startIdx > 0) {
        const seed = Object.create(null);
        for (const line of lines) {
          try {
            const g = JSON.parse(line);
            for (const [name, b] of Object.entries(g.plays || {})) {
              seed[name] = (seed[name] || 0) + (b.early || 0) + (b.mid || 0) + (b.late || 0);
            }
          } catch { /* korrupte Zeile → ignorieren */ }
        }
        seedExploreAttempts(seed);
        console.log(`[train] Novelty-Seed aus ${startIdx} Spielen: ${Object.keys(seed).length} Karten`);
      }
    }
  } catch { startIdx = 0; resumedWins = 0; resumedLosses = 0; resumedTies = 0; }

  let wins = resumedWins, losses = resumedLosses, ties = resumedTies;
  const t0 = Date.now();
  for (let i = startIdx; i < count; i++) {
    // Round-robin opponents so every archetype contributes equally;
    // alternate the pinned deck's seat so first-player advantage and
    // seat-dependent quirks average out.
    const opp = opponents[i % opponents.length];
    const pinnedIdx = i % 2;
    // ── ABSTURZ-ATTRIBUTION (31.7.) ──────────────────────────────────
    // Ein OOM tötet den PROZESS — kein catch, kein finally, kein Log
    // darüber, welches Match gerade lief. Die Konsole zeigt dann nur
    // das zuletzt FERTIGE Spiel, und die Ursache muss über den
    // Round-Robin-Index zurückgerechnet werden (so wurde der
    // Mawstruck-Absturz bei exakt 34 Spielen gefunden: Spiel 35 war
    // immer dasselbe Matchup). Deshalb hinterlässt jedes Spiel VOR dem
    // Start eine Brotkrume auf der Platte und räumt sie danach weg.
    // Bleibt sie liegen, hat genau dieses Match den Prozess getötet —
    // train-iterative.js liest sie und überspringt den Gegner beim
    // Wiederanlauf.
    const inflightPath = outPath + '.inflight.json';
    try {
      fs.writeFileSync(inflightPath, JSON.stringify({
        i, game: i + 1, pinned: pinned.name, opponent: opp.name, pinnedIdx,
        startedAt: new Date().toISOString(),
      }), { encoding: 'utf-8' });
    } catch { /* Brotkrume ist Diagnose, nie Abbruchgrund */ }
    let record;
    const trailHead = {
      i, game: i + 1, pinned: pinned.name, opponent: opp.name, pinnedIdx,
      startedAt: new Date().toISOString(),
    };
    try {
      // Brotkrume + Heap-Spur landen in DERSELBEN Datei: sie wird vor dem
      // Spiel geschrieben, vom Sampler fortgeschrieben und nach dem
      // erfolgreichen Append gelöscht. Überlebt sie, enthält sie beides —
      // das schuldige Match UND den Speicher-Anlauf bis zum Einfrieren.
      const gOpts = abMode ? { profileAllowedSide: pinnedIdx }
        : oppProfiles ? { profileAllowedSide: 1 - pinnedIdx } : {};
      gOpts.trailPath = inflightPath;
      gOpts.trailHead = trailHead;
      record = await runHeadlessTrainingGame(pinned, opp, pinnedIdx, gOpts);
    } catch (err) {
      console.error(`[train] game ${i + 1} threw:`, err.message);
      continue;
    }
    // Stamp the hero trio as PLAIN NAMES — the runtime profile matcher
    // keys on sorted hero-name strings. Sample-deck hero entries are
    // objects ({ hero, ability1, ability2 }); unwrap them.
    record.heroes = (pinned.heroes || [])
      .map(h => (h && typeof h === 'object') ? (h.hero || h.name) : h)
      .filter(Boolean);
    // Exploration-Stempel: Spiele aus ε-Läufen sind off-policy. Der
    // Trainer nutzt sie derzeit gleichberechtigt (das ist der Zweck —
    // Support für unerforschte Karten), aber das Feld erlaubt späteres
    // Down-Weighting oder getrennte Auswertung.
    if (!evalMode && !abMode && exploreEps > 0) record.exploreEps = exploreEps;
    // A/B-Spiele sind Messläufe, NIE Trainingsdaten (der Trainer filtert
    // abMode-Records zusätzlich hart raus). outcome ist bereits aus
    // Sicht der Profil-Seite gelabelt (pinnedIdx = profiledIdx).
    if (abMode) { record.abMode = true; record.profiledIdx = pinnedIdx; }
    if (oppProfiles) record.oppProfiles = true;
    fs.appendFileSync(outPath, JSON.stringify(record) + '\n', { encoding: 'utf-8' });
    // Spiel ist sicher auf der Platte → Brotkrume weg. Bleibt sie
    // liegen, war dieses Match der Prozess-Killer.
    try { fs.unlinkSync(inflightPath); } catch { /* schon weg */ }
    if (record.outcome === 1) wins++;
    else if (record.outcome === 0) losses++;
    else ties++;
    const msg = record.outcome === 1 ? 'WIN ' : record.outcome === 0 ? 'LOSS' : 'TIE ';
    console.log(`[train] ${i + 1}/${count} ${msg} vs ${opp.name} (${record.turns}t, ${record.reason}) — running ${wins}W-${losses}L-${ties}T`);
    if (typeof global.gc === 'function' && i % 10 === 9) { try { global.gc(); } catch {} }
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  if (process.env.PP_COVERAGE === '1' && global.__ppCoverage) {
    const covPath = (process.env.PP_TRAIN_OUT || 'training.jsonl').replace(/\.jsonl$/, '') + '.coverage.json';
    try {
      fs.writeFileSync(covPath, JSON.stringify(global.__ppCoverage, null, 1), 'utf-8');
      console.log(`[train] coverage → ${covPath} (${Object.keys(global.__ppCoverage).length} Karte|Hook-Schlüssel)`);
    } catch (err) { console.error('[train] coverage dump failed:', err.message); }
  }
  const _resumedTotal = resumedWins + resumedLosses + resumedTies;
  console.log(`[train] DONE in ${mins}min — ${wins}W-${losses}L-${ties}T`
    + (_resumedTotal > 0 ? ` (gesamte Datei, davon ${_resumedTotal} aus früheren Anläufen)` : '')
    + ` → ${outPath}`);
  if (abMode) {
    // Gesamtbilanz über die DATEI (nicht nur diesen Prozess) — Resume-
    // Fortsetzungen zählen mit. 95%-Wald-Intervall als Ehrlichkeits-
    // anker: bei n=100 ist ±~10 Prozentpunkte normal.
    try {
      let W = 0, L = 0, T = 0;
      for (const line of fs.readFileSync(outPath, { encoding: 'utf-8' }).split('\n')) {
        if (!line.trim()) continue;
        const g = JSON.parse(line);
        if (g.outcome === 1) W++; else if (g.outcome === 0) L++; else T++;
      }
      const n = W + L;
      const p = n > 0 ? W / n : 0;
      const ci = n > 0 ? 1.96 * Math.sqrt(p * (1 - p) / n) : 0;
      console.log(`[train] ═══ A/B-ERGEBNIS (gesamte Datei): Profil ${W}W-${L}L-${T}T gegen Baseline ═══`);
      console.log(`[train] Profil-Winrate im Spiegel: ${(100 * p).toFixed(1)}% ±${(100 * ci).toFixed(1)} (95%-CI, n=${n}) — 50% = kein Effekt`);
      // A/B-gated Deployment: Das Ergebnis wandert ins Profil-JSON.
      // Der Profil-Loader quarantänisiert Profile mit nachgewiesen
      // schädlichem Spiegel-Ergebnis (<48 % bei n≥50) — ein Profil, das
      // seinen eigenen Akzeptanztest verliert, deployt sich nicht mehr.
      // ── VARIANTEN-RIEGEL (v574) ──────────────────────────────────
      // Das Deployment-Gate darf AUSSCHLIESSLICH die Grundkonfiguration
      // messen. Am 21.8. hat ein als Ablation gedachter Lauf (der in
      // Wahrheit gar nicht abliert hat) seine 400-Spiele-Zahl in neun
      // Profile geschrieben und die Grundmessung dort ueberschrieben.
      // Waere die Ablation angekommen und ein Deck unter 48 % gefallen,
      // haette sie ein gesundes Profil quarantaenisiert. Der Riegel
      // sitzt bewusst HIER und nicht nur in ab-all.js — server.js kennt
      // seine eigene Umgebung, ein vergessenes Flag im Aufrufer kann ihn
      // also nicht umgehen.
      const _abVariante = [];
      if (process.env.PP_PROFILE_OFF) _abVariante.push(`Ablation ${process.env.PP_PROFILE_OFF}`);
      if (process.env.PP_PROFILE_CONF_CAP) _abVariante.push(`conf-cap ${process.env.PP_PROFILE_CONF_CAP}`);
      if (process.env.PP_AB_NO_PROFILE_WRITE === '1') _abVariante.push('vom Aufrufer gesperrt');
      if (_abVariante.length > 0) {
        console.log(`[train] abResult NICHT ins Profil geschrieben — Variantenlauf (${_abVariante.join(', ')}).`);
        console.log('[train] Das Deployment-Gate misst nur die Grundkonfiguration; das Ergebnis steht in der jsonl/Log-Datei.');
      } else {
      try {
        const slug = pinned.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const profPath = path.join(__dirname, 'data', 'cpu-profiles', `${slug}.json`);
        if (fs.existsSync(profPath)) {
          const prof = JSON.parse(fs.readFileSync(profPath, { encoding: 'utf-8' }));
          prof.abResult = {
            winrate: Math.round(p * 1000) / 1000, wins: W, losses: L, ties: T,
            games: n, date: new Date().toISOString().slice(0, 10),
          };
          fs.writeFileSync(profPath, JSON.stringify(prof, null, 2), { encoding: 'utf-8' });
          console.log(`[train] A/B-Ergebnis in ${slug}.json geschrieben${p < 0.48 && n >= 50 ? ' — Profil wird ab jetzt QUARANTÄNISIERT' : ''}`);
        }
      } catch (err) { console.error('[train] Konnte A/B-Ergebnis nicht ins Profil schreiben:', err.message); }
      }
    } catch (err) { console.error('[train] A/B-Summary fehlgeschlagen:', err.message); }
  } else {
    console.log(`[train] next: node scripts/train-deck-profile.js "${outPath}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BANDBREITEN-MESSSTAND (PP_NETTEST=1)
//
//  Beantwortet die Frage „was kosten mich diese Partien LIVE an
//  ausgehender Bandbreite?", ohne dass ein Spieler, ein Browser oder
//  eine Render-Instanz beteiligt sein muss.
//
//    PP_NETTEST=1 node server.js
//    Bequemer: node scripts/netbench.js --games 10 --spectators 2
//
//  WIE DAS GEHT — drei Beobachtungen aus dem Code:
//
//   1. `sendGameState` steigt bei `!p.socketId` aus. Im Trainingslauf
//      sind beide socketIds `null`, deshalb wird dort NIE eine Nutzlast
//      gebaut. Hier bekommen die Spieler ERFUNDENE socketIds, damit der
//      komplette Sendeweg laeuft — inklusive aller teuren Rechnungen,
//      die `sendGameState` je Aufruf anstellt.
//
//   2. Jeder Weg, der eine ECHTE Socket-Antwort braucht (Ketten-Abfrage,
//      target/option/confirm-Prompt), holt sich vorher `_getSocket(sid)`
//      und faellt bei `!socket` sofort auf einen Vorgabewert zurueck
//      (`pass`, erste Option, `false`). Unsere Socket-Registry ist leer,
//      also blockiert nichts — gemessen wird trotzdem, was rausgegangen
//      waere.
//
//   3. Der CPU-Treiber ruft `enterFastMode()` SELBST um seine
//      MCTS-Rollouts herum (sechs Stellen in _cpu.js). Die Partie
//      draussen darf also normal laufen: die Rollouts bleiben stumm,
//      nur die echten Spielzuege senden. Genau das misst man.
//
//  WAS GEMESSEN WIRD: jede Nachricht, die der Server an einen Client
//  schicken WUERDE — als socket.io-Rahmen (`42["ereignis",…]`), also
//  Byte fuer Byte das, was Render als „WebSocket Responses" zaehlt.
//  Zusaetzlich wird jede Nachricht durch einen permessage-deflate-Strom
//  je Verbindung geschickt, mit exakt der Konfiguration des Servers
//  (Schwelle 1024, Stufe 6, geteiltes Woerterbuch) — die Zahlen sind
//  damit die TATSAECHLICHEN Leitungsbytes, nicht die rohen.
//
//  Schalter (alle optional):
//    PP_NETTEST_GAMES=10        Partien (Vorgabe 5)
//    PP_NETTEST_DECK_A / _B     Decknamen (Teiltreffer); sonst zufaellig
//    PP_NETTEST_SPECTATORS=0    zusaetzliche Zuschauer je Partie
//    PP_NETTEST_REALTIME=1      Animationspausen NICHT ueberspringen
//    PP_NETTEST_OUT=<pfad>      JSON-Bericht (Vorgabe data/netbench/…)
//    PP_NETTEST_LOW=1           eigene Prozesspriorität senken
// ═══════════════════════════════════════════════════════════════════

/** Umgebungswert robust lesen — `set X=1 && …` schleppt in cmd ein
 *  Leerzeichen in den Wert. Das hat hier schon zweimal Zeit gekostet. */
function _nbEnv(name, vorgabe) {
  const v = process.env[name];
  return (v == null || String(v).trim() === '') ? vorgabe : String(v).trim();
}

// ── KONSOLEN-SCHLEUSE ────────────────────────────────────────────────
// Eine Partie OHNE Fast-Mode redet: `_cpuVerbose` steht in _cpu.js auf
// `true` (Vorgabe fuer den Entwicklerbetrieb), und der Trainingslauf
// schaltet es nur deshalb ab, weil er `setCpuVerbose(PP_TRAIN_VERBOSE)`
// ruft. Dazu kommen verstreute Meldungen aus Engine und Karten.
//
// Zwei Massnahmen, damit der Messlauf sich verhaelt wie das Training:
// `setCpuVerbose(false)` (die saubere Abschaltung an der Quelle) UND
// diese Schleuse, die alles Uebrige aus stdout heraushaelt, ohne es
// wegzuwerfen: die letzten Zeilen bleiben in einem Ringpuffer und
// werden gezeigt, wenn eine Partie haengt oder abstuerzt. Genau dann
// will man sie sehen — und sonst nie.
const _nbEcht = {
  log: console.log.bind(console), warn: console.warn.bind(console),
  info: console.info.bind(console), debug: console.debug.bind(console),
  error: console.error.bind(console),
};
/** Meine eigene Ausgabe — geht IMMER durch, auch bei geschlossener Schleuse. */
function _nbSchreib(...a) { _nbEcht.log(...a); }

function _nbSchleuse(ringGroesse = 400) {
  const ring = [];
  let verschluckt = 0;
  const schlucke = (praefix) => (...a) => {
    verschluckt++;
    try {
      ring.push(praefix + a.map(x => (typeof x === 'string' ? x : require('util').inspect(x, { depth: 1 }))).join(' '));
      if (ring.length > ringGroesse) ring.shift();
    } catch { /* Protokollieren darf nie stoeren */ }
  };
  return {
    zu() {
      console.log = schlucke(''); console.info = schlucke('');
      console.debug = schlucke(''); console.warn = schlucke('[warn] ');
      // console.error bleibt SICHTBAR: echte Fehler will man sofort
      // sehen, nicht erst im Nachhinein im Ringpuffer.
      console.error = (...a) => { schlucke('[error] ')(...a); _nbEcht.error(...a); };
    },
    auf() {
      console.log = _nbEcht.log; console.warn = _nbEcht.warn;
      console.info = _nbEcht.info; console.debug = _nbEcht.debug;
      console.error = _nbEcht.error;
    },
    letzte(n = 30) { return ring.slice(-n); },
    /** Ringpuffer leeren — je Partie einmal, damit die Diagnose bei
     *  einer auffaelligen Partie DEREN Zeilen zeigt und nicht die der
     *  sechs davor (Als Log 12.8.: zu sehen waren nur Startmeldungen
     *  und Abbruch-Quittungen frueherer Partien). */
    leeren() { ring.length = 0; },
    anzahl() { return verschluckt; },
  };
}

/** Ein Messstand fuer genau eine Partie. */
function _makeNetProbe() {
  // Ereignis -> { count, raw, wire }
  const jeEreignis = new Map();
  // Empfaenger -> { count, raw, wire }
  const jeEmpfaenger = new Map();
  // Rahmen in Sendereihenfolge, je Empfaenger (fuer den deflate-Strom)
  const rahmenJeEmpfaenger = new Map();
  let groesster = { bytes: 0, event: null };
  let broadcastRaw = 0, broadcastCount = 0;
  let laufend = 0, laufendRoh = 0;   // billige Live-Zaehler fuer den Fortschritt

  const buche = (map, key, roh) => {
    const e = map.get(key) || { count: 0, raw: 0, wire: 0 };
    e.count++; e.raw += roh;
    map.set(key, e);
    return e;
  };

  const erfasse = (sid, ereignis, daten) => {
    let rahmen;
    try {
      // socket.io v4, Standard-Namensraum: `42["ereignis",nutzlast]`
      rahmen = '42' + JSON.stringify([ereignis, daten === undefined ? null : daten]);
    } catch {
      rahmen = '42["' + ereignis + '",null]';   // zyklisch o.ae. — nicht messbar
    }
    const roh = Buffer.byteLength(rahmen, 'utf8');
    laufend++; laufendRoh += roh;
    buche(jeEreignis, ereignis, roh);
    buche(jeEmpfaenger, sid, roh);
    if (roh > groesster.bytes) groesster = { bytes: roh, event: ereignis };
    let liste = rahmenJeEmpfaenger.get(sid);
    if (!liste) { liste = []; rahmenJeEmpfaenger.set(sid, liste); }
    liste.push({ ereignis, buf: Buffer.from(rahmen, 'utf8') });
  };

  return {
    erfasse,
    /** Ohne Sortieren/Rechnen — fuer die Fortschrittszeile. */
    stand() { return { nachrichten: laufend, roh: laufendRoh }; },
    erfasseBroadcast(ereignis, daten) {
      try { broadcastRaw += Buffer.byteLength('42' + JSON.stringify([ereignis, daten ?? null]), 'utf8'); }
      catch { /* egal */ }
      broadcastCount++;
    },
    /**
     * Leitungsbytes bestimmen: je Empfaenger EIN deflate-Strom, wie ihn
     * `ws` fuer permessage-deflate mit context takeover fuehrt. Rahmen
     * unter der Schwelle gehen ungepackt raus (Server-Einstellung
     * `threshold: 1024`) und fuettern das Woerterbuch NICHT.
     */
    async wireAuswerten(schwelle = 32) {   // MUSS die Serverschwelle spiegeln
      for (const [sid, liste] of rahmenJeEmpfaenger) {
        const co = zlib.createDeflateRaw({ level: 6, memLevel: 8, windowBits: 15 });
        for (const { ereignis, buf } of liste) {
          let wire;
          if (buf.length < schwelle) {
            wire = buf.length;                       // ungepackt gesendet
          } else {
            const teile = [];
            const auf = (c) => teile.push(c);
            co.on('data', auf);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((res) => co.write(buf, () => co.flush(zlib.constants.Z_SYNC_FLUSH, res)));
            co.removeListener('data', auf);
            wire = teile.reduce((n, c) => n + c.length, 0);
          }
          jeEreignis.get(ereignis).wire += wire;
          jeEmpfaenger.get(sid).wire += wire;
        }
        co.end();
      }
      rahmenJeEmpfaenger.clear();   // Speicher je Partie wieder freigeben
    },
    bericht() {
      const ereignisse = [...jeEreignis.entries()]
        .map(([name, e]) => ({ name, ...e }))
        .sort((a, b) => b.wire - a.wire);
      const empfaenger = [...jeEmpfaenger.entries()]
        .map(([sid, e]) => ({ sid, ...e }))
        .sort((a, b) => b.wire - a.wire);
      return {
        ereignisse, empfaenger, groesster,
        broadcast: { count: broadcastCount, raw: broadcastRaw },
        summe: {
          count: ereignisse.reduce((n, e) => n + e.count, 0),
          raw: ereignisse.reduce((n, e) => n + e.raw, 0),
          wire: ereignisse.reduce((n, e) => n + e.wire, 0),
        },
      };
    },
  };
}

/** Eine Messpartie: zwei CPU-Decks, erfundene Sockets, volle Sendewege. */
async function runNetBenchmarkGame(deckA, deckB, cfg, haken = {}) {
  const snapshotDeck = (d) => JSON.parse(JSON.stringify({
    mainDeck: d.mainDeck || [], heroes: d.heroes || [],
    potionDeck: d.potionDeck || [], sideDeck: d.sideDeck || [], skins: d.skins || {},
  }));
  const roomId = 'netbench-' + uuidv4().substring(0, 8);
  const zuschauer = [];
  for (let i = 0; i < cfg.spectators; i++) {
    zuschauer.push({ username: 'Zuschauer ' + (i + 1), userId: 'nb-spec-' + i + '-' + roomId,
      socketId: 'sid-spec-' + i + '-' + roomId, color: '#888', avatar: null });
  }
  const room = {
    id: roomId, host: 'netbench', hostId: 'netbench',
    // GENAU die Raumform des Trainingslaufs (`runHeadlessTrainingGame`),
    // weil die sich taeglich bewaehrt. Zur Nutzlast: es wird fuer BEIDE
    // Seiten ein voller, eigener Zustand gebaut — das ist der PvP-Fall
    // mit zwei Clients. Der Unterschied zu einem echten PvP-Raum sind
    // zwei Felder (`isCpuBattle`, `cpuBgm`), also ein paar Byte.
    // `DEBUG_REVEAL_NPC_HAND` ist `false`, hier wird also nichts
    // zusaetzlich aufgedeckt und damit auch nichts ueberschaetzt.
    type: 'singleplayer', format: 1, winsNeeded: 1, setScore: [0, 0],
    playerPw: null, specPw: null,
    players: [
      { username: 'Spieler A', userId: 'nb-a-' + roomId, socketId: 'sid-a-' + roomId, deckId: 'nb-a' },
      { username: 'Spieler B', userId: 'nb-b-' + roomId, socketId: 'sid-b-' + roomId, deckId: 'nb-b' },
    ],
    spectators: zuschauer, status: 'waiting', created: Date.now(),
    gameState: null, chatHistory: [], privateChatHistory: {},
    _currentDecks: [snapshotDeck(deckA), snapshotDeck(deckB)],
    _deckNames: [deckA.name || '?', deckB.name || '?'],
  };
  rooms.set(roomId, room);
  await setupGameState(room);
  const firstPlayer = Math.random() < 0.5 ? 0 : 1;
  const t0 = Date.now();

  return new Promise((resolve) => {
    let done = false;
    let startPromise = null;
    let hardTimeout = null;
    let wachhund = null;
    let sieger = null;   // Gewinner-Index, fuer den Karten-Bericht
    // Rechenzeit und Kartenprofil DIESER Partie einsammeln, bevor
    // aufgeraeumt wird. Beides steht schon in der Engine — es hat nur
    // nie jemand ausgelesen (12.8., nach Als „verdaechtig langem Lauf").
    const cpuT0 = process.cpuUsage();
    let ernte = null;
    const einsammeln = () => {
      if (ernte) return;
      const u = process.cpuUsage(cpuT0);
      const eng = room.engine;
      const leaks = {};
      for (const e of (eng?._actionTrail || [])) {
        if (e.kind === 'leakyRollout' && e.cardName) leaks[e.cardName] = (leaks[e.cardName] || 0) + 1;
      }
      // ── HOOK-TIMEOUTS (12.8., Barker-Befund) ─────────────────────
      // Die Engine bricht einen Hook ab, wenn er EFFECT_TIMEOUT_MS
      // (5 s) lang keinen Fortschritt zeigt — `_hookProgressTick`
      // bewegt sich nicht UND keine Abfrage steht offen. Sie zaehlt das
      // in `_hookTimeouts` und schreibt je Treffer einen
      // `hook_timeout`-Eintrag mit Hook- und KARTENNAME ins Protokoll.
      // Bisher stand das nur in der Serverkonsole; hier wird es
      // ausgewertet, damit der naechste Lauf die Frage „welche Karte
      // haengt" von selbst beantwortet.
      // Primaerquelle ist der engine-eigene Zaehler `_hookTimeoutsByCard`
      // — er zaehlt AUCH im Fast-Mode, wo `log()` aussteigt und der
      // Protokollweg deshalb leer bleibt (Messlauf 12.8.: 29/107/8
      // Abbrueche gezaehlt, Kartenliste leer). Das Protokoll dient nur
      // noch als Rueckfall fuer aeltere Engines.
      const timeouts = { ...(eng?._hookTimeoutsByCard || {}) };
      if (!Object.keys(timeouts).length) {
        for (const e of (eng?.actionLog || [])) {
          if (e?.type === 'hook_timeout') {
            const key = `${e.card || '?'} (${e.hook || '?'})`;
            timeouts[key] = (timeouts[key] || 0) + 1;
          }
        }
      }
      // ── SPIELSTART-GRIFFE (12.8., Als Barker-Frage) ──────────────
      // `gameStartPickDecision` protokolliert jeden beantworteten Griff
      // in `engine._gameStartLog` mit der QUELLE: `priority` (harte
      // Skript-Vorfahrt via `gameStartPickPriority`), `rule` (gelernte
      // Profilwerte), `explore` (Training) oder Kombinationen. Wer hier
      // NICHT auftaucht, wurde vom Kanal mit `null` beantwortet — und
      // faellt damit auf die teure MCTS-Suche durch.
      //
      // Damit ist nach jedem Lauf belegbar statt argumentierbar, ob
      // Barkers Griff die Suche noch anfasst.
      const starts = {};
      for (const g of (eng?._gameStartLog || [])) {
        const key = `${g.card} → ${(g.picks || []).join(', ')} [${g.src}]`;
        starts[key] = (starts[key] || 0) + 1;
      }
      ernte = {
        gameStartPicks: starts,
        cpuMs: (u.user + u.system) / 1000,
        hookFiresByCard: { ...(eng?._hookFiresByCard || {}) },
        leakyRollouts: leaks,
        snapshots: eng?._snapshotsTaken || 0,
        hookTimeouts: eng?._hookTimeouts || 0,
        hookTimeoutsByCard: timeouts,
        overloadTrips: { ...(eng?._overloadTrips || {}) },
        steamDiag: { ...(eng?._steamDiag || {}) },
        // ── Overheal Shock / Heilungs-Umkehr (13.8.) ────────────────
        // Beides nur aus LIVE-Zuegen: die Karte stempelt ihren Einsatz
        // selbst (`_shockLog`), die Engine zaehlt am Umkehr-Gate mit
        // (`_healReversedDiag`). Rollouts sind in beiden ausgeschlossen.
        shockLog: [...(eng?._shockLog || [])],
        healReversed: eng?._healReversedDiag
          ? { ...eng._healReversedDiag, jeSeite: [...eng._healReversedDiag.jeSeite] }
          : null,
        healRouting: { ...(eng?._healRouting || {}) },
        shockEntfernt: eng?._shockEntfernt || 0,
        shockEntferntLebend: eng?._shockEntferntLebend || 0,
        // ── v385: KANDIDATEN-HEAP JE ROLLOUT ────────────────────────
        // Die Liste "Rollouts mit hohem Speicherumsatz" zaehlt nur
        // TREFFER ueber 0,5 MB. Damit sehen "teuer je Rollout" und
        // "sehr oft bewertet" identisch aus — im Lauf 14.8. 12:02 stand
        // Adventurousness mit 119 an der Spitze, ohne dass sich sagen
        // liess, welches von beidem gemeint ist. `_candidateHeapDelta`
        // fuehrt {calls, totalMb} je Kandidat und lag bisher ungenutzt
        // auf der Engine.
        candidateHeapDelta: { ...(eng?._candidateHeapTotal || {}) },
        // ── v385: WARUM ENDETE DIE PARTIE OHNE ERGEBNIS? ────────────
        // `ohne-spielende` heisst: die Zugkette lief aus, ohne dass
        // `gs.result` gesetzt wurde. Bisher stand im Bericht nur der
        // Name. `buildGameDiagnosis` (Modulebene seit v385) beschreibt
        // Heldenstand, Deckgroessen, Zug/Phase und — der wichtigste
        // Teil — die vom CPU-Treiber gefangenen Ausnahmen samt erstem
        // Karten-Frame aus dem Stack.
        diagnose: (!room.gameState?.result)
          ? buildGameDiagnosis(room, -1, 'no-result') : null,
        treiberFehler: (eng?._driverErrors || []).slice(-5).map(e => ({
          zug: e.turn, spieler: e.player, phase: e.phase, meldung: e.message,
        })),
        // ── v386: Brotkrumen ────────────────────────────────────────
        stilleHalte: (eng?._silentTurnExits || []).slice(-5),
        letzteMarke: eng?._cpuTurnMark || null,
        switchTurnNoops: (eng?._switchTurnNoops || []).slice(-5),
        switchTurnReentry: eng?._switchTurnReentryBlocked || 0,
        nachlauf: nachlaufBefund,                                // v391
      };
    };

    let nachlaufBefund = null;                 // v391
    const finish = (grund) => {
      if (done) return;
      done = true;
      einsammeln();                       // VOR dem abort/Abbau
      // ── SOFORT ABBRECHEN (12.8., Als Rueckfrage „unendliche Spiele
      //    sollten unmoeglich sein") ─────────────────────────────────
      // Sie SIND unmoeglich — das Deck-Out beendet jede Partie. Genau
      // das war hier auch passiert: die Engine meldete Deck-Out, rief
      // `onGameOver`, und diese Funktion lief an. Nur hat sie die
      // Engine nicht angehalten. Abgeraeumt wird erst unten in
      // `drain.then(...)` via `destroyRoom` → `engine.abort()`, und
      // `drain` haengt an `startPromise` (loest nie auf, die Partie
      // laeuft ja) ODER an einem 2-Sekunden-TIMER — der im
      // Mikrotask-Stau nie drankam. Ergebnis: eine laengst entschiedene
      // Partie drehte endlos weiter.
      //
      // Deshalb hier, als ERSTES und ohne jeden Timer: anhalten. Die
      // CPU-Schleifen in _cpu.js steigen auf `_aborted` selbst aus.
      try { room.engine?.abort?.(); } catch { /* Abbau darf nie werfen */ }
      if (hardTimeout) { clearTimeout(hardTimeout); hardTimeout = null; }
      if (wachhund) { clearInterval(wachhund); wachhund = null; }
      for (const p of room.players) activeGames.delete(p.userId);
      const turns = room.gameState?.turn || 0;
      const drain = startPromise
        ? Promise.race([startPromise.catch(() => {}), new Promise(r => setTimeout(r, 2000))])
        : Promise.resolve();
      drain.then(() => {
        const eng = room.engine;
        if (eng) { eng.onGameOver = null; eng._cpuDriver = null; }
        room._currentDecks = null;
        destroyRoom(roomId);
        resolve({ turns, ms: Date.now() - t0, grund, sieger, ...ernte });
      });
    };

    startGameEngine(room, roomId, firstPlayer, (engine) => {
      engine._isSelfPlay = true;          // beide Seiten CPU-pilotiert
      engine._cpuPlayerIdx = firstPlayer;
      // ── DAS GEHIRN FEHLTE (v384, 14.8.) ────────────────────────────
      // Alle vier anderen CPU-Pfade rufen `installCpuBrain` in genau
      // diesem Rueckruf auf (Singleplayer, Self-Play, cpu-vs-cpu,
      // Training); der Messstand als einziger nicht. Ohne das Gehirn
      // bleibt `_getCpuGenericResponse` der Engine-Default — und der
      // beantwortet JEDEN cancellable Prompt mit `null`.
      //
      // Zwei Folgen, beide belegt: (1) Barkers `onTurnStart` bekam auf
      // seinen Zonenwaehler `null` und sprang endlos zur Galerie
      // zurueck — 1.308.102 Spielstart-Griffe in EINER Partie, 300 s
      // CPU bei 9 Halbzuegen, 51 abgebrochene Hooks. (2) Der ganze
      // Messstand hat eine CPU OHNE Ziel- und Wahl-Gehirn vermessen;
      // alle Zahlen aus Laeufen vor v384 stehen unter diesem Vorbehalt
      // und sind mit spaeteren nicht vergleichbar.
      //
      // Muss VOR `onBeforeHandDraw` stehen (siehe startGameEngine) —
      // deshalb hier ganz oben und nicht weiter unten im Rueckruf.
      installCpuBrain(engine);

      // ── PAUSEN, REISSLEINE UND EIN ECHTER YIELD (12.8.) ────────────
      //
      // Animationspausen werden uebersprungen; die Zahl der Sendungen
      // aendert sich dadurch nicht, nur die Wanduhr. Wer den echten
      // Takt sehen will, setzt PP_NETTEST_REALTIME=1.
      //
      // ABER: `() => Promise.resolve()` allein war ein FEHLER, und zwar
      // ein lehrreicher. Damit besteht der komplette Partieverlauf nur
      // noch aus MIKROtasks. Node leert die Mikrotask-Warteschlange
      // vollstaendig, BEVOR ein Timer drankommt — eine unendliche Kette
      // aufgeloester Promises haengt also `setTimeout` und
      // `setInterval` komplett aus. Genau deshalb hat bei Als
      // Endlos-Partie WEDER der Wachhund NOCH das 5-Minuten-Zeitlimit
      // gefeuert: beide sind Timer, und Timer kamen nie dran.
      //
      // Zwei Konsequenzen, beide hier:
      //   (a) alle ~10 ms EIN echter Makrotask (`setImmediate`) — damit
      //       laeuft der Event-Loop weiter und Timer feuern wieder;
      //   (b) eine SYNCHRONE Reissleine, die gar nicht erst auf Timer
      //       angewiesen ist. Sie prueft Halbzug-Obergrenze und
      //       Wandzeit bei jedem Pausenaufruf und bricht per
      //       `engine.abort()` ab — die CPU-Schleifen in _cpu.js
      //       steigen darauf von selbst aus (`istAbgebrochen`).
      // ── DENKZEIT JE ZUG KAPPEN (12.8., Als Zeitlimit-Abbruch) ─────
      // `runCpuTurn` setzt zu Beginn jedes LIVE-Zugs
      // `engine._cpuTurnDeadline = Date.now() + MAX_CPU_TURN_MS` (90 s)
      // und fragt den Wert danach ueber `cpuPastDeadline` selbst ab.
      // Es ist also eine simple Zahl — ich kappe sie beim SCHREIBEN,
      // statt irgendwo in die Suche einzugreifen. Die CPU beendet ihren
      // Zug dann ueber ihren eigenen, erprobten Weg (Heuristik-
      // Reihenfolge, Sicherheitsschleifen, Force-Advance zur End Phase).
      //
      // `_inMctsSim` ist dabei egal: die Engine setzt die Frist ohnehin
      // nur fuer Live-Zuege, und `null` (Ruecksetzen) reicht die
      // Klammer unveraendert durch.
      if (cfg.cpuTurnMs > 0) {
        let _frist = null;
        Object.defineProperty(engine, '_cpuTurnDeadline', {
          configurable: true,
          // ── LAZY SEEDEN, NICHT NUR KAPPEN (12.8., Elven Vanguard) ──
          // Kappen allein reicht nicht: die Frist wird NUR in
          // `runCpuTurn` gesetzt. Entscheidungen, die VORHER laufen,
          // sehen `null` — und `cpuPastDeadline` gibt dann `false`
          // zurueck, dauerhaft. Genau das passiert bei Barkers
          // `onTurnStart`-Griff: `startTurn` feuert ON_TURN_START
          // (der Engine-Kommentar nennt Barker dort namentlich),
          // BEVOR der CPU-Treiber laeuft. Die Optionsschleife in
          // `mctsPickFromOptions` prueft zwar `cpuPastDeadline` vor
          // jeder Option — nur ist da nichts zu pruefen.
          //
          // Deshalb: beim ERSTEN Lesen die Uhr starten. Gelesen wird
          // ausschliesslich aus `cpuPastDeadline`, also genau dann,
          // wenn das CPU-Gehirn arbeitet — die Uhr startet damit nicht
          // zu frueh. `runCpuTurn` ueberschreibt sie danach je Zug
          // (gekappt), und ein Ruecksetzen auf `null` startet beim
          // naechsten Lesen ein frisches Fenster.
          get: () => {
            if (_frist == null) _frist = Date.now() + cfg.cpuTurnMs;
            return _frist;
          },
          set: (v) => {
            _frist = (typeof v === 'number')
              ? Math.min(v, Date.now() + cfg.cpuTurnMs)
              : v;
          },
        });
      }

      const echterDelay = engine._delay.bind(engine);
      let letzterYield = Date.now();
      engine._delay = (ms) => {
        if (!done) {
          const turn = room.gameState?.turn || 0;
          if (turn >= cfg.maxTurns) {
            engine.abort();
            finish(`endlosschleife@zug${turn}`);
          } else if (Date.now() - t0 > cfg.gameTimeoutMs) {
            engine.abort();
            // Halbzug mitgeben: „zeitlimit bei Halbzug 4" heisst
            // langsame Zuege, „bei Halbzug 300" heisst lange Partie.
            finish(`zeitlimit@zug${room.gameState?.turn || 0}`);
          }
        } else if (!engine._aborted) {
          // Die Partie ist fuer uns durch, die Engine laeuft aber noch —
          // genau der Zustand, der die Endlos-Drehung erzeugt hat.
          engine.abort();
        }
        if (cfg.realtime) return echterDelay(ms);
        // ── v390: LIVE IMMER EIN MAKROTASK ──────────────────────────
        // Bis v389 lieferte diese Huelle im Normalfall `Promise.resolve()`
        // — einen MIKROtask. Die Engine selbst nimmt live ein echtes
        // `setTimeout`, also einen MAKROtask. Der Unterschied ist nicht
        // kosmetisch: ein Makrotask laesst ALLE wartenden Fortsetzungen
        // zuerst durchlaufen, ein Mikrotask setzt die eigene Funktion
        // sofort fort. Zwei verschraenkte async-Ketten bekommen im
        // Messstand damit eine andere Reihenfolge als ueberall sonst.
        //
        // Genau das ist der einzige Unterschied, den der Messstand
        // gegenueber Live-Spiel, cpu-vs-cpu, Self-Play und Training hat
        // (`engine._delay` wird projektweit NUR hier ueberschrieben) —
        // und die `ohne-spielende`-Abbrueche sehen wie ein
        // Reihenfolge-Fehler aus (Zustand springt rueckwaerts: Zug 16
        // → 15, Phase 5 → 3). Al hat zu Recht darauf hingewiesen, dass
        // ihm das Bild live und im Training NIE begegnet ist.
        //
        // Neu also: dieselbe Task-Klasse wie in Produktion, nur ohne
        // Wartezeit. Der Rollout-Pfad bleibt bewusst auf dem Mikrotask
        // — dort tut die Engine selbst nichts anderes (`_fastMode` →
        // `Promise.resolve()`), und ein Makrotask je Rollout-Pause
        // waere millionenfach.
        // ── v392: v390 ZURUECKGEDREHT ────────────────────────────
        // v390 gab live IMMER einen Makrotask zurueck, um zu pruefen, ob
        // die Task-Klasse die `ohne-spielende`-Abbrueche erklaert. Der
        // Lauf vom 19:24 hat das widerlegt (Quote unveraendert 6/10) und
        // die Rechenzeit dabei VERVIELFACHT: 142 s / 58 s / 55 s je
        // Partie gegen vorher 20-30 s. Also zurueck zur Drossel — der
        // Yield alle 10 ms haelt den Event-Loop atmend, ohne je Pause
        // einen Makrotask zu kosten.
        const jetzt = Date.now();
        if (jetzt - letzterYield >= 10) {
          letzterYield = jetzt;
          return new Promise((r) => setImmediate(r));
        }
        return Promise.resolve();
      };
      engine.onGameOver = (_r, _w, grund) => {
        // Sieger festhalten — der Karten-Bericht braucht Sieg/Niederlage
        // je Partie, und `finish` bekommt nur den Grund gereicht.
        if (_w === 0 || _w === 1) sieger = _w;
        if (!done) finish(grund || 'ende');
      };
      room.engine._cpuDriver = makeCpuDriver(room);
      if (room.gameState?.mulliganPending) {
        room.gameState.mulliganPending = false;
        delete room.gameState.mulliganDecisions;
      }
      hardTimeout = setTimeout(() => {
        room.engine?.abort?.();
        finish(`zeitlimit@zug${room.gameState?.turn || 0}`);
      }, cfg.gameTimeoutMs);

      // ── WACHHUND (12.8., nach Als Verdacht „koennte das loopen?") ──
      // Zwei verschiedene Krankheiten, zwei verschiedene Diagnosen:
      //   • STILLSTAND — weder Halbzug noch Nachrichten bewegen sich.
      //     Die Partie haengt (Prompt ohne Antwort, Deadlock).
      //   • DREHZAHL — Nachrichten laufen weiter, der Halbzug nicht.
      //     Das IST die Endlosschleife, die Al befuerchtet — und sie
      //     waere zugleich ein handfester Bandbreiten-Befund.
      // Beides beendet die Partie mit klarem Grund, statt fuenf Minuten
      // stumm ins Timeout zu laufen.
      // ── DRITTES LEBENSZEICHEN: ENGINE-TICKS (12.8., Als Absturz) ──
      // Erster Anlauf pruefte nur Halbzug und Nachrichtenzahl. Beides
      // steht STILL, waehrend die CPU rechnet: MCTS-Rollouts laufen im
      // Fast-Mode, senden also nichts, und der Halbzug bleibt derselbe.
      // Eine lange Entscheidung sah damit aus wie ein Haenger — Als
      // Partie 7 wurde nach 48 s bei Halbzug 2 als „stillstand"
      // abgeschossen, obwohl die CPU nur nachdachte.
      //
      // `engine._hookProgressTick` ist das richtige Signal: `sync()`
      // erhoeht es AUSDRUECKLICH auch im Fast-Mode („MCTS rollouts that
      // call sync() should count as progress too"). Bewegt es sich,
      // arbeitet die Engine — egal ob nach aussen etwas sichtbar wird.
      const STILLSTAND_MS = cfg.stallMs;
      const DREHZAHL_MS = Math.max(120000, cfg.stallMs * 2);
      let letzterTurn = -1, letzteZahl = -1, letzteTicks = -1;
      let letzterTurnFuerZaehler = -1, letzteZahlBeiTurnwechsel = 0;
      let turnSeit = Date.now(), bewegungSeit = Date.now();

      // ── VIERTES LEBENSZEICHEN: VERBRAUCHTE CPU-ZEIT (12.8.) ────────
      // Nach dem Messlauf blieben drei Partien uebrig, die nach genau
      // 92/94/96 s abgeschossen wurden — Halbzug, Nachrichten UND Ticks
      // standen alle still. Damit ist die entscheidende Frage: RECHNET
      // der Prozess (dann arbeitet die CPU nur lange) oder schlaeft er
      // (dann haengt wirklich etwas)? Das beantwortet nur die
      // verbrauchte Prozessorzeit.
      //
      // Wichtig ist die Arbeitsteilung: „rechnet" gilt fuer den
      // STILLSTAND-Wachhund als Fortschritt — eine lange Suche wird
      // also nicht mehr abgeschossen. Eine ENDLOSE Rechnung faengt
      // dafuer weiterhin das harte Zeitlimit je Partie (`--game-ms`,
      // Vorgabe 300 s). Zwei Grenzen fuer zwei verschiedene Fragen.
      const cpuMs = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
      let letzteCpu = cpuMs();
      let rechnetSeit = 0;              // aufsummierte Rechenzeit im Stillstandsfenster
      let diagnose = null;
      wachhund = setInterval(() => {
        if (done) return;
        const turn = room.gameState?.turn ?? 0;
        const stand = haken.stand ? haken.stand() : { nachrichten: 0, roh: 0 };
        const ticks = room.engine?._hookProgressTick || 0;
        const jetzt = Date.now();
        const cpuJetzt = cpuMs();
        const cpuZuwachs = cpuJetzt - letzteCpu;
        letzteCpu = cpuJetzt;
        // Ueber 50 % eines Kerns im 2-Sekunden-Fenster = der Prozess
        // arbeitet. Darunter tut er nichts Nennenswertes.
        const rechnet = cpuZuwachs > 1000;

        if (turn !== letzterTurn) { letzterTurn = turn; turnSeit = jetzt; }
        if (stand.nachrichten !== letzteZahl || ticks !== letzteTicks || rechnet) {
          letzteZahl = stand.nachrichten; letzteTicks = ticks;
          bewegungSeit = jetzt; rechnetSeit = 0;
        } else {
          rechnetSeit += cpuZuwachs;
        }
        diagnose = { turn, nachrichten: stand.nachrichten, ticks,
          stillSeit: Math.round((jetzt - bewegungSeit) / 1000),
          cpuImFenster: Math.round(rechnetSeit) };
        if (haken.fortschritt) haken.fortschritt({ turn, ms: jetzt - t0, ticks, rechnet, ...stand });
        // Dritte Krankheit, die Al gefunden hat: die Partie zaehlt
        // munter Halbzuege, aber keine Seite kommt je durch. Weder
        // „Stillstand" noch „Drehzahl" greift dann — es bewegt sich ja
        // alles. Nur die Obergrenze faengt das.
        if (turn >= cfg.maxTurns) { room.engine?.abort?.(); return finish(`endlosschleife@zug${turn}`); }
        if (jetzt - bewegungSeit > STILLSTAND_MS) {
          room.engine?.abort?.();
          // Der Grund sagt jetzt, WORAN es lag: „untaetig" heisst, der
          // Prozess hat in der ganzen Zeit praktisch keine Rechenzeit
          // verbraucht — das ist ein echter Haenger, kein langes Denken.
          const art = diagnose && diagnose.cpuImFenster > cfg.stallMs * 0.2 ? 'rechnend' : 'untaetig';
          return finish(`stillstand(${art}, Halbzug ${turn}, ${diagnose?.cpuImFenster || 0} ms CPU)`);
        }
        // „Drehzahl" heisst: es GEHT etwas raus, aber der Halbzug bleibt
        // stehen. Reines Nachdenken (Ticks ohne Nachrichten) faellt
        // ausdruecklich NICHT darunter.
        if (jetzt - turnSeit > DREHZAHL_MS && stand.nachrichten > letzteZahlBeiTurnwechsel) {
          room.engine?.abort?.(); return finish('drehzahl');
        }
        if (turn !== letzterTurnFuerZaehler) { letzterTurnFuerZaehler = turn; letzteZahlBeiTurnwechsel = stand.nachrichten; }
      }, 2000);
      // KEIN enterFastMode hier — genau das ist der Unterschied zum
      // Trainingslauf: die Partie soll senden.
      startPromise = room.engine.startGame()
        // `startGame` ist durch, ohne dass `onGameOver` gefeuert hat —
        // die Partie hatte also kein regulaeres Ende. Im Messlauf vom
        // 12.8. traf das eine Partie nach 4 Halbzuegen und 5 Sekunden.
        // Eigener Grund, damit so etwas nicht stillschweigend in den
        // Schnitt wandert.
        // ── v391: NACHLAUF STATT SOFORTIGEM URTEIL ────────────────
        // Bisher galt: `startGame` ist durch → Partie ist tot →
        // `abort()` und Abbau. Diese Annahme wurde NIE geprueft, und
        // sie traegt die ganze `ohne-spielende`-Jagd seit v386.
        //
        // Die Kette ist eine einzige verschachtelte await-Folge
        // (startTurn → Treiber → switchTurn → Treiber → …). Fehlt
        // IRGENDWO ein `await`, loest `startGame` auf, waehrend die
        // Partie im Hintergrund weiterlaeuft — und der Messstand
        // erschlaegt sie dann selbst mit `engine.abort()`.
        //
        // Deshalb jetzt: nicht sofort urteilen, sondern nachsehen. Bis
        // zu 3 s in 100-ms-Schritten pruefen, ob sich Zug, Phase oder
        // Ergebnis noch bewegen. Bewegt sich etwas, war die Partie
        // LEBENDIG und der Befund ein Messfehler — das steht dann als
        // eigener Grund im Bericht und wandert nicht in denselben Topf.
        .then(async () => {
          if (done) return;
          const fertig = room.gameState?.result?.reason;
          if (fertig) return finish(fertig);
          const stand = () => `${room.gameState?.turn}:${room.gameState?.activePlayer}`
            + `:${room.gameState?.currentPhase}`;
          // ── v392: FAHNENSTAND IM MOMENT DES AUFLOESENS ────────────
          // Der 19:47-Lauf hat gezeigt, dass 6 von 7 Abbruechen gar
          // keine sind: die Partie lebte, und ihr Zustand wanderte
          // danach RUECKWAERTS (Zug 4 → 3, Phase 5 → 2). Es laeuft also
          // eine Simulation, waehrend die await-Kette von `startGame`
          // schon zurueckkehrt — irgendwo fehlt ein `await`.
          //
          // Welcher Pfad das ist, sagt der Zaehlerstand GENAU JETZT,
          // vor dem Nachlauf. `_fastModeDepth` ist dabei der schaerfste:
          // `enterFastMode`/`exitFastMode` fuehren ihn paarweise, eine
          // Unwucht benennt die Simulation, die noch offen ist. Nach dem
          // Nachlauf wird derselbe Stand erneut genommen — raeumt sich
          // die Unwucht in den 3 s auf, war die Simulation nur spaet;
          // bleibt sie stehen, ist sie haengen geblieben.
          // v395: auf das Noetige gekuerzt — die Jagd ist vorbei, diese
          // Zeile bleibt nur als Regressionsnetz fuer den Ska-Fall.
          const fahnen = () => ({
            inMctsSim: !!engine._inMctsSim,
            fastMode: !!engine._fastMode,
            fastModeTiefe: engine._fastModeDepth || 0,
          });
          const fahnenVorher = fahnen();
          const vorher = stand();
          const bis = Date.now() + 3000;
          let bewegt = false;
          let nachher = vorher;
          while (Date.now() < bis && !done) {
            await new Promise((r) => setTimeout(r, 100));
            if (room.gameState?.result?.reason) {
              if (!done) finish(`${room.gameState.result.reason}@nachlauf`);
              return;
            }
            nachher = stand();
            if (nachher !== vorher) { bewegt = true; break; }
          }
          if (done) return;
          if (bewegt) {
            // Weiterhin abbrechen (sonst laufen zehn Partien parallel
            // weiter), aber unter EIGENEM Namen — dieser Fall ist
            // etwas voellig anderes als eine stehende Partie.
            nachlaufBefund = { vorher, nachher, fahnenVorher, fahnenNachher: fahnen() };
            console.warn(`[netbench] PARTIE LEBTE WEITER: startGame war durch, `
              + `Stand wanderte ${vorher} → ${nachher}`);
            return finish('startgame-zu-frueh');
          }
          nachlaufBefund = { vorher, nachher: vorher, fahnenVorher, fahnenNachher: fahnen() };
          return finish('ohne-spielende');
        })
        .catch((err) => { console.error('[netbench] startGame:', err.message); if (!done) finish('fehler'); });
    }).catch((err) => {
      console.error('[netbench] setup:', err.message);
      if (!done) finish('setup-fehler');
    });
  });
}

async function runNetBenchmark() {
  if (_nbEnv('PP_NETTEST_LOW', '') === '1') {
    try { require('os').setPriority(0, require('os').constants.priority.PRIORITY_LOW); }
    catch (e) { console.warn('[netbench] Priorität konnte nicht gesenkt werden:', e.message); }
  }
  // ── PROFILE BLEIBEN AN (12.8., Als Befund zu Barker) ──────────────
  // Hier stand `PP_DISABLE_PROFILES = '1'` — uebernommen aus dem
  // Trainingslauf, wo es RICHTIG ist (dort sollen die Daten unbeein-
  // flusst vom Gelernten entstehen). Fuer eine MESSUNG ist es falsch:
  // `PP_DISABLE_PROFILES=1` macht `_deck-profile.js` komplett zum
  // No-op — `profileFor` gibt `null` zurueck, und damit liefert
  // `gameStartPickDecision` ebenfalls `null`.
  //
  // Genau dieser Kanal beantwortet Barkers Start-Griff normalerweise
  // OHNE jeden Rollout: er wird in Barkers Prompt-Responder ALS ERSTES
  // versucht und steigt bei einem Treffer sofort aus, lange bevor
  // `mctsPick(..., { horizon: 6 })` drankommt. Vier der fuenf
  // Barker-Decks haben den Griff laengst gelernt (burning-inferno,
  // elven-vanguard, slimy-infestation, to-attain-divinity), insgesamt
  // 24 von 42 Profilen haben `gameStartPicks`.
  //
  // Mein Schalter hat den Kanal also abgeschaltet und die Suche dahinter
  // freigelegt — die teuren Barker-Partien waren zum Teil ein
  // MESSARTEFAKT. Live laufen die Profile mit, also misst der Messstand
  // ab jetzt auch damit. Wer den nackten Zustand sehen will, setzt
  // `--no-profiles`.
  if (_nbEnv('PP_NETTEST_NO_PROFILES', '') === '1') {
    process.env.PP_DISABLE_PROFILES = '1';
  }
  setRolloutHorizon(parseInt(_nbEnv('PP_NETTEST_HORIZON', '2'), 10));
  // Die eigentliche Ursache der Textwand: `_cpuVerbose` steht in
  // _cpu.js auf `true`. Der Trainingslauf ist nur deshalb still, weil
  // er hier `setCpuVerbose(...)` ruft — der Messlauf tat es nicht.
  const laut = _nbEnv('PP_NETTEST_VERBOSE', '') === '1';
  setCpuVerbose(laut);


  const cfg = {
    games: Math.max(1, parseInt(_nbEnv('PP_NETTEST_GAMES', '5'), 10) || 5),
    spectators: Math.max(0, parseInt(_nbEnv('PP_NETTEST_SPECTATORS', '0'), 10) || 0),
    realtime: _nbEnv('PP_NETTEST_REALTIME', '') === '1',
    // Harte Obergrenze an HALBZUEGEN. Derselbe Wert und dieselbe
    // Begruendung wie im Selbstspiel-Wachhund (server.js ~13992):
    // „normal games end well under 50" — 400 faengt die Partien ab, die
    // Zuege zaehlen, ohne dass je eine Seite toedlich wird.
    maxTurns: Math.max(20, parseInt(_nbEnv('PP_NETTEST_MAX_TURNS', '400'), 10) || 400),
    gameTimeoutMs: Math.max(10000, parseInt(_nbEnv('PP_NETTEST_GAME_MS', '600000'), 10) || 600000),
    // Denkzeit je LIVE-Zug. Die Engine erlaubt 90 s (`MAX_CPU_TURN_MS`),
    // aber ihr eigener Kommentar sagt: „a healthy turn finishes in under
    // 10s; this cap exists solely to break out of pathological …
    // scenarios". Fuer eine BANDBREITEN-Messung ist Spielstaerke egal —
    // gemessen werden Bytes, nicht Zugqualitaet. 30 s laesst jeden
    // gesunden Zug in Ruhe und kappt nur die pathologischen, statt sie
    // 90 s lang laufen zu lassen und am Ende die halbe Partie
    // wegzuwerfen. 0 = Engine-Vorgabe behalten.
    cpuTurnMs: Math.max(0, parseInt(_nbEnv('PP_NETTEST_CPU_TURN_MS', '30000'), 10) || 0),
    brain: _nbEnv('PP_NETTEST_BRAIN', '') === 'heuristic' ? 'heuristic' : null,
    // Ab wann gilt eine Partie als haengend? Grosszuegig, weil eine
    // einzelne MCTS-Entscheidung auf einer nebenher trainierenden
    // Maschine durchaus eine Minute brauchen darf. Gemessen wird
    // ohnehin nicht mehr nur „nichts gesendet", sondern zusaetzlich der
    // Engine-Tick (siehe Wachhund).
    stallMs: Math.max(15000, parseInt(_nbEnv('PP_NETTEST_STALL_MS', '90000'), 10) || 90000),
  };
  // `heuristic` denkt deutlich schneller als `evalGreedy`. Aendert die
  // gespielten Zuege und damit die Zahlen leicht — deshalb NICHT
  // Vorgabe, sondern ein bewusster Schalter fuer lange Laeufe.
  if (cfg.brain === 'heuristic') setRolloutBrain('heuristic');
  // Widerspruechliche Grenzen melden statt sie stillschweigend zu
  // ertragen: ein Partie-Zeitlimit unter dem Vierfachen der Denkzeit
  // je Zug wirft praktisch garantiert Partien aus der Wertung.
  if (cfg.cpuTurnMs > 0 && cfg.gameTimeoutMs < cfg.cpuTurnMs * 4) {
    _nbSchreib(`[netbench] WARNUNG: --game-ms (${cfg.gameTimeoutMs} ms) ist knapp gegenueber `
      + `--cpu-turn-ms (${cfg.cpuTurnMs} ms). Partien mit mehreren langsamen Zuegen `
      + `laufen ins Zeitlimit und fallen aus der Wertung.`);
  }
  const samples = loadSampleDecks().filter(d =>
    d && Array.isArray(d.heroes) && d.heroes.length > 0
    && Array.isArray(d.mainDeck) && d.mainDeck.length > 0);
  if (samples.length < 2) { console.error('[netbench] zu wenige Beispieldecks gefunden'); process.exit(2); }
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const finde = (n) => n ? samples.find(d => norm(d.name).includes(norm(n))) : null;
  const wunschA = finde(_nbEnv('PP_NETTEST_DECK_A', ''));
  const wunschB = finde(_nbEnv('PP_NETTEST_DECK_B', ''));

  const zeilen = [];                      // sammelt den Textbericht
  const sag = (t = '') => { _nbSchreib(t); zeilen.push(t); };
  const nur = (t) => { zeilen.push(t); };  // nur in die Datei

  sag('═══ BANDBREITEN-MESSSTAND ═══');
  sag(`Partien: ${cfg.games} | Zuschauer je Partie: ${cfg.spectators} | `
    + `Pausen: ${cfg.realtime ? 'echt' : 'uebersprungen'}`
    + (laut ? ' | Engine-Ausgabe: LAUT' : ''));
  sag(`Grenzen: Denkzeit/Zug ${cfg.cpuTurnMs ? cfg.cpuTurnMs / 1000 + ' s' : 'Engine-Vorgabe (90 s)'}`
    + ` | Zeitlimit/Partie ${cfg.gameTimeoutMs / 1000} s`
    + ` | Stillstand ab ${cfg.stallMs / 1000} s`
    + ` | Halbzuege max ${cfg.maxTurns}`
    + ` | Rollout-Brain ${cfg.brain || 'evalGreedy'}`
    + ` | Deck-Profile ${process.env.PP_DISABLE_PROFILES === '1' ? 'AUS' : 'AN'}`);
  sag('Gemessen wird der AUSGEHENDE Verkehr an 2 Spieler'
    + (cfg.spectators ? ` + ${cfg.spectators} Zuschauer` : '') + ' je Partie.');
  sag('');

  // Sammler ueber alle GEWERTETEN Partien. Bewusst kein zweiter
  // Messstand: eine abgebrochene Endlos-Partie mit Zehntausenden
  // Nachrichten wuerde jeden Schnitt unbrauchbar machen. Eingerechnet
  // wird deshalb erst NACH dem Ende — und nur, wenn die Partie sauber
  // war.
  const sammler = {
    ereignisse: new Map(), empfaenger: new Map(),
    groesster: { bytes: 0, event: null }, broadcast: { count: 0, raw: 0 },
  };
  const einrechnen = (b) => {
    const zu = (map, key, e) => {
      const x = map.get(key) || { count: 0, raw: 0, wire: 0 };
      x.count += e.count; x.raw += e.raw; x.wire += e.wire;
      map.set(key, x);
    };
    for (const e of b.ereignisse) zu(sammler.ereignisse, e.name, e);
    for (const e of b.empfaenger) zu(sammler.empfaenger, e.sid, e);
    if (b.groesster.bytes > sammler.groesster.bytes) sammler.groesster = b.groesster;
    sammler.broadcast.count += b.broadcast.count;
    sammler.broadcast.raw += b.broadcast.raw;
  };
  const proPartie = [];
  // Kostenprofil: WELCHE Karten und WELCHE Decks fressen Rechenzeit?
  // Bewusst ueber ALLE Partien gefuehrt, auch die abgebrochenen — gerade
  // die teuren sind ja die interessanten.
  const kartenFires = new Map();     // Karte -> Hook-Feuer
  const kartenLeaks = new Map();     // Karte -> Zahl leckender Rollouts
  const kandHeap = new Map();        // Kandidat -> { calls, totalMb } (v385)
  const deckBilanz = new Map();      // Deck -> Siege/Partien/Laenge/CPU (v395)
  const paarung = new Map();         // "A vs B" -> {n, siegeA} (v395)
  const hookTimeouts = new Map();    // "Karte (Hook)" -> Zahl abgebrochener Hooks
  const startGriffe = new Map();     // "Karte → Wahl [Quelle]" -> Haeufigkeit
  const overloads = new Map();       // Grund -> Zahl der Notbrems-Ausloesungen
  const steam = new Map();           // Steam-Dwarf-Zaehlwerk
  const shockPartien = [];           // Overheal Shock: eine Zeile je Partie
  const healRouting = new Map();     // "Quelle → Zielart" -> {n, hp}
  let shockEntfernt = 0, shockEntferntLebend = 0;
  const deckKosten = new Map();      // Deck -> { cpuMs, partien, abbrueche }
  const buchen = (deck, cpuMs, abbruch) => {
    const x = deckKosten.get(deck) || { cpuMs: 0, partien: 0, abbrueche: 0 };
    x.cpuMs += cpuMs; x.partien++; if (abbruch) x.abbrueche++;
    deckKosten.set(deck, x);
  };

  // Sendewege abfangen. In diesem Prozess laeuft nichts anderes ueber
  // `io`, die Umleitung ist also vollstaendig.
  const _ioTo = io.to.bind(io);
  const _ioEmit = io.emit.bind(io);
  let aktiveSonde = null;
  io.to = (sid) => ({ emit: (ereignis, daten) => { if (aktiveSonde) aktiveSonde.erfasse(sid, ereignis, daten); } });
  io.emit = (ereignis, daten) => { if (aktiveSonde) aktiveSonde.erfasseBroadcast(ereignis, daten); };
  // Leere Registry: `_getSocket` liefert `undefined`, jeder
  // antwortabhaengige Weg nimmt seinen Vorgabewert. Nichts blockiert.
  io.sockets = { sockets: new Map() };

  const schleuse = _nbSchleuse();
  const tty = !!process.stdout.isTTY;
  let letzteHeartbeat = 0;
  const auffaellig = [];

  try {
    for (let g = 0; g < cfg.games; g++) {
      const a = wunschA || samples[Math.floor(Math.random() * samples.length)];
      let b = wunschB || samples[Math.floor(Math.random() * samples.length)];
      if (b === a && samples.length > 1 && !wunschB) b = samples[(samples.indexOf(a) + 1) % samples.length];
      const sonde = _makeNetProbe();
      aktiveSonde = sonde;

      // Lebenszeichen: alle paar Sekunden EINE Zeile (im Terminal an
      // Ort und Stelle ueberschrieben). Damit ist auf einen Blick zu
      // sehen, dass sich etwas bewegt — und woran es haengt, falls nicht.
      let vorigeNachrichten = -1;
      const fortschritt = ({ turn, ms, nachrichten, rechnet }) => {
        const jetzt = Date.now();
        if (!tty && jetzt - letzteHeartbeat < 30000) return;
        letzteHeartbeat = jetzt;
        // „rechnet" kommt jetzt aus der gemessenen Prozessorzeit statt
        // aus „es ging nichts raus" — das ist der Zustand, den ich beim
        // ersten Anlauf faelschlich fuer einen Haenger gehalten habe.
        const denkt = rechnet === true || nachrichten === vorigeNachrichten;
        vorigeNachrichten = nachrichten;
        const t = `  … Partie ${g + 1}/${cfg.games} · Halbzug ${turn} · `
          + `${(ms / 1000).toFixed(0)} s · ${nachrichten.toLocaleString('de-DE')} Nachrichten`
          + (denkt ? ' · CPU rechnet' : '');
        if (tty) process.stdout.write('\r' + t.padEnd(78));
        else _nbSchreib(t);
      };

      if (!laut) { schleuse.leeren(); schleuse.zu(); }
      let r;
      try {
        r = await runNetBenchmarkGame(a, b, cfg, { stand: () => sonde.stand(), fortschritt });
      } finally {
        if (!laut) schleuse.auf();
        if (tty) process.stdout.write('\r' + ' '.repeat(78) + '\r');
      }
      aktiveSonde = null;
      await sonde.wireAuswerten();
      const s = sonde.bericht();
      const seltsam = /^(stillstand|drehzahl|zeitlimit|timeout|fehler|setup-fehler|endlosschleife|ohne-spielende|startgame-zu-frueh)/.test(r.grund || '');
      if (!seltsam) einrechnen(s);
      for (const [k, v] of Object.entries(r.hookFiresByCard || {})) {
        kartenFires.set(k, (kartenFires.get(k) || 0) + v);
      }
      for (const [k, v] of Object.entries(r.leakyRollouts || {})) {
        kartenLeaks.set(k, (kartenLeaks.get(k) || 0) + v);
      }
      for (const [k, v] of Object.entries(r.candidateHeapDelta || {})) {
        const e = kandHeap.get(k) || { calls: 0, totalMb: 0 };
        e.calls += (v.calls || 0); e.totalMb += (v.totalMb || 0);
        kandHeap.set(k, e);
      }
      for (const [k, v] of Object.entries(r.hookTimeoutsByCard || {})) {
        hookTimeouts.set(k, (hookTimeouts.get(k) || 0) + v);
      }
      for (const [k, v] of Object.entries(r.gameStartPicks || {})) {
        startGriffe.set(k, (startGriffe.get(k) || 0) + v);
      }
      for (const [k, v] of Object.entries(r.overloadTrips || {})) {
        overloads.set(k, (overloads.get(k) || 0) + v);
      }
      for (const [k, v] of Object.entries(r.steamDiag || {})) {
        // Hoechstwerte werden gemaxt, Zaehler summiert.
        if (k.includes('hoechst') || k.includes('groesst')) {
          if (!(steam.get(k) >= v)) steam.set(k, v);
        } else steam.set(k, (steam.get(k) || 0) + v);
      }
      buchen(a.name, (r.cpuMs || 0) / 2, seltsam);
      buchen(b.name, (r.cpuMs || 0) / 2, seltsam);
      // ── Overheal Shock / Heilungs-Umkehr je Partie (13.8.) ──────
      // Nur Partien mit tatsaechlichem Einsatz ODER tatsaechlicher
      // Umwandlung landen hier; ein Lauf ohne die Karte druckt den
      // Abschnitt gar nicht erst.
      if ((r.shockLog || []).length || (r.healReversed?.treffer || 0) > 0) {
        shockPartien.push({
          nr: g + 1, decks: [a.name, b.name], turns: r.turns,
          sieger: r.sieger, grund: r.grund, gewertet: !seltsam,
          einsaetze: r.shockLog || [], hr: r.healReversed || null,
        });
      }
      for (const [k, v] of Object.entries(r.healRouting || {})) {
        const e = healRouting.get(k) || { n: 0, hp: 0 };
        e.n += v.n; e.hp += v.hp; healRouting.set(k, e);
      }
      shockEntfernt += (r.shockEntfernt || 0);
      shockEntferntLebend += (r.shockEntferntLebend || 0);
      // ── v395: SIEGBILANZ JE DECK UND PAARUNG ────────────────────
      // Bei 100 zufaelligen Paarungen ist das die eigentliche Ausbeute
      // des Laufs: welches Deck gewinnt wie oft, wie lang sind seine
      // Partien, was kostet es. Nur GEWERTETE Partien zaehlen — eine
      // abgebrochene sagt ueber Staerke nichts.
      if (!seltsam && (r.sieger === 0 || r.sieger === 1)) {
        const seiten = [a.name, b.name];
        for (let si = 0; si < 2; si++) {
          const e = deckBilanz.get(seiten[si])
            || { partien: 0, siege: 0, halbzuege: 0, cpuMs: 0 };
          e.partien += 1;
          if (r.sieger === si) e.siege += 1;
          e.halbzuege += (r.turns || 0);
          e.cpuMs += (r.cpuMs || 0) / 2;
          deckBilanz.set(seiten[si], e);
        }
        const [x, y] = [a.name, b.name].slice().sort();
        const key = `${x} vs ${y}`;
        const pe = paarung.get(key) || { n: 0, siegeX: 0 };
        pe.n += 1;
        if (seiten[r.sieger] === x) pe.siegeX += 1;
        paarung.set(key, pe);
      }
      proPartie.push({ nr: g + 1, deckA: a.name, deckB: b.name, turns: r.turns, ms: r.ms,
        nachrichten: s.summe.count, raw: s.summe.raw, wire: s.summe.wire,
        grund: r.grund, gewertet: !seltsam, sieger: r.sieger ?? null,
        cpuMs: Math.round(r.cpuMs || 0), snapshots: r.snapshots || 0,
        hookTimeouts: r.hookTimeouts || 0,
        letzteMarke: r.letzteMarke || null,
        stilleHalte: r.stilleHalte || [],
        stilleHalte: r.stilleHalte || [] });
      sag(`  Partie ${String(g + 1).padStart(3)}/${cfg.games}  ${String(r.turns).padStart(3)} Halbzuege  `
        + `${String(s.summe.count).padStart(6)} Nachrichten  `
        + `${(s.summe.raw / 1048576).toFixed(2).padStart(7)} MB roh  →  `
        + `${(s.summe.wire / 1048576).toFixed(3).padStart(7)} MB Leitung  `
        + `${(r.ms / 1000).toFixed(0).padStart(4)} s  `
        + `${((r.cpuMs || 0) / 1000).toFixed(0).padStart(4)} s CPU  `
        + `${seltsam ? '⚠ ' + r.grund + '  ' : ''}${a.name} vs ${b.name}`);

      // Nur im Problemfall wird die verschluckte Engine-Ausgabe gezeigt —
      // dann aber sofort, und dieselben Zeilen wandern in den Bericht.
      if (seltsam) {
        const letzte = schleuse.letzte(25);
        auffaellig.push({ partie: g + 1, grund: r.grund, letzteZeilen: letzte,
          diagnose: r.diagnose || null, treiberFehler: r.treiberFehler || [] });
        if (r.hookTimeouts) {
          sag(`     ↳ ${r.hookTimeouts} abgebrochene(r) Hook(s): `
            + Object.entries(r.hookTimeoutsByCard || {}).map(([k, v]) => `${k} ×${v}`).join(', '));
        }
        // ── v385: WARUM kam kein Ergebnis zustande? ─────────────
        // Bisher stand hier nur der Name des Abbruchgrunds. Die
        // Diagnose nennt Heldenstand, Deckgroessen, Zug/Phase und —
        // entscheidend — die vom CPU-Treiber gefangenen Ausnahmen mit
        // dem ersten Karten-Frame aus dem Stack.
        if (r.nachlauf) {
          if (r.nachlauf.vorher !== r.nachlauf.nachher) {
            sag(`     ↳ PARTIE LEBTE WEITER: startGame war durch, Stand wanderte `
              + `${r.nachlauf.vorher} → ${r.nachlauf.nachher} (Zug:Spieler:Phase)`);
            sag(`        Der Abbruch ist dann ein MESSFEHLER — nicht die Partie haengt,`);
            sag(`        sondern die await-Kette von startGame endete zu frueh.`);
          }
          const f = (x) => x ? `inMctsSim=${x.inMctsSim} fastMode=${x.fastMode} `
            + `fastModeTiefe=${x.fastModeTiefe}` : '—';
          sag(`     ↳ Fahnen beim Aufloesen: ${f(r.nachlauf.fahnenVorher)}`);
          sag(`     ↳ Fahnen nach Nachlauf:  ${f(r.nachlauf.fahnenNachher)}`);
        }
        if (r.diagnose) sag(`     ↳ Diagnose: ${r.diagnose}`);
        for (const h of (r.stilleHalte || [])) {
          sag(`     ↳ STILLER HALT: Zug ${h.zug} p${h.aktiv} Phase ${h.phaseVorher}→${h.phaseNachher}`);
          sag(`        Brotkrume: ${h.marke}`);
          if (h.noops) sag(`        switchTurn ohne Wechsel: ${h.noops}x | Wiedereintritt geblockt: ${h.reentry}x`);
        }
        if (!(r.stilleHalte || []).length && r.letzteMarke) {
          sag(`     ↳ letzte Piloten-Marke: ${r.letzteMarke}`);
        }
        for (const nn of (r.switchTurnNoops || [])) {
          sag(`     ↳ switchTurn kehrte ohne Wechsel zurueck: Zug ${nn.zug} p${nn.aktiv} Phase ${nn.phaseVorher}→${nn.phaseNachher}`);
        }
        sag(`     ↳ letzte ${letzte.length} Engine-Zeilen vor dem Abbruch:`);
        for (const z of letzte) sag('       ' + z);
      }
    }
  } finally {
    schleuse.auf();
    io.to = _ioTo; io.emit = _ioEmit;
  }
  if (!laut && schleuse.anzahl() > 0) {
    sag(`\n[netbench] ${schleuse.anzahl().toLocaleString('de-DE')} Engine-Ausgabezeilen unterdrueckt `
      + `(mit --verbose sichtbar).`);
  }

  const gewertet = proPartie.filter(p2 => p2.gewertet).length;
  if (gewertet === 0) {
    sag('');
    sag('⚠ KEINE einzige Partie ist sauber zu Ende gekommen — Bandbreite laesst sich');
    sag('  daraus nicht rechnen. Die DIAGNOSE steht trotzdem unten: sie stammt aus');
    sag('  allen Partien, auch den abgebrochenen — und genau dann braucht man sie.');
    // ── FEHLER VON MIR, 12.8. ─────────────────────────────────────
    // Hier stand ein `return`. Damit fielen ausgerechnet in dem Fall,
    // fuer den die Zaehlwerke gebaut wurden — keine Partie kommt durch —
    // alle Diagnose-Abschnitte unter den Tisch. Die Zahlen WAREN
    // erhoben, sie wurden nur nie gedruckt.
    diagnoseDrucken();
    sag('');
    sag('  Fuer Bandbreitenzahlen mit anderen Decks erneut versuchen (--deck-a/--deck-b).');
    _nbSchreib('');
    return;
  }
  const B = {
    ereignisse: [...sammler.ereignisse.entries()].map(([name, e]) => ({ name, ...e }))
      .sort((x, y) => y.wire - x.wire),
    empfaenger: [...sammler.empfaenger.entries()].map(([sid, e]) => ({ sid, ...e }))
      .sort((x, y) => y.wire - x.wire),
    groesster: sammler.groesster,
    broadcast: sammler.broadcast,
    summe: {
      count: [...sammler.ereignisse.values()].reduce((t, e) => t + e.count, 0),
      raw: [...sammler.ereignisse.values()].reduce((t, e) => t + e.raw, 0),
      wire: [...sammler.ereignisse.values()].reduce((t, e) => t + e.wire, 0),
    },
  };
  const n = gewertet;
  const mb = (x) => (x / 1048576);
  const kb = (x) => (x / 1024);
  const teilnehmer = 2 + cfg.spectators;
  const turnsGesamt = proPartie.filter(p => p.gewertet).reduce((s, p) => s + p.turns, 0) || 1;

  const endlos = proPartie.filter(p2 => /^endlosschleife/.test(p2.grund || ''));
  if (endlos.length) {
    sag('');
    sag('═══ ⚠ PARTIEN AN DER OBERGRENZE ═══');
    sag(`  ${endlos.length} von ${cfg.games} Partien liefen bis zur Obergrenze von ${cfg.maxTurns} Halbzuegen.`);
    sag('  Normale Partien enden weit darunter, und das Deck-Out beendet sie');
    sag('  spaetestens von selbst — wer die Grenze reisst, hat also entweder eine');
    sag('  Paarung, in der niemand durchkommt, oder einen Effekt, der das Ziehen');
    sag('  dauerhaft unterdrueckt. Betroffen:');
    for (const p2 of endlos) sag(`    • ${p2.deckA} vs ${p2.deckB} (${p2.grund})`);
    sag('  Fuer die Bandbreiten-Zahlen sind diese Partien ausgeklammert — sie wuerden');
    sag('  den Schnitt sonst mit Zehntausenden Nachrichten verfaelschen.');
  }
  sag(''); sag(`═══ GRÖSSTE BANDBREITEN-FRESSER (nach Leitungsbytes; Basis: ${n} gewertete Partien) ═══`);
  sag('  Anteil  Leitung/Partie   roh/Partie   Nachrichten  Ø roh   Kompression  Ereignis');
  for (const e of B.ereignisse.slice(0, 15)) {
    const anteil = 100 * e.wire / (B.summe.wire || 1);
    sag(
      `  ${anteil.toFixed(1).padStart(5)}%  ${kb(e.wire / n).toFixed(1).padStart(9)} KB  `
      + `${kb(e.raw / n).toFixed(1).padStart(9)} KB  ${String(Math.round(e.count / n)).padStart(9)}  `
      + `${(e.raw / e.count / 1024).toFixed(2).padStart(6)} KB  `
      + `${(100 - 100 * e.wire / e.raw).toFixed(1).padStart(9)}%  ${e.name}`);
  }
  if (B.ereignisse.length > 15) sag(`  … und ${B.ereignisse.length - 15} weitere Ereignisarten`);

  sag(''); sag('═══ JE EMPFÄNGER ═══');
  const proEmpf = new Map();
  for (const e of B.empfaenger) {
    const art = e.sid.includes('-spec-') ? 'Zuschauer' : 'Spieler';
    const x = proEmpf.get(art) || { count: 0, raw: 0, wire: 0, n: 0 };
    x.count += e.count; x.raw += e.raw; x.wire += e.wire; x.n++;
    proEmpf.set(art, x);
  }
  for (const [art, x] of proEmpf) {
    const anzahl = art === 'Spieler' ? 2 : cfg.spectators;
    sag(`  ${art.padEnd(10)} ${kb(x.wire / n / (anzahl || 1)).toFixed(1).padStart(9)} KB Leitung je Verbindung und Partie  `
      + `(${kb(x.raw / n / (anzahl || 1)).toFixed(1)} KB roh)`);
  }

  sag(''); sag('═══ HOCHRECHNUNG ═══');
  const wirePartie = B.summe.wire / n;
  const rawPartie = B.summe.raw / n;
  const wireProSpieler = wirePartie / teilnehmer;
  sag(`  Ø je Partie:            ${mb(rawPartie).toFixed(2)} MB roh  →  ${mb(wirePartie).toFixed(3)} MB auf der Leitung`);
  sag(`  Ø je Verbindung:        ${kb(wireProSpieler).toFixed(1)} KB`);
  sag(`  Ø je Halbzug (alle):    ${kb(B.summe.wire / turnsGesamt).toFixed(2)} KB`);
  sag(`  Singleplayer (1 Client): ~${kb(wireProSpieler).toFixed(1)} KB je Partie`);
  sag(`  PvP (2 Clients):         ~${kb(wireProSpieler * 2).toFixed(1)} KB je Partie`);
  sag(`  je zusätzlichem Zuschauer: ~${kb(wireProSpieler).toFixed(1)} KB je Partie`);
  const budget = 5 * 1024 * 1024 * 1024;
  sag(`  In 5 GB passen:          ~${Math.floor(budget / (wireProSpieler || 1)).toLocaleString('de-DE')} Singleplayer-Partien`);
  sag(`                           ~${Math.floor(budget / (wireProSpieler * 2 || 1)).toLocaleString('de-DE')} PvP-Partien`);
  sag(`  OHNE Kompression wären es ${Math.floor(budget / ((rawPartie / teilnehmer) || 1)).toLocaleString('de-DE')} bzw. `
    + `${Math.floor(budget / ((rawPartie / teilnehmer) * 2 || 1)).toLocaleString('de-DE')} — Faktor `
    + `${(B.summe.raw / (B.summe.wire || 1)).toFixed(1)}`);
  sag(`  Größte Einzelnachricht:  ${kb(B.groesster.bytes).toFixed(1)} KB (${B.groesster.event})`);

  // ── SCOPE-REGRESSION AUS v378, gefunden am 13.8. ──────────────────
  // Als der Diagnoseblock in `diagnoseDrucken()` gewandert ist, sind
  // SECHS `const`-Deklarationen mitgewandert, die der JSON-Schreiber
  // weiter unten braucht. Jeder Lauf mit mindestens einer gewerteten
  // Partie ist seitdem beim Schreiben gestorben:
  //   [netbench] Bericht konnte nicht geschrieben werden: cpuAlle is not defined
  // Aufgefallen ist es erst jetzt, weil der Lauf davor KEINE gewertete
  // Partie hatte und in den Null-Zweig lief, der frueher zurueckkehrt.
  // Der Textbericht war ebenfalls weg — beide Dateien entstehen in
  // derselben Anweisungsfolge. Deshalb: hier deklariert, drinnen nur
  // noch zugewiesen.
  let cpuAlle = 0;
  let deckListe = [];
  let fires = [];
  let leaks = [];
  let timeouts = [];
  let griffe = [];
  let notbremsen = [];

  // Als HOISTETE Funktion deklariert (nicht `const`), damit sie auch
  // oben im Null-Partien-Zweig aufgerufen werden kann.
  function diagnoseDrucken() {
  // ── RECHENZEIT: der zweite knappe Posten neben der Bandbreite ──────
  // Auf einer freien Render-Instanz ist CPU genauso begrenzt wie
  // Traffic — und eine Partie, die die CPU minutenlang beschaeftigt,
  // blockiert dort alles andere. Deshalb steht sie hier mit im Bericht.
  cpuAlle = proPartie.reduce((n, p2) => n + (p2.cpuMs || 0), 0);
  sag('');
  sag('═══ RECHENZEIT ═══');
  sag(`  Gesamt ueber alle ${proPartie.length} Partien: ${(cpuAlle / 60000).toFixed(1)} min CPU`);
  const teuerste = [...proPartie].sort((x, y) => (y.cpuMs || 0) - (x.cpuMs || 0)).slice(0, 5);
  for (const p2 of teuerste) {
    sag(`  ${((p2.cpuMs || 0) / 1000).toFixed(0).padStart(5)} s  bei ${String(p2.turns).padStart(3)} Halbzuegen`
      + ` (${((p2.cpuMs || 0) / Math.max(p2.turns, 1) / 1000).toFixed(1)} s/Halbzug)`
      + `  ${p2.gewertet ? '   ' : ' ⚠ '}${p2.deckA} vs ${p2.deckB}`);
  }

  deckListe = [...deckKosten.entries()]
    .map(([name, x]) => ({ name, ...x, proPartie: x.cpuMs / x.partien }))
    .sort((x, y) => y.proPartie - x.proPartie);
  if (deckListe.length) {
    sag('');
    sag('═══ TEUERSTE DECKS (Rechenzeit je Partie, halbiert auf beide Seiten) ═══');
    sag('   s/Partie  Partien  Abbrueche  Deck');
    for (const d of deckListe.slice(0, 10)) {
      sag(`  ${(d.proPartie / 1000).toFixed(0).padStart(9)}  ${String(d.partien).padStart(7)}  `
        + `${String(d.abbrueche).padStart(9)}  ${d.name}`);
    }
    const auffaellig = deckListe.filter(d => d.abbrueche > 0);
    if (auffaellig.length) {
      sag(`  → Abbrueche haeufen sich bei: ${auffaellig.map(d => `${d.name} (${d.abbrueche})`).join(', ')}`);
    }
  }

  // ── WELCHE KARTEN FEUERN DIE MEISTEN HOOKS ────────────────────────
  // `_hookFiresByCard` fuehrt die Engine ohnehin mit; bisher tauchte sie
  // nur in Overload-Dumps auf, also ausgerechnet dann, wenn es schon zu
  // spaet war. Hier steht sie nach JEDEM Lauf.
  fires = [...kartenFires.entries()].sort((x, y) => y[1] - x[1]);
  if (fires.length) {
    sag('');
    sag('═══ HOOK-FEUER JE KARTE (Top 15) ═══');
    const summe = fires.reduce((n, [, v]) => n + v, 0);
    for (const [name, v] of fires.slice(0, 15)) {
      const leck = kartenLeaks.get(name);
      sag(`  ${String(v).padStart(7)}  ${(100 * v / summe).toFixed(1).padStart(5)}%  ${name}`
        + (leck ? `   ⚠ ${leck} leckende Rollouts` : ''));
    }
  }
  if (steam.size) {
    const z = (k) => steam.get(k) || 0;
    sag('');
    sag('═══ STEAM-DWARF-ZAEHLWERK ═══');
    const auf = z('aufgerufen'), gef = z('gefeuert');
    sag(`  Abwurf-Reaktion: ${auf.toLocaleString('de-DE')} Aufrufe → ${gef.toLocaleString('de-DE')} mal gefeuert`
      + `${auf ? ` (${(100 * gef / auf).toFixed(1)} %)` : ''}`);
    sag(`    davon abgewiesen: HOPT ${z('raus_hopt').toLocaleString('de-DE')}`
      + ` | nicht im Support ${z('raus_zone').toLocaleString('de-DE')}`
      + ` | fremder Abwurf ${z('raus_fremd').toLocaleString('de-DE')}`
      + ` | inaktiv ${z('raus_inaktiv').toLocaleString('de-DE')}`);
    sag(`    Wartezeit allein aus den 150-ms-Pausen im Hook: `
      + `${(z('delay_ms') / 1000).toFixed(1)} s (live; im Rollout uebersprungen)`);
    sag(`    hoechste erreichte max HP: ${z('maxHp_hoechster').toLocaleString('de-DE')}`);
    if (z('miner_zugenden')) {
      sag(`  Miner-Zugende: ${z('miner_zugenden').toLocaleString('de-DE')} Ausloesungen, `
        + `${z('miner_karten_gesamt').toLocaleString('de-DE')} Karten insgesamt`);
      sag(`    groesster Einzelzug: ${z('miner_groesster_zug').toLocaleString('de-DE')} Karten`
        + ` bei ${z('miner_hoechste_hp').toLocaleString('de-DE')} max HP`);
      sag('    (`count = floor(maxHp / 100)` ist UNGEDECKELT — steigt die HP, steigt die Kette)');
    }
  }
  // ═══ OVERHEAL SHOCK / HEILUNGS-UMKEHR ═══════════════════════════
  // Karten-Einsatzbericht fuer die Umkehr-Mechanik. Beantwortet in
  // einer Tabelle: wie oft eingesetzt, hat es eine Aktion gekostet,
  // welcher Held war das Ziel, was hat die Umkehr an Schaden gebracht,
  // und wie ist die Partie ausgegangen. Alles aus LIVE-Zuegen — die
  // beiden Quellen (`_shockLog` in der Karte, `_healReversedDiag` in
  // der Engine) schliessen Rollouts ausdruecklich aus.
  if (shockPartien.length) {
    sag('');
    sag('═══ OVERHEAL SHOCK / HEILUNGS-UMKEHR ═══');
    sag('  Modus: `frei` = inhaerente Zusatz-Aktion (Support Magic 2 oder Decay Magic 1');
    sag('  beim Caster), `zusatz` = ueber einen Geber (Friendship & Co.), `main` = hat');
    sag('  die Aktion der Runde gekostet. „doppelt" = Ziel trug den Zustand schon —');
    sag('  jeder solche Einsatz ist verschenkt (der Zustand ist ein Boolean).');
    sag('');
    sag('  Partie  Zug  Modus   Caster                      → Ziel (HP)');
    let nEins = 0, nFrei = 0, nZusatz = 0, nMain = 0, nDoppelt = 0;
    let nTreffer = 0, nSchaden = 0;
    let nMitEinsatz = 0, nSiegeMitEinsatz = 0;
    for (const p2 of shockPartien) {
      for (const e of p2.einsaetze) {
        nEins++;
        if (e.modus === 'frei') nFrei++; else if (e.modus === 'zusatz') nZusatz++; else nMain++;
        if (e.zielHatteSchon) nDoppelt++;
        sag(`  ${String(p2.nr).padStart(6)}  ${String(e.zug).padStart(3)}  `
          + `${String(e.modus).padEnd(6)}  ${String(e.caster).slice(0, 26).padEnd(26)}  → `
          + `${e.ziel} (${e.zielHp})${e.zielHatteSchon ? '   ⚠ doppelt' : ''}`);
      }
      const t = p2.hr?.treffer || 0, d = p2.hr?.schaden || 0;
      nTreffer += t; nSchaden += d;
      const wer = (p2.sieger === 0 || p2.sieger === 1) ? p2.decks[p2.sieger] : null;
      // Die Karte steckt im Deck der Seite, die sie gespielt hat.
      const seite = p2.einsaetze.length ? p2.einsaetze[0].spieler : null;
      const gewonnen = (seite != null && p2.sieger === seite);
      // Gewertet wird nur, was die Frage beantwortet: Partien, in denen
      // die Karte tatsaechlich gespielt wurde und die sauber endeten.
      if (p2.gewertet && p2.einsaetze.length) {
        nMitEinsatz++;
        if (gewonnen) nSiegeMitEinsatz++;
      }
      sag(`          └─ ${String(t).padStart(3)} Umwandlungen, ${String(d).padStart(5)} Schaden`
        + ` · ${p2.turns} Halbzuege · ${wer ? 'Sieger: ' + wer : 'kein Sieger'}`
        + ` (${p2.grund})${p2.gewertet ? '' : '  ⚠ nicht gewertet'}`);
    }
    sag('');
    sag(`  SUMME ueber ${shockPartien.length} Partie(n) mit Beteiligung:`);
    sag(`    Einsaetze: ${nEins}  (frei ${nFrei} | ueber Geber ${nZusatz} | Main-Aktion ${nMain}`
      + `${nDoppelt ? ` | ⚠ ${nDoppelt} auf ein bereits geschocktes Ziel` : ''})`);
    sag(`    Umwandlungen: ${nTreffer}, daraus ${nSchaden} Schaden`
      + `${nEins ? ` (${(nSchaden / nEins).toFixed(0)} je Einsatz)` : ''}`);
    if (nMitEinsatz) {
      sag(`    Siege der spielenden Seite: ${nSiegeMitEinsatz}/${nMitEinsatz} gewertete Partien`
        + ` mit mindestens einem Einsatz (${(100 * nSiegeMitEinsatz / nMitEinsatz).toFixed(0)} %)`);
    }
    if (!nEins) {
      sag('    ⚠ KEIN einziger Einsatz — die Umwandlungen stammen aus einer aelteren');
      sag('      Anhaftung oder einer anderen Quelle des healReversed-Zustands.');
    }
    if (shockEntfernt) {
      sag(`    Vom Brett entfernt, bevor eingeloest: ${shockEntfernt}`
        + ` (davon ${shockEntferntLebend} bei noch lebendem Wirt)`);
    }
    if (nEins && !nTreffer) {
      sag('');
      sag('    ⚠ GELEGT, ABER NIE EINGELOEST. Die Karte liegt richtig, es folgt nur');
      sag('      keine Heilung auf das Ziel. Die Zielwahl-Tabelle unten sagt, wohin');
      sag('      die Heilungen stattdessen gehen.');
    }
    const wege = [...healRouting.entries()].sort((x, y) => y[1].n - x[1].n);
    if (wege.length) {
      sag('');
      sag('  ZIELWAHL ALLER HEILUNGEN (Versuche, live, je Quelle):');
      let gGesch = 0, gOffen = 0, gEigen = 0;
      for (const [k, v] of wege) {
        if (k.endsWith('gegner-geschockt')) gGesch += v.n;
        else if (k.endsWith('gegner-offen')) gOffen += v.n;
        else gEigen += v.n;
        sag(`    ${String(v.n).padStart(5)}x  ${String(v.hp).padStart(6)} HP  ${k}`);
      }
      sag(`    → eigene Seite ${gEigen} | geschockter Gegner ${gGesch}`
        + ` | Gegner OHNE Umkehr ${gOffen}${gOffen ? '  ⚠ reines Geschenk' : ''}`);
    }
  }
  notbremsen = [...overloads.entries()].sort((x, y) => y[1] - x[1]);
  if (notbremsen.length) {
    sag('');
    sag('═══ ⚠ NOTBREMSEN DER ENGINE ═══');
    sag('  `_dumpOverloadDiagnostics` hat angeschlagen. `cpu-deadline` heisst: ein');
    sag('  LIVE-Zug hat sein Zeitbudget gerissen — der Trail-Dump daneben sagt, wobei.');
    for (const [grund, v] of notbremsen) sag(`  ${String(v).padStart(5)}x  ${grund}`);
  }
  griffe = [...startGriffe.entries()].sort((x, y) => y[1] - x[1]);
  if (griffe.length) {
    sag('');
    sag('═══ SPIELSTART-GRIFFE (vom Lernkanal beantwortet) ═══');
    sag('  Quelle `priority` = harte Skript-Vorfahrt, `rule` = gelernte Profilwerte,');
    sag('  `explore` = Training. Jeder Eintrag hier ist ein Griff, der die MCTS-Suche');
    sag('  GAR NICHT erreicht hat.');
    for (const [name, v] of griffe.slice(0, 12)) sag(`  ${String(v).padStart(4)}x  ${name}`);
  }
  timeouts = [...hookTimeouts.entries()].sort((x, y) => y[1] - x[1]);
  if (timeouts.length) {
    sag('');
    sag('═══ ⚠ ABGEBROCHENE HOOKS ═══');
    sag('  Die Engine bricht einen Hook ab, wenn er 5 s lang keinen Fortschritt zeigt');
    sag('  (`_hookProgressTick` steht UND keine Abfrage offen). Rollouts bewegen den');
    sag('  Tick — wer hier auftaucht, haengt also NICHT in der MCTS-Suche, sondern');
    sag('  irgendwo davor oder danach. Ein abgebrochener onTurnStart kann den ganzen');
    sag('  Zug kosten; die Partie endet dann als „ohne-spielende".');
    for (const [name, v] of timeouts.slice(0, 10)) sag(`  ${String(v).padStart(5)}x  ${name}`);
  }
  leaks = [...kartenLeaks.entries()].sort((x, y) => y[1] - x[1]);
  if (leaks.length) {
    sag('');
    sag('═══ ROLLOUTS MIT HOHEM SPEICHERUMSATZ ═══');
    sag('  Gemessen wird der heapUsed-Unterschied um Snapshot/Restore, ab 0,5 MB.');
    sag('  ACHTUNG BEI DER DEUTUNG: darin steckt auch noch nicht eingesammelter Muell.');
    sag('  Bleibt der Speicher ueber die Partie flach, ist es GC-DRUCK, kein Leck —');
    sag('  teuer ist es trotzdem, weil jeder Rollout diesen Umsatz erneut erzeugt.');
    sag('  Ein echtes Leck erkennt man daran, dass rss/heapUsed mitwaechst.');
    for (const [name, v] of leaks.slice(0, 10)) sag(`  ${String(v).padStart(5)}x  ${name}`);
  }
  // ── v385: KOSTEN JE KANDIDAT, nicht nur Trefferzahl ───────────────
  // Die Liste darueber zaehlt nur Rollouts ueber 0,5 MB. Damit sehen
  // "teuer je Rollout" und "sehr oft bewertet" identisch aus — genau die
  // Frage, die bei Adventurousness (119 Treffer, Lauf 14.8. 12:02) offen
  // blieb. Diese Tabelle trennt es: `Rollouts` ist die Haeufigkeit,
  // `MB/Rollout` die Kosten. Eine Karte, die oft und billig bewertet
  // wird, steht mit vielen Rollouts und kleinem Schnitt da; ein echter
  // Fresser mit wenigen Rollouts und grossem Schnitt.
  const kand = [...kandHeap.entries()]
    .filter(([, v]) => v.calls > 0)
    .sort((x, y) => y[1].totalMb - x[1].totalMb);
  if (kand.length) {
    sag('');
    sag('═══ KOSTEN JE MCTS-KANDIDAT ═══');
    sag('  Heap-Umsatz um Snapshot/Restore, aufsummiert je Kandidat. Dieselbe');
    sag('  Messgroesse wie oben — hier aber MIT der Zahl der Rollouts, sodass');
    sag('  Haeufigkeit und Stueckkosten auseinanderzuhalten sind.');
    sag('   Rollouts     MB ges   MB/Rollout   ueber 0,5 MB  Kandidat');
    for (const [name, v] of kand.slice(0, 15)) {
      const proRollout = v.totalMb / v.calls;
      sag(`  ${String(v.calls).padStart(8)}  ${v.totalMb.toFixed(1).padStart(9)}  `
        + `${proRollout.toFixed(3).padStart(11)}  ${String(kartenLeaks.get(name) || 0).padStart(12)}  ${name}`);
    }
  }
  // ── v395: SIEGE JE DECK ───────────────────────────────────────────
  if (deckBilanz.size) {
    const zeilen = [...deckBilanz.entries()]
      .filter(([, v]) => v.partien > 0)
      .sort((p, q) => (q[1].siege / q[1].partien) - (p[1].siege / p[1].partien));
    sag('');
    sag('═══ SIEGE JE DECK (nur gewertete Partien) ═══');
    sag('  Quote  Siege/Partien  Ø Halbzuege  Ø s CPU (halbiert)  Deck');
    for (const [name, v] of zeilen) {
      const q = (100 * v.siege / v.partien).toFixed(0) + '%';
      sag(`  ${q.padStart(5)}  ${String(v.siege + '/' + v.partien).padStart(13)}  `
        + `${(v.halbzuege / v.partien).toFixed(1).padStart(11)}  `
        + `${(v.cpuMs / v.partien / 1000).toFixed(1).padStart(18)}  ${name}`);
    }
    const wenig = zeilen.filter(([, v]) => v.partien < 5).length;
    if (wenig) {
      sag(`  Hinweis: ${wenig} Deck(s) mit weniger als 5 Partien — Quote dort nicht belastbar.`);
    }
  }
  if (paarung.size) {
    const mehrfach = [...paarung.entries()].filter(([, v]) => v.n >= 3)
      .sort((p, q) => q[1].n - p[1].n).slice(0, 15);
    if (mehrfach.length) {
      sag('');
      sag('═══ PAARUNGEN MIT MINDESTENS 3 PARTIEN ═══');
      for (const [k, v] of mehrfach) {
        const erst = k.split(' vs ')[0];
        sag(`  ${String(v.n).padStart(3)}x  ${erst} gewinnt ${v.siegeX}/${v.n}  (${k})`);
      }
    }
  }
  }   // ← Ende diagnoseDrucken
  diagnoseDrucken();
  if (B.broadcast.count) {
    sag(`  Broadcasts an ALLE:      ${B.broadcast.count} Stück, ${kb(B.broadcast.raw / n).toFixed(1)} KB/Partie roh `
      + `— live × Anzahl verbundener Clients`);
  }

  // ── Vollbericht auf Platte ──
  const stempel = new Date().toISOString().replace(/[:.]/g, '-');
  const out = _nbEnv('PP_NETTEST_OUT',
    path.join(__dirname, 'data', 'netbench', `netbench-${stempel}.json`));
  const txt = out.replace(/\.json$/i, '') + '.txt';
  try {
    fs.mkdirSync(path.dirname(txt), { recursive: true });
    // Der Textbericht enthaelt WORTGLEICH das, was oben in der Konsole
    // stand — plus die Einzelpartien-Tabelle, die dort nur als Zeilen
    // vorbeilief. Zum Nachlesen ohne JSON-Betrachter.
    const tabelle = ['', '═══ EINZELPARTIEN ═══',
      '  Nr  Halbzuege  Nachrichten     roh MB   Leitung MB     s  s CPU  gewertet  Grund              Decks'];
    for (const p2 of proPartie) {
      tabelle.push(`  ${String(p2.nr).padStart(2)}  ${String(p2.turns).padStart(9)}  `
        + `${String(p2.nachrichten).padStart(11)}  ${(p2.raw / 1048576).toFixed(2).padStart(9)}  `
        + `${(p2.wire / 1048576).toFixed(3).padStart(11)}  ${(p2.ms / 1000).toFixed(0).padStart(4)}  `
        + `${((p2.cpuMs || 0) / 1000).toFixed(0).padStart(5)}  `
        + `${(p2.gewertet ? 'ja' : 'NEIN').padStart(8)}  `
        + `${String(p2.grund || '').padEnd(17)}  ${p2.deckA} vs ${p2.deckB}`);
    }
    fs.writeFileSync(txt, zeilen.concat(tabelle, ['']).join('\n'), { encoding: 'utf-8' });
    fs.writeFileSync(out, JSON.stringify({
      erzeugt: new Date().toISOString(),
      konfiguration: cfg,
      partien: proPartie,
      ereignisse: B.ereignisse,
      empfaenger: B.empfaenger,
      summe: B.summe,
      groesste_nachricht: B.groesster,
      broadcasts: B.broadcast,
      auffaellige_partien: auffaellig,
      deck_bilanz: Object.fromEntries([...deckBilanz.entries()].map(([k, v]) => [k, {
        partien: v.partien, siege: v.siege,
        quote: +(v.siege / v.partien).toFixed(3),
        halbzuegeSchnitt: +(v.halbzuege / v.partien).toFixed(1),
        cpuSekSchnitt: +(v.cpuMs / v.partien / 1000).toFixed(1) }])),
      paarungen: Object.fromEntries([...paarung.entries()]),
      kandidaten_heap: Object.fromEntries([...kandHeap.entries()]
        .map(([k, v]) => [k, { rollouts: v.calls, mbGesamt: +v.totalMb.toFixed(2),
          mbProRollout: +(v.totalMb / Math.max(1, v.calls)).toFixed(4),
          ueberSchwelle: kartenLeaks.get(k) || 0 }])),
      unterdrueckte_ausgabezeilen: schleuse.anzahl(),
      cpu_ms_gesamt: cpuAlle,
      hook_feuer_je_karte: Object.fromEntries(fires),
      leckende_rollouts: Object.fromEntries(leaks),
      abgebrochene_hooks: Object.fromEntries(timeouts),
      spielstart_griffe: Object.fromEntries(griffe),
      notbremsen: Object.fromEntries(notbremsen),
      steam_dwarf_zaehlwerk: Object.fromEntries(steam),
      overheal_shock: shockPartien,
      heil_zielwahl: Object.fromEntries(healRouting),
      shock_entfernt: { gesamt: shockEntfernt, wirtLebte: shockEntferntLebend },
      deck_kosten: deckListe,
      hochrechnung: {
        wire_je_partie: wirePartie, roh_je_partie: rawPartie,
        wire_je_verbindung: wireProSpieler,
        wire_je_halbzug: B.summe.wire / turnsGesamt,
        kompressionsfaktor: B.summe.raw / (B.summe.wire || 1),
      },
    }, null, 2), { encoding: 'utf-8' });
    _nbSchreib(`\n[netbench] Bericht (Text): ${txt}`);
    _nbSchreib(`[netbench] Bericht (JSON): ${out}`);
  } catch (e) {
    console.error('[netbench] Bericht konnte nicht geschrieben werden:', e.message);
  }
}

// ===== CATCH-ALL (SPA) =====
// ★ v485: fehlende DATEIEN bekommen jetzt eine echte 404 statt der
// index.html. Vorher beantwortete diese Zeile ausnahmslos jeden Pfad
// mit Status 200 und HTML — auch `/gibtsnicht.png` oder
// `/beliebig.js`. Fuer Suchmaschinen sind das „Soft 404s": unendlich
// viele URLs, die alle dieselbe Seite mit demselben Titel liefern.
// Google drosselt daraufhin die Indexierung der gesamten Domain.
//
// Der Riegel ist bewusst eng: er greift NUR, wenn das letzte
// Pfadsegment eine Dateiendung traegt (und nicht .html ist). Alles
// andere — `/play`, `/deck/123` — laeuft weiter in die SPA, damit
// kuenftige Client-Routen nicht brechen. Heute gibt es keine: das
// Frontend kennt kein pushState, die App lebt vollstaendig unter „/".
app.get('*', (req, res, next) => {
  const last = req.path.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  if (dot > 0) {
    const ext = last.slice(dot).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') {
      res.status(404);
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      return res.send('Not found');
    }
  }
  return next();
}, serveIndexHtml);

// ===== START =====
// Headless training mode — no DB, no socket server. Sample decks come
// from data/SampleDecks and setupGameState short-circuits on the
// injected room._currentDecks, so the whole batch runs engine-only.
if (process.env.PP_TRAIN) {
  runTrainingBatch()
    .then(() => process.exit(0))
    .catch(err => { console.error('[train] batch failed:', err); process.exit(1); });
} else if (_nbEnv('PP_NETTEST', '') === '1') {
  // Bandbreiten-Messstand — wie der Trainingslauf ohne Datenbank und
  // ohne Socket-Server. Siehe den Block bei runNetBenchmark().
  runNetBenchmark()
    .then(() => process.exit(0))
    .catch(err => { console.error('[netbench] fehlgeschlagen:', err); process.exit(1); });
} else
initDatabase().then(async () => {
  await purgeAllGuests(); // clear orphaned guest accounts from previous runs
  // Sitzungen zurueckholen, BEVOR der Server Anfragen annimmt — sonst
  // laufen die ersten Aufrufe nach einem Neustart in „Not authenticated".
  // NACH dem Gaeste-Raeumen, damit Sitzungen geloeschter Gastkonten
  // gar nicht erst in die Map kommen.
  await restoreSessions();
  server.listen(PORT, HOST, () => {
    // ── DIAGNOSE-SCHALTER BEIM START ANZEIGEN ─────────────────────
    // Zum ZWEITEN Mal ist eine Umgebungsvariable still nicht
    // angekommen (erst PP_DEMO_RECORD, jetzt PP_CHAIN_DEBUG /
    // PP_CPU_PROMPT_DEBUG als npm-Argument statt als Env). Ohne
    // Rueckmeldung ist "kein Log" nicht unterscheidbar von
    // "Codepfad nicht erreicht" — deshalb sagt der Server jetzt
    // beim Hochfahren, was er tatsaechlich sieht.
    {
      const DEBUG_FLAGS = [
        // PP_CHAIN_DEBUG und PP_CPU_PROMPT_DEBUG sind derzeit
        // FEST AN und brauchen keinen Schalter mehr.
        ['PP_PLAYLOG',          'Spielzug-Protokoll'],
        ['PP_DECK_MONITOR',     'Deck-Ueberwachung'],
        ['PP_STATUS_DEBUG',     'Statuseffekte'],
        ['PP_DMG_DEBUG',        'Schadensberechnung'],
        ['PP_SNAP_DEBUG',       'MCTS-Snapshots'],
      ];
      const aktiv = DEBUG_FLAGS.filter(([k]) => process.env[k] === '1');
      if (aktiv.length) {
        console.log('[diagnose] AKTIV: ' + aktiv.map(([k, d]) => k + ' (' + d + ')').join(', '));
      } else {
        const gesetztAberFalsch = DEBUG_FLAGS
          .filter(([k]) => process.env[k] != null && process.env[k] !== '1');
        // Haeufigste Ursache in cmd: `set X=1 && ...` nimmt das
        // Leerzeichen vor && in den WERT mit, also "1 " statt "1".
        if (gesetztAberFalsch.length) {
          console.warn('[diagnose] gesetzt, aber NICHT auf "1": '
            + gesetztAberFalsch.map(([k]) => k + '=' + JSON.stringify(process.env[k])).join(', '))
        } else {
          console.log('[diagnose] keine Diagnose-Schalter aktiv.')
        }
      }
      // Zustand der Entwicklerwerkzeuge unuebersehbar melden. Beim
      // Bandbreiten-Problem war „laeuft da was, das nicht laufen soll?"
      // genau die Frage, die man nicht raten will — also sagt der
      // Server sie beim Hochfahren an.
      if (DEBUG_TOOLS_ENABLED) {
        console.warn('[debug-tools] AN (PP_DEBUG_TOOLS=1) — Selbstspiel, A/B, CPU-vs-CPU und '
          + 'Snapshot-Test sind ueber Socket-Ereignisse ausloesbar. Auf einer LIVE-Instanz ausschalten.');
      } else {
        console.log('[debug-tools] AUS — Selbstspiel-/Debug-Ereignisse sind nicht angemeldet.');
      }
      if (process.env.PP_DEBUG_TOOLS != null && process.env.PP_DEBUG_TOOLS !== '1') {
        console.warn('[debug-tools] PP_DEBUG_TOOLS ist gesetzt, aber nicht auf "1": '
          + JSON.stringify(process.env.PP_DEBUG_TOOLS) + ' — bleibt AUS.');
      }
    }

    // Hand-Interaktions-Prüflauf: meldet vorgemerkte Karten, die
    // inzwischen implementiert sind, den Hook `onHandInteraction`
    // aber nicht feuern — ohne den greift "Ambush the Scout" gegen
    // sie nicht. Unübersehbar beim Start, weil so eine Lücke sonst
    // still bliebe (Als Vorgabe 4.8.).
    try {
      const { reportHandInteractionAudit, PENDING } =
        require('./cards/effects/_hand-interaction-registry');
      const { warnings } = reportHandInteractionAudit();
      if (warnings.length) {
        console.warn('╔══════════════════════════════════════════════════════╗');
        console.warn(`║  ${String(warnings.length).padEnd(2)} VORGEMERKTE HAND-INTERAKTION(EN) OHNE HOOK      ║`);
        console.warn('║  Details siehe die Zeilen darüber                    ║');
        console.warn('╚══════════════════════════════════════════════════════╝');
      } else {
        console.log(`[hand-interaction] ${PENDING.length} Karten vorgemerkt, keine offene Lücke`);
      }
    } catch (e) {
      console.warn('[hand-interaction] Prüflauf fehlgeschlagen:', e.message);
    }

    // Gold-Prüflauf: meldet Kartenskripte, die roh auf `.gold` schreiben
    // und damit an Logans Zustandsregel UND Criminal Monkees Zahlungs-
    // Trigger vorbeilaufen. Derselbe Fehler ist am 16.8. dreimal
    // hintereinander aufgetreten (v404/v405/v406) — ab jetzt meldet er
    // sich selbst, statt beim Playtest aufzufallen.
    try {
      const { reportGoldAudit } = require('./cards/effects/_gold-audit');
      const { warnings: goldWarn, checked: goldChecked } = reportGoldAudit();
      if (goldWarn.length) {
        console.warn('╔══════════════════════════════════════════════════════╗');
        console.warn(`║  ${String(goldWarn.length).padEnd(2)} KARTE(N) MIT ROHEM GOLD-ZUGRIFF                 ║`);
        console.warn('║  Details siehe die Zeilen darüber                    ║');
        console.warn('╚══════════════════════════════════════════════════════╝');
      } else {
        console.log(`[gold-audit] ${goldChecked} Kartenskripte geprüft, kein roher Gold-Zugriff`);
      }
    } catch (e) {
      console.warn('[gold-audit] Prüflauf fehlgeschlagen:', e.message);
    }
    // Demo-Aufnahme-Banner (Als Pilot-Spiele): beim Start unübersehbar
    // machen, ob PP_DEMO_RECORD wirkt — der erste Versuch scheiterte
    // still, weil die Variable als npm-Argument statt Env gesetzt war.
    if (demoRecordingEnabled()) {
      console.log('╔══════════════════════════════════════════════════════╗');
      console.log('║  DEMO-AUFNAHME AKTIV (Standard) — Singleplayer-      ║');
      console.log('║  Partien werden nach data/demo-games/ aufgezeichnet  ║');
      console.log('║  Abschalten: PP_DEMO_RECORD=0                        ║');
      console.log('╚══════════════════════════════════════════════════════╝');
    } else {
      console.log('[demo-recorder] deaktiviert (PP_DEMO_RECORD=0)');
    }
    console.log(`Pixel Parties TCG running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('[DB] Failed to initialize database:', err);
  process.exit(1);
});
