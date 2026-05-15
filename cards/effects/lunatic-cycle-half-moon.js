// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Cycle - Half Moon"
//  Artifact (Equipment, Cost 12, Lunatic)
//
//  Play condition: ≥1 "Lunatic Cycle - Crescent
//  Moon" on the board (either side).
//  Equip to a Hero you control → that Hero cannot
//  take more than half its max HP as damage in a
//  single instance (rounded up).
//
//  Implemented as a `beforeDamage` cap (Spectral
//  Armor's `setAmount` pattern — never assign
//  ctx.amount directly).
// ═══════════════════════════════════════════

const { lunaticCycleCountByName } = require('./_lunatic-shared');

const PREREQ = 'Lunatic Cycle - Crescent Moon';

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    return lunaticCycleCountByName(engine, PREREQ) >= 1;
  },

  hooks: {
    beforeDamage: (ctx) => {
      if (ctx.cancelled) return;
      if (ctx.cardZone !== 'support') return;
      const target = ctx.target;
      if (!target || target.maxHp === undefined) return; // hero targets only
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      // Is the damage target THIS equip's host Hero?
      const tgtOwner = engine._findHeroOwner?.(target);
      if (tgtOwner == null || tgtOwner < 0) return;
      if (tgtOwner !== ctx.cardOwner) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0 || tgtHi !== ctx.card.heroIdx) return;

      const cap = Math.ceil((target.maxHp || 0) / 2);
      if (cap >= 0 && ctx.amount > cap) {
        ctx.setAmount(cap);
        engine.log('lunatic_half_moon_cap', {
          hero: engine._heroLabel ? engine._heroLabel(target) : target.name,
          cappedTo: cap,
        });
      }
    },
  },
};
