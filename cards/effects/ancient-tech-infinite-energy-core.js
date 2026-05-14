// ═══════════════════════════════════════════
//  CARD EFFECT: "Ancient Tech Infinite Energy Core"
//  Artifact (Equipment, Cost 10)
//
//  Equipped Hero's ATK is increased by 10 × the
//  number of cards with DIFFERENT NAMES in the
//  controller's discard pile. Recomputed live as
//  the pile mutates — every Spell / Attack /
//  non-equip Artifact resolving to discard, every
//  Creature death, every Mill, every forced
//  discard, every revival pulling a name back out.
//
//  Implementation
//  ──────────────
//  • Bonus is stored as `inst.counters.atkGranted`
//    so the engine's standard `actionRevokeAtk`
//    cleanly removes the full amount when the
//    Equip leaves play. The recompute writes the
//    NEW bonus and applies the delta to hero.atk
//    directly — same shape as a Fighting bump,
//    so the UI's `fighting_atk_change` broadcast
//    flashes the change.
//
//  • The recompute hook fires on every event that
//    can plausibly mutate the discard pile. The
//    set is intentionally redundant: `onAny-
//    ActionResolved` already covers most resolved
//    actions, but the specific `onDiscard` /
//    `onMill` / `onCreatureDeath` / `afterSpell-
//    Resolved` hooks let the bonus update WITHIN
//    a chain (e.g. mid-attack, after a creature
//    dies, so the next damage instance reads the
//    updated ATK). `onTurnStart` is a periodic
//    safety net for any path that mutates the
//    pile without firing any of the above.
//
//  • Recompute is O(N) on the discard size with a
//    Set construction — cheap. The function early-
//    returns when the delta is zero, so most of
//    the hook fires are no-ops anyway and the
//    `fighting_atk_change` floater only surfaces
//    when something actually changed.
//
//  • Standard `onCardLeaveZone` revoke path: when
//    the Equip itself leaves its support slot
//    (destroyed / returned to hand / moved /
//    etc.), the full atkGranted is subtracted off
//    hero.atk via `ctx.revokeAtk()`.
// ═══════════════════════════════════════════

const CARD_NAME = 'Ancient Tech Infinite Energy Core';
const BONUS_PER_UNIQUE = 10;

/**
 * Recompute the ATK bonus and apply the delta vs. the previously
 * granted amount. Idempotent — a no-op when nothing changed, so
 * it's safe to fire on every plausibly-related hook.
 */
function recomputeBonus(ctx) {
  const engine = ctx._engine;
  const inst = ctx.card;
  if (!inst || inst.zone !== 'support') return;

  const owner = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const hero = engine.gs.players[owner]?.heroes?.[heroIdx];
  if (!hero?.name) return;

  const ps = engine.gs.players[owner];
  const uniqueCount = new Set(ps?.discardPile || []).size;
  const newBonus = uniqueCount * BONUS_PER_UNIQUE;

  if (!inst.counters) inst.counters = {};
  const currentBonus = inst.counters.atkGranted || 0;
  const delta = newBonus - currentBonus;
  if (delta === 0) return;

  hero.atk = Math.max(0, (hero.atk || 0) + delta);
  inst.counters.atkGranted = newBonus;

  engine._broadcastEvent('fighting_atk_change', {
    owner, heroIdx, amount: delta,
  });
  engine.log('ancient_tech_atk', {
    hero: hero.name, newBonus, uniqueCount, delta,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    // Initial calc on first placement + puzzle preset boards.
    onPlay:      (ctx) => recomputeBonus(ctx),
    onGameStart: (ctx) => recomputeBonus(ctx),

    // Discard-pile mutation triggers.
    //   afterSpellResolved   — Spell / Attack / Artifact lands in discard
    //   onAnyActionResolved  — hero effects, creature summons, ability
    //                          activations (catch-all post-action)
    //   onDiscard            — forced hand-side discards (Mill, Magenta,
    //                          self-discard equips, …)
    //   onMill               — deck → discard
    //   onCreatureDeath      — creature body to discard (mid-batch so
    //                          chained attacks see the updated ATK)
    //   onTurnStart          — safety-net refresh
    afterSpellResolved:  (ctx) => recomputeBonus(ctx),
    onAnyActionResolved: (ctx) => recomputeBonus(ctx),
    onDiscard:           (ctx) => recomputeBonus(ctx),
    onMill:              (ctx) => recomputeBonus(ctx),
    onCreatureDeath:     (ctx) => recomputeBonus(ctx),
    onTurnStart:         (ctx) => recomputeBonus(ctx),

    // Standard equip-removal revoke. The strict slot match ensures
    // this only fires for THIS Equip leaving its own support slot,
    // not for unrelated cards passing through onCardLeaveZone.
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== ctx.card.heroIdx) return;
      if (ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
    },
  },
};
