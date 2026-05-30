// ═══════════════════════════════════════════
//  CARD EFFECT: "Draw"
//  Spell (Decay Magic, Lv1, Normal)
//
//  "Both players discard their entire hands. Then, you draw 4/5/6
//   cards and your opponent draws 5/4/3 cards."
//
//  4/5/6 (you) and 5/4/3 (opponent) scale with the casting Hero's
//  Decay Magic level, clamped to [1, 3] (Performance on Decay Magic
//  counts via the engine helper):
//    DM 1 → you 4 / opp 5
//    DM 2 → you 5 / opp 4
//    DM 3 → you 6 / opp 3
//
//  Each player's hand-dump runs inside its own `withDiscardBatch`
//  (the Gigantisaur Spinor pattern) so per-card on-discard reactors
//  (Cute Bunny, Glass of Marbles, …) resolve AFTER the whole hand
//  has landed, batched as one event. The played "Draw" Spell is the
//  caster's resolving card — discarding it as part of "your entire
//  hand" is safe: doPlaySpell's `getResolvingHandIndex` returns -1
//  for a self-discarded resolving card and skips the post-resolution
//  re-discard (no duplicate).
// ═══════════════════════════════════════════

const CARD_NAME = 'Draw';

/** Casting Hero's Decay Magic level, clamped to [1, 3]. Caster-aware so
 *  an active `gs._castSchoolOverride` (Demon's Gate "as if Decay Magic 3")
 *  wins over the host hero's actual stack count. */
function decayLevel(engine, pi, heroIdx) {
  const dm = engine.effectiveSchoolLevelForCaster('Decay Magic', pi, heroIdx);
  return Math.max(1, Math.min(3, dm));
}

// Per-beat pacing for the synchronised hand-dump (one card per player
// per beat). Matches the engine's standard card-flow cadence.
const BEAT_MS = 260;

/**
 * Both players discard their ENTIRE hands CARD BY CARD, in lockstep:
 * each beat peels exactly ONE card off each player's hand at the same
 * time, until both are empty. Wrapped in nested `withDiscardBatch`
 * (one per player — nesting-safe; the outermost flush fires every
 * deferred per-card onDiscard then the aggregate batch-end with
 * `countByPlayer`) so per-card reactors resolve AFTER the whole dump.
 * Returns `{ my, opp }` counts.
 */
async function dumpHandsTogether(engine, pi, oppIdx) {
  const me = engine.gs.players[pi];
  const op = engine.gs.players[oppIdx];
  let my = 0;
  let opp = 0;

  await engine.withDiscardBatch(pi, { source: CARD_NAME }, async () =>
    engine.withDiscardBatch(oppIdx, { source: CARD_NAME }, async () => {
      let guard = 0;
      while (((me?.hand?.length || 0) > 0 || (op?.hand?.length || 0) > 0)
             && guard++ < 200) {
        const myCard  = (me?.hand?.length || 0) > 0 ? me.hand[0] : null;
        const oppCard = (op?.hand?.length || 0) > 0 ? op.hand[0] : null;

        // Launch BOTH hand→discard flights on the same beat (before
        // the splice so the leftmost hand slot still renders for the
        // source rect; the pile-transfer bucket suppresses the diff
        // detector's duplicate). Then move state + fire (deferred)
        // onDiscard hooks for each.
        if (myCard != null) {
          engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName: myCard, from: 'hand', to: 'discard', fromHandIdx: 0,
          });
        }
        if (oppCard != null) {
          engine._broadcastEvent('play_pile_transfer', {
            owner: oppIdx, cardName: oppCard, from: 'hand', to: 'discard', fromHandIdx: 0,
          });
        }
        if (myCard != null
            && await engine.actionDiscardHandCard(pi, myCard, 0, { source: CARD_NAME })) my++;
        if (oppCard != null
            && await engine.actionDiscardHandCard(oppIdx, oppCard, 0, { source: CARD_NAME })) opp++;

        engine.sync();
        const more = (me?.hand?.length || 0) > 0 || (op?.hand?.length || 0) > 0;
        if (more) await engine._delay(BEAT_MS);
      }
    }),
  );

  return { my, opp };
}

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const heroIdx = ctx.cardHeroIdx;

      const dm = decayLevel(engine, pi, heroIdx);
      const youDraw = 3 + dm;   // 4 / 5 / 6
      const oppDraw = 6 - dm;   // 5 / 4 / 3

      // ── Both players discard their entire hands, card by card, in
      //    lockstep (one card each per beat). The caster's hand
      //    includes the resolving Draw itself — the engine's
      //    self-discard path (getResolvingHandIndex → -1) handles
      //    that without a double-discard.
      const { my: myDiscarded, opp: oppDiscarded } =
        await dumpHandsTogether(engine, pi, oppIdx);
      engine.sync();
      await engine._delay(200);

      // ── Then draw ──
      await engine.actionDrawCardsAnimated(pi, youDraw);
      await engine.actionDrawCardsAnimated(oppIdx, oppDraw);

      engine.log('draw_card', {
        player: gs.players[pi]?.username,
        decayLevel: dm,
        myDiscarded, oppDiscarded,
        youDraw, oppDraw,
      });
      engine.sync();
    },
  },
};
