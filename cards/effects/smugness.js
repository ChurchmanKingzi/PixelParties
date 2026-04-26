// ═══════════════════════════════════════════
//  CARD EFFECT: "Smugness"
//  Ability — Ascended Hero only.
//
//  Whenever this Hero takes damage from an
//  opponent's card or effect (not status, not
//  self-induced), the controller may choose
//  any target and deal scaled damage:
//    Lv1: half the damage taken
//    Lv2: same damage taken
//    Lv3: double the damage taken
//
//  Animation: raccoon projectile from hero
//  to target.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  ascendedHeroOnly: true,
  // Lizbeth/Smugbeth: auto-mirror disabled because the hook re-walks
  // `ps.abilityZones[heroIdx]` for level lookup using the redirected
  // (Lizbeth's) heroIdx — Lizbeth has no Smugness slot of her own so
  // the level resolves to 0 and the retaliation aborts. A bespoke
  // Lizbeth-side handler that reads the SOURCE Smugness's level is
  // tracked under Phase 3 (per-ability mirroring punch list).
  disableLizbethMirror: true,

  /**
   * Restrict placement to Ascended Heroes only.
   * Checked by the server's play_ability handler.
   */
  canAttachToHero(gs, pi, heroIdx, engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name) return false;
    const cardDB = engine ? engine._getCardDB() : null;
    if (!cardDB) return true; // Fallback: allow (server will validate)
    const heroData = cardDB[hero.name];
    return heroData?.cardType === 'Ascended Hero';
  },

  hooks: {
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const target = ctx.target;
      const source = ctx.source;
      const dmgType = ctx.type;
      const amount = ctx.amount;

      // Only fire once per hero — skip if another Smugness instance on this hero already handled it
      const allSmugness = engine.cardInstances.filter(c =>
        c.name === 'Smugness' && c.owner === pi && c.heroIdx === heroIdx && c.zone === 'ability'
      );
      if (allSmugness.length > 0 && allSmugness[0].id !== ctx.card.id) return;

      // Only react to hero damage
      if (!target || target.hp === undefined) return;

      // Must be THIS ability's hero that was damaged
      let tgtPi = -1, tgtHi = -1;
      for (let p = 0; p < 2; p++) {
        for (let h = 0; h < (gs.players[p]?.heroes || []).length; h++) {
          if (gs.players[p].heroes[h] === target) { tgtPi = p; tgtHi = h; break; }
        }
        if (tgtPi >= 0) break;
      }
      if (tgtPi !== pi || tgtHi !== heroIdx) return;

      // No status/burn/poison damage
      const STATUS_TYPES = new Set(['status', 'burn', 'poison']);
      if (STATUS_TYPES.has(dmgType)) return;

      // Must be from opponent (not self-induced, not sourceless)
      const srcOwner = source?.controller ?? source?.owner ?? -1;
      if (srcOwner < 0 || srcOwner === pi) return;

      // Must have actually dealt damage
      if (!amount || amount <= 0) return;

      // Determine level from ability stack
      const ps = gs.players[pi];
      const abZones = ps.abilityZones[heroIdx] || [];
      let level = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        if (slot[0] === 'Smugness') { level = slot.length; break; }
      }
      if (level <= 0) return;

      // Calculate retaliation damage
      let retDamage;
      if (level === 1) retDamage = Math.ceil(amount / 2);
      else if (level === 2) retDamage = amount;
      else retDamage = amount * 2; // Lv3+

      if (retDamage <= 0) return;

      // Prompt: choose any target (hero or creature, friend or foe)
      const heroName = ps.heroes[heroIdx]?.name || 'Hero';
      const picked = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'other',
        baseDamage: retDamage,
        title: 'Smugness',
        description: `${heroName} took ${amount} damage! Deal ${retDamage} to a target.`,
        confirmLabel: `🦝 Retaliate! (${retDamage})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        noSpellCancel: true,
        _skipDamageLog: true,
      });

      if (!picked) return;

      // Raccoon projectile animation from Smugness hero to target
      const tgtZoneSlot = picked.type === 'equip' ? picked.slotIdx : -1;
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: pi,
        sourceHeroIdx: heroIdx,
        targetOwner: picked.owner,
        targetHeroIdx: picked.heroIdx,
        targetZoneSlot: tgtZoneSlot,
        emoji: '🦝',
        emojiStyle: { fontSize: '72px', filter: 'drop-shadow(0 0 16px rgba(80,50,20,.9)) drop-shadow(0 0 32px rgba(139,90,43,.7))' },
        trailClass: 'projectile-raccoon-trail',
        duration: 600,
      });
      await engine._delay(500);

      // Impact animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: picked.owner,
        heroIdx: picked.heroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(300);

      // Deal damage
      const dmgSource = { name: 'Smugness', owner: pi, heroIdx };
      if (picked.type === 'hero') {
        const h = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(dmgSource, h, retDamage, 'other');
        }
      } else if (picked.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, picked.cardInstance, retDamage, 'other',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('smugness', {
        player: ps.username,
        hero: heroName,
        damageTaken: amount,
        retDamage,
        level,
        target: picked.cardName,
      });
      engine.sync();
    },
  },
};
