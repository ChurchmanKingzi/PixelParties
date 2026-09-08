'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Kasperov, the King of Kings [B]"  (v818)
//  Hero — 300 HP / 60 ATK, Leadership + Summoning Magic
//
//  "You may once per turn sacrifice a "Pawn of Kings" you control that
//   was not summoned this turn to place any "of Kings" Creature from
//   your hand or deck into the same Support Zone it occupied."
//  (Text von Al am 6.9. korrigiert; cards.json angepasst.)
//
//  Helden-Effekt OHNE Aktionskosten (Als Regel 7.9.: aktive Effekte
//  kosten nur eine Aktion, wenn sie es ausdruecklich sagen — kein
//  `heroEffectActionCost`). HOPT macht die Engine. Opfer ueber
//  `resolveSacrificeCost` (nur Pawns, nicht in diesem Zug beschworen,
//  kein Hand-Ersatz); Zone des Pawns aus dem Prompt-Ziel gesichert,
//  dann Platzieren aus Hand ODER Deck (regardless of level, auch zu
//  toten/Frozen/Stunned/Negated Helden — Als Ruling 6.9., Frage 14).
// ═══════════════════════════════════════════
const {
  PAWN, isOfKingsCreatureData, ofKingsCreatures, summonedThisTurn,
  collectHandAndDeck, pickFromHandOrDeck, placeFromHandOrDeck, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = 'Kasperov, the King of Kings [B]';

function eligiblePawns(engine, pi) {
  return ofKingsCreatures(engine, pi).filter(i => i.name.startsWith(PAWN) && !summonedThisTurn(engine, i));
}

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (eligiblePawns(engine, pi).length === 0) return false;
    return collectHandAndDeck(engine, pi, isOfKingsCreatureData).length > 0;
  },

  onHeroEffect: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (eligiblePawns(engine, pi).length === 0) return false;

    let zone = null;
    const paid = await engine.resolveSacrificeCost(
      { cardOwner: pi, card: null, cardName: CARD_NAME, cardHeroIdx: ctx.cardHeroIdx },
      {
        minCount: 1, maxCount: 1, noHandSubstitute: true, cancellable: true,
        filter: c => String(c.inst?.name || '').startsWith(PAWN) && !summonedThisTurn(engine, c.inst),
        title: CARD_NAME,
        description: 'Sacrifice a "Pawn of Kings" (not summoned this turn) to place any "of Kings" Creature from your hand or deck into its Support Zone.',
        confirmLabel: '♚ Sacrifice!',
        onResolved: async (_c, picked) => {
          const t = picked?.[0];
          if (t) zone = { heroIdx: t.heroIdx, slotIdx: t.slotIdx, name: t.cardName };
        },
      },
    );
    if (!paid || !zone) return false;

    const entries = collectHandAndDeck(engine, pi, isOfKingsCreatureData);
    if (entries.length === 0) return;
    const pick = await pickFromHandOrDeck(engine, pi, entries, {
      title: CARD_NAME, auto: true, cancellable: false,
      description: `Choose an "of Kings" Creature from your hand or deck to place into ${zone.name}'s Support Zone.`,
      confirmLabel: '♟ Place!',
    });
    if (!pick) return;
    const z = ps.supportZones?.[zone.heroIdx]?.[zone.slotIdx];
    if (Array.isArray(z) && z.length > 0) return;
    const inst = await placeFromHandOrDeck(engine, pi, pick, zone.heroIdx, zone.slotIdx, CARD_NAME);
    engine.log('kasperov_place', { player: ps.username, sacrificed: zone.name, placed: pick.name, from: pick.source, ok: !!inst });
    engine.sync();
  },
};
