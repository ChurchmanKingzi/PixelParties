'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "The Root of all Presents"  (W77d)
//  Creature (Normal, Lv3, 150 HP, Summoning Magic) — Set PP CRESTMAS
//
//  „You may once per turn add any number of cards from your hand to your opponent's hand to draw the same number of cards."
//
//  ── AUSLEGUNG ───────────────────────────────────────────────────────────
//  • Aktiver Creature-Effekt (einmal pro Zug, Engine-Sperre je Instanz; `creatureEffect`). „You may": die Wahl ist abbrechbar, ein Abbruch verbraucht den Effekt nicht. „any number": EINE
//    `handPick`-Auswahl aus der ganzen eigenen Hand, mindestens eine Karte (0 Karten wäre eine leere Aktivierung — dafür bricht man ab).
//  • Spielbar nur, wenn es etwas zu tun gibt: der Spieler hat mindestens eine Handkarte, die Gegnerhand ist nicht tabu (Erstrunden-Schutz, Spreading Rumor „cannot interact with your opponent's hand").
//  • Das Verschenken ist eine Hand-Interaktion der Kategorie `insert` (Reaktionsfenster, Ambush the Scout): EIN Fenster für das ganze Geben; negiert → nichts geschieht, die Aktivierung ist verbraucht.
//    Jede Karte wandert über `actionTransferCardToOppHand` (Hook `onCardTransferredToOppHand`, Herkunft bleibt beim Besitzer) — von hinten nach vorn (stabile Indizes), einzeln fliegend.
//  • „to draw the same number of cards": Gezogen wird erst NACH dem Geben, so viele Karten, wie tatsächlich übergeben wurden (`actionDrawCards`, also mit Ziehsperren und Deck-Ende wie jeder Effekt-Zug).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  Flugstil `lichterkette` (Client, Pixelart): jede verschenkte Karte fliegt mit einem grünen Draht und 34 bunt blinkenden Lichtbirnchen am Kartenrand zur Gegnerhand, dahinter fallen bunte Lichtpixel.
// ═══════════════════════════════════════════

const CARD_NAME = 'The Root of all Presents';
const ABSTAND_MS = 320;      // zwischen den Flügen der verschenkten Karten

function moeglich(engine, pi) {
  const gs = engine.gs;
  const oi = engine.opponentOf(pi);
  const ps = gs.players[pi], ops = gs.players[oi];
  if (!ps || !ops) return false;
  if ((ps.hand || []).length === 0) return false;
  if (gs.firstTurnProtectedPlayer === oi) return false;                    // Erstrunden-Schutz: die Hand ist tabu
  if (ps._oppHandInteractionLockedTurn === gs.turn) return false;          // Spreading Rumor
  return true;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,   // OHNE dieses Kennzeichen listet der Server die Creature nicht als aktivierbar
  hooks: {},
  blockedByHandLock: true,

  canActivateCreatureEffect(ctx) {
    return moeglich(ctx._engine, ctx.cardOwner);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = engine.opponentOf(pi);
    const ps = gs.players[pi], ops = gs.players[oi];
    if (!ps || !ops || !moeglich(engine, pi)) return false;

    const alle = (ps.hand || []).map((_, i) => i);
    const wahl = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: `Choose any number of cards from your hand to give to ${ops.username}. You then draw that many cards.`,
      eligibleIndices: alle,
      highlightStyle: 'strong',
      minSelect: 1,
      maxSelect: alle.length,
      confirmLabel: '🎁 Give!',
      cancellable: true,
    });
    if (!wahl || wahl.cancelled) return false;
    const roh = Array.isArray(wahl.selectedCards) ? wahl.selectedCards : [];
    const gewaehlt = [...new Set(roh.map(s => s?.handIndex).filter(i => Number.isInteger(i) && alle.includes(i)))];
    if (gewaehlt.length === 0) return false;

    let gegeben = 0;
    if (!(await engine.checkHandInteractionReaction(oi, 'insert', { byPi: pi, count: gewaehlt.length, sourceName: CARD_NAME }))) {
      for (const idx of [...gewaehlt].sort((a, b) => b - a)) {
        if (await engine.actionTransferCardToOppHand(pi, idx, {
          source: CARD_NAME, windowChecked: true, finalHandSize: (ops.hand || []).length + 1, flightStyle: 'lichterkette', flightSfx: 'draw',
        })) gegeben++;
        if (gegeben < gewaehlt.length) await engine._delay(ABSTAND_MS);
      }
    }
    let gezogen = 0;
    if (gegeben > 0) {
      const karten = await engine.actionDrawCardsAnimated(pi, gegeben, { source: CARD_NAME });
      gezogen = Array.isArray(karten) ? karten.length : 0;
    }
    engine.log('root_of_all_presents', { player: ps.username, opponent: ops.username, gave: gegeben, drew: gezogen });
    engine.sync();
    return true;
  },

  /** CPU: verschenkt NIE freiwillig — ein Tausch ohne Wert-Rechnung wäre nur ein Nachteil (der Gegner bekommt Karten). */
  cpuMeta: { shouldActivateNow: () => false },
};
