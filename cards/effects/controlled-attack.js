// ═══════════════════════════════════════════
//  CARD EFFECT: "Controlled Attack"
//  Spell (Decay Magic Lv1) — Inherent additional
//  Action. Choose an opponent's Hero. You may
//  use that Hero's Abilities and active effect
//  this turn as if you controlled it.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx = pi === 0 ? 1 : 0;

      // Prompt to choose an opponent's hero
      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['hero'],
        damageType: null,
        title: 'Controlled Attack',
        description: 'Choose an opponent\'s Hero to control its Abilities and active effect this turn.',
        confirmLabel: '🔮 Control!',
        confirmClass: 'btn-danger',
        cancellable: true,
        _skipRedirectCheck: true,
      });

      if (!target) return;

      const tgtHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (!tgtHero) return;

      // ── beforeHeroEffect gate ──
      // Resistance (and any future "block first non-damaging effect"
      // ability) listens on this hook and calls `ctx.cancel()`. Without
      // the gate, the `controlledBy` mutation lands instantly and
      // bypasses every defensive Ability — same shape the engine already
      // uses for healing (line ~4234) and buffs (line ~7006). Cancelled
      // → silently fizzle; the gold cost was paid by the caller path.
      const effectCtx = {
        playerIdx: target.owner, heroIdx: target.heroIdx, hero: tgtHero,
        effectType: 'control', cancelled: false, _skipReactionCheck: true,
      };
      await engine.runHooks('beforeHeroEffect', effectCtx);
      if (effectCtx.cancelled) {
        engine.log('controlled_attack_blocked', {
          player: gs.players[pi]?.username,
          target: tgtHero.name,
        });
        engine.sync();
        return;
      }

      // Apply controlled status
      tgtHero.controlledBy = pi;

      // Reaction-window hook — Very Special Prisoner triggers on this.
      // Distinct `kind: 'controlled'` so listeners can tell Controlled
      // Attack's takeover apart from Charme / Dark Gear / temp steals
      // if they need finer-grained handling.
      await engine.runHooks('onTakeControl', {
        controllerPi: pi,
        originalOwnerPi: target.owner,
        targetType: 'hero',
        targetName: tgtHero.name,
        targetHero: tgtHero,
        heroIdx: target.heroIdx,
        kind: 'controlled',
        sourceName: 'Controlled Attack',
      });

      // Dark control energy animation
      engine._broadcastEvent('dark_control', {
        owner: target.owner,
        heroIdx: target.heroIdx,
      });
      await engine._delay(900);

      engine.log('controlled_attack', {
        player: gs.players[pi]?.username,
        target: tgtHero.name,
        opponent: gs.players[target.owner]?.username,
      });

      engine.sync();
    },
  },
};
