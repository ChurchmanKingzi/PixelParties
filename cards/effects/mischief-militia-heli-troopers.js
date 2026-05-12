// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Heli Troopers"
//  Creature — Summoning Magic Lv0, 10 HP
//
//  Death trigger: when this Creature is defeated,
//  its controller may choose any target on the
//  board and Freeze it for 1 turn. Optional
//  ("may") — the prompt is cancellable.
//
//  Trigger fires only for the dying instance
//  itself (instId match), so multiple Heli
//  Troopers each get exactly one trigger when
//  they die. The Heli Trooper is still tracked
//  in 'support' at hook-fire time (the engine
//  fires ON_CREATURE_DEATH BEFORE updating the
//  instance's zone), so `activeIn: ['support']`
//  is sufficient.
// ═══════════════════════════════════════════

const { applyFreezeToTarget } = require('./_mischief-militia-shared');

const CARD_NAME = 'Mischief Militia - Heli Troopers';

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    // The death trigger refunds value when the Creature is taken out —
    // freezing any opp target is roughly half a 60-dmg ping. Counts as
    // "this body wants to die" from the CPU's perspective.
    onDeathBenefit: 30,
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;
      // Self-death gate — every Heli Trooper on the board hears the hook;
      // only the dying instance's own listener fires.
      if (death.instId !== ctx.card.id) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      // Build target list: every face-up Hero (alive) + Creature on the
      // board that is not currently Frozen and can receive the status.
      const candidates = [];
      for (let pIdx = 0; pIdx < 2; pIdx++) {
        const ps = engine.gs.players[pIdx];
        if (!ps) continue;
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.frozen) continue;
          if (hero.statuses?.freeze_immune) continue;
          if (hero.buffs?.negative_status_immune) continue;
          candidates.push({
            id: `hero-${pIdx}-${hi}`,
            type: 'hero',
            owner: pIdx,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
      }
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        if (inst.id === ctx.card.id) continue; // skip the dying Trooper itself
        if (inst.counters?.frozen) continue;
        // Use the TARGETING-side gate so omni-immune Creatures (Cardinal
        // Beasts, Golden-Wings wearers, …) appear as valid targets —
        // the player can select them, the animation plays, and the
        // Freeze application fizzles silently in `applyFreezeToTarget`
        // via `canApplyCreatureStatus`. Per global convention: pickers
        // permissive, application side gates absolute immunity.
        if (!engine.canTargetForStatus(inst, 'frozen')) continue;
        candidates.push({
          id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip',
          owner: inst.owner,
          heroIdx: inst.heroIdx,
          slotIdx: inst.zoneSlot,
          cardName: inst.name,
          cardInstance: inst,
        });
      }
      if (candidates.length === 0) return;

      const picked = await engine.promptEffectTarget(pi, candidates, {
        title: CARD_NAME,
        description: 'Choose a target to Freeze for 1 turn.',
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true, // "may" — let the player skip
        maxTotal: 1,
      });
      if (!picked || picked.length === 0) return;

      const target = candidates.find(t => t.id === picked[0]);
      if (!target) return;

      await applyFreezeToTarget(engine, target, 1, pi);
      engine.log('heli_troopers_freeze', {
        player: engine.gs.players[pi]?.username,
        target: target.cardName,
      });
      engine.sync();
    },
  },
};
