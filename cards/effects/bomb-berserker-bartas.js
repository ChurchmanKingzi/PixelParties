// ═══════════════════════════════════════════
//  CARD EFFECT: "Bomb Berserker Bartas"
//  Hero — When this Hero hits exactly 1 target
//  with a normal Destruction Magic Spell whose
//  original level is lower than this Hero's DM
//  level (+ Performance), you may choose a second
//  target for the Spell to hit afterwards.
//
//  The second cast skips costs but applies all
//  effects including recoil. Works generically
//  with all current and future Destruction Spells.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Only trigger for spells cast BY this hero
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Don't trigger on a second cast (prevent infinite loop)
      if (ctx.isSecondCast) return;

      // Check Bartas is still alive and capable
      const ps = gs.players[pi];
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Check spell is a Normal Destruction Magic Spell
      const spellData = ctx.spellCardData;
      if (!spellData) return;
      if (!hasCardType(spellData, 'Spell')) return;
      if ((spellData.subtype || '').toLowerCase() !== 'normal') return;
      if (spellData.spellSchool1 !== 'Destruction Magic' && spellData.spellSchool2 !== 'Destruction Magic') return;

      // Check exactly 1 opponent target was hit
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      // Check spell level < Bartas's Destruction Magic level
      const spellLevel = spellData.level || 0;
      const abZones = ps.abilityZones[heroIdx] || [];
      let dmLevel = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        const base = slot[0];
        for (const ab of slot) {
          if (ab === 'Destruction Magic') dmLevel++;
          else if (ab === 'Performance' && base === 'Destruction Magic') dmLevel++;
        }
      }
      if (spellLevel >= dmLevel) return;

      // Check Bartas still has the required Destruction Magic level to cast
      if (dmLevel < spellLevel) return;

      // Check there's at least 1 OTHER valid target on the opponent's side
      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs = gs.players[oppIdx];
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

      // Re-verify Bartas is still alive and capable right before prompting
      // (covers edge cases where hero state changed during spell resolution)
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Prompt: "Hit a second target with [Spell name]?"
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Bomb Berserker Bartas',
        message: `Hit a second target with ${ctx.spellName}?`,
      });
      if (!confirmed) return;

      // Set up second cast: exclude first target, mark as second cast
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [firstTargetId];
      gs._bartasSecondCast = true;

      // Load spell script and re-invoke onPlay
      const spellScript = loadCardEffect(ctx.spellName);
      if (!spellScript?.hooks?.onPlay) return;

      // Create a temporary card instance for the second cast
      const tempInst = engine._trackCard(ctx.spellName, pi, 'hand', heroIdx, -1);

      try {
        await engine.runHooks('onPlay', {
          _onlyCard: tempInst, playedCard: tempInst,
          cardName: ctx.spellName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Bartas second cast error for "${ctx.spellName}":`, err.message);
      }

      // Clean up temp instance
      engine._untrackCard(tempInst.id);

      // Clean up tracking (may be cleaned again by handler, that's fine)
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._bartasSecondCast;

      engine.sync();
    },
  },
};
