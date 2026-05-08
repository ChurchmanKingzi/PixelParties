// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Reaper"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a Creature your opponent controls and
//  deal 50 damage to it. If this damage defeats that Creature, you may
//  immediately use this effect again.
//
//  Implementation: loops inside a single creatureEffect activation —
//  the global HOPT is claimed exactly once by the engine on success;
//  the "again on kill" chain happens before this method returns.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Reaper';
const DAMAGE = 50;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    // Need at least one opp creature on board.
    return engine.cardInstances.some(c =>
      c.zone === 'support' && (c.controller ?? c.owner) === oi,
    );
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const sourceCoord = { name: CARD_NAME, owner: pi, heroIdx };
    let firedAtLeastOnce = false;

    while (true) {
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to an opposing Creature. Killing it lets you fire again.`,
        confirmLabel: `🪦 Reap! (${DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) break;
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
      );
      if (!inst) break;

      // Crescent reap animation: a curved scythe-arc cut drawn across
      // the target. If this hit will defeat the Creature, the client
      // renders a HUGE dark+deadly variant (3× scale, near-black blade,
      // violet aura, rising skull) for the kill. Lethality is computed
      // from current HP — only an exact >= DAMAGE check is needed since
      // canBeNegated reactions can't make non-lethal damage suddenly
      // lethal post-broadcast. Negation can drop damage to 0, in which
      // case the heavy lethal cut would over-promise the outcome — but
      // creature negation is rare enough that the cinematic-on-likely-
      // kill payoff outweighs that edge case.
      const isLethal = (inst.counters?.currentHp || 0) <= DAMAGE;
      engine._broadcastEvent('play_zone_animation', {
        type: 'crescent_reap',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
        lethal: isLethal,
        // Lethal cut is ~1100ms total (blade 850 + aura/skull tail);
        // non-lethal resolves in ~450ms. Override the registry's 1000ms
        // default so the animation isn't cut off mid-skull.
        duration: isLethal ? 1300 : 600,
      });
      // Hold the action briefly so the blade visibly lands before HP
      // drops + the (likely) destroy flight kicks in. Lethal gets more
      // dwell to read as "doom is coming" before the kill finishes.
      await engine._delay(isLethal ? 700 : 320);

      await engine.actionDealCreatureDamage(
        sourceCoord, inst, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
      firedAtLeastOnce = true;
      engine.sync();

      // The damage batch routes lethal damage through actionDestroyCard,
      // which untracks the instance. If it's gone (or HP <= 0), the
      // kill counts and we offer another fire. Otherwise stop.
      const stillAlive = engine.cardInstances.some(c => c.id === inst.id)
        && (inst.counters?.currentHp || 0) > 0;
      if (stillAlive) break;

      // Stop the chain if there are no remaining opp creatures to hit.
      const oi = pi === 0 ? 1 : 0;
      const remaining = engine.cardInstances.some(c =>
        c.zone === 'support' && (c.controller ?? c.owner) === oi,
      );
      if (!remaining) break;
    }

    return firedAtLeastOnce;
  },
};
