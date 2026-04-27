// ═══════════════════════════════════════════
//  CARD EFFECT: "Luna Pele, the Flame Dancer"
//  Hero (400 HP, 40 ATK — Destruction Magic + Singing)
//
//  Two passive effects, both active only while
//  this Hero is alive on the board:
//
//  1. POISON → BURN (rest-of-game). Whenever a
//     Hero anywhere on the board gets the
//     `poisoned` status applied, also Burn that
//     Hero with `permanent: true` so the Burn
//     never expires at end of turn (still
//     cleansable by Beer / Tea / Cure — same
//     rule that governed Heat Wave's permanent
//     Burns). Skips if the Hero is already
//     Burned (avoids the re-application cascade
//     that overwrites the existing Burn entry
//     and re-fires `onStatusApplied`); instead,
//     the existing Burn is upgraded in-place
//     to `permanent: true` if it wasn't already.
//
//  2. BURN → DRAW, capped at 4 per turn. Whenever
//     a Hero gets the `burned` status applied,
//     this Luna draws 1 card. Cap is per-Luna
//     (each Luna instance tracks its own counter).
//     Resets on turn change via a turn-stamped
//     pair stored on the hero object.
//
//  ─── Scope note ─────────────────────────────
//  Card text says "target", which in normal
//  PixelParties usage covers both Heroes and
//  Creatures. However the engine's
//  `onStatusApplied` hook ONLY fires for Hero
//  status applications today — creature burns /
//  poisons go through direct `inst.counters.X`
//  writes that don't run hooks (Heat Wave's own
//  creature-burn path, Mountain Tear River's
//  burnCreature helper, etc.). So Luna's two
//  effects cover Hero targets only. Adding
//  Creature coverage would require centralizing
//  every creature-status callsite through a
//  helper that fires the hook — explicitly out
//  of scope for this card's implementation.
// ═══════════════════════════════════════════

const CARD_NAME = 'Luna Pele, the Flame Dancer';
const BURN_DRAW_CAP = 4;

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onStatusApplied: async (ctx) => {
      // Both `addHeroStatus` (uses `statusName`) and the generic
      // `actionAddStatus` (uses `status`) fire this hook, with
      // different field names — read both for safety.
      const statusName = ctx.statusName || ctx.status;
      if (!statusName) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOwner;
      const luna   = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!luna?.name || luna.hp <= 0) return;

      // ── Effect 1: Poisoned → also permanently Burned ────────────
      if (statusName === 'poisoned') {
        const target    = ctx.target;
        const heroOwner = ctx.heroOwner;
        const heroIdx   = ctx.heroIdx;
        if (target && target.hp !== undefined && heroOwner != null && heroIdx != null) {
          // Already burned: upgrade in-place to permanent (no hook
          // fire — avoids the re-application cascade that would
          // re-trigger every onStatusApplied listener including a
          // mirrored Luna on the other side).
          if (target.statuses?.burned) {
            if (!target.statuses.burned.permanent) {
              target.statuses.burned.permanent = true;
              engine.log('luna_pele_burn_upgrade', {
                player: gs.players[pi]?.username,
                target: target.name,
              });
              engine.sync();
            }
          } else {
            await engine.addHeroStatus(heroOwner, heroIdx, 'burned', {
              permanent: true,
              appliedBy: pi,
              _skipReactionCheck: true,
            });
            engine.log('luna_pele_burn_apply', {
              player: gs.players[pi]?.username,
              target: target.name,
            });
          }
        }
        // Fall through — even if effect 1 triggered, effect 2 must
        // also be checked (the burn application above will fire its
        // own onStatusApplied('burned') which separately runs effect
        // 2 for both Lunas; this current hook's path is on
        // 'poisoned', which the burn-draw branch ignores).
      }

      // ── Effect 2: a target was Burned → draw 1 (cap 4 per turn) ──
      if (statusName === 'burned') {
        const turn = gs.turn || 0;
        if (luna._lunaBurnDrawTurn !== turn) {
          luna._lunaBurnDrawTurn  = turn;
          luna._lunaBurnDrawCount = 0;
        }
        if (luna._lunaBurnDrawCount >= BURN_DRAW_CAP) return;
        luna._lunaBurnDrawCount++;
        await engine.actionDrawCards(pi, 1);
        engine.log('luna_pele_draw', {
          player: gs.players[pi]?.username,
          drawnThisTurn: luna._lunaBurnDrawCount,
        });
      }
    },
  },
};
