// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Balance"
//  Spell (Magic Arts Lv0) — Inherent Action.
//  Once per game (Divine Gift key).
//
//  On play: placed face-up as a permanent.
//  While active: both players may once per turn
//  activate it to draw until their hand matches
//  their opponent's hand size. Counts as an
//  additional Action.
//
//  Animation: golden scale grows on the permanent.
// ═══════════════════════════════════════════

module.exports = {
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      // Prevent the spell handler from discarding this card
      gs._spellPlacedOnBoard = true;

      // Place as permanent
      if (!ps.permanents) ps.permanents = [];
      const permId = 'perm-' + Date.now() + '-' + Math.random();
      ps.permanents.push({ name: 'Divine Gift of Balance', id: permId });

      const inst = engine._trackCard('Divine Gift of Balance', pi, 'permanent', -1, -1);
      inst.counters.permId = permId;

      engine.log('permanent_placed', { card: 'Divine Gift of Balance', player: ps.username });
      engine.sync();
    },

    // Reset per-instance HOPT flags at turn start
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      for (const ps of engine.gs.players) {
        if (!ps) continue;
        for (const perm of (ps.permanents || [])) {
          if (perm.name === 'Divine Gift of Balance') {
            delete perm._usedThisTurn;
          }
        }
      }
    },
  },

  // ── Permanent activation (generic system) ──

  /**
   * Can the given player activate this permanent right now?
   * Either player can activate on their own turn if they have
   * fewer cards than opponent, and this copy hasn't been used this turn.
   */
  canActivatePermanent(gs, activatorIdx, permOwner, engine) {
    // Must be activator's turn
    if (gs.activePlayer !== activatorIdx) return false;

    // Find this specific permanent instance
    const ownerPs = gs.players[permOwner];
    if (!ownerPs) return false;
    const perm = (ownerPs.permanents || []).find(p => p.name === 'Divine Gift of Balance');
    if (!perm) return false;

    // Soft HOPT: this specific copy, once per turn
    if (perm._usedThisTurn === gs.turn) return false;

    // Activator must have fewer cards than opponent
    const actPs = gs.players[activatorIdx];
    const oppIdx = activatorIdx === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!actPs || !oppPs) return false;
    if ((actPs.hand || []).length >= (oppPs.hand || []).length) return false;

    // Must have cards in deck to draw
    if ((actPs.mainDeck || []).length === 0) return false;

    return true;
  },

  /**
   * Activate: draw cards until hand matches opponent's count.
   */
  async onActivatePermanent(engine, activatorIdx, permOwner, perm) {
    const gs = engine.gs;
    const actPs = gs.players[activatorIdx];
    const oppIdx = activatorIdx === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!actPs || !oppPs) return;

    // Mark this copy as used this turn (soft HOPT)
    perm._usedThisTurn = gs.turn;

    // Golden scale animation on the permanent
    engine._broadcastEvent('play_permanent_animation', {
      owner: permOwner, permId: perm.id, type: 'golden_scale',
    });
    await engine._delay(800);

    // Draw until hand matches opponent
    const targetCount = (oppPs.hand || []).length;
    const currentCount = (actPs.hand || []).length;
    const toDraw = targetCount - currentCount;

    if (toDraw > 0) {
      await engine.actionDrawCards(activatorIdx, toDraw);
    }

    engine.log('divine_gift_balance', {
      player: actPs.username, drew: toDraw,
      handSize: (actPs.hand || []).length,
      oppHandSize: (oppPs.hand || []).length,
    });
    engine.sync();
  },
};
