// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Dragon Pilot"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 150 HP.
//
//  ① Can only be summoned by sacrificing 2+ of
//    your own Creatures that were NOT summoned
//    this turn and whose combined max HP is
//    ≥ 300.
//  ② If ALL sacrificed Creatures were Level 1
//    or lower, summoning this Creature counts
//    as an additional Action (costs no action
//    slot).
//  ③ Up to 3 times per turn, when you discard
//    1+ cards, choose a target and deal 100
//    damage to it with a massive fireball.
//
//  The "additional Action" path is implemented
//  via `inherentAction` (true whenever a valid
//  all-Lv1 sacrifice subset exists). When this
//  path is taken, `beforeSummon` restricts the
//  tribute picker to Lv1-or-lower candidates so
//  the player cannot break the card's contract
//  by picking higher-level creatures on a "free"
//  summon. On the paid path (Action Phase with
//  a main action available), any valid subset
//  works.
//
//  The sacrifice cost is defined via the engine's
//  `canSatisfySacrifice` / `resolveSacrificeCost`
//  primitives. Failed/cancelled cost payment
//  aborts the summon cleanly.
//
//  Steam Engineer bypasses the cost by passing
//  `skipBeforeSummon: true` when it calls
//  summonCreatureWithHooks (see engineer file).
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');

const CARD_NAME = 'Steam Dwarf Dragon Pilot';
const DISCHARGE_DAMAGE = 100;
const DISCHARGES_PER_TURN = 3;

// Normal sacrifice spec — any Creature that was not summoned this turn
// qualifies. Used on the paid Action-Phase path where Dragon Pilot
// consumes the main action slot and the "all Lv1" bonus does not apply.
const SACRIFICE_SPEC = {
  minCount: 2,
  minMaxHp: 300,
  title: CARD_NAME,
  description: 'Sacrifice 2 or more of your Creatures (not summoned this turn) with combined max HP ≥ 300.',
  confirmLabel: '🐉 Sacrifice!',
  confirmClass: 'btn-danger',
  cancellable: true,
};

// Lv1-only variant — only ≤Lv1 tributes are selectable. Used when Dragon
// Pilot is taking its "additional Action" (inherent) path so the zero-
// action-cost summon cannot be resolved against higher-level tributes.
// `showFilteredAsIneligible` keeps the filtered-out Lv2+ Creatures
// visible in the prompt but greyed out so the player can see at a
// glance which of their Creatures don't qualify.
const LV1_SACRIFICE_SPEC = {
  ...SACRIFICE_SPEC,
  filter: (c) => (c.level || 0) <= 1,
  showFilteredAsIneligible: true,
  description: 'Sacrifice 2 or more Level 1 or lower Creatures (not summoned this turn) with combined max HP ≥ 300.',
};

module.exports = attachSteamEngine({
  // Cheap gate — true whenever a valid sacrifice subset exists right now.
  // Used by the engine for hand-play gating (`getSummonBlocked`) AND by
  // summon effects (Living Illusion etc.) via `engine.isCreatureSummonable`.
  canSummon(ctx) {
    return ctx._engine.canSatisfySacrifice(ctx.cardOwner, SACRIFICE_SPEC);
  },

  // Inherent additional Action when an all-Lv1 sacrifice subset is
  // achievable — summoning Dragon Pilot off an all-Lv1 tribute costs no
  // action slot. If this flag is true at play time, beforeSummon
  // restricts the tribute picker to ≤Lv1 creatures so the player cannot
  // claim the free summon while paying with higher-level tributes.
  inherentAction(gs, pi, heroIdx, engine) {
    return engine.canSatisfySacrifice(pi, LV1_SACRIFICE_SPEC);
  },

  // Free-zone bypass: Dragon Pilot can be summoned onto a Hero with no
  // free Support Zones ONLY IF that Hero has 1+ sacrificable Creature
  // of their OWN (sacrificing one of this Hero's Creatures is what
  // frees the slot Dragon Pilot lands in), AND the overall sacrifice
  // spec remains satisfiable.
  canBypassFreeZoneRequirement: (gs, pi, heroIdx, cardData, engine) => {
    const heroHasOwnSac = engine.getSacrificableCreatures(pi)
      .some(c => c.inst.heroIdx === heroIdx);
    if (!heroHasOwnSac) return false;
    return engine.canSatisfySacrifice(pi, SACRIFICE_SPEC);
  },

  // Drop-on-occupied: only relevant for the all-full-slots case. When
  // the summoning Hero's Support Zones are all occupied but the player
  // has 1+ sacrificable Creature on that Hero, the server accepts a
  // drop on any occupied slot of that Hero — the drop is treated as a
  // "summon from this Hero" gesture, NOT a forced-tribute gesture. The
  // player still picks their sacrifices freely in the prompt; the only
  // constraint is that ≥1 must come from THIS Hero's zones, enforced in
  // beforeSummon via mustIncludeFromHeroIdx.
  //
  // Intentionally does NOT export getBouncePlacementTargets — that
  // would put Dragon Pilot into the client-side "bounce mode" (used by
  // Deepsea creatures), which forces drops onto specific occupied
  // bp-slots ONLY and makes click-on-hand enter the pick-a-swap-target
  // flow. Dragon Pilot wants the standard drop model (Hero / free zone)
  // for the normal case; the all-full case falls back to a raw drop on
  // any occupied slot which the server accepts via this hook.
  canPlaceOnOccupiedSlot: (gs, pi, heroIdx, slotIdx, engine) => {
    const ps = gs.players[pi];
    if (!ps) return false;
    const supZones = ps.supportZones[heroIdx] || [];
    const hasFree = [0, 1, 2].some(z => (supZones[z] || []).length === 0);
    if (hasFree) return false; // prefer normal free-slot drops
    const heroHasOwnSac = engine.getSacrificableCreatures(pi)
      .some(c => c.inst.heroIdx === heroIdx);
    if (!heroHasOwnSac) return false;
    return engine.canSatisfySacrifice(pi, SACRIFICE_SPEC);
  },

  // Pre-placement resolution: prompt for sacrifices, destroy them.
  // Returning false aborts the summon (engine's summonCreatureWithHooks
  // and the server's play_creature handler both respect this — the card
  // goes back to hand and the action slot isn't consumed).
  //
  // Three paths are woven here:
  //
  //   • Inherent path (ctx.isInherentAction === true): restrict tribute
  //     candidates to ≤Lv1, matching the card text's "additional Action"
  //     clause. Lv2+ Creatures stay visible but dimmed.
  //   • Free-slot drop: the server already validated a free slot on the
  //     summoning Hero. Sacrifice spec has no Hero-specific constraint;
  //     tributes may come from any ally Hero's zones. After beforeSummon
  //     returns true, the server's normal summonCreature places Dragon
  //     Pilot into the drop slot.
  //   • All-full drop (ps._requestedBouncePlaceSlot is set): the
  //     summoning Hero had no free slots. ≥1 tribute must come from
  //     THIS Hero's zones (enforced via mustIncludeFromHeroIdx). After
  //     the sacrifice frees a slot, Dragon Pilot is placed manually
  //     into the first freed slot and we signal the server to skip its
  //     default placement by setting _placementConsumedByCard.
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;

    // `_requestedBouncePlaceSlot` is only set when the player dropped
    // on an occupied slot — which for Dragon Pilot means the summoning
    // Hero had no free slots (canPlaceOnOccupiedSlot gates on that).
    const allFullDrop = !!ps?._requestedBouncePlaceSlot;
    if (ps?._requestedBouncePlaceSlot) delete ps._requestedBouncePlaceSlot;

    const baseSpec = ctx.isInherentAction ? LV1_SACRIFICE_SPEC : SACRIFICE_SPEC;
    const spec = allFullDrop
      ? {
          ...baseSpec,
          mustIncludeFromHeroIdx: heroIdx,
          description: `${baseSpec.description} At least one sacrifice must come from the summoning Hero's Support Zones.`,
        }
      : baseSpec;

    const ok = await engine.resolveSacrificeCost(ctx, spec);
    if (!ok) return false;

    // All-full path: manually place into a freed slot on the summoning
    // Hero, then tell the server to skip its default summonCreature.
    if (allFullDrop) {
      const supZones = ps.supportZones[heroIdx] || [];
      const freedSlot = [0, 1, 2].find(z => (supZones[z] || []).length === 0);
      if (freedSlot == null) return false; // shouldn't happen
      await engine.actionPlaceCreature(CARD_NAME, pi, heroIdx, freedSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    return true;
  },

  hooks: {
    /**
     * On discard of 1+ cards from hand, deal 100 damage to any target.
     * Up to 3 uses per turn per instance (tracked on inst.counters).
     * Does NOT conflict with the shared STEAM ENGINE passive: that
     * one has its own HOPT key (_steamEngineTurn), while this one
     * uses _dragonPilotDischarge for counting uses.
     */
    onDiscard: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;

      // Only my discards
      if (ctx.playerIdx !== pi) return;

      // Only when this Creature is actively on the field
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Track uses per turn on the instance itself
      if (!inst.counters) inst.counters = {};
      const turn = gs.turn || 0;
      if (inst.counters._dragonPilotDischargeTurn !== turn) {
        inst.counters._dragonPilotDischargeTurn = turn;
        inst.counters._dragonPilotDischargeUsed = 0;
      }
      if (inst.counters._dragonPilotDischargeUsed >= DISCHARGES_PER_TURN) return;

      // Offer activation — this is optional, so player can decline.
      const confirm = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `A card was discarded. Unleash a fireball for ${DISCHARGE_DAMAGE} damage? (${DISCHARGES_PER_TURN - inst.counters._dragonPilotDischargeUsed} use(s) left this turn)`,
        confirmLabel: '🔥 Fireball!',
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — opt-in fireball discharge.
      });
      if (!confirm || confirm.cancelled) return;

      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: `Hurl a fireball dealing ${DISCHARGE_DAMAGE} damage to any target.`,
        confirmLabel: `🔥 Fireball! (${DISCHARGE_DAMAGE})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      // Commit the use counter only once the player is locked in
      inst.counters._dragonPilotDischargeUsed =
        (inst.counters._dragonPilotDischargeUsed || 0) + 1;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Fireball — big radial blast on the target
      engine._broadcastEvent('play_zone_animation', {
        type: 'fireball',
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtZoneSlot,
      });
      await engine._delay(700);

      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await ctx.dealDamage(tgtHero, DISCHARGE_DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
          target.cardInstance, DISCHARGE_DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('dragon_pilot_fireball', {
        player: gs.players[pi]?.username,
        target: target.cardName,
        damage: DISCHARGE_DAMAGE,
        usesRemaining: DISCHARGES_PER_TURN - inst.counters._dragonPilotDischargeUsed,
      });
      engine.sync();
    },
  },
});
