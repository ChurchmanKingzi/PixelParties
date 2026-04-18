// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — CARD EFFECT ENGINE
//  Chain-based hook system with Yu-Gi-Oh-style chain resolution.
//  Each game gets one GameEngine instance. All card logic runs here.
// ═══════════════════════════════════════════════════════════════════

const { v4: uuidv4 } = require('uuid');
const { SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES, STATUS_EFFECTS, getNegativeStatuses, BUFF_EFFECTS, hasCardType, POISON_BASE_DAMAGE, BURN_BASE_DAMAGE } = require('./_hooks');
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
    this.originalOwner = owner; // Original owner — never changes (for discard pile routing)
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

    // ── CPU / Single-player / Puzzle mode ──
    // _cpuPlayerIdx: index of the CPU-controlled player (-1 = none).
    //   Used for puzzle validation, future single-player modes, etc.
    // isPuzzle: when true, the game ends after the human player's turn.
    //   If the human hasn't won by switchTurn, the puzzle is failed.
    this._cpuPlayerIdx = -1;
    this.isPuzzle = false;
  }

  // ─── INITIALIZATION ───────────────────────

  // ─── CPU PLAYER SYSTEM ────────────────────
  // Handles auto-responses for CPU-controlled players (puzzle mode, future single-player).
  // Card modules can export a cpuResponse(engine, promptType, promptData) function for
  // card-specific decision logic. The engine checks for it before falling back to defaults.

  /** Check whether a player index is CPU-controlled. */
  isCpuPlayer(pi) {
    return this._cpuPlayerIdx >= 0 && pi === this._cpuPlayerIdx;
  }

  /**
   * Generate a CPU response for a generic prompt (confirm, forceDiscard, cardGallery, etc.).
   * Rule: cancellable prompts → decline (CPU takes no voluntary actions).
   *       mandatory prompts  → auto-confirm / pick first option.
   * Card-specific overrides: if a card module exports cpuResponse(), it's checked first.
   * @param {object} promptData - The prompt data sent to the client
   * @returns {*} The response value (same shape the client would send)
   */
  _getCpuGenericResponse(promptData) {
    // ── Card-specific handler (extensible per-card CPU logic) ──
    const cardName = promptData.title || promptData.source;
    if (cardName) {
      const script = loadCardEffect(cardName);
      if (script?.cpuResponse) {
        const result = script.cpuResponse(this, 'generic', promptData);
        if (result !== undefined) return result;
      }
    }

    // ── Default: cancellable → decline, mandatory → auto-resolve ──
    if (promptData.cancellable) return null; // Decline optional actions

    const type = promptData.type;

    if (type === 'confirm') return true;

    if (type === 'forceDiscard' || type === 'forceDiscardCancellable') {
      const ps = this.gs.players[this._cpuPlayerIdx];
      if (!ps || !ps.hand || ps.hand.length === 0) return null;
      // Pick first eligible card (respect eligibleIndices if provided)
      const eligible = promptData.eligibleIndices;
      const idx = eligible ? eligible[0] : 0;
      return { cardName: ps.hand[idx], handIndex: idx };
    }

    if (type === 'cardGallery') {
      const cards = promptData.cards || [];
      if (cards.length === 0) return null;
      return { cardName: cards[0].name, source: cards[0].source };
    }

    if (type === 'cardGalleryMulti') {
      const cards = promptData.cards || [];
      if (cards.length === 0) return { selectedCards: [] };
      return { selectedCards: [cards[0].name] };
    }

    if (type === 'zonePick') {
      const zones = promptData.zones || [];
      if (zones.length === 0) return null;
      return { heroIdx: zones[0].heroIdx, slotIdx: zones[0].slotIdx };
    }

    if (type === 'statusSelect') {
      return { selectedStatuses: (promptData.statuses || []).map(s => s.key) };
    }

    if (type === 'handPick') {
      const eligible = promptData.eligibleIndices || [];
      if (eligible.length === 0) return null;
      return { selectedIndex: eligible[0] };
    }

    if (type === 'heroAction') {
      // CPU doesn't take optional hero actions
      return { cancelled: true };
    }

    if (type === 'chainTargetPick') {
      // Smart chain target selection:
      // - Pick highest-HP target each step
      // - If the damage would KILL the highest-HP target, pick lowest-HP instead
      // - Each target only selected once
      // - Respect heroesFirst: prefer heroes while any are available
      const targets = promptData.targets || [];
      const damages = promptData.damages || [];
      const heroesFirst = promptData.heroesFirst || false;

      if (targets.length === 0) return { selectedTargets: [] };

      const getHp = (t) => {
        if (t.type === 'hero') {
          const hero = this.gs.players[t.owner]?.heroes?.[t.heroIdx];
          return hero?.hp || 0;
        }
        if (t.type === 'equip') {
          const inst = this.cardInstances.find(c =>
            c.owner === t.owner && c.zone === 'support' && c.heroIdx === t.heroIdx && c.zoneSlot === t.slotIdx
          );
          const cd = this._getCardDB()[t.cardName];
          return inst?.counters?.currentHp ?? cd?.hp ?? 0;
        }
        return 0;
      };

      const selected = [];
      const usedIds = new Set();
      const maxTargets = Math.min(damages.length, targets.length);
      // Weakest damage that will actually be applied (damages are descending)
      const minDmg = damages[maxTargets - 1];

      for (let step = 0; step < maxTargets; step++) {
        const dmg = damages[step];
        let available = targets.filter(t => !usedIds.has(t.id));
        if (available.length === 0) break;

        // heroesFirst: prefer heroes while any hero targets remain
        if (heroesFirst) {
          const heroes = available.filter(t => t.type === 'hero');
          if (heroes.length > 0) available = heroes;
        }

        const remainingSteps = maxTargets - step;
        let chosen;

        // Optimization: if forced to hit all remaining targets (no spare slots),
        // and a target would die to even the weakest remaining hit, assign it the
        // strongest hit (this step) since the damage is wasted on a dead target anyway.
        if (available.length <= remainingSteps) {
          const wouldDieAnyway = available.filter(t => getHp(t) <= minDmg);
          if (wouldDieAnyway.length > 0) {
            // Pick the lowest-HP doomed target (least wasted overkill)
            wouldDieAnyway.sort((a, b) => getHp(a) - getHp(b));
            chosen = wouldDieAnyway[0];
          }
        }

        if (!chosen) {
          // Standard logic: pick highest HP, unless it would die → pick lowest
          available.sort((a, b) => getHp(b) - getHp(a));
          const highestHpTarget = available[0];
          if (dmg >= getHp(highestHpTarget)) {
            // Would kill highest — pick lowest HP instead
            chosen = available[available.length - 1];
          } else {
            chosen = highestHpTarget;
          }
        }

        selected.push(chosen);
        usedIds.add(chosen.id);
      }

      return { selectedTargets: selected };
    }

    // Fallback: confirm
    return true;
  }

  /**
   * Generate a CPU response for an effect target prompt.
   * Same cancellable logic: if cancellable, decline. Otherwise pick first target(s).
   * @param {Array} validTargets - Array of valid target objects with .id
   * @param {object} config - Targeting configuration
   * @returns {string[]} Array of selected target IDs
   */
  _getCpuTargetResponse(validTargets, config = {}) {
    // Card-specific handler
    const cardName = config.title;
    if (cardName) {
      const script = loadCardEffect(cardName);
      if (script?.cpuResponse) {
        const result = script.cpuResponse(this, 'effectTarget', { validTargets, config });
        if (result !== undefined) return result;
      }
    }

    // Cancellable → decline (return empty)
    if (config.cancellable) return [];

    // Mandatory → pick first valid target
    if (!validTargets || validTargets.length === 0) return [];
    return [validTargets[0].id];
  }


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

      // Area cards — `gs.areaZones[pi]` is a flat array of card names the
      // puzzle/game state has committed to the board. Each needs a
      // CardInstance tracked so its activeIn: ['area'] hooks can fire
      // (reactive afterSpellResolved for Acid Rain, onCardLeaveZone for
      // Reality Crack replacements, etc.). Without this, puzzle-authored
      // Areas look placed on the board but do nothing.
      for (const cardName of (this.gs.areaZones?.[pi] || [])) {
        this._trackCard(cardName, pi, ZONES.AREA);
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
        if (hero.hp <= 0 && !hookCtx._bypassDeadHeroFilter) return false;
        if ((hero.statuses?.frozen || hero.statuses?.stunned) && (c.zone === 'hero' || c.zone === 'ability') && !loadCardEffect(c.name)?.bypassStatusFilter) return false;
        if (hero.statuses?.negated && (c.zone === 'hero' || c.zone === 'ability') && !loadCardEffect(c.name)?.bypassStatusFilter) return false;
      }
      // Creature-level negation/freeze/stun (Dark Gear, Necromancy, Slimes, Null Zone, etc.)
      if (c.zone === 'support' && (c.counters?.negated || c.counters?.nulled || c.counters?.frozen || c.counters?.stunned)) return false;
      // Face-down surprise creatures (Bakhm slots) don't fire hooks
      if (c.faceDown) return false;
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

      // Propagate cancellation back to shared hookCtx
      if (ctx.cancelled) hookCtx.cancelled = true;

      // If this hook created pending triggers, collect them
      if (ctx._triggers?.length) {
        this.pendingTriggers.push(...ctx._triggers);
      }
    }

    // After hooks resolve, check for reaction cards (unless suppressed)
    if (!this._inReactionCheck && !hookCtx._skipReactionCheck && !hookCtx._isReaction) {
      await this._checkReactionCards(hookName, hookCtx);
    }

    // After hooks, check for equip/summon/ability-triggered surprises
    if (hookName === 'onCardEnterZone' && !this._inSurpriseResolution && !hookCtx._skipReactionCheck) {
      const enteringCard = hookCtx.enteringCard;
      const toZone = hookCtx.toZone;
      if (enteringCard && toZone === 'support') {
        const cd = this._getCardDB()[enteringCard.name];
        if (cd && !hasCardType(cd, 'Creature')) {
          await this._checkSurpriseOnEquip(enteringCard.controller ?? enteringCard.owner, enteringCard.heroIdx, enteringCard);
        }
        if (cd && hasCardType(cd, 'Creature')) {
          await this._checkSurpriseOnSummon(enteringCard.controller ?? enteringCard.owner, enteringCard);
        }
      }
      if (enteringCard && toZone === 'ability') {
        await this._checkSurpriseOnAbility(enteringCard.controller ?? enteringCard.owner, enteringCard.heroIdx, enteringCard);
      }
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

    // ── Resolve effective controller for cards attached to charmed heroes ──
    // This ensures ALL equipment hooks, ability hooks, and hero hooks
    // automatically use the charming player as controller/owner.
    let effectiveOwner = cardInstance.owner;
    let effectiveController = cardInstance.controller;
    let effectiveHeroOwner = cardInstance.heroOwner != null ? cardInstance.heroOwner : cardInstance.controller;
    if (cardInstance.heroIdx >= 0 && (cardInstance.zone === 'support' || cardInstance.zone === 'ability' || cardInstance.zone === 'hero')) {
      const heroObj = gs.players[cardInstance.owner]?.heroes?.[cardInstance.heroIdx];
      if (heroObj?.charmedBy != null) {
        effectiveController = heroObj.charmedBy;
        effectiveOwner = heroObj.charmedBy;
        effectiveHeroOwner = cardInstance.owner; // hero is still physically on original owner's side
      }
    }

    const ctx = {
      // Hook event data (spread first so card-specific props override)
      ...hookCtx,

      // ── Card-specific info (always refers to the card whose hook is firing) ──
      card: cardInstance,
      cardName: cardInstance.name,
      cardOwner: effectiveOwner,
      cardOriginalOwner: cardInstance.owner, // Always the original owner (for flag keys, etc.)
      cardController: effectiveController,
      cardZone: cardInstance.zone,
      cardHeroIdx: cardInstance.heroIdx,
      cardHeroOwner: effectiveHeroOwner,
      attachedHero: cardInstance.heroIdx >= 0
        ? gs.players[effectiveHeroOwner]?.heroes?.[cardInstance.heroIdx] || null
        : null,

      // Game state reads
      phase: PHASE_NAMES[gs.currentPhase || 0],
      phaseIndex: gs.currentPhase || 0,
      turn: gs.turn || 0,
      activePlayer: gs.activePlayer || 0,
      isMyTurn: (gs.activePlayer || 0) === effectiveController,
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
      /**
       * Deal damage that bypasses all reductions, multipliers, and negations.
       * Use for cards whose text says "this damage cannot be reduced or negated"
       * (Acid Vial, Rockfall, etc.). Automatically handles hero vs. creature
       * targets and sets the generic `_damagedOnTurn` tracker.
       */
      async dealTrueDamage(target, amount, type, opts) {
        return engine.actionDealTrueDamage(cardInstance, target, amount, { ...(opts || {}), type });
      },
      async healHero(target, amount) {
        return engine.actionHealHero(cardInstance, target, amount);
      },
      async healCreature(target, amount) {
        return engine.actionHealCreature(cardInstance, target, amount);
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
      async drawCards(playerIdx, count, opts) {
        return engine.actionDrawCards(playerIdx, count, opts);
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
      async millCards(playerIdx, count, opts) {
        return engine.actionMillCards(playerIdx, count, opts);
      },
      /** Add a specific card to a player's hand with logging. */
      addCardToHand(playerIdx, cardName, source) {
        return engine.actionAddCardToHand(playerIdx, cardName, source || cardInstance.name);
      },
      /** Shuffle cards from hand back into deck. */
      shuffleBackToDeck(playerIdx, cardNames, source) {
        return engine.actionShuffleBackToDeck(playerIdx, cardNames, source || cardInstance.name);
      },
      /** Shuffle a player's deck. No-op in puzzle mode. */
      shuffleDeck(playerIdx, deckType) {
        return engine.shuffleDeck(playerIdx, deckType);
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
      /**
       * Centralized creature summoning — guarantees summoning sickness, tracking, and counting.
       * Use summonCreatureWithHooks for full lifecycle including onPlay/onCardEnterZone hooks.
       */
      summonCreature(cardName, playerIdx, heroIdx, zoneSlot, opts) {
        return engine.summonCreature(cardName, playerIdx, heroIdx, zoneSlot, opts);
      },
      async summonCreatureWithHooks(cardName, playerIdx, heroIdx, zoneSlot, opts) {
        return engine.summonCreatureWithHooks(cardName, playerIdx, heroIdx, zoneSlot, opts);
      },
      async addStatus(target, statusName, opts) {
        return engine.actionAddStatus(target, statusName, opts);
      },
      async removeStatus(target, statusName) {
        return engine.actionRemoveStatus(target, statusName);
      },
      /** Remove multiple statuses from a hero (centralized cleanse). Skips unhealable. */
      cleanseHeroStatuses(hero, playerIdx, heroIdx, statusKeys, source) {
        return engine.cleanseHeroStatuses(hero, playerIdx, heroIdx, statusKeys, source);
      },
      /** Remove multiple statuses from a creature (centralized cleanse). Skips unhealable. */
      cleanseCreatureStatuses(inst, statusKeys, source) {
        return engine.cleanseCreatureStatuses(inst, statusKeys, source);
      },
      /** Get removable (non-unhealable) negative statuses from a hero. */
      getRemovableHeroStatuses(hero) {
        return engine.getRemovableHeroStatuses(hero);
      },
      /** Get removable (non-unhealable) negative statuses from a creature. */
      getRemovableCreatureStatuses(inst) {
        return engine.getRemovableCreatureStatuses(inst);
      },
      /** Estimate effective damage including hero-level bonuses (for preview). */
      estimateDamage(baseDamage, damageType) {
        return engine.estimateDamage(effectiveOwner, cardInstance.heroIdx, baseDamage, damageType || 'normal');
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
      /** Sync guardian immunity on a creature to match its controller's side. */
      syncGuardianImmunity(inst, controllerIdx) {
        return engine._syncGuardianImmunity(inst, controllerIdx);
      },
      /** Transfer a creature from one player's control to another. */
      async transferCreature(inst, toPlayerIdx, destHeroIdx, destSlotIdx, opts) {
        return engine.actionTransferCreature(inst, toPlayerIdx, destHeroIdx, destSlotIdx, opts);
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
            return cd && hasCardType(cd, 'Creature');
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
       * Lock hand additions for the card's controller for the rest of this turn.
       * Prevents all draws and cards being added to hand (search effects, etc.).
       */
      lockHand() {
        const ps = gs.players[cardInstance.controller];
        if (ps) ps.handLocked = true;
        engine.sync();
      },

      /**
       * Check if the card's controller has hand additions locked this turn.
       */
      isHandLocked() {
        return !!gs.players[cardInstance.controller]?.handLocked;
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
        const attackSource = { name: cardInstance.name, owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
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

      // ── Generic AoE Handler ──
      /**
       * Generic AoE effect handler. Collects targets, handles Ida single-target
       * override, plays animations, and deals damage via proper channels.
       *
       * @param {object} config
       * @param {string}   config.side           - 'enemy' | 'own' | 'both'
       * @param {string[]} [config.types]        - ['hero','creature'] (default both)
       * @param {number}   [config.damage]       - Damage to deal. 0 = collect + animate only. (default 0)
       * @param {string}   [config.damageType]   - e.g. 'destruction_spell', 'attack', 'fire'
       * @param {string}   config.sourceName     - Card name for logging & source tracking
       * @param {string}   [config.animationType]- Animation played on all targets
       * @param {number}   [config.animDelay]    - Delay after animation (default 300)
       * @param {number}   [config.hitDelay]     - Delay between individual hero hits (default 150)
       * @param {Function} [config.heroFilter]   - (hero, heroIdx, playerIdx) => bool
       * @param {Function} [config.creatureFilter]- (inst, cardData) => bool
       * @param {number}   [config.heroMinHp]    - Only heroes with hp >= this
       * @param {number}   [config.heroMaxHp]    - Only heroes with hp <= this
       * @param {number}   [config.creatureMinHp]- Only creatures with currentHp >= this
       * @param {number}   [config.creatureMaxHp]- Only creatures with currentHp <= this
       * @param {object}   [config.singleTargetPrompt] - Ida override: { title, description, confirmLabel, cancellable }
       * @returns {{ heroes, creatures, wasSingleTarget, cancelled }}
       */
      async aoeHit(config = {}) {
        return engine.actionAoeHit(cardInstance, config);
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

        // Auto-compute damage preview with hero-level bonuses
        if (config.baseDamage != null && config.baseDamage > 0) {
          const estDmg = engine.estimateDamage(pi, cardInstance.heroIdx, config.baseDamage, config.damageType || 'normal');
          if (estDmg !== config.baseDamage) {
            const base = String(config.baseDamage);
            const est = String(estDmg);
            const bonusNote = ` (${base}+${estDmg - config.baseDamage})`;
            if (config.description) config.description = config.description.split(base).join(est + bonusNote);
            if (config.confirmLabel) config.confirmLabel = config.confirmLabel.split(base).join(est);
          }
        }

        const addHeroes = (playerIdx) => {
          const ps2 = gs.players[playerIdx];
          for (let hi = 0; hi < (ps2.heroes || []).length; hi++) {
            const hero = ps2.heroes[hi];
            if (!hero?.name || hero.hp <= 0) continue;
            // Skip heroes charmed by the caster (they're on the caster's side)
            if (hero.charmedBy === pi && playerIdx !== pi) continue;
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
              const inst = engine.cardInstances.find(c =>
                (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
              );
              // Only actual Creatures are targetable — not Equipment, Heroes, etc.
              const cd = (inst ? engine.getEffectiveCardData(inst) : null) || cardDB[creatureName];
              if (!cd || !hasCardType(cd, 'Creature')) continue;
              if (inst?.faceDown) continue; // Face-down Bakhm surprises are not targetable
              const t = { id: `equip-${playerIdx}-${hi}-${si}`, type: 'equip', owner: playerIdx, heroIdx: hi, slotIdx: si, cardName: creatureName, cardInstance: inst };
              if (config.condition && !config.condition(t, engine)) continue;
              targets.push(t);
            }
          }
        };

        if (types.includes('hero')) {
          if (side === 'enemy' || side === 'any') addHeroes(oppIdx);
          if (side === 'my' || side === 'any') addHeroes(pi);
          // Add charmed opponent heroes to the caster's side
          if (side === 'my' || side === 'any') {
            const charmedOps = gs.players[oppIdx];
            for (let hi = 0; hi < (charmedOps.heroes || []).length; hi++) {
              const h = charmedOps.heroes[hi];
              if (!h?.name || h.hp <= 0 || h.charmedBy !== pi) continue;
              const t = { id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: h.name };
              if (config.condition && !config.condition(t, engine)) continue;
              if (!targets.some(x => x.id === t.id)) targets.push(t);
            }
          }
        }
        if (types.includes('creature')) {
          if (side === 'enemy' || side === 'any') addCreatures(oppIdx);
          if (side === 'my' || side === 'any') addCreatures(pi);
        }

        if (targets.length === 0) return null;

        // ── Untargetable filter ──
        // Heroes with the untargetable status can't be chosen by the opponent,
        // UNLESS all other heroes on that side are also untargetable or dead.
        if (!config.ignoreUntargetable) {
          const heroTargets = targets.filter(t => t.type === 'hero');
          const untargetableIds = new Set();
          // Group by owner to check per-side
          const byOwner = {};
          for (const t of heroTargets) {
            if (!byOwner[t.owner]) byOwner[t.owner] = [];
            byOwner[t.owner].push(t);
          }
          for (const [ownerStr, group] of Object.entries(byOwner)) {
            const owner = parseInt(ownerStr);
            if (owner === pi) continue; // Own heroes — untargetable doesn't block self-targeting
            const targetable = group.filter(t => !gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.untargetable);
            if (targetable.length > 0) {
              // Has non-untargetable heroes — mark untargetable ones for removal
              for (const t of group) {
                if (gs.players[t.owner]?.heroes?.[t.heroIdx]?.statuses?.untargetable) untargetableIds.add(t.id);
              }
            }
            // If ALL are untargetable, keep them all (untargetable does nothing)
          }
          if (untargetableIds.size > 0) {
            for (let i = targets.length - 1; i >= 0; i--) {
              if (untargetableIds.has(targets[i].id)) targets.splice(i, 1);
            }
            if (targets.length === 0) return null;
          }
        }

        // ── Creature untargetable-by-opponent filter (Golden Wings, etc.) ──
        // Generic: if a creature instance has counters.untargetable_by_opponent
        // and counters.untargetable_by_opponent_pi marks the current caster as
        // "the opponent to protect against", that creature is filtered out.
        // Doesn't apply to the buff-owning side's own targeting.
        if (!config.ignoreUntargetable) {
          for (let i = targets.length - 1; i >= 0; i--) {
            const t = targets[i];
            if (t.type !== 'equip' || !t.cardInstance) continue;
            const inst = t.cardInstance;
            if (!inst.counters?.untargetable_by_opponent) continue;
            // Check whose "opponent" this protection targets. If the current
            // caster (pi) matches the protected-from player, exclude.
            const shieldedFrom = inst.counters.untargetable_by_opponent_pi;
            if (shieldedFrom === pi) {
              targets.splice(i, 1);
            }
          }
          if (targets.length === 0) return null;
        }

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
          if (!config.noSpellCancel) gs._spellCancelled = true;
          return null;
        }
        let selected = filteredTargets.find(t => t.id === selectedIds[0]) || null;
        // Spell target tracking (for Bartas, etc.) — records at selection time,
        // not damage time, so protected/shielded targets still count as "hit"
        if (selected && gs._spellDamageLog && !config._skipDamageLog) {
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
              // Continue with redirected target (surprise window + post-target reactions still run)
              selected = redirected;
            }
          }
        }

        // ── Surprise window check ──
        // After target is confirmed (and possibly redirected), check if the targeted
        // hero has a face-down Surprise that should trigger.
        if (selected && selected.type === 'hero' && !config._skipSurpriseCheck) {
          // Mark this hero as surprise-checked so actionDealDamage doesn't re-check
          if (!gs._surpriseCheckedHeroes) gs._surpriseCheckedHeroes = new Set();
          gs._surpriseCheckedHeroes.add(`${selected.owner}-${selected.heroIdx}`);
          const surpriseResult = await engine._checkSurpriseWindow(
            [selected], cardInstance
          );
          if (surpriseResult?.effectNegated) {
            // Effect fully negated by surprise — don't set _spellCancelled (spell is consumed)
            gs._spellNegatedByEffect = true;
            // Remove the target from damage log — spell never connected
            if (gs._spellDamageLog) {
              const negIdx = gs._spellDamageLog.findIndex(t => t.id === selected.id);
              if (negIdx >= 0) gs._spellDamageLog.splice(negIdx, 1);
            }
            return null;
          }
        }

        // ── Post-target hand reaction check ──
        // After surprises, check if any player has a hand reaction that fires
        // after targeting (e.g. Divine Gift of Sacrifice, Invisibility Cloak).
        if (selected && !config._skipPostTargetReactions) {
          const ptResult = await engine._checkPostTargetHandReactions([selected], cardInstance);

          // Effect fully negated (Invisibility Cloak)
          if (ptResult?.effectNegated) {
            gs._spellNegatedByEffect = true;
            // Remove the target from damage log — spell never connected
            if (gs._spellDamageLog) {
              const negIdx = gs._spellDamageLog.findIndex(t => t.id === selected.id);
              if (negIdx >= 0) gs._spellDamageLog.splice(negIdx, 1);
            }
            return null;
          }

          // If the selected target died during the reaction, force retarget
          if (selected.type === 'hero') {
            const tgtHero = gs.players[selected.owner]?.heroes?.[selected.heroIdx];
            if (!tgtHero || tgtHero.hp <= 0) {
              // Remove dead target from damage log
              if (gs._spellDamageLog) {
                const deadIdx = gs._spellDamageLog.findIndex(t => t.id === selected.id);
                if (deadIdx >= 0) gs._spellDamageLog.splice(deadIdx, 1);
              }
              // Recursive retarget — rebuild targets, dead hero excluded naturally
              return ctx.promptDamageTarget({ ...config, _skipPostTargetReactions: false });
            }
          }
        }

        // Anti Magic Enchantment is NOT checked during target selection —
        // it's handled inside actionDealDamage (same pattern as the
        // first-turn-shielded buff), so spell animations always play
        // before the negation prompt appears.
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
            if (hero.charmedBy === pi && playerIdx !== pi) continue;
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
              const inst2 = engine.cardInstances.find(c =>
                (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
              );
              // Only actual Creatures are targetable — not Equipment, Tokens, Spells, etc.
              const cd = (inst2 ? engine.getEffectiveCardData(inst2) : null) || cardDB[creatureName];
              if (!cd || !hasCardType(cd, 'Creature')) continue;
              if (inst2?.faceDown) continue; // Face-down Bakhm surprises are not targetable
              const t = { id: `equip-${playerIdx}-${hi}-${si}`, type: 'equip', owner: playerIdx, heroIdx: hi, slotIdx: si, cardName: creatureName, cardInstance: inst2 };
              if (config.condition && !config.condition(t, engine)) continue;
              targets.push(t);
            }
          }
        };

        if (types.includes('hero')) {
          if (side === 'enemy' || side === 'any') addHeroes(oppIdx);
          if (side === 'my' || side === 'any') addHeroes(pi);
          if (side === 'my' || side === 'any') {
            const charmedOps2 = gs.players[oppIdx];
            for (let hi = 0; hi < (charmedOps2.heroes || []).length; hi++) {
              const h = charmedOps2.heroes[hi];
              if (!h?.name || h.hp <= 0 || h.charmedBy !== pi) continue;
              const t = { id: `hero-${oppIdx}-${hi}`, type: 'hero', owner: oppIdx, heroIdx: hi, cardName: h.name };
              if (config.condition && !config.condition(t, engine)) continue;
              if (!targets.some(x => x.id === t.id)) targets.push(t);
            }
          }
        }
        if (types.includes('creature')) {
          if (side === 'enemy' || side === 'any') addCreatures(oppIdx);
          if (side === 'my' || side === 'any') addCreatures(pi);
        }

        if (targets.length === 0) return [];

        // ── Creature untargetable-by-opponent filter (Golden Wings, etc.) ──
        // Mirror of the filter in promptDamageTarget. Drop any creature
        // whose untargetable_by_opponent_pi matches the current caster.
        if (!config.ignoreUntargetable) {
          for (let i = targets.length - 1; i >= 0; i--) {
            const t = targets[i];
            if (t.type !== 'equip' || !t.cardInstance) continue;
            const inst = t.cardInstance;
            if (!inst.counters?.untargetable_by_opponent) continue;
            if (inst.counters.untargetable_by_opponent_pi === pi) {
              targets.splice(i, 1);
            }
          }
          if (targets.length === 0) return [];
        }

        // Single-target attack restriction (e.g. Toras, Master of all Weapons).
        // When the caster's heroFlag singleTargetAttack is set, cap selection to 1.
        const casterPi      = cardInstance.controller ?? cardInstance.owner ?? -1;
        const casterHeroIdx = cardInstance.heroIdx ?? -1;
        const casterHeroFlag = (casterPi >= 0 && casterHeroIdx >= 0)
          ? gs.heroFlags?.[`${casterPi}-${casterHeroIdx}`]
          : null;
        const maxCap = casterHeroFlag?.singleTargetAttack ? 1 : (config.max || targets.length);
        const max = Math.min(maxCap, targets.length);
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

        // ── Surprise window check ──
        if (!config._skipSurpriseCheck) {
          const heroTargets = result.filter(t => t.type === 'hero');
          if (heroTargets.length > 0) {
            const surpriseResult = await engine._checkSurpriseWindow(heroTargets, cardInstance);
            if (surpriseResult?.effectNegated) {
              gs._spellNegatedByEffect = true;
              // Clear damage log entries for negated targets
              if (gs._spellDamageLog) {
                for (const t of result) {
                  const idx = gs._spellDamageLog.findIndex(e => e.id === t.id);
                  if (idx >= 0) gs._spellDamageLog.splice(idx, 1);
                }
              }
              return []; // Effect fully negated — don't set _spellCancelled
            }
          }
        }

        // ── Post-target hand reaction check (Invisibility Cloak, etc.) ──
        if (!config._skipPostTargetReactions) {
          const ptResult = await engine._checkPostTargetHandReactions(result, cardInstance);
          if (ptResult?.effectNegated) {
            gs._spellNegatedByEffect = true;
            // Clear damage log entries for negated targets
            if (gs._spellDamageLog) {
              for (const t of result) {
                const idx = gs._spellDamageLog.findIndex(e => e.id === t.id);
                if (idx >= 0) gs._spellDamageLog.splice(idx, 1);
              }
            }
            return [];
          }
        }

        // Anti Magic Enchantment is handled inside actionDealDamage per
        // hero, so spell animations play first and the negation prompt
        // comes only once damage is actually about to resolve.
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

  async actionDealDamage(source, target, amount, type, opts) {
    // ── Anti Magic Enchantment shield ──
    // Fires here, AFTER the spell's own animations have already broadcast
    // (projectile, impact, etc.), so accepting the negation prompt cancels
    // the landing effect cleanly without suppressing the visuals — same
    // sequence used by the first-turn-shielded buff. The prompt runs ONCE
    // per (spell, hero); subsequent actions in the same spell check the
    // cached shielded-hero set and silently no-op.
    if (target && target.hp !== undefined && amount > 0
        && (type === 'destruction_spell' || type === 'spell')) {
      const shielded = await this._maybePromptAntiMagicEnchantment(target, source);
      if (shielded) {
        this.log('ame_damage_blocked', { target: this._heroLabel(target), type });
        return { dealt: 0, cancelled: true, shielded: true };
      }
    }

    // ── Surprise window for direct damage (creature effects, etc.) ──
    // Only fires for hero targets with a card source, skips status/self damage and recursive calls
    // Also skips if the caller already ran the surprise window (e.g. via promptDamageTarget)
    const SURPRISE_SKIP_TYPES = new Set(['status', 'burn', 'poison', 'recoil', 'other']);
    if (
      !this._inSurpriseResolution &&
      !opts?.skipSurpriseCheck &&
      target && target.hp !== undefined &&
      amount > 0 &&
      source?.owner >= 0 && source?.heroIdx >= 0 &&
      !SURPRISE_SKIP_TYPES.has(type)
    ) {
      // Find target hero's owner + index
      const tgtOwner = this._findHeroOwner(target);
      if (tgtOwner >= 0) {
        const tgtPs = this.gs.players[tgtOwner];
        const tgtHeroIdx = (tgtPs?.heroes || []).indexOf(target);
        if (tgtHeroIdx >= 0 && (tgtPs.surpriseZones?.[tgtHeroIdx] || []).length > 0) {
          // Skip if this hero was already surprise-checked by promptDamageTarget
          const heroKey = `${tgtOwner}-${tgtHeroIdx}`;
          if (this.gs._surpriseCheckedHeroes?.has(heroKey)) {
            this.gs._surpriseCheckedHeroes.delete(heroKey);
          } else {
          // Build source for the surprise window — use full CardInstance if available
          const syntheticSource = source.cardInstance
            || (source.id && source.zone ? source : null)  // source IS a CardInstance
            || { name: source.name, controller: source.owner, owner: source.owner,
                 heroIdx: source.heroIdx, zone: source.zone || 'hand' };
          const surpriseResult = await this._checkSurpriseWindow(
            [{ type: 'hero', owner: tgtOwner, heroIdx: tgtHeroIdx, cardName: target.name }],
            syntheticSource
          );
          if (surpriseResult?.effectNegated) {
            return { dealt: 0, cancelled: true, surpriseNegated: true };
          }
          }
        }
      }
    }

    const hookCtx = { source, target, amount, type: type || 'normal', sourceHeroIdx: source?.heroIdx ?? -1, cancelled: false };
    // Alleria redirect: damage cannot be reduced/negated except by Surprises
    if (this.gs._redirectedOnlyReducibleBySurprise) {
      hookCtx.cannotBeNegated = true;
      hookCtx.onlyReducibleBySurprise = true;
      delete this.gs._redirectedOnlyReducibleBySurprise;
    }

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

    // Charmed heroes are immune to all damage (Charme Lv3)
    if (target?.statuses?.charmed && target.hp !== undefined) {
      this.log('damage_blocked', { target: this._heroLabel(target), reason: 'charmed' });
      return { dealt: 0, cancelled: true };
    }

    // Baihu petrify: stunned heroes with _baihuPetrify are immune to all damage
    if (target?.statuses?.stunned?._baihuPetrify && target.hp !== undefined) {
      this.log('damage_blocked', { target: this._heroLabel(target), reason: 'petrified' });
      return { dealt: 0, cancelled: true };
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

    // ── Smug Coin: lethal damage protection (opponent/status sources only) ──
    if (target?.hp > 0 && target.hp !== undefined && hookCtx.amount >= target.hp) {
      const targetOwner = this._findHeroOwner(target);
      if (targetOwner >= 0) {
        const dmgSrcOwner = source?.owner ?? source?.controller ?? -1;
        const isOpponentDamage = dmgSrcOwner >= 0 && dmgSrcOwner !== targetOwner;
        const isStatusDamage = dmgSrcOwner < 0 && (type === 'fire' || type === 'poison' || source?.name === 'Burn' || source?.name === 'Poison');
        if (isOpponentDamage || isStatusDamage) {
          const heroIdx = this.gs.players[targetOwner].heroes.indexOf(target);
          if (heroIdx >= 0) {
            const smugCoinInst = this.cardInstances.find(c =>
              c.name === 'Smug Coin' && c.owner === targetOwner && c.zone === 'support' && c.heroIdx === heroIdx
            );
            if (smugCoinInst) {
              hookCtx.amount = Math.max(0, target.hp - 1);
              this.log('smug_coin_save', { target: this._heroLabel(target), player: this.gs.players[targetOwner]?.username });
              // Broadcast coin rain animation
              this._broadcastEvent('smug_coin_save', { owner: targetOwner, heroIdx });
              // Delete the Smug Coin (remove from zone + untrack)
              const ps = this.gs.players[targetOwner];
              if (ps.supportZones[heroIdx]?.[smugCoinInst.zoneSlot]) {
                ps.supportZones[heroIdx][smugCoinInst.zoneSlot] = [];
              }
              this._untrackCard(smugCoinInst.id);
              this.log('card_deleted', { card: 'Smug Coin', player: ps.username });
            }
          }
        }
      }
    }

    const actualAmount = Math.max(0, hookCtx.amount);
    if (target && target.hp !== undefined) {
      target.hp = Math.max(0, target.hp - actualAmount);
      // Generic damage-tracking flag: records the turn number when the
      // target last took >0 damage. Used by cards like Medusa's Curse
      // ("affect only targets that have not taken damage yet this turn").
      // Not card-specific — any future "damaged this turn" lookup uses this.
      if (actualAmount > 0) target._damagedOnTurn = this.gs.turn;
    }

    this.log('damage', { source: source?.name, target: this._heroLabel(target), amount: actualAmount, damageType: type });
    await this.runHooks(HOOKS.AFTER_DAMAGE, { source, target, amount: actualAmount, type, sourceHeroIdx: source?.heroIdx ?? -1 });

    // ── After-damage hand reaction check (Fireshield, etc.) ──
    // Only fires if target survived and damage was actually dealt
    if (actualAmount > 0 && target && target.hp > 0 && target.hp !== undefined) {
      await this._checkAfterDamageHandReactions(target, source, actualAmount, type);
    }

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
      target.diedOnTurn = this.gs.turn;
      this.log('hero_ko', { hero: this._heroLabel(target), source: source?.name || 'damage' });
      // Store KO context for reaction cards (Loot the Leftovers, etc.)
      const targetOwner = this.gs.players.findIndex(ps => (ps.heroes || []).includes(target));
      this.gs._heroKOContext = { hero: target, source, heroOwner: targetOwner, killerOwner: source?.owner ?? -1 };
      await this.runHooks(HOOKS.ON_HERO_KO, { hero: target, source, _bypassDeadHeroFilter: true });
      delete this.gs._heroKOContext;

      // If a hook (Guardian Angel) restored HP, skip death processing
      if (target.hp > 0) {
        delete target.diedOnTurn;
      } else if (!target._koProcessed) {
        // Cleanup: discard equip artifacts and handle island zone removal
        target._koProcessed = true;
        await this.handleHeroDeathCleanup(target);

        // Check if ALL heroes of a player are dead → opponent wins
        await this.checkAllHeroesDead();
      }
    }

    return { dealt: actualAmount, cancelled: false };
  }

  /**
   * Deal "true damage" — damage that bypasses reductions, multipliers, and
   * negations. Reference implementation for Acid Vial, Rockfall, and any
   * future card whose text reads "this damage cannot be reduced or negated".
   *
   * What it bypasses (vs. actionDealDamage):
   *   • Buff damageMultipliers (Cloudy, medusa_petrified, ...)
   *   • Charmed damage immunity
   *   • Submerged damage immunity
   *   • Baihu Petrify hero-side block
   *   • Immortal/HP-1 caps
   *   • Smug Coin lethal save
   *   • Gate Shield, Guardian (for creature targets)
   *
   * What it still respects:
   *   • firstTurnProtectedPlayer (game-start grace shield — absolute)
   *   • Cardinal Beast immunity + Baihu Petrify on creatures (absolute
   *     "immune to all damage" flags, not reductions)
   *
   * Behavior preserved vs. actionDealDamage:
   *   • Sets `_damagedOnTurn` on the target (used by Medusa's Curse etc.)
   *   • Fires afterDamage hook for heroes
   *   • Goes through processCreatureDamageBatch for creatures, which
   *     handles onCreatureDeath, pile routing, and hand-limit rechecks
   *   • Processes hero KO (onHeroKO hook + handleHeroDeathCleanup + win check)
   *
   * @param {object} source - Source card info for logging/attribution.
   *                          Shape: { name, owner, heroIdx, controller? }
   * @param {object} target - Hero object (has .hp) or CardInstance (has .counters)
   * @param {number} amount - Damage amount
   * @param {object} [opts]  - { type, animType, _skipReactionCheck }
   * @returns {Promise<{ dealt: number }>}
   */
  async actionDealTrueDamage(source, target, amount, opts = {}) {
    if (!target || !(amount > 0)) return { dealt: 0 };

    const type        = opts.type || 'other';
    const sourceOwner = source?.owner ?? source?.controller ?? -1;

    // ── Hero target ──
    if (target.hp !== undefined) {
      const targetOwner = this._findHeroOwner(target);

      // First-turn protection is absolute — it's the game-start grace shield,
      // not a reducible defense. Acid Vial already respected this.
      if (targetOwner >= 0 && this.gs.firstTurnProtectedPlayer === targetOwner) {
        this.log('damage_blocked', { target: this._heroLabel(target), reason: 'shielded' });
        return { dealt: 0 };
      }

      const hpBefore = target.hp;
      target.hp = Math.max(0, target.hp - amount);
      const dealt = hpBefore - target.hp;
      if (dealt > 0) target._damagedOnTurn = this.gs.turn;

      this.log('damage', {
        source: source?.name, target: this._heroLabel(target),
        amount: dealt, damageType: type,
      });

      // Fire afterDamage so Shield of Life/Death, Fireshield, etc. still react.
      await this.runHooks(HOOKS.AFTER_DAMAGE, {
        source, target, amount: dealt, type,
        sourceHeroIdx: source?.heroIdx ?? -1,
        _skipReactionCheck: opts._skipReactionCheck,
      });

      // Track dealt-damage for SC / opponent tracking (mirrors actionDealDamage).
      if (dealt > 0 && sourceOwner >= 0) {
        for (let pi = 0; pi < 2; pi++) {
          if (pi !== sourceOwner && (this.gs.players[pi]?.heroes || []).includes(target)) {
            this.gs.players[sourceOwner].dealtDamageToOpponent = true;
            break;
          }
        }
      }

      // Hero KO — same flow as the normal damage path.
      if (target.hp <= 0) {
        target.diedOnTurn = this.gs.turn;
        this.log('hero_ko', { hero: this._heroLabel(target), source: source?.name || 'true damage' });
        this.gs._heroKOContext = {
          hero: target, source, heroOwner: targetOwner, killerOwner: sourceOwner,
        };
        await this.runHooks(HOOKS.ON_HERO_KO, { hero: target, source, _bypassDeadHeroFilter: true });
        delete this.gs._heroKOContext;
        if (target.hp > 0) {
          delete target.diedOnTurn;
        } else if (!target._koProcessed) {
          target._koProcessed = true;
          await this.handleHeroDeathCleanup(target);
          await this.checkAllHeroesDead();
        }
      }

      return { dealt };
    }

    // ── Creature target (CardInstance) ──
    // Route through the batch so all the centralized plumbing runs
    // (animation, death hooks, _damagedOnTurn tracker, hand-limit rechecks,
    // discard-pile routing). canBeNegated:false pierces Gate Shield,
    // Guardian, and buff multipliers. Cardinal Beast / Baihu absolutes
    // still block — those are "immune to all damage" flags, not reductions.
    if (target.counters) {
      await this.processCreatureDamageBatch([{
        inst: target,
        amount,
        type,
        source,
        sourceOwner,
        canBeNegated: false,
        isStatusDamage: false,
        animType: opts.animType || null,
      }]);
      return { dealt: amount };
    }

    return { dealt: 0 };
  }

  async actionHealHero(source, target, amount) {
    if (!target || target.hp === undefined) return;

    // Anti Magic Enchantment shield — spell-sourced heals on a shielded
    // hero are skipped along with all other spell effects.
    if (this._isAmeShieldedHeroObj(target)) {
      this.log('ame_heal_blocked', { target: this._heroLabel(target), amount });
      return;
    }

    // Check if target has Overheal Shock — converts healing to damage
    let targetPi = -1, targetHi = -1;
    for (let p = 0; p < 2; p++) {
      for (let h = 0; h < (this.gs.players[p]?.heroes || []).length; h++) {
        if (this.gs.players[p].heroes[h] === target) { targetPi = p; targetHi = h; break; }
      }
      if (targetPi >= 0) break;
    }
    if (targetPi >= 0 && targetHi >= 0) {
      const supportZones = this.gs.players[targetPi].supportZones[targetHi] || [];
      const hasOverhealShock = supportZones.some(slot => (slot || []).includes('Overheal Shock'));
      if (hasOverhealShock) {
        this.log('heal_reversed', { source: source?.name, target: this._heroLabel(target), amount, by: 'Overheal Shock' });
        await this.actionDealDamage(source, target, amount, 'other');
        return;
      }
    }

    const maxHp = target.maxHp || target.hp;
    let allowOverheal = false;
    if (source && source.owner != null && source.heroIdx >= 0) {
      const heroOwnerIdx = source.heroOwner != null ? source.heroOwner : source.owner;
      const flagKey = `${heroOwnerIdx}-${source.heroIdx}`;
      if (this.gs.heroFlags?.[flagKey]?.overhealPassive && target.hp <= maxHp) allowOverheal = true;
    }
    const hpBefore = target.hp;
    // Allow Resistance to cancel healing
    const healCtx = { playerIdx: targetPi, heroIdx: targetHi, hero: target, effectType: 'heal', amount, cancelled: false, _skipReactionCheck: true };
    await this.runHooks(HOOKS.BEFORE_HERO_EFFECT, healCtx);
    if (healCtx.cancelled) return;
    if (allowOverheal) {
      target.hp += amount;
      this.log('heal', { source: source?.name, target: this._heroLabel(target), amount, overheal: target.hp > maxHp });
    } else {
      // If already above maxHp (overhealed), do nothing
      if (target.hp >= maxHp) return;
      const healed = Math.min(amount, maxHp - target.hp);
      target.hp = Math.min(maxHp, target.hp + amount);
      this.log('heal', { source: source?.name, target: this._heroLabel(target), amount: healed });
    }

    // Fire afterHeal hook (Lifeforce Howitzer, etc.)
    const actualHealed = target.hp - hpBefore;
    if (actualHealed > 0 && targetPi >= 0 && targetHi >= 0) {
      await this.runHooks('afterHeal', {
        target, healedAmount: actualHealed, source,
        targetOwner: targetPi, targetHeroIdx: targetHi,
        _skipReactionCheck: true,
      });
    }
  }

  /**
   * Heal a creature (card instance in support zone).
   * Respects Nao's overheal passive — if the source hero has overhealPassive,
   * currentHp can exceed the creature's base HP.
   * @param {CardInstance} source - The card performing the heal
   * @param {CardInstance} target - The creature card instance to heal
   * @param {number} amount - Amount to heal
   */
  async actionHealCreature(source, target, amount) {
    if (!target || !target.counters) return;
    if (target.faceDown) return; // Face-down surprises cannot be healed
    const cd = this._getCardDB()[target.name];
    const baseHp = target.counters.maxHp ?? cd?.hp ?? 0;
    if (baseHp <= 0) return;

    // Monia-style creature protection
    if (hasCardType(cd, 'Creature')) {
      const hookCtx = { creature: target, effectType: 'heal', source, cancelled: false, _skipReactionCheck: true };
      await this.runHooks(HOOKS.BEFORE_CREATURE_AFFECTED, hookCtx);
      if (hookCtx.cancelled) return;
    }
    const currentHp = target.counters.currentHp ?? baseHp;
    // Check overheal passive
    let allowOverheal = false;
    if (source && source.owner != null && source.heroIdx >= 0) {
      const heroOwnerIdx = source.heroOwner != null ? source.heroOwner : source.owner;
      const flagKey = `${heroOwnerIdx}-${source.heroIdx}`;
      if (this.gs.heroFlags?.[flagKey]?.overhealPassive && currentHp <= baseHp) allowOverheal = true;
    }
    if (allowOverheal) {
      target.counters.currentHp = currentHp + amount;
      this.log('heal_creature', { source: source?.name, target: target.name, amount, overheal: target.counters.currentHp > baseHp });
    } else {
      // If already above baseHp (overhealed), do nothing
      if (currentHp >= baseHp) return;
      const healed = Math.min(amount, baseHp - currentHp);
      target.counters.currentHp = Math.min(baseHp, currentHp + amount);
      this.log('heal_creature', { source: source?.name, target: target.name, amount: healed });
    }
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
    delete hero._koProcessed; // Allow death cleanup to fire again if hero dies again

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
  increaseMaxHp(target, amount, opts = {}) {
    if (!target || amount <= 0) return 0;

    // ── Creature path ──────────────────────────────────────────────────────
    // Detected by the presence of a counters object (CardInstance).
    // Both currentHp and maxHp are always increased by the full amount —
    // this correctly handles Nao-style overheal (currentHp can exceed maxHp).
    if (target.counters !== undefined) {
      const cd        = this._getCardDB()[target.name];
      const baseHp    = target.counters.maxHp    ?? cd?.hp ?? 0;
      const currentHp = target.counters.currentHp ?? baseHp;
      target.counters.maxHp     = baseHp    + amount;
      target.counters.currentHp = currentHp + amount;
      this.log('max_hp_increase', { target: target.name, amount, newMax: target.counters.maxHp });
      return amount;
    }

    // ── Hero path (original logic) ─────────────────────────────────────────
    const hero = target;
    if (hero.hp === undefined) return 0;
    const alsoHeal   = opts.alsoHealCurrent !== false; // default true
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

  /**
   * Standard reveal pattern for cards added from deck/discard search.
   * Shows each card to the opponent one by one, waiting for confirmation.
   * @param {number} playerIdx - Player who searched
   * @param {string[]} cardNames - Card names to reveal
   * @param {string} title - Title for the reveal prompt (e.g. 'Divine Gift of Creation')
   */
  /**
   * Standard chain lightning target picker.
   * Shows all valid targets, player clicks to select in order.
   * Auto-confirms non-final clicks, confirm button for last target.
   * @param {number} playerIdx - Player who picks targets
   * @param {object[]} targets - Array of target objects with id, type, owner, heroIdx, slotIdx?, cardName
   * @param {number[]} damages - Damage per step, e.g. [200, 150, 100]
   * @param {object} opts - { title, heroesFirst }
   * @returns {object[]} Selected targets in order, or empty array if none
   */
  async promptChainTargets(playerIdx, targets, damages, opts = {}) {
    if (!targets || targets.length === 0) return [];

    // Strip cardInstance references for serialization
    const clientTargets = targets.map(t => {
      const { cardInstance, ...rest } = t;
      return rest;
    });

    const result = await this.promptGeneric(playerIdx, {
      type: 'chainTargetPick',
      title: opts.title || 'Chain Lightning',
      targets: clientTargets,
      damages,
      heroesFirst: opts.heroesFirst || false,
      cancellable: false,
    });

    if (!result || !result.selectedTargets || result.selectedTargets.length === 0) return [];
    // Re-match targets by id to get full data (cardInstance etc.)
    return result.selectedTargets.map(sel => targets.find(t => t.id === sel.id)).filter(Boolean);
  }

  async revealSearchedCards(playerIdx, cardNames, title) {
    if (!cardNames || cardNames.length === 0) return;
    const ps = this.gs.players[playerIdx];
    const oppIdx = playerIdx === 0 ? 1 : 0;
    const searcherName = ps?.username || 'Opponent';

    for (const cardName of cardNames) {
      this._broadcastEvent('deck_search_add', { cardName, playerIdx });
      this.log('deck_search', { player: searcherName, card: cardName, by: title });
      this.sync();
      await this._delay(500);
      await this.promptGeneric(oppIdx, {
        type: 'deckSearchReveal',
        cardName,
        searcherName,
        title,
        cancellable: false,
      });
    }
  }

  /**
   * Search a player's main deck for a card with an exact name, add one copy
   * to their hand, reveal it to the opponent, and shuffle the deck.
   *
   * @param {number}  playerIdx  - The searching player's index.
   * @param {string}  cardName   - Exact card name to search for.
   * @param {string}  title      - Effect title shown in the reveal prompt.
   * @param {object}  [opts]
   * @param {boolean} [opts.shuffle=true]  - Whether to shuffle after (default true).
   * @returns {string|null} The card name if found and added, otherwise null.
   */
  async searchDeckForNamedCard(playerIdx, cardName, title, opts = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return null;

    const idx = (ps.mainDeck || []).indexOf(cardName);
    if (idx < 0) return null;

    ps.mainDeck.splice(idx, 1);
    ps.hand.push(cardName);

    await this.revealSearchedCards(playerIdx, [cardName], title);

    if (opts.shuffle !== false) this.shuffleDeck(playerIdx);

    this.sync();
    return cardName;
  }

  /**
   * Apply (or add a stack to) Poison on a creature instance.
   * Centralised handler used by all Poison effects that target creatures.
   * Handles: immunity check, beforeCreatureAffected hook, stack increment
   * vs fresh application, counter bookkeeping, and logging.
   *
   * @param {object}       source - { name, owner, heroIdx } of the effect source
   * @param {CardInstance} inst   - Target creature instance
   */
  async actionApplyCreaturePoison(source, inst) {
    if (!inst || inst.zone !== 'support') return;
    if (!this.canApplyCreatureStatus(inst, 'poisoned')) return;

    const hookCtx = {
      creature: inst,
      effectType: 'status',
      source,
      cancelled: false,
      _skipReactionCheck: true,
    };
    await this.runHooks('beforeCreatureAffected', hookCtx);
    if (hookCtx.cancelled) return;

    if (inst.counters.poisoned) {
      inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 1;
    } else {
      inst.counters.poisoned = 1;
      inst.counters.poisonStacks = 1;
    }
    inst.counters.poisonAppliedBy = source.owner ?? -1;
    this.log('poison_applied', {
      target: inst.name, stacks: inst.counters.poisonStacks, by: source.name,
    });
  }

  async actionDrawCards(playerIdx, count, opts = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (ps.handLocked) return [];

    // Fire batch-level draw hook (Intrude, etc.) — only for effect draws, not Resource Phase
    if (!opts._skipBatchHook && this.gs.currentPhase !== PHASES.RESOURCE) {
      const batchCtx = { playerIdx, amount: count, deckType: 'main', _skipReactionCheck: true };
      await this.runHooks(HOOKS.BEFORE_DRAW_BATCH, batchCtx);
      count = Math.max(0, batchCtx.amount);
      if (count === 0) return [];
    }

    // Nomu check: if drawing exactly 1 card, auto-draw 1 extra from main deck
    // Capped at 3 bonus draws per turn per player.
    let nomuExtraDraw = false;
    if (count === 1 && !opts._nomuBypass && !this._inNomuResolution) {
      const nomuKey = `nomu_draws:${playerIdx}`;
      const nomuDrawsThisTurn = this.gs._nomuDrawCount?.[nomuKey] || 0;
      if (nomuDrawsThisTurn < 3) {
        nomuExtraDraw = this._hasActiveNomu(playerIdx);
      }
    }

    const drawn = [];
    const drawDelay = count > 1 ? (opts.drawDelay ?? 300) : 0;
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

      // Visual pacing: sync + delay between draws so cards appear one by one
      if (drawDelay > 0 && i < count - 1) {
        this.sync();
        await this._delay(drawDelay);
      }
    }

    // Nomu extra draw: auto-draw 1 additional card from main deck
    if (nomuExtraDraw && drawn.length > 0 && ps.mainDeck.length > 0) {
      this._inNomuResolution = true;
      try {
        // Increment Nomu draw counter for this turn
        const nomuKey = `nomu_draws:${playerIdx}`;
        if (!this.gs._nomuDrawCount) this.gs._nomuDrawCount = {};
        this.gs._nomuDrawCount[nomuKey] = (this.gs._nomuDrawCount[nomuKey] || 0) + 1;
        const extraCard = ps.mainDeck.shift();
        ps.hand.push(extraCard);
        const extraInst = this._trackCard(extraCard, playerIdx, ZONES.HAND);
        drawn.push(extraInst);
        this.log('draw', { player: ps.username, card: extraCard });
        this._broadcastEvent('nomu_draw', { playerIdx, cardName: extraCard });
        await this.runHooks(HOOKS.ON_DRAW, { playerIdx, card: extraInst, cardName: extraCard });

        // Find Nomu hero for logging
        const nomuHero = (ps.heroes || []).find(h => h?.name && h.hp > 0 && loadCardEffect(h.name)?.isNomuHero);
        this.log('nomu_draw', { player: ps.username, hero: nomuHero?.name || 'Nomu' });
      } finally {
        this._inNomuResolution = false;
      }
    }

    // After all draws, check reactive hand limits (Pollution Tokens, etc.)
    if (drawn.length > 0) await this._checkReactiveHandLimits(playerIdx);

    // Accumulate draws for batched surprise check (flushed after effect resolution)
    if (drawn.length > 0 && this.gs.currentPhase !== PHASES.RESOURCE && !this._inSurpriseResolution) {
      if (!this._pendingSurpriseDraws) this._pendingSurpriseDraws = {};
      this._pendingSurpriseDraws[playerIdx] = (this._pendingSurpriseDraws[playerIdx] || 0) + drawn.length;
    }

    return drawn;
  }

  /**
   * Draw cards from a player's Potion Deck. Triggers surprise draw checks
   * (e.g. Pure Advantage Camel) just like regular draws.
   */
  async actionDrawFromPotionDeck(playerIdx, count) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];

    // Fire batch-level draw hook (Intrude, etc.)
    if (this.gs.currentPhase !== PHASES.RESOURCE) {
      const batchCtx = { playerIdx, amount: count, deckType: 'potion', _skipReactionCheck: true };
      await this.runHooks(HOOKS.BEFORE_DRAW_BATCH, batchCtx);
      count = Math.max(0, batchCtx.amount);
      if (count === 0) return [];
    }
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if ((ps.potionDeck || []).length === 0) break;
      const cardName = ps.potionDeck.shift();
      ps.hand.push(cardName);
      drawn.push(cardName);
      this.log('potion_draw', { player: ps.username, card: cardName });
    }
    // Accumulate for surprise draw checks (same as regular draws)
    if (drawn.length > 0 && this.gs.currentPhase !== PHASES.RESOURCE && !this._inSurpriseResolution) {
      if (!this._pendingSurpriseDraws) this._pendingSurpriseDraws = {};
      this._pendingSurpriseDraws[playerIdx] = (this._pendingSurpriseDraws[playerIdx] || 0) + drawn.length;
    }
    return drawn;
  }

  /**
   * Add a specific card to a player's hand (e.g. search effects).
   * Logs 'card_added_to_hand' automatically.
   * @param {number} playerIdx
   * @param {string} cardName
   * @param {string} [source] - Name of the effect/card that caused the add
   */
  actionAddCardToHand(playerIdx, cardName, source) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    ps.hand.push(cardName);
    this.log('card_added_to_hand', { player: ps.username, card: cardName, by: source || null });
    this.sync();
  }

  /**
   * Mill cards from a player's deck to discard or deleted pile.
   * @param {number} playerIdx
   * @param {number} count
   * @param {'discard'|'delete'} [destination='discard']
   * @param {string} [source] - Name of the card/effect causing the mill
   */
  actionMillCards(playerIdx, count, destination = 'discard', source) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const milled = [];
    for (let i = 0; i < count; i++) {
      if (ps.mainDeck.length === 0) break;
      const cardName = ps.mainDeck.shift();
      if (destination === 'delete') {
        ps.deletedPile.push(cardName);
      } else {
        ps.discardPile.push(cardName);
      }
      milled.push(cardName);
    }
    if (milled.length > 0) {
      this.log('mill', { player: ps.username, count: milled.length, destination, source: source || null });
    }
    this.sync();
    return milled;
  }

  /**
   * Shuffle cards from hand back into deck.
   * @param {number} playerIdx
   * @param {string[]} cardNames - Cards to shuffle back
   * @param {string} [source] - Name of the card/effect causing the shuffle
   */
  actionShuffleBackToDeck(playerIdx, cardNames, source) {
    const ps = this.gs.players[playerIdx];
    if (!ps || !cardNames.length) return;
    for (const cn of cardNames) {
      const idx = ps.hand.indexOf(cn);
      if (idx >= 0) {
        ps.hand.splice(idx, 1);
        ps.mainDeck.push(cn);
      }
    }
    this.shuffleDeck(playerIdx);
    this.log('shuffle_back', { player: ps.username, count: cardNames.length, source: source || null });
    this.sync();
  }

  /**
   * Shuffle a player's main deck (Fisher-Yates).
   * In puzzle mode, deck order is intentional — shuffle is skipped.
   * @param {number} playerIdx
   * @param {'main'|'potion'} [deckType='main']
   */
  shuffleDeck(playerIdx, deckType = 'main') {
    if (this.isPuzzle) return;
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    const deck = deckType === 'potion' ? ps.potionDeck : ps.mainDeck;
    if (!deck || deck.length <= 1) return;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  async actionDestroyCard(source, targetCard, opts = {}) {
    if (!targetCard) return;
    if (targetCard.counters?.immovable) return; // Cannot be destroyed or removed
    if (targetCard.counters?._cardinalImmune) return; // Cardinal Beast immunity
    // First-turn protection: cards belonging to the protected player cannot be destroyed
    if (this.gs.firstTurnProtectedPlayer != null && targetCard.owner === this.gs.firstTurnProtectedPlayer) {
      this.log('destroy_blocked', { card: targetCard.name, reason: 'first-turn protection' });
      return;
    }
    // Defending the Gate: protect support zone cards
    if (!opts.ignoreGateShield && targetCard.zone === 'support') {
      await this._triggerGateCheck(targetCard.controller ?? targetCard.owner);
      if (this._isGateShielded(targetCard.controller ?? targetCard.owner)) {
        this.log('destroy_blocked', { card: targetCard.name, reason: 'Defending the Gate' });
        return;
      }
    }
    // Monia-style creature protection
    if (targetCard.zone === 'support') {
      const cd = this._getCardDB()[targetCard.name];
      if (cd && hasCardType(cd, 'Creature')) {
        const hookCtx = { creature: targetCard, effectType: 'destroy', source, cancelled: false, _skipReactionCheck: true };
        await this.runHooks(HOOKS.BEFORE_CREATURE_AFFECTED, hookCtx);
        if (hookCtx.cancelled) {
          this.log('destroy_blocked', { card: targetCard.name, reason: 'creature protection' });
          return;
        }
      }
    }
    this.log('destroy', { source: source?.name, target: targetCard.name });
    await this.actionMoveCard(targetCard, ZONES.DISCARD);
  }

  async actionMoveCard(cardInstance, toZone, toHeroIdx, toSlot, opts = {}) {
    // Immovable cards cannot leave their zone
    if (cardInstance.counters?.immovable && toZone !== cardInstance.zone) return;
    if (cardInstance.counters?._cardinalImmune && toZone !== cardInstance.zone) return; // Cardinal Beast immunity
    const fromZone = cardInstance.zone;
    const fromHeroIdx = cardInstance.heroIdx;

    // Defending the Gate: protect support zone cards
    if (!opts.ignoreGateShield && fromZone === 'support' && this._isGateShielded(cardInstance.controller ?? cardInstance.owner)) {
      return;
    }
    if (!opts.ignoreGateShield && fromZone === 'support' && toZone !== 'support') {
      await this._triggerGateCheck(cardInstance.controller ?? cardInstance.owner);
      if (this._isGateShielded(cardInstance.controller ?? cardInstance.owner)) return;
    }

    // Monia-style creature protection for control changes (not destruction — that's handled in actionDestroyCard)
    if (fromZone === 'support' && toZone !== ZONES.DISCARD && toZone !== ZONES.DELETED) {
      const cd = this._getCardDB()[cardInstance.name];
      if (cd && hasCardType(cd, 'Creature')) {
        const hookCtx = { creature: cardInstance, effectType: 'move', source: null, cancelled: false, _skipReactionCheck: true };
        await this.runHooks(HOOKS.BEFORE_CREATURE_AFFECTED, hookCtx);
        if (hookCtx.cancelled) {
          this.log('move_blocked', { card: cardInstance.name, reason: 'creature protection' });
          return;
        }
      }
    }

    await this.runHooks(HOOKS.ON_CARD_LEAVE_ZONE, {
      card: cardInstance, fromZone, fromHeroIdx,
      fromZoneSlot: cardInstance.zoneSlot ?? -1,
      fromOwner: cardInstance.owner,
      toZone,
    });

    // Cards can set _returnToHand = true in onCardLeaveZone to redirect
    // a discard/delete into a return-to-hand (e.g. The White Eye).
    if (cardInstance._returnToHand && toZone === ZONES.DISCARD) {
      delete cardInstance._returnToHand;
      toZone    = ZONES.HAND;
      toHeroIdx = -1;
      toSlot    = -1;
    }

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

    // Reactive hand-limit enforcement: if a card that was contributing to the
    // owner's hand-size cap leaves the support zone (most notably Royal Corgi's
    // -3 bonus via Goldify / The Yeeting / any destroy or bounce), the owner
    // may now exceed their effective max and must delete down to it. Mirrors
    // the same recheck performed at the end of processCreatureDamageBatch for
    // damage-kills — this branch catches every non-damage destruction path.
    if (fromZone === ZONES.SUPPORT && (cardInstance.counters?.handLimitReduction || 0) !== 0) {
      await this._checkReactiveHandLimits(cardInstance.owner);
    }
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
        await this.runHooks(HOOKS.ON_DISCARD, { playerIdx, card: inst, cardName, discardedCardName: cardName, _fromHand: true });
      }
    }
  }

  // ─── SAFE SUPPORT ZONE PLACEMENT ─────────

  /**
   * Mill `count` cards from the top of a player's main deck to their discard pile.
   * This is NOT discarding — milled cards do NOT fire ON_DISCARD.
   * Fires ON_MILL after the animation delay. Stops early if the deck runs out.
   *
   * @param {number}  playerIdx      - Player whose deck is milled.
   * @param {number}  count          - Max number of cards to mill.
   * @param {object}  [opts]
   * @param {string}  [opts.source]  - Name of the effect causing the mill (for logging).
   * @param {boolean} [opts.deleteMode] - If true, send to deletedPile instead of discardPile.
   * @returns {string[]} The names of cards that were milled.
   */
  async actionMillCards(playerIdx, count, opts = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps || !ps.mainDeck || ps.mainDeck.length === 0) return [];

    // First-turn protection: cannot be milled by opponent effects on turn 1
    if (!opts.selfInflicted && this.gs.firstTurnProtectedPlayer === playerIdx) {
      this.log('mill_blocked', { player: ps.username, reason: 'shielded' });
      return [];
    }

    const toMill     = Math.min(count, ps.mainDeck.length);
    const milledCards = [];
    const pileKey    = opts.deleteMode ? 'deletedPile' : 'discardPile';

    if (opts.targetCardName) {
      // Targeted mill: remove a specific named card from anywhere in the deck
      const idx = ps.mainDeck.indexOf(opts.targetCardName);
      if (idx >= 0) {
        ps.mainDeck.splice(idx, 1);
        ps[pileKey].push(opts.targetCardName);
        milledCards.push(opts.targetCardName);
      }
    } else {
      // Normal mill: take from the top of the deck
      for (let i = 0; i < toMill; i++) {
        const cardName = ps.mainDeck.shift();
        if (!cardName) break;
        ps[pileKey].push(cardName);
        milledCards.push(cardName);
      }
    }

    if (milledCards.length === 0) return [];

    // For any milled card whose script has an onMill hook, create a tracked
    // instance in the discard/deleted zone so it can fire as a listener.
    // (Cards in the deck normally have no tracked instances.)
    const { loadCardEffect } = require('./_loader');
    const destZoneMill = opts.deleteMode ? ZONES.DELETED : ZONES.DISCARD;
    for (const cardName of milledCards) {
      const existing = this.cardInstances.find(
        c => c.owner === playerIdx && c.name === cardName && c.zone === destZoneMill,
      );
      if (!existing) {
        const script = loadCardEffect(cardName);
        if (script?.hooks?.onMill) {
          this._trackCard(cardName, playerIdx, destZoneMill);
        }
      }
    }

    // Log and fire onMill BEFORE the animation — the game state change is already
    // complete, so hooks (Mystery Box draw, Jean bonus mill, etc.) fire immediately.
    this.log('mill', {
      player:      ps.username,
      count:       milledCards.length,
      cards:       milledCards,
      destination: opts.deleteMode ? 'delete' : 'discard',
      source:      opts.source || null,
    });

    await this.runHooks(HOOKS.ON_MILL, {
      playerIdx,
      milledCards,
      count:          milledCards.length,
      source:         opts.source || null,
      deleteMode:     !!opts.deleteMode,
      _jeanTriggered: !!opts._jeanTriggered,
      _skipReactionCheck: true,
    });

    // Broadcast face-up flying-card animation: deck → discard (purely visual)
    this._broadcastEvent('deck_to_discard_animation', {
      owner:        playerIdx,
      cardNames:    milledCards,
      deleteMode:   !!opts.deleteMode,
      holdDuration: opts.holdDuration || 0,
    });

    // Wait for animation only if there's a hold (Magenta's 2s reveal); otherwise skip
    if (opts.holdDuration) {
      const travelMs = 700;
      const holdMs   = opts.holdDuration;
      const fadeMs   = 300;
      await this._delay((milledCards.length - 1) * 200 + travelMs + holdMs + fadeMs + 100);
    }

    this.sync();
    return milledCards;
  }

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

    // Auto-find first free slot when no specific slot requested
    if (actualSlot < 0) {
      for (let z = 0; z < 3; z++) {
        if (((ps.supportZones[heroIdx][z] || []).length === 0)) {
          actualSlot = z;
          break;
        }
      }
      if (actualSlot < 0) {
        this.log('support_zone_full', { card: cardName, heroIdx, reason: 'no_free_zone' });
        return null;
      }
    }

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
    // Track creature summons this turn
    const cardDB = this._getCardDB();
    const cd = cardDB[cardName];
    if (cd && (cd.cardType === 'Creature' || cd.cardType === 'Token')) {
      ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;
    }
    // Log token placements
    if (cd && (cd.cardType === 'Token')) {
      const heroName = ps.heroes?.[heroIdx]?.name || 'Hero';
      this.log('token_placed', { player: ps.username, card: cardName, hero: heroName });
    }
    return { inst, actualSlot };
  }

  /**
   * Centralized creature/token summoning. ALL summon paths should route through this.
   * Guarantees: zone placement, instance tracking (turnPlayed = current turn → summoning
   * sickness), _creaturesSummonedThisTurn increment, onPlay + onCardEnterZone hooks, logging.
   *
   * @param {string} cardName - Name of the creature/token to summon
   * @param {number} playerIdx - Controlling player
   * @param {number} heroIdx - Hero column to summon into
   * @param {number} [zoneSlot=-1] - Specific slot (-1 = auto-find)
   * @param {object} [opts={}] - Options:
   *   {boolean} skipHooks - Skip onPlay/onCardEnterZone hooks (caller fires them manually)
   *   {boolean} skipLog - Skip the summon log entry
   *   {boolean} skipReactionCheck - Pass _skipReactionCheck to hooks
   *   {string} source - Source card name for logging (e.g. 'Necromancy')
   *   {object} hookExtras - Extra fields merged into hook context
   * @returns {{ inst: CardInstance, actualSlot: number } | null}
   */
  /**
   * Sync guardian immunity on a creature to match its controller's side.
   * Adds immunity if siblings have it, removes if they don't.
   * Called on summon (propagate) and on control change (equalize).
   */
  _syncGuardianImmunity(inst, controllerIdx) {
    const existing = this.cardInstances.find(c =>
      c.id !== inst.id && c.zone === ZONES.SUPPORT &&
      (c.controller ?? c.owner) === controllerIdx &&
      c.counters?._guardianImmune && c.counters?.buffs?.guardian
    );
    if (existing) {
      // New side has guardian — propagate
      inst.counters._guardianImmune = true;
      if (!inst.counters.buffs) inst.counters.buffs = {};
      inst.counters.buffs.guardian = { ...existing.counters.buffs.guardian };
    } else {
      // New side has no guardian — remove if present
      if (inst.counters._guardianImmune) {
        delete inst.counters._guardianImmune;
        if (inst.counters.buffs?.guardian) delete inst.counters.buffs.guardian;
      }
    }
  }

  summonCreature(cardName, playerIdx, heroIdx, zoneSlot = -1, opts = {}) {
    const placeResult = this.safePlaceInSupport(cardName, playerIdx, heroIdx, zoneSlot);
    if (!placeResult) return null;

    const { inst, actualSlot } = placeResult;

    // Enforce summoning sickness — belt-and-suspenders with _trackCard
    inst.turnPlayed = this.gs.turn || 0;

    // Propagate guardian immunity to newly summoned creatures
    this._syncGuardianImmunity(inst, playerIdx);

    // Log
    if (!opts.skipLog) {
      const ps = this.gs.players[playerIdx];
      const heroName = ps?.heroes?.[heroIdx]?.name || '?';
      this.log('creature_summoned', {
        player: ps?.username, card: cardName, hero: heroName,
        source: opts.source || null,
      });
    }

    return { inst, actualSlot };
  }

  /**
   * Async companion to summonCreature — places the creature AND fires onPlay + onCardEnterZone hooks.
   * Use this when you want the full summon lifecycle including hooks.
   */
  async summonCreatureWithHooks(cardName, playerIdx, heroIdx, zoneSlot = -1, opts = {}) {
    // Pre-placement gate: if the card defines a `beforeSummon(ctx)` async
    // hook (sacrifice costs etc.) and the summon path isn't opted out via
    // `opts.skipBeforeSummon`, run it FIRST. A returned `false` aborts the
    // summon entirely — no placement, no onPlay, no onCardEnterZone —
    // which is the point: the cost is paid at summon-declaration time, so
    // a failed cost never leaves a ghost creature momentarily on the board.
    if (!opts.skipBeforeSummon) {
      const ok = await this._runBeforeSummon(cardName, playerIdx, heroIdx, opts.hookExtras);
      if (!ok) return null;
    }

    const result = this.summonCreature(cardName, playerIdx, heroIdx, zoneSlot, { ...opts, skipLog: opts.skipLog });
    if (!result) return null;

    const { inst, actualSlot } = result;

    if (!opts.skipHooks) {
      const hookCtx = {
        _onlyCard: inst, playedCard: inst, cardName,
        zone: 'support', heroIdx, zoneSlot: actualSlot,
        _skipReactionCheck: opts.skipReactionCheck !== false,
        ...(opts.hookExtras || {}),
      };
      await this.runHooks('onPlay', hookCtx);
      await this.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
        _skipReactionCheck: opts.skipReactionCheck !== false,
      });
    }

    return { inst, actualSlot };
  }

  /**
   * Run a card's pre-placement `beforeSummon(ctx)` hook if it defines one.
   * Used by summonCreatureWithHooks AND by the server's hand-play path so
   * sacrifice costs (Dragon Pilot, any future "tribute summon" Creature)
   * are paid at the same point regardless of which path summons the card.
   *
   * Returns true to proceed with the summon, false to abort. Exceptions
   * are logged and treated as a false return (safer to fizzle than to
   * summon without resolving a cost we promised to resolve).
   */
  async _runBeforeSummon(cardName, playerIdx, heroIdx, hookExtras = {}) {
    const script = loadCardEffect(cardName);
    if (!script?.beforeSummon) return true;
    try {
      const dummy = new CardInstance(cardName, playerIdx, 'hand', heroIdx);
      const ctx = this._createContext(dummy, { ...hookExtras });
      const res = await script.beforeSummon(ctx);
      return res !== false;
    } catch (err) {
      console.error(`[beforeSummon] ${cardName} threw:`, err.message);
      return false;
    }
  }

  /**
   * Pure gate: is this Creature summonable right now for the given
   * player (and optionally hero)? Walks `script.canSummon(ctx)` with a
   * dummy card instance — same contract as getSummonBlocked's per-hand
   * check, but usable from any summoning effect (Living Illusion,
   * Reincarnation, etc.) that wants to filter its gallery.
   */
  isCreatureSummonable(cardName, playerIdx, heroIdx = -1) {
    const script = loadCardEffect(cardName);
    if (!script?.canSummon) return true;
    try {
      const dummy = new CardInstance(cardName, playerIdx, 'hand', heroIdx);
      const ctx = this._createContext(dummy, { event: 'canSummonCheck' });
      return !!script.canSummon(ctx);
    } catch (err) {
      console.error(`[canSummon] ${cardName} threw:`, err.message);
      return false;
    }
  }

  /**
   * Transfer a creature from one player's control to another.
   * Handles: remove from source zone, onCardLeaveZone hook, transfer animation,
   * place at destination, update instance controller/position, guardian immunity sync.
   *
   * @param {CardInstance} inst - The creature's tracked card instance
   * @param {number} toPlayerIdx - Player index receiving control
   * @param {number} destHeroIdx - Destination hero index
   * @param {number} destSlotIdx - Destination support zone slot
   * @param {object} [opts] - { animDuration, skipAnimation, source }
   * @returns {{ success: boolean }}
   */
  async actionTransferCreature(inst, toPlayerIdx, destHeroIdx, destSlotIdx, opts = {}) {
    const gs = this.gs;
    const fromPlayerIdx = inst.controller ?? inst.owner;
    const fromPs = gs.players[fromPlayerIdx];
    const toPs = gs.players[toPlayerIdx];
    if (!fromPs || !toPs || !inst) return { success: false };

    const cardName = inst.name;
    const srcHeroIdx = inst.heroIdx;
    const srcSlotIdx = inst.zoneSlot;

    // Remove from source support zone
    const srcSlot = (fromPs.supportZones[srcHeroIdx] || [])[srcSlotIdx] || [];
    const srcIdx = srcSlot.indexOf(cardName);
    if (srcIdx >= 0) srcSlot.splice(srcIdx, 1);

    this.sync();

    // Fire leave zone hook
    await this.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst,
      fromZone: 'support', fromHeroIdx: srcHeroIdx,
      _skipReactionCheck: true,
    });

    // Transfer animation
    if (!opts.skipAnimation) {
      const dur = opts.animDuration || 800;
      this._broadcastEvent('play_card_transfer', {
        sourceOwner: fromPlayerIdx, sourceHeroIdx: srcHeroIdx, sourceZoneSlot: srcSlotIdx,
        targetOwner: toPlayerIdx, targetHeroIdx: destHeroIdx, targetZoneSlot: destSlotIdx,
        cardName, duration: dur,
      });
      await this._delay(dur + 100);
    }

    // Place into destination support zone
    if (!toPs.supportZones[destHeroIdx]) toPs.supportZones[destHeroIdx] = [[], [], []];
    if (!toPs.supportZones[destHeroIdx][destSlotIdx]) toPs.supportZones[destHeroIdx][destSlotIdx] = [];
    toPs.supportZones[destHeroIdx][destSlotIdx].push(cardName);

    // Update card instance — controller changes, owner stays (tracks original ownership)
    inst.controller = toPlayerIdx;
    inst.zone = ZONES.SUPPORT;
    inst.heroIdx = destHeroIdx;
    inst.zoneSlot = destSlotIdx;

    // Sync guardian immunity to match new controller's side
    this._syncGuardianImmunity(inst, toPlayerIdx);

    this.sync();
    return { success: true };
  }

  /**
   * Resolve deferred spell recoil (Fire Bolts, etc.).
   * Called by the server after afterSpellResolved completes, so recoil
   * happens after all spell casts (including Bartas second cast).
   */
  async resolveDeferredRecoil() {
    const recoil = this.gs._deferredRecoil;
    if (!recoil) return;
    delete this.gs._deferredRecoil;

    const { cardName, ownerIdx, heroIdx, damage, enhanced, damageType } = recoil;

    // Build own targets for recoil prompt
    const targets = [];
    const ps = this.gs.players[ownerIdx];
    if (!ps) return;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({ id: `hero-${ownerIdx}-${hi}`, type: 'hero', owner: ownerIdx, heroIdx: hi, cardName: hero.name });
    }
    const cardDB = this._getCardDB();
    for (const inst of this.cardInstances) {
      if ((inst.owner !== ownerIdx && inst.controller !== ownerIdx) || inst.zone !== 'support' || inst.faceDown) continue;
      const cd = cardDB[inst.name];
      if (!cd || cd.cardType !== 'Creature') continue;
      targets.push({ id: `equip-${ownerIdx}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip', owner: ownerIdx, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst });
    }
    if (targets.length === 0) return;

    const selected = await this.promptEffectTarget(ownerIdx, targets, {
      title: `${cardName} — Recoil`,
      description: `Choose one of your targets to take ${damage} recoil damage.`,
      confirmLabel: `🔥 ${damage} Recoil!`,
      confirmClass: 'btn-danger',
      cancellable: false,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!selected || selected.length === 0) return;
    const target = targets.find(t => t.id === selected[0]);
    if (!target) return;

    const animType = enhanced ? 'flame_avalanche' : 'flame_strike';
    const zoneSlot = target.type === 'equip' ? target.slotIdx : -1;
    this._broadcastEvent('play_zone_animation', {
      type: animType, owner: target.owner, heroIdx: target.heroIdx, zoneSlot,
    });
    await this._delay(enhanced ? 600 : 400);

    if (target.type === 'hero') {
      const hero = this.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) {
        await this.actionDealDamage({ name: cardName, owner: ownerIdx, heroIdx }, hero, damage, damageType);
      }
    } else if (target.cardInstance) {
      await this.actionDealCreatureDamage(
        { name: cardName, owner: ownerIdx, heroIdx },
        target.cardInstance, damage, damageType,
        { sourceOwner: ownerIdx, canBeNegated: true },
      );
    }

    this.log('recoil', { card: cardName, player: ps.username, damage, target: target.cardName });
    this.sync();
  }

  /**
   * Enable discard-to-delete redirect for a player.
   * All cards that would go to discardPile via .push() are routed to deletedPile instead.
   * Cleared automatically on turn start.
   * @param {number} playerIdx
   */
  enableDiscardToDelete(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps || ps._discardToDeleteActive) return;
    ps._discardToDeleteActive = true;
    const originalPush = Array.prototype.push;
    const pile = ps.discardPile;
    const deleted = ps.deletedPile;
    pile.push = function (...cards) {
      return originalPush.apply(deleted, cards);
    };
  }

  /**
   * Disable discard-to-delete redirect for a player.
   * Restores normal discardPile.push behaviour.
   * @param {number} playerIdx
   */
  disableDiscardToDelete(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps || !ps._discardToDeleteActive) return;
    delete ps._discardToDeleteActive;
    delete ps.discardPile.push; // Remove instance override, restoring Array.prototype.push
  }

  /**
   * Return a card from a player's hand to its original owner's deck.
   * Stolen cards go back to the opponent's deck; owned cards go to own deck.
   * Potions route to potionDeck, others to mainDeck.
   * @param {number} holderIdx - Player currently holding the card
   * @param {string} cardName - Name of the card to return
   * @returns {{ returnedToOwner: number, isPotion: boolean }} or null if card not found
   */
  returnHandCardToDeck(holderIdx, cardName) {
    const ps = this.gs.players[holderIdx];
    if (!ps) return null;

    const handIdx = ps.hand.indexOf(cardName);
    if (handIdx < 0) return null;

    // Find tracked instance to determine original owner
    // Primary: instance owned by holder
    let inst = this.cardInstances.find(c =>
      c.owner === holderIdx && c.zone === 'hand' && c.name === cardName
    );
    // Fallback: stolen card — instance owner differs from holder (e.g. Loot the Leftovers)
    if (!inst) {
      inst = this.cardInstances.find(c =>
        c.zone === 'hand' && c.name === cardName && c.owner !== holderIdx
      );
    }
    const originalOwner = inst?.originalOwner ?? holderIdx;
    const ownerPs = this.gs.players[originalOwner];
    if (!ownerPs) return null;

    // Remove from hand
    ps.hand.splice(handIdx, 1);

    // Route to correct deck (always the original owner's)
    const cardDB = this._getCardDB();
    const cd = cardDB[cardName];
    const isPotion = cd?.cardType === 'Potion';
    if (isPotion) {
      ownerPs.potionDeck.push(cardName);
    } else {
      ownerPs.mainDeck.push(cardName);
    }

    // Untrack
    if (inst) this._untrackCard(inst.id);

    return { returnedToOwner: originalOwner, isPotion };
  }

  /**
   * Mulligan cards from a player's hand back to their original owner's deck.
   * Handles animation flags, per-card return, opponent tracking, and deck shuffling.
   *
   * @param {number} playerIdx - The player whose hand cards are being returned
   * @param {string[]} cardNames - Card names to return (order preserved)
   * @returns {{ potionCount: number }} - Number of potions returned (for draw routing)
   */
  async actionMulliganCards(playerIdx, cardNames) {
    const gs = this.gs;
    let potionCount = 0;

    gs.handReturnToDeck = true;
    gs.handReturnToOppCards = [];

    for (const cardName of cardNames) {
      const result = this.returnHandCardToDeck(playerIdx, cardName);
      if (result) {
        if (result.isPotion) potionCount++;
        if (result.returnedToOwner !== playerIdx) gs.handReturnToOppCards.push(cardName);
      } else {
        // Fallback: remove manually if instance not found
        const idx = gs.players[playerIdx]?.hand?.indexOf(cardName);
        if (idx >= 0) gs.players[playerIdx].hand.splice(idx, 1);
      }
      this.sync();
      await this._delay(150);
    }

    gs.handReturnToDeck = false;
    delete gs.handReturnToOppCards;

    // Shuffle all players' decks (returned cards may have gone to opponent's deck)
    for (let pi = 0; pi < gs.players.length; pi++) {
      if (!gs.players[pi]) continue;
      this.shuffleDeck(pi, 'main');
      this.shuffleDeck(pi, 'potion');
    }

    return { potionCount };
  }

  /**
   * Prompt a player to choose cards to discard from their hand.
   * Uses the standard forceDiscard UI.
   * @param {number} playerIdx - The player who must discard
   * @param {number} count - Number of cards to discard
   * @param {object} opts - { title, source, deleteMode, selfInflicted, eligibleIndices }
   */
  async actionPromptForceDiscard(playerIdx, count, opts = {}) {
    // First-turn protection blocks forced discard (but not self-inflicted costs)
    if (!opts.selfInflicted && this.gs.firstTurnProtectedPlayer === playerIdx) {
      this.log('discard_blocked', { player: this.gs.players[playerIdx]?.username, reason: 'shielded' });
      return;
    }
    const ps = this.gs.players[playerIdx];
    if (!ps || (ps.hand || []).length === 0) return;

    const deleteMode = !!opts.deleteMode;
    const pileKey = deleteMode ? 'deletedPile' : 'discardPile';
    const logEvent = deleteMode ? 'forced_delete' : 'forced_discard';
    const destZone = deleteMode ? ZONES.DELETED : ZONES.DISCARD;
    const hookName = deleteMode ? HOOKS.ON_DELETE : HOOKS.ON_DISCARD;
    const verb = deleteMode ? 'delete' : 'discard';

    const toDiscard = Math.min(count, ps.hand.length);
    for (let i = 0; i < toDiscard; i++) {
      if ((ps.hand || []).length === 0) break;

      const result = await this.promptGeneric(playerIdx, {
        type: 'forceDiscard',
        count: 1,
        title: opts.title || opts.source || (deleteMode ? 'Forced Delete' : 'Forced Discard'),
        description: opts.description || `You must ${verb} ${toDiscard - i} more card${toDiscard - i > 1 ? 's' : ''}.`,
        eligibleIndices: opts.eligibleIndices,
        cancellable: false,
      });

      if (!result || result.cardName == null) {
        // Safety fallback: auto-pop
        const cardName = ps.hand.pop();
        if (cardName) {
          ps[pileKey].push(cardName);
          this.log(logEvent, { player: ps.username, card: cardName, source: opts.source });
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
        ps[pileKey].push(result.cardName);
        this.log(logEvent, { player: ps.username, card: result.cardName, source: opts.source });
      }

      const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: result?.cardName })[0];
      if (inst) {
        inst.zone = destZone;
        await this.runHooks(hookName, { playerIdx, card: inst, cardName: result.cardName, discardedCardName: result.cardName, _fromHand: true, _skipReactionCheck: true });
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

    // Generic hand-limit bypass (Nomu, Willy, future cards)
    if (this._shouldBypassHandLimit(playerIdx)) return;

    // Compute effective max hand size
    let maxSize = opts.maxSize;
    if (maxSize === undefined) {
      maxSize = 7;
      for (const inst of this.cardInstances) {
        if (inst.owner === playerIdx && inst.zone === ZONES.SUPPORT && this.isCardEffectActive(inst)) {
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

    // A currently-resolving spell/attack sits in ps.hand until its effect
    // finishes, but it's already committed to leaving — it must NOT count
    // toward the hand-size check (otherwise the caster would be forced to
    // discard an extra card to make room for a card that's on its way out).
    const resolvingOffset = () => (ps._resolvingCard ? 1 : 0);
    while ((ps.hand || []).length - resolvingOffset() > maxSize) {
      const effective = ps.hand.length - resolvingOffset();
      const excess = effective - maxSize;

      const result = await this.promptGeneric(playerIdx, {
        type: 'forceDiscard',
        count: 1,
        title,
        description: `You have ${effective} cards in hand (max ${maxSize}). ${verb} ${excess} more.`,
        instruction: `Click a card in your hand to ${verb.toLowerCase()} it.`,
        cancellable: false,
      });

      if (!result || result.cardName == null) {
        // Safety: if prompt fails, auto-remove from end of hand
        const cardName = ps.hand.pop();
        ps[pileArr].push(cardName);
        const inst = this.findCards({ owner: playerIdx, zone: ZONES.HAND, name: cardName })[0];
        if (inst) inst.zone = destZone;
        this.log('hand_limit_' + pile, { player: ps.username, card: cardName });
        await this.runHooks(hookName, { playerIdx, cardName, discardedCardName: cardName, _fromHand: true, _skipReactionCheck: true });
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
      await this.runHooks(hookName, { playerIdx, cardName: result.cardName, discardedCardName: result.cardName, _fromHand: true, _skipReactionCheck: true });
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
    // Generic hand-limit bypass (Nomu, Willy, future cards)
    if (this._shouldBypassHandLimit(playerIdx)) return;
    let reduction = 0;
    for (const inst of this.cardInstances) {
      if (inst.owner === playerIdx && inst.zone === ZONES.SUPPORT && this.isCardEffectActive(inst)) {
        reduction += inst.counters.handLimitReduction || 0;
      }
    }
    if (reduction === 0) return;
    const maxSize = Math.max(1, 7 - reduction);
    // Exclude a currently-resolving spell/attack from the count — it's already
    // on its way to the discard pile, so it shouldn't trigger an extra delete.
    const effectiveHand = ps.hand.length - (ps._resolvingCard ? 1 : 0);
    if (effectiveHand > maxSize) {
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

      // Charmed heroes are immune to negative statuses
      if (target?.statuses?.charmed) {
        this.log('status_blocked', { target: this._heroLabel(target), status: statusName, reason: 'charmed' });
        playBlockedAnim();
        return false;
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
    this.log('status_add', { target: target.name || this._heroLabel(target), status: statusName, source: opts.source || opts.by || null });
    await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target, status: statusName, opts });
    return true;
  }

  async actionRemoveStatus(target, statusName) {
    if (!target?.statuses?.[statusName]) return false;
    // Unhealable statuses cannot be removed by any effect
    if (target.statuses[statusName]?.unhealable) return false;
    delete target.statuses[statusName];
    this.log('status_remove', { target: target.name || this._heroLabel(target), status: statusName });
    await this.runHooks(HOOKS.ON_STATUS_REMOVED, { target, status: statusName });
    return true;
  }

  /**
   * Remove multiple statuses from a hero, skipping unhealable ones.
   * Centralized cleanse function — ALL cards that remove statuses should use this.
   * @param {object} hero - Hero object
   * @param {number} playerIdx - Owner index
   * @param {number} heroIdx - Hero index
   * @param {string[]} statusKeys - Array of status keys to remove
   * @param {string} source - Card name for logging (e.g. 'Beer', 'Cure')
   * @returns {string[]} Array of actually removed status keys
   */
  cleanseHeroStatuses(hero, playerIdx, heroIdx, statusKeys, source) {
    if (!hero?.statuses) return [];
    const removed = [];
    for (const key of statusKeys) {
      if (!hero.statuses[key]) continue;
      if (hero.statuses[key]?.unhealable) continue;
      delete hero.statuses[key];
      this.log('status_remove', { target: hero.name, status: key, by: source });
      removed.push(key);
    }
    return removed;
  }

  /**
   * Remove multiple statuses from a creature, skipping unhealable ones.
   * Centralized cleanse function — ALL cards that remove creature statuses should use this.
   * @param {object} inst - Card instance
   * @param {string[]} statusKeys - Array of status counter keys to remove (e.g. ['poisoned', 'stunned'])
   * @param {string} source - Card name for logging
   * @returns {string[]} Array of actually removed status keys
   */
  cleanseCreatureStatuses(inst, statusKeys, source) {
    if (!inst) return [];
    const removed = [];
    for (const key of statusKeys) {
      if (!inst.counters[key]) continue;
      // Creature unhealable: stored as separate counter flag
      if (inst.counters[key + 'Unhealable']) continue;
      delete inst.counters[key];
      delete inst.counters[key + 'Stacks'];
      delete inst.counters[key + 'AppliedBy'];
      this.log('status_remove', { target: inst.name, status: key, by: source });
      removed.push(key);
    }
    return removed;
  }

  /**
   * Get removable (non-unhealable) negative status keys from a hero.
   * Use this to build cleanse target lists for cards like Beer, Coffee, Juice.
   * @param {object} hero - Hero object
   * @returns {string[]} Array of removable negative status keys
   */
  getRemovableHeroStatuses(hero) {
    if (!hero?.statuses) return [];
    const negativeKeys = getNegativeStatuses();
    return negativeKeys.filter(key =>
      hero.statuses[key] && !hero.statuses[key]?.unhealable
    );
  }

  /**
   * Get removable (non-unhealable) negative status keys from a creature.
   * @param {object} inst - Card instance
   * @returns {string[]} Array of removable negative status counter keys
   */
  getRemovableCreatureStatuses(inst) {
    if (!inst) return [];
    const negativeKeys = getNegativeStatuses();
    return negativeKeys.filter(key =>
      inst.counters[key] && !inst.counters[key + 'Unhealable']
    );
  }

  /**
   * Estimate effective damage from a source hero, including hero-level bonuses.
   * Used for damage preview in targeting prompts.
   * Card effects can export estimateDamageBonus(engine, playerIdx, heroIdx, baseDamage, damageType)
   * to participate in the preview calculation.
   * @returns {number} Estimated damage after source-side modifiers
   */
  estimateDamage(playerIdx, heroIdx, baseDamage, damageType) {
    let damage = baseDamage;
    for (const inst of this.cardInstances) {
      if (inst.owner !== playerIdx) continue;
      if (inst.heroIdx !== heroIdx) continue;
      if (!inst.isActiveIn(inst.zone)) continue;
      const script = loadCardEffect(inst.name);
      if (script?.estimateDamageBonus) {
        damage = script.estimateDamageBonus(this, playerIdx, heroIdx, damage, damageType);
      }
    }
    return damage;
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
    // Anti Magic Enchantment shield — spell-sourced buffs on a shielded
    // hero are skipped (the card text is generic "negate the effects of a
    // Spell that hits this Artifact's equipped Hero"; debuffs wrapped as
    // buffs count too).
    if (this._isAmeShieldedHero(playerIdx, heroIdx)) {
      this.log('ame_buff_blocked', { target: hero.name, buff: buffName });
      return false;
    }
    // Allow Resistance (and similar) to cancel the buff
    const buffCtx = { playerIdx, heroIdx, hero, effectType: 'buff_add', buffName, cancelled: false, _skipReactionCheck: true };
    await this.runHooks(HOOKS.BEFORE_HERO_EFFECT, buffCtx);
    if (buffCtx.cancelled) return false;
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
    if (inst.faceDown) return false; // Face-down surprises cannot be buffed
    if (inst.counters?._cardinalImmune) return false; // Cardinal Beast immunity
    if (!opts.ignoreGateShield && this._isGateShielded(inst.controller ?? inst.owner)) return false; // Defending the Gate
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
    // Allow Resistance to cancel debuff removal too (e.g. an enemy stripping a hero's buff)
    const buffCtx = { playerIdx, heroIdx, hero, effectType: 'buff_remove', buffName, cancelled: false, _skipReactionCheck: true };
    await this.runHooks(HOOKS.BEFORE_HERO_EFFECT, buffCtx);
    if (buffCtx.cancelled) return;
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
    if (inst.faceDown) return; // Face-down surprises cannot be debuffed
    // forceClear bypasses the immunity/shield gates — used for buff SELF
    // expiry where the buff itself is what granted the immunity (e.g. Golden
    // Wings sets _cardinalImmune, whose check here would otherwise prevent
    // the buff from ever coming back off).
    if (!opts.forceClear) {
      if (inst.counters?._cardinalImmune) return; // Cardinal Beast immunity
      if (!opts.ignoreGateShield && inst.zone === 'support' && this._isGateShielded(inst.controller ?? inst.owner)) return; // Defending the Gate
    }
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
   *
   * Supports two-pass operation via opts.beforeStatusDamage:
   *   true  → only expire buffs with expiresBeforeStatusDamage flag (Immortal, etc.)
   *   false → only expire buffs WITHOUT that flag (Cloudy, etc.)
   *   undefined → expire all matching buffs (legacy behavior)
   */
  async _processBuffExpiry(opts = {}) {
    const currentTurn = this.gs.turn;
    const activePlayer = this.gs.activePlayer;
    const filterEarly = opts.beforeStatusDamage;
    let expired = false;

    // Hero buffs
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.buffs) continue;
        for (const [buffName, buffData] of Object.entries(hero.buffs)) {
          if (buffData.expiresAtTurn !== currentTurn || buffData.expiresForPlayer !== activePlayer) continue;
          if (filterEarly === true && !buffData.expiresBeforeStatusDamage) continue;
          if (filterEarly === false && buffData.expiresBeforeStatusDamage) continue;
          await this.actionRemoveBuff(hero, pi, hi, buffName);
          expired = true;
        }
      }
    }

    // Creature buffs
    for (const inst of this.cardInstances) {
      if (inst.zone !== ZONES.SUPPORT || !inst.counters?.buffs) continue;
      for (const [buffName, buffData] of Object.entries(inst.counters.buffs)) {
        if (buffData.expiresAtTurn !== currentTurn || buffData.expiresForPlayer !== activePlayer) continue;
        if (filterEarly === true && !buffData.expiresBeforeStatusDamage) continue;
        if (filterEarly === false && buffData.expiresBeforeStatusDamage) continue;
        // Forward expiresForceClear so buffs that ALSO granted the immunity
        // (e.g. Golden Wings setting _cardinalImmune) can strip themselves
        // cleanly on expiry.
        await this.actionRemoveCreatureBuff(inst, buffName, { forceClear: !!buffData.expiresForceClear });
        expired = true;
      }
    }

    // Hero STATUS expiry — any status carrying expiresAtTurn/expiresForPlayer
    // (e.g. 'nulled' from Null Zone). Uses the same turn/player keying as
    // the buff system so one caller site handles everything.
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.statuses) continue;
        for (const [statusName, statusData] of Object.entries(hero.statuses)) {
          if (!statusData || typeof statusData !== 'object') continue;
          if (statusData.expiresAtTurn !== currentTurn || statusData.expiresForPlayer !== activePlayer) continue;
          if (filterEarly === true && !statusData.expiresBeforeStatusDamage) continue;
          if (filterEarly === false && statusData.expiresBeforeStatusDamage) continue;
          await this.removeHeroStatus(pi, hi, statusName);
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
   * @param {string} [opts.statusKey] - Counter key to set (default: 'negated'). Pass
   *   'nulled' for Null Zone so the effect surfaces as the cleansable "Nulled" status
   *   instead of the default "Negated" one.
   * @param {string} [opts.removeAnim] - Animation to play when negation expires
   */
  actionNegateCreature(inst, source, opts = {}) {
    if (!inst) return;
    if (inst.faceDown) return; // Face-down surprises cannot be negated
    if (!opts.ignoreGateShield && inst.zone === 'support' && this._isGateShielded(inst.controller ?? inst.owner)) return; // Defending the Gate
    const statusKey = opts.statusKey || 'negated';
    inst.counters[statusKey] = 1;
    if (!inst.counters.buffs) inst.counters.buffs = {};
    const buffKey = opts.buffKey || `${source.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_negated`;
    inst.counters.buffs[buffKey] = {
      expiresAtTurn: opts.expiresAtTurn,
      expiresForPlayer: opts.expiresForPlayer,
      clearCountersOnExpire: [statusKey],
      source,
      ...(opts.removeAnim ? { removeAnim: opts.removeAnim } : {}),
    };
    this.log('creature_negated', { creature: inst.name, source, buffKey, statusKey });
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
  canApplyCreatureStatus(inst, statusName, source, opts = {}) {
    if (!inst) return false;
    if (inst.faceDown) return false; // Face-down surprises cannot receive statuses
    if (!opts.ignoreGateShield && inst.zone === 'support' && this._isGateShielded(inst.controller ?? inst.owner)) return false; // Defending the Gate
    // Generic absolute-immunity gate: _cardinalImmune blocks every status
    // application, matching how it already blocks damage / destroy / move /
    // buff-add. Used by Cardinal Beasts and Golden Wings.
    if (inst.counters?._cardinalImmune) return false;
    const immuneKey = statusName + '_immune';
    if (inst.counters[immuneKey]) return false;
    // Monia-style creature protection (synchronous check via _moniaShieldActive)
    if (this.gs._moniaShieldActive != null && inst.owner === this.gs._moniaShieldActive) return false;
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
    if (inst.faceDown) return true; // Face-down surprises are immune to everything
    // Check creature's own immunity counter
    if (inst.counters[immuneType]) return true;
    // First-turn protection grants targeting + control immunity
    if (this.gs.firstTurnProtectedPlayer != null) {
      if (inst.controller === this.gs.firstTurnProtectedPlayer) return true;
    }
    return false;
  }

  /**
   * Check whether a card instance's passive effects are currently "active"
   * (i.e. whether its counters should be read by engine state aggregators).
   *
   * Mirrors the suppression rules in runHooks() so that any engine code that
   * sums counters across instances (hand-limit reduction, ATK auras, future
   * aggregators) behaves consistently with the hook dispatcher: a card that
   * wouldn't fire its hooks also doesn't contribute its counters.
   *
   * Support-zone cards are inactive when:
   *   • face-down
   *   • negated/frozen/stunned (own counters)
   *   • attached to a dead hero
   *
   * Note: Frozen/stunned/negated *heroes* only suppress their own 'hero' and
   * 'ability' zone effects — their support-zone cards (creatures, equips,
   * tokens) still fire and still contribute. This matches runHooks lines
   * 418–422 exactly.
   *
   * @param {CardInstance} inst
   * @returns {boolean}
   */
  isCardEffectActive(inst) {
    if (!inst) return false;
    if (inst.faceDown) return false;
    if (inst.zone === ZONES.SUPPORT) {
      if (inst.counters?.negated || inst.counters?.nulled || inst.counters?.frozen || inst.counters?.stunned) return false;
      const hero = this.gs.players[inst.controller ?? inst.owner]?.heroes?.[inst.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;
    }
    return true;
  }

  // ─── IMMEDIATE HERO ACTION (Coffee, etc.) ──────

  /**
   * Get all action cards (Attack/Spell/Creature) a specific hero could play from hand.
   * Checks spell school, level, free zones, summon lock.
   */
  getHeroEligibleActionCards(playerIdx, heroIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const hero = ps.heroes[heroIdx];
    if (!hero?.name || hero.hp <= 0) return [];
    // Per-hero action limit (Sol Rym, etc.)
    if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) return [];
    const cardDB = this._getCardDB();
    const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];
    const eligible = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || !ACTION_TYPES.includes(cd.cardType)) continue;
      // Check spell school / level requirements (centralized)
      if (!this.heroMeetsLevelReq(playerIdx, heroIdx, cd)) continue;
      // Creatures need a free support zone
      if (hasCardType(cd, 'Creature')) {
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
      if (script?.spellPlayCondition && !script.spellPlayCondition(this.gs, playerIdx, this)) continue;
      seen.add(cardName);
      eligible.push(cardName);
    }
    return eligible;
  }

  /**
   * Compute per-hero playable action cards for the client.
   * Returns a map of hero indices → card names that the hero can play,
   * considering ALL hero-specific constraints: level/school, frozen/stunned,
   * combo lock, per-hero action limit, hero script restrictions (Ghuanjun, etc.),
   * equip restrictions, creature support zone availability,
   * AND phase-aware action economy (bonus actions, additional actions, inherent actions).
   *
   * This is the single source of truth for card playability — the client
   * never duplicates action economy logic, it just does a lookup.
   *
   * @param {number} playerIdx
   * @returns {{ own: Object<number, string[]>, charmed: Object<number, string[]> }}
   */
  getHeroPlayableCards(playerIdx) {
    const gs = this.gs;
    const ps = gs.players[playerIdx];
    if (!ps) return { own: {}, charmed: {} };

    const cardDB = this._getCardDB();
    const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];

    // Phase context for action economy checks
    const isActionPhase = gs.currentPhase === 3;
    const isMainPhase = gs.currentPhase === 2 || gs.currentPhase === 4;
    const heroActed = (ps.heroesActedThisTurn?.length || 0) > 0;

    // Collect unique action cards from hand
    const handCards = [];
    const seen = new Set();
    for (const cardName of (ps.hand || [])) {
      if (seen.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd || !ACTION_TYPES.includes(cd.cardType)) continue;
      seen.add(cardName);
      handCards.push(cd);
    }

    const own = {};

    // ── Own heroes ──
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      const playable = [];

      // Hero-wide blocks: dead, frozen, stunned, combo-locked out, action limit
      if (!hero?.name || hero.hp <= 0) { own[hi] = playable; continue; }
      if (hero.statuses?.frozen || hero.statuses?.stunned) { own[hi] = playable; continue; }
      if (ps.comboLockHeroIdx != null && ps.comboLockHeroIdx !== hi) { own[hi] = playable; continue; }
      if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) { own[hi] = playable; continue; }

      // Pre-load hero script and equip scripts for per-card checks
      const heroScript = loadCardEffect(hero.name);
      const equipScripts = [];
      for (const inst of this.cardInstances) {
        if (inst.owner !== playerIdx || inst.zone !== 'support' || inst.heroIdx !== hi) continue;
        if (!inst.counters?.treatAsEquip) continue;
        const eScript = loadCardEffect(inst.name);
        if (eScript?.canPlayCard) equipScripts.push(eScript);
      }

      // Bonus action state for this hero:
      // - `bonusActions` is hero-specific with optional type restrictions (Ghuanjun combo).
      // - `_bonusMainActions` is the Torchure-style "second-action grace slot." It's a
      //   one-shot flag (not a stacking counter) granting access to exactly ONE specific
      //   Action Phase slot: the player's second action this phase. The flag is consumed
      //   (or lost) as soon as a second action is played, whether that action was
      //   regular, additional, or inherent. We track action count with
      //   `_actionsPlayedThisPhase` (incremented by each play handler) to identify which
      //   slot we're in. The grace slot is available iff we've already played exactly
      //   one action (slot #2) and the flag is set.
      const hasBonusAction = isActionPhase && ps.bonusActions?.heroIdx === hi && ps.bonusActions.remaining > 0;
      const actionsPlayed = ps._actionsPlayedThisPhase || 0;
      const hasBonusMainAction = isActionPhase && (ps._bonusMainActions || 0) > 0 && actionsPlayed === 1;

      for (const cd of handCards) {
        // Reaction subtype: not proactively playable unless script opts in
        if ((cd.subtype || '').toLowerCase() === 'reaction') {
          const s = loadCardEffect(cd.name);
          if (!s?.proactivePlay) continue;
        }
        // Nulled heroes cannot cast Spells (Null Zone). Mirrors the play-time
        // gate in validatePlayActionCardCommon so the client grays the spell
        // out when no non-nulled hero can cast it.
        if (cd.cardType === 'Spell' && hero.statuses?.nulled) continue;
        // Generic per-player Spell lock (Eraser Beam / any future "only Spell
        // this turn" card). Blocks further Spell plays once the lock is set;
        // cleared in the turn-start reset path alongside other per-turn flags.
        if (cd.cardType === 'Spell' && ps._spellLockTurn === gs.turn) continue;
        // Area cards (any type with subtype 'Area') can only be cast while
        // the caster's own area zone is empty. Mirrors the play-time gate.
        if ((cd.subtype || '').toLowerCase() === 'area'
            && (gs.areaZones?.[playerIdx] || []).length > 0) continue;
        // Reality Crack set _cantPlayAreaThisTurn — any Area card is locked
        // for the rest of the turn.
        if ((cd.subtype || '').toLowerCase() === 'area'
            && ps._cantPlayAreaThisTurn === gs.turn) continue;
        // Level/school requirements (handles levelOverrideCards, bypassLevelReq, negation, Performance, Wisdom)
        if (!this.heroMeetsLevelReq(playerIdx, hi, cd)) continue;
        // Wisdom hand-size check: player must have enough cards to pay the discard cost
        if (cd.cardType === 'Spell') {
          const wisdomCost = this.getWisdomDiscardCost(playerIdx, hi, cd);
          if (wisdomCost > 0 && (ps.hand.length - 1) < wisdomCost) continue;
        }
        // Hero script card restriction (e.g. Ghuanjun duplicate attack ban)
        if (heroScript?.canPlayCard && !heroScript.canPlayCard(gs, playerIdx, hi, cd, this)) continue;
        // Equipped card restrictions (treatAsEquip cards in support zones)
        let equipBlocked = false;
        for (const es of equipScripts) {
          if (!es.canPlayCard(gs, playerIdx, hi, cd, this)) { equipBlocked = true; break; }
        }
        if (equipBlocked) continue;
        // Creature-specific: need a free support zone and not summon-locked
        if (hasCardType(cd, 'Creature')) {
          if (ps.summonLocked) continue;
          const supZones = ps.supportZones[hi] || [];
          let hasFree = false;
          for (let z = 0; z < 3; z++) { if ((supZones[z] || []).length === 0) { hasFree = true; break; } }
          if (!hasFree) continue;
        }
        // Card-level per-hero gate. Opposite side of `canPlayCard` (which is
        // a HERO script asking "can this card be played here?"): this is the
        // CARD script asking "can I be cast from this specific Hero?". Used
        // by Living Illusion to require a free Support Zone on the casting
        // Hero specifically, and by any future card with similar per-hero
        // constraints that aren't expressible via generic checks.
        const cdScript = loadCardEffect(cd.name);
        if (cdScript?.canPlayWithHero && !cdScript.canPlayWithHero(gs, playerIdx, hi, cd, this)) continue;

        // ── Phase-aware action economy (single source of truth) ──

        // Action Phase: after a hero has already acted, cards need bonus action or additional action coverage
        if (isActionPhase && heroActed) {
          if (hasBonusMainAction) {
            // Generic bonus main action (Torchure, Dragon Pilot Lv1 sacrifice, etc.):
            // no hero restriction, no type restriction — any action card is playable.
            // Consumption happens in advanceToPhase, not here.
          } else if (hasBonusAction) {
            // Hero-specific bonus actions (Ghuanjun combo, etc.): only the allowed card types
            const allowed = ps.bonusActions.allowedTypes || [];
            if (allowed.length > 0 && !allowed.includes(cd.cardType)) continue;
          } else {
            // Normal: must have an additional action provider for this card + hero
            if (!this.findAdditionalActionForCard(playerIdx, cd.name, hi)) continue;
          }
        }

        // Main Phase: action cards need inherent action or additional action coverage
        if (isMainPhase) {
          const cardScript = loadCardEffect(cd.name);
          const isInherent = cardScript?.inherentAction === true
            || (typeof cardScript?.inherentAction === 'function' && cardScript.inherentAction(gs, playerIdx, hi, this));
          if (!isInherent && !this.findAdditionalActionForCard(playerIdx, cd.name, hi)) continue;
        }

        playable.push(cd.name);
      }
      own[hi] = playable;
    }

    // ── Charmed opponent heroes ──
    const charmed = {};
    const oppIdx = 1 - playerIdx;
    const oppPs = gs.players[oppIdx];
    if (oppPs) {
      for (let hi = 0; hi < (oppPs.heroes || []).length; hi++) {
        const hero = oppPs.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.charmedBy !== playerIdx) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
        // Combo lock does NOT apply to charmed heroes
        if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) continue;

        const heroScript = loadCardEffect(hero.name);
        const equipScripts = [];
        for (const inst of this.cardInstances) {
          if (inst.owner !== oppIdx || inst.zone !== 'support' || inst.heroIdx !== hi) continue;
          if (!inst.counters?.treatAsEquip) continue;
          const eScript = loadCardEffect(inst.name);
          if (eScript?.canPlayCard) equipScripts.push(eScript);
        }

        const playable = [];
        for (const cd of handCards) {
          // Reaction subtype: not proactively playable unless script opts in
          if ((cd.subtype || '').toLowerCase() === 'reaction') {
            const s = loadCardEffect(cd.name);
            if (!s?.proactivePlay) continue;
          }
          // Nulled (Null Zone) blocks Spells here just like for own heroes.
          if (cd.cardType === 'Spell' && hero.statuses?.nulled) continue;
          // Generic per-player Spell lock — `ps` here is the acting player,
          // since Spell-play restrictions follow the caster not the hero owner.
          if (cd.cardType === 'Spell' && ps._spellLockTurn === gs.turn) continue;
          // Level/school check uses opponent's ability zones (where the charmed hero lives)
          if (!this.heroMeetsLevelReq(oppIdx, hi, cd)) continue;
          // Wisdom hand-size check: acting player (ps) must have enough cards to pay
          if (cd.cardType === 'Spell') {
            const wisdomCost = this.getWisdomDiscardCost(oppIdx, hi, cd);
            if (wisdomCost > 0 && (ps.hand.length - 1) < wisdomCost) continue;
          }
          if (heroScript?.canPlayCard && !heroScript.canPlayCard(gs, oppIdx, hi, cd, this)) continue;
          let equipBlocked = false;
          for (const es of equipScripts) {
            if (!es.canPlayCard(gs, oppIdx, hi, cd, this)) { equipBlocked = true; break; }
          }
          if (equipBlocked) continue;
          // Creature checks: summonLocked is on the acting player, support zones on the hero owner
          if (hasCardType(cd, 'Creature')) {
            if (ps.summonLocked) continue;
            const supZones = oppPs.supportZones[hi] || [];
            let hasFree = false;
            for (let z = 0; z < 3; z++) { if ((supZones[z] || []).length === 0) { hasFree = true; break; } }
            if (!hasFree) continue;
          }
          playable.push(cd.name);
        }
        if (playable.length > 0) charmed[hi] = playable;
      }
    }

    return { own, charmed };
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
  validateActionPlay(pi, cardName, handIndex, heroIdx, expectedTypes, opts = {}) {
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

    // Divine Gift of Creation lock — cards with locked names can't be played this turn
    if (ps._creationLockedNames?.has(cardName)) return null;

    // Hero validation — charmed heroes are on the opponent's side
    const heroOwner = opts.charmedOwner != null ? opts.charmedOwner : pi;
    const heroPs = gs.players[heroOwner];
    const hero = heroPs?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return null;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return null;

    // Nulled heroes (Null Zone) can play Attacks and Creatures but not
    // Spells. This is a generic gate — any future card applying the
    // 'nulled' hero status benefits for free. "Nulled" is a cleansable
    // negative status (Juice/Tea/Coffee all strip it).
    if (hero.statuses?.nulled && cardData.cardType === 'Spell') return null;

    // Generic per-player Spell lock — set by cards that declare themselves
    // "the only Spell you play this turn" (Eraser Beam). Cleared at turn
    // start alongside other per-turn flags.
    if (cardData.cardType === 'Spell' && ps._spellLockTurn === gs.turn) return null;

    // Area-play lock (Reality Crack): once set, no further Area Spells
    // may be cast this turn by this player. Flag is cleared at turn end.
    if (ps._cantPlayAreaThisTurn === gs.turn &&
        (cardData.subtype || '').toLowerCase() === 'area') {
      return null;
    }

    // Generic Area rule: a player can only play an Area card (any type
    // with subtype "Area") while their OWN Area zone is empty. The zone
    // lives on gs.areaZones[playerIdx]; heroOwner is the caster's side
    // (equal to pi unless the spell is cast through a charmed opponent).
    if ((cardData.subtype || '').toLowerCase() === 'area'
        && (gs.areaZones?.[heroOwner] || []).length > 0) {
      return null;
    }

    // If charmedOwner is set, verify the hero is actually charmed by this player
    if (opts.charmedOwner != null && hero.charmedBy !== pi) return null;

    // Combo lock (only for own heroes)
    if (opts.charmedOwner == null && ps.comboLockHeroIdx != null && ps.comboLockHeroIdx !== heroIdx) return null;

    // Per-hero action limit (Sol Rym, etc.)
    if (hero._maxActionsPerTurn && (hero._actionsThisTurn || 0) >= hero._maxActionsPerTurn) return null;

    // Spell school / level requirements — centralized check (handles levelOverrideCards, bypassLevelReq, negation)
    if (!this.heroMeetsLevelReq(heroOwner, heroIdx, cardData)) return null;

    // Load card script
    const script = loadCardEffect(cardName);

    // Reaction subtype: not proactively playable unless script opts in
    if ((cardData.subtype || '').toLowerCase() === 'reaction' && !script?.proactivePlay) return null;

    // Once-per-game check
    if (script?.oncePerGame) {
      const opgKey = script.oncePerGameKey || cardName;
      if (ps._oncePerGameUsed?.has(opgKey)) return null;
    }

    // Support Spell lock (Friendship Lv1 debuff)
    if (ps.supportSpellLocked && cardData.cardType === 'Spell' && cardData.spellSchool1 === 'Support Magic') return null;

    // Custom play conditions (spells/attacks)
    if (script?.spellPlayCondition && !script.spellPlayCondition(gs, pi, this)) return null;

    // Card-level per-hero gate — same hook used by getPlayableActionCards
    // to filter the client-side eligible list, re-checked here so direct
    // socket plays can't bypass it.
    if (script?.canPlayWithHero && !script.canPlayWithHero(gs, pi, heroIdx, cardData, this)) return null;

    // Generic draw/search lock: cards with blockedByHandLock cannot be played while hand is locked
    if (script?.blockedByHandLock && ps.handLocked) return null;

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

    return { ps, cardData, hero, script, isActionPhase, isMainPhase, isInherentAction };
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

    let eligible = this.getHeroEligibleActionCards(playerIdx, heroIdx);

    // Optional card type filter (e.g. ['Attack', 'Spell'] for Invisibility Cloak)
    if (config.allowedCardTypes) {
      const cardDB = this._getCardDB();
      eligible = eligible.filter(name => {
        const cd = cardDB[name];
        return cd && config.allowedCardTypes.includes(cd.cardType);
      });
    }

    // Also check for activatable abilities on this hero (unless skipped)
    const activatableAbilities = [];
    if (!config.skipAbilities) {
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
    } // end skipAbilities check

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

    if (hasCardType(cardData, 'Creature')) {
      if (zoneSlot === undefined || zoneSlot < 0) return { played: false };
      if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
      if ((ps.supportZones[heroIdx][zoneSlot] || []).length > 0) return { played: false };

      ps.hand.splice(handIndex, 1);

      // Centralized creature summon — handles placement, tracking, summoning sickness
      const placeResult = this.summonCreature(cardName, playerIdx, heroIdx, zoneSlot, { source: config.title });
      if (!placeResult) {
        ps.discardPile.push(cardName);
        this.log('creature_fizzle', { card: cardName, reason: 'zone_occupied', by: config.title });
        return { played: false };
      }
      const { inst, actualSlot } = placeResult;

      this._broadcastEvent('summon_effect', { owner: playerIdx, heroIdx, zoneSlot: actualSlot, cardName });

      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: actualSlot, _skipReactionCheck: true });
      await this.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx, _skipReactionCheck: true });

      this.log('immediate_action', { hero: hero.name, card: cardName, cardType: 'Creature', by: config.title });

    } else {
      // Spell or Attack
      ps.hand.splice(handIndex, 1);
      const inst = this._trackCard(cardName, playerIdx, 'hand', heroIdx, -1);
      this.gs._immediateActionContext = true;
      // Start a fresh damage log so afterSpellResolved sees the targets
      // this spell actually hit (Bartas needs the unique-target list to
      // decide whether to offer a second cast).
      const hadPriorLog = this.gs._spellDamageLog !== undefined;
      if (!hadPriorLog) this.gs._spellDamageLog = [];
      // Apply target exclusion if configured (Invisibility Cloak, etc.)
      if (config.excludeTargets) this.gs._spellExcludeTargets = config.excludeTargets;
      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx, _skipReactionCheck: true });
      if (config.excludeTargets) delete this.gs._spellExcludeTargets;
      delete this.gs._immediateActionContext;

      // Fire afterSpellResolved for Spells — parity with the normal spell-
      // play path in server.js so hero passives like Bartas (Bomb Berserker),
      // Andras, Beato, Luck, etc. trigger off immediate-action spells too.
      if (cardData.cardType === 'Spell' && !this.gs._spellNegatedByEffect) {
        const uniqueTargets = [];
        const seenIds = new Set();
        for (const t of (this.gs._spellDamageLog || [])) {
          if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
        }
        await this.runHooks('afterSpellResolved', {
          spellName: cardName, spellCardData: cardData,
          heroIdx, casterIdx: playerIdx,
          damageTargets: uniqueTargets,
          isSecondCast: !!this.gs._bartasSecondCast,
          _skipReactionCheck: true,
        });
      }
      if (!hadPriorLog) delete this.gs._spellDamageLog;
      delete this.gs._spellNegatedByEffect;

      ps.discardPile.push(cardName);
      this._untrackCard(inst.id);
      this.log('immediate_action', { hero: hero.name, card: cardName, cardType: cardData.cardType, by: config.title });
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

  /**
   * Perform an immediate action with ANY hero. Shows the heroAction UI
   * without restricting to a single hero — the player drags a card onto
   * whichever hero they want, just like during the normal Action Phase.
   * @param {number} playerIdx
   * @param {object} config - { title, description, allowedCardTypes?, skipAbilities?, cancellable? }
   * @returns {{ played: boolean, cardName?: string, cardType?: string }}
   */
  async performImmediateActionAnyHero(playerIdx, config = {}) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return { played: false };
    const cardDB = this._getCardDB();

    // Collect eligible cards across ALL alive heroes
    const eligibleSet = new Set();
    const activatableAbilities = [];

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;

      let heroEligible = this.getHeroEligibleActionCards(playerIdx, hi);
      if (config.allowedCardTypes) {
        heroEligible = heroEligible.filter(name => {
          const cd = cardDB[name];
          return cd && config.allowedCardTypes.includes(cd.cardType);
        });
      }
      for (const name of heroEligible) eligibleSet.add(name);

      // Activatable abilities on this hero
      if (!config.skipAbilities) {
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
        for (let zi = 0; zi < (ps.abilityZones[hi] || []).length; zi++) {
          const slot = (ps.abilityZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const abilityName = slot[0];
          const script = loadCardEffect(abilityName);
          if (!script?.actionCost) continue;
          const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
          if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;
          activatableAbilities.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length });
        }
      }
    }

    const eligible = [...eligibleSet];
    if (eligible.length === 0 && activatableAbilities.length === 0) return { played: false };

    // Show heroAction prompt with no specific hero — player can use any
    const actionResult = await this.promptGeneric(playerIdx, {
      type: 'heroAction',
      // heroIdx intentionally omitted — allows all heroes
      eligibleCards: eligible,
      activatableAbilities,
      title: config.title || 'Immediate Action',
      description: config.description || 'Use an action with any Hero!',
      cancellable: config.cancellable !== undefined ? config.cancellable : false,
    });

    if (!actionResult || actionResult.cancelled) return { played: false };

    // Handle ability activation
    if (actionResult.abilityActivation) {
      const { heroIdx: abHeroIdx, zoneIdx } = actionResult;
      if (abHeroIdx == null) return { played: false };
      const slot = (ps.abilityZones[abHeroIdx] || [])[zoneIdx] || [];
      if (slot.length === 0) return { played: false };
      const abilityName = slot[0];
      const level = slot.length;
      const script = loadCardEffect(abilityName);
      if (!script?.actionCost || !script?.onActivate) return { played: false };

      const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
      if (!this.gs.hoptUsed) this.gs.hoptUsed = {};
      this.gs.hoptUsed[hoptKey] = this.gs.turn;

      const inst = this.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === 'ability' && c.heroIdx === abHeroIdx && c.zoneSlot === zoneIdx
      );
      if (!inst) return { played: false };

      this._broadcastEvent('ability_activated', { owner: playerIdx, heroIdx: abHeroIdx, zoneIdx, abilityName });
      const ctx = this._createContext(inst, {});
      await script.onActivate(ctx, level);
      this.sync();
      return { played: true, cardName: abilityName, cardType: 'Ability' };
    }

    // Handle card play — heroIdx comes from the client response
    const { cardName, handIndex, heroIdx: responseHeroIdx, zoneSlot } = actionResult;
    if (!cardName || responseHeroIdx == null) return { played: false };

    const cardData = cardDB[cardName];
    if (!cardData) return { played: false };
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return { played: false };

    const hero = ps.heroes[responseHeroIdx];
    if (!hero?.name || hero.hp <= 0) return { played: false };

    const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];
    if (!ACTION_TYPES.includes(cardData.cardType)) return { played: false };

    if (cardData.cardType === 'Creature') {
      ps.hand.splice(handIndex, 1);
      const placeResult = this.safePlaceInSupport(cardName, playerIdx, responseHeroIdx, zoneSlot ?? -1);
      if (!placeResult) {
        ps.discardPile.push(cardName);
        this.log('creature_fizzle', { card: cardName, reason: 'zone_occupied', by: config.title });
        return { played: false };
      }
      const { inst, actualSlot } = placeResult;
      // Propagate guardian immunity to newly placed creatures
      this._syncGuardianImmunity(inst, playerIdx);
      this._broadcastEvent('summon_effect', { owner: playerIdx, heroIdx: responseHeroIdx, zoneSlot: actualSlot, cardName });
      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx: responseHeroIdx, zoneSlot: actualSlot, _skipReactionCheck: true });
      await this.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: responseHeroIdx, _skipReactionCheck: true });
      this.log('immediate_action', { hero: hero.name, card: cardName, cardType: 'Creature', by: config.title });
    } else {
      // Spell or Attack
      ps.hand.splice(handIndex, 1);
      const inst = this._trackCard(cardName, playerIdx, 'hand', responseHeroIdx, -1);
      this.gs._immediateActionContext = true;
      if (config.excludeTargets) this.gs._spellExcludeTargets = config.excludeTargets;
      await this.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'hand', heroIdx: responseHeroIdx, _skipReactionCheck: true });
      if (config.excludeTargets) delete this.gs._spellExcludeTargets;
      delete this.gs._immediateActionContext;
      ps.discardPile.push(cardName);
      this._untrackCard(inst.id);
      this.log('immediate_action', { hero: hero.name, card: cardName, cardType: cardData.cardType, by: config.title });
    }

    this.sync();
    await this._delay(400);

    if (this.gs._spellFreeAction) {
      delete this.gs._spellFreeAction;
      this.log('free_action_refund', { card: cardName, hero: hero.name, by: config.title });
      const another = await this.performImmediateActionAnyHero(playerIdx, config);
      return { played: true, cardName, cardType: cardData.cardType, chainedAction: another };
    }

    return { played: true, cardName, cardType: cardData.cardType };
  }

  // ─── TURN / PHASE MANAGEMENT ───────────────

  /**
   * Start the game's first turn. Call once after init().
   */
  async startGame() {
    // Track hand cards — in normal games, starting hands are drawn AFTER init(),
    // so hand cards need to be registered here. In puzzle/single-player mode,
    // hands are pre-populated and already tracked by init() — skip to avoid duplicates.
    if (!this.isPuzzle) {
      for (let pi = 0; pi < 2; pi++) {
        const ps = this.gs.players[pi];
        for (const cardName of (ps.hand || [])) {
          this._trackCard(cardName, pi, ZONES.HAND);
        }
      }
    }

    // First turn rule: opponent of the starting player is fully shielded
    // (blocks ALL damage, ALL status effects, discard, mill — everything)
    // Skipped in puzzle mode — the whole point is to kill the opponent in one turn.
    if (!this.isPuzzle) {
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
    }
    await this.runHooks(HOOKS.ON_GAME_START, {});
    await this.startTurn();
  }

  /**
   * Begin a new turn for the active player.
   */
  async startTurn() {
    this.gs.currentPhase = PHASES.START;

    // ── Revert charmed heroes (Charme Lv3) ──
    for (const ps of this.gs.players) {
      if (!ps) continue;
      for (const hero of (ps.heroes || [])) {
        if (hero?.charmedBy != null) {
          delete hero.charmedBy;
          delete hero.charmedFromOwner;
          delete hero.charmedHeroIdx;
          if (hero.statuses?.charmed) delete hero.statuses.charmed;
          this.log('charme_revert', { hero: hero.name });
        }
        // Revert Controlled Attack
        if (hero?.controlledBy != null) {
          delete hero.controlledBy;
        }
      }
    }
    delete this.gs._charmedSupportLocked;

    // Reset per-turn flags
    const activePs = this.gs.players[this.gs.activePlayer];
    if (activePs) activePs.abilityGivenThisTurn = [false, false, false];
    this._resetTerrorTracking();
    // Clear summon lock for both players (it's a per-turn restriction)
    for (const ps of this.gs.players) {
      if (ps) {
        ps.summonLocked = false;
        ps.handLocked = false;
        ps.damageLocked = false;
        ps.dealtDamageToOpponent = false;
        ps.potionLocked = false;
        ps.supportSpellLocked = false;
        ps.oppHandLocked = false; // Slow — cannot interact with opponent's hand this turn
        ps.supportSpellUsedThisTurn = false;
        ps.potionsUsedThisTurn = 0;
        ps.attacksPlayedThisTurn = 0;
        ps.comboLockHeroIdx = null;
        ps.heroesActedThisTurn = [];
        ps.heroesAttackedThisTurn = [];
        ps._creaturesSummonedThisTurn = 0;
        delete ps._creationLockedNames;
        delete ps._revealedCardCounts;
        // Clear discard-to-delete redirect (Madaga's Forsaken, etc.)
        if (ps._discardToDeleteActive) this.disableDiscardToDelete(this.gs.players.indexOf(ps));
        ps.bonusActions = null;
        ps._bonusMainActions = 0;
        ps._actionsPlayedThisPhase = 0;
        // Reset per-hero action counters (Sol Rym, etc.)
        for (const hero of (ps.heroes || [])) {
          if (hero?._actionsThisTurn) hero._actionsThisTurn = 0;
        }
      }
    }
    // Reset Nomu bonus draw counter each turn
    this.gs._nomuDrawCount = {};
    // Reset Resistance block counters each turn
    this.gs._resistanceBlocks = {};
    // Refresh Anti Magic Enchantment charges on every enchanted artifact each
    // turn start ("once per turn" per the card text). Engine-level refresh so
    // the behaviour doesn't depend on any particular card instance staying
    // tracked/active.
    for (const inst of this.cardInstances) {
      if (inst.zone !== ZONES.SUPPORT) continue;
      const e = inst.counters?.antiMagicEnchanted;
      if (!e) continue;
      e.charges = 1;
      if (inst.counters.buffs?.anti_magic_enchanted) {
        delete inst.counters.buffs.anti_magic_enchanted.spent;
      }
    }
    this.log('turn_start', { turn: this.gs.turn, activePlayer: this.gs.activePlayer, username: activePs?.username });

    // Process status effects FIRST — before any card hooks fire
    // This ensures burn damage only hits burns from previous turns,
    // not burns applied during this turn's ON_TURN_START (e.g. Barker → Fiery Slime)
    await this.processStatusExpiry('START');

    // Early buff expiry: remove buffs flagged with expiresBeforeStatusDamage BEFORE
    // burn/poison fires (e.g. Ghuanjun's Immortal should not protect through opponent's burn tick)
    await this._processBuffExpiry({ beforeStatusDamage: true });

    // Burn/poison damage BEFORE regular buff expiry — so buffs like Cloudy still
    // halve status damage on the turn they expire
    await this.processBurnDamage();
    await this.processPoisonDamage();

    // Hook: all status damage done — deferred effects (Elixir revive choice) can resolve
    await this.runHooks(HOOKS.AFTER_ALL_STATUS_DAMAGE, { _skipReactionCheck: true });

    // Process regular buff expiry (Cloudy, etc.) AFTER status damage
    await this._processBuffExpiry({ beforeStatusDamage: false });

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
    await this._flushSurpriseDrawChecks();
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
        // Compute which targeting artifacts/potions have no valid targets
        this.gs.unactivatableArtifacts = this.getUnactivatableArtifacts(this.gs.activePlayer);
        // Player-controlled phase — wait for manual advance
        this.sync();
        break;

      case PHASES.ACTION:
        // Reset per-phase action count (tracks total actions played for
        // Torchure-style second-action-slot semantics)
        for (const ps of this.gs.players) {
          if (ps) ps._actionsPlayedThisPhase = 0;
        }
        // Compute which creatures have custom summon conditions that block them
        this.gs.summonBlocked = this.getSummonBlocked(this.gs.activePlayer);
        // Player-controlled — wait for card play or manual skip
        this.sync();
        break;

      case PHASES.END:
        // Automatic phase — process status expiry, hooks, then switch turn
        await this.processStatusExpiry('END');
        await this.runHooks(HOOKS.ON_PHASE_END, { phase: phaseName, phaseIndex: phase });
        await this._flushSurpriseDrawChecks();
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

    // Generic bonus action system: if a card granted a second-action grace slot
    // (Torchure), keep the player in Action Phase when they try to advance after
    // their first action. The flag is consumed (or lost) in the play handlers the
    // moment a second action begins — we never decrement it here, because the skip
    // must fire once per second-action-slot attempt, and the slot is defined by
    // _actionsPlayedThisPhase === 1.
    if (current === PHASES.ACTION && targetPhase === PHASES.MAIN2) {
      const ps = this.gs.players[playerIdx];
      const actionsPlayed = ps?._actionsPlayedThisPhase || 0;
      if (ps?._bonusMainActions > 0 && actionsPlayed === 1) {
        this.sync();
        return true; // Stay in Action Phase — player has a pending 2nd-action grace slot
      }
    }

    // Clear bonus action state when actually leaving Action Phase
    if (current === PHASES.ACTION) {
      const ps = this.gs.players[playerIdx];
      if (ps?.bonusActions) {
        ps.bonusActions = null;
      }
      // Clear any residual main-action bonus + phase action count at phase exit
      if (ps && (ps._bonusMainActions || 0) > 0) {
        ps._bonusMainActions = 0;
      }
      if (ps) {
        ps._actionsPlayedThisPhase = 0;
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
    // If game already ended (e.g. all heroes dead during End Phase), don't continue
    if (this.gs.result) return;

    // Puzzle mode: the human player's turn just ended without winning.
    // Before declaring failure, simulate the opponent's start-of-turn status damage
    // (burn/poison) — it should be possible to win via lingering status effects.
    if (this._cpuPlayerIdx >= 0) {
      const nextPlayer = this.gs.activePlayer === 0 ? 1 : 0;
      if (this.isPuzzle && nextPlayer === this._cpuPlayerIdx) {
        // Temporarily switch to opponent to process their burn/poison
        this.gs.activePlayer = this._cpuPlayerIdx;
        this.gs.turn++;
        await this.processBurnDamage();
        if (this.gs.result) return; // Burn killed all heroes → puzzle success
        await this.processPoisonDamage();
        if (this.gs.result) return; // Poison killed all heroes → puzzle success
        this.sync();
        await this._delay(300);
        // Status damage didn't finish them — puzzle failed
        if (this.onGameOver) this.onGameOver(this.room, this._cpuPlayerIdx, 'puzzle_failed');
        return;
      }
    }

    await this.runHooks(HOOKS.ON_TURN_END, { turn: this.gs.turn, activePlayer: this.gs.activePlayer });
    // Clear itemLocked for the player whose turn is ending
    // (it lasts from when it's applied until after the afflicted player's own turn)
    const endingPs = this.gs.players[this.gs.activePlayer];
    if (endingPs) endingPs.itemLocked = false;
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
    const allCards = this._getCardDB();
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
      // Support Spell lock (Friendship Lv1 debuff)
      if (ps.supportSpellLocked) {
        const cd = allCards[cardName];
        if (cd && cd.cardType === 'Spell' && cd.spellSchool1 === 'Support Magic') {
          blocked.push(cardName);
          continue;
        }
      }
      if (script?.spellPlayCondition) {
        if (!script.spellPlayCondition(this.gs, playerIdx, this)) blocked.push(cardName);
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
      if (script?.canActivate && (script.isTargetingArtifact || script.isPotion || script.resolve)) {
        if (!script.canActivate(this.gs, playerIdx, this)) blocked.push(cardName);
      }
      // Reaction cards: check reactionCondition for dimming.
      // Cards with proactivePlay use canActivate for proactive availability instead,
      // so reactionCondition only gates the reaction trigger window, not the hand dimming.
      if (script?.isReaction && script.reactionCondition && !script.proactivePlay) {
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
    // CPU auto-response: resolve immediately
    if (this.isCpuPlayer(playerIdx)) {
      await this._delay(50);
      return this._getCpuTargetResponse(validTargets, config);
    }
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
          minRequired: config.minRequired || 0,
          // Pollution-cap rule: caps non-own-support selections while leaving
          // own-support targets exempt. Consumed by togglePotionTarget.
          maxNonOwnSupport: config.maxNonOwnSupport,
          // Sacrifice-summon rule: confirm stays disabled until the sum of
          // the selected targets' `_meta.maxHp` values meets this floor
          // (Dragon Pilot etc.). Complements minRequired / maxTotal.
          minSumMaxHp: config.minSumMaxHp,
        },
      };
      this.sync();
    });
  }

  /**
   * Broadcast a pending card_reveal to the opponent once the player has confirmed.
   * Called from resolveEffectPrompt / resolveGenericPrompt after a non-cancelled response.
   */
  _firePendingCardReveal() {
    const pending = this.gs._pendingCardReveal;
    if (!pending) return;
    delete this.gs._pendingCardReveal;
    const oi = pending.ownerIdx === 0 ? 1 : 0;
    const oppSid = this.gs.players[oi]?.socketId;
    if (oppSid) this.io.to(oppSid).emit('card_reveal', { cardName: pending.cardName });
    if (this.room.spectators) {
      for (const spec of this.room.spectators) {
        if (spec.socketId) this.io.to(spec.socketId).emit('card_reveal', { cardName: pending.cardName });
      }
    }
    // Fire any pending play log at the same time as the card reveal
    this._firePendingPlayLog();
  }

  /**
   * Queue a log entry to fire when the card is revealed (on first confirmed prompt).
   * If no prompts occur, call _firePendingPlayLog() manually after resolution.
   */
  _setPendingPlayLog(type, data) {
    this.gs._pendingPlayLog = { type, data };
  }

  _firePendingPlayLog() {
    const pending = this.gs._pendingPlayLog;
    if (!pending) return;
    delete this.gs._pendingPlayLog;
    this.log(pending.type, pending.data);
    // Track for Terror: extract card name from log data
    const cardName = pending.data?.card || pending.data?.hero;
    if (cardName) {
      const playerName = pending.data?.player;
      const pi = this.gs.players.findIndex(p => p.username === playerName);
      if (pi >= 0) this._trackTerrorResolvedEffect(pi, cardName);
    }
  }

  /**
   * Track a resolved effect for Terror's counter.
   * Called after spells, attacks, artifacts, creatures, abilities, hero effects,
   * creature effects, potions, and permanent effects resolve.
   * @param {number} playerIdx - The player who resolved the effect
   * @param {string} cardName - The name of the card/effect resolved
   */
  _trackTerrorResolvedEffect(playerIdx, cardName) {
    if (!this.gs._terrorTracking) this.gs._terrorTracking = { 0: [], 1: [] };
    const set = this.gs._terrorTracking[playerIdx] || [];
    if (set.includes(cardName)) return; // Already tracked this card name this turn
    set.push(cardName);
    this.gs._terrorTracking[playerIdx] = set;

    // Check Terror threshold
    this._checkTerrorThreshold(playerIdx);
  }

  /**
   * Check if any Terror ability's threshold is reached.
   * If so, set a flag to force the turn to End Phase.
   */
  _checkTerrorThreshold(playerIdx) {
    const count = (this.gs._terrorTracking?.[playerIdx] || []).length;
    if (count === 0) return;

    // Find the lowest threshold from all Terror instances in play
    let threshold = Infinity;
    const cardDB = this._getCardDB();
    for (let pi = 0; pi < 2; pi++) {
      const ps = this.gs.players[pi];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.negated) continue;
        const abZones = ps.abilityZones[hi] || [];
        // Count Terror copies on this hero
        let terrorCount = 0;
        for (const zone of abZones) {
          for (const name of (zone || [])) {
            if (name === 'Terror') terrorCount++;
          }
        }
        if (terrorCount > 0) {
          const t = 10 - terrorCount; // 1 copy = 9, 2 copies = 8, 3 copies = 7
          if (t < threshold) threshold = t;
        }
      }
    }

    if (count >= threshold && !this.gs._terrorForceEndTurn) {
      this.gs._terrorForceEndTurn = playerIdx;
      this.log('terror_triggered', {
        player: this.gs.players[playerIdx]?.username,
        count,
        threshold,
      });
    }
  }

  /**
   * Reset Terror tracking for a player (called at turn start).
   */
  _resetTerrorTracking() {
    this.gs._terrorTracking = { 0: [], 1: [] };
    delete this.gs._terrorForceEndTurn;
  }

  /**
   * Check if a player has an active (alive, non-incapacitated) Nomu hero.
   */
  _hasActiveNomu(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      const script = loadCardEffect(hero.name);
      if (script?.isNomuHero) return true;
    }
    return false;
  }

  /**
   * Generic hand-limit bypass check.
   * Returns true if the player should skip hand size enforcement this turn.
   * Sources:
   *  - Hero scripts with bypassHandLimit flag (alive, not incapacitated)
   *  - Per-player _noHandLimitUntilTurn (turn-based bypass, e.g. Willy)
   */
  _shouldBypassHandLimit(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return false;
    // Turn-based bypass (Willy, etc.)
    if (ps._noHandLimitUntilTurn != null && (this.gs.turn || 1) <= ps._noHandLimitUntilTurn) return true;
    // Hero-based bypass (alive + not incapacitated)
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      if (hero.bypassHandLimit) return true;
      const script = loadCardEffect(hero.name);
      if (script?.bypassHandLimit) return true;
    }
    // Area-card-based bypass (Big Gwen, etc.) — walks every Area the player
    // controls and asks its module if it's currently bypassing the limit.
    // The module's bypassHandLimit receives (engine, playerIdx) so it can
    // inspect any state it needs (e.g. Big Gwen also requires the player
    // to control a Pollution Token).
    for (const inst of this.cardInstances) {
      if (inst.zone !== 'area') continue;
      if (inst.owner !== playerIdx) continue;
      const script = loadCardEffect(inst.name);
      if (!script?.bypassHandLimit) continue;
      if (typeof script.bypassHandLimit === 'function') {
        if (script.bypassHandLimit(this, playerIdx)) return true;
      } else if (script.bypassHandLimit === true) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolve a pending effect prompt (called by server socket handler).
   */
  resolveEffectPrompt(selectedIds) {
    if (!this._pendingPrompt) return false;
    const { resolve } = this._pendingPrompt;
    this._pendingPrompt = null;
    this.gs.potionTargeting = null;
    if (selectedIds && selectedIds.length > 0) this._firePendingCardReveal();
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

    // ── Hero-based redirects (Alleria, etc.) ──
    // Scan heroes for redirect capabilities (heroRedirect flag on script)
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

      const heroScript = loadCardEffect(hero.name);
      if (!heroScript?.heroRedirect) continue;

      // Check card-specific redirect eligibility
      if (heroScript.canHeroRedirect && !heroScript.canHeroRedirect(this.gs, targetOwnerIdx, hi, selected, validTargets, config, this)) continue;

      // Prompt the target's owner
      const attackerName = config.title || sourceCard?.name || 'an effect';
      const confirmed = await this.promptGeneric(targetOwnerIdx, {
        type: 'confirm',
        title: hero.name,
        message: `Redirect ${attackerName}?`,
        showCard: sourceCard?.name || null,
        confirmLabel: '🕸️ Redirect!',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed) continue;

      // Run the hero's redirect logic (hero selection, animation, etc.)
      const result = await heroScript.onHeroRedirect(this, targetOwnerIdx, hi, selected, validTargets, config, sourceCard);
      if (!result?.redirectTo) continue;

      // Reveal hero card
      const otherIdx = targetOwnerIdx === 0 ? 1 : 0;
      const otherSid = this.gs.players[otherIdx]?.socketId;
      if (otherSid) this.io.to(otherSid).emit('card_reveal', { cardName: hero.name });
      if (this.room.spectators) {
        for (const spec of this.room.spectators) {
          if (spec.socketId) this.io.to(spec.socketId).emit('card_reveal', { cardName: hero.name });
        }
      }

      this.log('target_redirect', {
        redirectCard: hero.name,
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
    // CPU auto-response: resolve immediately without socket round-trip
    if (this.isCpuPlayer(playerIdx)) {
      await this._delay(50); // Minimal delay to let event loop breathe
      const response = this._getCpuGenericResponse(promptData);
      return response;
    }
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
      this._firePendingCardReveal();
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

  // ─── SURPRISE SYSTEM ─────────────────────

  /**
   * Check face-down Surprises in targeted heroes' Surprise Zones.
   * For each matching Surprise, prompt the owner to activate it.
   * Returns { effectNegated: true } if the triggering effect should be fully negated.
   *
   * @param {Array} targetedHeroes - [{ type:'hero', owner, heroIdx, cardName }]
   * @param {CardInstance} sourceCard - The card that is targeting these heroes
  /**
   * Check if any opponent Surprise cards trigger on equip/attachment.
   * Called from runHooks after onCardEnterZone for non-Creature support zone entries.
   * @param {number} equipOwnerIdx - The player who equipped/attached
   * @param {number} equipHeroIdx - Hero that received the equip
   * @param {object} equipCard - The card instance that was equipped
   */
  // ─── DEFENDING THE GATE SHIELD SYSTEM ───────────
  
  /**
   * Check if Defending the Gate should trigger for this player's support zones.
   * Returns true if shield is active (existing or newly activated).
   * Call this from async contexts before opponent effects modify support zones.
   */
  async _triggerGateCheck(targetOwnerIdx) {
    // Already shielded this resolution
    if (this.gs._gateShieldActive === targetOwnerIdx) return true;
    
    if (this._inGateCheck) return false;
    
    const ps = this.gs.players[targetOwnerIdx];
    if (!ps) return false;
    
    // Find a Defending the Gate surprise
    let gateHeroIdx = -1;
    let gateName = null;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;
      const sz = ps.surpriseZones?.[hi] || [];
      if (sz.length === 0) continue;
      const script = loadCardEffect(sz[0]);
      if (script?.isDefendingGate) {
        if (!this._canHeroActivateSurprise(targetOwnerIdx, hi, sz[0])) continue;
        gateHeroIdx = hi;
        gateName = sz[0];
        break;
      }
    }
    if (gateHeroIdx < 0) return false;
    
    this._inGateCheck = true;
    this.gs._surprisePendingCount = (this.gs._surprisePendingCount || 0) + 1;
    this.gs.surprisePending = true;
    try {
      const heroName = ps.heroes[gateHeroIdx]?.name || 'Hero';
      const confirmed = await this.promptGeneric(targetOwnerIdx, {
        type: 'confirm',
        title: gateName,
        message: `Your Support Zone cards are about to be affected! Activate ${gateName} on ${heroName} to protect them?`,
        showCard: gateName,
        confirmLabel: '🛡️ Defend!',
        cancelLabel: 'No',
        cancellable: true,
      });
      
      if (!confirmed) return false;
      
      // Use centralized _activateSurprise — handles flip, logging, hooks (Bakhm), discard
      const script = loadCardEffect(gateName);
      await this._activateSurprise(targetOwnerIdx, gateHeroIdx, gateName, {}, script);
      
      return this.gs._gateShieldActive === targetOwnerIdx;
    } finally {
      this._inGateCheck = false;
      this.gs._surprisePendingCount = Math.max(0, (this.gs._surprisePendingCount || 1) - 1);
      if (this.gs._surprisePendingCount === 0) this.gs.surprisePending = false;
    }
  }
  
  /**
   * Sync check: is this player's support zone currently shielded by Defending the Gate?
   */
  _isGateShielded(targetOwnerIdx) {
    return this.gs._gateShieldActive === targetOwnerIdx;
  }

  async _checkSurpriseOnEquip(equipOwnerIdx, equipHeroIdx, equipCard) {
    if (this._inSurpriseResolution) return null;
    const opponentIdx = equipOwnerIdx === 0 ? 1 : 0;
    const equipInfo = { equipOwner: equipOwnerIdx, equipHeroIdx, cardName: equipCard?.name, cardInstance: equipCard };
    const equipPlayerName = this.gs.players[equipOwnerIdx]?.username || 'Opponent';
    return this._scanSurpriseEntriesForPlayer(opponentIdx, 'surpriseEquipTrigger', equipInfo, {
      message: () => `${equipPlayerName} equipped ${equipCard?.name || 'a card'}!`,
      showCard: equipCard?.name,
    });
  }

  /**
   * Check if any Surprise cards trigger on creature summons.
   * Unlike equip/draw triggers, summon triggers can fire for EITHER player's surprises.
   * @param {number} summonerIdx - The player who summoned
   * @param {object} summonedCard - The card instance that was summoned
   */
  /**
   * Check if any opponent Surprise cards trigger on ability attachment.
   * @param {number} attachOwnerIdx - The player who attached the ability
   * @param {number} attachHeroIdx - Hero that received the ability
   * @param {object} attachCard - The card instance that was attached
   */
  /**
   * Check if any opponent Surprise cards trigger on hero effect activation.
   * Called from server.js before the hero effect resolves.
   * @param {number} activatorIdx - The player who activated the hero effect
   * @param {number} heroIdx - The hero that used the effect
   * @param {string} effectName - Name of the effect being used
   * @returns {object|null} { negateEffect: true, tokenPlacedOnHeroIdx } or null
   */
  /**
   * Get all surprise entries for a player — both regular surprise zones
   * AND Bakhm's support zones (face-down surprise creatures).
   * Returns array of { heroIdx, cardName, isBakhmSlot, zoneSlot }
   */
  _getAllSurpriseEntries(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    const entries = [];

    // Regular surprise zones
    for (let heroIdx = 0; heroIdx < (ps.heroes || []).length; heroIdx++) {
      const surpriseZone = ps.surpriseZones?.[heroIdx] || [];
      if (surpriseZone.length > 0) {
        entries.push({
          heroIdx,
          cardName: surpriseZone[0],
          isBakhmSlot: false,
          zoneSlot: -1,
        });
      }
    }

    // Bakhm's support zones — face-down surprise creatures
    for (let heroIdx = 0; heroIdx < (ps.heroes || []).length; heroIdx++) {
      const hero = ps.heroes[heroIdx];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
      // Check if this hero is Bakhm
      const heroScript = loadCardEffect(hero.name);
      if (!heroScript?.isBakhmHero) continue;
      // Scan support zones for face-down surprise creatures
      for (let si = 0; si < (ps.supportZones[heroIdx] || []).length; si++) {
        const slot = (ps.supportZones[heroIdx] || [])[si] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const inst = this.cardInstances.find(c =>
          c.owner === playerIdx && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === si && c.name === cardName
        );
        if (!inst?.faceDown) continue;
        const cardScript = loadCardEffect(cardName);
        if (!cardScript?.isSurprise) continue;
        entries.push({
          heroIdx,
          cardName,
          isBakhmSlot: true,
          zoneSlot: si,
        });
      }
    }

    return entries;
  }

  /**
   * Generic scanner: iterate over all surprise entries (regular + Bakhm) for a player,
   * check a specific trigger flag, prompt, and activate. Returns the result of the first
   * activated surprise, or null.
   * @param {number} playerIdx - Player whose surprises to scan
   * @param {string} triggerFlag - Script flag to check (e.g. 'surpriseDrawTrigger')
   * @param {object} triggerInfo - Info passed to surpriseTrigger()
   * @param {object} promptConfig - { title, message, showCard, confirmLabel }
   * @returns {object|null} Result from _activateSurprise
   */
  async _scanSurpriseEntriesForPlayer(playerIdx, triggerFlag, triggerInfo, promptConfig) {
    const entries = this._getAllSurpriseEntries(playerIdx);
    this.gs._surprisePendingCount = (this.gs._surprisePendingCount || 0) + 1;
    this.gs.surprisePending = true;
    try {
    for (const entry of entries) {
      const script = loadCardEffect(entry.cardName);
      if (!script?.isSurprise || !script[triggerFlag]) continue;

      if (script.surpriseTrigger && !script.surpriseTrigger(this.gs, playerIdx, entry.heroIdx, triggerInfo, this)) continue;

      const canActivateOpts = entry.isBakhmSlot ? { isBakhmSlot: true } : {};
      if (!this._canHeroActivateSurprise(playerIdx, entry.heroIdx, entry.cardName, canActivateOpts)) continue;

      const heroName = this.gs.players[playerIdx]?.heroes?.[entry.heroIdx]?.name || 'Hero';
      const msg = typeof promptConfig.message === 'function'
        ? promptConfig.message(heroName, entry.cardName)
        : promptConfig.message;

      const confirmed = await this.promptGeneric(playerIdx, {
        type: 'confirm',
        title: entry.cardName,
        message: `${msg} Activate ${entry.cardName} on ${heroName}?`,
        showCard: promptConfig.showCard || undefined,
        confirmLabel: promptConfig.confirmLabel || '💥 Activate Surprise!',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed) continue;

      const activateOpts = entry.isBakhmSlot ? { isBakhmSlot: true, bakhmZoneSlot: entry.zoneSlot } : {};
      const result = await this._activateSurprise(playerIdx, entry.heroIdx, entry.cardName, triggerInfo, script, activateOpts);

      // For summon triggers: check if newly placed creature triggers more surprises
      if (triggerFlag === 'surpriseSummonTrigger') {
        const newCreatureInst = this.cardInstances.find(c =>
          c.name === entry.cardName && c.owner === playerIdx && c.zone === 'support'
        );
        if (newCreatureInst) {
          await this._checkSurpriseOnSummon(playerIdx, newCreatureInst);
        }
      }

      if (result) return result;
    }
    return null;
    } finally {
      this.gs._surprisePendingCount = Math.max(0, (this.gs._surprisePendingCount || 1) - 1);
      if (this.gs._surprisePendingCount === 0) this.gs.surprisePending = false;
    }
  }

  async _checkSurpriseOnHeroEffect(activatorIdx, heroIdx, effectName) {
    if (this._inSurpriseResolution) return null;
    const opponentIdx = activatorIdx === 0 ? 1 : 0;
    const heroEffectInfo = { activatorIdx, heroIdx, effectName };
    const activatorName = this.gs.players[activatorIdx]?.username || 'Opponent';
    const effectHeroName = this.gs.players[activatorIdx]?.heroes?.[heroIdx]?.name || 'a Hero';
    return this._scanSurpriseEntriesForPlayer(opponentIdx, 'surpriseHeroEffectTrigger', heroEffectInfo, {
      message: () => `${activatorName}'s ${effectHeroName} activated its Hero Effect!`,
    });
  }

  async _checkSurpriseOnAbility(attachOwnerIdx, attachHeroIdx, attachCard) {
    if (this._inSurpriseResolution) return null;
    const opponentIdx = attachOwnerIdx === 0 ? 1 : 0;
    const abilityInfo = { attachOwner: attachOwnerIdx, attachHeroIdx, cardName: attachCard?.name, cardInstance: attachCard };
    const attachPlayerName = this.gs.players[attachOwnerIdx]?.username || 'Opponent';
    const targetHeroName = this.gs.players[attachOwnerIdx]?.heroes?.[attachHeroIdx]?.name || 'a Hero';
    return this._scanSurpriseEntriesForPlayer(opponentIdx, 'surpriseAbilityTrigger', abilityInfo, {
      message: () => `${attachPlayerName} attached ${attachCard?.name || 'an Ability'} to ${targetHeroName}!`,
      showCard: attachCard?.name,
    });
  }

  async _checkSurpriseOnSummon(summonerIdx, summonedCard) {
    if (this._inSurpriseResolution) return null;
    const summonInfo = { summonerIdx, cardName: summonedCard?.name, cardInstance: summonedCard, heroIdx: summonedCard?.heroIdx };
    const summonerName = this.gs.players[summonerIdx]?.username || 'A player';
    // Summon triggers can fire for EITHER player's surprises
    for (let checkPlayer = 0; checkPlayer < 2; checkPlayer++) {
      const result = await this._scanSurpriseEntriesForPlayer(checkPlayer, 'surpriseSummonTrigger', summonInfo, {
        message: () => `${summonerName} summoned ${summonedCard?.name || 'a Creature'}!`,
        showCard: summonedCard?.name,
      });
      if (result) return result;
    }
    return null;
  }

  async _checkSurpriseOnStatus(targetOwnerIdx, targetHeroIdx, statusName, opts) {
    if (this._inSurpriseResolution) return null;
    const statusInfo = { targetOwner: targetOwnerIdx, targetHeroIdx, statusName, opts };
    const targetName = this.gs.players[targetOwnerIdx]?.heroes?.[targetHeroIdx]?.name || 'Target';
    const statusLabel = STATUS_EFFECTS[statusName]?.label || statusName;
    const result = await this._scanSurpriseEntriesForPlayer(targetOwnerIdx, 'surpriseStatusTrigger', statusInfo, {
      message: () => `${targetName} is about to be ${statusLabel}!`,
      confirmLabel: '🌵 Activate Surprise!',
    });
    if (result?.redirect) return result.redirect;
    return null;
  }

  /**
   * Check if any opponent Surprise cards trigger on draws outside Resource Phase.
   * Called from actionDrawCards when draws occur outside Resource Phase.
   * @param {number} drawingPlayerIdx - The player who drew cards
   * @param {number} drawnCount - How many cards were drawn
   */
  async _checkSurpriseOnDraw(drawingPlayerIdx, drawnCount) {
    if (this._inSurpriseResolution) return null;
    const opponentIdx = drawingPlayerIdx === 0 ? 1 : 0;
    const drawPlayerName = this.gs.players[drawingPlayerIdx]?.username || 'Opponent';
    const drawInfo = { drawingPlayer: drawingPlayerIdx, count: drawnCount, phase: this.gs.currentPhase };
    return this._scanSurpriseEntriesForPlayer(opponentIdx, 'surpriseDrawTrigger', drawInfo, {
      message: () => `${drawPlayerName} drew ${drawnCount} card${drawnCount > 1 ? 's' : ''} outside the Resource Phase!`,
      confirmLabel: '🐪 Activate Surprise!',
    });
  }

  /**
   * Flush accumulated surprise draw checks. Called after effect resolution
   * so that multiple draws from a single effect (e.g. Wheels drawing 3 one-at-a-time)
   * produce only ONE surprise prompt with the total count.
   */
  async _flushSurpriseDrawChecks() {
    // Clear Defending the Gate shield at end of effect resolution
    delete this.gs._gateShieldActive;
    
    if (!this._pendingSurpriseDraws) return;
    if (this._inSurpriseResolution) return;
    const pending = this._pendingSurpriseDraws;
    this._pendingSurpriseDraws = null;
    for (const [piStr, count] of Object.entries(pending)) {
      await this._checkSurpriseOnDraw(parseInt(piStr), count);
    }
  }

  /**
   * Execute any deferred surprise effects (Jumpscare, etc.) that were
   * queued during surprise activation but need to resolve AFTER the
   * triggering spell/effect finishes.
   */
  async _executeDeferredSurprises() {
    const deferred = this.gs._deferredSurprises;
    if (!deferred || deferred.length === 0) return;
    delete this.gs._deferredSurprises;
    for (const entry of deferred) {
      if (this.gs._spellNegatedByEffect) continue; // Skip if effect was negated
      try {
        await entry.execute(this);
      } catch (err) {
        console.error('[Engine] deferred surprise error:', err.message);
      }
    }
  }

  /**
   * Check hand cards that react AFTER damage is dealt to a hero (Fireshield, etc.).
   * Only fires when the hero survived the damage.
   * @param {object} target - The damaged hero object
   * @param {object} source - The damage source { name, owner, heroIdx, ... }
   * @param {number} amount - Actual damage dealt
   * @param {string} type - Damage type
   */
  async _checkAfterDamageHandReactions(target, source, amount, type) {
    if (this._inAfterDamageReaction) return;

    const srcOwner = source?.owner ?? source?.controller ?? -1;
    const targetOwner = this.gs.players.findIndex(ps => (ps.heroes || []).includes(target));
    if (targetOwner < 0) return;

    const targetHeroIdx = this.gs.players[targetOwner]?.heroes?.indexOf(target);
    if (targetHeroIdx < 0) return;

    const allCards = this._getCardDB();
    const ps = this.gs.players[targetOwner];
    if (!ps) return;

    const seen = new Set();
    for (let hi = 0; hi < ps.hand.length; hi++) {
      const cardName = ps.hand[hi];
      if (seen.has(cardName)) continue;
      seen.add(cardName);

      const script = loadCardEffect(cardName);
      if (!script?.isAfterDamageReaction) continue;

      const cardData = allCards[cardName];
      const cost = cardData?.cost || 0;
      if (cost > 0 && (ps.gold || 0) < cost) continue;

      // Check condition
      if (script.afterDamageCondition &&
          !script.afterDamageCondition(this.gs, targetOwner, this, target, targetHeroIdx, source, amount, type)) continue;

      // Check hero can cast this card
      if (!this._canHeroActivateSurprise(targetOwner, targetHeroIdx, cardName)) continue;

      // Prompt
      const srcName = source?.name || 'An effect';
      const heroName = target.name || 'Hero';
      const confirmed = await this.promptGeneric(targetOwner, {
        type: 'confirm',
        title: cardName,
        message: `${heroName} took ${amount} damage from ${srcName}! Activate ${cardName}?`,
        showCard: cardName,
        confirmLabel: '🔥 Activate!',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed) continue;

      // Activate: remove from hand, deduct gold
      const actualIdx = ps.hand.indexOf(cardName);
      if (actualIdx < 0) continue;
      ps.hand.splice(actualIdx, 1);
      if (cost > 0) ps.gold = Math.max(0, (ps.gold || 0) - cost);
      if (this.gs._scTracking && targetOwner >= 0 && targetOwner < 2) this.gs._scTracking[targetOwner].cardsPlayedFromHand++;

      // Reveal
      this._broadcastEvent('card_reveal', { cardName, playerIdx: targetOwner });
      await this._delay(300);

      this.log('after_damage_reaction', { card: cardName, player: ps.username });

      this._inAfterDamageReaction = true;
      try {
        if (script.afterDamageResolve) {
          await script.afterDamageResolve(this, targetOwner, target, targetHeroIdx, source, amount, type);
        }
      } finally {
        this._inAfterDamageReaction = false;
      }

      // Potions and deleteOnUse cards go to deleted pile; everything else to discard
      if (cardData?.cardType === 'Potion' || script?.deleteOnUse) {
        ps.deletedPile.push(cardName);
      } else {
        ps.discardPile.push(cardName);
      }
      this.sync();
      return; // Only one after-damage reaction per damage instance
    }
  }

  /**
   * @returns {object|null} { effectNegated: boolean } or null
   */
  async _checkSurpriseWindow(targetedHeroes, sourceCard) {
    if (!targetedHeroes || targetedHeroes.length === 0) return null;
    // Prevent recursive/double surprise prompts
    if (this._inSurpriseResolution) return null;

    this.gs._surprisePendingCount = (this.gs._surprisePendingCount || 0) + 1;
    this.gs.surprisePending = true;
    try {

    for (const target of targetedHeroes) {
      if (target.type !== 'hero') continue;
      const tOwner = target.owner;
      const tHeroIdx = target.heroIdx;
      const ps = this.gs.players[tOwner];
      if (!ps) continue;

      const surpriseZone = ps.surpriseZones?.[tHeroIdx] || [];
      if (surpriseZone.length === 0) continue;

      const surpriseCardName = surpriseZone[0];
      const script = loadCardEffect(surpriseCardName);
      if (!script?.isSurprise) continue;
      if (!script.onSurpriseActivate) continue;
      // Skip surprises that have their own dedicated trigger systems
      if (script.surpriseDrawTrigger || script.surpriseSummonTrigger || script.surpriseEquipTrigger ||
          script.surpriseStatusTrigger || script.surpriseHeroEffectTrigger || script.surpriseAbilityTrigger ||
          script.isDefendingGate) continue;

      // Build source info for the trigger check
      const sourceInfo = {
        cardName: sourceCard?.name,
        owner: sourceCard?.controller ?? sourceCard?.owner ?? -1,
        heroIdx: sourceCard?.heroIdx ?? -1,
        cardInstance: sourceCard,
      };

      // Check surprise trigger condition
      if (script.surpriseTrigger && !script.surpriseTrigger(this.gs, tOwner, tHeroIdx, sourceInfo, this)) continue;

      // Check if hero can activate (alive, not frozen/stunned, meets ability requirements)
      if (!this._canHeroActivateSurprise(tOwner, tHeroIdx, surpriseCardName)) continue;

      // Prompt the owner to activate
      const heroName = ps.heroes[tHeroIdx]?.name || 'Hero';

      // Build descriptive prompt showing WHO is attacking with WHAT
      let promptMsg;
      const srcCardName = sourceInfo.cardName || 'An effect';
      const srcOwnerPs = this.gs.players[sourceInfo.owner];
      const srcHero = srcOwnerPs?.heroes?.[sourceInfo.heroIdx];
      const srcHeroName = srcHero?.name;
      if (srcHeroName) {
        // Check if source is a creature (card in support zone) vs spell/attack from a hero
        const isCreatureSource = sourceInfo.cardInstance?.zone === ZONES.SUPPORT;
        if (isCreatureSource) {
          promptMsg = `${srcHeroName}'s ${srcCardName} is targeting ${heroName}!`;
        } else {
          promptMsg = `${srcHeroName}'s ${srcCardName} is targeting ${heroName}!`;
        }
      } else {
        promptMsg = `${srcCardName} is targeting ${heroName}!`;
      }

      const confirmed = await this.promptGeneric(tOwner, {
        type: 'confirm',
        title: surpriseCardName,
        message: `${promptMsg} Activate ${surpriseCardName}?`,
        showCard: srcCardName,
        confirmLabel: '💥 Activate Surprise!',
        cancelLabel: 'No',
        cancellable: true,
      });

      if (!confirmed) continue;

      // Activate the surprise
      const result = await this._activateSurprise(tOwner, tHeroIdx, surpriseCardName, sourceInfo, script);
      if (result?.effectNegated) {
        return { effectNegated: true };
      }
    }

    return null;
    } finally {
      this.gs._surprisePendingCount = Math.max(0, (this.gs._surprisePendingCount || 1) - 1);
      if (this.gs._surprisePendingCount === 0) this.gs.surprisePending = false;
    }
  }

  /**
   * Check for hand reaction cards that fire AFTER targeting but BEFORE resolution.
   * Used by cards like Divine Gift of Sacrifice that react to opponent targeting.
   * Unlike surprises (face-down on board), these are in the player's hand.
   *
   * @param {Array} targetedHeroes - Array of target objects (from promptDamageTarget)
   * @param {object} sourceCard - The card instance doing the targeting
   */
  /**
   * Anti Magic Enchantment — if any of the targeted heroes has an armed
   * `antiMagicEnchanted` counter on an attached artifact, offer the
   * enchantment's owner a chance to spend the charge and shield the target.
   *
   * Returns `{ shieldedHeroes: [{ owner, heroIdx }, ...] }` when one or more
   * targets are shielded, or `null` otherwise. The caller adds these heroes
   * to `gs._ameShieldedHeroes` so downstream actions (damage, status, buff,
   * heal) become no-ops on those heroes — but the spell's OWN animations
   * still play (projectile, hit VFX, etc.) because the target stays
   * selected. Only the landing effects are skipped.
   */
  async _checkAntiMagicEnchantmentNegation(targetedHeroes, sourceCard) {
    if (!targetedHeroes || targetedHeroes.length === 0) return null;
    if (this._inAntiMagicEnchantmentCheck) return null;

    // Only Spells are negatable by the enchantment (card text).
    const cardDB = this._getCardDB();
    const srcName = sourceCard?.name;
    const srcData = srcName ? cardDB[srcName] : null;
    if (!srcData || srcData.cardType !== 'Spell') return null;

    const shieldedHeroes = [];
    for (const t of targetedHeroes) {
      if (t.type !== 'hero') continue;
      const heroOwner = t.owner;
      const heroIdx = t.heroIdx;
      const armedArtifact = this.cardInstances.find(inst =>
        inst.zone === 'support' &&
        inst.owner === heroOwner &&
        inst.heroIdx === heroIdx &&
        inst.counters?.antiMagicEnchanted?.charges > 0
      );
      if (!armedArtifact) continue;

      const enchOwner = armedArtifact.counters.antiMagicEnchanted.ownerPi;
      const targetHero = this.gs.players[heroOwner]?.heroes?.[heroIdx];
      if (!targetHero?.name) continue;

      this._inAntiMagicEnchantmentCheck = true;
      try {
        const confirmed = await this.promptGeneric(enchOwner, {
          type: 'confirm',
          title: 'Anti Magic Enchantment',
          message: `${srcName} is about to hit your ${targetHero.name}! Negate the Spell with the enchanted ${armedArtifact.name}?`,
          showCard: armedArtifact.name,
          confirmLabel: '✨ Negate',
          confirmClass: 'btn-success',
          cancellable: true,
        });
        if (confirmed && !confirmed.cancelled) {
          armedArtifact.counters.antiMagicEnchanted.charges = 0;
          if (armedArtifact.counters.buffs?.anti_magic_enchanted) {
            armedArtifact.counters.buffs.anti_magic_enchanted.spent = true;
          }
          this.log('anti_magic_enchantment_negate', {
            artifact: armedArtifact.name, hero: targetHero.name,
            spell: srcName, owner: this.gs.players[enchOwner]?.username,
          });
          shieldedHeroes.push({ owner: heroOwner, heroIdx });
          this.sync();
        }
      } finally {
        delete this._inAntiMagicEnchantmentCheck;
      }
    }
    return shieldedHeroes.length > 0 ? { shieldedHeroes } : null;
  }

  /** Register AME-shielded heroes for the in-progress spell. */
  _registerAmeShieldedHeroes(entries) {
    if (!entries || entries.length === 0) return;
    if (!this.gs._ameShieldedHeroes) this.gs._ameShieldedHeroes = new Set();
    for (const e of entries) this.gs._ameShieldedHeroes.add(`${e.owner}-${e.heroIdx}`);
  }

  /**
   * Lazy AME prompt. Called from actionDealDamage when a Spell is about to
   * hit a hero. Returns true if the enchantment's owner spent a charge to
   * shield; false otherwise (including "hero not protected" / "user said
   * no"). Decisions are cached per hero per spell so follow-up actions
   * (status apply, buff apply, heal) skip without re-prompting.
   *
   * @param {object} hero - the hero object about to be damaged
   * @param {object} source - damage source (CardInstance-ish)
   * @returns {Promise<boolean>} true if shielded (caller should cancel)
   */
  async _maybePromptAntiMagicEnchantment(hero, source) {
    if (!hero) return false;
    if (this._inAntiMagicEnchantmentCheck) return false;

    const owner = this._findHeroOwner(hero);
    if (owner < 0) return false;
    const heroIdx = this.gs.players[owner].heroes.indexOf(hero);
    if (heroIdx < 0) return false;

    // Already decided for this hero in this spell — apply cached result.
    const key = `${owner}-${heroIdx}`;
    if (this.gs._ameShieldedHeroes?.has(key)) return true;
    if (this.gs._ameDeclinedHeroes?.has(key)) return false;

    const armedArtifact = this.cardInstances.find(inst =>
      inst.zone === 'support' &&
      inst.owner === owner &&
      inst.heroIdx === heroIdx &&
      inst.counters?.antiMagicEnchanted?.charges > 0
    );
    if (!armedArtifact) return false;

    // Only Spells can be negated by AME (card text).
    const cardDB = this._getCardDB();
    const srcName = source?.name;
    const srcData = srcName ? cardDB[srcName] : null;
    if (!srcData || srcData.cardType !== 'Spell') return false;

    const enchOwner = armedArtifact.counters.antiMagicEnchanted.ownerPi;
    this._inAntiMagicEnchantmentCheck = true;
    try {
      const confirmed = await this.promptGeneric(enchOwner, {
        type: 'confirm',
        title: 'Anti Magic Enchantment',
        message: `${srcName} is about to hit your ${hero.name}! Negate the Spell with the enchanted ${armedArtifact.name}?`,
        showCard: armedArtifact.name,
        confirmLabel: '✨ Negate',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!confirmed || confirmed.cancelled) {
        if (!this.gs._ameDeclinedHeroes) this.gs._ameDeclinedHeroes = new Set();
        this.gs._ameDeclinedHeroes.add(key);
        return false;
      }
      // Accepted — spend charge, register shield, mark buff as spent.
      armedArtifact.counters.antiMagicEnchanted.charges = 0;
      if (armedArtifact.counters.buffs?.anti_magic_enchanted) {
        armedArtifact.counters.buffs.anti_magic_enchanted.spent = true;
      }
      if (!this.gs._ameShieldedHeroes) this.gs._ameShieldedHeroes = new Set();
      this.gs._ameShieldedHeroes.add(key);
      this.log('anti_magic_enchantment_negate', {
        artifact: armedArtifact.name, hero: hero.name,
        spell: srcName, owner: this.gs.players[enchOwner]?.username,
      });
      this.sync();
      return true;
    } finally {
      delete this._inAntiMagicEnchantmentCheck;
    }
  }

  /** True if a hero is shielded from the currently-resolving spell by AME. */
  _isAmeShieldedHero(playerIdx, heroIdx) {
    const set = this.gs._ameShieldedHeroes;
    return !!(set && set.has(`${playerIdx}-${heroIdx}`));
  }

  /** True if a hero object is shielded. Convenience overload for targets passed by reference. */
  _isAmeShieldedHeroObj(hero) {
    if (!hero) return false;
    const owner = this._findHeroOwner(hero);
    if (owner < 0) return false;
    const idx = this.gs.players[owner].heroes.indexOf(hero);
    if (idx < 0) return false;
    return this._isAmeShieldedHero(owner, idx);
  }

  async _checkPostTargetHandReactions(targetedHeroes, sourceCard) {
    if (!targetedHeroes || targetedHeroes.length === 0) return null;
    if (this._inPostTargetReaction) return null;

    const sourceOwner = sourceCard?.controller ?? sourceCard?.owner ?? -1;
    const allCards = this._getCardDB();

    // Check both players, defender (targeted player) first
    const targetOwners = [...new Set(targetedHeroes.map(t => t.owner))];
    const checkOrder = [...targetOwners, ...([0, 1].filter(i => !targetOwners.includes(i)))];

    for (const pi of checkOrder) {
      const ps = this.gs.players[pi];
      if (!ps) continue;

      for (let hi = 0; hi < ps.hand.length; hi++) {
        const cardName = ps.hand[hi];
        const script = loadCardEffect(cardName);
        if (!script?.isPostTargetReaction) continue;


        const cardData = allCards[cardName];

        // Gold check for artifacts
        const cost = cardData?.cost || 0;
        if (cost > 0 && (ps.gold || 0) < cost) continue;

        // Once-per-game check
        if (script.oncePerGame || script.oncePerGameKey) {
          const opgKey = script.oncePerGameKey || cardName;
          if (ps._oncePerGameUsed?.has(opgKey)) continue;
        }

        // Check post-target condition
        if (script.postTargetCondition &&
            !script.postTargetCondition(this.gs, pi, this, targetedHeroes, sourceCard)) continue;

        // Spell/Attack reactions: at least 1 hero must be able to cast it
        // Artifacts: skip hero check (only need gold)
        const isArtifact = cardData?.cardType === 'Artifact';
        if (!isArtifact) {
          let canCast = false;
          for (let heroI = 0; heroI < (ps.heroes || []).length; heroI++) {
            if (this._canHeroActivateSurprise(pi, heroI, cardName)) {
              canCast = true;
              break;
            }
          }
          if (!canCast) continue;
        }

        // Build prompt message
        const targetNames = targetedHeroes.map(t => t.cardName).join(', ');
        const srcName = sourceCard?.name || 'An effect';

        const confirmed = await this.promptGeneric(pi, {
          type: 'confirm',
          title: cardName,
          message: `${srcName} is targeting ${targetNames}! Activate ${cardName}?`,
          showCard: cardName,
          confirmLabel: '✨ Activate!',
          cancelLabel: 'No',
          cancellable: true,
        });

        if (!confirmed) continue;

        // Activate: remove from hand, deduct gold, discard after resolve
        ps.hand.splice(hi, 1);
        if (cost > 0) ps.gold = Math.max(0, (ps.gold || 0) - cost);
        if (this.gs._scTracking && pi >= 0 && pi < 2) this.gs._scTracking[pi].cardsPlayedFromHand++;

        // Reveal card
        this._broadcastEvent('card_reveal', { cardName, playerIdx: pi });
        await this._delay(300);

        this.log('post_target_reaction', { card: cardName, player: ps.username });

        this._inPostTargetReaction = true;
        let resolveResult = null;
        try {
          if (script.postTargetResolve) {
            resolveResult = await script.postTargetResolve(this, pi, targetedHeroes, sourceCard);
          }
        } finally {
          this._inPostTargetReaction = false;
        }

        // Discard the card
        ps.discardPile.push(cardName);
        this.sync();

        // Return result (e.g. { effectNegated: true } for Invisibility Cloak)
        return resolveResult || null;
      }
    }
    return null;
  }

  /**
   * Requires: hero alive, not frozen/stunned, meets spell school & level requirements.
   * For Creature surprises: also requires a free Support Zone.
   */
  _canHeroActivateSurprise(playerIdx, heroIdx, cardName, opts = {}) {
    const ps = this.gs.players[playerIdx];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.frozen || hero.statuses?.stunned) return false;

    const cardData = this._getCardDB()[cardName];
    if (!cardData) return false;

    // Check spell school / level requirements (centralized)
    if (!this.heroMeetsLevelReq(playerIdx, heroIdx, cardData)) return false;

    // Creature surprises need a free Support Zone (skip for Bakhm slots — already in support)
    if (!opts.isBakhmSlot && hasCardType(cardData, 'Creature')) {
      let hasFreeSlot = false;
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[heroIdx] || [])[si] || []).length === 0) { hasFreeSlot = true; break; }
      }
      if (!hasFreeSlot) return false;
    }

    return true;
  }

  /**
   * Activate a face-down Surprise: flip face-up, reveal to opponent,
   * execute its effect, then discard (or place as creature).
   *
   * @returns {object|null} Result from the surprise's onSurpriseActivate
   */
  /**
   * Generic re-set for surprise creatures. Detects whether the creature is on
   * a Bakhm hero (flip face-down in place) or a regular hero (move to surprise zone).
   * Returns true if reset succeeded, false if cancelled/failed.
   */
  async surpriseCreatureReset(ctx) {
    const inst = ctx.card;
    const heroOwner = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = this.gs.players[heroOwner];
    const cardName = inst.name;
    const zoneSlot = inst.zoneSlot;

    // Check if this creature is on a Bakhm hero
    const hero = ps?.heroes?.[heroIdx];
    const heroScript = hero ? loadCardEffect(hero.name) : null;
    const isBakhmHero = !!(heroScript?.isBakhmHero);

    // Confirmation prompt
    const confirmed = await this.promptGeneric(heroOwner, {
      type: 'confirm',
      title: cardName,
      message: isBakhmHero
        ? `Flip ${cardName} face-down on ${hero.name}'s Support Zone?`
        : `Place ${cardName} into ${hero?.name || 'your Hero'}'s Surprise Zone?`,
      confirmLabel: '🎭 Set Surprise',
      cancelLabel: 'Cancel',
      cancellable: true,
    });

    if (!confirmed) return false;

    // Sand animation
    this._broadcastEvent('play_zone_animation', {
      type: 'sand_reset', owner: heroOwner, heroIdx, zoneSlot,
    });
    this._broadcastEvent('creature_zone_move', { owner: heroOwner, heroIdx, zoneSlot });
    await this._delay(200);

    if (isBakhmHero) {
      // Bakhm slot: just flip face-down in place
      inst.faceDown = true;
      inst.knownToOpponent = true;

      this._broadcastEvent('surprise_reset', { owner: heroOwner, heroIdx, cardName, isBakhmSlot: true, zoneSlot });
      this.log('surprise_reset', { card: cardName, player: ps.username, hero: hero.name, bakhmSlot: true });
    } else {
      // Regular: move from support zone to surprise zone
      const supportSlot = ps.supportZones[heroIdx]?.[zoneSlot];
      if (supportSlot) {
        const idx = supportSlot.indexOf(cardName);
        if (idx >= 0) supportSlot.splice(idx, 1);
      }

      // `_onlyCard: inst` — only the leaving card's own cleanup fires;
      // other cards (Flying Island, etc.) shouldn't think THEY left.
      await this.runHooks('onCardLeaveZone', {
        _onlyCard: inst, leavingCard: inst,
        fromZone: 'support', fromOwner: heroOwner, fromHeroIdx: heroIdx, fromZoneSlot: zoneSlot,
        _skipReactionCheck: true,
      });

      if (!ps.surpriseZones[heroIdx]) ps.surpriseZones[heroIdx] = [];
      ps.surpriseZones[heroIdx] = [cardName];

      inst.zone = 'surprise';
      inst.heroIdx = heroIdx;
      inst.zoneSlot = 0;
      inst.faceDown = true;
      inst.knownToOpponent = true;

      this._broadcastEvent('surprise_reset', { owner: heroOwner, heroIdx, cardName });
      this.log('surprise_reset', { card: cardName, player: ps.username, hero: hero.name });

      await this.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'surprise', toHeroIdx: heroIdx,
        _skipReactionCheck: true,
      });
    }

    this.sync();
    await this._delay(150);
    return true;
  }

  /**
   * Check if a surprise creature can re-set (go back face-down).
   * Works for both regular surprise zones and Bakhm support zones.
   */
  canSurpriseCreatureReset(ctx) {
    const heroOwner = ctx.cardHeroOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx._engine.gs.players[heroOwner];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    // Check if on Bakhm hero — can always reset if card is face-up
    const heroScript = loadCardEffect(hero.name);
    if (heroScript?.isBakhmHero) {
      // Already in support zone — just needs to be face-up
      return !ctx.card.faceDown;
    }

    // Regular: surprise zone must be empty
    const surpriseZone = ps.surpriseZones?.[heroIdx] || [];
    return surpriseZone.length === 0;
  }

  async _activateSurprise(playerIdx, heroIdx, cardName, sourceInfo, script, opts = {}) {
    this._surpriseResolutionDepth = (this._surpriseResolutionDepth || 0) + 1;
    this._inSurpriseResolution = true;
    try {
    const ps = this.gs.players[playerIdx];
    const hero = ps.heroes[heroIdx];
    const isBakhmSlot = opts.isBakhmSlot || false;
    const bakhmZoneSlot = opts.bakhmZoneSlot ?? -1;

    // Find and update the CardInstance — flip face-up
    let inst;
    if (isBakhmSlot) {
      inst = this.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === bakhmZoneSlot && c.name === cardName
      );
    } else {
      inst = this.cardInstances.find(c =>
        c.owner === playerIdx && c.zone === ZONES.SURPRISE && c.heroIdx === heroIdx && c.name === cardName
      );
    }
    if (inst) inst.faceDown = false;

    // Broadcast surprise flip animation
    this._broadcastEvent('surprise_flip', { owner: playerIdx, heroIdx, cardName, isBakhmSlot, bakhmZoneSlot });

    // Reveal card to opponent and spectators
    const oi = playerIdx === 0 ? 1 : 0;
    const oppSid = this.gs.players[oi]?.socketId;
    if (oppSid) this.io.to(oppSid).emit('card_reveal', { cardName });
    if (this.room.spectators) {
      for (const spec of this.room.spectators) {
        if (spec.socketId) this.io.to(spec.socketId).emit('card_reveal', { cardName });
      }
    }

    this.log('surprise_activated', { card: cardName, player: ps.username, hero: hero.name });
    // Sync with card still face-up in the surprise zone
    this.sync();
    await this._delay(800);

    // Fire onSurpriseActivated hook
    await this.runHooks('onSurpriseActivated', {
      surpriseCardName: cardName, surpriseOwner: playerIdx, heroIdx,
      sourceInfo, _skipReactionCheck: true,
    });

    // Execute the surprise's effect
    let result = null;
    if (script.onSurpriseActivate && inst) {
      const ctx = this._createContext(inst, { sourceInfo });
      result = await script.onSurpriseActivate(ctx, sourceInfo);
    }

    // Brief pause after effect resolution before placement. Only needed for
    // Creature surprises (which have a face-up placement animation after) —
    // for non-Creature surprises (Magic Mirror, Booby Trap, etc.) we go
    // straight to discard, so the long delay is just dead air between the
    // reflected effect and the surprise going to the discard pile.
    this.sync();
    const cardDataForDelay = this._getCardDB()[cardName];
    const isCreatureSurprise = isBakhmSlot || hasCardType(cardDataForDelay, 'Creature');
    await this._delay(isCreatureSurprise ? 500 : 150);

    if (isBakhmSlot) {
      // Bakhm slot: creature is already in the support zone — just stays face-up
      if (inst) {
        inst.turnPlayed = this.gs.turn || 0; // Enforce summoning sickness on flip
        this._broadcastEvent('summon_effect', { owner: playerIdx, heroIdx, zoneSlot: bakhmZoneSlot, cardName });
        this._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: playerIdx, heroIdx, zoneSlot: bakhmZoneSlot,
        });
        await this._delay(200);
        await this.runHooks('onSurpriseCreaturePlaced', {
          surpriseCardName: cardName, surpriseOwner: playerIdx, heroIdx,
          zoneSlot: bakhmZoneSlot, cardInstance: inst,
        });
      }
    } else {
    // NOW remove from surprise zone
    const surpriseZone = ps.surpriseZones[heroIdx];
    const szIdx = surpriseZone.indexOf(cardName);
    if (szIdx >= 0) surpriseZone.splice(szIdx, 1);

    // After resolution: place creature or discard
    const cardData = this._getCardDB()[cardName];
    if (hasCardType(cardData, 'Creature')) {
      // Place face-up as permanent creature in first free support zone
      const placed = this.safePlaceInSupport(cardName, playerIdx, heroIdx, -1);
      if (placed && inst) {
        // safePlaceInSupport created a new instance — remove it, reuse original
        this._untrackCard(placed.inst.id);
        inst.zone = ZONES.SUPPORT;
        inst.heroIdx = heroIdx;
        inst.zoneSlot = placed.actualSlot;
        inst.faceDown = false;
        inst.turnPlayed = this.gs.turn || 0; // Enforce summoning sickness
        this._syncGuardianImmunity(inst, playerIdx);
        this._broadcastEvent('summon_effect', { owner: playerIdx, heroIdx, zoneSlot: placed.actualSlot, cardName });
        // Extra flashy animation for surprise creature summon
        this._broadcastEvent('play_zone_animation', {
          type: 'gold_sparkle', owner: playerIdx, heroIdx, zoneSlot: placed.actualSlot,
        });
        await this._delay(200);
        await this.runHooks('onPlay', {
          _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
          _skipReactionCheck: true,
        });
        await this.runHooks('onCardEnterZone', {
          enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx,
          _skipReactionCheck: true,
        });
        // Fire hook for Bakhm's 80-damage chain
        await this.runHooks('onSurpriseCreaturePlaced', {
          surpriseCardName: cardName, surpriseOwner: playerIdx, heroIdx,
          zoneSlot: placed.actualSlot, cardInstance: inst,
        });
      } else {
        // No free slots — discard
        ps.discardPile.push(cardName);
        if (inst) this._untrackCard(inst.id);
      }
    } else {
      // Non-creature surprise → discard
      ps.discardPile.push(cardName);
      if (inst) this._untrackCard(inst.id);
    }
    } // end if/else isBakhmSlot

    this.sync();
    return result;
    } finally {
      this._surpriseResolutionDepth = Math.max(0, (this._surpriseResolutionDepth || 1) - 1);
      if (this._surpriseResolutionDepth === 0) this._inSurpriseResolution = false;
    }
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
    'beforeDamage', 'afterDamage', 'beforeLevelChange',
    'onResourceSpend', 'onReactionActivated', 'onCardActivation',
    'onActionUsed', 'onAdditionalActionUsed',
    'onHeroTargeted', 'onSurpriseActivated',
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
    const { cardName, owner, cardType, resolve, goldCost, heroIdx } = cardInfo;

    const initialLink = {
      id: uuidv4().substring(0, 12),
      cardName, owner, heroIdx: heroIdx ?? -1,
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
      await this._flushSurpriseDrawChecks();
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
        // Skip cards currently being played/resolved (prevents self-chaining)
        if (ps._resolvingCard) {
          const nth = ps.hand.slice(0, hi + 1).filter(c => c === ps._resolvingCard.name).length;
          if (cardName === ps._resolvingCard.name && nth === ps._resolvingCard.nth) continue;
        }
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
          showCard: chain[0]?.cardName || null,
          confirmLabel: 'Activate!',
          cancelLabel: 'No',
          cancellable: true,
        });

        if (!confirmed) continue;

        // Activate the reaction
        if (cost > 0) ps.gold -= cost;
        ps.hand.splice(hi, 1);

        this.log('reaction_activated', { card: cardName, player: ps.username, chainPosition: chain.length });

        // Reveal the reaction card to the opponent and spectators
        this._broadcastEvent('card_reveal', { cardName });

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
      if (!byType[typeId]) byType[typeId] = { typeId, label: config.label, allowedCategories: config.allowedCategories || [], heroRestricted: !!config.heroRestricted, providers: [], eligibleHandCards: [] };
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
      inst.counters.additionalActionAvail = Math.max(0, (inst.counters.additionalActionAvail || 1) - 1);
      this.log('additional_action_used', { typeId, provider: inst.name, remaining: inst.counters.additionalActionAvail, player: this.gs.players[playerIdx]?.username });
      // Fire onConsume callback if defined
      const config = this._additionalActionTypes[typeId];
      if (config?.onConsume) config.onConsume(this, playerIdx, inst);
      return inst;
    }
    return null;
  }

  /**
   * Check if a hand card can be played via any additional action.
   * Returns the matching typeId or null.
   */
  findAdditionalActionForCard(playerIdx, cardName, heroIdx) {
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
      // Hero-restricted: provider must be on the same hero as the spell caster
      if (config.heroRestricted && heroIdx != null && inst.heroIdx !== heroIdx) continue;
      // Check category
      if (config.allowedCategories && !config.allowedCategories.includes(category)) continue;
      // Check specific filter
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
   * Get effective card data for a card instance, respecting per-instance overrides.
   * Cards like Biomancy Tokens store a _cardDataOverride on their counters to
   * change their cardType/hp/effect while keeping the original card name/image.
   * @param {CardInstance} inst - Card instance
   * @returns {object|null} Card data (possibly overridden)
   */
  getEffectiveCardData(inst) {
    if (inst?.counters?._cardDataOverride) return inst.counters._cardDataOverride;
    return this._getCardDB()[inst?.name] || null;
  }

  /**
   * Check if a card in a support zone should be treated as an Equipment Artifact.
   * Centralises equip detection so all cards use consistent logic.
   * Detects: script.isEquip, DB subtype 'Equipment', treatAsEquip counter
   * (Initiation Ritual heroes), and Hero/Ascended Hero cards in support zones.
   * @param {string} cardName - Card name to check
   * @param {object} [inst] - Optional card instance (for treatAsEquip counter check)
   * @returns {boolean}
   */
  isEquipInZone(cardName, inst) {
    if (inst?.counters?.treatAsEquip) return true;
    const cd = this._getCardDB()[cardName];
    if (cd && (cd.subtype || '').toLowerCase() === 'equipment') return true;
    if (cd && (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero'))) return true;
    const script = loadCardEffect(cardName);
    if (script?.isEquip) return true;
    return false;
  }

  /**
   * Get standardised target objects for all living Heroes of a player.
   * Returns [{ id, type:'hero', owner, heroIdx, cardName }]
   * @param {number} playerIdx
   */
  getHeroTargets(playerIdx) {
    const ps = this.gs.players[playerIdx];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({ id: `hero-${playerIdx}-${hi}`, type: 'hero', owner: playerIdx, heroIdx: hi, cardName: hero.name });
    }
    return targets;
  }

  /**
   * Get standardised target objects for all Creatures (by card type) in a player's support zones.
   * Excludes Equipment Artifacts, Tokens, attached Spells/Attacks, etc.
   * Returns [{ id, type:'equip', owner, heroIdx, slotIdx, cardName, cardInstance }]
   * @param {number} playerIdx
   */
  getCreatureTargets(playerIdx) {
    const ps = this.gs.players[playerIdx];
    const cardDB = this._getCardDB();
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        const inst = this.cardInstances.find(c =>
          (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si
        );
        const cd = (inst ? this.getEffectiveCardData(inst) : null) || cardDB[slot[0]];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        targets.push({
          id: `equip-${playerIdx}-${hi}-${si}`, type: 'equip', owner: playerIdx,
          heroIdx: hi, slotIdx: si, cardName: slot[0], cardInstance: inst || null,
        });
      }
    }
    return targets;
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

        // Generic draw/search lock
        if (script.blockedByHandLock && ps.handLocked) continue;

        result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length });
      }
    }

    // Also check charmed opponent heroes (Charme Lv3)
    const oi = playerIdx === 0 ? 1 : 0;
    const ops = this.gs.players[oi];
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.charmedBy !== playerIdx) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

        for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
          const slot = (ops.abilityZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const abilityName = slot[0];
          const script = loadCardEffect(abilityName);
          if (!script?.actionCost) continue;

          const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
          if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

          if (script.canActivateAction && !script.canActivateAction(this.gs, playerIdx, hi, slot.length, this)) continue;

          result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, charmedOwner: oi });
        }
      }
    }

    // Also check controlled opponent heroes (Controlled Attack)
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.controlledBy !== playerIdx) continue;
        if (hero.charmedBy != null) continue; // Charme takes priority
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

        for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
          const slot = (ops.abilityZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const abilityName = slot[0];
          const script = loadCardEffect(abilityName);
          if (!script?.actionCost) continue;

          const hoptKey = `ability-action:${abilityName}:${playerIdx}`;
          if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;
          if (script.canActivateAction && !script.canActivateAction(this.gs, playerIdx, hi, slot.length, this)) continue;

          result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, charmedOwner: oi });
        }
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

    // Also check charmed opponent heroes (Charme Lv3)
    const oi = playerIdx === 0 ? 1 : 0;
    const ops = this.gs.players[oi];
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.charmedBy !== playerIdx) continue;
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

        const script = loadCardEffect(hero.name);
        if (!script?.heroEffect) continue;

        const hoptKey = `hero-effect:${hero.name}:${playerIdx}:${hi}`;
        if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

        if (script.canActivateHeroEffect) {
          try {
            const inst = this.cardInstances.find(c =>
              c.owner === oi && c.zone === 'hero' && c.heroIdx === hi
            );
            if (!inst) continue;
            const ctx = this._createContext(inst, { event: 'canHeroEffectCheck' });
            if (!script.canActivateHeroEffect(ctx)) continue;
          } catch { continue; }
        }

        result.push({ heroIdx: hi, heroName: hero.name, charmedOwner: oi });
      }
    }

    // Also check controlled opponent heroes (Controlled Attack)
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.controlledBy !== playerIdx) continue;
        if (hero.charmedBy != null) continue; // Charme takes priority
        if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;

        const script = loadCardEffect(hero.name);
        if (!script?.heroEffect) continue;

        const hoptKey = `hero-effect:${hero.name}:${playerIdx}:${hi}`;
        if (this.gs.hoptUsed?.[hoptKey] === this.gs.turn) continue;

        if (script.canActivateHeroEffect) {
          try {
            const inst = this.cardInstances.find(c =>
              c.owner === oi && c.zone === 'hero' && c.heroIdx === hi
            );
            if (!inst) continue;
            const ctx = this._createContext(inst, { event: 'canHeroEffectCheck' });
            if (!script.canActivateHeroEffect(ctx)) continue;
          } catch { continue; }
        }

        result.push({ heroIdx: hi, heroName: hero.name, charmedOwner: oi });
      }
    }

    return result;
  }

  // ─── ACTIVE CREATURE EFFECTS ─────────────
  /**
   * Get all creatures on the board with activatable effects for a player.
   * Soft HOPT per creature INSTANCE (each copy is independent).
   * Also scans charmed opponent heroes' creatures.
   * Returns array of { owner, heroIdx, zoneSlot, cardName, canActivate, instId }
   */
  getActivatableCreatures(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (this.gs.activePlayer !== playerIdx) return [];
    const currentPhase = this.gs.currentPhase;
    const isMainPhase = currentPhase === 2 || currentPhase === 4;
    if (!isMainPhase) return [];

    const result = [];
    const cardDB = this._getCardDB();

    const scanPlayer = (pi, charmedOwner) => {
      const scanPs = this.gs.players[pi];
      if (!scanPs) return;

      for (let hi = 0; hi < (scanPs.heroes || []).length; hi++) {
        const hero = scanPs.heroes[hi];
        if (!hero?.name) continue;
        // If scanning charmed heroes, only include those charmed by playerIdx
        if (charmedOwner != null && hero.charmedBy !== playerIdx) continue;

        for (let zi = 0; zi < (scanPs.supportZones[hi] || []).length; zi++) {
          const slot = (scanPs.supportZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const creatureName = slot[0];
          const inst = this.cardInstances.find(c =>
            (c.owner === pi || c.controller === pi) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
          );
          if (!inst) continue;
          if (inst.faceDown) continue;

          const cd = this.getEffectiveCardData(inst) || cardDB[creatureName];
          if (!cd || !hasCardType(cd, 'Creature')) continue;

          const effectName = inst.counters?._effectOverride || creatureName;
          const script = loadCardEffect(effectName);
          if (!script?.creatureEffect) continue;

          // Summoning sickness: creatures cannot activate on the turn they were summoned
          const hasSummoningSickness = inst.turnPlayed === (this.gs.turn || 0);

          // Soft HOPT per creature instance
          const hoptKey = `creature-effect:${inst.id}`;
          const exhausted = this.gs.hoptUsed?.[hoptKey] === this.gs.turn;
          let canActivate = !exhausted && !hasSummoningSickness;

          // Check script's activation condition
          if (canActivate && script.canActivateCreatureEffect) {
            try {
              const ctx = this._createContext(inst, { event: 'canCreatureEffectCheck' });
              canActivate = !!script.canActivateCreatureEffect(ctx);
            } catch { canActivate = false; }
          }

          result.push({
            owner: pi, heroIdx: hi, zoneSlot: zi,
            cardName: creatureName, canActivate, exhausted,
            instId: inst.id,
            charmedOwner: charmedOwner != null ? pi : undefined,
          });
        }
      }
    };

    // Own creatures
    scanPlayer(playerIdx, null);

    // Charmed opponent heroes' creatures
    const oi = playerIdx === 0 ? 1 : 0;
    scanPlayer(oi, oi);

    return result;
  }

  // ─── ACTIVE EQUIP EFFECTS ─────────────
  /**
   * Get all equipped cards (Artifacts/Equipment) with activatable effects.
   * Similar to creature effects but NO summoning sickness.
   * Soft HOPT per equip instance.
   */
  getActivatableEquips(playerIdx) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];
    if (this.gs.activePlayer !== playerIdx) return [];
    const currentPhase = this.gs.currentPhase;
    const isMainPhase = currentPhase === 2 || currentPhase === 4;
    if (!isMainPhase) return [];

    const result = [];

    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

      for (let zi = 0; zi < (ps.supportZones[hi] || []).length; zi++) {
        const slot = (ps.supportZones[hi] || [])[zi] || [];
        if (slot.length === 0) continue;
        const cardName = slot[0];
        const inst = this.cardInstances.find(c =>
          (c.owner === playerIdx || c.controller === playerIdx) && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === zi
        );
        if (!inst || inst.faceDown) continue;

        const script = loadCardEffect(cardName);
        if (!script?.equipEffect) continue;

        // Soft HOPT per equip instance
        const hoptKey = `equip-effect:${inst.id}`;
        const exhausted = this.gs.hoptUsed?.[hoptKey] === this.gs.turn;
        let canActivate = !exhausted;

        // Check script's activation condition
        if (canActivate && script.canActivateEquipEffect) {
          try {
            const ctx = this._createContext(inst, { event: 'canEquipEffectCheck' });
            canActivate = !!script.canActivateEquipEffect(ctx);
          } catch { canActivate = false; }
        }

        result.push({
          owner: playerIdx, heroIdx: hi, zoneSlot: zi,
          cardName, canActivate, exhausted, instId: inst.id,
        });
      }
    }

    return result;
  }

  // ─── PERMANENT ACTIVATION ─────────────
  /**
   * Get all permanents on the board that can be activated by the given player.
   * Checks ALL players' permanents (some permanents like Divine Gift of Balance
   * allow activation by either player on their turn).
   *
   * Returns array of { permId, permName, ownerIdx }
   */
  getActivatablePermanents(playerIdx) {
    if (this.gs.activePlayer !== playerIdx) return [];
    const currentPhase = this.gs.currentPhase;
    if (currentPhase !== 2 && currentPhase !== 3 && currentPhase !== 4) return [];

    const result = [];
    for (let pOwner = 0; pOwner < 2; pOwner++) {
      const ps = this.gs.players[pOwner];
      if (!ps) continue;
      for (const perm of (ps.permanents || [])) {
        const script = loadCardEffect(perm.name);
        if (!script?.canActivatePermanent) continue;
        if (script.canActivatePermanent(this.gs, playerIdx, pOwner, this)) {
          result.push({ permId: perm.id, permName: perm.name, ownerIdx: pOwner });
        }
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
    const isActionPhase = currentPhase === 3;

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

        // Some free abilities can also activate during Action Phase (Charme Lv1 copying action-cost abilities)
        if (!canActivate && !exhausted && isActionPhase && script.actionPhaseEligible) {
          canActivate = true;
        }

        // Generic draw/search lock
        let handLockBlocked = false;
        if (canActivate && script.blockedByHandLock && ps.handLocked) {
          canActivate = false;
          handLockBlocked = true;
        }

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

        result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, canActivate, exhausted, handLockBlocked });
      }
    }

    // Also check charmed opponent heroes (Charme Lv3)
    const oi = playerIdx === 0 ? 1 : 0;
    const ops = this.gs.players[oi];
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.charmedBy !== playerIdx) continue; // Only charmed by this player
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

        for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
          const slot = (ops.abilityZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const abilityName = slot[0];
          const script = loadCardEffect(abilityName);
          if (!script?.freeActivation) continue;

          const hoptKey = `free-ability:${abilityName}:${playerIdx}`;
          const exhausted = this.gs.hoptUsed?.[hoptKey] === this.gs.turn;
          let canActivate = !exhausted && isMainPhase;
          if (!canActivate && !exhausted && isActionPhase && script.actionPhaseEligible) canActivate = true;

          if (canActivate && script.canFreeActivate) {
            try {
              const inst = this.cardInstances.find(c =>
                c.owner === oi && c.zone === 'ability' && c.heroIdx === hi && c.zoneSlot === zi
              );
              if (inst) {
                const ctx = this._createContext(inst, { event: 'canFreeActivateCheck' });
                canActivate = !!script.canFreeActivate(ctx, slot.length);
              } else canActivate = false;
            } catch { canActivate = false; }
          }

          result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, canActivate, exhausted, charmedOwner: oi });
        }
      }
    }

    // Also check controlled opponent heroes (Controlled Attack)
    if (ops) {
      for (let hi = 0; hi < (ops.heroes || []).length; hi++) {
        const hero = ops.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.controlledBy !== playerIdx) continue;
        if (hero.charmedBy != null) continue; // Charme takes priority
        if (hero.statuses?.frozen || hero.statuses?.stunned) continue;

        for (let zi = 0; zi < (ops.abilityZones[hi] || []).length; zi++) {
          const slot = (ops.abilityZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          const abilityName = slot[0];
          const script = loadCardEffect(abilityName);
          if (!script?.freeActivation) continue;

          const hoptKey = `free-ability:${abilityName}:${playerIdx}`;
          const exhausted = this.gs.hoptUsed?.[hoptKey] === this.gs.turn;
          let canActivate = !exhausted && isMainPhase;
          if (!canActivate && !exhausted && isActionPhase && script.actionPhaseEligible) canActivate = true;

          if (canActivate && script.canFreeActivate) {
            try {
              const inst = this.cardInstances.find(c =>
                c.owner === oi && c.zone === 'ability' && c.heroIdx === hi && c.zoneSlot === zi
              );
              if (inst) {
                const ctx = this._createContext(inst, { event: 'canFreeActivateCheck' });
                canActivate = !!script.canFreeActivate(ctx, slot.length);
              } else canActivate = false;
            } catch { canActivate = false; }
          }

          result.push({ heroIdx: hi, zoneIdx: zi, abilityName, level: slot.length, canActivate, exhausted, charmedOwner: oi });
        }
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
   * Check if a hero meets the spell school / level requirements for a card,
   * considering the generic bypassLevelReq flag on the hero.
   * Use this in card modules (reactions, surprises, etc.) instead of manually
   * checking countAbilitiesForSchool — it respects Ascended Hero bypasses.
   *
   * @param {number} playerIdx
   * @param {number} heroIdx
   * @param {object} cardData - Card data from cards.json (needs level, spellSchool1, spellSchool2, cardType)
   * @returns {boolean}
   */
  heroMeetsLevelReq(playerIdx, heroIdx, cardData) {
    const ps = this.gs.players[playerIdx];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    let rawLevel = cardData.level || 0;
    // Per-card level override (e.g. Sol Rym treats Chain Lightning as level 0)
    if (hero.levelOverrideCards && cardData.name && hero.levelOverrideCards[cardData.name] != null) {
      rawLevel = hero.levelOverrideCards[cardData.name];
    }
    if (rawLevel <= 0 && !cardData.spellSchool1) return true;
    const abZones = hero.statuses?.negated ? [] : (ps.abilityZones[heroIdx] || []);

    // Apply generic pre-reductions (Mana Mining and any future ability
    // that silently lowers spell levels). Abilities opt in by exporting
    // `reduceSpellLevel(cardData, abilityLevel, engine) → number`.
    const level = this._applySpellLevelReductions(cardData, rawLevel, abZones);

    let levelFail = false;
    if (cardData.spellSchool1 && this.countAbilitiesForSchool(cardData.spellSchool1, abZones) < level) levelFail = true;
    if (cardData.spellSchool2 && this.countAbilitiesForSchool(cardData.spellSchool2, abZones) < level) levelFail = true;
    if (levelFail) {
      const blr = hero.bypassLevelReq;
      if (blr && level <= blr.maxLevel && blr.types.includes(cardData.cardType)) return true;

      // Generic paid-coverage fallback — abilities opt in via
      // `coverLevelGap(cardData, abilityLevel, engine, gap) → { coverable: bool, discardCost: number }`.
      // Wisdom is currently the sole user. Only applies to Spells.
      if (cardData.cardType === 'Spell') {
        const gap = this._spellLevelGap(cardData, level, abZones);
        if (gap > 0) {
          const cov = this._findLevelGapCoverage(cardData, gap, abZones);
          if (cov?.coverable) return true;
        }
      }

      return false;
    }
    return true;
  }

  /**
   * Walk a hero's ability zones and apply every `reduceSpellLevel` rebate.
   * Ability modules opt in by exporting
   *   reduceSpellLevel(cardData, abilityLevel, engine) → number
   * where `abilityLevel` is that ability's slot size (copies stacked,
   * including wildcards on top). Returned reductions are summed and
   * clamped at zero — engine never knows which cards participate.
   */
  _applySpellLevelReductions(cardData, rawLevel, abZones) {
    if (!cardData || rawLevel <= 0) return rawLevel;
    let total = 0;
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const base = slot[0];
      const script = loadCardEffect(base);
      if (typeof script?.reduceSpellLevel !== 'function') continue;
      // Slot size counts the base ability plus any wildcard copies stacked
      // on top (Performance), matching countAbilitiesForSchool semantics.
      let copies = 0;
      for (const ab of slot) {
        if (ab === base) copies++;
        else if (loadCardEffect(ab)?.isWildcardAbility) copies++;
      }
      try {
        const r = Number(script.reduceSpellLevel(cardData, copies, this)) || 0;
        if (r > 0) total += r;
      } catch { /* ability threw — ignore, no reduction */ }
    }
    return Math.max(0, rawLevel - total);
  }

  /**
   * Max school-gap for a Spell at a given effective level.
   * Returns 0 if no gap (spell is already playable).
   */
  _spellLevelGap(cardData, level, abZones) {
    let maxGap = 0;
    if (cardData.spellSchool1) {
      const has = this.countAbilitiesForSchool(cardData.spellSchool1, abZones);
      if (has < level) maxGap = Math.max(maxGap, level - has);
    }
    if (cardData.spellSchool2) {
      const has = this.countAbilitiesForSchool(cardData.spellSchool2, abZones);
      if (has < level) maxGap = Math.max(maxGap, level - has);
    }
    return maxGap;
  }

  /**
   * Walk a hero's ability zones for a `coverLevelGap` handler that can
   * pay off the remaining school-level gap. Abilities opt in via
   *   coverLevelGap(cardData, abilityLevel, engine, gap) → { coverable, discardCost }
   * Returns the first successful coverage, or null if nothing covers it.
   */
  _findLevelGapCoverage(cardData, gap, abZones) {
    for (const slot of abZones) {
      if (!slot || slot.length === 0) continue;
      const base = slot[0];
      const script = loadCardEffect(base);
      if (typeof script?.coverLevelGap !== 'function') continue;
      let copies = 0;
      for (const ab of slot) {
        if (ab === base) copies++;
        else if (loadCardEffect(ab)?.isWildcardAbility) copies++;
      }
      try {
        const res = script.coverLevelGap(cardData, copies, this, gap);
        if (res?.coverable) return res;
      } catch { /* ignore */ }
    }
    return null;
  }

  /**
   * Calculate the discard cost for playing a Spell with a given hero,
   * paid via any ability that exposes `coverLevelGap` (currently Wisdom).
   * Returns 0 if no cost, positive N for N cards, or -1 if no coverage.
   *
   * Named `getWisdomDiscardCost` for backwards compatibility — the server
   * calls it under this name. Internally it's fully generic; the engine
   * no longer references Wisdom by name.
   *
   * @param {number} playerIdx - Owner of the hero (may differ from acting player for charmed heroes)
   * @param {number} heroIdx
   * @param {object} cardData - Card data from cards.json
   * @returns {number}
   */
  getWisdomDiscardCost(playerIdx, heroIdx, cardData) {
    if (cardData.cardType !== 'Spell') return 0;
    const ps = this.gs.players[playerIdx];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return 0;

    let rawLevel = cardData.level || 0;
    if (hero.levelOverrideCards && cardData.name && hero.levelOverrideCards[cardData.name] != null) {
      rawLevel = hero.levelOverrideCards[cardData.name];
    }
    if (rawLevel <= 0 && !cardData.spellSchool1) return 0;

    const abZones = hero.statuses?.negated ? [] : (ps.abilityZones[heroIdx] || []);
    const level = this._applySpellLevelReductions(cardData, rawLevel, abZones);

    const gap = this._spellLevelGap(cardData, level, abZones);
    if (gap === 0) return 0; // Playable at effective level

    // bypassLevelReq grants free coverage — no paid cost needed
    const blr = hero.bypassLevelReq;
    if (blr && level <= blr.maxLevel && blr.types.includes(cardData.cardType)) return 0;

    const cov = this._findLevelGapCoverage(cardData, gap, abZones);
    if (cov?.coverable) return cov.discardCost || 0;

    return -1; // Not playable even with paid coverage
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

    // Anti Magic Enchantment shield: the current spell already "hit" this
    // hero visually, but the enchantment owner spent a charge to nullify
    // the spell's effects — so downstream status applications are skipped.
    if (this._isAmeShieldedHero(playerIdx, heroIdx)) {
      this.log('ame_status_blocked', { target: hero.name, status: statusName });
      return;
    }

    // Check for status-redirect surprises (Cactus Creature) — only for negative statuses
    const statusDef = STATUS_EFFECTS[statusName];
    if (statusDef?.negative && !opts._fromSurpriseRedirect && !this._inSurpriseResolution) {
      const redirect = await this._checkSurpriseOnStatus(playerIdx, heroIdx, statusName, opts);
      if (redirect) {
        if (redirect.type === 'hero') {
          await this.addHeroStatus(redirect.owner, redirect.heroIdx, statusName, { ...opts, _fromSurpriseRedirect: true });
        } else if (redirect.type === 'equip' && redirect.cardInstance) {
          // Apply status to creature via counters (matching format used by other effects)
          const ci = redirect.cardInstance;
          if (!ci.counters) ci.counters = {};
          ci.counters[statusName] = 1;
          if (statusName === 'burned') ci.counters.burnAppliedBy = opts.appliedBy ?? -1;
          if (statusName === 'poisoned') {
            ci.counters.poisonStacks = opts.stacks || opts.addStacks || 1;
            ci.counters.poisonAppliedBy = opts.appliedBy ?? -1;
          }
          if (statusName === 'frozen') ci.counters.frozenAppliedBy = opts.appliedBy ?? -1;
          if (statusName === 'stunned') ci.counters.stunnedAppliedBy = opts.appliedBy ?? -1;
          if (statusName === 'negated') ci.counters.negatedAppliedBy = opts.appliedBy ?? -1;
          this.log('status_add', { target: ci.name, status: statusName, owner: redirect.owner });
          this.sync();
        }
        return;
      }
    }

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
      // Carry over unhealable flag (once unhealable, always unhealable; new unhealable upgrades existing)
      if (opts.unhealable) hero.statuses.poisoned.unhealable = true;
      this.log('status_add', { target: hero.name, status: 'poisoned', stacks: newStacks, owner: playerIdx });
      await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target: hero, heroOwner: playerIdx, heroIdx, statusName, _skipReactionCheck: opts._skipReactionCheck });
      this.sync();
      return;
    }

    const statusOpts = { appliedTurn: this.gs.turn, appliedBy: opts.appliedBy ?? -1, ...opts };
    delete statusOpts._skipReactionCheck; // Internal flag, not stored on hero
    if (statusName === 'poisoned') {
      statusOpts.stacks = opts.addStacks || opts.stacks || 1;
      delete statusOpts.addStacks; // Clean up
    }
    hero.statuses[statusName] = statusOpts;
    this.log('status_add', { target: hero.name, status: statusName, owner: playerIdx });
    await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target: hero, heroOwner: playerIdx, heroIdx, statusName, _skipReactionCheck: opts._skipReactionCheck });
    this.sync();
  }

  async removeHeroStatus(playerIdx, heroIdx, statusName) {
    const hero = this.gs.players[playerIdx]?.heroes?.[heroIdx];
    if (!hero || !hero.name || !hero.statuses?.[statusName]) return;
    if (hero.statuses[statusName]?.unhealable) return;
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
        if (hero.statuses.frozen) {
          // Frozen supports a multi-turn `duration` counter (Cold Coffin etc.),
          // matching the pattern used by Baihu's multi-turn stun. Statuses
          // applied without a duration retain the single-turn default —
          // `undefined > 1` is false, so the else branch fires immediately.
          const fr = hero.statuses.frozen;
          if (fr.duration > 1) {
            fr.duration--;
            this.log('status_tick', { target: hero.name, status: 'frozen', remaining: fr.duration });
          } else {
            await this.removeHeroStatus(ap, hi, 'frozen');
            clearedCC = true;
          }
        }
        if (hero.statuses.stunned) {
          const stun = hero.statuses.stunned;
          if (stun.duration > 1) {
            // Multi-turn stun: decrement duration, keep stunned
            stun.duration--;
            this.log('status_tick', { target: hero.name, status: 'stunned', remaining: stun.duration });
          } else {
            await this.removeHeroStatus(ap, hi, 'stunned');
            clearedCC = true;
          }
        }
        if (hero.statuses.negated) { await this.removeHeroStatus(ap, hi, 'negated'); clearedCC = true; }
        if (clearedCC) await this.addHeroStatus(ap, hi, 'immune', {});
      }
      // Decrement Baihu creature stun durations
      for (const inst of this.cardInstances) {
        if (inst.owner !== ap || inst.zone !== 'support') continue;
        if (!inst.counters._baihuStunned) continue;
        if (inst.counters._baihuStunned.duration > 1) {
          inst.counters._baihuStunned.duration--;
        } else {
          delete inst.counters._baihuStunned;
          delete inst.counters._baihuPetrify;
        }
      }
    } else if (phaseName === 'START') {
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || !hero.statuses) continue;
        if (hero.statuses.shielded) await this.removeHeroStatus(ap, hi, 'shielded');
        if (hero.statuses.immune) await this.removeHeroStatus(ap, hi, 'immune');
        // Untargetable expires at the start of the caster's next turn
        if (hero.statuses.untargetable) {
          delete hero.statuses.untargetable;
          this.log('status_removed', { target: hero.name, status: 'untargetable' });
        }
      }
      // Butterfly Cloud cooldown: rotate flags each turn
      // _butterflyCloudUsedThisTurn (set during play) → _butterflyCooldown (blocks next turn) → cleared
      if (ps._butterflyCooldown) delete ps._butterflyCooldown;
      if (ps._butterflyCloudUsedThisTurn) {
        ps._butterflyCooldown = true;
        delete ps._butterflyCloudUsedThisTurn;
      }
    }
  }

  // ─── GENERIC AOE HANDLER ───────────────
  /**
   * Generic AoE effect handler. Collects targets based on config, handles Ida
   * single-target override, plays animations, and deals damage via proper channels.
   * Used by Flame Avalanche, Rain of Arrows, and future AoE cards.
   *
   * @param {CardInstance} cardInst - The card triggering the AoE
   * @param {object} config - See ctx.aoeHit() jsdoc for full config
   * @returns {{ heroes: Array, creatures: Array, wasSingleTarget: boolean, cancelled: boolean }}
   */
  async actionAoeHit(cardInst, config = {}) {
    const gs = this.gs;
    const pi = cardInst.controller;
    const oppIdx = pi === 0 ? 1 : 0;
    const heroIdx = cardInst.heroIdx;
    const damage = config.damage || 0;
    const damageType = config.damageType || 'other';
    const sourceName = config.sourceName || cardInst.name;
    const types = config.types || ['hero', 'creature'];
    const animationType = config.animationType;
    const animDelay = config.animDelay ?? 300;
    const hitDelay = config.hitDelay ?? 150;
    const cardDB = this._getCardDB();

    // Determine which player indices to target
    const targetPlayers = [];
    if (config.side === 'enemy') targetPlayers.push(oppIdx);
    else if (config.side === 'own') targetPlayers.push(pi);
    else if (config.side === 'both') targetPlayers.push(0, 1);
    else targetPlayers.push(oppIdx); // default: enemy

    // ── Ida single-target override check ──
    const flagOwner = cardInst.heroOwner != null ? cardInst.heroOwner : pi;
    const heroFlags = gs.heroFlags?.[`${flagOwner}-${heroIdx}`];
    // Auto-generate singleTargetPrompt for Destruction Spells when Ida's
    // forcesSingleTarget is active and no explicit prompt was provided.
    let singleTargetPrompt = config.singleTargetPrompt || null;
    if (heroFlags?.forcesSingleTarget && !singleTargetPrompt && damageType === 'destruction_spell') {
      singleTargetPrompt = {
        title: sourceName,
        description: `Deal ${damage} damage to a single target.`,
        confirmLabel: `💥 ${damage} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      };
    }
    const isSingleTarget = !!(heroFlags?.forcesSingleTarget && singleTargetPrompt);

    if (isSingleTarget) {
      const prompt = singleTargetPrompt;
      const sideMap = { enemy: 'enemy', own: 'my', both: 'any' };
      const target = await this._createContext(cardInst, {}).promptDamageTarget({
        side: sideMap[config.side] || 'enemy',
        types: types.includes('creature') ? ['hero', 'creature'] : ['hero'],
        damageType,
        title: prompt.title || sourceName,
        description: prompt.description || `Deal ${damage} damage.`,
        confirmLabel: prompt.confirmLabel || `💥 ${damage} Damage!`,
        confirmClass: prompt.confirmClass || 'btn-danger',
        cancellable: prompt.cancellable !== false,
      });

      if (!target) return { heroes: [], creatures: [], wasSingleTarget: true, cancelled: true };

      // Animation on single target
      if (animationType) {
        const slot = target.type === 'hero' ? -1 : target.slotIdx;
        this._broadcastEvent('play_zone_animation', {
          type: animationType, owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: slot,
        });
        await this._delay(animDelay);
      }

      // Deal damage to single target
      if (damage > 0) {
        if (target.type === 'hero') {
          const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
          if (hero && hero.hp > 0) {
            const ctx = this._createContext(cardInst, {});
            await ctx.dealDamage(hero, damage, damageType);
          }
          return {
            heroes: [{ hero: gs.players[target.owner]?.heroes?.[target.heroIdx], heroIdx: target.heroIdx, owner: target.owner }],
            creatures: [], wasSingleTarget: true, cancelled: false,
          };
        } else if (target.cardInstance) {
          await this.actionDealCreatureDamage(
            { name: sourceName, owner: pi, heroIdx },
            target.cardInstance, damage, damageType,
            { sourceOwner: pi, canBeNegated: true },
          );
          return {
            heroes: [], creatures: [{ inst: target.cardInstance }],
            wasSingleTarget: true, cancelled: false,
          };
        }
      }

      // Damage 0 — return target info without dealing damage
      const result = { heroes: [], creatures: [], wasSingleTarget: true, cancelled: false };
      if (target.type === 'hero') {
        result.heroes.push({ hero: gs.players[target.owner]?.heroes?.[target.heroIdx], heroIdx: target.heroIdx, owner: target.owner });
      } else if (target.cardInstance) {
        result.creatures.push({ inst: target.cardInstance });
      }
      return result;
    }

    // ── AoE mode (normal) ──

    // Collect heroes
    const allHeroes = [];       // for animation (includes shielded)
    const hitHeroes = [];       // for damage (excludes shielded)
    if (types.includes('hero')) {
      for (const tpi of targetPlayers) {
        const ps = gs.players[tpi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          // Skip heroes charmed by the caster (they're on the caster's side)
          if (hero.charmedBy === pi && tpi !== pi) continue;
          // HP threshold filters
          if (config.heroMinHp !== undefined && hero.hp < config.heroMinHp) continue;
          if (config.heroMaxHp !== undefined && hero.hp > config.heroMaxHp) continue;
          // Custom filter
          if (config.heroFilter && !config.heroFilter(hero, hi, tpi)) continue;

          allHeroes.push({ hero, heroIdx: hi, owner: tpi });
          if (!hero.statuses?.shielded) {
            hitHeroes.push({ hero, heroIdx: hi, owner: tpi });
          }
        }
      }
    }

    // Collect creatures (only Creature/Token card types)
    const creatureEntries = [];
    if (types.includes('creature')) {
      for (const tpi of targetPlayers) {
        for (const inst of this.cardInstances) {
          if ((inst.owner !== tpi && inst.controller !== tpi) || inst.zone !== 'support') continue;
          if (inst.faceDown) continue; // Face-down surprises are immune to AOE
          const cd = this.getEffectiveCardData(inst) || cardDB[inst.name];
          if (!cd || !hasCardType(cd, 'Creature')) continue;
          // HP threshold filters
          const currentHp = inst.counters.currentHp ?? (cd.hp || 0);
          if (config.creatureMinHp !== undefined && currentHp < config.creatureMinHp) continue;
          if (config.creatureMaxHp !== undefined && currentHp > config.creatureMaxHp) continue;
          // Custom filter
          if (config.creatureFilter && !config.creatureFilter(inst, cd)) continue;

          creatureEntries.push({
            inst, amount: damage, type: damageType,
            source: { name: sourceName, owner: pi, heroIdx },
            sourceOwner: pi, canBeNegated: true,
            isStatusDamage: false,
            animType: animationType,
          });
        }
      }
    }

    // ── Surprise window check (AoE) ──
    if (!config._skipSurpriseCheck && hitHeroes.length > 0) {
      const aoeTargets = hitHeroes.map(h => ({
        type: 'hero', owner: h.owner, heroIdx: h.heroIdx, cardName: h.hero.name,
      }));
      // Mark as AoE so surprises like Jumpscare can distinguish from single-target
      if (cardInst) cardInst._isAoeCheck = true;
      const surpriseResult = await this._checkSurpriseWindow(aoeTargets, cardInst);
      if (cardInst) delete cardInst._isAoeCheck;
      if (surpriseResult?.effectNegated) {
        return { heroes: [], creatures: [], wasSingleTarget: false, cancelled: true };
      }
    }

    // ── Post-target hand reaction check (Anti Magic Shield, Divine Gift of Rain, etc.) ──
    if (!config._skipSurpriseCheck && (hitHeroes.length > 0 || creatureEntries.length > 0)) {
      const aoeTargets2 = [
        ...hitHeroes.map(h => ({
          type: 'hero', owner: h.owner, heroIdx: h.heroIdx, cardName: h.hero.name,
        })),
        ...creatureEntries.map(e => ({
          type: 'creature', owner: e.inst.owner, heroIdx: e.inst.heroIdx,
          slotIdx: e.inst.zoneSlot, cardName: e.inst.name,
        })),
      ];
      const ptResult = await this._checkPostTargetHandReactions(aoeTargets2, cardInst);
      if (ptResult?.effectNegated) {
        return { heroes: [], creatures: [], wasSingleTarget: false, cancelled: true };
      }
      // Anti Magic Enchantment is handled per-target inside actionDealDamage
      // so AoE animations always flash first and the negation prompt only
      // appears right before damage actually lands on each enchanted hero.
    }

    // Play animations on ALL targets simultaneously (even shielded)
    if (animationType) {
      for (const { heroIdx: hi, owner } of allHeroes) {
        this._broadcastEvent('play_zone_animation', { type: animationType, owner, heroIdx: hi, zoneSlot: -1 });
      }
      // Creature animations are handled by processCreatureDamageBatch's animType,
      // but if damage is 0 we play them manually
      if (damage === 0) {
        for (const e of creatureEntries) {
          this._broadcastEvent('play_zone_animation', {
            type: animationType, owner: e.inst.owner,
            heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot,
          });
        }
      }
      if (allHeroes.length > 0 || creatureEntries.length > 0) {
        await this._delay(animDelay);
      }
    }

    // Deal damage to heroes
    if (damage > 0) {
      const ctx = this._createContext(cardInst, {});
      for (const { hero } of hitHeroes) {
        if (hero.hp <= 0) continue; // May have died from a previous hit this loop
        await ctx.dealDamage(hero, damage, damageType);
        this.sync();
        if (hitDelay > 0) await this._delay(hitDelay);
      }

      // Deal damage to creatures via batch
      if (creatureEntries.length > 0) {
        await this.processCreatureDamageBatch(creatureEntries);
      }
    }

    this.sync();
    return {
      heroes: allHeroes,
      creatures: creatureEntries.map(e => ({ inst: e.inst })),
      wasSingleTarget: false,
      cancelled: false,
    };
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

    // Filter out face-down surprise creatures — they cannot be damaged
    entries = entries.filter(e => !e.inst?.faceDown);
    if (entries.length === 0) return;

    // Mark Cardinal Beast immune, Baihu-petrified, and Guardian-shielded creatures
    // — they stay in batch for animations but damage will be cancelled before HP reduction
    // Guardian immunity is pierced by true damage (canBeNegated: false)
    for (const e of entries) {
      if (e.inst?.counters?._cardinalImmune || e.inst?.counters?._baihuPetrify) {
        e._immuneCreature = true;
      } else if (e.inst?.counters?._guardianImmune && e.canBeNegated !== false) {
        e._immuneCreature = true;
      }
    }

    // Annotate entries with cancelled flag and init HP
    const cardDB = this._getCardDB();
    for (const e of entries) {
      e.cancelled = false;
      const cd = cardDB[e.inst.name];
      const maxHp = e.inst.counters.maxHp ?? cd?.hp ?? 0;
      if (!e.inst.counters.currentHp) e.inst.counters.currentHp = maxHp;
      // Store original card level for Effect 1 type checks
      e.originalLevel = cd?.level ?? 0;
      // Track which hero dealt this damage (from source.heroIdx if available)
      e.sourceHeroIdx = e.source?.heroIdx ?? -1;
    }

    // Owners whose hand-size cap may have tightened because a creature
    // contributing handLimitReduction (including bonuses, i.e. negative
    // values from Royal Corgi) died in this batch. Rechecked after the
    // batch resolves so reactive deletion prompts fire immediately.
    const handLimitAffectedOwners = new Set();

    // Fire batch hook — cards like Diamond can inspect/cancel entries
    await this.runHooks(HOOKS.BEFORE_CREATURE_DAMAGE_BATCH, {
      entries,
      _skipReactionCheck: true,
    });

    // Defending the Gate: check if any entries would hit an opponent's support zones
    const gateCheckedPlayers = new Set();
    for (const e of entries) {
      if (e.cancelled) continue;
      const controllerIdx = e.inst.controller ?? e.inst.owner;
      if (gateCheckedPlayers.has(controllerIdx)) continue;
      gateCheckedPlayers.add(controllerIdx);
      await this._triggerGateCheck(controllerIdx);
    }
    // Cancel entries for gate-shielded players
    for (const e of entries) {
      if (e.cancelled) continue;
      if (e.canBeNegated === false) continue; // Un-negatable damage pierces gate shield
      const controllerIdx = e.inst.controller ?? e.inst.owner;
      if (this._isGateShielded(controllerIdx)) {
        e.cancelled = true;
        e._gateBlocked = true;
      }
    }

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
      // Cardinal/Baihu immune: animation played but damage is blocked
      if (e._immuneCreature) continue;
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
      // Generic damage-tracking flag — mirrors the hero path above.
      e.inst.counters._damagedOnTurn = this.gs.turn;
      this.log('creature_damage', { source: e.source?.name || e.source, target: e.inst.name, amount: actualAmount, damageType: e.type, owner: e.inst.owner });

      // ── SC tracking: creature overkill ──
      if (this.gs._scTracking && e.sourceOwner >= 0 && e.sourceOwner < 2) {
        const cd = cardDB[e.inst.name];
        const creatureMaxHp = e.inst.counters.maxHp ?? cd?.hp ?? 0;
        if (creatureMaxHp > 0 && actualAmount >= creatureMaxHp * 2) {
          this.gs._scTracking[e.sourceOwner].creatureOverkill = true;
        }
      }

      if (e.inst.counters.currentHp <= 0) {
        const ps = this.gs.players[e.inst.owner];
        this.log('creature_destroyed', { card: e.inst.name, by: e.source?.name || e.type, owner: e.inst.owner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot });
        // Store death info before cleanup
        const deathInfo = { name: e.inst.name, owner: e.inst.owner, originalOwner: e.inst.originalOwner, heroIdx: e.inst.heroIdx, zoneSlot: e.inst.zoneSlot };
        // If this creature contributed to hand-size math (e.g. Royal Corgi's
        // -3 bonus, or a hypothetical reducer-creature), flag the owner for a
        // hand-limit recheck once the batch settles.
        if ((e.inst.counters.handLimitReduction || 0) !== 0) {
          handLimitAffectedOwners.add(e.inst.owner);
        }
        const supSlot = ps.supportZones[e.inst.heroIdx]?.[e.inst.zoneSlot];
        if (supSlot) {
          const idx = supSlot.indexOf(e.inst.name);
          if (idx >= 0) supSlot.splice(idx, 1);
        }
        // Cards return to their ORIGINAL owner's discard pile (Tokens go to deleted pile)
        const creatureDiscardPs = this.gs.players[e.inst.originalOwner];
        if (creatureDiscardPs) {
          const effectiveCd = this.getEffectiveCardData(e.inst);
          if (effectiveCd && hasCardType(effectiveCd, 'Token')) {
            creatureDiscardPs.deletedPile.push(e.inst.name);
          } else {
            creatureDiscardPs.discardPile.push(e.inst.name);
          }
        }
        this._untrackCard(e.inst.id);
        // `_onlyCard: e.inst` — onCardLeaveZone fires ONLY the leaving
        // card's own cleanup hook, not every tracked card's. Without this
        // filter, every creature death made cards like Flying Island
        // (whose onCardLeaveZone removes its island zones) mistakenly
        // think THEY left. Other cards that want to react to creature
        // deaths should hook onCreatureDeath instead.
        await this.runHooks('onCardLeaveZone', { _onlyCard: e.inst, leavingCard: e.inst, fromZone: 'support', fromOwner: e.inst.owner, fromHeroIdx: e.inst.heroIdx, fromZoneSlot: e.inst.zoneSlot, _skipReactionCheck: true });
        await this.runHooks(HOOKS.ON_CREATURE_DEATH, { creature: deathInfo, source: e.source, _skipReactionCheck: true });
      }
      this.sync();
      await this._delay(200);
    }

    await this.runHooks(HOOKS.AFTER_CREATURE_DAMAGE_BATCH, { entries, _skipReactionCheck: true });

    // Reactive hand-limit enforcement: if any creature that affected the
    // owner's hand cap died (most notably Royal Corgi, whose -3 reduction
    // is a +3 hand-size bonus), the owner may now exceed their effective
    // max and must immediately delete down to it.
    for (const owner of handLimitAffectedOwners) {
      await this._checkReactiveHandLimits(owner);
    }
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

    // Also find burned creatures (not Equipment Artifacts, Spells, Tokens, etc.)
    const burnedCreatures = [];
    const burnCardDB = this._getCardDB();
    for (const inst of this.cardInstances) {
      if (inst.owner !== ap || inst.zone !== 'support') continue;
      if (inst.faceDown) continue; // Face-down surprises are immune
      if (!inst.counters.burned) continue;
      const cd = this.getEffectiveCardData(inst) || burnCardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
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
      this.log('burn_damage', { target: heroName, amount: BURN_BASE_DAMAGE, owner });
      await this.actionDealDamage({ name: 'Burn' }, hero, BURN_BASE_DAMAGE, 'fire');
      this.sync();
      await this._delay(200);
    }

    // Process creature burn damage via generic batch system
    if (burnedCreatures.length > 0) {
      const entries = burnedCreatures.map(inst => ({
        inst,
        amount: BURN_BASE_DAMAGE,
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
   * Damage = POISON_BASE_DAMAGE × poison stacks (modified by hooks). Called at start of turn before hooks.
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

    // Poisoned creatures (not Equipment Artifacts, Spells, Tokens, etc.)
    const poisonedCreatures = [];
    const poisonCardDB = this._getCardDB();
    for (const inst of this.cardInstances) {
      if (inst.owner !== ap || inst.zone !== 'support') continue;
      if (!inst.counters.poisoned) continue;
      const cd = this.getEffectiveCardData(inst) || poisonCardDB[inst.name];
      if (!cd || !hasCardType(cd, 'Creature')) continue;
      const stacks = inst.counters.poisonStacks || 1;
      poisonedCreatures.push({ inst, stacks });
    }

    if (poisonedHeroes.length === 0 && poisonedCreatures.length === 0) return;

    // Process hero poison
    for (const { owner, heroIdx, heroName, stacks } of poisonedHeroes) {
      const hero = ps.heroes[heroIdx];
      if (!hero || hero.hp <= 0) continue;
      const damage = await this.calculatePoisonDamage(ap, stacks);
      this._broadcastEvent('play_zone_animation', { type: 'poison_tick', owner: ap, heroIdx, zoneSlot: -1 });
      await this._delay(300);
      this.log('poison_damage', { target: heroName, amount: damage, stacks, owner });
      await this.actionDealDamage({ name: 'Poison' }, hero, damage, 'poison');
      this.sync();
      await this._delay(200);
    }

    // Process creature poison via generic batch system
    if (poisonedCreatures.length > 0) {
      const baseDamage = await this.calculatePoisonDamage(ap, 1);
      const entries = poisonedCreatures.map(({ inst, stacks }) => ({
        inst,
        amount: baseDamage * stacks,
        type: 'poison',
        source: { name: 'Poison' },
        sourceOwner: -1,
        canBeNegated: true,
        isStatusDamage: true,
        animType: 'poison_tick',
      }));
      await this.processCreatureDamageBatch(entries);
    }
  }

  /**
   * Calculate poison damage per tick for a specific player.
   * Fires MODIFY_POISON_DAMAGE hooks so hero effects can alter the amount.
   * @param {number} playerIdx - The player taking poison damage
   * @param {number} stacks - Number of poison stacks
   * @returns {number} Final damage amount
   */
  async calculatePoisonDamage(playerIdx, stacks) {
    const hookCtx = { amount: POISON_BASE_DAMAGE * stacks, baseDamage: POISON_BASE_DAMAGE, stacks, playerIdx };
    await this.runHooks(HOOKS.MODIFY_POISON_DAMAGE, hookCtx);
    return Math.max(0, hookCtx.amount);
  }

  /**
   * Get the current poison damage per stack for a player (for tooltip sync).
   * Runs MODIFY_POISON_DAMAGE hooks synchronously-style with 1 stack.
   * @param {number} playerIdx
   * @returns {number}
   */
  getPoisonDamagePerStack(playerIdx) {
    // Build a simple hookCtx and run hooks synchronously
    // Since modifyPoisonDamage hooks should be sync (just math), we run them inline
    const hookCtx = { amount: POISON_BASE_DAMAGE, baseDamage: POISON_BASE_DAMAGE, stacks: 1, playerIdx };
    // Manually iterate hook cards and apply sync modifications
    for (const inst of this.cardInstances) {
      if (!inst.name) continue;
      const script = loadCardEffect(inst.name);
      if (!script?.hooks?.modifyPoisonDamage) continue;
      try {
        script.hooks.modifyPoisonDamage({
          ...hookCtx,
          card: inst, cardName: inst.name,
          cardOwner: inst.owner, cardController: inst.controller,
          cardHeroIdx: inst.heroIdx,
          attachedHero: inst.heroIdx >= 0 ? this.gs.players[inst.owner]?.heroes?.[inst.heroIdx] : null,
          players: this.gs.players,
          _engine: this,
          modifyAmount(delta) { hookCtx.amount += delta; },
          setAmount(val) { hookCtx.amount = val; },
        });
      } catch (e) { /* ignore errors in tooltip calc */ }
    }
    return Math.max(0, hookCtx.amount);
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

      // Find all non-Creature/non-Token cards on this hero's support zones (Artifacts, Spells, Attacks, etc.)
      // Creatures and Tokens have their own mechanics; immovable cards (e.g. Divine Gift of Coolness) are protected
      const cardDB = this._getCardDB();
      const destroyableInstances = this.cardInstances.filter(c => {
        if (c.owner !== pi || c.zone !== 'support' || c.heroIdx !== hi) return false;
        if (c.counters?.immovable) return false; // Immovable cards stay even on dead heroes
        const cd = cardDB[c.name];
        if (cd && (hasCardType(cd, 'Creature') || hasCardType(cd, 'Token'))) return false;
        return true;
      });

      for (const inst of destroyableInstances) {
        // Fire onCardLeaveZone (triggers Sun Sword cleanup, Flying Island, etc.)
        // _bypassDeadHeroFilter: hero is already dead, but we still need cleanup hooks to fire
        await this.runHooks(HOOKS.ON_CARD_LEAVE_ZONE, { _onlyCard: inst, card: inst, fromZone: 'support', fromHeroIdx: hi, _bypassDeadHeroFilter: true });
        // Move card to discard
        const supZones = ps.supportZones[hi] || [];
        for (let zi = 0; zi < supZones.length; zi++) {
          const idx = (supZones[zi] || []).indexOf(inst.name);
          if (idx >= 0) { supZones[zi].splice(idx, 1); break; }
        }
        // Cards return to their ORIGINAL owner's discard pile (Tokens go to deleted pile)
        const discardPs = this.gs.players[inst.originalOwner];
        if (discardPs) {
          const effectiveCd = this.getEffectiveCardData(inst);
          if (effectiveCd && hasCardType(effectiveCd, 'Token')) {
            discardPs.deletedPile.push(inst.name);
          } else {
            discardPs.discardPile.push(inst.name);
          }
        }
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
   * @param {number} [count] - How many island zones to remove (from the
   *   rightmost end). Defaults to ALL islands on the hero, preserving the
   *   previous behaviour for callers that weren't scoped — but Flying
   *   Island passes 2 so multiple stacked copies each only remove their
   *   own zones when destroyed.
   */
  async removeIslandZones(playerIdx, heroIdx, count) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return;
    if (!ps.islandZoneCount) ps.islandZoneCount = [0, 0, 0];
    const islandCount = ps.islandZoneCount[heroIdx] || 0;
    if (islandCount <= 0) return;

    const removeCount = Math.min(count ?? islandCount, islandCount);
    if (removeCount <= 0) return;

    const totalZones = ps.supportZones[heroIdx].length;
    const firstRemoveIdx = totalZones - removeCount;

    // Defeat creatures in the island zones being removed (rightmost block)
    for (let zi = firstRemoveIdx; zi < totalZones; zi++) {
      const zoneCards = ps.supportZones[heroIdx][zi] || [];
      for (const cardName of [...zoneCards]) {
        // Fire death hooks for the creature
        const hero = ps.heroes[heroIdx];
        this.log('island_zone_defeat', { card: cardName, hero: hero?.name });
        await this.runHooks(HOOKS.ON_HERO_KO, { hero: { name: cardName, hp: 0 }, source: null });
        // Move to discard — use original owner's pile
        const inst = this.cardInstances.find(c => c.owner === playerIdx && c.zone === 'support' && c.heroIdx === heroIdx && c.name === cardName);
        const islandDiscardPs = this.gs.players[inst?.originalOwner ?? playerIdx];
        if (islandDiscardPs) islandDiscardPs.discardPile.push(cardName);
        // Untrack card instance
        if (inst) {
          this.cardInstances = this.cardInstances.filter(c => c.id !== inst.id);
        }
      }
    }

    // Remove the island zones from the array (rightmost block)
    ps.supportZones[heroIdx].splice(firstRemoveIdx, removeCount);
    ps.islandZoneCount[heroIdx] = Math.max(0, islandCount - removeCount);
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
      case ZONES.AREA: {
        // gs.areaZones lives on the root game state (not ps) — pull the
        // card name out so actionMoveCard correctly clears an Area card
        // when it's destroyed / bounced / discarded through the generic
        // pipeline. Without this the name would hang around in areaZones
        // while the CardInstance's `zone` ticks over to 'discard'.
        const arr = this.gs.areaZones?.[inst.owner];
        if (arr) { const idx = arr.indexOf(inst.name); if (idx >= 0) arr.splice(idx, 1); }
        break;
      }
      // DECK, HERO — handled separately
    }
  }

  /** Add a card to its new position in the raw game state arrays. */
  _addCardToState(inst) {
    switch (inst.zone) {
      case ZONES.DISCARD: {
        // Cards always return to their ORIGINAL owner's discard pile (Tokens → deleted pile)
        const discardPs = this.gs.players[inst.originalOwner];
        if (discardPs) {
          const effectiveCd = this.getEffectiveCardData(inst);
          if (effectiveCd && hasCardType(effectiveCd, 'Token')) {
            discardPs.deletedPile.push(inst.name);
          } else {
            discardPs.discardPile.push(inst.name);
          }
        }
        return;
      }
      case ZONES.DELETED: {
        // Cards always return to their ORIGINAL owner's deleted pile
        const deletePs = this.gs.players[inst.originalOwner];
        if (deletePs) deletePs.deletedPile.push(inst.name);
        return;
      }
    }

    const ps = this.gs.players[inst.owner];
    if (!ps) return;

    switch (inst.zone) {
      case ZONES.HAND:
        ps.hand.push(inst.name);
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

  // ═══════════════════════════════════════════════════════════════════════════
  //  ASCENSION SYSTEM
  //  Generic method for ascending a Hero into an Ascended Hero from hand.
  //  State transfer: HP delta, statuses, buffs, ability zones, support zones.
  //  Fires ON_ASCENSION hook (reaction window), then the ascended hero's
  //  onAscensionBonus, then optionally skips to End Phase.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Perform an Ascension: swap a hero's identity to an Ascended Hero from hand.
   *
   * @param {number} pi        - Player index
   * @param {number} heroIdx   - Hero slot being ascended
   * @param {string} cardName  - Ascended Hero card name
   * @param {number} handIndex - Index in hand
   * @param {object} opts      - { cheat: bool } — if true, skip eligibility (unless blocked)
   * @returns {object}         - { success, skipEndPhase }
   */
  async performAscension(pi, heroIdx, cardName, handIndex, opts = {}) {
    const gs = this.gs;
    const ps = gs.players[pi];
    if (!ps) return { success: false };

    const hero = ps.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return { success: false };

    // Validate hand
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== cardName) return { success: false };

    // Card data lookup
    const cardDB = this._getCardDB();
    const newCardData = cardDB[cardName];
    if (!newCardData || newCardData.cardType !== 'Ascended Hero') return { success: false };

    // Load scripts
    const oldHeroScript = loadCardEffect(hero.name);
    const ascendedScript = loadCardEffect(cardName);

    // Cheat check: if cheat mode, verify the base hero doesn't block it
    if (opts.cheat) {
      if (oldHeroScript?.cheatAscensionBlocked) return { success: false };
    } else {
      // Normal mode: hero must be ascension-ready
      if (!hero.ascensionReady) return { success: false };
    }

    // ── Remove from hand ──
    ps.hand.splice(handIndex, 1);
    if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;

    // ── State transfer ──
    const oldName = hero.name;
    const oldMaxHp = hero.maxHp || cardDB[oldName]?.hp || 0;
    const hpLost = Math.max(0, oldMaxHp - hero.hp);
    const newMaxHp = newCardData.hp || oldMaxHp;
    const newHp = Math.max(1, newMaxHp - hpLost);

    hero.name = cardName;
    hero.hp = newHp;
    hero.maxHp = newMaxHp;
    hero.atk = newCardData.atk || hero.atk;

    // Clean up ascension tracking from old hero
    delete hero.ascensionOrbs;
    delete hero.ascensionReady;
    delete hero.ascensionTarget;

    // ── Update card instance for the hero ──
    for (const inst of this.cardInstances) {
      if (inst.owner === pi && inst.heroIdx === heroIdx && inst.zone === 'hero') {
        inst.name = cardName;
        break;
      }
    }

    // ── Set up new hero's passive (bypassLevelReq, etc.) ──
    if (ascendedScript?.onAscendSetup) {
      ascendedScript.onAscendSetup(gs, pi, heroIdx, this);
    }

    this.log('hero_ascension', { player: ps.username, oldHero: oldName, newHero: cardName });
    this._broadcastEvent('hero_ascension', { owner: pi, heroIdx, oldHero: oldName, newHero: cardName });
    this.sync();
    await this._delay(800);

    // ── Fire ON_ASCENSION hook (reaction window) ──
    await this.runHooks(HOOKS.ON_ASCENSION, {
      playerIdx: pi, heroIdx, oldHeroName: oldName, newHeroName: cardName,
      hero, ascendedCardData: newCardData,
    });

    // ── Ascension Bonus (card-specific) ──
    if (ascendedScript?.onAscensionBonus) {
      await ascendedScript.onAscensionBonus(this, pi, heroIdx);
    }

    this.sync();

    // ── Determine if turn should skip to End Phase ──
    let skipEndPhase = false;
    if (pi === gs.activePlayer) {
      // Default: skip to End Phase. Ascended hero can block this.
      skipEndPhase = ascendedScript?.blockEndPhaseOnAscend ? false : true;
    }

    return { success: true, skipEndPhase };
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
