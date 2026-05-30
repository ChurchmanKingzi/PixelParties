// ═══════════════════════════════════════════
//  CARD EFFECT: "Taio, the Sun Fencer"
//  Hero — 400 HP / 80 ATK, starting abilities Fighting + Thieving.
//
//  Effect:
//    1. While Taio has an Artifact with a cost of 10 or more
//       equipped to him, every Destruction Magic Spell HE casts
//       has its level reduced by Taio's Fighting level.
//    2. Taio's Attack stat is increased by 20 for every Artifact
//       equipped to him.
//
//  Wiring:
//    • Level-reduction lives in the engine's generic level-
//      reduction hook `reduceCardLevel(cardData, engine, ownerIdx,
//      inst, heroIdx)`. The `heroIdx` arg (added alongside this
//      card — see _engine.js `_applyCardLevelReductions`) is the
//      casting Hero's slot, which lets Taio's reducer fire ONLY
//      for spells played from his own slot, not from other Heroes
//      on the same side. The contribution amount is
//      `countAbilitiesForSchool('Fighting', taiosAbZones)` —
//      matches the canonical Fighting-stack count.
//    • The "cost-≥-10 Artifact equipped" gate walks Taio's
//      Support Zone and consults `engine.isEquipInZone(name, inst)`
//      so subtype:'Equipment' Artifacts, opted-in `isEquip`
//      cards, and `treatAsEquip` counter-stamps all qualify.
//      `cardDB[name].cost >= 10` is the numeric cost gate.
//    • The +20 ATK aura is computed via additive grants tracked
//      on each Equipment inst (`inst.counters._taioAtkGranted`).
//      Mirrors Fighting's `atkGranted` pattern so Equipment that
//      leaves Taio's slot correctly revokes its contribution
//      via a single `onCardLeaveZone` listener.
//    • Listener flow:
//        - `onGameStart`: Taio is typically a starting Hero. Walk
//          his Support Zone once and grant +20 per Equipment
//          already in play (rare on turn 0, but covers puzzle /
//          preset boards).
//        - `onCardEnterZone`: fires either when Taio himself
//          enters a Hero Zone (mid-game placement — also walks
//          existing equipment) or when an Equipment enters
//          Taio's Support Zone (grant +20).
//        - `onCardLeaveZone`: fires when an Equipment leaves
//          Taio's slot — revoke the stamped +20. Ignores Taio's
//          own departure (the slot's ATK becomes moot on death/
//          ascension anyway; the engine resets `hero.atk` on
//          ascension and dead Heroes don't act).
// ═══════════════════════════════════════════

const CARD_NAME = 'Taio, the Sun Fencer';
const COST_THRESHOLD = 10;
const ATK_PER_ARTIFACT = 20;

// ── Ascension prerequisites for "Taio, Absorber of the Mountain's Heart" ──
// 1. The Sun Sword equipped to this Taio.
// 2. Has defeated an opp Hero with an Attack or Destruction Magic Spell
//    this game (persistent flag on the hero object: `_taioKilledOppHero`).
const ASCEND_TARGET = 'Taio, Absorber of the Mountain\'s Heart';
const SUN_SWORD     = 'The Sun Sword';
const KILL_FLAG     = '_taioKilledOppHero';

module.exports = {
  activeIn: ['hero'],

  /**
   * Engine-queried level-reduction hook. `heroIdx` (5th arg) is the
   * casting Hero — Taio only reduces spells HE casts, so bail when
   * the caster isn't Taio's own slot.
   */
  reduceCardLevel(cardData, engine, ownerIdx, inst, heroIdx) {
    if (!cardData) return 0;
    // Only Destruction Magic Spells.
    if (cardData.cardType !== 'Spell') return 0;
    if (cardData.spellSchool1 !== 'Destruction Magic'
        && cardData.spellSchool2 !== 'Destruction Magic') return 0;
    // Per-Hero gate: this Taio inst's slot must match the casting Hero.
    // `heroIdx` may be `undefined` from lookahead-style callers that
    // don't know the caster — treat that as "not Taio's spell".
    if (heroIdx == null) return 0;
    if (inst?.heroIdx !== heroIdx) return 0;
    // Conditional gate: at least one Artifact (cost ≥ 10) equipped.
    if (!_hasHighCostArtifactEquipped(engine, ownerIdx, heroIdx)) return 0;
    // Reduction amount = Taio's Fighting level.
    const ps = engine.gs.players[ownerIdx];
    if (!ps) return 0;
    const abZones = ps.abilityZones?.[heroIdx] || [];
    return engine.countAbilitiesForSchool('Fighting', abZones);
  },

  hooks: {
    /**
     * Starting-hero entry. Walk Taio's Support Zone and grant the
     * +20 ATK per Artifact already in play. No-op on the typical
     * turn-1 board (Heroes start with empty Support Zones), but
     * defensive against puzzle / preset / Ascension-into-Taio
     * starts that drop Equipment in alongside the Hero.
     */
    onGameStart: async (ctx) => {
      _grantForExistingEquipment(ctx);
      _refreshAscension(ctx);
    },

    /**
     * Two reasons this fires for Taio's listener:
     *   (a) Taio himself just entered the Hero Zone (Ascension,
     *       Quetzahuitl-style placement, future hero-revive paths).
     *       Treat exactly like onGameStart — walk equipment and
     *       grant.
     *   (b) Some other card entered the board. If it landed in
     *       Taio's Support Zone AND counts as an Equipment Artifact,
     *       grant +20 ATK.
     */
    onCardEnterZone: async (ctx) => {
      const entering = ctx.enteringCard;
      if (!entering) return;
      // Case (a): Taio entered his own slot.
      if (entering.id === ctx.card.id) {
        _grantForExistingEquipment(ctx);
        return;
      }
      // Case (b): something else entered. Must be in Taio's slot,
      // on his side, and qualify as an Equipment.
      if (entering.zone !== 'support') return;
      if (entering.heroIdx !== ctx.cardHeroIdx) return;
      if ((entering.controller ?? entering.owner) !== ctx.cardOwner) return;
      if (!ctx._engine.isEquipInZone(entering.name, entering)) return;
      _grantAura(ctx, entering);
      // The Sun Sword landing is one half of the ascension gate —
      // refresh so the hero picks up `ascensionReady` the moment
      // both conditions are satisfied.
      if (entering.name === SUN_SWORD) _refreshAscension(ctx);
    },

    /**
     * Revoke +20 when an Equipment leaves Taio's slot. Ignore
     * Taio's own departure (his ATK is moot on death / ascension —
     * the engine clears or replaces `hero.atk` on those paths).
     */
    onCardLeaveZone: async (ctx) => {
      const leaving = ctx.leavingCard;
      if (!leaving) return;
      if (leaving.id === ctx.card.id) return;
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (leaving.counters?._taioAtkGranted) _revokeAura(ctx, leaving);
      // The Sun Sword leaving is one half of the ascension gate —
      // refresh so `ascensionReady` clears when the Sword is gone.
      if (leaving.name === SUN_SWORD) _refreshAscension(ctx);
    },

    /**
     * Persistent kill-tracker for the ascension gate. Sets a flag on
     * Taio's hero object when an opp Hero is KO'd by an Attack or
     * Destruction Magic Spell card whose `heroIdx` matches Taio's
     * slot (i.e. Taio was the caster). The flag persists across
     * turns and through the ascension itself — on Ascend, the same
     * hero object's `name` flips to the Ascended card; the flag
     * lingers harmlessly. `_bypassDeadHeroFilter: true` is set on
     * the hookCtx by the engine for ON_HERO_KO, so this listener
     * fires even when targeting the dying hero's side.
     */
    onHeroKO: async (ctx) => {
      const hero = ctx.attachedHero;
      if (!hero?.name) return;
      if (hero[KILL_FLAG]) return;        // already recorded — no-op
      if (!ctx.hero?.name) return;
      // Dying hero must belong to Taio's opponent.
      const engine = ctx._engine;
      const dyingOwner = engine._findHeroOwner(ctx.hero);
      if (dyingOwner < 0 || dyingOwner === ctx.cardOwner) return;
      // Source attribution: same slot as Taio, and an Attack or
      // Destruction Magic Spell card.
      const src = ctx.source;
      if (!src?.name) return;
      if (src.owner !== ctx.cardOwner) return;
      if (src.heroIdx !== ctx.cardHeroIdx) return;
      const cd = engine._getCardDB()[src.name];
      if (!cd) return;
      const isAttack = cd.cardType === 'Attack';
      const isDMSpell = cd.cardType === 'Spell'
        && (cd.spellSchool1 === 'Destruction Magic'
            || cd.spellSchool2 === 'Destruction Magic');
      if (!isAttack && !isDMSpell) return;
      hero[KILL_FLAG] = true;
      engine.log('taio_kill_flag_set', {
        hero: hero.name, by: src.name, victim: ctx.hero.name,
      });
      _refreshAscension(ctx);
    },
  },
};

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

/**
 * True iff Taio has at least one Support-Zone card that qualifies as
 * Equipment AND has `cost >= 10` in the static card DB. Reads
 * `cardInstances` directly so per-instance facts (faceDown,
 * `treatAsEquip` counter via `isEquipInZone`'s inst-aware branch)
 * are respected.
 */
function _hasHighCostArtifactEquipped(engine, ownerIdx, heroIdx) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.heroIdx !== heroIdx) continue;
    if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
    if (inst.faceDown) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    const cd = cardDB[inst.name];
    if ((cd?.cost || 0) >= COST_THRESHOLD) return true;
  }
  return false;
}

/**
 * Walk Taio's Support Zone and grant the +20 ATK aura for each
 * Equipment Artifact already in place. Idempotent: skips any
 * inst that already carries a `_taioAtkGranted` stamp, so a
 * mid-game Ascension that fires both `onCardEnterZone` (Taio)
 * and replays `onGameStart` won't double-grant.
 */
function _grantForExistingEquipment(ctx) {
  const engine = ctx._engine;
  const ownerIdx = ctx.cardOwner;
  const heroIdx  = ctx.cardHeroIdx;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.heroIdx !== heroIdx) continue;
    if ((inst.controller ?? inst.owner) !== ownerIdx) continue;
    if (inst.faceDown) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    if (inst.counters?._taioAtkGranted) continue; // already granted
    _grantAura(ctx, inst);
  }
}

/** Apply +20 ATK to Taio and stamp the granting Equipment's inst. */
function _grantAura(ctx, equipInst) {
  const hero = ctx.attachedHero;
  if (!hero || !hero.name) return;
  const engine = ctx._engine;
  // Canonical engine ATK delta helper — routes through Curse's
  // suppression accumulator when Taio is cursed.
  engine._applyHeroAtkDelta(hero, ctx.cardOwner, ctx.cardHeroIdx, ATK_PER_ARTIFACT);
  if (!equipInst.counters) equipInst.counters = {};
  equipInst.counters._taioAtkGranted = ATK_PER_ARTIFACT;
  engine.log('taio_aura_grant', {
    hero: hero.name, equipment: equipInst.name, amount: ATK_PER_ARTIFACT,
  });
  engine.sync();
}

/** Revoke the stamped +20 ATK when its Equipment leaves Taio's slot. */
function _revokeAura(ctx, equipInst) {
  const hero = ctx.attachedHero;
  if (!hero || !hero.name) return;
  const engine = ctx._engine;
  const amount = equipInst.counters._taioAtkGranted || 0;
  if (amount <= 0) return;
  engine._applyHeroAtkDelta(hero, ctx.cardOwner, ctx.cardHeroIdx, -amount);
  delete equipInst.counters._taioAtkGranted;
  engine.log('taio_aura_revoke', {
    hero: hero.name, equipment: equipInst.name, amount,
  });
  engine.sync();
}

/**
 * Re-evaluate the two ascension conditions and toggle the standard
 * `ascensionReady` / `ascensionTarget` flags the engine's hand-card
 * gate (`canPlayCard` on Ascended Heroes, line ~14160 in app-board.jsx)
 * reads. Called from the Sun Sword equip/unequip listeners and from
 * the onHeroKO kill-flag setter.
 */
function _refreshAscension(ctx) {
  const hero = ctx.attachedHero;
  if (!hero?.name) return;
  if (hero.name !== CARD_NAME) return; // Already ascended or otherwise replaced.
  const engine = ctx._engine;
  const hasSword = engine.cardInstances.some(c =>
    c.zone === 'support'
    && c.heroIdx === ctx.cardHeroIdx
    && (c.controller ?? c.owner) === ctx.cardOwner
    && c.name === SUN_SWORD
    && !c.faceDown,
  );
  if (hasSword && hero[KILL_FLAG]) {
    hero.ascensionReady  = true;
    hero.ascensionTarget = ASCEND_TARGET;
  } else {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
  }
}
