// ═══════════════════════════════════════════
//  CARD EFFECT: "Burning Skeleton"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a target your opponent controls and
//  Burn it for the rest of the game.
//
//  "Rest of the game" matches the engine's default Burn behavior —
//  Burn carries no expiry timer; only cleanse / heal effects remove
//  it. So no extra plumbing beyond the standard application path.
// ═══════════════════════════════════════════

const CARD_NAME = 'Burning Skeleton';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    const engine = ctx._engine;
    const oppPs = engine.gs.players[oi];
    if (!oppPs) return false;
    // At least one un-burned opp Hero or Creature must exist.
    for (const hero of (oppPs.heroes || [])) {
      if (hero?.name && hero.hp > 0 && !hero.statuses?.burned) return true;
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== oi) continue;
      if (inst.counters?.burned) continue;
      if (engine.canApplyCreatureStatus(inst, 'burned')) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const target = await ctx.promptDamageTarget({
      side: 'enemy',
      types: ['hero', 'creature'],
      damageType: 'status',
      title: CARD_NAME,
      description: 'Burn an opponent\'s Hero or Creature for the rest of the game.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
      cancellable: true,
      condition: (t) => {
        if (t.type === 'hero') {
          const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
          return !!h && !h.statuses?.burned;
        }
        if (t.type === 'creature' || t.type === 'equip') {
          const inst = engine.cardInstances.find(c =>
            c.zone === 'support' && c.owner === t.owner
            && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx,
          );
          return !!inst && !inst.counters?.burned && engine.canApplyCreatureStatus(inst, 'burned');
        }
        return true;
      },
    });
    if (!target) return false;

    // Build the zone-animation payload that addresses the chosen
    // target. Hero target → omit zoneSlot (the play_zone_animation
    // handler falls through to `[data-hero-zone]` when zoneSlot < 0).
    // Creature target → pass slotIdx so it lands on the support slot.
    const animPayload = { owner: target.owner, heroIdx: target.heroIdx };
    if (target.type === 'hero') {
      animPayload.zoneSlot = -1;
    } else {
      animPayload.zoneSlot = target.slotIdx;
    }

    // 1) Red diagonal slash — visual "wound" preceding the burn.
    //    Mirror of silence_cut's structure (480ms blade, 700ms total)
    //    but recolored. Wait long enough for the slash to read before
    //    layering the flame on top.
    engine._broadcastEvent('play_zone_animation', { type: 'red_cut', ...animPayload });
    await engine._delay(450);
    // 2) Flame on the target — the actual ignition.
    engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', ...animPayload });
    await engine._delay(300);

    if (target.type === 'hero') {
      await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
        appliedBy: pi,
      });
    } else {
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
      );
      if (inst && engine.canApplyCreatureStatus(inst, 'burned', { name: CARD_NAME, owner: pi })) {
        inst.counters.burned = true;
        engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: CARD_NAME });
      }
    }
    engine.sync();
    return true;
  },
};
