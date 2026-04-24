// ═══════════════════════════════════════════
//  SHARED: Arrow archetype helpers
//
//  All "Arrow" Reaction Artifacts chain onto an
//  Attack performed by a Hero the Arrow's
//  controller owns, modify the Attack (damage +
//  post-hit rider like Burn / Poison / gold
//  gain / draw), and then self-discard. Their
//  trigger is identical; they differ only in
//  the modifier they arm the attacker with.
//
//  The shared mechanics:
//
//    1. `arrowTriggerCondition(gs, pi, engine,
//        chainCtx, opts)` — used by every Arrow's
//       `reactionCondition`. Gates on: the chain
//       is initiated by an Attack card OWNED by
//       `pi` (the Arrow's controller), whose
//       casting Hero is still alive. `opts.
//       requireSingleTarget` is accepted for
//       Golden Arrow's extra gate (always-true
//       in the current engine — every Attack
//       card resolves via a single promptDamage
//       Target call — but the gate stays in
//       place for future multi-target Attacks).
//
//    2. `armAttackerWithArrow(engine, pi,
//        modifier)` — called from an Arrow's
//       `resolve`. Looks up the attacker Hero
//       from the initial chain link's
//       `casterHeroIdx` and pushes a modifier
//       descriptor onto `hero._armedArrows`.
//       The array stays alive across every
//       `beforeDamage` / `afterDamage` fire of
//       the triggering Attack (covers multi-
//       target attacks correctly — every target
//       hit shares the armed mods) and is
//       cleared exactly once at Attack
//       resolution-end by `clearArmedArrows`.
//
//    3. `applyArrowsBeforeDamage(engine, source,
//        target, hookCtx)` — invoked from
//       `_actionDealDamageImpl` right after the
//       `beforeDamage` hook. Applies:
//         • flat damage bumps (sum).
//         • hard-zero from any arrow carrying
//           `setAmount0: true` — wins over any
//           flat bump, matching card text
//           ("Reduce that Attack's damage to
//           0").
//         • stashes `preZeroDamage` on the
//           arrow mod so `afterDamage` can
//           compute poison-stacks-from-would-
//           have-damage for Hydra Blood.
//
//    4. `applyArrowsAfterDamage(engine, source,
//        target, dealt, origAmount, type)` —
//       invoked from `_actionDealDamageImpl`
//       after the `afterDamage` hook. Applies
//       per-target post-hit riders: Burn,
//       Poison (fresh stacks), hero-specific
//       gold gain + gold-lock. Does NOT pop
//       mods — they stay armed for any
//       remaining targets in the same AoE
//       Attack.
//
//    5. `clearArmedArrows(pi, engine)` — called
//       by server.js after the triggering
//       Attack's `afterSpellResolved` hook and
//       on the negate-branch. Walks every Hero
//       on `pi`'s side and deletes
//       `_armedArrows`. Idempotent — safe to
//       call even when no arrows are armed.
//
//  Hydra Blood specifically uses `setAmount0:
//  true` + `poisonStacksPer: 30` (the stack
//  count for each target is `floor(would-have-
//  damage / 30)`). Poisoned / Flame Arrow use
//  `applyPoison1` / `applyBurn`. Golden Arrow
//  uses `goldRatio: 10` and `goldLockAfter:
//  true`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Reaction gate for every Arrow. Returns true iff:
 *   • A reaction chain is in progress
 *   • The chain's INITIAL link is an Attack card
 *   • That Attack's owner is `pi` (Arrow is chained onto an ally
 *     Attack, not the opponent's)
 *   • The casting Hero is still alive
 *
 * @param {object}  gs
 * @param {number}  pi
 * @param {object}  engine
 * @param {object}  chainCtx - { chain, eventDesc, ... }
 * @param {object}  [opts]
 * @param {boolean} [opts.requireSingleTarget] - Golden Arrow only. Currently
 *   a no-op because every PP Attack resolves with a single promptDamageTarget
 *   call, but the hook is in place for when multi-target Attacks ship.
 */
function arrowTriggerCondition(gs, pi, engine, chainCtx, _opts = {}) {
  if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
  const initial = chainCtx.chain.find(l => l.isInitialCard);
  if (!initial) return false;
  if (initial.cardType !== 'Attack') return false;
  if (initial.owner !== pi) return false;

  // Caster hero must exist and be alive. The INITIAL link uses `heroIdx`
  // (executeCardWithChain, see _engine.js:9042); the `casterHeroIdx`
  // field only shows up on REACTION links (_engine.js:9240). Accept
  // both so the gate is resilient to future field-name tweaks.
  const hiIdx = initial.heroIdx ?? initial.casterHeroIdx;
  if (hiIdx == null || hiIdx < 0) return false;
  const hero = gs.players[pi]?.heroes?.[hiIdx];
  if (!hero?.name || hero.hp <= 0) return false;

  // Future multi-target gate for Golden Arrow. Left intentionally true —
  // see header comment.
  // if (_opts.requireSingleTarget && attackIsMultiTarget(initial)) return false;

  return true;
}

/**
 * Register an arrow activation for `pi`'s triggering Attack. Called from
 * every Arrow's `resolve`. Two jobs:
 *   1. If `modifier` is supplied, push it onto the attacking Hero's
 *      `_armedArrows` list — the engine's damage-impl picks that up at
 *      `beforeDamage` / `afterDamage` time.
 *   2. Recompute and stash `hero._arrowsChainedCount` — the number of
 *      `isArrow`-tagged links in the reaction chain so far (Darge reads
 *      this at damage time; the chain itself is a local variable inside
 *      `_runReactionWindow` and is gone by the time the Attack resolves).
 *
 * The chain MUST be passed in — the reaction chain isn't stored on the
 * engine (it's a local inside `_runReactionWindow`), so helpers that
 * looked at `engine.chain` were reading the legacy-chain system and
 * always returning null. Arrow `resolve` signatures take `(engine, pi,
 * _sel, _val, chain, _idx)` from the reaction-runner wrapper, so
 * passing `chain` through is straightforward.
 *
 * Modifier fields supported (all optional):
 *   flatDamage    : number       — summed into hookCtx.amount
 *   setAmount0    : boolean      — forces hookCtx.amount = 0 (Hydra Blood)
 *   applyBurn     : boolean      — per-target burn at afterDamage
 *   applyPoison1  : boolean      — per-target 1-stack poison
 *   poisonStacksPer: number      — per-target floor(preZero / n) stacks
 *   goldRatio     : number       — per-target floor(dealt / n) gold to pi
 *   goldLockAfter : boolean      — set ps.goldLocked after first gain
 *   sourceCard    : string       — log label
 */
function armAttackerWithArrow(engine, pi, chain, modifier) {
  const hero = _findAttackerHero(engine, pi, chain);
  if (!hero) return false;
  if (modifier) {
    if (!Array.isArray(hero._armedArrows)) hero._armedArrows = [];
    hero._armedArrows.push({ ...modifier });
  }
  hero._arrowsChainedCount = _countArrowLinks(chain);
  return true;
}

/**
 * For arrows that don't arm any damage/rider modifier (currently only
 * Racket Arrow — it bounces a creature at reaction time and leaves the
 * attack untouched). Still updates Darge's arrow count so the bonus
 * reflects that the arrow was played.
 */
function noteArrowActivated(engine, pi, chain) {
  return armAttackerWithArrow(engine, pi, chain, null);
}

function _findAttackerHero(engine, pi, chain) {
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const initial = chain.find(l => l.isInitialCard && l.cardType === 'Attack');
  if (!initial) return null;
  if (initial.owner !== pi) return null;
  const hiIdx = initial.heroIdx ?? initial.casterHeroIdx;
  if (hiIdx == null || hiIdx < 0) return null;
  const hero = engine.gs.players[pi]?.heroes?.[hiIdx];
  return hero?.name ? hero : null;
}

function _countArrowLinks(chain) {
  const { loadCardEffect } = require('./_loader');
  if (!Array.isArray(chain)) return 0;
  let n = 0;
  for (const link of chain) {
    if (link.isInitialCard) continue;
    if (link.negated) continue; // A negated arrow wasn't "played" in the effect sense.
    const script = loadCardEffect(link.cardName);
    if (script?.isArrow) n++;
  }
  return n;
}

/**
 * Apply armed-arrow damage modifiers. Runs immediately after the
 * `beforeDamage` hook. Mutates `hookCtx.amount`.
 *
 * Sum-then-zero ordering so Hydra Blood's zero wins absolutely:
 *   1. Add every arrow's `flatDamage` into a running total.
 *   2. If ANY arrow requested `setAmount0`, the result is 0.
 *
 * Stashes `_preZeroDamage = amount-after-flat-bumps` on each arrow so
 * Hydra Blood's poison-stacks-per-30-would-have-damage computation has
 * the pre-zero value available at `afterDamage` time.
 */
function applyArrowsBeforeDamage(engine, source, target, hookCtx) {
  if (!source) return;
  const hero = heroFromSource(engine, source);
  if (!hero?._armedArrows?.length) return;
  if (hookCtx.type !== 'attack') return; // Arrows only care about attack damage.

  let flat = 0;
  let zero = false;
  for (const arrow of hero._armedArrows) {
    if (typeof arrow.flatDamage === 'number') flat += arrow.flatDamage;
    if (arrow.setAmount0) zero = true;
  }

  if (flat) hookCtx.amount = Math.max(0, hookCtx.amount + flat);
  const preZero = hookCtx.amount + (hookCtx._flatBonus || 0);
  if (zero) {
    hookCtx.amount = 0;
    // Hydra Blood's "reduce damage to 0" is absolute — it takes
    // everything, including any multiplier-immune flat bonuses that
    // Darge or future cards stamped on the hookCtx before this arrow
    // pass ran. The card-text exception for Darge is "unaffected by
    // effects that double damage" — multipliers, not zeroing.
    hookCtx._flatBonus = 0;
  }

  // Stash the PRE-ZERO total (flat-bumps + any _flatBonus already
  // written) on every arrow so Hydra Blood's poison-stacks-per-30-
  // would-have-damage computation uses the full amount the Attack
  // would have dealt had it not been zeroed.
  for (const arrow of hero._armedArrows) arrow._preZeroDamage = preZero;
}

/**
 * Post-hit effects. Runs after the `afterDamage` hook. `dealt` is the
 * ACTUAL HP drop (can be 0 for Hydra Blood's zero-damage branch); the
 * original pre-zero amount is in `arrow._preZeroDamage`.
 *
 * Runs every arrow's rider against THIS target. Does NOT pop the
 * arrows — they persist for every subsequent target hit by the same
 * Attack (any future multi-target attacks). `clearArmedArrows` does
 * the cleanup after the Attack fully resolves.
 */
async function applyArrowsAfterDamage(engine, source, target, dealt, _origAmount, type) {
  if (type !== 'attack') return;
  if (!source || !target) return;
  const hero = heroFromSource(engine, source);
  if (!hero?._armedArrows?.length) return;
  const pi = source.owner ?? source.controller ?? -1;
  if (pi < 0) return;
  const ps = engine.gs.players[pi];

  // Resolve target location for status / poison / gold logging.
  const targetLoc = resolveTargetLocation(engine, target);
  if (!targetLoc) return;

  for (const arrow of hero._armedArrows) {
    // Burn rider (Flame Arrow).
    if (arrow.applyBurn) {
      await applyBurnToTarget(engine, pi, targetLoc, arrow.sourceCard || 'Arrow');
    }
    // 1-stack poison (Poisoned Arrow).
    if (arrow.applyPoison1) {
      await applyPoisonStacksToTarget(engine, pi, targetLoc, 1, arrow.sourceCard || 'Arrow');
    }
    // Would-have-damage-based poison (Hydra Blood Arrow). Uses the
    // pre-zero amount so the stacks are computed against what the
    // Attack WOULD have dealt before Hydra Blood zeroed it.
    if (typeof arrow.poisonStacksPer === 'number' && arrow.poisonStacksPer > 0) {
      const basis = arrow._preZeroDamage || 0;
      const stacks = Math.floor(basis / arrow.poisonStacksPer);
      if (stacks > 0) {
        await applyPoisonStacksToTarget(engine, pi, targetLoc, stacks, arrow.sourceCard || 'Arrow');
      }
    }
    // Gold gain per N damage dealt (Golden Arrow).
    if (typeof arrow.goldRatio === 'number' && arrow.goldRatio > 0 && dealt > 0) {
      const gold = Math.floor(dealt / arrow.goldRatio);
      if (gold > 0 && ps && !ps.goldLocked) {
        await engine.actionGainGold(pi, gold);
        engine.log('arrow_gold_gain', {
          player: ps.username, gold, source: arrow.sourceCard || 'Arrow',
        });
      }
      if (arrow.goldLockAfter && ps) {
        ps.goldLocked = true;
        engine.log('gold_locked', {
          player: ps.username, by: arrow.sourceCard || 'Golden Arrow',
        });
      }
    }
  }
}

/**
 * Drop every armed arrow AND the Darge arrow-count stash from every
 * Hero of `pi`. Called after the triggering Attack's
 * `afterSpellResolved` hook and on negation.
 */
function clearArmedArrows(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return;
  for (const hero of (ps.heroes || [])) {
    if (!hero) continue;
    if (hero._armedArrows) delete hero._armedArrows;
    if (hero._arrowsChainedCount != null) delete hero._arrowsChainedCount;
  }
}

// ───────────── internals ─────────────

/** Resolve the Hero object from an attack damage source. */
function heroFromSource(engine, source) {
  const pi = source.owner ?? source.controller ?? -1;
  const hi = source.heroIdx ?? -1;
  if (pi < 0 || hi < 0) return null;
  return engine.gs.players[pi]?.heroes?.[hi] || null;
}

/** Collapse a damage-target (hero object OR creature instance) into a
 *  { kind, owner, heroIdx, slotIdx?, inst? } descriptor. */
function resolveTargetLocation(engine, target) {
  // Hero
  for (let p = 0; p < 2; p++) {
    const ps = engine.gs.players[p];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (ps.heroes[hi] === target) return { kind: 'hero', owner: p, heroIdx: hi };
    }
  }
  // Creature — target IS a CardInstance
  if (target?.zone === 'support' && typeof target.id === 'string') {
    return { kind: 'creature', owner: target.owner, heroIdx: target.heroIdx, slotIdx: target.zoneSlot, inst: target };
  }
  return null;
}

async function applyBurnToTarget(engine, pi, loc, sourceLabel) {
  if (loc.kind === 'hero') {
    await engine.addHeroStatus(loc.owner, loc.heroIdx, 'burned', {
      appliedBy: pi, _skipReactionCheck: true,
    });
  } else if (loc.kind === 'creature' && loc.inst) {
    if (engine.canApplyCreatureStatus(loc.inst, 'burned') && !loc.inst.counters?.burned) {
      loc.inst.counters = loc.inst.counters || {};
      loc.inst.counters.burned = true;
      engine.log('creature_burned', { card: loc.inst.name, owner: loc.inst.owner, by: sourceLabel });
    }
  }
}

async function applyPoisonStacksToTarget(engine, pi, loc, stacks, sourceLabel) {
  if (stacks <= 0) return;
  if (loc.kind === 'hero') {
    await engine.addHeroStatus(loc.owner, loc.heroIdx, 'poisoned', {
      addStacks: stacks, appliedBy: pi, _skipReactionCheck: true,
    });
  } else if (loc.kind === 'creature' && loc.inst) {
    if (engine.canApplyCreatureStatus(loc.inst, 'poisoned')) {
      loc.inst.counters = loc.inst.counters || {};
      const cur = loc.inst.counters.poisoned || 0;
      loc.inst.counters.poisoned = cur + stacks;
      engine.log('creature_poisoned', {
        card: loc.inst.name, owner: loc.inst.owner, stacks, total: loc.inst.counters.poisoned, by: sourceLabel,
      });
    }
  }
}

/**
 * Find the most recent Arrow chain link owned by `pi` that hasn't been
 * flagged as already-retriggered by an Arrow Slit. Used by Arrow Slit
 * to pick WHICH Arrow to re-activate.
 *
 * Pass `stopIdx` (Slit's own chain index) at resolve time so the scan
 * runs backwards from just BEFORE Slit — matching the card text's
 * "when you activate an Arrow Artifact". Without the stop index, an
 * Arrow chained ON TOP of Slit in the build phase would be picked
 * first because LIFO resolution processes higher indices first (and
 * they'd already be in the chain array at resolve time).
 *
 * At reactionCondition time the Slit isn't in the chain yet, so callers
 * pass no stopIdx and the scan simply goes from the end — which is
 * identically "the last arrow played so far". We tag the chosen link
 * with `_retriggeredByArrowSlit` so a subsequent Slit finds a
 * DIFFERENT arrow (multi-Slit stacking).
 */
function pickLastUntriggeredArrowLink(pi, chain, stopIdx = null) {
  const { loadCardEffect } = require('./_loader');
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const start = (typeof stopIdx === 'number' && stopIdx >= 0)
    ? stopIdx - 1
    : chain.length - 1;
  for (let i = start; i >= 0; i--) {
    const link = chain[i];
    if (link.isInitialCard) continue;
    if (link.owner !== pi) continue;
    if (link._retriggeredByArrowSlit) continue;
    const script = loadCardEffect(link.cardName);
    if (script?.isArrow) return link;
  }
  return null;
}

module.exports = {
  arrowTriggerCondition,
  armAttackerWithArrow,
  noteArrowActivated,
  applyArrowsBeforeDamage,
  applyArrowsAfterDamage,
  clearArmedArrows,
  pickLastUntriggeredArrowLink,
};
