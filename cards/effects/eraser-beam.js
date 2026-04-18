// ═══════════════════════════════════════════
//  CARD EFFECT: "Eraser Beam"
//  Spell (Destruction Magic Lv2, Normal)
//  Pollution archetype — HOPG, once per game.
//
//  • Must be the ONLY Spell you play this turn.
//  • Place 3 Pollution Tokens into your free Support
//    Zones to use this Spell (activation cost, paid
//    even if the Spell is later negated).
//  • Choose a target your opponent controls and defeat
//    it. Never hits more than 1 target.
//  • You can only play 1 "Eraser Beam" per game.
//
//  Interpretation of "defeat":
//    Eraser Beam is an OFFENSIVE effect. Defeat is
//    routed through the normal damage / destruction
//    pipelines so that every protection layer works
//    against it — first-turn protection, Gate Shield,
//    Anti Magic Enchantment, Anti Magic Shield,
//    Charmed/Submerged/Petrified immunity, Monia-style
//    creature protection, Surprise-triggered negation,
//    etc. If a protection blocks the effect, the target
//    survives. No protection → the target is erased.
//    (Gift of Sacrifice's hp=0 shortcut is NOT used —
//    that path is a voluntary self-sacrifice that must
//    bypass protections.)
//
//  "Only Spell this turn" enforcement:
//    - CAST TIME: `spellPlayCondition` reads
//      `ps._eraserBeamPriorSpellTurn`, stamped via a
//      broadcast `afterSpellResolved` listener.
//    - POST CAST: `onPlay` sets the generic engine
//      flag `ps._spellLockTurn = gs.turn`. The engine
//      blocks any further Spell plays until turn end.
//
//  Animation: blood-red beam from caster to target with
//  crackling lightning arcs — one of the deadliest Spells
//  in the game and looks the part.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');

const CARD_NAME = 'Eraser Beam';

module.exports = {
  placesPollutionTokens: true,
  oncePerGame: true,
  oncePerGameKey: 'eraserBeam',

  /**
   * Cast-time gate:
   *   • Must have ≥3 free Support Zones for the token cost.
   *   • Must not have played any other Spell this turn yet.
   *   • (The engine's generic per-player Spell lock also blocks
   *     re-casting Eraser Beam itself this turn, should the
   *     once-per-game key ever be reset — defense in depth.)
   */
  spellPlayCondition(gs, pi, engine) {
    if (countFreeZones(gs, pi) < 3) return false;
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._eraserBeamPriorSpellTurn === gs.turn) return false;
    if (ps._spellLockTurn === gs.turn) return false;
    return true;
  },

  /**
   * Place the 3 Pollution Token cost BEFORE the reaction chain
   * window, so a negation still leaves the caster with 3 Pollution
   * Tokens on their board (Cold Coffin / activation-cost pattern).
   */
  async payActivationCost(ctx) {
    await placePollutionTokens(ctx._engine, ctx.cardOwner, 3, CARD_NAME, { promptCtx: ctx });
  },

  hooks: {
    /**
     * Broadcast listener — fires for EVERY spell resolution across
     * the board. When the caster resolves a spell other than
     * Eraser Beam itself, stamp the per-player marker. spellPlayCondition
     * reads this to ban Eraser Beam when a Spell has already happened.
     *
     * Listens from hand/deck/discard; the engine's hook broadcast
     * path covers instances in any zone when `_onlyCard` isn't set.
     */
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (!ctx.spellName || ctx.spellName === CARD_NAME) return;
      // casterIdx identifies whose spell just resolved. Only stamp that
      // player's tracker — Eraser Beam in the opponent's deck doesn't care.
      const casterIdx = ctx.casterIdx;
      if (casterIdx == null || casterIdx < 0) return;
      if (casterIdx !== ctx.cardOwner) return;
      const ps = gs.players[casterIdx];
      if (!ps) return;
      ps._eraserBeamPriorSpellTurn = gs.turn;
    },

    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // Cost has already been paid via payActivationCost. Mark the
      // once-per-game key now so even a same-turn negation still
      // consumes the game-long charge.
      if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
      ps._oncePerGameUsed.add('eraserBeam');

      // Lock any further Spell plays for this player on this turn.
      // The engine's generic Spell lock gate (getHeroPlayableCards +
      // validateActionPlay) reads this flag.
      ps._spellLockTurn = gs.turn;

      // Target selection — opponent-side only, single target, respects
      // the standard Surprise / post-target reaction window built into
      // promptDamageTarget. `cancellable: false` because the activation
      // cost is already paid (Pollution Tokens are on the board).
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: 'Erase a target your opponent controls. Nothing survives — unless it\'s protected.',
        confirmLabel: '🩸 Erase!',
        confirmClass: 'btn-danger',
        cancellable: false,
      });

      if (!target) {
        engine.log('eraser_beam_fizzle', { player: ps.username, reason: 'no_target_or_negated' });
        return;
      }

      // ── Animation: blood-red beam with crackling lightning ──
      // Broadcast the custom beam event FIRST, then hold for the
      // animation to play out (~1.4s arc → ~0.3s settle before impact).
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('eraser_beam', {
        sourceOwner: ctx.cardHeroOwner ?? pi,
        sourceHeroIdx: heroIdx,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot: tgtSlot,
      });
      await engine._delay(1500);

      // ── Resolve defeat via normal offensive pipelines ──
      // • Hero: massive destruction_spell damage → actionDealDamage
      //   respects first-turn protection, Anti Magic Enchantment, Anti
      //   Magic Shield, Charmed/Submerged/Petrified immunity, surprise
      //   windows, and beforeDamage hooks. The amount (999999) is far
      //   larger than any max HP — if protection doesn't stop it, HP
      //   drops below zero and onHeroKO fires through the normal flow.
      // • Creature: processCreatureDamageBatch with the same damage
      //   type. beforeCreatureDamageBatch, buff multipliers, creature
      //   protection hooks, and Gate Shield all run normally.
      const ERASE_DAMAGE = 999999;
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, ERASE_DAMAGE, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.processCreatureDamageBatch([{
          inst: target.cardInstance,
          amount: ERASE_DAMAGE,
          type: 'destruction_spell',
          source: { name: CARD_NAME, owner: pi, heroIdx },
          sourceOwner: pi,
          canBeNegated: true,
          isStatusDamage: false,
          animType: null,
        }]);
      }

      engine.log('eraser_beam', {
        player: ps.username,
        target: target.cardName,
        targetType: target.type,
      });

      engine.sync();
    },
  },
};
