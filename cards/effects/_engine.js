// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — CARD EFFECT ENGINE
//  Chain-based hook system with Yu-Gi-Oh-style chain resolution.
//  Each game gets one GameEngine instance. All card logic runs here.
// ═══════════════════════════════════════════════════════════════════

const { v4: uuidv4 } = require('uuid');
const { SPEED, HOOKS, PHASES, PHASE_NAMES, ZONES } = require('./_hooks');
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
  constructor(room, io, sendGameStateFn, onGameOverFn) {
    this.room = room;
    this.io = io;
    this.sendGameState = sendGameStateFn;
    this.onGameOver = onGameOverFn || null;
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
      // Frozen/Stunned heroes' abilities and effects are also negated
      // Negated heroes' hero + ability effects are silenced, but support/creature effects still work
      if ((c.zone === 'hero' || c.zone === 'ability' || c.zone === 'support') && c.heroIdx >= 0) {
        const hero = this.gs.players[c.owner]?.heroes?.[c.heroIdx];
        if (!hero || !hero.name) return false; // Empty hero slot
        if (hero.hp <= 0) return false;
        if (hero.statuses?.frozen || hero.statuses?.stunned) return false;
        if (hero.statuses?.negated && (c.zone === 'hero' || c.zone === 'ability')) return false;
      }
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
          new Promise((_, rej) => setTimeout(() => rej(new Error('Hook timeout')), EFFECT_TIMEOUT_MS)),
        ]);
      } catch (err) {
        console.error(`[Engine] Hook "${hookName}" on card "${card.name}" (${card.id}) failed:`, err.message);
      }

      // If this hook created pending triggers, collect them
      if (ctx._triggers?.length) {
        this.pendingTriggers.push(...ctx._triggers);
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

    return {
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

      // ── Game Actions (each fires its own hooks) ──
      async dealDamage(target, amount, type) {
        return engine.actionDealDamage(cardInstance, target, amount, type);
      },
      async healHero(target, amount) {
        return engine.actionHealHero(cardInstance, target, amount);
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
      async addStatus(target, statusName, opts) {
        return engine.actionAddStatus(target, statusName, opts);
      },
      async removeStatus(target, statusName) {
        return engine.actionRemoveStatus(target, statusName);
      },

      // ── Player input (async — pauses until client responds) ──
      async promptTarget(validTargets, config) {
        return engine.promptEffectTarget(cardInstance.controller, validTargets, config);
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
    };
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
    const hookCtx = { source, target, amount, type: type || 'normal', cancelled: false };
    await this.runHooks(HOOKS.BEFORE_DAMAGE, hookCtx);
    if (hookCtx.cancelled) return { dealt: 0, cancelled: true };

    // Shielded heroes (first-turn protection) are immune to ALL damage
    if (this.gs.firstTurnProtectedPlayer != null && target && target.hp !== undefined) {
      const protectedIdx = this.gs.firstTurnProtectedPlayer;
      const ps = this.gs.players[protectedIdx];
      if (ps && (ps.heroes || []).includes(target)) {
        this.log('damage_blocked', { target: this._heroLabel(target), reason: 'shielded' });
        return { dealt: 0, cancelled: true };
      }
    }

    const actualAmount = Math.max(0, hookCtx.amount);
    if (target && target.hp !== undefined) {
      target.hp = Math.max(0, target.hp - actualAmount);
    }

    this.log('damage', { source: source?.name, target: this._heroLabel(target), amount: actualAmount, type });
    await this.runHooks(HOOKS.AFTER_DAMAGE, { source, target, amount: actualAmount, type });

    // Check for hero KO
    if (target && target.hp !== undefined && target.hp <= 0) {
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

  async actionDrawCards(playerIdx, count) {
    const ps = this.gs.players[playerIdx];
    if (!ps) return [];

    const drawn = [];
    for (let i = 0; i < count; i++) {
      const hookCtx = { playerIdx, cancelled: false };
      await this.runHooks(HOOKS.BEFORE_DRAW, hookCtx);
      if (hookCtx.cancelled) continue;

      if (ps.mainDeck.length === 0) {
        this.log('deck_empty', { player: ps.username });
        continue; // Deck out — could trigger a loss condition
      }

      const cardName = ps.mainDeck.shift();
      ps.hand.push(cardName);
      const inst = this._trackCard(cardName, playerIdx, ZONES.HAND);
      drawn.push(inst);

      this.log('draw', { player: ps.username, card: cardName });
      await this.runHooks(HOOKS.ON_DRAW, { playerIdx, card: inst, cardName });
    }

    return drawn;
  }

  async actionDestroyCard(source, targetCard) {
    if (!targetCard) return;
    this.log('destroy', { source: source?.name, target: targetCard.name });
    await this.actionMoveCard(targetCard, ZONES.DISCARD);
  }

  async actionMoveCard(cardInstance, toZone, toHeroIdx, toSlot) {
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

  async actionAddStatus(target, statusName, opts = {}) {
    if (!target) return;
    if (!target.statuses) target.statuses = {};
    target.statuses[statusName] = { ...opts, appliedTurn: this.gs.turn };
    this.log('status_add', { target: target.name || this._heroLabel(target), status: statusName });
    await this.runHooks(HOOKS.ON_STATUS_APPLIED, { target, status: statusName, opts });
  }

  async actionRemoveStatus(target, statusName) {
    if (!target?.statuses?.[statusName]) return;
    delete target.statuses[statusName];
    this.log('status_remove', { target: target.name || this._heroLabel(target), status: statusName });
    await this.runHooks(HOOKS.ON_STATUS_REMOVED, { target, status: statusName });
  }

  // ─── TURN / PHASE MANAGEMENT ───────────────

  /**
   * Start the game's first turn. Call once after init().
   */
  async startGame() {
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
    this.log('turn_start', { turn: this.gs.turn, activePlayer: this.gs.activePlayer, username: activePs?.username });
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
        // Automatic phase — process status expiry, burn damage, hooks, then advance
        await this.processStatusExpiry('START');
        await this.processBurnDamage();
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
        await this._delay(300);
        await this.switchTurn();
        break;
    }
  }

  /** Async delay helper for pacing phase transitions. */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      [PHASES.ACTION]: [PHASES.MAIN2],
      [PHASES.MAIN2]: [PHASES.END],
    };

    const allowed = legalTransitions[current];
    if (!allowed || !allowed.includes(targetPhase)) return false;

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

  async addHeroStatus(playerIdx, heroIdx, statusName, opts = {}) {
    const hero = this.gs.players[playerIdx]?.heroes?.[heroIdx];
    if (!hero || !hero.name) return;
    if (!hero.statuses) hero.statuses = {};

    // Shielded (first-turn protection) blocks ALL status effects — no exceptions
    if (hero.statuses.shielded && statusName !== 'shielded') {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: 'shielded' });
      return;
    }

    // Regular Immune (post-CC) only blocks CC effects: frozen, stunned, negated
    const CC_STATUSES = ['frozen', 'stunned', 'negated'];
    if (hero.statuses.immune && CC_STATUSES.includes(statusName)) {
      this.log('status_blocked', { target: hero.name, status: statusName, reason: 'immune' });
      return;
    }

    hero.statuses[statusName] = { appliedTurn: this.gs.turn, appliedBy: opts.appliedBy ?? -1, ...opts };
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

    if (burnedHeroes.length === 0) return;

    // Broadcast burn tick for visual escalation BEFORE dealing damage
    this._broadcastEvent('burn_tick', { heroes: burnedHeroes });
    await this._delay(300); // Let the escalation animation start

    for (const { owner, heroIdx, heroName } of burnedHeroes) {
      const hero = ps.heroes[heroIdx];
      if (!hero || hero.hp <= 0) continue; // May have died from a previous burn this loop
      this.log('burn_damage', { target: heroName, amount: 60, owner });
      await this.actionDealDamage({ name: 'Burn' }, hero, 60, 'fire');
      this.sync();
      await this._delay(200);
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
        const script = c.loadScript();
        return script?.isEquip === true;
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
      const heroes = this.gs.players[pi]?.heroes || [];
      const allDead = heroes.length > 0 && heroes.every(h => !h.name || h.hp <= 0);
      if (allDead) {
        const winnerIdx = pi === 0 ? 1 : 0;
        this.log('all_heroes_dead', { loser: this.gs.players[pi].username, winner: this.gs.players[winnerIdx].username });
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
  }

  _broadcastEvent(event, data) {
    for (let i = 0; i < 2; i++) {
      const sid = this.gs.players[i]?.socketId;
      if (sid) this.io.to(sid).emit(event, data);
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
    if (this.sendGameState) {
      for (let i = 0; i < 2; i++) {
        this.sendGameState(this.room, i);
      }
    }
  }
}

module.exports = { GameEngine, CardInstance, SPEED };
