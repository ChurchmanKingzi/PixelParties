// ═══════════════════════════════════════════
//  CARD EFFECT: "Big Gwen Guard"
//  Creature (Normal, Lv1 Summoning Magic) — Crystals
//  HP 50
//
//  ① SPECIAL SUMMON — while you control no
//    Creatures AND have at least one auto-revealing
//    card in hand (`revealOnEnterHand: true`), you
//    may pay 1 such card to summon BGG as an
//    additional Action. The path bypasses the
//    standard Lv1 Summoning Magic level
//    requirement.
//
//  ② SUPPRESSION AURA — while BGG sits in a
//    Support Zone, every "while in hand" effect
//    from auto-revealing Crystals on that
//    controller's side is suppressed. Wired
//    centrally via `_crystals-shared.js` /
//    `selfRevealEffectsSuppressed(engine, pi)`.
//
//  Summon-mode policy:
//    • Main Phase OR Action Phase without an Action
//      slot available OR hero can't normal-summon
//      (no Lv1 Summoning Magic coverage) → special
//      path is the ONLY way; the discard cost is
//      forced, no prompt.
//    • Action Phase with both options live (action
//      slot free AND hero meets Lv1 Summoning
//      Magic) → prompt the player to pick:
//        · "Special" — pay the discard, no Action.
//        · "Normal"  — skip the discard, consume
//          the hero's Action slot (engine's default
//          summon path).
//      The action refund / re-consume is handled by
//      a `gs._summonModeUpgradedToInherent` flag
//      read by server.js after `_runBeforeSummon`.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Big Gwen Guard';

/**
 * True iff `pi` currently controls NO Creature in support. Walks
 * tracked instances and stops on the first Creature owned/controlled
 * by `pi`. Skips face-down (surprise) Creatures since the card text
 * implies the player can see what they "control".
 */
function _controlsNoCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return false;
  }
  return true;
}

/**
 * Hand indices on `pi`'s side that are auto-revealed via the card's
 * own `revealOnEnterHand: true` script flag. The discard cost
 * specifically eats one of THESE (the card text scopes "revealed
 * because of its own effect", not Luna Kiai-style temporary reveals).
 */
function _autoRevealedHandIndices(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    const script = loadCardEffect(ps.hand[i]);
    if (script?.revealOnEnterHand) out.push(i);
  }
  return out;
}

/** True iff special-summon conditions hold for `pi`. */
function _specialSummonEligible(engine, pi) {
  if (!_controlsNoCreatures(engine, pi)) return false;
  return _autoRevealedHandIndices(engine, pi).length > 0;
}

/**
 * Is the hero's Action slot still available right now? Action Phase
 * only — Main Phase has no action slot to use, so the answer is
 * always "no" there. Mirrors the gate at server.js:doPlayCreature
 * (`actionAlreadyUsed = isActionPhase && heroesActedThisTurn.length
 * > 0 && !hasBonusAction`).
 */
function _actionSlotAvailable(gs, pi, heroIdx) {
  if (gs.currentPhase !== 3) return false;
  const ps = gs.players[pi];
  if (!ps) return false;
  const actedAny = (ps.heroesActedThisTurn || []).length > 0;
  if (!actedAny) return true;
  const hasBonus = (ps.bonusActions?.heroIdx === heroIdx && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0);
  return !!hasBonus;
}

/**
 * Can the hero satisfy the Lv1 Summoning Magic requirement WITHOUT
 * BGG's bypass? Manual count via `countAbilitiesForSchool` to avoid
 * a recursion back into `canBypassLevelReq`. Lv1 SM is the only
 * level requirement BGG cares about, so a simple ≥1 check on the
 * hero's Summoning Magic stack (Performance / Wisdom not counted
 * here — they pay at cast time, but for "can the hero normal-summon
 * BGG by school alone", the pure ability count is the cleanest
 * read).
 */
function _heroCanNormalSummonBgg(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;
  const abZones = ps.abilityZones?.[heroIdx] || [];
  const smLevel = engine.countAbilitiesForSchool('Summoning Magic', abZones);
  return smLevel >= 1;
}

/** Forced-special context — phase / action / hero coverage. */
function _isForcedSpecial(gs, engine, pi, heroIdx) {
  const isMain = gs.currentPhase === 2 || gs.currentPhase === 4;
  if (isMain) return true;
  if (!_actionSlotAvailable(gs, pi, heroIdx)) return true;
  if (!_heroCanNormalSummonBgg(engine, pi, heroIdx)) return true;
  return false;
}

/**
 * Pay the discard cost — pick an auto-revealed hand card and discard
 * it. Returns true on success, false on cancel. Cancel refuses the
 * whole summon.
 */
async function _payDiscardCost(engine, pi) {
  const eligibleIndices = _autoRevealedHandIndices(engine, pi);
  if (eligibleIndices.length === 0) return false;
  const result = await engine.promptGeneric(pi, {
    type: 'forceDiscardCancellable',
    title: CARD_NAME,
    description: `Discard one of your auto-revealed cards to summon ${CARD_NAME} as an additional Action.`,
    instruction: 'Click a highlighted auto-revealed card in your hand to discard it.',
    eligibleIndices,
    cancellable: true,
    cancelLabel: 'Cancel summon',
  });
  if (!result || result.cancelled || result.cardName == null) return false;
  const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
    source: CARD_NAME, selfInflicted: true,
  });
  return !!ok;
}

module.exports = {
  activeIn: ['support'],
  canSummon: () => true,

  /**
   * Bypass the Lv1 Summoning Magic requirement on the special path —
   * which is the only path when conditions hold AND we're in a forced
   * context (Main / no action / hero can't normal-summon). Returns
   * false for the "ambiguous" Action Phase case so the engine's
   * normal level check still gates the normal-summon branch (the
   * player picks the path in `beforeSummon` and the hero must
   * legitimately satisfy SM for the normal pick to be offered).
   */
  canBypassLevelReq(gs, pi, heroIdx, cardData, engine) {
    if (!engine) return false;
    if (!_specialSummonEligible(engine, pi)) return false;
    return _isForcedSpecial(gs, engine, pi, heroIdx);
  },

  /**
   * Engine-economy gate. Mirrors `canBypassLevelReq` — true only when
   * conditions FORCE the special path. For the ambiguous Action Phase
   * case the engine treats it as a normal summon (Action slot
   * consumed), and `beforeSummon` then offers a "switch to special"
   * prompt that refunds the slot when accepted.
   */
  inherentAction(gs, pi, heroIdx, engine) {
    if (!engine) return false;
    if (!_specialSummonEligible(engine, pi)) return false;
    return _isForcedSpecial(gs, engine, pi, heroIdx);
  },

  /**
   * Resolve the summon-mode choice + pay any cost.
   *
   *   • Conditions not met         → return true (vanilla path).
   *   • Forced special             → pay discard or refuse.
   *   • Ambiguous (Action Phase    → prompt the player. If they pick
   *     + action + hero meets SM)    "special", pay discard AND set
   *                                  `gs._summonModeUpgradedToInherent
   *                                  = pi` so server.js refunds the
   *                                  action it already consumed.
   *                                  Otherwise return true (engine's
   *                                  default normal summon flow).
   */
  async beforeSummon(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    if (!_specialSummonEligible(engine, pi)) return true;

    // Card-effect placements (Living Illusion, Barker, revive/discard-
    // path summons) bypass the player-choice flow entirely — the
    // discard cost belongs to the action-economy summon path, not to
    // forced placements. We detect "this is a card-effect summon"
    // by the engine flags those callers carry on the ctx.
    if (ctx._summonedFromDiscard || ctx._reviveAfterDeath
        || ctx._summonedByLivingIllusion || ctx._summonedByPlacement) return true;

    if (_isForcedSpecial(gs, engine, pi, heroIdx)) {
      return await _payDiscardCost(engine, pi);
    }

    // Action Phase + slot available + hero meets SM. Both paths viable.
    const choice = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Choose how to summon ${CARD_NAME}:`,
      showCard: CARD_NAME,
      confirmLabel: '⚡ Special (discard 1 auto-revealed, free Action)',
      cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
      cancellable: true,
    });
    if (!choice) {
      // Normal summon — engine already consumed the Action slot.
      // Nothing to do here.
      return true;
    }
    const paid = await _payDiscardCost(engine, pi);
    if (!paid) return false;
    // Flag for server.js to refund the action consumption and treat
    // this play as if it were inherent.
    gs._summonModeUpgradedToInherent = pi;
    return true;
  },
};
