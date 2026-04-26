// ═══════════════════════════════════════════
//  CARD EFFECT: "Bottled Flame"
//  Potion — Alternating discard chain.
//  The player who "takes it" has all their
//  targets Burned permanently.
// ═══════════════════════════════════════════

const { runDiscardChain } = require('./_bottled-shared');

module.exports = {
  isPotion: true,
  // Either side ends up the "taker" — if it's the opponent on turn 1, all the
  // Burn applications on their targets fizzle through the shield; if it's the
  // CPU, we just self-Burn for nothing. Either way the card is wasted.
  firstTurnSafe: false,

  async resolve(engine, pi) {
    const gs = engine.gs;
    const cardDB = engine._getCardDB();

    // Run the discard chain — opponent goes first
    const takerIdx = await runDiscardChain(engine, pi, 'Bottled Flame');
    const takerPs = gs.players[takerIdx];

    engine.log('bottled_take', { player: takerPs.username, potion: 'Bottled Flame' });

    // Burn all targets the taker controls
    // Heroes
    for (let hi = 0; hi < (takerPs.heroes || []).length; hi++) {
      const hero = takerPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0 || hero.statuses?.burned) continue;
      await engine.addHeroStatus(takerIdx, hi, 'burned', { permanent: true, _skipReactionCheck: true });
      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike', owner: takerIdx, heroIdx: hi, zoneSlot: -1,
      });
    }

    // Creatures
    for (const inst of engine.cardInstances) {
      if (inst.owner !== takerIdx || inst.zone !== 'support' || inst.faceDown) continue;
      if (inst.counters.burned || inst.counters._cardinalImmune) continue;
      const cd = cardDB[inst.name];
      if (!cd || cd.cardType !== 'Creature') continue;
      inst.counters.burned = true;
      inst.counters.burnAppliedBy = pi;
      engine._broadcastEvent('play_zone_animation', {
        type: 'flame_strike', owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Bottled Flame' });
    }

    engine.sync();
    return true;
  },
};
