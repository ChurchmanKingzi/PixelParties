// ═══════════════════════════════════════════
//  CARD EFFECT: "Cold Coffin"
//  Spell (Decay Magic Lv1, Normal)
//  Pollution archetype.
//
//  Place 2 Pollution Tokens into your free Support
//  Zones to use this Spell. Choose a target and
//  Freeze it:
//    • Hero target  → frozen for 3 of that hero's
//      end-of-turn ticks (duration-backed, matches
//      Baihu's multi-turn stun model).
//    • Creature target → frozen indefinitely
//      (unhealable, since nothing ticks creature
//      frozen down outside cleanse effects — and
//      frozenUnhealable blocks cleanse).
//
//  Order of operations (per design):
//    1. Place 2 Pollution Tokens  (cost — paid at
//       activation, NOT refunded by negation)
//    2. Reaction window (opponent may negate)
//    3. Select target
//    4. Post-target reaction window (Anti Magic
//       Shield, etc.)
//    5. Apply freeze (if not negated)
//
//  The cost runs from payActivationCost, which the
//  server invokes before executeCardWithChain.
// ═══════════════════════════════════════════

const { placePollutionTokens, countFreeZones } = require('./_pollution-shared');

module.exports = {
  placesPollutionTokens: true,

  // Cost gate: need 2 free Support Zones for the token placement.
  spellPlayCondition(gs, pi) {
    return countFreeZones(gs, pi) >= 2;
  },

  // Activation cost (runs BEFORE the reaction chain window). The Pollution
  // placement is the spell's activation cost, so it is paid even if the
  // spell is negated by Anti Magic Shield, The Master's Plan, or any other
  // counter-spell. No refund.
  async payActivationCost(ctx) {
    await placePollutionTokens(ctx._engine, ctx.cardOwner, 2, 'Cold Coffin', { promptCtx: ctx });
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;

      // Cost was already paid by payActivationCost before the chain window,
      // so target selection is non-cancellable — the player is committed.
      // If a post-target reaction (Anti Magic Shield) negates, the prompt
      // returns null and we fall through silently; the server-level
      // `_spellNegatedByEffect` wins over `_spellCancelled` and discards
      // the card normally.
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: null,
        title: 'Cold Coffin',
        description: 'Freeze a target. Heroes: Frozen for 3 turns. Creatures: Frozen permanently (cannot be thawed).',
        confirmLabel: '❄️ Entomb!',
        confirmClass: 'btn-info',
        cancellable: false,
        condition: (t) => {
          // Skip already-frozen targets — the effect is a no-op on them
          if (t.type === 'hero') {
            const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
            return h && !h.statuses?.frozen;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.frozen;
          }
          return true;
        },
      });

      if (!target) return; // Negated or no valid target — cost was already paid.

      // ── Encasement animation on the target ──
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'cold_coffin_encase', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(900); // Animation runtime

      // ── Apply freeze ──
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
            duration: 3,
            appliedBy: pi,
          });
        }
      } else {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && engine.canApplyCreatureStatus(inst, 'frozen')) {
          inst.counters.frozen = 1;
          inst.counters.frozenAppliedBy = pi;
          // The engine's cleanseCreatureStatuses() checks for key+'Unhealable'
          // and skips removal — this is the canonical way to make a status stick.
          inst.counters.frozenUnhealable = true;
          engine.log('freeze_applied', {
            target: inst.name, by: 'Cold Coffin', unhealable: true,
          });
        }
      }

      engine.log('cold_coffin', {
        player: gs.players[pi].username,
        target: target.cardName,
        targetType: target.type,
      });
      engine.sync();
    },
  },
};
