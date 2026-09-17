// ═══════════════════════════════════════════
//  CREATURE: "Bonded Companion Mellvy"
//
//  Gemeinsame Saetze: `_bonded-companions-shared.js`. Eigener Satz:
//
//    „Once per turn, when the corresponding Hero performs an Action,
//     draw a card from your Potion Deck."
//
//  „the corresponding Hero" = der Held der eigenen Spalte, also
//  `ctx.heroIdx === ctx.cardHeroIdx`.
// ═══════════════════════════════════════════

const { companion, companionGlow } = require('./_bonded-companions-shared');
const { usesLeft, spendUse } = require('./_charges');
const { handlungsHooks } = require('./_action-shared');

const CARD_NAME = 'Bonded Companion Mellvy';
const USE_KEY   = 'mellvyPotion';
const MAX_USES  = 1;

module.exports = companion({
  name: CARD_NAME,
  eigeneHooks: {
    // v1157: auch Reaktionen dieses Helden (`_action-shared.js`)
    ...handlungsHooks(async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;

      const inst = ctx.card;
      const gs = ctx._engine?.gs;
      if (usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES }) <= 0) return;
      if ((gs?.players?.[ctx.cardOwner]?.potionDeck || []).length === 0) return;

      spendUse(inst, gs, { key: USE_KEY, max: MAX_USES });
      await ctx._engine.showTriggeredEffect(CARD_NAME);
      companionGlow(ctx._engine, inst);
      // ── ZUG SICHTBAR MACHEN (Als Befund 12.9., dritter Anlauf) ───
      // Der Hand-Diff-Melder des Clients erkennt einen Zug daran, dass
      // die Hand WAECHST und gleichzeitig ein Stapel schrumpft. Dafuer
      // muss er zwei getrennte Zustaende sehen: einen VOR und einen NACH
      // dem Zug. `showTriggeredEffect` sendet nur ein Ereignis und
      // synchronisiert NICHT — der Auftritt allein liefert also keinen
      // Zwischenstand. Deshalb hier ausdruecklich: Zustand rausschicken,
      // dem Client einen Moment zum Verarbeiten geben, DANN ziehen
      // (`actionDrawFromPotionDeck` synchronisiert seit v927 selbst).
      ctx._engine.sync();
      await ctx._engine._delay(180);
      await ctx._engine.actionDrawFromPotionDeck(ctx.cardOwner, 1);
      ctx._engine.log('mellvy_potion_draw', {
        player: gs.players[ctx.cardOwner]?.username, action: ctx.actionType,
      });
    }),
  },
});
