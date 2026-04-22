// ═══════════════════════════════════════════
//  CARD EFFECT: "Layn, Defender of Deri"
//  Hero — 450 HP, 50 ATK
//  Starting abilities: Leadership, Toughness
//
//  While Layn is alive and not incapacitated
//  (not Frozen, Stunned or Negated), all ally
//  Creatures on the board have +100 current
//  and max HP.
//
//  The bonus is applied immediately whenever:
//    • Layn enters play / game starts
//    • An ally Creature is summoned
//    • Layn recovers from CC or is revived
//
//  The bonus is removed immediately when:
//    • Layn is KO'd
//    • Layn becomes Frozen, Stunned or Negated
//  On removal, currentHp is capped at the new
//  max but not otherwise reduced.
//
//  bypassStatusFilter: true — Layn's hooks must
//  fire even while she is CC'd (to catch the
//  moment a status is applied TO her).
//
//  Tracking: each buffed creature instance
//  carries inst.counters._laynBonus = 100.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Layn, Defender of Deri';
const BONUS     = 100;

// ─── Helpers ──────────────────────────────

/** True when Layn is alive and unaffected by CC. */
function laynIsActive(hero) {
  return !!(
    hero && hero.hp > 0 &&
    !hero.statuses?.frozen &&
    !hero.statuses?.stunned &&
    !hero.statuses?.negated
  );
}

/**
 * Apply the HP bonus to a single creature instance that doesn't yet have it.
 * Uses ctx.increaseMaxHp so creature currentHp and maxHp both increase by BONUS.
 */
function applyBonus(ctx, inst) {
  if (inst.counters._laynBonus) return; // already buffed
  ctx.increaseMaxHp(inst, BONUS);
  inst.counters._laynBonus = BONUS;
}

/**
 * Apply the bonus to every qualifying ally creature that doesn't yet have it.
 */
function applyBonusToAll(ctx) {
  const engine  = ctx._engine;
  const pi      = ctx.cardOwner;
  const cardDB  = engine._getCardDB();

  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi && inst.controller !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.counters._laynBonus) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    applyBonus(ctx, inst);
  }
  engine.sync();
}

/**
 * Remove the bonus from every ally creature that has it.
 * currentHp is capped at the new max but not otherwise reduced.
 */
function removeBonusFromAll(engine, pi) {
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi && inst.controller !== pi) continue;
    if (inst.zone !== 'support') continue;
    const bonus = inst.counters._laynBonus || 0;
    if (!bonus) continue;

    const oldMax    = inst.counters.maxHp || 0;
    const currentHp = inst.counters.currentHp ?? oldMax; // unset = at full health
    const newMax    = Math.max(0, oldMax - bonus);

    inst.counters.maxHp     = newMax;
    inst.counters.currentHp = Math.min(currentHp, newMax); // cap, but don't otherwise reduce
    delete inst.counters._laynBonus;
  }
  engine.sync();
}

// ─── Card module ──────────────────────────

const LAYN_ASCENSION_ITEM = 'Earth-Shattering Hammer, Relic of Deri';

module.exports = {
  activeIn: ['hero'],

  // Ascension condition cannot be bypassed via cheat mode
  cheatAscensionBlocked: true,

  // Must fire even when Layn is CC'd (e.g. to react the moment she is frozen)
  bypassStatusFilter: true,

  // CPU ascension targeting: the Hammer is the only card that progresses Layn.
  ascensionNeedsCard(cardName, _cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero || hero.name !== CARD_NAME) return false;
    if (hero.ascensionReady) return false;
    if (cardName !== LAYN_ASCENSION_ITEM) return false;
    const alreadyHas = engine.cardInstances.some(c =>
      c.owner === pi && c.zone === 'support' &&
      c.heroIdx === hi && c.name === cardName);
    return !alreadyHas;
  },

  // CPU evaluator: 0 or 1 — binary for Layn (only one required item).
  ascensionProgress(engine, pi, hi) {
    const has = engine.cardInstances.some(c =>
      c.owner === pi && c.zone === 'support' &&
      c.heroIdx === hi && c.name === LAYN_ASCENSION_ITEM);
    return has ? 1 : 0;
  },

  hooks: {
    // ── Apply bonus when Layn enters / game starts ────────────────────────

    onGameStart: (ctx) => {
      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;
      applyBonusToAll(ctx);
    },

    onPlay: (ctx) => {
      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;
      applyBonusToAll(ctx);
    },

    // ── Apply bonus to each new ally Creature summoned ────────────────────

    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;

      const entering = ctx.enteringCard;
      if (!entering) return;

      const pi = ctx.cardOwner;
      if (entering.owner !== pi && entering.controller !== pi) return;

      const engine = ctx._engine;
      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;
      if (entering.counters._laynBonus) return; // already has it (shouldn't happen, but guard)

      applyBonus(ctx, entering);
      engine.sync();
    },

    // ── Remove bonus when Layn is KO'd ────────────────────────────────────

    onHeroKO: (ctx) => {
      // Only react to THIS hero being KO'd
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.deadHero !== ctx.attachedHero && ctx.deadHero?.name !== CARD_NAME) return;

      removeBonusFromAll(ctx._engine, ctx.cardOwner);
    },

    // ── Remove bonus when Layn gains a CC status ──────────────────────────
    // bypassStatusFilter ensures this fires even after the status is set.

    onStatusApplied: (ctx) => {
      // Only react to THIS hero receiving a CC status
      if (ctx.heroOwner !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;

      const status = ctx.statusName;
      if (status !== 'frozen' && status !== 'stunned' && status !== 'negated') return;

      removeBonusFromAll(ctx._engine, ctx.cardOwner);
    },

    // ── Re-apply bonus when Layn's CC is cleared ─────────────────────────

    onStatusRemoved: (ctx) => {
      // Only react to THIS hero losing a CC status
      if (ctx.heroOwner !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;

      const status = ctx.statusName;
      if (status !== 'frozen' && status !== 'stunned' && status !== 'negated') return;

      // Re-apply only if Layn is now fully active (no remaining CC)
      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;

      applyBonusToAll(ctx);
    },

    // ── Re-apply bonus when Layn is revived ───────────────────────────────

    onHeroRevive: (ctx) => {
      if (ctx.heroIdx !== ctx.cardHeroIdx || ctx.playerIdx !== ctx.cardOwner) return;

      const hero = ctx.attachedHero;
      if (!laynIsActive(hero)) return;

      applyBonusToAll(ctx);
    },
  },
};
