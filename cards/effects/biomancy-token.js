// ═══════════════════════════════════════════
//  CARD EFFECT: "Biomancy Token"
//  Creature/Token — Active ability (HOPT)
//
//  Once per turn: Deal damage equal to this
//  Token's stored biomancyDamage to any
//  single target on the board.
//
//  When leaving the board, goes to deleted pile
//  (handled by Token card type logic).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    if (!inst?.counters?.biomancyDamage) return false;
    return true;
  },

  onCreatureEffect: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const inst = ctx.card;
    const damage = inst.counters.biomancyDamage || 40;

    // Build target list: all living heroes + creatures (both players)
    const targets = [];
    const cardDB = engine._getCardDB();
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      const pState = gs.players[pIdx];
      for (let hi = 0; hi < (pState.heroes || []).length; hi++) {
        const h = pState.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        targets.push({ id: `hero-${pIdx}-${hi}`, type: 'hero', owner: pIdx, heroIdx: hi, cardName: h.name });
      }
      for (const ci of engine.cardInstances) {
        if (ci.owner !== pIdx || ci.zone !== 'support') continue;
        if (ci.faceDown) continue;
        if (ci.id === inst.id) continue; // Can't target self
        const cd = engine.getEffectiveCardData(ci) || cardDB[ci.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${pIdx}-${ci.heroIdx}-${ci.zoneSlot}`,
          type: 'equip', owner: pIdx, heroIdx: ci.heroIdx,
          slotIdx: ci.zoneSlot, cardName: ci.name, cardInstance: ci,
        });
      }
    }

    if (targets.length === 0) return false;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Biomancy Token',
      description: `Deal ${damage} damage to any target.`,
      confirmLabel: `🌿 ${damage} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });

    if (!selectedIds || selectedIds.length === 0) return false;

    const picked = targets.find(t => t.id === selectedIds[0]);
    if (!picked) return false;

    // Play vine animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'biomancy_vines',
      owner: picked.owner, heroIdx: picked.heroIdx,
      zoneSlot: picked.type === 'equip' ? picked.slotIdx : -1,
    });
    await engine._delay(400);

    // Deal damage
    if (picked.type === 'hero') {
      const targetHero = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
      if (targetHero && targetHero.hp > 0) {
        await engine.actionDealDamage(
          { name: 'Biomancy Token', owner: pi, heroIdx: inst.heroIdx },
          targetHero, damage, 'other'
        );
      }
    } else if (picked.type === 'equip' && picked.cardInstance) {
      await engine.actionDealCreatureDamage(
        { name: 'Biomancy Token', owner: pi, heroIdx: inst.heroIdx },
        picked.cardInstance, damage, 'other',
        { sourceOwner: pi },
      );
    }

    engine.log('biomancy_token_attack', {
      player: gs.players[pi]?.username,
      target: picked.cardName, damage,
    });

    engine.sync();
  },
};
