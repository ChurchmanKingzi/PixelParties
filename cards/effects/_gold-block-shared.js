'use strict';
// ═══════════════════════════════════════════════════════════════════
//  GOLD-SPERRE — die eine Auslegungsstelle für "Tuscan Aristocrat"
//
//  > **Tuscan Aristocrat** (Creature): *"While you control this
//  > Creature, your opponent cannot gain any Gold outside their
//  > Resource Phase."*
//
//  Schwestermodul zu `_draw-block-shared.js`, gleiches Muster und
//  gleiche Begründung.
//
//  ── WAS DIESES MODUL TUT UND WAS NICHT ────────────────────────────
//  Die NEGATION selbst braucht es nicht: Aristocrat hängt im
//  `onResourceGain`-Hook und bricht den Gewinn zentral ab. Das erfasst
//  jeden Gold-Gewinn im Spiel, auch künftige Karten, ohne dass eine
//  davon angefasst werden müsste.
//
//  Dieses Modul ist nur für das AUSGRAUEN da. Al (17.8.), analog zum
//  Ruling für Tuscan Artist: **eine Karte, deren einziger Nutzen ein
//  Gold-Gewinn ist, wird gesperrt statt wirkungslos zu feuern** —
//  Treasure Chest, Golden Bananas, War Chest, Tears of Creation. Ein
//  aktiver Effekt, der nur Gold bringt, ist nicht aktivierbar und
//  verbraucht dann auch sein Once-per-turn NICHT.
//
//  ── DER PHASEN-TEST ───────────────────────────────────────────────
//  Aristocrat sperrt nur AUSSERHALB der Resource Phase des Gewinners
//  (Als Ruling 16.8.: Phasen-Test, kein Effekt-Test). Praktisch heißt
//  das für Handkarten "immer", weil man in der Resource Phase gar
//  nichts spielt — aber der Helfer prüft die Phase trotzdem, damit er
//  die Karte wörtlich abbildet und nicht nur ihren Normalfall.
//
//  Ausdrücklich NICHT betroffen (Als Vorgabe): "Wealth" und "Treasure
//  Huntress Semi" erhöhen den Gewinn INNERHALB der Resource Phase.
//
//  ── ABGRENZUNG ────────────────────────────────────────────────────
//  Karten, bei denen Gold nur ein Nebenertrag ist, bleiben spielbar
//  und verlieren lediglich das Gold — Goldify (besiegt eine Creature
//  und kann eine Zusatzaktion sein), Archer of Teocuilatl, Golden
//  Arrow, Loyal Beagle, Splashy Slime und rund zwanzig weitere.
//  Sie brauchen hier nichts.
// ═══════════════════════════════════════════════════════════════════

const { PHASES } = require('./_hooks');

const BLOCKER_NAME = 'Tuscan Aristocrat';

/**
 * Kontrolliert der Gegner von `playerIdx` einen aktiven Aristocrat?
 * Prüft dieselben Stilllegungen wie der Hook-Verteiler der Engine,
 * damit eine ausgeschaltete Kreatur auch hier nicht mehr sperrt.
 */
function blockerAufDemBrett(engine, playerIdx) {
  const gegnerIdx = playerIdx === 0 ? 1 : 0;
  for (const inst of (engine?.cardInstances || [])) {
    if (inst.name !== BLOCKER_NAME) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    // Kontrolle, nicht Besitz — eine gestohlene Kopie wirkt für den,
    // der sie gerade kontrolliert.
    if ((inst.controller ?? inst.owner) !== gegnerIdx) continue;
    const c = inst.counters || {};
    if (c.negated || c.nulled || c.stunned || c.magic_silenced) continue;
    if (c.frozen && !engine._isChillyDogActiveFor?.(gegnerIdx)) continue;
    return true;
  }
  return false;
}

/**
 * DIE Frage für Kartenskripte: würde ein Gold-Gewinn für `playerIdx`
 * gerade abgebrochen?
 *
 * Nutzung im Gate einer Karte, deren Gold ihr einziger Nutzen ist:
 *
 *     const { goldGainWouldBeBlocked } = require('./_gold-block-shared');
 *     canActivate(gs, pi, engine) {
 *       return !goldGainWouldBeBlocked(engine, pi);
 *     },
 *
 * @param {object} engine
 * @param {number} playerIdx  Der GEWINNENDE Spieler
 */
function goldGainWouldBeBlocked(engine, playerIdx) {
  if (!engine || playerIdx == null) return false;
  // Die eigene Resource Phase bleibt frei — dort greift Aristocrat nicht.
  const gs = engine.gs || {};
  if (gs.currentPhase === PHASES.RESOURCE && gs.activePlayer === playerIdx) return false;
  return blockerAufDemBrett(engine, playerIdx);
}

module.exports = {
  BLOCKER_NAME,
  blockerAufDemBrett,
  goldGainWouldBeBlocked,
};
