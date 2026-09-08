// ═══════════════════════════════════════════
//  CARD EFFECT: "Dichotomy of Luna and Tempeste"
//  Spell (Destruction Magic + Magic Arts Lv 1,
//  Attachment)
//
//  While attached to a Hero you control, ALL
//  Burned targets you control take HALF damage
//  (rounded up) from any source EXCEPT their own
//  Burn ticks. The damage they take cannot be
//  reduced further by any other effect.
//
//  Implementation
//  ──────────────
//  • Attachment lifecycle (Prophecy of Tempeste
//    pattern): on cast, place into the caster's
//    free Support Zone, fall back to other own
//    Heroes, fizzle if no slot. `_spellPlacedOnBoard`
//    keeps the card on the field instead of
//    routing to discard.
//  • Damage modifier (`beforeDamage` for heroes,
//    `beforeCreatureDamageBatch` for creatures):
//    if the target is on the controller's side
//    AND Burned AND the damage type is NOT
//    'burn' / 'status', halve the amount
//    (rounded up).
//  • "Cannot be reduced further" — engine-wide
//    flag the user added for Dichotomy's sake
//    but designed to be reusable. Set
//    `hookCtx.cannotBeReduced = true` on hero
//    damage events (or `entry.cannotBeReduced =
//    true` on creature batch entries) and the
//    engine's buff-multiplier pass + the ctx's
//    setAmount/modifyAmount setters all refuse
//    to drop the amount further.
//
//  Edge cases handled:
//   • Burned but the source IS Burn damage →
//     skip Dichotomy (Burn ticks are unaffected
//     by spec).
//   • Same-side hero is the source (e.g. own
//     Burning Finger recoil onto an own Burned
//     creature) → Dichotomy still halves; the
//     "your controller's" qualifier is purely
//     about the TARGET being on the same side
//     as Dichotomy's host, not about who deals
//     the damage.
//   • Nested redirects (Tempeste-style) — they
//     re-fire damage against the host, which
//     might or might not be Burned; this hook
//     re-evaluates per damage event so each
//     hit is independently checked.
// ═══════════════════════════════════════════

const CARD_NAME = 'Dichotomy of Luna and Tempeste';

function findFreeSlot(ps, heroIdx) {
  const sz = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let si = 0; si < 3; si++) {
    if (((sz[si] || []).length) === 0) return si;
  }
  return -1;
}

function ownerHasAttachableHero(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (findFreeSlot(ps, hi) >= 0) return true;
  }
  return false;
}

// Dichotomy can attach to ANY alive Hero on the board with a free
// Support slot — own OR opponent's. The "your controller's" check on
// damage modification still references whichever side ends up hosting,
// so attaching to an opponent's Hero turns Dichotomy's halving into a
// gift to the opponent's Burned targets. Intentional per spec.
function anyPlayerHasAttachableHero(gs) {
  for (let pi = 0; pi < 2; pi++) {
    const ps = gs.players[pi];
    if (ps && ownerHasAttachableHero(ps)) return true;
  }
  return false;
}

/**
 * Card text: "Burned targets you control take half damage from all
 * sources, except their Burn damage". The ONLY exception is Burn.
 * Poison ticks, status damage from other sources, and every other
 * damage type are halved like normal — no broader carve-out.
 *
 * Match: source.name === 'Burn'. The engine fires Burn ticks via
 * `actionDealDamage({ name: 'Burn' }, hero, AMOUNT, 'fire')` and
 * `actionDealCreatureDamage(... type='fire', source: { name: 'Burn' })`.
 * Damage TYPE is `'fire'` (not `'burn'`) — a type-only check would
 * miss Burn ticks AND would over-match other fire-typed damage.
 * Source name is the precise discriminator.
 */
function isBurnTick(source) {
  return source?.name === 'Burn';
}

const { candidateHosts, attachmentHostsFor, attachToHero } = require('./_attachment-shared');

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs, pi, engine) {
    return candidateHosts(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }).length > 0;
  },
  attachmentHosts(gs, pi, engine) { return attachmentHostsFor(gs, pi, engine, { sides: [pi, pi === 0 ? 1 : 0] }); }, // v651: beide Seiten als Drop-Ziel

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      // The casting Hero — used by the drag-onto-Hero auto-place tier
      // below to land Dichotomy on the SPECIFIC Hero the player
      // dropped on (Hero 2's slot, not Hero 1's). Lost in the previous
      // refactor; re-pulled here so the auto-place isn't ReferenceError.
      const heroIdx = ctx.cardHeroIdx;

      // ── Build target list: every alive Hero on either side with at
      // least one free Support slot. Mixed hero + equip targets so the
      // picker highlights both the Hero portrait AND the candidate
      // slots — same shape Guardian Angel uses.
      // v650: Anlegen ueber den geteilten Vorgang — beide Seiten, Caster-
      // Held als Vorgabe (bisheriges Verhalten), Anti-Magic-Schutz inklusive.
      const res = await attachToHero(ctx, CARD_NAME, {
        sides: [pi, pi === 0 ? 1 : 0], preferCaster: true,
        description: 'Choose a Hero to attach Dichotomy of Luna and Tempeste to.',
        confirmLabel: '🌗 Attach!', confirmClass: 'btn-info', skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const destOwner = host.owner, destHero = host.heroIdx;
      const destPs = gs.players[destOwner];
      engine.log('dichotomy_attached', {
        player: gs.players[pi].username,
        hero: destPs.heroes[destHero]?.name,
        targetOwner: destPs.username,
      });

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHero,
        _skipReactionCheck: true,
      });
      engine.sync();
    },

    /**
     * Hero damage — halve if the target hero is on this controller's
     * side AND Burned, except when the source is Burn damage itself.
     * Lock the amount so subsequent reductions can't shave further.
     */
    beforeDamage: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.cancelled) return;
      if (ctx.amount == null || ctx.amount <= 0) return;
      if (isBurnTick(ctx.source)) return;

      const target = ctx.target;
      if (!target?.statuses?.burned) return;

      const ownerIdx = ctx.cardOwner;
      const targetOwnerIdx = ctx._engine._findHeroOwner?.(target);
      if (targetOwnerIdx !== ownerIdx) return;

      // Punkt vor Strich (Al 1.9.): Halbierung als MULTIPLIKATOR, flat
      // Modifikatoren (Tempeste −100 …) rechnet die Engine danach.
      ctx.multiplyAmount(0.5);
      ctx.lockReduction();
    },

    /**
     * Creature damage — same logic against batch entries. Iterating
     * directly because batch listeners mutate `entry.amount` /
     * `entry.cannotBeReduced` in place; the engine's buff-multiplier
     * pass downstream honours the lock.
     *
     * Stacking guard: respect `entry.cannotBeReduced` from prior
     * listeners (including a previous Dichotomy in this same chain) —
     * the lock means "this is the floor; no further reductions". The
     * hero side gets this guard automatically via `ctx.setAmount`'s
     * built-in `cannotBeReduced` check; the creature side has to
     * enforce it by hand because we mutate `e.amount` directly.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const ownerIdx = ctx.cardOwner;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (e.cannotBeReduced) continue; // already locked by a prior reducer
        if (!e.inst) continue;
        if (!e.inst.counters?.burned) continue;
        if ((e.inst.controller ?? e.inst.owner) !== ownerIdx) continue;
        if (isBurnTick(e.source)) continue;
        if (e.amount == null || e.amount <= 0) continue;

        e.multiplyAmount(0.5);   // Punkt vor Strich
        e.cannotBeReduced = true;
      }
    },
  },
};
