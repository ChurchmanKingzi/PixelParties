// ═══════════════════════════════════════════
//  CARD EFFECT: "Ambush the Scout"
//  Spell (Reaction, Lv1, Decay Magic, PP SOD)
//
//  "Play this card immediately when your opponent
//   activates an effect that would interact with
//   your hand. Negate that effect.
//   Then, your opponent discards 2 cards of their
//   choice from their hand."
//
//  Bauform
//  ───────
//  Anders als No Retreat! hängt diese Karte NICHT
//  am ersten Kettenglied, sondern am Hook
//  `onHandInteraction` (Als Rulings 4.8.):
//
//   • Das Fenster geht erst auf, wenn die Hand
//     TATSÄCHLICH angefasst wird — also nach allen
//     Wahlmöglichkeiten. „You may make your
//     opponent discard" öffnet es erst, wenn der
//     Gegner zugesagt hat. Spike Trap öffnet es,
//     wenn der Zielspieler „ich werfe ab" wählt —
//     er chained dann auf seine eigene Entscheidung
//     und negiert damit die Spike Trap, ohne die
//     Karten zu verlieren.
//
//   • Negiert wird NUR DER TEILEFFEKT, nicht die
//     ganze Karte. Strong Ox Headbutt macht seinen
//     Schaden, und erst der anschließende
//     „darf ich abwerfen lassen?"-Teil fällt weg.
//
//  Was zählt (Als Kategorien): Zwangs-Abwurf,
//  Hand ansehen, Karten aus der Hand nehmen, Hand
//  sperren (nur bei Aktivierung), Karte in die Hand
//  legen. NICHT: Handkarten bloß zählen.
//  Register und Prüflauf: _hand-interaction-registry.js
// ═══════════════════════════════════════════

const CARD_NAME = 'Ambush the Scout';
const DISCARD_COUNT = 2;

/** Passt das offene Fenster zu dieser Karte? */
function openWindow(engine, chainCtx) {
  // Bevorzugt aus dem Ketten-Kontext, sonst aus der Ablage am
  // Engine — `resolve` bekommt chainCtx nicht durchgereicht.
  return (chainCtx?.hookName === 'onHandInteraction' ? chainCtx.hookCtx : null)
      || engine?._pendingHandInteraction || null;
}

function windowFits(pi, engine, chainCtx) {
  const h = openWindow(engine, chainCtx);
  if (!h || h.cancelled) return false;
  // "…interact with YOUR hand" — es muss die eigene Hand sein.
  if (h.targetPi !== pi) return false;
  // "…when your OPPONENT activates an effect" — der verursachende
  // Effekt muss dem Gegner gehören. Wer die Auswahl geklickt hat,
  // ist egal: bei Spike Trap wählt der Ambush-Spieler selbst, der
  // Effekt gehört aber dem Gegner.
  if (h.byPi === pi) return false;
  return true;
}

module.exports = {
  isReaction: true,
  // Reaktion-only — nie proaktiv spielbar.
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => windowFits(pi, engine, chainCtx),

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const oppIdx = pi === 0 ? 1 : 0;
    const h = engine._pendingHandInteraction;

    // 1) "Negate that effect." — der auslösende Effekt liest das
    //    Feld direkt nach dem Hook und überspringt seinen
    //    Hand-Teileffekt. Alles andere an der Karte bleibt.
    if (h) h.cancelled = true;
    engine.log('ambush_the_scout_negate', {
      player: gs.players[pi]?.username,
      kind: h?.kind || 'unknown',
      negated: h?.sourceName || undefined,
    });

    // 2) "Then, your opponent discards 2 cards of their choice."
    //    Läuft über dieselbe Primitive wie jeder andere Zwangs-
    //    Abwurf, damit Takt, Glow und Discard-Hooks greifen. Hat der
    //    Gegner weniger als 2 Karten, wirft er ab, was er hat.
    await engine.actionPromptForceDiscard(oppIdx, DISCARD_COUNT, {
      sourceName: CARD_NAME,
      sourceOwner: pi,
      reason: CARD_NAME,
    });

    engine.sync();
  },
};
