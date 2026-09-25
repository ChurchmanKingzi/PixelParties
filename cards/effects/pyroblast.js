// ═══════════════════════════════════════════
//  CARD EFFECT: "Pyroblast"
//  Spell (Destruction Magic Lv0) — HOPT
//
//  Choose up to N targets (where N = free
//  Support Zones you control) and deal 100
//  Destruction Spell damage to each.
//  Then place one Pollution Token per target
//  hit into your free Support Zones.
//
//  The player picks zones one-by-one for each
//  Pollution Token placement.
//
//  Refactored to use _pollution-shared.js for
//  zone counting and token placement — no
//  card-specific Pollution logic remains here.
// ═══════════════════════════════════════════

const { countFreeZones, placePollutionTokens } = require('./_pollution-shared');

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  placesPollutionTokens: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Pre-check HOPT without claiming — claim only after the
      // player commits at least one target so cancelling the picker
      // doesn't burn the once-per-turn slot.
      if (engine.gs.hoptUsed?.[`pyroblast:${pi}`] === engine.gs.turn) return;

      // Count free support zones — this caps the number of targets
      const maxTargets = countFreeZones(gs, pi);
      if (maxTargets === 0) {
        engine.log('pyroblast_fizzle', { player: gs.players[pi].username, reason: 'no_free_zones' });
        return;
      }

      // ── Multi-target selection ──
      const hitTargets = await ctx.promptMultiTarget({
        side: 'any',
        types: ['hero', 'creature'],
        max: maxTargets,
        min: 1,
        baseDamage: 100,
        title: 'Pyroblast',
        description: `Select up to ${maxTargets} target${maxTargets > 1 ? 's' : ''} to deal 100 damage each.`,
        confirmLabel: '🔥 Pyroblast!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });

      if (hitTargets.length === 0) return; // Cancelled

      // Commit — claim HOPT now.
      ctx.hardOncePerTurn('pyroblast');

      // ── Fire animations on all targets simultaneously ──
      // ★ v1392: Treffer über die EINE Stelle für Mehrfachtreffer.
      await ctx.dealDamageToTargets(hitTargets.map(t => t.type === 'hero'
        ? { type: 'hero', owner: t.owner, heroIdx: t.heroIdx }
        : { type: 'creature', inst: t.cardInstance, owner: t.owner, heroIdx: t.heroIdx, slotIdx: t.slotIdx }), {
        damage: 100, damageType: 'destruction_spell', sourceName: 'Pyroblast',
        animationType: 'flame_strike', animDelay: 400, hitDelay: 0,
        surpriseCheck: false, postTargetCheck: false,
      });

      // Single sync after all damage — damage numbers appear simultaneously
      engine.sync();
      await engine._delay(400);

      // ── Place Pollution Tokens (shared helper handles zone-pick loop,
      //    hook firing, logging, and _checkReactiveHandLimits) ──
      const { placed } = await placePollutionTokens(engine, pi, hitTargets.length, 'Pyroblast', {
        promptCtx: ctx,
      });

      engine.log('pyroblast', {
        player: gs.players[pi].username,
        targets: hitTargets.map(t => t.cardName),
        tokensPlaced: placed,
      });

      engine.sync();
    },
  },
};
