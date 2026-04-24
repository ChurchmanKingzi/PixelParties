// ═══════════════════════════════════════════
//  CARD EFFECT: "Bow Sniper Darge"
//  Hero (350 HP, 80 ATK — Adventurousness + Fighting)
//
//  Passive: If Darge hits exactly 1 target with
//  an Attack, increase that Attack's damage by
//  50 for each "Arrow" Artifact the player chains
//  onto the Attack. This bonus is unaffected by
//  effects that double damage — i.e. it bypasses
//  every damage multiplier (Cloudy halving,
//  future damage doublers).
//
//  The "exactly 1 target" clause: every PP
//  Attack card currently resolves against a
//  single promptDamageTarget pick, so the
//  condition is always met in practice. If
//  multi-target Attacks ship in the future, we
//  can narrow the hook by checking the Attack's
//  resolved-target count.
//
//  Mechanism: Darge hooks both `beforeDamage`
//  (hero target) and `beforeCreatureDamageBatch`
//  (creature target). In each, we count arrow-
//  tagged links on the live chain and push the
//  +50*N bonus onto the engine's "flat bonus"
//  field — a number that's added to the final
//  damage AFTER the buff-multiplier pass, so
//  it's untouched by halving / doubling.
//
//  The arrow count is captured at damage-time,
//  not at chain-resolve-time, so it correctly
//  accounts for every Arrow that was chained
//  regardless of the Slit retrigger path (Slit
//  is NOT an arrow, so retriggers via Slit
//  don't inflate the count).
// ═══════════════════════════════════════════

const CARD_NAME = 'Bow Sniper Darge';
const BONUS_PER_ARROW = 50;

/**
 * Is the damage source this Darge instance's own attack?
 * Guards against firing for other heroes' attacks or non-attack damage.
 */
function isOwnAttack(ctx, source) {
  if (!source) return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  const srcOwner = source.owner ?? source.controller ?? -1;
  if (srcOwner !== ctx.cardOwner) return false;
  return true;
}

/**
 * Arrow count for the triggering Attack. Each Arrow's `resolve`
 * stashes the running count on the attacking hero's `_arrowsChainedCount`
 * (via `_arrows-shared.js`), because the reaction chain is a local
 * variable inside `_runReactionWindow` and is gone by the time the
 * Attack's damage path actually fires.
 */
function armedArrowCount(ctx) {
  return ctx.attachedHero?._arrowsChainedCount || 0;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // Hero-target attacks route through `_actionDealDamageImpl`, which
    // fires `beforeDamage`. Read Darge's arrow count from the hero's
    // stashed counter and stamp the bonus onto the hook context via
    // `addFlatBonus` — added after the multiplier pass so halving
    // can't touch it.
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      if (!isOwnAttack(ctx, ctx.source)) return;
      const arrows = armedArrowCount(ctx);
      if (arrows <= 0) return;
      const bonus = BONUS_PER_ARROW * arrows;
      ctx.addFlatBonus(bonus);
      ctx._engine.log('darge_arrow_bonus', {
        hero: ctx.attachedHero?.name, arrows, bonus,
      });
    },

    // Creature-target attacks route through `processCreatureDamageBatch`,
    // which fires `beforeCreatureDamageBatch` once for the whole batch
    // with an `entries` array. Tag every entry that's this Darge's own
    // attack with an `_flatBonus` field — the engine reads it after
    // the per-entry multiplier pass.
    beforeCreatureDamageBatch: (ctx) => {
      const entries = ctx.entries;
      if (!Array.isArray(entries) || entries.length === 0) return;
      const arrows = armedArrowCount(ctx);
      if (arrows <= 0) return;
      const bonus = BONUS_PER_ARROW * arrows;
      let applied = 0;
      for (const e of entries) {
        if (e.type !== 'attack') continue;
        if (!isOwnAttack(ctx, e.source)) continue;
        e._flatBonus = (e._flatBonus || 0) + bonus;
        applied++;
      }
      if (applied > 0) {
        ctx._engine.log('darge_arrow_bonus', {
          hero: ctx.attachedHero?.name, arrows, bonus, entries: applied,
        });
      }
    },
  },
};
