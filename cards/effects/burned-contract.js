// ═══════════════════════════════════════════
//  CARD EFFECT: "Burned Contract"
//  Artifact (Normal, Cost 6)
//
//  Choose a Creature ANY player controls and
//  defeat it. Hard once per turn.
//
//  Routing: `isTargetingArtifact: true` opens the
//  standard targeting picker (server.js
//  `doUseArtifactEffect` → `potionTargeting` →
//  `doConfirmPotion`). The 6-Gold cost is auto-
//  deducted by `doConfirmPotion` since
//  `manualGoldCost` is not set.
//
//  "Defeat" → `engine.actionDestroyCard` with
//  `fireCreatureDeath: true` so onCreatureDeath
//  riders (Exploding Skull, Loyal Terrier death-
//  watch, Powder Keg AoE, Hell Fox self-detect,
//  etc.) all fire normally. The action handles
//  every absolute-immunity gate (Cardinal Beasts,
//  Golden Wings wearers, immovable, first-turn
//  protection, gate shield, Monia-style
//  beforeCreatureAffected cancel) — a fizzle
//  there is silent and consumes the HOPT slot
//  anyway, matching the card text reading "Spend
//  the play, even on an immune target".
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Burned Contract';
const HOPT_KEY = 'burned-contract';

/** Every face-up Creature on the board, either side, that the player
 *  could legally point Burned Contract at. Routes through the engine's
 *  standard helpers — `getCreatureTargets` uses `hasCardType` under
 *  the hood, so Artifact-Creature hybrids (Powder Keg etc.) qualify. */
function _allCreatureTargets(engine) {
  return [
    ...engine.getCreatureTargets(0),
    ...engine.getCreatureTargets(1),
  ];
}

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    // Gold + free-zone gates: the standard handler checks `cardData.cost`
    // before this canActivate fires. We just need at least one legal
    // Creature target somewhere on the board.
    return true;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    return _allCreatureTargets(engine);
  },

  targetingConfig: {
    description: 'Choose any Creature on the board and defeat it.',
    confirmLabel: '🔥 Burn!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
    maxTotal: 1,
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'none',

  /**
   * CPU heuristic — pick the single highest-value Creature to destroy.
   * Score: opp Creatures preferred over own (multiplier ×2), then by
   * `(level × 100 + currentHp)` so high-level / high-HP threats outrank
   * cheap chaff. Falls through to the generic CPU brain on non-target
   * prompts.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'target' && kind !== 'effectTarget') return undefined;
    const { validTargets } = payload || {};
    if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
    const cpuIdx = engine._cpuPlayerIdx;
    if (typeof cpuIdx !== 'number' || cpuIdx < 0) return undefined;
    const cardDB = engine._getCardDB();
    const scored = validTargets.map(t => {
      const inst = t.cardInstance;
      const cd = cardDB[t.cardName];
      const level = cd?.level || 0;
      const hp = inst?.counters?.currentHp ?? cd?.hp ?? 0;
      const sideMult = (t.owner === cpuIdx) ? 1 : 2; // opp first
      return { id: t.id, score: sideMult * (level * 100 + hp) };
    });
    scored.sort((a, b) => b.score - a.score);
    return [scored[0].id];
  },

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target?.cardInstance && target?.type !== 'equip') return { cancelled: true };

    const gs = engine.gs;

    // Claim HOPT — atomic check-and-set. Any later fizzle (immune
    // target etc.) still consumes the turn's Burned Contract slot,
    // matching the card text "1 per turn" reading on cast not on
    // success.
    if (!engine.claimHOPT(HOPT_KEY, pi)) return { cancelled: true };

    // Resolve the live instance — re-look-up in case `cardInstance`
    // stale-pointered through an intervening effect.
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support'
      && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx,
    );
    if (!inst || inst.zone !== 'support') return;

    // Flame-strike animation on the doomed slot. Fires unconditionally
    // so absolute-immune targets still see the visual hit; the actual
    // destroy below is what fizzles silently.
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: target.slotIdx,
    });
    await engine._delay(400);

    const source = { name: CARD_NAME, owner: pi, heroIdx: -1 };
    await engine.actionDestroyCard(source, inst, { fireCreatureDeath: true });

    engine.log('burned_contract', {
      player: gs.players[pi]?.username,
      target: inst.name,
      targetOwner: gs.players[target.owner]?.username,
    });
    engine.sync();
  },
};
