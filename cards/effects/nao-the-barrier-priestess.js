// ═══════════════════════════════════════════
//  CARD EFFECT: "Nao, the Barrier Princess"
//  Hero — Passive effect:
//
//  When Nao uses an Attack or Spell whose effect
//  includes healing a target (including herself),
//  the healing can overheal — the target's current
//  HP may exceed its max HP with no cap.
//
//  While a target has HP > max HP, it displays a
//  semi-transparent 〇 barrier indicator and its
//  HP value is shown in green.
//
//  The overheal is permanent (no decay per turn)
//  and only decreases when the target takes damage.
//  Applies to both heroes and creatures.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * On game start: register the overheal passive flag
     * so actionHealHero knows to bypass the maxHp cap
     * for heals originating from this hero's slot.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      if (!gs.heroFlags[key]) gs.heroFlags[key] = {};
      gs.heroFlags[key].overhealPassive = true;
    },

    /**
     * Also set on onPlay in case Nao enters mid-game
     * (e.g. via Initiation Ritual or similar effects).
     */
    onPlay: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      if (!gs.heroFlags[key]) gs.heroFlags[key] = {};
      gs.heroFlags[key].overhealPassive = true;
    },
  },
};
