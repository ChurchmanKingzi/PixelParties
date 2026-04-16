// ═══════════════════════════════════════════
//  CARD EFFECT: "Legendary Sword of a Barbarian King"
//  Artifact (Equipment, Cost 10)
//
//  ① Equipped Hero gains +10 ATK.
//  ② Once per turn, when the equipped Hero
//    performs an Attack, the player may
//    immediately summon a Creature as an
//    additional Action (no action cost).
//    Granted via the additional-action system;
//    restricted to Creature card type only.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { checkArthorAscension } = require('./_arthor-shared');

const CARD_NAME     = 'Legendary Sword of a Barbarian King';
const ATK_BONUS     = 10;
const ADDITIONAL_TYPE = 'sword_summon';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
      // Register the additional-action type (idempotent)
      ctx._engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        filter: (cardData) => hasCardType(cardData, 'Creature'),
      });
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },

    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
      ctx._engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        filter: (cardData) => hasCardType(cardData, 'Creature'),
      });
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },

    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner || ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
      // Expire any unused summon grant from this sword instance
      ctx.expireAdditionalAction();
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, ctx.card.id);
    },

    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      // Re-register type each turn (may be needed after engine resets)
      ctx._engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        filter: (cardData) => hasCardType(cardData, 'Creature'),
      });
    },

    /**
     * After the equipped Hero resolves an Attack, prompt to summon a Creature for free.
     * - 1 eligible Creature → "Summon [name]?"
     * - 2+ → "Summon a Creature?" with list
     * - Cancelled / no eligible → keep additional action + _preventPhaseAdvance so
     *   the player can still drag-summon from hand.
     */
    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Attack') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.isSecondCast) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // HOPT per sword instance
      if (!ctx.hardOncePerTurn(`sword-summon:${ctx.card.id}`)) return;

      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Register type (idempotent)
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        filter: (cardData) => hasCardType(cardData, 'Creature'),
      });

      // Find eligible creatures in hand for this hero
      const cardDB   = engine._getCardDB();
      const eligible = engine.getHeroEligibleActionCards(pi, heroIdx)
        .filter(cn => hasCardType(cardDB[cn], 'Creature'));

      // Grant the token regardless — needed for drag-play fallback if cancelled
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);

      if (eligible.length === 0) {
        // Nothing to summon — hold phase open so nothing strange happens
        gs._preventPhaseAdvance = true;
        engine.log('sword_summon_grant', { player: gs.players[pi].username, hero: hero.name });
        engine.sync();
        return;
      }

      const uniqueNames = [...new Set(eligible)];
      const title = uniqueNames.length === 1
        ? `Summon ${uniqueNames[0]}?`
        : 'Summon a Creature?';

      const result = await ctx.performImmediateAction(heroIdx, {
        title,
        description: `${CARD_NAME} — free Creature summon!`,
        allowedCardTypes: ['Creature'],
        skipAbilities: true,
        cancellable: true,
      });

      if (result?.played) {
        // Consume the token — the summon already happened inside performImmediateAction
        engine.consumeAdditionalAction(pi, ADDITIONAL_TYPE);
        // No _preventPhaseAdvance → phase will advance normally after this hook returns
      } else {
        // Player cancelled — hold Action Phase open so they can drag-summon instead
        gs._preventPhaseAdvance = true;
      }

      engine.log('sword_summon_grant', { player: gs.players[pi].username, hero: hero.name });
      engine.sync();
    },
  },
};
