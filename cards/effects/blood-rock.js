// ═══════════════════════════════════════════
//  CARD EFFECT: "Blood Rock"
//  Attack (Fighting Lv3, Area)
//
//  EFFECT (passive, while in Area zone):
//   • At the END of EACH turn, deal 100 damage
//     to all Heroes the turn player controls.
//
//  IMPLEMENTATION:
//   • Self-place into the caster's Area zone via
//     the standard onPlay → placeArea path
//     (mirrors Stinky Stables / Acid Rain / the
//     Circle-of-Hell Areas).
//   • onTurnEnd fires for the Blood Rock instance
//     on BOTH players' End Phases (gs.activePlayer
//     is still the turn player at end-of-turn —
//     same convention The First Circle of Hell
//     relies on). The "turn player" is therefore
//     ctx.activePlayer.
//   • Damage routes through ctx.aoeHit so it goes
//     through the proper hero-damage channel and
//     respects shields, the surprise window and
//     post-target hand reactions (Anti Magic
//     Shield, Divine Gift of Rain, …) — same as
//     every other AoE card. aoeHit's `side` is
//     relative to the card's controller, so we map
//     the turn player onto 'own' vs 'enemy'.
//   • damageType 'other': this is passive recurring
//     board damage, not a Hero performing an Attack
//     action — matching MOE Bomb / Butterfly Cloud.
//   • Each Blood Rock copy resolves independently
//     (the hook fires once per instance), so two
//     Blood Rocks deal 100 + 100 as written.
// ═══════════════════════════════════════════

const { heroHasDiverHelmet } = require('./_diver-helmet-shared');

const CARD_NAME = 'Blood Rock';

module.exports = {
  // 'hand' for the self-cast onPlay; 'area' for the passive turn hook.
  activeIn: ['hand', 'area'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /**
     * End of EACH turn: 100 damage to every Hero the turn player
     * controls. The turn player is ctx.activePlayer (unchanged until
     * the turn actually flips). `side` is computed relative to Blood
     * Rock's controller because that's what actionAoeHit keys off.
     */
    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const pi = ctx.activePlayer;
      if (pi == null || pi < 0) return;

      const controller = ctx.card.controller;
      const side = pi === controller ? 'own' : 'enemy';
      const engine = ctx._engine;

      await ctx.aoeHit({
        side,
        types: ['hero'],
        damage: 100,
        damageType: 'other',
        sourceName: CARD_NAME,
        animationType: 'blood_moon_pulse',
        // Diver Helmet: the equipped Hero is unaffected by Areas — skip
        // it entirely (no damage AND no blood-pulse animation). tpi is
        // the targeted Hero's side.
        heroFilter: (hero, hi, tpi) => !heroHasDiverHelmet(engine, tpi, hi),
      });

      ctx._engine.log('blood_rock_tick', {
        turnPlayer: ctx._engine.gs.players[pi]?.username,
        damage: 100,
      });
      ctx._engine.sync();
    },
  },
};
