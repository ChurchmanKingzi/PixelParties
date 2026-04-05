// ═══════════════════════════════════════════
//  CARD EFFECT: "Creativity"
//  Ability — Passive trigger (soft once per
//  turn per Hero).
//  When ANY Ability is attached to this Hero,
//  draw cards equal to the Creativity level
//  BEFORE the new Ability was attached.
//  Lv0→0 draws, Lv1→1, Lv2→2, Lv3→3.
//  Level = slot length (includes Performance
//  copies stacked on top).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],

  hooks: {
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;

      // Only care about abilities entering THIS hero's zone (same player + same hero)
      if (ctx.toZone !== 'ability') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      if (entering.owner !== ctx.cardOwner) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Soft once per turn per hero — keyed by hero index
      const soptKey = `creativity-draw:${pi}:${heroIdx}`;
      if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
      if (engine.gs.hoptUsed[soptKey] === engine.gs.turn) return;

      // Find the Creativity slot and its current level
      // Level = slot length (includes Performance copies on top)
      const ps = ctx.players[pi];
      const abZones = ps.abilityZones[heroIdx] || [];
      let creativitySlotIdx = -1;
      let creativityLevel = 0;
      for (let si = 0; si < abZones.length; si++) {
        const slot = abZones[si] || [];
        if (slot.length > 0 && slot[0] === 'Creativity') {
          creativitySlotIdx = si;
          creativityLevel = slot.length;
          break;
        }
      }

      if (creativityLevel <= 0) return;

      // If the entering card was placed into the Creativity slot,
      // subtract 1 to get the level BEFORE attachment
      if (entering.zoneSlot === creativitySlotIdx) {
        creativityLevel--;
      }

      // No draws at level 0 or below
      if (creativityLevel <= 0) return;

      // Claim SOPT and draw
      engine.gs.hoptUsed[soptKey] = engine.gs.turn;

      // Flash the Creativity ability zone (visible to all players)
      engine._broadcastEvent('ability_activated', {
        owner: pi, heroIdx, zoneIdx: creativitySlotIdx,
      });

      // Sync BEFORE drawing so the client sees the hand without the
      // just-played ability card. Without this, the first draw merely
      // restores the hand to its previous length and gets no animation.
      engine.sync();
      await engine._delay(350);

      for (let i = 0; i < creativityLevel; i++) {
        if ((ps.mainDeck || []).length === 0) break;
        await engine.actionDrawCards(pi, 1);
        engine.sync();
        await engine._delay(250);
      }
    },
  },
};
