// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Idol"
//  Reaction Artifact (cost 4)
//
//  TRIGGER: 2+ Creatures you control would take
//  damage from a single source. Detected via the
//  engine's universal `_checkCreatureDamageBatch
//  Reactions` window, which scans both players'
//  hands when a damage batch contains 2+ live
//  entries on a single side.
//
//  EFFECT: Negate all effects that damage source
//  would have on Creatures you control —
//  including damage. Implemented as: cancel
//  every entry in the batch that targets a
//  Creature on the activator's side. Subsequent
//  damage from the same batch (e.g., chained
//  reactions) doesn't re-trigger Idol because the
//  helper short-circuits on entries already
//  cancelled / immune.
//
//  ACTIVATION: HAND-ONLY VIA REACTION TRIGGER.
//  • `canActivate: () => false` — never proactively
//    playable.
//  • `neverPlayable: true` — surfaced in
//    `neverPlayableCards` so the client greys the
//    card out in hand.
//  • `subtype: 'Reaction'` (data file) — engine's
//    Reaction-subtype gate (no `proactivePlay`)
//    blocks any from-hand cast.
//  • Standard chain reaction window (`isReaction:
//    true`) is NOT used — Deepsea Idol fires only
//    via the batch helper, not in response to
//    arbitrary card plays.
// ═══════════════════════════════════════════

const CARD_NAME = 'Deepsea Idol';

module.exports = {
  // Custom flag — engine helper picks this up.
  isCreatureDamageBatchReaction: true,

  // Strictly reactive — never proactively playable. The neverPlayable
  // surface keeps it greyed out in hand.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Trigger gate. The engine helper has already verified ≥2 of pi's
   * Creatures would actually take damage. We just defensive-check that
   * entries are non-empty.
   */
  creatureDamageBatchCondition(gs, pi, engine, entries) {
    if (!Array.isArray(entries) || entries.length === 0) return false;
    return true;
  },

  /**
   * Resolve: cancel every batch entry targeting a Creature on the
   * activator's side. The engine's damage-batch loop respects
   * `e.cancelled === true` and skips the HP reduction + downstream
   * effects (afterDamage hooks, status applications gated on
   * "this damage actually landed", etc.) for cancelled entries.
   *
   * Animation: a cosmic / wave burst on each saved creature so the
   * negation is visible.
   */
  async creatureDamageBatchResolve(engine, pi, entries) {
    let saved = 0;
    for (const e of entries) {
      if (!e.inst) continue;
      if (e.inst.owner !== pi) continue;
      if (e.cancelled) continue;
      e.cancelled = true;
      saved++;
      engine._broadcastEvent('play_zone_animation', {
        type: 'deepsea_idol_negate',
        owner: e.inst.owner,
        heroIdx: e.inst.heroIdx,
        zoneSlot: e.inst.zoneSlot,
      });
    }
    if (saved > 0) await engine._delay(450);
    engine.log('deepsea_idol_negate', {
      player: engine.gs.players[pi]?.username,
      creaturesProtected: saved,
    });
    engine.sync();
  },
};
