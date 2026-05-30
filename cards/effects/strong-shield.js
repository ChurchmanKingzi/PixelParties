// ═══════════════════════════════════════════
//  CARD EFFECT: "Strong Shield"
//  Artifact (Reaction, Cost 8)
//
//  Play this card immediately when a target you
//  control would take 300 or more damage. Negate
//  that damage (but not other effects associated
//  with it) to that target.
//
//  Source-agnostic: any damage type, any source,
//  any amount ≥ 300 to a Hero or Creature on the
//  controller's side. Returns `{ amountOverride: 0 }`
//  from the pre-damage resolver — the afterDamage
//  hook still fires, on-hit riders (Icebolt's
//  Freeze, etc.) still trigger, separate companion
//  damage from the same Spell (Phoenix Tackle's
//  recoil) is unaffected. Only the HP loss to this
//  target is removed.
//
//  No HOPT and no once-per-game lock — multiple
//  copies may chain on a single multi-target source
//  if the controller wants to spend the gold.
// ═══════════════════════════════════════════

const CARD_NAME = 'Strong Shield';
const TRIGGER_THRESHOLD = 300;

module.exports = {
  // Purely reactive — never proactively played.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  // ── Hero damage path ──────────────────────────────────────────────
  isPreDamageReaction: true,
  preDamageCondition(gs, ownerIdx, engine, target, heroIdx, source, amount /*, type */) {
    return amount >= TRIGGER_THRESHOLD;
  },
  async preDamageResolve(engine, ownerIdx, target /*, heroIdx, source, amount, type */) {
    engine.log('strong_shield_negate', {
      player: engine.gs.players[ownerIdx]?.username,
      target: engine._heroLabel(target),
    });
    return { amountOverride: 0 };
  },

  // ── Creature damage path ──────────────────────────────────────────
  isCreaturePreDamageReaction: true,
  creaturePreDamageCondition(gs, ownerIdx, engine, creatureInst, source, amount /*, type */) {
    return amount >= TRIGGER_THRESHOLD;
  },
  async creaturePreDamageResolve(engine, ownerIdx, creatureInst /*, source, amount, type */) {
    engine.log('strong_shield_negate', {
      player: engine.gs.players[ownerIdx]?.username,
      target: creatureInst.name,
    });
    return { amountOverride: 0 };
  },
};
