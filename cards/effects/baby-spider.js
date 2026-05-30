// ═══════════════════════════════════════════
//  CARD EFFECT: "Baby Spider"
//  Creature (Summoning Magic Lv0, Normal) — 10 HP
//
//  "While you control another 'Spider' Creature, summoning this
//   Creature counts as an additional Action. You can only summon 1
//   'Baby Spider' with this effect per turn. You may sacrifice this
//   Creature to immediately activate a Surprise in one of your
//   Heroes' Surprise Zones as if any target had met its activation
//   condition."
//
//  Mechanics
//  ─────────
//   • Lv0 SM — no level gate. The "additional Action" path is a pure
//     action-economy bypass: when controller has ANOTHER Spider
//     Creature on board AND this turn's inherent-summon hasn't been
//     used yet, the engine takes the free path.
//   • Per-turn inherent cap is tracked on the player state
//     (`_babySpiderInherentUsedTurn`) — bumped in `beforeSummon` when
//     the engine is about to take the inherent path. Subsequent
//     Baby Spider summons this turn cost an Action (normal Lv0
//     summon, which always succeeds).
//   • Active effect (`creatureEffect`) = sacrifice Baby Spider →
//     force-activate a Surprise on any of the controller's Heroes,
//     bypassing the surprise's natural trigger condition. Follows
//     the SAME pattern as Telekinesis (canonical "force-trigger a
//     Surprise" reference): builds the eligible Surprise list via
//     the standard `promptEffectTarget` picker, then calls
//     `engine._activateSurprise(..., { telekinesis: true })` so
//     scripts that read `sourceInfo.telekinesis` (Booby Trap's
//     "pick any target" branch, Magic Mirror's reflection
//     refusal, etc.) compose correctly.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { isSpiderCreature } = require('./_spider-shared');

const CARD_NAME = 'Baby Spider';

/**
 * True iff `pi` controls at least one Spider Creature that ISN'T this
 * Baby Spider (the card text reads "another 'Spider' Creature").
 */
function controlsAnotherSpider(engine, pi) {
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.name === CARD_NAME) continue;
    if (isSpiderCreature(inst.name, engine)) return true;
  }
  return false;
}

/** Has the inherent path already been used this turn? */
function inherentUsedThisTurn(gs, pi) {
  return gs.players[pi]?._babySpiderInherentUsedTurn === gs.turn;
}

/**
 * Build the target list of own face-down Surprises the activator can
 * force-trigger. Mirrors Telekinesis's eligibility gate: living host
 * Hero, not Frozen/Stunned/Webbed, surprise opts in via
 * `canTelekinesisActivate !== false`, and the host Hero
 * legitimately meets the surprise's school/level via
 * `_canHeroActivateSurprise`. Bakhm-support-zone face-down
 * surprises are NOT included — Baby Spider's text reads "in one of
 * your Heroes' Surprise Zones", scoping to the actual Surprise Zone.
 */
function getEligibleTargets(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return [];
  const targets = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (hero.statuses?.frozen
        || hero.statuses?.stunned
        || hero.statuses?.webbed) continue;
    const sz = ps.surpriseZones?.[hi] || [];
    if (sz.length === 0) continue;
    const cardName = sz[0];
    const script = loadCardEffect(cardName);
    if (!script?.isSurprise) continue;
    if (script.canTelekinesisActivate === false) continue;
    if (typeof script.canTelekinesisActivate === 'function'
        && !script.canTelekinesisActivate(engine, pi)) continue;
    if (!engine._canHeroActivateSurprise(pi, hi, cardName)) continue;
    targets.push({
      id: `surprise-${pi}-${hi}`,
      type: 'surprise',
      owner: pi,
      heroIdx: hi,
      cardName,
    });
  }
  return targets;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  /**
   * Free additional-Action summon while another Spider Creature is on
   * the board, capped at one per turn. The cap is checked against the
   * shared `_babySpiderInherentUsedTurn` counter set in `beforeSummon`.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (inherentUsedThisTurn(gs, pi)) return false;
    return controlsAnotherSpider(engine, pi);
  },

  /**
   * Mark this summon as having consumed the once-per-turn inherent
   * slot if (and only if) the engine is about to take the inherent
   * path. We re-check `inherentAction` here — the gs state is stable
   * across the engine's path-decision and beforeSummon, so true here
   * means the engine ALSO saw true and chose the free path.
   *
   * Card-effect placements (revive / Living Illusion / similar) skip
   * the action-economy counter — those aren't action-spending summons.
   */
  beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    if (ctx._summonedFromDiscard || ctx._reviveAfterDeath
        || ctx._summonedByLivingIllusion || ctx._summonedByPlacement) return true;
    if (inherentUsedThisTurn(gs, pi)) return true;
    if (!controlsAnotherSpider(engine, pi)) return true;
    // Inherent path — mark the once-per-turn slot used.
    gs.players[pi]._babySpiderInherentUsedTurn = gs.turn;
    return true;
  },

  /** Active effect requires at least one eligible own face-down Surprise. */
  canActivateCreatureEffect(ctx) {
    return getEligibleTargets(ctx._engine, ctx.cardOwner).length > 0;
  },

  /**
   * Sacrifice Baby Spider → force-activate one of own face-down
   * Surprises. Uses the same `promptEffectTarget` + `_activateSurprise`
   * pattern as Telekinesis. Cancelling the picker refuses the whole
   * effect (HOPT not consumed, Baby Spider stays alive).
   */
  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const babyInst = ctx.card;
    if (!babyInst || babyInst.zone !== 'support') return false;

    const targets = getEligibleTargets(engine, pi);
    if (targets.length === 0) return false;

    // ── Step 1: pick a Surprise to force-activate ──
    // Prompt FIRST so cancelling doesn't waste the Baby Spider.
    const selectedIds = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Sacrifice Baby Spider to immediately activate one of your face-down Surprises.',
      confirmLabel: '🕷️ Sacrifice & Activate!',
      confirmClass: 'btn-danger',
      cancellable: true,
      allowNonCreatureEquips: true,
      maxTotal: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const target = targets.find(t => t.id === selectedIds[0]);
    if (!target) return false;
    const surpriseCardName = target.cardName;
    const surpriseHeroIdx = target.heroIdx;
    const script = loadCardEffect(surpriseCardName);
    if (!script?.isSurprise || !script.onSurpriseActivate) return false;

    // ── Step 2: sacrifice Baby Spider ──
    // Fire ON_CREATURE_SACRIFICED before destroying so listeners can
    // read the live inst; actionDestroyCard then routes to discard +
    // fires the standard onCreatureDeath chain. Snapshot the live id
    // for the creature-caster annotation in Step 3 — once the inst is
    // untracked, the snapshot is the only handle left.
    const source = { name: CARD_NAME, owner: pi, heroIdx: babyInst.heroIdx };
    const sacrificedSnapshot = {
      id: babyInst.id,
      name: CARD_NAME,
      owner: pi, controller: pi,
      heroIdx: babyInst.heroIdx, zoneSlot: babyInst.zoneSlot,
    };
    await engine.runHooks('onCreatureSacrificed', {
      creature: babyInst,
      cardName: CARD_NAME,
      owner: pi,
      heroIdx: babyInst.heroIdx,
      zoneSlot: babyInst.zoneSlot,
      source,
      _skipReactionCheck: true,
    });
    await engine.actionDestroyCard(source, babyInst);
    engine.sync();
    await engine._delay(200);

    // ── Step 3: force-activate the chosen Surprise ──
    // `sourceInfo.telekinesis: true` is the canonical "no real
    // attacker" signal. Beyond that, the Surprise's downstream damage
    // events should treat the dead Baby Spider as the "user" — so
    // opp's after-the-fact retaliation (Booby Trap / Fireshield /
    // Spider Avalanche-style chains) sees a Creature source whose
    // live instance no longer exists, and bails out cleanly without
    // hitting the host Hero. Achieved via the engine's existing
    // creature-caster annotation pipeline (`gs._spellCasterCreature`
    // → `_rewriteSourceForCreatureCaster` → `_creatureCasterForSource`
    // side-channel). `isCreatureSource` returns true → routes to
    // creature-target branch; `resolveSourceCreature` returns null
    // (Baby Spider is untracked) → trigger conditions short-circuit.
    const prevCasterCreature = engine.gs._spellCasterCreature;
    engine.gs._spellCasterCreature = sacrificedSnapshot;
    try {
      await engine._activateSurprise(pi, surpriseHeroIdx, surpriseCardName, {
        telekinesis: true,
        forcedByCard: CARD_NAME,
        activatorIdx: pi === 0 ? 1 : 0,
      }, script);
    } finally {
      if (prevCasterCreature === undefined) delete engine.gs._spellCasterCreature;
      else engine.gs._spellCasterCreature = prevCasterCreature;
    }

    engine.log('baby_spider_sacrifice', {
      player: gs.players[pi]?.username,
      surprise: surpriseCardName,
      hero: surpriseHeroIdx,
    });
    engine.sync();
    return true;
  },
};
