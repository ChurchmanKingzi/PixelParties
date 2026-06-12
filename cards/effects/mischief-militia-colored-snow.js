// ═══════════════════════════════════════════
//  CARD EFFECT: "Mischief Militia - Colored Snow"
//  Creature — Summoning Magic Lv1, 50 HP
//
//  Once per turn (PER INSTANCE — multiple
//  Colored Snows each get one trigger), when an
//  OPPONENT target is Frozen, you may immediately
//  resolve the top card of your Potion Deck as
//  if you played it from your hand.
//
//  Whiff semantics — per user spec: the Potion
//  is always revealed to the opponent. If it has
//  no valid targets (or no `canActivate`-eligible
//  state), the Potion fizzles to the DELETED
//  pile and Colored Snow's once-per-turn slot is
//  still consumed. A successful resolution
//  routes the Potion to its normal post-resolve
//  destination (deleted via `afterPotionUsed`).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Mischief Militia - Colored Snow';

/**
 * Soft once-per-turn per Colored Snow instance.
 */
function _isExhausted(inst, turn) {
  return inst.counters?._coloredSnowUsedTurn === turn;
}
function _markUsed(inst, turn) {
  inst.counters._coloredSnowUsedTurn = turn;
}

/**
 * Resolve the top of the controller's Potion Deck "as if played from
 * hand". Returns `'success'` (resolve ran), `'fizzle'` (no targets or
 * canActivate denied), or `'no-potion'` (empty deck).
 *
 * Wrapped by a two-phase reveal animation:
 *   • Phase 1 (`colored_snow_reveal_start`) — the Potion flies from
 *     the controller's Potion Deck to the center of the screen face-
 *     down, holds, then dramatically flips face-up. The card hangs
 *     centered for the duration of the resolve.
 *   • Resolve runs (with any targeting prompts taking as long as the
 *     player needs).
 *   • Phase 2 (`colored_snow_reveal_end`) — the Potion flies from
 *     center to its final destination, detected post-resolve:
 *       – deleted pile (default fizzle / resolve)
 *       – opponent's hand (Saint Nicolas redirect)
 *       – a Support Zone (Biomancy turning the Potion into a Creature)
 *       – discard pile (uncommon redirect)
 */
async function _resolveTopPotion(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.potionDeck || ps.potionDeck.length === 0) return 'no-potion';

  const cardName = ps.potionDeck[0];
  const script = loadCardEffect(cardName);
  const cardDB = engine._getCardDB();
  const cd = cardDB[cardName];
  if (!cd || cd.cardType !== 'Potion' || !script?.isPotion) {
    // Defensive — Potion Deck should only contain Potions, but if a
    // foreign card slipped in, just delete-fizzle it (no animation).
    ps.potionDeck.shift();
    ps.deletedPile.push(cardName);
    return 'fizzle';
  }

  // ── Phase 1: fly-in + flip face-up at center ──
  engine._broadcastEvent('colored_snow_reveal_start', {
    owner: pi, cardName,
  });
  await engine._delay(REVEAL_IN_MS);

  // Pop the Potion from the deck NOW — the card is mid-flight client-
  // side, the server commits the pile change to match.
  ps.potionDeck.shift();
  engine.sync();

  // Snapshot pre-resolve pile counts of THIS card name so the post-
  // resolve destination detection can compare deltas — guards against
  // false positives when the opponent already has a copy of the same
  // Potion in hand (so `hand.includes(cardName)` was true before we
  // resolved anything).
  const oppIdxForSnap = pi === 0 ? 1 : 0;
  const oppPsForSnap = engine.gs.players[oppIdxForSnap];
  const preSnap = {
    deletedCount: (ps.deletedPile || []).filter(c => c === cardName).length,
    discardCount: (ps.discardPile || []).filter(c => c === cardName).length,
    oppHandCount: (oppPsForSnap?.hand || []).filter(c => c === cardName).length,
    supportCount: engine.cardInstances.filter(i =>
      i.name === cardName && i.zone === 'support'
      && (i.controller ?? i.owner) === pi
    ).length,
  };

  // canActivate / resolve / routing. Each branch ends by computing
  // the post-resolve destination and emitting phase 2.
  let outcome = 'success';

  if (script.canActivate && !script.canActivate(engine.gs, pi, engine)) {
    ps.deletedPile.push(cardName);
    engine.log('colored_snow_fizzle', { potion: cardName, reason: 'canActivate' });
    outcome = 'fizzle';
  } else if (script.getValidTargets && script.targetingConfig) {
    // Targeted Potion path.
    const validTargets = script.getValidTargets(engine.gs, pi, engine) || [];
    if (validTargets.length === 0) {
      ps.deletedPile.push(cardName);
      engine.log('colored_snow_fizzle', { potion: cardName, reason: 'no_targets' });
      outcome = 'fizzle';
    } else {
      const cfg = typeof script.targetingConfig === 'function'
        ? script.targetingConfig(engine.gs, pi)
        : script.targetingConfig;
      const picked = await engine.promptEffectTarget(pi, validTargets, {
        ...cfg,
        title: cfg?.title || cardName,
        description: cfg?.description || `Resolve ${cardName} from your Potion Deck.`,
        cancellable: cfg?.cancellable !== false,
      });
      if (!picked || picked.length === 0) {
        ps.deletedPile.push(cardName);
        engine.log('colored_snow_fizzle', { potion: cardName, reason: 'cancelled' });
        outcome = 'fizzle';
      } else {
        try {
          const result = script.resolve
            ? await script.resolve(engine, pi, picked, validTargets)
            : null;
          if (result?.aborted) {
            ps.deletedPile.push(cardName);
            engine.log('colored_snow_fizzle', { potion: cardName, reason: 'aborted' });
            outcome = 'fizzle';
          } else {
            await _runAfterPotionUsedRouting(engine, pi, cardName);
          }
        } catch (err) {
          console.error('[Colored Snow] potion resolve threw:', err.message);
          ps.deletedPile.push(cardName);
          outcome = 'fizzle';
        }
      }
    }
  } else {
    // Non-targeted Potion path.
    try {
      if (script.resolve) await script.resolve(engine, pi, [], []);
      await _runAfterPotionUsedRouting(engine, pi, cardName);
    } catch (err) {
      console.error('[Colored Snow] potion resolve threw:', err.message);
      ps.deletedPile.push(cardName);
      outcome = 'fizzle';
    }
  }

  // ── Phase 2: fly from center to final destination ──
  // Detect where the Potion ended up by name, comparing post-resolve
  // counts against the pre-resolve snapshot so a duplicate copy that
  // was already in opp's hand doesn't fool us into reporting a Saint
  // Nicolas redirect.
  const destination = _detectPotionDestination(engine, pi, cardName, preSnap);
  engine._broadcastEvent('colored_snow_reveal_end', {
    owner: pi, cardName, destination,
  });
  await engine._delay(REVEAL_OUT_MS);
  engine.sync();

  return outcome;
}

const REVEAL_IN_MS = 1500;
const REVEAL_OUT_MS = 500;

/**
 * Find where the Potion `cardName` ended up after the resolve / route
 * step. Returns `{ kind, owner, heroIdx?, slotIdx? }` describing the
 * destination for the client-side fly-out animation. Compares against
 * pre-resolve counts so any "found a copy" check requires a delta of
 * at least 1 to claim that destination.
 */
function _detectPotionDestination(engine, pi, cardName, preSnap) {
  const oppIdx = pi === 0 ? 1 : 0;
  const oppPs = engine.gs.players[oppIdx];
  const ps = engine.gs.players[pi];

  const oppHandNow = (oppPs?.hand || []).filter(c => c === cardName).length;
  if (oppHandNow > (preSnap?.oppHandCount || 0)) {
    // Saint Nicolas pushes the Potion to opp's hand (end of array),
    // so the new copy is the LAST occurrence of `cardName`. Pass the
    // specific hand index so the client lands the fly-out on that
    // slot rather than the middle of the hand row.
    const handIdx = (oppPs.hand || []).lastIndexOf(cardName);
    return { kind: 'oppHand', owner: oppIdx, handIdx };
  }
  // Biomancy — find a Support Zone Creature copy that wasn't there
  // before. Walk cardInstances and pick the first new own-side match.
  const supportInsts = engine.cardInstances.filter(i =>
    i.name === cardName && i.zone === 'support'
    && (i.controller ?? i.owner) === pi
  );
  if (supportInsts.length > (preSnap?.supportCount || 0)) {
    // Pick any of the new ones — order isn't meaningful here.
    const inst = supportInsts[supportInsts.length - 1];
    return { kind: 'support', owner: pi, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot };
  }
  const discardNow = (ps?.discardPile || []).filter(c => c === cardName).length;
  if (discardNow > (preSnap?.discardCount || 0)) {
    return { kind: 'discard', owner: pi };
  }
  // Default — deleted pile (standard Potion post-resolve routing).
  return { kind: 'deleted', owner: pi };
}

/** Fire afterPotionUsed and route to deleted by default (mirrors server.js
 *  doUsePotion's post-resolve block). */
async function _runAfterPotionUsedRouting(engine, pi, cardName) {
  const ps = engine.gs.players[pi];
  const hookCtx = {
    potionName: cardName, potionOwner: pi,
    placed: false, _skipReactionCheck: true,
  };
  try {
    await engine.runHooks('afterPotionUsed', hookCtx);
  } catch (err) {
    console.error('[Colored Snow] afterPotionUsed threw:', err.message);
  }
  if (!hookCtx.placed) {
    ps.deletedPile.push(cardName);
  }
}

module.exports = {
  // CPU: confirm the "resolve top of Potion Deck?" prompt — the default brain
  // declines cancellable confirms outside a card-cast (onStatusApplied
  // trigger), so without this the bonus never fires. (Title == card name.)
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm' && !promptData.showCard) return { confirmed: true };
    return undefined;
  },
  activeIn: ['support'],

  cpuMeta: {
    onDeathBenefit: 0,
  },

  hooks: {
    onStatusApplied: async (ctx) => {
      const sn = ctx.statusName || ctx.status;
      if (sn !== 'frozen') return;

      const inst = ctx.card;
      const engine = ctx._engine;
      const pi = inst.controller ?? inst.owner;
      const turn = engine.gs.turn || 0;

      // Once-per-turn per Colored Snow instance.
      if (_isExhausted(inst, turn)) return;

      // Trigger only when the target belongs to the OPPONENT.
      const target = ctx.target;
      if (!target) return;
      // Hero target: ctx.heroOwner or check via player heroes array.
      // Creature target (_onCreature): target.controller / owner.
      let targetOwner;
      if (ctx._onCreature) {
        targetOwner = target.controller ?? target.owner;
      } else {
        // Hero — figure out which side.
        for (let p = 0; p < 2; p++) {
          if ((engine.gs.players[p]?.heroes || []).includes(target)) {
            targetOwner = p; break;
          }
        }
      }
      if (targetOwner == null || targetOwner === pi) return;

      // Optional prompt — "may".
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: 'Resolve the top of your Potion Deck as if you played it from your hand?',
        confirmLabel: '✨ Resolve!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      // Consume the once-per-turn slot whether the Potion fizzles or
      // resolves — per user spec "Colored Snow's effect is spent by
      // whiffing".
      _markUsed(inst, turn);

      await _resolveTopPotion(engine, pi);
      engine.sync();
    },
  },
};
