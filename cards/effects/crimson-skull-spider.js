// ═══════════════════════════════════════════
//  CARD EFFECT: "Crimson Skull Spider"
//  Creature (Summoning Magic Lv1, Normal) — 60 HP
//
//  "You may send 3 Surprises you control to the discard pile to summon
//   this Creature as an additional Action. While you control this
//   Creature, any damage your opponent takes from Surprises is
//   increased by 40 for every 'Spider' Creature you control. You can
//   only control 1 'Crimson Skull Spider'."
//
//  Singleton + Big-Gwen-Guard-style summon-cost path (via the shared
//  `makeSurpriseCostSummon` mixin) + Surprise-damage modifier on
//  hero AND creature targets the opponent controls.
//
//  The damage modifier reads the source CARD's subtype — a Surprise's
//  damage payload always carries the Surprise's card name as the
//  source, regardless of whether the damage was routed through
//  `actionDealDamage` or `actionDealCreatureDamage`. The Demon's
//  Gate creature-caster annotation preserves source.name, so a
//  Spell cast via Demon's Gate is correctly NOT boosted here (its
//  subtype is Normal, not Surprise).
// ═══════════════════════════════════════════

const {
  countSpiderCreaturesControlled,
  makeSurpriseCostSummon,
} = require('./_spider-shared');

const CARD_NAME = 'Crimson Skull Spider';
const SURPRISE_COST = 3;
const PER_SPIDER_BONUS = 40;

/** Already-controlled singleton check. */
function alreadyControlled(engine, pi) {
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.name === CARD_NAME) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  /** Singleton — only one Crimson Skull Spider can be controlled. */
  canSummon(ctx) {
    return !alreadyControlled(ctx._engine, ctx.cardOwner);
  },

  // Big Gwen Guard-style summon-cost path. The mixin provides
  // canBypassLevelReq + inherentAction + beforeSummon — sending 3
  // Surprises to discard converts the summon into an additional
  // Action, otherwise the normal Lv1 Summoning Magic path applies.
  ...makeSurpriseCostSummon(SURPRISE_COST, CARD_NAME),

  hooks: {
    /**
     * Boost opponent's incoming damage from Surprise sources by
     * 40 × Spider Creatures the Crimson Skull controller controls.
     */
    beforeDamage: async (ctx) => {
      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const skullOwner = ctx.cardOwner;
      // Target must be on the OPPONENT side of the Skull's controller.
      const tgtOwner = ctx.target?.owner ?? engine._findHeroOwner?.(ctx.target);
      if (tgtOwner == null || tgtOwner < 0 || tgtOwner === skullOwner) return;
      // Source must be a Surprise card. Read the card subtype from the
      // source name (or its cardInstance name).
      const srcName = ctx.source?.cardInstance?.name || ctx.source?.name;
      const srcData = srcName ? cardDB[srcName] : null;
      if (!srcData || srcData.subtype !== 'Surprise') return;
      // Skull must be alive.
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const hp = inst.counters?.currentHp ?? cardDB[CARD_NAME]?.hp ?? 0;
      if (hp <= 0) return;

      const spiderCount = countSpiderCreaturesControlled(engine, skullOwner);
      if (spiderCount <= 0) return;
      const bonus = PER_SPIDER_BONUS * spiderCount;
      if (bonus <= 0) return;
      ctx.modifyAmount(bonus);
      engine.log('crimson_skull_bonus', {
        player: engine.gs.players[skullOwner]?.username,
        bonus, spiderCount, surprise: srcName,
      });
    },

    /**
     * Same boost on creature targets the opponent controls — Spider
     * Avalanche / future creature-targeting Surprises propagate the
     * per-Spider bonus through the batch entries.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const cardDB = engine._getCardDB();
      const skullOwner = ctx.cardOwner;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const hp = inst.counters?.currentHp ?? cardDB[CARD_NAME]?.hp ?? 0;
      if (hp <= 0) return;
      const spiderCount = countSpiderCreaturesControlled(engine, skullOwner);
      if (spiderCount <= 0) return;
      const bonus = PER_SPIDER_BONUS * spiderCount;
      if (bonus <= 0) return;

      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        const tgtCtrl = e.inst?.controller ?? e.inst?.owner;
        if (tgtCtrl == null || tgtCtrl === skullOwner) continue;
        const srcName = e.source?.cardInstance?.name || e.source?.name;
        const srcData = srcName ? cardDB[srcName] : null;
        if (!srcData || srcData.subtype !== 'Surprise') continue;
        e.amount = (e.amount || 0) + bonus;
      }
    },
  },
};
