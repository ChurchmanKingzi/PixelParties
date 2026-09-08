'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pawn Chain"  (v818)
//  Spell / Reaction — Summoning Magic Lv1
//
//  "Play this card immediately when a Creature you control is defeated.
//   Choose a "Pawn of Kings" from your hand or deck and place it into
//   the same Support Zone as the defeated Creature as an additional
//   Action. You can only play 1 "Pawn Chain" per turn."
//
//  Fenster: `isCreatureDefeatedReaction` (Troop Annihilation) — Caster
//  (Level/Schule/lebend), Kosten, Auftritt und Discard-Routing macht die
//  Engine. Opfer zaehlen als „defeated" (Als Ruling 6.9., Frage 16).
//  Die Zone ist beim Todes-Hook bereits geraeumt (`_removeCardFromState`
//  vor ON_CREATURE_DEATH). Platzieren = keine Aktion, kein Level-Check.
//  Harte Einmal-pro-Zug-Sperre je Spieler ueber `gs.hoptUsed`.
// ═══════════════════════════════════════════
const {
  PAWN, isOfKingsName, collectHandAndDeck, pickFromHandOrDeck, placeFromHandOrDeck, ofKingsCpuAnswer,
} = require('./_of-kings-shared');

const CARD_NAME = 'Pawn Chain';
const key = (pi) => `pawn-chain:${pi}`;
const isPawn = (cd) => !!cd && isOfKingsName(cd.name) && cd.name.startsWith(PAWN);

function zoneFree(engine, pi, heroIdx, slot) {
  const z = engine.gs.players[pi]?.supportZones?.[heroIdx]?.[slot];
  return Array.isArray(z) ? z.length === 0 : true;
}

module.exports = {
  activeIn: ['hand'],
  // KEIN `isReaction` — das Flag ohne `reactionCondition` meldet die Karte
  // im generischen Kettenfenster bei JEDEM Kartenspiel (v830, Als
  // Report). Das Kreaturentod-Fenster braucht nur das Flag darunter.
  isCreatureDefeatedReaction: true,

  creatureDefeatedCondition(gs, pi, engine, deathInfo) {
    if (!deathInfo || deathInfo.heroIdx == null || deathInfo.zoneSlot == null) return false;
    // v828: nur „a Creature YOU control" — das Fenster feuert fuer jeden
    // Kreaturentod beider Seiten (Als Report: Dauer-Prompt, Fizzle).
    if ((deathInfo.controller ?? deathInfo.owner) !== pi) return false;
    if (gs.hoptUsed?.[key(pi)] === gs.turn) return false;
    if (!zoneFree(engine, pi, deathInfo.heroIdx, deathInfo.zoneSlot)) return false;
    return collectHandAndDeck(engine, pi, isPawn).length > 0;
  },

  async creatureDefeatedResolve(engine, pi, deathInfo) {
    const gs = engine.gs;
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[key(pi)] = gs.turn;
    const entries = collectHandAndDeck(engine, pi, isPawn);
    const pick = await pickFromHandOrDeck(engine, pi, entries, {
      title: CARD_NAME, auto: true, cancellable: false,
      description: `Choose a "Pawn of Kings" from your hand or deck to place into ${deathInfo.name}'s Support Zone.`,
      confirmLabel: '♟ Place!',
    });
    if (!pick) return;
    if (!zoneFree(engine, pi, deathInfo.heroIdx, deathInfo.zoneSlot)) return;
    const inst = await placeFromHandOrDeck(engine, pi, pick, deathInfo.heroIdx, deathInfo.zoneSlot, CARD_NAME);
    engine.log('pawn_chain', { player: gs.players[pi]?.username, placed: pick.name, from: pick.source, ok: !!inst });
    engine.sync();
  },

  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'confirm' && payload?.title === CARD_NAME) return true;
    return ofKingsCpuAnswer(engine, kind, payload);
  },
};
