// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Interception"
//  Spell (Destruction Magic Lv2, subtype Reaction)
//
//  "Play this card immediately when your opponent chooses a target you
//   control with an Attack, Spell or Creature effect. Sacrifice a
//   'Chaorc' Creature you control that is not the original target to
//   negate that Attack, Spell or effect. Delete this card."
//
//  Reaction-only (Storm Ring contract): exports `isPostTargetReaction`
//  and NEITHER `proactivePlay` NOR `isReaction`, so it can never be
//  clicked proactively in hand and the reaction-chain collector skips
//  it — it acts solely through the engine's post-target hand-reaction
//  hub (`_checkPostTargetHandReactions`), which fires after the
//  opponent has chosen targets but before the effect resolves, for
//  Attacks, Spells AND Creature effects that route through the
//  targeting pickers.
//
//  The hub auto-handles the activate prompt, the casting-Hero level /
//  school check (it's a Destruction Magic Lv2 Spell), the hand→pile
//  flight and the reveal. `deleteOnUse: true` sends it to the DELETED
//  pile ("Delete this card") instead of the discard. We pay the
//  sacrifice cost in `postTargetResolve` and return
//  `{ effectNegated: true }` to fizzle the source.
// ═══════════════════════════════════════════

const { isChaorcCreature } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Interception';

/** Identity keys (instance id + slot) of the source's chosen targets,
 *  so a sacrificed Chaorc is never "the original target". */
function targetKeys(targetedHeroes) {
  const ids = new Set();
  const slots = new Set();
  for (const t of (targetedHeroes || [])) {
    if (t?.cardInstance?.id) ids.add(t.cardInstance.id);
    if (t?.id != null) ids.add(t.id);
    if (t?.owner != null && t?.slotIdx != null) slots.add(`${t.owner}:${t.heroIdx}:${t.slotIdx}`);
  }
  return { ids, slots };
}

/** Sacrificable Chaorc Creatures `pi` controls that are NOT among the
 *  source's chosen targets. */
function availableTributes(engine, pi, targetedHeroes) {
  const { ids, slots } = targetKeys(targetedHeroes);
  return engine.getSacrificableCreatures(pi).filter(c => {
    if (!isChaorcCreature(c.cardName, engine)) return false;
    if (ids.has(c.inst.id)) return false;
    if (slots.has(`${c.inst.owner}:${c.inst.heroIdx}:${c.inst.zoneSlot}`)) return false;
    return true;
  });
}

module.exports = {
  isPostTargetReaction: true,
  // "Delete this card" — the hub routes deleteOnUse reactions to the
  // deleted pile instead of discard.
  deleteOnUse: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard /*, opts */) {
    // "your OPPONENT chooses a target" — opponent-sourced only.
    const srcOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;
    // "a target YOU control" — at least one chosen target is yours.
    if (!Array.isArray(targetedHeroes) || !targetedHeroes.some(t => t?.owner === pi)) return false;
    // Need a non-target Chaorc Creature to sacrifice.
    return availableTributes(engine, pi, targetedHeroes).length > 0;
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard /*, opts */) {
    // Pay the sacrifice. The hub already removed Chaorc Interception
    // from hand (→ deleted pile), so we build a lightweight ctx shim
    // for `resolveSacrificeCost`. Non-cancellable: activation already
    // committed the card, and the condition guaranteed a valid tribute.
    const tributeIds = new Set(availableTributes(engine, pi, targetedHeroes).map(c => c.inst.id));
    if (tributeIds.size === 0) return null;

    const shimCtx = {
      cardOwner: pi,
      card: { id: null },
      cardName: CARD_NAME,
      cardHeroIdx: -1,
    };

    const paid = await engine.resolveSacrificeCost(shimCtx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice a "Chaorc" Creature you control (not the original target) to negate the effect.',
      confirmLabel: '🗡️ Negate!',
      confirmClass: 'btn-danger',
      cancellable: false,
      filter: (c) => tributeIds.has(c.inst.id),
    });
    if (!paid) return null;

    engine.log('chaorc_interception_negate', {
      player: engine.gs.players[pi]?.username,
      source: sourceCard?.name || '?',
    });
    return { effectNegated: true };
  },
};
