// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Bone Dog"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  When a "Loyal" or "Skeleton" Creature you
//  control would be defeated, you may discard
//  this card from your hand to revive that
//  Creature with full HP after it dies.
//
//  This Creature is also treated as a "Skeleton"
//  Creature.
//
//  Wiring:
//    • Hand reaction via the engine's
//      `isCreaturePreDefeatReaction` window
//      (in `_engine.js`'s
//      `_checkCreaturePreDefeatHandReactions`,
//      called from `actionApplyDamageBatch`
//      before each lethal entry finalizes).
//    • Condition: dying Creature is on the same
//      side as Bone Dog's controller AND is a
//      Loyal OR a Skeleton.
//    • Resolve semantics: this is a "kill AND
//      revive" effect, not a "protect from death"
//      effect. The resolver stamps the dying
//      instance with `_reviveAfterDeath` and
//      returns `{ saved: false }` — letting the
//      lethal HP application, onCardLeaveZone,
//      and onCreatureDeath all fire normally so
//      every other on-death trigger (Loyal
//      Terrier's death-watch chain, etc.) sees
//      the creature as having actually died.
//      The engine's death-batch processor reads
//      `_reviveAfterDeath` after `_untrackCard`
//      and re-summons a fresh instance into the
//      same slot raw (no onPlay/onCardEnterZone
//      hooks — it's a revive, not a fresh play).
//    • The "treated as Skeleton" half of the
//      rules text lives in `_skeleton-shared.js`'s
//      `TREATED_AS_SKELETON` set — any current or
//      future Skeleton-tribal effect that calls
//      into `isSkeletonCreature` sees Bone Dog
//      automatically.
// ═══════════════════════════════════════════

const { isLoyalCreature } = require('./_loyal-shared');
const { isSkeletonCreature } = require('./_skeleton-shared');

const CARD_NAME = 'Loyal Bone Dog';

module.exports = {
  // Engine flag — surfaces this card in the creature pre-defeat hand
  // reaction window.
  isCreaturePreDefeatReaction: true,

  // Strictly reactive: never proactively playable, never a chain-link
  // candidate. Hand cards stay dimmed in the regular UI.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Trigger condition — the engine hands over the dying creature
   * instance with the FINAL damage amount about to land, AFTER all
   * other modifiers (Cloudy, Smug Coin equivalents, Labradoodle
   * reduction). Bone Dog fires when the doomed Creature is on the
   * controller's side AND is a Loyal or Skeleton.
   */
  creaturePreDefeatCondition(gs, ownerIdx, engine, creatureInst /*, source, amount, type */) {
    if (!creatureInst) return false;
    // Dying creature must be on our side.
    const targetController = creatureInst.controller ?? creatureInst.owner;
    if (targetController !== ownerIdx) return false;
    // Loyal OR Skeleton — Bone Dog is excluded from the dying-self
    // case implicitly: a Bone Dog only fires from HAND, so a Bone Dog
    // on the board dying could only be saved by ANOTHER Bone Dog in
    // hand, which is fine per card text.
    if (isLoyalCreature(creatureInst.name, engine)) return true;
    if (isSkeletonCreature(creatureInst.name, engine)) return true;
    return false;
  },

  /**
   * Mark the doomed creature for revive-after-death and let the
   * death proceed. The engine's death-batch processor reads
   * `_reviveAfterDeath` after onCreatureDeath has fired and
   * re-summons a fresh instance into the same slot. Returning
   * `{ saved: false }` is intentional — Bone Dog does NOT protect
   * from death; it kills then revives, so every other on-death
   * trigger (Terrier's chain, etc.) fires on the way through.
   */
  async creaturePreDefeatResolve(engine, ownerIdx, creatureInst /*, source, amount, type */) {
    if (!creatureInst) return { saved: false };
    const cardDB = engine._getCardDB();
    const cd     = cardDB[creatureInst.name];
    const maxHp  = creatureInst.counters.maxHp ?? cd?.hp ?? 0;
    if (maxHp <= 0) return { saved: false };

    creatureInst._reviveAfterDeath = {
      name: creatureInst.name,
      owner: creatureInst.owner,
      originalOwner: creatureInst.originalOwner,
      heroIdx: creatureInst.heroIdx,
      zoneSlot: creatureInst.zoneSlot,
      by: CARD_NAME,
    };

    engine.log('loyal_bone_dog_save', {
      player: engine.gs.players[ownerIdx]?.username,
      target: creatureInst.name,
      restoredTo: maxHp,
    });
    engine.sync();
    return { saved: false };
  },
};
