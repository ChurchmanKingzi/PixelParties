// ═══════════════════════════════════════════
//  CARD EFFECT: "Fireball"
//  Spell (Normal, Lv2, Destruction Magic)
//
//  Choose up to 2 targets your opponent controls
//  (Heroes and/or Creatures) and deal 150 damage
//  to each.
//
//  Animation: one big fireball per selected target
//  flies out from the casting Hero and explodes
//  into flames on impact.
//
//  `ctx.promptMultiTarget` (baseDamage:150 → the
//  damage-targeting signal) runs the surprise +
//  post-target reaction windows itself, so the
//  per-target damage below skips its own reaction
//  check (one consolidated window per cast — same
//  rationale as Laser Volley).
// ═══════════════════════════════════════════

const CARD_NAME = 'Fireball';
const FIREBALL_DAMAGE = 150;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const srcHeroIdx = ctx.cardHeroIdx;

      // Up to 2 targets the opponent controls — Heroes and/or
      // Creatures. promptMultiTarget handles the targeting UI plus the
      // surprise + post-target reaction windows (baseDamage:150 makes
      // the damage-mitigation reactions eligible).
      // When performed via a forced effect (Chaorc Friendly Fireballer
      // sacrifices a Creature → "the Fireball MUST be used"), there's no
      // opt-out: the targeting can't be cancelled, so the player must
      // pick a target and fire. promptMultiTarget already enforces a
      // minimum of 1 target, so removing the cancel button is enough.
      const forced = !!ctx._forcePerform;
      const targets = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'enemy',
        max: 2,
        baseDamage: FIREBALL_DAMAGE,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `Choose up to 2 targets your opponent controls — deal ${FIREBALL_DAMAGE} damage to each.`,
        confirmLabel: `🔥 Fireball! (${FIREBALL_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: !forced,
      });

      // [] = cancelled or fully negated (promptMultiTarget already set
      // gs._spellCancelled / gs._spellNegatedByEffect as appropriate).
      if (!targets || targets.length === 0) return;

      const source = { name: CARD_NAME, owner: pi, heroIdx: srcHeroIdx, controller: pi };

      // ── One big fireball per target, flying from the caster ──
      // Staggered so two fireballs read as a quick volley, then we
      // wait out the trailing flight so the impact flames + damage
      // numbers land together with the projectiles.
      const FLIGHT = 520;
      const STAGGER = 130;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        engine._broadcastEvent('play_projectile_animation', {
          sourceOwner: pi,
          sourceHeroIdx: srcHeroIdx,
          // Originate from the CASTER: a Hero cast leaves the source
          // card's zoneSlot at -1 (→ Hero portrait), while a Creature
          // performing the Fireball (Chaorc Friendly Fireballer) carries
          // its own Support-Zone slot (→ the Creature fires it).
          sourceZoneSlot: ctx.card?.zoneSlot,
          targetOwner: t.owner,
          targetHeroIdx: t.heroIdx,
          targetZoneSlot: t.type === 'hero' ? undefined : t.slotIdx,
          emoji: '🔥',
          // The projectile-rotation wrapper assumes an EAST-facing
          // visual (rotation = the src→tgt angle). The 🔥 emoji points
          // UP by nature, so it reads 90° off — `baseAngle: 90` rotates
          // it to lead tip-first along the caster→target axis.
          baseAngle: 90,
          emojiStyle: { fontSize: 44 },
          duration: FLIGHT,
        });
        if (i < targets.length - 1) await engine._delay(STAGGER);
      }
      await engine._delay(Math.max(FLIGHT - STAGGER * (targets.length - 1), 250));

      // ── Impact: flame explosion + 150 damage per target ──
      // Reaction/surprise windows already ran inside promptMultiTarget,
      // so skip them here (no nested counter windows per target).
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!hero?.name || hero.hp <= 0) continue;
          engine._broadcastEvent('play_zone_animation', {
            type: 'flame_strike', owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1,
          });
          await engine.actionDealDamage(source, hero, FIREBALL_DAMAGE, 'destruction_spell', {
            _skipReactionCheck: true,
          });
        } else {
          const inst = t.cardInstance
            || engine.cardInstances.find(c =>
              (c.owner === t.owner || c.controller === t.owner)
              && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
          if (!inst) continue;
          engine._broadcastEvent('play_zone_animation', {
            type: 'flame_strike', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
          });
          await engine.actionDealCreatureDamage(source, inst, FIREBALL_DAMAGE, 'destruction_spell', {
            sourceOwner: pi, _skipReactionCheck: true,
          });
        }
      }

      engine.log('fireball', {
        player: ps.username,
        targets: targets.map(t => t.cardName),
        damage: FIREBALL_DAMAGE,
      });
      engine.sync();
    },
  },
};
