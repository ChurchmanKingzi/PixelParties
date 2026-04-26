// ═══════════════════════════════════════════
//  CARD EFFECT: "Friendship"
//  Ability — Three-level passive effect:
//
//  ALL LEVELS: Grants 1 additional Action per
//  turn for Support Magic Spells. Hero-restricted
//  (only the hero with Friendship can use it).
//
//  LEVEL 1: Can only be used if no Support Spells
//  were used this turn. Using it applies a global
//  "no more Support Spells" debuff for the turn.
//
//  LEVEL 2: No restriction. When this hero uses
//  a Support Spell, draw 1 card (HOPT per hero).
//
//  LEVEL 3: Same as Lv2 but draw 3 cards.
// ═══════════════════════════════════════════

const ADDITIONAL_TYPE_PREFIX = 'friendship_support';

function getTypeId(heroIdx) {
  return `${ADDITIONAL_TYPE_PREFIX}_${heroIdx}`;
}

/**
 * Get the Friendship level for a specific hero.
 * Returns the count of 'Friendship' (+ Performance wildcards) in the ability zones.
 */
function getFriendshipLevel(ps, heroIdx) {
  const abZones = ps.abilityZones[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length === 0) continue;
    if (slot[0] === 'Friendship') return slot.length;
    // Check if Friendship is anywhere in the stack (Performance on top)
    if (slot.includes('Friendship')) return slot.length;
  }
  return 0;
}

/**
 * Build the filter function for the additional action.
 * Captures engine + player references for dynamic checks.
 */
function buildFilter(engine, pi, heroIdx) {
  return (cardData) => {
    if (!cardData || cardData.cardType !== 'Spell' || cardData.spellSchool1 !== 'Support Magic') return false;

    const ps = engine.gs.players[pi];
    if (!ps) return false;

    // Lv1 restriction: no Support Spells used yet this turn
    const level = getFriendshipLevel(ps, heroIdx);
    if (level <= 1) {
      if (ps.supportSpellUsedThisTurn || ps.supportSpellLocked) return false;
    }

    // Global lock check
    if (ps.supportSpellLocked) return false;

    // Check if this hero can cast the spell (spell school level requirements)
    const spellLevel = cardData.level || 0;
    if (spellLevel > 0) {
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;
      if (hero.statuses?.negated || hero.statuses?.frozen || hero.statuses?.stunned) return false;
      if (!engine.heroMeetsLevelReq(pi, heroIdx, cardData)) return false;
    }

    return true;
  };
}

/**
 * Register the additional action type and grant the action.
 */
function setupAdditionalAction(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const level = getFriendshipLevel(ps, heroIdx);
  if (level <= 0) return;

  const typeId = getTypeId(heroIdx);
  engine.registerAdditionalActionType(typeId, {
    label: 'Friendship',
    allowedCategories: ['spell'],
    heroRestricted: true,
    filter: buildFilter(engine, pi, heroIdx),
  });

  // Find the Friendship card instance for this hero to grant the action
  const friendshipInst = engine.cardInstances.find(c =>
    c.owner === pi && c.zone === 'ability' && c.heroIdx === heroIdx && c.name === 'Friendship'
  );
  if (friendshipInst) {
    engine.grantAdditionalAction(friendshipInst, typeId);
  }
}

module.exports = {
  activeIn: ['ability'],
  // Lizbeth/Smugbeth: auto-mirror disabled. Friendship's setup uses
  // `getFriendshipLevel(ps, heroIdx)` and `setupAdditionalAction(...)`
  // keyed on the borrower's own (Lizbeth's) heroIdx where Friendship
  // doesn't actually live, so the level/draw resolves to 0. Phase 3
  // punch list.
  disableLizbethMirror: true,

  hooks: {
    /**
     * On play: register and grant the additional action.
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      setupAdditionalAction(engine, pi, heroIdx);
      engine.sync();
    },

    /**
     * On turn start: re-register and re-grant.
     */
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      setupAdditionalAction(engine, pi, heroIdx);
    },

    /**
     * After a spell resolves: Lv2/3 draw trigger.
     * Draws 1 (Lv2) or 3 (Lv3) cards when this hero uses a Support Spell.
     * HOPT per Friendship hero.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      // Only trigger for spells cast by THIS hero
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Only for Support Magic Spells
      const spellData = ctx.spellCardData;
      if (!spellData || spellData.spellSchool1 !== 'Support Magic') return;

      const level = getFriendshipLevel(ps, heroIdx);
      if (level < 2) return; // Lv1 doesn't draw

      // HOPT check per Friendship hero
      const hoptKey = `friendship-draw:${pi}:${heroIdx}`;
      if (!engine.claimHOPT(hoptKey, pi)) return;

      const drawCount = level >= 3 ? 3 : 1;

      // Play sparkle animation on Friendship's ability zone
      const abZones = ps.abilityZones[heroIdx] || [];
      for (let z = 0; z < 3; z++) {
        if ((abZones[z] || []).includes('Friendship')) {
          engine._broadcastEvent('ability_activated', {
            owner: pi, heroIdx, zoneIdx: z, abilityName: 'Friendship',
          });
          break;
        }
      }
      await engine._delay(300);

      // Draw cards
      await engine.actionDrawCards(pi, drawCount);

      engine.log('friendship_draw', { player: ps.username, hero: ps.heroes[heroIdx]?.name, cards: drawCount, level });
    },
  },
};
