// ═══════════════════════════════════════════
//  Shared helper for Bottled Flame / Lightning
//  Alternating discard chain. Opponent goes first.
//  Returns the player index who "took it".
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

/**
 * Run an alternating discard chain between two players.
 * Opponent discards first. Players take turns discarding 1 card.
 * A player may choose "Take it!" to stop. If a player has 0 cards, they auto-take.
 * @returns {number} playerIdx of the player who "took it"
 */
/**
 * Wechselseitige Abwurfkette.
 * @returns {Promise<number|null>} Index des Spielers, der den Effekt
 *   nimmt — oder `null`, wenn die Kette (und damit die ganze Karte)
 *   negiert wurde.
 */
async function runDiscardChain(engine, potionOwner, potionName) {
  const gs = engine.gs;
  const oppIdx = potionOwner === 0 ? 1 : 0;

  // Opponent goes first
  let currentPlayer = oppIdx;

  while (true) {
    const ps = gs.players[currentPlayer];
    const hand = ps?.hand || [];

    // Auto-take if no cards left
    if (hand.length === 0) return currentPlayer;

    // ── BORIS, VOR DER ZIELWAHL (Als Praezisierung 5.8.) ──────────────
    // Frueher stand die Abfrage NACH dem Picker — man suchte erst eine
    // Karte aus, um dann zu sagen "doch nicht abwerfen". Jetzt zuerst.
    //
    // SICHERUNG gegen Endlosschleife (Als Vorgabe): haben BEIDE Spieler
    // einen wirksamen Boris, ist der Abwurf NICHT ueberspringbar —
    // sonst reichten sie die Kette unbegrenzt hin und her, weil keiner
    // je etwas abwerfen muesste.
    {
      const oppOf = currentPlayer === 0 ? 1 : 0;
      const boris = loadCardEffect('Boris, the Guardian of Blackport');
      const beideHabenBoris = !!boris?.borisActive
        && boris.borisActive(engine, currentPlayer) && boris.borisActive(engine, oppOf);
      if (!beideHabenBoris && boris?.offerDiscardSkip
          && await boris.offerDiscardSkip(engine, currentPlayer, 1, { sourceName: potionName })) {
        // Verzichtet — die Entscheidung zaehlt, die Kette laeuft weiter.
        currentPlayer = oppOf;
        continue;
      }
    }

    const result = await engine.promptGeneric(currentPlayer, {
      type: 'forceDiscardCancellable',
      title: potionName,
      description: `Discard a card or take the ${potionName} effect!`,
      instruction: 'Click a card to discard it, or press "Take it!" to accept the effect.',
      cancelLabel: '🔥 Take it!',
      cancellable: true,
      showOpponentWaiting: true,
      opponentTitle: `🍾 ${potionName} — Opponent is deciding...`,
    });

    if (!result || result.cancelled) {
      // This player chose to "take it"
      return currentPlayer;
    }

    // Discard the chosen card — must fire the ON_DISCARD hook so effects
    // like Steam Dwarf that subscribe to hand discards see the event.
    const { cardName, handIndex } = result;

    // Reaktionsfenster (Ambush the Scout). Genau wie bei Spike Trap
    // (Als Ruling 4.8.): der Zielspieler hat sich fuer den Abwurf
    // ENTSCHIEDEN, erst dann geht das Fenster auf. Wird negiert,
    // bleibt die Entscheidung stehen — die Kette laeuft normal
    // weiter, nur die Karte bleibt auf der Hand. Kein Fenster, wenn
    // der Trank-Besitzer selbst abwirft: das sind eigene Kosten.
    // Wird negiert, ist die GANZE Karte negiert (Als Ruling 5.8.), nicht
    // nur dieser eine Abwurf: bei diesem Trank IST die Abwurfkette der
    // Effekt. Das unterscheidet ihn von Strong Ox Headbutt, wo der
    // Abwurf ein angehaengter Teileffekt nach dem Schaden ist.
    // `null` = komplett negiert, die Traenke brechen dann ab.
    if (currentPlayer !== potionOwner
        && await engine.checkHandInteractionReaction(currentPlayer, 'discard',
             { byPi: potionOwner, count: 1, sourceName: potionName })) {
      engine.log('bottled_negated', { potion: potionName, by: gs.players[currentPlayer]?.username });
      engine.sync();
      return null;
    }


    if (handIndex >= 0 && handIndex < hand.length && hand[handIndex] === cardName) {
      hand.splice(handIndex, 1);
      ps.discardPile.push(cardName);
      const inst = engine.findCards({ owner: currentPlayer, zone: 'hand', name: cardName })[0];
      if (inst) {
        inst.zone = 'discard';
        await engine.runHooks('onDiscard', {
          playerIdx: currentPlayer,
          card: inst,
          cardName,
          discardedCardName: cardName,
          _fromHand: true,
        });
      }
      engine.log('bottled_discard', { player: ps.username, card: cardName, by: potionName });
      engine.sync();
      await engine._delay(300);
    }

    // Switch to other player
    currentPlayer = currentPlayer === 0 ? 1 : 0;
  }
}

module.exports = { runDiscardChain };
