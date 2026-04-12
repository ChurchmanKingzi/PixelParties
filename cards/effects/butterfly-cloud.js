// ═══════════════════════════════════════════
//  CARD EFFECT: "Butterfly Cloud"
//  Spell — AoE + Untargetable self-buff.
//
//  Deal 50 damage to all targets your opponent
//  controls. The casting Hero becomes untargetable
//  until the beginning of your next turn (opponent
//  can't choose it with Attacks, Spells, or
//  Creature effects while other Heroes are valid).
//
//  Cooldown: cannot be played on 2 consecutive
//  turns. Multiple can be played in a single turn.
//
//  Animation: golden butterflies swarm from caster
//  to all enemy targets before damage resolves.
// ═══════════════════════════════════════════

module.exports = {
  // Cooldown: blocked if any Butterfly Cloud was played last turn
  spellPlayCondition: (gs, playerIdx) => {
    const ps = gs.players[playerIdx];
    return !ps._butterflyCooldown;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const oppIdx = pi === 0 ? 1 : 0;

      // ── Butterfly swarm animation ──
      // Collect all enemy target positions for the animation
      const animTargets = [];
      const oppPs = gs.players[oppIdx];
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const h = oppPs.heroes[hi];
        if (h?.name && h.hp > 0) animTargets.push({ owner: oppIdx, heroIdx: hi, type: 'hero' });
      }
      for (const inst of engine.cardInstances) {
        if ((inst.owner !== oppIdx && inst.controller !== oppIdx) || inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
        if (!cd || !cd.cardType?.includes('Creature')) continue;
        animTargets.push({ owner: oppIdx, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, type: 'creature' });
      }

      engine._broadcastEvent('butterfly_cloud_animation', {
        sourceOwner: pi, sourceHeroIdx: heroIdx, targets: animTargets,
      });
      await engine._delay(1400);

      // ── AoE 50 damage to all enemy targets ──
      await ctx.aoeHit({
        damage: 50,
        damageType: 'other',
        side: 'enemy',
        types: ['hero', 'creature'],
        animationType: 'none',
        _skipSurpriseCheck: false,
      });

      // ── Apply Untargetable buff to casting hero ──
      if (hero.hp > 0) {
        if (!hero.statuses) hero.statuses = {};
        hero.statuses.untargetable = true;
        engine.log('status_applied', { target: hero.name, status: 'untargetable', player: ps.username });
        engine.sync();
      }

      // ── Set cooldown flag (blocks next turn, not this turn) ──
      ps._butterflyCloudUsedThisTurn = true;
    },
  },
};
