// ═══════════════════════════════════════════
//  CARD EFFECT: "Outbreak"
//  Spell (Destruction Magic Lv 1, Normal)
//
//  This Spell can ONLY be used by a Hero with at
//  least 1 negative status effect, but it can be
//  used IN SPITE OF those negative status effects
//  (Frozen / Stunned / Bound / Nulled / Burned /
//  Poisoned / etc.).
//
//  Choose a target → 100 damage. Then heal the
//  user from all negative status effects. If the
//  damage defeats the target, the user may
//  immediately perform an additional Action.
//
//  Implementation
//  ──────────────
//  • `canPlayWithHero` — per-hero gate. The
//    hero must have ≥ 1 cleansable negative
//    status; without one, Outbreak is dimmed in
//    that hero's eligible-cards list.
//  • `canPlayDespiteStatuses` — engine hook (the
//    generic "ignore the paralysis / Nulled
//    blocks for this card" opt-in added for
//    Outbreak's class of effects). Lets a frozen
//    / stunned / bound / nulled hero cast in
//    spite of that. Hero must still be alive —
//    a corpse never qualifies.
//  • `cleanseHeroStatuses` — the standard cleanse
//    helper. Removes all NEGATIVE statuses
//    Juice / Tea / Beer would also strip; same
//    list `getCleansableStatuses` returns.
//  • Defeat detection — re-check the target's HP
//    AFTER the damage call. If a hero dropped to
//    0 (or a creature was untracked from
//    support), call `engine.performImmediateAction`
//    so the user gets a bonus Action with the
//    standard hero-locked prompt UX.
// ═══════════════════════════════════════════

const { getNegativeStatuses, getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Outbreak';
const DAMAGE    = 100;

function heroHasAnyNegativeStatus(hero) {
  if (!hero?.statuses) return false;
  for (const k of getNegativeStatuses()) {
    if (hero.statuses[k]) return true;
  }
  return false;
}

module.exports = {
  /**
   * Per-hero gate: this Hero must currently have at least 1 negative
   * status to be eligible. Used both client-side (dim the card if no
   * own hero qualifies) and server-side (validateActionPlay re-runs
   * this before the cast).
   */
  canPlayWithHero(gs, pi, heroIdx /* , cardData, engine */) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return heroHasAnyNegativeStatus(hero);
  },

  /**
   * Generic "in spite of negative statuses" hook — bypasses the
   * frozen / stunned / bound paralysis gate AND the Nulled-spell
   * gate (engine reads it from both sites). The dead-hero gate is
   * unconditional and does NOT bypass; Outbreak still requires a
   * living user.
   *
   * The condition mirrors `canPlayWithHero` so a hero with 0
   * negative statuses (e.g. recently cleansed) doesn't accidentally
   * get the bypass on top of failing the prerequisite.
   */
  canPlayDespiteStatuses(gs, pi, heroIdx /* , cardData, engine */) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return heroHasAnyNegativeStatus(hero);
  },

  /**
   * Optimistic deck-level condition — exists somewhere on the field
   * is a Hero who could cast this. Backstops `canPlayWithHero`'s
   * per-hero check.
   */
  spellPlayCondition(gs, pi /* , engine */) {
    const ps = gs.players[pi];
    if (!ps) return false;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0 && heroHasAnyNegativeStatus(h)) return true;
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps     = gs.players[pi];
      const userHero = ps?.heroes?.[heroIdx];
      if (!userHero?.name || userHero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Step 1: pick a target ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target. The user is then cleansed.`,
        confirmLabel: `🦠 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // Snapshot the target's "alive" state for the kill-detect step.
      let aliveBefore = false;
      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        aliveBefore = !!(h?.name && h.hp > 0);
      } else if (target.cardInstance) {
        const cd = engine._getCardDB()[target.cardInstance.name];
        const hp = target.cardInstance.counters?.currentHp ?? cd?.hp ?? 0;
        aliveBefore = hp > 0;
      }

      // ── Step 2: deal the damage ──
      // Layered animation: the existing plague-smoke cloud overlaps an
      // explosion burst on the same target. Both events fire on the
      // SAME tick so the visual reads as a single combined effect
      // rather than a sequence — `play_zone_animation` handlers each
      // mount their own particle layer, so stacking two events on one
      // zone composites cleanly without one canceling the other.
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', {
        type: 'plague_smoke',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot,
      });
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(400);

      const dmgSource = { name: CARD_NAME, owner: pi, heroIdx };
      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h && h.hp > 0) {
          await engine.actionDealDamage(dmgSource, h, DAMAGE, 'destruction_spell');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          dmgSource, target.cardInstance, DAMAGE, 'destruction_spell',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      // ── Step 3: cleanse the user's negative statuses ──
      const cleansable = getCleansableStatuses();
      // The host might have been moved/affected by the damage step (rare —
      // damage rarely targets self), so re-resolve the live reference.
      const liveUser = gs.players[pi]?.heroes?.[heroIdx];
      if (liveUser?.name && liveUser.hp > 0) {
        engine.cleanseHeroStatuses(liveUser, pi, heroIdx, cleansable, CARD_NAME);
        engine._broadcastEvent('play_zone_animation', {
          type: 'heal_sparkle',
          owner: pi, heroIdx, zoneSlot: -1,
        });
        engine.sync();
        await engine._delay(300);
      }

      // ── Step 4: bonus Action if the damage killed the target ──
      let killedTarget = false;
      if (aliveBefore) {
        if (target.type === 'hero') {
          const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
          killedTarget = !h?.name || h.hp <= 0;
        } else if (target.cardInstance) {
          const stillTracked = engine.cardInstances.some(c => c.id === target.cardInstance.id && c.zone === 'support');
          killedTarget = !stillTracked || (target.cardInstance.counters?.currentHp ?? 1) <= 0;
        }
      }

      if (killedTarget && liveUser?.name && liveUser.hp > 0) {
        await engine.performImmediateAction(pi, heroIdx, {
          title: CARD_NAME,
          description: `${liveUser.name} may perform an additional Action!`,
        });
      }

      engine.log('outbreak_resolve', {
        player: ps.username,
        target: target.cardName,
        killed: killedTarget,
      });
      engine.sync();
    },
  },
};
