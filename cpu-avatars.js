// ═══════════════════════════════════════════════════════════════════
//  GEGNER-AVATARE (Trophäen aus dem Singleplayer)
//
//  Jeder CPU-Gegner (= Sample-/Structure-Deck) tritt mit dem Portrait seines
//  Helden an (in der Partie der mittlere Held, sonst der erste vorhandene –
//  `portraetHeld` in public/app-board.jsx). Wer ihn ZUM ERSTEN MAL besiegt
//  (`UNLOCK_WINS`), darf dieses Portrait ab dann selbst als Avatar tragen.
//  Kaufen kann man diese Avatare nicht.
//
//  • Zuordnung Deck → Avatar steht in `data/shop/cpu-avatars.json`
//    ({ avatars: [{ deckId, id, name, hero }] }, erzeugt von
//    scripts/avatar-entwuerfe/motive/cpu_avatare.py). Die Bilder liegen wie alle
//    Avatare in `data/shop/avatars/<id>.png` (gleiche URL-Form beim Ausrüsten),
//    werden aber aus Katalog, Kauf und Zufallskauf herausgehalten. Gelistet wird
//    nur, was als Datei existiert.
//  • Der Freischalt-Stand wird nicht gespeichert, sondern wie bei den
//    Gegner-Sleeves und Battle-Tracks aus `npc_stats` abgeleitet: wirkt
//    rückwirkend für bereits gesammelte Siege und kann nicht auseinanderlaufen.
//
//  Diese Datei ist bewusst frei von Express/Sockets: server.js reicht
//  Datenbank und Deck-Funktionen herein (Schwester von cpu-sleeves.js).
// ═══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

/** Siege gegen eine CPU, ab denen ihr Avatar dem Spieler gehört. */
const UNLOCK_WINS = 1;

/** Einträge aus der Zuordnungsdatei, deren Bild existiert (fehlt die Datei → leer). */
function loadEntries(mapFile, avatarsDir) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(mapFile, 'utf-8')); } catch { return []; }
  const list = Array.isArray(doc?.avatars) ? doc.avatars : [];
  return list.filter(e => e && e.deckId && e.id && fs.existsSync(path.join(avatarsDir, e.id + '.png')));
}

/**
 * Hat dieser Sieg den Avatar freigeschaltet? `postWins` = Siege NACH der
 * Partie (enthält den neuen Sieg). Genau einmal wahr: beim Erreichen der Schwelle.
 */
function crossedUnlock(postWins) {
  return postWins === UNLOCK_WINS;
}

/** @param {{db, loadSampleDecks: Function, mapFile: string, avatarsDir: string}} deps */
function createCpuAvatars(deps) {
  const { db, loadSampleDecks, mapFile, avatarsDir } = deps;

  // Kleiner Zwischenspeicher: die Datei wird nur neu gelesen, wenn sie sich ändert.
  let cache = { mtime: -1, entries: [] };
  function entries() {
    let mtime = 0;
    try { mtime = fs.statSync(mapFile).mtimeMs; } catch { return []; }
    if (mtime !== cache.mtime) cache = { mtime, entries: loadEntries(mapFile, avatarsDir) };
    return cache.entries;
  }
  const byDeck = () => new Map(entries().map(e => [e.deckId, e]));
  const idSet = () => new Set(entries().map(e => e.id));

  /** Ist diese Avatar-ID ein Gegner-Avatar (→ nicht im Shop kaufbar)? */
  function isCpuAvatar(id) { return idSet().has(String(id)); }

  /** Anzeigename eines Gegner-Avatars (oder null). */
  function nameOf(id) { return entries().find(e => e.id === String(id))?.name || null; }

  /** Gegner-Avatar eines Decks: { id, name, file } oder null. */
  function forDeck(deckId) {
    const e = byDeck().get(deckId);
    return e ? { id: e.id, name: e.name, file: e.id + '.png' } : null;
  }

  async function winsByDeck(userId) {
    const rows = await db.all('SELECT opponent_deck_id, wins FROM npc_stats WHERE user_id = ?', [userId]);
    return new Map(rows.map(r => [r.opponent_deck_id, Number(r.wins || 0)]));
  }

  /** IDs der Gegner-Avatare, die dieser Spieler besitzt. */
  async function ownedIds(userId) {
    const wins = await winsByDeck(userId);
    return entries().filter(e => (wins.get(e.deckId) || 0) >= UNLOCK_WINS).map(e => e.id);
  }

  /**
   * Liste für den Shop. Gegner, die der Spieler noch nicht freigeschaltet hat,
   * bleiben verdeckt (kein Name, kein Held), damit nichts vorweggenommen wird.
   * @param {Set<string>} unlockedOpponents  getUnlockedOpponentIds() aus server.js
   */
  async function listFor(userId, unlockedOpponents) {
    const wins = await winsByDeck(userId);
    const decks = new Map((loadSampleDecks() || []).map(d => [d.id, d]));
    const order = new Map([...decks.keys()].map((id, i) => [id, i]));
    return entries()
      .filter(e => decks.has(e.deckId))
      .map(e => {
        const d = decks.get(e.deckId);
        const w = wins.get(e.deckId) || 0;
        const known = unlockedOpponents.has(e.deckId);
        return {
          id: e.id,
          file: e.id + '.png',
          name: (known || w >= UNLOCK_WINS) ? e.name : null,
          wins: Math.min(w, UNLOCK_WINS),
          unlocked: w >= UNLOCK_WINS,
          opponentKnown: known,
          opponent: known ? d.name : null,
          middleHero: known ? (d.heroes?.[1]?.hero || e.hero || null) : null,
          _o: order.get(e.deckId),
        };
      })
      .sort((a, b) => (b.unlocked - a.unlocked) || (b.opponentKnown - a.opponentKnown) || (b.wins - a.wins) || (a._o - b._o))
      .map(({ _o, ...rest }) => rest);
  }

  /**
   * Nach einem CPU-Sieg: wurde gerade ein Avatar freigeschaltet?
   * MUSS nach dem Hochzählen von `npc_stats` laufen.
   * @returns {Promise<{id,name,file,opponent,middleHero}|null>}
   */
  async function unlockedByWin(userId, opponentDeckId) {
    const e = byDeck().get(opponentDeckId);
    if (!e) return null;
    const post = (await winsByDeck(userId)).get(opponentDeckId) || 0;
    if (!crossedUnlock(post)) return null;
    const d = (loadSampleDecks() || []).find(x => x.id === opponentDeckId);
    return { id: e.id, name: e.name, file: e.id + '.png', opponent: d?.name || null, middleHero: d?.heroes?.[1]?.hero || e.hero || null };
  }

  return { UNLOCK_WINS, isCpuAvatar, nameOf, forDeck, ownedIds, listFor, unlockedByWin };
}

module.exports = { UNLOCK_WINS, loadEntries, crossedUnlock, createCpuAvatars };
