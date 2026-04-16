// ═══════════════════════════════════════════
//  CARD EFFECT: "The White Eye"
//  Artifact (Equipment, Cost 50)
//
//  ① Whenever the equipped Hero hits exactly
//    1 target with a Spell, you may have that
//    target's controller discard 1 random card.
//
//  ② When this card is sent to your discard
//    pile for any reason EXCEPT being discarded
//    from your hand, it immediately returns to
//    your hand.
//    The exception is handled automatically:
//    activeIn: ['support'] means this hook only
//    fires while the card is in a Support Zone.
//    Discards from hand don't fire the hook.
//    toZone === 'hand' guard blocks the rare
//    case where a support card moves to hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'The White Eye';

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * ① After a Spell resolves hitting exactly 1 target,
     * optionally force that target's controller to discard a random card.
     */
    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Spell') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;

      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const tgtOwner = targets[0].owner;
      const tgtPs    = gs.players[tgtOwner];

      if (!tgtPs || (tgtPs.hand || []).length === 0) return;

      // Arthor must still be alive and capable
      const hero = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Flash The White Eye's support zone slot
      engine._broadcastEvent('card_effect_flash', {
        owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: ctx.card.zoneSlot,
      });

      // Prompt: optionally trigger the discard
      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Force ${tgtPs.username} to discard 1 random card?`,
      });
      if (!confirmed) return;

      // Discard a random card from the target's hand
      const hand = tgtPs.hand;
      if (hand.length === 0) return;
      const randomIdx  = Math.floor(Math.random() * hand.length);
      const discarded  = hand.splice(randomIdx, 1)[0];
      tgtPs.discardPile.push(discarded);

      // Update card instance zone if tracked
      const inst = engine.cardInstances.find(c =>
        c.owner === tgtOwner && c.zone === 'hand' && c.name === discarded,
      );
      if (inst) inst.zone = 'discard';

      engine.log('white_eye_discard', {
        player: gs.players[pi].username,
        target: tgtPs.username,
        card: discarded,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'plague_smoke', owner: tgtOwner, heroIdx: targets[0].heroIdx, zoneSlot: -1,
      });
      engine.sync();
    },

    /**
     * ② When The White Eye leaves its Support Zone going to discard,
     * redirect it to the owner's hand instead.
     *
     * activeIn: ['support'] means this hook only fires while The White Eye
     * is in a Support Zone — discards from hand never trigger it, which
     * is the natural implementation of "except because you discarded it
     * from your hand."
     *
     * Sets inst._returnToHand = true; actionMoveCard intercepts this flag
     * right after onCardLeaveZone and reroutes to ZONES.HAND.
     */
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone !== 'discard') return;

      // Confirm the leaving card is The White Eye itself (match by slot)
      const engine = ctx._engine;
      const leavingInst = engine.cardInstances.find(c =>
        c.owner === ctx.cardOwner && c.zone === 'support' &&
        c.heroIdx === ctx.fromHeroIdx && c.zoneSlot === ctx.fromZoneSlot,
      );
      if (!leavingInst || leavingInst.id !== ctx.card.id) return;

      // Signal actionMoveCard to route to hand instead of discard
      leavingInst._returnToHand = true;

      engine.log('white_eye_return', {
        player: engine.gs.players[ctx.cardOwner]?.username,
      });
    },
  },
};
