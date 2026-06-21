// ═══════════════════════════════════════════
//  CARD EFFECT: "Chosen Sacrifice"
//  Creature (Summoning Magic Lv0, 20 HP)
//
//  "When you would sacrifice a Creature you control, you may instead
//   sacrifice this Creature in your hand. When you sacrifice this
//   Creature, draw 1 card OR gain 4 Gold."
//
//  ── Substitute-from-hand ──
//  `sacrificableFromHand: true` is the engine marker (read by
//  `_collectSacrificeCandidates` → `_getHandSacrificeSubstitutes`) that
//  injects this card, while it sits in hand, as a selectable tribute in
//  EVERY "sacrifice a Creature you control" picker — rendered as a
//  clickable hand card (`type: 'hand'`, the Rocky Slime mixed-target
//  pattern). Hand substitutes are EXEMPT from the cost's filter (e.g.
//  "not summoned this turn"), matching "you may INSTEAD sacrifice this".
//
//  ── On-sacrifice reward ──
//  Fires whenever THIS instance is sacrificed (from hand via the
//  substitution, or from the board if it was summoned and later
//  sacrificed). The self-instance check (`creature.id === card.id`)
//  means a SEPARATE copy being sacrificed doesn't trigger it — but
//  unlike a "whenever a Creature is sacrificed" board passive, this IS
//  meant to fire for its own sacrifice ("When you sacrifice THIS
//  Creature"). Mandatory choice: draw 1 OR gain 4 Gold.
// ═══════════════════════════════════════════

const CARD_NAME = 'Chosen Sacrifice';

module.exports = {
  activeIn: ['hand', 'support'],

  // Engine: usable as a substitute sacrifice straight from hand.
  sacrificableFromHand: true,

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      // Only THIS instance's own sacrifice (a different copy doesn't
      // trigger the reward).
      if (ctx.creature?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const pi = ctx.cardController ?? ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps) return;

      const res = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'You sacrificed Chosen Sacrifice — choose your reward:',
        options: [
          { id: 'draw', label: '🃏 Draw 1 card' },
          { id: 'gold', label: '💰 Gain 4 Gold' },
        ],
        cancellable: false,
        gerrymanderEligible: true,
      });
      const mode = res?.optionId || 'draw';
      if (mode === 'gold') {
        await engine.actionGainGold(pi, 4);
      } else {
        await engine.actionDrawCards(pi, 1);
      }
      engine.log('chosen_sacrifice_reward', { player: ps.username, reward: mode });
      engine.sync();
    },
  },

  cpuMeta: {
    // A 20-HP body whose whole job is to be thrown away — its sacrifice
    // pays a card draw OR 4 Gold, so it's worth clearly more dead than
    // alive (net-positive to sacrifice).
    onDeathBenefit: 20,
  },
};
