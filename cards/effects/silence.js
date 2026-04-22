// ═══════════════════════════════════════════
//  CARD EFFECT: "Silence"
//  Spell (Reaction) — Decay Magic Lv2
//
//  When the opponent plays a Spell, negate it.
//  The opponent may immediately play ONE more
//  Spell as an additional Action (doesn't cost
//  their Main/Action-Phase Action). After that
//  single Spell resolves (or they decline), no
//  more Spells this turn.
//
//  Implementation:
//    • Negate the target chain link.
//    • Set opp._spellLockTurn = gs.turn to lock
//      Spell plays for the rest of the turn.
//    • Grant a one-use bypass token
//      (opp._silenceBonusSpell = gs.turn) that
//      _engine.js consults at the three Spell-
//      lock sites (validateActionPlay + the two
//      CPU hand-filter loops). doPlaySpell in
//      server.js consumes the token on the
//      first successful validation — from that
//      point the lock is absolute.
//    • Once per game.
// ═══════════════════════════════════════════

module.exports = {
  isReaction: true,
  oncePerGame: true,
  oncePerGameKey: 'silence',

  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    if (lastLink.cardType !== 'Spell') return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    if (ps._oncePerGameUsed?.has('silence')) return false;

    const cardData = engine._getCardDB()['Silence'];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return false;
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const targetIndex = myIndex - 1;
    if (targetIndex < 0) return;
    const targetLink = chain[targetIndex];
    if (!targetLink) return;

    const oppIdx = targetLink.owner;
    const oppPs = gs.players[oppIdx];

    // Claim once-per-game
    const ps = gs.players[pi];
    if (!ps._oncePerGameUsed) ps._oncePerGameUsed = new Set();
    ps._oncePerGameUsed.add('silence');

    // Animation on the opponent's side
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: oppIdx,
      heroIdx: targetLink.heroIdx ?? 0, zoneSlot: -1,
    });
    await engine._delay(500);

    // Negate the Spell
    engine.negateChainLink(chain, targetIndex);

    // Set lock + one-use bypass token on opponent
    if (oppPs) {
      oppPs._spellLockTurn = gs.turn;
      oppPs._silenceBonusSpell = gs.turn;
    }

    engine.log('silence_negate', {
      player: engine.gs.players[pi]?.username,
      negated: targetLink.cardName,
      owner: oppIdx,
    });
    engine.sync();
  },
};
