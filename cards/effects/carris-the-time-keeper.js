// ═══════════════════════════════════════════
//  CARD EFFECT: "Carris, the Time Keeper"
//  Hero — 1 HP / 60 ATK (Divinity + Premonition)
//
//  "Any damage this Hero would take becomes 0, including damage that
//   could normally not be reduced or negated. At the end of each of
//   your turns, place 1 Time Counter on this Hero. If there are 4 or
//   more Time Counters on this Hero, you lose the game. These effects
//   cannot be negated."
//
//  ── Wiring ──────────────────────────────────────────────────────
//  ① Damage wall. `heroSelfDamageImmune: true` is the generic engine
//     hook (read by `_isHeroSelfDamageImmune` in BOTH the normal
//     damage path `_actionDealDamageImpl` AND the true-damage path
//     `actionDealTrueDamage`). The engine zeroes EVERY incoming
//     damage event — normal, status (burn / poison), and "cannot be
//     reduced or negated" true damage alike — before any reaction /
//     Surprise / BEFORE_DAMAGE side effects can fire. The probe is
//     deliberately NOT status-gated, so the wall holds even while
//     Carris is Frozen / Stunned / Negated ("cannot be negated").
//     Non-damage defeats (instant-defeat effects) are NOT blocked —
//     the card only nullifies DAMAGE — which is exactly why the
//     Time-Counter clock below is the intended counterplay/clock.
//
//  ② Time-Counter clock. At the end of EACH of the controller's
//     turns a Time Counter is placed; the 4th makes the controller
//     lose immediately. `bypassStatusFilter: true` lets the
//     onTurnEnd tick fire even when Carris is Frozen / Stunned /
//     Negated, honouring "these effects cannot be negated".
//
//  Counter storage: `hero._timeCounters` (int). Rendered as a hero
//  badge in app-board.jsx.
// ═══════════════════════════════════════════

const CARD_NAME = 'Carris, the Time Keeper';
const LOSE_AT   = 4;

module.exports = {
  activeIn: ['hero'],

  // Engine-level absolute damage immunity (see _engine.js
  // `_isHeroSelfDamageImmune`). Unconditional — Carris's text has no
  // qualifier, unlike Chuck's "while you control other Heroes".
  heroSelfDamageImmune: true,

  // "These effects cannot be negated" — keep the onTurnEnd clock
  // firing through Frozen / Stunned / Negated / Mummified.
  bypassStatusFilter: true,

  hooks: {
    /**
     * End of each of the controller's turns: +1 Time Counter, then
     * lose at 4+. `ctx.activePlayer` is the player whose turn is
     * ending; only tick on Carris's controller's turns ("each of
     * YOUR turns").
     */
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      if (gs.result) return; // Game already decided.

      const controller = ctx.cardController ?? ctx.cardOwner;
      if (ctx.activePlayer !== controller) return;

      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      hero._timeCounters = (hero._timeCounters || 0) + 1;
      engine.log('carris_time_counter', {
        player: gs.players[controller]?.username,
        counters: hero._timeCounters,
      });
      engine.sync();

      if (hero._timeCounters >= LOSE_AT) {
        const winnerIdx = controller === 0 ? 1 : 0;
        engine.log('carris_time_out', {
          loser: gs.players[controller]?.username,
          winner: gs.players[winnerIdx]?.username,
          counters: hero._timeCounters,
        });
        if (engine.onGameOver && !gs.result) {
          engine.onGameOver(engine.room, winnerIdx, 'carris_time_out');
        }
      }
    },
  },
};
