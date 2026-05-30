// ═══════════════════════════════════════════
//  CARD EFFECT: "Attack"
//  Attack (Lv0, Normal)
//
//  The most basic Attack: choose any target,
//  deal damage equal to the attacker's effective
//  ATK stat (buffs / equips included — that's
//  what `hero.atk` is, vs `hero.baseAtk` which
//  ignores buffs). Self-targeting blocked.
//
//  Implementation routes through the generic
//  `ctx.executeAttack` helper so all the canonical
//  Attack plumbing comes for free:
//   • target prompt with the Anti Magic / first-
//     turn protection / Charme / Truth-Seeing
//     filters,
//   • `onAttackDeclare` pre-damage hook (Doq's
//     guess, Boots of Hermes, future "when this
//     Hero attacks" listeners),
//   • the standard `attack`-type damage path so
//     before/afterDamage / armed-arrow riders /
//     Sacred Hammer all compose normally,
//   • Hero AND Creature target dispatch through
//     `actionDealDamage` / `actionDealCreatureDamage`.
//
//  Animation: `quick_slash` — the canonical
//  double-slash white flash + sparks impact that
//  Quick Attack already uses.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = ctx.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const atk = hero.atk || 0;

      await ctx.executeAttack({
        title: 'Attack',
        description: `Deal ${atk} damage to a target.`,
        confirmLabel: `⚔️ Attack! (${atk})`,
        animationType: 'quick_slash',
        animDuration: 250,
        side: 'any',
        types: ['hero', 'creature'],
        excludeSelf: true,
      });

      engine.sync();
    },
  },
};
