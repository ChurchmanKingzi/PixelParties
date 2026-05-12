// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Biseria"
//  Spell (Decay Magic Lv1, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Inherent additional Action.
//  Choose any target on the board and Freeze it
//  for 3 turns.
//
//  Hero target: standard frozen status with
//  duration=3 (engine ticks at end of controller's
//  turn — same model Cold Coffin uses).
//  Creature target: counters.frozen=1 plus
//  counters.frozenDuration=3 (engine decrement
//  block lives in processStatusExpiry END phase).
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: null,
        title: 'Divine Gift of Biseria',
        description: 'Choose any target to Freeze for 3 turns.',
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true,
        condition: (t) => {
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

      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'biseria_ice_engulf', owner: target.owner,
        heroIdx: target.heroIdx, zoneSlot: tgtSlot,
      });
      // Hold for the full animation runtime (~2.4s) before applying the
      // status — selling the visual weight of "engulfed in glaciers".
      await engine._delay(1400);

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
        if (inst) {
          const applied = await engine.applyCreatureStatus(inst, 'frozen', {
            sourceOwner: pi,
            duration: 3,
            source: 'Divine Gift of Biseria',
          });
          if (applied) engine.log('freeze_applied', { target: inst.name, by: 'Divine Gift of Biseria', duration: 3 });
        }
      }

      engine.log('divine_gift_biseria', {
        player: gs.players[pi].username,
        target: target.cardName,
        targetType: target.type,
      });
      engine.sync();
    },
  },
};
