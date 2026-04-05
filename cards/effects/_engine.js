// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — CARD EFFECT ENGINE
//  Chain-based hook system with Yu-Gi-Oh-style chain resolution.
//  Each game gets one GameEngine instance. All card logic runs here.
// ═══════════════════════════════════════════════════════════════════

const { v4: uuidv4 } = require('uuid');
const { SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES, STATUS_EFFECTS, getNegativeStatuses, BUFF_EFFECTS } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const MAX_CHAIN_DEPTH = 10;   // Prevent infinite chain loops
const CHAIN_TIMEOUT_MS = 30000; // 30s to respond to chain prompt
const EFFECT_TIMEOUT_MS = 5000; // 5s max for a single effect to execute

// ═══════════════════════════════════════════
//  CARD INSTANCE
//  Wraps a card name with tracking metadata.
// ═══════════════════════════════════════════
class CardInstance {
  constructor(name, owner, zone, heroIdx = -1, zoneSlot = -1) {
    this.id = uuidv4().substring(0, 12);
    this.name = name;
    this.owner = owner;       // Player index (0 or 1)
    this.controller = owner;  // Can differ from owner (stolen cards)
    this.zone = zone;
    this.heroIdx = heroIdx;   // Which hero column (-1 = N/A)
    this.zoneSlot = zoneSlot; // Index within zone array
    this.faceDown = zone === ZONES.SURPRISE;
    this.statuses = {};       // { statusName: { duration, source, ... } }
    this.counters = {};       // { counterName: number }
    this.turnPlayed = 0;
    this.activatedThisChain = false; // Per-chain activation guard
    this.script = null;       // Loaded lazily
  }

  /** Load this card's effect script (cached via loader). */
  loadScript() {
    if (this.script === undefined || this.script === null) {
      this.script = loadCardEffect(this.name) || null;
    }
    return this.script;
  }

  /** Check if this card's hooks should fire in its current zone. */
  isActiveIn(zone) {
    const script = this.loadScript();
    if (!script) return false;
    if (!script.activeIn) return true; // No restriction = always active
    return script.activeIn.includes(zone || this.zone);
  }

  /** Get a specific hook function, or null. */
  getHook(hookName) {
    const script = this.loadScript();
    if (!script?.hooks) return null;
    return script.hooks[hookName] || null;
  }

  /** Get active effects (for chain building). */
  getEffects() {
    const script = this.loadScript();
    return script?.effects || {};
  }
}

// ═══════════════════════════════════════════
//  GAME ENGINE
// ═══════════════════════════════════════════
class GameEngine {
  /**
   * @param {object} room - The room object from server.js
   * @param {object} io - Socket.io server instance
   * @param {function} sendGameStateFn - Function to sync state to clients
   */
  constructor(room, io, sendGameStateFn, onGameOverFn, sendSpectatorGameStateFn) {
    this.room = room;
    this.io = io;
    this.sendGameState = sendGameStateFn;
    this.onGameOver = onGameOverFn || null;
    this.sendSpectatorGameState = sendSpectatorGameStateFn || null;
    this.gs = room.gameState;

    // Card instance tracking
    this.cardInstances = []; // All tracked CardInstance objects

    // Chain state
    this.chain = [];           // Current chain links
    this.chainDepth = 0;       // Nested chain counter
    this.pendingTriggers = []; // Triggers collected during resolution
    this.isResolving = false;  // True while a chain is resolving

    // Action log (sent to clients for animations/history)
    this.actionLog = [];
    this.eventId = 0; // Unique ID per event for trigger deduplication

    // Additional Actions registry — type ID → { label, actionType, filter(cardData) → bool }
    this._additionalActionTypes = {};

    // Socket listeners per player (for prompts)
    this._promptResolvers = {};
  }

  // ─── INITIALIZATION ───────────────────────

  /**
   * Initialize card instances from the current game state.
   * Call this once after game start.
   */
  init() {
    this.cardInstances = [];

    // ── SC reward tracking (per player) ──
    if (!this.gs._scTracking) {
      this.gs._scTracking = [
        { totalGoldEarned: 0, maxDamageInstance: 0, cardsPlayedFromHand: 0, creatureOverkill: false, heroEverBelow50: false, allAbilitiesFilled: false, allAbilitiesLevel3: false, allSupportFull: false, wasFirstToOneHero: false, totalHpLost: 0 },
        { totalGoldEarned: 0, maxDamageInstance: 0, cardsPlayedFromHand: 0, creatureOverkill: false, heroEverBelow50: false, allAbilitiesFilled: false, allAbilitiesLevel3: false, allSupportFull: false, wasFirstToOneHero: false, totalHpLost: 0 },
      ];
    }

    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];

      // Heroes
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (hero.name) {
          this._trackCard(hero.name, pi, ZONES.HERO, hi);
        }
      }

      // Abilities
      for (let hi = 0; hi < (ps.abilityZones || []).length; hi++) {
        for (let zi = 0; zi < (ps.abilityZones[hi] || []).length; zi++) {
          for (const cardName of (ps.abilityZones[hi][zi] || [])) {
            this._trackCard(cardName, pi, ZONES.ABILITY, hi, zi);
          }
        }
      }

      // Supports
      for (let hi = 0; hi < (ps.supportZones || []).length; hi++) {
        for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
          for (const cardName of (ps.supportZones[hi][zi] || [])) {
            this._trackCard(cardName, pi, ZONES.SUPPORT, hi, zi);
          }
        }
      }

      // Surprises
      for (let hi = 0; hi < (ps.surpriseZones || []).length; hi++) {
        for (const cardName of (ps.surpriseZones[hi] || [])) {
          this._trackCard(cardName, pi, ZONES.SURPRISE, hi);
        }
      }

      // Hand cards (hooks for "while in hand" effects)
      for (const cardName of (ps.hand || [])) {
        this._trackCard(cardName, pi, ZONES.HAND);
      }
    }

    return this;
  }

  /** Create and register a CardInstance. */
  _trackCard(name, owner, zone, heroIdx = -1, zoneSlot = -1) {
    const inst = new CardInstance(name, owner, zone, heroIdx, zoneSlot);
    inst.turnPlayed = this.gs.turn || 0;
    this.cardInstances.push(inst);
    return inst;
  }

  /** Remove a CardInstance from tracking. */
  _untrackCard(instanceId) {
    this.cardInstances = this.cardInstances.filter(c => c.id !== instanceId);
  }

  /** Find card instances by filters. */
  findCards(filter = {}) {
    return this.cardInstances.filter(c => {
      if (filter.owner !== undefined && c.owner !== filter.owner) return false;
      if (filter.controller !== undefined && c.controller !== filter.controller) return false;
      if (filter.zone && c.zone !== filter.zone) return false;
      if (filter.zones && !filter.zones.includes(c.zone)) return false;
      if (filter.heroIdx !== undefined && c.heroIdx !== filter.heroIdx) return false;
      if (filter.name && c.name !== filter.name) return false;
      if (filter.hasScript && !c.loadScript()) return false;
      return true;
    });
  }

  // ─── HOOK DISPATCH ────────────────────────

  /**
   * Run a hook across all active card instances.
   * Collects any triggered effects for post-chain processing.
   * @param {string} hookName - Hook to fire
   * @param {object} hookCtx - Context data for the hook
   * @returns {object} hookCtx (possibly modified by cards)
   */
  async runHooks(hookName, hookCtx = {}) {
    // Add engine reference and defaults to context
    hookCtx._engine = this;
    hookCtx._hookName = hookName;
    hookCtx.cancelled = hookCtx.cancelled || false;
    hookCtx.gameState = this.gs;

    // Gather all cards that have this hook AND are active in their current zone
    const listeners = this.cardInstances.filter(c => {
      // If _onlyCard is set, only that specific card fires this hook
      if (hookCtx._onlyCard && c.id !== hookCtx._onlyCard.id) return false;
      const hookFn = c.getHook(hookName);
      if (!hookFn) return false;
      if (!c.isActiveIn(c.zone)) return false;
      // Dead heroes and their abilities/supports don't fire hooks
      // Frozen/Stunned heroes' hero and ability effects are negated (but creature effects still work)
      // Negated heroes' hero + ability effects are silenced, but support/creature effects still work
      if ((c.zone === 'hero' || c.zone === 'ability' || c.zone === 'support') && c.heroIdx >= 0) {
        const hero = this.gs.players[c.controller ?? c.owner]?.heroes?.[c.heroIdx];
        if (!hero || !hero.name) return false; // Empty hero slot
        if (hero.hp <= 0) return false;
        if ((hero.statuses?.frozen || hero.statuses?.stunned) && (c.zone === 'hero' || c.zone === 'ability')) return false;
        if (hero.statuses?.negated && (c.zone === 'hero' || c.zone === 'ability')) return false;
      }
      // Creature-level negation (Dark Gear, Necromancy, Diplomacy, etc.)
      if (c.zone === 'support' && c.counters?.negated) return false;
      return true;
    });

    // Sort: turn player's cards first, then opponent's
    const activePlayer = this.gs.activePlayer || 0;
    listeners.sort((a, b) => {
      if (a.controller === activePlayer && b.controller !== activePlayer) return -1;
      if (a.controller !== activePlayer && b.controller === activePlayer) return 1;
      return 0;
    });

    // Execute each listener
    for (const card of listeners) {
      if (hookCtx.cancelled) break; // Allow early cancellation

      const hookFn = card.getHook(hookName);
      const ctx = this._createContext(card, hookCtx);

      try {
        await Promise.race([
          Promise.resolve(hookFn(ctx)),
          new Promise((_, rej) => {
            const check = () => {
              // Don't timeout while an interactive prompt is pending
              if (this._pendingGenericPrompt || this._pendingPrompt) {
                setTimeout(check, EFFECT_TIMEOUT_MS);
              } else {
                rej(new Error('Hook timeout'));
              }
            };
            setTimeout(check, EFFECT_TIMEOUT_MS);
          }),
        ]);
      } catch (err) {
        console.error(`[Engine] Hook "${hookName}" on card "${card.name}" (${card.id}) failed:`, err.message);
      }

      // If this hook created pending triggers, collect them
      if (ctx._triggers?.length) {
        this.pendingTriggers.push(...ctx._triggers);
      }
    }

    // After hooks resolve, check for reaction cards (unless suppressed)
    if (!this._inReactionCheck && !hookCtx._skipReactionCheck && !hookCtx._isReaction) {
      await this._checkReactionCards(hookName, hookCtx);
    }

    return hookCtx;
  }

  // ─── CONTEXT OBJECT ───────────────────────

  /**
   * Create the ctx object that card scripts interact with.
   * This is the ONLY interface card scripts have to the game.
   */
  _createContext(cardInstance, hookCtx) {
    const engine = this;
    const gs = this.gs;

    const ctx = {
      // Hook event data (spread first so card-specific props override)
      ...hookCtx,

      // ── Card-specific info (always refers to the card whose hook is firing) ──
      card: cardInstance,
      cardName: cardInstance.name,
      cardOwner: cardInstance.owner,
      cardController: cardInstance.controller,
      cardZone: cardInstance.zone,
      cardHeroIdx: cardInstance.heroIdx,
      attachedHero: cardInstance.heroIdx >= 0
        ? gs.players[cardInstance.controller]?.heroes?.[cardInstance.heroIdx] || null
        : null,

      // Game state reads
      phase: PHASE_NAMES[gs.currentPhase || 0],
      phaseIndex: gs.currentPhase || 0,
      turn: gs.turn || 0,
      activePlayer: gs.activePlayer || 0,
      isMyTurn: (gs.activePlayer || 0) === cardInstance.controller,
      players: gs.players,

      // Internal
      _triggers: [],
      _engine: engine,

      // ── Event modification (for "before" hooks) ──
      cancel() { hookCtx.cancelled = true; },
      modifyAmount(delta) {
        if (hookCtx.amount !== undefined) hookCtx.amount += delta;
      },
      setAmount(val) {
        if (hookCtx.amount !== undefined) hookCtx.amount = val;
      },
      negate() { hookCtx.negated = true; },
      /** Set a flag on the hookCtx (survives through all hooks → read by engine after) */
      setFlag(key, value) { hookCtx[key] = value; },

      // ── Game Actions (each fires its own hooks) ──
      async dealDamage(target, amount, type) {
        return engine.actionDealDamage(cardInstance, target, amount, type);
      },
      async healHero(target, amount) {
        return engine.actionHealHero(cardInstance, target, amount);
      },
      async reviveHero(playerIdx, heroIdx, hp, opts) {
        return engine.actionReviveHero(playerIdx, heroIdx, hp, opts);
      },
      increaseMaxHp(target, amount, opts) {
        return engine.increaseMaxHp(target, amount, opts);
      },
      decreaseMaxHp(target, amount) {
        return engine.decreaseMaxHp(target, amount);
      },
      async drawCards(playerIdx, count) {
        return engine.actionDrawCards(playerIdx, count);
      },
      async destroyCard(targetCard) {
        return engine.actionDestroyCard(cardInstance, targetCard);
      },
      async moveCard(targetCard, toZone, toHeroIdx, toSlot) {
        return engine.actionMoveCard(targetCard, toZone, toHeroIdx, toSlot);
      },
      async discardCards(playerIdx, count) {
        return engine.actionDiscardCards(playerIdx, count);
      },
      /**
       * Safely place a card into a support zone with zone-occupied fallback.
       * If occupied, auto-relocates to another free base zone on the same hero.
       * Returns { inst, actualSlot } or null (no free zones — caller handles fizzle).
       * Does NOT fire onPlay/onCardEnterZone — caller must do that.
       */
      safePlaceInSupport(cardName, playerIdx, heroIdx, zoneSlot) {
        return engine.safePlaceInSupport(cardName, playerIdx, heroIdx, zoneSlot);
      },
      async addStatus(target, statusName, opts) {
        return engine.actionAddStatus(target, statusName, opts);
      },
      async removeStatus(target, statusName) {
        return engine.actionRemoveStatus(target, statusName);
      },
      /** Add a buff to a hero. */
      async addBuff(hero, playerIdx, heroIdx, buffName, opts) {
        return engine.actionAddBuff(hero, playerIdx, heroIdx, buffName, opts);
      },
      /** Add a buff to a creature (card instance). */
      async addCreatureBuff(inst, buffName, opts) {
        return engine.actionAddCreatureBuff(inst, buffName, opts);
      },
      /** Remove a buff from a hero. */
      async removeBuff(hero, playerIdx, heroIdx, buffName, opts) {
        return engine.actionRemoveBuff(hero, playerIdx, heroIdx, buffName, opts);
      },
      /** Remove a buff from a creature (card instance). */
      async removeCreatureBuff(inst, buffName, opts) {
        return engine.actionRemoveCreatureBuff(inst, buffName, opts);
      },
      /**
       * Change a creature's level by delta. Fires BEFORE/AFTER_LEVEL_CHANGE hooks.
       * If no target specified, changes THIS card's level.
       * @param {number} delta - Amount to change (positive or negative)
       * @param {CardInstance} [target] - Target card (defaults to this card)
       */
      async changeLevel(delta, target) {
        return engine.actionChangeLevel(target || cardInstance, delta);
      },

      /**
       * Negate a creature's effects with automatic expiry.
       * @param {CardInstance} inst - The creature to negate
       * @param {string} source - Source name (e.g. 'Dark Gear', 'Necromancy')
       * @param {object} opts - { expiresAtTurn, expiresForPlayer, buffKey?, removeAnim? }
       */
      async negateCreature(inst, source, opts) {
        return engine.actionNegateCreature(inst, source, opts);
      },

      /**
       * Check if a creature has a specific immunity.
       * @param {CardInstance} inst - The creature to check
       * @param {string} immuneType - e.g. 'targeting_immune', 'control_immune'
       */
      isCreatureImmune(inst, immuneType) {
        return engine.isCreatureImmune(inst, immuneType);
      },

      /**
       * Grant ATK to this card's hero. Tracked on the card instance for auto-revocation.
       * @param {number} amount - ATK to add
       */
      grantAtk(amount) {
        const hero = gs.players[cardInstance.owner]?.heroes?.[cardInstance.heroIdx];
        if (hero) engine.actionGrantAtk(cardInstance, hero, cardInstance.owner, cardInstance.heroIdx, amount);
      },

      /**
       * Revoke ATK previously granted by this card instance.
       */
      revokeAtk() {
        const hero = gs.players[cardInstance.owner]?.heroes?.[cardInstance.heroIdx];
        if (hero) engine.actionRevokeAtk(cardInstance, hero, cardInstance.owner, cardInstance.heroIdx);
      },

      // ── Player input (async — pauses until client responds) ──
      async promptTarget(validTargets, config) {
        // Auto-filter: remove non-Creature support zone targets unless explicitly allowed
        let targets = validTargets;
        if (!config?.allowNonCreatureEquips) {
          const cardDB = engine._getCardDB();
          targets = validTargets.filter(t => {
            if (t.type !== 'equip') return true;
            const cd = cardDB[t.cardName];
            return cd && cd.cardType === 'Creature';
          });
          if (targets.length === 0 && validTargets.length > 0) targets = validTargets; // Fallback
        }
        const selectedIds = await engine.promptEffectTarget(cardInstance.controller, targets, config);

        // ── Target redirect check (Challenge, etc.) ──
        // Only for single-target selections with hero/creature targets
        if (selectedIds && selectedIds.length === 1 && !config?.cannotBeRedirected && !config?._skipRedirectCheck) {
          const selected = validTargets.find(t => t.id === selectedIds[0]);
          if (selected && selected.owner >= 0) {
            const redirected = await engine._checkTargetRedirect(
              selected.owner, selected, validTargets, config || {}, cardInstance
            );
            if (redirected) {
              return [redirected.id]; // Return the redirected target's ID
            }
          }
        }

        return selectedIds;
      },
      async chooseTarget(type, filter) {
        return engine.promptChooseTarget(cardInstance.controller, type, filter);
      },
      async chooseCards(zone, count, filter) {
        return engine.promptChooseCards(cardInstance.controller, zone, count, filter);
      },
      async chooseOption(options) {
        return engine.promptChooseOption(cardInstance.controller, options);
      },
      async confirm(message) {
        return engine.promptConfirm(cardInstance.controller, message);
      },

      // ── Hard Once Per Turn (HOPT) ──
      // Returns true if this is the first use of effectId this turn for this player.
      // Returns false if already used — the effect should fizzle.
      // Automatically marks as used when returning true.
      hardOncePerTurn(effectId) {
        return engine.claimHOPT(effectId, cardInstance.controller);
      },

      /**
       * Lock summons for the card's controller for the rest of this turn.
       * Prevents all creature summoning (hand play + effect placement).
       */
      lockSummons() {
        const ps = gs.players[cardInstance.controller];
        if (ps) ps.summonLocked = true;
        engine.sync();
      },

      /**
       * Check if the card's controller has summons locked this turn.
       */
      isSummonLocked() {
        return !!gs.players[cardInstance.controller]?.summonLocked;
      },

      /**
       * Register an additional action type (call once from card script init/play).
       */
      registerAdditionalActionType(typeId, config) {
        engine.registerAdditionalActionType(typeId, config);
      },

      /**
       * Grant an additional action from THIS card.
       * @param {string} typeId - The registered type ID
       */
      grantAdditionalAction(typeId) {
        engine.grantAdditionalAction(cardInstance, typeId);
      },

      /**
       * Expire THIS card's additional action.
       */
      expireAdditionalAction() {
        engine.expireAdditionalAction(cardInstance);
      },

      /**
       * Expire ALL additional actions of a type for this card's controller.
       */
      expireAllAdditionalActions(typeId) {
        engine.expireAllAdditionalActions(cardInstance.controller, typeId);
      },

      /**
       * Perform an immediate action with a specific hero (pseudo-Action-Phase).
       * Used by Coffee and future cards.
       * @param {number} heroIdx - Hero index
       * @param {object} config - { title, description }
       * @returns {{ played: boolean, cardName?, cardType? }}
       */
      async performImmediateAction(heroIdx, config) {
        return engine.performImmediateAction(cardInstance.controller, heroIdx, config);
      },

      /** Gain gold for the card's controller. Plays animation. */
      async gainGold(amount) {
        await engine.actionGainGold(cardInstance.controller, amount);
      },

      /** Get the hero name for this card's hero. */
      heroName() {
        const ps = gs.players[cardInstance.owner];
        return ps?.heroes?.[cardInstance.heroIdx]?.name || 'Unknown Hero';
      },

      /** Log an engine event. */
      log(event, data) {
        engine.log(event, data);
      },

      // ── General-purpose prompts (async — pauses game) ──

      /**
       * Show a yes/no confirmation dialog. Returns true if confirmed, false if declined.
       * @param {object} config - { title, message }
       */
      async promptConfirmEffect(config) {
        const result = await engine.promptGeneric(cardInstance.controller, {
          type: 'confirm', title: config.title || cardInstance.name, message: config.message,
        });
        return result?.confirmed === true;
      },

      /**
       * Show a card gallery picker. Returns { cardName, source } or null if cancelled.
       * @param {Array} cards - [{ name, source ('hand'|'deck'), ...extraDisplayData }]
       * @param {object} config - { title, description, cancellable }
       */
      async promptCardGallery(cards, config = {}) {
        return engine.promptGeneric(cardInstance.controller, {
          type: 'cardGallery', cards,
          title: config.title || cardInstance.name,
          description: config.description || 'Select a card.',
          cancellable: config.cancellable !== false,
        });
      },

      /**
       * Show a multi-select card gallery picker. Returns { selectedCards: string[] } or null if cancelled.
       * @param {Array} cards - [{ name, source?, cost?, ...extraDisplayData }]
       * @param {object} config - { title, description, cancellable, selectCount, minSelect, maxBudget, costKey, confirmLabel, confirmClass }
       */
      async promptCardGalleryMulti(cards, config = {}) {
        return engine.promptGeneric(cardInstance.controller, {
          type: 'cardGalleryMulti', cards,
          title: config.title || cardInstance.name,
          description: config.description || 'Select cards.',
          cancellable: config.cancellable !== false,
          selectCount: config.selectCount || 2,
          minSelect: config.minSelect,
          maxBudget: config.maxBudget,
          costKey: config.costKey || 'cost',
          confirmLabel: config.confirmLabel,
          confirmClass: config.confirmClass,
        });
      },

      /**
       * Show a zone picker (highlights zones on the board). Returns { heroIdx, slotIdx } or null if cancelled.
       * @param {Array} zones - [{ heroIdx, slotIdx, label }]
       * @param {object} config - { title, description, cancellable }
       */
      async promptZonePick(zones, config = {}) {
        return engine.promptGeneric(cardInstance.controller, {
          type: 'zonePick', zones,
          title: config.title || cardInstance.name,
          description: config.description || 'Select a zone.',
          cancellable: config.cancellable !== false,
        });
      },

      /**
       * Show a status effect selection prompt (for Beer, etc.)
       * @param {string} targetName - Name of the target (hero/creature)
       * @param {Array} statuses - [{key, label, icon}] of removable statuses
       * @param {object} config - { title, description, cancellable, confirmLabel }
       * @returns {Promise<{selectedStatuses: string[]}|null>}
       */
      async promptStatusSelect(targetName, statuses, config = {}) {
        return engine.promptGeneric(cardInstance.controller, {
          type: 'statusSelect',
          targetName,
          statuses,
          title: config.title || cardInstance.name,
          description: config.description || `Choose status effects to remove from ${targetName}.`,
          confirmLabel: config.confirmLabel || 'Confirm',
          cancellable: config.cancellable !== false,
        });
      },

      /**
       * Generic Attack execution handler. Handles target selection, ATK-based
       * damage calculation, animation, and damage dealing with type 'attack'.
       * Equipment hooks (Sun Sword burn, Sacred Hammer bonus) fire automatically.
       * Returns { target, damage, hero, heroIdx } or null if cancelled.
       *
       * @param {object} config - {
       *   title: string, description: string, confirmLabel: string, confirmClass: string,
       *   animationType: string (zone animation to play on target),
       *   animDuration: number (ms to wait for animation, default 400),
       *   side: 'any'|'enemy'|'my' (default 'any'),
       *   types: ['hero','creature'] (default both),
       *   excludeSelf: boolean (exclude the attacking hero, default true),
       *   condition: (target, engine) => bool (optional extra filter),
       *   damageMultiplier: number (multiply hero.atk, default 1),
       *   flatDamage: number (add to damage, default 0),
       * }
       */
      async executeAttack(config = {}) {
        const pi = cardInstance.controller;
        const heroIdx = cardInstance.heroIdx;
        const hero = gs.players[pi]?.heroes?.[heroIdx];
        if (!hero || hero.hp <= 0) return null;

        const atkDamage = Math.max(0, Math.floor((hero.atk || 0) * (config.damageMultiplier || 1)) + (config.flatDamage || 0));

        // Build condition that excludes self if requested
        const baseCondition = config.condition;
        const excludeSelf = config.excludeSelf !== false;
        const combinedCondition = excludeSelf
          ? (t, eng) => {
              if (t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx) return false;
              return baseCondition ? baseCondition(t, eng) : true;
            }
          : baseCondition;

        // Prompt for target
        const target = await ctx.promptDamageTarget({
          side: config.side || 'any',
          types: config.types || ['hero', 'creature'],
          damageType: 'attack',
          title: config.title || cardInstance.name,
          description: config.description || `Deal ${atkDamage} damage.`,
          confirmLabel: config.confirmLabel || `⚔️ Attack! (${atkDamage})`,
          confirmClass: config.confirmClass || 'btn-danger',
          cancellable: config.cancellable !== false,
          condition: combinedCondition,
        });

        if (!target) return null; // Cancelled

        // Play animation on target
        if (config.animationType) {
          if (target.type === 'hero') {
            engine._broadcastEvent('play_zone_animation', {
              type: config.animationType, owner: target.owner,
              heroIdx: target.heroIdx, zoneSlot: -1,
            });
          } else {
            engine._broadcastEvent('play_zone_animation', {
              type: config.animationType, owner: target.owner,
              heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
            });
          }
          await engine._delay(config.animDuration || 400);
        }

        // Deal ATK-based damage with type 'attack'
        const attackSource = { name: cardInstance.name, owner: pi, heroIdx, controller: pi };
        let dealt = 0;

        if (target.type === 'hero') {
          const targetHero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (targetHero && targetHero.hp > 0) {
            const result = await engine.actionDealDamage(attackSource, targetHero, atkDamage, 'attack');
            dealt = result?.dealt || 0;
          }
        } else if (target.type === 'equip') {
          const inst = target.cardInstance || engine.cardInstances.find(c =>
            c.owner === target.owner && c.zone === 'support' &&
            c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
          );
          if (inst) {
            await engine.actionDealCreatureDamage(
              attackSource, inst, atkDamage, 'attack',
              { sourceOwner: pi, canBeNegated: true },
            );
            dealt = atkDamage; // Creature damage doesn't return dealt amount
          }
        }

        engine.sync();
        return { target, damage: dealt || atkDamage, hero, heroIdx, atkDamage };
      },

      // ── Queries ──
      getCards(filter) {
        return engine.findCards(typeof filter === 'string' ? engine._parseFilterShorthand(filter, cardInstance) : filter);
      },
      getHero(playerIdx, heroIdx) {
        return gs.players[playerIdx]?.heroes?.[heroIdx] || null;
      },
      getMyHeroes() {
        return gs.players[cardInstance.controller]?.heroes || [];
      },
      getEnemyHeroes() {
        const oppIdx = cardInstance.controller === 0 ? 1 : 0;
        return gs.players[oppIdx]?.heroes || [];
      },

      // ── Generic Damage Target Picker ──
      /**
       * Prompt the player to select a target for dealing damage.
       * Builds valid targets based on config, then opens the targeting UI.
       * @param {object} config - {
       *   side: 'enemy'|'my'|'any',
       *   types: ['hero','creature'] (default both),
       *   condition: (target) => bool (optional filter),
       *   damageType: string (e.g. 'destruction_spell', 'attack', 'creature', 'status', 'artifact', 'other'),
       *   title, description, confirmLabel, confirmClass, cancellable
       * }
       * @returns {object|null} { id, type, owner, heroIdx, slotIdx?, cardName } or null
       */
      async promptDamageTarget(config = {}) {
        const pi = cardInstance.controller;
        const oppIdx = pi === 0 ? 1 : 0;
        const targets = [];
        const side = config.side || 'any';
        const types = config.types || ['hero', 'creature'];

        const addHeroes = (playerIdx) => {
          const ps2 = gs.players[playerIdx];
          for (let hi = 0; hi < (ps2.heroes || []).length; hi++) {
            const hero = ps2.heroes[hi];
            if (!hero?.name || hero.hp <= 0) continue;
            // Note: shielded/protected heroes ARE still selectable as targets.
            // The actual damage/status block is handled by actionDealDamage / addHeroStatus.
            const t = { id: `hero-${playerIdx}-${hi}`, type: 'hero', owner: playerIdx, heroIdx: hi, cardName: hero.name };
            if (config.condition && !config.condition(t, engine)) continue;
            targets.push(t);
          }
        };

        const addCreatures = (playerIdx) => {
          const ps2 = gs.players[playerIdx];
          const cardDB = engine._getCardDB();
          for (let hi = 0; hi < (ps2.heroes || []).length; hi++) {
            if (!ps2.heroes[hi]?.name || ps2.heroes[hi].hp <= 0) continue;
            for (let si = 0; si < (ps2.supportZones[hi] || []).length; si++) {
              const slot = (ps2.supportZones[hi] || [])[si] || [];
              if (slot.length === 0) continue;
              const creatureName = slot[0];
              // Only actual Creatures are targetable — not Equipment, Heroes, etc.
              const cd = cardDB[creatureName];
              if (!cd || cd.cardType !== 'Creature') continue;
              const inst = engine.cardInstances.find(c =>
                c.owner === playerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
              );
              const t = { id: `equip-${playerIdx}-${hi}-${si}`, type: 'equip', owner: playerIdx, heroIdx: hi, slotIdx: si, cardName: creatureName, cardInstance: inst };
              if (config.condition && !config.condition(t, engine)) continue;
              targets.push(t);
            }
          }
        };

        if (types.includes('hero')) {
          if (side === 'enemy' || side === 'any') addHeroes(oppIdx);
          if (side === 'my' || side === 'any') addHeroes(pi);
        }
        if (types.includes('creature')) {
          if (side === 'enemy' || side === 'any') addCreatures(oppIdx);
          if (side === 'my' || side === 'any') addCreatures(pi);
        }

        if (targets.length === 0) return null;

        // Filter out excluded targets (Bartas second-cast, etc.)
        const excludeIds = gs._spellExcludeTargets || [];
        const filteredTargets = excludeIds.length > 0 ? targets.filter(t => !excludeIds.includes(t.id)) : targets;
        if (filteredTargets.length === 0) return null;

        const selectedIds = await engine.promptEffectTarget(cardInstance.controller, filteredTargets, {
          title: config.title || cardInstance.name,
          description: config.description || 'Select a target.',
          confirmLabel: config.confirmLabel || 'Attack!',
          confirmClass: config.confirmClass || 'btn-danger',
          cancellable: config.cancellable !== false,
          exclusiveTypes: true,
          maxPerType: { hero: 1, equip: 1 },
        });

        if (!selectedIds || selectedIds.length === 0) {
          // Mark spell as cancelled so the handler can return the card to hand
          gs._spellCancelled = true;
          return null;
        }
        const selected = filteredTargets.find(t => t.id === selectedIds[0]) || null;
        // Spell target tracking (for Bartas, etc.) — records at selection time,
        // not damage time, so protected/shielded targets still count as "hit"
        if (selected && gs._spellDamageLog) {
          gs._spellDamageLog.push({ ...selected });
        }

        // ── Target redirect check (Challenge, etc.) ──
        // After target is selected, check if the target's owner has a redirect card.
        // Skipped if config explicitly disables redirection.
        if (selected && !config.cannotBeRedirected && !config._skipRedirectCheck) {
          // Determine target's owner
          const tgtOwner = selected.owner;
          if (tgtOwner >= 0) {
            const redirected = await engine._checkTargetRedirect(
              tgtOwner, selected, filteredTargets, config, cardInstance
            );
            if (redirected) {
              // Update the spell damage log to reflect the new target
              if (gs._spellDamageLog && gs._spellDamageLog.length > 0) {
                gs._spellDamageLog[gs._spellDamageLog.length - 1] = { ...redirected };
              }
              return redirected;
            }
          }
        }

        return selected;
      },

      /**
       * Prompt for multiple targets at once using a single selection UI.
       * Returns an array of target objects, or empty array if cancelled.
       * @param {object} config - {
       *   side: 'enemy'|'my'|'any',
       *   types: ['hero','creature'],
       *   min: number (minimum targets required, default 1),
       *   max: number (maximum targets allowed),
       *   title, description, confirmLabel, confirmClass, cancellable,
       *   condition: (target, engine) => bool
       * }
       * @returns {Array} selected target objects
       */
      async promptMultiTarget(config = {}) {
        const pi = cardInstance.controller;
        const oppIdx = pi === 0 ? 1 : 0;
        const targets = [];
        const side = config.side || 'any';
        const types = config.types || ['hero', 'creature'];

        const addHeroes = (playerIdx) => {
          const ps2 = gs.players[playerIdx];
          for (let hi = 0; hi < (ps2.heroes || []).length; hi++) {
            const hero = ps2.heroes[hi];
            if (!hero?.name || hero.hp <= 0) continue;
            const t = { id: `hero-${playerIdx}-${hi}`, type: 'hero', owner: playerIdx, heroIdx: hi, cardName: hero.name };
            if (config.condition && !config.condition(t, engine)) continue;
            targets.push(t);
          }
        };
        const addCreatures = (playerIdx) => {
          const ps2 = gs.players[playerIdx];
          for (let hi = 0; hi < (ps2.heroes || []).length; hi++) {
            if (!ps2.heroes[hi]?.name || ps2.heroes[hi].hp <= 0) continue;
            for (let si = 0; si < (ps2.supportZones[hi] || []).length; si++) {
              const slot = (ps2.supportZones[hi] || [])[si] || [];
              if (slot.length === 0) continue;
              const inst2 = engine.cardInstances.find(c =>
                c.owner === playerIdx && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
              );
              const t = { id: `equip-${playerIdx}-${hi}-${si}`, type: 'equip', owner: playerIdx, heroIdx: hi, slotIdx: si, cardName: slot[0], cardInstance: inst2 };
              if (config.condition && !config.condition(t, engine)) continue;
              targets.push(t);
            }
          }
        };

        if (types.includes('hero')) {
          if (side === 'enemy' || side === 'any') addHeroes(oppIdx);
          if (side === 'my' || side === 'any') addHeroes(pi);
        }
        if (types.includes('creature')) {
          if (side === 'enemy' || side === 'any') addCreatures(oppIdx);
          if (side === 'my' || side === 'any') addCreatures(pi);
        }

        if (targets.length === 0) return [];

        const max = Math.min(config.max || targets.length, targets.length);
        const min = config.min || 1;

        const selectedIds = await engine.promptEffectTarget(pi, targets, {
          title: config.title || cardInstance.name,
          description: config.description || 'Select targets.',
          confirmLabel: config.confirmLabel || 'Confirm',
          confirmClass: config.confirmClass || 'btn-danger',
          cancellable: config.cancellable !== false,
          maxTotal: max,
          minRequired: min,
        });

        if (!selectedIds || selectedIds.length === 0) {
          if (config.cancellable !== false) gs._spellCancelled = true;
          return [];
        }

        // Map IDs to target objects and record for spell tracking
        const result = selectedIds.map(id => targets.find(t => t.id === id)).filter(Boolean);
        if (gs._spellDamageLog) {
          for (const t of result) gs._spellDamageLog.push({ ...t });
        }
        return result;
      },
    };
    return ctx;
  }

  /** Parse shorthand filter strings like "enemySupports", "myHand", etc. */
  _parseFilterShorthand(shorthand, card) {
    const oppIdx = card.controller === 0 ? 1 : 0;
    switch (shorthand) {
      case 'mySupports':    return { controller: card.controller, zone: ZONES.SUPPORT };
      case 'enemySupports': return { controller: oppIdx, zone: ZONES.SUPPORT };
      case 'myAbilities':   return { controller: card.controller, zone: ZONES.ABILITY };
      case 'enemyAbilities':return { controller: oppIdx, zone: ZONES.ABILITY };
      case 'myHand':        return { controller: card.controller, zone: ZONES.HAND };
      case 'enemyHand':     return { controller: oppIdx, zone: ZONES.HAND };
      case 'mySurprises':   return { controller: card.controller, zone: ZONES.SURPRISE };
      case 'enemySurprises':return { controller: oppIdx, zone: ZONES.SURPRISE };
      default: return {};
    }
  }

  // ─── CHAIN SYSTEM ─────────────────────────

  /**
   * Start a new chain with an initial link.
   * @param {object} initialLink - { card, effectKey, controller, targets, speed }
   */
  async startChain(initialLink) {
    if (this.chainDepth >= MAX_CHAIN_DEPTH) {
      console.warn('[Engine] Max chain depth reached — chain aborted.');
      return;
    }

    this.chainDepth++;
    this.chain = [initialLink];
    this.pendingTriggers = [];

    // Reset per-chain activation guards
    for (const c of this.cardInstances) c.activatedThisChain = false;
    if (initialLink.card) initialLink.card.activatedThisChain = true;

    // Notify clients chain started
    await this.runHooks(HOOKS.ON_CHAIN_START, { chain: this.chain });
    this._broadcastChainState();

    // Build phase — alternate priority
    await this._buildChain(initialLink.controller);

    // Resolve phase — reverse order
    await this._resolveChain();

    // Process pending triggers → may start new chains
    await this._processPendingTriggers();

    this.chainDepth--;
  }

  /**
   * Build phase: alternate asking players to chain or pass.
   * Chain building ends when both players pass consecutively.
   */
  async _buildChain(initiatorIdx) {
    let priorityPlayer = initiatorIdx === 0 ? 1 : 0; // Opponent gets first response
    let passCount = 0;

    while (passCount < 2) {
      const topLink = this.chain[this.chain.length - 1];
      const legalResponses = this._findLegalChainResponses(priorityPlayer, topLink.speed);

      if (legalResponses.length === 0) {
        // No legal responses — auto-pass
        passCount++;
        priorityPlayer = priorityPlayer === 0 ? 1 : 0;
        continue;
      }

      // Ask the player
      const response = await this._askChainResponse(priorityPlayer, legalResponses);

      if (!response || response.action === 'pass') {
        passCount++;
      } else {
        // Player is chaining
        const link = {
          card: response.cardInstance,
          effectKey: response.effectKey,
          controller: priorityPlayer,
          targets: response.targets || null,
          speed: response.speed,
          resolve: response.resolveFn,
        };
        this.chain.push(link);

        if (response.cardInstance) response.cardInstance.activatedThisChain = true;

        this._broadcastChainState();
        passCount = 0; // Reset — other player gets to respond
      }

      priorityPlayer = priorityPlayer === 0 ? 1 : 0;
    }
  }

  /**
   * Find all legal chain responses for a player.
   */
  _findLegalChainResponses(playerIdx, currentSpeed) {
    const responses = [];
    const minSpeed = currentSpeed || SPEED.NORMAL;

    for (const card of this.cardInstances) {
      if (card.controller !== playerIdx) continue;
      if (card.activatedThisChain) continue;
      if (!card.isActiveIn(card.zone)) continue;

      const effects = card.getEffects();
      for (const [key, effect] of Object.entries(effects)) {
        if ((effect.speed || SPEED.NORMAL) < minSpeed) continue;

        // Check activation condition
        try {
          const canCtx = this._createContext(card, { chain: this.chain, event: 'chainResponse' });
          if (effect.canActivate && !effect.canActivate(canCtx)) continue;
        } catch (err) {
          console.error(`[Engine] canActivate check failed for "${card.name}":`, err.message);
          continue;
        }

        responses.push({
          cardInstance: card,
          cardName: card.name,
          cardId: card.id,
          effectKey: key,
          speed: effect.speed || SPEED.NORMAL,
          resolveFn: effect.resolve,
          zone: card.zone,
          heroIdx: card.heroIdx,
        });
      }
    }

    return responses;
  }

  /**
   * Ask a player for their chain response via socket.
   * Returns their choice or { action: 'pass' } on timeout.
   */
  async _askChainResponse(playerIdx, legalResponses) {
    const ps = this.gs.players[playerIdx];
    if (!ps?.socketId) return { action: 'pass' };

    // Send available responses to the client (stripped of functions)
    const clientResponses = legalResponses.map(r => ({
      cardName: r.cardName,
      cardId: r.cardId,
      effectKey: r.effectKey,
      speed: r.speed,
      zone: r.zone,
      heroIdx: r.heroIdx,
    }));

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        this.io.to(ps.socketId).emit('chain_timeout');
        resolve({ action: 'pass' });
      }, CHAIN_TIMEOUT_MS);

      this.io.to(ps.socketId).emit('chain_prompt', {
        chain: this.chain.map(l => ({
          cardName: l.card?.name || '?',
          controller: l.controller,
          speed: l.speed,
        })),
        legalResponses: clientResponses,
        timeout: CHAIN_TIMEOUT_MS,
      });

      // Listen for response (one-time)
      const socket = this._getSocket(ps.socketId);
      if (!socket) { clearTimeout(timeoutHandle); resolve({ action: 'pass' }); return; }

      const handler = (data) => {
        clearTimeout(timeoutHandle);
        if (data.action === 'pass') {
          resolve({ action: 'pass' });
        } else if (data.action === 'chain') {
          // Validate the response
          const match = legalResponses.find(r => r.cardId === data.cardId && r.effectKey === data.effectKey);
          if (!match) {
            resolve({ action: 'pass' }); // Invalid → auto-pass
          } else {
            resolve({
              action: 'chain',
              cardInstance: match.cardInstance,
              effectKey: match.effectKey,
              speed: match.speed,
              targets: data.targets,
              resolveFn: match.resolveFn,
            });
          }
        } else {
          resolve({ action: 'pass' });
        }
      };

      socket.once('chain_response', handler);
    });
  }

  /**
   * Resolve the chain in reverse order (LIFO).
   */
  async _resolveChain() {
    this.isResolving = true;

    while (this.chain.length > 0) {
      const link = this.chain.pop();

      // Notify clients which link is resolving
      this._broadcastEvent('chain_resolving', {
        cardName: link.card?.name || '?',
        controller: link.controller,
        chainRemaining: this.chain.length,
      });

      // Check if this link was negated by a later link
      if (link.negated) {
        this.log('effect_negated', { card: link.card?.name, controller: link.controller });
        await this.runHooks(HOOKS.ON_EFFECT_NEGATED, { negatedCard: link.card, link });
        continue;
      }

      // Execute the effect
      if (link.resolve) {
        const ctx = this._createContext(link.card || new CardInstance('System', link.controller, 'none'), {
          chain: this.chain,
          link,
          targets: link.targets,
        });

        try {
          await Promise.race([
            Promise.resolve(link.resolve(ctx)),
            new Promise((_, rej) => setTimeout(() => rej(new Error('Effect timeout')), EFFECT_TIMEOUT_MS)),
          ]);
        } catch (err) {
          console.error(`[Engine] Effect resolve failed for "${link.card?.name}":`, err.message);
        }
      }
    }

    this.isResolving = false;
    await this.runHooks(HOOKS.ON_CHAIN_RESOLVE, {});
  }

  /**
   * After chain resolution, process any triggers that fired during it.
   * Turn player's mandatory triggers first, then opponent's.
   * Each batch forms a new chain.
   */
  async _processPendingTriggers() {
    if (this.pendingTriggers.length === 0) return;

    // Sort: active player's triggers first
    const activePlayer = this.gs.activePlayer || 0;
    const sorted = [...this.pendingTriggers].sort((a, b) => {
      if (a.controller === activePlayer && b.controller !== activePlayer) return -1;
      if (a.controller !== activePlayer && b.controller === activePlayer) return 1;
      return 0;
    });

    this.pendingTriggers = [];

    // First trigger starts a new chain, rest are added automatically
    for (const trigger of sorted) {
      await this.startChain(trigger);
    }
  }

  // ─── GAME ACTIONS ─────────────────────────
  // Each action fires before/after hooks and logs itself.

  async actionDealDamage(source, target, amount, type) {
    const hookCtx = { source, target, amount, type: type || 'normal', sourceHeroIdx: source?.heroIdx ?? -1, cancelled: false };
    await this.runHooks(HOOKS.BEFORE_DAMAGE, hookCtx);
    if (hookCtx.cancelled) return { dealt: 0, cancelled: true };

    // Apply buff damage modifiers (Cloudy, etc.) — skipped for un-reducible damage (Ida)
    if (!hookCtx.cannotBeNegated && target?.buffs) {
      for (const [, buffData] of Object.entries(target.buffs)) {
        if (buffData.damageMultiplier != null) {
          hookCtx.amount = Math.ceil(hookCtx.amount * buffData.damageMultiplier);
        }
      }
    }

    // Shielded heroes (first-turn protection) are immune to ALL damage
    if (this.gs.firstTurnProtectedPlayer != null && target && target.hp !== undefined) {
      const protectedIdx = this.gs.firstTurnProtectedPlayer;
      const ps = this.gs.players[protectedIdx];
      if (ps && (ps.heroes || []).includes(target)) {
        this.log('damage_blocked', { target: this._heroLabel(target), reason: 'shielded' });
        return { dealt: 0, cancelled: true };
      }
    }

    // Submerged heroes: immune to all damage while owner has other alive non-submerged heroes
    if (target?.buffs?.submerged && target.hp !== undefined) {
      const ownerIdx = this._findHeroOwner(target);
      if (ownerIdx >= 0) {
        const ps = this.gs.players[ownerIdx];
        const otherAlive = (ps.heroes || []).some(h => h !== target && h.name && h.hp > 0 && !h.buffs?.submerged);
        if (otherAlive) {
          this.log('damage_blocked', { target: this._heroLabel(target), reason: 'submerged' });
          return { dealt: 0, cancelled: true };
        }
      }
    }

    // Flame Avalanche lock: if source player's damageLocked is true,
    // ALL damage to opponent's targets becomes 0 (ABSOLUTE — overrides everything)
    const srcOwner = source?.owner ?? source?.controller ?? -1;
    if (srcOwner >= 0 && this.gs.players[srcOwner]?.damageLocked) {
      let targetOwner = -1;
      for (let pi = 0; pi < 2; pi++) {
        if ((this.gs.players[pi]?.heroes || []).includes(target)) { targetOwner = pi; break; }
      }
      if (targetOwner >= 0 && targetOwner !== srcOwner) {
        hookCtx.amount = 0;
      }
    }

    // Immortal buff: damage cannot drop HP below 1
    if (target?.buffs?.immortal && target.hp !== undefined && target.hp > 0) {
      const maxDmg = Math.max(0, target.hp - 1);
      if (hookCtx.amount > maxDmg) {
        hookCtx.amount = maxDmg;
        this.log('damage_capped', { target: this._heroLabel(target), reason: 'immortal', cappedTo: maxDmg });
      }
    }

    // Generic HP-1 cap (set by beforeDamage hooks, e.g. Ghuanjun)
    // Runs AFTER all modifiers (Sacred Hammer bonus, etc.) so it's the final word
    if (hookCtx.capAtHPMinus1 && target?.hp !== undefined && target.hp > 0) {
      const maxDmg = Math.max(0, target.hp - 1);
      if (hookCtx.amount > maxDmg) {
        hookCtx.amount = maxDmg;
        this.log('damage_capped', { target: this._heroLabel(target), reason: 'capAtHPMinus1', cappedTo: maxDmg });
      }
    }

    const actualAmount = Math.max(0, hookCtx.amount);
    if (target && target.hp !== undefined) {
      target.hp = Math.max(0, target.hp - actualAmount);
    }

    this.log('damage', { source: source?.name, target: this._heroLabel(target), amount: actualAmount, type });
    await this.runHooks(HOOKS.AFTER_DAMAGE, { source, target, amount: actualAmount, type, sourceHeroIdx: source?.heroIdx ?? -1 });

    // ── SC tracking ──
    if (actualAmount > 0 && this.gs._scTracking) {
      const srcOwner2 = source?.owner ?? source?.controller ?? -1;
      if (srcOwner2 >= 0 && srcOwner2 < 2) {
        const t = this.gs._scTracking[srcOwner2];
        if (actualAmount > t.maxDamageInstance) t.maxDamageInstance = actualAmount;
      }
      // Check creature overkill (damage >= 2x creature max HP)
      if (target && target.zone === 'support') {
        // target is a card instance — check counters for HP tracking
        // Not applicable here — creatures don't have hp on the target object in this path
      }
      // Track hero HP dropping below 50%
      if (target && target.hp !== undefined && target.maxHp) {
        const targetOwner = this._findHeroOwner(target);
        if (targetOwner >= 0 && targetOwner < 2) {
          if (target.hp < target.maxHp * 0.5) {
            this.gs._scTracking[targetOwner].heroEverBelow50 = true;
          }
          // Track total HP lost by this player's heroes
          this.gs._scTracking[targetOwner].totalHpLost += actualAmount;
        }
      }
      // Track first player to be down to 1 hero
      for (let pi = 0; pi < 2; pi++) {
        const ps = this.gs.players[pi];
        const alive = (ps.heroes || []).filter(h => h.name && h.hp > 0).length;
        if (alive <= 1 && !this.gs._scTracking[0].wasFirstToOneHero && !this.gs._scTracking[1].wasFirstToOneHero) {
          this.gs._scTracking[pi].wasFirstToOneHero = true;
        }
      }
    }

    // Track: this player dealt damage to opponent's targets this turn
    if (actualAmount > 0 && srcOwner >= 0) {
      for (let pi = 0; pi < 2; pi++) {
        if (pi !== srcOwner && (this.gs.players[pi]?.heroes || []).includes(target)) {
          this.gs.players[srcOwner].dealtDamageToOpponent = true;
          break;
        }
      }
    }

    // Check for hero KO
    if (target && target.hp !== undefined && target.hp <= 0) {
      target.diedOnTurn = this.gs.turn; // Track when hero died (Initiation Ritual, etc.)
      await this.runHooks(HOOKS.ON_HERO_KO, { hero: target, source });

      // Cleanup: discard equip artifacts and handle island zone removal
      await this.handleHeroDeathCleanup(target);

      // Check if ALL heroes of a player are dead → opponent wins
      await this.checkAllHeroesDead();
    }

    return { dealt: actualAmount, cancelled: false };
  }

  async actionHealHero(source, target, amount) {
    if (!target || target.hp === undefined) return;
    const healed = Math.min(amount, (target.maxHp || target.hp) - target.hp);
    target.hp = Math.min(target.maxHp || target.hp + amount, target.hp + amount);
    this.log('heal', { source: source?.name, target: this._heroLabel(target), amount: healed });
  }

  /**
   * Revive a defeated hero. Generic handler used by Resuscitation Potion,
   * Elixir of Immortality, Golden Ankh, and future revival effects.
   * @param {number} playerIdx - Owning player
   * @param {number} heroIdx - Hero index
   * @param {number} hp - HP to revive with (clamped to maxHp)
   * @param {object} [opts]
   * @param {number} [opts.maxHpCap] - If set, cap maxHp at this value
   * @param {boolean} [opts.forceKillAtTurnEnd] - If true, hero dies at end of this turn (un-negatable)
   * @param {string} [opts.animationType] - Animation type (default 'holy_revival')
   * @param {number} [opts.animDelay] - Delay after animation (default 1200)
   * @param {string} [opts.source] - Source card name for logging
   * @returns {boolean} true if revived
   */
  async actionReviveHero(playerIdx, heroIdx, hp, opts = {}) {
    const ps = this.gs.players[playerIdx];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name) return false;
    if (hero.hp > 0) return false;

    const maxHp = hero.maxHp || 400;
    const reviveHp = Math.min(hp, maxHp);
    hero.hp = reviveHp;
    hero.statuses = {};

    if (opts.maxHpCap != null) {
      hero.maxHp = opts.maxHpCap;
      hero.maxHpCapped = opts.maxHpCap;
    }
    if (opts.forceKillAtTurnEnd) {
      hero._forceKillAtTurnEnd = this.gs.turn;
    }

    this.log('hero_revived', { hero: hero.name, player: ps.username, hp: reviveHp, by: opts.source || 'unknown' });

    const animType = opts.animationType || 'holy_revival';
    this._broadcastEvent('play_zone_animation', { type: animType, owner: playerIdx, heroIdx, zoneSlot: -1 });
    this.sync();
    await this._delay(opts.animDelay != null ? opts.animDelay : 1200);

    await this.runHooks(HOOKS.ON_HERO_REVIVE, { playerIdx, heroIdx, hero, hp: reviveHp, source: opts.source });
    return true;
  }

  /**
   * Increase a hero's max HP (and optionally current HP) by the given amount.
   * Respects hero.maxHpCapped — if set, max HP cannot exceed that value.
   * @param {object} hero - The hero object
   * @param {number} amount - Desired increase
   * @param {object} opts - { alsoHealCurrent: true (default) }
   * @returns {number} The actual amount max HP was increased by (may be 0 if capped)
   */
  increaseMaxHp(hero, amount, opts = {}) {
    if (!hero || hero.hp === undefined) return 0;
    const alsoHeal = opts.alsoHealCurrent !== false; // default true
    const currentMax = hero.maxHp || hero.hp;

    let effective = amount;
    if (hero.maxHpCapped != null) {
      effective = Math.max(0, Math.min(amount, hero.maxHpCapped - currentMax));
    }
    if (effective <= 0) {
      this.log('max_hp_capped', { hero: this._heroLabel(hero), cap: hero.maxHpCapped, attempted: amount });
      return 0;
    }

    hero.maxHp = currentMax + effective;
    if (alsoHeal) hero.hp += effective;

    this.log('max_hp_increase', { hero: this._heroLabel(hero), amount: effective, newMax: hero.maxHp });
    return effective;
  }

  /**
   * Decrease a hero's max HP by the given amount.
   * Max HP can never drop below 1. Current HP is clamped to new max.
   * @param {object} hero - The hero object
   * @param {number} amount - Desired decrease
   * @returns {number} The actual amount max HP was decreased by
   */
  decreaseMaxHp(hero, amount) {
    if (!hero || hero.hp === undefined) return 0;
    const currentMax = hero.maxHp || hero.hp;
    const effective = Math.min(amount, currentMax - 1); // Never below 1
    if (effective <= 0) return 0;

    hero.maxHp = currentMax - effective;
    hero.hp = Math.max(1, Math.min(hero.hp, hero.maxHp));

    this.log('max_hp_decrease', { hero: this._heroLabel(hero), amount: effective, newMax: hero.maxHp });
    return effective;
  }

  async actionDrawCards(playerIdx, count) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];

    const drawn = [];
    for (let i = 0; i < count; i++) {
      const hookCtx = { playerIdx, cancelled: false };
      await this.runHooks(HOOKS.BEFORE_DRAW, hookCtx);
      if (hookCtx.cancelled) continue;

      if (ps.mainDeck.length === 0) {
        this.log('deck_out', { player: ps.username });
        // Deck out = instant loss
        if (!this.gs.result) {
          const winnerIdx = playerIdx === 0 ? 1 : 0;
          this.log('deck_out_loss', { loser: ps.username, winner: this.gs.players[winnerIdx]?.username });
          if (this.onGameOver) {
            this.onGameOver(this.room, winnerIdx, 'deck_out');
          }
        }
        return drawn; // Stop drawing immediately
      }

      const cardName = ps.mainDeck.shift();
      ps.hand.push(cardName);
      const inst = this._trackCard(cardName, playerIdx, ZONES.HAND);
      drawn.push(inst);

      this.log('draw', { player: ps.username, card: cardName });
      await this.runHooks(HOOKS.ON_DRAW, { playerIdx, card: inst, cardName });
    }

    // After all draws, check reactive hand limits (Pollution Tokens, etc.)
    if (drawn.length > 0) await this._checkReactiveHandLimits(playerIdx);

    return drawn;
  }

  async actionDestroyCard(source, targetCard) {
    if (!targetCard) return;
    if (targetCard.counters?.immovable) return; // Cannot be destroyed or removed
    this.log('destroy', { source: source?.name, target: targetCard.name });
    await this.actionMoveCard(targetCard, ZONES.DISCARD);
  }

  async actionMoveCard(cardInstance, toZone, toHeroIdx, toSlot) {
    // Immovable cards cannot leave their zone
    if (cardInstance.counters?.immovable && toZone !== cardInstance.zone) return;
    const fromZone = cardInstance.zone;
    const fromHeroIdx = cardInstance.heroIdx;

    await this.runHooks(HOOKS.ON_CARD_LEAVE_ZONE, { card: cardInstance, fromZone, fromHeroIdx });

    // Remove from old zone in game state
    this._removeCardFromState(cardInstance);

    // Update instance
    cardInstance.zone = toZone;
    cardInstance.heroIdx = toHeroIdx !== undefined ? toHeroIdx : -1;
    cardInstance.zoneSlot = toSlot !== undefined ? toSlot : -1;
    cardInstance.faceDown = toZone === ZONES.SURPRISE;

    // Add to new zone in game state
    this._addCardToState(cardInstance);

    this.log('move', { card: cardInstance.name, from: fromZone, to: toZone });
    await this.runHooks(HOOKS.ON_CARD_ENTER_ZONE, { card: cardInstance, toZone, toHeroIdx });
  }

  async actionDiscardCards(playerIdx, count) {
    // First-turn protection blocks forced discard
    if (this.gs.firstTurnProtectedPlayer === playerIdx) {
      this.log('discard_blocked', { player: this.gs.players[playerIdx]?.username, reason: 'shielded' });
      return;
    }
    // For now, discard from end of hand. Later: prompt player to choose.
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    const toDiscard = Math.min(count, ps.hand.length);
    for (let i = 0; i < toDiscard; i++) {
      const cardName = ps.hand.pop();
      ps.discardPile.push(cardName);
      const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: cardName })[0];
      if (inst) {
        inst.zone = ZONES.DISCARD;
        this.log('discard', { player: ps.username, card: cardName });
        await this.runHooks(HOOKS.ON_DISCARD, { playerIdx, card: inst, cardName });
      }
    }
  }

  // ─── SAFE SUPPORT ZONE PLACEMENT ─────────

  /**
   * Safely place a card into a support zone with zone-occupied fallback.
   * If the desired slot is occupied, tries other free BASE zones (0–2) on the same hero.
   * If no free zone exists, returns null — caller handles fizzle/discard.
   *
   * Does NOT fire onPlay/onCardEnterZone hooks — caller is responsible for those
   * (since hook context varies by card type: creature, equip, token, etc.).
   *
   * @param {string} cardName - Card to place
   * @param {number} playerIdx - Owner player index
   * @param {number} heroIdx - Target hero index
   * @param {number} zoneSlot - Desired zone slot
   * @returns {{ inst: CardInstance, actualSlot: number } | null}
   */
  safePlaceInSupport(cardName, playerIdx, heroIdx, zoneSlot) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return null;
    if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];

    let actualSlot = zoneSlot;

    // Check if desired slot is occupied
    if ((ps.supportZones[heroIdx][actualSlot] || []).length > 0) {
      // Find another free base zone (0–2) on the same hero
      actualSlot = -1;
      for (let z = 0; z < 3; z++) {
        if (z !== zoneSlot && ((ps.supportZones[heroIdx][z] || []).length === 0)) {
          actualSlot = z;
          break;
        }
      }
      if (actualSlot < 0) {
        this.log('support_zone_full', { card: cardName, heroIdx, reason: 'no_free_zone' });
        return null; // No free zones — caller handles fizzle
      }
      this.log('support_zone_relocated', { card: cardName, heroIdx, from: zoneSlot, to: actualSlot });
    }

    // Place the card
    if (!ps.supportZones[heroIdx][actualSlot]) ps.supportZones[heroIdx][actualSlot] = [];
    ps.supportZones[heroIdx][actualSlot] = [cardName];
    const inst = this._trackCard(cardName, playerIdx, 'support', heroIdx, actualSlot);
    return { inst, actualSlot };
  }

  /**
   * Prompt a player to choose cards to discard from their hand.
   * Uses the standard forceDiscard UI.
   * @param {number} playerIdx - The player who must discard
   * @param {number} count - Number of cards to discard
   * @param {object} opts - { title, source }
   */
  async actionPromptForceDiscard(playerIdx, count, opts = {}) {
    // First-turn protection blocks forced discard
    if (this.gs.firstTurnProtectedPlayer === playerIdx) {
      this.log('discard_blocked', { player: this.gs.players[playerIdx]?.username, reason: 'shielded' });
      return;
    }
    const ps = this.gs.players[playerIdx];
    if (!ps || (ps.hand || []).length === 0) return;

    const toDiscard = Math.min(count, ps.hand.length);
    for (let i = 0; i < toDiscard; i++) {
      if ((ps.hand || []).length === 0) break;

      const result = await this.promptGeneric(playerIdx, {
        type: 'forceDiscard',
        count: 1,
        title: opts.title || opts.source || 'Forced Discard',
        description: `You must discard ${toDiscard - i} more card${toDiscard - i > 1 ? 's' : ''}.`,
        cancellable: false,
      });

      if (!result || result.cardName == null) {
        // Safety fallback: auto-pop
        const cardName = ps.hand.pop();
        if (cardName) {
          ps.discardPile.push(cardName);
          this.log('forced_discard', { player: ps.username, card: cardName, source: opts.source });
        }
      } else {
        const handIdx = result.handIndex;
        if (handIdx != null && handIdx >= 0 && handIdx < ps.hand.length && ps.hand[handIdx] === result.cardName) {
          ps.hand.splice(handIdx, 1);
        } else {
          const fallbackIdx = ps.hand.indexOf(result.cardName);
          if (fallbackIdx >= 0) ps.hand.splice(fallbackIdx, 1);
          else continue;
        }
        ps.discardPile.push(result.cardName);
        this.log('forced_discard', { player: ps.username, card: result.cardName, source: opts.source });
      }

      const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: result?.cardName })[0];
      if (inst) {
        inst.zone = ZONES.DISCARD;
        await this.runHooks(HOOKS.ON_DISCARD, { playerIdx, card: inst, cardName: result.cardName, _skipReactionCheck: true });
      }
      this.sync();
    }
  }

  // ─── HAND SIZE LIMIT ──────────────────────

  /**
   * Enforce the maximum hand size.
   * Base limit is 7, reduced by handLimitReduction counters on support zone cards
   * (e.g. Pollution Tokens), with a minimum of 1.
   *
   * @param {number} playerIdx
   * @param {object} [opts]
   * @param {number} [opts.maxSize] - Override the computed max hand size
   * @param {boolean} [opts.deleteMode] - If true, send cards to deleted pile instead of discard
   * @param {string} [opts.title] - Prompt title (default 'Hand Limit')
   */
  async enforceHandLimit(playerIdx, opts = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;

    // Compute effective max hand size
    let maxSize = opts.maxSize;
    if (maxSize === undefined) {
      maxSize = 7;
      for (const inst of this.cardInstances) {
        if (inst.owner === playerIdx && inst.zone === ZONES.SUPPORT) {
          maxSize -= inst.counters.handLimitReduction || 0;
        }
      }
      maxSize = Math.max(1, maxSize);
    }

    // Determine whether to delete (pollution) or discard (normal)
    const deleteMode = opts.deleteMode !== undefined ? opts.deleteMode : false;
    const title = opts.title || 'Hand Limit';
    const pile = deleteMode ? 'deleted' : 'discard';
    const pileArr = deleteMode ? 'deletedPile' : 'discardPile';
    const destZone = deleteMode ? ZONES.DELETED : ZONES.DISCARD;
    const hookName = deleteMode ? HOOKS.ON_DELETE : HOOKS.ON_DISCARD;
    const verb = deleteMode ? 'Delete' : 'Discard';

    while ((ps.hand || []).length > maxSize) {
      const excess = ps.hand.length - maxSize;

      const result = await this.promptGeneric(playerIdx, {
        type: 'forceDiscard',
        count: 1,
        title,
        description: `You have ${ps.hand.length} cards in hand (max ${maxSize}). ${verb} ${excess} more.`,
        cancellable: false,
      });

      if (!result || result.cardName == null) {
        // Safety: if prompt fails, auto-remove from end of hand
        const cardName = ps.hand.pop();
        ps[pileArr].push(cardName);
        const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: cardName })[0];
        if (inst) inst.zone = destZone;
        this.log('hand_limit_' + pile, { player: ps.username, card: cardName });
        await this.runHooks(hookName, { playerIdx, cardName, _skipReactionCheck: true });
        this.sync();
        continue;
      }

      // Validate and remove the selected card
      const handIdx = result.handIndex;
      if (handIdx == null || handIdx < 0 || handIdx >= ps.hand.length || ps.hand[handIdx] !== result.cardName) {
        const fallbackIdx = ps.hand.indexOf(result.cardName);
        if (fallbackIdx < 0) continue;
        ps.hand.splice(fallbackIdx, 1);
      } else {
        ps.hand.splice(handIdx, 1);
      }
      ps[pileArr].push(result.cardName);

      const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: result.cardName })[0];
      if (inst) inst.zone = destZone;

      this.log('hand_limit_' + pile, { player: ps.username, card: result.cardName });
      await this.runHooks(hookName, { playerIdx, cardName: result.cardName, _skipReactionCheck: true });
      this.sync();
    }
  }

  /**
   * Check if a player has reactive hand limit reductions (Pollution Tokens, etc.)
   * and enforce deletion if the hand exceeds the reduced limit.
   * Generic: uses the handLimitReduction counter on support zone cards.
   * Called after draws and other hand-growing events.
   */
  async _checkReactiveHandLimits(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    let reduction = 0;
    for (const inst of this.cardInstances) {
      if (inst.owner === playerIdx && inst.zone === ZONES.SUPPORT) {
        reduction += inst.counters.handLimitReduction || 0;
      }
    }
    if (reduction === 0) return;
    const maxSize = Math.max(1, 7 - reduction);
    if (ps.hand.length > maxSize) {
      await this.enforceHandLimit(playerIdx, { maxSize, deleteMode: true, title: 'Pollution' });
    }
  }

  async actionAddStatus(target, statusName, opts = {}) {
    if (!target) return false;
    if (!target.statuses) target.statuses = {};

    // Check if this is a negative status
    const statusDef = STATUS_EFFECTS[statusName];
    const isNegative = statusDef?.negative === true;

    // Helper: play animation on blocked status (find hero position first)
    const playBlockedAnim = () => {
      if (!opts.animationType) return;
      const ownerIdx = this._findHeroOwner(target);
      if (ownerIdx < 0) return;
      const ps = this.gs.players[ownerIdx];
      const heroIdx = (ps.heroes || []).indexOf(target);
      if (heroIdx >= 0) {
        this._broadcastEvent('play_zone_animation', {
          type: opts.animationType, owner: ownerIdx, heroIdx, zoneSlot: -1,
        });
      }
    };

    if (isNegative) {
      // First-turn protection: block ALL negative statuses on protected player's heroes
      if (this.gs.firstTurnProtectedPlayer != null) {
        const protectedIdx = this.gs.firstTurnProtectedPlayer;
        const ps = this.gs.players[protectedIdx];
        if (ps && (ps.heroes || []).includes(target)) {
          this.log('status_blocked', { target: this._heroLabel(target), status: statusName, reason: 'shielded' });
          playBlockedAnim();
          return false;
        }
      }

      // Immune status blocks all negative statuses
      if (target.statuses?.immune) {
        this.log('status_blocked', { target: target.name || this._heroLabel(target), status: statusName, reason: 'immune' });
        playBlockedAnim();
        return false;
      }

      // Specific immunity (burn_immune, freeze_immune, etc.)
      if (statusDef?.immuneKey && target.statuses?.[statusDef.immuneKey]) {
        this.log('status_blocked', { target: target.name || this._heroLabel(target), status: statusName, reason: statusDef.immuneKey });
        playBlockedAnim();
        return false;
      }
    }

    target.statuses[statusName] = { ...opts, appliedTurn: this.gs.turn };
    this.log('status_add', { target: target.name || this._heroLabel(target), status: statusName });
    await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target, status: statusName, opts });
    return true;
  }

  async actionRemoveStatus(target, statusName) {
    if (!target?.statuses?.[statusName]) return;
    delete target.statuses[statusName];
    this.log('status_remove', { target: target.name || this._heroLabel(target), status: statusName });
    await this.runHooks(HOOKS.ON_STATUS_REMOVED, { target, status: statusName });
  }

  // ─── BUFF SYSTEM ──────────────────────────

  /**
   * Add a buff to a hero. Buffs are positive effects displayed in the buff column.
   * @param {object} hero - The hero object
   * @param {number} playerIdx - Owning player
   * @param {number} heroIdx - Hero index
   * @param {string} buffName - Key from BUFF_EFFECTS registry
   * @param {object} [opts] - { expiresAtTurn, expiresForPlayer, source, addAnim, removeAnim, ... }
   */
  async actionAddBuff(hero, playerIdx, heroIdx, buffName, opts = {}) {
    if (!hero?.name || hero.hp <= 0) return false;
    if (!hero.buffs) hero.buffs = {};
    const buffDef = BUFF_EFFECTS[buffName] || {};
    hero.buffs[buffName] = {
      ...opts,
      damageMultiplier: buffDef.damageMultiplier ?? opts.damageMultiplier,
      appliedTurn: this.gs.turn,
    };
    this.log('buff_add', { hero: hero.name, buff: buffName, player: this.gs.players[playerIdx]?.username });
    if (opts.addAnim) {
      this._broadcastEvent('play_zone_animation', { type: opts.addAnim, owner: playerIdx, heroIdx, zoneSlot: -1 });
    }
    this.sync();
    return true;
  }

  /**
   * Add a buff to a creature (card instance in support zone).
   * Stored in inst.counters.buffs object.
   */
  async actionAddCreatureBuff(inst, buffName, opts = {}) {
    if (!inst || inst.zone !== ZONES.SUPPORT) return false;
    if (!inst.counters.buffs) inst.counters.buffs = {};
    const buffDef = BUFF_EFFECTS[buffName] || {};
    inst.counters.buffs[buffName] = {
      ...opts,
      damageMultiplier: buffDef.damageMultiplier ?? opts.damageMultiplier,
      appliedTurn: this.gs.turn,
    };
    this.log('buff_add', { creature: inst.name, buff: buffName, owner: inst.owner });
    if (opts.addAnim) {
      this._broadcastEvent('play_zone_animation', { type: opts.addAnim, owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    }
    this.sync();
    return true;
  }

  /**
   * Remove a buff from a hero.
   */
  async actionRemoveBuff(hero, playerIdx, heroIdx, buffName, opts = {}) {
    if (!hero?.buffs?.[buffName]) return;
    const buffData = hero.buffs[buffName];
    delete hero.buffs[buffName];
    this.log('buff_remove', { hero: hero.name, buff: buffName });
    if (buffData.removeAnim || opts.removeAnim) {
      this._broadcastEvent('play_zone_animation', { type: opts.removeAnim || buffData.removeAnim, owner: playerIdx, heroIdx, zoneSlot: -1 });
    }
    this.sync();
  }

  /**
   * Remove a buff from a creature.
   */
  async actionRemoveCreatureBuff(inst, buffName, opts = {}) {
    if (!inst?.counters?.buffs?.[buffName]) return;
    const buffData = inst.counters.buffs[buffName];
    // Clear associated counters on expiry (e.g. dark_gear_negated clears negated)
    if (buffData.clearCountersOnExpire) {
      for (const key of buffData.clearCountersOnExpire) {
        delete inst.counters[key];
      }
    }
    delete inst.counters.buffs[buffName];
    this.log('buff_remove', { creature: inst.name, buff: buffName });
    if (buffData.removeAnim || opts.removeAnim) {
      this._broadcastEvent('play_zone_animation', { type: opts.removeAnim || buffData.removeAnim, owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    }
    this.sync();
  }

  /**
   * Process buff expiry at the start of a turn.
   * Removes buffs whose expiresAtTurn matches the current turn
   * and expiresForPlayer matches the active player.
   * Called after burn/poison so buffs still protect during those.
   */
  async _processBuffExpiry() {
    const currentTurn = this.gs.turn;
    const activePlayer = this.gs.activePlayer;
    let expired = false;

    // Hero buffs
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.buffs) continue;
        for (const [buffName, buffData] of Object.entries(hero.buffs)) {
          if (buffData.expiresAtTurn === currentTurn && buffData.expiresForPlayer === activePlayer) {
            await this.actionRemoveBuff(hero, pi, hi, buffName);
            expired = true;
          }
        }
      }
    }

    // Creature buffs
    for (const inst of this.cardInstances) {
      if (inst.zone !== ZONES.SUPPORT || !inst.counters?.buffs) continue;
      for (const [buffName, buffData] of Object.entries(inst.counters.buffs)) {
        if (buffData.expiresAtTurn === currentTurn && buffData.expiresForPlayer === activePlayer) {
          await this.actionRemoveCreatureBuff(inst, buffName);
          expired = true;
        }
      }
    }

    if (expired) this.sync();
  }

  /**
   * Change a creature's level. Fires BEFORE_LEVEL_CHANGE (can modify delta) and AFTER_LEVEL_CHANGE.
   * Broadcasts 'level_change' for frontend popup animation.
   * @param {CardInstance} card - The card whose level to change
   * @param {number} delta - Amount to change (positive or negative)
   */
  async actionChangeLevel(card, delta) {
    if (!card || delta === 0) return;

    // Fire BEFORE hook — allows modification of delta (e.g. Slime Rancher adds +1)
    const hookCtx = { targetCard: card, delta, targetCardName: card.name, targetOwner: card.owner, cancelled: false };
    await this.runHooks(HOOKS.BEFORE_LEVEL_CHANGE, hookCtx);
    if (hookCtx.cancelled) return;

    const finalDelta = hookCtx.delta || delta;
    const oldLevel = card.counters.level || 0;
    card.counters.level = oldLevel + finalDelta;

    this.log('level_change', { card: card.name, owner: card.owner, delta: finalDelta, newLevel: card.counters.level });

    // Broadcast for frontend popup
    this._broadcastEvent('level_change', {
      cardName: card.name, owner: card.owner,
      heroIdx: card.heroIdx, zoneSlot: card.zoneSlot,
      delta: finalDelta, newLevel: card.counters.level,
    });

    await this.runHooks(HOOKS.AFTER_LEVEL_CHANGE, { targetCard: card, delta: finalDelta, newLevel: card.counters.level });
    this.sync();
  }

  // ─── CREATURE NEGATION ──────────────────

  /**
   * Negate a creature's effects with automatic expiry.
   * Generic handler used by Dark Gear, Necromancy, and future negation effects.
   * Sets inst.counters.negated = 1 and creates a timed buff that clears it on expiry.
   * @param {CardInstance} inst - The creature to negate
   * @param {string} source - Source name (e.g. 'Dark Gear', 'Necromancy')
   * @param {object} opts
   * @param {number} opts.expiresAtTurn - Turn number when negation expires
   * @param {number} opts.expiresForPlayer - Player index whose turn start triggers expiry
   * @param {string} [opts.buffKey] - Custom buff key (default: auto-generated from source)
   * @param {string} [opts.removeAnim] - Animation to play when negation expires
   */
  actionNegateCreature(inst, source, opts = {}) {
    if (!inst) return;
    inst.counters.negated = 1;
    if (!inst.counters.buffs) inst.counters.buffs = {};
    const buffKey = opts.buffKey || `${source.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_negated`;
    inst.counters.buffs[buffKey] = {
      expiresAtTurn: opts.expiresAtTurn,
      expiresForPlayer: opts.expiresForPlayer,
      clearCountersOnExpire: ['negated'],
      source,
      ...(opts.removeAnim ? { removeAnim: opts.removeAnim } : {}),
    };
    this.log('creature_negated', { creature: inst.name, source, buffKey });
    this.sync();
  }

  // ─── ATK MODIFICATION ─────────────────────

  /**
   * Grant ATK to a hero and track it on the source card instance.
   * Generic handler for Fighting, Sacred Hammer, equipment, etc.
   * @param {CardInstance} cardInst - The card granting the ATK (tracks amount for revocation)
   * @param {object} hero - The hero object
   * @param {number} ownerIdx - Player index
   * @param {number} heroIdx - Hero index
   * @param {number} amount - ATK to add
   */
  actionGrantAtk(cardInst, hero, ownerIdx, heroIdx, amount) {
    if (!hero || !amount) return;
    hero.atk = (hero.atk || 0) + amount;
    cardInst.counters.atkGranted = (cardInst.counters.atkGranted || 0) + amount;
    this._broadcastEvent('fighting_atk_change', { owner: ownerIdx, heroIdx, amount });
    this.log('atk_grant', { hero: hero.name, amount, source: cardInst.name });
    this.sync();
  }

  /**
   * Revoke ATK previously granted by a card instance.
   * Reads the stored atkGranted counter and subtracts it.
   * @param {CardInstance} cardInst - The card whose ATK grant to revoke
   * @param {object} hero - The hero object
   * @param {number} ownerIdx - Player index
   * @param {number} heroIdx - Hero index
   */
  actionRevokeAtk(cardInst, hero, ownerIdx, heroIdx) {
    const granted = cardInst.counters.atkGranted || 0;
    if (!hero || granted <= 0) return;
    hero.atk = Math.max(0, (hero.atk || 0) - granted);
    this._broadcastEvent('fighting_atk_change', { owner: ownerIdx, heroIdx, amount: -granted });
    this.log('atk_revoke', { hero: hero.name, amount: granted, source: cardInst.name });
    this.sync();
  }

  /**
   * Check if a creature status can be applied (generic immunity check).
   * Checks for `inst.counters[statusName + '_immune']`.
   * Used by card scripts before directly setting creature counters.
   * @param {CardInstance} inst - The creature
   * @param {string} statusName - e.g. 'frozen', 'burned', 'poisoned'
   * @returns {boolean} true if the status CAN be applied
   */
  canApplyCreatureStatus(inst, statusName) {
    if (!inst) return false;
    const immuneKey = statusName + '_immune';
    if (inst.counters[immuneKey]) return false;
    return true;
  }

  /**
   * Check if a creature has a specific immunity.
   * Checks creature's own counters AND first-turn protection.
   * Generic handler for targeting_immune, control_immune, etc.
   * @param {CardInstance} inst - The creature to check
   * @param {string} immuneType - Immunity counter key (e.g. 'targeting_immune', 'control_immune')
   * @returns {boolean}
   */
  isCreatureImmune(inst, immuneType) {
    if (!inst) return false;
    // Check creature's own immunity counter
    if (inst.counters[immuneType]) return true;
    // First-turn protection grants targeting + control immunity
    if (this.gs.firstTurnProtectedPlayer != null) {
      if (inst.controller === this.gs.firstTurnProtectedPlayer) return true;
    }
    return false;
  }

  // ─── IMMEDIATE HERO ACTION (Coffee, etc.) ──────

  /**
   * Get all action cards (Attack/Spell/Creature) a specific hero could play from hand.
   * Checks spell school, level, free zones, summon lock.
   */
  getHeroEligibleActionCards(playerIdx, heroIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const cardDB = this._getCardDB();
    const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];
    const eligible = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || !ACTION_TYPES.includes(cd.cardType)) continue;
      // Check spell school / level requirements
      const hero = ps.heroes[heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      const level = cd.level || 0;
      if (level > 0 || cd.spellSchool1) {
        const abZones = ps.abilityZones[heroIdx] || [];
        const countAb = (school) => this.countAbilitiesForSchool(school, abZones);
        if (cd.spellSchool1 && countAb(cd.spellSchool1) < level) continue;
        if (cd.spellSchool2 && countAb(cd.spellSchool2) < level) continue;
      }
      // Creatures need a free support zone
      if (cd.cardType === 'Creature') {
        const supZones = ps.supportZones[heroIdx] || [];
        let hasFree = false;
        for (let z = 0; z < 3; z++) { if ((supZones[z] || []).length === 0) { hasFree = true; break; } }
        if (!hasFree) continue;
        if (ps.summonLocked) continue;
      }
      // Once-per-game cards (Divine Gift, etc.)
      const script = loadCardEffect(cardName);
      if (script?.oncePerGame) {
        const opgKey = script.oncePerGameKey || cardName;
        if (ps._oncePerGameUsed?.has(opgKey)) continue;
      }
      // Spells/Attacks with custom play conditions
      if (script?.spellPlayCondition && !script.spellPlayCondition(this.gs, playerIdx)) continue;
      seen.add(cardName);
      eligible.push(cardName);
    }
    return eligible;
  }

  /**
   * Shared validation for playing action cards (Spell, Attack, Creature) from hand.
   * Covers: phase check, hand validation, card data lookup, hero validation,
   * spell school/level, combo lock, once-per-game, canPlayCard hero restrictions,
   * spellPlayCondition, and inherent action detection.
   *
   * @param {number} pi - Player index
   * @param {string} cardName - Card name
   * @param {number} handIndex - Index in hand
   * @param {number} heroIdx - Hero to play under
   * @param {string[]} expectedTypes - Allowed card types (e.g. ['Spell','Attack'])
   * @returns {object|null} Computed context or null if validation fails
   */
  validateActionPlay(pi, cardName, handIndex, heroIdx, expectedTypes) {
    const gs = this.gs;
    if (pi < 0 || pi !== gs.activePlayer) return null;

    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (!isActionPhase && !isMainPhase) return null;

    const ps = gs.players[pi];
    if (!ps) return null;

    // Hand validation
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return null;

    // Card data lookup (uses engine's cached card DB)
    const cardData = this._getCardDB()[cardName];
    if (!cardData || !expectedTypes.includes(cardData.cardType)) return null;

    // Hero validation
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return null;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return null;

    // Combo lock
    if (ps.comboLockHeroIdx != null && ps.comboLockHeroIdx !== heroIdx) return null;

    // Spell school / level requirements
    const level = cardData.level || 0;
    if (level > 0 || cardData.spellSchool1) {
      const abZones = ps.abilityZones[heroIdx] || [];
      if (cardData.spellSchool1 && this.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) return null;
      if (cardData.spellSchool2 && this.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) return null;
    }

    // Load card script
    const script = loadCardEffect(cardName);

    // Once-per-game check
    if (script?.oncePerGame) {
      const opgKey = script.oncePerGameKey || cardName;
      if (ps._oncePerGameUsed?.has(opgKey)) return null;
    }

    // Custom play conditions (spells/attacks)
    if (script?.spellPlayCondition && !script.spellPlayCondition(gs, pi)) return null;

    // Hero-specific card restrictions (e.g. duplicate attack bans)
    const heroScript = loadCardEffect(hero.name);
    if (heroScript?.canPlayCard && !heroScript.canPlayCard(gs, pi, heroIdx, cardData, this)) return null;

    // Equipped hero card restrictions (treatAsEquip cards in support zones)
    for (const inst of this.cardInstances) {
      if (inst.owner !== pi || inst.zone !== 'support' || inst.heroIdx !== heroIdx) continue;
      if (!inst.counters?.treatAsEquip) continue;
      const equipScript = loadCardEffect(inst.name);
      if (equipScript?.canPlayCard && !equipScript.canPlayCard(gs, pi, heroIdx, cardData, this)) return null;
    }

    // Inherent action detection
    const isInherentAction = typeof script?.inherentAction === 'function'
      ? script.inherentAction(gs, pi, heroIdx, this)
      : script?.inherentAction === true;

    return { ps, cardData, hero, script, level, isActionPhase, isMainPhase, isInherentAction };
  }

  /**
   * Perform an immediate action with a specific hero. Shows the pseudo-Action-Phase UI.
   * Used by Coffee and future cards.
   * @param {number} playerIdx - Player index
   * @param {number} heroIdx - Hero index to act with
   * @param {object} config - { title, description } for the prompt panel
   * @returns {{ played: boolean, cardName?: string, cardType?: string }} result
   */
  async performImmediateAction(playerIdx, heroIdx, config = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return { played: false };
    const hero = ps.heroes[heroIdx];
    if (!hero?.name || hero.hp <= 0) return { played: false };

    const eligible = this.getHeroEligibleActionCards(playerIdx, heroIdx);

    // Also check for activatable abilities on this hero
    const activatableAbilities = [];
    for (let zi = 0; zi < (ps.abilityZones[heroIdx] || []).length; zi++) {
      const slot = (ps.abilityZones[heroIdx] || [])[zi] || [];
      if (slot.length === 0) continue;
      const abilityName = slot[0];
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost) continue;
      const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
      if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      activatableAbilities.push({ heroIdx, zoneIdx: zi, abilityName, level: slot.length });
    }

    if (eligible.length === 0 && activatableAbilities.length === 0) return { played: false };

    // Show hero-action prompt
    const actionResult = await this.promptGeneric(playerIdx, {
      type: 'heroAction',
      heroIdx,
      heroName: hero.name,
      eligibleCards: eligible,
      activatableAbilities,
      title: config.title || 'Immediate Action',
      description: config.description || `Use an action with ${hero.name}!`,
      cancellable: true,
    });

    if (!actionResult || actionResult.cancelled) return { played: false };

    // Handle ability activation
    if (actionResult.abilityActivation) {
      const { zoneIdx } = actionResult;
      const slot = (ps.abilityZones[heroIdx] || [])[zoneIdx] || [];
      if (slot.length === 0) return { played: false };
      const abilityName = slot[0];
      const level = slot.length;
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) return { played: false };

      const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
      if (!this.gs.hoptUsed) this.gs.hoptUsed = {};
      this.gs.hoptUsed[hoptKey] = this.gs.turn;

      const inst = this.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === 'ability' && c.heroIdx === heroIdx && c.zoneSlot === zoneIdx
      );
      if (!inst) return { played: false };

      this._broadcastEvent('ability_activated', { owner: playerIdx, heroIdx, zoneIdx, abilityName });
      const ctx = this._createContext(inst, {});
      await script.onActivate(ctx, level);
      this.sync();
      return { played: true, cardName: abilityName, cardType: 'Ability' };
    }

    const { cardName, handIndex, zoneSlot } = actionResult;
    if (!cardName) return { played: false };

    const cardDB = this._getCardDB();
    const cardData = cardDB[cardName];
    if (!cardData) return { played: false };
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return { played: false };

    const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];
    if (!ACTION_TYPES.includes(cardData.cardType)) return { played: false };

    if (cardData.cardType === 'Creature') {
      if (zoneSlot === undefined || zoneSlot < 0) return { played: false };
      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      if ((ps.supportZones[heroIdx][zoneSlot] || []).length > 0) return { played: false };

      ps.hand.splice(handIndex, 1);

      // Safe placement — handles zone-occupied fallback
      const placeResult = this.safePlaceInSupport(cardName, playerIdx, heroIdx, zoneSlot);
      if (!placeResult) {
        ps.discardPile.push(cardName);
        this.log('creature_fizzle', { card: cardName, reason: 'zone_occupied', by: config.title });
        return { played: false };
      }
      const { inst, actualSlot } = placeResult;

      this._broadcastEvent('summon_effect', { owner: playerIdx, heroIdx, zoneSlot: actualSlot, cardName });

      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualSlot, _skipReactionCheck: true });
      await this.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });

      this.log('immediate_action', { hero: hero.name, card: cardName, type: 'Creature', by: config.title });

    } else {
      // Spell or Attack
      ps.hand.splice(handIndex, 1);
      const inst = this._trackCard(cardName, playerIdx, 'hand', heroIdx, -1);
      this.gs._immediateActionContext = true;
      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });
      delete this.gs._immediateActionContext;
      ps.discardPile.push(cardName);
      this._untrackCard(inst.id);
      this.log('immediate_action', { hero: hero.name, card: cardName, type: cardData.cardType, by: config.title });
    }

    this.sync();
    await this._delay(400);

    // If the spell declared itself a free action (Fire Bolts enhanced, etc.),
    // the immediate action wasn't consumed — grant another one
    if (this.gs._spellFreeAction) {
      delete this.gs._spellFreeAction;
      this.log('free_action_refund', { card: cardName, hero: hero.name, by: config.title });
      const another = await this.performImmediateAction(playerIdx, heroIdx, config);
      return { played: true, cardName, cardType: cardData.cardType, chainedAction: another };
    }

    return { played: true, cardName, cardType: cardData.cardType };
  }

  // ─── TURN / PHASE MANAGEMENT ───────────────

  /**
   * Start the game's first turn. Call once after init().
   */
  async startGame() {
    // Track hand cards — starting hand is drawn before engine init,
    // so hand cards need to be registered here for hand-zone hooks to fire.
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      for (const cardName of (ps.hand || [])) {
        this._trackCard(cardName, pi, ZONES.HAND);
      }
    }

    // First turn rule: opponent of the starting player is fully shielded
    // (blocks ALL damage, ALL status effects, discard, mill — everything)
    const oppIdx = this.gs.activePlayer === 0 ? 1 : 0;
    this.gs.firstTurnProtectedPlayer = oppIdx;
    const oppPs = this.gs.players[oppIdx];
    if (oppPs) {
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const hero = oppPs.heroes[hi];
        if (hero?.name) {
          await this.addHeroStatus(oppIdx, hi, 'shielded', {});
        }
      }
    }
    await this.runHooks(HOOKS.ON_GAME_START, {});
    await this.startTurn();
  }

  /**
   * Begin a new turn for the active player.
   */
  async startTurn() {
    this.gs.currentPhase = PHASES.START;
    // Reset per-turn flags
    const activePs = this.gs.players[this.gs.activePlayer];
    if (activePs) activePs.abilityGivenThisTurn = [false, false, false];
    // Clear summon lock for both players (it's a per-turn restriction)
    for (const ps of this.gs.players) {
      if (ps) {
        ps.summonLocked = false;
        ps.damageLocked = false;
        ps.dealtDamageToOpponent = false;
        ps.potionLocked = false;
        ps.potionsUsedThisTurn = 0;
        ps.attacksPlayedThisTurn = 0;
        ps.comboLockHeroIdx = null;
        ps.heroesActedThisTurn = [];
        ps.heroesAttackedThisTurn = [];
        ps.bonusActions = null;
      }
    }
    this.log('turn_start', { turn: this.gs.turn, activePlayer: this.gs.activePlayer, username: activePs?.username });

    // Process status effects FIRST — before any card hooks fire
    // This ensures burn damage only hits burns from previous turns,
    // not burns applied during this turn's ON_TURN_START (e.g. Barker → Fiery Slime)
    await this.processStatusExpiry('START');

    // Burn/poison damage BEFORE buff expiry — so buffs like Cloudy still
    // halve status damage on the turn they expire
    await this.processBurnDamage();
    await this.processPoisonDamage();

    // Hook: all status damage done — deferred effects (Elixir revive choice) can resolve
    await this.runHooks(HOOKS.AFTER_ALL_STATUS_DAMAGE, { _skipReactionCheck: true });

    // Process buff expiry (Cloudy, Immortal, etc.) AFTER status damage
    await this._processBuffExpiry();

    // Now fire turn-start hooks (Barker, Slime level-ups, Rancher restore, etc.)
    await this.runHooks(HOOKS.ON_TURN_START, { turn: this.gs.turn, activePlayer: this.gs.activePlayer });
    this.sync();
    await this.runPhase(PHASES.START);
  }

  /**
   * Run a specific phase: fire hooks, do automatic actions, auto-advance if needed.
   */
  async runPhase(phase) {
    this.gs.currentPhase = phase;
    const phaseName = PHASE_NAMES[phase];
    this.log('phase_start', { phase: phaseName });
    await this.runHooks(HOOKS.ON_PHASE_START, { phase: phaseName, phaseIndex: phase });
    this.sync();

    switch (phase) {
      case PHASES.START:
        // Status expiry + burn damage already processed in startTurn() before hooks
        await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: phase });
        await this._delay(250);
        await this.runPhase(PHASES.RESOURCE);
        break;

      case PHASES.RESOURCE: {
        await this._delay(200);
        // Draw 1 card
        const activeP = this.gs.activePlayer;
        await this.actionDrawCards(activeP, 1);
        await this._delay(150);
        // Gain 4 Gold
        await this.actionGainGold(activeP, 4);
        // Auto-advance after hooks
        await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: phase });
        await this._delay(200);
        await this.runPhase(PHASES.MAIN1);
        break;
      }

      case PHASES.MAIN1:
      case PHASES.MAIN2:
        // Compute which ability cards have custom placement
        this.gs.customPlacementCards = this.getCustomPlacementCards(this.gs.activePlayer);
        // Compute which targeting artifacts/potions have no valid targets
        this.gs.unactivatableArtifacts = this.getUnactivatableArtifacts(this.gs.activePlayer);
        // Player-controlled phase — wait for manual advance
        this.sync();
        break;

      case PHASES.ACTION:
        // Compute which creatures have custom summon conditions that block them
        this.gs.summonBlocked = this.getSummonBlocked(this.gs.activePlayer);
        // Player-controlled — wait for card play or manual skip
        this.sync();
        break;

      case PHASES.END:
        // Automatic phase — process status expiry, hooks, then switch turn
        await this.processStatusExpiry('END');
        await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: phase });
        // Process forced kills (Golden Ankh, etc.) — un-negatable
        await this._processForceKills();
        await this._delay(300);
        // Enforce hand size limit — discard down to 10 if over
        await this.enforceHandLimit(this.gs.activePlayer);
        await this.switchTurn();
        break;
    }
  }

  /** Async delay helper for pacing phase transitions. */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process forced hero kills at end of turn (Golden Ankh, etc.).
   * Heroes marked with _forceKillAtTurnEnd === currentTurn are
   * killed unconditionally — bypasses all protection and hooks.
   */
  async _processForceKills() {
    let killed = false;
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero._forceKillAtTurnEnd !== this.gs.turn) continue;
        // Un-negatable kill — set HP to 0, run cleanup
        hero.hp = 0;
        delete hero._forceKillAtTurnEnd;
        this.log('force_kill', { hero: hero.name, player: ps.username, reason: 'ankh_expiry' });
        this._broadcastEvent('play_zone_animation', { type: 'explosion', owner: pi, heroIdx: hi, zoneSlot: -1 });
        await this.runHooks(HOOKS.ON_HERO_KO, { hero, source: { name: 'Golden Ankh' } });
        await this.handleHeroDeathCleanup(hero);
        killed = true;
      }
    }
    if (killed) {
      this.sync();
      await this._delay(400);
      await this.checkAllHeroesDead();
    }
  }

  /**
   * Advance to the next phase. Called by player action (socket event).
   * Returns true if advance was valid.
   */
  async advancePhase(playerIdx) {
    // Only the active player can advance
    if (playerIdx !== this.gs.activePlayer) return false;

    const current = this.gs.currentPhase;
    let nextPhase = null;

    // Determine valid transitions
    switch (current) {
      case PHASES.MAIN1:
        // Can go to Action Phase or Main Phase 2
        nextPhase = PHASES.ACTION; // Default — clicking "Action Phase"
        break;
      case PHASES.ACTION:
        // Can go to Main Phase 2 (or auto-advance after playing a card)
        nextPhase = PHASES.MAIN2;
        break;
      case PHASES.MAIN2:
        // Can go to End Phase
        nextPhase = PHASES.END;
        break;
      default:
        return false; // Can't manually advance from auto phases
    }

    if (nextPhase === null) return false;

    const phaseName = PHASE_NAMES[current];
    await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: current });
    await this.runPhase(nextPhase);
    return true;
  }

  /**
   * Advance to a specific phase (for skipping Action Phase → Main Phase 2).
   */
  async advanceToPhase(playerIdx, targetPhase) {
    if (playerIdx !== this.gs.activePlayer) return false;

    const current = this.gs.currentPhase;

    // Validate the transition is legal
    const legalTransitions = {
      [PHASES.MAIN1]: [PHASES.ACTION, PHASES.END],  // Can go to Action or skip straight to End
      [PHASES.ACTION]: [PHASES.MAIN2, PHASES.END],
      [PHASES.MAIN2]: [PHASES.END],
    };

    const allowed = legalTransitions[current];
    if (!allowed || !allowed.includes(targetPhase)) return false;

    // Clear bonus actions when leaving Action Phase
    if (current === PHASES.ACTION) {
      const ps = this.gs.players[playerIdx];
      if (ps?.bonusActions) {
        ps.bonusActions = null;
      }
    }

    const phaseName = PHASE_NAMES[current];
    await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: current });
    await this.runPhase(targetPhase);
    return true;
  }

  /**
   * Switch to the other player's turn.
   */
  async switchTurn() {
    await this.runHooks(HOOKS.ON_TURN_END, { turn: this.gs.turn, activePlayer: this.gs.activePlayer });
    // Clear first-turn full protection after the starting player's turn ends
    if (this.gs.firstTurnProtectedPlayer != null) {
      delete this.gs.firstTurnProtectedPlayer;
    }
    this.gs.activePlayer = this.gs.activePlayer === 0 ? 1 : 0;
    this.gs.turn++;
    await this.startTurn();
  }

  // ─── GOLD ACTIONS ─────────────────────────

  /**
   * Get card names in the player's hand that have custom placement rules.
   */
  getCustomPlacementCards(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const custom = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      seen.add(cardName);
      const script = loadCardEffect(cardName);
      if (script?.customPlacement) custom.push(cardName);
    }
    return custom;
  }

  /**
   * Check which creatures in the player's hand have custom canSummon
   * conditions that currently prevent summoning.
   * Returns array of card names that are blocked.
   */
  getSummonBlocked(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const blocked = [];
    for (const cardName of (ps.hand || [])) {
      const script = loadCardEffect(cardName);
      if (script?.canSummon) {
        try {
          const dummyCard = new CardInstance(cardName, playerIdx, 'hand');
          const ctx = this._createContext(dummyCard, { event: 'canSummonCheck' });
          if (!script.canSummon(ctx)) blocked.push(cardName);
        } catch (err) {
          console.error(`[Engine] canSummon check failed for "${cardName}":`, err.message);
        }
      }
    }
    return blocked;
  }

  /**
   * Check if a player's abilities are protected from removal (first-turn rule).
   * Use this in any card's getValidTargets() to skip opponent abilities during turn 1.
   * Example: if (engine.isAbilityRemovalProtected(gs, targetOwnerIdx)) { skip; }
   */
  static isAbilityRemovalProtected(gs, targetOwnerIdx) {
    return gs.firstTurnProtectedPlayer === targetOwnerIdx;
  }

  /**
   * Get spell/attack cards in hand that are blocked from being played.
   * Checks scripts with spellPlayCondition(gs, playerIdx) returning false.
   * Returns array of blocked card names.
   */
  getBlockedSpells(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const blocked = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      seen.add(cardName);
      const script = loadCardEffect(cardName);
      // Once-per-game cards
      if (script?.oncePerGame) {
        const opgKey = script.oncePerGameKey || cardName;
        if (ps._oncePerGameUsed?.has(opgKey)) {
          blocked.push(cardName);
          continue;
        }
      }
      if (script?.spellPlayCondition) {
        if (!script.spellPlayCondition(this.gs, playerIdx)) blocked.push(cardName);
      }
    }
    return blocked;
  }

  /**
   * Check which targeting artifacts in the player's hand have no valid targets.
   * Returns array of card names that can't be activated.
   */
  getUnactivatableArtifacts(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const blocked = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      seen.add(cardName);
      const script = loadCardEffect(cardName);
      if (script?.canActivate && (script.isTargetingArtifact || script.isPotion)) {
        if (!script.canActivate(this.gs, playerIdx)) blocked.push(cardName);
      }
      // Reaction cards: check reactionCondition
      if (script?.isReaction && script.reactionCondition) {
        if (!script.reactionCondition(this.gs, playerIdx, this)) blocked.push(cardName);
      }
    }
    return blocked;
  }

  async actionGainGold(playerIdx, amount) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    const hookCtx = { playerIdx, amount, cancelled: false };
    await this.runHooks(HOOKS.ON_RESOURCE_GAIN, hookCtx);
    if (hookCtx.cancelled) return;
    const gained = Math.max(0, hookCtx.amount);
    ps.gold = (ps.gold || 0) + gained;
    // ── SC tracking: cumulative gold earned ──
    if (gained > 0 && this.gs._scTracking && playerIdx >= 0 && playerIdx < 2) {
      this.gs._scTracking[playerIdx].totalGoldEarned += gained;
    }
    this.log('gold_gain', { player: ps.username, amount: gained, total: ps.gold });
    this.sync();
  }

  async actionSpendGold(playerIdx, amount) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return false;
    if ((ps.gold || 0) < amount) return false;
    const hookCtx = { playerIdx, amount, cancelled: false };
    await this.runHooks(HOOKS.ON_RESOURCE_SPEND, hookCtx);
    if (hookCtx.cancelled) return false;
    ps.gold -= hookCtx.amount;
    this.log('gold_spend', { player: ps.username, amount: hookCtx.amount, total: ps.gold });
    return true;
  }

  // ─── HERO STATUS EFFECTS ────────────────────

  /**
   * Prompt a player to select targets during an effect resolution.
   * Returns a Promise that resolves with the selected target IDs.
   * Sets gs.potionTargeting (reuses the targeting UI) with isEffectPrompt flag.
   */
  async promptEffectTarget(playerIdx, validTargets, config = {}) {
    if (!validTargets || validTargets.length === 0) return [];
    return new Promise((resolve) => {
      this._pendingPrompt = { resolve };
      this.gs.potionTargeting = {
        potionName: config.title || 'Effect',
        ownerIdx: playerIdx,
        isEffectPrompt: true,
        validTargets,
        config: {
          description: config.description || 'Select a target.',
          confirmLabel: config.confirmLabel || 'Confirm',
          confirmClass: config.confirmClass || 'btn-success',
          cancellable: config.cancellable !== undefined ? config.cancellable : true,
          exclusiveTypes: config.exclusiveTypes || false,
          maxPerType: config.maxPerType || {},
          maxTotal: config.maxTotal || undefined,
        },
      };
      this.sync();
    });
  }

  /**
   * Resolve a pending effect prompt (called by server socket handler).
   */
  resolveEffectPrompt(selectedIds) {
    if (!this._pendingPrompt) return false;
    const { resolve } = this._pendingPrompt;
    this._pendingPrompt = null;
    this.gs.potionTargeting = null;
    resolve(selectedIds || []);
    return true;
  }

  // ─── GENERAL-PURPOSE PROMPT SYSTEM ─────────
  // Uses gs.effectPrompt for state sync (survives reconnects).
  // Types: 'confirm', 'cardGallery', 'zonePick'

  // ─── TARGET REDIRECT (Challenge, etc.) ────────

  /**
   * Check if the selected target's owner has a redirect card (Challenge, etc.).
   * Called by promptDamageTarget after target selection.
   * If a redirect is activated, returns the new target. Otherwise null.
   *
   * @param {number} targetOwnerIdx - Owner of the selected target
   * @param {object} selected - The selected target { id, type, owner, heroIdx, cardName, ... }
   * @param {Array} validTargets - All valid targets for the effect
   * @param {object} config - The targeting config from promptDamageTarget
   * @param {CardInstance} sourceCard - The card that initiated the targeting
   * @returns {object|null} Redirected target, or null
   */
  async _checkTargetRedirect(targetOwnerIdx, selected, validTargets, config, sourceCard) {
    const ps = this.gs.players[targetOwnerIdx];
    if (!ps) return null;

    // Scan hand for redirect cards
    const seen = new Set();
    for (let hi = 0; hi < ps.hand.length; hi++) {
      const cardName = ps.hand[hi];
      if (seen.has(cardName)) continue;
      seen.add(cardName);

      const script = loadCardEffect(cardName);
      if (!script?.isTargetRedirect) continue;

      // Check card-specific redirect eligibility
      if (script.canRedirect && !script.canRedirect(this.gs, targetOwnerIdx, selected, validTargets, config, this)) continue;

      // Prompt the target's owner
      const attackerName = config.title || sourceCard?.name || 'an effect';
      const confirmed = await this.promptGeneric(targetOwnerIdx, {
        type: 'confirm',
        title: cardName,
        message: `Your ${selected.cardName} was targeted by ${attackerName}! Activate ${cardName}?`,
        confirmLabel: `⚔️ ${cardName}!`,
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed) continue; // Declined — check next redirect card

      // Run the card's redirect logic (hero selection, chain UI, etc.)
      const result = await script.onRedirect(this, targetOwnerIdx, selected, validTargets, config, sourceCard);
      if (!result?.redirectTo) continue; // Redirect was cancelled

      // Consume the card from hand
      const removeIdx = ps.hand.indexOf(cardName);
      if (removeIdx >= 0) {
        ps.hand.splice(removeIdx, 1);
        ps.discardPile.push(cardName);
        // Untrack hand instance
        const inst = this.cardInstances.find(c =>
          c.owner === targetOwnerIdx && c.zone === 'hand' && c.name === cardName
        );
        if (inst) this._untrackCard(inst.id);
      }

      // Reveal to other player + spectators
      const otherIdx = targetOwnerIdx === 0 ? 1 : 0;
      const otherSid = this.gs.players[otherIdx]?.socketId;
      if (otherSid) this.io.to(otherSid).emit('card_reveal', { cardName });
      if (this.room.spectators) {
        for (const spec of this.room.spectators) {
          if (spec.socketId) this.io.to(spec.socketId).emit('card_reveal', { cardName });
        }
      }

      this.log('target_redirect', {
        redirectCard: cardName,
        originalTarget: selected.cardName,
        newTarget: result.redirectTo.cardName,
        player: ps.username,
      });

      return result.redirectTo;
    }

    return null; // No redirect
  }

  /**
   * Show a generic prompt to a player. Returns a Promise that resolves
   * when the player responds (or null/false if cancelled).
   * @param {number} playerIdx
   * @param {object} promptData - { type, title, ...typeSpecificData }
   */
  async promptGeneric(playerIdx, promptData) {
    return new Promise((resolve) => {
      this._pendingGenericPrompt = { resolve };
      this.gs.effectPrompt = { ...promptData, ownerIdx: playerIdx };
      this.sync();
    });
  }

  /**
   * Resolve a pending generic prompt. Called by server socket handler.
   * @param {object} response - { cancelled, ...typeSpecificData }
   */
  resolveGenericPrompt(response) {
    if (!this._pendingGenericPrompt) return false;
    const { resolve } = this._pendingGenericPrompt;
    this._pendingGenericPrompt = null;
    this.gs.effectPrompt = null;
    if (response?.cancelled) {
      resolve(null);
    } else {
      resolve(response);
    }
    this.sync();
    return true;
  }

  // ─── HARD ONCE PER TURN (HOPT) ────────────
  /**
   * Claim a "hard once per turn" slot for the given key and player.
   * Returns true if this is the first claim this turn (effect proceeds).
   * Returns false if already claimed this turn (effect should be skipped).
   * No manual reset needed — automatically resets each turn via turn counter.
   *
   * Usage in card scripts:
   *   if (!engine.claimHOPT('icy-slime', ctx.cardOwner)) return;
   */
  claimHOPT(key, playerIdx) {
    if (!this.gs.hoptUsed) this.gs.hoptUsed = {};
    const hoptKey = `${key}:${playerIdx}`;
    if (this.gs.hoptUsed[hoptKey] === this.gs.turn) return false;
    this.gs.hoptUsed[hoptKey] = this.gs.turn;
    return true;
  }

  // ─── REACTION CHAIN SYSTEM ─────────────────

  /** Human-readable descriptions for hook events (for reaction prompts) */
  static HOOK_DESCRIPTIONS = {
    onTurnStart: 'The turn has just started',
    onPhaseEnd: 'The phase has ended',
    onCardLeaveZone: 'A card left the field',
    onAttackDeclare: 'An attack was declared',
    afterDamage: 'Damage was just dealt',
    onHeroKO: 'A hero was knocked out',
    onResourceGain: 'Resources were gained',
    onStatusApplied: 'A status effect was applied',
    onStatusRemoved: 'A status effect was removed',
    afterLevelChange: 'A level was changed',
    onDiscard: 'A card was discarded',
    onCreatureSummoned: 'A creature was just summoned',
    onCardActivation: 'A card was activated',
    onReactionActivated: 'A reaction was activated',
  };

  /** Hooks that should NOT trigger reaction checks */
  static REACTION_SKIP_HOOKS = new Set([
    'onPlay', 'onCardEnterZone', 'onPhaseStart', 'onGameStart', 'onBeforeHandDraw',
    'onChainStart', 'onChainResolve', 'onEffectNegated',
    'beforeDamage', 'beforeLevelChange',
    'onResourceSpend', 'onReactionActivated', 'onCardActivation',
    'onActionUsed', 'onAdditionalActionUsed',
  ]);

  /**
   * Execute a card's effect with a reaction window before it resolves.
   * If reactions fire, a chain is built (LIFO). The initial card resolves
   * last — or is negated and sent to discard.
   *
   * @param {object} cardInfo - { cardName, owner, cardType, resolve: async()=>result }
   * @returns {{ negated: boolean, chainFormed: boolean, resolveResult: any }}
   */
  async executeCardWithChain(cardInfo) {
    const { cardName, owner, cardType, resolve, goldCost } = cardInfo;

    const initialLink = {
      id: uuidv4().substring(0, 12),
      cardName, owner,
      cardType: cardType || 'Unknown',
      goldCost: goldCost || 0,
      isInitialCard: true,
      negated: false,
      chainClosed: false,
      resolve: resolve || null,
      resolveResult: null,
    };

    this._inReactionCheck = true;
    try {
      const eventDesc = `${cardName} was activated`;
      const chain = await this._runReactionWindow(initialLink, eventDesc);

      if (!chain) {
        // No reactions — resolve normally (no chain visualization)
        this._inReactionCheck = false;
        let resolveResult = null;
        if (resolve) resolveResult = await resolve();
        return { negated: false, chainFormed: false, resolveResult };
      }

      return {
        negated: initialLink.negated,
        chainFormed: true,
        resolveResult: initialLink.resolveResult || null,
      };
    } finally {
      this._inReactionCheck = false;
    }
  }

  /**
   * Check if any player has activatable reaction cards.
   * If reactions fire, builds a chain and resolves LIFO.
   * Replaces the old sequential reaction processing.
   */
  async _checkReactionCards(hookName, hookCtx) {
    if (GameEngine.REACTION_SKIP_HOOKS.has(hookName)) return;
    if (!GameEngine.HOOK_DESCRIPTIONS[hookName]) return;

    const eventDesc = GameEngine.HOOK_DESCRIPTIONS[hookName];

    // Optional initial card from hookCtx (e.g. creature that was just summoned)
    let initialLink = null;
    if (hookCtx._initialCard) {
      initialLink = {
        id: uuidv4().substring(0, 12),
        cardName: hookCtx._initialCard.cardName,
        owner: hookCtx._initialCard.owner,
        cardType: hookCtx._initialCard.cardType || 'Unknown',
        goldCost: hookCtx._initialCard.goldCost || 0,
        isInitialCard: true,
        negated: false, chainClosed: false,
        resolve: hookCtx._initialCard.resolve || null,
        resolveResult: null,
      };
    }

    this._inReactionCheck = true;
    try {
      const chain = await this._runReactionWindow(initialLink, eventDesc);
      if (chain && initialLink) {
        hookCtx._initialCardNegated = initialLink.negated;
      }
    } finally {
      this._inReactionCheck = false;
    }
  }

  /**
   * Core chain builder: checks for reactions, builds chain, resolves LIFO.
   * @param {object|null} initialLink - First link (the card being reacted to), or null
   * @param {string} eventDesc - Human-readable event description
   * @returns {Array|null} The resolved chain, or null if no reactions fired
   */
  async _runReactionWindow(initialLink, eventDesc) {
    const chain = initialLink ? [initialLink] : [];
    const ap = this.gs.activePlayer;
    const nonAp = ap === 0 ? 1 : 0;
    const checkOrder = [nonAp, ap];

    // Check for first reaction
    const found = await this._promptReactionsForChain(chain, checkOrder, eventDesc);
    if (!found) return null;

    // Chain formed — broadcast only if 2+ links
    if (chain.length >= 2) this._broadcastChainUpdate(chain);

    // Continue building (reaction-to-reaction)
    while (!chain[chain.length - 1].chainClosed) {
      const more = await this._promptReactionsForChain(chain, checkOrder, eventDesc);
      if (!more) break;
      if (chain.length >= 2) this._broadcastChainUpdate(chain);
    }

    // Resolve LIFO
    await this._resolveReactionChain(chain);
    return chain;
  }

  /**
   * Iterate through players checking for available reaction cards.
   * Prompts the player, and if activated, adds the reaction to the chain.
   * @returns {boolean} Whether a reaction was added
   */
  async _promptReactionsForChain(chain, checkOrder, eventDesc) {
    const allCards = this._getCardDB();

    for (const pi of checkOrder) {
      const ps = this.gs.players[pi];
      if (!ps) continue;

      for (let hi = 0; hi < ps.hand.length; hi++) {
        const cardName = ps.hand[hi];
        const script = loadCardEffect(cardName);
        if (!script?.isReaction) continue;

        const cardData = allCards[cardName];
        const baseCost = cardData?.cost || 0;
        // Support dynamic cost (Tool Freezer, etc.) — overrides card data cost
        const chainCtx = { chain, eventDesc };
        const cost = script.dynamicCost
          ? script.dynamicCost(this.gs, pi, this, chainCtx)
          : baseCost;
        if ((ps.gold || 0) < cost) continue;

        // Check reaction condition with chain context
        if (script.reactionCondition && !script.reactionCondition(this.gs, pi, this, chainCtx)) continue;

        // Prompt the player
        const confirmed = await this.promptGeneric(pi, {
          type: 'confirm',
          title: cardName,
          message: `${eventDesc}. Activate ${cardName}?`,
          confirmLabel: 'Activate!',
          cancelLabel: 'No',
          cancellable: true,
        });

        if (!confirmed) continue;

        // Activate the reaction
        if (cost > 0) ps.gold -= cost;
        ps.hand.splice(hi, 1);

        this.log('reaction_activated', { card: cardName, player: ps.username, chainPosition: chain.length });

        const link = {
          id: uuidv4().substring(0, 12),
          cardName, owner: pi,
          cardType: cardData?.cardType || 'Unknown',
          goldCost: cost,
          isInitialCard: false,
          negated: false, chainClosed: false,
          resolve: script.resolve
            ? async (ch, idx) => await script.resolve(this, pi, null, null, ch, idx)
            : null,
          script,
        };

        chain.push(link);
        if (chain.length >= 2) this._broadcastChainUpdate(chain);

        // Fire onReactionActivated hook (for board passives)
        await this.runHooks('onReactionActivated', {
          reactionCardName: cardName, reactionOwner: pi, chain,
          _skipReactionCheck: true, _isReaction: true,
        });

        // Script-specific post-add logic (Camera's 3G close prompt)
        if (script.onChainAdd) {
          await script.onChainAdd(this, pi, chain, link);
          if (chain.length >= 2) this._broadcastChainUpdate(chain);
        }

        this.sync();
        return true; // Restart check loop
      }
    }
    return false;
  }

  /**
   * Resolve a reaction chain in LIFO order.
   * Negated links show negation visual and skip resolve.
   * Non-initial links go to discard after resolve/negation.
   */
  async _resolveReactionChain(chain) {
    this._broadcastEvent('reaction_chain_resolving_start', {});
    await this._delay(500);

    for (let i = chain.length - 1; i >= 0; i--) {
      const link = chain[i];

      if (link.negated) {
        // Negation visual — glitch + 🚫 (or custom style like ice)
        this._broadcastEvent('reaction_chain_link_negated', {
          linkIndex: i, cardName: link.cardName, owner: link.owner,
          negationStyle: link.negationStyle || null,
        });
        this.log('card_negated', { card: link.cardName, owner: link.owner });
        await this._delay(600);

        // Negated non-initial cards go to discard
        if (!link.isInitialCard) {
          const ps = this.gs.players[link.owner];
          if (ps) ps.discardPile.push(link.cardName);
        }
      } else {
        // Resolve glow
        this._broadcastEvent('reaction_chain_link_resolving', {
          linkIndex: i, cardName: link.cardName, owner: link.owner,
        });
        await this._delay(400);

        if (link.resolve) {
          try {
            const result = await link.resolve(chain, i);
            if (link.isInitialCard) link.resolveResult = result;
          } catch (err) {
            console.error(`[Engine] Chain resolve failed for "${link.cardName}":`, err.message);
          }
        }

        // Non-initial cards go to discard after resolving
        if (!link.isInitialCard) {
          await this._delay(250);
          const ps = this.gs.players[link.owner];
          if (ps) ps.discardPile.push(link.cardName);
        }

        this._broadcastEvent('reaction_chain_link_resolved', {
          linkIndex: i, cardName: link.cardName, owner: link.owner,
        });
        await this._delay(300);
      }

      this.sync();
    }

    this._broadcastEvent('reaction_chain_done', {});
    await this._delay(400);
  }

  /**
   * Negate a specific link in a reaction chain.
   * Called by card effects (Camera, etc.) during LIFO resolution.
   */
  negateChainLink(chain, linkIndex, opts = {}) {
    if (linkIndex >= 0 && linkIndex < chain.length) {
      chain[linkIndex].negated = true;
      if (opts.negationStyle) chain[linkIndex].negationStyle = opts.negationStyle;
    }
  }

  /** Broadcast chain state to both clients */
  _broadcastChainUpdate(chain) {
    this._broadcastEvent('reaction_chain_update', {
      links: chain.map(l => ({
        id: l.id, cardName: l.cardName, owner: l.owner,
        cardType: l.cardType, isInitialCard: l.isInitialCard,
        negated: l.negated, negationStyle: l.negationStyle || null, chainClosed: l.chainClosed,
      })),
    });
  }

  // ─── ADDITIONAL ACTIONS ────────────────────
  /**
   * Register an additional action type. Call from card scripts.
   * @param {string} typeId - Unique ID (e.g., 'summon_slime_not_rancher')
   * @param {object} config - {
   *   label: string,
   *   allowedCategories: string[] - which action categories this covers:
   *     'creature', 'spell', 'attack', 'ability_activation', 'hero_effect_activation'
   *   filter?: (cardData) → bool - optional hand card filter (for creature/spell/attack)
   * }
   */
  registerAdditionalActionType(typeId, config) {
    this._additionalActionTypes[typeId] = config;
  }

  /**
   * Grant an additional action from a specific card instance.
   * Sets counters on the card to track availability.
   */
  grantAdditionalAction(cardInstance, typeId) {
    cardInstance.counters.additionalActionType = typeId;
    cardInstance.counters.additionalActionAvail = 1;
  }

  /**
   * Expire (remove) the additional action from a specific card instance.
   */
  expireAdditionalAction(cardInstance) {
    cardInstance.counters.additionalActionAvail = 0;
  }

  /**
   * Expire ALL additional actions of a given type for a player.
   */
  expireAllAdditionalActions(playerIdx, typeId) {
    for (const inst of this.cardInstances) {
      if (inst.owner === playerIdx && inst.counters.additionalActionType === typeId && inst.counters.additionalActionAvail) {
        inst.counters.additionalActionAvail = 0;
      }
    }
  }

  /**
   * Get all available additional actions for a player.
   * Returns array of { typeId, label, actionType, providers: [{cardId, cardName, heroIdx, zoneSlot}], eligibleHandCards: [cardName] }
   */
  getAdditionalActions(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];

    // Group providers by typeId
    const byType = {};
    for (const inst of this.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (!inst.counters.additionalActionType || !inst.counters.additionalActionAvail) continue;
      const typeId = inst.counters.additionalActionType;
      const config = this._additionalActionTypes[typeId];
      if (!config) continue;
      if (!byType[typeId]) byType[typeId] = { typeId, label: config.label, allowedCategories: config.allowedCategories || [], providers: [], eligibleHandCards: [] };
      byType[typeId].providers.push({ cardId: inst.id, cardName: inst.name, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot });
    }

    // For each type, compute eligible hand cards
    const allCards = this._getCardDB();
    for (const [typeId, entry] of Object.entries(byType)) {
      const config = this._additionalActionTypes[typeId];
      if (!config?.filter) continue;
      const seen = new Set();
      for (const cardName of (ps.hand || [])) {
        if (seen.has(cardName)) continue;
        const cardData = allCards[cardName];
        if (cardData && config.filter(cardData)) {
          seen.add(cardName);
          entry.eligibleHandCards.push(cardName);
        }
      }
    }

    return Object.values(byType);
  }

  /**
   * Consume one additional action of the given type for a player.
   * If providerCardId is specified, consume that specific provider.
   * Otherwise, consume the first available.
   * Returns the consumed provider's card instance, or null.
   */
  consumeAdditionalAction(playerIdx, typeId, providerCardId) {
    for (const inst of this.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (inst.counters.additionalActionType !== typeId) continue;
      if (!inst.counters.additionalActionAvail) continue;
      if (providerCardId && inst.id !== providerCardId) continue;
      // Decrement (supports multi-charge providers like Ghuanjun combo)
      inst.counters.additionalActionAvail = Math.max(0, (inst.counters.additionalActionAvail || 1) - 1);
      this.log('additional_action_used', { typeId, provider: inst.name, remaining: inst.counters.additionalActionAvail, player: this.gs.players[playerIdx]?.username });
      return inst;
    }
    return null;
  }

  /**
   * Check if a hand card can be played via any additional action.
   * Returns the matching typeId or null.
   */
  findAdditionalActionForCard(playerIdx, cardName) {
    const allCards = this._getCardDB();
    const cardData = allCards[cardName];
    if (!cardData) return null;

    // Map card type to category
    const typeToCategory = { Creature: 'creature', Spell: 'spell', Attack: 'attack' };
    const category = typeToCategory[cardData.cardType];
    if (!category) return null;

    for (const inst of this.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (!inst.counters.additionalActionType || !inst.counters.additionalActionAvail) continue;
      const typeId = inst.counters.additionalActionType;
      const config = this._additionalActionTypes[typeId];
      if (!config) continue;
      // Check category
      if (config.allowedCategories && !config.allowedCategories.includes(category)) continue;
      // Check specific filter (e.g., Slime Rancher's archetype filter)
      if (config.filter && !config.filter(cardData)) continue;
      return typeId;
    }
    return null;
  }

  /** Lazy-load card database (cached) */
  _getCardDB() {
    if (!this._cardDB) {
      const allCards = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8'));
      this._cardDB = {};
      allCards.forEach(c => { this._cardDB[c.name] = c; });
    }
    return this._cardDB;
  }

  /**
   * Check if a player has any available additional action covering a specific category.
   */
  hasAdditionalActionForCategory(playerIdx, category) {
    for (const inst of this.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (!inst.counters.additionalActionType || !inst.counters.additionalActionAvail) continue;
      const config = this._additionalActionTypes[inst.counters.additionalActionType];
      if (config?.allowedCategories?.includes(category)) return true;
    }
    return false;
  }

  /**
   * Get all abilities on the board that can be activated (cost an action) for a player.
   * Checks: script has actionCost, hero alive/not frozen/stunned, HOPT not used.
   * Returns array of { heroIdx, zoneIdx, abilityName, level }
   */
  getActivatableAbilities(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (this.gs.activePlayer !== playerIdx) return [];
    const result = [];
    const currentPhase = this.gs.currentPhase;
    const isActionPhase = currentPhase === 3;
    const isMainPhase = currentPhase === 2 || currentPhase === 4;

    // Check if action is available (Action Phase or Additional Action with ability_activation)
    const hasAdditional = isMainPhase && this.hasAdditionalActionForCategory(playerIdx, 'ability_activation');
    if (!isActionPhase && !hasAdditional) return [];

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

      for (let zi = 0; zi < (ps.abilityZones[hi] || []).length; zi++) {
        const slot = (ps.abilityZones[hi] || [])[zi] || [];
        if (slot.length === 0) continue;
        const abilityName = slot[0]; // Base ability name (wildcard abilities stack on top)
        const script = loadCardEffect(abilityName);
        if (!script?.actionCost) continue;

        // Check HOPT
        const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
        if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

        // Check script-defined activation condition (Necromancy, etc.)
        if (script.canActivateAction && !script.canActivateAction(this.gs, playerIdx, hi, slot.length, this)) continue;

        result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length });
      }
    }
    return result;
  }

  // ─── ACTIVE HERO EFFECTS ─────────────────
  /**
   * Get heroes with activatable hero effects for a player.
   * Only returns heroes that CAN activate right now (never grayed out).
   * Checks: script has heroEffect, hero alive/not frozen/stunned/negated, HOPT, canActivateHeroEffect.
   * Must be during Main Phase.
   * Returns array of { heroIdx, heroName }
   */
  getActiveHeroEffects(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (this.gs.activePlayer !== playerIdx) return [];
    const result = [];
    const currentPhase = this.gs.currentPhase;
    const isMainPhase = currentPhase === 2 || currentPhase === 4;
    if (!isMainPhase) return [];

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

      const script = loadCardEffect(hero.name);
      if (!script?.heroEffect) continue;

      // HOPT per hero instance (soft — each copy is independent)
      const hoptKey = `hero-effect:${hero.name}:${playerIdx}:${hi}`;
      if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

      // Check canActivateHeroEffect
      if (script.canActivateHeroEffect) {
        try {
          const inst = this.cardInstances.find(c =>
            c.owner === playerIdx && c.zone === 'hero' && c.heroIdx === hi
          );
          if (!inst) continue;
          const ctx = this._createContext(inst, { event: 'canHeroEffectCheck' });
          if (!script.canActivateHeroEffect(ctx)) continue;
        } catch (err) {
          console.error(`[Engine] canActivateHeroEffect failed for "${hero.name}":`, err.message);
          continue;
        }
      }

      result.push({ heroIdx: hi, heroName: hero.name });
    }

    // Also check equipped hero cards in support zones (Initiation Ritual)
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

      for (const inst of this.cardInstances) {
        if (inst.owner !== playerIdx || inst.zone !== 'support' || inst.heroIdx !== hi) continue;
        if (!inst.counters?.treatAsEquip) continue;
        const equipScript = loadCardEffect(inst.name);
        if (!equipScript?.heroEffect) continue;

        const hoptKey = `hero-effect:${inst.name}:${playerIdx}:${hi}`;
        if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

        if (equipScript.canActivateHeroEffect) {
          try {
            const ctx = this._createContext(inst, { event: 'canHeroEffectCheck' });
            if (!equipScript.canActivateHeroEffect(ctx)) continue;
          } catch { continue; }
        }

        result.push({ heroIdx: hi, heroName: hero.name, equippedCard: inst.name });
        // No break — allow multiple equipped hero effects per hero
      }
    }

    return result;
  }

  // ─── FREE ABILITY ACTIVATION ─────────────
  /**
   * Get all abilities on the board that have freeActivation (no action cost,
   * usable during Main Phase). Returns entries for ALL such abilities,
   * including exhausted/unusable ones so the frontend can gray them out.
   *
   * HOPT rule: once ANY copy of an ability name resolves, ALL copies of
   * that name are exhausted for the rest of the turn for that player.
   *
   * Returns array of { heroIdx, zoneIdx, abilityName, level, canActivate, exhausted }
   */
  getFreeActivatableAbilities(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (this.gs.activePlayer !== playerIdx) return [];
    const result = [];
    const currentPhase = this.gs.currentPhase;
    const isMainPhase = currentPhase === 2 || currentPhase === 4;

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

      for (let zi = 0; zi < (ps.abilityZones[hi] || []).length; zi++) {
        const slot = (ps.abilityZones[hi] || [])[zi] || [];
        if (slot.length === 0) continue;
        const abilityName = slot[0];
        const script = loadCardEffect(abilityName);
        if (!script?.freeActivation) continue;

        // HOPT by ability NAME — blocks all copies for this player
        const hoptKey = `free-ability:${abilityName}:${playerIdx}`;
        const exhausted = this.gs.hoptUsed?.[hoptKey] === this.gs.turn;

        let canActivate = !exhausted && isMainPhase;

        // Check script's canFreeActivate condition
        if (canActivate && script.canFreeActivate) {
          try {
            const inst = this.cardInstances.find(c =>
              c.owner === playerIdx && c.zone === 'ability' && c.heroIdx === hi && c.zoneSlot === zi
            );
            if (inst) {
              const ctx = this._createContext(inst, { event: 'canFreeActivateCheck' });
              canActivate = !!script.canFreeActivate(ctx, slot.length);
            } else {
              canActivate = false;
            }
          } catch (err) {
            console.error(`[Engine] canFreeActivate check failed for "${abilityName}":`, err.message);
            canActivate = false;
          }
        }

        result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, canActivate, exhausted });
      }
    }
    return result;
  }

  /**
   * Attach an ability card from hand to a hero's ability zone.
   * Handles standard placement, custom placement, and optionally skips
   * the "one ability per hero per turn" limit.
   *
   * @param {number} playerIdx
   * @param {string} cardName
   * @param {number} heroIdx
   * @param {object} opts - { skipAbilityGivenCheck: boolean, targetZoneSlot: number }
   * @returns {{ success: boolean, zoneSlot?: number, inst?: CardInstance }}
   */
  async attachAbilityFromHand(playerIdx, cardName, heroIdx, opts = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return { success: false };
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return { success: false };

    const handIdx = ps.hand.indexOf(cardName);
    if (handIdx < 0) return { success: false };

    const abZones = ps.abilityZones[heroIdx] || [[], [], []];
    ps.abilityZones[heroIdx] = abZones;

    const script = loadCardEffect(cardName);
    let targetZone = -1;

    // If a specific zone was requested (e.g. player dragged onto a specific slot), try it first
    if (opts.targetZoneSlot !== undefined && opts.targetZoneSlot >= 0 && opts.targetZoneSlot < 3) {
      const reqSlot = abZones[opts.targetZoneSlot] || [];
      if (script?.customPlacement) {
        if (script.customPlacement.canPlace(reqSlot)) targetZone = opts.targetZoneSlot;
      } else {
        if (reqSlot.length > 0 && reqSlot[0] === cardName && reqSlot.length < 3) targetZone = opts.targetZoneSlot;
        else if (reqSlot.length === 0) targetZone = opts.targetZoneSlot;
      }
    }

    // If no specific zone requested or it wasn't valid, auto-find
    if (targetZone < 0) {
      if (script?.customPlacement) {
        // Custom placement (Performance, etc.)
        for (let z = 0; z < 3; z++) {
          const slot = abZones[z] || [];
          if (script.customPlacement.canPlace(slot)) { targetZone = z; break; }
        }
      } else {
        // Standard: stack onto existing or find free zone
        for (let z = 0; z < 3; z++) {
          if ((abZones[z] || []).length > 0 && abZones[z][0] === cardName && abZones[z].length < 3) {
            targetZone = z; break;
          }
        }
        if (targetZone < 0) {
          for (let z = 0; z < 3; z++) {
            if ((abZones[z] || []).length === 0) { targetZone = z; break; }
          }
        }
      }
    }

    if (targetZone < 0) return { success: false };

    // Defensive: re-verify card is still in hand at expected position
    const verifyIdx = ps.hand.indexOf(cardName);
    if (verifyIdx < 0) return { success: false };

    // Execute: remove from hand, add to zone
    ps.hand.splice(verifyIdx, 1);
    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(cardName);

    // Consume abilityGivenThisTurn unless opted out
    if (!opts.skipAbilityGivenCheck) {
      ps.abilityGivenThisTurn[heroIdx] = true;
    }

    // Track card instance
    const inst = this._trackCard(cardName, playerIdx, 'ability', heroIdx, targetZone);

    // Fire hooks
    await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'ability', heroIdx, _skipReactionCheck: true });
    await this.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx, _skipReactionCheck: true });

    this.sync();
    return { success: true, zoneSlot: targetZone, inst };
  }

  /**
   * Count how many ability cards in a hero's ability zones match a given spell school.
   * Wildcard abilities (e.g. Performance with isWildcardAbility: true) count as the
   * base ability's school when stacked on top.
   * @param {string} school - Spell school name to count
   * @param {Array} abZones - The hero's ability zones array (e.g. ps.abilityZones[heroIdx])
   * @returns {number} count of matching abilities
   */
  countAbilitiesForSchool(school, abZones) {
    let count = 0;
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const base = slot[0];
      for (const ab of slot) {
        if (ab === school) { count++; }
        else if (base === school && loadCardEffect(ab)?.isWildcardAbility) { count++; }
      }
    }
    return count;
  }

  /**
   * Check if a specific ability card can be attached to a specific hero.
   * Used by Training and other effects to determine valid targets.
   * @param {number} playerIdx
   * @param {string} cardName - Ability card name
   * @param {number} heroIdx
   * @returns {boolean}
   */
  canAttachAbilityToHero(playerIdx, cardName, heroIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return false;
    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const abZones = ps.abilityZones[heroIdx] || [[], [], []];
    const script = loadCardEffect(cardName);

    if (script?.customPlacement) {
      return abZones.some(slot => script.customPlacement.canPlace(slot || []));
    }

    // Standard: can stack onto existing (< 3) or go into empty zone
    for (let z = 0; z < 3; z++) {
      const slot = abZones[z] || [];
      if (slot.length > 0 && slot[0] === cardName && slot.length < 3) return true;
      if (slot.length === 0) return true;
    }
    return false;
  }

  async addHeroStatus(playerIdx, heroIdx, statusName, opts = {}) {
    const hero = this.gs.players[playerIdx]?.heroes?.[heroIdx];
    if (!hero || !hero.name) return;
    if (!hero.statuses) hero.statuses = {};

    // Helper: play the animation even when blocked (the effect visually "hits" but doesn't stick)
    const playBlockedAnim = () => {
      if (opts.animationType) {
        this._broadcastEvent('play_zone_animation', {
          type: opts.animationType, owner: playerIdx, heroIdx, zoneSlot: -1,
        });
      }
    };

    // Shielded (first-turn protection) blocks ALL status effects — no exceptions
    if (hero.statuses.shielded && statusName !== 'shielded') {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: 'shielded' });
      playBlockedAnim();
      return;
    }

    // Submerged heroes: immune to all status effects while owner has other alive non-submerged heroes
    if (hero.buffs?.submerged) {
      const ps = this.gs.players[playerIdx];
      const otherAlive = (ps.heroes || []).some(h => h !== hero && h.name && h.hp > 0 && !h.buffs?.submerged);
      if (otherAlive) {
        this.log('status_blocked', { target: hero.name, status: statusName, reason: 'submerged' });
        playBlockedAnim();
        return;
      }
    }

    // Regular Immune (post-CC) only blocks CC effects: frozen, stunned, negated
    // Can be bypassed via opts.bypassImmune (Tiger Kick 3rd attack, etc.)
    const CC_STATUSES = ['frozen', 'stunned', 'negated'];

    // Universal negative status immunity (Divine Gift of Coolness, etc.)
    const statusDef = STATUS_EFFECTS[statusName];
    if (statusDef?.negative && hero.buffs?.negative_status_immune) {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: 'negative_status_immune' });
      playBlockedAnim();
      return;
    }

    if (!opts.bypassImmune && hero.statuses.immune && CC_STATUSES.includes(statusName)) {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: 'immune' });
      playBlockedAnim();
      return;
    }

    // Per-status immunity (e.g. poison_immune blocks poisoned, freeze_immune blocks frozen)
    if (statusDef?.immuneKey && hero.statuses[statusDef.immuneKey]) {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: statusDef.immuneKey });
      playBlockedAnim();
      return;
    }

    // Poison stacking: if already poisoned, add/set stacks
    if (statusName === 'poisoned' && hero.statuses.poisoned) {
      let newStacks;
      if (opts.addStacks) {
        newStacks = (hero.statuses.poisoned.stacks || 1) + opts.addStacks;
      } else if (opts.stacks) {
        newStacks = opts.stacks; // Set mode (Tea transfer)
      } else {
        newStacks = (hero.statuses.poisoned.stacks || 1) + 1; // Default: +1
      }
      hero.statuses.poisoned.stacks = newStacks;
      this.log('status_add', { target: hero.name, status: 'poisoned', stacks: newStacks, owner: playerIdx });
      await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target: hero, heroOwner: playerIdx, heroIdx, statusName });
      this.sync();
      return;
    }

    const statusOpts = { appliedTurn: this.gs.turn, appliedBy: opts.appliedBy ?? -1, ...opts };
    if (statusName === 'poisoned') {
      statusOpts.stacks = opts.addStacks || opts.stacks || 1;
      delete statusOpts.addStacks; // Clean up
    }
    hero.statuses[statusName] = statusOpts;
    this.log('status_add', { target: hero.name, status: statusName, owner: playerIdx });
    await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target: hero, heroOwner: playerIdx, heroIdx, statusName });
    this.sync();
  }

  async removeHeroStatus(playerIdx, heroIdx, statusName) {
    const hero = this.gs.players[playerIdx]?.heroes?.[heroIdx];
    if (!hero || !hero.name || !hero.statuses?.[statusName]) return;
    delete hero.statuses[statusName];
    this.log('status_remove', { target: hero.name, status: statusName, owner: playerIdx });
    await this.runHooks(HOOKS.ON_STATUS_REMOVED, { target: hero, heroOwner: playerIdx, heroIdx, statusName });
  }

  /**
   * Process status expiry at turn boundaries.
   * END of a player's turn: Remove Frozen/Stunned → add Immune
   * START of a player's turn: Remove Immune
   */
  async processStatusExpiry(phaseName) {
    const ap = this.gs.activePlayer;
    const ps = this.gs.players[ap];
    if (!ps) return;

    if (phaseName === 'END') {
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || !hero.statuses) continue;
        let clearedCC = false;
        if (hero.statuses.frozen) { await this.removeHeroStatus(ap, hi, 'frozen'); clearedCC = true; }
        if (hero.statuses.stunned) { await this.removeHeroStatus(ap, hi, 'stunned'); clearedCC = true; }
        if (hero.statuses.negated) { await this.removeHeroStatus(ap, hi, 'negated'); clearedCC = true; }
        if (clearedCC) await this.addHeroStatus(ap, hi, 'immune', {});
      }
    } else if (phaseName === 'START') {
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || !hero.statuses) continue;
        if (hero.statuses.shielded) await this.removeHeroStatus(ap, hi, 'shielded');
        if (hero.statuses.immune) await this.removeHeroStatus(ap, hi, 'immune');
      }
    }
  }

  // ─── CREATURE DAMAGE (GENERIC BATCHED) ────
  /**
   * Deal damage to one or more creatures in a single batch.
   * Fires beforeCreatureDamageBatch hook so passive effects (Diamond, etc.)
   * can inspect/cancel/modify all entries at once.
   *
   * @param {Array} entries - [{
   *   inst: CardInstance,
   *   amount: number,
   *   type: string ('fire','poison','destruction_spell','attack','other',...),
   *   source: any (source card/object),
   *   sourceOwner: number (-1 = system/status),
   *   canBeNegated: boolean (default true),
   *   isStatusDamage: boolean (burn/poison tick),
   *   animType?: string (zone animation type to play before damage),
   * }]
   */
  async processCreatureDamageBatch(entries) {
    if (!entries || entries.length === 0) return;

    // Annotate entries with cancelled flag and init HP
    const cardDB = this._getCardDB();
    for (const e of entries) {
      e.cancelled = false;
      const cd = cardDB[e.inst.name];
      const maxHp = cd?.hp || 0;
      if (!e.inst.counters.currentHp) e.inst.counters.currentHp = maxHp;
      // Store original card level for Effect 1 type checks
      e.originalLevel = cd?.level ?? 0;
      // Track which hero dealt this damage (from source.heroIdx if available)
      e.sourceHeroIdx = e.source?.heroIdx ?? -1;
    }

    // Fire batch hook — cards like Diamond can inspect/cancel entries
    await this.runHooks(HOOKS.BEFORE_CREATURE_DAMAGE_BATCH, {
      entries,
      _skipReactionCheck: true,
    });

    // Flame Avalanche lock: if source player's damageLocked is true,
    // ALL damage to opponent's creatures becomes 0 (ABSOLUTE — overrides everything)
    for (const e of entries) {
      if (e.cancelled) continue;
      // Apply buff damage modifiers (Cloudy, etc.) — skipped for un-reducible damage
      if (e.canBeNegated !== false && e.inst.counters?.buffs) {
        for (const [, bd] of Object.entries(e.inst.counters.buffs)) {
          if (bd.damageMultiplier != null) {
            e.amount = Math.ceil(e.amount * bd.damageMultiplier);
          }
        }
      }
      if (e.sourceOwner >= 0 && this.gs.players[e.sourceOwner]?.damageLocked) {
        if (e.inst.owner !== e.sourceOwner) {
          e.amount = 0;
        }
      }
    }

    // Apply damage to non-cancelled entries
    for (const e of entries) {
      if (e.cancelled) continue;
      let actualAmount = Math.max(0, e.amount);
      if (actualAmount === 0) continue;

      // Track: source player dealt damage to opponent's creature
      if (e.sourceOwner >= 0 && e.inst.owner !== e.sourceOwner) {
        const srcPs = this.gs.players[e.sourceOwner];
        if (srcPs) srcPs.dealtDamageToOpponent = true;
      }

      // Play animation if specified
      if (e.animType) {
        this._broadcastEvent('play_zone_animation', { type: e.animType, owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot });
        await this._delay(300);
      }

      // Immortal buff: damage cannot drop HP below 1
      if (e.inst.counters?.buffs?.immortal && e.inst.counters.currentHp > 0) {
        const maxDmg = Math.max(0, e.inst.counters.currentHp - 1);
        if (actualAmount > maxDmg) {
          actualAmount = maxDmg;
          this.log('damage_capped', { target: e.inst.name, reason: 'immortal', cappedTo: maxDmg });
        }
      }

      // Generic HP-1 cap (set by beforeCreatureDamageBatch hooks, e.g. Ghuanjun)
      if (e.capAtHPMinus1 && e.inst.counters.currentHp > 0) {
        const maxDmg = Math.max(0, e.inst.counters.currentHp - 1);
        if (actualAmount > maxDmg) {
          actualAmount = maxDmg;
          this.log('damage_capped', { target: e.inst.name, reason: 'capAtHPMinus1', cappedTo: maxDmg });
        }
      }

      e.inst.counters.currentHp -= actualAmount;
      this.log('creature_damage', { source: e.source?.name || e.source, target: e.inst.name, amount: actualAmount, type: e.type, owner: e.inst.owner });

      // ── SC tracking: creature overkill ──
      if (this.gs._scTracking && e.sourceOwner >= 0 && e.sourceOwner < 2) {
        const cd = cardDB[e.inst.name];
        const creatureMaxHp = cd?.hp || 0;
        if (creatureMaxHp > 0 && actualAmount >= creatureMaxHp * 2) {
          this.gs._scTracking[e.sourceOwner].creatureOverkill = true;
        }
      }

      if (e.inst.counters.currentHp <= 0) {
        const ps = this.gs.players[e.inst.owner];
        this.log('creature_destroyed', { card: e.inst.name, by: e.source?.name || e.type, owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot });
        // Store death info before cleanup
        const deathInfo = { name: e.inst.name, owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot };
        const supSlot = ps.supportZones[e.inst.heroIdx]?.[e.inst.zoneSlot];
        if (supSlot) {
          const idx = supSlot.indexOf(e.inst.name);
          if (idx >= 0) supSlot.splice(idx, 1);
        }
        ps.discardPile.push(e.inst.name);
        this._untrackCard(e.inst.id);
        await this.runHooks('onCardLeaveZone', { card: e.inst, fromZone: 'support', fromHeroIdx: e.inst.heroIdx, _skipReactionCheck: true });
        await this.runHooks(HOOKS.ON_CREATURE_DEATH, { creature: deathInfo, source: e.source, _skipReactionCheck: true });
      }
      this.sync();
      await this._delay(200);
    }

    await this.runHooks(HOOKS.AFTER_CREATURE_DAMAGE_BATCH, { entries, _skipReactionCheck: true });
  }

  /**
   * Deal damage to a single creature (convenience wrapper around batch).
   * Used by card effects like Alice.
   */
  async actionDealCreatureDamage(source, inst, amount, type, opts = {}) {
    await this.processCreatureDamageBatch([{
      inst,
      amount,
      type: type || 'other',
      source,
      sourceOwner: opts.sourceOwner ?? -1,
      canBeNegated: opts.canBeNegated !== false,
      isStatusDamage: opts.isStatusDamage || false,
      animType: opts.animType || null,
    }]);
  }

  /**
   * Process burn damage at the start of a player's turn.
   * All Burned heroes the active player controls take 60 damage each.
   * Broadcasts 'burn_tick' to frontend for visual escalation.
   */
  async processBurnDamage() {
    const ap = this.gs.activePlayer;
    const ps = this.gs.players[ap];
    if (!ps) return;

    const burnedHeroes = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0 || !hero.statuses?.burned) continue;
      burnedHeroes.push({ owner: ap, heroIdx: hi, heroName: hero.name });
    }

    // Also find burned creatures
    const burnedCreatures = [];
    for (const inst of this.cardInstances) {
      if (inst.owner !== ap || inst.zone !== 'support') continue;
      if (!inst.counters.burned) continue;
      burnedCreatures.push(inst);
    }

    if (burnedHeroes.length === 0 && burnedCreatures.length === 0) return;

    // Broadcast burn tick for visual escalation BEFORE dealing damage
    if (burnedHeroes.length > 0) {
      this._broadcastEvent('burn_tick', { heroes: burnedHeroes });
      await this._delay(300); // Let the escalation animation start
    }

    for (const { owner, heroIdx, heroName } of burnedHeroes) {
      const hero = ps.heroes[heroIdx];
      if (!hero || hero.hp <= 0) continue; // May have died from a previous burn this loop
      this.log('burn_damage', { target: heroName, amount: 60, owner });
      await this.actionDealDamage({ name: 'Burn' }, hero, 60, 'fire');
      this.sync();
      await this._delay(200);
    }

    // Process creature burn damage via generic batch system
    if (burnedCreatures.length > 0) {
      const entries = burnedCreatures.map(inst => ({
        inst,
        amount: 60,
        type: 'fire',
        source: { name: 'Burn' },
        sourceOwner: inst.counters.burnAppliedBy ?? -1,
        canBeNegated: true,
        isStatusDamage: true,
        animType: 'flame_strike',
      }));
      await this.processCreatureDamageBatch(entries);
    }
  }

  /**
   * Deal poison damage to all poisoned heroes/creatures of the active player.
   * Damage = 30 × poison stacks. Called at start of turn before hooks.
   */
  async processPoisonDamage() {
    const ap = this.gs.activePlayer;
    const ps = this.gs.players[ap];
    if (!ps) return;

    // Poisoned heroes
    const poisonedHeroes = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0 || !hero.statuses?.poisoned) continue;
      const stacks = hero.statuses.poisoned.stacks || 1;
      poisonedHeroes.push({ owner: ap, heroIdx: hi, heroName: hero.name, stacks });
    }

    // Poisoned creatures
    const poisonedCreatures = [];
    for (const inst of this.cardInstances) {
      if (inst.owner !== ap || inst.zone !== 'support') continue;
      if (!inst.counters.poisoned) continue;
      const stacks = inst.counters.poisonStacks || 1;
      poisonedCreatures.push({ inst, stacks });
    }

    if (poisonedHeroes.length === 0 && poisonedCreatures.length === 0) return;

    // Process hero poison
    for (const { owner, heroIdx, heroName, stacks } of poisonedHeroes) {
      const hero = ps.heroes[heroIdx];
      if (!hero || hero.hp <= 0) continue;
      const damage = 30 * stacks;
      this._broadcastEvent('play_zone_animation', { type: 'poison_tick', owner: ap, heroIdx, zoneSlot: -1 });
      await this._delay(300);
      this.log('poison_damage', { target: heroName, amount: damage, stacks, owner });
      await this.actionDealDamage({ name: 'Poison' }, hero, damage, 'poison');
      this.sync();
      await this._delay(200);
    }

    // Process creature poison via generic batch system
    if (poisonedCreatures.length > 0) {
      const entries = poisonedCreatures.map(({ inst, stacks }) => ({
        inst,
        amount: 30 * stacks,
        type: 'poison',
        source: { name: 'Poison' },
        sourceOwner: -1, // Poison source owner not tracked on creatures currently
        canBeNegated: true,
        isStatusDamage: true,
        animType: 'poison_tick',
      }));
      await this.processCreatureDamageBatch(entries);
    }
  }

  // ─── WIN CONDITION ─────────────────────────

  /**
   * Handle cleanup when a hero dies.
   * Equip artifacts go to discard (fires onCardLeaveZone).
   * Any creatures in island zones are defeated.
   */
  async handleHeroDeathCleanup(hero) {
    if (!hero || !hero.name) return;

    // Clear ALL statuses from dead hero
    if (hero.statuses) {
      hero.statuses = {};
    }

    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      const hi = ps.heroes.findIndex(h => h === hero);
      if (hi < 0) continue;

      // Find equip artifact CardInstances on this hero's support zones
      const equipInstances = this.cardInstances.filter(c => {
        if (c.owner !== pi || c.zone !== 'support' || c.heroIdx !== hi) return false;
        if (c.counters?.immovable) return false; // Immovable cards stay even on dead heroes
        const script = c.loadScript();
        return script?.isEquip === true || c.counters?.treatAsEquip === true;
      });

      for (const inst of equipInstances) {
        // Fire onCardLeaveZone (triggers Flying Island cleanup etc.)
        await this.runHooks(HOOKS.ON_CARD_LEAVE_ZONE, { _onlyCard: inst, card: inst, fromZone: 'support', fromHeroIdx: hi });
        // Move card to discard
        const supZones = ps.supportZones[hi] || [];
        for (let zi = 0; zi < supZones.length; zi++) {
          const idx = (supZones[zi] || []).indexOf(inst.name);
          if (idx >= 0) { supZones[zi].splice(idx, 1); break; }
        }
        ps.discardPile.push(inst.name);
        this.cardInstances = this.cardInstances.filter(c => c.id !== inst.id);
      }
      break;
    }
  }

  /**
   * Add island (creature-only) support zones to a hero.
   */
  addIslandZones(playerIdx, heroIdx, count) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    if (!ps.islandZoneCount) ps.islandZoneCount = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      ps.supportZones[heroIdx].push([]);
    }
    ps.islandZoneCount[heroIdx] += count;
  }

  /**
   * Remove island support zones from a hero.
   * Any creatures in those zones are defeated (fire hooks) and go to discard.
   */
  async removeIslandZones(playerIdx, heroIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    if (!ps.islandZoneCount) ps.islandZoneCount = [0, 0, 0];
    const islandCount = ps.islandZoneCount[heroIdx] || 0;
    if (islandCount <= 0) return;

    const totalZones = ps.supportZones[heroIdx].length;
    const firstIslandIdx = totalZones - islandCount;

    // Defeat creatures in island zones
    for (let zi = firstIslandIdx; zi < totalZones; zi++) {
      const zoneCards = ps.supportZones[heroIdx][zi] || [];
      for (const cardName of [...zoneCards]) {
        // Fire death hooks for the creature
        const hero = ps.heroes[heroIdx];
        this.log('island_zone_defeat', { card: cardName, hero: hero?.name });
        await this.runHooks(HOOKS.ON_HERO_KO, { hero: { name: cardName, hp: 0 }, source: null });
        // Move to discard
        ps.discardPile.push(cardName);
        // Untrack card instance
        const inst = this.cardInstances.find(c => c.owner === playerIdx && c.zone === 'support' && c.heroIdx === heroIdx && c.name === cardName);
        if (inst) {
          this.cardInstances = this.cardInstances.filter(c => c.id !== inst.id);
        }
      }
    }

    // Remove the island zones from the array
    ps.supportZones[heroIdx].splice(firstIslandIdx, islandCount);
    ps.islandZoneCount[heroIdx] = 0;
  }

  /**
   * Check if all heroes of either player are dead.
   * If so, the other player wins.
   */
  async checkAllHeroesDead() {
    if (this.gs.result) return; // Game already over
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      const heroes = ps?.heroes || [];
      const allDead = heroes.length > 0 && heroes.every(h => !h.name || h.hp <= 0);
      if (allDead) {
        // Check if this player has an active Elixir of Immortality — block game over
        const hasElixir = (ps.permanents || []).some(p => p.name === 'Elixir of Immortality');
        if (hasElixir) continue; // Elixir will handle revival
        const winnerIdx = pi === 0 ? 1 : 0;
        this.log('all_heroes_dead', { loser: ps.username, winner: this.gs.players[winnerIdx].username });
        if (this.onGameOver) {
          this.onGameOver(this.room, winnerIdx, 'all_heroes_dead');
        }
        return;
      }
    }
  }

  // ─── GAME STATE HELPERS ───────────────────

  /** Remove a card from its current position in the raw game state arrays. */
  _removeCardFromState(inst) {
    const ps = this.gs.players[inst.owner];
    if (!ps) return;

    switch (inst.zone) {
      case ZONES.HAND: {
        const idx = ps.hand.indexOf(inst.name);
        if (idx >= 0) ps.hand.splice(idx, 1);
        break;
      }
      case ZONES.SUPPORT: {
        if (inst.heroIdx >= 0 && inst.zoneSlot >= 0) {
          const arr = ps.supportZones?.[inst.heroIdx]?.[inst.zoneSlot];
          if (arr) { const idx = arr.indexOf(inst.name); if (idx >= 0) arr.splice(idx, 1); }
        }
        break;
      }
      case ZONES.ABILITY: {
        if (inst.heroIdx >= 0 && inst.zoneSlot >= 0) {
          const arr = ps.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot];
          if (arr) { const idx = arr.indexOf(inst.name); if (idx >= 0) arr.splice(idx, 1); }
        }
        break;
      }
      case ZONES.SURPRISE: {
        if (inst.heroIdx >= 0) {
          const arr = ps.surpriseZones?.[inst.heroIdx];
          if (arr) { const idx = arr.indexOf(inst.name); if (idx >= 0) arr.splice(idx, 1); }
        }
        break;
      }
      case ZONES.DISCARD: {
        const idx = ps.discardPile.indexOf(inst.name);
        if (idx >= 0) ps.discardPile.splice(idx, 1);
        break;
      }
      case ZONES.DELETED: {
        const idx = ps.deletedPile.indexOf(inst.name);
        if (idx >= 0) ps.deletedPile.splice(idx, 1);
        break;
      }
      case ZONES.PERMANENT: {
        const idx = (ps.permanents || []).findIndex(p => p.id === inst.counters?.permId);
        if (idx >= 0) ps.permanents.splice(idx, 1);
        break;
      }
      // DECK, HERO — handled separately
    }
  }

  /** Add a card to its new position in the raw game state arrays. */
  _addCardToState(inst) {
    const ps = this.gs.players[inst.owner];
    if (!ps) return;

    switch (inst.zone) {
      case ZONES.HAND:
        ps.hand.push(inst.name);
        break;
      case ZONES.DISCARD:
        ps.discardPile.push(inst.name);
        break;
      case ZONES.DELETED:
        ps.deletedPile.push(inst.name);
        break;
      case ZONES.SUPPORT: {
        if (inst.heroIdx >= 0 && inst.zoneSlot >= 0) {
          if (!ps.supportZones[inst.heroIdx]) ps.supportZones[inst.heroIdx] = [[], [], []];
          ps.supportZones[inst.heroIdx][inst.zoneSlot].push(inst.name);
        }
        break;
      }
      case ZONES.ABILITY: {
        if (inst.heroIdx >= 0 && inst.zoneSlot >= 0) {
          if (!ps.abilityZones[inst.heroIdx]) ps.abilityZones[inst.heroIdx] = [[], [], []];
          ps.abilityZones[inst.heroIdx][inst.zoneSlot].push(inst.name);
        }
        break;
      }
      case ZONES.SURPRISE: {
        if (inst.heroIdx >= 0) {
          if (!ps.surpriseZones[inst.heroIdx]) ps.surpriseZones[inst.heroIdx] = [];
          ps.surpriseZones[inst.heroIdx].push(inst.name);
        }
        break;
      }
    }
  }

  _heroLabel(hero) {
    if (!hero) return '?';
    return hero.name || 'Hero';
  }

  // ─── PLAYER PROMPTS ───────────────────────
  // Async: send socket event, wait for response with timeout.

  async promptChooseTarget(playerIdx, type, filter) {
    const ps = this.gs.players[playerIdx];
    if (!ps?.socketId) return null;

    // Build valid targets based on type
    const validTargets = this._buildValidTargets(playerIdx, type, filter);
    if (validTargets.length === 0) return null;
    if (validTargets.length === 1) return validTargets[0]; // Auto-select

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(validTargets[0]), CHAIN_TIMEOUT_MS);

      this.io.to(ps.socketId).emit('target_prompt', { type, validTargets, timeout: CHAIN_TIMEOUT_MS });

      const socket = this._getSocket(ps.socketId);
      if (!socket) { clearTimeout(timeout); resolve(validTargets[0]); return; }

      socket.once('target_response', (data) => {
        clearTimeout(timeout);
        const target = validTargets.find(t => t.id === data.targetId);
        resolve(target || validTargets[0]);
      });
    });
  }

  async promptChooseCards(playerIdx, zone, count, filter) {
    // Simplified: for now, auto-select first N matching cards
    const cards = this.findCards({ controller: playerIdx, zone });
    return cards.slice(0, count);
  }

  async promptChooseOption(playerIdx, options) {
    const ps = this.gs.players[playerIdx];
    if (!ps?.socketId) return options[0];

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(options[0]), CHAIN_TIMEOUT_MS);

      this.io.to(ps.socketId).emit('option_prompt', { options, timeout: CHAIN_TIMEOUT_MS });

      const socket = this._getSocket(ps.socketId);
      if (!socket) { clearTimeout(timeout); resolve(options[0]); return; }

      socket.once('option_response', (data) => {
        clearTimeout(timeout);
        const match = options.find((_, i) => i === data.optionIndex);
        resolve(match || options[0]);
      });
    });
  }

  async promptConfirm(playerIdx, message) {
    const ps = this.gs.players[playerIdx];
    if (!ps?.socketId) return false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), CHAIN_TIMEOUT_MS);

      this.io.to(ps.socketId).emit('confirm_prompt', { message, timeout: CHAIN_TIMEOUT_MS });

      const socket = this._getSocket(ps.socketId);
      if (!socket) { clearTimeout(timeout); resolve(false); return; }

      socket.once('confirm_response', (data) => {
        clearTimeout(timeout);
        resolve(!!data.confirmed);
      });
    });
  }

  _buildValidTargets(playerIdx, type, filter) {
    const targets = [];
    const oppIdx = playerIdx === 0 ? 1 : 0;

    switch (type) {
      case 'hero':
      case 'anyHero':
        for (let pi = 0; pi < 2; pi++) {
          for (let hi = 0; hi < (this.gs.players[pi]?.heroes || []).length; hi++) {
            const h = this.gs.players[pi].heroes[hi];
            if (h.name && h.hp > 0) targets.push({ id: `hero-${pi}-${hi}`, type: 'hero', playerIdx: pi, heroIdx: hi, ...h });
          }
        }
        break;
      case 'myHero':
        for (let hi = 0; hi < (this.gs.players[playerIdx]?.heroes || []).length; hi++) {
          const h = this.gs.players[playerIdx].heroes[hi];
          if (h.name && h.hp > 0) targets.push({ id: `hero-${playerIdx}-${hi}`, type: 'hero', playerIdx, heroIdx: hi, ...h });
        }
        break;
      case 'enemyHero':
        for (let hi = 0; hi < (this.gs.players[oppIdx]?.heroes || []).length; hi++) {
          const h = this.gs.players[oppIdx].heroes[hi];
          if (h.name && h.hp > 0) targets.push({ id: `hero-${oppIdx}-${hi}`, type: 'hero', playerIdx: oppIdx, heroIdx: hi, ...h });
        }
        break;
      case 'card':
        targets.push(...this.cardInstances.filter(c => c.zone !== ZONES.DECK && c.zone !== ZONES.DELETED).map(c => ({
          id: c.id, type: 'card', ...c,
        })));
        break;
    }

    if (filter) return targets.filter(filter);
    return targets;
  }

  // ─── SOCKET HELPERS ───────────────────────

  _getSocket(socketId) {
    return this.io.sockets.sockets.get(socketId) || null;
  }

  _broadcastChainState() {
    const chainData = this.chain.map(l => ({
      cardName: l.card?.name || 'System',
      controller: l.controller,
      speed: l.speed,
    }));
    for (let i = 0; i < 2; i++) {
      const sid = this.gs.players[i]?.socketId;
      if (sid) this.io.to(sid).emit('chain_update', { chain: chainData });
    }
    // Also send to spectators
    if (this.room.spectators) {
      for (const spec of this.room.spectators) {
        if (spec.socketId) this.io.to(spec.socketId).emit('chain_update', { chain: chainData });
      }
    }
  }

  _broadcastEvent(event, data) {
    for (let i = 0; i < 2; i++) {
      const sid = this.gs.players[i]?.socketId;
      if (sid) this.io.to(sid).emit(event, data);
    }
    // Also send to spectators
    if (this.room.spectators) {
      for (const spec of this.room.spectators) {
        if (spec.socketId) this.io.to(spec.socketId).emit(event, data);
      }
    }
  }

  // ─── LOGGING ──────────────────────────────

  log(type, data) {
    const entry = { id: ++this.eventId, type, turn: this.gs.turn, phase: PHASE_NAMES[this.gs.currentPhase || 0], ...data };
    this.actionLog.push(entry);
    this._broadcastEvent('action_log', entry);
  }

  /** Get the full action log. */
  getLog() {
    return this.actionLog;
  }

  // ─── SYNC STATE TO CLIENTS ────────────────

  sync() {
    // ── SC tracking: check ability/support zone states ──
    if (this.gs._scTracking) {
      for (let pi = 0; pi < 2; pi++) {
        const ps = this.gs.players[pi];
        const t = this.gs._scTracking[pi];
        const aliveHeroes = (ps.heroes || []).filter(h => h.name && h.hp > 0);
        if (aliveHeroes.length > 0) {
          // Check all ability zones filled (all living heroes, all 3 slots non-empty)
          let allAbFilled = true, allAbLevel3 = true;
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            const hero = ps.heroes[hi];
            if (!hero?.name || hero.hp <= 0) continue;
            const abZ = ps.abilityZones?.[hi] || [];
            for (let z = 0; z < 3; z++) {
              const slot = abZ[z] || [];
              if (slot.length === 0) { allAbFilled = false; allAbLevel3 = false; }
              else if (slot.length < 3) { allAbLevel3 = false; }
            }
          }
          if (allAbFilled) t.allAbilitiesFilled = true;
          if (allAbLevel3) t.allAbilitiesLevel3 = true;
          // Check all 9 support zones full (3 heroes × 3 base slots)
          let fullSupports = 0;
          for (let hi = 0; hi < 3; hi++) {
            for (let z = 0; z < 3; z++) {
              if (((ps.supportZones?.[hi] || [])[z] || []).length > 0) fullSupports++;
            }
          }
          if (fullSupports >= 9) t.allSupportFull = true;
        }
      }
    }
    if (this.sendGameState) {
      for (let i = 0; i < 2; i++) {
        this.sendGameState(this.room, i);
      }
    }
    if (this.sendSpectatorGameState) {
      this.sendSpectatorGameState(this.room);
    }
  }

  /** Find which player owns a hero object. */
  _findHeroOwner(hero) {
    for (let pi = 0; pi < 2; pi++) {
      if ((this.gs.players[pi]?.heroes || []).includes(hero)) return pi;
    }
    return -1;
  }
}

module.exports = { GameEngine, CardInstance, SPEED, STATUS_EFFECTS, getNegativeStatuses };
