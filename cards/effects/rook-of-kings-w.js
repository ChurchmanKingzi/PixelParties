'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Rook of Kings [W]"  (v818)
//  Creature — Summoning Magic Lv3, 1 HP
//
//  "If you haven't summoned any Creatures yet this turn and "Board of
//   Kings" is on the board, summoning this Creature counts as an
//   additional Action. Once per turn, when you sacrifice a "Pawn of
//   Kings" Creature while "Board of Kings" is on the board, you may
//   immediately sacrifice another "of Kings" Creature you control to
//   choose an "of Kings" Creature with a different name from your hand
//   or deck and place it into the same Support Zone."
//
//  • Zusatzaktion: `inherentAction` (Board liegt, 0 Beschwoerungen).
//  • Trigger: `onCreatureSacrificed` je Tribut (auch innerhalb einer
//    Opferkette, `_inSacrificeBatch` wird bewusst nicht uebersprungen),
//    einmal pro Zug JE ROOK (weicher Stempel am Instanzzaehler). Das
//    zweite Opfer waehlt `resolveSacrificeCost` (ohne Hand-Ersatz, der
//    Pawn selbst ausgeschlossen, der Rook darf sich selbst opfern).
//    „the same Support Zone" = Zone des ZWEITEN Opfers, „different
//    name" = andere Familie als das zweite Opfer (Als Rulings 12/13).
//    Platzieren regardless of level, keine Aktion, auch zu toten Helden.
// ═══════════════════════════════════════════
const {
  PAWN, familyName, isOfKingsName, isOfKingsCreatureData, boardOfKingsOnBoard,
  collectHandAndDeck, pickFromHandOrDeck, placeFromHandOrDeck, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = 'Rook of Kings [W]';

module.exports = {
  activeIn: ['support'],

  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (!boardOfKingsOnBoard(engine)) return false;
    return (gs.players[pi]?._creaturesSummonedThisTurn || 0) === 0;
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) {
      // Lohnt nur, wenn ein Ersatz aus Hand/Deck bereitsteht.
      const pi = engine._cpuPlayerIdx;
      return collectHandAndDeck(engine, pi, isOfKingsCreatureData).length > 0;
    }
    return ofKingsCpuAnswer(engine, kind, payload);
  },

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const victim = ctx.creature;
      if (!victim || !String(victim.name || '').startsWith(PAWN)) return;
      if ((victim.controller ?? victim.owner) !== pi) return;
      if (!boardOfKingsOnBoard(engine)) return;
      if (inst.counters?._rookTriggerTurn === gs.turn) return;

      const ps = gs.players[pi];
      const spec = {
        minCount: 1, maxCount: 1, noHandSubstitute: true, cancellable: true,
        filter: c => isOfKingsName(c.inst?.name) && c.inst?.id !== victim.id && c.inst?.id !== victim.instId,
        title: CARD_NAME,
        description: `${victim.name} is being sacrificed. Sacrifice another "of Kings" Creature you control to replace it with an "of Kings" Creature of a different name from your hand or deck?`,
        confirmLabel: '♖ Sacrifice!',
      };
      // Vorab: gibt es ueberhaupt ein zweites Opfer und irgendeinen Ersatz?
      const pseudoCtx = { cardOwner: pi, card: null, cardName: CARD_NAME, cardHeroIdx: inst.heroIdx };
      if (!engine.canSatisfySacrifice(pi, spec, null)) return;
      if (collectHandAndDeck(engine, pi, isOfKingsCreatureData).length === 0) return;

      const yes = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: spec.description, showCard: CARD_NAME, showCardLeft: victim.name,
        confirmLabel: '♖ Yes', cancelLabel: 'No', cancellable: true,
      });
      if (!yes) return;

      let secondVictim = null;
      const paid = await engine.resolveSacrificeCost(pseudoCtx, {
        ...spec,
        onResolved: async (_c, picked) => {
          const t = picked?.[0];
          if (t) secondVictim = { name: t.cardName, heroIdx: t.heroIdx, zoneSlot: t.slotIdx };
        },
      });
      if (!paid || !secondVictim) return;
      inst.counters = inst.counters || {};
      inst.counters._rookTriggerTurn = gs.turn;
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: victim });

      const fam = familyName(secondVictim.name);
      const entries = collectHandAndDeck(engine, pi, cd => isOfKingsCreatureData(cd) && familyName(cd.name) !== fam);
      if (entries.length === 0) return;
      const pick = await pickFromHandOrDeck(engine, pi, entries, {
        title: CARD_NAME, auto: true, cancellable: false,
        description: `Choose an "of Kings" Creature (not "${fam}") from your hand or deck to place into ${secondVictim.name}'s Support Zone.`,
        confirmLabel: '♟ Place!',
      });
      if (!pick) return;
      const zone = ps.supportZones?.[secondVictim.heroIdx]?.[secondVictim.zoneSlot];
      if (Array.isArray(zone) && zone.length > 0) return;   // Zone belegt (Reaktion dazwischen)
      const placed = await placeFromHandOrDeck(engine, pi, pick, secondVictim.heroIdx, secondVictim.zoneSlot, CARD_NAME);
      engine.log('rook_of_kings_replace', { player: ps.username, sacrificed: secondVictim.name, placed: pick.name, from: pick.source, ok: !!placed });
      engine.sync();
    },
  },
};
