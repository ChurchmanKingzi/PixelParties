// ═══════════════════════════════════════════
//  CARD EFFECT: "Capture Net"
//  Artifact (Normal, 4 Gold base)
//
//  "Choose a Creature on the board and add it to your hand. This
//   card's Cost is multiplied by the Creature's level. You can only
//   play 1 "Capture Net" per turn."
//
//  Wiring:
//   • Targeting Artifact. cards.json `cost` (4) is the BASE — the real
//     cost is `level × 4`, so `manualGoldCost: true` stops the engine
//     auto-deducting; `resolve` deducts manually. Same scaling pattern
//     as Dark Gear ("Cost multiplied by the Creature's level").
//   • Targets Creatures on BOTH sides. Level-less Creatures
//     (Artifact-Creatures) have no numeric level → not valid targets.
//     A Lv0 Creature costs 0 (free capture) — the Dark Gear convention.
//   • The captured Creature is moved to the caster's hand via
//     `_sparkfly-shared.stealBoardCardToHand` (handles the zone move,
//     onCardLeaveZone, hand re-track with pinned originalOwner, and the
//     authoritative support→hand flight animation).
//   • "1 per turn" — a per-player HOPT (`capture_net`).
//   • Animation: a net plummets from the top of the screen onto the
//     Creature (`capture_net` zone animation), then the Creature flies
//     from its Support Zone to the caster's hand.
// ═══════════════════════════════════════════

const { hasNumericCreatureLevel } = require('./_hooks');
const { stealBoardCardToHand } = require('./_sparkfly-shared');

const CARD_NAME = 'Capture Net';
const BASE_COST = 4;
const HOPT_KEY = 'capture_net';

/** Has a Capture Net already been played by `pi` this turn? */
function hoptUsed(engine, pi) {
  // claimHOPT stores the claim under `${key}:${pi}`.
  return engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn;
}

/**
 * Creatures on the board `pi` can afford to capture — both sides,
 * filtered by numeric level, targeting immunity, the Great Wall
 * non-damage shield (opponent side only), and `gold ≥ level × 4`.
 * Stamps `t.level` / `t.cost` on each returned target.
 */
function getCapturableCreatures(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const gold = ps.gold || 0;
  const cardDB = engine._getCardDB();
  const oppShielded = engine._isSideNondamageShielded(oppIdx);
  const out = [];
  // BORIS-EINSCHRAENKUNG (Als Praezisierung 5.8.): hat der Gegner einen
  // wirksamen Boris, faellt SEINE Brettseite als Ziel weg. Die eigene
  // bleibt waehlbar — bleibt dort nichts uebrig, greift die normale
  // "keine Ziele"-Behandlung und die Karte ist von selbst unspielbar.
  const sides = engine.borisHidesOpponentSide?.(pi) ? [pi] : [pi, oppIdx];
  for (const side of sides) {
    // The Great Wall of Deri: a side's Creatures can't be CHOSEN by the
    // opponent's non-damage effects. Capture Net is non-damage, so a
    // shielded opponent's Creatures are unreachable — your own are
    // always fair game (the Wall protects from the opponent, not you).
    if (side === oppIdx && oppShielded) continue;
    for (const t of (engine.getCreatureTargets(side) || [])) {
      const inst = t.cardInstance;
      if (inst && engine.isCreatureImmune(inst, 'targeting_immune')) continue;
      // Effective card data — per-instance level overrides (Biomancy
      // Token etc.) win over the static DB entry, mirroring Dark Gear.
      const cd = (inst ? engine.getEffectiveCardData(inst) : null) || cardDB[t.cardName];
      // Cost scales by level → level-less Creatures (Artifact-Creatures,
      // `level: null`) are not valid targets.
      if (!hasNumericCreatureLevel(cd)) continue;
      const level = cd.level;
      const cost = level * BASE_COST;
      if (gold < cost) continue;
      t.level = level;
      t.cost = cost;
      out.push(t);
    }
  }
  return out;
}

module.exports = {
  // BORIS-EINSCHRAENKUNG (Klausel 1, Als Praezisierung 5.8.): nimmt eine BELIEBIGE Creature vom Brett auf die eigene Hand.
  // Trifft beliebige Creature auf dem GESAMTEN Brett — deshalb NICHT sperren, sondern bei
  // wirksamem Boris beim Gegner nur dessen Seite ausblenden. Solange
  // es eigene legale Ziele gibt, bleibt der Effekt nutzbar.
  stealsFromEitherSide: true,

  isTargetingArtifact: true,
  // cards.json cost (4) is the BASE — real cost is level × 4, so the
  // engine must not auto-deduct; resolve() deducts manually.
  manualGoldCost: true,
  // resolve() runs the whole net-drop + support→hand flight itself.
  animationType: 'none',

  canActivate(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    if (hoptUsed(eng, pi)) return false;
    return getCapturableCreatures(eng, pi).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return [];
    if (hoptUsed(eng, pi)) return [];
    return getCapturableCreatures(eng, pi);
  },

  targetingConfig: {
    description: "Choose a Creature on the board to capture into your hand. Cost = the Creature's level × 4 Gold.",
    confirmLabel: '🕸️ Capture!',
    confirmClass: 'btn-info',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  },

  validateSelection: (selectedIds) => !!selectedIds && selectedIds.length === 1,

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { aborted: true };

    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };

    // Defensive HOPT recheck.
    if (hoptUsed(engine, pi)) return { aborted: true };

    // Re-resolve the live Creature instance.
    const inst = (target.cardInstance && engine.cardInstances.find(c => c.id === target.cardInstance.id))
      || engine.cardInstances.find(c => c.zone === 'support'
        && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        && c.name === target.cardName);
    if (!inst || inst.zone !== 'support') return { aborted: true };

    // Recompute the cost from the effective card data — agrees with the
    // affordability filter in getCapturableCreatures.
    const cardDB = engine._getCardDB();
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    const level = (cd && cd.level != null) ? cd.level : 1;
    const totalCost = level * BASE_COST;

    // Final gold check (state may have shifted since targeting).
    if ((ps.gold || 0) < totalCost) {
      engine.log('capture_net_fizzle', {
        player: ps.username, reason: 'insufficient_gold', cost: totalCost,
      });
      return { aborted: true };
    }

    // ── Commit ──
    engine.claimHOPT(HOPT_KEY, pi);
    if (totalCost > 0) {
      ps.gold -= totalCost;
      engine.log('gold_spent', { player: ps.username, amount: totalCost, reason: CARD_NAME });
      engine._broadcastEvent('gold_change', { owner: pi, amount: -totalCost });
    }

    // ── Animation phase 1: the net plummets onto the Creature ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'capture_net', owner: inst.owner,
      heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      duration: 1900,
    });
    engine.sync();
    await engine._delay(1150); // net plummets and lands on the Creature

    // ── Animation phase 2: the Creature is hauled into your hand ──
    // stealBoardCardToHand removes it from the board, fires
    // onCardLeaveZone, re-tracks it in your hand (originalOwner pinned),
    // and broadcasts the authoritative support→hand flight. It returns
    // false when the Creature is omni-immune (Cardinal Beast) — the
    // capture fizzles, but Capture Net is still spent.
    const creatureName = inst.name;
    const moved = await stealBoardCardToHand(engine, pi, inst, CARD_NAME);

    // Hold here until the capture has fully concluded — the ~700ms
    // support→hand flight when the Creature moved, or the net's impact
    // settle when the move was blocked — so doConfirmPotion only sends
    // Capture Net to the discard pile AFTER the Creature has finished
    // moving into the hand (or been blocked).
    await engine._delay(moved ? 750 : 450);

    engine.log(moved ? 'capture_net' : 'capture_net_immune_block', {
      player: ps.username, creature: creatureName, cost: totalCost, level,
    });
    engine.sync();
    return true;
  },
};
