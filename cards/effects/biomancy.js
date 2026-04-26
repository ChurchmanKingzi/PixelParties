// ═══════════════════════════════════════════
//  CARD EFFECT: "Biomancy"
//  Ability — Passive (afterPotionUsed hook)
//
//  When the controller uses a Potion from hand,
//  eligible Biomancy instances (highest level
//  first) prompt to convert the spent Potion
//  into a Biomancy Token creature placed in a
//  free Support Zone. Soft HOPT per hero.
//
//  Token stats by level:
//    Lv1: 40 HP, 40 damage
//    Lv2: 60 HP, 60 damage
//    Lv3: 80 HP, 80 damage
//
//  Animation: sickly jungle flowers overgrowing.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const LEVEL_STATS = { 1: 40, 2: 60, 3: 80 };

module.exports = {
  activeIn: ['ability'],
  // Lizbeth/Smugbeth: auto-mirror disabled. The hook walks the
  // borrower's own heroes for free Support Zones + Biomancy level,
  // and Lizbeth without her own Biomancy slot resolves no eligible
  // host. Phase 3 punch list — bespoke handler should read level from
  // the SOURCE Biomancy and place the token on Lizbeth's side.
  disableLizbethMirror: true,

  hooks: {
    afterPotionUsed: async (ctx) => {
      // Already placed by another Biomancy instance — skip
      if (ctx.placed) return;

      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // Only trigger for the potion owner's Biomancy
      if (ctx.potionOwner !== pi) return;

      // Prevent re-entry: only the first Biomancy instance handles all
      if (ctx._biomancyHandled) return;
      ctx.setFlag('_biomancyHandled', true);

      const ps = gs.players[pi];

      // Gather all eligible Biomancy heroes with their levels
      const eligible = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

        // Must have a free support zone
        const supZones = ps.supportZones[hi] || [[], [], []];
        if (![0, 1, 2].some(z => (supZones[z] || []).length === 0)) continue;

        // Soft HOPT: check if this hero's Biomancy was already used this turn
        const hoptKey = `biomancy:${pi}:${hi}`;
        if (gs.hoptUsed?.[hoptKey] === gs.turn) continue;

        // Determine Biomancy level on this hero
        const abZones = ps.abilityZones[hi] || [];
        const level = engine.countAbilitiesForSchool('Biomancy', abZones);
        if (level <= 0) continue;

        eligible.push({ heroIdx: hi, level, hero });
      }

      if (eligible.length === 0) return;

      // Sort by level descending (highest first)
      eligible.sort((a, b) => b.level - a.level);

      // Prompt each in order until one is accepted or all declined
      for (const entry of eligible) {
        if (ctx.placed) break;

        const stats = LEVEL_STATS[Math.min(entry.level, 3)];

        const result = await engine.promptGeneric(pi, {
          type: 'confirm',
          title: `Biomancy Lv${entry.level}`,
          description: `Convert the spent Potion into a Biomancy Token (${stats} HP, ${stats} damage) on ${entry.hero.name}?`,
          confirmLabel: '🌿 Create Token!',
          confirmClass: 'btn-success',
          cancellable: true,
        });

        if (!result || result.cancelled) continue;

        // Show Biomancy card to both players
        engine._broadcastEvent('card_reveal', { cardName: 'Biomancy' });
        await engine._delay(300);

        // Mark HOPT
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[`biomancy:${pi}:${entry.heroIdx}`] = gs.turn;

        // Place the Potion itself as a Creature/Token in the support zone
        const potionName = ctx.potionName;
        const cardDB = engine._getCardDB();
        const potionData = cardDB[potionName];
        const placeResult = engine.safePlaceInSupport(potionName, pi, entry.heroIdx, -1);
        if (!placeResult) continue;

        const { inst, actualSlot } = placeResult;

        // Override card data so the engine treats this Potion as a Creature/Token
        inst.counters._cardDataOverride = {
          ...(potionData || {}),
          cardType: 'Creature/Token',
          hp: stats,
          effect: `Once per turn: Deal ${stats} damage to any target on the board.`,
        };
        // Load the Biomancy Token's creature effect script instead of the potion's
        inst.counters._effectOverride = 'Biomancy Token';
        inst.counters.currentHp = stats;
        inst.counters.maxHp = stats;
        inst.counters.biomancyDamage = stats;
        inst.counters.biomancyLevel = entry.level;

        // Play flower overgrowth animation
        engine._broadcastEvent('play_zone_animation', {
          type: 'biomancy_bloom',
          owner: pi, heroIdx: entry.heroIdx, zoneSlot: actualSlot,
        });
        await engine._delay(600);

        engine.log('biomancy_token_created', {
          player: ps.username, hero: entry.hero.name,
          potion: ctx.potionName, level: entry.level, hp: stats, damage: stats,
        });

        // Fire onCardEnterZone to trigger Pes'zet etc.
        await engine.runHooks('onCardEnterZone', {
          enteringCard: inst, toZone: 'support', toHeroIdx: entry.heroIdx,
          _skipReactionCheck: true,
        });

        ctx.setFlag('placed', true);
        engine.sync();
        break;
      }
    },
  },
};
