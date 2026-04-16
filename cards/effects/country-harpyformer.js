// ═══════════════════════════════════════════
//  CARD EFFECT: "Country Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for an
//    "Adventurousness" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard an Adventurousness
//    Ability from hand to gain 6 Gold.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');

const CARD_NAME  = 'Country Harpyformer';
const ABILITY_NAME = 'Adventurousness';

module.exports = {
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Adventurousness ────────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Search your deck for an "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: gain 6 Gold ────────────────────────────
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
      description: `Discard "${ABILITY_NAME}" to gain 6 Gold.`,
      confirmLabel: '🪙 Discard & Gain 6 Gold',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    const idx = ps.hand.indexOf(ABILITY_NAME);
    if (idx < 0) return false;
    ps.hand.splice(idx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('country_discard', { player: ps.username, card: ABILITY_NAME });

    await ctx.gainGold(6);
    engine.sync();
    return true;
  },
};
