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
    if (!ctx._borrowedUse && ctx.card?.counters?.[HOPT_KEY] === ctx._engine.gs.turn) return false;   // W12 (Q5): geliehene Verwendung ignoriert den Stempel
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
        // W16c (A04-04): „as if it was part of your hand" — nur die KOSTEN entfallen, die Spielbedingung der Ausrüstung
        // (`canEquipToHero`, z. B. Crescent Moon: mind. 1 New Moon auf dem Brett) gilt weiter.
        if (!engine.canEquipCardToHero(top, pi, hi)) continue;
        const slots = ps.supportZones?.[hi] || [];
        if (slots.some(s => !s || s.length === 0) || engine.equipPflichtPlatz(pi, hi, top) >= 0) return true;   // Darion: der Equip-Stapel zaehlt als Platz
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
    if (!ctx._borrowedUse && ctx.card?.counters?.[HOPT_KEY] === engine.gs.turn) return false;
    const top = engine.getCoolnessStackTop(pi);
    if (!top) return false;
    const cardDB = engine._getCardDB();
    const cd = cardDB[top];
    if (cd?.cardType !== 'Artifact') return false;
    if (!ctx.card.counters) ctx.card.counters = {};
    if (!ctx._borrowedUse) ctx.card.counters[HOPT_KEY] = engine.gs.turn;   // W13 (Al, Rueckfrage 9): geliehen = Stempel bleibt (und Abbruch loescht keinen fremden Stempel)
    // ★ Z7 (A04-05): Abbruch/Fehlschlag VOR der Zusage verbraucht die Einmal-Nutzung NICHT (Regel 23.9) —
    // der Zählerstempel geht zurück, und `false` hält auch die Engine-Rundensperre offen (ein blankes
    // `return;` gilt dort als Erfolg).
    const abbruch = () => { if (!ctx._borrowedUse) delete ctx.card.counters[HOPT_KEY]; return false; };

    const ps = engine.gs.players[pi];

    // ── Equipment branch: build hero+slot target list, fly first, commit after ──
    if (cd?.subtype === 'Equipment') {
      const targets = [];
      for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        // Frozen Heroes can't accept new equipment.
        if (hero.statuses?.frozen) continue;
        if (!engine.canEquipCardToHero(top, pi, hi)) continue;   // W16c (A04-04): Spielbedingung bleibt (nur Kosten entfallen)
        const slots = ps.supportZones?.[hi] || [];
        let leftmostFree = -1;
        const _stapel = engine.equipPflichtPlatz(pi, hi, top);   // Darion: der Equip-Stapel ist der einzige Platz
        for (let si = 0; si < slots.length; si++) {
          if (_stapel >= 0 ? si === _stapel : (!slots[si] || slots[si].length === 0)) {
            if (leftmostFree < 0) leftmostFree = si;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi, heroIdx: hi, slotIdx: si, cardName: '',
              ...(_stapel >= 0 ? { _eigeneStapelWahl: true } : {}),   // Darion: Platzwahl, keine Kartenwahl — keine Rueckfrage „welches Equip?"
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
      if (targets.length === 0) return abbruch();
      const pick = await engine.promptEffectTarget(pi, targets, {
        maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
        title: CARD_NAME,
        description: `Equip ${top} for free — pick a Hero or a specific empty Support Zone.`,
        confirmLabel: '⚒️ Equip',
        confirmClass: 'btn-success',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });
      if (!pick || pick.length === 0) return abbruch();
      const sel = targets.find(t => t.id === pick[0]);
      if (!sel) return abbruch();
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
      if (!popped) return abbruch();
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
    // Cost bypass — Swagdri's text says "without paying its Cost":
    // siehe Gratis-Scope weiter unten.
    const { loadCardEffect } = require('./_loader');
    const script = loadCardEffect(top);
    if (!script) return abbruch();

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
      if (validTargets.length === 0 && !config.alwaysConfirmable) return abbruch();

      const pick = await engine.promptEffectTarget(pi, validTargets, config);
      if (pick == null) return abbruch(); // null/undefined = cancel
      // Empty `pick` is OK iff alwaysConfirmable (the user confirmed
      // with no selections — Magnetic Glove's deck-search flow).
      if (pick.length === 0 && !config.alwaysConfirmable) return abbruch();
      if (pick.length > 0 && script.validateSelection
          && !script.validateSelection(pick, validTargets)) return abbruch();
      selectedIds = pick;
    }

    // Pop the Stack inst NOW (after the player committed via the prompt).
    // popCoolnessStackTo('board') already broadcasts coolness_stack_change
    // mode='pop' dest='board' so the client unmasks the new Stack top
    // synchronously when the next sync arrives.
    const popped = await ctx.popCoolnessStackTo(pi, 'board', { source: CARD_NAME });
    if (!popped) return abbruch();
    engine.sync();

    // Kosten umgehen ueber den Gratis-Scope (`engine.kostenlosSpielen`):
    // fuer `pi` ist `canAffordGold` wahr und `_payCardCost` bucht nichts
    // ab – auch Artifacts mit eigener Kostenrechnung (manualGoldCost)
    // zahlen nichts. Frueher: Gold sichern/zuruecksetzen, das jeden
    // Gold-GEWINN des Artifacts mit verwarf (A04-cute-03, Golden Bananas).
    try {
      if (script.resolve) {
        await engine.kostenlosSpielen(pi, async () => {
          await script.resolve(engine, pi, selectedIds, validTargets);
        });
      }
    } catch (err) {
      console.error('[Swagdri] artifact resolve error:', err?.message);
    }

    // Route the artifact to deletedPile (per Swagdri's text). The
    // synthetic flow never put it in hand, so there's no hand splice
    // to do — just place it in deleted.
    ps.deletedPile.push(top);
    engine.log('swagdri_free_play', { player: ps.username, card: top });
    engine.sync();
  },
};
