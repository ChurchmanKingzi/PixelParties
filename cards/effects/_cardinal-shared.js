// ═══════════════════════════════════════════
//  Shared Cardinal Beast helpers
// ═══════════════════════════════════════════

const CARDINAL_NAMES = [
  'Cardinal Beast Baihu',
  'Cardinal Beast Qinglong',
  'Cardinal Beast Xuanwu',
  'Cardinal Beast Zhuque',
];

/**
 * Set immune flag on the Cardinal Beast creature instance.
 */
function _setCardinalImmune(ctx) {
  const inst = ctx.card;
  if (inst && CARDINAL_NAMES.includes(inst.name)) {
    inst.counters._cardinalImmune = true;
  }
}

/**
 * Check if a player controls all 4 Cardinal Beasts → instant win.
 * Called from onCardEnterZone — guarded to fire only once.
 */
async function _checkCardinalWin(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  if (gs._cardinalWinTriggered) return;

  for (let pi = 0; pi < gs.players.length; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    const onBoard = new Set();
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
        const slot = (ps.supportZones[hi] || [])[zi] || [];
        if (slot.length > 0 && CARDINAL_NAMES.includes(slot[0])) {
          onBoard.add(slot[0]);
        }
      }
    }
    if (onBoard.size === 4) {
      gs._cardinalWinTriggered = true;
      engine.log('cardinal_win', { player: ps.username });
      engine._broadcastEvent('cardinal_beast_win', { owner: pi });
      engine.sync();

      // Wait for celebration animation before ending game. Use engine._delay
      // so fast-mode (self-play) skips the 3.5s real-time wait.
      await engine._delay(3500);

      if (engine.onGameOver) {
        await engine.onGameOver(engine.room, pi, 'cardinal_beast');
      }
      return;
    }
  }
}

module.exports = { _setCardinalImmune, _checkCardinalWin, CARDINAL_NAMES };
