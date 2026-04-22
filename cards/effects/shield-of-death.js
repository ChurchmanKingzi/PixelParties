// ═══════════════════════════════════════════
//  CARD EFFECT: "Shield of Death"
//  Artifact (Equipment, Cost 4)
//
//  When the equipped Hero takes damage from an
//  opponent's card/effect (not self, not status)
//  and survives, controller selects any target
//  to deal 100 damage. Once per turn.
//
//  Animation: dark magic skulls on target.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const card = ctx.card;
      const target = ctx.target;
      const source = ctx.source;
      const dmgType = ctx.type;

      if (!target || target.hp === undefined) return;

      // Must survive
      if (target.hp <= 0) return;

      // Find which hero was damaged
      let tgtPi = -1, tgtHi = -1;
      for (let p = 0; p < 2; p++) {
        for (let h = 0; h < (gs.players[p]?.heroes || []).length; h++) {
          if (gs.players[p].heroes[h] === target) { tgtPi = p; tgtHi = h; break; }
        }
        if (tgtPi >= 0) break;
      }
      if (tgtPi < 0 || tgtHi < 0) return;

      // Must be THIS Shield's hero
      if (tgtPi !== ctx.cardOriginalOwner || tgtHi !== card.heroIdx) return;

      // Must be opponent's damage (not self-inflicted by controller)
      const srcOwner = source?.controller ?? source?.owner;
      if (srcOwner == null || srcOwner === ctx.cardOwner) return;

      // No status damage
      if (dmgType === 'status') return;

      // Once per turn
      if (card.counters.shieldFiredThisTurn) return;

      card.counters.shieldFiredThisTurn = true;

      const pi = ctx.cardOwner; // Effective controller
      const heroIdx = card.heroIdx;

      // Prompt: select any hero or creature target. Renamed from `target` to
      // avoid shadowing the damaged-hero `target` from this hook's context
      // (declared at the top of this function).
      const retaliateTarget = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'artifact',
        baseDamage: 100,
        title: 'Shield of Death',
        description: `${ctx.attachedHero?.name || 'Hero'} survived damage! Choose a target to deal 100 damage.`,
        confirmLabel: '💀 Retaliate! (100)',
        confirmClass: 'btn-danger',
        cancellable: true,
        noSpellCancel: true,
      });

      if (!retaliateTarget) {
        card.counters.shieldFiredThisTurn = false; // Refund if cancelled
        return;
      }

      // Dark skulls animation on target
      engine._broadcastEvent('play_zone_animation', {
        type: 'death_skulls', owner: retaliateTarget.owner, heroIdx: retaliateTarget.heroIdx,
        zoneSlot: retaliateTarget.type === 'hero' ? -1 : retaliateTarget.slotIdx,
      });
      await engine._delay(400);

      // Deal damage
      const dmgSource = { name: 'Shield of Death', owner: ctx.cardOriginalOwner, heroIdx };
      if (retaliateTarget.type === 'hero') {
        const h = gs.players[retaliateTarget.owner]?.heroes?.[retaliateTarget.heroIdx];
        if (h && h.hp > 0) await engine.actionDealDamage(dmgSource, h, 100, 'artifact');
      } else {
        const inst = retaliateTarget.cardInstance || engine.cardInstances.find(c =>
          c.owner === retaliateTarget.owner && c.zone === 'support' && c.heroIdx === retaliateTarget.heroIdx && c.zoneSlot === retaliateTarget.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(dmgSource, inst, 100, 'artifact', { sourceOwner: pi, canBeNegated: true });
        }
      }

      engine.log('shield_of_death', { player: gs.players[pi].username, target: retaliateTarget.cardName });
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      ctx.card.counters.shieldFiredThisTurn = false;
    },
  },
};
