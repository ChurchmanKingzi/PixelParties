// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Spores"
//  Spell (Summoning Magic Lv0, Reaction)
//
//  You may activate this card at the start of
//  your opponent's turn. For the rest of the
//  turn, all Creatures on the board are treated
//  as "Deepsea" Creatures.
//
//  Activation paths:
//    • Proactively on your OWN turn (normal
//      Spell play via inherentAction +
//      proactivePlay, for in-hand usage).
//    • Reactively during the opponent's turn
//      START ONLY — we gate the reaction via
//      chainCtx.eventDesc matching the engine's
//      onTurnStart description, AND the reactor
//      must be the non-active player.
//
//  The effect flips a per-turn flag that
//  isDeepseaCreature() consults; it naturally
//  expires when gs.turn advances (compared
//  against current turn).
// ═══════════════════════════════════════════

const { activateDeepseaSpores } = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Spores';
// Matches _engine.js HOOK_DESCRIPTIONS['onTurnStart'] — kept here as a
// string literal (no cross-imports to engine internals). If that copy
// drifts, the reaction simply won't fire on turn start.
const TURN_START_EVENT = 'The turn has just started';

module.exports = {
  isReaction: true,
  proactivePlay: true,
  inherentAction: true,

  /**
   * Reaction can ONLY fire at the opponent's onTurnStart AND only when
   * at least one Creature exists on the board — firing with an empty
   * field is wasted since the Spores archetype-override only affects
   * board creatures.
   *   • chainCtx.eventDesc identifies which hook opened the reaction
   *     window; we require it to be the turn-start string.
   *   • The reactor (pi) must be the non-active player — i.e. it is
   *     the OPPONENT's turn that just started.
   *   • At least one Creature must be in a support zone on either side.
   */
  reactionCondition(gs, pi, engine, chainCtx) {
    if (!chainCtx) return false;
    if (chainCtx.eventDesc !== TURN_START_EVENT) return false;
    // Opponent's turn => pi is the non-active player.
    if (gs.activePlayer === pi) return false;
    if (!engine) return true;
    const cardDB = engine._getCardDB();
    const hasCreature = engine.cardInstances.some(c =>
      c.zone === 'support' && !c.faceDown &&
      (cardDB[c.name]?.cardType === 'Creature')
    );
    return hasCreature;
  },

  /**
   * Proactive play (from own hand during own turn). The server's
   * validateActionPlay already restricts Reaction-subtype cards to
   * cards with proactivePlay: true; no extra gating needed here.
   */
  spellPlayCondition(gs, pi) {
    // Only playable proactively on YOUR OWN turn (the reaction path
    // handles opponent-turn activation).
    return gs.activePlayer === pi;
  },

  hooks: {
    onPlay: async (ctx) => {
      activateDeepseaSpores(ctx._engine);
      ctx._engine.log('deepsea_spores_active', {
        player: ctx._engine.gs.players[ctx.cardOwner]?.username,
        turn: ctx._engine.gs.turn,
      });
      ctx._engine.sync();
    },
  },

  // Reaction-chain resolve path — fires during the opponent's
  // onTurnStart chain window when confirmed.
  async resolve(engine, pi) {
    activateDeepseaSpores(engine);
    engine.log('deepsea_spores_active', {
      player: engine.gs.players[pi]?.username, turn: engine.gs.turn,
    });
    engine.sync();
    return true;
  },
};
