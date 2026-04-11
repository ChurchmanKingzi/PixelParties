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

    // Build list of all available card names (that have effect scripts or are in the card DB)
    const cardDB = engine._getCardDB();
    const allNames = Object.keys(cardDB).filter(n => {
      const cd = cardDB[n];
      if (!cd) return false;
      if (cd.cardType === 'Token') return false;
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

    // Reveal the declared card to both players
    engine._broadcastEvent('card_reveal', { cardName: declared });
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
