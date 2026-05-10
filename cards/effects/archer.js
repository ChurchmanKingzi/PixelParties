// ═══════════════════════════════════════════
//  CARD EFFECT: "Archer"
//  Creature (Summoning Magic Lv0) — Arrows archetype
//
//  ① Alternative summon: if the controller owns no
//    Creatures and has at least one "Arrow"
//    Artifact in hand, Archer plays as an additional
//    Action — discarding one of those Arrows is the
//    cost. Standard normal-summon path stays
//    available the moment either condition no
//    longer holds (already controls a Creature, or
//    no Arrow in hand).
//  ② Triggered active: up to 3 times per turn,
//    when Archer's controller plays an Arrow
//    Artifact (chain-builds or otherwise),
//    Archer may choose a target and deal 40
//    damage to it. Counter is per-Archer, so
//    multiple copies on the board each get their
//    own 3 uses, and chaining 3 Arrows onto one
//    Attack lets a single Archer fire all three
//    times — once per Arrow add (the trigger
//    listens on `onReactionActivated`, which
//    fires per chain-add of each reaction card).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME    = 'Archer';
const MAX_USES     = 3;
const SHOT_DAMAGE  = 40;

/** True iff `pi` currently controls at least one Creature. */
function controlsAnyCreature(engine, pi) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

/** Returns the hand indices (in `ps.hand`) that hold Arrow Artifacts. */
function getArrowIndicesInHand(ps) {
  const out = [];
  const hand = ps?.hand || [];
  for (let i = 0; i < hand.length; i++) {
    const script = loadCardEffect(hand[i]);
    if (script?.isArrow) out.push(i);
  }
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],

  /**
   * Inherent additional Action gate. Returns true iff Archer's
   * controller currently owns no Creatures AND has at least one Arrow
   * Artifact in hand. When true, the engine routes Archer's play as a
   * free additional action and `beforeSummon` charges the Arrow
   * discard cost.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (controlsAnyCreature(engine, pi)) return false;
    return getArrowIndicesInHand(ps).length > 0;
  },

  /**
   * Pre-placement cost for the alt path. Direct in-hand discard
   * (`forceDiscardCancellable`): Arrow cards highlight, every other
   * card dims, click a highlighted Arrow to discard it. Cancel aborts
   * the alt summon — the card returns to hand and the player keeps
   * their Action slot. Standard non-inherent summons skip this step
   * entirely (return true).
   */
  async beforeSummon(ctx) {
    if (!ctx.isInherentAction) return true;

    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const eligibleIndices = getArrowIndicesInHand(ps);
    if (eligibleIndices.length === 0) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      title: CARD_NAME,
      description: 'Discard an "Arrow" Artifact to summon Archer as an additional Action.',
      instruction: 'Click a highlighted Arrow Artifact in your hand.',
      eligibleIndices,
      cancellable: true,
    });
    if (!result || result.cancelled || result.cardName == null) return false;
    // Defensive: only Arrows should pass eligibility, but verify the
    // returned card name still has the isArrow flag.
    const pickedScript = loadCardEffect(result.cardName);
    if (!pickedScript?.isArrow) return false;

    const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
      source: CARD_NAME,
    });
    if (!ok) return false;

    engine.log('archer_alt_summon', {
      player: ps.username, arrow: result.cardName,
    });
    return true;
  },

  hooks: {
    /**
     * Reset the per-turn counter at the start of THIS Archer's
     * controller's turn. Per-instance counter so multiple Archers
     * each get their own 3 uses.
     */
    onTurnStart: (ctx) => {
      if (ctx.activePlayer !== ctx.cardOwner) return;
      const inst = ctx.card;
      if (inst?.counters && inst.counters._archerUsesThisTurn) {
        delete inst.counters._archerUsesThisTurn;
      }
    },

    /**
     * Per-Arrow trigger. The engine fires `onReactionActivated` once
     * per reaction added to the chain — so chaining 3 Arrows onto a
     * single Attack hits this hook three times, and Archer's "up to
     * 3 times per turn" cap lets a single Archer answer all three
     * adds (subject to the counter).
     *
     * Damage fires DURING the chain-build window (between the Arrow
     * being added and the next reaction window iteration). The
     * `_skipReactionCheck` on the damage call prevents the bonus shot
     * from opening a NESTED reaction window, which would let the
     * opponent counter Archer's shot in the middle of building the
     * outer chain.
     */
    onReactionActivated: async (ctx) => {
      const reactionName = ctx.reactionCardName;
      const reactionOwner = ctx.reactionOwner;
      if (!reactionName || reactionOwner == null) return;
      // Only trigger off OUR own Arrows — Archer doesn't fire on opp's plays.
      if (reactionOwner !== ctx.cardOwner) return;

      const reactionScript = loadCardEffect(reactionName);
      if (!reactionScript?.isArrow) return;

      const inst = ctx.card;
      if (!inst) return;
      const used = inst.counters?._archerUsesThisTurn || 0;
      if (used >= MAX_USES) return;

      const engine = ctx._engine;
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        baseDamage: SHOT_DAMAGE,
        title: CARD_NAME,
        description: `Choose a target and deal ${SHOT_DAMAGE} damage. (${used + 1}/${MAX_USES} this turn)`,
        confirmLabel: `🏹 ${SHOT_DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      // Spend the use (only after the player commits to a target).
      if (!inst.counters) inst.counters = {};
      inst.counters._archerUsesThisTurn = used + 1;

      const targetSlot = target.type === 'equip' ? target.slotIdx : -1;
      engine._broadcastEvent('play_zone_animation', {
        type: 'electric_strike',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: targetSlot,
      });
      await engine._delay(400);

      const source = { name: CARD_NAME, owner: ctx.cardOwner, heroIdx: inst.heroIdx };
      if (target.type === 'hero') {
        const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero && hero.hp > 0) {
          await engine.actionDealDamage(source, hero, SHOT_DAMAGE, 'other', {
            _skipReactionCheck: true,
          });
        }
      } else if (target.type === 'equip' && target.cardInstance) {
        await engine.actionDealCreatureDamage(
          source, target.cardInstance, SHOT_DAMAGE, 'other',
          { sourceOwner: ctx.cardOwner, _skipReactionCheck: true }
        );
      }

      engine.log('archer_shot', {
        player: engine.gs.players[ctx.cardOwner]?.username,
        arrow: reactionName,
        target: target.cardName,
        damage: SHOT_DAMAGE,
        usesThisTurn: inst.counters._archerUsesThisTurn,
      });
      engine.sync();
    },
  },
};
