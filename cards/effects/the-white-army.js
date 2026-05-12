// ═══════════════════════════════════════════
//  CARD EFFECT: "The White Army"
//  Spell — Summoning Magic Lv0
//
//  Choose up to ⌊N/2⌋ targets on the board and
//  Freeze them for 1 turn, where N = number of
//  Creatures you control (subtype-Creatures
//  count too). If you control ≥2 Lv0 Creatures,
//  this counts as an additional Action. Only one
//  "The White Army" can be played per turn.
//
//  Gating: greys out in hand whenever it would
//  Freeze 0 targets — that is, the player owns
//  < 2 Creatures OR no freezable non-Frozen
//  targets currently exist. `spellPlayCondition`
//  is the standard hand-eligibility hook.
// ═══════════════════════════════════════════

const {
  countOwnCreatures,
  countOwnLv0Creatures,
  enumerateFreezableNonFrozenTargets,
  applyFreezeToTarget,
} = require('./_mischief-militia-shared');

const CARD_NAME = 'The White Army';

function maxTargets(engine, pi) {
  return Math.floor(countOwnCreatures(engine, pi) / 2);
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.

  // Free-action gate: passes when the caster controls ≥2 Lv0 Creatures.
  // Subtype-Creatures with `level: null` are excluded (see
  // `countOwnLv0Creatures` — numeric-level only).
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    return countOwnLv0Creatures(engine, pi) >= 2;
  },

  /**
   * Eligibility gate consulted by validateActionPlay AND the CPU's
   * hand filter. Grays this Spell in hand whenever it would freeze 0
   * targets — i.e. the cap is 0 or no freezable target exists.
   * Also enforces the "1 per turn" rule via a per-player turn stamp.
   */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true; // optimistic when engine not threaded
    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._whiteArmyUsedTurn === gs.turn) return false;
    if (maxTargets(engine, pi) < 1) return false;
    if (enumerateFreezableNonFrozenTargets(engine).length === 0) return false;
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const gs = engine.gs;
      const ps = gs.players[pi];
      const cap = maxTargets(engine, pi);

      const candidates = enumerateFreezableNonFrozenTargets(engine);

      if (cap < 1 || candidates.length === 0) {
        // Race / late-revealed Lily etc. — refund the spell.
        gs._spellCancelled = true;
        return;
      }

      const upper = Math.min(cap, candidates.length);
      const picked = await engine.promptEffectTarget(pi, candidates, {
        title: CARD_NAME,
        description: `Freeze up to ${upper} target(s) for 1 turn.`,
        confirmLabel: '❄️ Freeze!',
        confirmClass: 'btn-info',
        cancellable: true,
        maxTotal: upper,
        alwaysConfirmable: true,
      });

      if (!picked) {
        gs._spellCancelled = true;
        return;
      }

      // Claim the once-per-turn slot the moment the player commits the
      // prompt — even on a 0-target confirm, the Spell counts as cast.
      ps._whiteArmyUsedTurn = gs.turn;

      let frozenCount = 0;
      for (const id of picked) {
        const t = candidates.find(c => c.id === id);
        if (!t) continue;
        if (await applyFreezeToTarget(engine, t, 1, pi)) frozenCount++;
      }
      await engine._delay(300);
      engine.log('the_white_army', {
        player: ps.username, frozen: frozenCount,
      });
      engine.sync();
    },
  },
};
