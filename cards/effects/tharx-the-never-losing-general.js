// ═══════════════════════════════════════════
//  CARD EFFECT: "Tharx, the Never-Losing General"
//  Hero — Active effect (soft once per turn).
//  Draw as many cards as you control Creatures
//  that were not summoned this turn. Draws are blocked
//  by handLocked (generic actionDrawCards).
//  Animation: gold sparkle on Tharx.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  // CPU: confirm this Hero's activated-effect "you may" prompt — the default
  // brain declines cancellable confirms raised outside a card-cast (Hero
  // effect activations don't set _resolvingCard), which would otherwise make
  // the effect a no-op even after the CPU chose to activate it. (Title must
  // equal the card name for this lookup.)
  cpuResponse(engine, kind, promptData) {
    // KEINE !showCard-Bedingung: promptConfirmEffect defaultet showCard
    // inzwischen IMMER auf den Kartennamen — die alte Bedingung war nie
    // erfüllt und der Confirm wurde still declined (Barker-Bugklasse).
    if (promptData?.type === 'confirm') return { confirmed: true };
    return undefined;
  },
  activeIn: ['hero'],
  heroEffect: true,

  // CPU threat assessment (draw supporter). Draws N cards, where N is the
  // number of Creatures the owner controls that were not summoned this turn.
  supportYield(ctx) {
    return { drawsPerTurn: _countCreatures(ctx.engine, ctx.pi) };
  },

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

    const drawCount = creatureCount;

    const confirmed = await ctx.promptConfirmEffect({
      title: 'Tharx, the Never-Losing General',
      message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''}? (${creatureCount} Creature${creatureCount !== 1 ? 's' : ''} not summoned this turn)`,
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

/** Creatures, die der Spieler kontrolliert und die NICHT in diesem Zug beschworen wurden. */
function _countCreatures(engine, pi) {
  const turn = engine.gs?.turn || 0;
  const cardDB = engine._getCardDB();
  let count = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi || inst.zone !== 'support') continue;
    if ((inst.turnPlayed || 0) === turn) continue;   // diesen Zug beschworen → zaehlt nicht
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (cd && hasCardType(cd, 'Creature')) count++;
  }
  return count;
}
