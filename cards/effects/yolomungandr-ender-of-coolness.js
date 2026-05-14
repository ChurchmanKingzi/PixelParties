// ═══════════════════════════════════════════
//  CREATURE: "Yolomungandr, Ender of Coolness"
//  Lvl 3, 250 HP.
//
//  On summon: delete every card in your Coolness
//  Stack. Deal 30 × cards-deleted damage to all
//  Heroes your opponent controls OR all Creatures
//  your opponent controls.
//
//  At the end of each of your turns: deal 30 ×
//  (current Stack size) damage to all Heroes your
//  opponent controls OR all Creatures your
//  opponent controls.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Yolomungandr, Ender of Coolness';
const PER_CARD = 30;
// Manifest spectacle timing — same shape as Dark Deepsea God's
// summon (2500 ms total, hit ~midpoint before damage resolves so
// the boss is fully on-screen when the AoE lands).
const MANIFEST_FULL_MS = 2500;
const MANIFEST_HALF_MS = 1250;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      // Only the actual placement firing.
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const stackSize = engine.getCoolnessStackSize(pi);
      const damage = PER_CARD * stackSize;

      // Boss-summon spectacle — full-board cyan/brass manifest of the
      // Yolomungandr.png sprite, paired with the standard hero-style
      // announcement. Wait to the manifest midpoint so the boss is
      // fully on-screen when the Stack-delete + AoE land.
      engine._broadcastEvent('yolomungandr_manifest', { owner: pi });
      engine._broadcastEvent('hero_announcement', { text: `${CARD_NAME} ends it all!` });
      await engine._delay(MANIFEST_HALF_MS);

      // Delete the entire Stack (always; even if empty, no-op).
      if (stackSize > 0) {
        await ctx.deleteCoolnessStack(pi, { source: CARD_NAME });
      }
      // Let the second half of the manifest play out before the AoE
      // resolves — the spectacle reads better when the prompt opens
      // after the sprite has fully landed.
      await engine._delay(MANIFEST_FULL_MS - MANIFEST_HALF_MS);

      if (damage <= 0) return;
      await fireGroupChoice(ctx, damage);
    },

    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.activePlayer !== ctx.cardOwner) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const stackSize = engine.getCoolnessStackSize(pi);
      if (stackSize <= 0) return;

      // Own-side reveal first — the controller sees Yolomungandr's
      // portrait flash so they know which card just triggered the
      // end-of-turn AoE before they're asked to pick the target group.
      const ownSid = engine.gs.players[pi]?.socketId;
      if (ownSid) engine.io?.to(ownSid).emit('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
      await engine._delay(450);

      await fireGroupChoice(ctx, PER_CARD * stackSize, /* postPromptReveal */ true);
    },
  },
};

async function fireGroupChoice(ctx, damage, postPromptReveal = false) {
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const oppIdx = pi === 0 ? 1 : 0;
  const oppPs = engine.gs.players[oppIdx];
  if (!oppPs) return;

  const heroesPick = await engine.promptGeneric(pi, {
    type: 'confirm',
    title: CARD_NAME,
    message: `Deal ${damage} damage to all ${oppPs.username}'s Heroes? (Cancel = hit Creatures instead.)`,
    confirmLabel: '🔥 Heroes',
    confirmClass: 'btn-danger',
    cancelLabel: '🔥 Creatures',
    cancellable: true,
  });
  const target = heroesPick ? 'heroes' : 'creatures';

  // Opponent + spectator reveal AFTER the controller commits to a
  // target group — keeps the AoE direction a surprise until the
  // player has chosen, then flashes Yolomungandr's portrait on the
  // opponent's screen as the precursor to the damage hitting.
  if (postPromptReveal) {
    const oppSid = oppPs?.socketId;
    if (oppSid && engine.io) engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
    if (engine.room?.spectators?.length && engine.io) {
      for (const spec of engine.room.spectators) {
        if (spec.socketId) engine.io.to(spec.socketId).emit('card_reveal', { cardName: CARD_NAME, playerIdx: pi });
      }
    }
    await engine._delay(450);
  }

  if (target === 'heroes') {
    for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
      const h = oppPs.heroes[hi];
      if (h?.name && h.hp > 0) {
        await ctx.dealDamage(h, damage, 'destruction_spell');
      }
    }
  } else {
    const entries = [];
    for (const inst of engine.cardInstances) {
      if (inst.owner === oppIdx && inst.zone === 'support') {
        const cd = engine._getCardDB()[inst.name];
        if (cd && hasCardType(cd, 'Creature')) {
          entries.push({ inst, amount: damage, source: ctx.card, type: 'destruction_spell' });
        }
      }
    }
    // `processCreatureDamageBatch` is the engine's batch-damage entry
    // point — `dealCreatureDamage` doesn't exist (the previous call
    // was a no-op) and would silently drop the AoE.
    if (entries.length > 0) await engine.processCreatureDamageBatch(entries);
  }
}
