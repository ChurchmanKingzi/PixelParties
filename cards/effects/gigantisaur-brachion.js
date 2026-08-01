// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Brachion"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 400
//
//  ① UNIQUENESS — shared archetype rule (1 per
//    Hero) PLUS Brachion-specific "only 1 of THIS
//    Creature controlled at a time" rule.
//
//  ② DAMAGE REDIRECT — when the host Hero would
//    take damage, controller may discard 1 card
//    to redirect that damage to Brachion. Cancels
//    the original damage and re-issues it as
//    creature damage on this Creature with
//    `cannotBeReduced` / `cannotBeNegated` flags.
//
//  ③ UNREVIVABLE — `_summonedFromDiscard`-style
//    summons are refused in `beforeSummon`. Hand-
//    summon is still allowed (a fresh copy from
//    hand has none of these flags).
//
//  ④ DAMAGE-PROOF — damage Brachion takes cannot
//    be reduced or negated. `beforeCreatureDamage-
//    Batch` stamps `cannotBeReduced: true` +
//    `cannotBeNegated: true` on every entry
//    that targets THIS Brachion's inst.
// ═══════════════════════════════════════════

const {
  gigantisaursCanSummon,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Brachion';

/** True iff this player already controls another Brachion. */
function otherBrachionControlled(engine, pi, selfInstId) {
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support') continue;
    if (c.name !== CARD_NAME) continue;
    if ((c.controller ?? c.owner) !== pi) continue;
    if (selfInstId && c.id === selfInstId) continue;
    return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  /**
   * Standard archetype gate PLUS Brachion-specific "only 1 controlled
   * at a time" rule. Layered on top of the shared helper.
   */
  canSummon(ctx) {
    if (!gigantisaursCanSummon(ctx)) return false;
    const engine = ctx._engine;
    if (otherBrachionControlled(engine, ctx.cardOwner, ctx.card?.id)) return false;
    return true;
  },

  /**
   * Revive refusal. `_summonedFromDiscard` is the canonical signal
   * for "this summon came out of the discard pile" (Grave Worm style);
   * `_reviveAfterDeath` is the engine's internal flag for the
   * extra-life / Phoenix-style same-slot re-summon. Both routes are
   * refused. A regular hand cast through `doPlayCreature` sets
   * neither, so the standard play continues normally.
   */
  async beforeSummon(ctx) {
    if (ctx._summonedFromDiscard) return false;
    if (ctx._reviveAfterDeath) return false;
    return true;
  },

  // ── CPU: Confirm-Prompts pauschal bejahen (Barker-Bugklasse) ──────
  // beforeDamage-Confirm (Gegner-Angriff, plan-los).
  // Ohne Intercept declined der Brain-Default cancellable Confirms in
  // plan-losen Kontexten und der Effekt verpufft still. Der generic-
  // Dispatch lädt dieses Skript nur für Prompts mit dem eigenen
  // Kartentitel — Pauschal-Confirm ist damit korrekt gescopet.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type === 'confirm') {
      // Protection-Lernkanal: gelernte Regel > Explorations-Arm (Training)
      // > Accept-Default. Features kommen als protMeta aus dem Hook.
      const { protectionDecision } = require('./_deck-profile');
        if (typeof protectionDecision !== 'function') return { confirmed: true }; // Teildeployment-Schutz
      const meta = promptData.protMeta || { d: 0, hp: 1 };
      const pi = typeof meta.pi === 'number' ? meta.pi : engine._cpuPlayerIdx;
      return { confirmed: protectionDecision(engine, pi, promptData.title, meta) };
    }
    return undefined;
  },

  hooks: {
    /**
     * Damage redirect — fires on EVERY beforeDamage event the engine
     * runs. Filter to: damage target is THIS Brachion's host Hero,
     * Brachion still alive, controller can pay the discard cost.
     * Opt-in via a Yes/No prompt; on YES, pay 1 discard, cancel the
     * original damage by setting `cancelled = true`, and re-issue
     * the same amount as creature damage on Brachion.
     */
    beforeDamage: async (ctx) => {
      const engine = ctx._engine;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      if (inst.counters?.negated || inst.counters?.nulled) return;
      if (ctx.cancelled) return;

      const target = ctx.target;
      if (!target || target.hp == null || target.hp <= 0) return;

      // Identify which Hero is the target, and verify it's THIS
      // Brachion's host.
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      const hostHero = ps.heroes?.[inst.heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;
      if (target !== hostHero) return;

      // Re-entry guard — Brachion's redirect re-issues damage on
      // ITSELF (a creature damage event); without this guard, a
      // beforeDamage during that re-issue could re-enter and chain.
      // Creature damage doesn't fire the hero beforeDamage path so
      // this is defensive, but cheap.
      if (engine.gs._brachionRedirecting === inst.id) return;

      // Need at least 1 hand card to pay the redirect cost.
      if ((ps.hand?.length || 0) < 1) return;

      // Brachion can absorb the damage — must have a valid amount.
      const amount = ctx.amount;
      if (!(amount > 0)) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        protMeta: { d: amount, hp: target.hp, pi },
        title: CARD_NAME,
        message: `${hostHero.name} is about to take ${amount} damage. Discard 1 card to redirect to ${CARD_NAME}?`,
        showCard: CARD_NAME,
        confirmLabel: '🦕 Redirect!',
        cancelLabel: 'Take damage',
        cancellable: true,
      });
      if (!confirmed) return;

      // Pay the discard cost. If it fails (hand emptied between
      // prompt and now), bail without redirecting.
      const handBefore = ps.hand.length;
      await engine.actionPromptForceDiscard(pi, 1, {
        title: CARD_NAME,
        source: CARD_NAME,
        selfInflicted: true,
      });
      if (ps.hand.length >= handBefore) return;

      // Cancel the original damage on the Hero.
      ctx.cancelled = true;
      if (typeof ctx.setAmount === 'function') ctx.setAmount(0);

      // Quick redirect animation — a red beam from the host hero
      // crashing into Brachion's slot.
      engine._broadcastEvent('play_zone_animation', {
        type: 'red_cut', owner: pi,
        heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine._delay(120);

      // Re-issue the damage as a creature hit on Brachion. Mark the
      // re-entry guard so any nested beforeDamage doesn't loop.
      engine.gs._brachionRedirecting = inst.id;
      try {
        await engine.actionDealCreatureDamage(
          ctx.source, inst, amount, ctx.type || 'other',
          {
            sourceOwner: ctx.source?.owner,
            canBeNegated: false,
            cannotBeReduced: true,
          },
        );
      } finally {
        delete engine.gs._brachionRedirecting;
      }

      engine.log('brachion_redirect', {
        player: ps.username, hero: hostHero.name, amount,
      });
    },

    /**
     * Damage-proof: every creature-damage entry that targets THIS
     * Brachion gets `cannotBeReduced` / `cannotBeNegated` stamped on
     * it. Mirrors Gou's `beforeCreatureDamageBatch` shape — iterates
     * the batch entries and mutates per-entry flags before the
     * engine's reducer / negation pass reads them.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const entries = ctx.entries;
      if (!Array.isArray(entries)) return;
      for (const e of entries) {
        if (!e || !e.inst) continue;
        if (e.inst.id !== inst.id) continue;
        e.cannotBeReduced = true;
        e.cannotBeNegated = true;
      }
    },
  },
};
