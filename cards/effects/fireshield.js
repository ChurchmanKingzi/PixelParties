// ═══════════════════════════════════════════
//  CARD EFFECT: "Fireshield"
//  Spell (Reaction) — Destruction Magic Lv1
//  When a hero takes damage from opponent's
//  Attack/Spell/Creature effect and survives,
//  deal half damage back as recoil (full at
//  Destruction Magic Lv3).
//
//  Recoil routing: a Creature attacker takes the
//  recoil ITSELF (not its host Hero); a Hero
//  attacker (Spell/Attack) takes it on the Hero.
//  Source→creature resolution is the shared
//  `_hooks` helper (same one Booby Trap uses) so
//  the routing never diverges between cards.
// ═══════════════════════════════════════════

const { resolveSourceCreature, isCreatureSource } = require('./_hooks');

module.exports = {
  isAfterDamageReaction: true,

  /**
   * Triggers on opponent combat damage (Attack/Spell/Creature effect)
   * when there's a valid recoil target left alive: the attacking
   * Creature itself, or — for Hero-cast Spells/Attacks — the Hero.
   */
  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    if (source?.owner == null || source.owner < 0) return false;
    if (source.owner === pi) return false; // Only opponent damage
    const srcPs = gs.players[source.owner];
    if (!srcPs) return false;

    if (isCreatureSource(engine, source)) {
      // Creature attacker — only if its live instance is still on the
      // board to receive the recoil.
      return !!resolveSourceCreature(engine, source);
    }

    // Hero source (Spell / Attack): need a living attacker Hero.
    const srcHeroIdx = source.heroIdx ?? -1;
    if (srcHeroIdx < 0) return false;
    const srcHero = srcPs.heroes?.[srcHeroIdx];
    if (!srcHero || srcHero.hp <= 0) return false;
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, source, amount, type) {
    const gs = engine.gs;
    const ps = gs.players[pi];

    // Count Destruction Magic level on the damaged hero (with Performance)
    const abZones = ps.abilityZones[targetHeroIdx] || [];
    let dmLevel = 0;
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const base = slot[0];
      for (const ab of slot) {
        if (ab === 'Destruction Magic') dmLevel++;
        else if (ab === 'Performance' && base === 'Destruction Magic') dmLevel++;
      }
    }

    const recoil = dmLevel >= 3 ? amount : Math.ceil(amount / 2);

    // Fire corona animation on the Fireshield user
    engine._broadcastEvent('fireshield_corona', { owner: pi, heroIdx: targetHeroIdx });
    await engine._delay(600);

    if (isCreatureSource(engine, source)) {
      // Creature attacker — recoil hits the CREATURE itself, never its
      // host Hero. (No live creature → attacker already gone, no
      // recoil; condition normally prevents reaching here.)
      const rc = resolveSourceCreature(engine, source);
      if (rc) {
        await engine.actionDealCreatureDamage(
          { name: 'Fireshield', owner: pi, heroIdx: targetHeroIdx },
          rc, recoil, 'other',
          { sourceOwner: pi, canBeNegated: false },
        );
      }
      engine.log('fireshield_recoil', {
        player: ps.username, hero: target.name,
        attacker: rc?.name || source?.name || '?',
        recoil, fullDamage: dmLevel >= 3, vsCreature: true,
      });
    } else {
      // Hero source — recoil the attacking Hero.
      const srcHero = gs.players[source.owner]?.heroes?.[source.heroIdx];
      if (srcHero && srcHero.hp > 0) {
        await engine.actionDealDamage(
          { name: 'Fireshield', owner: pi, heroIdx: targetHeroIdx },
          srcHero, recoil, 'other'
        );
      }
      engine.log('fireshield_recoil', {
        player: ps.username, hero: target.name,
        attacker: srcHero?.name || '?', recoil, fullDamage: dmLevel >= 3,
      });
    }

    engine.sync();
  },
};
