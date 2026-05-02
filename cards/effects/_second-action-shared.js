// ═══════════════════════════════════════════
//  SHARED HANDLER: "Second Action" grants
// ═══════════════════════════════════════════
//
//  Used by cards that grant a hero-restricted
//  second Action during the Action Phase
//  (Soul Shard Ba and any future similar card).
//  Encapsulates:
//
//    1. ONSET — hero-restricted additional-
//       action type registration, grant on the
//       granting card's inst, host-Hero badge,
//       optional animation, and a pre-emptive
//       `_preventPhaseAdvance` if the grant
//       lands while we're already at action 1.
//
//    2. PHASE-ADVANCE GATE — `onActionUsed`
//       re-asserts `_preventPhaseAdvance` after
//       action 1 if the grant is still alive,
//       so the engine doesn't kick the player
//       out of Action Phase before the bonus
//       is reachable.
//
//    3. FIZZLE — the player's "second action"
//       slot is universally consumed when
//       `_actionsPlayedThisPhase` reaches 2,
//       regardless of which provider the
//       second action picked (Torchure /
//       Claussss / etc.). Any second-action
//       grant whose `additionalActionAvail` is
//       still alive at that point is wasted —
//       multiple concurrent grants all fizzle
//       together. Mirrors the Claussss /
//       Torchure / Reiza convention.
//
//    4. CLEANUP — `onPhaseEnd` for Action
//       Phase, `onAdditionalActionUsed` (after
//       a consume that drops avail to 0), and
//       `onCardLeaveZone` (self) all clear the
//       host Hero's badge — but ONLY when no
//       OTHER active second-action grant
//       remains for that Hero (so two
//       overlapping grants on the same Hero
//       keep the badge while either is alive).
//
//  USAGE
//  -----
//    const { secondActionGrant, secondActionHooks }
//      = require('./_second-action-shared');
//
//    module.exports = {
//      ...,
//      hooks: {
//        onPlay: async (ctx) => {
//          // per-card gates / setup ...
//          if (!ctx._summonedFromDiscard) return;
//          await secondActionGrant(ctx, {
//            sourceLabel: CARD_NAME,
//            animationType: 'soul_shard_dark_grant',
//          });
//        },
//        ...secondActionHooks,
//      },
//    };
//
//  The card may add per-card hooks alongside
//  `secondActionHooks` — JS object spread keeps
//  the latter's onPlay slot empty, so the
//  card's onPlay runs as written.
// ═══════════════════════════════════════════

const SECOND_ACTION_BUFF_KEY = 'second_action_grant';
const SECOND_ACTION_TYPE_PREFIX = 'second_action:';

/**
 * True iff `inst.counters.additionalActionType` resolves to a registered
 * additional-action config flagged `isSecondActionGrant: true`.
 */
function isSecondActionGrant(engine, inst) {
  const typeId = inst?.counters?.additionalActionType;
  if (!typeId) return false;
  const config = engine?._additionalActionTypes?.[typeId];
  return !!config?.isSecondActionGrant;
}

/**
 * Walk all card instances; return true if any inst (other than
 * `excludeInstId`) belonging to `playerIdx` and hosted on `heroIdx` still
 * carries an active second-action grant. Used to decide whether the
 * host Hero's buff badge can be torn down (only when ALL grants for that
 * Hero are gone).
 */
function heroHasOtherActiveSecondActionGrant(engine, playerIdx, heroIdx, excludeInstId) {
  if (playerIdx == null || playerIdx < 0) return false;
  for (const inst of engine.cardInstances) {
    if (inst.owner !== playerIdx) continue;
    if (inst.heroIdx !== heroIdx) continue;
    if (excludeInstId != null && inst.id === excludeInstId) continue;
    if (!inst.counters?.additionalActionAvail) continue;
    if (!isSecondActionGrant(engine, inst)) continue;
    return true;
  }
  return false;
}

/**
 * Remove the host Hero's `second_action_grant` badge — but only if no
 * other active second-action grant is still hosted on this Hero. Pass
 * `excludeInstId` for the card whose grant was just expired/leaving so
 * its OWN (still-tracked) grant doesn't keep the badge alive.
 */
function clearBadgeIfNoOtherGrants(engine, playerIdx, heroIdx, excludeInstId) {
  const ps = engine.gs.players[playerIdx];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.buffs?.[SECOND_ACTION_BUFF_KEY]) return;
  if (heroHasOtherActiveSecondActionGrant(engine, playerIdx, heroIdx, excludeInstId)) return;
  delete hero.buffs[SECOND_ACTION_BUFF_KEY];
}

/**
 * Stamp a hero-restricted "second action" grant on `ctx.card`.
 *
 * @param {object} ctx     - Hook context (card, cardOwner, cardHeroIdx, cardHeroOwner, _engine).
 * @param {object} opts
 *   sourceLabel:           Card display name (logged + can be surfaced
 *                          on the additional-action label).
 *   animationType:         Optional animation key broadcast on the host
 *                          Hero zone (`zoneSlot: -1`). Skipped if absent.
 *   allowedCategories:     Optional override of the action-category list
 *                          the grant covers. Defaults to all standard
 *                          play categories.
 */
async function secondActionGrant(ctx, opts = {}) {
  const { sourceLabel, animationType, allowedCategories } = opts;
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;
  if (!inst) return false;
  const pi = ctx.cardOwner;
  const ps = gs.players[pi];
  if (!ps) return false;
  const heroIdx = ctx.cardHeroIdx;
  const hostHero = ps.heroes?.[heroIdx];
  if (!hostHero?.name) return false;

  // Per-instance type id keeps multiple concurrent grants independent —
  // each card's grant is its own provider entry in `cardInstances`, with
  // its own `additionalActionAvail` counter.
  const typeId = `${SECOND_ACTION_TYPE_PREFIX}${inst.id}`;
  engine.registerAdditionalActionType(typeId, {
    label: hostHero.name,
    allowedCategories: allowedCategories
      || ['creature', 'spell', 'attack', 'ability_activation', 'hero_effect_activation'],
    heroRestricted: true,
    isSecondActionGrant: true,
    sourceLabel: sourceLabel || inst.name,
  });
  engine.grantAdditionalAction(inst, typeId);

  hostHero.buffs = hostHero.buffs || {};
  hostHero.buffs[SECOND_ACTION_BUFF_KEY] = { appliedTurn: gs.turn };

  if (animationType) {
    engine._broadcastEvent('play_zone_animation', {
      type: animationType,
      owner: ctx.cardHeroOwner,
      heroIdx, zoneSlot: -1,
    });
  }

  // If the grant lands while the player is already at action 1 of the
  // Action Phase (e.g. the granting card was activated as a free
  // ability mid-phase), the engine's post-action auto-advance check
  // would otherwise kick them out before the bonus is reachable. The
  // shared `onActionUsed` hook below re-asserts this every action 1
  // for the rest of the phase.
  if ((ps._actionsPlayedThisPhase || 0) === 1) {
    gs._preventPhaseAdvance = true;
  }

  engine.log('second_action_granted', {
    player: ps.username,
    source: sourceLabel || inst.name,
    hero: hostHero.name,
    heroIdx,
  });
  engine.sync();
  return true;
}

/**
 * Hooks object handling the entire lifecycle of a second-action grant.
 * Cards spread this into their own `hooks`. Each handler early-returns
 * for any card instance whose grant isn't flagged
 * `isSecondActionGrant: true`, so cards that DON'T grant a second
 * action are unaffected even if they share the spread pattern (the
 * `additionalActionType` namespace is broader than just second-action
 * grants).
 */
const secondActionHooks = {
  onActionUsed: async (ctx) => {
    if (ctx.playerIdx !== ctx.cardOwner) return;
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!isSecondActionGrant(engine, inst)) return;
    const gs = engine.gs;
    const ps = gs.players[ctx.cardOwner];
    if (!ps) return;
    const actionsPlayed = ps._actionsPlayedThisPhase || 0;

    // Action 1 just resolved + grant alive → keep the player in Action
    // Phase so the bonus second action stays reachable.
    if (actionsPlayed === 1 && inst.counters?.additionalActionAvail) {
      gs._preventPhaseAdvance = true;
      return;
    }

    // Action 2+ resolved with the grant still unconsumed → the
    // player's single second-action slot was spent on a different
    // path (different Hero / different provider). Fizzle.
    if (actionsPlayed >= 2 && inst.counters?.additionalActionAvail) {
      const config = engine._additionalActionTypes?.[inst.counters?.additionalActionType];
      engine.expireAdditionalAction(inst);
      clearBadgeIfNoOtherGrants(engine, ctx.cardOwner, inst.heroIdx);
      engine.log('second_action_fizzle', {
        player: ps.username,
        source: config?.sourceLabel || inst.name,
        hero: ps.heroes?.[inst.heroIdx]?.name,
      });
      engine.sync();
    }
  },

  onAdditionalActionUsed: async (ctx) => {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!isSecondActionGrant(engine, inst)) return;
    if (inst.counters?.additionalActionAvail) return; // not yet drained
    clearBadgeIfNoOtherGrants(engine, inst.owner, inst.heroIdx);
    engine.sync();
  },

  onPhaseEnd: async (ctx) => {
    if (ctx.phaseIndex !== 3) return; // PHASES.ACTION
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!isSecondActionGrant(engine, inst)) return;
    if (inst.counters?.additionalActionAvail) {
      engine.expireAdditionalAction(inst);
    }
    clearBadgeIfNoOtherGrants(engine, inst.owner, inst.heroIdx);
    engine.sync();
  },

  onCardLeaveZone: async (ctx) => {
    if (ctx.leavingCard?.id !== ctx.card.id) return;
    const engine = ctx._engine;
    if (!isSecondActionGrant(engine, ctx.card)) return;
    // Exclude self from the "any other grant?" check — Ba is leaving,
    // its own grant doesn't count toward keeping the badge alive.
    clearBadgeIfNoOtherGrants(engine, ctx.card.owner, ctx.card.heroIdx, ctx.card.id);
    engine.sync();
  },
};

module.exports = {
  secondActionGrant,
  secondActionHooks,
  isSecondActionGrant,
  SECOND_ACTION_BUFF_KEY,
};
