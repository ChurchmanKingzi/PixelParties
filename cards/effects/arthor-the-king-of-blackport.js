// ═══════════════════════════════════════════
//  CARD EFFECT: "Arthor, the King of Blackport"
//  Hero — 400 HP, 30 ATK
//  Starting abilities: Decay Magic, Wealth
//
//  ① Whenever Arthor casts a Spell while the
//    opponent has > 1 card in hand, they must
//    discard 1 card of their choice.
//    If "The White Eye" is equipped to him,
//    they must discard 2 cards instead.
//
//  ② Ascension: ascensionReady is set when BOTH
//    "Legendary Sword of a Barbarian King" AND
//    "Summoning Circle" are equipped to Arthor.
//    Cannot be cheat-ascended.
//    On-equip/on-remove is handled by those
//    scripts (which have ctx.card.id for proper
//    exclusion). Arthor only checks on game start.
// ═══════════════════════════════════════════

const { checkArthorAscension } = require('./_arthor-shared');

const CARD_NAME = 'Arthor, the King of Blackport';
const EYE_NAME  = 'The White Eye';

module.exports = {
  activeIn: ['hero'],
  cheatAscensionBlocked: true,

  hooks: {
    // ── Ascension: initial check at game start ────────────────────────────
    // On-equip and on-remove checks live in the equip scripts.

    onGameStart: (ctx) => {
      checkArthorAscension(ctx._engine, ctx.cardOwner, ctx.cardHeroIdx, null);
    },

    // ── Spell discard effect ─────────────────────────────────────────────

    afterSpellResolved: async (ctx) => {
      if (!ctx.spellCardData || ctx.spellCardData.cardType !== 'Spell') return;
      if (ctx.casterIdx !== ctx.cardOwner || ctx.heroIdx !== ctx.cardHeroIdx) return;
      if (ctx.isSecondCast) return;

      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const oppIdx  = pi === 0 ? 1 : 0;
      const oppPs   = gs.players[oppIdx];

      // Must have > 1 card in hand
      if ((oppPs?.hand || []).length <= 1) return;

      // Respect opp-hand interaction lock (e.g. Slow was cast this turn)
      if (gs.players[pi]?.oppHandLocked) return;

      // Arthor must still be alive and capable
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;

      // Check for White Eye
      const hasWhiteEye = engine.cardInstances.some(c =>
        c.owner === pi && c.zone === 'support' &&
        c.heroIdx === heroIdx && c.name === EYE_NAME,
      );
      const discardCount = hasWhiteEye ? 2 : 1;

      // Flash Arthor's hero zone + stream his card to both players
      engine._broadcastEvent('card_effect_flash', { owner: pi, heroIdx });
      engine._broadcastEvent('card_reveal', { cardName: 'Arthor, the King of Blackport' });
      await engine._delay(400);

      await engine.actionPromptForceDiscard(oppIdx, discardCount, {
        title: CARD_NAME,
        source: CARD_NAME,
        description: `Arthor forces you to discard ${discardCount} card${discardCount > 1 ? 's' : ''}.`,
      });

      engine.log('arthor_discard', {
        player: gs.players[pi].username,
        spell: ctx.spellName,
        count: discardCount,
        whiteEye: hasWhiteEye,
      });
      engine.sync();
    },
  },
};
