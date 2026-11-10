'use strict';
// ═══════════════════════════════════════════════════════════════
//  Rarity-Umbenennung in gespeicherten Daten (läuft bei jedem Serverstart, idempotent).
//  Stand: Diamond Rare wurde zu Storm Rare (gleiche Rangstelle) — die alte ID `diamond` gibt es nicht mehr.
//  Betroffen:
//    * user_card_rarities (Sammlung): Zeile umschreiben; gibt es für (Nutzer, Karte) schon eine Zeile der neuen ID, werden die Zähler addiert
//    * decks.rarities (JSON { main, potion, side, heroes:[{hero, ability1, ability2}] }): jede Kopie mit alter ID bekommt die neue
//    * pending_booster.cards_json (offenes Pack, JSON-Liste { name, rarity })
//  Nicht angefasst: sc_log.opponent_id (Verlaufstext „<rarity>:<Karte>“, nur gelesen) und laufende Spiele (flüchtig).
//  Alt-Clients mit gecachtem JS kennen `storm` nicht: unbekannte Rarity zählt dort als Common (rarities.js: rank/clean) — kein Absturz.
// ═══════════════════════════════════════════════════════════════

const RENAMES = { diamond: 'storm' };

function mapRarity(v, ren) { return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ren, v) ? ren[v] : v; }

/** Deck-Rarities (JSON-Objekt) umschreiben; liefert null, wenn nichts zu ändern war. */
function renameInDeckRarities(raw, ren) {
  if (!raw || typeof raw !== 'object') return null;
  let changed = false;
  const out = { ...raw };
  for (const k of ['main', 'potion', 'side']) {
    if (!Array.isArray(raw[k])) continue;
    out[k] = raw[k].map(v => { const n = mapRarity(v, ren); if (n !== v) changed = true; return n; });
  }
  if (Array.isArray(raw.heroes)) {
    out.heroes = raw.heroes.map(h => {
      if (!h || typeof h !== 'object') return h;
      const o = { ...h };
      for (const key of ['hero', 'ability1', 'ability2']) { const n = mapRarity(h[key], ren); if (n !== h[key]) { o[key] = n; changed = true; } }
      return o;
    });
  }
  return changed ? out : null;
}

/** Offenes Pack (Liste { name, rarity, … }) umschreiben; null, wenn nichts zu ändern war. */
function renameInPackCards(list, ren) {
  if (!Array.isArray(list)) return null;
  let changed = false;
  const out = list.map(c => {
    if (!c || typeof c !== 'object') return c;
    const n = mapRarity(c.rarity, ren);
    if (n === c.rarity) return c;
    changed = true;
    return { ...c, rarity: n };
  });
  return changed ? out : null;
}

/**
 * @param {{all:Function, run:Function, transaction:Function}} db Hilfsfunktionen aus db.js
 * @param {Object<string,string>} [renames] alte ID → neue ID
 * @returns {Promise<{collection:number, decks:number, packs:number}>} Zahl der umgeschriebenen Zeilen
 */
async function migrateRarityRenames(db, renames) {
  const ren = renames || RENAMES;
  const res = { collection: 0, decks: 0, packs: 0 };
  for (const from of Object.keys(ren)) {
    const to = ren[from];
    // Sammlung: je (Nutzer, Karte) die Zähler zusammenführen
    const rows = await db.all('SELECT user_id, card, count FROM user_card_rarities WHERE rarity = ?', [from]);
    if (rows.length) {
      await db.transaction(async (tx) => {
        for (const r of rows) {
          await tx.run('INSERT INTO user_card_rarities (user_id, card, rarity, count) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, card, rarity) DO UPDATE SET count = count + excluded.count',
            [r.user_id, r.card, to, Number(r.count) || 0]);
          await tx.run('DELETE FROM user_card_rarities WHERE user_id = ? AND card = ? AND rarity = ?', [r.user_id, r.card, from]);
        }
      });
      res.collection += rows.length;
    }
    // Decks
    for (const d of await db.all('SELECT id, rarities FROM decks WHERE rarities LIKE ?', ['%"' + from + '"%'])) {
      let raw = null; try { raw = JSON.parse(d.rarities); } catch { /* kaputtes JSON: bleibt liegen (zählt beim Laden als Common) */ }
      const out = renameInDeckRarities(raw, ren);
      if (!out) continue;
      await db.run('UPDATE decks SET rarities = ? WHERE id = ?', [JSON.stringify(out), d.id]);
      res.decks++;
    }
    // Offene Packs
    for (const p of await db.all('SELECT id, cards_json FROM pending_booster WHERE cards_json LIKE ?', ['%"' + from + '"%'])) {
      let raw = null; try { raw = JSON.parse(p.cards_json); } catch { /* s. o. */ }
      const out = renameInPackCards(raw, ren);
      if (!out) continue;
      await db.run('UPDATE pending_booster SET cards_json = ? WHERE id = ?', [JSON.stringify(out), p.id]);
      res.packs++;
    }
  }
  return res;
}

module.exports = { RENAMES, migrateRarityRenames, renameInDeckRarities, renameInPackCards };
