// ═══════════════════════════════════════════
//  CREATURE: "Bonded Companion Orphy"
//
//  Gemeinsame Saetze: `_bonded-companions-shared.js`. Eigener Satz:
//
//    „Once per turn, when you attach an Ability to the corresponding
//     Hero, draw 3 cards."
//
//  Abilities landen in der Ability Zone — der Verteiler meldet das als
//  `onCardEnterZone` mit `toZone: 'ability'`.
// ═══════════════════════════════════════════

const { companion, companionGlow } = require('./_bonded-companions-shared');
const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Bonded Companion Orphy';
const USE_KEY   = 'orphyDraw';
const MAX_USES  = 1;
const KARTEN    = 3;

module.exports = companion({
  name: CARD_NAME,
  eigeneHooks: {
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'ability') return;
      // v1352 (Als Ruling): die Rueckkehr einer verwahrten Ability (Madame
      // Guillotine) ist KEIN Anlegen.
      if (ctx._verwahrungRueckkehr) return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      // „when YOU attach" — nur die eigene Seite.
      const leger = ctx.enteringCard?.owner ?? ctx.enteringCard?.controller;
      if (leger !== ctx.cardOwner) return;

      const inst = ctx.card;
      const gs = ctx._engine?.gs;
      if (usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES }) <= 0) return;

      spendUse(inst, gs, { key: USE_KEY, max: MAX_USES });
      await ctx._engine.showTriggeredEffect(CARD_NAME);
      companionGlow(ctx._engine, inst);
      await ctx.drawCards(ctx.cardOwner, KARTEN);
      ctx._engine.log('orphy_ability_draw', {
        player: gs.players[ctx.cardOwner]?.username,
        ability: ctx.enteringCard?.name || null, cards: KARTEN,
      });
    },
  },
});
