'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pawn Sacrifice"  (v818)
//  Spell / Normal — Magic Arts Lv1
//
//  "Sacrifice a "Pawn of Kings" to draw 3 cards OR delete a "Pawn of
//   Kings" from your discard pile to draw 2 cards. If you control at
//   least 1 "of Kings" Creature after this Spell resolves, this counts
//   as an additional Action. You can only play 1 "Pawn Sacrifice" per
//   turn."
//
//  Zusatzaktion nachtraeglich (Als Ruling 6.9., Frage 17): `inherent-
//  Action` PROGNOSTIZIERT — frei, wenn nach dem gewaehlten Modus noch
//  ≥ 1 „of Kings"-Kreatur bliebe (Opfermodus: ≥ 2 auf dem Brett; Loesch-
//  modus: ≥ 1 + Pawn in der Ablage). Platzt die Prognose in der
//  Aufloesung, kostet die Karte die Aktion (`gs._spellForcesActionConsume`,
//  Curse-Vertrag). Wurde sie ueber den Haupt-Slot gespielt und die
//  Bedingung haelt, gibt `gs._spellFreeAction` den Slot zurueck (Server
//  seit v818 auch fuer den Haupt-Slot).
//  Loeschen aus der Ablage: Stapel-Schicht `engine.deleteFromPile` (v820).
// ═══════════════════════════════════════════
const { PAWN, isOfKingsName, ofKingsCreatures, ofKingsCpuAnswer } = require('./_of-kings-shared');
const { drawWouldBeBlocked } = require('./_draw-block-shared');

const CARD_NAME = 'Pawn Sacrifice';
const key = (pi) => `pawn-sacrifice:${pi}`;
const isPawnName = (n) => typeof n === 'string' && n.startsWith(PAWN);

function pawnsOnBoard(engine, pi) {
  return ofKingsCreatures(engine, pi).filter(i => isPawnName(i.name));
}
function pawnsInDiscard(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (!engine.pileOutAllowed(pi, 'discard', { sourceOwner: pi })) return [];
  return (ps.discardPile || []).filter(isPawnName);
}
function prognoseFree(engine, pi) {
  const total = ofKingsCreatures(engine, pi).length;
  if (pawnsOnBoard(engine, pi).length > 0 && total >= 2) return true;
  if (pawnsInDiscard(engine, pi).length > 0 && total >= 1) return true;
  return false;
}

module.exports = {
  activeIn: ['hand'],

  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    if (gs.hoptUsed?.[key(pi)] === gs.turn) return false;
    return pawnsOnBoard(engine, pi).length > 0 || pawnsInDiscard(engine, pi).length > 0;
  },

  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (engine.findAdditionalActionForCard(pi, CARD_NAME, heroIdx)) return false;
    return prognoseFree(engine, pi);
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'optionPicker' && payload?.title === CARD_NAME) {
      const pi = engine._cpuPlayerIdx;
      // Ablage-Modus bevorzugen, wenn er das Brett schont.
      const disc = pawnsInDiscard(engine, pi).length > 0;
      const board = pawnsOnBoard(engine, pi).length > 0;
      if (disc && (!board || ofKingsCreatures(engine, pi).length < 2)) return { optionId: 'delete' };
      return { optionId: board ? 'sacrifice' : 'delete' };
    }
    return ofKingsCpuAnswer(engine, kind, payload);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      const wasInherent = gs._spellWasInherent === true;

      const onBoard = pawnsOnBoard(engine, pi).length > 0;
      const inDiscard = pawnsInDiscard(engine, pi);
      if (!onBoard && inDiscard.length === 0) { gs._spellCancelled = true; return; }

      let mode = onBoard ? 'sacrifice' : 'delete';
      if (onBoard && inDiscard.length > 0) {
        const pick = await engine.promptGeneric(pi, {
          type: 'optionPicker', title: CARD_NAME,
          message: 'Choose one:',
          showCard: CARD_NAME,
          options: [
            { id: 'sacrifice', label: '♟ Sacrifice a "Pawn of Kings" → draw 3' },
            { id: 'delete', label: '🗑️ Delete a "Pawn of Kings" from your discard pile → draw 2' },
          ],
          cancellable: true,
        });
        if (!pick || pick.cancelled || pick.optionId == null) { gs._spellCancelled = true; return; }
        mode = String(pick.optionId);
      }

      let draws = 0;
      if (mode === 'sacrifice') {
        const paid = await engine.resolveSacrificeCost(ctx, {
          minCount: 1, maxCount: 1, noHandSubstitute: true,
          filter: c => isPawnName(c.inst?.name),
          title: CARD_NAME, description: 'Sacrifice a "Pawn of Kings" to draw 3 cards.',
          confirmLabel: '♟ Sacrifice!',
        });
        if (!paid) { gs._spellCancelled = true; return; }
        draws = 3;
      } else {
        let name = inDiscard[0];
        const distinct = [...new Set(inDiscard)];
        if (distinct.length > 1) {
          const res = await engine.promptGeneric(pi, {
            type: 'cardGallery', title: CARD_NAME,
            cards: distinct.map(n => ({ name: n, source: 'discard' })),
            description: 'Delete a "Pawn of Kings" from your discard pile to draw 2 cards.',
            cancellable: true,
          });
          if (!res || res.cancelled || !res.cardName) { gs._spellCancelled = true; return; }
          name = res.cardName;
        }
        const ok = await engine.deleteFromPile(pi, 'discard', name, { source: CARD_NAME, sourceOwner: pi });
        if (!ok) { gs._spellCancelled = true; return; }   // nicht da oder gesperrt (Knight [B])
        draws = 2;
      }

      // Karte einmal pro Zug — erst nach bezahlten Kosten stempeln.
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[key(pi)] = gs.turn;

      if (!drawWouldBeBlocked(engine, pi, draws)) await ctx.drawCards(pi, draws);

      // „If you control at least 1 "of Kings" Creature after this Spell resolves"
      const holds = ofKingsCreatures(engine, pi).length >= 1;
      if (holds && !wasInherent) gs._spellFreeAction = true;
      if (!holds && wasInherent) gs._spellForcesActionConsume = true;
      engine.log('pawn_sacrifice', { player: ps.username, mode, draws, additional: holds });
      engine.sync();
    },
  },
};
