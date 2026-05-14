// ═══════════════════════════════════════════
//  CARD EFFECT: "Giga Steroids"
//  Artifact (Normal, Cost 6). BANNED.
//
//  Effect: You may perform a second Action during
//  your Action Phase this turn, but that Action
//  can only be used to activate an effect.
//
//  "Activate an effect" covers every Action-cost
//  activation of a face-up board card:
//    • `actionCost: true` Abilities (Adventurousness).
//    • `creatureActionCost: true` Creatures
//      (Spawn Mother).
//    • `heroEffectActionCost: true` Heroes
//      (Champion, the Stormbringer).
//
//  All three of those routes look up an
//  additional-action provider via
//  `findAdditionalActionForCategory(pi,
//  'ability_activation', heroIdx)` — so a single
//  `allowedCategories: ['ability_activation']`
//  grant covers every effect-activation path.
//  Spell / Attack / Creature plays from hand are
//  intentionally NOT covered.
//
//  Wiring:
//    • Plays in Main Phase (the engine's
//      `doUseArtifactEffect` path). The grant is
//      registered against THIS instance and
//      flagged `isSecondActionGrant: true`, so
//      the engine's existing second-action
//      machinery (only-redeemable-as-action-2,
//      onActionUsed fizzle when action 2 spent
//      elsewhere, onPhaseEnd cleanup) handles
//      the entire lifecycle. We just spread
//      `secondActionHooks` and let it run.
//    • Owner-wide, NOT hero-restricted —
//      `heroRestricted: false`. Any of the
//      controller's alive Heroes can spend the
//      grant on whichever effect they own. This
//      diverges from Soul Shard Ba (per-host) and
//      Reiza (per-host); Giga Steroids is
//      explicitly an item the player benefits
//      from across their whole side.
//    • `activeIn: ['hand', 'discard']` — the inst
//      is created in hand. After resolve, the
//      artifact card moves to the discard pile
//      (via `doUseArtifactEffect`'s direct splice,
//      which doesn't update `inst.zone`). The
//      stale `inst.zone === 'hand'` would silence
//      the listener under a strict filter; the
//      `'discard'` entry covers the eventual
//      zone-corrected path so the grant survives
//      either way until the Action Phase ends or
//      its slot is consumed/fizzled.
//    • `findAdditionalActionForCategory` doesn't
//      filter providers by zone — it walks every
//      cardInstance owned by the player and
//      checks `additionalActionAvail`. So even
//      with the stale zone, the provider remains
//      reachable for the duration of the grant.
// ═══════════════════════════════════════════

const { secondActionHooks, isSecondActionGrant } = require('./_second-action-shared');

const CARD_NAME = 'Giga Steroids';
const TYPE_ID_PREFIX = 'second_action:giga-steroids:';

/**
 * True iff `playerIdx` has at least one Action-cost effect on their
 * board that's currently activatable. Walks the same enumerators the
 * engine uses to populate the player's UI: Action-cost Abilities
 * (Adventurousness), Action-cost Creature effects (Spawn Mother), and
 * `heroEffectActionCost` Hero effects (Champion). All three categories
 * consume `ability_activation` slots — the only category Giga Steroids
 * grants — so if every list is empty, the bonus has nothing to spend.
 *
 * Called from the action-resolved hooks below to decide whether to
 * keep the player parked in Action Phase post-Action-1, or to fizzle
 * the grant so the engine's auto-advance to Main Phase 2 fires.
 */
function _hasAnyActionCostEffectAvailable(engine, pi) {
  // Action-cost Abilities. `getActivatableAbilities` already factors
  // in HOPT, hero CC, hand-lock, and per-script `canActivateAction`
  // gates — non-empty means at least one is fireable right now.
  if (engine.getActivatableAbilities(pi).length > 0) return true;

  // Action-cost Creatures. In Action Phase the function only returns
  // entries whose `actionCost` is true (free creature effects are
  // Main-Phase-only and skip in the loop). The `canActivate` flag
  // factors in summoning sickness + HOPT + script-side gates.
  for (const c of engine.getActivatableCreatures(pi)) {
    if (c.actionCost && c.canActivate) return true;
  }

  // `heroEffectActionCost` Heroes. In Action Phase
  // `getActiveHeroEffects` only returns action-cost heroes (free hero
  // effects skip via `else if (!isMainPhase) continue;`); a non-empty
  // result therefore means at least one Champion-style activation is
  // ready. The list also factors in HOPT + canActivateHeroEffect, so
  // dead/incapacitated/exhausted heroes are filtered out already.
  if (engine.getActiveHeroEffects(pi).length > 0) return true;

  return false;
}

/**
 * Recompute the player-level `onSteroids` flag. True iff the player
 * has at least one alive Giga Steroids grant (any cardInstance with
 * matching `additionalActionType` and `additionalActionAvail > 0`).
 * The client reads `me.onSteroids` / `opp.onSteroids` to render the
 * "On Steroids" buff badge in the top-of-board debuff/buff panel.
 *
 * Called every time the grant state mutates (resolve / consume /
 * fizzle / expire). Idempotent — safe to invoke from multiple hook
 * paths in the same action resolution.
 */
function _recomputeOnSteroidsFlag(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  let active = false;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.name !== CARD_NAME) continue;
    if (!inst.counters?.additionalActionAvail) continue;
    const typeId = inst.counters?.additionalActionType;
    if (typeof typeId !== 'string' || !typeId.startsWith(TYPE_ID_PREFIX)) continue;
    active = true;
    break;
  }
  if (active) ps.onSteroids = true;
  else if (ps.onSteroids) delete ps.onSteroids;
}

/**
 * Shared body for the `onActionUsed` and `onAnyActionResolved`
 * handlers. Both fire after an action resolves; we need the logic in
 * BOTH because:
 *   • `onActionUsed` fires for Spell / Attack / Creature plays and
 *     `actionCost: true` Ability activations.
 *   • `onAnyActionResolved` fires UNIVERSALLY — including Hero-effect
 *     activations (`heroEffectActionCost`) which DON'T fire
 *     `onActionUsed`.
 * Without the `onAnyActionResolved` listener, activating Champion's
 * effect as Action 1 would never trigger the fizzle path, the
 * grant would stay alive, and `advanceToPhase`'s internal "any
 * isSecondActionGrant alive?" check would refuse to advance — leaving
 * the player stuck in Action Phase with no way to spend the grant.
 *
 * The body is idempotent so double-firing on non-hero paths (where
 * both hooks run sequentially) is safe.
 */
async function _processGrantPostAction(ctx) {
  if (ctx.playerIdx !== ctx.cardOwner) return;
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!isSecondActionGrant(engine, inst)) return;
  const gs = engine.gs;
  const ps = gs.players[ctx.cardOwner];
  if (!ps) return;
  const actionsPlayed = ps._actionsPlayedThisPhase || 0;

  // Action 2+ resolved with grant unconsumed — another provider was
  // used. Fizzle (mirror of the shared late-fizzle branch).
  if (actionsPlayed >= 2 && inst.counters?.additionalActionAvail) {
    engine.expireAdditionalAction(inst);
    _recomputeOnSteroidsFlag(engine, ctx.cardOwner);
    engine.log('giga_steroids_fizzle', {
      player: ps.username, reason: 'other_provider_consumed',
    });
    engine.sync();
    return;
  }

  // Action 1 resolved + grant alive: park the player in Action Phase
  // (canonical), but ONLY if there's something to spend the bonus
  // on. Otherwise fizzle so the engine's auto-advance fires.
  if (actionsPlayed === 1 && inst.counters?.additionalActionAvail) {
    if (_hasAnyActionCostEffectAvailable(engine, ctx.cardOwner)) {
      gs._preventPhaseAdvance = true;
      return;
    }
    engine.expireAdditionalAction(inst);
    _recomputeOnSteroidsFlag(engine, ctx.cardOwner);
    engine.log('giga_steroids_fizzle', {
      player: ps.username, reason: 'no_action_cost_effects_available',
    });
    engine.sync();
  }
}

module.exports = {
  // See header — both zones cover the inst's hand → discard transit.
  activeIn: ['hand', 'discard'],

  canActivate(/* gs, pi */) {
    // Always activatable — the grant alone is the value, even if the
    // player has nothing to spend it on right now (the 6-gold cost is
    // theirs to evaluate).
    return true;
  },

  cpuMeta: {
    /**
     * Eval bonus for an active Giga Steroids grant — but ONLY when
     * the owner has a non-Spell/Attack/Creature Action lined up to
     * spend it on (Hero effect, Artifact, or Ability costing an
     * Action). Without such an action, the grant sits unused and
     * the 6-Gold + 1-card discard cost is pure waste; the bonus
     * stays at 0 in that case so MCTS won't be lured into playing
     * the artifact for nothing.
     *
     * Gated on `inst.counters.additionalActionAvail` so only the
     * post-resolve state (grant alive) scores the bonus — the
     * hand-side inst before resolve has no grant yet.
     */
    cpuInstBonus(engine, inst, ownerIdx) {
      if (!inst.counters?.additionalActionAvail) return 0;
      const typeId = inst.counters?.additionalActionType;
      if (typeof typeId !== 'string' || !typeId.startsWith(TYPE_ID_PREFIX)) return 0;
      if (!_hasAnyActionCostEffectAvailable(engine, ownerIdx)) return 0;
      return 100;
    },
  },

  async resolve(engine, pi /*, selectedIds, validTargets */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Locate this Giga Steroids' inst. doUseArtifactEffect splices the
    // card from hand AFTER `resolve` returns, so at this point the
    // inst is still tracked at zone='hand'.
    const inst = engine.cardInstances.find(c =>
      c.owner === pi && c.zone === 'hand' && c.name === CARD_NAME,
    );
    if (!inst) return { cancelled: true };

    // Per-instance additional-action provider. Owner-wide
    // (heroRestricted: false), only covers `ability_activation` —
    // which is the category every Action-cost effect activation
    // (Ability / Creature / Hero) consumes. Spell / Attack /
    // Creature plays from hand each have their own categories
    // (`spell`, `attack`, `creature`) and won't match this grant.
    const typeId = `${TYPE_ID_PREFIX}${inst.id}`;
    engine.registerAdditionalActionType(typeId, {
      label:             CARD_NAME,
      allowedCategories: ['ability_activation'],
      heroRestricted:    false,
      isSecondActionGrant: true,
      sourceLabel:       CARD_NAME,
    });
    engine.grantAdditionalAction(inst, typeId);

    // Stamp the player-level "On Steroids" flag — the client reads
    // `me.onSteroids` / `opp.onSteroids` and renders the buff badge
    // in the top-of-board buff/debuff strip. Cleared on consume /
    // fizzle / expire by `_recomputeOnSteroidsFlag` calls below.
    _recomputeOnSteroidsFlag(engine, pi);

    // If the grant lands while the controller is already at action 1
    // of their Action Phase (e.g. Giga Steroids was used in Main
    // Phase 2 BETWEEN the lone Action and the auto-advance), the
    // engine's post-action auto-advance would otherwise kick them out
    // before the bonus is reachable. The shared onActionUsed hook
    // re-asserts this every action 1 for the rest of the phase, but
    // we set it pre-emptively here for the Main-Phase-2 path where
    // the artifact resolves between action 1 and the phase advance.
    if ((ps._actionsPlayedThisPhase || 0) === 1) {
      gs._preventPhaseAdvance = true;
    }

    engine.log('giga_steroids_grant', {
      player: ps.username,
      source: CARD_NAME,
    });
    engine.sync();
    return true;
  },

  hooks: {
    // Spread the shared second-action lifecycle hooks for the
    // mechanics that map cleanly: onAdditionalActionUsed (post-consume
    // cleanup, no-op here because `inst.heroIdx === -1`),
    // onCardLeaveZone (badge cleanup, also no-op for heroIdx -1).
    // `onActionUsed`, `onAnyActionResolved`, and `onPhaseEnd` below
    // override / supplement the shared logic.
    ...secondActionHooks,

    /**
     * Action-resolved fizzle path for Spell / Attack / Creature plays
     * and `actionCost: true` Ability activations. Body is shared with
     * `onAnyActionResolved` (the universal hook); see
     * `_processGrantPostAction` for the full decision tree.
     */
    onActionUsed: _processGrantPostAction,

    /**
     * Universal action-resolved fizzle path. Fires for EVERY action
     * (including Hero-effect activations like Champion's
     * `heroEffectActionCost` route, which DON'T fire `onActionUsed`).
     * Without this hook, activating Champion's effect as Action 1
     * would never trigger the fizzle decision, the grant would stay
     * alive past the auto-advance, and `advanceToPhase`'s internal
     * "any second-action grant alive?" check would refuse to advance
     * — leaving the player stuck in Action Phase. Body is idempotent
     * so non-hero paths (where both `onActionUsed` and
     * `onAnyActionResolved` fire sequentially) work correctly.
     */
    onAnyActionResolved: _processGrantPostAction,

    /**
     * Drain the player-level `onSteroids` flag the moment the grant
     * is consumed by an effect activation. Mirrors the shared
     * onAdditionalActionUsed handler but recomputes the player flag
     * (the shared handler only clears the host-Hero badge, which
     * doesn't exist on this owner-wide grant).
     */
    onAdditionalActionUsed: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      // Defer to the shared cleanup first (badge no-op for heroIdx -1).
      if (typeof secondActionHooks.onAdditionalActionUsed === 'function') {
        await secondActionHooks.onAdditionalActionUsed(ctx);
      }
      if (!isSecondActionGrant(engine, inst)) return;
      // Recompute regardless of whether THIS inst's grant was the
      // one consumed — the shared call above might have expired the
      // grant via `clearBadgeIfNoOtherGrants`-side cleanup.
      _recomputeOnSteroidsFlag(engine, inst.owner);
    },

    /**
     * Override the shared onPhaseEnd to also expire the grant at
     * turn-end (phase 5), not just Action-Phase end (phase 3). The
     * shared handler covers the canonical case (artifact played in
     * Main Phase 1 → grant lives through Action Phase → expires when
     * Action Phase ends). But if the artifact is played in Main
     * Phase 2 (after Action Phase already passed for the turn), the
     * shared phase-3 handler never fires, and the inst's
     * `additionalActionAvail` counter would otherwise carry into the
     * next turn — making the grant claimable on the wrong turn's
     * action 2. Adding phase 5 as a fallback expire-trigger fixes
     * that without affecting the canonical Action-Phase path.
     */
    onPhaseEnd: async (ctx) => {
      if (ctx.phaseIndex !== 3 && ctx.phaseIndex !== 5) return;
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!isSecondActionGrant(engine, inst)) return;
      if (inst.counters?.additionalActionAvail) {
        engine.expireAdditionalAction(inst);
      }
      _recomputeOnSteroidsFlag(engine, inst.owner);
      engine.sync();
    },
  },
};
