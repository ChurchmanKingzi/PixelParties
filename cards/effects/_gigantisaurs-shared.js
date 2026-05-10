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
    const cd = cardDB[c.name];
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

module.exports = {
  ARCHETYPE,
  heroHasGigantisaur,
  gigantisaursCanSummon,
};
