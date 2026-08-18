// ═══════════════════════════════════════════
//  SHARED HELPER: Trials-Archetyp
//
//  Sechs Karten, eine gemeinsame Regelhuelle. Vor v481 lag alles
//  doppelt in `trial-of-coolness.js` und `trial-of-dominance.js` —
//  mit `The Final Trial` waere daraus dreifach geworden, denn der
//  MUSS die Once-per-Game-Schluessel ALLER fuenf Pruefungen kennen.
//  Zwei Orte fuer dieselbe Liste sind eine Driftfalle; hier ist die
//  einzige Wahrheit.
//
//  ── Die fuenf Pruefungen (alle Spell, Normal, Lv1, Archetyp
//     „Trials", alle 1x pro Spiel) ──
//    Trial of Annoyance  (Decay Magic)       — Gegner wirft auf 2 ab
//    Trial of Coolness   (Summoning Magic)   — Extra Life
//    Trial of Dominance  (Destruction Magic) — Gegnerbrett wischen
//    Trial of Knowledge  (Magic Arts)        — Trial-Stufen auf 0
//    Trial of Loyalty    (Support Magic)     — bis zu 5 Trials suchen
//
//  Dazu `The Final Trial` (Attack, Fighting Lv0): keine Pruefung,
//  sondern die Belohnung — wer alle fuenf gespielt hat, gewinnt.
//
//  ── Zwei Regeln, die JEDE der fuenf teilt ──
//
//  1. EINMAL PRO SPIEL, je Karte einzeln. Der Text sagt „You can
//     only play 1 <Name> per game", nicht „1 Trial per game" — die
//     Schluessel sind deshalb pro Karte verschieden. Gespeichert in
//     `ps._oncePerGameUsed` (Set), vom Server beim Ausspielen
//     gestempelt. Genau dieses Set liest `The Final Trial` als
//     „habe ich diese Pruefung dieses Spiel gespielt?"
//
//  2. DER SYMMETRISCHE RIEGEL. „You cannot play other Attacks or
//     Spells the turn you play this card" wirkt in BEIDE Richtungen:
//     davor ueber `spellPlayCondition` (schon ein Attack/Spell
//     gelaufen → nicht spielbar), danach ueber
//     `ps._attackSpellLockedTurn = gs.turn`, das die Engine in
//     `validateActionPlay` abfragt. Der Riegel wird auch dann
//     gestempelt, wenn der Effekt ins Leere lief — die Pruefung war
//     trotzdem abgelegt.
//     ★ `The Final Trial` traegt diesen Riegel NICHT: sein Text
//     nennt ihn nicht, er hat stattdessen die Erste-Aktion-Bedingung.
// ═══════════════════════════════════════════

/**
 * Kartenname → Once-per-Game-Schluessel. Muss mit dem
 * `oncePerGameKey` im jeweiligen Kartenmodul uebereinstimmen; die
 * Module lesen ihren Schluessel von hier, damit das nicht auseinander
 * laufen kann.
 */
const TRIAL_KEYS = {
  'Trial of Annoyance': 'trialOfAnnoyance',
  'Trial of Coolness': 'trialOfCoolness',
  'Trial of Dominance': 'trialOfDominance',
  'Trial of Knowledge': 'trialOfKnowledge',
  'Trial of Loyalty': 'trialOfLoyalty',
};

/** Die fuenf Pruefungen in Textreihenfolge von „The Final Trial". */
const TRIAL_NAMES = [
  'Trial of Dominance',
  'Trial of Loyalty',
  'Trial of Knowledge',
  'Trial of Annoyance',
  'Trial of Coolness',
];

const FINAL_TRIAL_NAME = 'The Final Trial';

/**
 * Traegt die Karte einen „Trial of"-Namen? Namensbezuege zaehlen in
 * diesem Spiel woertlich und mit Gross-/Kleinschreibung (siehe
 * `_drago-shared.js`), deshalb Praefix statt Archetyp: der Text von
 * Trial of Knowledge sagt „all \"Trial of\" Spells", nicht „all
 * Trials". `The Final Trial` faellt damit korrekt heraus — er
 * gehoert zum Archetyp, traegt den Namensteil aber nicht.
 */
function isTrialOfName(cardName) {
  return String(cardName || '').startsWith('Trial of ');
}

/** „Trial of"-Karte UND Spell? (Knowledge zaehlt nur Spells.) */
function isTrialOfSpell(cardData) {
  return !!cardData && cardData.cardType === 'Spell' && isTrialOfName(cardData.name);
}

/**
 * Hat `pi` diese Pruefung in diesem Spiel schon gespielt?
 * Liest das Once-per-Game-Set, das der Server beim Ausspielen fuellt.
 */
function hasPlayedTrial(ps, trialName) {
  const key = TRIAL_KEYS[trialName];
  if (!key) return false;
  return !!ps?._oncePerGameUsed?.has(key);
}

/** Welche der fuenf Pruefungen fehlen `pi` noch? */
function missingTrials(ps) {
  return TRIAL_NAMES.filter(n => !hasPlayedTrial(ps, n));
}

/**
 * Der VORDERE Teil des symmetrischen Riegels: darf `pi` gerade eine
 * Pruefung spielen? Nein, sobald diese Runde schon ein Attack oder
 * Spell gelaufen ist.
 */
function trialTurnIsClean(gs, pi) {
  const ps = gs?.players?.[pi];
  if (!ps) return false;
  if ((ps.attacksPlayedThisTurn || 0) > 0) return false;
  if ((ps.spellsPlayedThisTurn || 0) > 0) return false;
  return true;
}

/**
 * Der HINTERE Teil: nach dem Aufloesen keine weiteren Attacks/Spells
 * mehr diese Runde. Die Engine liest den Stempel in
 * `validateActionPlay`. Bewusst auch bei wirkungslosem Effekt setzen.
 */
function stampTrialLock(gs, pi) {
  const ps = gs?.players?.[pi];
  if (ps) ps._attackSpellLockedTurn = gs.turn;
}

module.exports = {
  TRIAL_KEYS,
  TRIAL_NAMES,
  FINAL_TRIAL_NAME,
  isTrialOfName,
  isTrialOfSpell,
  hasPlayedTrial,
  missingTrials,
  trialTurnIsClean,
  stampTrialLock,
};
