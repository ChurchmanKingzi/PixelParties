// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Ruin Mourner"
//  Creature (Summoning Magic Lv4, 50 HP)
//
//  "This card's level in your hand is reduced by the number of targets
//   you've sacrificed since the start of this turn. Up to 4 times per
//   turn, when you sacrifice a target, choose a target and deal 80
//   damage to it."
//
//  Two independent pieces:
//
//   1. Hand level reduction — `reduceCardLevel` returns the controller's
//      per-turn sacrifice tally (`ps._creaturesSacrificedThisTurn`, kept
//      by the engine). The engine's `_applyCardLevelReductions` already
//      walks every owned instance that exports `reduceCardLevel`, sums
//      the results and clamps at 0, so a Lv4 Ruin Mourner becomes Lv0
//      after four sacrifices. We dedup to the lowest-id owned copy so
//      two Ruin Mourners don't double-count the reduction onto each
//      other.
//
//   2. The burn — a board passive (Support Zone) listening on
//      `onCreatureSacrificed`. Each time you sacrifice your own Creature
//      you MAY deal 80 damage to any target, up to four times per turn.
//      Declining (cancel) does not spend a use.
// ═══════════════════════════════════════════

const { isOwnSacrifice } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Ruin Mourner';
const MAX_BURNS = 4;

module.exports = {
  activeIn: ['hand', 'support'],

  /**
   * Lower this card's level in hand by the controller's sacrifices
   * this turn. Only the lowest-id owned copy contributes, so the
   * per-name reduction the engine applies is exactly the tally (not a
   * multiple of it when several copies are in play).
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts) {
    if (!cardData || cardData.name !== CARD_NAME) return 0;
    // "This card's level in your HAND is reduced" — never while it sits
    // in the deck / discard / deleted pile. `evalOpts.pileSide` is set
    // for those evaluations (e.g. Ladder to the Sky's deck search), so
    // bail and report the printed level there.
    if (evalOpts?.pileSide) return 0;
    const owned = engine.cardInstances.filter(c =>
      c.name === CARD_NAME
      && (c.controller ?? c.owner) === ownerIdx
      && !c.faceDown
      && c.isActiveIn());
    if (owned.length === 0) return 0;
    const lowestId = owned.map(c => c.id).sort()[0];
    if (inst?.id !== lowestId) return 0;
    return Math.max(0, engine.gs.players[ownerIdx]?._creaturesSacrificedThisTurn || 0);
  },

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      // Board passive only — the burn is a property of the Creature in
      // play, not the copy sitting in hand.
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      // `isOwnSacrifice` excludes the self-instance (Ruin Mourner can't
      // react to its OWN sacrifice — it's leaving the board) while still
      // allowing a separate copy's sacrifice to trigger the burn.
      if (!isOwnSacrifice(ctx, pi)) return;

      // Per-turn 4-use cap, scoped per Ruin Mourner instance.
      const c = ctx.card.counters || (ctx.card.counters = {});
      if (c._ruinBurnTurn !== gs.turn) { c._ruinBurnTurn = gs.turn; c._ruinBurnCount = 0; }
      if ((c._ruinBurnCount || 0) >= MAX_BURNS) return;

      const heroIdx = ctx.cardHeroIdx;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: 80,
        title: CARD_NAME,
        description: `You may deal 80 damage to a target. (${MAX_BURNS - (c._ruinBurnCount || 0)} use${MAX_BURNS - (c._ruinBurnCount || 0) !== 1 ? 's' : ''} left this turn.)`,
        confirmLabel: '💀 80 Damage!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return; // declined — use not spent

      c._ruinBurnCount = (c._ruinBurnCount || 0) + 1;

      const slot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot ?? -1,
      });
      await engine._delay(400);

      const source = { name: CARD_NAME, owner: pi, heroIdx };
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await engine.actionDealDamage(source, tgtHero, 80, 'creature');
      } else if (target.cardInstance) {
        const live = engine.cardInstances.find(c2 => c2.id === target.cardInstance.id);
        if (live && live.zone === 'support') {
          await engine.actionDealCreatureDamage(source, live, 80, 'creature', { sourceOwner: pi, canBeNegated: true });
        }
      }
      engine.log('ruin_mourner_burn', {
        player: gs.players[pi]?.username, used: c._ruinBurnCount, target: target.cardName || target.type,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    // Cheap body that converts sacrifices into 80-damage pings — credit
    // ally deaths as fuel for its on-sacrifice burn.
    chainSource: {
      isArmed: (engine, inst) => {
        const c = inst.counters || {};
        const used = c._ruinBurnTurn === engine.gs.turn ? (c._ruinBurnCount || 0) : 0;
        return inst.zone === 'support' && used < MAX_BURNS;
      },
      triggersOn: (engine, tributeInst, sourceInst) =>
        (tributeInst.controller ?? tributeInst.owner) === (sourceInst.controller ?? sourceInst.owner),
      valuePerTrigger: 80,
    },
  },
};
