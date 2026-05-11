// ═══════════════════════════════════════════
//  CARD EFFECT: "Gigantisaur Pteranos"
//  Creature (Normal, Lv3, Summoning Magic) — Gigantisaurs
//  HP 200
//
//  ① UNIQUENESS — shared archetype rule.
//
//  ② ACTIVE — Once per turn, discard any number
//    of DIFFERENT-NAME Gigantisaur Creatures
//    from your hand (min 1) → draw 2× that many
//    cards.
// ═══════════════════════════════════════════

const {
  gigantisaursCanSummon, isGigantisaurCreature,
} = require('./_gigantisaurs-shared');

const CARD_NAME = 'Gigantisaur Pteranos';

/** Distinct Gigantisaur Creature names currently in the player's hand. */
function distinctGigantisaurNamesInHand(ps, engine) {
  const names = new Set();
  for (const n of (ps.hand || [])) {
    if (isGigantisaurCreature(n, engine)) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

module.exports = {
  activeIn: ['support'],
  canSummon: gigantisaursCanSummon,

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false; // draw payout pointless
    return distinctGigantisaurNamesInHand(ps, engine).length >= 1;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const eligibleNames = distinctGigantisaurNamesInHand(ps, engine);
    if (eligibleNames.length === 0) return false;

    // Iterative discard loop — caster picks one Gigantisaur at a
    // time, each name once. forceDiscardCancellable with the
    // eligible-indices list narrowed to "this name still in hand".
    // Cancel exits the loop; the first pick is mandatory so the
    // activation can't fizzle into a 0-discard no-op (the spec
    // requires at least 1).
    //
    // The whole loop runs inside a single `withDiscardBatch` so any
    // on-discard reactors (Glass of Marbles, Skull Necklace, …) wait
    // until every Gigantisaur the player picked is in the pile
    // before resolving — and Cute Bunny sees an N-card batch event
    // rather than N independent 1-card events.
    const discarded = await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () => {
      const discardedNames = new Set();
      let n = 0;
      while (true) {
        const eligibleIndices = [];
        for (let i = 0; i < (ps.hand || []).length; i++) {
          const cn = ps.hand[i];
          if (!isGigantisaurCreature(cn, engine)) continue;
          if (discardedNames.has(cn)) continue;
          eligibleIndices.push(i);
        }
        if (eligibleIndices.length === 0) break;

        const isFirst = n === 0;
        const result = await engine.promptGeneric(pi, {
          type: 'forceDiscardCancellable',
          title: CARD_NAME,
          description: isFirst
            ? `Discard a Gigantisaur Creature from your hand. (You'll draw 2× the number discarded.)`
            : `Discard another different-named Gigantisaur, or click Done. (${n} discarded so far → ${n * 2} draws queued.)`,
          instruction: 'Click a highlighted Gigantisaur in your hand.',
          eligibleIndices,
          // First discard mandatory (the effect spec is "min 1").
          // Subsequent discards opt-in via the Done button.
          cancellable: !isFirst,
          cancelLabel: 'Done',
        });
        if (!result || result.cancelled || result.cardName == null) {
          if (isFirst) return 0; // mandatory pick declined → fizzle
          break;
        }
        const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
          source: CARD_NAME,
        });
        if (!ok) {
          if (isFirst) return 0;
          break;
        }
        discardedNames.add(result.cardName);
        n++;
      }
      return n;
    });

    if (discarded === 0) return false;

    // Brief beat so the discard syncs commit before the draws fire —
    // same "post-discard / pre-draw" timing fix used for Heinz /
    // Triceras. Without it the first draw's animation can be eaten
    // by React batching the discard-shrink + draw-grow into one
    // render with delta=0.
    await engine._delay(300);

    const drawCount = discarded * 2;
    await engine.actionDrawCards(pi, drawCount);

    engine.log('pteranos_draw', {
      player: ps.username, discarded, drew: drawCount,
    });
    engine.sync();
    return true;
  },
};
