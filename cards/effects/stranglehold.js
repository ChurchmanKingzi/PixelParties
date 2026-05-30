// ═══════════════════════════════════════════
//  CARD EFFECT: "Stranglehold"
//  Attack (Fighting Lv0, Normal) — Choose a
//  target. Deal 50 damage × number of negative
//  status effects on it. If the user has
//  Fighting Lv1+, also add the hero's BASE ATK
//  stat (ignoring equipment/buff modifiers).
//  Equipment hooks (Sacred Hammer, Sun Sword)
//  still fire via 'attack' damage type.
//
//  Uses stranglehold_squeeze animation (CSS
//  scaleX squeeze on the target zone).
// ═══════════════════════════════════════════

const DAMAGE_PER_STATUS = 50;
const NEGATIVE_STATUSES = ['frozen', 'stunned', 'burned', 'poisoned', 'negated'];

/**
 * Count negative status effects on a target.
 * Heroes use statuses object, creatures use counters.
 */
function countNegativeStatuses(target, engine) {
  let count = 0;
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero) return 0;
    for (const s of NEGATIVE_STATUSES) {
      if (hero.statuses?.[s]) count++;
    }
  } else if (target.type === 'equip') {
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return 0;
    for (const s of NEGATIVE_STATUSES) {
      if (inst.counters[s]) count++;
    }
  }
  return count;
}

/**
 * Count Fighting ability level on a hero (with Performance stacking).
 */
function getFightingLevel(ps, heroIdx) {
  const abZones = ps.abilityZones[heroIdx] || [];
  let level = 0;
  for (const slot of abZones) {
    if (!slot || slot.length === 0) continue;
    const base = slot[0];
    for (const ab of slot) {
      if (ab === 'Fighting') level++;
      else if (ab === 'Performance' && base === 'Fighting') level++;
    }
  }
  return level;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const fightingLevel = getFightingLevel(ps, heroIdx);
      const atkBonus = fightingLevel >= 1 ? (hero.baseAtk || 0) : 0;

      // Prompt for target (any living target except the caster)
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        // Damage is target-specific (50 × target's negative-status count
        // + atkBonus). The picker uses one number for all candidates,
        // so we pass `atkBonus + 50` — assumes ~1 negative status on
        // average. Underestimates against debuff-heavy targets (CPU
        // misses some kill shots) but a positive signal beats zero
        // (random tiebreak). Ideally pickEnemyTargets would consult
        // a per-target damage callback, but threading that through is
        // a wider refactor.
        baseDamage: atkBonus + 50,
        title: 'Stranglehold',
        description: `Deal 50 × negative statuses on target` + (atkBonus > 0 ? ` + ${atkBonus} ATK` : '') + '.',
        confirmLabel: '⚔️ Stranglehold!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return; // Cancelled

      // Count negative statuses on the target
      const statusCount = countNegativeStatuses(target, engine);
      const baseDamage = DAMAGE_PER_STATUS * statusCount;
      const totalDamage = baseDamage + atkBonus;

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: 'Stranglehold', owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, totalDamage);

      // Play squeeze animation on target
      if (target.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'stranglehold_squeeze', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: -1,
        });
      } else {
        engine._broadcastEvent('play_zone_animation', {
          type: 'stranglehold_squeeze', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
      }
      await engine._delay(600);

      // Deal damage with type 'attack' (triggers Sacred Hammer, Sun Sword, etc.)
      if (target.type === 'hero') {
        const targetHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, finalDmg, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, finalDmg, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      engine.log('stranglehold', {
        player: ps.username, target: target.cardName,
        statusCount, baseDamage, atkBonus, totalDamage: finalDmg,
      });
      engine.sync();
    },
  },
};
