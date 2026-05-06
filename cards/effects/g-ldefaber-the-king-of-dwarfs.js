// ═══════════════════════════════════════════
//  CARD EFFECT: "Güldefaber, the King of Dwarfs"
//  Hero (550 HP, 70 ATK — Toughness + Wealth)
//
//  Two passives, both Gold-flavoured:
//
//  1) Active — spend your Action to gain 20 Gold.
//     Adventurousness-Lv2 mirror, but on the Hero
//     itself. Wired through the `heroEffect` +
//     `heroEffectActionCost` channel that Champion
//     the Stormbringer pioneered: the action-cost
//     bookkeeping (Action Phase main slot OR a
//     Main-Phase additional-action provider) is
//     handled entirely by server.js
//     `doActivateHeroEffect`, and the engine's
//     `hero-effect:{name}:{pi}:{heroIdx}` HOPT key
//     gives us once-per-turn enforcement for free.
//
//  2) Passive trigger — once per turn, when this
//     Hero performs an Attack or Spell, gain 10
//     Gold. Tracked via a counter on Güldefaber's
//     own card instance and reset at every turn
//     start (Stellan's HOPT pattern, generalised
//     to "fires once per either-player's turn").
//     Triggered from `onAnyActionResolved` so
//     ANY Attack / Spell counts — main slot,
//     additional, inherent, free-action, even a
//     Reaction Spell on the opponent's turn —
//     matching the user's "performs an Attack or
//     Spell" wording (no "Action" qualifier).
// ═══════════════════════════════════════════

const CARD_NAME = 'Güldefaber, the King of Dwarfs';
const HOPT_KEY = '_guldefaberGoldUsed';
const ACTION_GOLD = 20;
const TRIGGER_GOLD = 10;

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  heroEffectActionCost: true,

  // CPU threat assessment: 20 Gold from the active + 10 Gold from one
  // Attack / Spell trigger ≈ 30 / turn while Güldefaber stays alive
  // and casts at all. Conservative because not every turn includes
  // an Attack or Spell.
  supportYield() {
    return { goldPerTurn: ACTION_GOLD + TRIGGER_GOLD };
  },

  // No precondition beyond the engine's standard alive / not-frozen /
  // not-stunned / not-negated / HOPT-clean checks (handled centrally
  // in `getActiveHeroEffects`). The Action grants Gold unconditionally.
  canActivateHeroEffect() { return true; },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    const hero = ps?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    await ctx.gainGold(ACTION_GOLD);
    engine.log('guldefaber_action', {
      player: ps.username, hero: hero.name, gold: ACTION_GOLD,
    });
    return true;
  },

  hooks: {
    // Per-instance counter clear on every turn start. Mirrors Stellan's
    // pattern (stellan-the-calm-cat.js:303-305) — "once per turn"
    // resets on either player's turn boundary, so a Reaction Spell on
    // the opponent's turn and a regular Attack on your own turn each
    // get their own 10-Gold trigger.
    onTurnStart: (ctx) => {
      if (ctx.card?.counters) delete ctx.card.counters[HOPT_KEY];
    },

    // Universal "any action resolved" — fires for Spell / Attack /
    // Creature / Ability / HeroEffect plays regardless of action-slot
    // category (main / additional / inherent / free-action). Gives
    // the trigger Reaction-Spell coverage too, since reactions skip
    // `onActionUsed` (server.js:3486 isReactionSubtype filter) but
    // still flow through this hook.
    onAnyActionResolved: async (ctx) => {
      // Actor must be Güldefaber on Güldefaber's owning player.
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Filter to Attack and Spell card types.
      if (ctx.actionType !== 'attack' && ctx.actionType !== 'spell') return;
      // Once per turn — counter on the card instance.
      const card = ctx.card;
      if (!card) return;
      if (card.counters?.[HOPT_KEY]) return;

      const engine = ctx._engine;
      const ps = engine.gs.players[ctx.cardOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Stamp the HOPT BEFORE the gold call so a re-entrant trigger
      // (chained reaction running another spell mid-resolve) can't
      // double-fire. Cleared by onTurnStart above.
      if (!card.counters) card.counters = {};
      card.counters[HOPT_KEY] = true;

      await ctx.gainGold(TRIGGER_GOLD);
      engine.log('guldefaber_trigger', {
        player: ps.username, hero: hero.name,
        gold: TRIGGER_GOLD, action: ctx.actionType,
      });
    },
  },
};
