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
//  Note on ordering: the normal play_creature
//  server flow places the Creature BEFORE firing
//  onPlay, so by the time the sacrifice prompt
//  runs the Dragon Pilot is already on the field.
//  Sacrifices are picked immediately, and if the
//  player cannot satisfy the requirement (which
//  canSummon already gates) we self-destroy as
//  a fail-safe.
//
//  When summoned via Steam Dwarf Engineer, the
//  ctx carries _steamEngineerSummon which
//  bypasses both the sacrifice prompt and the
//  bonus-action calculation.
// ═══════════════════════════════════════════

const { attachSteamEngine, getSacrificableCreatures } = require('./_steam-dwarf-shared');

const CARD_NAME = 'Steam Dwarf Dragon Pilot';
const MIN_SAC_COUNT = 2;
const MIN_SAC_MAXHP = 300;
const DISCHARGE_DAMAGE = 100;
const DISCHARGES_PER_TURN = 3;

/**
 * Check if a set of candidate sacrifices contains at least one
 * combination of 2+ creatures whose combined maxHp is ≥ 300.
 * Greedy check: sort by maxHp desc, take the top 2 — if their sum
 * meets the requirement, any requirement including them does. We
 * also need ≥2 entries total. No deep combinatorial check needed:
 * if the two fattest don't make it, no 2-combo does.
 */
function hasValidSacrificeSet(candidates) {
  if (!candidates || candidates.length < MIN_SAC_COUNT) return false;
  const sorted = [...candidates].sort((a, b) => b.maxHp - a.maxHp);
  const top2 = sorted[0].maxHp + sorted[1].maxHp;
  return top2 >= MIN_SAC_MAXHP;
}

module.exports = attachSteamEngine({
  // Sacrifice requirement check — gates playability from hand.
  // Does NOT run when Engineer summons us (Engineer bypasses the
  // normal play flow entirely via summonCreatureWithHooks).
  canSummon(ctx) {
    const engine = ctx._engine;
    const candidates = getSacrificableCreatures(engine, ctx.cardOwner);
    return hasValidSacrificeSet(candidates);
  },

  hooks: {
    /**
     * Fire on play. Three branches:
     *   - Engineer-summoned (ctx._steamEngineerSummon): skip entirely.
     *   - Normal summon: prompt sacrifices, destroy them, check Lv1
     *     rule for bonus-action grant.
     *   - Sacrifice set not available somehow (shouldn't happen due
     *     to canSummon gate but defensive): self-destroy.
     */
    onPlay: async (ctx) => {
      // Bypass: Engineer summoned us → no sacrifice cost, no bonus
      if (ctx._steamEngineerSummon) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Build sacrifice candidates (exclude self — self is fresh this turn)
      const candidates = getSacrificableCreatures(engine, pi)
        .filter(c => c.inst.id !== inst.id);

      if (!hasValidSacrificeSet(candidates)) {
        // Shouldn't happen: canSummon was true at play-time but state
        // changed before we got here (e.g. a reaction destroyed our
        // sacrifices). Clean up by self-destroying.
        engine.log('dragon_pilot_fizzle', {
          player: ps.username, reason: 'no_valid_sacrifices',
        });
        await engine.actionDestroyCard({ name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx }, inst);
        return;
      }

      // Build targeting list for the sacrifice prompt
      const targets = candidates.map(c => ({
        id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
        type: 'equip',
        owner: c.inst.owner,
        heroIdx: c.inst.heroIdx,
        slotIdx: c.inst.zoneSlot,
        cardName: c.cardName,
        cardInstance: c.inst,
        _meta: { maxHp: c.maxHp, level: c.level },
      }));

      // Prompt loop: the player must select a valid combination.
      // We validate minCount/minMaxHp after selection via re-prompt
      // on invalid pick (cancellable: false — this cost MUST be paid).
      let picked = null;
      while (true) {
        const ids = await engine.promptEffectTarget(pi, targets, {
          title: CARD_NAME,
          description: `Sacrifice 2 or more of your Creatures (not summoned this turn) with combined max HP ≥ ${MIN_SAC_MAXHP}.`,
          confirmLabel: '🐉 Sacrifice!',
          confirmClass: 'btn-danger',
          cancellable: false,
          allowNonCreatureEquips: false,
          maxTotal: candidates.length,
          minRequired: MIN_SAC_COUNT,
        });
        if (!ids || ids.length < MIN_SAC_COUNT) continue;

        const chosen = ids.map(id => targets.find(t => t.id === id)).filter(Boolean);
        if (chosen.length < MIN_SAC_COUNT) continue;

        const sumMax = chosen.reduce((s, t) => s + (t._meta.maxHp || 0), 0);
        if (sumMax < MIN_SAC_MAXHP) continue;   // re-prompt

        picked = chosen;
        break;
      }

      // Check the "all Lv1 or lower" rule BEFORE destroying (so we
      // still have access to the level metadata on the picked set).
      const allLowLevel = picked.every(t => (t._meta.level || 0) <= 1);

      // Sacrifice: destroy each picked creature in order.
      // actionDestroyCard fires onCreatureDeath hooks for each.
      for (const t of picked) {
        try {
          await engine.actionDestroyCard({ name: CARD_NAME, owner: pi, heroIdx: ctx.cardHeroIdx }, t.cardInstance);
        } catch (err) {
          console.error('[Dragon Pilot] sacrifice failed:', err.message);
        }
      }

      engine.log('dragon_pilot_sacrificed', {
        player: ps.username,
        victims: picked.map(t => t.cardName),
        count: picked.length,
      });

      // If all sacrifices were Lv1 or lower, the summon was an
      // ADDITIONAL action rather than costing an action. Grant one
      // bonus Main Phase action — same mechanism as Torchure.
      if (allLowLevel) {
        ps._bonusMainActions = (ps._bonusMainActions || 0) + 1;
        engine.log('dragon_pilot_bonus_action', {
          player: ps.username,
          note: 'all sacrifices were Lv1 or lower',
        });
      }

      engine.sync();
    },

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
      if (inst.counters?.negated) return;
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
