// ═══════════════════════════════════════════
//  CARD EFFECT: "Vacarn, the Dark Goblin Necromancer"
//  Hero — 300 HP / 40 ATK / Skeletons archetype
//  Starting abilities: Leadership, Necromancy
//
//  Two passive clauses:
//
//    1. "Skeleton" Creatures this Hero summons with the effect of
//       Necromancy don't have their effects negated and may use their
//       active effects the turn they're summoned.
//
//       — Implemented inside `necromancy.js`: when the host hero is
//       Vacarn AND the revived Creature passes
//       `_skeleton-shared.isSkeletonCreature`, the negation buff is
//       skipped and `inst.turnPlayed` is rewound by one turn so the
//       engine's creature-effect HOPT gate accepts a same-turn fire.
//
//    2. Creatures in this Hero's Support Zones that are defeated are
//       deleted.
//
//       — Implemented here via an `onCardLeaveZone` hook that stamps
//       `_redirectToDeleted = true` on the leaving instance whenever
//       a Creature is being moved from Vacarn's own Support Zone to
//       the discard pile. The engine-side redirect block in
//       `actionMoveCard` flips the destination to the deleted pile
//       before the card lands. Tokens, Equipment, and other non-
//       Creatures route normally.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Vacarn, the Dark Goblin Necromancer';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCardLeaveZone: (ctx) => {
      // Only intercept discard-bound moves out of THIS Vacarn's
      // own Support Zone (matched by owner + heroIdx).
      if (ctx.fromZone !== 'support') return;
      if (ctx.toZone !== 'discard') return;
      if (ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== ctx.cardHeroIdx) return;

      const leaving = ctx.leavingCard;
      if (!leaving) return;

      // Only Creatures get redirected. Equipment Artifacts, Spell
      // attachments, Tokens-without-creature-type stay on the
      // discard route per their own conventions.
      const cardDB = ctx._engine._getCardDB();
      const cd = cardDB[leaving.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Vacarn must still be alive — a dead Vacarn has no Support Zone
      // to anchor this rule. The engine's runHooks already filters
      // listeners on dead-hero hosts, but belt-and-suspenders.
      const hero = ctx._engine.gs.players[ctx.cardOwner]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Stamp the redirect flag — actionMoveCard's redirect block
      // intercepts before the card lands and flips toZone to deleted.
      leaving._redirectToDeleted = true;
      ctx._engine.log('vacarn_delete_redirect', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
        creature: leaving.name,
      });
    },
  },
};
