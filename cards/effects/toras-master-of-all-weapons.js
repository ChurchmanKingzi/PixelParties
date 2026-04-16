// ═══════════════════════════════════════════
//  CARD EFFECT: "Toras, Master of all Weapons"
//  Hero — 350 HP, 120 ATK
//  Starting abilities: Fighting × 2
//
//  ① Passive: +40 ATK for each Artifact with a
//    different name equipped to this Hero.
//    Recalculated whenever an Artifact enters
//    or leaves this Hero's Support Zone.
//
//  ② Restriction: this Hero can never hit more
//    than 1 target with an Attack.
//    Enforced via heroFlags.singleTargetAttack —
//    promptMultiTarget caps to 1 automatically,
//    and individual Attack cards with secondary
//    multi-hit effects (e.g. Whirlwind Strike)
//    check the same flag.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Toras, Master of all Weapons';
const ATK_PER_ARTIFACT = 40;

/**
 * Count the number of uniquely named Artifacts currently equipped to a
 * specific hero's Support Zone. Optionally excludes one card instance by
 * ID (used when called from onCardLeaveZone, where the departing card may
 * still be present in cardInstances when the hook fires).
 *
 * @param {object} engine
 * @param {number} pi         - Player index who controls the hero
 * @param {number} heroIdx    - Hero column index
 * @param {string} [excludeId] - cardInstance ID to exclude from the count
 * @returns {number} Count of unique Artifact names
 */
function countUniqueArtifacts(engine, pi, heroIdx, excludeId) {
  const cardDB = engine._getCardDB();
  const names = new Set();
  for (const inst of engine.cardInstances) {
    if (excludeId && inst.id === excludeId) continue;
    if (inst.zone !== 'support') continue;
    if (inst.heroIdx !== heroIdx) continue;
    // Support cards belong to the hero's owner, not necessarily the controller
    if (inst.owner !== pi && inst.controller !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    names.add(inst.name);
  }
  return names.size;
}

/**
 * Apply (or update) the ATK bonus for Toras. Computes the new total bonus
 * from the current artifact count, diffs against the stored value, and
 * adjusts hero.atk by the delta only.
 */
function applyAtkBonus(ctx, excludeId) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = gs.players[pi]?.heroes?.[heroIdx];
  if (!hero?.name) return;

  const count      = countUniqueArtifacts(engine, pi, heroIdx, excludeId);
  const newBonus   = count * ATK_PER_ARTIFACT;
  const oldBonus   = ctx.card.counters.torasAtkBonus || 0;
  const delta      = newBonus - oldBonus;

  if (delta === 0) return;

  hero.atk = (hero.atk || 0) + delta;
  ctx.card.counters.torasAtkBonus = newBonus;

  engine._broadcastEvent('fighting_atk_change', { owner: pi, heroIdx, amount: delta });
  engine.log('toras_atk_update', {
    hero: hero.name, artifacts: count, bonus: newBonus, delta,
  });
  engine.sync();
}

/**
 * Register Toras's single-target attack restriction on heroFlags.
 */
function registerFlag(ctx) {
  const gs = ctx._engine.gs;
  if (!gs.heroFlags) gs.heroFlags = {};
  const key = `${ctx.cardOwner}-${ctx.cardHeroIdx}`;
  if (!gs.heroFlags[key]) gs.heroFlags[key] = {};
  gs.heroFlags[key].singleTargetAttack = true;
}

/**
 * Remove the single-target restriction when Toras leaves play.
 */
function clearFlag(ctx) {
  const gs = ctx._engine.gs;
  const key = `${ctx.cardOwner}-${ctx.cardHeroIdx}`;
  if (gs.heroFlags?.[key]) {
    delete gs.heroFlags[key].singleTargetAttack;
    if (Object.keys(gs.heroFlags[key]).length === 0) {
      delete gs.heroFlags[key];
    }
  }
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // ── Register flag + calculate initial bonus ──────────────────────────────

    onGameStart: (ctx) => {
      registerFlag(ctx);
      applyAtkBonus(ctx);
    },

    onPlay: (ctx) => {
      registerFlag(ctx);
      applyAtkBonus(ctx);
    },

    // ── Recalculate when an Artifact enters this hero's support zone ─────────

    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;

      const enteringCard = ctx.enteringCard;
      if (!enteringCard) return;
      const cd = ctx._engine.getEffectiveCardData(enteringCard)
        || ctx._engine._getCardDB()[enteringCard.name];
      if (!cd || !hasCardType(cd, 'Artifact')) return;

      applyAtkBonus(ctx);
    },

    // ── Recalculate when an Artifact leaves this hero's support zone ─────────

    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromHeroIdx !== ctx.cardHeroIdx) return;

      const leavingInst = ctx._engine.cardInstances.find(c =>
        c.owner === ctx.cardOwner && c.zone === 'support' &&
        c.heroIdx === ctx.fromHeroIdx && c.zoneSlot === ctx.fromZoneSlot,
      );
      const cd = ctx._engine.getEffectiveCardData(leavingInst)
        || ctx._engine._getCardDB()[leavingInst?.name];
      if (!cd || !hasCardType(cd, 'Artifact')) return;

      applyAtkBonus(ctx, leavingInst?.id);
    },

    // ── Clean up flag and stored bonus when Toras is KO'd ───────────────────

    onHeroKO: (ctx) => {
      if (ctx.deadHero?.name !== CARD_NAME) return;
      // hero.atk resets on KO anyway, but clean up our stored counter and flag
      if (ctx.card?.counters) ctx.card.counters.torasAtkBonus = 0;
      clearFlag(ctx);
    },
  },
};
