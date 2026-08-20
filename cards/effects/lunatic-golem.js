// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Golem"
//  Creature (Lv3, 100 HP, Summoning Magic, Lunatic)
//
//  Tiered on the number of DIFFERENT "Lunatic
//  Cycle" cards on the board (either side):
//   • 1+  Activated, once/turn, FREE: choose a
//         target and deal 100 × (#different
//         Lunatic Cycle) damage to it.
//   • 2+  Immune to negative status effects.
//   • 3+  Halve all damage this Creature takes.
//   • 4+  All damage its HOST Hero would take is
//         negated.
//   • 5   The activated effect INSTANTLY DEFEATS
//         the chosen target instead of damaging it
//         (designer-confirmed interaction).
//
//  Tiers are read live (`countDistinctLunaticCycle`)
//  at each hook/use, EXCEPT the 2+ status immunity:
//  `canApplyCreatureStatus` is a synchronous engine
//  gate, so we maintain the real
//  `negative_status_immune` buff on the Creature
//  (engine enforces it for creatures — added
//  alongside the hero-side check) whenever the
//  board count is ≥2, re-evaluated on every
//  board/turn change. Precise to the wording: only
//  NEGATIVE statuses are blocked.
// ═══════════════════════════════════════════

const { countDistinctLunaticCycle, hostHeroOf } = require('./_lunatic-shared');
const { getNegativeStatuses } = require('./_hooks');

const CARD_NAME = 'Lunatic Golem';
const DMG_PER_CYCLE = 100;

/** Keep the tier-2+ `negative_status_immune` buff in sync with the
 *  live board count. Uses a private marker so we only ever add/remove
 *  OUR grant — never strip an immunity another card gave this Creature. */
function reevalImmunity(engine, inst) {
  if (!inst || inst.zone !== 'support') return;
  if (!inst.counters.buffs) inst.counters.buffs = {};
  const n = countDistinctLunaticCycle(engine);
  const cur = inst.counters.buffs.negative_status_immune;
  if (n >= 2) {
    if (!cur) {
      inst.counters.buffs.negative_status_immune = { source: CARD_NAME, _lunaticGolem: true };
      // Tier 2+ doesn't just block NEW negative statuses — it negates
      // the effects of any it ALREADY has. Cleanse them the moment the
      // immunity turns on so the badges visibly clear (Frozen/Stunned/
      // Burned/Poisoned/etc.). Non-cleansable CC (Negated/Nulled) and
      // Stinky-Stables-locked Poison can't be stripped here, but the
      // engine's negative_status_immune guards still negate their
      // EFFECT (no tick damage; stays activatable despite CC).
      engine.cleanseCreatureStatuses(inst, getNegativeStatuses(), CARD_NAME);
    }
  } else if (cur && cur._lunaticGolem) {
    delete inst.counters.buffs.negative_status_immune;
  }
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true, // tier 1+ activated (free; engine HOPT = once/turn)

  // The tier-2+ immunity is MAINTAINED by `reevalImmunity` running on
  // onGameStart/onTurnStart/onCardEnterZone/etc. Without this flag the
  // engine's support-creature CC filter in runHooks (frozen / stunned /
  // negated / nulled → listener dropped) would silence those very hooks
  // whenever the Golem already carries the status it's meant to negate
  // — a deadlock (e.g. a Frozen Golem pre-placed in puzzle mode never
  // grants its own immunity, so the Frozen is never negated/cleansed).
  // The immunity bookkeeping must out-rank the silence, so it fires
  // regardless of CC; the hook bodies self-gate on the live cycle count
  // (same rationale as Chilly Wizard's "cannot be negated" passive).
  bypassStatusFilter: true,

  // ── Tier 1+ activated effect ──────────────────────────────────────
  canActivateCreatureEffect(ctx) {
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    return countDistinctLunaticCycle(ctx._engine) >= 1;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const inst = ctx.card;
    const n = countDistinctLunaticCycle(engine);
    if (n < 1) return false;

    const lethal = n >= 5;
    const dmg = DMG_PER_CYCLE * n;

    // Choose ANY target (Hero or Creature, either side).
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['hero', 'creature'],
      damageType: 'other',
      baseDamage: lethal ? undefined : dmg,
      // Tier-5 is a NON-damage defeat ("instead of damaging it"), so
      // pure damage-mitigation post-target reactions (Spectral Armor's
      // halve, damage negation, …) must not fire — they'd do nothing to
      // an insta-kill and the CPU shouldn't burn a card "reacting" to
      // it. Non-lethal stays true (it really does deal `dmg`).
      dealsDamage: !lethal,
      title: CARD_NAME,
      description: lethal
        ? 'Choose any target — it is immediately defeated.'
        : `Choose any target — deal ${dmg} damage to it.`,
      confirmLabel: lethal ? '🌑 Defeat!' : `🌑 ${dmg} Damage!`,
      confirmClass: 'btn-danger',
      cancellable: true,
    });
    if (!target) return false;

    // Moon beam: a pale moonlight ray from the Golem to the target —
    // light-yellow, almost white. `color` drives the core line + the
    // flash/shockwave; `glow` recolours the halo via the beam's
    // `--bg-*` CSS vars (same path Disruption Ray uses).
    const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_beam_animation', {
      sourceOwner: pi,
      sourceHeroIdx: inst.heroIdx,
      sourceZoneSlot: inst.zoneSlot,
      targetOwner: target.owner,
      targetHeroIdx: target.heroIdx,
      targetZoneSlot: tgtZoneSlot,
      color: 'rgba(255, 252, 236, 0.92)', // near-white moonlight
      glow: 'rgba(244, 240, 205, 0.85)',  // soft pale-yellow halo
      duration: 1000,
    });
    await engine._delay(420);

    const source = { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx, controller: pi };

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!hero || hero.hp <= 0) return false;
      if (lethal) {
        // Tier 5: "instantly defeats" — a NON-damage KO. Routed through
        // actionDefeatHero so it never enters the damage pipeline: no
        // beforeDamage/afterDamage, no damage-reducing/"would take
        // damage" reaction prompts, and every form of damage protection
        // (incl. Golem's own tier-4 host-damage negation) is bypassed
        // by construction. "instead of damaging it" — to the letter.
        await engine.actionDefeatHero(source, hero, { reason: CARD_NAME });
      } else {
        await ctx.dealDamage(hero, dmg, 'creature');
      }
    } else {
      const cInst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (!cInst) return false;
      if (lethal) {
        await engine.actionDestroyCard(source, cInst);
      } else {
        await engine.actionDealCreatureDamage(source, cInst, dmg, 'creature',
          { sourceOwner: pi, canBeNegated: true });
      }
    }

    engine.log('lunatic_golem_strike', {
      player: gs.players[pi]?.username, target: target.cardName,
      lethal, damage: lethal ? 'defeat' : dmg, cycles: n,
    });
    engine.sync();
    return true;
  },

  hooks: {
    onPlay: (ctx) => reevalImmunity(ctx._engine, ctx.card),
    onGameStart: (ctx) => reevalImmunity(ctx._engine, ctx.card),
    onTurnStart: (ctx) => reevalImmunity(ctx._engine, ctx.card),
    onCardEnterZone: (ctx) => reevalImmunity(ctx._engine, ctx.card),
    onCardLeaveZone: (ctx) => {
      // A Lunatic Cycle equip leaving may drop us below tier 2.
      if (ctx.leavingCard?.id === ctx.card.id) return; // we're the one leaving
      reevalImmunity(ctx._engine, ctx.card);
    },

    // ── Tier 3+: halve all damage THIS Creature takes ──
    beforeCreatureDamageBatch: (ctx) => {
      const engine = ctx._engine;
      if (countDistinctLunaticCycle(engine) < 3) return;
      const meId = ctx.card.id;
      for (const e of (ctx.entries || [])) {
        if (e.cancelled || !e.inst || e.inst.id !== meId) continue;
        if (!(e.amount > 0)) continue;
        e.amount = Math.ceil(e.amount / 2);
      }
    },

    // ── Tier 4+: negate ALL damage the host Hero would take ──
    beforeDamage: (ctx) => {
      if (ctx.cancelled) return;
      const engine = ctx._engine;
      if (countDistinctLunaticCycle(engine) < 4) return;
      const target = ctx.target;
      if (!target || target.maxHp === undefined) return; // hero targets only
      const host = hostHeroOf(engine, ctx.card);
      if (!host || target !== host.hero) return;
      ctx.setAmount(0);
      ctx.cancel?.();
    },
  },
};
