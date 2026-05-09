// ═══════════════════════════════════════════
//  CREATURE: "Phatnir, Prototype of Coolness"
//  Lvl 8 base, 500 HP. Level (in hand and on the
//  board) is reduced by the size of your Coolness
//  Stack. Once per turn: deal 300 damage to a
//  target via a giant red laser blast.
// ═══════════════════════════════════════════

const CARD_NAME = 'Phatnir, Prototype of Coolness';
const HOPT_KEY  = 'phatnirBlastedThisTurn';
const ZAP_DAMAGE = 300;
const BEAM_THICKNESS = 2.8; // ~3× thicker than Alice's standard beam.

module.exports = {
  activeIn: ['support', 'hand'],
  // Creatures with an activated effect use the `creatureEffect` API,
  // NOT the Ability `actionCost` flag. Without `creatureEffect: true`
  // the engine never surfaces an activate option on the board, so
  // clicking Phatnir does nothing.
  creatureEffect: true,
  requiresTarget: true,

  /**
   * Engine reads `reduceCardLevel` to recompute the effective level for
   * gate-checks (hand level filter and board summon checks). Returns
   * a positive number — the engine subtracts it from the base level.
   */
  reduceCardLevel(cardData, engine, ownerIdx /* , inst */) {
    if (cardData?.name !== CARD_NAME) return 0;
    const size = engine.gs.players[ownerIdx]?.coolnessStack?.length || 0;
    return size;
  },

  canActivateCreatureEffect(ctx) {
    // Soft once-per-turn (per Phatnir instance) — two Phatnirs each
    // get their own activation. Stored on the inst's counters so it
    // travels with the specific instance.
    return ctx.card?.counters?.[HOPT_KEY] !== ctx._engine.gs.turn;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      title: CARD_NAME,
      description: `Deal ${ZAP_DAMAGE} damage to any target.`,
      confirmLabel: '⚡ Blast!',
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false; // No commit, no HOPT claim.
    // Soft HOPT — stamp the inst, not the player. Each Phatnir gets
    // its own per-turn slot.
    if (!ctx.card.counters) ctx.card.counters = {};
    ctx.card.counters[HOPT_KEY] = engine.gs.turn;

    // Giant red laser from Phatnir's support slot to the target.
    // Uses the existing beam infrastructure with a thickness multiplier
    // — same shape Alice uses, scaled up.
    const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: ctx.cardOwner,
      sourceHeroIdx: ctx.card.heroIdx,
      sourceZoneSlot: ctx.card.zoneSlot,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot,
      color: '#ff2222',
      thickness: BEAM_THICKNESS,
      // Longer than Alice's 1500 ms so the bigger impact spectacle
      // (sustained flash + three staggered shockwave rings) gets
      // room to land before the line fades.
      duration: 2400,
    });
    await engine._delay(550);

    if (target.type === 'hero') {
      const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (h && h.hp > 0) await ctx.dealDamage(h, ZAP_DAMAGE, 'destruction_spell');
    } else if (target.cardInstance) {
      // Use `actionDealCreatureDamage` — the canonical creature damage
      // helper. The previous call to `engine.dealCreatureDamage` was
      // a non-existent method, so the damage silently dropped.
      await engine.actionDealCreatureDamage(
        ctx.card, target.cardInstance, ZAP_DAMAGE, 'destruction_spell',
        { sourceOwner: pi, canBeNegated: true }
      );
    }
    return true;
  },
};
