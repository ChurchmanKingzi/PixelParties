'use strict';
// ═══════════════════════════════════════════════════════════════════
//  ZIEH-SPERRE — die eine Auslegungsstelle für "Tuscan Artist"
//
//  > **Tuscan Artist** (Creature): *"While you control this Creature,
//  > any effect that would allow your opponent to draw 2 or 3 cards
//  > is negated."*
//
//  ALS RULINGS (16.8., verbindlich):
//   • GENAU 2 oder GENAU 3. Ein 1er-Zug und ein 4er-Zug laufen durch.
//   • Es wird NUR DAS ZIEHEN negiert, nicht die ganze Karte — es sei
//     denn, das Ziehen IST der ganze Nutzen (siehe unten).
//   • Das Potion Deck zählt genauso wie das Hauptdeck.
//   • Auch ein Zug aus dem GEGNERISCHEN Deck zählt ("Cell Escape").
//   • Ist der Zug der einzige Nutzen — auch wenn dafür Kosten anfallen
//     (Potion of Greed: "skip your Action Phase", Skeleton Mage:
//     "discard 1 afterwards") — dann ist die Karte bzw. der aktive
//     Effekt GESPERRT und wird ausgegraut. Ein Effekt, der so nicht
//     feuern kann, verbraucht auch sein Once-per-turn NICHT.
//   • "N Karten pro X" sind EINZELNE Instanzen von "ziehe N"
//     (Detection: 2 je entfernter Surprise). Jede davon wird für sich
//     geblockt — die Karte selbst bleibt spielbar, sie zieht nur nichts.
//
//  ── WARUM EIN GETEILTES MODUL ─────────────────────────────────────
//  Die Negation selbst braucht kein Kartenskript: sie hängt zentral
//  im `beforeDrawBatch`-Hook des Artists und erfasst damit ALLE 43
//  Karten des Pools automatisch, auch künftige.
//
//  Das AUSGRAUEN geht dagegen nicht generisch — der Server kann einer
//  Karte nicht ansehen, ob ihr Zug ihr einziger Nutzen ist. Die rund
//  zwölf betroffenen Karten fragen deshalb hier nach, mit EINER Zeile
//  in ihrem eigenen Gate. Diese Datei ist die einzige Stelle, an der
//  die Regel ausgelegt wird — kommt je eine zweite Sperrkarte dazu,
//  ändert sich nur `blockerAufDemBrett`.
//
//  ── ACHTUNG BEIM SCHREIBEN NEUER ZIEH-KARTEN ──────────────────────
//  Der Riegel sieht die Menge, die das Skript an `actionDrawCards`
//  übergibt — nicht die Zahl im Kartentext. Wer "ziehe 2" als zwei
//  Einzelzüge programmiert (nur wegen der Animation), umgeht ihn
//  versehentlich. `actionDrawCards` staffelt intern bereits, ein
//  eigener 1er-Loop ist also nie nötig. Gemessen am 16.8.: 25 von 27
//  Karten machten es richtig, Detection und Divine Zeal nicht — beide
//  in derselben Auslieferung auf die logische Menge gezogen.
// ═══════════════════════════════════════════════════════════════════

const BLOCKER_NAME = 'Tuscan Artist';
const MIN_BLOCKED = 2;
const MAX_BLOCKED = 3;

/**
 * Liegt bei `gegnerVon` eine aktive Sperrkarte, die gegen `playerIdx`
 * wirkt? Die Instanz muss in einer Support Zone liegen und darf nicht
 * stillgelegt sein — beides prüft die Engine bereits beim Hook-Versand,
 * hier brauchen wir es aber auch für die reine ANZEIGE-Abfrage, die
 * ohne Hook läuft.
 */
function blockerAufDemBrett(engine, playerIdx) {
  const gegnerIdx = playerIdx === 0 ? 1 : 0;
  for (const inst of (engine?.cardInstances || [])) {
    if (inst.name !== BLOCKER_NAME) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    // Kontrolle, nicht Besitz — eine gestohlene/gecharmte Kopie wirkt
    // für den, der sie gerade kontrolliert.
    if ((inst.controller ?? inst.owner) !== gegnerIdx) continue;
    const c = inst.counters || {};
    if (c.negated || c.nulled || c.stunned || c.magic_silenced) continue;
    if (c.frozen && !engine._isChillyDogActiveFor?.(gegnerIdx)) continue;
    return true;
  }
  return false;
}

/** Fällt diese Menge unter die Sperre? Genau 2 oder genau 3. */
function mengeGesperrt(amount) {
  const n = Number(amount) || 0;
  return n >= MIN_BLOCKED && n <= MAX_BLOCKED;
}

/**
 * DIE Frage für Kartenskripte: würde ein Zug von `amount` Karten für
 * `playerIdx` gerade negiert?
 *
 * Nutzung im Gate einer Karte, deren Zug ihr einziger Nutzen ist:
 *
 *     const { drawWouldBeBlocked } = require('./_draw-block-shared');
 *     canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
 *       return !drawWouldBeBlocked(engine, pi, 3);
 *     },
 *
 * @param {object} engine
 * @param {number} playerIdx  Der ZIEHENDE Spieler
 * @param {number} amount     Die logische Zugmenge laut Kartentext
 */
function drawWouldBeBlocked(engine, playerIdx, amount) {
  if (!mengeGesperrt(amount)) return false;
  return blockerAufDemBrett(engine, playerIdx);
}

module.exports = {
  BLOCKER_NAME,
  MIN_BLOCKED,
  MAX_BLOCKED,
  mengeGesperrt,
  blockerAufDemBrett,
  drawWouldBeBlocked,
};
