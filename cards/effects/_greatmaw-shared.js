// ═══════════════════════════════════════════
//  SHARED HELPER: Greatmaw archetype
//
//  Greatmaw is a sacrifice / tribute archetype. Two Creatures are
//  HOPT "engines" whose activated effects cost sacrificing a Creature
//  you control (Greatmaw Shark → +100 ATK to a Hero; Infected Greatmaw
//  → deal a Hero's ATK as an Attack). Two more Creatures bend the
//  sacrifice rules:
//
//   • Greatmaw Siren (passive — no effect script). While Siren is on
//     the board, "the effects of Greatmaw Creatures" may sacrifice
//     Creatures the turn they were summoned. Creatures sacrificed THIS
//     WAY (fresh + for a Greatmaw effect), except Greatmaw Creatures,
//     have their effects negated — so their on-death/sacrifice
//     triggers are suppressed. Both halves are enforced here, consulted
//     by the engine Creatures' sacrifice spec.
//
//   • Greatmaw Remora (effect script — own self-rule). Remora can be
//     sacrificed the turn it was summoned for the effects of a
//     Greatmaw Creature even without a Siren. Remora opts in by
//     exporting `selfSacrificeableForGreatmaw: true`; the filter below
//     reads the flag generically so a future "fresh-sacrificeable for
//     Greatmaw" Creature only needs the same flag.
//
//  Single source of truth for "is this a Greatmaw Creature?" and the
//  sacrifice-cost `spec` (filter + Siren negation rider) the engine
//  Creatures hand to `engine.resolveSacrificeCost`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const GREATMAW_ARCHETYPE = 'Greatmaw';
const SIREN_NAME = 'Greatmaw Siren';
const REMORA_NAME = 'Greatmaw Remora';

/**
 * Is this card a "Greatmaw" Creature?
 *
 * Pure archetype check against cards.json — every Greatmaw card is a
 * standard Creature with `archetype: "Greatmaw"`, no per-card overrides.
 */
function isGreatmawCreature(cardName, engine) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  if (!hasCardType(cd, 'Creature')) return false;
  return cd.archetype === GREATMAW_ARCHETYPE;
}

/**
 * Does `pi` control at least 1 Greatmaw Creature OTHER than a Greatmaw
 * Remora? Drives Greatmaw Remora's "if you control at least 1 Greatmaw
 * Creature, except Greatmaw Remora" free-summon condition.
 *
 * Control (not ownership) is the gameplay-truth side. Negation / Freeze
 * is NOT filtered — a CC'd Creature is still controlled, and the card
 * text gates on control alone. `excludeInstId` skips a specific
 * instance (Remora's own instance, once it is on the board in onPlay).
 */
function controlsNonRemoraGreatmaw(engine, pi, excludeInstId = null) {
  if (!engine || pi == null) return false;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    if (excludeInstId != null && inst.id === excludeInstId) continue;
    if (inst.name === REMORA_NAME) continue;
    if (!isGreatmawCreature(inst.name, engine)) continue;
    return true;
  }
  return false;
}

/**
 * Does `pi` control an ACTIVE Greatmaw Siren? A Siren whose effects are
 * shut off (Negated / Nulled / Frozen / Stunned) stops relaxing the
 * sacrifice rule — same gate the engine applies to any Creature passive.
 */
function controlsActiveGreatmawSiren(engine, pi) {
  if (!engine || pi == null) return false;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.name !== SIREN_NAME) continue;
    if (inst.faceDown) continue;
    const c = inst.counters || {};
    if (c.negated || c.nulled || c.frozen || c.stunned) continue;
    return true;
  }
  return false;
}

/**
 * The `spec.filter` for a Greatmaw Creature's sacrifice cost.
 *
 * `engine.getSacrificableCreatures` does NOT exclude Creatures summoned
 * this turn — that restriction is the card's job. A candidate passes if:
 *   • it was NOT summoned this turn, OR
 *   • you control an active Greatmaw Siren (relaxes the rule for all), OR
 *   • the candidate's own script opts in via `selfSacrificeableForGreatmaw`
 *     (Greatmaw Remora's self-rule).
 */
function greatmawSacFilter(engine, pi) {
  const gs = engine.gs;
  const sirenActive = controlsActiveGreatmawSiren(engine, pi);
  return (c) => {
    const inst = c?.inst;
    if (!inst) return false;
    if (inst.turnPlayed !== gs.turn) return true;          // not fresh
    if (sirenActive) return true;                          // Siren relaxes
    const script = loadCardEffect(inst.name);
    return !!script?.selfSacrificeableForGreatmaw;          // Remora self-rule
  };
}

/**
 * Greatmaw Siren's negation clause. For each chosen tribute that was
 * summoned THIS turn and is NOT a Greatmaw Creature (and not a card
 * with its own fresh-sacrifice rule), negate its effects so its
 * on-death / on-sacrifice triggers are suppressed. Runs via
 * `spec.onTributesChosen` — BEFORE the engine fires ON_CREATURE_SACRIFICED
 * / destroys the tributes — so the negation lands before the dying
 * Creature's hooks would fire.
 */
async function negateFreshTributes(engine, pi, picked) {
  if (!controlsActiveGreatmawSiren(engine, pi)) return;
  const gs = engine.gs;
  for (const t of (picked || [])) {
    const inst = t?.cardInstance;
    if (!inst) continue;
    if (inst.turnPlayed !== gs.turn) continue;             // only fresh tributes
    if (isGreatmawCreature(inst.name, engine)) continue;   // Greatmaw excepted
    const script = loadCardEffect(inst.name);
    if (script?.selfSacrificeableForGreatmaw) continue;    // not "sacrificed this way"
    try {
      await engine.actionNegateCreature(inst, SIREN_NAME, { selfInflicted: true });
    } catch (err) {
      // Defensive fallback — the tribute is about to be destroyed
      // anyway; a direct counter write still suppresses its hooks.
      inst.counters = inst.counters || {};
      inst.counters.negated = 1;
      console.error('[Greatmaw Siren] negateFreshTributes failed:', err.message);
    }
  }
}

/**
 * Build the `spec` object handed to `engine.resolveSacrificeCost` /
 * `engine.canSatisfySacrifice` by a Greatmaw Creature's activated
 * effect. `partial` overrides/extends (title, description, confirmLabel,
 * minCount/maxCount default to exactly 1).
 */
function buildGreatmawSacSpec(engine, pi, partial = {}) {
  return {
    minCount: 1,
    maxCount: 1,
    redSelect: true,
    filter: greatmawSacFilter(engine, pi),
    onTributesChosen: async (ctx, picked) => {
      await negateFreshTributes(engine, pi, picked);
    },
    ...partial,
  };
}

module.exports = {
  GREATMAW_ARCHETYPE,
  SIREN_NAME,
  REMORA_NAME,
  isGreatmawCreature,
  controlsNonRemoraGreatmaw,
  controlsActiveGreatmawSiren,
  greatmawSacFilter,
  negateFreshTributes,
  buildGreatmawSacSpec,
};
