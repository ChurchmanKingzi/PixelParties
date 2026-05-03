// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Timid Tanuki"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  Active effect (1×/turn per instance): draw
//  cards equal to the number of different-name
//  Rebelliokai Creatures in your discard pile,
//  capped at 3.
//
//  Passive (on opp-defeat): when defeated by an
//  opponent's card or effect, the controller
//  discards 2 cards. Mirrors Cute Phoenix's
//  detection convention — status / burn / poison
//  ticks do NOT count as "an opponent's card or
//  effect" (the engine-wide reading). The
//  forced-discard runs through
//  `actionPromptForceDiscard`, which respects
//  first-turn protection on its own.
//
//  Wiring:
//    • `creatureEffect: true` — engine handles
//      per-instance HOPT, summoning sickness,
//      and Main-Phase gating.
//    • `canActivateCreatureEffect` gate ensures
//      the player has at least 1 differently-
//      named Rebelliokai already in discard
//      AND isn't hand-locked. Without that gate,
//      the effect would fizzle visibly with the
//      animation already played.
//    • `onCreatureDeath` matches by `instId`
//      (self-only) and uses ctx.source.owner /
//      ctx.type to filter for opponent-source
//      direct effects.
// ═══════════════════════════════════════════

const {
  countDifferentRebelliokaiInDiscard,
} = require('./_rebelliokai-shared');

const CARD_NAME = 'Rebelliokai Timid Tanuki';

module.exports = {
  selfDeleteOnExternalDiscard: true,
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: {
    // The on-defeat penalty is real (-2 hand cards), but the active
    // draw scales as the discard fills. A live Tanuki on a fueled
    // board = ≈+24 (3 draws once per turn). The opp-defeat tax (~-9
    // hand-value over 2 cards) drags the on-death-by-opp benefit
    // negative. Keep it conservative.
    onDeathBenefit: -8,

    /**
     * Defer activation when the discard pile hasn't reached its
     * potential for the turn yet. Tanuki's draw count = unique-named
     * Rebelliokai Creatures in own discard, capped at 3 — firing in
     * MP1 with a thin pile and 1 draw is strictly worse than firing
     * in MP2 after the rest of the turn (Inventing, Champion, future
     * tutored discard cards, opp-side reactions, etc.) has had a
     * chance to churn more Rebelliokai into discard.
     *
     * Returns `false` (= "wait") iff ALL of:
     *   • Currently in MP1 (currentPhase === 2). MP2 is the last
     *     window before End Phase, so any wait beyond it would
     *     forfeit the activation entirely.
     *   • Current unique Rebelliokai count in discard < 3 — already-
     *     maxed pile gets no upside from delaying.
     *   • CPU still holds at least one Rebelliokai Creature whose
     *     name is NOT yet in the discard pile. If no new-unique
     *     candidate exists in hand, the pile can't grow this turn
     *     from any discard effect (the only Rebelliokai-feeding
     *     pipes route from hand → discard), so delaying buys
     *     nothing — fire now.
     *
     * Deliberately NOT enumerating specific discard sources
     * (Inventing, Champion, Magenta, future cards). The CPU may
     * acquire new discard sources mid-turn (drawn / tutored), and
     * an exhaustive registry would rot. Instead we use the simpler
     * heuristic: as long as a new-unique candidate is in hand AND
     * we're still in MP1, defer; the MP2 re-pass fires Tanuki with
     * whatever pile state actually materialized.
     *
     * `_cpu.js` adds the inst to its `tried` set on `false`, so the
     * MP1 pass moves past Tanuki and the MP2 `runMainPhase` re-pass
     * sees a freshly-empty `tried` and re-evaluates the predicate
     * against the now-fuller pile (where currentPhase === 4 → fire).
     */
    shouldActivateNow(engine, pi) {
      const gs = engine.gs;
      const ps = gs.players[pi];
      if (!ps) return true;

      // Past MP1 (Action Phase reached MP2 / End) — last chance, fire now.
      if (gs.currentPhase !== 2) return true;

      const cardDB = engine._getCardDB();
      const distinct = new Set();
      for (const cn of (ps.discardPile || [])) {
        const cd = cardDB[cn];
        if (cd?.archetype === 'Rebelliokai' && cd?.cardType === 'Creature') {
          distinct.add(cn);
        }
      }
      // Already at max draws — no upside to delaying.
      if (distinct.size >= 3) return true;

      // Need a Rebelliokai still in hand whose name isn't already in
      // the pile (a NEW unique candidate). If there's none, the pile
      // can't grow this turn from the CPU's hand → fire now.
      for (const cn of (ps.hand || [])) {
        if (distinct.has(cn)) continue;
        const cd = cardDB[cn];
        if (cd?.archetype === 'Rebelliokai' && cd?.cardType === 'Creature') {
          // Found a new-unique candidate — defer; MP2 re-evaluates
          // with whatever pile state materialized by then.
          return false;
        }
      }
      // No new-unique candidate in hand → fire now.
      return true;
    },
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps     = engine.gs.players[ctx.cardOriginalOwner ?? ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;
    return countDifferentRebelliokaiInDiscard(ps, engine, 3) > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOriginalOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    const draws = countDifferentRebelliokaiInDiscard(ps, engine, 3);
    if (draws <= 0) return false;

    await engine.actionDrawCards(pi, draws, { source: CARD_NAME });

    engine.log('rebelliokai_timid_tanuki_draw', {
      player: ps.username, drew: draws,
    });
    engine.sync();
    return true;
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death || death.name !== CARD_NAME) return;

      // Self-only by instId — robust against multiple Tanukis.
      if (death.instId != null) {
        if (death.instId !== ctx.card.id) return;
      } else {
        if (death.owner   !== ctx.cardOriginalOwner) return;
        if (death.heroIdx !== ctx.cardHeroIdx) return;
        if (death.zoneSlot !== ctx.card.zoneSlot) return;
      }

      // Must be defeated by an OPPONENT's card or effect. Cute Phoenix's
      // convention: source.controller || source.owner identifies the
      // attribution; status/burn/poison ticks are NOT "an opponent's
      // card or effect" (they're residual status damage with no source-
      // controller at tick time).
      const source = ctx.source;
      const srcOwner = source?.controller ?? source?.owner ?? -1;
      if (srcOwner < 0 || srcOwner === ctx.cardOriginalOwner) return;
      if (['status', 'burn', 'poison'].includes(ctx.type)) return;

      const engine = ctx._engine;
      const pi     = ctx.cardOriginalOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      // Force-discard 2. The helper handles hand-empty fizzles, the
      // first-turn protection check, and prompt UI on its own.
      await engine.actionPromptForceDiscard(pi, 2, {
        title:  CARD_NAME,
        source: CARD_NAME,
      });

      engine.log('rebelliokai_timid_tanuki_defeat_tax', {
        player: ps.username, by: source?.name || null,
      });
      engine.sync();
    },
  },
};
