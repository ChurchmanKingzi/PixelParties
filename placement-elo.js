'use strict';
// ═══════════════════════════════════════════════════════════════════
//  PLATZIERUNGS-ELO (Ranked-Draft und Ranked-Skill-Test)
//
//  Beide Modi buchen auf die NORMALE Ranked-`elo` (keine eigene Wertung je
//  Modus), und zwar nach der Platzierung unter den MENSCHEN:
//  Platz 1 → +K, letzter Platz → −K, dazwischen linear.
//  CPUs/Bots zählen nicht mit; ein Raum mit nur einem Menschen wird nicht
//  gewertet (sonst ließe sich gegen CPUs Elo farmen).
// ═══════════════════════════════════════════════════════════════════

const K = 24;

/** Elo-Änderung für `rank` (1-basiert) unter `n` Menschen. Gleicher Rang → gleiche Änderung. */
function placementDelta(rank, n) {
  const norm = Math.max(0, Math.min(1, (n - rank) / Math.max(1, n - 1)));   // 1.0 für Platz 1, 0.0 für den Letzten
  return Math.round(K * (norm - 0.5) * 2);                                  // −K … +K
}

module.exports = { K, placementDelta };
