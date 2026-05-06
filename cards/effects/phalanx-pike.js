// ═══════════════════════════════════════════
//  CARD EFFECT: "Phalanx Pike"
//  Artifact (Equipment, Cost 8)
//
//  ① Equipped Hero gains +30 ATK.
//  ② The equipped Hero does not trigger Surprises
//    with its Attacks. Covers every surprise that
//    fires from `_checkSurpriseWindow` (Booby
//    Trap, Firewall, etc.) — gated on damageType
//    === 'attack' so the same hero's Spells / Hero
//    effects / Creature activations still open the
//    window normally.
//  ③ Maximum 1 Phalanx Pike per Hero.
//
//  Wiring: the engine reads `hero._skipAttackSurprises`
//  inside `_checkSurpriseWindow`. We stamp the flag
//  on the equipped hero in onPlay/onGameStart and
//  clear it in onCardLeaveZone (only when no other
//  Pike is still equipped).
// ═══════════════════════════════════════════

const ATK_BONUS = 30;
const CARD_NAME = 'Phalanx Pike';

function _otherPikeOnHero(engine, ownerIdx, heroIdx, excludeId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeId &&
    c.owner === ownerIdx && c.zone === 'support' &&
    c.heroIdx === heroIdx && c.name === CARD_NAME
  );
}

function _applySurpriseSkip(engine, ownerIdx, heroIdx) {
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (hero) hero._skipAttackSurprises = true;
}

function _clearSurpriseSkipIfLast(engine, ownerIdx, heroIdx, excludeId) {
  if (_otherPikeOnHero(engine, ownerIdx, heroIdx, excludeId)) return;
  const hero = engine.gs.players[ownerIdx]?.heroes?.[heroIdx];
  if (hero) delete hero._skipAttackSurprises;
}

module.exports = {
  activeIn: ['support'],

  /**
   * Block placement if this hero already has a Phalanx Pike equipped.
   * Mirrors Vampiric Sword / Slippery Skates' anti-stack guard so the
   * +30 ATK can't be doubled up via repeated equips.
   */
  canEquipToHero(gs, playerIdx, heroIdx) {
    const supportZones = gs.players[playerIdx]?.supportZones[heroIdx] || [];
    for (const slot of supportZones) {
      if ((slot || []).includes(CARD_NAME)) return false;
    }
    return true;
  },

  hooks: {
    onPlay: (ctx) => {
      ctx.grantAtk(ATK_BONUS);
      _applySurpriseSkip(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
    },

    /**
     * Game start path — fires for pre-equipped Pikes loaded from a
     * puzzle preset. `atkGranted` is the canonical "already applied"
     * counter set by ctx.grantAtk; if non-zero, skip both halves.
     */
    onGameStart: (ctx) => {
      if ((ctx.card.counters.atkGranted || 0) > 0) return;
      const hero = ctx.attachedHero;
      if (!hero?.name) return;
      ctx.grantAtk(ATK_BONUS);
      _applySurpriseSkip(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx);
    },

    /**
     * On removal: revoke ATK and clear the surprise-skip flag IFF no
     * other Pike is still equipped to the same hero.
     */
    onCardLeaveZone: (ctx) => {
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== ctx.card.heroIdx || ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      ctx.revokeAtk();
      _clearSurpriseSkipIfLast(ctx._engine, ctx.fromOwner, ctx.fromHeroIdx, ctx.card.id);
    },
  },
};
