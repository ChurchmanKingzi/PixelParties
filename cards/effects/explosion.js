// ═══════════════════════════════════════════
//  CARD EFFECT: "Explosion"
//  Spell (Normal, Lv 2, Destruction Magic)
//
//  Choose up to 3 targets your opponent controls
//  (Heroes and/or Creatures) and deal 100 damage
//  to each.
//
//  Ida, the Adept of Destruction's
//  `forcesSingleTarget` passive caps every
//  Destruction-Spell multi-pick to 1 — handled
//  automatically by the engine's `promptMultiTarget`
//  when `damageType === 'destruction_spell'`, so no
//  card-side branching is required (same as
//  Fireball / Chain Lightning / etc.).
//
//  Animation: a big `explosion` blooms on every
//  picked target, staggered so the three booms read
//  as a cascade rather than a single soup.
//  `ctx.promptMultiTarget` runs the surprise +
//  post-target reaction windows itself
//  (baseDamage:100 surfaces damage-mitigation
//  reactions), so the per-target damage skips its
//  own reaction check — one consolidated window per
//  cast, same as Fireball / Laser Volley.
// ═══════════════════════════════════════════

const CARD_NAME = 'Explosion';
const EXPLOSION_DAMAGE = 100;
const MAX_TARGETS = 3;

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      const srcHeroIdx = ctx.cardHeroIdx;

      const targets = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'enemy',
        max: MAX_TARGETS,
        baseDamage: EXPLOSION_DAMAGE,
        damageType: 'destruction_spell',
        title: CARD_NAME,
        description: `Choose up to ${MAX_TARGETS} targets your opponent controls — deal ${EXPLOSION_DAMAGE} damage to each.`,
        confirmLabel: `💥 Explode! (${EXPLOSION_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      // [] = cancelled or fully negated (promptMultiTarget already set
      // gs._spellCancelled / gs._spellNegatedByEffect as appropriate).
      if (!targets || targets.length === 0) return;

      const source = { name: CARD_NAME, owner: pi, heroIdx: srcHeroIdx, controller: pi };

      // ── Cascade of big explosion animations on every target ──
      // Fire each `explosion` broadcast first (staggered so the booms
      // ripple across the picked targets), then wait briefly for the
      // last one to start blooming before damage numbers begin landing.
      const STAGGER = 150;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.type === 'hero') {
          engine._broadcastEvent('play_zone_animation', {
            type: 'explosion', owner: t.owner, heroIdx: t.heroIdx, zoneSlot: -1,
          });
        } else {
          const inst = t.cardInstance
            || engine.cardInstances.find(c =>
              (c.owner === t.owner || c.controller === t.owner)
              && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
          if (inst) {
            engine._broadcastEvent('play_zone_animation', {
              type: 'explosion', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
            });
          }
        }
        if (i < targets.length - 1) await engine._delay(STAGGER);
      }
      await engine._delay(280);

      // ── 100 damage per target ──
      // Reaction / surprise windows already ran inside
      // promptMultiTarget, so skip them here.
      for (const t of targets) {
        if (t.type === 'hero') {
          const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
          if (!hero?.name || hero.hp <= 0) continue;
          await engine.actionDealDamage(source, hero, EXPLOSION_DAMAGE, 'destruction_spell', {
            _skipReactionCheck: true,
          });
        } else {
          const inst = t.cardInstance
            || engine.cardInstances.find(c =>
              (c.owner === t.owner || c.controller === t.owner)
              && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx);
          if (!inst) continue;
          await engine.actionDealCreatureDamage(source, inst, EXPLOSION_DAMAGE, 'destruction_spell', {
            sourceOwner: pi, _skipReactionCheck: true,
          });
        }
      }

      engine.log('explosion', {
        player: ps.username,
        targets: targets.map(t => t.cardName),
        damage: EXPLOSION_DAMAGE,
      });
      engine.sync();
    },
  },
};
