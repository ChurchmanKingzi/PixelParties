// ═══════════════════════════════════════════
//  CARD EFFECT: "The Fifth Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by an effect and you have not played a deleted Area yet this turn,
//   you may immediately delete all Areas you control and play this deleted Spell as an additional
//   Action. When this card is sent to the discard pile or deleted from the board, the next damage
//   that exactly 1 target takes this turn is doubled. You can only activate this effect once per
//   turn."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Beim Verlassen des Bretts stempelt die Karte `gs._naechsterEinzelschadenX2`; die Engine
//    (`_naechsterEinzelschadenVerdoppeln`) verdoppelt das NAECHSTE Schadensereignis > 0 dieses
//    Zuges, das genau ein Ziel trifft: ein einzelner Schadensaufruf auf einen Helden bzw. ein
//    Kreaturen-Durchgang mit genau einem Eintrag. Mitten in einem Flaechenschlag
//    (`_deferGameOverCheck`) bleibt der Stempel stehen; er verfaellt am Zugende.
//  • „Doubled" = Faktor 2 im Punkt-vor-Strich-Sammler (wie `multiplyAmount`), egal wessen Schaden
//    und welches Ziels. „Once per turn": ein Stempel je Spieler und Zug.
// ═══════════════════════════════════════════

const {
  verlaesstBrett, loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');

const CARD_NAME = 'The Fifth Circle of Hell';

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
      if (!verlaesstBrett(ctx)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps || ps._fifthCircleTurn === gs.turn) return;   // einmal je Zug
      ps._fifthCircleTurn = gs.turn;
      gs._naechsterEinzelschadenX2 = { turn: gs.turn, owner: pi, source: CARD_NAME };
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      engine.log('fifth_circle_armed', { player: ps.username });
      engine.sync();
    },
  },
};
