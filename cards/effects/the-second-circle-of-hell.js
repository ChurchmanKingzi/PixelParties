// ═══════════════════════════════════════════
//  CARD EFFECT: "The Second Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by an effect and you have not played a deleted Area yet this turn,
//   you may immediately delete all Areas you control and play this deleted Spell as an additional
//   Action. When this card on your side of the board is sent to the discard pile or deleted, you
//   may choose one of your deleted cards and add it to your hand."
//
//  Gemeinsame Klausel + Auslegung: siehe `_hell-circles-shared.js`.
//  • Der Abgang-Effekt wird VOR dem Stapel-Eintrag ausgewertet — „one of your deleted cards"
//    meint die Karten, die schon vorher im Geloescht-Stapel lagen (nicht diese Karte selbst).
// ═══════════════════════════════════════════

const {
  verlaesstBrett, loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');

const { skipIfSearchBlocked } = require('./_search-shared');

// COST-DISCARD-CHANNEL: n/a — kein Abwurf als Kosten: die Karte WIRD abgelegt, der Effekt ist die Folge
const CARD_NAME = 'The Second Circle of Hell';

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
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      const namen = [...new Set(ps?.deletedPile || [])];
      if (namen.length === 0) return;
      if (skipIfSearchBlocked(engine, pi, CARD_NAME, 'discard')) return;   // Such-Sperre: Angebot entfaellt
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });
      const wahl = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        searchToHand: true, searchPile: 'discard',   // Template: Hand-Suche kennzeichnen (Geloescht-Stapel zaehlt wie die Ablage)
        cards: namen.map(name => ({ name, source: 'deleted', count: ps.deletedPile.filter(n => n === name).length })),
        title: CARD_NAME,
        description: 'You may choose one of your deleted cards and add it to your hand.',
        confirmLabel: '🔥 Add to Hand',
        confirmClass: 'btn-warning',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!wahl || wahl.cancelled || !wahl.cardName || !ps.deletedPile.includes(wahl.cardName)) return;
      const ok = await engine.addFromPileToHand(pi, 'deleted', wahl.cardName, { source: CARD_NAME });
      engine.log('second_circle_return', { player: ps.username, card: wahl.cardName, ok: !!ok });
      engine.sync();
    },
  },
};
