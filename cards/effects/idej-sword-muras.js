// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Sword - Muras"
//  Artifact / Equipment (Idej) — Cost 20 (0 on Idej Lord Nobunakin)
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   If you equip this Artifact to "Idej Lord Nobunakin", its Cost
//   becomes 0. A Hero can only be equipped with 1 "Idej Sword"
//   Artifact. The first Attack the equipped Hero uses every turn
//   counts as an additional Action, but it must be the only Attack
//   the equipped Hero uses this turn."
//
//  • Cost-0-on-Nobunakin: Idej Lord Nobunakin's `equipCostReduction`.
//  • "first Attack counts as an additional Action": Muras registers a
//    HERO-RESTRICTED, Attack-category additional-action type and grants
//    one token (refreshed at the start of the equipped Hero's turn,
//    and on equip). The engine's `findAdditionalActionForCard` then
//    routes the equipped Hero's first Attack through that token — so
//    it doesn't consume the turn-Action (the player stays in the
//    Action Phase) AND it can be used during a Main Phase via the
//    standard inherent / additional-action mechanics.
//  • "must be the only Attack": the Sword self-stamps `treatAsEquip`
//    so the engine consults its `canPlayCard`, which blocks any
//    further Attack by the equipped Hero once it has attacked this
//    turn (engine-tracked via `heroesAttackedThisTurn`).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { canEquipToIdejHero, heroHasIdejSword } = require('./_idej-shared');

const CARD_NAME = 'Idej Sword - Muras';
const ADDITIONAL_TYPE = 'idej_muras_attack';

/** Register Muras's additional-action type (idempotent). Hero-restricted
 *  + Attack-only — so only the equipped Hero's Attacks consume it. */
function registerType(engine) {
  engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
    label: CARD_NAME,
    allowedCategories: ['attack'],
    heroRestricted: true,
    // Used even when the equipped Hero's main turn-Action is still
    // available — "the FIRST Attack ... counts as an additional
    // Action" means it must ALWAYS be the free extra, never the
    // main Action. doPlaySpell honours this flag.
    preferOverMainAction: true,
    filter: (cardData) => hasCardType(cardData, 'Attack'),
  });
}

function stampSelf(ctx) {
  if (ctx.card) {
    ctx.card.counters = ctx.card.counters || {};
    ctx.card.counters.treatAsEquip = 1; // → engine consults canPlayCard
  }
}

/** Refresh Muras's free-Attack token to exactly one — expire any
 *  leftover (the engine has no turn-rollover cleanup for unused
 *  additional-action grants), then grant a fresh one. */
function refreshGrant(ctx) {
  registerType(ctx._engine);
  ctx.expireAdditionalAction();
  ctx.grantAdditionalAction(ADDITIONAL_TYPE);
}

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, pi, heroIdx, engine) {
    if (!canEquipToIdejHero(gs, pi, heroIdx, engine)) return false;
    const eng = engine || gs._engineRef;
    return eng ? !heroHasIdejSword(eng, pi, heroIdx) : true;
  },

  // "it must be the only Attack the equipped Hero uses this turn" —
  // once the equipped Hero has attacked, block further Attacks by it.
  canPlayCard(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.cardType !== 'Attack') return true;
    return !((gs.players?.[pi]?.heroesAttackedThisTurn) || []).includes(heroIdx);
  },

  hooks: {
    // On equip — register the type, self-stamp treatAsEquip, and grant
    // the free Attack so it's usable the turn Muras lands too.
    onPlay: (ctx) => { stampSelf(ctx); refreshGrant(ctx); },
    onGameStart: (ctx) => { stampSelf(ctx); refreshGrant(ctx); },
    onCardEnterZone: (ctx) => {
      if (ctx.enteringCard?.id === ctx.card?.id) { stampSelf(ctx); refreshGrant(ctx); }
    },

    // "the FIRST Attack ... EVERY turn" — refresh the token at the
    // start of the equipped Hero's controller's turn.
    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      refreshGrant(ctx);
    },

    // The free Muras Attack is an ADDITIONAL action — it leaves the
    // turn-Action unspent. But the engine auto-advances out of the
    // Action Phase after ANY action play, so without this the player
    // would be booted to Main Phase 2 with their real Action still
    // unused. When the equipped Hero acts in the Action Phase and the
    // turn-Action is STILL unspent (i.e. it was the free additional
    // Attack), re-assert `_preventPhaseAdvance` to keep the Action
    // Phase open — the `_second-action-shared` pattern.
    onActionUsed: (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;   // the equipped Hero acted
      const engine = ctx._engine;
      const gs = engine.gs;
      if ((gs.currentPhase | 0) !== 3) return;       // Action Phase only
      const ps = gs.players[ctx.cardOwner];
      if (!ps) return;
      // turn-Action still unspent → the play WAS the free additional
      // Attack → keep the Action Phase open for the real Action.
      if ((ps.heroesActedThisTurn || []).length === 0) {
        gs._preventPhaseAdvance = true;
      }
    },

    // Muras leaves the board — drop any unused free-Attack token.
    onCardLeaveZone: (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card?.id) return;
      if (ctx.fromZone !== 'support') return;
      ctx.expireAdditionalAction();
    },
  },
};
