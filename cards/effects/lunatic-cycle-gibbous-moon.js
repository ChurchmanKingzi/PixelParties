// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Cycle - Gibbous Moon"
//  Artifact (Equipment, Cost 12, Lunatic)
//
//  Play condition: ≥1 "Lunatic Cycle - Half Moon"
//  on the board (either side).
//  Equip to a Hero you control → that Hero is
//  unaffected by negative status effects.
//
//  Uses the standard `negative_status_immune`
//  buff (engine enforces it in addHeroStatus).
//  Granted permanent on play / game-start, and
//  cleared when this equip leaves — but only if
//  no OTHER Gibbous Moon still hosts the buff on
//  that Hero, and only if WE were its source (so
//  a Divine-Gift-of-Coolness immunity isn't
//  stripped).
// ═══════════════════════════════════════════

const { lunaticCycleCountByName } = require('./_lunatic-shared');
const { getNegativeStatuses } = require('./_hooks');

const CARD_NAME = 'Lunatic Cycle - Gibbous Moon';
const PREREQ = 'Lunatic Cycle - Half Moon';
const BUFF = 'negative_status_immune';

function grant(ctx) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const hi = ctx.card.heroIdx;
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return;
  if (hero.buffs?.[BUFF]) return; // already immune (any source)
  engine.actionAddBuff(hero, pi, hi, BUFF, { source: CARD_NAME, permanent: true });
  // Mirror Divine Gift of Coolness: clear any negatives already on it.
  try {
    engine.cleanseHeroStatuses(hero, pi, hi, getNegativeStatuses(), CARD_NAME);
  } catch { /* cleanse is best-effort */ }
}

module.exports = {
  isEquip: true,
  activeIn: ['support'],

  canEquipToHero(gs, playerIdx, heroIdx, engine) {
    return lunaticCycleCountByName(engine, PREREQ) >= 1;
  },

  hooks: {
    onPlay: (ctx) => grant(ctx),
    onGameStart: (ctx) => grant(ctx),
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner
        || ctx.fromHeroIdx !== ctx.card.heroIdx
        || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hi = ctx.card.heroIdx;
      const hero = engine.gs.players[pi]?.heroes?.[hi];
      if (!hero) return;
      // Another Gibbous Moon still on this Hero? Keep the buff.
      const another = (engine.cardInstances || []).some(c =>
        c && c.id !== ctx.card.id && c.name === CARD_NAME
        && c.zone === 'support' && c.owner === pi && c.heroIdx === hi);
      if (another) return;
      // Only strip the buff if WE were its source.
      if (hero.buffs?.[BUFF]?.source === CARD_NAME) {
        delete hero.buffs[BUFF];
        engine.sync();
      }
    },
  },
};
