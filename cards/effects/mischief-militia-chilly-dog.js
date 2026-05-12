// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Chilly Dog"
//  Creature — Summoning Magic Lv1, 50 HP
//
//  Two passive auras:
//
//  1) FROZEN ≠ NEGATED on your side. Own-side
//     Heroes / Abilities / Creatures keep firing
//     their effects while Frozen. Stunned and
//     Negated still silence. (Card text:
//     "[Frozen] Heroes still can't perform
//     Actions" — Action eligibility is gated
//     elsewhere in the engine and is NOT lifted
//     by Chilly Dog, only passive hook firing
//     and effect / ability activation.)
//
//     Wiring: derived LIVE by the engine helper
//     `engine._isChillyDogActiveFor(pi)`, which
//     walks `cardInstances` and returns true iff
//     a Chilly Dog with an active effect sits on
//     pi's support side. Puzzle-mode boards (and
//     any other off-hook insertion path) work
//     instantly — the rule is "while a Chilly
//     Dog exists", not "when a Chilly Dog is
//     summoned". The legacy `gs._chillyDogActive
//     For` / `…ActiveCount` counters maintained
//     by the hooks below stay as a no-op cache;
//     no engine code reads them anymore.
//
//  2) HASTE on own-side Frozen Creatures with
//     summoning sickness. Set `_hasHaste` so the
//     Creature can fire its active effect on the
//     turn it was summoned. Triggers:
//       • Creature freezes while sick → haste.
//       • Creature is summoned while Frozen     → haste on entry.
//       • Chilly Dog itself enters the board
//         with Frozen-sick allies present       → haste each one.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Mischief Militia - Chilly Dog';

/** Increment / decrement the per-side activity counter. */
function _setActiveFor(engine, pi, delta) {
  if (!engine?.gs) return;
  if (!engine.gs._chillyDogActiveFor) engine.gs._chillyDogActiveFor = {};
  if (!engine.gs._chillyDogActiveCount) engine.gs._chillyDogActiveCount = {};
  const next = (engine.gs._chillyDogActiveCount[pi] || 0) + delta;
  engine.gs._chillyDogActiveCount[pi] = Math.max(0, next);
  engine.gs._chillyDogActiveFor[pi] = engine.gs._chillyDogActiveCount[pi] > 0;
}

/** Try to grant Haste to a Frozen-sick Creature. */
function _maybeGrantHaste(engine, inst) {
  if (!inst || inst.zone !== 'support') return;
  if (!inst.counters?.frozen) return;
  if (inst.turnPlayed !== (engine.gs.turn || 0)) return; // not sick
  if (inst.counters._hasHaste) return;
  inst.counters._hasHaste = true;
  engine.log('chilly_dog_haste', {
    target: inst.name, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
  });
}

/** Walk own-side support and grant Haste to all matching Creatures. */
function _refreshOwnSide(engine, pi) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const ctrl = inst.controller ?? inst.owner;
    if (ctrl !== pi) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    _maybeGrantHaste(engine, inst);
  }
}

module.exports = {
  activeIn: ['support'],

  cpuMeta: {
    onDeathBenefit: 0,
  },

  hooks: {
    // Aura ON when this Chilly Dog lands. Refresh haste for own-side
    // Frozen-sick allies on the same beat — they should benefit
    // retroactively for the rest of this turn.
    onPlay: async (ctx) => {
      const inst = ctx.card;
      if (!inst || ctx.playedCard?.id !== inst.id) return;
      if (inst.zone !== 'support') return;
      const engine = ctx._engine;
      const pi = inst.controller ?? inst.owner;
      _setActiveFor(engine, pi, +1);
      _refreshOwnSide(engine, pi);
      engine.sync();
    },

    // Aura OFF when this Chilly Dog leaves the board. Engine-level CC
    // silence reasserts itself naturally on the next hook fire.
    onCardLeaveZone: async (ctx) => {
      if (ctx.leavingCard?.id !== ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      const engine = ctx._engine;
      const pi = ctx.card.controller ?? ctx.card.owner;
      _setActiveFor(engine, pi, -1);
      engine.sync();
    },

    // Frozen status applied to an own-side Creature with summoning
    // sickness → grant Haste.
    onStatusApplied: async (ctx) => {
      if (!ctx._onCreature) return;
      const sn = ctx.statusName || ctx.status;
      if (sn !== 'frozen') return;
      const inst = ctx.target;
      if (!inst) return;
      const ctrl = inst.controller ?? inst.owner;
      const myPi = ctx.card.controller ?? ctx.card.owner;
      if (ctrl !== myPi) return;
      _maybeGrantHaste(ctx._engine, inst);
    },

    // Creature enters our side already Frozen (e.g. SnowItAll's hand-
    // summon + freeze flow, future "place Frozen" effects) → grant
    // Haste if it has summoning sickness.
    onCardEnterZone: async (ctx) => {
      if (ctx.toZone !== 'support') return;
      const entering = ctx.enteringCard;
      if (!entering) return;
      const ctrl = entering.controller ?? entering.owner;
      const myPi = ctx.card.controller ?? ctx.card.owner;
      if (ctrl !== myPi) return;
      _maybeGrantHaste(ctx._engine, entering);
    },
  },
};
