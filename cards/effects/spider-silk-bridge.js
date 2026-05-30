// ═══════════════════════════════════════════
//  CARD EFFECT: "Spider Silk Bridge"
//  Spell (Support Magic Lv1, Surprise)
//
//  "Activate this Surprise when your opponent ends their turn without
//   dealing damage to any target you control that turn. Draw 2 cards.
//   Additionally, this card remains face-up in the user's Surprise
//   Zone until your opponent deals damage to a target you control. If
//   this card is face-up in your Hero's Surprise Zone at the beginning
//   of your turn, draw 1 card."
//
//  Mechanics
//  ─────────
//   • Trigger: end of OPPONENT's turn where opp didn't damage any of
//     the player's targets. Uses the engine's new
//     `surpriseTurnEndTrigger` + `_checkSurpriseOnTurnEnd` pipeline.
//     The "didn't damage me" check reads `gs.players[opp].dealtDamageToOpponent`
//     — the engine sets it true whenever a player damages an opp
//     hero/creature, and clears it at each turn start.
//   • Effect: draw 2.
//   • Persistence: `staysFaceUpOnActivation: true` keeps the card
//     face-up in the Surprise Zone after activation instead of
//     discarding. The engine sets `inst.faceDown = false` and leaves
//     the card name in `ps.surpriseZones[heroIdx]` so the UI renders
//     a face-up card on the Hero.
//   • Recurring draw: while face-up, `onTurnStart` (controller's
//     turn) draws 1.
//   • Lifecycle exit: while face-up, `afterDamage` /
//     `afterCreatureDamageBatch` listens for opp damage to any target
//     the controller controls — when it lands, the face-up Spider
//     Silk Bridge moves to its owner's discard pile.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spider Silk Bridge';

/** Move this face-up Spider Silk Bridge to its owner's discard pile. */
async function discardFaceUp(engine, inst, reason) {
  if (!inst || inst.zone !== 'surprise') return;
  const ps = engine.gs.players[inst.owner];
  if (!ps) return;
  const zone = ps.surpriseZones?.[inst.heroIdx];
  if (!zone) return;
  const idx = zone.indexOf(inst.name);
  if (idx < 0) return;
  // Zone-anchored fly to discard (project rule for chosen board card →
  // pile flights). Surprises with the same name on different heroes
  // are rare but possible (a player could in principle place 3 Spider
  // Silk Bridges), and the name-keyed diff animator would pick the
  // leftmost — pre-emit the slot-anchored flight to disambiguate.
  engine._broadcastEvent('play_pile_transfer', {
    owner: inst.owner, cardName: inst.name,
    from: 'surprise', to: 'discard',
    fromHeroIdx: inst.heroIdx,
  });
  zone.splice(idx, 1);
  ps.discardPile.push(inst.name);
  engine._untrackCard(inst.id);
  engine.log('spider_silk_bridge_consumed', {
    player: ps.username, reason,
  });
  engine.sync();
}

module.exports = {
  isSurprise: true,
  // Active in 'surprise' zone so the face-up `onTurnStart` / damage
  // listeners fire from the Surprise Zone. The face-down phase doesn't
  // fire hooks (runHooks skips faceDown), so this is harmless then.
  activeIn: ['surprise'],

  // Keep the card face-up in its Surprise Zone after activation.
  // Engine reads this in `_activateSurprise` and skips the splice +
  // discard step.
  staysFaceUpOnActivation: true,

  // No Telekinesis activation — there's no "attacker" to react to, and
  // the trigger is end-of-turn-state, not target-selection.
  canTelekinesisActivate: false,

  /**
   * End-of-turn trigger. Fires when opp ends their turn without having
   * dealt damage to any target this Spider Silk Bridge's controller
   * controls. The engine's `_checkSurpriseOnTurnEnd` calls this with
   * `info.endingPlayer` set to the player whose turn just ended.
   */
  surpriseTurnEndTrigger(gs, ownerIdx, heroIdx, info /*, engine */) {
    // Only fires on the OPPONENT's turn end.
    if (info.endingPlayer === ownerIdx) return false;
    // Opp must NOT have dealt damage to this player's targets this turn.
    // The engine's `dealtDamageToOpponent` flag is set on a player when
    // they damage opp's heroes / creatures, and cleared at turn start.
    if (info.dealtDamageToOpponent === true) return false;
    return true;
  },

  /**
   * On activation: draw 2 cards. The engine handles the "stays face-up"
   * persistence via the `staysFaceUpOnActivation` flag — no need to do
   * anything special here.
   */
  async onSurpriseActivate(ctx /*, sourceInfo */) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return null;

    // Web/silk visual on the activating Hero's slot.
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle',
      owner: pi, heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    const drawn = await engine.actionDrawCards(pi, 2, { source: CARD_NAME });
    engine.log('spider_silk_bridge_draw', {
      player: ps.username, drawn: drawn?.length || 0, phase: 'activation',
    });
    engine.sync();
    return null;
  },

  hooks: {
    /**
     * While face-up at start of own turn: draw 1. Only fires once
     * `inst.faceDown === false`, which is set by `_activateSurprise`
     * after the initial activation.
     */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.faceDown) return;
      if (inst.zone !== 'surprise') return;
      if (ctx.activePlayer !== inst.owner) return;
      const engine = ctx._engine;
      const drawn = await engine.actionDrawCards(inst.owner, 1, { source: CARD_NAME });
      engine.log('spider_silk_bridge_draw', {
        player: engine.gs.players[inst.owner]?.username,
        drawn: drawn?.length || 0, phase: 'turn_start',
      });
      engine.sync();
    },

    /**
     * Face-up exit condition: opp deals damage to a target the
     * controller controls → the Bridge crosses over and is consumed.
     * Reads the source's owner + target's owner; ignores self-damage
     * and own-creature damage.
     */
    afterDamage: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.faceDown || inst.zone !== 'surprise') return;
      if ((ctx.amount || 0) <= 0) return;
      const engine = ctx._engine;
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (srcOwner < 0 || srcOwner === inst.owner) return; // opp-source only
      // Target's owner must be this Bridge's controller.
      const tgtOwner = ctx.target?.owner ?? engine._findHeroOwner?.(ctx.target);
      if (tgtOwner == null || tgtOwner !== inst.owner) return;
      await discardFaceUp(engine, inst, 'opp_damaged_hero');
    },

    afterCreatureDamageBatch: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.faceDown || inst.zone !== 'surprise') return;
      const engine = ctx._engine;
      const entries = ctx.entries || [];
      for (const e of entries) {
        if (e.cancelled || (e.amount || 0) <= 0) continue;
        const tgtCtrl = e.inst?.controller ?? e.inst?.owner;
        if (tgtCtrl == null || tgtCtrl !== inst.owner) continue;
        const srcOwner = e.source?.owner ?? e.source?.controller ?? -1;
        if (srcOwner < 0 || srcOwner === inst.owner) continue;
        await discardFaceUp(engine, inst, 'opp_damaged_creature');
        return;
      }
    },
  },
};
