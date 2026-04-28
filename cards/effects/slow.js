// ═══════════════════════════════════════════
//  CARD EFFECT: "Slow"
//  Spell (Decay Magic Lv1, Normal)
//
//  Your opponent chooses and discards:
//    Lv1: 2 cards
//    Lv2: 3 cards
//    Lv3: 4 cards
//
//  Afterwards: the caster cannot interact with
//  the opponent's hand for the rest of the turn
//  (ps.oppHandLocked = true).
//
//  Cannot be played if oppHandLocked is already
//  set (covers re-casting and other hand-lock
//  effects sharing the same flag).
//
//  Animation: purple dark-magic sparkles burst
//  over the opponent's hand for each card
//  discarded (slow_dark_magic event).
// ═══════════════════════════════════════════

const CARD_NAME = 'Slow';

/** Number of forced discards per Decay Magic level. */
const DISCARD_BY_LEVEL = { 1: 2, 2: 3, 3: 4 };

module.exports = {
  cpuMeta: { scalesWithSchool: 'Decay Magic' },
  /** Block play if the caster's opp-hand interaction is already locked. */
  spellPlayCondition(gs, playerIdx) {
    return !gs.players[playerIdx]?.oppHandLocked;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      const oppIdx  = pi === 0 ? 1 : 0;
      const oppPs   = gs.players[oppIdx];

      if (!ps || !oppPs) return;

      // Calculate Decay Magic level for this hero
      const abZones     = ps.abilityZones[heroIdx] || [];
      const decayLevel  = engine.countAbilitiesForSchool('Decay Magic', abZones);
      const discardCount = DISCARD_BY_LEVEL[Math.min(decayLevel, 3)] ?? DISCARD_BY_LEVEL[1];

      // Discard one card at a time, playing the dark-magic animation on each
      for (let i = 0; i < discardCount; i++) {
        if ((oppPs.hand || []).length === 0) break;

        // Purple dark-magic burst over the opponent's hand
        engine._broadcastEvent('slow_dark_magic', { ownerIdx: oppIdx });
        await engine._delay(300);

        await engine.actionPromptForceDiscard(oppIdx, 1, {
          title: CARD_NAME,
          source: CARD_NAME,
          description: `Slow — discard ${discardCount - i} more card${discardCount - i > 1 ? 's' : ''}.`,
        });

        await engine._delay(200);
      }

      // Lock: no more hand interaction with the opponent this turn
      ps.oppHandLocked = true;

      engine.log('slow_resolved', {
        player: ps.username, discards: discardCount, decayLevel,
      });
      engine.sync();
    },
  },
};
