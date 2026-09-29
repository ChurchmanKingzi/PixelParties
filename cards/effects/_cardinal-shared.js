// ═══════════════════════════════════════════
//  Shared Cardinal Beast helpers
// ═══════════════════════════════════════════

const CARDINAL_NAMES = [
  'Cardinal Beast Baihu',
  'Cardinal Beast Qinglong',
  'Cardinal Beast Xuanwu',
  'Cardinal Beast Zhuque',
];

// O(1) lookup companion to CARDINAL_NAMES. Used by hot-path guards
// (damage pipeline, deepsea targeting, CPU evaluators) — the array
// is kept too for callers that iterate (Cardinal-win check).
const CARDINAL_NAMES_SET = new Set(CARDINAL_NAMES);

/**
 * Name-based fallback for the engine's absolute-immunity shield on
 * Cardinal Beasts. Each Beast's `onPlay` also stamps
 * `inst.counters._cardinalImmune` via `_setCardinalImmune`, but the
 * name check catches summon paths that skip onPlay (tutor re-clones,
 * ascension swaps, etc.) so the "immune to everything" guarantee
 * holds however the Beast got onto the board.
 */
function isCardinalBeastByName(name) {
  return !!name && CARDINAL_NAMES_SET.has(name);
}

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

  // Kontrolle statt Seite (Styx 28.9.): „If you control 4 …" — jede
  // oben liegende Cardinal-Karte zaehlt fuer den Kontrolleur ihrer
  // Instanz, nicht fuer die Brettseite (seitenfremd beschworen/gestohlen).
  const kontrolle = [new Set(), new Set()];
  for (let side = 0; side < gs.players.length; side++) {
    const sps = gs.players[side];
    if (!sps) continue;
    for (let hi = 0; hi < (sps.heroes || []).length; hi++) {
      for (let zi = 0; zi < (sps.supportZones?.[hi] || []).length; zi++) {
        const slot = (sps.supportZones[hi] || [])[zi] || [];
        if (slot.length === 0 || !CARDINAL_NAMES.includes(slot[0])) continue;
        const inst = (engine.cardInstances || []).find(c => c.zone === 'support'
          && c.name === slot[0] && c.heroIdx === hi && c.zoneSlot === zi
          && engine.physicalSide(c) === side);
        const wer = inst ? (inst.controller ?? inst.owner) : side;
        kontrolle[wer]?.add(slot[0]);
      }
    }
  }

  for (let pi = 0; pi < gs.players.length; pi++) {
    const ps = gs.players[pi];
    if (!ps) continue;
    const onBoard = kontrolle[pi] || new Set();
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

module.exports = { _setCardinalImmune, _checkCardinalWin, CARDINAL_NAMES, CARDINAL_NAMES_SET, isCardinalBeastByName };
