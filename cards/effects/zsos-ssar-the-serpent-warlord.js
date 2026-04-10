// ═══════════════════════════════════════════
//  CARD EFFECT: "Zsos'Ssar, the Serpent Warlord"
//  Hero — Decay Magic / Decay Magic
//
//  1) When this Hero performs a Decay Magic
//     Spell (any subtype), the player must
//     select one of their own Heroes and
//     inflict 2 Poison stacks on it.
//
//  2) Any direct damage this Hero deals with
//     Attacks and Spells against a single
//     target is increased by 40 × the number
//     of Poisoned targets on the board
//     (both players' heroes + creatures).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Count all Poisoned targets on the board (both players).
 */
function countPoisonedTargets(gs, engine) {
  let count = 0;
  const cardDB = engine._getCardDB();
  for (let p = 0; p < 2; p++) {
    const ps = gs.players[p];
    // Heroes
    for (const hero of (ps.heroes || [])) {
      if (hero?.name && hero.hp > 0 && hero.statuses?.poisoned) count++;
    }
    // Creatures
    for (const inst of engine.cardInstances) {
      if (inst.owner !== p || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = cardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      if (inst.counters.poisoned) count++;
    }
  }
  return count;
}

module.exports = {
  activeIn: ['hero'],

  /**
   * Damage preview estimation for targeting prompts.
   * Adds 40 × poisoned targets on the board to the base damage.
   */
  estimateDamageBonus(engine, playerIdx, heroIdx, baseDamage, damageType) {
    const skipTypes = new Set(['burn', 'poison', 'recoil', 'status', 'other']);
    if (skipTypes.has(damageType)) return baseDamage;
    const poisonedCount = countPoisonedTargets(engine.gs, engine);
    if (poisonedCount <= 0) return baseDamage;
    return baseDamage + 40 * poisonedCount;
  },

  hooks: {
    // ── Effect 1: Decay Spell cost — inflict 2 Poison to own Hero ──
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only trigger for spells cast BY this hero
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Must be a Decay Magic spell
      const spellData = ctx.spellCardData;
      if (!spellData) return;
      if (spellData.spellSchool1 !== 'Decay Magic' && spellData.spellSchool2 !== 'Decay Magic') return;
      // Must be a Spell (not Attack)
      if (!hasCardType(spellData, 'Spell')) return;

      // Dedup guard: prevent double-firing for the same spell in the same turn
      const dedupKey = `zsos_cost_${gs.turn}_${ctx.spellName}_${engine.eventId}`;
      const hero0 = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero0?._zsosCostDedupKey) hero0._zsosCostDedupKey = null;
      if (hero0._zsosCostDedupKey === dedupKey) return;
      hero0._zsosCostDedupKey = dedupKey;

      // Hero must still be alive
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Collect own alive heroes as targets
      const ownHeroes = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const h = ps.heroes[hi];
        if (h?.name && h.hp > 0) {
          ownHeroes.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: h.name });
        }
      }
      if (ownHeroes.length === 0) return;

      // If only 1 hero alive, auto-target
      let targetHeroIdx;
      if (ownHeroes.length === 1) {
        targetHeroIdx = ownHeroes[0].heroIdx;
      } else {
        // Prompt player to select one of their heroes
        const selectedIds = await engine.promptEffectTarget(pi, ownHeroes, {
          title: "Zsos'Ssar — Serpent's Cost",
          description: 'Select one of your Heroes to Poison (2 stacks).',
          confirmLabel: '☠️ Inflict Poison',
          confirmClass: 'btn-danger',
          cancellable: false,
          maxTotal: 1,
        });

        if (!selectedIds || selectedIds.length === 0) {
          // Force first hero if no selection
          targetHeroIdx = ownHeroes[0].heroIdx;
        } else {
          const picked = ownHeroes.find(t => t.id === selectedIds[0]);
          targetHeroIdx = picked ? picked.heroIdx : ownHeroes[0].heroIdx;
        }
      }

      // Apply 2 Poison stacks
      await engine.addHeroStatus(pi, targetHeroIdx, 'poisoned', {
        addStacks: 2,
        appliedBy: pi,
      });

      const targetName = ps.heroes[targetHeroIdx]?.name;
      engine.log('zsos_ssar_cost', {
        player: ps.username, hero: hero.name,
        target: targetName,
      });

      engine.sync();
    },

    // ── Effect 2: Damage boost for single-target Attacks/Spells ──
    beforeDamage: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only modify damage dealt by this hero
      const source = ctx.source;
      if (!source || source.owner !== pi || source.heroIdx !== heroIdx) return;

      // Only during spell/attack resolution (spellDamageLog exists)
      const log = gs._spellDamageLog;
      if (!log || log.length !== 1) return;

      // Skip status/self damage types
      const skipTypes = new Set(['burn', 'poison', 'recoil', 'status', 'other']);
      if (skipTypes.has(ctx.type)) return;

      // Count poisoned targets on the board
      const poisonedCount = countPoisonedTargets(gs, engine);
      if (poisonedCount <= 0) return;

      const bonus = 40 * poisonedCount;
      ctx.modifyAmount(bonus);

      engine.log('zsos_ssar_boost', {
        hero: gs.players[pi]?.heroes?.[heroIdx]?.name,
        poisonedCount,
        bonus,
      });
    },
  },
};
