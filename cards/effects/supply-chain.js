// ═══════════════════════════════════════════
//  CARD EFFECT: "Supply Chain"
//  Spell (Support Magic Lv2, Normal)
//  Draw until you have 7 cards in hand.
//  Cards are drawn one by one.
//  Can only be used while player has <7 cards.
// ═══════════════════════════════════════════

module.exports = {
  // ★ v1288: spielbar nur, wenn danach wirklich gezogen wird. Liegt eine
  // Supply Chain in der Hand, zaehlt sie dort mit (daher < 8). Liegt KEINE
  // in der Hand, kann sie nur aus der Creation Zone kommen (True Fairy
  // Crestina) — dann zaehlt sie nicht mit, und die Hand muss unter 7 sein.
  // Vorher war sie dort mit 7 Handkarten spielbar und zog nichts.
  spellPlayCondition(gs, pi) {
    const hand = gs.players[pi]?.hand || [];
    return hand.includes('Supply Chain') ? hand.length < 8 : hand.length < 7;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      // ★ v1288 (Befund 22.9.: „zieht mit Crestina bis 8 statt bis 7").
      // Bisher: pauschal „bis 8, weil Supply Chain selbst noch in der Hand
      // liegt". Aus der CREATION ZONE gewirkt (True Fairy Crestina legt
      // ihre Karte dorthin) liegt sie aber NICHT in der Hand — dann wurde
      // eine Karte zu viel gezogen. Jetzt zaehlt die Hand ohne die
      // aufloesende Karte, wo auch immer sie liegt.
      const handSize = engine.handSizeWithoutResolving(pi);
      const drawCount = 7 - handSize;
      if (drawCount <= 0) return;

      // Confirm
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Supply Chain',
        message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''} (to 7 in hand).`,
        confirmLabel: `📦 Deliver! (+${drawCount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Animated multi-draw — paces each card and settles the last
      // one before Supply Chain itself heads to the discard pile.
      await ctx.drawCardsAnimated(pi, drawCount);

      engine.log('supply_chain', { player: ps.username, drawn: drawCount });
      engine.sync();
    },
  },
};
