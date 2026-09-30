// ═══════════════════════════════════════════════════════════════════
//  GEGNER-SLEEVES (Trophäen aus dem Singleplayer)
//
//  Jeder CPU-Gegner (= Sample-/Structure-Deck) hat eine eigene Sleeve, mit
//  der er selbst spielt. Wer ihn FÜNFMAL besiegt (`UNLOCK_WINS`), darf sie
//  ab dann selbst ausrüsten. Kaufen kann man sie nicht.
//
//  • Zuordnung Deck → Sleeve steht in `data/shop/cpu-sleeves.json`
//    ({ sleeves: [{ deckId, id, name }] }, erzeugt vom Rahmen-Skript in
//    data/sleeve-proposals/runde6/generator/frame_r6.py). Die Bilder liegen
//    wie alle Sleeves in `data/shop/sleeves/<id>.png` (gleiche URL-Form beim
//    Ausrüsten), werden aber aus Katalog, Kauf und Zufallskauf herausgehalten.
//    Gelistet wird nur, was als Datei existiert.
//  • Der Freischalt-Stand wird nicht gespeichert, sondern wie bei den
//    Battle-Tracks aus `npc_stats` abgeleitet: wirkt rückwirkend für bereits
//    gesammelte Siege und kann nicht auseinanderlaufen.
//
//  Diese Datei ist bewusst frei von Express/Sockets: server.js reicht
//  Datenbank und Deck-Funktionen herein.
// ═══════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

/** Siege gegen eine CPU, ab denen ihre Sleeve dem Spieler gehört. */
const UNLOCK_WINS = 5;

/** Einträge aus der Zuordnungsdatei, deren Bild existiert (fehlt die Datei → leer). */
function loadEntries(mapFile, sleevesDir) {
  let doc;
  try { doc = JSON.parse(fs.readFileSync(mapFile, 'utf-8')); } catch { return []; }
  const list = Array.isArray(doc?.sleeves) ? doc.sleeves : [];
  return list.filter(e => e && e.deckId && e.id && fs.existsSync(path.join(sleevesDir, e.id + '.png')));
}

/**
 * Hat dieser Sieg die Sleeve freigeschaltet? `postWins` = Siege NACH der
 * Partie (enthält den neuen Sieg). Genau einmal wahr: beim Erreichen der Schwelle.
 */
function crossedUnlock(postWins) {
  return postWins === UNLOCK_WINS;
}

/** @param {{db, loadSampleDecks: Function, mapFile: string, sleevesDir: string}} deps */
function createCpuSleeves(deps) {
  const { db, loadSampleDecks, mapFile, sleevesDir } = deps;

  // Kleiner Zwischenspeicher: die Datei wird nur neu gelesen, wenn sie sich ändert.
  let cache = { mtime: -1, entries: [] };
  function entries() {
    let mtime = 0;
    try { mtime = fs.statSync(mapFile).mtimeMs; } catch { return []; }
    if (mtime !== cache.mtime) cache = { mtime, entries: loadEntries(mapFile, sleevesDir) };
    return cache.entries;
  }
  const byDeck = () => new Map(entries().map(e => [e.deckId, e]));
  const idSet = () => new Set(entries().map(e => e.id));

  /** Ist diese Sleeve-ID eine Gegner-Sleeve (→ nicht im Shop kaufbar)? */
  function isCpuSleeve(id) { return idSet().has(String(id)); }

  /** Anzeigename einer Gegner-Sleeve (oder null). */
  function nameOf(id) { return entries().find(e => e.id === String(id))?.name || null; }

  /** Gegner-Sleeve eines Decks: { id, name, file } oder null. */
  function forDeck(deckId) {
    const e = byDeck().get(deckId);
    return e ? { id: e.id, name: e.name, file: e.id + '.png' } : null;
  }

  /** Bild-URL der Sleeve, mit der diese CPU spielt (oder null). */
  function urlForDeck(deckId) {
    const e = byDeck().get(deckId);
    return e ? '/data/shop/sleeves/' + e.id + '.png' : null;
  }

  async function winsByDeck(userId) {
    const rows = await db.all('SELECT opponent_deck_id, wins FROM npc_stats WHERE user_id = ?', [userId]);
    return new Map(rows.map(r => [r.opponent_deck_id, Number(r.wins || 0)]));
  }

  /** IDs der Gegner-Sleeves, die dieser Spieler besitzt. */
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
          middleHero: known ? (d.heroes?.[1]?.hero || null) : null,
          _o: order.get(e.deckId),
        };
      })
      .sort((a, b) => (b.unlocked - a.unlocked) || (b.opponentKnown - a.opponentKnown) || (b.wins - a.wins) || (a._o - b._o))
      .map(({ _o, ...rest }) => rest);
  }

  /**
   * Nach einem CPU-Sieg: wurde gerade eine Sleeve freigeschaltet?
   * MUSS nach dem Hochzählen von `npc_stats` laufen.
   * @returns {Promise<{id,name,file,opponent,middleHero}|null>}
   */
  async function unlockedByWin(userId, opponentDeckId) {
    const e = byDeck().get(opponentDeckId);
    if (!e) return null;
    const post = (await winsByDeck(userId)).get(opponentDeckId) || 0;
    if (!crossedUnlock(post)) return null;
    const d = (loadSampleDecks() || []).find(x => x.id === opponentDeckId);
    return { id: e.id, name: e.name, file: e.id + '.png', opponent: d?.name || null, middleHero: d?.heroes?.[1]?.hero || null };
  }

  return { UNLOCK_WINS, isCpuSleeve, nameOf, forDeck, urlForDeck, ownedIds, listFor, unlockedByWin };
}

module.exports = { UNLOCK_WINS, loadEntries, crossedUnlock, createCpuSleeves };
