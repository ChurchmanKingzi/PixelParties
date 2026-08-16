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
//      (gemeinsamer Rundenzaehler, Schluessel `goldenVermin`).
//      Setzt sich per Rundenstempel selbst zurueck — jeder Spielerzug
//      bringt frische Ladungen (Als Regel 16.8.).
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

const { usesLeft, spendUse } = require('./_charges');
const USE_KEY = 'goldenVermin';
module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): nur LESEN,
  // niemals den Zaehler anfassen — laeuft bei jedem Zustandsversand.
  chargesPerTurn: 5,
  chargeKey: USE_KEY,
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
    // ── KEINE eigene Ruecksetzung mehr (v417) ──────────────────────
    // Hier stand ein `onTurnStart`, das nur beim EIGENEN Rundenbeginn
    // zuruecksetzte — der Kommentar berief sich sogar auf eine
    // „standard per turn convention", die es so nie gab. Al hat es am
    // 16.8. entschieden: X-mal in meiner Runde, dann FRISCHE X-mal in
    // der Gegnerrunde. Vermin lief damit auf halbem Kontingent.
    // Der gemeinsame Zaehler stempelt die Runde mit.

    onResourceGain: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      const pending = ctx.amount || 0;
      if (pending <= 0) return;

      const inst = ctx.card;
      const gs = ctx._engine?.gs;
      const frei = usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN });
      if (frei <= 0) return;
      const used = MAX_USES_PER_TURN - frei;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Draw 1 card instead of gaining ${pending} Gold? `
          + `(${used + 1}/${MAX_USES_PER_TURN} uses this turn)`,
      });
      if (!confirmed) return;

      spendUse(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN });
      ctx.cancel();
      await ctx.drawCards(ctx.cardOwner, 1);

      ctx._engine.log('golden_vermin_swap', {
        player: ctx.players[ctx.cardOwner]?.username,
        goldForegone: pending,
        uses: MAX_USES_PER_TURN - usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES_PER_TURN }),
      });
    },
  },
};
