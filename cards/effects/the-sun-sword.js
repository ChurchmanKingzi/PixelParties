// ═══════════════════════════════════════════
//  CARD EFFECT: "The Sun Sword"
//  Artifact (Equipment, 14 Gold)
//
//  1) Equipped Hero gains +20 ATK.
//  2) ALL targets the player controls become
//     immune to being Frozen (hero status +
//     creature counter). New creatures auto-get it.
//  3) On equip, thaw all frozen targets the
//     player controls (no immune grant on thaw).
//  4) When the equipped Hero hits any target with
//     an Attack and it's not Burn-immune or already
//     Burned, Burn it.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ATK_BONUS = 20;

// ─── HELPERS ─────────────────────────────

/**
 * Apply freeze immunity to all targets the player controls.
 * Heroes: set status + buff. Creatures: set counter + creature buff.
 */
function applyFreezeImmunity(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;

  // Heroes
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!hero.statuses) hero.statuses = {};
    hero.statuses.freeze_immune = { source: 'The Sun Sword' };
    if (!hero.buffs) hero.buffs = {};
    hero.buffs.freeze_immune = { source: 'The Sun Sword' };
  }

  // Creatures only (not Equipment Artifacts)
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support') continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    inst.counters.freeze_immune = 1;
    if (!inst.counters.buffs) inst.counters.buffs = {};
    inst.counters.buffs.freeze_immune = { source: 'The Sun Sword' };
  }
}

/**
 * Remove freeze immunity from all targets the player controls.
 * Only removes Sun Sword-sourced immunity.
 */
function removeFreezeImmunity(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;

  // Heroes
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    if (hero.statuses?.freeze_immune?.source === 'The Sun Sword') {
      delete hero.statuses.freeze_immune;
    }
    if (hero.buffs?.freeze_immune?.source === 'The Sun Sword') {
      delete hero.buffs.freeze_immune;
    }
  }

  // Creatures only
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support') continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (inst.counters.freeze_immune) delete inst.counters.freeze_immune;
    if (inst.counters.buffs?.freeze_immune?.source === 'The Sun Sword') {
      delete inst.counters.buffs.freeze_immune;
    }
  }
}

/**
 * Thaw all frozen targets the player controls.
 * Heroes: remove frozen status. Creatures: remove frozen counter.
 * Does NOT grant immune status (unlike natural thaw at turn end).
 */
async function thawAll(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;

  // Heroes
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0 || !hero.statuses?.frozen) continue;
    delete hero.statuses.frozen;
    engine._broadcastEvent('play_zone_animation', { type: 'thaw', owner: pi, heroIdx: hi, zoneSlot: -1 });
    engine.log('thaw', { target: hero.name, by: 'The Sun Sword' });
  }

  // Creatures
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support' || !inst.counters.frozen) continue;
    delete inst.counters.frozen;
    engine._broadcastEvent('play_zone_animation', { type: 'thaw', owner: pi, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    engine.log('thaw', { target: inst.name, by: 'The Sun Sword' });
  }
}

/**
 * Check if the player controls an active Sun Sword.
 * Optionally exclude a specific card ID (the one currently being removed).
 */
function hasSunSword(engine, pi, excludeId) {
  return engine.cardInstances.some(c =>
    c.owner === pi && c.zone === 'support' && c.name === 'The Sun Sword' && c.id !== excludeId
  );
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * On equip: +20 ATK, freeze immunity to all, thaw all frozen.
     */
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      ctx.grantAtk(ATK_BONUS);
      applyFreezeImmunity(engine, pi);
      await thawAll(engine, pi);
      engine.sync();
    },

    /**
     * Game start: apply for pre-equipped Sun Swords (Bill, etc.).
     */
    onGameStart: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hero = ctx.attachedHero;
      if (!hero?.name) return;
      if (ctx.card.counters.atkGranted > 0) return; // Already applied
      ctx.grantAtk(ATK_BONUS);
      applyFreezeImmunity(engine, pi);
      // No thaw needed at game start — nothing is frozen yet
      engine.sync();
    },

    /**
     * On removal: revoke ATK, remove freeze immunity (if no other Sun Sword active).
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;

      ctx.revokeAtk();

      // Only remove freeze immunity if no other Sun Sword is still equipped
      if (!hasSunSword(engine, pi, ctx.card.id)) {
        removeFreezeImmunity(engine, pi);
      }
      engine.sync();
    },

    /**
     * When a creature enters any of the player's support zones,
     * grant it freeze immunity if Sun Sword is active.
     */
    onCardEnterZone: (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;
      if (entering.owner !== ctx.cardOwner) return;

      // Only Creatures get buffs, not Equipment Artifacts
      const cardDB = ctx._engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Apply freeze immunity to the entering creature
      entering.counters.freeze_immune = 1;
      if (!entering.counters.buffs) entering.counters.buffs = {};
      entering.counters.buffs.freeze_immune = { source: 'The Sun Sword' };
    },

    /**
     * After the equipped Hero deals Attack damage to a target,
     * Burn it if not already Burned and not Burn-immune.
     */
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;

      // Source must be this hero
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const target = ctx.target;
      if (!target) return; // No amount check — burn applies on any hit, even 0 damage (Ghuanjun cap)

      // Target is a hero (has statuses)
      if (target.hp !== undefined && target.statuses) {
        if (target.statuses.burned || target.statuses.burn_immune || target.statuses.immune) return;

        // Find which player/hero this target belongs to
        for (let tpi = 0; tpi < 2; tpi++) {
          const tps = engine.gs.players[tpi];
          for (let thi = 0; thi < (tps.heroes || []).length; thi++) {
            if (tps.heroes[thi] === target && target.hp > 0) {
              await engine.addHeroStatus(tpi, thi, 'burned', {
                appliedBy: pi,
                animationType: 'flame_strike',
              });
              return;
            }
          }
        }
      }
    },

    /**
     * After creature damage batch: burn creatures hit by this hero's attacks.
     */
    afterCreatureDamageBatch: (ctx) => {
      if (!ctx.entries) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      for (const e of ctx.entries) {
        if (e.type !== 'attack') continue;
        if ((e.source?.heroIdx ?? -1) !== heroIdx) continue;
        if ((e.source?.owner ?? -1) !== pi) continue;
        if (e.amount <= 0) continue;

        const inst = e.inst;
        if (!inst || inst.zone !== 'support') continue;
        if (inst.counters.burned) continue;
        if (!engine.canApplyCreatureStatus(inst, 'burned')) continue;

        inst.counters.burned = 1;
        inst.counters.burnAppliedBy = pi;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        engine.log('burn_applied', { target: inst.name, by: 'The Sun Sword' });
      }
    },
  },
};
