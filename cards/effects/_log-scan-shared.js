// ═══════════════════════════════════════════
//  SHARED: In-Flight-Schutz für actionLog-Scans
//
//  Kartenskripte, die "erster X diese Runde"-Bedingungen über einen
//  Scan des engine.actionLog prüfen (Fire Bolts, Kitsune
//  Transformation, Tengu Windstorm), verließen sich auf die Annahme,
//  dass der eigene spell_played-Eintrag beim Betreten von onPlay noch
//  NICHT im Log steht (er feuert normalerweise erst mit dem ersten
//  Prompt/Reveal). `maybeFireCpuRevealEarly` bricht diese Annahme für
//  LIVE-CPU-Plays: dort feuert der Eintrag VOR der Resolution, damit
//  die Ankündigung der Animation vorausläuft — der Scan sah die
//  eigene Karte und meldete fälschlich "war schon dran" (Als
//  Fire-Bolts-Report: 50 statt 200 Recoil trotz inhärentem Play;
//  MCTS-Rollouts überspringen das Early-Reveal und rechneten mit 200
//  — Simulation und Realität divergierten).
//
//  Lösung: Der Resolving-Spell-Stack (gs._resolvingSpellStack) kennt
//  alle Spells, die gerade in Resolution sind. Scans iterieren den
//  Log RÜCKWÄRTS und verrechnen die neuesten passenden Einträge gegen
//  dieses Multiset — was in-flight ist, zählt nicht als "früher
//  gespielt". Steht der eigene Log-Eintrag noch aus (_pendingPlayLog
//  nicht gefeuert — Normalfall bei Menschen-Plays), wird die pending-
//  Karte vorab aus dem Multiset entfernt, sonst würde der Eintrag
//  eines FRÜHEREN, bereits resolvedeten Casts derselben Karte
//  geschluckt (Zweitcast-Randfall).
// ═══════════════════════════════════════════

/**
 * Multiset der Spells, die in Resolution sind UND bereits einen
 * eigenen Log-Eintrag haben. Verwendung im Scan (rückwärts!):
 *   if (inFlight[entry.card] > 0) { inFlight[entry.card]--; continue; }
 */
function inFlightSpellMultiset(engine) {
  const m = Object.create(null);
  for (const nm of (engine.gs?._resolvingSpellStack || [])) {
    m[nm] = (m[nm] || 0) + 1;
  }
  const pendingCard = engine.gs?._pendingPlayLog?.data?.card;
  if (pendingCard && m[pendingCard] > 0) m[pendingCard]--;
  return m;
}

module.exports = { inFlightSpellMultiset };
