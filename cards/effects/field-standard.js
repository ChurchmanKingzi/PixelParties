// ═══════════════════════════════════════════
//  CARD EFFECT: "Field Standard"
//  Artifact (Normal, Cost 10) — Banned base
//
//  Choose a level 3 or lower Creature you control
//  that already used its active effect this turn
//  and immediately use that effect an additional
//  time. You can only play 1 'Field Standard' per
//  turn.
//
//  Implementation
//  ──────────────
//  • Targeting Artifact — `getValidTargets` builds
//    the set of own Lv≤3 Creatures whose per-inst
//    HOPT `creature-effect:${inst.id}` is stamped
//    for this turn. That stamp is the engine's
//    canonical "this Creature already activated
//    its effect this turn" marker (see
//    `_engine.js` ~L17128 and `server.js`'s
//    `doActivateCreatureEffect`).
//  • Re-fires via `script.onCreatureEffect(ctx)`
//    using `engine._createContext(inst, {})`. We
//    do NOT touch the Creature's HOPT — text says
//    "use that effect an additional time", not
//    "reset its once-per-turn slot". The fresh
//    fire ignores any internal cancel-on-HOPT
//    guard because `onCreatureEffect` itself does
//    not re-check HOPT (the engine pre-checks via
//    `canActivateCreatureEffect`).
//  • Once-per-turn-by-name HOPT keyed on
//    `field-standard:${pi}` — checked in
//    `canActivate` so the play is rejected at
//    the doUseArtifactEffect gate before any
//    targeting UI opens. (There is no
//    artifact-specific `*PlayCondition` hook in
//    the engine the way Spells have
//    `spellPlayCondition`; canActivate is the
//    canonical play-time gate for Artifacts.)
//  • Does NOT stamp `ps._artifactLockTurn` —
//    text limits the card to "1 per turn" but
//    doesn't lock the Artifact slot for the rest
//    of the turn (the player can still play
//    other Artifacts).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Field Standard';
const HOPT_KEY_PREFIX = 'field-standard';
const MAX_LEVEL = 3;

function _hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY_PREFIX}:${pi}`] === gs.turn;
}
function _stampHopt(gs, pi) {
  if (!gs.hoptUsed) gs.hoptUsed = {};
  gs.hoptUsed[`${HOPT_KEY_PREFIX}:${pi}`] = gs.turn;
}

/**
 * Is this Creature instance an eligible Field Standard target?
 *   • Controlled by `pi` (own side, including stolen-by us).
 *   • Face-up Creature card-type, level ≤ 3.
 *   • Has used its active effect this turn — i.e. the engine's
 *     per-inst creature-effect HOPT is stamped for the current turn.
 *   • Host hero is alive (a Creature on a dead Hero stays on the
 *     board but its effect activation gates require a live host).
 */
function _isEligible(engine, inst, pi) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if ((inst.controller ?? inst.owner) !== pi) return false;

  const cardDB = engine._getCardDB();
  const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
  if (!cd || !hasCardType(cd, 'Creature')) return false;
  if ((cd.level ?? 99) > MAX_LEVEL) return false;

  const effectName = inst.counters?._effectOverride || inst.name;
  const script = loadCardEffect(effectName);
  if (!script?.onCreatureEffect) return false;

  const host = engine.gs.players[pi]?.heroes?.[inst.heroIdx];
  if (!host?.name || host.hp <= 0) return false;

  const hoptKey = `creature-effect:${inst.id}`;
  return engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn;
}

module.exports = {
  /**
   * Deferred commitment: don't broadcast the card-reveal stream or
   * stamp the once-per-turn HOPT until the picked Creature's effect
   * ACTUALLY commits. `doConfirmPotion` honours this flag by
   * stashing the reveal/log on `gs._pendingCardReveal` /
   * `gs._pendingPlayLog` so the first prompt resolution inside the
   * re-fired Creature's effect drains them at the real commitment
   * moment — or our fallback fire below if the effect commits
   * without any prompts. If the re-fired Creature's effect aborts
   * (returns false), we return `{ cancelled: true }` from `resolve`;
   * `doConfirmPotion`'s cancel branch then refunds gold, clears the
   * pending stash, and leaves Field Standard untouched in hand.
   */
  deferReveal: true,

  /**
   * Suppress the default `potion_resolved` explosion that
   * `doConfirmPotion` would otherwise fire on the picked Creature
   * BEFORE `resolve` runs. Field Standard's own visual (the
   * `field_standard_rally` zone-anim broadcast inside `resolve`)
   * fires only at the post-commit moment, so a player who
   * repeatedly targets a Creature and then aborts inside its
   * re-fired effect never spawns any animation at all.
   */
  animationType: 'none',

  /**
   * Play-time gate. Rejects the click before any targeting UI opens
   * when (a) the once-per-turn-by-name HOPT is already claimed, or
   * (b) there's no eligible Creature on the controller's side. The
   * server passes `engine` as the 3rd arg (see `doUseArtifactEffect`
   * in `server.js`); without it we can't walk `cardInstances`, so
   * fall back to rejecting the play.
   */
  canActivate(gs, pi, engine) {
    if (_hoptUsed(gs, pi)) return false;
    if (!engine) return false;
    for (const inst of engine.cardInstances) {
      if (_isEligible(engine, inst, pi)) return true;
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const out = [];
    if (!engine) return out;
    for (const inst of engine.cardInstances) {
      if (!_isEligible(engine, inst, pi)) continue;
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, cardInstance: inst,
        ownSupport: true,
      });
    }
    return out;
  },

  targetingConfig: {
    description: 'Choose a Lv≤3 Creature you control that already used its active effect this turn. That effect resolves again.',
    confirmLabel: '🚩 Rally!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: false,
    maxPerType: { equip: 1 },
  },

  validateSelection(selectedIds /*, validTargets */) {
    return Array.isArray(selectedIds) && selectedIds.length === 1;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target?.cardInstance) return { cancelled: true };

    const inst = target.cardInstance;
    // Defensive re-check — the eligibility filter ran at play-time;
    // an interleaved effect could in theory have moved/destroyed/HOPT-
    // reset the creature between picker render and pick. Re-validate
    // before committing.
    if (!_isEligible(engine, inst, pi)) return { cancelled: true };

    const effectName = inst.counters?._effectOverride || inst.name;
    const script = loadCardEffect(effectName);
    if (!script?.onCreatureEffect) return { cancelled: true };

    // Stash Field Standard's pending card-reveal + play-log OFF-SIDE
    // before re-firing the Creature. `doConfirmPotion` set both
    // (see `deferReveal: true`) — without this stash, the Creature's
    // first internal prompt would drain them mid-effect and reveal
    // Field Standard to opp BEFORE the effect has actually committed
    // (e.g., if the Creature's later prompt cancels). Holding the
    // stash off-side defers reveal to the post-commit moment below.
    // Same pattern as SnowItAll's two-step picker — see
    // `mischief-militia-snowitall.js`.
    const savedReveal = engine.gs._pendingCardReveal;
    delete engine.gs._pendingCardReveal;
    const savedPlayLog = engine.gs._pendingPlayLog;
    delete engine.gs._pendingPlayLog;

    // Re-fire the creature's onCreatureEffect with a fresh context
    // anchored on the creature inst (not the Artifact). The
    // Creature's per-inst HOPT stays stamped — Field Standard does
    // not reset it (text: "use that effect an additional time", not
    // "reset the once-per-turn slot").
    const ctx = engine._createContext(inst, {});
    let resolved;
    try {
      resolved = await script.onCreatureEffect(ctx);
    } catch (err) {
      console.error(`[Field Standard] re-fire of "${inst.name}" threw:`, err.message);
      resolved = false;
    }

    // If the re-fired Creature effect aborted (returned false — same
    // contract `doActivateCreatureEffect` uses for own cancellation),
    // bail without consuming Field Standard. `doConfirmPotion`'s
    // cancelled branch will refund gold, leave the card in hand,
    // and clear the (now-empty) pending stash slots. The off-side
    // saved values are simply discarded.
    if (resolved === false) return { cancelled: true };

    // Commitment moment. Stamp the once-per-turn-by-name HOPT now.
    // Restore + fire the stashed pending reveal/log so opp sees the
    // Field Standard banner and the action-log entry appears at the
    // actual commitment instant.
    _stampHopt(engine.gs, pi);
    if (savedReveal) engine.gs._pendingCardReveal = savedReveal;
    if (savedPlayLog) engine.gs._pendingPlayLog = savedPlayLog;
    engine._firePendingCardReveal();

    // Brief "rallying flag" zone animation on the chosen Creature so
    // the re-fire moment is visible to both players. No client-side
    // handler is required — unknown anim types render silently.
    engine._broadcastEvent('play_zone_animation', {
      type: 'field_standard_rally',
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    engine.log('field_standard_refire', {
      player: engine.gs.players[pi]?.username,
      creature: inst.name,
    });

    engine.sync();
    return true;
  },
};
