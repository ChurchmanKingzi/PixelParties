// ═══════════════════════════════════════════════════════════════════
//  FREISCHALTBARE SKINS
//
//  Manche Skins stehen NICHT im Shop, sondern werden über Ereignisse frei.
//  Ihre Kartenbilder liegen in `cards/skins/unlockable/` (statt direkt in
//  `cards/skins/`); die Zuordnung Held → Skin steht wie bei allen Skins in
//  `data/skins.json`.
//
//  Dieses Modul enthält nur die REINE Logik — ohne Datenbank, Sockets oder
//  Spielzustand, damit sie einzeln prüfbar ist. `server.js` kümmert sich um
//  alles Übrige (Besitz schreiben, Popup senden, Hooks an den Spielenden).
//
//  Aktuell:
//   • „Bills Worst Nightmare“  → Tutorial geschafft (alle Stufen).
//   • „Dr. Heinz N. Stein“     → am 31.10. nach der LOKALEN Uhr des Spielers
//                                 irgendeine Partie gewonnen (PvP unranked/
//                                 ranked, Draft, CPU, Kampagnenduell, Skill Test).
//
//  CPUs/Bots tragen NIEMALS freischaltbare Skins (`withoutUnlockableSkins`,
//  und der Shop/CPU-Würfel zieht nur aus dem Shop-Bestand).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const SKINS_DIR = path.join(__dirname, 'cards', 'skins');
const UNLOCKABLE_DIR = path.join(SKINS_DIR, 'unlockable');
const TUTORIAL_DIR = path.join(__dirname, 'data', 'puzzles', 'tutorial');
const IMAGE_EXTS = new Set(['.png', '.webp', '.jpg', '.jpeg', '.gif']);

// Wodurch welcher freischaltbare Skin frei wird (Namen wie in data/skins.json bzw. als Bilddatei).
const TUTORIAL_SKIN = 'Bills Worst Nightmare';
const HALLOWEEN_SKIN = 'Dr. Heinz N. Stein';
const RULES = {
  [TUTORIAL_SKIN]: 'tutorial',
  [HALLOWEEN_SKIN]: 'halloween',
};

/** Namen (ohne Endung) aller Bilder in `cards/skins/unlockable/`. */
function unlockableSkinNames(dir = UNLOCKABLE_DIR) {
  try {
    return new Set(fs.readdirSync(dir)
      .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
      .map(f => path.basename(f, path.extname(f))));
  } catch { return new Set(); }
}

function isUnlockableSkin(skinName, dir) { return unlockableSkinNames(dir).has(skinName); }

/** Held, zu dem ein Skin gehört (aus data/skins.json) — null, wenn unbekannt. */
function heroOfSkin(skinsData, skinName) {
  for (const [hero, list] of Object.entries(skinsData || {})) if ((list || []).includes(skinName)) return hero;
  return null;
}

/** Skin-Zuordnung (Held → Skin) ohne freischaltbare Skins — für alles, was einer CPU/einem Bot gehört. */
function withoutUnlockableSkins(skins, dir) {
  const out = {};
  if (!skins || typeof skins !== 'object') return out;
  const lock = unlockableSkinNames(dir);
  for (const [hero, skin] of Object.entries(skins)) if (!lock.has(skin)) out[hero] = skin;
  return out;
}

/** Ids aller Tutorial-Stufen (`tutorial/<Dateiname>`, wie in `puzzle_completions`). */
function allTutorialIds(dir = TUTORIAL_DIR) {
  try {
    return fs.readdirSync(dir)
      .filter(f => /^tutorial(\d+)\s+(.+)\.json$/i.test(f))
      .map(f => 'tutorial/' + f.replace(/\.json$/, ''));
  } catch { return []; }
}

// ── Uhr des Spielers ──
// „Am 31.10. seiner eigenen Zeit (lokale PC-Uhr)“: nur der Client kennt sie. Er meldet
// `{ now: Date.now(), tz: getTimezoneOffset() }`; wir merken uns den Abstand zur Serveruhr
// (`skew`), damit das Datum auch Stunden nach der Meldung stimmt (Mitternachtswechsel).

/** Gültige Uhrmeldung → { skew, tz } (skew = Client-Uhr minus Server-Uhr in ms), sonst null. */
function parseClientClock(data, serverNow = Date.now()) {
  const now = Number(data && data.now), tz = Number(data && data.tz);
  if (!Number.isFinite(now) || !Number.isFinite(tz) || Math.abs(tz) > 14 * 60) return null;
  return { skew: now - serverNow, tz };
}

/** Lokales Datum { month (1-12), day } nach einer gemerkten Uhr — null ohne Uhr. */
function localDate(clock, serverNow = Date.now()) {
  if (!clock) return null;
  const d = new Date(serverNow + clock.skew - clock.tz * 60000);   // UTC-Getter liefern dann die lokale Wandzeit
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function isHalloween(date) { return !!date && date.month === 10 && date.day === 31; }

module.exports = {
  SKINS_DIR, UNLOCKABLE_DIR, TUTORIAL_SKIN, HALLOWEEN_SKIN, RULES,
  unlockableSkinNames, isUnlockableSkin, heroOfSkin, withoutUnlockableSkins, allTutorialIds,
  parseClientClock, localDate, isHalloween,
};
