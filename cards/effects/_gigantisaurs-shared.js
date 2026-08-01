// ═══════════════════════════════════════════
//  ARCHETYPE HELPER: "Gigantisaurs"
//
//  Shared logic for the "A Hero can only have 1
//  'Gigantisaur' Creature in its Support Zones
//  at a time" rule. Consumed by every Gigantisaur
//  Creature script via a single re-exported
//  `canSummon` reference.
//
//  The helper is dual-purpose, dispatching on
//  whether the canSummon ctx targets a SPECIFIC
//  Hero or a card-wide check:
//
//    • Per-Hero check (cardHeroIdx >= 0) — fired
//      by `isCreatureSummonable(name, pi, hi)`
//      inside `getHeroPlayableCards`. Rejects
//      when THIS Hero already hosts any
//      Gigantisaur. Self-excludes the just-being-
//      summoned dummy via `selfInstId`.
//
//    • Card-wide check (cardHeroIdx === -1) —
//      fired by `getSummonBlocked(pi)`, which
//      drives the in-hand greyout. Walks every
//      Hero on the player's side and returns true
//      iff at least ONE *capable* Hero (alive,
//      not Frozen/Stunned, meets the card's level
//      requirement) doesn't already host a
//      Gigantisaur. If every capable Hero has
//      one, the card is unplayable for the rest
//      of the turn (until something dies) and
//      `getSummonBlocked` collects it for grey-
//      out.
//
//  Note: free-zone availability is intentionally
//  NOT part of the capable-Hero gate here. The
//  engine's standard "no free Support Zone"
//  check already handles that orthogonally
//  (`getHeroPlayableCards`); this helper's job
//  is the archetype-specific "1 per Hero"
//  restriction only.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ARCHETYPE = 'Gigantisaurs';

/**
 * Does this Hero currently host any Gigantisaur Creature in its
 * Support Zones? Walks `engine.cardInstances` (the source of truth
 * for tracked support occupants) and matches by archetype +
 * Creature card-type.
 *
 * @param {object} engine
 * @param {number} pi          - Hero's controller side
 * @param {number} heroIdx     - Hero whose slots we're checking
 * @param {string} [selfInstId] - Optional inst-id self-exclusion so
 *   the just-being-summoned dummy isn't counted as occupant of its
 *   own destination slot.
 */
function heroHasGigantisaur(engine, pi, heroIdx, selfInstId = null) {
  const cardDB = engine._getCardDB();
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (c.heroIdx !== heroIdx) continue;
    if (selfInstId && c.id === selfInstId) continue;
    const cd = c.counters?._cardDataOverride || cardDB[c.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd) continue;
    if (cd.archetype === ARCHETYPE && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

/**
 * Shared `canSummon` for every Gigantisaur Creature. Drop-in:
 *
 *     const { gigantisaursCanSummon } = require('./_gigantisaurs-shared');
 *     module.exports = { canSummon: gigantisaursCanSummon, ... };
 */
function gigantisaursCanSummon(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const ps = engine.gs?.players?.[pi];
  if (!ps) return false;

  const heroIdx = ctx.cardHeroIdx;
  const selfInstId = ctx.card?.id;

  // ── Per-Hero check ──
  if (typeof heroIdx === 'number' && heroIdx >= 0) {
    return !heroHasGigantisaur(engine, pi, heroIdx, selfInstId);
  }

  // ── Card-wide check (greyout signal) ──
  // At least one capable Hero on this side must NOT already host a
  // Gigantisaur. Capable = alive, not Frozen/Stunned, level-eligible
  // for the card.
  const cardData = engine._getCardDB()[ctx.cardName];
  if (!cardData) return true; // unknown — let normal flow handle.
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cardData)) continue;
    if (!heroHasGigantisaur(engine, pi, hi, selfInstId)) return true;
  }
  return false;
}

/**
 * Is this card name a Gigantisaur Creature (per cards.json)? Helper
 * used by every archetype consumer that needs to filter cards by
 * name (discard / hand / deck scans).
 */
function isGigantisaurCreature(cardName, engine) {
  if (!cardName) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  return cd.archetype === ARCHETYPE && hasCardType(cd, 'Creature');
}

/**
 * Count UNIQUE Gigantisaur Creature names in a pile array
 * (player.discardPile, player.hand, etc.). Returns `{ count, names }`
 * — names is an alphabetical-sorted list of the distinct names found.
 */
function countDistinctGigantisaursInPile(pile, engine) {
  const names = new Set();
  for (const n of (pile || [])) {
    if (isGigantisaurCreature(n, engine)) names.add(n);
  }
  return { count: names.size, names: [...names].sort() };
}

/**
 * Count Gigantisaur Creature INSTANCES in the player's support zones.
 * Returns the raw count of tracked support insts. Used by Raptoren's
 * activatable draw and any future "draw per Gigantisaur" effect.
 */
function countGigantisaursInSupport(pi, engine) {
  let n = 0;
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (isGigantisaurCreature(c.name, engine)) n++;
  }
  return n;
}

/**
 * Find a Gigantisaur Creature instance you control (excluding an
 * optional self-id). Used by sacrifice-tribute summoning paths
 * (King Trex).
 */
function findOwnedGigantisaurs(pi, engine, opts = {}) {
  const exclude = opts.excludeInstId;
  const out = [];
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (exclude && c.id === exclude) continue;
    if (isGigantisaurCreature(c.name, engine)) out.push(c);
  }
  return out;
}

module.exports = {
  ARCHETYPE,
  heroHasGigantisaur,
  gigantisaursCanSummon,
  isGigantisaurCreature,
  countDistinctGigantisaursInPile,
  countGigantisaursInSupport,
  findOwnedGigantisaurs,
};
