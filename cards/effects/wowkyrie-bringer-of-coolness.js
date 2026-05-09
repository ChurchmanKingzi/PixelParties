// ═══════════════════════════════════════════
//  CREATURE EFFECT: "Wowkyrie, Bringer of Coolness"
//  Once per turn: place the top card of your deck
//  on top of your Coolness Stack.
//  Damage immunity while the Stack has ≥3 cards.
// ═══════════════════════════════════════════

const CARD_NAME = 'Wowkyrie, Bringer of Coolness';
const STACK_THRESHOLD = 3;
const HOPT_KEY = 'wowkyriePushedThisTurn';

module.exports = {
  activeIn: ['support'],
  // Creatures with active effects use the `creatureEffect` API —
  // `actionCost` is the Ability flag and the engine wouldn't surface
  // an activate option on the Creature.
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    // Soft once-per-turn (per Wowkyrie instance).
    if (ctx.card?.counters?.[HOPT_KEY] === ctx._engine.gs.turn) return false;
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (!engine.hasCoolnessStack(pi)) return false;
    const ps = engine.gs.players[pi];
    return Array.isArray(ps?.mainDeck) && ps.mainDeck.length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return false;
    if (!engine.hasCoolnessStack(pi)) return false;
    if (!ctx.card.counters) ctx.card.counters = {};
    ctx.card.counters[HOPT_KEY] = engine.gs.turn;
    await ctx.pushDeckTopToCoolnessStack(pi, { source: CARD_NAME, requireStack: true });
    return true;
  },

  hooks: {
    /**
     * Stack-size-gated damage immunity. While owner's Stack has 3+
     * cards, all damage Wowkyrie would take is negated.
     */
    beforeDamage: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      // beforeCreatureDamageBatch fires for creature damage; beforeDamage
      // fires for hero damage. Wowkyrie is a creature — guard accordingly.
      // The actual creature-batch path uses beforeCreatureDamageBatch.
    },
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      if (engine.getCoolnessStackSize(ctx.cardOwner) < STACK_THRESHOLD) return;
      const entries = ctx.entries || [];
      for (const e of entries) {
        if (e.inst?.id === ctx.card.id) {
          e.amount = 0;
          e.negated = true;
        }
      }
    },
  },
};
