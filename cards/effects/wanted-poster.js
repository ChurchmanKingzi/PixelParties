// ═══════════════════════════════════════════
//  CARD EFFECT: "Wanted Poster"
//  Artifact (Equipment, Cost 5)
//
//  Whenever the equipped Hero defeats a target,
//  draw 2 cards. Maximum 1 Wanted Poster per Hero.
//
//  "Defeats" = the target dies AND the kill's
//  damage source is the equipped Hero. Covers:
//    • Basic attacks (executeAttack — synthetic
//      source { owner, heroIdx, usesHeroAtk: true }).
//    • Attack / Spell cards cast by the Hero
//      (Hammer Throw, Magic Hammer, etc.).
//    • The Hero's own active effect (heroEffect:
//      true scripts — source = hero's cardInstance,
//      zone === 'hero').
//    • Abilities attached to the Hero that deal
//      damage (source.zone === 'ability').
//
//  Excludes: kills by Creatures hosted on the
//  Hero's Support Zone — the Creature is the
//  source, not the Hero. Detected via
//  `source.zone === 'support'` skip.
// ═══════════════════════════════════════════

const CARD_NAME = 'Wanted Poster';
const DRAW_COUNT = 2;

/**
 * True iff the death event's source is the equipped Hero (and not a
 * Creature hosted on that Hero's Support Zone). Mirrors the
 * `sourceOwner / sourceHeroIdx` matching pattern used by Blade of the
 * Swamp Witch / Ghuanjun.
 */
function _isHeroSource(ctx) {
  const src = ctx.source;
  if (!src) return false;
  const srcOwner = src.controller ?? src.owner ?? -1;
  if (srcOwner !== ctx.cardOwner) return false;
  if ((src.heroIdx ?? -1) !== ctx.cardHeroIdx) return false;
  // A Creature sitting in the equipped Hero's Support Zone shares the
  // same `heroIdx` (the host) — but the Creature is the source of its
  // own attacks/effects, not the Hero. Synthetic sources from Attack /
  // Spell cards have no `.zone` field; treat them as hero-side.
  if (src.zone === 'support') return false;
  return true;
}

module.exports = {
  activeIn: ['support'],

  /**
   * One Wanted Poster per Hero. Same anti-stack guard the rest of the
   * Equipment family uses (Vampiric Sword, Slippery Skates, Phalanx
   * Pike). Card text explicitly enforces this.
   */
  canEquipToHero(gs, playerIdx, heroIdx) {
    const supportZones = gs.players[playerIdx]?.supportZones[heroIdx] || [];
    for (const slot of supportZones) {
      if ((slot || []).includes(CARD_NAME)) return false;
    }
    return true;
  },

  hooks: {
    /**
     * Hero KO triggered by the equipped Hero. Fires for opponent heroes
     * the Hero defeated AND for the equipped Hero's own KO if somehow
     * self-sourced (rare — self-damage spells, mirrored Booby Trap,
     * etc.). The engine passes `_bypassDeadHeroFilter: true` for
     * ON_HERO_KO so this hook fires even when the Hero killed itself.
     */
    onHeroKO: async (ctx) => {
      if (!_isHeroSource(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      await engine.actionDrawCards(pi, DRAW_COUNT, { source: CARD_NAME });
      engine.log('wanted_poster_draw', {
        player: engine.gs.players[pi]?.username,
        defeated: ctx.hero?.name || '?',
        drawCount: DRAW_COUNT,
      });
      engine.sync();
    },

    /**
     * Creature death (any path — damage, sacrifice, destroy) triggered
     * by the equipped Hero. Same source-match gate as onHeroKO.
     */
    onCreatureDeath: async (ctx) => {
      if (!_isHeroSource(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      await engine.actionDrawCards(pi, DRAW_COUNT, { source: CARD_NAME });
      engine.log('wanted_poster_draw', {
        player: engine.gs.players[pi]?.username,
        defeated: ctx.creature?.name || '?',
        drawCount: DRAW_COUNT,
      });
      engine.sync();
    },
  },
};
