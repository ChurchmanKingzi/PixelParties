// ═══════════════════════════════════════════
//  CARD EFFECT: "Sculpture Guards"
//  Spell (Reaction) — Support Magic Lv0
//
//  Activate immediately when one or more Frozen
//  targets you control would take damage from
//  the same source. Pick ONE of those Frozen
//  targets — its damage from this source is
//  fully negated. Other targets of the same
//  source still take their normal damage; the
//  source's recoil / cost / animations all play.
//
//  Three trigger entry points cover every damage
//  path the engine exposes:
//
//    1. `isPostTargetReaction` — fires once per
//       multi-target damage source AFTER targets
//       are determined but BEFORE damage is dealt.
//       Activator gets ONE prompt, then a picker
//       over the source's Frozen targets they
//       control (auto-picks if only 1). Stamps a
//       per-target shield mark on `gs._sgShield`
//       that the `beforeDamage` /
//       `beforeCreatureDamageBatch` hooks below
//       consume.
//
//    2. `isPreDamageReaction` — fires per-hero
//       inside the engine's pre-damage hand-
//       reaction window for direct hero damage
//       paths (recoil, status ticks, internally-
//       picked targets — any hero damage that
//       doesn't flow through a target prompt).
//       The resolver fully negates the single
//       target's damage.
//
//    3. `isCreaturePreDamageReaction` — sibling
//       of (2) but for the creature damage batch
//       path (Bear Rider's `actionDealCreature-
//       Damage`, etc.).
//
//  Dedup — when the post-target window resolves
//  (whether accepted or declined), we stamp
//  `gs._sgPromptedFor[pi] = true`. The per-target
//  windows check the flag and skip, so a multi-
//  target source that already offered the player
//  one prompt doesn't re-prompt per individual
//  entry. Cleared at chain-resolve.
//
//  ── ALL CARD-SPECIFIC STATE / HOOKS LIVE HERE ──
//
//  Shield consumption (the post-target stamp is
//  consumed when damage actually lands) goes
//  through the engine's generic `beforeDamage`
//  and `beforeCreatureDamageBatch` hooks below.
//  The engine has zero knowledge of "Sculpture
//  Guards" — it just dispatches the generic
//  damage hooks; this script reads its own
//  `gs._sgShield` set and mutates the ctx /
//  entries to cancel damage. Same pattern as Sun
//  Sword's burn-on-attack and every other
//  damage-time card-side effect.
//
//  `activeIn: ['hand', 'discard']` ensures the
//  hooks fire BOTH while a copy sits in hand
//  (rare — the shield is stamped only after the
//  card has been consumed from hand to discard,
//  but the engine's pile-listener safety net
//  fires hooks from either zone) AND after the
//  card has been routed to discard by the
//  post-target framework. Cleanup happens in the
//  generic `onChainResolve` hook.
// ═══════════════════════════════════════════

const CARD_NAME = 'Sculpture Guards';

module.exports = {
  // Cards.json subtype 'Reaction' + engine validateActionPlay's
  // reaction-subtype filter block proactive Main-Phase casts.
  canActivate: () => false,

  // Hooks fire from hand (defensive) and discard (where the card sits
  // once the post-target framework consumes it). The pile-listener
  // safety net ensures a tracked inst exists in either zone.
  activeIn: ['hand', 'discard'],

  // ── Batch-level (multi-target / AoE) ─────────────────────────────
  isPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedTargets, sourceCard, opts) {
    // "when a Frozen target you control would take ANY DAMAGE" — never
    // chain to non-damage targeting. See Spectral Armor.
    if (opts && opts.dealsDamage === false) return false;
    if (_alreadyPrompted(gs, pi)) return false;
    const eligible = _collectFrozenOwnedTargets(gs, pi, engine, targetedTargets).length > 0;
    if (eligible) {
      // Stamp the per-player dedup flag NOW — even though the engine
      // hasn't fired the prompt yet, marking eligibility here ensures
      // that if the player DECLINES the upcoming prompt, the
      // downstream per-target hooks (preDamage / creaturePreDamage)
      // for this same damage source also skip. Setting it in the
      // resolver would only cover the accept path.
      _markPrompted(gs, pi);
    }
    return eligible;
  },

  async postTargetResolve(engine, pi, targetedTargets /*, sourceCard, opts */) {
    const candidates = _collectFrozenOwnedTargets(engine.gs, pi, engine, targetedTargets);
    if (candidates.length === 0) return { effectNegated: false };
    _markPrompted(engine.gs, pi);

    let picked;
    if (candidates.length === 1) {
      picked = candidates[0];
    } else {
      const pickerCandidates = candidates.map(c => ({
        id: c.id,
        type: c.type,
        owner: c.owner,
        heroIdx: c.heroIdx,
        slotIdx: c.slotIdx,
        cardName: c.cardName,
        cardInstance: c.cardInstance,
      }));
      const result = await engine.promptEffectTarget(pi, pickerCandidates, {
        title: CARD_NAME,
        description: 'Choose a Frozen target you control to shield from this source.',
        confirmLabel: '🛡️ Shield!',
        confirmClass: 'btn-info',
        cancellable: false,
        maxTotal: 1,
      });
      if (!result || result.length === 0) {
        picked = candidates[0];
      } else {
        picked = candidates.find(c => c.id === result[0]) || candidates[0];
      }
    }

    if (picked.type === 'hero') {
      _addShield(engine.gs, _keyForHero(picked.owner, picked.heroIdx));
    } else if (picked.cardInstance) {
      _addShield(engine.gs, _keyForInst(picked.cardInstance));
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_block',
      owner: picked.owner,
      heroIdx: picked.heroIdx,
      zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
    });
    await engine._delay(400);

    engine.log('sculpture_guards', {
      player: engine.gs.players[pi]?.username,
      shielded: picked.cardName,
    });
    engine.sync();

    return { effectNegated: false };
  },

  // ── Per-hero fallback (direct hero damage paths) ─────────────────
  isPreDamageReaction: true,

  preDamageCondition(gs, ownerIdx, engine, target, targetHeroIdx /*, source, amount, type */) {
    if (_alreadyPrompted(gs, ownerIdx)) return false;
    if (!target?.statuses?.frozen) return false;
    if (!_hasCaster(gs, ownerIdx, engine)) return false;
    _markPrompted(gs, ownerIdx);
    return true;
  },

  async preDamageResolve(engine, ownerIdx, target, targetHeroIdx, source /*, amount, type */) {
    _markPrompted(engine.gs, ownerIdx);
    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_block',
      owner: ownerIdx, heroIdx: targetHeroIdx, zoneSlot: -1,
    });
    await engine._delay(400);
    engine.log('sculpture_guards', {
      player: engine.gs.players[ownerIdx]?.username,
      shielded: target?.name, from: source?.name || '?',
    });
    return { negated: true };
  },

  // ── Per-creature fallback (direct creature damage paths) ─────────
  isCreaturePreDamageReaction: true,

  creaturePreDamageCondition(gs, ownerIdx, engine, creatureInst /*, source, amount, type */) {
    if (_alreadyPrompted(gs, ownerIdx)) return false;
    if (!creatureInst?.counters?.frozen) return false;
    if (!_hasCaster(gs, ownerIdx, engine)) return false;
    _markPrompted(gs, ownerIdx);
    return true;
  },

  async creaturePreDamageResolve(engine, ownerIdx, creatureInst, source /*, amount, type */) {
    _markPrompted(engine.gs, ownerIdx);
    const physSide = engine.physicalSide(creatureInst);
    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_block',
      owner: physSide, heroIdx: creatureInst.heroIdx, zoneSlot: creatureInst.zoneSlot,
    });
    await engine._delay(400);
    engine.log('sculpture_guards', {
      player: engine.gs.players[ownerIdx]?.username,
      shielded: creatureInst.name, from: source?.name || '?',
    });
    return { negated: true };
  },

  hooks: {
    /**
     * Consume the per-target shield mark for the incoming hero damage.
     * Returns nothing — mutates ctx in place. Fires for every tracked
     * Sculpture Guards inst, but only the first hook to match the
     * shield key consumes it; subsequent fires are no-ops. The hook
     * also short-circuits early when `ctx.cancelled` is already set
     * by a prior hook in the same dispatch.
     */
    beforeDamage: (ctx) => {
      if (ctx.cancelled) return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      const engine = ctx._engine;
      const tgtOwner = engine._findHeroOwner(target);
      if (tgtOwner < 0) return;
      const tgtHi = (engine.gs.players[tgtOwner]?.heroes || []).indexOf(target);
      if (tgtHi < 0) return;
      if (!_consumeShield(engine.gs, _keyForHero(tgtOwner, tgtHi))) return;
      engine.log('sculpture_guards_block', {
        target: engine._heroLabel(target), type: ctx.type,
      });
      ctx.cancelled = true;
    },

    /**
     * Consume the per-target shield mark for each entry in a creature
     * damage batch. Matches the legacy engine-side behaviour: walk
     * the entries, cancel the ones whose creature inst is shielded.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const engine = ctx._engine;
      const entries = ctx.entries;
      if (!Array.isArray(entries) || entries.length === 0) return;
      for (const e of entries) {
        if (e.cancelled || !e.inst) continue;
        if (!_consumeShield(engine.gs, _keyForInst(e.inst))) continue;
        e.cancelled = true;
        engine.log('sculpture_guards_block', { target: e.inst.name, type: e.type });
      }
    },

    /**
     * Chain-resolve cleanup. Both the per-target shield set and the
     * per-player prompt dedup map live for the duration of a single
     * chain resolution; clear them so the next chain starts fresh.
     */
    onChainResolve: (ctx) => {
      const gs = ctx._engine.gs;
      if (gs._sgShield) delete gs._sgShield;
      if (gs._sgPromptedFor) delete gs._sgPromptedFor;
    },
  },
};

// ─── Per-player prompt dedup (one prompt per damage source) ─────────

function _alreadyPrompted(gs, pi) {
  return !!gs._sgPromptedFor?.[pi];
}
function _markPrompted(gs, pi) {
  if (!gs._sgPromptedFor) gs._sgPromptedFor = {};
  gs._sgPromptedFor[pi] = true;
}

// ─── Per-target shield set + one-shot consume ───────────────────────

function _addShield(gs, key) {
  if (!key) return;
  if (!gs._sgShield) gs._sgShield = new Set();
  gs._sgShield.add(key);
}
function _consumeShield(gs, key) {
  const set = gs?._sgShield;
  if (!set || !key || !set.has(key)) return false;
  set.delete(key);
  return true;
}
function _keyForHero(ownerIdx, heroIdx) {
  return `hero-${ownerIdx}-${heroIdx}`;
}
function _keyForInst(inst) {
  if (!inst) return null;
  return `creature-${inst.id}`;
}

/**
 * Filter the source's target list to entries that are Frozen AND
 * controlled by `pi` (the activator). The engine's post-target
 * helper passes a mixed `targetedTargets` array containing both
 * `{ type: 'hero', owner, heroIdx, cardName }` and
 * `{ type: 'creature', owner, heroIdx, slotIdx, cardName }` entries
 * — we resolve the live state for each and emit picker-shaped
 * objects (with `cardInstance` included for the creature path so
 * the shield-key lookup works).
 */
function _collectFrozenOwnedTargets(gs, pi, engine, targetedTargets) {
  const out = [];
  if (!Array.isArray(targetedTargets)) return out;

  for (const t of targetedTargets) {
    if (!t) continue;
    if (t.type === 'hero') {
      const hero = gs.players[t.owner]?.heroes?.[t.heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      if (!hero.statuses?.frozen) continue;
      if (t.owner !== pi) continue;
      out.push({
        id: `hero-${t.owner}-${t.heroIdx}`,
        type: 'hero',
        owner: t.owner,
        heroIdx: t.heroIdx,
        cardName: hero.name,
      });
    } else if (t.type === 'creature' || t.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.zone === 'support'
        && (c.controller ?? c.owner) === t.owner
        && c.heroIdx === t.heroIdx
        && c.zoneSlot === t.slotIdx,
      );
      if (!inst || inst.faceDown) continue;
      if (!inst.counters?.frozen) continue;
      const ctrl = inst.controller ?? inst.owner;
      if (ctrl !== pi) continue;
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: ctrl,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
  }
  return out;
}

/**
 * Returns true iff the activator's side has at least one alive, non-
 * CC'd Hero who can cast Support Magic Lv0 — defensive guard so
 * the engine never offers a Sculpture Guards prompt with no legal
 * caster.
 */
function _hasCaster(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  const cardData = engine?._getCardDB?.()[CARD_NAME];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    if (engine?._canHeroActivateSurprise?.(pi, hi, CARD_NAME)) return true;
    if (engine?.heroMeetsLevelReq?.(pi, hi, cardData)) return true;
  }
  return false;
}
