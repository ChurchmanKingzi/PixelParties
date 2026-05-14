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

const { loadCardEffect } = require('./_loader');

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
     * After a spell resolves: Lv2/3 draw rider.
     *
     * The draw is now tied DIRECTLY to the additional-action grant —
     * fires only when the spell was just played AS Friendship's
     * additional action. Spells normally cast from the same hero
     * (regular Action / Main-phase plays) get no draw, and the per-
     * turn cap is enforced naturally by the additional action's
     * own `additionalActionAvail` token (granted once per turn,
     * consumed exactly once → draw at most once per turn). No
     * separate HOPT needed.
     *
     * Mandatory and silent: `engine.actionDrawCards` doesn't prompt,
     * so the player can't decline.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];

      // Gate on "was THIS spell played as Friendship's additional
      // action on THIS Hero?". server.js's spell-play path stamps
      // `ctx.viaAdditionalProvider` with the consumed provider inst
      // (or null when the play was a normal action). We require the
      // provider to be a Friendship card belonging to the same
      // (player, hero) pair as the listener — if Friendship-A's
      // additional action fired Heal on Hero-A and Friendship-B is
      // also on the board, only Friendship-A draws.
      //
      // Stack-instance gate (`provider.id !== ctx.card.id`): at Lv2/3
      // multiple Friendship copies are stacked in the same ability
      // slot — every copy is a separate cardInstance and runHooks
      // dispatches `afterSpellResolved` to ALL of them. Without this
      // ID match, each stacked Friendship would draw its full quota
      // (Lv3 → 3 listeners × 3 cards = 9 instead of 3). Only the
      // single instance whose additionalActionAvail token was
      // consumed draws.
      const provider = ctx.viaAdditionalProvider;
      if (!provider || provider.name !== 'Friendship') return;
      if (provider.owner !== pi || provider.heroIdx !== heroIdx) return;
      if (provider.id !== ctx.card?.id) return;

      // Sanity: the spell must still be a Support Magic Spell. The
      // additional-action filter already enforces this at play time,
      // but defensive: a future change to the filter shouldn't silently
      // start drawing on Trick / Destruction Magic.
      const spellData = ctx.spellCardData;
      if (!spellData || spellData.spellSchool1 !== 'Support Magic') return;

      const level = getFriendshipLevel(ps, heroIdx);
      if (level < 2) return; // Lv1 grants the action but no draw

      const drawCount = level >= 3 ? 3 : 1;

      // Thalia, the Fun Fairy: while alive and not silenced on the same
      // side, "You do not draw cards through the effect of Friendship."
      // Skips the whole sparkle+draw rider — the additional action and
      // level reduction still work, only the draw is negated.
      const thaliaScript = loadCardEffect('Thalia, the Fun Fairy');
      if (thaliaScript?.hasActiveThaliaOnSide?.(engine, pi)) {
        engine.log('friendship_draw_negated', {
          player: ps.username,
          hero: ps.heroes[heroIdx]?.name,
          by: 'Thalia, the Fun Fairy',
        });
        return;
      }

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
