// ═══════════════════════════════════════════
//  CARD EFFECT: "Tarleinn's Floating Island"
//  Spell (Support Magic Lv0, Area)
//
//  Self-place into the caster's area zone on cast.
//
//  ① Inherent additional action when the casting
//     hero is "Tarleinn the Traveler".
//
//  ② Once per turn (game-wide), when a target a
//     player controls has its HP healed, that
//     player may draw 1 card.
//
//  The "once per turn" gate lives on the area
//  instance's counters. Two Floating Islands on
//  opposite sides EACH track their own per-turn
//  trigger so each side gets one shot per turn —
//  the once-per-turn cap is per-island, not global.
// ═══════════════════════════════════════════

const CARD_NAME = "Tarleinn's Floating Island";
const HOPT_KEY  = 'tarleinnIslandTriggeredOnTurn';

module.exports = {
  // Live in 'hand' so the self-cast onPlay fires; live in 'area' so
  // afterHeal fires once placed.
  activeIn: ['hand', 'area'],

  /**
   * Inherent additional action when Tarleinn the Traveler is the caster.
   * The check runs per-hero — engine asks "is this hero allowed to play
   * this card without spending its turn action?" and we answer yes iff
   * the hero is Tarleinn.
   */
  inherentAction: (gs, pi, heroIdx /*, engine */) => {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    return hero?.name === 'Tarleinn the Traveler';
  },

  hooks: {
    /**
     * Self-cast: drop into the caster's Area zone. The client-side
     * overlay uses a hardcoded layout, so no per-play seed is needed.
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /**
     * Triggered draw on heal. Fires on hero heals (afterHeal hook).
     * Creature heals don't fire afterHeal in the engine, so this card
     * effectively triggers off hero heals — matching the "target a
     * player controls" wording for hero healing.
     */
    afterHeal: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const gs     = engine.gs;
      const turn   = gs.turn || 0;

      // Per-island once-per-turn guard.
      if (ctx.card.counters?.[HOPT_KEY] === turn) return;

      const target = ctx.target;
      const targetOwner = ctx.targetOwner;
      const healed = ctx.healedAmount || 0;
      if (!target || targetOwner == null || targetOwner < 0) return;
      if (healed <= 0) return;

      // Ensure target is alive (it is, we just healed it — defensive)
      if (target.hp !== undefined && target.hp <= 0) return;

      const ps = gs.players[targetOwner];
      if (!ps) return;
      // Nothing to draw if their main deck is empty (skip the prompt
      // entirely — saves a "do nothing" Yes/No round-trip).
      if (!(ps.mainDeck || []).length) return;

      // Mark the per-turn slot BEFORE the prompt so a heal in the same
      // resolution chain can't double-trigger.
      if (!ctx.card.counters) ctx.card.counters = {};
      ctx.card.counters[HOPT_KEY] = turn;

      const confirmed = await engine.promptGeneric(targetOwner, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${target.name || 'Your hero'} was just healed. Draw 1 card from ${CARD_NAME}?`,
        showCard: CARD_NAME,
        confirmLabel: '📜 Draw 1!',
        confirmClass: 'btn-success',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) {
        // Refund: not consuming the turn slot when the player declines.
        if (ctx.card.counters[HOPT_KEY] === turn) delete ctx.card.counters[HOPT_KEY];
        return;
      }

      // Sparkle on the area zone for both players
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: ctx.cardOwner,
        heroIdx: -1, zoneSlot: -1, zoneType: 'area',
      });

      await engine.actionDrawCards(targetOwner, 1);
      engine.log('tarleinn_island_draw', {
        player: ps.username, healed: target.name,
      });
      engine.sync();
    },
  },
};
