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

const {
  tokenStatsForLevel, freeSupportSlots, placeBiomancyToken,
} = require('./_biomancy-shared');

module.exports = {
  activeIn: ['ability'],

  // CPU: Biomancy's afterPotionUsed trigger is a cancellable "you may" confirm.
  // The generic CPU resolver declines every cancellable confirm by default, so
  // without this the CPU would NEVER convert a spent Potion into a Token —
  // Biomancy would be dead for the CPU. Converting a spent Potion into a free
  // board Creature is always beneficial (eligibility already requires a free
  // Support Zone), so confirm. NOTE: the prompt's `title` MUST be the exact
  // card name 'Biomancy' for the brain's title→script cpuResponse lookup to
  // find this — the per-level label lives in the description instead.
  cpuResponse(engine, kind, promptData) {
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
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
        if (freeSupportSlots(engine, pi, hi).length === 0) continue;

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

        const stats = tokenStatsForLevel(entry.level).hp;

        const result = await engine.promptGeneric(pi, {
          // Title must stay the bare card name so the CPU brain's
          // title→script cpuResponse lookup resolves (see cpuResponse above);
          // the level is surfaced in the description instead.
          type: 'confirm',
          title: 'Biomancy',
          description: `Biomancy Lv${entry.level}: Convert the spent Potion into a Biomancy Token (${stats} HP, ${stats} damage) on ${entry.hero.name}?`,
          confirmLabel: '🌿 Create Token!',
          confirmClass: 'btn-success',
          cancellable: true,
          // True "you may" effect — Biomancy asks per Hero whether to
          // convert the spent Potion. Gerrymander redirects this.
          gerrymanderEligible: true,
        });

        if (!result || result.cancelled) continue;

        // Show Biomancy card to both players
        engine._broadcastEvent('card_reveal', { cardName: 'Biomancy' });
        await engine._delay(300);

        // Mark HOPT
        if (!gs.hoptUsed) gs.hoptUsed = {};
        gs.hoptUsed[`biomancy:${pi}:${entry.heroIdx}`] = gs.turn;

        // Platzierung, Override, Animation, Log und onCardEnterZone
        // liegen seit dem 16.8. in `_biomancy-shared.js` — dieselbe
        // Stelle, aus der auch Kyli ihre Tokens erzeugt. Verhalten
        // unveraendert, nur nicht mehr doppelt gepflegt.
        const placed = await placeBiomancyToken(
          engine, pi, entry.heroIdx, ctx.potionName, entry.level,
          { sourceName: 'Biomancy' },
        );
        if (!placed) continue;

        ctx.setFlag('placed', true);
        engine.sync();
        break;
      }
    },
  },
};
