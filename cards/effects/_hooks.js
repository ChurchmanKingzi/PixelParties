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
  // Fires whenever a card is taken from the OPPONENT's deck or
  // hand and added to the taker's hand (Infiltration, Charme Lv2,
  // future steal effects). One emit PER CARD so listeners that
  // scale "per stolen card" (Lilly, the Charming Infiltrator) just
  // count their hook fires. Context: { takerPi, fromZone, cardName }
  // — fromZone is 'deck' | 'hand' so listeners can discriminate
  // (e.g. a future card that only triggers on hand-rips).
  ON_CARD_TAKEN_FROM_OPP: 'onCardTakenFromOpponent',
  // Fires when a card moves from one player's hand into the opposite
  // player's hand (Crystal Well's swap, Letter of Misinformations
  // landing on opp). One emit per card so multi-card transfers fire
  // the listener N times. Context: { fromPi, toPi, cardName,
  // originalOwner, fromHandIdx, toHandIdx }. Mary Crestmas reads it
  // for her draw trigger; Letter of Misinformations reads it for its
  // self-trigger when it's the card being transferred.
  ON_CARD_TRANSFERRED_TO_OPP_HAND: 'onCardTransferredToOppHand',
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

  // ── Control changes ──
  ON_TAKE_CONTROL: 'onTakeControl',  // Fires when a player gains control of an opponent's target (Hero or Creature). Covers permanent transfers (Dark Gear, Diplomacy), temporary creature steals (Aligning Goals, Treacherous Crystal, Deepsea Succubus), Charme Lv3 hero steals, and Controlled Attack's hero-control mark. Context: { controllerPi, originalOwnerPi, targetType: 'hero'|'creature', targetName, targetInst?, targetHero?, heroIdx, kind: 'steal'|'transfer'|'charm'|'controlled' }

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
  // Coolness Stack — face-up player-owned pile created by Wowhalla.
  // Cards on the Stack can be searched, played from the top, or moved
  // back to hand by dedicated "Cool" effects.
  COOLNESS_STACK: 'coolnessStack',
};

// ═══════════════════════════════════════════
//  STATUS EFFECT REGISTRY
//  Categorizes status effects for cards like Beer.
//  Add new statuses here to auto-integrate.
// ═══════════════════════════════════════════
// Per-status optional metadata used by hero passives that need to
// categorise statuses generically (Karian's split-immunity is the
// reference consumer):
//   • paralysisLike — silences the bearer's actions / abilities until
//     it expires (frozen, stunned). Cards that "act despite paralysis"
//     filter on this flag instead of name-checking each status.
//   • dealsTickDamage + damageSourceName — the status applies a
//     periodic damage tick whose engine `actionDealDamage` source is
//     `{ name: damageSourceName }`. Cards that intercept "damage from
//     a negative status" (Karian's heal redirect, future similar
//     mirrors) read the source-name set without hard-coding 'Burn' /
//     'Poison'.
const STATUS_EFFECTS = {
  frozen:  { negative: true, cleansable: true,  label: 'Frozen',  icon: '❄️', immuneKey: 'freeze_immune', paralysisLike: true },
  stunned: { negative: true, cleansable: true,  label: 'Stunned', icon: '💫', immuneKey: 'stun_immune', paralysisLike: true },
  // `negated` is applied by effects like Dark Gear / Diplomacy / Necromancy
  // that take control of or silence a creature. It's NOT cleanseable —
  // Juice / Beer / Cure etc. should not undo the opponent's negation.
  negated: { negative: true, cleansable: false, label: 'Negated', icon: '⚡', immuneKey: 'negate_immune' },
  burned:  { negative: true, cleansable: true,  label: 'Burned',  icon: '🔥', immuneKey: 'burn_immune', dealsTickDamage: true, damageSourceName: 'Burn' },
  poisoned:{ negative: true, cleansable: true,  label: 'Poisoned', icon: '☠️', immuneKey: 'poison_immune', dealsTickDamage: true, damageSourceName: 'Poison' },
  // `nulled` is used by permanent silence effects (Null Zone, Shadow etc).
  // Same rationale as `negated` — shouldn't be cleanseable.
  nulled:  { negative: true, cleansable: false, label: 'Nulled',  icon: '🔇', immuneKey: 'null_immune' },
  // `bound` (Forbidden Zone, future restraint cards) prevents the hero
  // from performing Actions but does NOT silence their hero / ability /
  // creature effects — passive auras, ability triggers, and reactions
  // all keep firing. Distinct from Stunned which silences everything.
  // Cleansable like Stunned.
  bound:   { negative: true, cleansable: true,  label: 'Bound',   icon: '⛓️', immuneKey: 'bound_immune' },
  // `blinded` (Smoke Vial, future Blinded sources) prevents the bearer
  // from using Attacks, Spells, or activated effects that need to pick
  // one or more targets. AoE / area-wide effects keep working — the
  // engine reads `blocksTargeting: true` plus the card script's
  // `requiresTarget: true` flag to decide. Cleansable like Stunned.
  // Status icon is rendered as 👁 with a CSS strikethrough line.
  blinded: { negative: true, cleansable: true,  label: 'Blinded', icon: '👁️', immuneKey: 'blind_immune', blocksTargeting: true },
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

/** Negative statuses whose "silences the hero" gate fires. Karian's
 *  pretend-paralysed flow filters on this rather than name-checking
 *  frozen / stunned, so a future paralysis-like status only needs
 *  `paralysisLike: true` in its STATUS_EFFECTS entry to opt in. */
function getParalysisStatuses() {
  return Object.entries(STATUS_EFFECTS).filter(([, v]) => v.negative && v.paralysisLike).map(([k]) => k);
}

/** Negative statuses that block targeted Attacks / Spells / effects.
 *  Currently just `blinded`, but future "blind-like" statuses can opt
 *  in with `blocksTargeting: true` and the engine's targeting gates
 *  will pick them up automatically. */
function getTargetingBlockingStatuses() {
  return Object.entries(STATUS_EFFECTS).filter(([, v]) => v.negative && v.blocksTargeting).map(([k]) => k);
}

/** Engine `actionDealDamage` source-name strings for every status that
 *  ticks damage. Cards intercepting "damage from a negative status"
 *  (Karian's redirect-to-heal) consume this set so adding a new
 *  damaging status only requires `dealsTickDamage: true` +
 *  `damageSourceName: '<EngineSourceName>'` in STATUS_EFFECTS. */
function getStatusDamageSourceNames() {
  return Object.entries(STATUS_EFFECTS)
    .filter(([, v]) => v.negative && v.dealsTickDamage && v.damageSourceName)
    .map(([, v]) => v.damageSourceName);
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
  // Elixir of Cold — for the rest of this turn, anything this Hero hits
  // with an Attack or Spell becomes Frozen for 1 turn.
  cold_strike: { label: 'Cold Strike', icon: '❄️', tooltip: "This Hero's Attacks and Spells Freeze each target they hit for 1 turn. Wears off at the end of this turn." },
  // Elixir of Strength — primed +100 unstoppable damage on the Hero's
  // next single-target Attack. Persists across turns until consumed.
  empowered_strike: { label: 'Empowered Strike', icon: '💪', tooltip: "The next time this Hero hits exactly 1 target with an Attack, that Attack's damage is increased by 100 and cannot be reduced or negated." },
  // String of Fine — target takes 0 damage from any source for the
  // duration of the buff. `damageMultiplier: 0` is read by the
  // engine's standard buff-multiplier pass on hero & creature damage,
  // so any damage that goes through `actionDealDamage` is zeroed.
  // True damage (`actionDealTrueDamage` — Acid Vial, Rockfall, etc.)
  // bypasses this multiplier by design, matching the card text.
  damage_immune: { label: 'Damage Immune', icon: '💠', tooltip: 'Takes no damage from any sources.', damageMultiplier: 0 },
  // Disruption Ray — target takes DOUBLE damage from every source for
  // the duration of the buff. `damageMultiplier: 2` is read by the
  // engine's standard buff-multiplier pass on both hero & creature
  // damage (≥1 multipliers apply even through a `cannotBeReduced`
  // lock). True damage (`actionDealTrueDamage`) bypasses the
  // multiplier pass by design, same as Cloudy / Damage Immune.
  disrupted: { label: 'Disrupted', icon: '☢️', tooltip: 'Disrupted: Takes double damage from all sources.', damageMultiplier: 2 },
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
 * non-negative number. Regular Creatures have levels 0..5 (Lv0 is a real,
 * common category — Aggressive Town Guard, Pure Advantage Camel,
 * Stellin, all Slimes, all Guardian Beasts, the Spirits, etc.); only
 * Artifact-Creatures (Pollution Spewer and similar) have `level: null`.
 * Effects that need to scale / gate by level use this to exclude
 * truly level-less targets.
 *
 * Callers that scale a cost by `level` (e.g. Dark Gear's cost = level ×
 * BASE_COST) get a 0 cost for Lv0 Creatures, which is the intended
 * behaviour — stealing a Lv0 body is free.
 */
function hasNumericCreatureLevel(cd) {
  if (!cd) return false;
  return typeof cd.level === 'number' && cd.level >= 0;
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

/**
 * Resolve the live Creature CardInstance that a damage SOURCE
 * represents, or `null` when the source is a Hero (Spell/Attack) or no
 * matching live creature is on the board.
 *
 * Single source of truth for "retaliation/recoil should hit the
 * attacking Creature itself, not its host Hero" — shared by Fireshield,
 * Booby Trap, and any future retaliation card so the routing never
 * diverges again. Handles EVERY source shape the damage / surprise
 * pipelines produce:
 *   • a real CardInstance (legacy direct shape — has `.zone` / `.id`),
 *   • the `{ ..., cardInstance }` wrapper (creature-effect scripts and
 *     the engine surprise-window `sourceInfo`),
 *   • the MINIMAL `{ name, owner, heroIdx }` wrapper many generic
 *     creature-damage helpers pass (NO `.zone`, NO `.cardInstance`).
 * Card names are unique → exactly one card type, so the card DB tells
 * us whether `source.name` is a Creature; we then locate its live
 * support-zone instance (re-resolved by id so a stale snapshot never
 * lands the hit on the wrong target).
 */
function resolveSourceCreature(engine, source) {
  if (!source || !engine) return null;
  const cardDB = engine._getCardDB();
  const aliveSupport = (inst) => {
    if (!inst || inst.zone !== 'support') return null;
    const hp = inst.counters?.currentHp ?? cardDB[inst.name]?.hp ?? 0;
    return hp > 0 ? inst : null;
  };

  // AUTHORITATIVE type check. Card names are unique → exactly one card
  // type, so if we can name the source and it is NOT a Creature it's a
  // Hero-cast Spell/Attack (whose `cardInstance` is the SPELL's inst —
  // present but not a creature). Only the support-zone-hint fallback
  // applies when the name has no DB entry (rare tokens).
  const name = source.cardInstance?.name || source.name;
  const cd = name ? cardDB[name] : null;
  const looksCreature = cd
    ? hasCardType(cd, 'Creature')
    : (source.zone === 'support' || source.cardInstance?.zone === 'support');
  if (!looksCreature) return null;

  // 1. Resolve the live instance by id (cardInstance hint, or a direct
  //    support-zone instance) — re-resolved so a stale snapshot can't
  //    land the hit on a wrong/old target. Fall through on a miss: the
  //    id may be stale; a name match below still finds the live one.
  const hint = source.cardInstance
    || (source.zone === 'support' && source.id != null ? source : null);
  if (hint?.id != null) {
    const byId = engine.cardInstances.find(c => c.id === hint.id);
    const live = aliveSupport(byId)
      || (hint.zone === 'support' ? aliveSupport(hint) : null);
    if (live) return live;
  }

  // 2. Locate by name + owner + (host hero) among live support cards.
  const owner = source.owner ?? source.cardInstance?.owner;
  const hi = source.heroIdx ?? source.cardInstance?.heroIdx;
  for (const c of engine.cardInstances) {
    if (c.zone !== 'support' || c.name !== name) continue;
    if (owner != null && (c.controller ?? c.owner) !== owner) continue;
    if (hi != null && hi >= 0 && c.heroIdx !== hi) continue;
    const alive = aliveSupport(c);
    if (alive) return alive;
  }
  return null;
}

/**
 * True when a damage SOURCE originated from a Creature (any shape).
 * Pairs with `resolveSourceCreature`: a creature source whose instance
 * is already gone (`isCreatureSource` true, `resolveSourceCreature`
 * null) means "the attacking Creature is no longer a valid target" —
 * NOT "fall back to hitting a Hero".
 */
function isCreatureSource(engine, source) {
  if (!source) return false;
  // Type the source by its card name (unique → one card type). A
  // Hero-cast Spell/Attack carries a `cardInstance` too (the spell's
  // inst), so presence of `cardInstance` alone must NOT count as a
  // creature — only a Creature-typed name does.
  const name = source.cardInstance?.name || source.name;
  const cd = (name && engine) ? engine._getCardDB()[name] : null;
  if (cd) return hasCardType(cd, 'Creature');
  // Unknown name (rare token / no DB entry): a support-zone hint is
  // the only remaining creature signal.
  return source.zone === 'support' || source.cardInstance?.zone === 'support';
}

module.exports = {
  SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES,
  STATUS_EFFECTS, getNegativeStatuses, getCleansableStatuses,
  getParalysisStatuses, getTargetingBlockingStatuses, getStatusDamageSourceNames, BUFF_EFFECTS,
  hasCardType, isArtifactCreature, hasNumericCreatureLevel, isCreatureNegated,
  resolveSourceCreature, isCreatureSource,
  POISON_BASE_DAMAGE, BURN_BASE_DAMAGE,
};
