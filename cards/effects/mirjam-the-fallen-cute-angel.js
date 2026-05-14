// ═══════════════════════════════════════════
//  CARD EFFECT: "Mirjam, the Fallen Cute Angel"
//  Hero — 400 HP, 40 ATK. Starting abilities:
//  Charme, Terror.
//
//  Three passive effects, all keyed on Mirjam's
//  own hero zone:
//
//   1) Whenever Mirjam takes damage, permanently
//      increase her ATK by the damage amount.
//      Hooks `afterDamage`, filters to her own
//      hero object (cardOriginalOwner + heroIdx
//      so the rule survives hero theft), reads
//      `ctx.amount` (post-shield, pre-realDealt-
//      capping — matches the standard Lizbeth /
//      Brachion `ctx.amount` convention), and
//      mutates `hero.atk` directly. Broadcasts
//      `fighting_atk_change` so the UI flashes
//      the ATK gain like any Fighting bump.
//
//      Dead-hero filter (`hero.hp <= 0`) is the
//      engine's runHooks filter — if a damage
//      hit kills Mirjam, her own listener is
//      already filtered out before this handler
//      runs. No `_bypassDeadHeroFilter` opt-in
//      because the post-mortem ATK bump is
//      moot anyway.
//
//   2) `canPlayCard` blocks every Attack-card
//      play from Mirjam's column past the first
//      per turn. Counts via `onActionUsed`
//      (fires for both standard and additional-
//      action paths), reset by `onTurnStart`.
//      Per-turn counter lives on the hero object
//      as `_mirjamAttacksUsed` so it travels with
//      Mirjam across control changes (steals
//      can't reset the cap).
//
//      Bonus-action Attacks count too — the cap
//      is a HARDER ceiling than the standard
//      1-action-per-turn rule, so Coffee / Psychic
//      Scout / Ghuanjun combo can't lift it.
//
//   3) `beforeHeroEffect` cancels every `heal`
//      effect targeting Mirjam. `increaseMaxHp`
//      flows through a separate engine path
//      (line 5060 — direct `hero.maxHp` / `hp`
//      mutation, no `beforeHeroEffect` fire), so
//      "they can still be increased" works as
//      authored. Revival (`actionReviveHero`)
//      also bypasses the heal hook chain, so
//      Mirjam can be revived after a KO.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Mirjam, the Fallen Cute Angel';

module.exports = {
  activeIn: ['hero'],

  /**
   * Block additional Attacks beyond the first per turn — applies in
   * canPlayCard so the play option is greyed out in hand even when
   * a bonus-action grant (Coffee, Psychic Scout, Ghuanjun combo, …)
   * would otherwise lift the standard 1-per-turn ceiling.
   *
   * `gs.players[pi].heroes[heroIdx]` is the hero whose column the
   * card would resolve on. The cap belongs to the hero itself, so
   * we look it up directly rather than going through ctx (canPlayCard
   * is called with raw args, not a context).
   */
  canPlayCard: (gs, pi, heroIdx, cardData, _engine) => {
    if (!hasCardType(cardData, 'Attack')) return true;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero) return true;
    return (hero._mirjamAttacksUsed || 0) < 1;
  },

  hooks: {
    /**
     * Damage-to-ATK conversion. Mutates hero.atk directly + the
     * standard `fighting_atk_change` broadcast for the UI bump
     * (mirrors Nero Zira's pattern at nero-zira-the-mastermind.js:74).
     */
    afterDamage: async (ctx) => {
      const engine = ctx._engine;
      const target = ctx.target;
      if (!target || target.hp === undefined) return; // creature target — skip

      // Locate the damaged hero's pi/heroIdx by physical column.
      const gs = engine.gs;
      let tgtPi = -1, tgtHi = -1;
      for (let p = 0; p < 2; p++) {
        const heroes = gs.players[p]?.heroes || [];
        for (let h = 0; h < heroes.length; h++) {
          if (heroes[h] === target) { tgtPi = p; tgtHi = h; break; }
        }
        if (tgtPi >= 0) break;
      }
      if (tgtPi < 0 || tgtHi < 0) return;
      // Must be THIS Mirjam — `cardOriginalOwner` so the rule
      // survives theft (Mirjam stays physically in her original
      // column even when controlled by the opponent).
      if (tgtPi !== ctx.cardOriginalOwner) return;
      if (tgtHi !== ctx.cardHeroIdx) return;

      const amount = ctx.amount || 0;
      if (amount <= 0) return;
      // The runHooks filter already drops Mirjam's listener if she
      // died from this hit; this is just a defensive double-check.
      if (target.hp <= 0) return;

      target.atk = (target.atk || 0) + amount;
      engine._broadcastEvent('fighting_atk_change', {
        owner: tgtPi, heroIdx: tgtHi, amount,
      });
      engine.log('mirjam_atk_gain', {
        hero: target.name, amount, newAtk: target.atk,
      });
      engine.sync();
    },

    /**
     * Heal block. `beforeHeroEffect` cancels via `ctx.cancel()`;
     * the engine then short-circuits the heal in `_actionHealHeroImpl`
     * (line 4748). `increaseMaxHp` doesn't fire this hook — it
     * mutates `hero.maxHp` / `hp` directly — so HP-pool expansions
     * still work as the card text promises.
     */
    beforeHeroEffect: (ctx) => {
      if (ctx.effectType !== 'heal') return;
      if (ctx.playerIdx !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      ctx.cancel();
      const engine = ctx._engine;
      const heroName = engine.gs.players[ctx.playerIdx]?.heroes?.[ctx.heroIdx]?.name;
      engine.log('mirjam_heal_blocked', {
        hero: heroName, amount: ctx.amount,
      });
    },

    /**
     * Attack-per-turn counter. Fires for both standard and
     * additional-action paths (server.js:3924 and 3929 both
     * fire `onActionUsed`), so bonus-action Attacks still count
     * toward the cap.
     */
    onActionUsed: async (ctx) => {
      if (ctx.actionType !== 'attack') return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Effective controller — survives hero theft (a stealer
      // playing an Attack from Mirjam's column still trips her cap).
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const hero = ctx.attachedHero;
      if (!hero) return;
      hero._mirjamAttacksUsed = (hero._mirjamAttacksUsed || 0) + 1;
    },

    /**
     * Reset on Mirjam's owner's turn start. `isMyTurn` is the
     * standard "this is the active player I belong to" check.
     */
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      const hero = ctx.attachedHero;
      if (hero) hero._mirjamAttacksUsed = 0;
    },
  },
};
