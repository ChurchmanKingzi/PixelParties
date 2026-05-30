// ═══════════════════════════════════════════
//  CARD EFFECT: "Spider Hive"
//  Spell (Decay Magic Lv1, Area)
//
//  "The levels of all face-down Surprises on the board are reduced
//   by the number of 'Spider' Creatures on the board until they are
//   activated."
//
//  Mechanics
//  ─────────
//   • Self-place into the caster's Area zone on cast.
//   • While Spider Hive sits in an Area zone, every Surprise-subtype
//     card's effective level is reduced by `countSpiderCreaturesOnBoard`
//     — for BOTH players. The reduction is read by the engine's
//     centralised `_applyCardLevelReductions`, which is called from
//     `heroMeetsLevelReq` → `_canHeroActivateSurprise` — i.e. exactly
//     when a player tries to flip a Surprise. Lifted automatically
//     once a Surprise activates (the card leaves the Surprise Zone
//     and its level is no longer checked).
//   • `globalReduceCardLevel: true` opts into the engine's both-sides
//     reduction path so the opponent's Surprises shed levels too.
//   • Both sides' Spider Creatures count toward the reduction (card
//     text reads "Spider Creatures on the board", not "you control").
// ═══════════════════════════════════════════

const { countSpiderCreaturesOnBoard } = require('./_spider-shared');

const CARD_NAME = 'Spider Hive';

module.exports = {
  // 'hand' for the self-cast onPlay; 'area' for the passive level-
  // reduction hook the engine reads from each instance.
  activeIn: ['hand', 'area'],

  // Both sides of the board feel the reduction — opt into the engine's
  // global reduction path so the opponent's Surprise activations are
  // also gated against the reduced level.
  globalReduceCardLevel: true,

  /**
   * Reduce the effective level of any Surprise-subtype card by the
   * count of Spider Creatures on the board. Reads the cardData's
   * subtype directly, which avoids per-instance lookups. The reduction
   * only matters at Surprise-activation time (the only moment a
   * Surprise's level is gate-checked); UI-level surface that reads
   * effective levels of Surprises in hand will show the reduction
   * too, which is harmless.
   */
  reduceCardLevel(cardData, engine /*, ownerIdx, inst, heroIdx */) {
    if (!cardData) return 0;
    if (cardData.subtype !== 'Surprise') return 0;
    if (!engine) return 0;
    const spiderCount = countSpiderCreaturesOnBoard(engine);
    return spiderCount > 0 ? spiderCount : 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
      ctx._engine.log('spider_hive_placed', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
        reduction: countSpiderCreaturesOnBoard(ctx._engine),
      });
    },
  },
};
