// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SMUG COINS (SC) AM DUELLENDE (v1381)
//
//  Alles, was die SC-Belohnungen eines Duells ausmacht, lebt HIER.
//  server.js ruft nur:
//    • createScRewards({ db, uuidv4, getActiveDaily })  einmal beim Laden
//    • sc.evaluate(room, winnerIdx, reason)              Katalog-Belohnungen
//    • sc.awardDailyChallengeBonus(room, winnerIdx, reason)
//    • isCpuUserId / cpuOpponentKey                      in setupGameState
//    • ensureScSchema(db)                                in initDatabase
//    • noteSetGame(room, winnerIdx)                      in endGame, VOR
//                                                        dem Satzstand-++
//    • room._scCpuVorSiege (Promise)                     in endCpuBattle
//
//  BEDINGUNGS-ERGEBNIS: false/true wie gehabt — oder (v1383)
//    • eine Zahl       → variable Auszahlung statt `amount` (On Fire)
//    • { key, amount } → Auszahlung „je Schlüssel": gebucht wird unter
//                        `<id>:<key>`, das Limit gilt je Schlüssel, der
//                        Toast zeigt „Titel (key)" (Archetypal)
//
//  NEUE KATEGORIE = ein Eintrag in `data/sc-rewards.json` plus (falls
//  die Bedingung neu ist) EINE Funktion in `CONDITIONS` unten. Fehlt die
//  Funktion oder das Limit, meldet `validateCatalog` das beim Serverstart
//  laut im Log — die Kategorie wird dann übersprungen, nie still falsch.
//
//  Katalog-Felder:
//    id, title, description   sichtbar (ENGLISCH, Spielregel)
//    amount                   SC je Auszahlung
//    limit                    Schlüssel in `LIMITS`
//    requires                 Schlüssel in `CONDITIONS`
//    onDisconnectWin          true = gibt es auch bei Sieg durch
//                             Verbindungsabbruch (bisher nur „Player")
//
//  GEGNER-SCHLÜSSEL: `gs._playerIPs[pi]` ist der Schlüssel, unter dem
//  ein Spieler als „Gegner" zählt (Spalte `opponent_ip` in `sc_log`).
//  Menschen: ihre IP. CPUs: `cpu:<Deck-ID>` — jede CPU ist ein eigener
//  Gegner (Als Vorgabe 24.9.), für „einmal je Gegner" und Socialite.
//
//  KEINE TAGESKAPPE MEHR (v1384, Als Vorgabe 24.9.): die frühere Grenze
//  von 15 SC je Gegner und Tag ist entfallen; im Gegenzug kosten alle
//  Shop-Artikel das Fünffache. Es gelten nur noch die Limits der
//  einzelnen Kategorien.
//
//  CPU-PARTIEN (Als Vorgabe 24.9.): offen für ALLE Belohnungen außer
//  Ranked (gegen CPUs gibt es kein Ranked). Die CPU selbst hat kein
//  Konto und wird nie ausgewertet — bis v1380 lief sie mit, ihr Insert
//  in `sc_log` scheiterte und riss die Auszahlungsliste des Menschen mit.
// ═══════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, 'data', 'sc-rewards.json');

const MIN_GAME_DURATION_MS = 3 * 60 * 1000;  // 3 Minuten
const MIN_TURNS = 4;                         // jede Seite 2 Züge
const MIN_CARDS_PLAYED = 3;                  // je Seite aus der Hand

// ── Wer ist ein Konto? ──────────────────────────────────────────
// CPU-Gegner: `cpu-sp-<raum>` (createCpuBattle). Cube-Bots: `bot:<…>`.
// Beide haben eine userId, aber keine Zeile in `users`.
function isCpuUserId(id) {
  return typeof id === 'string' && id.startsWith('cpu-');
}
function isBotUserId(id) {
  return typeof id === 'string' && id.startsWith('bot:');
}
function isAccountPlayer(ps) {
  return !!ps?.userId && !isCpuUserId(ps.userId) && !isBotUserId(ps.userId);
}
/** Gegner-Schlüssel einer CPU — je Gegnerdeck einer. */
function cpuOpponentKey(deckId) {
  return 'cpu:' + (deckId || 'unknown');
}

/** Tagesbeginn (UTC, Unix-Sekunden) — wie bisher. */
function dayStartSec(nowMs = Date.now()) {
  const s = Math.floor(nowMs / 1000);
  return s - (s % 86400);
}

// ── Anti-Farm-Riegel (EINE Stelle für Katalog + Daily Challenge) ──
/**
 * @returns {string|null} Grund der Ablehnung, oder null = zulässig
 */
function antiFarmRejection(gs, reason, nowMs = Date.now()) {
  const k0 = gs._playerIPs?.[0] || 'unknown';
  const k1 = gs._playerIPs?.[1] || 'unknown';
  if (k0 !== 'unknown' && k0 === k1) return 'same_ip';
  const dauer = nowMs - (gs._gameStartTime || nowMs);
  if (dauer < MIN_GAME_DURATION_MS) return 'too_short';
  if ((gs.turn || 0) < MIN_TURNS) return 'too_few_turns';
  const tr = gs._scTracking || [{}, {}];
  if ((tr[0]?.cardsPlayedFromHand || 0) < MIN_CARDS_PLAYED) return 'too_few_cards';
  if ((tr[1]?.cardsPlayedFromHand || 0) < MIN_CARDS_PLAYED) return 'too_few_cards';
  // Aufgabe, bevor irgendein Held Schaden hatte → nichts.
  if (reason === 'surrender') {
    const anyDamage = gs.players.some(ps => (ps.heroes || []).some(h => h.name && h.hp < h.maxHp));
    if (!anyDamage) return 'surrender_undamaged';
  }
  return null;
}

// ── Endzustands-Lesehilfen ──────────────────────────────────────
const benannteHelden = (ps) => (ps.heroes || []).filter(h => h?.name);
const hpSumme = (ps) => benannteHelden(ps).reduce((s, h) => s + Math.max(0, h.hp || 0), 0);

/** Alle Ability Zones aller Helden (lebend UND besiegt) mit ≥ minStufe Karten. */
function alleAbilityZonen(ps, minStufe) {
  let gesehen = false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!ps.heroes[hi]?.name) continue;
    gesehen = true;
    const abZ = ps.abilityZones?.[hi] || [];
    for (let z = 0; z < 3; z++) {
      if ((abZ[z] || []).length < minStufe) return false;
    }
  }
  return gesehen;
}

/** Belegte Support Zones am Ende — alle Helden, Island Zones eingeschlossen. */
function belegteSupportZonen(ps) {
  let n = 0;
  for (const zonen of (ps.supportZones || [])) {
    for (const slot of (zonen || [])) {
      if (Array.isArray(slot) ? slot.length > 0 : !!slot) n++;
    }
  }
  return n;
}

// ═══════════════════════════════════════════════════════════════
//  BEDINGUNGEN — Schlüssel = `requires` im Katalog
//  Kontext `c`: { db, gs, room, pi, ps, opp, isWinner, reason, t,
//  tracking, turn, durationMs, isRanked, oppKey, todayStart, serie,
//  serieGesamt, cardDB }
//  Darf async sein. Zustands-Kategorien lesen das Brett am ENDE
//  (Als Ruling 24.9.).
// ═══════════════════════════════════════════════════════════════
const CONDITIONS = {
  play: () => true,
  win: (c) => c.isWinner,
  win_ranked: (c) => c.isWinner && c.isRanked,

  win_all_heroes_alive: (c) => {
    if (!c.isWinner) return false;
    if (!benannteHelden(c.ps).every(h => h.hp > 0)) return false;
    // Bei Aufgabe nur, wenn der Gegner schon ≥ 1 Helden verloren hat
    // und mindestens Zug 5 erreicht ist.
    if (c.reason === 'surrender') {
      const oppDead = benannteHelden(c.opp).filter(h => h.hp <= 0).length;
      return oppDead >= 1 && c.turn >= 5;
    }
    return true;
  },

  win_last_hero_low: (c) => {
    if (!c.isWinner) return false;
    const alive = benannteHelden(c.ps).filter(h => h.hp > 0);
    return alive.length === 1 && alive[0].hp < alive[0].maxHp * 0.5;
  },

  // Jeder Deck-out zählt, auch ein selbst verursachter (Als Ruling 24.9.).
  win_deck_out: (c) => c.isWinner && c.reason === 'deck_out',

  // Endzustand (Als Ruling 24.9.). Island Zones zählen mit — daher „9+".
  win_support_full: (c) => c.isWinner && belegteSupportZonen(c.ps) >= 9,

  // Jeder Einzeltreffer, Kreaturen eingeschlossen (Als Ruling 24.9.).
  damage_instance_400: (c) => (c.t.maxDamageInstance || 0) >= 400,

  gold_earned_99: (c) => (c.t.totalGoldEarned || 0) >= 99,

  win_comeback: (c) => c.isWinner && !!c.t.wasFirstToOneHero,

  // Laufendes Flag (jeder HP-Verlust, auch Opfer/Insta-Kill) PLUS ein
  // Blick aufs Ende als Netz für HP-Setzungen außerhalb der Pfade.
  win_flawless: (c) => c.isWinner
    && !c.t.heroEverBelow50
    && benannteHelden(c.ps).every(h => h.hp > h.maxHp * 0.5),

  creature_overkill: (c) => !!c.t.creatureOverkill,

  // Endzustand (Als Ruling 24.9.).
  all_abilities_filled: (c) => alleAbilityZonen(c.ps, 1),
  all_abilities_level3: (c) => alleAbilityZonen(c.ps, 3),

  win_turn_30: (c) => c.isWinner && c.turn >= 30,
  win_speedrun: (c) => c.isWinner && c.turn <= 6 && c.reason !== 'surrender',

  // Verschiedene Gegner-Schlüssel heute (jede CPU zählt einzeln).
  unique_opponents_5: async (c) => {
    const heute = await c.db.get(
      `SELECT COUNT(DISTINCT opponent_ip) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND created_at >= ?`,
      [c.ps.userId, c.todayStart]);
    const dieserSchonDa = await c.db.get(
      `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'player' AND opponent_ip = ? AND created_at >= ?`,
      [c.ps.userId, c.oppKey, c.todayStart]);
    const gesamt = (heute?.cnt || 0) + ((dieserSchonDa?.cnt || 0) === 0 ? 1 : 0);
    return gesamt >= 5;
  },

  first_win: async (c) => {
    if (!c.isWinner) return false;
    const prev = await c.db.get(
      `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = 'first_blood'`,
      [c.ps.userId]);
    return (prev?.cnt || 0) === 0;
  },

  // ── v1382 ──────────────────────────────────────────────────────
  // Besiegen zählt nach der Coreling-Regel (Quelle gehört mir, Opfer der
  // Gegenseite; Status-Ticks und eigene Opfer nicht). Beide Kill-Stufen
  // zahlen unabhängig: ein Triple Kill bringt auch den Double Kill.
  hero_kills_turn_2: (c) => (c.t.maxHeroKillsInTurn || 0) >= 2,
  hero_kills_turn_3: (c) => (c.t.maxHeroKillsInTurn || 0) >= 3,

  win_after_ascension: (c) => c.isWinner && !!c.t.ascended,

  // Nur Karten vom Typ Spell; Double Spells decken beide Schulen ab.
  spell_schools_5: (c) => (c.t.spellSchools || []).length >= 5,

  surprises_3: (c) => (c.t.surprisesActivated || 0) >= 3,

  // Jeder Spieler mit mindestens einem Glied in der Kette.
  chain_4: (c) => (c.t.longestChain || 0) >= 4,

  // Helden und Kreaturen, Überheilung zählt mit.
  hp_restored_1000: (c) => (c.t.hpRestored || 0) >= 1000,

  creatures_defeated_10: (c) => (c.t.enemyCreaturesDefeated || 0) >= 10,

  potions_5: (c) => (c.t.potionsUsed || 0) >= 5,

  win_resourceful: (c) => c.isWinner && (c.t.cardsPlayedFromHand || 0) <= 12,

  // Satz-Kategorien: `room._scSetVerlauf` = Sieger jeder Partie des
  // laufenden Satzes (noteSetGame). Nur Best-of-3.
  set_clean_sweep: (c) => {
    const v = c.room?._scSetVerlauf || [];
    return c.isWinner && c.room?.format === 3 && v.length === 2 && v.every(w => w === c.pi);
  },
  set_reverse_sweep: (c) => {
    const v = c.room?._scSetVerlauf || [];
    return c.isWinner && c.room?.format === 3 && v.length === 3
      && v[0] !== c.pi && v[1] === c.pi && v[2] === c.pi;
  },

  // Elo VOR dieser Partie: aus gs.result.eloChanges (Satzende, dort schon
  // umgebucht), sonst unverändert aus der Datenbank.
  win_ranked_underdog: async (c) => {
    if (!c.isWinner || !c.isRanked || !isAccountPlayer(c.opp)) return false;
    const eloVorher = async (spieler) => {
      const e = (c.gs.result?.eloChanges || []).find(x => x.username === spieler.username);
      if (e && typeof e.oldElo === 'number') return e.oldElo;
      const row = await c.db.get('SELECT elo FROM users WHERE id = ?', [spieler.userId]);
      return Number(row?.elo ?? 1000);
    };
    return (await eloVorher(c.opp)) - (await eloVorher(c.ps)) >= 100;
  },

  // Erster Sieg gegen DIESE CPU überhaupt. Die Zahl der bisherigen Siege
  // liest endCpuBattle, BEVOR es npc_stats hochzählt (room._scCpuVorSiege).
  first_cpu_win: async (c) => {
    if (!c.isWinner || !String(c.oppKey).startsWith('cpu:')) return false;
    const vorher = await c.room?._scCpuVorSiege;
    return vorher === 0;
  },

  // Siegesserie HEUTE (Als Vorgabe 24.9.) — siehe `serieBuchen`.
  win_streak_3: (c) => c.isWinner && (c.serie || 0) >= 3,

  // ── v1383 (Als Kategorien 24.9.) ────────────────────────────────
  // Kein Sieg nötig. Zusatzaktion = jede Aktion außer der Main-Action
  // der eigenen Action Phase (Engine: `_sc-tracking.js`, `aktion`).
  no_additional_actions: (c) => !c.t.usedAdditionalAction,

  // Der Schaden, der den letzten Helden fällt, entspricht genau seinen
  // restlichen HP. Jeder Schaden zählt, auch Status (Als Ruling 24.9.).
  win_exact_final_kill: (c) => c.isWinner && c.reason === 'all_heroes_dead' && !!c.t.lastKillExact,

  // Mindestens 1 Schaden der richtigen Art, keiner einer anderen — auch
  // nicht an eigenen Zielen und nicht als Status-Schaden.
  win_only_spell_damage: (c) => c.isWinner && (c.t.dmgSpell || 0) > 0
    && !(c.t.dmgCreature > 0) && !(c.t.dmgOther > 0),
  win_only_creature_damage: (c) => c.isWinner && (c.t.dmgCreature || 0) > 0
    && !(c.t.dmgSpell > 0) && !(c.t.dmgOther > 0),

  // On Fire: +1 SC je volle 10 Siege in Folge (über alle Tage), max. +5.
  win_streak_bonus: (c) => {
    if (!c.isWinner) return false;
    const stufen = Math.floor((c.serieGesamt || 0) / 10);
    return stufen >= 1 ? Math.min(5, stufen) : false;
  },

  // 31+ Main-Deck-Karten eines Archetyps; gebucht je Archetyp.
  win_archetype_31: (c) => {
    if (!c.isWinner) return false;
    const deck = c.room?._currentDecks?.[c.pi]?.mainDeck || c.room?._originalDecks?.[c.pi]?.mainDeck || [];
    const db = c.cardDB || {};
    const zahl = {};
    for (const name of deck) {
      const a = db[name]?.archetype;
      if (a) zahl[a] = (zahl[a] || 0) + 1;
    }
    const best = Object.entries(zahl).sort((x, y) => y[1] - x[1])[0];
    return best && best[1] >= 31 ? { key: best[0] } : false;
  },

  win_low_deck: (c) => c.isWinner && (c.ps.mainDeck || []).length < 10,

  // Kein Sieg nötig (Als Ruling 24.9.): Summe ALLER eigenen Helden-HP am
  // Ende größer als bei Spielbeginn. Besiegte Helden zählen mit 0.
  hp_above_start: (c) => typeof c.t.startHpSumme === 'number'
    && hpSumme(c.ps) > c.t.startHpSumme,

  good_game: (c) => c.turn >= 7
    && c.durationMs >= 5 * 60 * 1000
    && (c.tracking[0]?.totalHpLost || 0) >= 400
    && (c.tracking[1]?.totalHpLost || 0) >= 400,
};

// ═══════════════════════════════════════════════════════════════
//  LIMITS — Schlüssel = `limit` im Katalog. true = darf ausgezahlt werden.
// ═══════════════════════════════════════════════════════════════
async function taeglichJeGegner(c, reward) {
  const prev = await c.db.get(
    `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND opponent_ip = ? AND created_at >= ?`,
    [c.ps.userId, reward.id, c.oppKey, c.todayStart]);
  return (prev?.cnt || 0) === 0;
}
const LIMITS = {
  daily_per_opponent: taeglichJeGegner,
  daily_per_opponent_ip: taeglichJeGegner,   // alter Name, gleiche Bedeutung
  daily: async (c, reward) => {
    const prev = await c.db.get(
      `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND created_at >= ?`,
      [c.ps.userId, reward.id, c.todayStart]);
    return (prev?.cnt || 0) === 0;
  },
  once: async (c, reward) => {
    const prev = await c.db.get(
      `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ?`,
      [c.ps.userId, reward.id]);
    return (prev?.cnt || 0) === 0;
  },
  // v1382 (First Conquest!): einmal je Gegner-Schlüssel, für immer.
  once_per_opponent: async (c, reward) => {
    const prev = await c.db.get(
      `SELECT COUNT(*) as cnt FROM sc_log WHERE user_id = ? AND reward_id = ? AND opponent_ip = ?`,
      [c.ps.userId, reward.id, c.oppKey]);
    return (prev?.cnt || 0) === 0;
  },
  unlimited: () => true,
};

// ═══════════════════════════════════════════════════════════════
//  SIEGESSERIE (Hot Streak, v1382)
//  Als Vorgabe 24.9.: nur Partien von HEUTE zählen; eine Serie von
//  gestern hilft heute nicht. Tag = derselbe UTC-Tag wie bei den
//  Tageslimits.
//    • Niederlage (jede, auch eine zu kurze Partie) → Serie 0
//    • Sieg, der die Anti-Farm-Riegel besteht → +1
//    • Sieg, der sie nicht besteht → Serie bleibt stehen
// ═══════════════════════════════════════════════════════════════
async function ensureScSchema(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS sc_streaks (
    user_id TEXT PRIMARY KEY,
    day INTEGER NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0,
    streak_total INTEGER NOT NULL DEFAULT 0
  )`);
  // v1383 (On Fire): Serie über alle Tage. Für Tabellen aus v1382 nachrüsten.
  try {
    await db.execute('ALTER TABLE sc_streaks ADD COLUMN streak_total INTEGER NOT NULL DEFAULT 0');
  } catch { /* Spalte existiert schon */ }
}

/**
 * Beide Serien in einem Zug buchen.
 * @returns {{ heute: number, gesamt: number }}
 */
async function serieBuchen(db, userId, heute, ergebnis) {
  const row = await db.get('SELECT day, streak, streak_total FROM sc_streaks WHERE user_id = ?', [userId]);
  let serie = (row && Number(row.day) === heute) ? Number(row.streak || 0) : 0;
  let gesamt = Number(row?.streak_total || 0);
  if (ergebnis === 'niederlage') { serie = 0; gesamt = 0; }
  else if (ergebnis === 'sieg') { serie += 1; gesamt += 1; }
  await db.run(
    `INSERT INTO sc_streaks (user_id, day, streak, streak_total) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, streak = excluded.streak, streak_total = excluded.streak_total`,
    [userId, heute, serie, gesamt]);
  return { heute: serie, gesamt };
}

/**
 * Satzverlauf mitschreiben (Clean/Reverse Sweep). Aufruf in endGame
 * VOR `room.setScore[winnerIdx]++` — steht der Satz da noch auf 0:0,
 * beginnt ein neuer.
 */
function noteSetGame(room, winnerIdx) {
  if (!room) return;
  const s = room.setScore || [0, 0];
  if ((s[0] || 0) + (s[1] || 0) === 0 || !Array.isArray(room._scSetVerlauf)) room._scSetVerlauf = [];
  room._scSetVerlauf.push(winnerIdx);
}

// ── Katalog laden und prüfen ────────────────────────────────────
/** @returns {string[]} gefundene Probleme (leer = alles gut) */
function validateCatalog(catalog) {
  const probleme = [];
  if (!Array.isArray(catalog)) return ['sc-rewards.json ist kein Array'];
  const ids = new Set();
  for (const r of catalog) {
    const wer = r?.id || JSON.stringify(r);
    if (!r?.id) probleme.push(`Eintrag ohne id: ${wer}`);
    else if (ids.has(r.id)) probleme.push(`doppelte id: ${r.id}`);
    ids.add(r?.id);
    if (typeof r?.title !== 'string' || !r.title) probleme.push(`${wer}: title fehlt`);
    if (typeof r?.description !== 'string' || !r.description) probleme.push(`${wer}: description fehlt`);
    if (!Number.isInteger(r?.amount) || r.amount <= 0) probleme.push(`${wer}: amount muss eine positive Ganzzahl sein`);
    if (!CONDITIONS[r?.requires]) probleme.push(`${wer}: unbekannte Bedingung requires="${r?.requires}"`);
    if (!LIMITS[r?.limit]) probleme.push(`${wer}: unbekanntes limit="${r?.limit}"`);
  }
  return probleme;
}

function loadCatalog(file = CATALOG_PATH) {
  const catalog = JSON.parse(fs.readFileSync(file, 'utf-8'));
  for (const p of validateCatalog(catalog)) console.error('[SC] Katalogfehler:', p);
  return catalog;
}

// ═══════════════════════════════════════════════════════════════
//  FABRIK
// ═══════════════════════════════════════════════════════════════
function createScRewards({ db, uuidv4, getActiveDaily, getCardDB, catalog = loadCatalog(), now = () => Date.now() }) {
  // Karten nach Name (Archetypal). Vom Server gereicht, sonst selbst geladen.
  let eigeneDB = null;
  const kartenDB = () => {
    if (getCardDB) return getCardDB();
    if (!eigeneDB) {
      eigeneDB = {};
      for (const k of JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'cards.json'), 'utf-8'))) eigeneDB[k.name] = k;
    }
    return eigeneDB;
  };

  /**
   * Katalog-Belohnungen für beide Seiten auswerten und buchen.
   * @returns {Promise<Object<number,{rewards:Array,total:number}>>}
   */
  async function evaluate(room, winnerIdx, reason) {
    const gs = room?.gameState;
    if (!gs) return {};
    const nowMs = now();
    const todayStart = dayStartSec(nowMs);
    const abgelehnt = antiFarmRejection(gs, reason, nowMs);

    // Hot Streak zuerst buchen — auch Partien, die keine SC bringen,
    // beenden eine Serie (Niederlage) oder lassen sie stehen.
    const serien = {};
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      if (!isAccountPlayer(ps)) continue;
      const ergebnis = pi !== winnerIdx ? 'niederlage' : (abgelehnt ? 'neutral' : 'sieg');
      try { serien[pi] = await serieBuchen(db, ps.userId, todayStart, ergebnis); }
      catch (err) { console.error('[SC] Serie:', err.message); serien[pi] = { heute: 0, gesamt: 0 }; }
    }

    if (abgelehnt) return {};

    const tracking = gs._scTracking || [{}, {}];
    const isDisconnectWin = reason === 'disconnect_timeout';
    const results = {};

    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      if (!isAccountPlayer(ps)) continue;   // CPU / Cube-Bot: kein Konto
      const oi = pi === 0 ? 1 : 0;
      const opp = gs.players[oi];
      const c = {
        db, gs, room, pi, ps, opp, reason, tracking, todayStart,
        isWinner: pi === winnerIdx,
        t: tracking[pi] || {},
        turn: gs.turn || 0,
        durationMs: nowMs - (gs._gameStartTime || nowMs),
        isRanked: room.type === 'ranked',
        oppKey: gs._playerIPs?.[oi] || 'unknown',
        serie: serien[pi]?.heute || 0,
        serieGesamt: serien[pi]?.gesamt || 0,
        cardDB: kartenDB(),
      };

      const earned = [];
      for (const reward of catalog) {
        if (isDisconnectWin && !reward.onDisconnectWin) continue;
        const bedingung = CONDITIONS[reward.requires];
        const limit = LIMITS[reward.limit];
        if (!bedingung || !limit) continue;             // beim Start gemeldet
        const erg = await bedingung(c);
        if (!erg) continue;
        // v1383: Ergebnis kann die Höhe (Zahl) oder einen Schlüssel liefern.
        const key = (erg && typeof erg === 'object' && erg.key != null) ? String(erg.key) : null;
        const betrag = typeof erg === 'number' ? erg
          : (erg && typeof erg === 'object' && Number.isInteger(erg.amount)) ? erg.amount
          : reward.amount;
        if (!(betrag > 0)) continue;
        const gebucht = key ? { ...reward, id: `${reward.id}:${key}`, title: `${reward.title} (${key})` } : reward;
        if (!(await limit(c, gebucht))) continue;
        earned.push({ id: gebucht.id, title: gebucht.title, amount: betrag, description: reward.description });
      }

      if (earned.length === 0) continue;
      // CPU-Gegner als stabile Kennung statt der Raum-ID.
      const oppId = isAccountPlayer(opp) ? opp.userId : c.oppKey;
      let total = 0;
      for (const r of earned) {
        await db.run(
          'INSERT INTO sc_log (id, user_id, reward_id, opponent_id, opponent_ip, amount) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), ps.userId, r.id, oppId, c.oppKey, r.amount]);
        total += r.amount;
      }
      await db.run('UPDATE users SET sc = sc + ? WHERE id = ?', [total, ps.userId]);
      results[pi] = { rewards: earned, total };
    }
    return results;
  }

  /**
   * Daily-Challenge-Bonus für den Sieger: 2+ seiner Tages-Helden im Deck.
   * Groß (10 SC für 2, 20 SC für 3) einmal je Challenge, danach 1 SC je
   * weiterem Sieg. Seit v1381 auch gegen CPUs (Als Vorgabe 24.9.: alle
   * Belohnungen außer Ranked).
   */
  async function awardDailyChallengeBonus(room, winnerIdx, reason) {
    const gs = room?.gameState;
    if (!gs) return null;
    const winner = gs.players?.[winnerIdx];
    if (!isAccountPlayer(winner)) return null;
    if (reason === 'disconnect_timeout') return null;
    if (antiFarmRejection(gs, reason, now())) return null;

    const userRow = await db.get(
      'SELECT daily_heroes, daily_start_ts, daily_claimed_big FROM users WHERE id = ?',
      [winner.userId]);
    const active = getActiveDaily(userRow);
    if (!active) return null;

    const namen = new Set(benannteHelden(winner).map(h => h.name));
    const matched = active.heroes.filter(n => namen.has(n)).length;
    if (matched < 2) return null;

    let amount = 1;
    let newClaimed = active.claimedBig;
    if (active.claimedBig === 0) {
      amount = matched >= 3 ? 20 : 10;
      newClaimed = amount;
    }
    await db.run('UPDATE users SET sc = sc + ?, daily_claimed_big = ? WHERE id = ?',
      [amount, newClaimed, winner.userId]);
    return {
      matched, amount, claimedBig: newClaimed,
      title: matched >= 3
        ? 'Daily Challenge — 3/3 Heroes!'
        : (active.claimedBig === 0 ? 'Daily Challenge — 2 Heroes' : 'Daily Challenge — repeat win'),
      description: `${matched} of your 3 daily Heroes`,
    };
  }

  /**
   * Beides zusammen, als EIN Paket je Spieler (ein kombinierter Toast).
   */
  async function evaluateWithDailyBonus(room, winnerIdx, reason) {
    const results = await evaluate(room, winnerIdx, reason);
    try {
      const bonus = await awardDailyChallengeBonus(room, winnerIdx, reason);
      if (bonus) {
        const entry = results[winnerIdx] || { rewards: [], total: 0 };
        entry.rewards.push({ id: 'daily_challenge', title: bonus.title, amount: bonus.amount, description: bonus.description });
        entry.total += bonus.amount;
        results[winnerIdx] = entry;
      }
    } catch (err) {
      console.error('[Daily] bonus error:', err.message);
    }
    return results;
  }

  return { evaluate, awardDailyChallengeBonus, evaluateWithDailyBonus, catalog };
}

module.exports = {
  createScRewards,
  ensureScSchema,
  noteSetGame,
  validateCatalog,
  isCpuUserId,
  isAccountPlayer,
  cpuOpponentKey,
  CONDITIONS,
  LIMITS,
};
