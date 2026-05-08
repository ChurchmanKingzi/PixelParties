// ═══════════════════════════════════════════
//  CARD EFFECT: "Divine Gift of Skill"
//  Spell (Magic Arts Lv0, Normal)
//
//  Once per game (shared "Divine Gift" key).
//  Inherent additional Action.
//  Choose a Hero you control. Up to 4 additional
//  Abilities may be attached to that Hero this
//  turn. That Hero cannot perform an Action for
//  the rest of the turn unless they have at least
//  Magic Arts 1.
//
//  State surfaces:
//    • `ps._bonusAbilityAttachments[heroIdx] = 4`
//      The ability-play gate in server.js consumes
//      these after the standard one-ability-per-
//      turn slot is spent.
//    • `hero._skillLockTurn = gs.turn`
//      Read by `engine.isHeroSkillLocked`, which
//      gates Spell / Attack / Creature plays
//      (validateActionPlay) and action-cost
//      ability / hero-effect activations
//      (server.js gates). The lock auto-bypasses
//      once the hero has Magic Arts >= 1, so
//      stacking on the bonus slots up to that
//      threshold restores normal Action play.
// ═══════════════════════════════════════════

const BONUS_ATTACHMENTS = 4;

function getOwnLivingHeroTargets(gs, pi) {
  const ps = gs.players[pi];
  const targets = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    targets.push({
      id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi,
      cardName: hero.name,
    });
  }
  return targets;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  inherentAction: true,
  oncePerGame: true,
  oncePerGameKey: 'divineGift',

  spellPlayCondition(gs, pi) {
    return getOwnLivingHeroTargets(gs, pi).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const targets = getOwnLivingHeroTargets(gs, pi);
      if (targets.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Divine Gift of Skill',
        description: `Choose a Hero. They may attach up to ${BONUS_ATTACHMENTS} additional Abilities this turn, but cannot perform an Action this turn unless they have Magic Arts 1+.`,
        confirmLabel: '🎓 Bless!',
        confirmClass: 'btn-success',
        cancellable: true,
        greenSelect: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1 },
        maxTotal: 1,
      });

      if (!picked || picked.length === 0) {
        gs._spellCancelled = true;
        return;
      }
      const t = targets.find(tt => tt.id === picked[0]);
      if (!t) {
        gs._spellCancelled = true;
        return;
      }
      const hero = ps.heroes[t.heroIdx];
      if (!hero?.name || hero.hp <= 0) {
        gs._spellCancelled = true;
        return;
      }

      // Grant bonus ability attachments. Stacks if multiple cards somehow apply.
      if (!ps._bonusAbilityAttachments) ps._bonusAbilityAttachments = {};
      ps._bonusAbilityAttachments[t.heroIdx] =
        (ps._bonusAbilityAttachments[t.heroIdx] || 0) + BONUS_ATTACHMENTS;

      // Lock Actions for this hero this turn (auto-bypassed when their
      // Magic Arts level reaches 1+).
      hero._skillLockTurn = gs.turn;

      // Visible Blessed buff icon — `BuffColumn` reads `hero.buffs[name]`
      // and renders the entry in BUFF_ICONS. The tooltip's function form
      // pulls live `remaining` / `locked` from the buff data, so
      // server.js doPlayAbility must keep these fields in sync as
      // bonus slots are consumed and as Magic Arts level changes.
      hero.buffs = hero.buffs || {};
      hero.buffs.blessed_skill = {
        remaining: ps._bonusAbilityAttachments[t.heroIdx],
        locked: engine.isHeroSkillLocked(pi, t.heroIdx),
        source: 'Divine Gift of Skill',
      };

      engine._broadcastEvent('play_zone_animation', {
        type: 'blessed_skill_burst', owner: pi, heroIdx: t.heroIdx, zoneSlot: -1,
      });
      await engine._delay(900);

      engine.log('divine_gift_skill', {
        player: ps.username,
        hero: hero.name,
        bonusAttachments: BONUS_ATTACHMENTS,
      });
      engine.sync();
    },
  },
};
