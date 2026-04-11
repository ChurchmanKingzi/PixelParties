// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Baihu"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Stun target for 3 turns with
//  damage immunity. Win if all 4 Cardinal Beasts
//  are controlled.
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

  canActivateCreatureEffect(ctx) { return true; },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const oppIdx = pi === 0 ? 1 : 0;

    // Target: any opponent's hero or creature
    const targets = [];
    const ops = gs.players[oppIdx];
    const cardDB = engine._getCardDB();
    for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
      const hero = ops.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.stunned) continue; // Already stunned
      targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
    }
    for (const inst of engine.cardInstances) {
      if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (inst.counters._baihuStunned) continue; // Already stunned
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
      title: 'Cardinal Beast Baihu',
      description: 'Choose a target to Stun for 3 turns (with damage immunity).',
      confirmLabel: '🐅 Petrify!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const picked = targets.find(t => t.id === selectedIds[0]);
    if (!picked) return false;

    // Petrification animation
    engine._broadcastEvent('baihu_petrify', {
      owner: picked.owner, heroIdx: picked.heroIdx,
      zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
    });
    await engine._delay(600);

    if (picked.type === 'hero') {
      await engine.addHeroStatus(picked.owner, picked.heroIdx, 'stunned', {
        duration: 3,
        _baihuPetrify: true,
      });
    } else if (picked.cardInstance) {
      if (!picked.cardInstance.counters._cardinalImmune) {
        picked.cardInstance.counters._baihuStunned = { duration: 3 };
        picked.cardInstance.counters._baihuPetrify = true;
      }
    }

    engine.log('baihu_petrify', { player: gs.players[pi]?.username, target: picked.cardName });
    engine.sync();
    return true;
  },
};
