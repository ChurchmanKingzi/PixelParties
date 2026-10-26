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
//   • While Spider Hive sits in an Area zone, every face-down Surprise
//     ON THE BOARD has its effective level reduced by `countSpiderCreaturesOnBoard`
//     — for BOTH players. Als Ruling (Al 26.10.): „nur die auf dem Board" —
//     Surprises auf der Hand bleiben auf ihrer Stufe (`evalOpts.surpriseAufBrett`).
//     The reduction is read by the engine's centralised `_applyCardLevelReductions`, which is called from
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
   * Reduce the effective level of a face-down Surprise ON THE BOARD by the
   * count of Spider Creatures on the board.
   * Als Ruling (Al 26.10.): „Ja, nur die auf dem Board" — die Senkung gilt
   * NUR, wenn die Stufe einer verdeckt liegenden Surprise ausgewertet wird
   * (`evalOpts.surpriseAufBrett`: `_canHeroActivateSurprise` = Aktivierungs-Gate
   * und die Stufenanzeige der gesetzten Surprise im Gamestate), nie für die
   * Kopie auf der Hand (Anzeige, Kreaturen-Stufenfilter wie „Lv 0 aus der Hand").
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx, evalOpts) {
    if (!cardData) return 0;
    // W16c (A05-28): Dauereffekt der AUSLIEGENDEN Area - die Kopie auf der Hand ('hand' ist nur fuer das Selbstlegen) senkt nichts.
    if (inst && inst.zone !== 'area') return 0;
    if (cardData.subtype !== 'Surprise') return 0;
    if (!evalOpts || evalOpts.surpriseAufBrett !== true) return 0;   // Als Ruling (Al 26.10.): nur verdeckte Surprises AUF DEM BRETT, nicht die Hand
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
