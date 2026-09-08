'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Board of Kings"  (v818)
//  Spell / Area — Magic Arts Lv3
//
//  "This Spell's level in your hand is reduced by the number of "of
//   Kings" Creatures you control. You may sacrifice an "of Kings"
//   Creature you control that was not summoned this turn to make
//   playing this card count as an additional Action. Creatures you
//   control can't be chosen and are unaffected by your opponent's cards
//   and effects while there is at least 1 Creature with a lower level in
//   an adjacent Support Zone to them that can be chosen or affected by
//   that card or effect."
//
//  Bausteine (alle in `_of-kings-shared.js` ausgelegt):
//   • Level-Reduktion: `reduceLevelByOfKingsFactory` (Ruin-Mourner-Form).
//   • Zusatzaktion durch Opfer (Als Ruling 6.9., Frage 7): die Karte ist
//     inhaerent, sobald ein opferbares Ziel existiert. Bei FREIEM Haupt-
//     Slot bekommt der Spieler die Wahl; „Nein" → `gs._spellForcesAction-
//     Consume` (Curse-Vertrag) und die normale Aktion wird verbraucht.
//     Ohne freien Slot ist das Opfer Pflicht (Abbruch = Karte bleibt).
//   • Deckung: die Engine fragt `guardsCreatureChoice` (Zielsammler,
//     Truth-Seeing Eye umgeht NUR das) und `guardsCreatureFromOpp`
//     (`isOppEffectImmuneFrom` / `isOppDamageImmuneFrom`, „unaffected").
//     Nicht rekursiv; Adjazenz = 9er-Reihe; Board beider Seiten zaehlt.
// ═══════════════════════════════════════════
const {
  BOARD, reduceLevelByOfKingsFactory, coveredByBoardOfKings, ofKingsCreatures,
  summonedThisTurn, isOfKingsName, mainActionSlotFree, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = BOARD;

function sacrificeSpec(engine, pi) {
  return {
    minCount: 1, maxCount: 1, noHandSubstitute: true,
    filter: c => isOfKingsName(c.inst?.name) && !summonedThisTurn(engine, c.inst),
    title: CARD_NAME,
    description: 'Sacrifice an "of Kings" Creature you control that was not summoned this turn — playing Board of Kings then counts as an additional Action.',
    confirmLabel: '♟ Sacrifice!',
  };
}

function hasTribute(engine, pi) {
  return ofKingsCreatures(engine, pi).some(i => !summonedThisTurn(engine, i));
}

module.exports = {
  activeIn: ['hand', 'area'],

  reduceCardLevel: reduceLevelByOfKingsFactory(CARD_NAME),

  /** Inhaerent, sobald ein Opfer moeglich ist (Wahl folgt in onPlay). */
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (engine.findAdditionalActionForCard(pi, CARD_NAME, heroIdx)) return false;
    return hasTribute(engine, pi);
  },

  /** CPU: opfert nur, wenn danach noch eine „of Kings"-Kreatur bleibt. */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) {
      const pi = engine._cpuPlayerIdx;
      return ofKingsCreatures(engine, pi).length >= 2;
    }
    return ofKingsCpuAnswer(engine, kind, payload);
  },

  // ── Engine-Vertraege der Deckung ──
  guardsCreatureChoice(engine, inst, choosingPi) {
    return coveredByBoardOfKings(engine, inst, choosingPi, null);
  },
  guardsCreatureFromOpp(engine, inst, sourceOwner, source) {
    return coveredByBoardOfKings(engine, inst, sourceOwner, source);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      const wasInherent = gs._spellWasInherent === true;
      if (wasInherent) {
        let sacrifice = true;
        if (mainActionSlotFree(engine, pi, heroIdx)) {
          sacrifice = !!(await engine.promptGeneric(pi, {
            type: 'confirm', title: CARD_NAME,
            message: 'Sacrifice an "of Kings" Creature (not summoned this turn) to make playing Board of Kings count as an additional Action? Otherwise it uses this Hero\'s normal Action.',
            showCard: CARD_NAME,
            confirmLabel: '♟ Sacrifice → additional Action',
            cancelLabel: '⚔️ Normal Action',
            cancellable: true,
          }));
          if (!sacrifice) gs._spellForcesActionConsume = true;
        }
        if (sacrifice) {
          const paid = await engine.resolveSacrificeCost(ctx, sacrificeSpec(engine, pi));
          if (!paid) {
            // Ohne freien Slot ist das Opfer die einzige Spielart —
            // Abbruch laesst die Karte in der Hand.
            gs._spellCancelled = true;
            return;
          }
          engine.log('board_of_kings_free', { player: ps.username });
        }
      }

      await engine.placeArea(pi, ctx.card);
    },
  },
};
