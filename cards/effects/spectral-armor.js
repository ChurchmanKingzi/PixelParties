// ═══════════════════════════════════════════
//  CARD EFFECT: "Spectral Armor"
//  Spell (Reaction, Magic Arts / Support Magic Lv1)
//
//  Play this card immediately when a target you
//  control would take any damage. Halve that
//  damage (rounded up).
//
//  Wiring — two entry points, consolidated UX:
//
//   1. `isPostTargetReaction` (primary) — fires
//      ONCE per damage source after targets are
//      determined. If 2+ of the activator's Heroes
//      are in the target list, the player chooses
//      WHICH ONE gets the halve. The chosen Hero
//      is stamped via `engine.addSpectralArmorMark`;
//      `_actionDealDamageImpl` consumes the mark
//      before damage applies and halves the amount
//      in-flight.
//
//   2. `isPreDamageReaction` (fallback) — fires
//      per-Hero for damage paths that don't route
//      through the post-target hub (direct
//      `actionDealDamage` from recoil, status
//      ticks, etc.). Gated by the per-source
//      `_saPromptedFor` flag so it never re-prompts
//      after the post-target window has fired.
//
//  Dedup: per-player `_saPromptedFor[pi]` is set in
//  `postTargetCondition` (covers both accept AND
//  decline paths) and in `preDamageCondition`. All
//  three flags + the halve-marks are cleared at
//  chain-resolve.
//
//  CPU decision-making (preDamage path only):
//    • PUZZLE mode → activate iff halving would
//      save the targeted Hero from lethal damage.
//    • COMBAT mode → MCTS-evaluate "halve now vs
//      hold for later" via `mctsPickFromOptions`.
//      The rollout naturally weighs whether the
//      target is worth protecting, whether the
//      damage is lethal, whether opp has bigger
//      hits queued, and what the rest-of-turn
//      score looks like with vs without the
//      Spectral Armor still in hand.
// ═══════════════════════════════════════════

const CARD_NAME = 'Spectral Armor';

module.exports = {
  // Cards.json subtype 'Reaction' + engine validateActionPlay's
  // reaction-subtype filter block proactive Main-Phase casts.
  canActivate: () => false,
  neverPlayable: true,
  // Active in hand (defensive) and discard (where the card lands once
  // the post-target framework consumes it). Both zones host the
  // beforeDamage / onChainResolve hooks below.
  activeIn: ['hand', 'discard'],

  // ── Batch-level (consolidated multi-target prompt) ──────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedTargets, sourceCard, opts) {
    // Spectral Armor's text is strictly "when a target you control
    // would take ANY DAMAGE". The post-target hub also fires for pure
    // non-damage targeting (Disruption Ray, Icy Slime, …); bail there
    // so it never chains to a Spell/effect that deals no damage.
    if (opts && opts.dealsDamage === false) return false;
    if (_alreadyPrompted(gs, pi)) return false;
    const eligible = _collectOwnedHeroTargets(gs, pi, targetedTargets).length > 0;
    if (eligible) {
      // Side effect — covers decline path. Once the prompt is offered
      // (accept or decline), no further SA prompts for this source.
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
        description: 'Choose one of your Heroes to halve the incoming damage.',
        confirmLabel: '🛡️ Halve!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      picked = (result && result.length > 0)
        ? (candidates.find(c => c.id === result[0]) || candidates[0])
        : candidates[0];
    }

    _addMark(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    engine.log('spectral_armor_prompt_accepted', {
      player: engine.gs.players[pi]?.username, target: picked.cardName,
    });
    engine.sync();
    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isPreDamageReaction: true,

  preDamageCondition(gs, ownerIdx, _engine, _target, _heroIdx, _source, amount /*, type */) {
    if (_alreadyPrompted(gs, ownerIdx)) return false;
    if (!(amount > 0)) return false;
    _markPrompted(gs, ownerIdx);
    return true;
  },

  async preDamageResolve(engine, ownerIdx, target, heroIdx, _source, amount, _type) {
    _markPrompted(engine.gs, ownerIdx);
    const halved = Math.ceil(amount / 2);
    engine._broadcastEvent('play_zone_animation', {
      type: 'spectral_armor', owner: ownerIdx, heroIdx, zoneSlot: -1,
    });
    await engine._delay(450);

    const ps = engine.gs.players[ownerIdx];
    engine.log('spectral_armor', {
      player: ps?.username, hero: target?.name,
      originalDamage: amount, halvedDamage: halved,
    });
    return { amountOverride: halved };
  },

  /**
   * CPU decision-maker — fires for the pre-damage prompt path. The
   * post-target prompt is a generic confirm with no extra context;
   * the engine's default activation policy handles it.
   *
   * Puzzle mode: deterministic save-from-lethal heuristic.
   * Combat mode: MCTS over [confirm, decline].
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'confirm') return undefined;
    if ((promptData?._gerryOriginalTitle || promptData?.title) !== CARD_NAME) return undefined;

    const ctx = promptData._preDamageContext;
    if (!ctx) return undefined;

    const { targetOwner, targetHeroIdx, amount } = ctx;
    const target = engine.gs?.players?.[targetOwner]?.heroes?.[targetHeroIdx];
    if (!target) return null;

    const halved = Math.ceil(amount / 2);
    const wouldLethal = target.hp <= amount;
    const halvedSaves = wouldLethal && target.hp > halved;

    if (engine.isPuzzle) {
      return halvedSaves ? { confirmed: true } : null;
    }

    let mctsPick = null;
    try { ({ mctsPickFromOptions: mctsPick } = require('./_cpu')); } catch {}
    if (typeof mctsPick !== 'function' || engine._inMctsSim) {
      return halvedSaves ? { confirmed: true } : null;
    }

    const options = [
      { id: 'confirm', value: { confirmed: true } },
      { id: 'decline', value: null },
    ];

    const apply = async (eng, opt) => {
      const t = eng.gs?.players?.[targetOwner]?.heroes?.[targetHeroIdx];
      const ps = eng.gs?.players?.[targetOwner];
      if (!t || !ps) return false;
      if (opt.id === 'confirm') {
        const dealt = Math.min(t.hp, halved);
        t.hp -= dealt;
        const hIdx = (ps.hand || []).indexOf(CARD_NAME);
        if (hIdx >= 0) ps.hand.splice(hIdx, 1);
      } else {
        const dealt = Math.min(t.hp, amount);
        t.hp -= dealt;
      }
      return true;
    };

    return (async () => {
      try {
        const best = await mctsPick(engine, options, apply, { horizon: 4 });
        return best?.value ?? null;
      } catch (err) {
        console.error('[Spectral Armor MCTS]', err.message);
        return halvedSaves ? { confirmed: true } : null;
      }
    })();
  },

  hooks: {
    /**
     * Consume the per-target halve-mark on incoming hero damage.
     * Mutates `ctx.amount` to ceil(amount / 2) and plays the
     * `spectral_armor` animation. Runs FIRST among damage-modifier
     * hooks (matching the legacy engine ordering: SA halve →
     * Homerun! cancel-if-lethal → Bamboo Shield pin-to-0) via the
     * deterministic SA → HR → BS naming-order tiebreak inside the
     * engine's hook dispatch.
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
      const halved = Math.ceil(ctx.amount / 2);
      engine._broadcastEvent('play_zone_animation', {
        type: 'spectral_armor', owner: tgtOwner, heroIdx: tgtHi, zoneSlot: -1,
      });
      engine.log('spectral_armor_apply', {
        target: engine._heroLabel(target), original: ctx.amount, halved,
      });
      // Route through `setAmount` — direct `ctx.amount = halved`
      // only mutates the local hook-ctx wrapper, NOT the underlying
      // hookCtx the engine reads after the listener loop (the ctx is
      // built via `{ ...hookCtx }`, a shallow copy, in
      // `_engine.js#_createContext`). `setAmount` writes to hookCtx
      // through its closure and also honours `cannotBeReduced`.
      ctx.setAmount(halved);
    },

    /**
     * Chain-resolve cleanup. Both the per-target halve-mark set and
     * the per-player prompt dedup map live for the duration of a
     * single chain; clear them so the next chain starts fresh.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._saMarks) delete gs._saMarks;
      if (gs._saPromptedFor) delete gs._saPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup ───────────────────────────────────────

function _alreadyPrompted(gs, pi) {
  return !!gs._saPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._saPromptedFor) gs._saPromptedFor = {};
  gs._saPromptedFor[pi] = true;
}

// ─── Per-target halve-mark set + one-shot consume ──────────────────

function _addMark(gs, key) {
  if (!key) return;
  if (!gs._saMarks) gs._saMarks = new Set();
  gs._saMarks.add(key);
}
function _consumeMark(gs, key) {
  const set = gs?._saMarks;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `sa-hero-${ownerIdx}-${heroIdx}`;
}

/**
 * Filter the source's target list to alive Heroes controlled by `pi`.
 * Spectral Armor's card text says "any target you control"; the
 * current implementation covers Heroes only (matching the existing
 * pre-damage reaction's scope). Adding Creature support would require
 * a parallel creature-mark + creature-damage consumption hook.
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
