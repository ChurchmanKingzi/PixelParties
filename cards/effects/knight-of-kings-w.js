'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Knight of Kings [W]"  (v818)
//  Creature — Summoning Magic Lv1, 1 HP
//
//  "If you have not summoned a "Knight of Kings" yet this turn, you may
//   make summoning this Creature count as an additional Action, but if
//   you do, you can't play any more cards from your hand for the rest
//   of the turn. If "Board of Kings" is on the board, you can still play
//   cards whose names or effects include "of Kings"."
//
//  Bauform Big Gwen Guard: `inherentAction` nur, wenn der Zusatzweg
//  ERZWUNGEN ist (Main Phase / kein Haupt-Slot); bei freiem Slot
//  entscheidet `beforeSummon` — „Special" stempelt
//  `gs._summonModeUpgradedToInherent`, der Server erstattet den Slot.
//  Die Hand-Spielsperre ist der Engine-Vertrag `ps._handPlayLock`
//  (`allow: 'of-kings'`) aus v818 — sie greift in `validateActionPlay`,
//  `getHeroPlayableCards` und allen Hand-Reaktionsfenstern.
//  „Knight summoned this turn": Stempel `gs.hoptUsed` je Spieler, gesetzt
//  in `onPlay` fuer JEDE Knight-Beschwoerung (beide Farben, Queen zaehlt
//  hier nicht — sie WIRD nicht als Knight beschworen).
// ═══════════════════════════════════════════
const { KNIGHT, mainActionSlotFree, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Knight of Kings [W]';
const summonedKey = (pi) => `ofkings-summoned:${KNIGHT}:${pi}`;

function knightSummonedThisTurn(gs, pi) {
  return gs.hoptUsed?.[summonedKey(pi)] === gs.turn;
}
function forced(gs, engine, pi, heroIdx) {
  if (gs.currentPhase === 2 || gs.currentPhase === 4) return true;
  return !mainActionSlotFree(engine, pi, heroIdx);
}
function lockHand(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  ps._handPlayLock = { turn: engine.gs.turn || 0, allow: 'of-kings' };
  engine.log('hand_play_locked', { player: ps.username, by: CARD_NAME });
}

module.exports = {
  activeIn: ['support'],

  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (knightSummonedThisTurn(gs, pi)) return false;
    return forced(gs, engine, pi, heroIdx);
  },

  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    // v833: die Wahl gibt es NUR bei der eigenen Beschwoerung aus der
    // Hand (`_isNormalSummon`, Server-Pfad). Effektbeschwoerungen (Tamed
    // Primordium, Kasperov, Castling, Necromancy …) stellen keine Frage.
    if (!ctx._isNormalSummon) return true;
    if (knightSummonedThisTurn(gs, pi)) return true;          // normale Beschwoerung

    if (forced(gs, engine, pi, heroIdx)) {
      const ok = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME,
        message: 'Summon Knight of Kings as an additional Action? If you do, you can\'t play any more cards from your hand this turn (with Board of Kings on the board, "of Kings" cards stay playable).',
        showCard: CARD_NAME, confirmLabel: '♞ Summon (hand lock)', cancelLabel: 'Cancel', cancellable: true,
      });
      if (!ok) return false;
      lockHand(engine, pi);
      return true;
    }
    // v828 (Al 8.9.): drei Wege — Zusatzaktion, normale Aktion, Abbruch.
    const wahl = await engine.promptGeneric(pi, {
      type: 'optionPicker', title: CARD_NAME,
      message: 'Choose how to summon Knight of Kings:',
      showCard: CARD_NAME,
      options: [
        { id: 'special', label: '⚡ Additional Action', description: 'You can\'t play any more cards from your hand this turn (with Board of Kings, "of Kings" cards stay playable).' },
        { id: 'normal', label: '⚔️ Normal Action', description: 'Uses this Hero\'s Action, no hand lock.' },
        { id: 'cancel', label: '✕ Cancel', description: 'Don\'t summon.' },
      ],
      cancellable: true,
    });
    const id = wahl?.optionId;
    if (!wahl || wahl.cancelled || id === 'cancel') return false;
    if (id !== 'special') return true;
    lockHand(engine, pi);
    gs._summonModeUpgradedToInherent = pi;
    return true;
  },

  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || payload?.title !== CARD_NAME) return ofKingsCpuAnswer(engine, kind, payload);
    // Sperre lohnt nur mit fast leerer Hand.
    const ps = engine.gs.players[engine._cpuPlayerIdx];
    const wenigHand = (ps?.hand || []).length <= 2;
    if (payload?.type === 'confirm') return wenigHand;
    if (payload?.type === 'optionPicker') return { optionId: wenigHand ? 'special' : 'normal' };
    return undefined;
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;
      const gs = ctx._engine.gs;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[summonedKey(ctx.cardOwner)] = gs.turn;
    },
  },
};
