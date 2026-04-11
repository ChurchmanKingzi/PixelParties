// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Qinglong"
//  Creature (Lv5, 500HP) — Immune to opponent.
//  Once per turn: Opponent chooses 3 of their
//  targets consecutively. 120/80/40 damage.
//  All 3 selected first, then chain lightning.
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
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = ctx.cardZoneSlot;

    const damages = [120, 80, 40];
    const cardDB = engine._getCardDB();

    // Helper to build available targets for opponent
    const buildTargets = (excludeIds) => {
      const targets = [];
      const ops = gs.players[oppIdx];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        const id = `hero-${oppIdx}-${hi}`;
        if (excludeIds.has(id)) continue;
        targets.push({ id, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || cd.cardType !== 'Creature') continue;
        const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
        if (hp <= 0) continue;
        const id = `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`;
        if (excludeIds.has(id)) continue;
        targets.push({ id, type: 'equip', owner: oppIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
      }
      return targets;
    };

    // Phase 1: Opponent selects up to 3 targets sequentially
    // Stream card image to opponent first
    const oppSid = gs.players[oppIdx]?.socketId;
    if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: 'Cardinal Beast Qinglong' });
    await engine._delay(200);

    const selectedTargets = [];
    const excludeIds = new Set();

    for (let step = 0; step < 3; step++) {
      const targets = buildTargets(excludeIds);
      if (targets.length === 0) break;

      const selectedIds = await engine.promptEffectTarget(oppIdx, targets, {
        title: `Cardinal Beast Qinglong — Target ${step + 1}/3`,
        description: `Choose target #${step + 1} (will take ${damages[step]} damage).${step > 0 ? ` Already selected: ${selectedTargets.map((t,i) => `#${i+1} ${t.cardName}`).join(', ')}` : ''}`,
        confirmLabel: `⚡ #${step + 1} (${damages[step]} dmg)`,
        confirmClass: 'btn-danger',
        cancellable: false,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) break;
      const picked = targets.find(t => t.id === selectedIds[0]);
      if (!picked) break;

      selectedTargets.push(picked);
      excludeIds.add(picked.id);
    }

    if (selectedTargets.length === 0) return false;

    // Phase 2: Chain lightning animation + damage
    let prevOwner = pi, prevHeroIdx = heroIdx, prevZoneSlot = zoneSlot;

    for (let step = 0; step < selectedTargets.length; step++) {
      const tgt = selectedTargets[step];
      const dmg = damages[step];
      const tgtZoneSlot = tgt.type === 'hero' ? -1 : tgt.slotIdx;

      // Lightning from previous target (or Qinglong) to this target
      engine._broadcastEvent('qinglong_lightning', {
        srcOwner: prevOwner, srcHeroIdx: prevHeroIdx, srcZoneSlot: prevZoneSlot,
        tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot,
        step,
      });
      await engine._delay(400);

      // Deal damage
      if (tgt.type === 'hero') {
        const hero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (hero && hero.hp > 0) {
          await engine.actionDealDamage(
            { name: 'Cardinal Beast Qinglong', owner: pi, heroIdx },
            hero, dmg, 'normal'
          );
        }
      } else if (tgt.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: 'Cardinal Beast Qinglong', owner: pi, heroIdx },
          tgt.cardInstance, dmg, 'normal',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
      await engine._delay(300);

      // Next lightning starts from this target
      prevOwner = tgt.owner;
      prevHeroIdx = tgt.heroIdx;
      prevZoneSlot = tgtZoneSlot;
    }

    return true;
  },
};
