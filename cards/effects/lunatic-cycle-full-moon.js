// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Cycle - Full Moon"
//  Artifact (Equipment, Cost 12, Lunatic)
//
//  Play condition: ≥1 "Lunatic Cycle - Gibbous
//  Moon" on the board (either side).
//  Equip to a Hero you control → +100 ATK.
//
//  Same +ATK lifetime pattern as Vampiric Sword:
//  grant on play / game-start, revoke on leave.
// ═══════════════════════════════════════════

const { lunaticCycleCountByName } = require('./_lunatic-shared');

const ATK_BONUS = 100;
const PREREQ = 'Lunatic Cycle - Gibbous Moon';

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    return lunaticCycleCountByName(engine, PREREQ) >= 1;
  },

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
    },
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      ctx.grantAtk(ATK_BONUS);
    },
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner
        || ctx.fromHeroIdx !== ctx.card.heroIdx
        || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },
  },
};
