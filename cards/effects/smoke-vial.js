// ═══════════════════════════════════════════
//  CARD EFFECT: "Smoke Vial"
//  Potion — All Heroes the opponent controls are
//  Blinded until the end of YOUR next turn.
//
//  Blinded silences targeted Attacks / Spells /
//  effects but lets full-AoE plays through.
//  Duration is "until the end of the caster's
//  next turn". Buff/status expiry runs at
//  TURN-START only (_processBuffExpiry), and
//  gs.turn increments per player-turn, so with
//  cast=T → opp T+1 → caster's next turn T+2 →
//  opp T+3, the Blinded must survive through ALL
//  of T+2 and be gone by T+3. It therefore
//  expires at the START of T+3 — the first
//  turn-start AFTER the end of the caster's next
//  turn: expiresAtTurn = gs.turn + 3,
//  expiresForPlayer = opponent (the active
//  player at T+3).
//
//  (Previously this used the "+2 / caster"
//  pattern, which actually expires at the START
//  of the caster's next turn — i.e. "until the
//  START of your next turn". Corrected to the
//  literal card text; Disruption Ray uses the
//  same convention.)
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

    // Start of the opponent's turn that follows the caster's next turn
    // = just after the end of the caster's next turn. See header.
    const expiresTurn = gs.turn + 3;

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
        expiresForPlayer: oi,
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
