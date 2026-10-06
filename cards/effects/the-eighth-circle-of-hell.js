// ═══════════════════════════════════════════
//  CARD EFFECT: "The Eighth Circle of Hell"
//  Spell (Destruction Magic Lv1, Area) — Archetyp Hell Circles
//
//  „When this card is deleted by another card's effect and you have not played a deleted Area yet
//   this turn, you may immediately delete all Areas you control and play this deleted Spell as an
//   additional Action. Whenever a player draws 1 or more cards through an effect, their opponent
//   may delete this card from the board to draw the same number of cards."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „Whenever a player draws": WORTGETREU fuer BEIDE Seiten. Zieht ein Spieler per Effekt
//    (`beforeDrawBatch`, gleiches Fenster wie Intrude; nicht das Rundenziehen), darf SEIN GEGNER
//    diese Area loeschen und gleich viele Karten ziehen — auch wenn die Area auf der Seite des
//    ziehenden Spielers liegt. Der Gegner des Ziehenden ist der Fragende.
//  • „By another card's effect": die Loeschung durch die eigene Klausel (Kosten der Ziehung) loest
//    die Rueckhol-Klausel NICHT aus (`_geloeschtStumm`). Alle anderen Loeschungen schon.
//  • Die Ziehung des Gegners laeuft zuerst (mit `_skipBatchHook`, kein Kettenfenster), danach die
//    urspruengliche; es gibt keine Obergrenze je Zug, nur die eine Area.
// ═══════════════════════════════════════════

const {
  loeschenUndSpielen, cpuBejahen,
} = require('./_hell-circles-shared');

const CARD_NAME = 'The Eighth Circle of Hell';

module.exports = {
  activeIn: ['hand', 'area'],
  ...cpuBejahen,

  onDeletedFromAnywhere: (engine, pi) => loeschenUndSpielen(engine, pi, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand' || ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    beforeDrawBatch: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const zieher = ctx.playerIdx;
      if (zieher !== 0 && zieher !== 1) return;
      const fragender = engine.opponentOf(zieher);
      if (gs._eighthCircleResolving) return;
      const anzahl = ctx.amount;
      if (!(anzahl > 0)) return;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'area') return;
      const fps = gs.players[fragender];
      if (!fps) return;
      if (fps.handLocked || fps.drawLocked) return;   // er koennte ohnehin nicht ziehen

      const deckType = ctx.deckType || 'main';
      const label = deckType === 'potion' ? 'Potion Deck' : 'Deck';
      const antwort = await engine.promptGeneric(fragender, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${gs.players[zieher]?.username} is drawing ${anzahl} card${anzahl > 1 ? 's' : ''} from their ${label}.\nDelete ${CARD_NAME} from the board to draw ${anzahl} as well?`,
        showCard: CARD_NAME,
        confirmLabel: `🔥 Delete & draw ${anzahl}`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!engine._confirmSaidYes(antwort)) return;

      gs._eighthCircleResolving = true;
      engine._geloeschtStumm = (engine._geloeschtStumm || 0) + 1;   // eigene Loeschung: keine Rueckhol-Klausel
      try {
        await engine.deleteArea(inst, CARD_NAME, { skipProtection: true, sourceOwner: fragender });
      } finally {
        engine._geloeschtStumm--;
      }
      try {
        if (deckType === 'potion') await engine.actionDrawFromPotionDeck(fragender, anzahl);
        else await engine.actionDrawCards(fragender, anzahl, { _skipBatchHook: true, source: CARD_NAME });
      } finally {
        delete gs._eighthCircleResolving;
      }
      engine.log('eighth_circle_draw', { player: fps.username, drawn: anzahl, deckType });
      engine.sync();
    },
  },
};
