// ═══════════════════════════════════════════
//  SHARED HELPER: Spider archetype
//
//  Single source of truth for "is this a Spider?" predicates, Spider
//  Creature counts (board-wide + per-side, used by Spider Avalanche /
//  Crimson Skull Spider / Spider Hive / Spider Dance), the "send N
//  face-down Surprises you control to the discard pile as a summon
//  cost" cost-payment helper (Box / Brain / Crimson Skull / Diamond
//  Spider all share the pattern), and force-Surprise-activation (Baby
//  Spider sacrifice + Cute Spider discard-trigger both bypass the
//  Surprise's natural trigger condition by calling `_activateSurprise`
//  directly with a synthetic source).
//
//  Pure-archetype check — every Spider card in cards.json carries
//  `archetype: "Spider"`. No per-card archetype overrides today.
// ═══════════════════════════════════════════

const SPIDER_ARCHETYPE = 'Spiders';

/** Is this card a Spider Creature? */
function isSpiderCreature(cardName, engine) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;
  return cd.archetype === SPIDER_ARCHETYPE;
}

/**
 * Count Spider Creatures `playerIdx` controls in support zones.
 * Excludes face-down (Bakhm-staged / pre-flip) instances — they don't
 * yet count as on-board for tribal purposes, matching Loyal / Deepsea
 * conventions.
 */
function countSpiderCreaturesControlled(engine, playerIdx) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!isSpiderCreature(inst.name, engine)) continue;
    n++;
  }
  return n;
}

/**
 * Total Spider Creatures on the board (both sides). Used by Spider
 * Hive: "reduce face-down Surprise levels by the number of Spider
 * Creatures ON THE BOARD" — both sides count.
 */
function countSpiderCreaturesOnBoard(engine) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!isSpiderCreature(inst.name, engine)) continue;
    n++;
  }
  return n;
}

/**
 * Enumerate the player's own face-down Surprises across all their
 * Hero slots. Returns one entry per Surprise:
 *   { inst, heroIdx, cardName }
 * Skips empty / non-face-down / wrong-zone slots. Used by the
 * Surprise-cost summon helper (Box / Brain / Crimson Skull / Diamond
 * Spider) and by Baby Spider's "activate any of your Surprises".
 */
function listOwnFaceDownSurprises(engine, playerIdx) {
  const out = [];
  const ps = engine.gs.players[playerIdx];
  if (!ps) return out;
  for (let hi = 0; hi < (ps.surpriseZones || []).length; hi++) {
    const zone = ps.surpriseZones[hi] || [];
    if (zone.length === 0) continue;
    const cardName = zone[0];
    // Find the live instance to send to discard later.
    const inst = engine.cardInstances.find(c =>
      (c.owner === playerIdx || c.controller === playerIdx)
      && c.zone === 'surprise' && c.heroIdx === hi && c.name === cardName
    );
    if (!inst) continue;
    if (!inst.faceDown) continue;
    out.push({ inst, heroIdx: hi, cardName });
  }
  return out;
}

/**
 * Send N face-down Surprises the player controls to the discard pile
 * as a summon cost. Prompts via a zonePick over the player's Surprise
 * Zones. Returns true on commit, false on cancel.
 *
 *   • `count` Surprises must be picked (no partial fulfilment).
 *   • Picker is cancellable — cancelling refuses the whole summon.
 *   • Each chosen Surprise flies to its owner's discard pile via a
 *     zone-anchored `play_pile_transfer` (per the "Removing a chosen
 *     board card" project rule — the diff animator would otherwise
 *     pick the wrong slot if multiple Surprises share a name).
 *
 * Caller wires this from `beforeSummon`. On false return, the summon
 * is refused.
 */
async function paySurpriseCostToSummon(engine, playerIdx, count, sourceCardName, summonHeroIdx) {
  const available = listOwnFaceDownSurprises(engine, playerIdx);
  if (available.length < count) return false;

  // Interactive board picker — the player clicks face-down Surprises
  // on their actual Surprise Zones rather than a modal gallery
  // overlay. The `pickSurprise` prompt highlights the matching
  // Surprise Zones, lets the player toggle selection (or auto-emits
  // on single-pick), and a small floating panel handles Confirm /
  // Cancel without dimming the board.
  const result = await engine.promptGeneric(playerIdx, {
    type: 'pickSurprise',
    surprises: available.map(s => ({
      owner: playerIdx,
      heroIdx: s.heroIdx,
      instId: s.inst.id,
    })),
    selectCount: count,
    minSelect: count,
    cancellable: true,
    title: sourceCardName,
    description: `Sacrifice ${count} face-down Surprise${count > 1 ? 's' : ''} you control to summon ${sourceCardName} as an additional Action.`,
    confirmLabel: '🕷️ Sacrifice & Summon!',
  });

  if (!result || result.cancelled) return false;
  const picks = Array.isArray(result.selectedSurprises) ? result.selectedSurprises : [];
  if (picks.length !== count) return false;

  // Resolve each pick back to the live inst via id. Re-check zone
  // ('surprise') so a race during the picker (Defending the Gate
  // proxying, etc.) doesn't strand us. Stagger the discards with
  // small delays so multi-pick sacrifices (Box / Crimson Skull /
  // Diamond) read as a sequence rather than a simultaneous batch
  // of pile flights — matches the project's simultaneous-pile-
  // flight stagger rule for visible card transit.
  const STAGGER_MS = 260;
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    const inst = pick.instId != null
      ? engine.cardInstances.find(c => c.id === pick.instId)
      : null;
    if (!inst || inst.zone !== 'surprise') continue;
    engine._broadcastEvent('play_pile_transfer', {
      owner: inst.owner, cardName: inst.name,
      from: 'surprise', to: 'discard',
      fromHeroIdx: inst.heroIdx,
    });
    await engine.actionDestroyCard(
      { name: sourceCardName, owner: playerIdx },
      inst,
      { toPile: 'discard' },
    );
    if (i < picks.length - 1) await engine._delay(STAGGER_MS);
  }
  engine.sync();

  // ── Summon flourish: webs descend, small spiders crawl out ──
  // Anchored to the Spider's actual Support Zone slot — not the
  // Hero's row — so the burst lands on the Spider itself. The
  // engine doesn't know the destination slot yet (placement runs
  // AFTER beforeSummon returns), so we stash a pending marker on
  // gs and let `summonCreatureWithHooks` fire the animation with
  // the resolved `actualSlot` right after placement.
  if (summonHeroIdx != null && summonHeroIdx >= 0) {
    engine.gs._spiderSummonFlourishPending = {
      pi: playerIdx,
      heroIdx: summonHeroIdx,
      cardName: sourceCardName,
    };
  }
  return true;
}

/**
 * Force-activate a face-down Surprise as if its trigger condition had
 * been met by "any target". Used by Baby Spider's sacrifice and Cute
 * Spider's discard-trigger.
 *
 *   • `heroIdx` — which of `playerIdx`'s Heroes hosts the Surprise.
 *   • `opts.spellInst` — the Surprise's CardInstance, when known
 *     (Cute Spider's case where the Surprise has already been moved
 *     to discard and we need to run its effect from there).
 *   • Bypasses the script's `surpriseTrigger` (this helper IS the
 *     "as if condition met" path).
 *   • Still vets `_canHeroActivateSurprise` so school / level / Wisdom
 *     coverage are honoured.
 *
 * Returns the surprise's onSurpriseActivate result (incl. negation).
 */
async function forceActivateSurprise(engine, playerIdx, heroIdx, surpriseCardName, opts = {}) {
  const { loadCardEffect } = require('./_loader');
  const script = loadCardEffect(surpriseCardName);
  if (!script?.isSurprise || !script.onSurpriseActivate) return null;

  if (!engine._canHeroActivateSurprise(playerIdx, heroIdx, surpriseCardName)) return null;

  // Synthetic sourceInfo — no real attacker. Surprises that REQUIRE
  // an attacker (Booby Trap) check `sourceInfo.owner >= 0` and bail;
  // Surprises that allow "any target" (Spider Avalanche) work fine.
  // The forcer (Baby Spider) decides whether to call this for
  // attacker-required Surprises; we just bypass the trigger check.
  const sourceInfo = opts.sourceInfo || {
    cardName: opts.forcerCardName || null,
    owner: -1, heroIdx: -1, telekinesis: true,
    forcedByCard: opts.forcerCardName,
  };

  return engine._activateSurprise(playerIdx, heroIdx, surpriseCardName, sourceInfo, script);
}

// ═══════════════════════════════════════════
//  Spider "send N Surprises to summon as additional Action" mixin.
//
//  Four Spider Creatures share the exact same summon-cost pattern:
//  Box Spider / Crimson Skull Spider (3 Surprises), Diamond Spider
//  (2 Surprises), Brain Spider (1 Surprise). The action-economy is
//  identical — Big Gwen Guard's path (forced-special vs ambiguous
//  Action Phase prompt). Each card calls `makeSurpriseCostSummon(N)`
//  to get the `canBypassLevelReq` / `inherentAction` / `beforeSummon`
//  triple plus the support functions in one consistent shape.
//
//  Cards that ALSO need extra summon-time gates (Crimson Skull's
//  singleton; Brain Spider's no-extra-gate) compose by adding their
//  own `canSummon` separately — this helper deliberately scopes only
//  to the cost-payment + action-economy mixin.
// ═══════════════════════════════════════════

/** Is the Action-Phase Action slot still available right now? */
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

/** Hero satisfies Lv1 Summoning Magic without any bypass. */
function _heroCanNormalSummonSpider(engine, pi, heroIdx) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name || hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return false;
  const abZones = ps.abilityZones?.[heroIdx] || [];
  return engine.countAbilitiesForSchool('Summoning Magic', abZones) >= 1;
}

/**
 * Build the surprise-cost summon mixin. Returns an object the card
 * spreads into its module.exports.
 *
 *   { inherentAction, beforeSummon }
 *
 * The card's caller defines the card-specific bits (`canSummon`,
 * `hooks`, `cpuMeta`, …) and merges this in.
 *
 * NOTE — what this DOES NOT bypass:
 *   • Spider card text reads "send N Surprises … to summon this
 *     Creature as an additional Action". The surprise cost waives
 *     the ACTION cost, NOT the Lv1 Summoning Magic level
 *     requirement. The summoning Hero must therefore still
 *     legitimately satisfy the school / level gate (just like any
 *     normal Lv1 Summoning Magic summon). Heroes without Summoning
 *     Magic are NOT eligible to summon a Spider via the surprise
 *     cost — only Heroes who could already summon it normally.
 *     Concretely: the mixin deliberately omits
 *     `canBypassLevelReq`, so `heroMeetsLevelReq` enforces the
 *     standard school check on every candidate Hero and the
 *     click-to-summon picker only lights up Heroes that are
 *     actually capable.
 */
function makeSurpriseCostSummon(surpriseCost, cardName) {
  function specialEligible(engine, pi) {
    return listOwnFaceDownSurprises(engine, pi).length >= surpriseCost;
  }
  // True iff the action-economy context FORCES the special (free-
  // Action) path: Main Phase (no Action exists), or Action Phase
  // with no Action available to the hero. Note the deliberate
  // omission of `!_heroCanNormalSummonSpider(...)` — without the
  // level bypass, a Hero who can't normal-summon (no SM) shouldn't
  // see the special path either, because the eligibility filter
  // already rejects them at `heroMeetsLevelReq`. The mixin's
  // `inherentAction` is only consulted for Heroes that have already
  // cleared the level gate.
  function isForcedSpecial(gs, engine, pi, heroIdx) {
    const isMain = gs.currentPhase === 2 || gs.currentPhase === 4;
    if (isMain) return true;
    if (!_actionSlotAvailable(gs, pi, heroIdx)) return true;
    return false;
  }
  return {
    inherentAction(gs, pi, heroIdx, engine) {
      if (!engine) return false;
      if (!specialEligible(engine, pi)) return false;
      return isForcedSpecial(gs, engine, pi, heroIdx);
    },
    async beforeSummon(ctx) {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      if (!specialEligible(engine, pi)) return true;
      // Card-effect placements skip the cost flow — costs belong to the
      // action-economy summon path only (Living Illusion, revives, etc.).
      if (ctx._summonedFromDiscard || ctx._reviveAfterDeath
          || ctx._summonedByLivingIllusion || ctx._summonedByPlacement) return true;

      if (isForcedSpecial(gs, engine, pi, heroIdx)) {
        return await paySurpriseCostToSummon(engine, pi, surpriseCost, cardName, heroIdx);
      }

      // Ambiguous — both paths viable, let the player pick.
      const costLabel = surpriseCost === 1 ? '1 Surprise' : `${surpriseCost} Surprises`;
      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: cardName,
        message: `Choose how to summon ${cardName}:`,
        showCard: cardName,
        confirmLabel: `🕷️ Special (send ${costLabel}, free Action)`,
        cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
        cancellable: true,
      });
      if (!choice) return true; // Engine already took the Action.
      const paid = await paySurpriseCostToSummon(engine, pi, surpriseCost, cardName, heroIdx);
      if (!paid) return false;
      gs._summonModeUpgradedToInherent = pi;
      return true;
    },
  };
}

module.exports = {
  SPIDER_ARCHETYPE,
  isSpiderCreature,
  countSpiderCreaturesControlled,
  countSpiderCreaturesOnBoard,
  listOwnFaceDownSurprises,
  paySurpriseCostToSummon,
  forceActivateSurprise,
  makeSurpriseCostSummon,
};
