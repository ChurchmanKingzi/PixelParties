// ═══════════════════════════════════════════
//  CARD EFFECTS: "Skeleton Bard"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose another Creature you control with a
//  once per turn effect. It may immediately use its once per turn
//  effect an additional time. You can only activate this effect of
//  "Skeleton Bard" once per turn.
//
//  "Additional time" is read literally — the chosen Creature's
//  `onCreatureEffect` is invoked directly with a fresh ctx, which the
//  engine's per-instance creature-effect HOPT does NOT consume
//  (HOPT is only stamped when the engine's normal activation pipeline
//  in server.js fires the effect). So the chosen Creature can still
//  fire its own normal 1/turn use, plus this Bard-driven fire.
//
//  Hard once-per-turn (player-level): only ONE Skeleton Bard's effect
//  can fire each turn no matter how many Bards are on the board.
//  Stored at `gs.hoptUsed['skeleton-bard:<pi>']`. Stamped only after
//  the encore actually commits — cancelling the target prompt or
//  picking nothing leaves the slot free to retry.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Skeleton Bard';
const HOPT_KEY = 'skeleton-bard';

/**
 * Own creatures (excluding self) whose script defines a
 * creatureEffect AND whose own `canActivateCreatureEffect` gate
 * currently returns true. The latter check matters because Bard's
 * "use its once-per-turn effect again" only makes sense when the
 * target could legally fire it RIGHT NOW — e.g. Skeleton Priest
 * with no eligible Spells in discard, or a PACMAN reset target
 * whose Surprise Zone isn't empty, are both unactivatable and
 * therefore not valid encore targets.
 */
function eligibleTargets(engine, pi, selfId) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.id === selfId) continue;
    if (inst.faceDown) continue;
    const effectName = inst.counters?._effectOverride || inst.name;
    const script = loadCardEffect(effectName);
    if (!script?.creatureEffect) continue;
    if (typeof script.onCreatureEffect !== 'function') continue;
    if (typeof script.canActivateCreatureEffect === 'function') {
      let activatable = false;
      try {
        const probeCtx = engine._createContext(inst, { event: 'bardEncoreProbe' });
        activatable = !!script.canActivateCreatureEffect(probeCtx);
      } catch {
        activatable = false;
      }
      if (!activatable) continue;
    }
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    // Hard once-per-turn (player-level) — gates every Bard the
    // player controls. The engine's built-in per-inst HOPT
    // (`creature-effect:<instId>`) only blocks repeats of the SAME
    // Bard, which still leaves multiple Bards each firing once.
    if (engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn) return false;
    return eligibleTargets(engine, pi, ctx.card?.id).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const selfId = ctx.card?.id;

    // Re-check the hard HOPT here — a same-tick double-click can
    // race past `canActivateCreatureEffect` if the second prompt
    // hadn't stamped yet.
    if (engine.gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === engine.gs.turn) return false;

    const targets = eligibleTargets(engine, pi, selfId);
    if (targets.length === 0) return false;

    // Pick the target creature.
    const targetEntries = targets.map(inst => ({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    }));
    const picked = await engine.promptEffectTarget(pi, targetEntries, {
      title: CARD_NAME,
      description: 'Pick another Creature you control to fire its once-per-turn effect again.',
      confirmLabel: '🎵 Encore!',
      confirmClass: 'btn-success',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });
    if (!picked || picked.length === 0) return false;
    const sel = targetEntries.find(t => t.id === picked[0]);
    const targetInst = sel?.cardInstance;
    if (!targetInst) return false;

    // Commit — stamp the player-level HOPT now so any other Bard
    // the controller owns sees the slot consumed for this turn.
    if (!engine.gs.hoptUsed) engine.gs.hoptUsed = {};
    engine.gs.hoptUsed[`${HOPT_KEY}:${pi}`] = engine.gs.turn;

    // Fire the chosen creature's effect directly. Build its ctx via
    // the engine's standard helper so its onCreatureEffect sees a
    // normal-shaped context. We DON'T claim the engine's
    // creature-effect HOPT for this fire — Bard's "additional time"
    // shouldn't burn the creature's own once-per-turn slot.
    const effectName = targetInst.counters?._effectOverride || targetInst.name;
    const script = loadCardEffect(effectName);
    if (!script?.onCreatureEffect) return false;

    const targetCtx = engine._createContext(targetInst, { event: 'bardEncore' });
    let resolved = false;
    try {
      const r = await script.onCreatureEffect(targetCtx);
      resolved = r !== false;
    } catch (err) {
      console.error(`[Skeleton Bard] re-fire of '${targetInst.name}' threw:`, err.message);
    }

    // If the chosen Creature's own onCreatureEffect bailed out
    // (cancelled an inner prompt, no valid target after recheck,
    // threw, …), the encore didn't actually do anything — refund
    // Bard's hard once-per-turn slot and tell the engine the
    // activation failed so it skips the per-inst HOPT stamp too.
    if (!resolved) {
      if (engine.gs.hoptUsed) delete engine.gs.hoptUsed[`${HOPT_KEY}:${pi}`];
      engine.sync();
      return false;
    }

    engine.log('skeleton_bard_encore', {
      player: engine.gs.players[pi]?.username,
      target: targetInst.name,
      resolved,
    });
    engine.sync();
    return true;
  },
};
