// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Phoenix"
//  Creature (Summoning Magic Lv 3, 50 HP — Cute archetype)
//
//  Three effects:
//
//  1. UNIQUENESS — only one "Cute Phoenix" may
//     be on a player's side at a time. Enforced
//     via the engine's `canSummon` hook.
//
//  2. ACTIVE — once per turn, deal 50 damage
//     to any target × the number of Creatures
//     in the controller's discard pile. The
//     damage is uncategorised ("other" type),
//     so it bypasses fire / status / etc.
//     resistances. Animation: a flame strike on
//     the target.
//
//  3. SELF-REVIVE — if defeated by an
//     opponent's card or effect (NOT by status
//     ticks like Burn/Poison or self-inflicted
//     damage), the controller may discard 2
//     cards to revive Cute Phoenix in the same
//     Support Zone with full HP. Implemented
//     via the standard `_reviveAfterDeath` flag
//     the engine reads after `onCreatureDeath`.
//     The revive uses `summonCreatureWithHooks`
//     internally (skipHooks: true), so on-play
//     effects don't double-fire.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cute Phoenix';

function countCreaturesInDiscard(engine, ps) {
  if (!ps?.discardPile) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const cn of ps.discardPile) {
    const cd = cardDB[cn];
    if (cd && hasCardType(cd, 'Creature')) n++;
  }
  return n;
}

module.exports = {
  activeIn: ['support'],

  // ── CPU evaluation hints ──────────────────────────────────────────
  // Two complementary signals tell the brain how to value Phoenix:
  //
  //   chainSource — own Creature deaths discount the slot value of
  //     dying Creatures while Phoenix is armed, so MCTS sees them
  //     as cheap fodder to feed her. Phoenix herself skips the
  //     chain bonus (chain sources don't discount themselves).
  //
  //   pileFuel — generic eval contribution: Phoenix on board (1.0)
  //     or in hand (0.5) makes EACH Creature in her controller's
  //     discard pile worth +50 to that side's score, and EACH
  //     Creature still in the deck worth +10 (latent fuel — see
  //     `_cpu.js` for the full machinery). Combined with the
  //     forceDiscard simulator pushing candidates into discardPile
  //     before re-scoring, the brain sees "discarding a Creature
  //     feeds my Phoenix" as actively beneficial — across every
  //     prompted discard generically (Cute Dog tutor cost, Cute
  //     Hydra head counters, Wisdom cost, hand-limit cleanup, etc.).
  //     The deck term is gated at deck.length ≥ 21 so the bonus
  //     auto-stops once the existing deck-out penalty starts
  //     charging the brain per missing card.
  //
  //     `stackable: false` — Phoenix is uniqueness-locked at 1
  //     active per side. Multiple copies (e.g. 1 on board + 1 in
  //     hand) take the MAX weight (1.0), not summed.
  cpuMeta: {
    chainSource: {
      isArmed(engine, inst) {
        if (!inst) return false;
        if (inst.counters?.negated || inst.counters?.nulled) return false;
        return true;
      },
      triggersOn(engine, tributeInst, sourceInst) {
        if (!tributeInst || !sourceInst) return false;
        if (tributeInst.id === sourceInst.id) return false;
        if (tributeInst.name === CARD_NAME) return false;
        const cd = engine._getCardDB()[tributeInst.name];
        return !!(cd && hasCardType(cd, 'Creature'));
      },
      valuePerTrigger: 50,
    },
    pileFuel: {
      presenceWeights: { support: 1.0, hand: 0.5 },
      stackable: false,
      discardFilter: (cd) => hasCardType(cd, 'Creature'),
      discardValue: 50,
      deckFilter: (cd) => hasCardType(cd, 'Creature'),
      deckValue: 10,
      deckMinSize: 21,
    },
  },

  /**
   * CPU prompt response — the engine's default `cpuGenericChoice`
   * declines cancellable confirms (returns null), which would make
   * the CPU refuse Phoenix's revive every time. Override to confirm
   * — the 2-card discard cost is paid via the standard forceDiscard
   * handler immediately afterwards, which picks the least-valuable
   * cards (and protects Ascended Heroes / scarce singletons via the
   * value scorer).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm'
        && /Revive/i.test(promptData.confirmLabel || '')) {
      return { confirmed: true };
    }
    return undefined;
  },

  /**
   * Uniqueness gate: deny summon if a Cute Phoenix instance is already
   * on this player's side. The `ctx.card.id` self-exclusion prevents
   * the just-being-summoned dummy from blocking itself.
   */
  canSummon(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    for (const c of engine.cardInstances) {
      if (c.zone !== 'support') continue;
      if (c.name !== CARD_NAME) continue;
      if ((c.controller ?? c.owner) !== pi) continue;
      if (c.id === ctx.card.id) continue;
      return false;
    }
    return true;
  },

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    return countCreaturesInDiscard(engine, ps) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const count = countCreaturesInDiscard(engine, ps);
    const damage = 50 * count;
    if (damage <= 0) return false;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      title: CARD_NAME,
      description: `Deal ${damage} damage (50 × ${count} Creatures in discard) to any target.`,
      confirmLabel: `🔥 Burn! (${damage})`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtZoneSlot,
    });
    await engine._delay(300);

    const dmgSource = { name: CARD_NAME, owner: pi, heroIdx };
    if (target.type === 'hero') {
      const h = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (h && h.hp > 0) await engine.actionDealDamage(dmgSource, h, damage, 'other');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        dmgSource, target.cardInstance, damage, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('cute_phoenix_burn', {
      player: ps.username, target: target.cardName, damage, discardCount: count,
    });
    engine.sync();
    return true;
  },

  hooks: {
    /**
     * Self-revive on death. Fires when Cute Phoenix herself dies — we
     * verify by matching `ctx.creature.instId` to the listener's
     * `ctx.card.id`. Source must be an opponent's card/effect (not a
     * status tick like Burn/Poison and not self-inflicted). The
     * controller may pay 2 hand discards to stamp `_reviveAfterDeath`,
     * which the engine consumes after `_untrackCard` fires and
     * re-summons Cute Phoenix into her original slot at full HP.
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.instId !== ctx.card.id) return;

      // Must be defeated by an opponent's card / effect.
      const source = ctx.source;
      const srcOwner = source?.controller ?? source?.owner ?? -1;
      if (srcOwner < 0 || srcOwner === ctx.cardOwner) return;
      // Status / burn / poison ticks are excluded by the spec
      // ("opponent's card or effect" reads as direct effects, not the
      // residual ticks of an applied status).
      if (['status', 'burn', 'poison'].includes(ctx.type)) return;

      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      if (!ps) return;

      // Need at least 2 cards in hand to pay the discard cost.
      if ((ps.hand || []).length < 2) return;

      const confirmed = await engine.promptGeneric(ctx.cardOwner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${CARD_NAME} was defeated! Discard 2 cards to revive at full HP in the same Support Zone?`,
        confirmLabel: '🔥 Revive!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in revive.
      });
      if (!confirmed) return;

      // Pay 2 discards. The standard force-discard prompt lets the
      // player pick — `selfInflicted: true` skips first-turn shield.
      await engine.actionPromptForceDiscard(ctx.cardOwner, 2, {
        title: `${CARD_NAME} — Discard 2`,
        source: CARD_NAME,
        selfInflicted: true,
      });

      // Stamp the revive flag — the engine's death-batch processor
      // reads `_reviveAfterDeath` after `_untrackCard` and re-summons
      // a fresh instance into the original slot with no on-play hooks.
      ctx.card._reviveAfterDeath = {
        name: ctx.card.name,
        owner: ctx.card.owner,
        originalOwner: ctx.card.originalOwner,
        heroIdx: ctx.card.heroIdx,
        zoneSlot: ctx.card.zoneSlot,
        by: CARD_NAME,
      };

      engine.log('cute_phoenix_revive', {
        player: ps.username, source: source?.name || ctx.type,
      });
    },
  },
};
