// ═══════════════════════════════════════════
//  CARD EFFECT: "Willy, the Valiant Leprechaun"
//  Hero — At the end of your first turn, choose:
//  Draw 5 cards OR Gain 30 Gold.
//  No hand size limit during your first turn.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  hooks: {
    /**
     * On game start: record the owner's first turn number
     * and set the hand-limit bypass flag.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      const pi = ctx.cardOriginalOwner;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;

      // Compute first turn number: player who goes first = turn 1, second = turn 2
      const firstTurn = (gs.activePlayer === pi) ? (gs.turn || 1) : (gs.turn || 1) + 1;
      hero._willyFirstTurn = firstTurn;
      hero._willyEffectUsed = false;

      // Generic hand-limit bypass: enforceHandLimit checks this
      ps._noHandLimitUntilTurn = firstTurn;
    },

    /**
     * End Phase of owner's first turn: prompt for Draw 5 or Gain 30 Gold.
     */
    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== 5) return; // Only End Phase
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOriginalOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.attachedHero;
      if (!hero || hero._willyEffectUsed) return;
      if (gs.activePlayer !== pi) return; // Only on owner's turn
      if ((gs.turn || 1) !== hero._willyFirstTurn) return; // Only first turn

      // Must be alive and not incapacitated
      if (hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      hero._willyEffectUsed = true;

      const ps = gs.players[pi];
      const oppIdx = pi === 0 ? 1 : 0;

      // Reveal Willy to opponent
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid && engine.io) {
        engine.io.to(oppSid).emit('card_reveal', { cardName: 'Willy, the Valiant Leprechaun' });
      }
      await engine._delay(300);

      // Prompt for choice
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: 'Willy, the Valiant Leprechaun',
        description: "Willy's Luck! Choose your reward:",
        options: [
          { id: 'draw', label: '🃏 Draw 5 Cards', description: 'Draw 5 cards from your deck.', color: '#4488ff' },
          { id: 'gold', label: '💰 Gain 30 Gold', description: 'Add 30 Gold to your treasury.', color: '#ffcc00' },
        ],
        cancellable: false,
      });

      const picked = choice?.optionId || 'draw';

      // Leprechaun animation on Willy's hero zone (plays BEFORE effect resolves)
      engine._broadcastEvent('willy_leprechaun', { owner: pi, heroIdx });
      await engine._delay(800);

      if (picked === 'draw') {
        // Draw 5 cards (engine handles one-by-one visual pacing)
        await engine.actionDrawCards(pi, 5);
        engine.log('willy_draw', { player: ps.username, count: 5 });
      } else {
        // Gain 30 Gold with sparkle animation
        await engine.actionGainGold(pi, 30);
        engine.log('willy_gold', { player: ps.username, amount: 30 });
        // Extra gold sparkle on the gold counter
        const goldSel = `[data-gold-player="${pi}"]`;
        engine._broadcastEvent('play_zone_animation', { type: 'gold_sparkle', selector: goldSel });
      }

      engine.sync();
    },
  },
};
