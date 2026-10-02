// ═══════════════════════════════════════════
//  CARD EFFECT: "The Fourth Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by an effect and you have not played a deleted Area yet this turn,
//   you may immediately delete all Areas you control and play this deleted Spell as an additional
//   Action. When this card on your side of the board is sent to the discard pile or deleted, gain
//   Gold equal to the number of your deleted cards."
//
//  • Wird sie vom Brett GELOESCHT, zaehlt sie selbst mit (sie liegt dann im Geloescht-Stapel).
// ═══════════════════════════════════════════

const {
  verlaesstBrett, loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');

const CARD_NAME = 'The Fourth Circle of Hell';

module.exports = {
  activeIn: ['hand', 'area'],
  ...cpuBejahen,

  onDeletedFromAnywhere: (engine, pi) => loeschenUndSpielen(engine, pi, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    onCardLeaveZone: async (ctx) => {
      const weg = verlaesstBrett(ctx);
      if (!weg) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const anzahl = (ps?.deletedPile || []).length + (weg.nachZone === 'deleted' ? 1 : 0);
      if (anzahl <= 0) return;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      // Goldrausch aus der Area-Zone (Animation + Muenzklang)
      engine._broadcastEvent('play_zone_animation', { type: 'hell_coins', owner: pi, zoneType: 'area', heroIdx: -1, zoneSlot: -1 });
      await engine._delay(350);
      await engine.actionGainGold(pi, anzahl, { source: CARD_NAME });
      engine.log('fourth_circle_gold', { player: ps.username, gold: anzahl });
      engine.sync();
    },
  },
};
