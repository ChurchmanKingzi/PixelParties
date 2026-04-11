// ═══════════════════════════════════════════
//  CARD EFFECT: "Tharx, the Never-Losing General"
//  Hero — Active effect (soft once per turn).
//  Draw half as many cards as Creatures you
//  control (rounded up). Draws are blocked
//  by handLocked (generic actionDrawCards).
//  Animation: gold sparkle on Tharx.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const creatureCount = _countCreatures(engine, pi);
    return creatureCount > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];

    const creatureCount = _countCreatures(engine, pi);
    if (creatureCount <= 0) return false;

    const drawCount = Math.ceil(creatureCount / 2);

    const confirmed = await ctx.promptConfirmEffect({
      title: 'Tharx, the Never-Losing General',
      message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''}? (${creatureCount} Creature${creatureCount !== 1 ? 's' : ''} controlled)`,
    });
    if (!confirmed) return false;

    // Gold sparkle animation on Tharx
    engine._broadcastEvent('play_zone_animation', {
      type: 'gold_sparkle', owner: ctx.cardHeroOwner, heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Draw cards
    await engine.actionDrawCards(pi, drawCount);

    engine.log('tharx_draw', { player: ps.username, creatures: creatureCount, drawn: drawCount });
    engine.sync();
    return true;
  },
};

function _countCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  let count = 0;
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support') continue;
    const cd = cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) count++;
  }
  return count;
}
