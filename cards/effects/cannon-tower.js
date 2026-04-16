// ═══════════════════════════════════════════
//  CARD EFFECT: "Cannon Tower"
//  Creature (Summoning Magic Lv3) — 300 HP
//
//  Once per turn: deal 150 damage to any target.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cannon Tower';
const DAMAGE    = 150;

module.exports = {
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to any target.`,
      confirmLabel: `🏰 ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtOwner    = target.owner;
    const tgtHeroIdx  = target.heroIdx;
    const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
    const impactSlot  = target.type === 'hero' ? -1 : target.slotIdx;

    // Cannonball projectile
    engine._broadcastEvent('play_projectile_animation', {
      sourceOwner: pi, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card.zoneSlot,
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      emoji: '💣',
      emojiStyle: { fontSize: 32 },
      duration: 600,
    });
    await engine._delay(500);

    // Impact explosion
    engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(250);

    if (target.type === 'hero') {
      const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
      if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
    } else if (target.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: CARD_NAME, owner: pi, heroIdx },
        target.cardInstance, DAMAGE, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }

    engine.sync();
    return true;
  },
};
