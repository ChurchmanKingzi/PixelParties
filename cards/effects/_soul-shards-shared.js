// ═══════════════════════════════════════════
//  Shared helpers for the "Soul Shards"
//  archetype.
//
//  Eight Creatures (Ba, Ib, Ka, Khet, Ren, Sah,
//  Sekhem, Shut) themed around ancient-Egyptian
//  soul fragments. The whole archetype shares
//  three rules:
//
//  1. NECROMANCY BYPASS — "This Creature's
//     effects don't get negated when it's
//     summoned by the effect of Necromancy."
//     Necromancy normally negates the placed
//     Creature's effects until next turn; Soul
//     Shards opt out via the script-level
//     `bypassNecromancyNegation: true` flag,
//     which Necromancy reads before it would
//     call `actionNegateCreature`.
//
//  2. PER-NAME 1/TURN CAP — "You can only
//     summon 1 X per turn." Counts ALL summons
//     (hand play, Necromancy, placement, …),
//     not just discard summons. Implemented via
//     `ps._soulShardSummonedThisTurn[<name>]`
//     stamped in onPlay and consulted by
//     `canSummonSoulShard`. Engine resets the
//     map at turn start (see `_engine.js`
//     `startTurn` near the Guardian-Beast flag
//     reset).
//
//  3. DISCARD-PILE TRIGGER — every Shard except
//     Sah gates its unique effect on
//     `ctx._summonedFromDiscard === true`. Sah
//     uses the stricter `_summonedByNecromancy`.
//     Both flags are stamped in Necromancy's
//     onPlay/onCardEnterZone hookExtras (see
//     `necromancy.js`). Other discard-summon
//     paths can opt in by passing the same flag
//     in their `summonCreatureWithHooks`
//     hookExtras.
//
//  The loader skips files starting with "_", so
//  this module is private infrastructure and
//  never loaded as a card.
// ═══════════════════════════════════════════

const ARCHETYPE = 'Soul Shards';

const SOUL_SHARD_NAMES = new Set([
  'Soul Shard Ba',
  'Soul Shard Ib',
  'Soul Shard Ka',
  'Soul Shard Khet',
  'Soul Shard Ren',
  'Soul Shard Sah',
  'Soul Shard Sekhem',
  'Soul Shard Shut',
]);

/** Is this card name one of the eight Soul Shard Creatures? */
function isSoulShard(cardName) {
  return SOUL_SHARD_NAMES.has(cardName);
}

/** Has the player already summoned a copy of this Soul Shard this turn? */
function wasSoulShardSummonedThisTurn(gs, pi, cardName) {
  const ps = gs?.players?.[pi];
  if (!ps?._soulShardSummonedThisTurn) return false;
  return !!ps._soulShardSummonedThisTurn[cardName];
}

/** Stamp the per-name 1/turn flag on the player. Idempotent. */
function markSoulShardSummoned(gs, pi, cardName) {
  const ps = gs?.players?.[pi];
  if (!ps) return;
  if (!ps._soulShardSummonedThisTurn) ps._soulShardSummonedThisTurn = {};
  ps._soulShardSummonedThisTurn[cardName] = true;
}

/**
 * Shared `canSummon(ctx)` predicate for every Soul Shard Creature.
 * Returns false when the player has already summoned a copy of THIS
 * Shard this turn — covers hand plays, Necromancy revives, placement
 * effects, and any other summon path. The check runs against the
 * NAME of the card being summoned, NOT the listener — `ctx.cardName`
 * is the canonical "what's about to be summoned" handle the engine
 * exposes inside `canSummon` checks.
 */
function canSummonSoulShard(ctx) {
  const engine = ctx?._engine;
  const pi = ctx?.cardOwner;
  const cardName = ctx?.cardName;
  if (engine == null || pi == null || !cardName) return true;
  return !wasSoulShardSummonedThisTurn(engine.gs, pi, cardName);
}

/**
 * Count distinct creature NAMES currently in the player's discard pile.
 * Used by Soul Shard Ib's heal scaling. Tokens count too — they're
 * named cards in the pile.
 */
function distinctCreatureNamesInDiscard(engine, pi) {
  const ps = engine.gs?.players?.[pi];
  if (!ps?.discardPile) return 0;
  const cardDB = engine._getCardDB();
  const seen = new Set();
  for (const name of ps.discardPile) {
    if (seen.has(name)) continue;
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Creature') continue;
    seen.add(name);
  }
  return seen.size;
}

/**
 * Count distinct Soul Shard NAMES currently on the board (both sides
 * unless `ownerIdx` is provided). Used by Soul Shard Sekhem's damage
 * scaling — "50 × different Soul Shard Creatures on the board
 * (including this one)".
 */
function distinctSoulShardsOnBoard(engine, ownerIdx) {
  const seen = new Set();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!isSoulShard(inst.name)) continue;
    if (ownerIdx != null && (inst.controller ?? inst.owner) !== ownerIdx) continue;
    seen.add(inst.name);
  }
  return seen.size;
}

/**
 * Shared `cpuMeta.pileFuel` template for every Soul Shard Creature
 * AND for Thep (the host Hero whose effect re-summons Shards from
 * discard). The pileFuel framework in `_cpu.js` rewards `discardValue`
 * per matching name in the OWNER'S discard pile when the declaring
 * card is "active" (presence weight > 0 for its current zone). For
 * Soul Shards this means: every Shard you control or hold in hand
 * makes EACH Shard in your discard pile worth `discardValue` extra
 * eval points. The brain's forceDiscard / Magenta-mill / search
 * prompts read this through `evaluateState` delta, so a Soul Shard
 * leaving HAND or DECK for the discard pile flips evaluator-positive
 * — the CPU naturally seeds its discard with Shards before trying
 * to revive them.
 *
 * `stackable: false` because the per-controller "uniqueness-locked"
 * Shards take MAX weight across copies, not summed (two Sahs in hand
 * isn't twice as valuable as one).
 *
 * Latent deck fuel (`deckValue`) credits Shards still in the deck
 * — enables tutor / mill / discard paths to look attractive even
 * before the first Shard reaches the pile. Gated at `deckMinSize: 22`
 * so the bonus auto-disables when deck-out becomes a real risk.
 *
 * presence weight on `hero` covers Thep — a living Thep is a Shard
 * reanimator the eval rewards just like an on-board Shard would.
 */
const SOUL_SHARD_PILE_FUEL = {
  presenceWeights: { support: 1.0, hand: 0.6, hero: 1.0 },
  stackable: false,
  discardFilter: (cd) => isSoulShard(cd?.name),
  discardValue: 50,
  deckFilter: (cd) => isSoulShard(cd?.name),
  deckValue: 10,
  deckMinSize: 22,
};

module.exports = {
  ARCHETYPE,
  SOUL_SHARD_NAMES,
  SOUL_SHARD_PILE_FUEL,
  isSoulShard,
  wasSoulShardSummonedThisTurn,
  markSoulShardSummoned,
  canSummonSoulShard,
  distinctCreatureNamesInDiscard,
  distinctSoulShardsOnBoard,
};
