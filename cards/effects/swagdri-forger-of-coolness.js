// ═══════════════════════════════════════════
//  CREATURE: "Swagdri, Forger of Coolness"
//  When this Creature is the top of your Coolness
//  Stack, you may summon it as an inherent
//  additional Action from there.
//
//  Once per turn, if the top of your Coolness
//  Stack is an Artifact, you may immediately play
//  it without paying its Cost as if it were part
//  of your hand. If you do, delete the Artifact
//  if it would be sent to the discard pile.
// ═══════════════════════════════════════════

const CARD_NAME = 'Swagdri, Forger of Coolness';
const HOPT_KEY  = 'swagdriPlayedArtifactThisTurn';

const hipdall = require('./hipdall-protector-of-coolness');
const summonFromStack = hipdall._summonFromStack;

module.exports = {
  activeIn: ['support', 'coolnessStack'],
  summonableFromCoolnessStack: true,
  // Creatures with active effects use `creatureEffect`, not the
  // Ability `actionCost` flag.
  creatureEffect: true,

  async resolveFromCoolnessStack(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (engine.getCoolnessStackTop(pi) !== CARD_NAME) return { aborted: true, reason: 'not_top' };
    return summonFromStack(engine, pi, CARD_NAME);
  },

  /**
   * Activated effect (1/turn): if the top of the Stack is an Artifact,
   * play it for free as if from hand. The Artifact is deleted (instead
   * of discarded) when it would normally hit the discard pile.
   */
  canActivateCreatureEffect(ctx) {
    // Soft once-per-turn (per Swagdri instance).
    if (ctx.card?.counters?.[HOPT_KEY] === ctx._engine.gs.turn) return false;
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    const top = engine.getCoolnessStackTop(pi);
    if (!top) return false;
    const cardDB = engine._getCardDB();
    const cd = cardDB[top];
    if (cd?.cardType !== 'Artifact') return false;

    // Beyond "is an Artifact": the player must actually be able to
    // resolve it. Mirror the gates the resolve flow checks so Swagdri
    // greys out when the top Artifact is unplayable.
    if (cd.subtype === 'Equipment') {
      // Need at least one alive, non-Frozen Hero with a free Support slot.
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen) continue;
        const slots = ps.supportZones?.[hi] || [];
        if (slots.some(s => !s || s.length === 0)) return true;
      }
      return false;
    }

    // Non-equipment Artifact — load the script and probe its gates.
    const { loadCardEffect } = require('./_loader');
    const script = loadCardEffect(top);
    if (!script) return false;
    // Card-level "can this be played at all right now?" gate (Heart of
    // the Mountain wants 1+ burned targets, etc.). Some artifacts
    // don't define it — those are unconditional and we fall through.
    if (typeof script.canActivate === 'function') {
      try { if (!script.canActivate(gs, pi)) return false; }
      catch { /* defensive — treat as activatable */ }
    }
    // Targeting artifacts: need at least one valid target unless the
    // card declares `alwaysConfirmable` (Magnetic Glove / Cute Cheese
    // self-target effects with empty board target lists).
    if (script.getValidTargets && script.targetingConfig) {
      const config = typeof script.targetingConfig === 'function'
        ? script.targetingConfig(gs, pi, 0)
        : script.targetingConfig;
      if (config?.alwaysConfirmable) return true;
      let validTargets = [];
      try { validTargets = script.getValidTargets(gs, pi, engine) || []; }
      catch { return false; }
      return validTargets.length > 0;
    }
    // No targeting config + script.resolve exists → unconditional.
    return typeof script.resolve === 'function';
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return false;
    const top = engine.getCoolnessStackTop(pi);
    if (!top) return false;
    const cardDB = engine._getCardDB();
    const cd = cardDB[top];
    if (cd?.cardType !== 'Artifact') return false;
    if (!ctx.card.counters) ctx.card.counters = {};
    ctx.card.counters[HOPT_KEY] = engine.gs.turn;

    const ps = engine.gs.players[pi];

    // ── Equipment branch: build hero+slot target list, fly first, commit after ──
    if (cd?.subtype === 'Equipment') {
      const targets = [];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        // Frozen Heroes can't accept new equipment.
        if (hero.statuses?.frozen) continue;
        const slots = ps.supportZones?.[hi] || [];
        let leftmostFree = -1;
        for (let si = 0; si < slots.length; si++) {
          if (!slots[si] || slots[si].length === 0) {
            if (leftmostFree < 0) leftmostFree = si;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi, heroIdx: hi, slotIdx: si, cardName: '',
            });
          }
        }
        if (leftmostFree >= 0) {
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi, heroIdx: hi, cardName: hero.name,
            _autoSlot: leftmostFree,
          });
        }
      }
      if (targets.length === 0) return;
      const pick = await engine.promptEffectTarget(pi, targets, {
        title: CARD_NAME,
        description: `Equip ${top} for free — pick a Hero or a specific empty Support Zone.`,
        confirmLabel: '⚒️ Equip',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });
      if (!pick || pick.length === 0) return;
      const sel = targets.find(t => t.id === pick[0]);
      if (!sel) return;
      const heroIdx = sel.heroIdx;
      const slotIdx = sel.type === 'hero' ? sel._autoSlot : sel.slotIdx;

      // Fly first (Stack still has card), then commit + sync.
      const popInst = engine.getCoolnessStackTopInst(pi);
      engine._broadcastEvent('attach_hero_fly', {
        ownerIdx: pi, source: 'coolnessStack', cardName: top,
        destOwner: pi, destHeroIdx: heroIdx, destZoneSlot: slotIdx,
      });
      await engine._delay(620);

      const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
      if (!popped) return;
      const placed = engine.safePlaceInSupport(top, pi, heroIdx, slotIdx);
      if (!placed?.inst) return;
      placed.inst.zone = 'support';
      placed.inst._swagdriRouteToDelete = true;
      engine.sync();

      await engine.runHooks('onCardLeaveZone', {
        card: popInst, cardName: top,
        fromZone: 'coolnessStack', fromOwner: pi, toZone: 'support',
      });
      await engine.runHooks('onPlay', {
        _onlyCard: placed.inst,
        playedCard: placed.inst, cardName: top,
        zone: 'support', heroIdx, zoneSlot: placed.actualSlot,
        _skipReactionCheck: true,
      });
      await engine.runHooks('onCardEnterZone', {
        enteringCard: placed.inst, cardName: top,
        toZone: 'support', toOwner: pi, toHeroIdx: heroIdx,
        fromZone: 'coolnessStack',
      });
      return;
    }

    // ── Non-equipment Artifact branch ────────────────────────────────
    // Includes both targeting artifacts (Magnetic Glove, Book of Doom,
    // Yeeting, Heart of the Mountain, etc.) and non-targeting artifacts
    // (Cute Cheese-style self-effects). Strategy: load the artifact's
    // own resolution path and invoke it for free.
    //
    // Cost bypass — Swagdri's text says "without paying its Cost", and
    // for `manualGoldCost` artifacts (Book of Doom's per-target scaling)
    // the resolve does its own gold deduction. We can't intercept that
    // cleanly, so we bump the player's gold by a generous headroom
    // before resolving and restore the original value afterwards. Net
    // effect: any deduction made by the resolve is undone, leaving the
    // player at their pre-Swagdri gold total. Headroom is the artifact's
    // base cost × the targeting maxTotal (capped at 99 per the
    // `manualGoldCost` convention) so even an "all-in" Book of Doom on
    // 99 targets fits.
    const { loadCardEffect } = require('./_loader');
    const script = loadCardEffect(top);
    if (!script) return;

    const baseCost = cd?.cost || 0;

    // Build validTargets + config for targeting artifacts.
    const isTargetingArtifact = !!(script.getValidTargets && script.targetingConfig);
    let selectedIds = [];
    let validTargets = [];

    if (isTargetingArtifact) {
      validTargets = script.getValidTargets(engine.gs, pi, engine) || [];
      const config = typeof script.targetingConfig === 'function'
        ? script.targetingConfig(engine.gs, pi, 0)
        : { ...script.targetingConfig };
      // Override fields that depend on cost so the targeting UI
      // displays / accepts a free play correctly.
      if (script.manualGoldCost && !config.maxTotal) config.maxTotal = 99;
      if (config.dynamicCostPerTarget != null) config.dynamicCostPerTarget = 0;
      config.title = config.title || `Swagdri — ${top}`;
      config.description = (config.description || `Play ${top} for free.`)
        + ' (Swagdri: cost is 0.)';
      config.cancellable = config.cancellable !== false;

      // Self-target-only artifacts (Magnetic Glove, Cute Cheese: no
      // board targets, just deck searches) declare `alwaysConfirmable`
      // so the confirm fires with 0 selections. Don't bail on empty
      // validTargets in that case.
      if (validTargets.length === 0 && !config.alwaysConfirmable) return;

      const pick = await engine.promptEffectTarget(pi, validTargets, config);
      if (pick == null) return; // null/undefined = cancel
      // Empty `pick` is OK iff alwaysConfirmable (the user confirmed
      // with no selections — Magnetic Glove's deck-search flow).
      if (pick.length === 0 && !config.alwaysConfirmable) return;
      if (pick.length > 0 && script.validateSelection
          && !script.validateSelection(pick, validTargets)) return;
      selectedIds = pick;
    }

    // Pop the Stack inst NOW (after the player committed via the prompt).
    // popCoolnessStackTo('board') already broadcasts coolness_stack_change
    // mode='pop' dest='board' so the client unmasks the new Stack top
    // synchronously when the next sync arrives.
    const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
    if (!popped) return;
    engine.sync();

    // Cost bypass via gold save/restore.
    // `_goldFreeze` masks the inflated value in sendGameState so the
    // client's diff-detector never sees the +headroom bump or the
    // -headroom restore. Without this freeze the player would see
    // a -999 (or larger) red floater above the gold counter.
    const origGold = ps.gold || 0;
    const headroom = Math.max(baseCost * 99, 999);
    ps._goldFreeze = origGold;
    ps.gold = origGold + headroom;
    try {
      if (script.resolve) {
        await script.resolve(engine, pi, selectedIds, validTargets);
      }
    } catch (err) {
      console.error('[Swagdri] artifact resolve error:', err?.message);
    }
    // Restore gold and clear the freeze so subsequent gold changes
    // (gains/losses outside the Swagdri play) animate normally.
    ps.gold = origGold;
    delete ps._goldFreeze;

    // Route the artifact to deletedPile (per Swagdri's text). The
    // synthetic flow never put it in hand, so there's no hand splice
    // to do — just place it in deleted.
    ps.deletedPile.push(top);
    engine.log('swagdri_free_play', { player: ps.username, card: top });
    engine.sync();
  },
};
