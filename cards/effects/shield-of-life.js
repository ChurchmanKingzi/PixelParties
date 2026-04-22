// ═══════════════════════════════════════════
//  CARD EFFECT: "Shield of Life"
//  Artifact (Equipment, Cost 4)
//
//  When the equipped Hero takes damage from an
//  opponent's card/effect (not self, not status)
//  and survives, controller selects any target
//  to heal for 100 HP. Once per turn.
//
//  Animation: heal sparkle on target.
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

      // Only hero damage (not creatures)
      if (target.hp <= 0) return; // Must survive

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

      // Prompt: select any hero or creature target. Renamed from `target`
      // to avoid shadowing the damaged-hero `target` from this hook's ctx.
      const healTarget = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        title: 'Shield of Life',
        description: `${ctx.attachedHero?.name || 'Hero'} survived damage! Choose a target to heal for 100 HP.`,
        confirmLabel: '💚 Heal! (100)',
        confirmClass: 'btn-success',
        cancellable: true,
        noSpellCancel: true,
      });

      if (!healTarget) {
        card.counters.shieldFiredThisTurn = false; // Refund if cancelled
        return;
      }

      // Heal sparkle animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: healTarget.owner, heroIdx: healTarget.heroIdx,
        zoneSlot: healTarget.type === 'hero' ? -1 : healTarget.slotIdx,
      });
      await engine._delay(300);

      // Heal
      const healSource = { name: 'Shield of Life', owner: ctx.cardOriginalOwner, heroIdx };
      if (healTarget.type === 'hero') {
        const h = gs.players[healTarget.owner]?.heroes?.[healTarget.heroIdx];
        if (h && h.hp > 0) await engine.actionHealHero(healSource, h, 100);
      } else {
        const inst = healTarget.cardInstance || engine.cardInstances.find(c =>
          c.owner === healTarget.owner && c.zone === 'support' && c.heroIdx === healTarget.heroIdx && c.zoneSlot === healTarget.slotIdx
        );
        if (inst) await engine.actionHealCreature(healSource, inst, 100);
      }

      engine.log('shield_of_life', { player: gs.players[pi].username, target: healTarget.cardName });
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      ctx.card.counters.shieldFiredThisTurn = false;
    },
  },
};
