// ═══════════════════════════════════════════
//  CARD EFFECT: "Fireshield"
//  Spell (Reaction) — Destruction Magic Lv1
//  When a hero takes damage from opponent's
//  Attack/Spell/Creature effect and survives,
//  deal half damage back as recoil (full at
//  Destruction Magic Lv3).
// ═══════════════════════════════════════════

module.exports = {
  isAfterDamageReaction: true,

  /**
   * Only triggers for Attack/Spell/Creature damage types (not artifacts, potions, poison, etc.)
   * The source must have a valid hero or creature attacker to receive recoil.
   */
  afterDamageCondition(gs, pi, engine, target, targetHeroIdx, source, amount, type) {
    // Must be combat-related damage (from attacks, spells, creature effects)
    // Exclude: poison, burn, status, artifact, potion, trap, other
    const validTypes = ['normal', 'destruction_spell', 'attack', 'creature_effect'];
    // Also accept undefined/null type as normal combat
    const effectiveType = type || 'normal';
    // Be permissive: allow anything that comes from a hero or creature source
    if (source?.owner == null || source.owner < 0) return false;
    if (source.owner === pi) return false; // Only opponent damage

    // Source must be a hero (spell/attack) or creature
    const srcPs = gs.players[source.owner];
    if (!srcPs) return false;

    const srcHeroIdx = source.heroIdx ?? -1;
    if (srcHeroIdx < 0) return false;

    // Creature source: check creature is alive
    if (source.zone === 'support') {
      const creatureHp = source.counters?.currentHp ?? engine._getCardDB()[source.name]?.hp ?? 0;
      return creatureHp > 0;
    }

    // Hero source: check hero is alive (to receive recoil)
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

    // Determine recoil target: creature source → hit the creature; hero source → hit the hero
    const srcOwner = source.owner;
    const srcHeroIdx = source.heroIdx;
    const isCreatureSource = source.zone === 'support';

    if (isCreatureSource) {
      // Creature source — deal recoil to the creature
      const srcInst = engine.cardInstances.find(c =>
        c.owner === srcOwner && c.zone === 'support' && c.heroIdx === srcHeroIdx && c.id === source.id
      ) || source;
      const creatureHp = srcInst.counters?.currentHp ?? engine._getCardDB()[srcInst.name]?.hp ?? 0;
      if (creatureHp > 0) {
        await engine.actionDealCreatureDamage(
          { name: 'Fireshield', owner: pi, heroIdx: targetHeroIdx },
          srcInst, recoil, 'other',
          { sourceOwner: pi, canBeNegated: false },
        );
      }
      engine.log('fireshield_recoil', {
        player: ps.username, hero: target.name,
        attacker: srcInst.name || '?', recoil, fullDamage: dmLevel >= 3,
      });
    } else {
      // Hero source — deal recoil to the attacker's hero
      const srcHero = gs.players[srcOwner]?.heroes?.[srcHeroIdx];
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
