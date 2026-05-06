// ═══════════════════════════════════════════
//  CARD EFFECT: "Grisgar, Emissary of the Demon Lord"
//  Hero — Decay-Magic mirror of Bomb Berserker
//  Bartas. When this Hero hits exactly 1 target
//  with a Normal Decay Magic Spell whose level is
//  lower than this Hero's Decay Magic level, the
//  controller may choose a second target for the
//  Spell to hit afterwards.
//
//  Re-cast skips costs but re-runs onPlay, so all
//  on-hit effects (status applications, recoil,
//  follow-ups) compose naturally with any current
//  or future Decay Magic Spell.
//
//  Reuses the engine's existing second-cast plumbing:
//    • `gs._bartasSecondCast` — historical name, but
//      it's the *generic* second-cast flag the engine
//      and other cards already key off of (see the
//      "Shared flag" note in andras-the-human-weapon
//      .js, and the `isSecondCast` read in server.js
//      :3384 + engine.js:8283). Sharing it means
//      Fire Bolts' second-cast clause, Victory Phoenix
//      Cannon's recoil cleanup, etc. all work for
//      Grisgar with zero new wiring.
//    • `gs._spellExcludeTargets` — the engine's per-
//      spell "don't re-pick this target" list, also
//      shared with Bartas / Andras.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Grisgar, Emissary of the Demon Lord';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    afterSpellResolved: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Trigger only on Spells cast BY this Hero.
      if (ctx.casterIdx !== pi || ctx.heroIdx !== heroIdx) return;

      // Guard against recursion — never re-fire on a re-cast.
      if (ctx.isSecondCast) return;

      // Negated Spells (Anti Magic Shield / Master's Plan / counter-
      // spells) don't qualify — the original cast didn't "hit".
      if (gs._spellNegatedByEffect) return;

      const ps = gs.players[pi];
      const hero = ps.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Spell must be a Normal Decay Magic Spell (subtype 'Normal'
      // excludes Reactions / Surprises). Match either school slot in
      // case a future card lists Decay Magic as spellSchool2.
      const spellData = ctx.spellCardData;
      if (!spellData) return;
      if (!hasCardType(spellData, 'Spell')) return;
      if ((spellData.subtype || '').toLowerCase() !== 'normal') return;
      if (spellData.spellSchool1 !== 'Decay Magic' && spellData.spellSchool2 !== 'Decay Magic') return;

      // Exactly 1 damage target. `damageTargets` is the deduplicated
      // selected-target list the engine populates per Spell.
      const targets = ctx.damageTargets || [];
      if (targets.length !== 1) return;

      // Spell level must be strictly LESS than Grisgar's Decay Magic
      // level. `countAbilitiesForSchool` already folds in stacked
      // wildcards (Performance, etc.) so this is the canonical level
      // measurement Bartas uses too.
      const spellLevel = spellData.level || 0;
      const dmLevel = engine.countAbilitiesForSchool('Decay Magic', ps.abilityZones[heroIdx] || []);
      if (spellLevel >= dmLevel) return;

      // At least 1 OTHER opponent-side target must exist — otherwise
      // the prompt has no answer and we'd just spin the recast for
      // nothing. Mirror Bartas's check exactly.
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

      // Re-verify Grisgar is still up before prompting — same belt-
      // and-suspenders re-check Bartas does, since Spell resolution
      // can mutate hero state between the entry guard and here
      // (e.g. self-recoil into a Surprise that freezes her).
      if (hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Hit a second target with ${ctx.spellName}?`,
      });
      if (!confirmed) return;

      engine.log('grisgar_second_cast', {
        player: ps.username, hero: hero.name, spell: ctx.spellName,
      });

      // Re-cast plumbing — fresh damage log, target exclusion list,
      // shared second-cast flag (see header comment).
      gs._spellDamageLog = [];
      gs._spellExcludeTargets = [firstTargetId];
      gs._bartasSecondCast = true;

      const spellScript = loadCardEffect(ctx.spellName);
      if (!spellScript?.hooks?.onPlay) return;

      const tempInst = engine._trackCard(ctx.spellName, pi, 'hand', heroIdx, -1);

      try {
        await engine.runHooks('onPlay', {
          _onlyCard: tempInst, playedCard: tempInst,
          cardName: ctx.spellName, zone: 'hand', heroIdx,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error(`[Engine] Grisgar second cast error for "${ctx.spellName}":`, err.message);
      }

      engine._untrackCard(tempInst.id);

      // Defensive cleanup — most paths through the engine and the
      // shared cards (Victory Phoenix Cannon, Andras) clear these
      // already, but a re-cast that throws or returns early before
      // hitting those cleanup sites would otherwise leak.
      delete gs._spellDamageLog;
      delete gs._spellExcludeTargets;
      delete gs._bartasSecondCast;

      engine.sync();
    },
  },
};
