// ═══════════════════════════════════════════
//  CARD EFFECT: "Smoke Vial"
//  Potion — All Heroes the opponent controls are
//  Blinded until the end of YOUR next turn.
//
//  Blinded silences targeted Attacks / Spells /
//  effects but lets full-AoE plays through.
//  Duration is wired with the standard
//  `expiresAtTurn` / `expiresForPlayer` mechanism
//  (see cards/effects/cloud-pillow.js for the
//  reference implementation): expires at the
//  start of the caster's turn-after-next, which
//  lines up with "end of caster's next turn"
//  since no opponent turn falls between those
//  two moments.
//
//  Visual: thick gray smoke clouds enveloping
//  ALL three opponent hero slots — including
//  immune ones, dead ones, or empty ones — even
//  though the Blinded status itself only sticks
//  on alive, vulnerable heroes (immune / shielded
//  blocks are honoured by addHeroStatus).
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  canActivate(gs, pi) {
    const oi = pi === 0 ? 1 : 0;
    return (gs.players[oi]?.heroes || []).some(h => h?.name && h.hp > 0);
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const oi = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oi];
    if (!oppPs) return;

    // Caster's turn-after-next start = end of caster's next turn.
    const expiresTurn = gs.turn + 2;

    // Smoke envelops all three opponent hero slots regardless of
    // alive/dead/immune state — the visual is part of the play, not the
    // status. addHeroStatus below still honours immune / shielded /
    // dead checks so the Blinded itself only sticks where it can.
    const heroCount = (oppPs.heroes || []).length;
    for (let hi = 0; hi < heroCount; hi++) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'smoke_vial', owner: oi, heroIdx: hi, zoneSlot: -1,
      });
    }
    await engine._delay(450);

    let landed = 0;
    for (let hi = 0; hi < heroCount; hi++) {
      const hero = oppPs.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      await engine.addHeroStatus(oi, hi, 'blinded', {
        expiresAtTurn: expiresTurn,
        expiresForPlayer: pi,
        appliedBy: pi,
        source: 'Smoke Vial',
      });
      landed++;
    }

    engine.log('smoke_vial', {
      player: gs.players[pi]?.username,
      blinded: landed,
    });
    engine.sync();
  },
};
