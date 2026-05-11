// ═══════════════════════════════════════════
//  ARCHETYPE HELPER: "Slippery"
//
//  Shared logic for the two clauses every Slippery
//  Creature shares:
//
//    1. Turn-start auto-slide — at the start of
//       each own turn, the Creature places itself
//       into a free Support Zone of an adjacent
//       Hero (if any). If there are multiple legal
//       destinations the engine's standard zone-
//       pick prompts the controller; if only one,
//       it auto-slides; if none, it stays put.
//
//    2. On-move trigger — when the Creature lands
//       in a different Hero's Support Zone via ANY
//       move source (Slippery Ice, Slippery Skates,
//       Slippery Pengu's rider, the auto-slide
//       above, or any future move card), its
//       per-Creature payoff fires. Distinguished
//       from the initial summon via the `_isMove`
//       flag on `onCardEnterZone`, which every
//       Slippery move source sets.
//
//  Adjacency follows the standard 3-Hero row:
//    Hero 0 ↔ Hero 1 ↔ Hero 2
//    (Heroes 0 and 2 are NOT adjacent.)
//
//  Move execution funnels through
//  `moveSlipperyCreature` here so every source
//  applies the same animation, suppresses the
//  source-slot damage-floater, and fires
//  `onCardEnterZone` with `_isMove: true` (no
//  `_onlyCard` filter — host-Hero reactors like
//  Ingo / Maya / Pes'zet still see the entry).
// ═══════════════════════════════════════════

const ARCHETYPE = 'Slippery';

/** Hero indices adjacent to `heroIdx` in the 3-slot row. */
function adjacentHeroIndices(heroIdx) {
  const out = [];
  if (heroIdx > 0) out.push(heroIdx - 1);
  if (heroIdx < 2) out.push(heroIdx + 1);
  return out;
}

/**
 * Free Support Zones on adjacent live Heroes for `inst`.
 * Returns array of `{ heroIdx, slotIdx, label }`.
 */
function destinationsFor(engine, pi, inst) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (const hi of adjacentHeroIndices(inst.heroIdx)) {
    const hero = ps.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({
          heroIdx: hi, slotIdx: zi,
          label: `${hero.name} — Slot ${zi + 1}`,
        });
      }
    }
  }
  return out;
}

/**
 * Perform a Slippery move. Funnels all four sources (Ice, Skates,
 * turn-start auto-slide, Pengu's rider) through one path so
 * animations and the `_isMove: true` enter-zone flag are uniform.
 *
 * Returns true on success, false if the source slot was already
 * empty (race with another move) or the destination is full.
 *
 * Marks the moved inst with `_slipperyMovedTurn = gs.turn` if it is a
 * Slippery archetype Creature, so the Start Phase sub-mode picker can
 * exclude it for the rest of the turn (one auto-slide per Slippery
 * per turn — same rule applies whether the move came from the picker
 * itself, from Pengu's rider, from Slippery Ice, or from Skates).
 */
async function moveSlipperyCreature(engine, pi, inst, destHeroIdx, destSlot) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const srcHeroIdx = inst.heroIdx;
  const srcSlot = inst.zoneSlot;
  const srcArr = (ps.supportZones?.[srcHeroIdx] || [])[srcSlot] || [];
  const srcIdx = srcArr.indexOf(inst.name);
  if (srcIdx < 0) return false;
  if (((ps.supportZones?.[destHeroIdx] || [])[destSlot] || []).length > 0) return false;

  // Suppress the diff-detector's spurious damage-floater on the
  // source slot as the Creature leaves it.
  engine._broadcastEvent('creature_zone_move', {
    owner: pi, heroIdx: srcHeroIdx, zoneSlot: srcSlot,
  });

  srcArr.splice(srcIdx, 1);

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

  // Mark Slippery Creatures as "auto-slid this turn" so the Start
  // Phase picker excludes them from its eligible set. Non-Slippery
  // Creatures (e.g. a Pengu rider moving a non-Slippery target) are
  // untouched — they have no archetype turn-start clause to gate.
  if (isSlipperyCard(inst.name, engine)) {
    inst._slipperyMovedTurn = engine.gs.turn;
  }

  // Fire onCardEnterZone with `_isMove: true` so the Slippery
  // Creature's own on-move listener (and any future archetype-aware
  // reactor) can distinguish "moved here" from "summoned here". No
  // `_onlyCard` — host-Hero passives still react to the entry.
  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
    _skipReactionCheck: true,
    _isMove: true,
  });

  return true;
}

/**
 * Filter applied to every candidate Slippery Creature before it shows
 * up in the Start Phase picker. Mirrors the gate that the per-Creature
 * payoff hooks themselves apply (faceDown / negated / frozen / stunned
 * / nulled all skip), plus the per-turn "already auto-slid" mark so the
 * picker doesn't list a Creature that Pengu's rider (or another move
 * source) already shoved this turn.
 */
function _slipperyEligibleNow(engine, inst) {
  if (!inst || inst.zone !== 'support') return false;
  if (inst.faceDown) return false;
  if (inst.counters?.negated || inst.counters?.nulled) return false;
  if (inst.counters?.frozen || inst.counters?.stunned) return false;
  if (inst._slipperyMovedTurn === engine.gs.turn) return false;
  return true;
}

/**
 * Collect this turn's still-movable Slippery Creatures on `pi`'s side.
 * Re-evaluated each iteration of the sub-mode so newly-summoned
 * Slipperies AND newly-marked ones (Pengu/Snowman/etc. chains) refresh
 * the picker in real time.
 */
function _collectMovableSlipperies(engine, pi) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (!isSlipperyCard(inst.name, engine)) continue;
    if (!_slipperyEligibleNow(engine, inst)) continue;
    const dests = destinationsFor(engine, pi, inst);
    if (dests.length === 0) continue;
    out.push({ inst, dests });
  }
  return out;
}

/**
 * Interactive Start Phase sub-mode driving every Slippery Creature's
 * auto-slide. Funnels through `engine.promptGeneric` with a custom
 * `slipperyMove` type so the client can render highlights + a
 * "Done Slipping" exit button.
 *
 * Player path:
 *   1. Highlight every eligible Slippery + show the picker panel.
 *   2. Click a Slippery → client locally selects it and highlights
 *      that Creature's destination zones.
 *   3. Click a destination zone (even when only 1 is legal — explicit
 *      confirm step per the spec) → response = { instId, destHeroIdx,
 *      destSlot }.
 *   4. Server moves the Creature, fires its on-move payoff (which may
 *      open its own nested prompts — Pengu's rider, Snowman freeze
 *      confirm, Whoolmoth damage target, Narw destroy + tutor, etc.),
 *      then re-collects and re-prompts.
 *   5. Loop until the player clicks "Done Slipping" or no eligible
 *      Slippery has any legal destination.
 *
 * CPU path: skip the prompt entirely and auto-pick the first
 * destination for each eligible Slippery in iteration order. The
 * positional value is small and stable; cheap heuristic is good
 * enough (MCTS can be wired later via cpuResponse if needed).
 *
 * Iteration cap is a defensive guard against pathological re-spawn
 * loops; in practice the picker terminates inside a handful of steps.
 */
async function _runSlipperySubMode(engine, pi) {
  // Snapshot the inst.ids of `pi`'s Slippery Creatures on the board at
  // sub-mode entry. ONLY these Slipperies are eligible to slip this
  // turn. Anything that comes into play DURING the sub-mode — e.g. a
  // new Slippery summoned via Polar's bonus Summoning-Magic Spell, or
  // a Slippery returned from discard by some future card — is excluded
  // and waits until next turn's Start Phase to auto-slide. This is the
  // explicit user rule: "Slippery Creatures newly brought out during
  // the Start Phase do NOT get to slip immediately during that Start
  // Phase."
  const initialIds = new Set();
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (!isSlipperyCard(inst.name, engine)) continue;
    initialIds.add(inst.id);
  }
  const collect = () =>
    _collectMovableSlipperies(engine, pi).filter(e => initialIds.has(e.inst.id));

  if (engine.isCpuPlayer(pi)) {
    for (let iter = 0; iter < 64; iter++) {
      const list = collect();
      if (list.length === 0) return;
      const entry = list[0];
      const dest = entry.dests[0];
      await moveSlipperyCreature(engine, pi, entry.inst, dest.heroIdx, dest.slotIdx);
    }
    return;
  }
  for (let iter = 0; iter < 64; iter++) {
    const list = collect();
    if (list.length === 0) return;
    const result = await engine.promptGeneric(pi, {
      type: 'slipperyMove',
      title: 'Slippery Movement',
      description: 'You may move your Slippery Creatures around!',
      creatures: list.map(e => ({
        instId: e.inst.id,
        name: e.inst.name,
        heroIdx: e.inst.heroIdx,
        zoneSlot: e.inst.zoneSlot,
        dests: e.dests.map(d => ({ heroIdx: d.heroIdx, slotIdx: d.slotIdx })),
      })),
      doneLabel: '✓ Done Slipping',
      cancellable: false,
    });
    if (!result || result.done) return;
    const { instId, destHeroIdx, destSlot } = result;
    if (instId == null || destHeroIdx == null || destSlot == null) continue;
    const entry = list.find(e => e.inst.id === instId);
    if (!entry) continue;
    if (!entry.dests.some(d => d.heroIdx === destHeroIdx && d.slotIdx === destSlot)) continue;
    await moveSlipperyCreature(engine, pi, entry.inst, destHeroIdx, destSlot);
  }
}

/**
 * Coordinator `onTurnStart` hook attached to every Slippery Creature.
 * Engine fires `onTurnStart` once per active support-zone hook source,
 * so with N Slipperies on a side this would naively open N prompts.
 * Instead, the first invocation per (player, turn) stamps a flag and
 * runs the unified sub-mode for ALL of that player's Slipperies;
 * subsequent invocations within the same turn no-op.
 *
 * The per-Creature filter (zone / faceDown / counters) is applied
 * inside the sub-mode collector — this outer guard just decides
 * whether to RUN the sub-mode at all. Even a frozen/stunned Slippery
 * still triggers the coordinator (it just won't be eligible inside),
 * so the player gets a chance to move their OTHER unstunned Slipperies.
 */
async function onSlipperyTurnStart(ctx) {
  if (!ctx.isMyTurn) return;
  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const gs = engine.gs;
  if (!gs._slipperySubModeTurn) gs._slipperySubModeTurn = {};
  if (gs._slipperySubModeTurn[pi] === gs.turn) return;
  gs._slipperySubModeTurn[pi] = gs.turn;
  await _runSlipperySubMode(engine, pi);
}

/**
 * Gate for a Slippery Creature's `onCardEnterZone` listener. Returns
 * true when the hook is for THIS Creature instance AND came from a
 * Slippery move (not the initial summon). Each Creature's listener
 * starts with: `if (!slipperyOnMoveGate(ctx)) return;`.
 */
function slipperyOnMoveGate(ctx) {
  if (!ctx) return false;
  if (ctx._isMove !== true) return false;
  if (!ctx.enteringCard || !ctx.card) return false;
  return ctx.enteringCard.id === ctx.card.id;
}

/** Card-DB-backed test: is this card name a Slippery archetype member? */
function isSlipperyCard(cardName, engine) {
  if (!cardName) return false;
  const cd = engine._getCardDB()[cardName];
  return cd?.archetype === ARCHETYPE;
}

module.exports = {
  ARCHETYPE,
  adjacentHeroIndices,
  destinationsFor,
  moveSlipperyCreature,
  onSlipperyTurnStart,
  slipperyOnMoveGate,
  isSlipperyCard,
};
