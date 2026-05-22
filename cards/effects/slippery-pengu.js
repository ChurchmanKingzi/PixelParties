// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Pengu"
//  Creature (Summoning Magic Lv1, 50 HP — Slippery)
//
//  At the beginning of each of your turns, place
//  this Creature into the free Support Zone of an
//  adjacent Hero, if possible.
//
//  When this Creature is moved into a different
//  Hero's Support Zone, you may choose another
//  Creature you control (except another copy of
//  "Slippery Pengu"). Your opponent then chooses
//  a free Support Zone of one of your adjacent
//  undefeated Heroes (adjacent to the chosen
//  Creature's current Hero), if possible.
//  Immediately move that Creature into that
//  Support Zone.
//
//  Mechanics notes:
//   • "Adjacent" Heroes are 0↔1, 1↔2 — same row
//     adjacency rule the Slippery archetype uses
//     for Creature movement.
//   • Destination Heroes MUST be undefeated. Empty
//     columns and KO'd Hero slots are excluded
//     (this is stricter than the turn-start auto-
//     slide, which allows empty columns).
//   • Movement reuses `moveSlipperyCreature` so the
//     animation, source-slot floater suppression,
//     and on-move trigger semantics match every
//     other Slippery move source.
//   • The chosen Creature need not be Slippery —
//     Pengu can shove any allied Creature. If it IS
//     Slippery, `moveSlipperyCreature` marks it as
//     "moved this turn" so it can't also be picked
//     by the Start Phase auto-slide picker.
//   • Opponent's zone-pick uses the standard
//     `zonePick` prompt with `owner: pi` — the
//     opponent sees the player's free zones
//     highlighted as if it were their own
//     placement.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  onSlipperyTurnStart,
  slipperyOnMoveGate,
  moveSlipperyCreature,
  adjacentHeroIndices,
} = require('./_slippery-shared');

const CARD_NAME = 'Slippery Pengu';

/**
 * Own Creatures eligible to be picked as Pengu's "move-me-too" target.
 * Card text excludes copies of Slippery Pengu by name, and the moving
 * Pengu instance itself is excluded as a defense in depth (covered
 * already by the name filter, but explicit for clarity if a future
 * mechanic ever changes Pengu's display name).
 */
function eligiblePartnerCreatures(engine, pi, excludeInstId) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.id === excludeInstId) continue;
    if (inst.name === CARD_NAME) continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: pi,
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    });
  }
  return out;
}

/**
 * Free Support Zones on Heroes ADJACENT to `fromHeroIdx`, restricted to
 * Heroes that are alive (hp > 0). Empty columns and KO'd Heroes are
 * excluded per the card's "adjacent undefeated Heroes" wording. Returns
 * `{ owner, heroIdx, slotIdx, label }` entries for the zone-pick prompt.
 */
function adjacentFreeUndefeatedZones(engine, pi, fromHeroIdx) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (const hi of adjacentHeroIndices(fromHeroIdx)) {
    const hero = ps.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) {
        out.push({
          owner: pi,
          heroIdx: hi, slotIdx: zi,
          label: `${hero.name} — Slot ${zi + 1}`,
        });
      }
    }
  }
  return out;
}

module.exports = {
  activeIn: ['support'],

  // ── MCTS partner picker for the rider's promptTarget ──
  // Default `_getCpuTargetResponse` declines cancellable target prompts,
  // which meant Pengu's rider silently never fired for the CPU. Here we
  // intercept that prompt, build one option per eligible partner
  // Creature (each scored by snapshot → simulated move → rollout →
  // `evaluateState`), and pick whichever scores highest. The MCTS
  // naturally highlights Whoolmoth (120 dmg) and other high-impact
  // payoffs over neutral Slipperies; user spec: "use MCTS to find the
  // most valuable other Slippery to move (which will almost always be
  // Whoolmoth for its 120 damage)."
  //
  // Inside an outer rollout (`_inMctsSim`) the picker can't recurse —
  // we return the first option deterministically so the outer MCTS
  // still sees Pengu's bonus value land (a `return undefined` here
  // would fall through to the engine default's cancellable-decline,
  // making the rollout underestimate Pengu).
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const config = payload?.config;
    if (config?.title !== CARD_NAME) return undefined;
    const validTargets = payload.validTargets || [];
    if (validTargets.length === 0) return [];
    if (validTargets.length === 1) return [validTargets[0].id];

    const cpuIdx = engine._cpuPlayerIdx;
    if (cpuIdx == null || cpuIdx < 0) return [validTargets[0].id];

    // Lazy require so card-script load doesn't depend on _cpu init.
    let mctsPick;
    try { ({ mctsPickFromOptions: mctsPick } = require('./_cpu')); }
    catch { mctsPick = null; }

    // Inside an outer rollout: deterministic first-option pick so the
    // outer MCTS still captures the value of Pengu's bonus move.
    if (engine._inMctsSim || typeof mctsPick !== 'function') {
      return [validTargets[0].id];
    }

    return (async () => {
      const apply = async (eng, opt) => {
        const liveInst = eng.cardInstances.find(c => c.id === opt.cardInstance?.id);
        if (!liveInst || liveInst.zone !== 'support') return false;
        const ctrl = liveInst.controller ?? liveInst.owner;
        if (ctrl !== cpuIdx) return false;
        // Proxy the opp's destination pick by moving to the first legal
        // adjacent-undefeated free zone — same default the engine uses
        // for an opp CPU's zonePick response. The relative VALUE between
        // partners (Whoolmoth's 120 dmg etc.) dominates the destination
        // choice, so this proxy preserves the ranking we care about.
        const dests = adjacentFreeUndefeatedZones(eng, cpuIdx, liveInst.heroIdx);
        if (dests.length === 0) return false;
        const dest = dests[0];
        const ok = await moveSlipperyCreature(
          eng, cpuIdx, liveInst, dest.heroIdx, dest.slotIdx,
          { skipSlipperyMovedMark: true },
        );
        return ok !== false;
      };
      try {
        const best = await mctsPick(engine, validTargets, apply);
        if (best?.id) return [best.id];
      } catch { /* fall through */ }
      return [validTargets[0].id];
    })();
  },

  hooks: {
    onTurnStart: onSlipperyTurnStart,

    onCardEnterZone: async (ctx) => {
      if (!slipperyOnMoveGate(ctx)) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = engine.gs.players[pi];
      if (!ps) return;
      const pengueInst = ctx.card;

      // Build the eligible-Creature list, then keep only those that
      // have at least one adjacent-undefeated-Hero free zone available.
      // If a Creature has zero legal destinations, presenting it is
      // pointless — the opponent's later zone-pick would be empty.
      const candidates = eligiblePartnerCreatures(engine, pi, pengueInst.id)
        .map(t => ({
          target: t,
          dests: adjacentFreeUndefeatedZones(engine, pi, t.heroIdx),
        }))
        .filter(c => c.dests.length > 0);
      if (candidates.length === 0) return;

      // Player picks a Creature (the "you may" — cancellable).
      const selectedIds = await ctx.promptTarget(
        candidates.map(c => c.target),
        {
          title: CARD_NAME,
          description: 'Choose another Creature you control to slip-move. Your opponent will pick the destination.',
          confirmLabel: '🐧 Slip-Move',
          confirmClass: 'btn-info',
          cancellable: true,
          exclusiveTypes: true,
          maxPerType: { equip: 1 },
        },
      );
      if (!selectedIds || selectedIds.length === 0) return;
      const chosen = candidates.find(c => c.target.id === selectedIds[0]);
      if (!chosen) return;

      // Re-collect destinations against the LIVE board — state may have
      // shifted (a post-target reaction could have moved or KO'd a
      // Hero, or summoned into a slot we'd marked free). If the list
      // collapsed to zero, the effect fizzles per the "if possible"
      // wording on the card.
      const liveInst = chosen.target.cardInstance;
      if (!liveInst || liveInst.zone !== 'support'
          || (liveInst.controller ?? liveInst.owner) !== pi) return;
      const liveDests = adjacentFreeUndefeatedZones(engine, pi, liveInst.heroIdx);
      if (liveDests.length === 0) return;

      // Opponent picks the destination zone. The zone-pick prompt is
      // forced (`cancellable: false`) — the card text gives the opp NO
      // option to refuse. `owner: pi` makes the client highlight the
      // player's own zones for the opp's pick.
      const oppPs = engine.gs.players[oppIdx];
      const dest = await engine.promptGeneric(oppIdx, {
        type: 'zonePick',
        title: `${CARD_NAME} — Opponent's choice`,
        description: `Choose a free Support Zone of one of ${ps.username}'s adjacent undefeated Heroes for ${liveInst.name}.`,
        zones: liveDests,
        cancellable: false,
      });
      if (!dest) return;

      // Re-verify the opp's pick against the live destination list
      // (defense in depth against a stale response — the opp's prompt
      // window can't usually shift the board, but mid-flight reaction
      // chains technically could).
      const stillLegal = liveDests.some(z =>
        z.heroIdx === dest.heroIdx && z.slotIdx === dest.slotIdx,
      );
      if (!stillLegal) return;

      // Pengu's rider grants a SEPARATE move on top of the target's
      // own inherent turn-start auto-slide — don't stamp `_slipperyMovedTurn`,
      // so the target stays eligible in the Start Phase picker.
      const ok = await moveSlipperyCreature(
        engine, pi, liveInst, dest.heroIdx, dest.slotIdx,
        { skipSlipperyMovedMark: true },
      );
      if (!ok) return;

      engine.log('slippery_pengu_force_move', {
        player: ps.username,
        opponent: oppPs?.username,
        creature: liveInst.name,
        to: ps.heroes?.[dest.heroIdx]?.name,
        zoneSlot: dest.slotIdx,
      });
      engine.sync();
    },
  },
};
