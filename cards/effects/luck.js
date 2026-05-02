// ═══════════════════════════════════════════
//  CARD EFFECT: "Luck"
//  Ability — Hard once per turn free activation.
//  Declare a card name. When the opponent plays
//  a card of that name from hand, draw 2/3/4
//  cards (based on Luck level).
//  Resets at the start of owner's next turn.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  noDefaultFlash: true,

  // CPU should ALWAYS fire Luck — onFreeActivate has no immediate
  // state delta (it just stores the declared name on the inst), so
  // the MCTS activation gate's eval-delta heuristic reads ~0 and
  // would otherwise skip the activation forever. The future-turn
  // payoff (free 2/3/4 cards if opp plays the named card next turn)
  // is invisible to the gate but real, and the activation itself is
  // free with no downside.
  cpuMeta: { alwaysCommit: true },

  /**
   * On activation: prompt for a card name via cardNamePicker.
   * Store selection on the hero and display to both players.
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    const zoneIdx = ctx.card.zoneSlot;
    const hero = ps?.heroes?.[heroIdx];
    if (!hero) return false;

    // Build list of all available card names. Tokens are excluded —
    // they're spawned by effects and never "played from hand," so they
    // can't trigger Luck's draw. Reaction and Surprise subtype cards
    // are also excluded: Reactions fire in chain windows on the
    // opponent's turn, and Surprises sit hidden in face-down zones
    // until triggered, so neither is "played" on the opponent's own
    // turn — declaring one is almost always wasted.
    const cardDB = engine._getCardDB();
    const allNames = Object.keys(cardDB).filter(n => {
      const cd = cardDB[n];
      if (!cd) return false;
      if (cd.cardType === 'Token') return false;
      const sub = (cd.subtype || '').toLowerCase();
      if (sub === 'reaction' || sub === 'surprise') return false;
      return true;
    }).sort((a, b) => a.localeCompare(b));

    // Prompt with cardNamePicker
    const result = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: 'Luck',
      description: 'Declare a card name. If your opponent plays it, you draw cards!',
      cardNames: allNames,
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return false;

    const declared = result.cardName;

    // Store on hero for client tooltip access
    if (!hero._luckDeclared) hero._luckDeclared = {};
    hero._luckDeclared[zoneIdx] = { target: declared, level, heroIdx };

    // Store on card instance for hook access
    ctx.card.counters.luckTarget = declared;
    ctx.card.counters.luckLevel = level;
    ctx.card.counters.luckOwner = pi;

    // Stream the DECLARED card to the opponent as if THAT card had
    // just been activated. The server's free-ability handler set
    // `gs._pendingCardReveal = { cardName: 'Luck', ... }` before
    // calling onFreeActivate; after the picker resolved we know the
    // declared name, so we hand the canonical reveal channel the
    // declared name instead. The post-activation
    // `_firePendingCardReveal()` then broadcasts the declared card to
    // the opponent (and spectators) — same prominent overlay any
    // played card gets, no double-overlay with Luck on top.
    if (gs._pendingCardReveal) {
      gs._pendingCardReveal.cardName = declared;
    } else {
      // Fallback: human activator path may have already fired the
      // pending reveal during prompt resolution. Manually broadcast
      // the declared card so the opponent still sees the streamed
      // image of "what Luck called".
      engine._broadcastEvent('card_reveal', { cardName: declared });
    }
    await engine._delay(300);

    // Flash on Luck's ability zone
    engine._broadcastEvent('ability_activated', { owner: ctx.cardHeroOwner, heroIdx, zoneIdx });

    engine.log('luck_declare', { player: ps.username, card: declared, level });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Shared trigger logic — draws cards and plays animation.
     */
    _triggerLuck: async (ctx, playedCardName, playedByOwner) => {
      const target = ctx.card.counters?.luckTarget;
      if (!target) return;
      const pi = ctx.card.counters.luckOwner;
      if (pi == null) return;
      // Only trigger on opponent's plays
      if (playedByOwner === pi) return;
      // Match card name
      if (playedCardName !== target) return;

      const level = ctx.card.counters.luckLevel || 1;
      const drawCount = level + 1; // Lv1=2, Lv2=3, Lv3=4
      const engine = ctx._engine;
      const ps = engine.gs.players[pi];

      engine.log('luck_trigger', { player: ps?.username, card: target, drawn: drawCount });

      // Rainbow animation on Luck's hero zone
      engine._broadcastEvent('willy_leprechaun', { owner: ctx.cardHeroOwner, heroIdx: ctx.cardHeroIdx });

      // Draw cards
      await engine.actionDrawCards(pi, drawCount);
      engine.sync();
    },

    /**
     * Spells/Attacks resolved by opponent.
     */
    afterSpellResolved: async (ctx) => {
      if (ctx._engine.gs._spellNegatedByEffect) return;
      await module.exports.hooks._triggerLuck(ctx, ctx.spellName, ctx.casterIdx);
    },

    /**
     * Cards entering any zone (creatures, abilities, equipment, surprises).
     */
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      await module.exports.hooks._triggerLuck(ctx, entering.name, entering.owner);
    },

    /**
     * Potions used by opponent.
     */
    afterPotionUsed: async (ctx) => {
      if (ctx.potionName == null) return;
      await module.exports.hooks._triggerLuck(ctx, ctx.potionName, ctx.potionOwner);
    },

    /**
     * At the start of owner's turn: clear the declared target.
     */
    onTurnStart: (ctx) => {
      if (ctx.activePlayer !== ctx.cardOriginalOwner) return;
      // Clear stored target
      delete ctx.card.counters.luckTarget;
      delete ctx.card.counters.luckLevel;
      delete ctx.card.counters.luckOwner;
      // Clear hero tooltip data
      const hero = ctx.attachedHero;
      if (hero?._luckDeclared) {
        delete hero._luckDeclared[ctx.card.zoneSlot];
        if (Object.keys(hero._luckDeclared).length === 0) delete hero._luckDeclared;
      }
      ctx._engine.sync();
    },
  },
};
