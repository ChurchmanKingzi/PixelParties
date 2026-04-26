// ═══════════════════════════════════════════
//  CARD EFFECT: "Smug Mastermind Antonia"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Active effect (free, once per turn — standard
//  creatureEffect HOPT keyed on instance id):
//
//    Place a "Cool Rescuer Monia" from your hand
//    or deck underneath this Creature.
//
//  While Monia is attached:
//    • +200 HP (current and max).
//    • Up to 2× per turn, when a Creature you
//      control takes damage, you may discard a
//      card to choose any non-Hero card on the
//      board and send it to the discard pile.
//
//  Trigger gate quirk — "Antonia damaged + dies
//  → does NOT trigger" is naturally satisfied by
//  the engine: AFTER_CREATURE_DAMAGE_BATCH fires
//  after the death loop has already untracked
//  dead instances, so a dead Antonia's hook
//  never runs. The other rule cases all fall
//  out of "any creature on Antonia's side took
//  damage in this batch".
// ═══════════════════════════════════════════

const ATTACHABLE = 'Cool Rescuer Monia';
const HOPT_KEY   = '_antoniaTriggersThisTurn';
const MAX_TRIGGERS = 2;

function triggersUsed(card) {
  return (card?.counters && card.counters[HOPT_KEY]) || 0;
}
function reserveTrigger(card) {
  if (!card.counters) card.counters = {};
  card.counters[HOPT_KEY] = triggersUsed(card) + 1;
}
function refundTrigger(card) {
  if (!card?.counters) return;
  const n = triggersUsed(card);
  if (n <= 1) delete card.counters[HOPT_KEY];
  else card.counters[HOPT_KEY] = n - 1;
}

/**
 * Every non-hand / non-discard / non-deck instance counts as a non-Hero
 * board target. Immunity counters (`_cardinalImmune`, `_stealImmortal`,
 * first-turn protection) are intentionally NOT filtered here: the user
 * wants the player to be able to TARGET an immune card and have the
 * destroy fizzle visibly (matching the "animations still play" rule
 * the slime/vial/tea status applies follow). The engine's
 * `actionDestroyCard` already returns silently on each of those gates
 * with a `destroy_blocked` log entry — no double-destroy risk. The
 * picker only filters `immovable`, which represents "literally part of
 * the world geometry" rather than a status-style immunity, and would
 * be silly to keep clicking.
 */
function collectNonHeroBoardTargets(gs, engine) {
  const targets = [];
  const seen = new Set();

  for (const inst of engine.cardInstances) {
    if (
      inst.zone === 'hand' || inst.zone === 'discard' ||
      inst.zone === 'deleted' || inst.zone === 'hero' || inst.zone === 'deck'
    ) continue;
    if (inst.counters?.immovable) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'ability') {
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({
        id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'permanent') {
      targets.push({
        id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
        type: 'perm', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'area') {
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({
        id: `area-${inst.owner}`,
        type: 'area', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'surprise') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-surprise`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
        cardName: inst.name, _cardInstance: inst,
      });
    }
  }

  return targets;
}

/**
 * Resolve one trigger: target picker → discard 1 → destroy. Returns true
 * iff the destroy actually committed (so the caller can refund the
 * reserved trigger slot otherwise).
 */
async function runAntoniaEffect(ctx) {
  const engine = ctx._engine;
  const gs     = engine.gs;
  const pi     = ctx.cardOwner;
  const ps     = gs.players[pi];
  if (!ps) return false;

  // No card to discard → effect can't pay its cost; bail without using
  // up the trigger.
  if ((ps.hand || []).length === 0) return false;

  const boardTargets = collectNonHeroBoardTargets(gs, engine);
  if (boardTargets.length === 0) return false;

  // Pick a board target first (cancellable). The discard cost is taken
  // only after the player commits to a target, so a cancel doesn't burn
  // a card.
  const pick = await engine.promptEffectTarget(pi, boardTargets, {
    title: 'Smug Mastermind Antonia',
    description: 'Discard a card to destroy any non-Hero card on the board.',
    confirmLabel: '🗑️ Eliminate!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1, ability: 1, perm: 1, area: 1, surprise: 1 },
  });
  if (!pick || pick.length === 0) return false;

  const sel = boardTargets.find(t => t.id === pick[0]);
  if (!sel?._cardInstance) return false;
  const targetInst = sel._cardInstance;

  // Race: prompt was open long enough for hand to empty (e.g. an
  // interleaved discard-everything from another hook). Refund silently.
  if ((ps.hand || []).length === 0) return false;

  await engine.actionPromptForceDiscard(pi, 1, {
    title: 'Smug Mastermind Antonia — Discard 1',
    source: 'Smug Mastermind Antonia',
    selfInflicted: true,
  });

  const dmgSource = { name: 'Smug Mastermind Antonia', owner: pi };
  await engine.actionDestroyCard(dmgSource, targetInst);

  engine.log('antonia_destroy', {
    player: ps.username,
    target: targetInst.name,
  });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    if (ctx.card.counters?.attachedHero) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hasMonia = (ps.hand || []).includes(ATTACHABLE)
      || (ps.mainDeck || []).includes(ATTACHABLE);
    return hasMonia;
  },

  async onCreatureEffect(ctx) {
    return await ctx._engine.actionAttachHeroToCreature(
      ctx.cardOwner, ATTACHABLE, ctx.card,
      { source: 'Smug Mastermind Antonia' },
    );
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 200);
  },

  cpuMeta: { alwaysCommit: true },

  hooks: {
    onTurnStart: (ctx) => {
      if (ctx.card?.counters && ctx.card.counters[HOPT_KEY] != null) {
        delete ctx.card.counters[HOPT_KEY];
      }
    },

    /**
     * "Up to 2 per turn, when a Creature you control takes damage". Each
     * damaged creature in the batch is its own trigger event — a single
     * AOE that lands on two of Antonia's creatures should produce two
     * fires (capped by remaining per-turn triggers). Fires after the
     * damage batch has resolved (and dead creatures untracked) — so
     * Antonia herself dying naturally suppresses her own trigger because
     * runHooks won't dispatch to an untracked instance.
     */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.card.counters?.attachedHero) return;
      // Defensive: dead-but-still-tracked edge case — the batch could
      // mark Antonia at 0 HP without untracking yet under unusual orderings.
      if ((ctx.card.counters?.currentHp || 0) <= 0) return;

      if (triggersUsed(ctx.card) >= MAX_TRIGGERS) return;

      const entries = ctx.entries || [];
      const myController = ctx.cardOwner;
      const damagedCount = entries.reduce((n, e) => (
        e?.inst &&
        !e.cancelled &&
        (e.inst.controller ?? e.inst.owner) === myController &&
        (e.amount || 0) > 0
      ) ? n + 1 : n, 0);
      if (damagedCount === 0) return;

      // Run up to (remaining per-turn triggers) ∩ (damaged-creature
      // count) iterations. Each iteration reserves a trigger up front
      // (so a re-entrant batch can't steal a slot mid-prompt) and
      // refunds on cancel — meaning the player can stop early by
      // cancelling the second prompt and the unused trigger goes back
      // into the per-turn budget.
      const fires = Math.min(damagedCount, MAX_TRIGGERS - triggersUsed(ctx.card));
      for (let i = 0; i < fires; i++) {
        // Re-check survival between iterations — Antonia might die to
        // an interleaved effect launched from her own destroy.
        if ((ctx.card.counters?.currentHp || 0) <= 0) break;
        if (triggersUsed(ctx.card) >= MAX_TRIGGERS) break;

        reserveTrigger(ctx.card);
        let fired = false;
        try {
          fired = await runAntoniaEffect(ctx);
        } catch (err) {
          console.error('[Antonia] effect threw:', err.message);
        }
        if (!fired) {
          refundTrigger(ctx.card);
          // Cancel propagates — stop offering further triggers from
          // this batch (the player explicitly declined).
          break;
        }
      }
    },
  },
};
