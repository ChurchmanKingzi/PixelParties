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
//    or lower, summoning this Creature grants an
//    additional Main Phase action (it doesn't
//    cost an action — it IS a bonus action).
//  ③ Up to 3 times per turn, when you discard
//    1+ cards, choose a target and deal 100
//    damage to it with a massive fireball.
//
//  The sacrifice cost is defined via the shared
//  `_sacrifice-shared` module and resolved BEFORE
//  placement through the engine's beforeSummon
//  hook — any valid summon path (hand play,
//  Living Illusion, Reincarnation, future summon
//  effects) pays the cost the same way, and
//  failed cost payment aborts the summon cleanly
//  without a transient ghost creature.
//
//  Steam Engineer bypasses the cost by passing
//  `skipBeforeSummon: true` when it calls
//  summonCreatureWithHooks (see engineer file).
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');
const { canSatisfySacrifice, resolveSacrificeCost } = require('./_sacrifice-shared');

const CARD_NAME = 'Steam Dwarf Dragon Pilot';
const DISCHARGE_DAMAGE = 100;
const DISCHARGES_PER_TURN = 3;

// Shared spec used by BOTH canSummon (pure gate) and beforeSummon
// (interactive cost resolution). The onResolved rider is where
// Dragon Pilot's "all Lv1 → bonus Main Phase action" effect lives.
const SACRIFICE_SPEC = {
  minCount: 2,
  minMaxHp: 300,
  title: CARD_NAME,
  description: 'Sacrifice 2 or more of your Creatures (not summoned this turn) with combined max HP ≥ 300.',
  confirmLabel: '🐉 Sacrifice!',
  confirmClass: 'btn-danger',
  onResolved: async (ctx, picked) => {
    // If every sacrificed Creature was Lv1 or lower, Dragon Pilot's
    // summon was BONUS — grant an additional Main Phase action
    // (same mechanism Torchure uses).
    const allLowLevel = picked.every(t => (t._meta.level || 0) <= 1);
    if (!allLowLevel) return;
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return;
    ps._bonusMainActions = (ps._bonusMainActions || 0) + 1;
    engine.log('dragon_pilot_bonus_action', {
      player: ps.username, note: 'all sacrifices were Lv1 or lower',
    });
  },
};

module.exports = attachSteamEngine({
  // Cheap gate — true whenever a valid sacrifice subset exists right now.
  // Used by the engine for hand-play gating (`getSummonBlocked`) AND by
  // summon effects (Living Illusion etc.) via `engine.isCreatureSummonable`.
  canSummon(ctx) {
    return canSatisfySacrifice(ctx._engine, ctx.cardOwner, SACRIFICE_SPEC);
  },

  // Pre-placement resolution: prompt for sacrifices, destroy them, apply
  // the onResolved rider. Returning false aborts the summon (the engine's
  // summonCreatureWithHooks / server's play_creature respects this).
  async beforeSummon(ctx) {
    return await resolveSacrificeCost(ctx, SACRIFICE_SPEC);
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
