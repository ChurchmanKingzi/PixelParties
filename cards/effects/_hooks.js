// ═══════════════════════════════════════════
//  HOOK POINTS & SPEED LEVELS
//  Add new hooks freely — just fire them with
//  engine.runHooks('hookName', ctx) anywhere
//  in _engine.js or game logic.
// ═══════════════════════════════════════════

// Speed levels — determines what can chain onto what.
// A chain link's speed must be >= the link below it.
const SPEED = {
  NORMAL: 1,    // Regular plays, activated abilities. Can START a chain only.
  QUICK: 2,     // Quick effects, Surprise cards. Can chain onto Speed 1 or 2.
  COUNTER: 3,   // Counter effects. Can chain onto anything.
};

// Hook points (string-based — engine accepts ANY string, these are just for documentation).
const HOOKS = {
  // ── Game flow ──
  ON_BEFORE_HAND_DRAW: 'onBeforeHandDraw', // Fires before starting hands are drawn (Bill, etc.)
  ON_GAME_START:    'onGameStart',
  ON_TURN_START:    'onTurnStart',
  ON_TURN_END:      'onTurnEnd',
  ON_PHASE_START:   'onPhaseStart',
  ON_PHASE_END:     'onPhaseEnd',

  // ── Card movement ──
  BEFORE_DRAW:      'beforeDraw',
  ON_DRAW:          'onDraw',
  ON_CARD_ADDED_TO_HAND: 'onCardAddedToHand', // Fires when a card is added to a hand from the deck (tutor effects — Mass Multiplication, etc.). Complements ON_DRAW, which only fires for top-of-deck draws.
  ON_CARD_ADDED_FROM_DISCARD_TO_HAND: 'onCardAddedFromDiscardToHand', // Fires when a card is moved from a discard pile (either player's) into a hand. Distinct from ON_CARD_ADDED_TO_HAND so listeners (Bamboo Staff, Bamboo Shield reveal, …) can react specifically to "recovered from graveyard" without firing on deck-tutors.
  BEFORE_PLAY:      'beforePlay',
  ON_PLAY:          'onPlay',
  ON_DISCARD:       'onDiscard',
  ON_MILL:          'onMill',       // Fires when cards are milled from deck to discard (NOT onDiscard)
  ON_DELETE:        'onDelete',
  ON_CARD_ENTER_ZONE: 'onCardEnterZone',
  ON_CARD_LEAVE_ZONE: 'onCardLeaveZone',

  // ── Combat ──
  ON_ATTACK_DECLARE: 'onAttackDeclare',
  BEFORE_DAMAGE:     'beforeDamage',
  AFTER_DAMAGE:      'afterDamage',
  ON_HERO_KO:        'onHeroKO',
  ON_HERO_REVIVE:    'onHeroRevive',
  ON_CREATURE_DEATH: 'onCreatureDeath',
  // Fires specifically when a Creature is SACRIFICED — i.e. removed
  // from the board as a deliberate cost (resolveSacrificeCost), not
  // killed by damage. Sacrifices ALSO fire ON_CREATURE_DEATH normally
  // (destroyCard → onCreatureDeath); this hook layers ON TOP for cards
  // that need to distinguish "you chose to lose this Creature" from
  // any other death.
  ON_CREATURE_SACRIFICED: 'onCreatureSacrificed',

  // ── Resources ──
  ON_RESOURCE_GAIN:  'onResourceGain',
  ON_RESOURCE_SPEND: 'onResourceSpend',

  // ── Level ──
  BEFORE_LEVEL_CHANGE: 'beforeLevelChange',
  AFTER_LEVEL_CHANGE:  'afterLevelChange',

  // ── Status ──
  ON_STATUS_APPLIED:  'onStatusApplied',
  ON_STATUS_REMOVED:  'onStatusRemoved',
  BEFORE_HERO_EFFECT: 'beforeHeroEffect',  // buff add/remove, heal — cancellable

  // ── Chain-specific ──
  ON_CHAIN_START:    'onChainStart',
  ON_CHAIN_RESOLVE:  'onChainResolve',
  ON_EFFECT_NEGATED: 'onEffectNegated',

  // ── Creature damage (batched) ──
  BEFORE_CREATURE_DAMAGE_BATCH: 'beforeCreatureDamageBatch',
  BEFORE_CREATURE_AFFECTED: 'beforeCreatureAffected',
  AFTER_CREATURE_DAMAGE_BATCH:  'afterCreatureDamageBatch',
  AFTER_ALL_STATUS_DAMAGE:      'afterAllStatusDamage',

  // ── Reaction chain ──
  ON_REACTION_ACTIVATED: 'onReactionActivated',  // Fires when a reaction card is added to the chain
  ON_CARD_ACTIVATION:    'onCardActivation',      // Fires before a card's effect resolves (for reaction window)
  AFTER_SPELL_RESOLVED:  'afterSpellResolved',    // Fires after a spell/attack's onPlay completes (for Bartas, etc.)
  AFTER_POTION_USED:     'afterPotionUsed',       // Fires after a potion resolves; hookCtx.placed can be set to prevent deletion

  // ── Surprise system ──
  ON_HERO_TARGETED:      'onHeroTargeted',        // Fires after a hero is confirmed as a target (surprise window)
  ON_SURPRISE_ACTIVATED: 'onSurpriseActivated',   // Fires when a surprise card is flipped face-up

  // ── Actions ──
  ON_ACTION_USED:            'onActionUsed',            // Fires when any action is consumed (spell, creature, ability activation, etc.)
  ON_ADDITIONAL_ACTION_USED: 'onAdditionalActionUsed',  // Fires when an additional action is consumed (Necromancy summon, Slime Rancher, etc.)

  // ── Status damage modification ──
  MODIFY_POISON_DAMAGE: 'modifyPoisonDamage',  // Fires before each poison tick; hookCtx.amount can be modified

  // ── Batch draw modification ──
  BEFORE_DRAW_BATCH: 'beforeDrawBatch',  // Fires once before a batch of draws; hookCtx.amount can be modified or hookCtx.cancelled set

  // ── Ascension ──
  ON_ASCENSION: 'onAscension',  // Fires when a Hero ascends into an Ascended Hero (reaction window)

  // ── Archetype-specific (fired from cards/effects/_*-shared.js modules) ──
  ON_POLLUTION_TOKEN_REMOVED: 'onPollutionTokenRemoved',  // Fired by _pollution-shared when a Pollution Token leaves the board (Pollution Spewer, etc.)
};

// ── Status damage base values ──
const POISON_BASE_DAMAGE = 30;
const BURN_BASE_DAMAGE = 60;

// Phases (indices match the frontend phase tracker)
const PHASES = {
  START:    0,
  RESOURCE: 1,
  MAIN1:    2,
  ACTION:   3,
  MAIN2:    4,
  END:      5,
};

const PHASE_NAMES = ['START', 'RESOURCE', 'MAIN1', 'ACTION', 'MAIN2', 'END'];

// Zones where cards can exist
const ZONES = {
  HAND:     'hand',
  DECK:     'deck',
  POTION:   'potion',
  ABILITY:  'ability',
  SUPPORT:  'support',
  SURPRISE: 'surprise',
  AREA:     'area',
  DISCARD:  'discard',
  DELETED:  'deleted',
  HERO:     'hero',
  PERMANENT:'permanent',
};

// ═══════════════════════════════════════════
//  STATUS EFFECT REGISTRY
//  Categorizes status effects for cards like Beer.
//  Add new statuses here to auto-integrate.
// ═══════════════════════════════════════════
const STATUS_EFFECTS = {
  frozen:  { negative: true, cleansable: true,  label: 'Frozen',  icon: '❄️', immuneKey: 'freeze_immune' },
  stunned: { negative: true, cleansable: true,  label: 'Stunned', icon: '💫', immuneKey: 'stun_immune' },
  // `negated` is applied by effects like Dark Gear / Diplomacy / Necromancy
  // that take control of or silence a creature. It's NOT cleanseable —
  // Juice / Beer / Cure etc. should not undo the opponent's negation.
  negated: { negative: true, cleansable: false, label: 'Negated', icon: '⚡', immuneKey: 'negate_immune' },
  burned:  { negative: true, cleansable: true,  label: 'Burned',  icon: '🔥', immuneKey: 'burn_immune' },
  poisoned:{ negative: true, cleansable: true,  label: 'Poisoned', icon: '☠️', immuneKey: 'poison_immune' },
  // `nulled` is used by permanent silence effects (Null Zone, Shadow etc).
  // Same rationale as `negated` — shouldn't be cleanseable.
  nulled:  { negative: true, cleansable: false, label: 'Nulled',  icon: '🔇', immuneKey: 'null_immune' },
  // `bound` (Forbidden Zone, future restraint cards) prevents the hero
  // from performing Actions but does NOT silence their hero / ability /
  // creature effects — passive auras, ability triggers, and reactions
  // all keep firing. Distinct from Stunned which silences everything.
  // Cleansable like Stunned.
  bound:   { negative: true, cleansable: true,  label: 'Bound',   icon: '⛓️', immuneKey: 'bound_immune' },
  immune:  { negative: false, label: 'Immune',  icon: '🛡️' },
  shielded:{ negative: false, label: 'Shielded', icon: '✨' },
};

function getNegativeStatuses() {
  return Object.entries(STATUS_EFFECTS).filter(([, v]) => v.negative).map(([k]) => k);
}

/** Negative statuses that healing/cleanse cards (Juice, Beer, Cure, etc.)
 *  are allowed to remove. Excludes permanent lockouts like `negated` and
 *  `nulled` which represent the opponent having taken control / silenced
 *  the target — undoing those would break intended card balance. */
function getCleansableStatuses() {
  return Object.entries(STATUS_EFFECTS).filter(([, v]) => v.negative && v.cleansable !== false).map(([k]) => k);
}

// ═══════════════════════════════════════════
//  BUFF EFFECT REGISTRY
//  Positive effects displayed as buff icons.
//  Add new buffs here to auto-integrate with
//  the buff display column and damage modifiers.
// ═══════════════════════════════════════════
const BUFF_EFFECTS = {
  cloudy: { label: 'Cloudy', icon: '☁️', tooltip: 'Takes half damage from all sources!', damageMultiplier: 0.5 },
  submerged: { label: 'Submerged', icon: '🌊', tooltip: 'Unaffected by all cards and effects while other possible targets exist!' },
  negative_status_immune: { label: 'Cool', icon: '😎', tooltip: 'Immune to all negative status effects!' },
  medusa_petrified: { label: 'Petrified', icon: '🗿', tooltip: 'Takes 0 damage from all sources! (Medusa\'s Curse)', damageMultiplier: 0 },
  golden_wings: { label: 'Golden Wings', icon: '🪽', tooltip: 'Golden Wings: Fully immune to all opponent effects for the rest of this turn.' },
  anti_magic_enchanted: { label: 'Anti Magic Enchantment', icon: '🛡️', tooltip: 'Anti Magic Enchantment: Once per turn, the controlling player may negate the effects of a Spell that hits this Artifact\'s equipped Hero.' },
};

// ═══════════════════════════════════════════
//  CARD TYPE HELPER
//  Supports multi-type cards where cardType
//  is slash-delimited (e.g. "Creature/Token").
//  Use instead of raw cd.cardType === 'X' checks.
// ═══════════════════════════════════════════

/**
 * Check if a card has a specific type.
 * Handles single types ("Creature") and multi-types ("Creature/Token").
 * @param {object} cd - Card data object (from cards.json)
 * @param {string} type - Type to check for (e.g. 'Creature', 'Token', 'Artifact')
 * @returns {boolean}
 */
function hasCardType(cd, type) {
  if (!cd?.cardType) return false;
  if (cd.cardType === type) return true; // Fast path for single-type cards
  if (cd.cardType.split('/').some(t => t.trim() === type)) return true;
  // Also check subtype (e.g. Token with subtype 'Creature' counts as Creature)
  if (cd.subtype && cd.subtype.split('/').some(t => t.trim() === type)) return true;
  return false;
}

/**
 * "Artifact-Creature" hybrid: a card whose cardType is `Artifact` AND whose
 * subtype contains `Creature` (Pollution Spewer is the reference implementation).
 * Plays like an Artifact — pays gold, goes to a Support Zone during Main
 * Phase, no Action cost, no spell school / level / hero-state requirements.
 * Once on the board it functions as a Creature — has HP, takes creature
 * damage, dies when HP hits 0, targetable by effects that hit Creatures.
 *
 * Its level is intentionally `null`. Effects that scale off a Creature's
 * level (Dark Gear, etc.) should treat Artifact-Creatures as "level-less"
 * and exclude them from their target pool — use `hasNumericCreatureLevel`
 * below.
 */
function isArtifactCreature(cd) {
  if (!cd) return false;
  return cd.cardType === 'Artifact' && hasCardType(cd, 'Creature');
}

/**
 * A Creature has a "numeric level" when its `level` field is a finite,
 * positive number. Regular Creatures have levels 1..5; Artifact-Creatures
 * (Pollution Spewer) have `null`. Effects that need to scale / gate by
 * level use this to exclude level-less targets.
 */
function hasNumericCreatureLevel(cd) {
  if (!cd) return false;
  return typeof cd.level === 'number' && cd.level > 0;
}

/**
 * Whether a creature's effects are currently negated.
 * "Negated" (Dark Gear / Necromancy / Diplomacy) and "Nulled" (Null Zone)
 * are distinct status keys but both gate a creature's effects identically —
 * any code checking "can this creature's effects fire?" must treat them the
 * same. Centralize the OR here so new negation-like statuses can be added
 * in one place.
 */
function isCreatureNegated(inst) {
  const c = inst?.counters;
  return !!(c?.negated || c?.nulled);
}

module.exports = {
  SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES,
  STATUS_EFFECTS, getNegativeStatuses, getCleansableStatuses, BUFF_EFFECTS,
  hasCardType, isArtifactCreature, hasNumericCreatureLevel, isCreatureNegated,
  POISON_BASE_DAMAGE, BURN_BASE_DAMAGE,
};
