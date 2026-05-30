// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Angel Molinda"
//  Hero — Two passive effects, both gated on the
//  damage source being CARD-PLAYED-BY-MOLINDA
//  (her heroIdx + owner).
//
//  1) Creatures take no damage from her Attacks
//     and Spells. Damage entries with type
//     'attack' or '*_spell' whose source is her
//     hero get `amount = 0` in
//     beforeCreatureDamageBatch — animation still
//     plays, "0" floater shows.
//
//  2) Whenever she "hits" a Creature with an
//     Attack or Spell, the controller may take
//     permanent control of that Creature and
//     place it into one of HER free Support
//     Zones. Triggered in afterCreatureDamageBatch
//     so we see the post-batch entry list. The
//     hit counts even though damage was zeroed:
//     the Spell/Attack still resolved against the
//     Creature, exactly like Cardinal Beast
//     immunity blocks visible damage but still
//     counts as a "hit".
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Angel Molinda';

/**
 * Damage type filter for "Attacks and Spells".
 *   • 'attack'          — Attack card / executeAttack flow.
 *   • any '*_spell'     — 'destruction_spell' today, future-proofs
 *                         against new Spell-school damage tags
 *                         (matches Vinepire's helper).
 * Status ticks ('fire', 'poison'), 'creature', 'artifact',
 * 'status', 'other' are excluded — none of those are "Attacks
 * and Spells" in the rules sense.
 */
function _isAttackOrSpellType(t) {
  if (typeof t !== 'string') return false;
  return t === 'attack' || t.endsWith('_spell');
}

/**
 * Source matches Molinda's hero slot. Damage source objects
 * carry `{ owner, heroIdx, ... }` for every Attack / Spell
 * channel the engine routes through.
 */
function _isFromMolinda(source, ctx) {
  if (!source || typeof source !== 'object') return false;
  return source.owner === ctx.cardOwner
      && source.heroIdx === ctx.cardHeroIdx;
}

/**
 * Free Support Zones under Molinda's hero column. Returns
 * `[]` if she's KO'd or her column has no empty slots —
 * matches dark-gear.js' getFreeZones, scoped to one hero.
 */
function _molindaFreeZones(engine, ctx) {
  const ps = engine.gs.players[ctx.cardOwner];
  if (!ps) return [];
  const heroIdx = ctx.cardHeroIdx;
  const hero = ps.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  const slots = ps.supportZones?.[heroIdx] || [];
  const zones = [];
  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si] || [];
    if (slot.length === 0) {
      zones.push({
        heroIdx,
        slotIdx: si,
        label: `${hero.name} — Slot ${si + 1}`,
      });
    }
  }
  return zones;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Effect 1 — zero out damage entries sourced from Molinda's
     * hero on Creature targets when the type is an Attack or
     * Spell. Uses `e.amount = 0` (not `e.cancelled`) so the
     * caller's animation still plays and the engine emits the
     * "0" floater on the target — players see the strike land
     * harmlessly, mirroring how Cardinal Beast immunity reads.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const entries = ctx.entries;
      if (!entries) return;
      for (const e of entries) {
        if (e.cancelled) continue;
        if (!_isAttackOrSpellType(e.type)) continue;
        if (!_isFromMolinda(e.source, ctx)) continue;
        e.amount = 0;
      }
    },

    /**
     * Effect 2 — after the batch resolves, prompt the controller
     * (per Creature) to take permanent control. Permanent steal
     * goes through `actionTransferCreature`, which updates
     * controller + owner + zone fields, plays the transfer
     * animation, and fires onCardLeaveZone / onCardEnterZone
     * (with `_isMove: true` so summon-gated reactors don't
     * misfire). Iterates serially so the player decides one at a
     * time and the free-zone count stays accurate as zones fill
     * up mid-loop.
     *
     * Immunity gating — must skip Creatures the steal can't
     * legally land on, even though Molinda's hit "happened":
     *   • `e._immuneCreature` — engine-stamped (line 16584+) for
     *     Cardinal Beasts, Baihu petrify, Time-Bomblebee bomb-
     *     locked, Guardian-shielded, and currently temp-stolen
     *     (`_stealImmortal`) Creatures. They shrugged off the
     *     damage; they shrug off the steal too.
     *   • `engine.isCreatureImmune(inst, 'control_immune')` —
     *     the canonical control-immune check, which also folds
     *     in first-turn protection (`firstTurnProtectedPlayer`,
     *     engine.js:7374-7377) so freshly-played Creatures on a
     *     game-start-protected board can't be hijacked.
     */
    afterCreatureDamageBatch: async (ctx) => {
      const engine = ctx._engine;
      const entries = ctx.entries || [];

      // Collect Molinda-sourced creature hits, deduped on inst —
      // a multi-target Spell can list the same creature only
      // once, but defending against duplicate entries is cheap.
      // Filter out engine-flagged absolute-immune entries
      // (Cardinal / Baihu / Bomb-locked / Guardian / temp-stolen)
      // here so an immune Creature never even prompts.
      const hits = [];
      const seen = new Set();
      for (const e of entries) {
        if (!_isAttackOrSpellType(e.type)) continue;
        if (!_isFromMolinda(e.source, ctx)) continue;
        if (e._immuneCreature) continue;
        // Full negation (Idej Projection-style "and all associated
        // effects") — even though Molinda's text counts hits on
        // zero-damage Cardinal-immune Creatures, a full damage-event
        // negation also negates the hit-counter rider per the unified
        // engine rule. Cardinal Beast immunity stays distinct because
        // it sets `e._immuneCreature` (visible damage zeroed, hit
        // resolves) rather than `e.cancelled` (whole event negated).
        if (e.cancelled) continue;
        const inst = e.inst;
        if (!inst || seen.has(inst)) continue;
        seen.add(inst);
        hits.push(inst);
      }
      if (hits.length === 0) return;

      // Molinda must still be alive to route stolen Creatures
      // into her column.
      const ps = engine.gs.players[ctx.cardOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      for (const inst of hits) {
        // Re-validate every iteration: a parallel damage source
        // (status tick, chained reaction) could have killed the
        // Creature, or an earlier steal in this loop could have
        // moved it. Re-check immunity per Creature too — first-
        // turn protection / control_immune / new immune flags can
        // also be acquired mid-loop via reaction effects.
        if (!inst || (inst.counters?.currentHp ?? 1) <= 0) continue;
        const tgtCtrl = inst.controller ?? inst.owner;
        if (tgtCtrl === ctx.cardOwner) continue;
        // Per-side non-damage shield (The Great Wall of Deri). Molinda's
        // steal is a non-damage effect — opp's protected Creatures are
        // unreachable even though the preceding damage hit them legally
        // (damage targeting bypasses the shield, but the follow-up
        // control flip does not).
        if (engine._isSideNondamageShielded?.(tgtCtrl)) continue;
        if (engine.isCreatureImmune?.(inst, 'control_immune')) continue;
        if (inst.counters?._cardinalImmune) continue;
        if (inst.counters?._baihuPetrify) continue;
        if (inst.counters?._damageDestroyImmune) continue;
        if (inst.counters?._guardianImmune) continue;
        if (inst.counters?._stealImmortal) continue;

        const freeZones = _molindaFreeZones(engine, ctx);
        if (freeZones.length === 0) break; // No room — bail on remaining hits.

        const confirmed = await ctx.promptConfirmEffect({
          title: CARD_NAME,
          message: `Take permanent control of "${inst.name}" and place it into one of ${hero.name}'s free Support Zones?`,
        });
        if (!confirmed) continue;

        let chosen;
        if (freeZones.length === 1) {
          chosen = freeZones[0];
        } else {
          const picked = await engine.promptGeneric(ctx.cardOwner, {
            type: 'zonePick',
            zones: freeZones,
            title: CARD_NAME,
            description: `Choose a Support Zone under ${hero.name} for "${inst.name}".`,
            cancellable: false,
          });
          chosen = (picked && freeZones.find(z =>
            z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx
          )) || freeZones[0];
        }

        // ── Heart-burst flourish on charme ──
        // Three simultaneous heart_burst pops (~18 hearts each =
        // ~54 hearts total → "dozens of hearts") at the three
        // visual loci of the steal: Molinda herself (the
        // charmer), the Creature being whisked away (current
        // location), and the destination slot. The bursts kick
        // off BEFORE actionTransferCreature so they overlap with
        // its 800-ms card-flight animation — the hearts trail
        // the card as it crosses the board.
        // Animation source = PHYSICAL side (where the slot currently
        // renders, before the transfer flips it). Equivalent to
        // `inst.owner` under the standard convention; defensive
        // against temp-steal scenarios (Succubus) where the card
        // stayed on its original side.
        const srcOwner = engine.physicalSide(inst);
        const srcHeroIdx = inst.heroIdx;
        const srcSlotIdx = inst.zoneSlot;
        engine._broadcastEvent('play_zone_animation', {
          type: 'heart_burst', owner: ctx.cardOwner,
          heroIdx: ctx.cardHeroIdx, zoneSlot: -1,
        });
        engine._broadcastEvent('play_zone_animation', {
          type: 'heart_burst', owner: srcOwner,
          heroIdx: srcHeroIdx, zoneSlot: srcSlotIdx,
        });
        engine._broadcastEvent('play_zone_animation', {
          type: 'heart_burst', owner: ctx.cardOwner,
          heroIdx: chosen.heroIdx, zoneSlot: chosen.slotIdx,
        });
        await engine._delay(300);

        const result = await engine.actionTransferCreature(
          inst, ctx.cardOwner, chosen.heroIdx, chosen.slotIdx,
        );
        if (!result?.success) continue;

        // Trailing burst on the destination slot — the Creature
        // has just landed; finish the flourish where it now sits.
        engine._broadcastEvent('play_zone_animation', {
          type: 'heart_burst', owner: ctx.cardOwner,
          heroIdx: chosen.heroIdx, zoneSlot: chosen.slotIdx,
        });
        await engine._delay(400);

        engine.log('cute_angel_molinda_steal', {
          player: ps.username,
          creature: inst.name,
          toHero: hero.name,
        });
      }

      engine.sync();
    },
  },
};
