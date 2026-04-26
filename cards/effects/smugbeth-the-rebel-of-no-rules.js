// ═══════════════════════════════════════════
//  CARD EFFECT: "Smugbeth, the Rebel of no Rules"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Active effect (free, once per turn — standard
//  creatureEffect HOPT keyed on instance id):
//
//    Place a "Lizbeth, the Reaper of the Light"
//    from your hand or deck underneath this
//    Creature.
//
//  While Lizbeth is attached:
//    • +250 HP (current and max).
//    • Smugbeth's HOST HERO can use the active
//      effects of opponent Heroes' Abilities as
//      if they were attached to it. This is the
//      ACTIVE-only half of Lizbeth's borrowing
//      (Lizbeth herself also gets the passive
//      level-req counting; Smugbeth's host does
//      NOT).
//
//  All borrowing logic lives in the engine. The
//  host-hero gating is identified by checking
//  for a Smugbeth instance with Lizbeth attached
//  in the host's Support zone — see
//  `_heroHasSmugbethBoost` in `_engine.js`.
//  Smugbeth must itself be active (alive, not
//  negated / frozen / stunned / face-down).
// ═══════════════════════════════════════════

const ATTACHABLE = 'Lizbeth, the Reaper of the Light';

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    if (ctx.card.counters?.attachedHero) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hasLizbeth = (ps.hand || []).includes(ATTACHABLE)
      || (ps.mainDeck || []).includes(ATTACHABLE);
    return hasLizbeth;
  },

  async onCreatureEffect(ctx) {
    return await ctx._engine.actionAttachHeroToCreature(
      ctx.cardOwner, ATTACHABLE, ctx.card,
      { source: 'Smugbeth, the Rebel of no Rules' },
    );
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 250);
  },

  cpuMeta: { alwaysCommit: true },

  // No `hooks` block. The active-ability borrowing for Smugbeth's host
  // is dispatched entirely by the engine (`_getAbilityBorrowSources`
  // returns opponent sources for any hero that has a Smugbeth+Lizbeth
  // attached, gated on `mode === 'active'`).
};
