// ═══════════════════════════════════════════
//  CARD EFFECT: "Golden Vermin"
//  Creature (Summoning Magic Lv0) — 30 HP
//
//  Up to 5 times per turn, when you would gain Gold through an
//  effect, you may draw 1 card instead.
//
//  Wiring:
//    • Listens on `onResourceGain` while in the Support Zone.
//    • Trigger gate: the gainer (`ctx.playerIdx`) must be this
//      Creature's controller (`ctx.cardOwner`), the pending amount
//      must be > 0 (no point trading 0 Gold for a draw), and the
//      per-turn counter must be under cap.
//    • Per-turn use counter lives on the inst
//      (`inst.counters._goldenVerminUses`). Reset at the start of
//      the controller's turn via `onTurnStart`.
//    • Prompt: a yes/no confirm offers the swap, citing both the
//      pending Gold amount and the remaining use budget so the
//      player has the information they need to decide.
//    • Resolution: yes → `ctx.cancel()` suppresses the Gold gain,
//      `ctx.drawCards(owner, 1)` adds a card to hand, counter
//      bumps. No → fall through; Gold gain resolves normally.
//
//  Note on multi-Vermin tables: when more than one Golden Vermin
//  is on the same controller's side, only the FIRST listener in
//  the engine's hook-firing order can intercept any single Gold-
//  gain event — once it calls `ctx.cancel()`, the runHooks loop
//  breaks and downstream Vermin's hooks don't fire for that
//  event. If the controller declines the first prompt, the
//  second Vermin still gets a shot at the same event. Per-turn
//  budgets are tracked per inst, so each Vermin independently
//  caps at 5 uses.
// ═══════════════════════════════════════════

const CARD_NAME = 'Golden Vermin';
const MAX_USES_PER_TURN = 5;

module.exports = {
  // CPU: this is a gold→draw tradeoff prompt fired on every Gold gain. The
  // default brain declines cancellable confirms outside a card-cast, which
  // would make Golden Vermin a dead card for the CPU. Convert to a draw only
  // while the hand is still thin (keep the Gold otherwise) so it doesn't
  // starve the CPU's economy. (Title must equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type !== 'confirm' || promptData.showCard) return undefined;
    const ps = engine.gs.players?.[engine._cpuPlayerIdx];
    return { confirmed: (ps?.hand?.length || 0) < 5 };
  },
  activeIn: ['support'],

  hooks: {
    onTurnStart: async (ctx) => {
      // Reset only on the controller's own turn-start — opp turn
      // starts don't refresh own-side per-turn budgets, matching
      // the standard "per turn" convention across the engine.
      if (ctx.activePlayer !== ctx.cardOwner) return;
      const inst = ctx.card;
      if (inst?.counters?._goldenVerminUses != null) {
        delete inst.counters._goldenVerminUses;
      }
    },

    onResourceGain: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const pending = ctx.amount || 0;
      if (pending <= 0) return;

      const inst = ctx.card;
      if (!inst.counters) inst.counters = {};
      const used = inst.counters._goldenVerminUses || 0;
      if (used >= MAX_USES_PER_TURN) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Draw 1 card instead of gaining ${pending} Gold? `
          + `(${used + 1}/${MAX_USES_PER_TURN} uses this turn)`,
      });
      if (!confirmed) return;

      inst.counters._goldenVerminUses = used + 1;
      ctx.cancel();
      await ctx.drawCards(ctx.cardOwner, 1);

      ctx._engine.log('golden_vermin_swap', {
        player: ctx.players[ctx.cardOwner]?.username,
        goldForegone: pending,
        uses: inst.counters._goldenVerminUses,
      });
    },
  },
};
