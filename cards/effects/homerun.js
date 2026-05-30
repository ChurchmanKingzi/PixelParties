// ═══════════════════════════════════════════
//  CARD EFFECT: "Homerun!"
//  Artifact (Reaction, Cost 4)
//
//  Play this card immediately when a Hero you
//  control would take damage equal to or greater
//  than their max HP. Negate that damage and any
//  effects associated with it on that Hero.
//
//  Wiring — two entry points, consolidated UX:
//
//   1. `isPostTargetReaction` (primary) — fires
//      ONCE per damage source after targets are
//      determined. The post-target stage does NOT
//      know the per-target damage amount yet, so
//      eligibility is relaxed to "1+ of the
//      activator's alive Heroes is in the target
//      list"; the >= maxHp condition is enforced
//      at mark-consumption time (`_actionDealDamage-
//      Impl`). The activator commits Homerun! on
//      the picked Hero — if the actual incoming
//      hit is < that Hero's max HP, the mark stays
//      in place (waiting for a qualifying hit
//      later in the same chain) and is cleared at
//      chain-resolve if it never qualifies.
//
//   2. `isPreDamageReaction` (fallback) — fires
//      per-Hero for damage paths that don't route
//      through the post-target hub (direct
//      `actionDealDamage` from recoil, status
//      ticks, etc.). Gated by the per-source
//      `_hrPromptedFor` flag so it never re-prompts
//      after the post-target window has fired.
//
//  Dedup: per-player `_hrPromptedFor[pi]` is set
//  in `postTargetCondition` (covers both accept
//  AND decline paths) and in `preDamageCondition`.
//  All flags + the mark are cleared at chain-
//  resolve.
// ═══════════════════════════════════════════

const CARD_NAME = 'Homerun!';

module.exports = {
  canActivate: () => false,
  neverPlayable: true,
  // Active in hand + discard so the beforeDamage / onChainResolve
  // hooks fire while the card sits in either zone (post-target
  // framework routes the card to discard on commit).
  activeIn: ['hand', 'discard'],

  // ── Batch-level (consolidated multi-target prompt) ──────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, _engine, targetedTargets, sourceCard, opts) {
    // "when a Hero you control would take DAMAGE ≥ their max HP" —
    // never chain to non-damage targeting. See Spectral Armor.
    if (opts && opts.dealsDamage === false) return false;
    if (_alreadyPrompted(gs, pi)) return false;
    // Relaxed eligibility: any of the activator's alive Heroes in the
    // target list qualifies. The strict ≥ maxHp check happens at mark-
    // consumption time inside `_actionDealDamageImpl` — the post-
    // target window doesn't yet know the per-target damage amounts
    // (modifiers / arrow boosts / source-script per-target deltas all
    // resolve later).
    const eligible = _collectOwnedHeroTargets(gs, pi, targetedTargets).length > 0;
    if (eligible) {
      _markPrompted(gs, pi);
    }
    return eligible;
  },

  async postTargetResolve(engine, pi, targetedTargets /*, sourceCard, opts */) {
    const candidates = _collectOwnedHeroTargets(engine.gs, pi, targetedTargets);
    if (candidates.length === 0) return { effectNegated: false };
    _markPrompted(engine.gs, pi);

    let picked;
    if (candidates.length === 1) {
      picked = candidates[0];
    } else {
      const result = await engine.promptEffectTarget(pi, candidates.map(c => ({
        id: c.id, type: 'hero',
        owner: c.owner, heroIdx: c.heroIdx, cardName: c.cardName,
      })), {
        title: CARD_NAME,
        description: 'Choose one of your Heroes to negate a max-HP-or-greater hit on.',
        confirmLabel: '⚾ Homerun!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    _addMark(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    engine.log('homerun_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isPreDamageReaction: true,

  preDamageCondition(gs, pi, _engine, target, _heroIdx, _source, amount, _type) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!target || target.hp === undefined) return false;
    if (target.hp <= 0) return false;
    const maxHp = target.maxHp || 0;
    if (maxHp <= 0) return false;
    // Direct per-hero path: the resolved amount IS known here, so
    // preserve the strict ≥ maxHp gate of the original implementation.
    if (amount < maxHp) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async preDamageResolve(engine, pi, target, heroIdx /*, source, amount, type */) {
    _markPrompted(engine.gs, pi);
    engine._broadcastEvent('play_zone_animation', {
      type: 'holy_revival', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(700);
    engine.log('homerun_save', {
      player: engine.gs.players[pi]?.username, hero: target.name,
    });
    engine.sync();
    return { negated: true };
  },

  hooks: {
    /**
     * Consume the per-target full-negate-mark IFF the final incoming
     * amount ≥ the target's max HP. On a qualifying hit, sets
     * `ctx.cancelled = true` and plays the rescue animation. On a
     * non-qualifying hit (amount < maxHp), the mark stays in place
     * for the next damage event that meets the threshold; cleared at
     * chain-resolve if it never qualifies.
     */
    beforeDamage: (ctx) => {
      if (ctx.cancelled) return;
      // Piercing damage (Ida etc.) bypasses Homerun!. Bail BEFORE
      // consuming the mark so a future non-piercing hit of ≥maxHp
      // can still trigger the rescue. The engine's safety net would
      // otherwise undo the cancellation, but the mark would be lost.
      if (ctx.cannotBeNegated) return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (!(ctx.amount > 0)) return;
      const maxHp = target.maxHp || 0;
      if (maxHp <= 0 || ctx.amount < maxHp) return;
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner(target);
      if (tgtOwner < 0) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0) return;
      if (!_consumeMark(engine.gs, _keyForHero(tgtOwner, tgtHi))) return;
      engine._broadcastEvent('play_zone_animation', {
        type: 'holy_revival', owner: tgtOwner, heroIdx: tgtHi, zoneSlot: -1,
      });
      engine.log('homerun_save', {
        player: engine.gs.players[tgtOwner]?.username,
        hero: target.name, original: ctx.amount, maxHp,
      });
      ctx.cancelled = true;
    },

    /**
     * Chain-resolve cleanup. Per-target marks + per-player prompt
     * dedup are scoped to a single chain.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._hrMarks) delete gs._hrMarks;
      if (gs._hrPromptedFor) delete gs._hrPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup ───────────────────────────────────────

function _alreadyPrompted(gs, pi) {
  return !!gs._hrPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._hrPromptedFor) gs._hrPromptedFor = {};
  gs._hrPromptedFor[pi] = true;
}

// ─── Per-target full-negate-mark set + one-shot consume ────────────

function _addMark(gs, key) {
  if (!key) return;
  if (!gs._hrMarks) gs._hrMarks = new Set();
  gs._hrMarks.add(key);
}
function _consumeMark(gs, key) {
  const set = gs?._hrMarks;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `hr-hero-${ownerIdx}-${heroIdx}`;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`.
 * Homerun!'s card text says "a Hero you control"; the current
 * implementation covers Heroes only (Creatures don't have a
 * meaningful "max HP" concept under the same wording).
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
