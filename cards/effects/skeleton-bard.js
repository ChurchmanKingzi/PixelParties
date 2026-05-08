// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton Bard"
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You may once per turn choose another Creature you control with a
//  once per turn effect. It may immediately use its once per turn
//  effect an additional time.
//
//  "Additional time" is read literally — the chosen Creature's
//  `onCreatureEffect` is invoked directly with a fresh ctx, which the
//  engine's per-instance creature-effect HOPT does NOT consume
//  (HOPT is only stamped when the engine's normal activation pipeline
//  in server.js fires the effect). So the chosen Creature can still
//  fire its own normal 1/turn use, plus this Bard-driven fire.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Skeleton Bard';

/** Own creatures (excluding self) whose script defines a creatureEffect. */
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
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    return eligibleTargets(ctx._engine, ctx.cardOwner, ctx.card?.id).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const selfId = ctx.card?.id;

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

    engine.log('skeleton_bard_encore', {
      player: engine.gs.players[pi]?.username,
      target: targetInst.name,
      resolved,
    });
    engine.sync();
    return true;
  },
};
