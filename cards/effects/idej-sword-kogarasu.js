// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Sword - Kogarasu"
//  Artifact / Equipment (Idej) — Cost 20 (0 on Idej Lord Daiyo)
//
//  "You can only equip this Artifact to an "Idej" Hero you control.
//   If you equip this Artifact to "Idej Lord Daiyo", its Cost becomes
//   0. A Hero can only be equipped with 1 "Idej Sword" Artifact. Any
//   Spells the equipped Hero uses have their level reduced by the
//   Hero's Fighting level, but the equipped Hero can only use 1 Spell
//   per turn."
//
//  • Cost-0-on-Daiyo: handled by Idej Lord Daiyo's `equipCostReduction`.
//  • Level discount: `reduceCardLevel` — rebates the equipped Hero's
//    Fighting ability level off EVERY Spell it casts.
//  • "1 Spell per turn": the Sword self-stamps `treatAsEquip` so the
//    engine consults its `canPlayCard`, which blocks the equipped
//    Hero's 2nd+ Spell of the turn (tracked via `afterSpellResolved`).
// ═══════════════════════════════════════════

const { canEquipToIdejHero, heroHasIdejSword } = require('./_idej-shared');

function stampSelf(ctx) {
  if (ctx.card) {
    ctx.card.counters = ctx.card.counters || {};
    ctx.card.counters.treatAsEquip = 1; // → engine consults canPlayCard
  }
}

module.exports = {
  activeIn: ['support'],

  canEquipToHero(gs, pi, heroIdx, engine) {
    if (!canEquipToIdejHero(gs, pi, heroIdx, engine)) return false;
    const eng = engine || gs._engineRef;
    return eng ? !heroHasIdejSword(eng, pi, heroIdx) : true;
  },

  // "Any Spells the equipped Hero uses have their level reduced by the
  // Hero's Fighting level." Taio-style per-instance / per-casting-Hero
  // reducer — applies to every Spell the equipped Hero casts.
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx) {
    if (!cardData || cardData.cardType !== 'Spell') return 0;
    if (heroIdx == null || !inst || heroIdx !== inst.heroIdx) return 0;
    const abZones = engine.gs.players?.[ownerIdx]?.abilityZones?.[heroIdx] || [];
    return engine.countAbilitiesForSchool('Fighting', abZones) || 0;
  },

  // "the equipped Hero can only use 1 Spell per turn." Consulted by the
  // engine's equip-restriction gate (enabled by the treatAsEquip stamp).
  canPlayCard(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.cardType !== 'Spell') return true;
    const hero = gs.players?.[pi]?.heroes?.[heroIdx];
    return !hero || hero._idejKogarasuSpellTurn !== gs.turn;
  },

  hooks: {
    onPlay: (ctx) => stampSelf(ctx),
    onGameStart: (ctx) => stampSelf(ctx),
    onCardEnterZone: (ctx) => {
      if (ctx.enteringCard?.id === ctx.card?.id) stampSelf(ctx);
    },

    // Record that the equipped Hero has cast a Spell this turn so
    // canPlayCard blocks the next one.
    afterSpellResolved: (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Spell') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      const hero = ctx.attachedHero;
      if (hero) hero._idejKogarasuSpellTurn = ctx._engine.gs.turn;
    },
  },
};
