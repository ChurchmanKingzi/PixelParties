// ═══════════════════════════════════════════
//  CARD EFFECT: "Chain Lightning"
//  Spell (Destruction Magic Lv3) — Opponent
//  must choose 3 targets (heroes first).
//  200/150/100 chain lightning damage.
// ═══════════════════════════════════════════

module.exports = {
  // Turn-1 shielded opponent makes every bolt fizzle (opponent picks the
  // targets and they're all immune). The CPU has no `getValidTargets` to
  // reason about, so flag it explicitly here.
  firstTurnSafe: false,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx = pi === 0 ? 1 : 0;
      const cardDB = engine._getCardDB();
      const damages = [200, 150, 100];

      // Stream card to opponent
      const oppSid = gs.players[oppIdx]?.socketId;
      if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: 'Chain Lightning' });
      await engine._delay(200);

      // Build all opponent targets
      const targets = [];
      const ops = gs.players[oppIdx];
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: hero.name });
      }
      for (const inst of engine.cardInstances) {
        if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || cd.cardType !== 'Creature') continue;
        const hp = inst.counters?.currentHp ?? cd.hp ?? 0;
        if (hp <= 0) continue;
        targets.push({ id: `equip-${oppIdx}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: oppIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
      }
      if (targets.length === 0) return;

      // ── Ida single-target override ──
      const heroFlags = gs.heroFlags?.[`${pi}-${heroIdx}`];
      if (heroFlags?.forcesSingleTarget) {
        // Opponent picks only 1 target, only the first hit (200) applies
        const selected = await engine.promptEffectTarget(oppIdx, targets, {
          title: 'Chain Lightning (Single Target)',
          description: 'Choose 1 target to take 200 damage.',
          confirmLabel: '⚡ Accept (200)',
          confirmClass: 'btn-danger',
          cancellable: false,
          exclusiveTypes: true,
          maxPerType: { hero: 1, equip: 1 },
        });
        if (!selected || selected.length === 0) return;

        const tgt = targets.find(t => t.id === selected[0]);
        if (!tgt) return;

        const tgtZoneSlot = tgt.type === 'hero' ? -1 : tgt.slotIdx;
        engine._broadcastEvent('qinglong_lightning', {
          srcOwner: pi, srcHeroIdx: heroIdx, srcZoneSlot: -1,
          tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step: 0,
        });
        await engine._delay(400);

        if (tgt.type === 'hero') {
          const hero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
          if (hero && hero.hp > 0) {
            await engine.actionDealDamage({ name: 'Chain Lightning', owner: pi, heroIdx }, hero, 200, 'destruction_spell');
          }
        } else if (tgt.cardInstance) {
          await engine.actionDealCreatureDamage(
            { name: 'Chain Lightning', owner: pi, heroIdx },
            tgt.cardInstance, 200, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
        engine.sync();
        return;
      }

      // Prompt opponent to pick targets (heroes first)
      const selectedTargets = await engine.promptChainTargets(oppIdx, targets, damages, {
        title: 'Chain Lightning',
        heroesFirst: true,
      });

      if (selectedTargets.length === 0) return;

      // Chain lightning animation + damage
      let prevOwner = selectedTargets[0].owner;
      let prevHeroIdx = selectedTargets[0].heroIdx;
      let prevZoneSlot = selectedTargets[0].type === 'hero' ? -1 : selectedTargets[0].slotIdx;

      for (let step = 0; step < selectedTargets.length; step++) {
        const tgt = selectedTargets[step];
        const dmg = damages[step];
        const tgtZoneSlot = tgt.type === 'hero' ? -1 : tgt.slotIdx;

        if (step > 0) {
          engine._broadcastEvent('qinglong_lightning', {
            srcOwner: prevOwner, srcHeroIdx: prevHeroIdx, srcZoneSlot: prevZoneSlot,
            tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step,
          });
        } else {
          // First bolt originates from the spellcaster
          engine._broadcastEvent('qinglong_lightning', {
            srcOwner: pi, srcHeroIdx: ctx.cardHeroIdx, srcZoneSlot: -1,
            tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step: 0,
          });
        }
        await engine._delay(400);

        if (tgt.type === 'hero') {
          const hero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
          if (hero && hero.hp > 0) {
            await engine.actionDealDamage({ name: 'Chain Lightning', owner: pi, heroIdx: ctx.cardHeroIdx }, hero, dmg, 'destruction_spell');
          }
        } else if (tgt.cardInstance) {
          await engine.actionDealCreatureDamage(
            { name: 'Chain Lightning', owner: pi, heroIdx: ctx.cardHeroIdx },
            tgt.cardInstance, dmg, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
        engine.sync();
        await engine._delay(10);

        prevOwner = tgt.owner;
        prevHeroIdx = tgt.heroIdx;
        prevZoneSlot = tgtZoneSlot;
      }
    },
  },
};
