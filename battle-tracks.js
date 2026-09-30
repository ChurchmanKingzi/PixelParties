// ═══════════════════════════════════════════════════════════════════
//  WAHLBARE BATTLE-TRACKS (Spielerprofil)
//
//  Jeder Spieler wählt im Profil SEINEN Kampf-Track. Der GEGNER hört ihn
//  (PvP), und umgekehrt hört man den Track des Gegners. Gegen eine CPU
//  läuft deren Thema (`cpuBgm`, siehe server.js) — unabhängig von der Wahl.
//
//  Drei Sorten Tracks, alle liegen als `public/music/bgm_<id>.ogg`:
//   • ALLGEMEINE Tracks `battle1`, `battle2`, … — stehen jedem offen.
//     Neue Dateien nach dem Muster `bgm_battle<Zahl>.ogg` erscheinen
//     ohne Codeänderung in der Auswahl.
//   • ARCHETYP-THEMES `theme_<slug>` (z. B. `theme_deepsea`) — je ein Track
//     für jeden Archetyp mit mehr als drei Karten, ebenfalls frei wählbar.
//     Sie sind zum Rollenspielen gedacht und haben Namen. Titel und
//     Archetyp stehen in `data/battle-tracks.json` (erzeugt von
//     `scripts/music/themes_spec.py`); gelistet wird nur, was als Datei
//     existiert.
//   • CPU-Themen (`zi`, `null`, …) — frei nach ZEHN Siegen gegen diese CPU
//     (`UNLOCK_WINS`). Der Stand wird nicht gespeichert, sondern aus
//     `npc_stats` abgeleitet: wirkt damit auch rückwirkend für bereits
//     gesammelte Siege und kann nicht auseinanderlaufen. Mehrere Decks
//     derselben Figur (Varianten mit gleichem mittlerem Helden) teilen sich
//     ein Thema; ihre Siege zählen zusammen.
//
//  Diese Datei ist bewusst frei von Express/Sockets: server.js reicht
//  Datenbank und Deck-/Slug-Funktionen herein.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

/** Siege gegen eine CPU, ab denen deren Track wählbar wird. */
const UNLOCK_WINS = 10;

const GENERIC_RE = /^bgm_(battle\d+)\.(ogg|mp3|wav)$/i;
const THEME_RE = /^bgm_(theme_[a-z0-9]+)\.(ogg|mp3|wav)$/i;
const NAMES_FILE = path.join(__dirname, 'data', 'battle-tracks.json');

/** Titel der Tracks aus data/battle-tracks.json (fehlt die Datei → leer). */
function loadTrackNames() {
  try {
    const j = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf-8'));
    return { generic: j.generic || {}, themes: Array.isArray(j.themes) ? j.themes : [] };
  } catch { return { generic: {}, themes: [] }; }
}

/** Archetyp-Themes, deren Datei existiert: [{ id, name, archetype }], alphabetisch nach Archetyp. */
function listThemeTracks(musicDir, names = loadTrackNames()) {
  let files;
  try { files = new Set(fs.readdirSync(musicDir).map(f => (THEME_RE.exec(f) || [])[1]).filter(Boolean).map(x => x.toLowerCase())); }
  catch { return []; }
  // Alphabetisch nach Archetyp (die Reihenfolge der JSON folgt der Kartenanzahl und taugt nicht als Anzeige).
  return names.themes.filter(t => files.has(t.id)).map(t => ({ id: t.id, name: t.name, archetype: t.archetype }))
    .sort((a, b) => a.archetype.localeCompare(b.archetype, 'en', { sensitivity: 'base' }));
}

/** Allgemeine Tracks im Musikordner, numerisch sortiert (battle2 vor battle10). */
function listGenericTracks(musicDir) {
  const ids = new Set();
  try {
    for (const f of fs.readdirSync(musicDir)) {
      const m = GENERIC_RE.exec(f);
      if (m) ids.add(m[1].toLowerCase());
    }
  } catch { /* kein Musikordner → keine Auswahl */ }
  return [...ids].sort((a, b) => parseInt(a.slice(6), 10) - parseInt(b.slice(6), 10));
}

/**
 * Deck-ID → { slug, name } für alle Decks, deren mittlerer Held ein Thema hat.
 * @param {Array} decks         Ergebnis von loadSampleDecks()
 * @param {Function} slugForHero  bgmSlugForHero aus server.js
 */
function buildCpuIndex(decks, slugForHero) {
  const byDeck = new Map();     // deckId → slug
  const bySlug = new Map();     // slug → { slug, name, deckIds }
  for (const d of decks || []) {
    const hero = d?.heroes?.[1]?.hero;
    if (!hero) continue;
    const slug = slugForHero(hero);
    if (!slug) continue;
    byDeck.set(d.id, slug);
    let e = bySlug.get(slug);
    if (!e) { e = { slug, name: hero, deckIds: [] }; bySlug.set(slug, e); }
    e.deckIds.push(d.id);
  }
  return { byDeck, bySlug };
}

/** Siege je Thema aus npc_stats-Zeilen ({opponent_deck_id, wins}). */
function winsPerSlug(rows, byDeck) {
  const out = new Map();
  for (const r of rows || []) {
    const slug = byDeck.get(r.opponent_deck_id);
    if (!slug) continue;
    out.set(slug, (out.get(slug) || 0) + Number(r.wins || 0));
  }
  return out;
}

/**
 * Hat dieser Sieg den Track freigeschaltet? `preWins` = Siege dieses Themas
 * VOR der Partie. Genau einmal wahr, wenn die Schwelle überschritten wird.
 */
function crossedUnlock(preWins, won) {
  return !!won && preWins < UNLOCK_WINS && preWins + 1 >= UNLOCK_WINS;
}

/** @param {{db, loadSampleDecks: Function, bgmSlugForHero: Function, musicDir: string}} deps */
function createBattleTracks(deps) {
  const { db, loadSampleDecks, bgmSlugForHero, musicDir } = deps;

  const cpuIndex = () => buildCpuIndex(loadSampleDecks(), bgmSlugForHero);

  async function winsFor(userId, byDeck) {
    const rows = await db.all('SELECT opponent_deck_id, wins FROM npc_stats WHERE user_id = ?', [userId]);
    return winsPerSlug(rows, byDeck);
  }

  /** Vollständige Auswahlliste für die Profil-Oberfläche. */
  async function listFor(userId) {
    const { byDeck, bySlug } = cpuIndex();
    const wins = await winsFor(userId, byDeck);
    const cpu = [...bySlug.values()].map(e => {
      const w = wins.get(e.slug) || 0;
      return { id: e.slug, name: e.name, wins: w, unlocked: w >= UNLOCK_WINS };
    }).sort((a, b) => (b.unlocked - a.unlocked) || a.name.localeCompare(b.name));
    const names = loadTrackNames();
    return {
      need: UNLOCK_WINS,
      generic: listGenericTracks(musicDir).map(id => ({ id, name: names.generic[id] || 'Battle ' + id.slice(6) })),
      themes: listThemeTracks(musicDir, names),
      cpu,
    };
  }

  /** Darf dieser Spieler den Track wählen? (null = Standard = immer.) */
  async function isSelectable(userId, track) {
    if (track == null || track === '') return true;
    const id = String(track).toLowerCase();
    if (listGenericTracks(musicDir).includes(id)) return true;
    if (listThemeTracks(musicDir).some(t => t.id === id)) return true;
    const { byDeck, bySlug } = cpuIndex();
    if (!bySlug.has(id)) return false;
    return ((await winsFor(userId, byDeck)).get(id) || 0) >= UNLOCK_WINS;
  }

  /** Gespeicherte Wahl beim Kampfbeginn prüfen → gültige ID oder null. */
  async function resolveForBattle(userId, stored) {
    if (!stored) return null;
    try { return (await isSelectable(userId, stored)) ? String(stored).toLowerCase() : null; }
    catch { return null; }
  }

  /**
   * Nach einem CPU-Sieg: wurde ein Thema gerade freigeschaltet?
   * MUSS nach dem Hochzählen von `npc_stats` laufen: der Stand danach
   * enthält den neuen Sieg, der Stand davor ist einfach eins weniger.
   * @returns {Promise<{id,name}|null>}
   */
  async function unlockedByWin(userId, opponentDeckId) {
    const { byDeck, bySlug } = cpuIndex();
    const slug = byDeck.get(opponentDeckId);
    if (!slug) return null;
    const wins = await winsFor(userId, byDeck);
    const post = wins.get(slug) || 0;                 // enthält den neuen Sieg bereits
    const pre = post - 1;
    return crossedUnlock(pre, true) ? { id: slug, name: bySlug.get(slug).name } : null;
  }

  return { listFor, isSelectable, resolveForBattle, unlockedByWin };
}

module.exports = { UNLOCK_WINS, listGenericTracks, listThemeTracks, loadTrackNames, buildCpuIndex, winsPerSlug, crossedUnlock, createBattleTracks };
