// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Snowman"
//  Creature (Summoning Magic Lv1, 50 HP — Slippery)
//
//  At the beginning of each of your turns, slide
//  this Creature into the free Support Zone of an
//  adjacent Hero (if possible).
//
//  When this Creature is moved into a different
//  Hero's Support Zone AND no Hero the opponent
//  controls is currently Frozen, you may Freeze
//  the opponent's Hero in the same column as the
//  destination Hero (opp's heroIdx === this
//  Creature's new heroIdx) for 1 turn.
//
//  "May" — the player can decline (the move-effect
//  flow surfaces a confirm prompt). Frozen
//  application uses the standard snowball-burst
//  `freeze` animation.
// ═══════════════════════════════════════════

const { onSlipperyTurnStart, slipperyOnMoveGate } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Snowman';

/** True iff any of `oppPs`'s alive Heroes is currently Frozen. */
function oppHasFrozenHero(oppPs) {
  if (!oppPs?.heroes) return false;
  for (const h of oppPs.heroes) {
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const oppPs = engine.gs.players[oi];
      if (!oppPs) return;
      // Gate clause from the card text: opp must have zero Frozen
      // Heroes when the move resolves.
      if (oppHasFrozenHero(oppPs)) return;

      const myHeroIdx = ctx.card.heroIdx;
      const oppHero = oppPs.heroes?.[myHeroIdx];
      if (!oppHero?.name || oppHero.hp <= 0) return;
      // Already-immune Hero (Charme Lv3, generic immune status, freeze-
      // immune): skip the prompt rather than offer a fizzle.
      if (oppHero.statuses?.immune || oppHero.statuses?.freeze_immune) return;
      // Re-freeze guard — the opp-has-frozen check above already
      // refuses if THIS Hero is Frozen, but defense-in-depth.
      if (oppHero.statuses?.frozen) return;

      const confirmed = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Freeze ${oppHero.name} (the Hero in the same column) for 1 turn?`,
        confirmLabel: '❄️ Freeze!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'freeze', owner: oi, heroIdx: myHeroIdx, zoneSlot: -1,
      });
      await engine._delay(300);

      await engine.addHeroStatus(oi, myHeroIdx, 'frozen', {
        duration: 1,
        appliedBy: pi,
      });

      const ps = engine.gs.players[pi];
      engine.log('slippery_snowman_freeze', {
        player: ps?.username, target: oppHero.name, column: myHeroIdx,
      });
      engine.sync();
    },
  },
};
