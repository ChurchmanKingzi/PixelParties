// ═══════════════════════════════════════════
//  CARD EFFECT: "Haste"
//  Spell (Support Magic Lv1, Normal)
//  Draw 2/3/4 cards based on caster's total
//  Support Magic level. Cards drawn one by one.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Calculate Support Magic level
      const abZones = ps.abilityZones[heroIdx] || [[], [], []];
      const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
      const drawCount = smLevel >= 3 ? 4 : smLevel >= 2 ? 3 : 2;

      // Confirm
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Haste',
        message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''}. (Support Magic Lv${smLevel})`,
        confirmLabel: `⚡ Haste! (+${drawCount})`,
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Draw cards one by one
      for (let i = 0; i < drawCount; i++) {
        if ((ps.mainDeck || []).length === 0) break;
        await engine.actionDrawCards(pi, 1);
        engine.sync();
        if (i < drawCount - 1) await engine._delay(200);
      }

      engine.log('haste', { player: ps.username, drawn: drawCount, smLevel });
      engine.sync();
    },
  },
};
