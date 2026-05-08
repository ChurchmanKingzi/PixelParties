// ═══════════════════════════════════════════
//  CARD EFFECT: "Winged Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  Once per turn, when a "Skeleton" Creature you control is chosen by
//  an opponent's card or effect, you may return that Creature back to
//  your hand to negate the card or effect.
//
//  Rule of thumb (per design): "If `_cardinalImmune` would block it,
//  it's targeting, and it comes from the opponent — Winged Skeleton
//  can chain to it." So we listen on the engine paths that respect
//  `_cardinalImmune`:
//
//    • beforeCreatureAffected  — destroy / move / status / heal
//      (heal is INCLUDED — opp-targeted heals on your creatures are
//      rare but legal targeting; the rule covers them).
//    • beforeCreatureDamageBatch — direct damage (Attacks like Heavy
//      Hit, single-target Spells like Alice's effect, etc.). We only
//      react when the batch is a SINGLE-target hit on our Skeleton —
//      AoE / multi-target damage isn't "choosing" any one creature.
//
//  Buff add / remove paths (`actionAddCreatureBuff` /
//  `actionRemoveCreatureBuff`) have no firing hook today — covering
//  them would need an engine extension. They're rare opp interactions
//  on creatures (most buffs are own-side), so left for future work.
//
//  Per-turn cap: hard once-per-controller HOPT under
//  `gs.hoptUsed['winged-skeleton:<pi>']`.
// ═══════════════════════════════════════════

const { isSkeletonCreature } = require('./_skeleton-shared');

const CARD_NAME = 'Winged Skeleton';
const HOPT_PREFIX = 'winged-skeleton';

function alreadyUsedThisTurn(gs, controller) {
  return gs.hoptUsed?.[`${HOPT_PREFIX}:${controller}`] === gs.turn;
}
function stampUsed(gs, controller) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_PREFIX}:${controller}`] = gs.turn;
}

/**
 * Splice the targeted Skeleton off the board and back into its
 * original owner's hand. Mirrors Sparkfly Worker's stealBoardCardToHand
 * pattern but restricted to support-zone Skeletons. Fires the
 * cross-side flight animation so the bounce is visible on both clients.
 */
function bounceSkeletonToHand(engine, targetInst) {
  const gs = engine.gs;
  const ownerIdx = targetInst.owner;
  const ownerPs  = gs.players[ownerIdx];
  if (!ownerPs) return false;
  const supportSlot = ownerPs.supportZones?.[targetInst.heroIdx]?.[targetInst.zoneSlot] || [];
  const slotIdx = supportSlot.indexOf(targetInst.name);
  if (slotIdx >= 0) supportSlot.splice(slotIdx, 1);
  ownerPs.hand.push(targetInst.name);
  const handInst = engine._trackCard(targetInst.name, ownerIdx, 'hand');
  handInst.originalOwner = targetInst.originalOwner;
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: ownerIdx,
    toOwner: ownerIdx,
    cardName: targetInst.name,
    from: 'support',
    to: 'hand',
    fromHeroIdx: targetInst.heroIdx,
    fromSlotIdx: targetInst.zoneSlot,
    toHandIdx: ownerPs.hand.length - 1,
  });
  engine._untrackCard(targetInst.id);
  return true;
}

/**
 * Shared confirm + bounce flow. Returns true if the player accepted
 * the negation. Stamps HOPT only on a successful accept.
 */
async function offerNegation(ctx, targetInst, sourceCardName, descriptionVerb) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const myController = ctx.cardController ?? ctx.cardOwner;
  if (alreadyUsedThisTurn(gs, myController)) return false;

  const confirmed = await engine.promptGeneric(myController, {
    type: 'confirm',
    title: CARD_NAME,
    message: `An opponent's ${sourceCardName || 'effect'} ${descriptionVerb} ${targetInst.name}. Return it to your hand and negate the effect?`,
    showCard: CARD_NAME,
    confirmLabel: '🪽 Negate!',
    confirmClass: 'btn-success',
    cancelLabel: 'Let it land',
    cancellable: true,
  });
  if (!confirmed) return false;

  stampUsed(gs, myController);
  bounceSkeletonToHand(engine, targetInst);
  engine.log('winged_skeleton_negate', {
    player: gs.players[myController]?.username,
    rescued: targetInst.name,
    sourceCard: sourceCardName || 'unknown',
    verb: descriptionVerb,
  });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * Fires from actionDestroyCard / actionMoveCard /
     * actionApplyCreaturePoison / actionHealCreature with effectType
     * 'destroy' / 'move' / 'status' / 'heal'. Cancellable via
     * `ctx.cancel()` or by setting `ctx.cancelled = true`.
     */
    beforeCreatureAffected: async (ctx) => {
      const targetInst = ctx.creature;
      if (!targetInst) return;
      if (ctx.cancelled) return;

      const engine = ctx._engine;
      const myController = ctx.cardController ?? ctx.cardOwner;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller;
      if (sourceOwner == null) return;
      if (sourceOwner === myController) return;
      const targetController = targetInst.controller ?? targetInst.owner;
      if (targetController !== myController) return;
      if (!isSkeletonCreature(targetInst.name, engine)) return;

      const verb = (ctx.effectType === 'destroy') ? 'targeted'
                 : (ctx.effectType === 'move')    ? 'is moving'
                 : (ctx.effectType === 'heal')    ? 'is healing'
                 : (ctx.effectType === 'status')  ? 'is statusing'
                 :                                  'chose';
      const accepted = await offerNegation(ctx, targetInst, ctx.source?.name, verb);
      if (accepted) {
        if (typeof ctx.cancel === 'function') ctx.cancel();
        else ctx.setFlag?.('cancelled', true);
      }
    },

    /**
     * Direct damage to creatures routes through this hook. We only
     * react to TARGETING-style damage (single-entry batches): an
     * Attack hitting one creature, a single-target damage spell
     * (Alice etc.). Multi-entry batches (AoE / splash) are NOT
     * "choosing" the Skeleton specifically and are skipped.
     *
     * Cancel mechanics: setting `entry._immuneCreature = true`
     * marks the entry as immune so the damage step (line ~17170 in
     * the engine) skips HP reduction. Pre-empting the bounce avoids
     * a second-best outcome where the Skeleton takes damage AND is
     * bounced.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const entries = ctx.entries || [];
      if (entries.length !== 1) return;
      const entry = entries[0];
      if (!entry || entry.cancelled || entry._immuneCreature) return;
      const targetInst = entry.inst;
      if (!targetInst) return;

      const engine = ctx._engine;
      const myController = ctx.cardController ?? ctx.cardOwner;
      const sourceOwner = entry.sourceOwner ?? entry.source?.owner;
      if (sourceOwner == null) return;
      if (sourceOwner === myController) return;
      const targetController = targetInst.controller ?? targetInst.owner;
      if (targetController !== myController) return;
      if (!isSkeletonCreature(targetInst.name, engine)) return;

      const accepted = await offerNegation(ctx, targetInst, entry.source?.name, `targeted (${entry.amount} dmg)`);
      if (accepted) {
        // Mark the entry as fully cancelled so neither damage nor
        // any post-hit rider (afterDamage, on-hit status, etc.) fires.
        entry.cancelled = true;
        entry._immuneCreature = true;
      }
    },
  },
};
