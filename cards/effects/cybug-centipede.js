// ═══════════════════════════════════════════
//  CARD EFFECT: "Cybug CENTIPEDE"
//  Creature (Summoning Magic Lv1, Surprise) — 10 HP
//
//  "Activate this Surprise when your opponent would draw cards
//   through an effect by deleting 1 "Wheels" from your hand or
//   deck. You draw that number of cards instead. Then, place this
//   Creature into one of the user's free Support Zones. When this
//   Creature is defeated, add a "Wheels" from your discard pile to
//   your hand."
//
//  Mechanics
//  ─────────
//   • Pre-draw interrupt: hooks the engine's pre-draw Surprise
//     window (`surpriseBeforeOppDrawTrigger`). Fires INSIDE
//     `actionDrawCards` BEFORE any cards are dispensed. Returning
//     `{ drawRedirected: true }` from `onSurpriseActivate` cancels
//     opp's draw entirely; the controller's own follow-up draw
//     happens here too.
//   • Activation cost: delete 1 "Wheels" from controller's hand
//     (preferred) or deck. The trigger gate refuses to even prompt
//     when no Wheels is available (`hasCybugFuel`).
//   • Placement: standard Creature-Surprise behavior — the engine's
//     `_activateSurprise` disposition places the live inst into the
//     host Hero's first free Support Zone, no extra work needed
//     here.
//   • On-death recovery: when THIS Cybug CENTIPEDE instance dies,
//     pull a "Wheels" from the controller's discard pile to hand.
//     Filter by `death.instId === ctx.card.id` so other Cybug
//     CENTIPEDE deaths on the board don't pile on each other's
//     trigger. Best-effort — no-op if no Wheels in discard or
//     if the controller is hand-locked.
//   • Telekinesis disallowed: there's no real triggering draw to
//     redirect under a forced activation. Same gate Frost Rune /
//     Magic Mirror use.
// ═══════════════════════════════════════════

const { deleteCybugFuel, recoverCybugFuel, hasCybugFuel } = require('./_cybug-shared');

const CARD_NAME = 'Cybug CENTIPEDE';
const FUEL_CARD = 'Wheels';

module.exports = {
  isSurprise: true,
  // Surprise zone for the pre-draw interrupt; support zone for the
  // post-activation Creature life (where the death hook fires).
  activeIn: ['surprise', 'support'],

  canTelekinesisActivate: false,

  /**
   * Trigger: opp is about to draw cards through an effect AND the
   * controller can pay the Wheels cost. The engine's pre-draw
   * window already filters by phase (Resource-Phase draws don't
   * open this window), so the script just needs to gate on
   * payability + a positive draw count.
   */
  surpriseBeforeOppDrawTrigger(gs, ownerIdx, heroIdx, drawInfo, engine) {
    if (!drawInfo || drawInfo.drawingPlayer === ownerIdx) return false;
    if (!drawInfo.count || drawInfo.count <= 0) return false;
    // Hand-locked controllers can't fulfil "you draw that number of
    // cards instead" — refuse to even prompt so the cost isn't
    // wasted on a redirect that can't pay out.
    if (gs.players[ownerIdx]?.handLocked) return false;
    return hasCybugFuel(gs, ownerIdx, FUEL_CARD);
  },

  /**
   * Pay the Wheels cost → draw that many cards for the controller.
   * Returning `{ drawRedirected: true }` aborts the opp's
   * `actionDrawCards` call so they draw nothing.
   */
  async onSurpriseActivate(ctx, sourceInfo) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return null;

    // Hand-lock guard — `surpriseBeforeOppDrawTrigger` already
    // rejects when locked, but a race (Friendship Lv1 etc. locking
    // mid-prompt) could leave us mismatched. Bail BEFORE paying so
    // no Wheels is wasted on a redirect that can't land.
    if (ps.handLocked) return null;

    // Pay cost — `surpriseBeforeOppDrawTrigger` already verified
    // availability, but a race (another effect just consumed the
    // Wheels mid-prompt) could leave us empty-handed. Refuse the
    // redirect cleanly so opp's draw still resolves.
    const paid = await deleteCybugFuel(engine, pi, FUEL_CARD);
    if (!paid) return null;

    const count = sourceInfo?.count || 0;
    if (count > 0) {
      // Controller draws the redirected count. Pass `_skipBatchHook`
      // so this internal draw doesn't re-trigger another Cybug
      // CENTIPEDE on its own draw (and to skip the
      // `BEFORE_DRAW_BATCH` reactors that already fired for the
      // original opp draw — those have already had their say).
      await engine.actionDrawCards(pi, count, {
        source: CARD_NAME,
        _skipBatchHook: true,
      });
    }

    engine.log('cybug_centipede_redirect', {
      player: ps.username,
      count, original: sourceInfo?.drawingPlayer,
    });
    engine.sync();

    return { drawRedirected: true };
  },

  hooks: {
    /**
     * On-death recovery — best-effort pull of a single Wheels from
     * discard back to the controller's hand. Filtered to THIS
     * specific Cybug CENTIPEDE instance via `instId` match so
     * board-wide creature deaths don't all run this. Engine fires
     * `onCreatureDeath` for the dying card itself, so `ctx.card` is
     * the dying instance and the id comparison is a true equality.
     */
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || !ctx.card) return;
      if (death.instId !== ctx.card.id) return;
      const pi = death.owner;
      await recoverCybugFuel(ctx._engine, pi, FUEL_CARD, CARD_NAME);
    },
  },
};
