// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Priest"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn delete a level 1 or lower Normal Destruction
//  Magic Spell from your discard pile to have this Creature use that
//  Spell as an additional Action as if it had Destruction Magic 1.
//
//  Implementation
//  ──────────────
//  • The Priest IS the caster — animations originate from its
//    Support slot (via `gs._spellCasterOverride`) and any recoil /
//    self-damage that the spell would deal to its casting hero is
//    redirected to the Priest's instance.
//  • The discard-pile delete is the COST, but it is only paid once
//    the spell actually commits (cancelling out of the spell's
//    target prompt no longer wastes the spell). Detection uses the
//    engine's `gs._spellCancelled` flag, which `promptDamageTarget`
//    and `aoeHit` set on cancel.
//  • Activation is hidden when no eligible spell exists.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Skeleton Priest';

/**
 * Lv1-or-lower Normal Destruction Magic Spells in this player's
 * discard pile. Returns a deduped {name, count} list.
 */
function eligibleSpells(ps, engine) {
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const counts = new Map();
  for (const name of (ps.discardPile || [])) {
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.cardType !== 'Spell') continue;
    if ((cd.subtype || '').toLowerCase() !== 'normal') continue;
    if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
    if ((cd.level || 0) > 1) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    return eligibleSpells(ps, engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const priestInst = ctx.card;
    if (!priestInst) return false;
    const heroIdx = priestInst.heroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    const candidates = eligibleSpells(ps, engine);
    if (candidates.length === 0) return false;

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: candidates.map(c => ({ name: c.name, source: 'discard', count: c.count })),
      title: CARD_NAME,
      description: 'Choose a Lv1-or-lower Normal Destruction Magic Spell from your discard pile to cast.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const spellName = picked.cardName;
    if (!candidates.some(c => c.name === spellName)) return false;

    // Verify still in discard, but DON'T remove it yet — the cost
    // is only paid once the cast itself commits (i.e. the player
    // didn't back out of the spell's target prompt).
    const discardIdx = ps.discardPile.indexOf(spellName);
    if (discardIdx < 0) return false;

    // ── Animation routing: Priest is the caster ──
    // `_spellCasterOverride` is the same hook Wolflesia uses. The
    // engine's `_broadcastEvent` rewrites caster-anchored animation
    // payloads (`sourceOwner` + `sourceHeroIdx` matching the host
    // hero, no `sourceZoneSlot` set) to inject Priest's slot, so
    // beams / projectiles / rams originate from Priest's tile.
    gs._spellCasterOverride = {
      owner: priestInst.owner,
      heroIdx: priestInst.heroIdx,
      zoneSlot: priestInst.zoneSlot,
    };

    // Track a temporary inst for the spell so its onPlay sees a
    // typical-shaped ctx. `heroIdx` matches Priest's host hero so
    // hero-anchored targeting / level lookups still work.
    const spellInst = engine._trackCard(spellName, pi, 'hand', heroIdx, -1);
    spellInst.turnPlayed = gs.turn || 0;

    // Build the spell's ctx via the engine helper, then patch the
    // self-damage / heal helpers so any reference to "the casting
    // hero" lands on Priest's inst instead. Phoenix Tackle's recoil
    // is the canonical case: `ctx.dealDamage(hero, recoil, 'other')`
    // where `hero === ps.heroes[heroIdx]`. We detect that exact
    // identity match and redirect.
    const spellCtx = engine._createContext(spellInst, {
      playedCard: spellInst, cardName: spellName, zone: 'hand',
      heroIdx,
      _onlyCard: spellInst, _skipReactionCheck: true,
      _viaSkeletonPriest: true,
    });
    const castingHero = ps.heroes?.[heroIdx] || null;
    const origDealDamage = spellCtx.dealDamage;
    const origDealTrueDamage = spellCtx.dealTrueDamage;
    const origHealHero = spellCtx.healHero;
    spellCtx.dealDamage = async (target, amount, type) => {
      if (target && target === castingHero) {
        return engine.actionDealCreatureDamage(
          spellInst, priestInst, amount, type || 'other',
          { sourceOwner: pi, canBeNegated: false },
        );
      }
      return origDealDamage(target, amount, type);
    };
    spellCtx.dealTrueDamage = async (target, amount, type, opts) => {
      if (target && target === castingHero) {
        return engine.actionDealTrueDamage(
          spellInst, priestInst, amount,
          { ...(opts || {}), type: type || 'other' },
        );
      }
      return origDealTrueDamage(target, amount, type, opts);
    };
    spellCtx.healHero = async (target, amount) => {
      if (target && target === castingHero) {
        return engine.actionHealCreature(spellInst, priestInst, amount);
      }
      return origHealHero(target, amount);
    };

    // Reset the cancel flag so we can detect a fresh cancellation
    // inside this nested cast. `aoeHit` and `promptDamageTarget`
    // both set `gs._spellCancelled = true` when their target prompt
    // bails — the canonical signal for "the player backed out".
    const prevCancelled = gs._spellCancelled;
    gs._spellCancelled = false;

    let castError = null;
    try {
      const script = loadCardEffect(spellName);
      if (typeof script?.hooks?.onPlay === 'function') {
        await script.hooks.onPlay(spellCtx);
      }
    } catch (err) {
      castError = err;
      console.error(`[Skeleton Priest] spell '${spellName}' onPlay threw:`, err.message);
    }

    const cancelled = gs._spellCancelled === true;
    // Restore prior flag so we don't leak this cast's signal back
    // to whatever outer flow invoked us.
    gs._spellCancelled = prevCancelled;
    delete gs._spellCasterOverride;
    engine._untrackCard(spellInst.id);

    // Pay the cost only on commit. Cancellations leave the spell
    // sitting in discard — the player can try again next turn (or
    // pick a different spell this turn? no: HOPT applies). If the
    // cast threw, treat as cancelled too so a buggy spell doesn't
    // burn the source.
    if (cancelled || castError) {
      engine.sync();
      return false;
    }

    // Verify still in discard at the original index — a downstream
    // listener could have shifted the pile, so re-find rather than
    // trusting the cached index.
    const finalIdx = ps.discardPile.indexOf(spellName);
    if (finalIdx >= 0) {
      ps.discardPile.splice(finalIdx, 1);
      if (!ps.deletedPile) ps.deletedPile = [];
      ps.deletedPile.push(spellName);
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName: spellName, from: 'discard', to: 'deleted',
      });
      engine.log('skeleton_priest_delete', { player: ps.username, spell: spellName });
    }

    engine.log('skeleton_priest_cast', { player: ps.username, spell: spellName });
    engine.sync();
    return true;
  },
};
