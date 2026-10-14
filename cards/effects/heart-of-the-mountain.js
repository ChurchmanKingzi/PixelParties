// ═══════════════════════════════════════════
//  CARD EFFECT: "Heart of the Mountain"
//  Artifact (Normal, Cost 10)
//
//  Draw cards equal to the count of Burned
//  targets currently on the board (cap 4). Plays
//  at most once per turn — the HOPT lock dims
//  every copy in hand once a Heart has resolved
//  this turn (multiple copies in hand are still
//  legal; only the first one each turn fires).
//
//  Wiring:
//    • Non-targeting Normal Artifact — routes
//      through `doUseArtifactEffect`. The lack of
//      `getValidTargets` / `targetingConfig`
//      sends the engine straight to `resolve`.
//    • `canActivate` checks the HOPT lock so
//      the card is grayed out client-side after
//      the first play this turn (matches Bamboo
//      Shield's UX).
//    • `resolve` claims the HOPT, counts Burned
//      targets across BOTH sides (heroes'
//      `statuses.burned` + face-up creatures'
//      `counters.burned` — same predicate
//      Candlestick Squire / Outbreak / Heat Wave
//      use), and draws `min(count, 4)` cards.
//      Re-checking at resolve time means a Burn
//      that drops off mid-chain doesn't leave a
//      stale draw count.
//    • Returns `true` even when 0 Burns exist —
//      the play is legal (the HOPT was a player
//      choice), just yields nothing. The engine
//      still pays the gold cost and discards
//      the artifact, matching the card text
//      ("Draw as many cards as there are Burned
//      targets on the board" — zero is a valid
//      result).
// ═══════════════════════════════════════════

const HOPT_KEY = 'heart_of_the_mountain';
const DRAW_CAP = 4;

function countBurnedTargets(engine) {
  let n = 0;
  for (const ps of (engine.gs.players || [])) {
    if (!ps) continue;
    for (const h of (ps.heroes || [])) {
      if (h?.name && h.hp > 0 && h.statuses?.burned) n++;
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.burned) n++;
  }
  return n;
}

module.exports = {
  canActivate(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    return true;
  },

  async resolve(engine, pi /*, selectedIds, validTargets */) {
    if (!engine.claimHOPT(HOPT_KEY, pi)) return { cancelled: true };

    const ps = engine.gs.players[pi];
    const n  = Math.min(DRAW_CAP, countBurnedTargets(engine));
    if (n > 0) {
      await engine.actionDrawCards(pi, n);
    }

    engine.log('heart_of_the_mountain', {
      player: ps?.username, drawn: n,
    });
    engine.sync();
    return true;
  },
};
