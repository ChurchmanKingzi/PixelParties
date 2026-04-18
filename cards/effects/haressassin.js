// ═══════════════════════════════════════════
//  CARD EFFECT: "Haressassin"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  Once per turn: deal 150 damage to any target.
// ═══════════════════════════════════════════

const CARD_NAME = 'Haressassin';
const DAMAGE    = 150;

module.exports = {
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    // Physical render side — where the creature actually sits on the
    // board. For a stolen / charmed-hero creature, ctx.cardOwner is the
    // activator (for damage credit) but the instance is still on its
    // original owner's side, so animations must use cardHeroOwner to
    // find the right support slot. For a non-stolen creature this
    // equals cardOwner, so the branch is invisible in the common case.
    const sourceOwner = ctx.cardHeroOwner;

    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to any target.`,
      confirmLabel: `🗡️ ${DAMAGE} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    const tgtHeroIdx  = target.heroIdx;
    const tgtOwner    = target.owner;
    const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;
    const impactSlot  = target.type === 'hero' ? -1 : target.slotIdx;

    // Haressassin dashes to the target …
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner, sourceHeroIdx: heroIdx,
      sourceZoneSlot: ctx.card.zoneSlot,          // originate from this creature's support slot
      targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
      targetZoneSlot: tgtZoneSlot,
      cardName: CARD_NAME, duration: 800,
    });
    await engine._delay(150); // Reaches target

    // … then slashes
    engine._broadcastEvent('play_zone_animation', {
      type: 'quick_slash', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot,
    });
    await engine._delay(300);

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

    await engine._delay(500); // Ram return
    engine.sync();
    return true;
  },
};
