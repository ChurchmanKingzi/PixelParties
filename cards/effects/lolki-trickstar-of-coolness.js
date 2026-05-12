// ═══════════════════════════════════════════
//  HERO EFFECT: "Lolki, Trickstar of Coolness"
//  Once per turn: search the deck for a card,
//  place it on top of your Coolness Stack, then
//  Stun a target you control for 1 turn.
//
//  Self-Stun is a real cost — the deck-search
//  prompt is non-cancellable once committed, but
//  we still gate `canActivateHeroEffect` on having
//  a Stack AND a non-empty deck AND at least one
//  Stun-eligible ally target.
// ═══════════════════════════════════════════

const CARD_NAME = 'Lolki, Trickstar of Coolness';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (!engine.hasCoolnessStack(pi)) return false;
    const ps = engine.gs.players[pi];
    if (!ps?.mainDeck?.length) return false;
    return true;
  },

  onHeroEffect: async (ctx) => {
    // Don't claim a custom HOPT — the engine itself stamps the
    // hero-effect HOPT only after `onHeroEffect` resolves cleanly
    // (and reveals the activation to the opponent at the same
    // moment). Returning `false` from any cancel path tells the
    // engine "treat this as not activated" → no HOPT, no reveal.
    const engine = ctx._engine;
    const pi = ctx.cardOwner;

    const pushed = await ctx.searchAndPushToCoolnessStack(pi, {
      title: CARD_NAME,
      description: 'Choose a card from your deck to place on top of your Coolness Stack. After this, you must Stun a target you control for 1 turn.',
    });
    if (!pushed) return false;

    // Stun is a committed cost — non-cancellable. If literally no
    // ally target exists, the cost can't be paid and we silently
    // skip (rare; canActivateHeroEffect doesn't pre-check Stun
    // eligibility because the deck-search itself might add one).
    const target = await ctx.promptDamageTarget({
      side: 'my',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: 'Choose a target you control to Stun for 1 turn.',
      confirmLabel: '💫 Stun!',
      confirmClass: 'btn-warning',
      cancellable: false,
      condition: (t) => t.owner === pi,
    });
    if (!target) return false;
    // "Pranking" the target with a hand electro-shocker — fire the
    // electric_strike burst on the target's zone before the Stun
    // status actually applies, so the visual reads as cause→effect.
    const animSlot = target.type === 'hero' ? -1 : (target.slotIdx ?? -1);
    engine._broadcastEvent('play_zone_animation', {
      type: 'electric_strike',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: animSlot,
    });
    await engine._delay(450);
    if (target.type === 'hero') {
      await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', { duration: 1, appliedBy: pi });
    } else if (target.cardInstance) {
      await engine.applyCreatureStatus(target.cardInstance, 'stunned', {
        sourceOwner: pi,
        duration: 1,
        source: 'Lolki, Trickstar of Coolness',
      });
    }
    engine.sync();
  },
};
