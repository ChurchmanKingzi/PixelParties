// ═══════════════════════════════════════════
//  CARD EFFECT: "Nero Zira, the Mastermind"
//  Hero — 450 HP, 70 ATK — BANNED
//  Starting abilities: Fighting, Inventing
//
//  Up to 5 times per turn, when a Creature is
//  placed into one of your Heroes' Support
//  Zones, permanently increase this Hero's
//  Attack by 30.
//
//  Trigger pattern mirrors Maya / Ingo
//  (onCardEnterZone, filtered to Creatures
//  owned by Nero's player). Per-turn use cap
//  is tracked on the hero object itself,
//  keyed by gs.turn — same shape as Sandy
//  Blob's discharge accounting. ATK is added
//  directly to hero.atk (no per-instance
//  revoke counter — the boost is permanent).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Nero Zira, the Mastermind';
const ATK_BOOST = 30;
const USES_PER_TURN = 5;

module.exports = {
  activeIn: ['hero'],

  // CPU threat assessment. Each friendly Creature summon into pi's support
  // zones grants Nero +30 ATK (capped 5/turn). Reuses the same summon-rate
  // proxy as Maya / Ingo / Pes'zet, clamped to the per-turn cap so the AI
  // doesn't over-value him in summon-heavy boards.
  supportYield(ctx) {
    const gs = ctx.engine.gs;
    const ps = gs.players[ctx.pi];
    let count = 0;
    for (const heroZones of (ps?.supportZones || [])) {
      for (const z of (heroZones || [])) if ((z || []).length > 0) count++;
    }
    const avg = Math.min(USES_PER_TURN, count / Math.max(1, gs.turn || 1));
    return { damagePerTurn: ATK_BOOST * avg };
  },

  hooks: {
    onCardEnterZone: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      if (ctx.toZone !== 'support') return;

      // Only react to Creatures owned by Nero's player (Maya / Ingo pattern).
      const entering = ctx.enteringCard;
      if (!entering || entering.owner !== pi) return;

      const cd = engine.getEffectiveCardData(entering) || engine._getCardDB()[entering.name];
      if (!cd || !hasCardType(cd, 'Creature')) return;

      // Nero must be alive
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Per-turn use cap, keyed by gs.turn (matches Sandy Blob).
      const turn = gs.turn || 0;
      if (hero._neroZiraAtkBoostTurn !== turn) {
        hero._neroZiraAtkBoostTurn = turn;
        hero._neroZiraAtkBoostUsed = 0;
      }
      if (hero._neroZiraAtkBoostUsed >= USES_PER_TURN) return;
      hero._neroZiraAtkBoostUsed++;

      // Permanent ATK gain. Routed through `_applyHeroAtkDelta` so
      // the Curse suppression accumulator catches it when the host
      // is cursed — `actionGrantAtk` isn't appropriate here because
      // the boost never expires (no per-instance revoke counter).
      engine._applyHeroAtkDelta(hero, pi, heroIdx, ATK_BOOST);
      engine.log('atk_grant', {
        hero: hero.name, amount: ATK_BOOST, source: CARD_NAME,
      });
      engine.log('nero_zira_atk_boost', {
        player: gs.players[pi].username,
        creature: entering.name,
        amount: ATK_BOOST,
        usesRemaining: USES_PER_TURN - hero._neroZiraAtkBoostUsed,
      });
      engine.sync();
    },
  },
};
