// ═══════════════════════════════════════════
//  CARD EFFECT: "Dark Deepsea God"
//  Creature (Summoning Magic Lv4 — bypassed) — 150 HP
//
//  Normal Action-cost summon with a tribute path:
//  sacrifice 2+ of your own Creatures (not summoned
//  this turn) whose combined original levels are
//  ≥ 4. Those Creatures return to HAND (not the
//  discard pile), and DDG takes ONE OF THEIR
//  VACATED SUPPORT ZONES, chosen by the controller.
//
//  The entire flow runs inside `beforeSummon` so
//  we can interleave the placement and the summon
//  animation:
//
//    1. Pick tributes (`promptEffectTarget`, the
//       standard click-to-select flow with a
//       `minSumLevel: 4` gate).
//    2. Pick which tributed slot DDG rises from
//       (`promptZonePick`). Runs before any bounce
//       so labels still read the tributed
//       Creatures' names.
//    3. Bounce every tribute back to hand via
//       `returnSupportCreatureToHand` — fires the
//       generic `onCardsReturnedToHand` hook so
//       Teppes / Siphem etc. react naturally.
//    4. Broadcast the DDG.png manifest and wait
//       HALF the animation duration so the card
//       materializes on the board at the midpoint.
//    5. Place DDG into the chosen slot via
//       `placeCreature` with `fireHooks: true`.
//       (DDG's own `onPlay` is intentionally
//       empty — all manifest / damage timing is
//       sequenced here so we can split placement
//       across the animation.)
//    6. Wait the remaining half of the manifest
//       so damage lands AFTER the image fades.
//    7. Claim a HARD ONCE PER TURN gate on the
//       AoE damage (`claimHOPT('ddg_aoe', pi)`).
//       If it was already used this turn by this
//       controller (e.g. a second DDG), the
//       animation still played but no damage is
//       dealt.
//    8. Apply 150 standard Creature damage to
//       every enemy target via the normal damage
//       pipelines so every immunity / shield /
//       protection path applies uniformly.
//    9. Set `ps._placementConsumedByCard` so the
//       server skips its default `summonCreature`
//       path (the card is already placed).
//
//  Playability flags:
//    • `canBypassLevelReq: () => true` — no
//      Summoning Magic needed.
//    • `canBypassFreeZoneRequirement` — the
//      casting Hero doesn't need a free slot
//      because DDG lands in a tributed slot.
//    • `getBouncePlacementTargets` — every
//      tribute-candidate slot is a drop target.
//    • `canPlaceOnOccupiedSlot` — server accepts
//      a drop on an occupied tribute candidate
//      (actual placement slot is still the one
//      chosen inside the zone-picker).
//    • `canSummon` greys DDG out in hand when
//      no valid tribute set is available.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { returnSupportCreatureToHand } = require('./_deepsea-shared');

const CARD_NAME = 'Dark Deepsea God';
const DAMAGE = 150;

// Full manifest runs 2500ms. The card materializes at the 50% mark so
// it's already on the board as the image peaks and fades. Halves are
// stored explicitly so both sides of the split are easy to tweak.
const MANIFEST_HALF_MS = 1250;

const SACRIFICE_SPEC = {
  minCount: 2,
  minSumLevel: 4,
};

function _collectTributeCandidates(engine, playerIdx, selfId) {
  let cs = engine.getSacrificableCreatures(playerIdx);
  if (selfId != null) cs = cs.filter(c => c.inst.id !== selfId);
  // DDG's text: "not summoned this turn." The generic
  // `getSacrificableCreatures` deliberately skips this filter (cards
  // like Sacrifice to Divinity sacrifice anything you control), so
  // DDG enforces it here.
  const currentTurn = engine.gs.turn || 0;
  cs = cs.filter(c => c.inst.turnPlayed !== currentTurn);
  return cs;
}

/**
 * DDG's on-summon effect: AoE `DAMAGE` to every opp Hero + Creature.
 * HOPT-gated (`ddg_aoe` per controller) so a second DDG this turn
 * still fires its manifest animation but does not double-dip. Used by
 * both the normal-summon path and Deepsea Monstrosity's copy path.
 * `sourceInst` is the damage source (DDG itself on normal summons,
 * Monstrosity on copies).
 */
async function _fireAoEAsSource(engine, pi, sourceInst, isCopy) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!engine.claimHOPT('ddg_aoe', pi)) {
    engine.log('dark_deepsea_god_repeat', {
      player: ps?.username,
      reason: 'ddg_aoe_already_fired_this_turn',
      viaCopy: !!isCopy,
    });
    return;
  }
  const oi = pi === 0 ? 1 : 0;
  const ops = gs.players[oi];
  if (!ops) return;
  const cardDB = engine._getCardDB();

  for (const h of (ops.heroes || [])) {
    if (!h?.name || h.hp <= 0) continue;
    await engine.actionDealDamage(sourceInst, h, DAMAGE, 'creature', {
      sourceOwner: pi, canBeNegated: true,
    });
  }

  const creatureEntries = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== oi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    creatureEntries.push({
      inst, amount: DAMAGE, type: 'creature',
      source: sourceInst, sourceOwner: pi, canBeNegated: true,
    });
  }
  if (creatureEntries.length > 0) {
    await engine.processCreatureDamageBatch(creatureEntries);
  }

  engine.log('dark_deepsea_god_awakened', {
    player: ps?.username, damage: DAMAGE,
    heroHits: (ops.heroes || []).filter(h => h?.name && h.hp >= 0).length,
    creatureHits: creatureEntries.length,
    viaCopy: !!isCopy,
  });
}

module.exports = {
  canBypassLevelReq: () => true,

  // DDG's text is "tribute 2+ Creatures NOT summoned this turn (sum-
  // level ≥ 4)". The `canSatisfySacrifice` engine helper doesn't apply
  // the not-summoned-this-turn rule on its own (cards like Sacrifice
  // to Divinity sacrifice anything you control), so we layer it on
  // here via spec.filter — otherwise DDG would highlight as playable
  // in hand on turns where the only available tributes were summoned
  // this turn (which can't actually pay the cost).
  canSummon: (ctx) => {
    const engine = ctx._engine;
    const turn = engine.gs?.turn || 0;
    return engine.canSatisfySacrifice(ctx.cardOwner, {
      ...SACRIFICE_SPEC,
      filter: (c) => (c.inst?.turnPlayed || 0) !== turn,
    }, ctx.card?.id);
  },

  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) => {
    const turn = engine.gs?.turn || 0;
    return engine.canSatisfySacrifice(pi, {
      ...SACRIFICE_SPEC,
      filter: (c) => (c.inst?.turnPlayed || 0) !== turn,
    }, null);
  },

  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine) => {
    const cands = _collectTributeCandidates(engine, pi, null);
    return cands.some(c => c.inst.heroIdx === heroIdx && c.inst.zoneSlot === slotIdx);
  },
  getBouncePlacementTargets: (gs, pi, engine) =>
    _collectTributeCandidates(engine, pi, null)
      .map(c => ({ heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot })),

  beforeSummon: async (ctx) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // ═════════════════════════════════════════════════════════════════
    //  Two distinct entry paths.
    //
    //  NORMAL SUMMON:
    //    • Summoning condition → tribute 2+ own Creatures (sum-level ≥4).
    //    • On-summon effect    → AoE 90 to every opp target.
    //    Both live together in `beforeSummon` historically because DDG's
    //    placement-inside-a-tribute-slot animation couples them.
    //
    //  DEEPSEA MONSTROSITY COPY (`ctx._monstrosityCopy`):
    //    • The COST (tribute of 2 creatures) is DDG's SUMMONING
    //      CONDITION, not its on-summon effect, so it does NOT copy.
    //    • Only the AoE is the on-summon effect — that's what Monstrosity
    //      should fire.
    //    • HOPT still gates it (one detonation per turn per controller).
    // ═════════════════════════════════════════════════════════════════
    const isCopy = !!ctx._monstrosityCopy;

    if (isCopy) {
      await _fireAoEAsSource(engine, pi, ctx.card, /*isCopy*/ true);
      // Return value is ignored on the copy path — we're not in an
      // actual summon flow. Return false so no unintended side effects.
      return false;
    }

    // ── Normal summon from here ──────────────────────────────────────
    const candidates = _collectTributeCandidates(engine, pi, ctx.card?.id);
    if (!engine.hasValidSacrificeSet(candidates, SACRIFICE_SPEC.minCount, 0, SACRIFICE_SPEC.minSumLevel)) {
      engine.log('ddg_fizzle', { reason: 'no_valid_tribute' });
      return false;
    }

    // ── Step 1: pick the tribute set ─────────
    const targets = candidates.map(c => ({
      id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
      type: 'equip', owner: c.inst.owner,
      heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
      cardName: c.cardName, cardInstance: c.inst,
      _meta: { level: c.level, maxHp: c.maxHp },
    }));

    const picked = await engine.promptEffectTarget(pi, targets, {
      title: `${CARD_NAME} — Tribute`,
      description: 'Select 2+ of your Creatures (not summoned this turn) whose combined original levels are 4 or higher. They will be returned to your hand.',
      confirmLabel: '🌊 Confirm Tribute',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: targets.length,
      minRequired: SACRIFICE_SPEC.minCount,
      minSumLevel: SACRIFICE_SPEC.minSumLevel,
    });
    if (!picked || picked.length < SACRIFICE_SPEC.minCount) return false;

    const chosenTargets = picked.map(id => targets.find(t => t.id === id)).filter(Boolean);
    if (chosenTargets.length < SACRIFICE_SPEC.minCount) return false;
    const sumLvl = chosenTargets.reduce((s, t) => s + (t._meta.level || 0), 0);
    if (sumLvl < SACRIFICE_SPEC.minSumLevel) return false;

    // ── Step 2: pick DDG's placement slot (one of the tribute slots) ──
    const zones = chosenTargets.map(t => {
      const hero = ps.heroes[t.heroIdx];
      return {
        heroIdx: t.heroIdx, slotIdx: t.slotIdx,
        label: `${hero?.name || 'Hero'} — ${t.cardName} (Slot ${t.slotIdx + 1})`,
      };
    });
    const zonePick = await ctx.promptZonePick(zones, {
      title: `${CARD_NAME} — Rise From`,
      description: `Pick which tributed Support Zone ${CARD_NAME} rises into.`,
      cancellable: true,
    });
    if (!zonePick) return false;

    // ── Step 3: bounce every chosen Creature back to hand ────────────
    // Non-landing tributes first, landing tribute last so the destination
    // slot stays "occupied by a departing sacrifice" right up to the
    // moment DDG takes its place.
    const landingInst = chosenTargets.find(t =>
      t.heroIdx === zonePick.heroIdx && t.slotIdx === zonePick.slotIdx
    )?.cardInstance;
    const others = chosenTargets
      .filter(t => !(t.heroIdx === zonePick.heroIdx && t.slotIdx === zonePick.slotIdx))
      .map(t => t.cardInstance);
    for (const inst of others) {
      if (!inst) continue;
      await returnSupportCreatureToHand(engine, inst, CARD_NAME);
    }
    if (landingInst) {
      await returnSupportCreatureToHand(engine, landingInst, CARD_NAME);
    }

    // ── Step 4: start the manifest, then wait to the midpoint ───────
    engine._broadcastEvent('dark_deepsea_god_manifest', { owner: pi });
    engine._broadcastEvent('hero_announcement', { text: `${CARD_NAME} awakens!` });
    await engine._delay(MANIFEST_HALF_MS);

    // ── Step 5: place DDG into the vacated landing slot ─────────────
    const result = await engine.actionPlaceCreature(CARD_NAME, pi, zonePick.heroIdx, zonePick.slotIdx, {
      source: 'external',
      sourceName: CARD_NAME,
      animationType: 'none',
      fireHooks: true,
    });
    if (!result) return false;

    // ── Step 6: wait the remaining half of the animation ────────────
    await engine._delay(MANIFEST_HALF_MS);

    // ── Step 7 + 8: on-summon AoE, HOPT-gated ───────────────────────
    await _fireAoEAsSource(engine, pi, result.inst, /*isCopy*/ false);

    // ── Step 9: server skips summonCreature ─────────────────────────
    ps._placementConsumedByCard = CARD_NAME;
    engine.log('ddg_summon', {
      player: ps.username,
      tributed: chosenTargets.map(t => t.cardName),
      landedAt: { heroIdx: zonePick.heroIdx, slotIdx: zonePick.slotIdx },
    });
    engine.sync();
    return false;
  },

  // onPlay is intentionally a no-op. The manifest + damage sequence is
  // orchestrated inside beforeSummon so we can appear the card ON the
  // board in the middle of its entrance animation — placing DDG fires
  // this hook at the animation midpoint, and we explicitly don't want
  // it to spawn a second animation / extra damage (e.g. via Blood Moon
  // under the Sea's retrigger, which would pass through here).
  hooks: {},
};
