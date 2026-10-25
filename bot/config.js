'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Konfiguration — alles kommt aus Umgebungsvariablen (bot/.env, siehe .env.example).
//  Nichts Geheimes steht im Code.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

/** Kleiner .env-Leser (keine Abhängigkeit). Bereits gesetzte Variablen gewinnen — wie in server.js. */
function loadEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/(^|\s+)#.*$/, '').trim();          // Kommentar hinter dem Wert („KEY=123   # Hinweis“)
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(path.join(__dirname, '.env'));

/** Nur EINEN Schlüssel aus einer fremden .env holen (die des Spiels enthält weitere Geheimnisse, die der Bot nicht braucht). */
function readKeyFrom(file, name) {
  try {
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith('#') || !line.startsWith(name + '=')) continue;
      let v = line.slice(name.length + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  } catch { /* keine Datei */ }
  return '';
}
// BOT_SECRET muss im Spiel und im Bot gleich sein — es genügt, es EINMAL in die .env des Spiels zu schreiben.
if (!process.env.BOT_SECRET) {
  const v = readKeyFrom(path.join(__dirname, '..', '.env'), 'BOT_SECRET');
  if (v) process.env.BOT_SECRET = v;
}

const env = (k, d = '') => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const num = (k, d) => { const n = Number(env(k)); return Number.isFinite(n) && env(k) !== '' ? n : d; };
const list = (k, d = []) => (env(k) ? env(k).split(',').map(s => s.trim()).filter(Boolean) : d);
const flag = (k, d = false) => (env(k) === '' ? d : /^(1|true|yes|on)$/i.test(env(k)));

// Kanal „new-cards“. Fest im Code; eine Variable NEW_CARDS_CHANNEL_ID in der .env wird ignoriert (und beim Start gemeldet, wenn sie abweicht).
const NEW_CARDS_CHANNEL_ID = '774670375303905291';
if (process.env.NEW_CARDS_CHANNEL_ID && process.env.NEW_CARDS_CHANNEL_ID !== NEW_CARDS_CHANNEL_ID) {
  console.warn(`[config] NEW_CARDS_CHANNEL_ID=${process.env.NEW_CARDS_CHANNEL_ID} in der .env wird ignoriert — der Kanal für neue Karten ist fest ${NEW_CARDS_CHANNEL_ID}.`);
}

const config = {
  token: env('DISCORD_TOKEN'),
  clientId: env('DISCORD_CLIENT_ID', '765902004160692245'),
  guildId: env('GUILD_ID'),
  prefix: env('PREFIX', '!'),

  // Verbindung zum Spielserver (läuft auf derselben Maschine)
  gameApiUrl: env('GAME_API_URL', 'http://127.0.0.1:3000').replace(/\/+$/, ''),
  botSecret: env('BOT_SECRET'),
  gameUrl: env('GAME_URL', 'https://pixelpartiestcg.com/'),

  // Wer Admin-Befehle benutzen darf (Rollennamen, ohne Groß-/Kleinschreibung und Sonderzeichen verglichen) — oder per ID.
  adminRoleNames: list('ADMIN_ROLE_NAMES', ['Creator', 'Deputy Monia [MOD]']),
  adminRoleIds: list('ADMIN_ROLE_IDS'),

  // Kanäle (IDs). Leer = Funktion aus.
  channels: {
    welcome: env('WELCOME_CHANNEL_ID'),          // leer: Systemkanal des Servers
    modlog: env('MODLOG_CHANNEL_ID'),
    // Neue Karten als Bilder: FEST eingetragen, bewusst NICHT per .env überschreibbar (ein alter oder falscher Eintrag NEW_CARDS_CHANNEL_ID in der .env hatte den Feed ins Leere geschickt).
    newCards: NEW_CARDS_CHANNEL_ID,
    patchnotes: env('PATCHNOTES_CHANNEL_ID'),
    leaderboard: env('LEADERBOARD_CHANNEL_ID'),
    cardOfDay: env('CARD_OF_DAY_CHANNEL_ID'),
    bugs: env('BUG_CHANNEL_ID'),
    bugfixes: env('BUGFIXES_CHANNEL_ID', '1562197315437989889'),   // Bugfixes an Karten/Wechselwirkungen mit Kartenbildern (ohne .env-Eintrag gilt dieser)
    // Kanal der Minispiele (!mystery, !guess, !pixle). Ohne .env-Eintrag gilt dieser; die ältere Variable MYSTERY_CHANNEL_ID bleibt als Rückfall gültig.
    matchmaking: env('MATCHMAKING_CHANNEL_ID', '733828766794645504'),   // 💥-matchmaking: hier landen alle !duel-Herausforderungen (ohne .env-Eintrag gilt dieser)
    minigames: env('MINIGAMES_CHANNEL_ID', env('MYSTERY_CHANNEL_ID', '1561796630762623036')),
  },

  // Moderation
  newMemberDays: num('NEW_MEMBER_DAYS', 183),    // „weniger als ein halbes Jahr“
  muteMinutes: num('MUTE_MINUTES', 60),
  strikeLimit: num('STRIKE_LIMIT', 3),
  strikeExpiryDays: num('STRIKE_EXPIRY_DAYS', 90),
  raidJoins: num('RAID_JOINS', 8),               // so viele Beitritte …
  raidWindowSec: num('RAID_WINDOW_SEC', 60),     // … in so vielen Sekunden = Raid-Verdacht
  raidLockdownMinutes: num('RAID_LOCKDOWN_MINUTES', 15),   // 0 = nur warnen, Verifizierungsstufe nicht anheben

  // Willkommen / Regeln
  newcomerRoleId: env('NEWCOMER_ROLE_ID'),       // wird beim Beitritt vergeben, per Regel-Button entfernt
  verifiedRoleId: env('VERIFIED_ROLE_ID'),       // wird per Regel-Button vergeben
  welcomeDm: flag('WELCOME_DM', false),

  // Spiel-Integration
  syncMinutes: num('ROLE_SYNC_MINUTES', 10),
  syncNicknames: flag('SYNC_NICKNAMES', false),
  skinCollectorMin: num('SKIN_COLLECTOR_MIN', 50),
  veteranGames: num('VETERAN_GAMES', 300),

  // Mystery-Spiel (!mystery / !guess): unbegrenzt viele Rätsel, aber nur das erste neu erzeugte jeder vollen Stunde ist SC wert
  mysteryReward: num('MYSTERY_REWARD', 20),       // SC für den Gewinner …
  mysteryPenalty: num('MYSTERY_PENALTY', 2),      // … minus so viele je falschem Tipp, den er für diese Karte schon abgegeben hat

  // Pixle (!pixle): tägliche geheime Karte, höchstens so viele Tipps je Person; SC nur für das Lösen (einmal pro Tag)
  pixleMaxGuesses: num('PIXLE_MAX_GUESSES', 10),
  pixleReward: num('PIXLE_REWARD', 30),            // SC fürs Lösen …
  pixlePenalty: num('PIXLE_PENALTY', 3),           // … minus so viel je falschem Tipp davor (mindestens 3 SC)

  // Bugfix-Feed: ab so vielen betroffenen Karten gilt ein gemeinsamer Baustein als „breit“ (dann nur Name und Anzahl, keine Bilder)
  bugfixMaxShared: num('BUGFIX_MAX_SHARED', 12),

  // Feeds
  feedPollMinutes: num('FEED_POLL_MINUTES', 5),
  leaderboardMinutes: num('LEADERBOARD_MINUTES', 10),

  // /bug → optional zusätzlich als GitHub-Issue
  githubToken: env('GITHUB_TOKEN'),
  githubRepo: env('GITHUB_REPO', 'ChurchmanKingzi/PixelParties'),

  repoRoot: path.resolve(__dirname, '..'),
  dataDir: path.join(__dirname, 'data'),
};

module.exports = config;
module.exports._loadEnvFile = loadEnvFile;
