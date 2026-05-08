// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparkfly Attendant"
//  Creature (Summoning Magic, Lv 1, Sparkfly) — 50 HP
//
//  • Aura: while you control this Creature, your "Sparkfly Queen"
//    Creatures are unaffected by your opponent's cards and effects.
//    Implemented via the engine's generic absolute-immunity counter
//    (`_cardinalImmune`), with a marker `_sparkflyAttendantAura` so
//    the aura strips itself cleanly when the last Attendant leaves.
//  • When sacrificed to summon Sparkfly Queen (via Hive's Crown), the
//    Queen permanently gains: "This Creature is unaffected by your
//    opponent's cards and effects, except damage." The "except damage"
//    falls out of the engine's `_cardinalImmune` semantics — that
//    counter blocks targeted effects/destroys/displaces, never damage
//    events. The gift is stamped by Hive's Crown's resolve and is
//    independent of the live aura (so killing every Attendant doesn't
//    revoke a gift the Queen already received).
// ═══════════════════════════════════════════

const { refreshAttendantAura } = require('./_sparkfly-shared');

const CARD_NAME = 'Sparkfly Attendant';

module.exports = {
  activeIn: ['support'],

  hooks: {
    // On any zone-enter or zone-leave that could plausibly affect the
    // aura state, recompute it for the controller. The recompute is
    // O(cardInstances) and idempotent — running it on unrelated events
    // is harmless. Listening from the Attendant itself means the recheck
    // fires whether Attendant moved or a sibling Queen did, because the
    // engine fires onCardEnterZone/LeaveZone to all listeners.
    onCardEnterZone: (ctx) => {
      refreshAttendantAura(ctx._engine, ctx.cardOwner);
    },
    onCardLeaveZone: (ctx) => {
      refreshAttendantAura(ctx._engine, ctx.cardOwner);
    },
    onPlay: (ctx) => {
      // Initial sync the moment Attendant is placed.
      refreshAttendantAura(ctx._engine, ctx.cardOwner);
    },
    onGameStart: (ctx) => {
      refreshAttendantAura(ctx._engine, ctx.cardOwner);
    },
  },
};
