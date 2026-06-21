// ═══════════════════════════════════════════
//  CARD EFFECT: "Temple of Sacrifice"
//  Spell — Area (Summoning Magic Lv1)   (Banned)
//
//  "You may sacrifice a Creature you control that was not summoned this
//   turn to play this card as an additional Action. Every time a player
//   sacrifices 1 or more Creatures, they may draw 1 card. Every time a
//   player sacrifices 1 or more Heroes, they may draw 3 cards."
//
//  ── Inherent additional Action (with a sacrifice cost) ──
//  `inherentAction` is a function gated on the controller having an
//  eligible Creature (one NOT summoned this turn). While that holds, the
//  card can be played WITHOUT spending the Main/Action-Phase Action; the
//  sacrifice paid in `onPlay` is the cost (Divine Gift of Sacrifice
//  pattern). Declining the sacrifice cancels the play (card returns to
//  hand, no Action spent). With no eligible Creature the card is simply
//  played with the normal Action and no sacrifice. (Temple is NOT a
//  "Chaorc" card, so the Chaorc Cannon Fodder "sacrifice the turn it's
//  summoned" exception does NOT apply — the cost is plain "not summoned
//  this turn".)
//
//  ── Draw triggers (symmetric — fire for EITHER player) ──
//  • Creatures: ONE draw per sacrifice EVENT, not per tribute. The
//    engine fires `onSacrificeBatch` once per `resolveSacrificeCost`
//    cost (any tribute count) → draw 1. Single-Creature sacrifices that
//    don't go through a batched cost (treatAsSacrificed, Garius,
//    Brackle, …) fire an unflagged `onCreatureSacrificed` → also draw 1.
//    Batched fires are flagged `_inSacrificeBatch` and skipped in the
//    per-tribute handler so a batch never double-draws.
//  • Heroes: Hero sacrifices flag their KO via `isSacrifice` (Divine
//    Gift of Sacrifice, Pharaoh, …) → draw 3.
//
//  The draw goes to the player who DID the sacrificing, and is optional
//  ("they may") — offered via a confirm prompt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Temple of Sacrifice';

/** Does `pi` control a sacrificable Creature that was NOT summoned this
 *  turn? `getSacrificableCreatures` already drops Cardinal Beasts /
 *  immovables / face-downs / "cannot be sacrificed" Creatures. */
function hasFreshSacrifice(engine, pi) {
  const turn = engine.gs.turn;
  return engine.getSacrificableCreatures(pi).some(c => c.inst.turnPlayed !== turn);
}

/** Offer the sacrificing player an optional draw of `n`. */
async function offerDraw(engine, pi, n) {
  if (pi == null || pi < 0) return;
  const ps = engine.gs.players[pi];
  if (!ps) return;
  const ok = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `Temple of Sacrifice — draw ${n} card${n > 1 ? 's' : ''}?`,
    showCard: CARD_NAME,
    confirmLabel: `🃏 Draw ${n}!`,
    cancelLabel: 'No',
    cancellable: true,
  });
  if (!ok) return;
  await engine.actionDrawCards(pi, n);
  engine.sync();
}

module.exports = {
  // 'hand' for the self-cast onPlay; 'area' for the passive draw hooks.
  activeIn: ['hand', 'area'],

  // The inherent additional-Action play is available ONLY while an
  // eligible Creature to sacrifice exists.
  inherentAction: (gs, pi, heroIdx, engine) => hasFreshSacrifice(engine, pi),

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];

      // Eligible Creature present → the engine classified this as the
      // inherent additional Action; offer the sacrifice cost.
      if (hasFreshSacrifice(engine, pi)) {
        const turn = gs.turn;
        const paid = await engine.resolveSacrificeCost(ctx, {
          minCount: 1,
          maxCount: 1,
          title: `${CARD_NAME} — Sacrifice`,
          description: 'Sacrifice 1 of your Creatures (not summoned this turn) to play Temple of Sacrifice as an additional Action.',
          confirmLabel: '🗡️ Sacrifice!',
          confirmClass: 'btn-danger',
          cancellable: true,
          filter: (c) => c.inst.turnPlayed !== turn,
        });
        if (!paid) {
          // Sacrifice declined. If a regular Action is available (Action
          // Phase, caster hasn't acted yet), play Temple by consuming
          // THAT instead of aborting — flip the engine's inherent
          // classification back to a main-Action consume (the Curse
          // dual-mode pattern; server.js reads gs._spellForcesActionConsume
          // after onPlay). Otherwise (Main Phase, or already acted) the
          // inherent additional Action was the only way in, so cancel
          // the play and return the card to hand.
          const heroIdx = ctx.cardHeroIdx;
          const casterActed = (ps.heroesActedThisTurn || []).includes(heroIdx);
          const canSpendAction = gs.currentPhase === 3 && !casterActed;
          if (canSpendAction) {
            gs._spellForcesActionConsume = true;
          } else {
            gs._spellCancelled = true;
            return;
          }
        }
      }

      // Place into the controller's Area zone (handles the
      // _spellPlacedOnBoard disposition + onCardEnterZone).
      await engine.placeArea(pi, ctx.card);
    },

    // Creatures — one draw per sacrifice cost (any tribute count).
    onSacrificeBatch: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      await offerDraw(ctx._engine, ctx.playerIdx, 1);
    },

    // Creatures — single sacrifices outside a batched cost.
    onCreatureSacrificed: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      if (ctx._inSacrificeBatch) return; // batch handled above — no double-draw
      const drawPlayer = ctx.source?.owner ?? ctx.creature?.controller ?? ctx.creature?.owner;
      await offerDraw(ctx._engine, drawPlayer, 1);
    },

    // Heroes — draw 3 per sacrificed Hero (flagged via isSacrifice).
    onHeroKO: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      if (!ctx.isSacrifice) return;
      const drawPlayer = ctx.source?.owner ?? ctx.source?.controller;
      await offerDraw(ctx._engine, drawPlayer, 3);
    },
  },

  cpuMeta: {
    // While Temple is on the board, sacrificing your own Creatures draws
    // cards — so the CPU should treat its Creatures as more disposable.
    // Chain source (collected from the area zone) crediting a draw's
    // worth to every own-side Creature death.
    chainSource: {
      isArmed: (engine, inst) => inst.zone === 'area',
      triggersOn: (engine, tributeInst, sourceInst) =>
        (tributeInst.controller ?? tributeInst.owner) === (sourceInst.controller ?? sourceInst.owner),
      valuePerTrigger: 20,
    },
  },
};
