// ═══════════════════════════════════════════
//  HERO EFFECT: "Thorad, Strength of Coolness"
//  Any damage this Hero deals to a single target
//  with Attacks or Spells is increased by 40 ×
//  number of cards in your Coolness Stack.
// ═══════════════════════════════════════════

const CARD_NAME = 'Thorad, Strength of Coolness';
const PER_STACK = 40;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Single-target hero damage from Attacks / Spells dealt by Thorad.
     * Detect "single target" by gating on a single-target damage type
     * — beforeDamage fires per target; we modify per-call as long as
     * Thorad's hero zone produced the source.
     *
     * Creature-cast spells (Skeleton Priest, Wolflesia) set
     * `gs._spellCasterOverride` for the duration of their resolve.
     * In that window the *Creature* is the caster — Thorad isn't —
     * so the bonus must be skipped even if the source's `heroIdx`
     * still anchors to Thorad's hero zone.
     */
    beforeDamage: async (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      if (engine.gs._spellCasterOverride) return;
      const stackSize = engine.getCoolnessStackSize(pi);
      if (stackSize === 0) return;
      // Filter by source: must be Thorad himself.
      const src = ctx.source;
      const heroIdx = ctx.cardHeroIdx;
      // ctx.sourceHeroIdx / ctx.casterIdx exposes the casting hero on
      // hero spells; for Attacks the source instance is the hero card.
      const fromThorad = (ctx.sourceHeroIdx === heroIdx && ctx.casterIdx === pi)
        || (src && src.owner === pi && src.heroIdx === heroIdx);
      if (!fromThorad) return;
      // Only Attack / Spell damage.
      const t = ctx.type || '';
      if (t !== 'attack' && t !== 'destruction_spell' && t !== 'spell') return;
      ctx.modifyAmount(PER_STACK * stackSize);
    },

    /**
     * Same modifier for creature damage batches when Thorad casts a
     * single-target Spell that hits a creature.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      // Same creature-cast skip as the hero-damage branch above.
      if (engine.gs._spellCasterOverride) return;
      const stackSize = engine.getCoolnessStackSize(pi);
      if (stackSize === 0) return;
      const entries = ctx.entries || [];
      // Single-target gate: only one entry in the batch.
      if (entries.length !== 1) return;
      for (const e of entries) {
        const fromThorad = e.source?.owner === pi && e.source?.heroIdx === ctx.cardHeroIdx;
        if (!fromThorad) continue;
        const t = e.type || '';
        if (t !== 'attack' && t !== 'destruction_spell' && t !== 'spell') continue;
        e.amount += PER_STACK * stackSize;
      }
    },
  },
};
