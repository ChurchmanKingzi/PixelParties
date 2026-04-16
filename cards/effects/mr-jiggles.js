// ═══════════════════════════════════════════
//  CARD EFFECT: "Mr. Jiggles"
//  Creature (Summoning Magic Lv2) — 90 HP
//
//  Once per turn: choose up to 2 targets the
//  opponent controls and deal 100 damage to each.
// ═══════════════════════════════════════════

const CARD_NAME = 'Mr. Jiggles';
const DAMAGE    = 100;

module.exports = {
  creatureEffect: true,

  canActivateCreatureEffect() { return true; },

  async onCreatureEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    const targets = await ctx.promptMultiTarget({
      types: ['hero', 'creature'],
      side: 'enemy',
      max: 2,
      min: 1,
      title: CARD_NAME,
      description: `Deal ${DAMAGE} damage to up to 2 targets your opponent controls.`,
      confirmLabel: `🎉 ${DAMAGE} each!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!targets || targets.length === 0) return false;

    // Fire all laser beams simultaneously (no await between broadcasts)
    for (const target of targets) {
      engine._broadcastEvent('play_beam_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card.zoneSlot,
        targetOwner: target.owner, targetHeroIdx: target.heroIdx,
        targetZoneSlot: target.type === 'equip' ? target.slotIdx : -1,
        color: '#ff2222',
        duration: 1200,
      });
    }
    await engine._delay(400); // Beams travel

    for (const target of targets) {
      if (target.type === 'hero') {
        const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tgtHero && tgtHero.hp > 0) await ctx.dealDamage(tgtHero, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx },
          target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
    }

    await engine._delay(600); // Beams finish
    engine.sync();
    return true;
  },
};
