// ═══════════════════════════════════════════
//  CARD EFFECT: "Warhorse"
//  Artifact (Equipment, Cost 10)
//
//  When the equipped Hero hits EXACTLY 1 target
//  with an Attack, that Attack's damage is
//  increased by 50.
//
//  Single-target detection mirrors The Master's
//  Sword: `gs._spellDamageLog` is populated as
//  targets are selected (before damage fires) and
//  splice-pruned on redirect / negate, so its
//  length at `beforeDamage` time reflects the
//  live "how many things will this Attack hit"
//  count. Length === 1 means the Attack hits one
//  target after every targeting-side modifier
//  resolves.
//
//  Multi-target Attacks (AoE, multi-pick) skip the
//  bonus — even if N-1 targets get filtered out by
//  Cardinal-immunity or similar last-step blocks
//  the originally-selected target count stays in
//  the log, so a 2-target Attack that fizzles
//  down to 1 hit still reads as 2 here. Matches
//  the literal "hits exactly 1 target" intent —
//  multi-target Attacks are not single-target
//  even when only one hit lands.
//
//  No passive ATK grant, so no grantAtk /
//  revokeAtk plumbing is needed.
// ═══════════════════════════════════════════

const CARD_NAME = 'Warhorse';
const BONUS = 50;

module.exports = {
  activeIn: ['support'],

  /**
   * Damage preview participant. `promptDamageTarget` passes
   * `opts.isSingleTarget: true` so the bonus is folded into the picker's
   * damage label exactly when the actual `beforeDamage` rider below will
   * fire (single-target Attacks). Non-attack damage types skip the
   * bonus — the rider only applies to Attacks.
   *
   * No "is this hero's Attack" gate here because `engine.estimateDamage`
   * already iterates only instances on the source hero's column (the
   * outer loop in `engine.estimateDamage` filters by `inst.owner` +
   * `inst.heroIdx`), so this hook is reached only when Warhorse's hero
   * is the prospective source.
   */
  estimateDamageBonus(_engine, _playerIdx, _heroIdx, baseDamage, damageType, opts) {
    if (damageType !== 'attack') return baseDamage;
    if (!opts?.isSingleTarget) return baseDamage;
    return baseDamage + BONUS;
  },

  hooks: {
    beforeDamage: (ctx) => {
      if (ctx.type !== 'attack') return;
      if (ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      const sourceOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (sourceOwner !== ctx.cardOwner) return;

      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      const gs = ctx._engine.gs;
      if ((gs._spellDamageLog?.length ?? 0) !== 1) return;

      ctx.modifyAmount(BONUS);
    },
  },
};
