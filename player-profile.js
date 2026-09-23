// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — ÖFFENTLICHES SPIELERPROFIL (v1289)
//
//  Als Vorgabe 23.9.: Ein Klick auf einen Eintrag der Top-Spieler-Liste
//  öffnet ein kompaktes Profil — Avatar, Name, Win Rate / Elo / SC,
//  die (bis zu) drei besten Decks nach Winrate UND Spielrate, die Helden
//  des Top-Decks als Kartenbilder und der Victory-Spruch als Motto.
//  Dazu, was für einen ANDEREN Spieler relevant ist: Rang, Form der
//  letzten Runden, die eigene Bilanz gegen diesen Spieler, Ranked-Sets,
//  Mitglied seit, Bio und ob er gerade spielt.
//
//  Alles, was dieses Feature braucht, lebt HIER — server.js ruft nur:
//    • ensurePlayerProfileSchema(db)      in initDatabase
//    • deckIdentityOf(deck)               in setupGameState (Deck merken)
//    • historyDeckColumns(identity)       in endGame (Deck mitschreiben)
//    • registerPlayerProfileRoutes(app, deps)
//
//  DECK-IDENTITÄT
//  `game_history` kannte bis v1288 nur das Helden-Trio einer Runde.
//  Ab v1289 schreibt endGame `deck_id` (eigene Deck-Zeile oder
//  `sample-…`) und `deck_name` (Name zur Spielzeit) mit. Alte Zeilen ohne
//  Deck werden über ihr Trio einem Deck des Spielers zugeordnet
//  (eigenes Default-Deck > zuletzt bearbeitetes eigenes Deck > gepinntes
//  Sample-Deck > übrige Sample-Decks). Ohne Treffer bilden sie eine
//  eigene Trio-Gruppe. Neue Runden sind damit exakt, alte bestmöglich.
// ═══════════════════════════════════════════════════════════════
'use strict';

// Glättung wie bei den Top-Heroes (`HERO_RANK_PRIOR_*` in server.js):
// jedes Deck startet mit 5 Phantom-Spielen à 50 %, damit ein 1-0-Deck
// kein 20-Spiele-Deck mit 70 % überholt.
const DECK_PRIOR_GAMES = 5;
const DECK_PRIOR_RATE = 0.5;
// Gewichtung „Winrate und Spielrate" (Als Vorgabe). Die Spielrate ist
// relativ zum meistgespielten Deck des Spielers normiert (0…1).
const DECK_SCORE_WINRATE_WEIGHT = 0.6;
const DECK_SCORE_PLAYRATE_WEIGHT = 0.4;
const TOP_DECK_COUNT = 3;
const RECENT_FORM_LENGTH = 10;

// ── Schema ─────────────────────────────────────────────────────
async function ensurePlayerProfileSchema(db) {
  try { await db.execute('ALTER TABLE game_history ADD COLUMN deck_id TEXT DEFAULT NULL'); } catch {}
  try { await db.execute('ALTER TABLE game_history ADD COLUMN deck_name TEXT DEFAULT NULL'); } catch {}
  // Kopf-an-Kopf-Abfrage (Ziel gegen Betrachter).
  try { await db.execute('CREATE INDEX IF NOT EXISTS idx_game_history_user_opp ON game_history(user_id, opponent_id)'); } catch {}
}

// ── Deck-Identität (setupGameState → endGame) ──────────────────
/** Identität eines aufgelösten Decks — `null`, wenn es keine gibt. */
function deckIdentityOf(deck) {
  if (!deck) return null;
  const id = deck.id ? String(deck.id) : null;
  const name = deck.name ? String(deck.name).slice(0, 80) : null;
  return (id || name) ? { id, name } : null;
}
/** Werte für die beiden neuen game_history-Spalten. */
function historyDeckColumns(identity) {
  return [identity?.id || null, identity?.name || null];
}

// ── Reine Helfer (ohne DB, testbar) ────────────────────────────
function heroNamesOfRow(row) {
  return [row.hero1, row.hero2, row.hero3].filter(Boolean);
}
function trioKey(names) {
  return (names || []).filter(Boolean).slice().sort().join('|');
}
function heroNamesOfDeck(deck) {
  return (deck?.heroes || []).map(h => (h && typeof h === 'object') ? h.hero : h).filter(Boolean);
}

/**
 * Trio → bestes bekanntes Deck. `knownDecks` ist bereits nach
 * Priorität sortiert (erstes gewinnt).
 */
function buildTrioIndex(knownDecks) {
  const idx = new Map();
  for (const d of knownDecks) {
    const key = trioKey(heroNamesOfDeck(d));
    if (key && !idx.has(key)) idx.set(key, d);
  }
  return idx;
}

/**
 * Gruppiert die Spielhistorie eines Spielers nach Deck.
 * `rows` sind game_history-Zeilen (beliebige Reihenfolge, mit created_at).
 */
function groupHistoryByDeck(rows, knownDecks) {
  const trioIndex = buildTrioIndex(knownDecks);
  const groups = new Map();
  for (const row of rows) {
    const heroes = heroNamesOfRow(row);
    const tk = trioKey(heroes);
    let key, deckId = null;
    if (row.deck_id) { deckId = String(row.deck_id); key = 'id:' + deckId; }
    else if (tk && trioIndex.has(tk)) { deckId = trioIndex.get(tk).id; key = 'id:' + deckId; }
    else if (tk) key = 'trio:' + tk;
    else continue;   // Zeile ohne Helden — nichts zuzuordnen
    let g = groups.get(key);
    if (!g) { g = { key, deckId, games: 0, wins: 0, trios: new Map(), lastName: null, lastTs: -Infinity }; groups.set(key, g); }
    g.games++;
    if (row.won) g.wins++;
    if (tk) {
      const t = g.trios.get(tk) || { count: 0, heroes };
      t.count++;
      g.trios.set(tk, t);
    }
    const ts = Number(row.created_at) || 0;
    if (ts >= g.lastTs) {
      g.lastTs = ts;
      if (row.deck_name) g.lastName = String(row.deck_name);
    }
  }
  return [...groups.values()];
}

/** Bewertet und sortiert Deck-Gruppen — beste zuerst. */
function rankDeckGroups(groups) {
  const maxGames = groups.reduce((m, g) => Math.max(m, g.games), 0) || 1;
  return groups
    .map(g => {
      const smoothed = (g.wins + DECK_PRIOR_GAMES * DECK_PRIOR_RATE) / (g.games + DECK_PRIOR_GAMES);
      const playShare = g.games / maxGames;
      return { ...g, score: DECK_SCORE_WINRATE_WEIGHT * smoothed + DECK_SCORE_PLAYRATE_WEIGHT * playShare };
    })
    .sort((a, b) => (b.score - a.score) || (b.games - a.games) || (b.lastTs - a.lastTs));
}

/** Macht aus einer Gruppe den Client-Eintrag (Name, Kennzahlen, Helden, Skins). */
function deckEntryOf(group, decksById) {
  const known = group.deckId ? decksById.get(group.deckId) : null;
  // Helden = das tatsächlich am häufigsten gespielte Trio dieses Decks
  // (in Spielreihenfolge). Rückfall: die aktuellen Helden des Decks.
  let heroes = [];
  let best = null;
  for (const t of group.trios.values()) if (!best || t.count > best.count) best = t;
  if (best) heroes = best.heroes.slice(0, 3);   // Reihenfolge der juengsten Runde
  // Ist es dasselbe Trio wie im gespeicherten Deck, gilt dessen
  // Aufstellung (links / Mitte / rechts, wie der Spieler sie gebaut hat).
  const deckHeroes = known ? heroNamesOfDeck(known).slice(0, 3) : [];
  if (deckHeroes.length && (!heroes.length || trioKey(heroes) === trioKey(deckHeroes))) heroes = deckHeroes;
  // Ohne Decknamen: Kurznamen der Helden („Diamond / Alice / Barker") —
  // die vollen Beinamen sprengen die kompakte Zeile.
  const kurz = heroes.map(h => String(h).split(',')[0].trim());
  const name = known?.name || group.lastName || (kurz.length ? kurz.join(' / ') : 'Unnamed deck');
  const skins = {};
  if (known?.skins) for (const h of heroes) if (known.skins[h]) skins[h] = known.skins[h];
  return {
    name,
    games: group.games,
    wins: group.wins,
    losses: group.games - group.wins,
    winRate: group.games ? Math.round((group.wins / group.games) * 100) : 0,
    heroes,
    skins,
    prebuilt: !!known?.isSample,
  };
}

/** Form der letzten Runden: älteste links, neueste rechts; plus aktuelle Serie. */
function recentFormOf(rowsNewestFirst) {
  const last = rowsNewestFirst.slice(0, RECENT_FORM_LENGTH);
  const results = last.map(r => (r.won ? 'W' : 'L')).reverse();
  let streak = null;
  if (last.length) {
    const kind = last[0].won ? 'W' : 'L';
    let n = 0;
    for (const r of rowsNewestFirst) { if ((r.won ? 'W' : 'L') !== kind) break; n++; }
    streak = { kind, count: n };
  }
  return { results, streak };
}

function parseJson(text, fallback) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

// ── Zusammenbau ────────────────────────────────────────────────
/**
 * deps: { db, loadSampleDecks, isInGame(userId) }
 * Liefert `null`, wenn es den Spieler nicht gibt (oder er ein Gast ist).
 */
async function buildPlayerProfile(deps, username, viewerId) {
  const { db, loadSampleDecks, isInGame } = deps;
  const user = await db.get(
    'SELECT id, username, elo, color, avatar, bio, victory_msg, wins, losses, sc, ranked_games, created_at, default_sample_deck_id, is_guest FROM users WHERE username = ?',
    [username]
  );
  if (!user || user.is_guest) return null;

  const wins = Number(user.wins) || 0;
  const losses = Number(user.losses) || 0;
  const rankedSets = Number(user.ranked_games) || 0;

  // Rang in derselben Ordnung wie /api/leaderboard (elo DESC, username ASC).
  let rank = null;
  if (rankedSets > 0) {
    const r = await db.get(
      'SELECT COUNT(*) AS n FROM users WHERE ranked_games > 0 AND (elo > ? OR (elo = ? AND username < ?))',
      [user.elo, user.elo, user.username]
    );
    rank = (Number(r?.n) || 0) + 1;
  }

  // Bekannte Decks in Zuordnungs-Priorität.
  const ownRows = await db.all(
    "SELECT id, name, heroes, skins, is_default, updated_at FROM decks WHERE user_id = ? AND (mode IS NULL OR mode != 'cube')",
    [user.id]
  );
  const own = ownRows
    .map(d => ({
      id: String(d.id), name: d.name, heroes: parseJson(d.heroes, []), skins: parseJson(d.skins, {}),
      isDefault: !!d.is_default, updatedAt: Number(d.updated_at) || 0, isSample: false,
    }))
    .sort((a, b) => (b.isDefault - a.isDefault) || (b.updatedAt - a.updatedAt));
  let samples = [];
  try { samples = (loadSampleDecks() || []).map(s => ({ id: s.id, name: s.name, heroes: s.heroes || [], skins: {}, isSample: true })); } catch {}
  const pinned = user.default_sample_deck_id;
  samples.sort((a, b) => (b.id === pinned) - (a.id === pinned));
  const knownDecks = [...own, ...samples];
  const decksById = new Map(knownDecks.map(d => [d.id, d]));

  const history = await db.all(
    'SELECT hero1, hero2, hero3, won, opponent_id, deck_id, deck_name, created_at FROM game_history WHERE user_id = ? ORDER BY created_at DESC, rowid DESC',
    [user.id]
  );
  const ranked = rankDeckGroups(groupHistoryByDeck(history, knownDecks));
  const topDecks = ranked.slice(0, TOP_DECK_COUNT).map(g => deckEntryOf(g, decksById));

  // Bilanz des BETRACHTERS gegen diesen Spieler (aus Sicht des Betrachters).
  let headToHead = null;
  if (viewerId && String(viewerId) !== String(user.id)) {
    let targetWins = 0, games = 0;
    for (const r of history) {
      if (String(r.opponent_id) !== String(viewerId)) continue;
      games++;
      if (r.won) targetWins++;
    }
    headToHead = { games, wins: games - targetWins, losses: targetWins };
  }

  return {
    username: user.username,
    color: user.color || '#00f0ff',
    avatar: user.avatar || null,
    bio: user.bio || '',
    motto: user.victory_msg || '',
    elo: Number(user.elo) || 0,
    sc: Number(user.sc) || 0,
    wins, losses,
    winRate: (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : null,
    rank,
    rankedSets,
    memberSince: Number(user.created_at) || null,
    inGame: typeof isInGame === 'function' ? !!isInGame(user.id) : false,
    isSelf: !!viewerId && String(viewerId) === String(user.id),
    topDecks,
    form: recentFormOf(history),
    headToHead,
  };
}

// ── Route ──────────────────────────────────────────────────────
/**
 * deps: { db, loadSampleDecks, isInGame(userId), viewerIdOf(req) }
 * Öffentlich wie /api/leaderboard; der Betrachter ist optional (Cookie)
 * und schaltet nur die Kopf-an-Kopf-Bilanz frei. Keine E-Mail, keine IDs.
 */
function registerPlayerProfileRoutes(app, deps) {
  app.get('/api/players/:username/profile', async (req, res) => {
    const username = String(req.params.username || '').trim();
    if (!username || username.length > 40) return res.status(400).json({ error: 'Invalid player name' });
    try {
      const viewerId = typeof deps.viewerIdOf === 'function' ? deps.viewerIdOf(req) : null;
      const profile = await buildPlayerProfile(deps, username, viewerId);
      if (!profile) return res.status(404).json({ error: 'Player not found' });
      res.json({ profile });
    } catch (err) {
      console.error('[player-profile] error:', err.message);
      res.status(500).json({ error: 'Failed to load player profile' });
    }
  });
}

module.exports = {
  ensurePlayerProfileSchema,
  deckIdentityOf,
  historyDeckColumns,
  registerPlayerProfileRoutes,
  buildPlayerProfile,
  // reine Helfer — für Prüfskripte
  groupHistoryByDeck, rankDeckGroups, deckEntryOf, recentFormOf, trioKey,
};
