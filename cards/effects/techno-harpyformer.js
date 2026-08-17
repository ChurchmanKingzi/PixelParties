// ═══════════════════════════════════════════
//  CARD EFFECT: "Techno Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may search deck for an
//    "Inventing" Ability, reveal and add to hand.
//  ③ Once per turn: discard an Inventing Ability
//    from hand to draw 2 cards.
// ═══════════════════════════════════════════

// Als Ruling 16.8. ("Tuscan Artist"): ist der 2er-/3er-Zug der EINZIGE
// Nutzen dieser Karte, wird sie gesperrt statt wirkungslos zu feuern.
// Die Auslegung steht in `_draw-block-shared.js`.
const { drawWouldBeBlocked } = require('./_draw-block-shared');

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

const CARD_NAME    = 'Techno Harpyformer';
const ABILITY_NAME = 'Inventing';

module.exports = {
  inherentAction: harpyformerInherentAction,

  // ── On summon: search deck for Inventing ──────────────────────────────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      const confirm = await ctx.promptConfirmEffect({
        title:   CARD_NAME,
        message: `Search your deck for an "${ABILITY_NAME}" Ability and add it to your hand?`,
      });
      if (!confirm) return;

      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: draw 2 cards ───────────────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    // Ohne den 2er-Zug blieben nur die Abwurf-Kosten uebrig — Als Ruling:
    // dann ist der Effekt nicht aktivierbar und verbraucht auch sein
    // Once-per-turn nicht.
    if (drawWouldBeBlocked(ctx._engine, ctx.cardOwner, 2)) return false;
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOwner;
    const ps     = gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to draw 2 cards.`,
      source: CARD_NAME,
      logType: 'techno_discard',
    });
    if (!ok) return false;
    engine.sync();

    await engine.actionDrawCards(pi, 2);
    engine.sync();
    return true;
  },
};
