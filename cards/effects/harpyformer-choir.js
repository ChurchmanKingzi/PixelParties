// ═══════════════════════════════════════════
//  CARD EFFECT: "Harpyformer Choir"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for a
//    "Summoning Magic" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Summoning Magic
//    Ability from hand. Until the beginning of
//    your next turn, the next damage ANY Creature
//    you control would take is reduced by 100.
//
//  Shield is stored as _choirShield on this
//  creature instance and cleared on the
//  owner's next turn start or when consumed.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');

const CARD_NAME    = 'Harpyformer Choir';
const ABILITY_NAME = 'Summoning Magic';

module.exports = {
  inherentAction: harpyformerInherentAction,

  activeIn: ['support'],

  // ── On summon: search deck for Summoning Magic + shield hook ──────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for a "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },

    /**
     * Expire the shield at the start of its owner's turn (if unused).
     */
    onTurnStart: async (ctx) => {
      if (ctx.activePlayer !== ctx.cardOwner) return;
      if (ctx.card?.counters?._choirShield) {
        ctx.card.counters._choirShield = false;
        ctx._engine.sync();
      }
    },

    /**
     * Intercept creature damage batches: if the shield is active, reduce
     * the first non-cancelled damage entry against a friendly creature by 100.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      const inst = ctx.card;
      if (!inst?.counters?._choirShield) return;

      const pi = ctx.cardOwner;
      const entries = ctx.entries;
      if (!entries || entries.length === 0) return;

      // Find the first non-cancelled entry targeting a creature this player controls
      for (const entry of entries) {
        if (entry.cancelled) continue;
        const entryOwner = entry.inst?.controller ?? entry.inst?.owner;
        if (entryOwner !== pi) continue;

        // Reduce by 100, minimum 0
        entry.amount = Math.max(0, entry.amount - 100);
        inst.counters._choirShield = false;
        ctx._engine.log('choir_shield', {
          player: ctx.players[pi]?.username,
          protected: entry.inst.name,
          reduced: 100,
        });
        break;
      }
    },
  },

  // ── Once-per-turn creature effect: activate the shield ───────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Confirm discard
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to reduce the next damage a Creature you control takes by 100 until your next turn.`,
      confirmLabel: '🎵 Discard & Shield',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    const idx = ps.hand.indexOf(ABILITY_NAME);
    if (idx < 0) return false;
    ps.hand.splice(idx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('choir_discard', { player: ps.username, card: ABILITY_NAME });

    // Activate the shield on this creature instance
    ctx.card.counters._choirShield = true;
    engine.log('choir_shield_active', { player: ps.username });

    engine.sync();
    return true;
  },
};
