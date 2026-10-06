'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — ZENTRALE REGEL- UND BALANCE-KONSTANTEN
//
//  Alles, was man am Modus später drehen will, steht HIER (und in
//  `skilltestLegal` in data/cards.json für den Kartenpool). Server,
//  Bots und Client lesen dieselben Werte; nichts davon ist in der
//  Engine verstreut.
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,

  // ── Vorbereitung ───────────────────────────────────────────────
  HAND_SIZE: 18,
  // Semi-fixe Raten der Startkarten (Spieler-Vorgabe 6.10.): Heroes 3–5,
  // Abilities 1–5, Creatures 4–12, der Rest verteilt sich auf Artifacts,
  // Potions und Attacks/Spells. Ascended Heroes: nie.
  HAND_RATES: {
    heroes:    [3, 5],
    abilities: [1, 5],
    creatures: [4, 12],
  },
  // Mindestzahl „Rest"-Karten (Artifacts/Potions/Attacks/Spells), damit
  // 5 + 5 + 12 = 22 > 18 nicht möglich ist: die Stichprobe der drei
  // Bereiche wird so lange gekürzt, bis mindestens so viel übrig bleibt.
  MIN_REST_CARDS: 3,
  // Gewichte der Rest-Verteilung. `AttackSpell` zieht gleichverteilt aus
  // der Vereinigung beider Kartentypen (= überwiegend Spells).
  REST_WEIGHTS: { Artifact: 30, Potion: 12, AttackSpell: 58 },

  // ── Recycler ───────────────────────────────────────────────────
  RECYCLE_EVERY: 2,          // nach jeder 2. eingeworfenen Karte kommt eine neue
  RECYCLE_GOLD: 4,           // +Gold je eingeworfener Karte
  // Typ-Gewichte für die Recycler-Ausgabe. `null` = reiner Zufall über
  // den verbleibenden Pool (Spieler-Vorgabe: „zufällige neue Karte").
  RECYCLER_TYPE_WEIGHTS: null,

  // ── Timer (Defaults; im Raum-Dialog änderbar / abschaltbar) ─────
  DEFAULT_PREP_TIMER_SEC: 300,
  DEFAULT_TURN_TIMER_SEC: 90,
  PREP_TIMER_RANGE: [30, 1800],
  TURN_TIMER_RANGE: [15, 600],

  // Start-Gold: ein Resource-Tick am Spielbeginn (+4 plus Boni wie Wealth).
  START_GOLD_TICK: 4,

  // ── Belohnungen (SC) ───────────────────────────────────────────
  SC_PER_ROUND: 1,
  SC_PER_OUTLASTED_PLAYER: 5,
  SC_WIN_BONUS: 5,
};

// Karten, die der Modus grundsätzlich NIE verwendet — unabhängig vom
// Feld `skilltestLegal` (Sicherheitsnetz: selbst ein versehentlich auf
// true gesetzter Eintrag gelangt nicht in den Pool).
const HARD_EXCLUDED_TYPES = new Set(['Ascended Hero', 'Token', 'Creature/Token']);

// Ausnahmen, mit denen `skilltestLegal` initial auf false gesetzt wird.
// Danach wird das Feld per Hand in cards.json kuratiert — das Skript
// scripts/set-skilltest-legal.js überschreibt vorhandene Werte NIE.
const INITIAL_ILLEGAL_NAMES = new Set([
  'Divinity',                  // nur als Start-Ability (s. START_ABILITY_BAN_EXEMPT)
  'Performance',
  'Attack',                    // der Basisangriff ist im Modus ein virtueller Klick-Angriff
  'Flying Island in the Sky',  // Layout-Probleme bei 8 Spielern
]);

// Start-Abilities ignorieren die Pool-Sperre (z. B. Zhigao startet mit
// Divinity ×2). Sie sind keine „existierenden Karten" im Sinn der
// Einmaligkeitsregel.
const START_ABILITY_BAN_EXEMPT = true;

module.exports = {
  CONFIG, HARD_EXCLUDED_TYPES, INITIAL_ILLEGAL_NAMES, START_ABILITY_BAN_EXEMPT,
};
