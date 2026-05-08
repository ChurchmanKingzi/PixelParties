// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Healer"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose a different target and heal it for
//  100 HP. ("Different" = anything other than this Creature itself.)
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Healer';
const HEAL = 100;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ctx.card.zoneSlot;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      title: CARD_NAME,
      description: `Heal a target for ${HEAL} HP. Cannot target this Creature.`,
      confirmLabel: `✨ Heal! (${HEAL})`,
      confirmClass: 'btn-success',
      cancellable: true,
      condition: (t) => {
        // Disallow self-target — "different" target per card text.
        if (t.type === 'equip' && t.owner === pi
            && t.heroIdx === heroIdx && t.slotIdx === zoneSlot) return false;
        return true;
      },
    });
    if (!target) return false;

    // Mirror Heal's three-phase laser sequence (cards/effects/heal.js):
    // green beam rises off-screen from the source, descends onto the
    // target, then a sparkle burst marks impact. Source here is the
    // Creature itself in the support slot, so the beam's first phase
    // uses `sourceZoneSlot` — the play_heal_beam handler resolves a
    // support-zone selector when that's >= 0, falling back to the
    // hero zone otherwise.
    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_heal_beam', {
      phase: 'rise',
      sourceOwner: pi,
      sourceHeroIdx: heroIdx,
      sourceZoneSlot: zoneSlot,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot: tgtZoneSlot,
    });
    await engine._delay(500);
    engine._broadcastEvent('play_heal_beam', {
      phase: 'strike',
      sourceOwner: pi,
      sourceHeroIdx: heroIdx,
      sourceZoneSlot: zoneSlot,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot: tgtZoneSlot,
    });
    await engine._delay(350);
    engine._broadcastEvent('play_zone_animation', {
      type: 'heal_sparkle',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: tgtZoneSlot,
    });
    await engine._delay(200);

    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await ctx.healHero(hero, HEAL);
    } else {
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support' && c.owner === target.owner
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
      );
      if (inst) await ctx.healCreature(inst, HEAL);
    }
    engine.log('skeleton_healer', {
      player: engine.gs.players[pi]?.username,
      target: target.cardName,
      amount: HEAL,
    });
    engine.sync();
    return true;
  },
};
