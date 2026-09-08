'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pawn of Kings [B]"  (v818)
//  Creature — Summoning Magic Lv0, 1 HP, bis zu 8 Kopien (`maxCopies`)
//
//  "Your deck may contain up to 8 copies of this card. While "Board of
//   Kings" is on the board, Areas cannot be removed from the board by
//   cards or effects of the opponent of the player who played them."
//
//  Area-Schutz ueber `onAreaWouldBeAffected` (Guardian-of-Teocuilatl-
//  Protokoll, `tryAreaProtection`): Areas BEIDER Seiten, sobald der
//  Zugreifende nicht der Spieler ist, der die Area gespielt hat.
//  Das Kopienlimit lebt in cards.json (`maxCopies: 8`) und zaehlt im
//  Deckbuilder ueber die Kopienfamilie beider Farben zusammen.
// ═══════════════════════════════════════════
const { boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Pawn of Kings [B]';

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],

  hooks: {
    onAreaWouldBeAffected: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      if (!boardOfKingsOnBoard(engine)) return;
      if (ctx.cancelled) return;
      const so = ctx.sourceOwner;
      if (so == null || so === ctx.affectedOwner) return;   // eigener Zugriff bleibt erlaubt
      ctx.cancelled = true;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: ctx.cardOwner, source: ctx.affectedArea });
      engine.log('pawn_of_kings_area_guard', {
        player: engine.gs.players[ctx.cardOwner]?.username, area: ctx.areaName, source: ctx.source,
      });
    },
  },
};
