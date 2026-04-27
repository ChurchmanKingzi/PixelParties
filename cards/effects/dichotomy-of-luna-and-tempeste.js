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

/** Skip burn damage AND any "status" damage tick (poison ticks etc.). */
function isUnaffectedDamageType(type) {
  return type === 'burn' || type === 'status';
}

module.exports = {
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs, playerIdx /* , engine */) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    return ownerHasAttachableHero(ps);
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // ── Pick destination Hero + slot ──
      let destHero = -1;
      let destSlot = -1;
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0) {
        const si = gs._attachmentZoneSlot;
        const slot = (ps.supportZones[heroIdx] || [])[si] || [];
        if (slot.length === 0) { destHero = heroIdx; destSlot = si; }
      }
      if (destSlot < 0) {
        const si = findFreeSlot(ps, heroIdx);
        if (si >= 0) { destHero = heroIdx; destSlot = si; }
      }
      if (destSlot < 0) {
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          if (hi === heroIdx) continue;
          const h = ps.heroes[hi];
          if (!h?.name || h.hp <= 0) continue;
          const si = findFreeSlot(ps, hi);
          if (si >= 0) { destHero = hi; destSlot = si; break; }
        }
      }
      if (destSlot < 0) { gs._spellCancelled = true; return; }

      // ── Place into the chosen Support Zone ──
      if (!ps.supportZones[destHero]) ps.supportZones[destHero] = [[], [], []];
      if (!ps.supportZones[destHero][destSlot]) ps.supportZones[destHero][destSlot] = [];
      ps.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from hand → support
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard(CARD_NAME, pi, 'support', destHero, destSlot);
      gs._spellPlacedOnBoard = true;

      engine.log('dichotomy_attached', {
        player: ps.username, hero: ps.heroes[destHero]?.name,
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
      if (isUnaffectedDamageType(ctx.type)) return;

      const target = ctx.target;
      if (!target?.statuses?.burned) return;

      const ownerIdx = ctx.cardOwner;
      const targetOwnerIdx = ctx._engine._findHeroOwner?.(target);
      if (targetOwnerIdx !== ownerIdx) return;

      const halved = Math.ceil(ctx.amount / 2);
      ctx.setAmount(halved);
      ctx.lockReduction();
    },

    /**
     * Creature damage — same logic against batch entries. Iterating
     * directly because batch listeners mutate `entry.amount` /
     * `entry.cannotBeReduced` in place; the engine's buff-multiplier
     * pass downstream honours the lock.
     */
    beforeCreatureDamageBatch: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      const ownerIdx = ctx.cardOwner;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled) continue;
        if (!e.inst) continue;
        if (!e.inst.counters?.burned) continue;
        if ((e.inst.controller ?? e.inst.owner) !== ownerIdx) continue;
        if (isUnaffectedDamageType(e.type)) continue;
        if (e.amount == null || e.amount <= 0) continue;

        e.amount = Math.ceil(e.amount / 2);
        e.cannotBeReduced = true;
      }
    },
  },
};
