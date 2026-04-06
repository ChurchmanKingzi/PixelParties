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

      // Build all targets (any hero or creature, either side)
      const targets = [];
      for (let p = 0; p < 2; p++) {
        for (let hi = 0; hi < (gs.players[p].heroes || []).length; hi++) {
          const h = gs.players[p].heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          targets.push({ id: `hero-${p}-${hi}`, type: 'hero', owner: p, heroIdx: hi, cardName: h.name });
        }
        for (let hi = 0; hi < (gs.players[p].heroes || []).length; hi++) {
          if (!gs.players[p].heroes[hi]?.name || gs.players[p].heroes[hi].hp <= 0) continue;
          for (let si = 0; si < (gs.players[p].supportZones[hi] || []).length; si++) {
            const slot = (gs.players[p].supportZones[hi] || [])[si] || [];
            if (slot.length === 0) continue;
            const inst = engine.cardInstances.find(c =>
              c.owner === p && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
            );
            if (!inst) continue;
            targets.push({ id: `equip-${p}-${hi}-${si}`, type: 'equip', owner: p, heroIdx: hi, slotIdx: si, cardName: slot[0], cardInstance: inst });
          }
        }
      }

      if (targets.length === 0) return;

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Shield of Life',
        description: `${ctx.attachedHero?.name || 'Hero'} survived damage! Choose a target to heal for 100 HP.`,
        confirmLabel: '💚 Heal! (100)',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!picked || picked.length === 0) {
        card.counters.shieldFiredThisTurn = false; // Refund if cancelled
        return;
      }

      const sel = targets.find(t => t.id === picked[0]);
      if (!sel) { card.counters.shieldFiredThisTurn = false; return; }

      // Heal sparkle animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'heal_sparkle', owner: sel.owner, heroIdx: sel.heroIdx,
        zoneSlot: sel.type === 'hero' ? -1 : sel.slotIdx,
      });
      await engine._delay(300);

      // Heal
      const healSource = { name: 'Shield of Life', owner: pi, heroIdx };
      if (sel.type === 'hero') {
        const h = gs.players[sel.owner]?.heroes?.[sel.heroIdx];
        if (h && h.hp > 0) await engine.actionHealHero(healSource, h, 100);
      } else {
        const inst = sel.cardInstance || engine.cardInstances.find(c =>
          c.owner === sel.owner && c.zone === 'support' && c.heroIdx === sel.heroIdx && c.zoneSlot === sel.slotIdx
        );
        if (inst) await engine.actionHealCreature(healSource, inst, 100);
      }

      engine.log('shield_of_life', { player: gs.players[pi].username, target: sel.cardName });
      engine.sync();
    },

    onTurnStart: async (ctx) => {
      ctx.card.counters.shieldFiredThisTurn = false;
    },
  },
};
