// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud in a Bottle"
//  Potion (Reaction).
//
//  When any target you control takes damage,
//  halve the damage (rounded up) and apply the
//  Cloudy buff (halves all future damage this
//  turn) to that target.
//
//  Wiring — two entry points, consolidated UX:
//
//   1. `isPostTargetReaction` (primary) — fires
//      ONCE per damage source after targets are
//      determined. If 2+ of the activator's Heroes
//      are in the target list, the player chooses
//      WHICH ONE gets the halve + Cloudy buff. The
//      chosen Hero is stamped via
//      `engine.addCloudBottleMark`;
//      `_actionDealDamageImpl` consumes the mark
//      AFTER damage applies, restores half the
//      dealt amount, and applies the Cloudy buff.
//
//   2. `isAfterDamageReaction` (fallback) — fires
//      per-Hero for damage paths that don't route
//      through the post-target hub. Gated by the
//      per-source `_cibPromptedFor` flag so it
//      never re-prompts after the post-target
//      window has fired.
//
//  Dedup: per-player `_cibPromptedFor[pi]` is set in
//  `postTargetCondition` (covers both accept AND
//  decline paths) and in `afterDamageCondition`.
//  All flags + marks are cleared at chain-resolve.
//
//  Stacking guard: targets that already have the
//  Cloudy buff are excluded from the candidate
//  list (no point doubling-up halving).
// ═══════════════════════════════════════════

const CARD_NAME = 'Cloud in a Bottle';

module.exports = {
  isPotion: true,
  canActivate: () => false,
  // Active in hand + deleted (Potions route to deletedPile on resolve)
  // so afterDamage / onChainResolve hooks fire while the card sits in
  // either zone.
  activeIn: ['hand', 'deleted'],

  // ── Batch-level (consolidated multi-target prompt) ──────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, _engine, targetedTargets, sourceCard, opts) {
    // "when a target you control takes ANY DAMAGE" — never chain to
    // non-damage targeting (Disruption Ray, …). See Spectral Armor.
    if (opts && opts.dealsDamage === false) return false;
    if (_alreadyPrompted(gs, pi)) return false;
    const eligible = _collectOwnedHeroTargets(gs, pi, targetedTargets).length > 0;
    if (eligible) {
      // Side effect — covers decline path. Once the prompt is offered
      // (accept or decline), no further CIB prompts for this source.
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
        description: 'Choose one of your Heroes to halve the incoming damage and gain Cloudy.',
        confirmLabel: '☁️ Protect!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    _addMark(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    engine.log('cloud_bottle_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isAfterDamageReaction: true,

  afterDamageCondition(gs, pi, _engine, target, _targetHeroIdx, _source, amount /*, type */) {
    if (_alreadyPrompted(gs, pi)) return false;
    if (!(amount > 0)) return false;
    // Don't trigger if the hero already has the Cloudy buff (no stacking).
    if (target?.buffs?.cloudy) return false;
    _markPrompted(gs, pi);
    return true;
  },

  async afterDamageResolve(engine, pi, target, targetHeroIdx, _source, amount, _type) {
    _markPrompted(engine.gs, pi);
    const gs = engine.gs;
    const ps = gs.players[pi];

    const halfDmg = Math.ceil(amount / 2);
    const restoreAmount = amount - halfDmg; // = floor(amount / 2)
    if (restoreAmount > 0 && target.hp > 0) {
      target.hp = Math.min(target.hp + restoreAmount, target.maxHp);
      engine.log('cloud_bottle_restore', {
        player: ps.username, hero: target.name,
        originalDamage: amount, effectiveDamage: halfDmg, restored: restoreAmount,
      });
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'cloud_gather', owner: pi, heroIdx: targetHeroIdx, zoneSlot: -1,
    });
    await engine._delay(600);

    const nextPlayer = gs.activePlayer === 0 ? 1 : 0;
    await engine.actionAddBuff(target, pi, targetHeroIdx, 'cloudy', {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: nextPlayer,
      source: CARD_NAME,
      addAnim: 'cloud_gather',
      removeAnim: 'cloud_disperse',
    });

    engine.log('cloud_bottle', {
      player: ps.username, hero: target.name,
    });
    engine.sync();
  },

  hooks: {
    /**
     * Consume the per-target halve-after-damage mark. Restores
     * floor(actualAmount / 2) HP (effectively halving the damage,
     * rounded up) and applies the Cloudy buff. Mark is one-shot.
     * Runs in the engine's AFTER_DAMAGE hook window which fires
     * after HP has dropped but BEFORE the after-damage hand-reaction
     * window — so CIB's per-target `isAfterDamageReaction` fallback
     * is naturally suppressed (dedup flag set in postTargetCondition).
     */
    afterDamage: async (ctx) => {
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (target.hp <= 0) return;
      const actualAmount = ctx.amount;
      if (!(actualAmount > 0)) return;
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner(target);
      if (tgtOwner < 0) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0) return;
      if (!_consumeMark(engine.gs, _keyForHero(tgtOwner, tgtHi))) return;

      const halfDmg = Math.ceil(actualAmount / 2);
      const restoreAmount = actualAmount - halfDmg; // = floor(actualAmount/2)
      if (restoreAmount > 0 && target.hp > 0) {
        target.hp = Math.min(target.hp + restoreAmount, target.maxHp);
      }
      engine._broadcastEvent('play_zone_animation', {
        type: 'cloud_gather', owner: tgtOwner, heroIdx: tgtHi, zoneSlot: -1,
      });
      await engine._delay(450);
      // Cloudy buff: expires at end of this turn (start of next player's turn).
      const nextPlayer = engine.gs.activePlayer === 0 ? 1 : 0;
      await engine.actionAddBuff(target, tgtOwner, tgtHi, 'cloudy', {
        expiresAtTurn: engine.gs.turn + 1,
        expiresForPlayer: nextPlayer,
        source: CARD_NAME,
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
      engine.log('cloud_bottle_apply', {
        target: engine._heroLabel(target),
        originalDamage: actualAmount, restored: restoreAmount,
      });
    },

    /**
     * Chain-resolve cleanup. Per-target marks + per-player prompt
     * dedup are scoped to a single chain.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._cibMarks) delete gs._cibMarks;
      if (gs._cibPromptedFor) delete gs._cibPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup ───────────────────────────────────────

function _alreadyPrompted(gs, pi) {
  return !!gs._cibPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._cibPromptedFor) gs._cibPromptedFor = {};
  gs._cibPromptedFor[pi] = true;
}

// ─── Per-target halve-after-damage mark set + one-shot consume ────

function _addMark(gs, key) {
  if (!key) return;
  if (!gs._cibMarks) gs._cibMarks = new Set();
  gs._cibMarks.add(key);
}
function _consumeMark(gs, key) {
  const set = gs?._cibMarks;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `cib-hero-${ownerIdx}-${heroIdx}`;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`
 * that don't already have the Cloudy buff. CIB's text "any target you
 * control" technically includes Creatures, but the current
 * implementation is hero-only (mirroring the existing after-damage
 * scope).
 */
function _collectOwnedHeroTargets(gs, pi, targetedTargets) {
  const out = [];
  if (!Array.isArray(targetedTargets)) return out;
  for (const t of targetedTargets) {
    if (!t || t.type !== 'hero') continue;
    if (t.owner !== pi) continue;
    const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.buffs?.cloudy) continue;
    out.push({
      id: `hero-${t.owner}-${t.heroIdx}`,
      owner: t.owner, heroIdx: t.heroIdx,
      cardName: hero.name,
    });
  }
  return out;
}
