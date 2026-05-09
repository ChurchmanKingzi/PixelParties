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

      // HOPT per sword instance — claimed up-front so a recursive
      // trigger fired by the chained summon itself can't double-fire.
      // Refunded on every cancel / no-target path below so the
      // trigger remains available on later Attacks this turn.
      const hoptKey = `sword-summon:${ctx.card.id}`;
      if (!ctx.hardOncePerTurn(hoptKey)) return;
      const refundHopt = () => { if (gs.hoptUsed) delete gs.hoptUsed[`${hoptKey}:${pi}`]; };

      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) { refundHopt(); return; }

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

      if (eligible.length === 0) {
        // No summonable Creature in hand at the time the Sword
        // triggers → no token granted, HOPT refunded so a later
        // Attack this turn (after a draw) can still trigger. Token
        // stays un-granted to keep `additionalActionAvail` from
        // leaking past the immediate hook.
        refundHopt();
        engine.log('sword_summon_no_targets', { player: gs.players[pi].username, hero: hero.name });
        engine.sync();
        return;
      }

      // Grant the token so performImmediateAction can route the summon
      // through the additional-action machinery. Whatever happens below,
      // we expire the token before this hook returns — the Sword's free
      // summon must be the IMMEDIATE next thing or it's forgone, which
      // means the token never survives this hook in any state.
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);

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
        // Summon already happened inside performImmediateAction — consume
        // the token so the engine's "did this play use an additional
        // action?" bookkeeping is right, then phase advances normally.
        engine.consumeAdditionalAction(pi, ADDITIONAL_TYPE);
      } else {
        // Cancelled — expire the additional-action token so it can't
        // leak into a later play / next turn via drag-summon (the
        // engine has no turn-rollover cleanup for
        // `additionalActionAvail` counters), AND refund the HOPT so
        // the trigger can fire again on the equipped Hero's next
        // Attack this turn.
        ctx.expireAdditionalAction();
        refundHopt();
      }

      engine.log('sword_summon_grant', { player: gs.players[pi].username, hero: hero.name });
      engine.sync();
    },
  },
};
