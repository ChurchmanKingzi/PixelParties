// ═══════════════════════════════════════════
//  CARD EFFECT: "Thalia, the Fun Fairy"
//  Hero — Friendship / Friendship
//
//  PASSIVE 1: While this Hero is on the board,
//  every Support Magic Spell in your hand has
//  its level reduced by Thalia's Friendship
//  level. Applies to plays by ANY of your
//  Heroes, not just Thalia herself.
//
//  PASSIVE 2: While this Hero is alive on your
//  side, you do not draw cards through the
//  effect of Friendship. Friendship's Lv2/3
//  draw rider checks `hasActiveThaliaOnSide`
//  on the same side before drawing, and skips
//  the entire sparkle+draw block if Thalia is
//  active. Independent of Thalia owning a
//  Friendship herself — the negation is a
//  side-wide rule whenever Thalia is active.
//
//  IMPLEMENTATION: hooks the engine's per-side
//  `reduceCardLevel` pass — the engine walks
//  every card instance the player controls
//  during a level check (`heroMeetsLevelReq`)
//  and sums their reductions, regardless of
//  which Hero is doing the check. Reading
//  Friendship from Thalia's own ability slot
//  matches Friendship's `getFriendshipLevel`
//  helper (counts stacked copies + Performance
//  wildcards layered on top).
//
//  STATUS GATE: both passives are silenced if
//  Thalia is dead, Frozen, Stunned, or Negated —
//  matching the standard hero-effect filter.
//  No bypassStatusFilter (both effects ARE
//  hero-typed passives, so they follow the
//  normal silenced-while-disabled rules).
// ═══════════════════════════════════════════

const CARD_NAME = 'Thalia, the Fun Fairy';

/**
 * Thalia's Friendship level on this player's side. Walks the side's
 * Heroes for one named Thalia, then her ability zones for Friendship's
 * stack size — Friendship Lv1/2/3 corresponds to slot length 1/2/3,
 * including Performance wildcards stacked on top. Returns 0 when:
 *   - no Thalia on this side
 *   - Thalia is dead (hp ≤ 0)
 *   - Thalia is Frozen / Stunned / Negated (hero effects silenced)
 *   - Thalia has no Friendship in any ability slot
 */
function getThaliaFriendshipLevel(engine, ownerIdx) {
  const ps = engine.gs?.players?.[ownerIdx];
  if (!ps?.heroes) return 0;
  for (let hi = 0; hi < ps.heroes.length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.name !== CARD_NAME) continue;
    if (hero.hp <= 0) return 0;
    if (hero.statuses?.negated || hero.statuses?.frozen || hero.statuses?.stunned) return 0;
    const abZones = ps.abilityZones?.[hi] || [];
    for (let z = 0; z < 3; z++) {
      const slot = abZones[z] || [];
      if (slot.length === 0) continue;
      // Match Friendship's own helper: trigger if Friendship is at the
      // base of the stack OR anywhere in it (Performance covering it).
      if (slot[0] === 'Friendship' || slot.includes('Friendship')) {
        return slot.length;
      }
    }
    return 0;
  }
  return 0;
}

/**
 * True iff side `ownerIdx` has a Thalia who is alive AND not silenced
 * (not Negated / Frozen / Stunned). Used by Friendship's draw rider to
 * decide whether to skip the Lv2/3 draw — does NOT require Thalia to
 * own Friendship herself (it's a side-wide rule keyed only on Thalia
 * being on the board and active).
 */
function hasActiveThaliaOnSide(engine, ownerIdx) {
  const ps = engine.gs?.players?.[ownerIdx];
  if (!ps?.heroes) return false;
  for (const hero of ps.heroes) {
    if (!hero?.name || hero.name !== CARD_NAME) continue;
    if (hero.hp <= 0) continue;
    if (hero.statuses?.negated || hero.statuses?.frozen || hero.statuses?.stunned) continue;
    return true;
  }
  return false;
}

module.exports = {
  activeIn: ['hero'],

  /**
   * Per-side card-level reducer. Engine calls this once per Thalia hero
   * instance during every `heroMeetsLevelReq` check, summing across all
   * reducers on the player's side. Subtracts Thalia's Friendship level
   * from any Support Magic Spell, regardless of which Hero is checking.
   */
  reduceCardLevel(cardData, engine, ownerIdx) {
    if (!cardData) return 0;
    if (cardData.cardType !== 'Spell') return 0;
    if (cardData.spellSchool1 !== 'Support Magic') return 0;
    return getThaliaFriendshipLevel(engine, ownerIdx);
  },

  // Exported for Friendship's afterSpellResolved draw gate.
  hasActiveThaliaOnSide,
};
