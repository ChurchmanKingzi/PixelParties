// ═══════════════════════════════════════════
//  CARD EFFECT: "Arrow Slit"
//  Artifact (Reaction, cost 4)
//
//  Play immediately when you activate an "Arrow"
//  Artifact. That Artifact activates a second
//  time immediately after its first activation.
//
//  Implementation — Arrow Slit chains ON TOP of
//  the Arrow link. Chain resolution is LIFO, so
//  Arrow Slit runs BEFORE the Arrow it targets.
//  Arrow Slit's `resolve` immediately re-invokes
//  the target Arrow's own `resolve` function,
//  then the engine proceeds down the chain and
//  runs the Arrow's resolve AGAIN as part of
//  normal chain processing — net effect: the
//  Arrow's resolve fires twice.
//
//  All arrow `resolve`s are idempotent in
//  terms of arming (each call pushes another
//  modifier onto `hero._armedArrows`, so buffs
//  stack — Angelfeather goes +60 → +120, etc.)
//  and resolution-time side effects (Bomb
//  re-prompts for another Creature target,
//  Racket bounces a second Creature, Rainbow
//  draws another 2 cards). Arrow Slit picks the
//  most recent UN-RETRIGGERED Arrow owned by
//  its controller — this keeps two Arrow Slits
//  chained in a row from both targeting the
//  same Arrow (each marks its target with
//  `_retriggeredByArrowSlit`).
//
//  Arrow Slit is NOT flagged `isArrow`, so it
//  doesn't count toward Darge's +50-per-arrow
//  bonus — only the actual Arrow Artifacts
//  the player has chained do (which matches
//  Darge's card text).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { pickLastUntriggeredArrowLink } = require('./_arrows-shared');

const CARD_NAME = 'Arrow Slit';

module.exports = {
  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length === 0) return false;
    // Need at least one reactable Arrow link owned by pi — the most
    // recent qualifies. Reject if there's nothing to retrigger.
    const target = pickLastUntriggeredArrowLink(pi, chainCtx.chain);
    if (!target) return false;
    // Ensure the chain is still a "live Attack" context — don't let
    // Arrow Slit chain onto a non-Attack chain that happens to contain
    // an Arrow (defensive; shouldn't happen given Arrow's own gate).
    const initial = chainCtx.chain.find(l => l.isInitialCard);
    if (!initial || initial.cardType !== 'Attack') return false;
    return true;
  },

  resolve: async (engine, pi, _selectedIds, _validTargets, chain, myIdx) => {
    // `myIdx` is Slit's position in the chain. Pass it so the picker
    // scans BACKWARDS from it — picking the Arrow chained immediately
    // before Slit, matching the card text's "when you activate an
    // Arrow Artifact". An Arrow chained ON TOP of Slit (e.g. the
    // player plays Slit first, then another Arrow afterwards) resolves
    // earlier in LIFO order and is NOT what Slit's text targets.
    const target = pickLastUntriggeredArrowLink(pi, chain, myIdx);
    if (!target) return false;
    const script = loadCardEffect(target.cardName);
    if (typeof script?.resolve !== 'function') return false;

    // Mark so a subsequent Arrow Slit on the same chain targets a
    // DIFFERENT Arrow. Set BEFORE the re-invocation so nested retriggers
    // (unlikely but possible) don't recurse onto the same link.
    target._retriggeredByArrowSlit = true;

    engine.log('arrow_slit_retrigger', {
      player: engine.gs.players[pi]?.username,
      arrow: target.cardName,
    });

    try {
      // Re-invoke the Arrow's resolve with the same signature the
      // reaction runner uses (engine, pi, null, null, chain, idx).
      await script.resolve(engine, pi, null, null, chain, null);
    } catch (err) {
      console.error(`[Arrow Slit] re-invoking ${target.cardName}.resolve threw:`, err.message);
    }

    engine.sync();
    return true;
  },
};
