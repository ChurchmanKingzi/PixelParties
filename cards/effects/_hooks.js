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

  // ── Resources ──
  ON_RESOURCE_GAIN:  'onResourceGain',
  ON_RESOURCE_SPEND: 'onResourceSpend',

  // ── Status ──
  ON_STATUS_APPLIED:  'onStatusApplied',
  ON_STATUS_REMOVED:  'onStatusRemoved',

  // ── Chain-specific ──
  ON_CHAIN_START:    'onChainStart',
  ON_CHAIN_RESOLVE:  'onChainResolve',
  ON_EFFECT_NEGATED: 'onEffectNegated',
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
};

module.exports = { SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES };
