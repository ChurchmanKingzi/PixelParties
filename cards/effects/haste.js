// ═══════════════════════════════════════════
//  CARD EFFECT: "Haste"
//  Spell (Support Magic Lv1, Normal)
//  Draw 2/3/4 cards based on caster's total
//  Support Magic level. Cards drawn one by one.
// ═══════════════════════════════════════════

const { drawWouldBeBlocked } = require('./_draw-block-shared');

module.exports = {
  cpuMeta: { scalesWithSchool: 'Support Magic' },

  // ── Tuscan Artist (Als Ruling 16.8.) ──
  // Haste zieht 2/3/4 je nach Support-Magic-Level des CASTERS. Der Zug
  // ist ihr einziger Nutzen, also ist sie gesperrt, wenn genau dieser
  // Held 2 oder 3 zoege — bei Level 3+ (4 Karten) bleibt sie spielbar.
  // Deshalb `canPlayWithHero` und nicht `neverPlayable`: der Server
  // graut ueber `cardGateBlockedCards` erst aus, wenn KEIN eigener Held
  // sie mehr spielen kann.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[pi];
    const abZones = ps?.abilityZones?.[heroIdx] || [[], [], []];
    const smLevel = engine.countAbilitiesForSchool('Support Magic', abZones);
    const drawCount = smLevel >= 3 ? 4 : smLevel >= 2 ? 3 : 2;
    return !drawWouldBeBlocked(engine, pi, drawCount);
  },
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

      // Draw cards
      await engine.actionDrawCards(pi, drawCount);

      engine.log('haste', { player: ps.username, drawn: drawCount, smLevel });
      engine.sync();
    },
  },
};
