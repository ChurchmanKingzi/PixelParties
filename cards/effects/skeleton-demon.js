// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Demon"  *(BANNED)*
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  Whenever your opponent draws or adds cards to their hand with one
//  of their own effects while you control this Creature, you may
//  choose a target and deal 50 damage TIMES the number of cards to it.
//
//  Hooks (mirrors Analyzer from the Cosmic Depths' trigger gating):
//    • `beforeDrawBatch` — fires once per opponent `actionDrawCards`
//      call, carrying `amount`. Resource-phase auto-draws are gated
//      out at the engine level (they skip the hook entirely).
//    • `onCardAddedToHand` / `onCardAddedFromDiscardToHand` — fire
//      once per added card. Each triggers a separate 50-damage prompt.
//
//  All prompts are cancellable ("you may"). The damage source is the
//  Demon's coordinates so animations and source-aware reactions paint
//  on the right side.
// ═══════════════════════════════════════════

const CARD_NAME = 'Skeleton Demon';
const PER_CARD = 50;

async function offerDamage(ctx, multiplier) {
  if (multiplier <= 0) return;
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const damage = PER_CARD * multiplier;

  const target = await ctx.promptDamageTarget({
    side: 'any',
    types: ['hero', 'creature'],
    damageType: 'creature',
    baseDamage: damage,
    title: CARD_NAME,
    description: `Deal ${damage} damage (${PER_CARD} × ${multiplier}) to a target.`,
    confirmLabel: `🩸 Strike! (${damage})`,
    confirmClass: 'btn-danger',
    cancellable: true,
  });
  if (!target) return;

  // Black-flame strike — Skeleton Demon's signature visual. Broadcast
  // BEFORE the damage so the flames are mid-engulf as HP drops. The
  // `black_flame_strike` ANIM_REGISTRY component scales count + size
  // + reach with `intensity`, capped at 5 inside the component. We
  // pass the damage multiplier directly as intensity (1 → small, 5+
  // → engulfs the whole slot). Wait ~450ms so the flames register
  // before the damage / KO routing fires.
  const tgtZoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
  engine._broadcastEvent('play_zone_animation', {
    type: 'black_flame_strike',
    owner: target.owner,
    heroIdx: target.heroIdx,
    zoneSlot: tgtZoneSlot,
    intensity: multiplier,
  });
  await engine._delay(450);

  const sourceCoord = { name: CARD_NAME, owner: pi, heroIdx };
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (hero && hero.hp > 0) await ctx.dealDamage(hero, damage, 'creature');
  } else {
    const inst = engine.cardInstances.find(c =>
      c.zone === 'support' && c.owner === target.owner
      && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
    );
    if (inst) {
      await engine.actionDealCreatureDamage(
        sourceCoord, inst, damage, 'creature',
        { sourceOwner: pi, canBeNegated: true },
      );
    }
  }
  engine.log('skeleton_demon_strike', {
    player: engine.gs.players[pi]?.username,
    target: target.cardName,
    damage,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['support'],

  hooks: {
    beforeDrawBatch: async (ctx) => {
      // Only fires for opp draws (we want THIS Skeleton Demon's
      // controller to hit the opp who's drawing). The hook fires for
      // both sides of the game; filter to "the drawer is opp from my
      // perspective". Resource-phase auto-draws are excluded by the
      // engine gating and don't reach us.
      if (ctx.playerIdx === ctx.cardOwner) return;
      const amount = ctx.amount || 0;
      if (amount <= 0) return;
      await offerDamage(ctx, amount);
    },
    onCardAddedToHand: async (ctx) => {
      if (ctx.playerIdx === ctx.cardOwner) return;
      await offerDamage(ctx, 1);
    },
    onCardAddedFromDiscardToHand: async (ctx) => {
      if (ctx.playerIdx === ctx.cardOwner) return;
      await offerDamage(ctx, 1);
    },
  },
};
