// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Polar"
//  Creature (Summoning Magic Lv2, 130 HP — Slippery)
//
//  Effect:
//    1. At the beginning of each of your turns, slide this Creature
//       into the free Support Zone of an adjacent Hero (if possible).
//       Handled by the shared `onSlipperyTurnStart` coordinator.
//    2. Once per turn, when this Creature is moved into a different
//       Hero's Support Zone, that Hero may IMMEDIATELY SUMMON A
//       CREATURE from your hand as an additional Action.
//
//  Wiring:
//    • The on-move grant runs through the engine's canonical
//      `performImmediateAction(pi, hostHeroIdx, config)` helper —
//      the same hero-locked "additional Action" path Coffee / Trample
//      Sounds / Mana Beacon use. Restricting the action via
//      `allowedCardTypes: ['Creature']` plus `skipAbilities: true`
//      makes the picker offer ONLY Creatures from the player's hand
//      that the host Hero can legally summon (the helper's filter
//      already runs the canonical `getHeroEligibleActionCards` gate,
//      so spell-school / level / Wisdom / canSummon / free-zone are
//      all honoured). Cancelling the prompt skips the bonus — the
//      card text says "may", so declining is legal.
//    • Per-instance HOPT (`slippery-polar:<instId>:<turn>`) gates
//      "once per turn" per Polar. Two Polars on the same side each
//      get their own trigger.
//    • The grant fires from the host Hero of the destination slot
//      (`ctx.card.heroIdx` AFTER the move resolves — Slippery's
//      shared mover updates `inst.heroIdx` before firing
//      `onCardEnterZone`).
//
//  Previous design used `registerAdditionalActionType` +
//  `grantAdditionalAction` to leave a stored token on the inst, which
//  surfaced the engine's generic ⚡ "additional Action available" icon
//  on Polar. The new flow opens the picker immediately and never
//  stamps `additionalActionAvail`, so the icon stays off.
// ═══════════════════════════════════════════

const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Polar';
const HOPT_KEY  = 'slippery-polar';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.card.heroIdx;

      // Per-instance "once per turn" — applies to THIS Polar (inst id
      // in the key so two Polars on the same side don't share the
      // lockout). PEEK only here: we must NOT consume the once-per-turn
      // just for the trigger firing. `claimHOPT` derives the stored key
      // as `${key}:${playerIdx}`, so mirror that for the read-only
      // check, then claim it LATER — only if a Creature is actually
      // summoned.
      const hoptKey = `${HOPT_KEY}:${ctx.card.id}:${pi}`;
      if (engine.gs.hoptUsed?.[hoptKey] === engine.gs.turn) return;

      const hostHero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hostHero?.name || hostHero.hp <= 0) return;

      engine.log('slippery_polar_trigger', {
        player: gs.players[pi]?.username,
        hero: hostHero.name,
      });
      engine.sync();

      // Route the bonus through the canonical immediate-action helper.
      // The host Hero locks the prompt; only Creatures from hand show
      // up; the helper's internal filter already enforces summoning
      // requirements, free zone, canSummon, summonLock, etc. It returns
      // `{ played: true }` ONLY when a Creature was actually summoned —
      // `{ played: false }` for "no eligible Creature" (e.g. not enough
      // Summoning Magic on the new host) or a declined/cancelled prompt
      // (the card says "may").
      const result = await engine.performImmediateAction(pi, heroIdx, {
        title: CARD_NAME,
        description: `${hostHero.name} may immediately summon a Creature from your hand as an additional Action.`,
        allowedCardTypes: ['Creature'],
        skipAbilities: true,
      });

      // Consume the once-per-turn ONLY now, and ONLY if something was
      // actually summoned. Nothing summoned (can't / declined) → the
      // trigger stays available, so a later same-turn slip to a Hero
      // that CAN summon still works. (claimHOPT re-derives the same
      // `${HOPT_KEY}:${id}:${pi}` key checked above.)
      if (result && result.played) {
        engine.claimHOPT(`${HOPT_KEY}:${ctx.card.id}`, pi);
        engine.sync();
      }
    },
  },
};
