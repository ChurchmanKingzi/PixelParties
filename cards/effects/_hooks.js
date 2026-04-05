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
  BEFORE_PLAY:      'beforePlay',
  ON_PLAY:          'onPlay',
  ON_DISCARD:       'onDiscard',
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

  // ── Resources ──
  ON_RESOURCE_GAIN:  'onResourceGain',
  ON_RESOURCE_SPEND: 'onResourceSpend',

  // ── Level ──
  BEFORE_LEVEL_CHANGE: 'beforeLevelChange',
  AFTER_LEVEL_CHANGE:  'afterLevelChange',

  // ── Status ──
  ON_STATUS_APPLIED:  'onStatusApplied',
  ON_STATUS_REMOVED:  'onStatusRemoved',

  // ── Chain-specific ──
  ON_CHAIN_START:    'onChainStart',
  ON_CHAIN_RESOLVE:  'onChainResolve',
  ON_EFFECT_NEGATED: 'onEffectNegated',

  // ── Creature damage (batched) ──
  BEFORE_CREATURE_DAMAGE_BATCH: 'beforeCreatureDamageBatch',
  AFTER_CREATURE_DAMAGE_BATCH:  'afterCreatureDamageBatch',

  // ── Reaction chain ──
  ON_REACTION_ACTIVATED: 'onReactionActivated',  // Fires when a reaction card is added to the chain
  ON_CARD_ACTIVATION:    'onCardActivation',      // Fires before a card's effect resolves (for reaction window)
  AFTER_SPELL_RESOLVED:  'afterSpellResolved',    // Fires after a spell/attack's onPlay completes (for Bartas, etc.)

  // ── Actions ──
  ON_ACTION_USED:            'onActionUsed',            // Fires when any action is consumed (spell, creature, ability activation, etc.)
  ON_ADDITIONAL_ACTION_USED: 'onAdditionalActionUsed',  // Fires when an additional action is consumed (Necromancy summon, Slime Rancher, etc.)
};

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
  frozen:  { negative: true, label: 'Frozen',  icon: '❄️', immuneKey: 'freeze_immune' },
  stunned: { negative: true, label: 'Stunned', icon: '💫', immuneKey: 'stun_immune' },
  negated: { negative: true, label: 'Negated', icon: '⚡', immuneKey: 'negate_immune' },
  burned:  { negative: true, label: 'Burned',  icon: '🔥', immuneKey: 'burn_immune' },
  poisoned:{ negative: true, label: 'Poisoned', icon: '☠️', immuneKey: 'poison_immune' },
  immune:  { negative: false, label: 'Immune',  icon: '🛡️' },
  shielded:{ negative: false, label: 'Shielded', icon: '✨' },
};

function getNegativeStatuses() {
  return Object.entries(STATUS_EFFECTS).filter(([, v]) => v.negative).map(([k]) => k);
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
};

module.exports = { SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES, STATUS_EFFECTS, getNegativeStatuses, BUFF_EFFECTS };
