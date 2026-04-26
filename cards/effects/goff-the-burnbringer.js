// ═══════════════════════════════════════════
//  CARD EFFECT: "Goff, the Burnbringer"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Active effect (free, once per turn — standard
//  creatureEffect HOPT keyed on instance id):
//
//    Place a "Gon, the Frostbringer" from your
//    hand or deck underneath this Creature.
//
//  While Gon is attached:
//    • +200 HP (current and max).
//    • Any damage your opponent's targets take
//      from Burn is doubled.
//
//  Generic attach plumbing lives in
//  `engine.actionAttachHeroToCreature`. Goff
//  declares which Heroes it accepts via
//  `attachableHeroes`, defines the activation
//  trigger via `creatureEffect`, and applies
//  bonus stats via `onAttachHero`. The bonus
//  EFFECT (Burn doubling) is implemented as
//  `beforeDamage` / `beforeCreatureDamageBatch`
//  hooks gated on the `attachedHero` counter,
//  so it switches off automatically if Goff
//  somehow loses the attachment.
// ═══════════════════════════════════════════

const ATTACHABLE = 'Gon, the Frostbringer';

module.exports = {
  activeIn: ['support'],

  // Generic attach declaration — engine helper checks this list
  // when attaching, future creatures with the same shape just list
  // a different Hero name.
  attachableHeroes: [ATTACHABLE],

  // Active effect: trigger the attach. Free activation
  // (no Action consumed); the once-per-turn cap is the engine's
  // standard creature-effect HOPT.
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    if (ctx.card.counters?.attachedHero) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hasGon = (ps.hand || []).includes(ATTACHABLE)
      || (ps.mainDeck || []).includes(ATTACHABLE);
    return hasGon;
  },

  async onCreatureEffect(ctx) {
    return await ctx._engine.actionAttachHeroToCreature(
      ctx.cardOwner, ATTACHABLE, ctx.card,
      { source: 'Goff, the Burnbringer' },
    );
  },

  /**
   * Engine hook fired by `actionAttachHeroToCreature` after the Hero
   * is successfully tucked underneath. Apply Goff's stat bump here.
   * `increaseMaxHp` on a CardInstance bumps both currentHp and maxHp.
   */
  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 200);
  },

  // CPU hint: attaching Gon is essentially free upside (a card from
  // hand or deck for +200 HP and a passive damage doubler) — but the
  // turn-bounded evaluator can't measure the future-Burn-doubling
  // payoff, and the +200 HP doesn't directly score in
  // evaluateState's slot-occupancy term. Always commit so the gate
  // doesn't refuse it.
  cpuMeta: { alwaysCommit: true },

  hooks: {
    /**
     * Hero-target Burn damage doubler. Fires before the engine
     * applies the damage so the doubled amount flows through every
     * downstream hook (afterDamage, status reactions, etc.) without
     * any special casing.
     *
     * Gates:
     *   • Only while Gon is attached to THIS Goff.
     *   • Source must be Burn (engine's burn tick uses
     *     `source.name === 'Burn'`, type `'fire'`).
     *   • Target must be on the OPPONENT's side — own-side Burn
     *     ticks don't get doubled (matches "your opponent's targets"
     *     in the card text).
     */
    beforeDamage: (ctx) => {
      if (!ctx.card.counters?.attachedHero) return;
      if (ctx.source?.name !== 'Burn') return;
      if (ctx.type !== 'fire') return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      const engine = ctx._engine;
      const targetOwner = engine._findHeroOwner?.(target);
      if (targetOwner == null || targetOwner < 0) return;
      if (targetOwner === ctx.cardOwner) return;
      // Use ctx.setAmount — `ctx.amount` is a copy of the hookCtx
      // value (numbers don't share references through the spread in
      // _createContext), so a direct assignment doesn't propagate
      // back to the engine. setAmount writes to hookCtx.amount.
      const doubled = (ctx.amount || 0) * 2;
      ctx.setAmount(doubled);
      engine.log('goff_burn_doubled', {
        target: target.name, newAmount: doubled,
      });
    },

    /**
     * Creature-target Burn damage doubler. Same gates as above, but
     * iterates the batch's entries[] — burn ticks on opp creatures
     * fire through `processCreatureDamageBatch`, not `actionDeal-
     * Damage`, so a separate hook is needed.
     */
    beforeCreatureDamageBatch: (ctx) => {
      if (!ctx.card.counters?.attachedHero) return;
      const entries = ctx.entries || [];
      for (const e of entries) {
        if (e.cancelled) continue;
        if (e.source?.name !== 'Burn') continue;
        if (e.type !== 'fire') continue;
        if (!e.inst) continue;
        if (e.inst.owner === ctx.cardOwner) continue;
        e.amount = (e.amount || 0) * 2;
        ctx._engine.log('goff_burn_doubled', {
          target: e.inst.name, newAmount: e.amount,
        });
      }
    },
  },
};
