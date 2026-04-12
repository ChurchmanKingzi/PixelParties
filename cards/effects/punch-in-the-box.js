// ═══════════════════════════════════════════
//  CARD EFFECT: "Punch in the Box"
//  Potion (Reaction) — After-damage reaction.
//  When a target you control takes damage from
//  an opponent's card or effect, choose any
//  target the opponent controls and deal half
//  that damage (rounded up) to it.
//
//  Uses the after-damage reaction system
//  (like Fireshield) but lets the player pick
//  any opponent target instead of auto-retaliating.
//
//  Animation: boxing glove hitting from the side.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isAfterDamageReaction: true,
  isPotion: true,

  // Not proactively usable — grayed out in hand via unactivatableArtifacts
  canActivate: () => false,

  /**
   * Triggers on ANY opponent damage to our hero.
   * Source must be an opponent's card/effect (any type).
   */
  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    // Source must be from the opponent
    const srcOwner = source?.owner ?? source?.controller ?? -1;
    if (srcOwner < 0 || srcOwner === pi) return false;
    // Damage must be > 0 (already guaranteed by the system, but be safe)
    if (amount <= 0) return false;
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!oppPs) return;

    const recoil = Math.ceil(amount / 2);
    const cardDB = engine._getCardDB();

    // Build valid opponent targets (heroes + creatures)
    const targets = [];

    // Opponent heroes
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${oppIdx}-${hi}`,
        type: 'hero',
        owner: oppIdx,
        heroIdx: hi,
        cardName: hero.name,
      });
    }

    // Opponent creatures
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({
        id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: oppIdx,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }

    if (targets.length === 0) return;

    // Prompt player to choose target
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Punch in the Box',
      description: `Deal ${recoil} recoil damage (half of ${amount}) to an opponent's target.`,
      confirmLabel: `🥊 Punch! (${recoil})`,
      confirmClass: 'btn-danger',
      cancellable: false,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!selectedIds || selectedIds.length === 0) return;

    const chosen = targets.find(t => t.id === selectedIds[0]);
    if (!chosen) return;

    // Boxing glove animation on the chosen target
    engine._broadcastEvent('punch_box_animation', {
      targetOwner: chosen.owner,
      targetHeroIdx: chosen.heroIdx,
      targetZoneSlot: chosen.type === 'hero' ? -1 : chosen.slotIdx,
    });
    await engine._delay(800);

    // Deal recoil damage — temporarily clear the after-damage lock so the
    // opponent can chain their own after-damage reactions (e.g. their own Punch)
    engine._inAfterDamageReaction = false;
    if (chosen.type === 'hero') {
      const hero = oppPs.heroes?.[chosen.heroIdx];
      if (hero && hero.hp > 0) {
        await engine.actionDealDamage(
          { name: 'Punch in the Box', owner: pi },
          hero, recoil, 'other'
        );
      }
    } else if (chosen.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: 'Punch in the Box', owner: pi },
        chosen.cardInstance, recoil, 'other',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.log('punch_recoil', {
      player: ps.username,
      target: chosen.cardName,
      originalDamage: amount,
      recoilDamage: recoil,
    });

    engine.sync();
  },
};
