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

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

const { harpyformerInherentAction, harpyformerDiscardCost } = require('./_harpyformer-shared');

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
    // Nur der AKTIVE Teileffekt ist reines Gold ("discard an
    // Adventurousness Ability to gain 6 Gold"). Die Karte selbst
    // bleibt spielbar — Beschwoerungs-Effekt und Zusatzaktion haengen
    // nicht am Gold.
    if (goldGainWouldBeBlocked(ctx._engine, ctx.cardOwner)) return false;
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const ok = await harpyformerDiscardCost(engine, pi, ABILITY_NAME, {
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to gain 6 Gold.`,
      source: CARD_NAME,
      logType: 'country_discard',
    });
    if (!ok) return false;

    await ctx.gainGold(6);
    engine.sync();
    return true;
  },
};
