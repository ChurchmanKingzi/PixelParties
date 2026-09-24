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
      const hero = ctx.attachedHero || ps?.heroes?.[heroIdx];   // v1364: geliehener Held (Love Shot, Charme) — physische Seite
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

      // ── Apply Untargetable buff to casting hero ──
      // ★ v1304 (Als Ruling 23.9.): VOR dem Schaden. Loest der Flaechen-
      // schlag einen zielenden On-Death-Effekt aus (Flaming Dragonegg),
      // darf der Wirker dafuer schon nicht mehr waehlbar sein — vorher
      // griff der Schutz erst nach dem Schaden und damit zu spaet.
      // Direct-assignment shortcut bypasses `addHeroStatus`, so the
      // engine's centralized Anti-Magic gate (in addHeroStatus) doesn't
      // fire here. Apply the same gate locally so a self-Anti-Magic'd
      // caster (Anti Magic Lv 2+ attached to their own Hero) doesn't
      // pick up the untargetable from their own Butterfly Cloud cast.
      if (hero.hp > 0) {
        if (engine._isHeroSpellProtected(hero, 'Butterfly Cloud')) {
          engine.log('status_blocked', { target: hero.name, status: 'untargetable', reason: 'magic_immune' });
          engine._playAntiMagicBlockedAnim(hero);
        } else {
          if (!hero.statuses) hero.statuses = {};
          hero.statuses.untargetable = true;
          engine.log('status_applied', { target: hero.name, status: 'untargetable', player: ps.username });
        }
        engine.sync();
      }

      // ── AoE 50 damage to all enemy targets ──
      await ctx.aoeHit({
        damage: 50,
        damageType: 'other',
        side: 'enemy',
        types: ['hero', 'creature'],
        animationType: 'none',
        _skipSurpriseCheck: false,
      });

      // ── Set cooldown flag (blocks next turn, not this turn) ──
      ps._butterflyCloudUsedThisTurn = true;
    },
  },
};
