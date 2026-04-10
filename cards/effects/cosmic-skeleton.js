// ═══════════════════════════════════════════
//  CARD EFFECT: "Cosmic Skeleton"
//  Creature — Active effect (soft once per turn
//  per creature instance).
//
//  Requires the Hero to have at least 1 Spell
//  School Ability (except Summoning Magic) at
//  Lv1+. Hero must be alive.
//
//  Effect: Choose any target (friend/foe,
//  Hero/Creature, even itself) → deal 150 damage.
//  Animation: red laser beam to target.
//  Self-target: red laser show in all directions.
// ═══════════════════════════════════════════

const VALID_SCHOOLS = ['Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic'];

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  /**
   * Can activate if the hero has 1+ non-Summoning spell school ability at Lv1+.
   */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const heroOwner = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[heroOwner]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const abZones = gs.players[heroOwner].abilityZones[heroIdx] || [];
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      if (VALID_SCHOOLS.includes(slot[0])) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroOwner = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ctx.card.zoneSlot;

    // Prompt: select any target (hero or creature, either side)
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: 150,
      title: 'Cosmic Skeleton',
      description: 'Deal 150 damage to any target.',
      confirmLabel: '💀 Fire! (150)',
      confirmClass: 'btn-danger',
      cancellable: true,
      noSpellCancel: true,
    });

    if (!target) return false; // Cancelled

    // Determine if self-target (creature targeting itself)
    const isSelfTarget = target.type === 'equip' &&
      target.owner === heroOwner &&
      target.heroIdx === heroIdx &&
      target.slotIdx === zoneSlot;

    if (isSelfTarget) {
      // Red laser show in all directions
      engine._broadcastEvent('play_zone_animation', {
        type: 'laser_burst', owner: heroOwner, heroIdx, zoneSlot,
      });
    } else {
      // Red laser beam from skeleton to target
      const targetZoneSlot = target.type === 'equip' ? target.slotIdx : -1;
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: heroOwner,
        sourceHeroIdx: heroIdx,
        sourceZoneSlot: zoneSlot,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot,
        color: '#ff2222',
        duration: 1500,
      });
    }
    await engine._delay(400);

    // Deal damage
    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await ctx.dealDamage(hero, 150, 'other');
      }
    } else if (target.type === 'equip') {
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        await engine.actionDealCreatureDamage(
          { name: 'Cosmic Skeleton', owner: pi, heroIdx },
          inst, 150, 'other',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    engine.sync();
    await engine._delay(800);
    return true;
  },
};
