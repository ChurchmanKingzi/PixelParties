// ═══════════════════════════════════════════
//  CARD EFFECT: "Andras, the Human Weapon"
//  Hero — 400 HP, 80 ATK — BANNED
//  Starting abilities: Fighting, Resistance
//
//  When this Hero hits exactly 1 target with a
//  normal Attack whose original level is lower
//  than this Hero's Fighting level, you may
//  choose a second target for the Attack to hit
//  afterwards.
//
//  Mirrors Bomb Berserker Bartas exactly, but
//  for Attacks instead of Destruction Magic Spells:
//  - Checks cardType 'Attack' + subtype 'Normal'
//  - Level check against Fighting level (via
//    engine.countAbilitiesForSchool, which
//    includes Performance wildcards)
//  - Re-runs onPlay on a temporary instance with
//    _bartasSecondCast = true and the first
//    target excluded
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Andras, the Human Weapon';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs     = ctx.gameState;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only trigger for attacks cast BY this hero
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Prevent infinite loop on the second hit
      if (ctx.isSecondCast) return;

      // Don't trigger if the attack was negated
      if (gs._spellNegatedByEffect) return;

      // Andras must be alive and capable
      const ps   = gs.players[pi];
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Must be a Normal Attack (not a Reaction, Surprise, etc.)
      const attackData = ctx.spellCardData;
      if (!attackData) return;
      if (!hasCardType(attackData, 'Attack')) return;
      if ((attackData.subtype || '').toLowerCase() !== 'normal') return;

      // Must have hit exactly 1 target
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      // Attack's original level must be lower than Andras's Fighting level
      const attackLevel  = attackData.level || 0;
      const fightingLevel = engine.countAbilitiesForSchool('Fighting', ps.abilityZones[heroIdx] || []);
      if (attackLevel >= fightingLevel) return;

      // Must be at least 1 other valid target on the opponent's side
      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs  = gs.players[oppIdx];
      const firstTargetId = targets[0].id;
      let hasOtherTarget = false;

      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const h = oppPs.heroes[hi];
        if (!h?.name || h.hp <= 0) continue;
        if (`hero-${oppIdx}-${hi}` !== firstTargetId) { hasOtherTarget = true; break; }
      }
      if (!hasOtherTarget) {
        for (const inst of engine.cardInstances) {
          if (inst.owner !== oppIdx || inst.zone !== 'support') continue;
          const cId = `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`;
          if (cId !== firstTargetId) { hasOtherTarget = true; break; }
        }
      }
      if (!hasOtherTarget) return;

      // Re-verify Andras is still alive right before prompting
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Prompt: hit a second target?
      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Hit a second target with ${ctx.spellName}?`,
      });
      if (!confirmed) return;

      engine.log('andras_second_hit', {
        player: ps.username, hero: hero.name, attack: ctx.spellName,
      });

      // Set up second hit: exclude first target, flag as second cast
      gs._spellDamageLog        = [];
      gs._spellExcludeTargets   = [firstTargetId];
      gs._bartasSecondCast      = true; // Shared flag — ctx.isSecondCast reads this

      // Load the attack script and re-invoke onPlay
      const attackScript = loadCardEffect(ctx.spellName);
      if (!attackScript?.hooks?.onPlay) return;

      // Create a temporary card instance for the second hit
      const tempInst = engine._trackCard(ctx.spellName, pi, 'hand', heroIdx, -1);

      try {
        await engine.runHooks('onPlay', {
          _onlyCard: tempInst, playedCard: tempInst,
          cardName: ctx.spellName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Andras second hit error for "${ctx.spellName}":`, err.message);
      }

      // Clean up temp instance and tracking flags
      engine._untrackCard(tempInst.id);
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._bartasSecondCast;

      engine.sync();
    },
  },
};
