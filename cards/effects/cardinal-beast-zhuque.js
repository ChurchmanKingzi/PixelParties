// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Zhuque"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Choose a target and Burn it.
//  If Hero, also burn all Creatures in its
//  Support Zones.
// ═══════════════════════════════════════════

const { _checkCardinalWin, _setCardinalImmune } = require('./_cardinal-shared');

module.exports = {
  creatureEffect: true,

  hooks: {
    onPlay: async (ctx) => { _setCardinalImmune(ctx); },
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.name?.startsWith('Cardinal Beast')) await _checkCardinalWin(ctx);
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const ops = gs.players[oppIdx];
    if (!ops) return false;

    // Must have 1+ non-burned target
    for (const hero of (ops.heroes || [])) {
      if (hero?.name && hero.hp > 0 && !hero.statuses?.burned) return true;
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (!inst.counters.burned) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const heroIdx = ctx.cardHeroIdx;

    // Build targets: opponent's non-burned heroes and creatures
    const targets = [];
    const ops = gs.players[oppIdx];
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.burned) continue;
      targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
    }
    const cardDB = engine._getCardDB();
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (inst.counters.burned) continue;
      const cd = cardDB[inst.name];
      if (!cd || cd.cardType !== 'Creature') continue;
      const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
      if (hp <= 0) continue;
      targets.push({
        id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: oppIdx, heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
      });
    }
    if (targets.length === 0) return false;

    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: 'Cardinal Beast Zhuque',
      description: 'Choose a target to Burn permanently.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const picked = targets.find(t => t.id === selectedIds[0]);
    if (!picked) return false;

    // Flame animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike', owner: picked.owner,
      heroIdx: picked.heroIdx, zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
    });
    await engine._delay(400);

    if (picked.type === 'hero') {
      const hero = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
      if (hero && hero.hp > 0 && !hero.statuses?.burned) {
        await engine.addHeroStatus(picked.owner, picked.heroIdx, 'burned', { permanent: true });
      }
      // Also burn all creatures in this hero's support zones
      for (const inst of engine.cardInstances) {
        if (inst.owner !== picked.owner || inst.zone !== 'support' || inst.heroIdx !== picked.heroIdx) continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || cd.cardType !== 'Creature') continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        if (!inst.counters.burned && !inst.counters._cardinalImmune) {
          inst.counters.burned = true;
          inst.counters.burnAppliedBy = pi;
          engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Cardinal Beast Zhuque' });
        }
      }
    } else if (picked.cardInstance) {
      if (!picked.cardInstance.counters.burned && !picked.cardInstance.counters._cardinalImmune) {
        picked.cardInstance.counters.burned = true;
        picked.cardInstance.counters.burnAppliedBy = pi;
        engine.log('creature_burned', { card: picked.cardName, owner: picked.owner, by: 'Cardinal Beast Zhuque' });
      }
    }

    engine.log('zhuque_burn', { player: gs.players[pi]?.username, target: picked.cardName });
    engine.sync();
    return true;
  },
};
