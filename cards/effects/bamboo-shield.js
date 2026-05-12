// ═══════════════════════════════════════════
//  CARD EFFECT: "Bamboo Shield"
//  Artifact (Reaction, Cost 20 / 8 when revealed)
//
//  Play this card immediately when a Hero would
//  take any damage. Negate that damage to that
//  Hero. When this card is added to your hand
//  from your discard pile, you may permanently
//  reveal it to make its Cost become 8. You can
//  only play 1 'Bamboo Shield' per turn.
//
//  Wiring — two entry points, consolidated UX:
//
//   1. `isPostTargetReaction` (primary) — fires
//      ONCE per damage source after targets are
//      determined. If 2+ of the activator's Heroes
//      are in the target list, the player chooses
//      WHICH ONE gets the negate. The chosen Hero
//      is stamped via `engine.addBambooShieldMark`;
//      `_actionDealDamageImpl` consumes the mark
//      before damage applies and pins
//      `hookCtx.amount` to 0 (afterDamage hook
//      still fires, on-hit status / arrow riders
//      still trigger — only HP loss is removed).
//
//   2. `isPreDamageReaction` (fallback) — fires
//      per-Hero for damage paths that don't route
//      through the post-target hub. Gated by the
//      per-source `_bsPromptedFor` flag so it
//      never re-prompts after the post-target
//      window has fired.
//
//  Dedup + HOPT: per-player `_bsPromptedFor[pi]`
//  is set in `postTargetCondition` (covers both
//  accept AND decline paths) and in
//  `preDamageCondition`. Per-turn HOPT (claimed
//  in either resolver) survives the chain since
//  it lives in `gs.hoptUsed` not the chain-resolve
//  cleanup set. All flags + the marks are cleared
//  at chain-resolve.
//
//  Cost discount: revealing a copy stamps the
//  index in `ps._permanentlyRevealedHandIndices`
//  — the engine's `dynamicCost` path drops the
//  price to 8 in both post-target AND pre-damage
//  windows. The engine's splice prefers the
//  revealed copy when consuming.
// ═══════════════════════════════════════════

const CARD_NAME = 'Bamboo Shield';
const BASE_COST = 20;
const REVEALED_COST = 8;
const HOPT_KEY_PREFIX = 'bamboo_shield';

/** True iff `ps` has at least one Bamboo Shield in hand at a revealed index. */
function hasRevealedCopy(ps) {
  const map = ps?._permanentlyRevealedHandIndices;
  if (!map) return false;
  for (const kStr of Object.keys(map)) {
    if ((ps.hand || [])[+kStr] === CARD_NAME) return true;
  }
  return false;
}

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  // Active in hand + discard so the beforeDamage / onChainResolve
  // hooks fire while the card sits in either zone.
  activeIn: ['hand', 'discard'],

  /**
   * Cost gate read by `_checkPreDamageHandReactions` and
   * `_checkPostTargetHandReactions`. Drops the price to 8 iff the
   * player has at least one currently-revealed Bamboo Shield in hand.
   */
  dynamicCost(gs, playerIdx /*, engine */) {
    const ps = gs?.players?.[playerIdx];
    return hasRevealedCopy(ps) ? REVEALED_COST : BASE_COST;
  },

  // ── Batch-level (consolidated multi-target prompt) ──────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, _engine, targetedTargets /*, sourceCard, opts */) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (_hoptUsed(gs, pi)) return false;
    const eligible = _collectOwnedHeroTargets(gs, pi, targetedTargets).length > 0;
    if (eligible) {
      // Side effect — covers decline path. Once the prompt is offered
      // (accept or decline), no further BS prompts for this source.
      _markPrompted(gs, pi);
    }
    return eligible;
  },

  async postTargetResolve(engine, pi, targetedTargets /*, sourceCard, opts */) {
    const candidates = _collectOwnedHeroTargets(engine.gs, pi, targetedTargets);
    if (candidates.length === 0) return { effectNegated: false };
    _markPrompted(engine.gs, pi);

    // Claim the once-per-turn HOPT here so a declined picker after the
    // accept can't fail. The HOPT is independent of the per-source
    // dedup flag (it persists across chains).
    if (!engine.claimHOPT(HOPT_KEY_PREFIX, pi)) {
      // Defensive — postTargetCondition should have already rejected.
      return { effectNegated: false };
    }

    let picked;
    if (candidates.length === 1) {
      picked = candidates[0];
    } else {
      const result = await engine.promptEffectTarget(pi, candidates.map(c => ({
        id: c.id, type: 'hero',
        owner: c.owner, heroIdx: c.heroIdx, cardName: c.cardName,
      })), {
        title: CARD_NAME,
        description: 'Choose one of your Heroes to negate the incoming damage.',
        confirmLabel: '🎋 Shield!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    _addMark(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    engine.log('bamboo_shield_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isPreDamageReaction: true,

  preDamageCondition(gs, ownerIdx /*, engine, target, heroIdx, source, amount, type */) {
    if (_alreadyPrompted(gs, ownerIdx)) return false;
    if (_hoptUsed(gs, ownerIdx)) return false;
    _markPrompted(gs, ownerIdx);
    return true;
  },

  async preDamageResolve(engine, ownerIdx /*, target, heroIdx, source, amount, type */) {
    if (!engine.claimHOPT(HOPT_KEY_PREFIX, ownerIdx)) {
      return { amountOverride: undefined };
    }
    _markPrompted(engine.gs, ownerIdx);
    const ps = engine.gs.players[ownerIdx];
    engine.log('bamboo_shield_negate', { player: ps?.username });
    return { amountOverride: 0 };
  },

  hooks: {
    /**
     * When a Bamboo Shield is recovered into our hand from the discard
     * pile, prompt the controller: permanently reveal THIS copy to
     * lock the cost discount? The reveal entry lives in the engine's
     * generic `_permanentlyRevealedHandIndices` map — keyed by the
     * resolved handIndex of the just-arrived inst, so the splice
     * interceptor and `reorder_hand` remap follow the physical copy
     * through any hand mutation.
     */
    onCardAddedFromDiscardToHand: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.addedCardName !== CARD_NAME) return;
      if (ctx.addedCard?.id !== ctx.card.id) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      const handIdx = engine._findHandIndexForInst(ctx.card);
      if (handIdx < 0) return;
      if (ps._permanentlyRevealedHandIndices?.[handIdx]) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${CARD_NAME} returned to your hand! Permanently reveal it to drop ${CARD_NAME}'s cost to ${REVEALED_COST}?`,
        showCard: CARD_NAME,
        confirmLabel: '🎋 Reveal!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      const handIdxNow = engine._findHandIndexForInst(ctx.card);
      if (handIdxNow < 0) return;

      if (!ps._permanentlyRevealedHandIndices) ps._permanentlyRevealedHandIndices = {};
      ps._permanentlyRevealedHandIndices[handIdxNow] = true;

      engine._broadcastEvent('card_reveal', {
        cardName: CARD_NAME, playerIdx: pi,
      });

      engine.log('bamboo_shield_revealed', { player: ps.username });
      engine.sync();
    },

    /**
     * Consume the per-target damage-pin-to-0 mark on incoming hero
     * damage. Sets `ctx.amount = 0` so the damage instance stays
     * live — afterDamage hooks, on-hit status (Reiza Poison+Stun),
     * armed-arrow riders all still fire — but no HP is lost.
     * Matches the legacy `amountOverride: 0` semantics. No dedicated
     * zone-anim — the card reveal at activation time is the user-
     * visible cue.
     */
    beforeDamage: (ctx) => {
      if (ctx.cancelled) return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (!(ctx.amount > 0)) return;
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner(target);
      if (tgtOwner < 0) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0) return;
      if (!_consumeMark(engine.gs, _keyForHero(tgtOwner, tgtHi))) return;
      engine.log('bamboo_shield_apply', {
        target: engine._heroLabel(target), original: ctx.amount,
      });
      ctx.amount = 0;
    },

    /**
     * Chain-resolve cleanup. Per-target marks + per-player prompt
     * dedup are scoped to a single chain.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._bsMarks) delete gs._bsMarks;
      if (gs._bsPromptedFor) delete gs._bsPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup ───────────────────────────────────────

function _alreadyPrompted(gs, pi) {
  return !!gs._bsPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._bsPromptedFor) gs._bsPromptedFor = {};
  gs._bsPromptedFor[pi] = true;
}

// ─── Per-target pin-to-0 mark set + one-shot consume ───────────────

function _addMark(gs, key) {
  if (!key) return;
  if (!gs._bsMarks) gs._bsMarks = new Set();
  gs._bsMarks.add(key);
}
function _consumeMark(gs, key) {
  const set = gs?._bsMarks;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `bs-hero-${ownerIdx}-${heroIdx}`;
}

/** True iff the per-turn HOPT for player `pi` is already claimed. */
function _hoptUsed(gs, pi) {
  return gs.hoptUsed?.[`${HOPT_KEY_PREFIX}:${pi}`] === gs.turn;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`.
 * Bamboo Shield's card text says "a Hero would take damage"; the
 * current implementation covers Heroes only (matching the existing
 * pre-damage reaction's scope).
 */
function _collectOwnedHeroTargets(gs, pi, targetedTargets) {
  const out = [];
  if (!Array.isArray(targetedTargets)) return out;
  for (const t of targetedTargets) {
    if (!t || t.type !== 'hero') continue;
    if (t.owner !== pi) continue;
    const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    out.push({
      id: `hero-${t.owner}-${t.heroIdx}`,
      owner: t.owner, heroIdx: t.heroIdx,
      cardName: hero.name,
    });
  }
  return out;
}
