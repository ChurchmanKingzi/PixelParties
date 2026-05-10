// ═══════════════════════════════════════════
//  CARD EFFECT: "Accusation"
//  Spell (Normal, Lv1, Decay Magic)
//
//  Declare a card name. Your opponent must show
//  you their hand and send all cards with the
//  declared name from their hand to the discard
//  pile. Draw 1 card for every card discarded.
// ═══════════════════════════════════════════

const CARD_NAME = 'Accusation';

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oi];
      if (!ps || !ops) return;

      // Spreading-Rumor lock — Accusation reads opp's hand, so it's
      // gated behind the once-per-turn opp-hand interaction lock.
      if (ps._oppHandInteractionLockedTurn === gs.turn) {
        engine.log('accusation_locked', { player: ps.username });
        gs._spellCancelled = true;
        return;
      }

      // Stream the card image to the opponent NOW — without this,
      // doPlaySpell's `_firePendingCardReveal` only runs AFTER the
      // name-picker + per-card reveal stream finishes, leaving the
      // opponent staring at a mystery cast for the entire prompt.
      if (gs._pendingCardReveal) engine._firePendingCardReveal();

      // Build the name picker list. Same shape as Luck — exclude
      // Tokens (never in deck) but allow every other card type so
      // the player can name Reactions / Surprises that the opp
      // might be hoarding.
      const cardDB = engine._getCardDB();
      const allNames = Object.keys(cardDB).filter(n => {
        const cd = cardDB[n];
        if (!cd) return false;
        if (cd.cardType === 'Token') return false;
        return true;
      }).sort((a, b) => a.localeCompare(b));

      const result = await engine.promptGeneric(pi, {
        type: 'cardNamePicker',
        title: CARD_NAME,
        description: `Declare a Card name. ${ops.username} reveals their hand and discards every copy of that card.`,
        cardNames: allNames,
        cancellable: true,
      });
      if (!result || result.cancelled || !result.cardName) {
        gs._spellCancelled = true;
        return;
      }
      const declared = result.cardName;

      // Reveal opp's full hand to the caster (private peek). Each
      // card in opp's hand emits a `card_reveal` to the caster's
      // socket only; this is the same pattern Krates / Sid use to
      // surface opp-hand contents to the active player.
      const ourSid = ps.socketId;
      if (ourSid && engine.io) {
        for (const cn of (ops.hand || [])) {
          engine.io.to(ourSid).emit('card_reveal', { cardName: cn });
          await engine._delay(120);
        }
      }
      await engine._delay(300);

      // Splice every matching copy out of opp's hand and route through
      // the canonical discard helper so onDiscard listeners (Cute
      // Hydra, Rebelliokai Kind Kitsune, etc.) fire per card.
      let discarded = 0;
      while (true) {
        const idx = (ops.hand || []).indexOf(declared);
        if (idx < 0) break;
        const ok = await engine.actionDiscardHandCard(oi, declared, idx, {
          source: CARD_NAME,
        });
        if (!ok) break;
        discarded++;
      }

      engine.log('accusation_resolved', {
        player: ps.username, opponent: ops.username,
        declared, discarded,
      });

      if (discarded > 0) {
        await engine._delay(200);
        await engine.actionDrawCards(pi, discarded);
      }

      engine.sync();
    },
  },
};
