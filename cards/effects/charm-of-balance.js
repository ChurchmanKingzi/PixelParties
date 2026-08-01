// ═══════════════════════════════════════════
//  CARD EFFECT: "Charm of Balance"
//  Artifact (Equipment, Cost 4)
//
//  ① While equipped, whenever the equipped Hero
//    is hit by an opponent's card or effect (we
//    track damage AND status applications — the
//    two engine-observable forms of "being
//    affected"), put 1 Balance Counter on this
//    card.
//  ② Once per turn, the controller may activate
//    Charm of Balance to draw cards equal to the
//    number of Balance Counters currently on it.
//    The counters are NOT consumed by drawing.
//  ③ Hand-size guard: any time the controller's
//    hand size exceeds 7, Charm self-discards.
//    Hooked into every hand-grow path so the
//    rule fires immediately, not deferred.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

const CARD_NAME = 'Charm of Balance';
const HAND_LIMIT = 7;

/**
 * True if the source of an effect is an opponent of `pi`. Mirrors the
 * pattern in smugness.js — checks `controller` first (charmed source
 * routes there) and falls back to `owner`. Returns false for source-
 * less effects (status ticks with no clear caster, etc.) and self-
 * sourced effects.
 */
function _isOppSource(source, pi) {
  if (!source) return false;
  const srcOwner = source.controller ?? source.owner ?? -1;
  return srcOwner >= 0 && srcOwner !== pi;
}

function _addBalance(ctx, n = 1) {
  const inst = ctx.card;
  if (!inst) return;
  if (!inst.counters) inst.counters = {};
  inst.counters.balance = (inst.counters.balance || 0) + n;
  ctx._engine.log('charm_of_balance_counter', {
    counters: inst.counters.balance,
  });
}

/**
 * Send this Charm to its owner's discard pile if their hand size now
 * exceeds the cap. Idempotent: skipped once the inst has already been
 * moved out of `support` (a chained second hand-grow event in the same
 * tick won't double-discard a card that's already gone).
 */
async function _maybeSelfDiscard(ctx) {
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const ps = engine.gs.players[pi];
  if (!ps) return;
  if ((ps.hand || []).length <= HAND_LIMIT) return;

  // actionMoveCard with `fireCreatureDeath: false` is the right
  // primitive — Charm isn't a Creature, so no death hooks should run,
  // but the standard onCardLeaveZone wiring still fires which lets
  // grantAtk-style equip cleanup (none here, but matches the engine's
  // expectations) run.
  await engine.actionMoveCard(inst, ZONES.DISCARD, undefined, undefined, {
    fireCreatureDeath: false,
  });
  engine.log('charm_of_balance_self_discard', {
    player: ps.username,
    handSize: (ps.hand || []).length,
  });
  engine.sync();
}

module.exports = {
  // CPU: confirm this card's beneficial "you may" prompt — the default brain
  // declines cancellable confirms raised outside a card-cast (board
  // activation), which would otherwise make this effect a no-op for the CPU.
  // (The prompt title must equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  activeIn: ['support'],
  equipEffect: true,

  // ── Activated effect: draw N cards (N = current Balance Counters) ──
  // No-op when the counter is zero — keeps the equip from being clicked
  // in error before it has accumulated anything.
  canActivateEquipEffect(ctx) {
    return (ctx.card.counters?.balance || 0) > 0;
  },

  async onEquipEffect(ctx) {
    const counters = ctx.card.counters?.balance || 0;
    if (counters <= 0) return false;

    // Confirm with the player so they can see the draw count up front
    // (the equip has no other UI surface for the counter — this also
    // gives them an out if they're already close to the 7-card cap).
    const confirmed = await ctx.promptConfirmEffect({
      title: CARD_NAME,
      message: `Draw ${counters} card${counters !== 1 ? 's' : ''}?`,
    });
    if (!confirmed) return false;

    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    await engine.actionDrawCards(pi, counters, { source: CARD_NAME });

    engine.log('charm_of_balance_draw', {
      player: engine.gs.players[pi]?.username,
      counters,
    });

    // The hand-grow check is also wired via the onDraw hook, but call
    // it explicitly here too — actionDrawCards may bail early (deck out,
    // hand-lock, …) and then the onDraw hooks don't fire. Without this,
    // a Charm activation that drew zero cards but pushed hand to >7 by
    // some other path during the same async tick wouldn't self-discard.
    await _maybeSelfDiscard(ctx);
    return true;
  },

  hooks: {
    // ── Counter accumulation: damage from an opponent ──
    afterDamage: (ctx) => {
      if (ctx.target !== ctx.attachedHero) return;
      if (!_isOppSource(ctx.source, ctx.cardOwner)) return;
      _addBalance(ctx, 1);
      ctx._engine.sync();
    },

    // ── Counter accumulation: opponent applies a status to this hero ──
    // appliedBy lives on the just-stamped status options object; the
    // engine sets it from `opts.appliedBy` on the addHeroStatus call.
    onStatusApplied: (ctx) => {
      if (ctx.target !== ctx.attachedHero) return;
      const statusOpts = ctx.target?.statuses?.[ctx.statusName];
      const appliedBy = statusOpts?.appliedBy ?? -1;
      if (appliedBy < 0 || appliedBy === ctx.cardOwner) return;
      _addBalance(ctx, 1);
      ctx._engine.sync();
    },

    // ── Hand-size guard: every path that can grow the controller's hand ──
    // Uses async hooks because actionMoveCard awaits sync + onCardLeaveZone.
    onDraw: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      await _maybeSelfDiscard(ctx);
    },
    onCardAddedToHand: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      await _maybeSelfDiscard(ctx);
    },
    onCardAddedFromDiscardToHand: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      await _maybeSelfDiscard(ctx);
    },
    // Belt-and-suspenders catch-all: if some exotic path grew the hand
    // without firing any of the hooks above (rare — the hand-grow
    // primitives all funnel through them), the next turn-start sweep
    // still self-discards.
    onTurnStart: async (ctx) => {
      await _maybeSelfDiscard(ctx);
    },
  },
};
