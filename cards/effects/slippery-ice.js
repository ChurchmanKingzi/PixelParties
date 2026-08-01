// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Ice"
//  Spell (Magic Arts Lv1, Area)
//
//  Both players may, once per turn, click the
//  Area to move any number of the Creatures
//  they control onto free Support Zones of
//  adjacent Heroes they also control. Hero
//  adjacency follows the standard PP layout:
//    Hero 0 ↔ Hero 1 ↔ Hero 2
//    (Heroes 0 and 2 are NOT adjacent.)
//
//  Unlike Deepsea Castle — which swaps a board
//  Creature for a hand Creature — Slippery Ice
//  only rearranges Creatures that are already on
//  the board. No hand interaction, no level gate,
//  no summoning. The Creature is picked up from
//  one slot and dropped into a free adjacent one.
//
//  Flow, per activation:
//    1. Loop:
//       a. Collect every (creature → adjacent free
//          zone) pair the controller currently has.
//          If none, exit.
//       b. Prompt "Pick a Creature to move" over
//          every eligible source. Cancel stops.
//       c. Prompt "Pick a destination" over that
//          Creature's adjacent free zones. Cancel
//          rewinds to the source prompt.
//       d. Execute the move: splice out of source,
//          splice into destination, update the
//          instance's heroIdx / zoneSlot, fire
//          onCardEnterZone at the new slot,
//          animate via `play_card_transfer`.
//       e. Mark the instance as "moved" and loop.
//    2. Return true if anything moved, else false
//       (false leaves the once-per-turn gate
//       unused — activation never "spent" the
//       turn's usage if the player cancelled
//       before making a move).
//
//  A Creature that already moved during this
//  activation is excluded from subsequent source
//  prompts — the card text says "move as many
//  Creatures", not "keep moving the same one
//  around the board".
//
//  The activating player is always the active
//  player via `ctx._activator`, regardless of who
//  placed the Area. Both sides share the board.
// ═══════════════════════════════════════════

const { ownSupportCreatures } = require('./_deepsea-shared');
const { isAreaImmuneInst } = require('./_diver-helmet-shared');
const { _runMctsSlipperyLoop } = require('./_slippery-shared');

const CARD_NAME = 'Slippery Ice';

/** Hero indices adjacent to `heroIdx` in the 3-slot row. */
function adjacentHeroIndices(heroIdx) {
  const out = [];
  if (heroIdx > 0) out.push(heroIdx - 1);
  if (heroIdx < 2) out.push(heroIdx + 1);
  return out;
}

/**
 * For a given creature instance on `pi`'s side, list every legal
 * destination — {heroIdx, slotIdx} of each free Support Zone on an
 * adjacent live-named Hero that `pi` still owns. Matches Slippery
 * Skates' definition of "adjacent ally Hero free zone".
 */
function destinationsFor(engine, pi, inst) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (const hi of adjacentHeroIndices(inst.heroIdx)) {
    const hero = ps.heroes?.[hi];
    if (!hero?.name) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

/** True when at least one own Creature has at least one legal destination. */
function hasAnyLegalMove(engine, pi) {
  for (const inst of ownSupportCreatures(engine, pi)) {
    // Diver Helmet: Creatures in the equipped Hero's Support Zones are
    // unaffected by Areas — Slippery Ice can't move them.
    if (isAreaImmuneInst(engine, inst)) continue;
    if (destinationsFor(engine, pi, inst).length > 0) return true;
  }
  return false;
}

/**
 * Perform the move. Splices the card name out of its source slot, splices
 * it into the destination, patches the CardInstance's heroIdx / zoneSlot
 * in place, fires `onCardEnterZone` at the new slot, and plays the same
 * slide animation Slippery Skates uses. No `onCardLeaveZone` — the
 * Creature is moving within the board, not leaving it.
 */
async function moveCreature(engine, pi, inst, destHeroIdx, destSlot) {
  const ps = engine.gs.players[pi];
  const srcHeroIdx = inst.heroIdx;
  const srcSlot = inst.zoneSlot;
  const srcZone = (ps.supportZones?.[srcHeroIdx] || [])[srcSlot] || [];
  const idxInSlot = srcZone.indexOf(inst.name);
  if (idxInSlot < 0) return false;

  // Suppress stray damage-number overlays on the source slot while it's
  // about to visually empty out.
  engine._broadcastEvent('creature_zone_move', {
    owner: pi, heroIdx: srcHeroIdx, zoneSlot: srcSlot,
  });

  srcZone.splice(idxInSlot, 1);

  // Slide animation source → destination.
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: pi,
    sourceHeroIdx: srcHeroIdx,
    sourceZoneSlot: srcSlot,
    targetOwner: pi,
    targetHeroIdx: destHeroIdx,
    targetZoneSlot: destSlot,
    cardName: inst.name,
    duration: 500,
    particles: null,
  });
  engine.sync();
  await engine._delay(420);

  if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
  if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
  ps.supportZones[destHeroIdx][destSlot].push(inst.name);
  inst.heroIdx = destHeroIdx;
  inst.zoneSlot = destSlot;

  engine.sync();

  // `_isMove: true` so Slippery Creatures' on-move listeners fire
  // (their per-Creature payoff distinguishes moves from initial
  // summons via this flag). No `_onlyCard` filter — host-Hero
  // reactors like Ingo / Maya / Pes'zet should still see the entry.
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst,
    toZone: 'support', toHeroIdx: destHeroIdx,
    _skipReactionCheck: true,
    _isMove: true,
  });

  return true;
}

module.exports = {
  activeIn: ['hand', 'area'],
  areaEffect: true,
  // alwaysCommit: Die Aktivierung ist KOSTENLOS (kein Action-Cost,
  // once per turn) und canActivateAreaEffect verlangt bereits einen
  // legalen Zug. Das MCTS-Gate kann den Wert nicht messen, weil der
  // innere Multi-Move-Planner im Sim-Modus degradiert (kein Nested-
  // MCTS, _slippery-shared L213) und dort nichts Sinnvolles bewegt —
  // das Gate skippte deshalb systematisch eine Gratis-Value-Quelle.
  // Live plant der echte MCTS-Loop die Züge und bewegt nur bei
  // Vorteil; immer aktivieren ist also strikt korrekt.
  cpuMeta: { alwaysCommit: true },

  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const activator = ctx._activator ?? engine.gs.activePlayer;
    if (activator == null || activator < 0) return false;
    return hasAnyLegalMove(engine, activator);
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const activator = ctx._activator ?? gs.activePlayer;
    if (activator == null || activator < 0) return false;
    const ps = gs.players[activator];
    if (!ps) return false;

    // Synthetic instance so `promptZonePick` routes to the activating
    // player — the Area itself can be activated from either side of the
    // table, so we can't rely on Slippery Ice's own controller field.
    const pseudoInst = {
      id: 'slippery-ice-pseudo',
      name: CARD_NAME, owner: activator, controller: activator,
      zone: 'area', heroIdx: -1, zoneSlot: -1, counters: {}, faceDown: false,
    };
    const promptCtx = engine._createContext(pseudoInst, {});

    const movedInstIds = new Set();
    let moved = 0;

    // ── CPU path: MCTS-driven multi-move planner ──
    // Each step picks the (creature, dest) pair that scores highest
    // under a snapshot/rollout, so the plan naturally avoids clogging
    // adjacent zones and routes high-impact Creatures (Whoolmoth's
    // 120 damage, Snowman's freeze, etc.) onto productive columns.
    // Mirrors the per-activation "each Creature moves at most once"
    // rule via the shared movedInstIds set, threaded through the
    // helper's onLiveMove callback.
    if (engine.isCpuPlayer(activator)) {
      const collectIce = () => {
        const out = [];
        for (const inst of ownSupportCreatures(engine, activator)) {
          if (movedInstIds.has(inst.id)) continue;
          if (isAreaImmuneInst(engine, inst)) continue;
          const dests = destinationsFor(engine, activator, inst);
          if (dests.length === 0) continue;
          out.push({ inst, dests });
        }
        return out;
      };
      await _runMctsSlipperyLoop(engine, activator, collectIce, {
        // Slippery Ice runs in main phase (after the Start Phase
        // auto-slide has already locked in this turn's archetype
        // moves), so stamping `_slipperyMovedTurn` here is a no-op —
        // skip it for parity with the existing Slippery Ice mover.
        moveOpts: { skipSlipperyMovedMark: true },
        onLiveMove: (inst) => { movedInstIds.add(inst.id); moved++; },
      });
      if (moved === 0) return false;
      engine.log('slippery_ice_move', { player: ps.username, moved });
      return true;
    }

    while (true) {
      // Re-collect each iteration — previous moves change the board.
      const candidates = ownSupportCreatures(engine, activator).filter(inst => {
        if (movedInstIds.has(inst.id)) return false;
        // Diver Helmet: protected Creatures are unaffected by Areas.
        if (isAreaImmuneInst(engine, inst)) return false;
        return destinationsFor(engine, activator, inst).length > 0;
      });
      if (candidates.length === 0) break;

      const sourceZones = candidates.map(inst => {
        const hero = ps.heroes[inst.heroIdx];
        return {
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — ${inst.name} (Slot ${inst.zoneSlot + 1})`,
        };
      });

      const src = await promptCtx.promptZonePick(sourceZones, {
        title: CARD_NAME,
        description: moved > 0
          ? `Pick another Creature to move, or cancel to stop (${moved} moved so far).`
          : 'Pick a Creature to move onto an adjacent Hero.',
        cancellable: true,
      });
      if (!src) break;

      const chosenInst = candidates.find(i =>
        i.heroIdx === src.heroIdx && i.zoneSlot === src.slotIdx
      );
      if (!chosenInst) break;

      const destZones = destinationsFor(engine, activator, chosenInst).map(z => {
        const hero = ps.heroes?.[z.heroIdx];
        return {
          heroIdx: z.heroIdx, slotIdx: z.slotIdx,
          label: `${hero?.name || 'Hero'} — Slot ${z.slotIdx + 1}`,
        };
      });
      if (destZones.length === 0) {
        // Legal-move count changed out from under us — skip this attempt
        // and re-prompt the source list.
        continue;
      }
      const dst = await promptCtx.promptZonePick(destZones, {
        title: CARD_NAME,
        description: `Move ${chosenInst.name} onto which zone?`,
        cancellable: true,
      });
      // Cancelling the destination prompt returns to the source prompt —
      // the player hasn't committed yet, so loop instead of breaking.
      if (!dst) continue;

      // Guard against interleaved state (other hooks firing between
      // prompts). Re-verify the source still holds our creature and the
      // destination is still free.
      const stillThere = engine.cardInstances.find(c => c.id === chosenInst.id);
      if (!stillThere
          || stillThere.zone !== 'support'
          || stillThere.heroIdx !== chosenInst.heroIdx
          || stillThere.zoneSlot !== chosenInst.zoneSlot) {
        continue;
      }
      if (((ps.supportZones[dst.heroIdx] || [])[dst.slotIdx] || []).length > 0) continue;

      const ok = await moveCreature(engine, activator, stillThere, dst.heroIdx, dst.slotIdx);
      if (ok) {
        movedInstIds.add(stillThere.id);
        moved++;
      }
    }

    if (moved === 0) return false;
    engine.log('slippery_ice_move', { player: ps.username, moved });
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-placement on cast. Guard against spurious bubble-through
      // fires — only the instance being played should install the area.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },
};
