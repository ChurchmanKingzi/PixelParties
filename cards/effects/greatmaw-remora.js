// ═══════════════════════════════════════════
//  CARD EFFECT: "Greatmaw Remora"
//  Creature (Summoning Magic, Lv2, Normal) — 50 HP
//  Archetype: Greatmaw   (Banned)
//
//  "If you control at least 1 "Greatmaw" Creature, except "Greatmaw
//   Remora", you may summon this Creature from your hand as an
//   additional Action, but if you do, you cannot summon Creatures for
//   the rest of the turn afterwards, except "Greatmaw" Creatures. This
//   Creature can be sacrificed the turn it was summoned for the
//   effects of a "Greatmaw" Creature. When this Creature is
//   sacrificed, delete it."
//
//  ── Wiring ──────────────────────────────────────────────────────
//  • Free additional-Action summon → `inherentAction` returns true
//    while you control another (non-Remora) Greatmaw Creature, so the
//    engine plays Remora without consuming an Action.
//  • The summon-lock penalty is applied in `onPlay`. Per the design:
//      - If a real Action is still available, the player is PROMPTED
//        to either keep the free summon (→ except-Greatmaw lock) or
//        spend one of their Actions instead (→ no lock).
//      - If no real Action is available (the inherent path is the
//        only way Remora could be on the board), the lock applies
//        automatically.
//  • "Can be sacrificed the turn it was summoned for the effects of a
//    Greatmaw Creature" → `selfSacrificeableForGreatmaw: true`, read
//    generically by `_greatmaw-shared.greatmawSacFilter`.
//  • "When this Creature is sacrificed, delete it" → `onCreatureSacrificed`
//    flags the instance, `onCardLeaveZone` flips the discard-bound move
//    to the deleted pile via the engine's `_redirectToDeleted` hook.
//    `bypassStatusFilter` keeps these hooks firing even if Remora is
//    CC'd when sacrificed.
// ═══════════════════════════════════════════

const { controlsNonRemoraGreatmaw } = require('./_greatmaw-shared');

const CARD_NAME = 'Greatmaw Remora';

module.exports = {
  activeIn: ['support'],
  bypassStatusFilter: true,            // self-delete hooks fire even when CC'd
  selfSacrificeableForGreatmaw: true,  // read by _greatmaw-shared's sac filter

  // Free additional-Action summon while you control another Greatmaw
  // Creature. Engine evaluates this with (gs, pi, heroIdx, engine).
  inherentAction: (gs, pi, heroIdx, engine) => {
    try { return controlsNonRemoraGreatmaw(engine, pi); }
    catch { return false; }
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      if (!ps) return;

      // The penalty only applies when Remora was summoned via its free
      // additional-Action path — i.e. you control another Greatmaw
      // Creature (the same predicate `inherentAction` gated on). A
      // plain Action summon (no other Greatmaw on board) → no penalty.
      if (!controlsNonRemoraGreatmaw(engine, pi, ctx.card?.id)) return;

      const applyLock = () => {
        ctx.lockSummonsExceptGreatmaw();
        engine.log('greatmaw_remora_summon_lock', { player: ps.username });
      };

      // No real Action available → the inherent path is the only way
      // Remora could be here → auto-free, lock applies, no prompt.
      if (!engine.hasSpendableActionFor(pi, heroIdx)) {
        applyLock();
        return;
      }

      // A real Action is available → let the player choose. Confirm =
      // spend an Action (no lock); cancel / escape = free summon
      // (lock) — the no-surprise default.
      const spendAction = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Greatmaw Remora can be summoned as a free additional Action '
          + '(you control another "Greatmaw" Creature). If it is, you cannot summon '
          + 'non-"Greatmaw" Creatures for the rest of this turn.\n\n'
          + 'Spend one of your Actions on it instead to avoid that lock?',
        showCard: CARD_NAME,
        confirmLabel: '✋ Spend an Action',
        cancelLabel: '🦈 Free (lock non-Greatmaw)',
        cancellable: true,
      });

      if (spendAction && engine.consumeRealActionFor(pi, heroIdx)) {
        engine.log('greatmaw_remora_paid_action', { player: ps.username });
      } else {
        // Chose the free summon, OR chose to pay but no Action could
        // be consumed — either way the lock applies.
        applyLock();
      }
      engine.sync();
    },

    // "When this Creature is sacrificed, delete it." ON_CREATURE_SACRIFICED
    // fires (with the live instance) BEFORE the destroy/move — flag the
    // instance so onCardLeaveZone can redirect the corpse.
    onCreatureSacrificed: async (ctx) => {
      if (!ctx.creature || !ctx.card || ctx.creature.id !== ctx.card.id) return;
      ctx.card.counters = ctx.card.counters || {};
      ctx.card.counters._greatmawRemoraSacrificed = 1;
    },

    // Flip the sacrifice's discard-bound move to the deleted pile.
    // `_redirectToDeleted` is the engine's generic discard→deleted
    // redirect hook (see actionMoveCard).
    onCardLeaveZone: async (ctx) => {
      const leaving = ctx.leavingCard;
      if (!leaving || !ctx.card || leaving.id !== ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      if (leaving.counters?._greatmawRemoraSacrificed) {
        leaving._redirectToDeleted = true;
      }
    },
  },
};
