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

module.exports = {
  activeIn: ['hand', 'support'],

  spellPlayCondition(gs /* , playerIdx, engine */) {
    return anyPlayerHasAttachableHero(gs);
  },

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
      const targets = [];
      for (let p = 0; p < 2; p++) {
        const tps = gs.players[p];
        if (!tps) continue;
        for (let hi = 0; hi < (tps.heroes || []).length; hi++) {
          const hero = tps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          let hasFreeZone = false;
          for (let si = 0; si < 3; si++) {
            const slot = (tps.supportZones[hi] || [])[si] || [];
            if (slot.length !== 0) continue;
            hasFreeZone = true;
            targets.push({
              id: `equip-${p}-${hi}-${si}`,
              type: 'equip',
              owner: p,
              heroIdx: hi,
              slotIdx: si,
              cardName: '',
            });
          }
          if (hasFreeZone) {
            targets.push({
              id: `hero-${p}-${hi}`,
              type: 'hero',
              owner: p,
              heroIdx: hi,
              cardName: hero.name,
            });
          }
        }
      }
      if (targets.length === 0) { gs._spellCancelled = true; return; }

      // ── Resolve destination ────────────────────────────────────
      // Priority order (drag UX always wins over the picker):
      //   1. `gs._attachmentZoneSlot` set — the player drag-dropped on
      //      a SPECIFIC support slot of the casting Hero. Use it.
      //   2. Drag-onto-Hero (caster `heroIdx` known, slot unspecified):
      //      auto-place on the caster's first free Support slot. This
      //      restores the natural drag-to-attach flow — players who
      //      drag the spell onto an own Hero with a free slot don't
      //      have to confirm a picker first.
      //   3. Click-from-hand or caster has no free slot: fall back to
      //      the cross-board picker (any Hero with a free slot, own or
      //      opponent's). The user can attach to an opponent's Hero
      //      via this path — drag is intentionally limited to the
      //      caster because the standard drag UI doesn't expose
      //      opponent support zones as drop targets.
      let destOwner = -1;
      let destHero  = -1;
      let destSlot  = -1;

      // (1) — explicit slot drag. Match BOTH the slot index AND the
      // heroIdx from the play context, so dropping on Hero 2's slot 0
      // lands on Hero 2's slot 0 even when Hero 1 also has a free
      // slot 0 (the previous version used only slot+owner and so
      // routed every attachment to whichever Hero showed up first
      // in `targets`).
      if (gs._attachmentZoneSlot != null && gs._attachmentZoneSlot >= 0
          && heroIdx != null && heroIdx >= 0) {
        const preTarget = targets.find(t =>
          t.type === 'equip'
          && t.owner === pi
          && t.heroIdx === heroIdx
          && t.slotIdx === gs._attachmentZoneSlot
        );
        if (preTarget) {
          destOwner = preTarget.owner;
          destHero  = preTarget.heroIdx;
          destSlot  = preTarget.slotIdx;
        }
      }

      // (2) — drag onto the caster Hero (no specific slot), auto-place
      // on the dropped Hero's first free slot.
      if (destSlot < 0 && heroIdx != null && heroIdx >= 0) {
        const ps = gs.players[pi];
        const sup = ps?.supportZones?.[heroIdx] || [];
        for (let si = 0; si < 3; si++) {
          if ((sup[si] || []).length === 0) {
            destOwner = pi;
            destHero  = heroIdx;
            destSlot  = si;
            break;
          }
        }
      }

      // (3) — picker fallback (click-cast, or caster's slots all full).
      if (destSlot < 0) {
        const picked = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description: 'Choose a Hero to attach Dichotomy of Luna and Tempeste to.',
          confirmLabel: '🌗 Attach!',
          confirmClass: 'btn-info',
          cancellable: true,
          exclusiveTypes: false,
          maxPerType: { hero: 1, equip: 1 },
          greenSelect: true,
        });
        if (!picked || picked.length === 0) { gs._spellCancelled = true; return; }
        const target = targets.find(t => t.id === picked[0]);
        if (!target) { gs._spellCancelled = true; return; }
        if (target.type === 'equip') {
          destOwner = target.owner;
          destHero  = target.heroIdx;
          destSlot  = target.slotIdx;
        } else {
          // Hero-portrait pick: auto-route to that Hero's first free slot.
          destOwner = target.owner;
          destHero  = target.heroIdx;
          const tps = gs.players[destOwner];
          for (let si = 0; si < 3; si++) {
            if (((tps.supportZones[destHero] || [])[si] || []).length === 0) {
              destSlot = si;
              break;
            }
          }
        }
      }
      if (destSlot < 0) { gs._spellCancelled = true; return; }

      // ── Place into the chosen Support Zone ──
      const destPs = gs.players[destOwner];
      if (!destPs.supportZones[destHero]) destPs.supportZones[destHero] = [[], [], []];
      if (!destPs.supportZones[destHero][destSlot]) destPs.supportZones[destHero][destSlot] = [];
      destPs.supportZones[destHero][destSlot].push(CARD_NAME);

      // Re-track from caster's hand → destination Hero's support zone.
      // The inst's `owner` stays at the caster (`pi`) so cardOwner-driven
      // listener routing on Dichotomy itself keeps firing for the caster's
      // hand-trigger context, while the inst's `heroIdx` reflects the
      // physical host. The damage hooks use `_findHeroOwner(target)` to
      // determine same-side-as-host eligibility, so attaching to an
      // opponent's Hero correctly halves the OPPONENT's burned targets.
      const oldInst = engine.cardInstances.find(c =>
        c.owner === pi && c.name === CARD_NAME && c.zone === 'hand' && c.id === ctx.card.id
      );
      if (oldInst) engine._untrackCard(oldInst.id);

      const inst = engine._trackCard(CARD_NAME, destOwner, 'support', destHero, destSlot);
      gs._spellPlacedOnBoard = true;

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

      const halved = Math.ceil(ctx.amount / 2);
      ctx.setAmount(halved);
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

        e.amount = Math.ceil(e.amount / 2);
        e.cannotBeReduced = true;
      }
    },
  },
};
