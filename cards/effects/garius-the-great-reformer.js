// ═══════════════════════════════════════════
//  CARD EFFECT: "Garius, the Great Reformer"
//  Hero — 450 HP, 80 ATK. Starting abilities:
//  Creativity, Leadership.
//
//  Hero Effect (once per turn):
//    Sacrifice a Creature you control that was
//    NOT summoned this turn → search your deck
//    for a Creature with the same or a lower
//    level and a different name → place it into
//    the same Support Zone. That Creature may
//    activate its active effect this turn.
//
//  Implementation notes
//  ────────────────────
//  • `heroEffect: true` + `onHeroEffect` is the
//    standard hero-active contract. Engine
//    stamps the per-hero HOPT on truthy return;
//    any cancel path returns false to refund
//    the slot for the turn.
//
//  • Sacrifice candidates: `getSacrificableCreatures`
//    + per-turn summoning-sickness filter (same
//    pattern as Brackle). Engine helper handles
//    Cardinal Beast / Token immunity.
//
//  • Candidates are FURTHER filtered to those
//    with at least one valid replacement in the
//    deck so the player can never commit to a
//    sacrifice that fizzles at the gallery step.
//
//  • Replacement gallery: distinct Creatures
//    from `ps.mainDeck` of level ≤ sacrificed
//    Creature's level, excluding the sacrificed
//    Creature's own name. Tokens excluded.
//    `canSummon` gate is applied against the
//    sacrificed Creature's heroIdx so Creatures
//    with hard summoning locks (Sparkfly Queen
//    requires `_hivesCrownActive`, future "only
//    via X" rules) never appear.
//
//  • Cancel routing matches Brackle: cancel on
//    the replacement gallery loops BACK to the
//    sacrifice picker; cancel on the sacrifice
//    picker ends the effect and refunds HOPT.
//
//  • Placement: `summonCreatureWithHooks` with
//    `isPlacement: true` runs the full lifecycle
//    (beforeSummon, onPlay, onCardEnterZone)
//    while skipping host-incapacitation gates.
//    Tribute-summon Creatures (Dragon Pilot,
//    Dark Deepsea God, …) still pay their own
//    cost via `beforeSummon` at this step —
//    "Whatever Garius sacrifices does NOT count
//    toward such sacrifices" falls out naturally
//    because Garius's sacrifice has already
//    removed the catalyst from the board (so
//    the placed Creature's tribute prompt can't
//    re-pick it), AND the costs are paid through
//    separate prompts. If the player can't /
//    won't pay the tribute, the placement fails
//    and the deck card is refunded — but the
//    Garius sacrifice is already spent.
//    `inst.counters._hasHaste = true` lifts
//    summoning-sickness on the placed Creature
//    so it may use its active effect this turn
//    (Forceful Revival / Divine Gift of the
//    Deepsea pattern — keeps `turnPlayed`
//    accurate for "summoned this turn" reads).
// ═══════════════════════════════════════════

const { hasCardType, isOwnSideSummonableCreature } = require('./_hooks');

const CARD_NAME = 'Garius, the Great Reformer';

/** Sacrifice candidates intersected with the per-turn summoning-
 *  sickness filter. Pure read, side-effect-free. */
function _eligibleSacrificeCandidates(engine, pi) {
  const turn = engine.gs.turn || 0;
  return engine.getSacrificableCreatures(pi).filter(c =>
    c.inst.turnPlayed !== turn,
  );
}

/**
 * Build the gallery of replacement candidates: distinct Creatures
 * from `ps.mainDeck` of level ≤ maxLevel, EXCLUDING `excludeName`,
 * AND that pass the placed Creature's own `canSummon` gate against
 * the target heroIdx.
 *
 * `canSummon` filter intent — "respect summoning restrictions":
 *   • Sparkfly Queen returns false unless Hive's Crown is mid-resolve
 *     → excluded.
 *   • Trex / placement-gated Gigantisaurs keep their loose (non-strict)
 *     gate because Garius DOES run `beforeSummon` for the placement
 *     (via `summonCreatureWithHooks`), so the per-Hero archetype rule
 *     gets re-applied by the Creature's own beforeSummon at place time.
 *     We deliberately don't pass `_bypassBeforeSummon: true` here.
 *   • Tribute-summon Creatures (Dragon Pilot, Dark Deepsea God, …)
 *     have no `canSummon` and are NOT excluded — their cost is paid
 *     interactively by `beforeSummon` at placement time, AFTER Garius's
 *     sacrifice has already removed the catalyst from the board (so
 *     the catalyst can't also be picked as their tribute).
 */
function _buildReplacementGallery(engine, pi, heroIdx, maxLevel, excludeName) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const seen = new Map();
  for (const cn of (ps.mainDeck || [])) {
    if (seen.has(cn)) continue;
    if (excludeName && cn === excludeName) continue;
    const cd = cardDB[cn];
    if (!cd || !isOwnSideSummonableCreature(cd, cn)) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    const effLvl = engine.effectiveCardLevel(cd, pi);
    if (effLvl > maxLevel) continue;
    if (!engine.isCreatureSummonable(cn, pi, heroIdx)) continue;
    seen.set(cn, { name: cn, source: 'deck', level: effLvl });
  }
  return [...seen.values()].sort(
    (a, b) => (a.level - b.level) || a.name.localeCompare(b.name),
  );
}

/** True iff the deck contains at least one different-named Creature
 *  of level ≤ this candidate's level AND legal to summon at this
 *  candidate's heroIdx. Sacrifice candidate's level is read via
 *  `engine.effectiveCardLevel` so live reducers (Whoolmoth-style)
 *  affect the cap consistently. */
function _hasReplacement(engine, pi, candidateInst) {
  const cardDB = engine._getCardDB();
  const cd = cardDB[candidateInst.name];
  if (!cd) return false;
  const lvl = engine.effectiveCardLevel(cd, pi, { heroIdx: candidateInst.heroIdx });
  return _buildReplacementGallery(
    engine, pi, candidateInst.heroIdx, lvl, candidateInst.name,
  ).length > 0;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    return _eligibleSacrificeCandidates(engine, pi)
      .some(c => _hasReplacement(engine, pi, c.inst));
  },

  /**
   * CPU heuristic — fired for both the sacrifice picker AND the
   * replacement gallery. MCTS would otherwise rollout up to
   * M (sacrifices) × N (gallery) branches per activation; that's
   * cheap per branch but quadratic in pool size, so we collapse
   * each branch to the obvious "throw away the weakest / fetch
   * the strongest" choice.
   *
   *   • Sacrifice prompt — `kind === 'target'` (CPU brain) or
   *     `'effectTarget'` (engine fallback). Valid targets are
   *     own-side equips with cardInstance. Pick the LOWEST-level
   *     Creature (least value lost).
   *   • Replacement gallery — `kind === 'generic'`,
   *     `payload.type === 'cardGallery'`. Pick the HIGHEST-level
   *     Creature (best stat budget at the level cap).
   *
   * Returning undefined falls back to the generic MCTS brain.
   */
  cpuResponse(engine, kind, payload) {
    if (kind === 'target' || kind === 'effectTarget') {
      const { validTargets } = payload || {};
      if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
      const own = validTargets.filter(t => t.type === 'equip' && t.cardInstance);
      if (own.length === 0) return undefined;
      const cardDB = engine._getCardDB();
      const sorted = own.slice().sort((a, b) => {
        const aLvl = cardDB[a.cardName]?.level ?? 0;
        const bLvl = cardDB[b.cardName]?.level ?? 0;
        return aLvl - bLvl;
      });
      return [sorted[0].id];
    }
    if (kind === 'generic' && payload?.type === 'cardGallery') {
      const cards = payload.cards || [];
      if (cards.length === 0) return undefined;
      const cardDB = engine._getCardDB();
      const sorted = cards.slice().sort((a, b) => {
        const aLvl = cardDB[a.name]?.level ?? 0;
        const bLvl = cardDB[b.name]?.level ?? 0;
        return bLvl - aLvl;
      });
      return { cardName: sorted[0].name };
    }
    return undefined;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const gariusHeroIdx = ctx.cardHeroIdx;
    if (!ps) return false;
    const cardDB = engine._getCardDB();

    // ── Pick loop — replacement-gallery cancel returns to the
    // sacrifice picker (Brackle's pattern). Sacrifice-picker cancel
    // ends the effect and refunds HOPT. ──
    while (true) {
      const candidates = _eligibleSacrificeCandidates(engine, pi)
        .filter(c => _hasReplacement(engine, pi, c.inst));
      if (candidates.length === 0) return false;

      const sacTargets = candidates.map(c => ({
        id: `equip-${c.inst.owner}-${c.inst.heroIdx}-${c.inst.zoneSlot}`,
        type: 'equip',
        owner: c.inst.owner, heroIdx: c.inst.heroIdx, slotIdx: c.inst.zoneSlot,
        cardName: c.cardName, cardInstance: c.inst,
        _meta: { level: c.level, maxHp: c.maxHp },
      }));

      const sacPick = await engine.promptEffectTarget(pi, sacTargets, {
        title: CARD_NAME,
        description: 'Click one of your Creatures (not summoned this turn) to sacrifice.',
        confirmLabel: '⚖️ Reform!',
        confirmClass: 'btn-warning',
        cancellable: true,
        exclusiveTypes: true,
        maxPerType: { equip: 1 },
        maxTotal: 1,
        minRequired: 1,
        autoConfirm: true,
        redSelect: true,
      });
      if (!sacPick || sacPick.length === 0) return false;

      const sacSel = sacTargets.find(t => t.id === sacPick[0]);
      if (!sacSel?.cardInstance) return false;
      const sacInst = sacSel.cardInstance;

      // Defensive re-validate — eligibility filter ran at pick-time;
      // an interleaved effect could have moved / destroyed / age-
      // flipped the Creature between picker render and pick.
      if ((sacInst.controller ?? sacInst.owner) !== pi) continue;
      if (sacInst.zone !== 'support') continue;
      if (sacInst.turnPlayed === gs.turn) continue;
      if (sacInst.faceDown) continue;

      // Sacrificed Creature's CURRENT level — Whoolmoth-style reducers
      // can lower it, in which case the replacement cap follows suit.
      const sacLevel    = engine.effectiveCardLevel(
        cardDB[sacInst.name], pi, { heroIdx: sacInst.heroIdx },
      );
      const sacName     = sacInst.name;
      const sacHeroIdx  = sacInst.heroIdx;
      const sacZoneSlot = sacInst.zoneSlot;

      // Build the replacement gallery from the deck — gated on
      // `canSummon` against `sacHeroIdx` so unsummonable Creatures
      // (Sparkfly Queen et al.) never appear.
      const gallery = _buildReplacementGallery(engine, pi, sacHeroIdx, sacLevel, sacName);
      if (gallery.length === 0) continue; // Defensive — pre-filter should preclude.

      const repPick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: `Choose a level ${sacLevel} or lower Creature (other than ${sacName}) from your deck. It will be placed into the same Support Zone.`,
        confirmLabel: '⚖️ Reform!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      // Cancel → back to the sacrifice picker.
      if (!repPick || repPick.cancelled || !repPick.cardName) continue;

      const repName = repPick.cardName;
      if (repName === sacName) continue;
      const repCd = cardDB[repName];
      if (!repCd || !hasCardType(repCd, 'Creature')
          || engine.effectiveCardLevel(repCd, pi) > sacLevel) continue;
      if ((ps.mainDeck || []).indexOf(repName) < 0) continue;
      // Defensive canSummon re-check — gallery filter ran at picker
      // render; an interleaved effect could have flipped the gate
      // (e.g. a Hive's Crown resolution that ended between render
      // and pick). Looping back to the sacrifice picker lets the
      // player choose a different replacement instead of fizzling.
      if (!engine.isCreatureSummonable(repName, pi, sacHeroIdx)) continue;

      // ── Commit ──────────────────────────────────────────────────────
      const source = { name: CARD_NAME, owner: pi, heroIdx: gariusHeroIdx };

      // (1) Sacrifice the original Creature — frees the slot for the
      //     placement and fires onCreatureSacrificed (sub-type of
      //     dying), then destroyCard fires onCreatureDeath.
      await engine.runHooks('onCreatureSacrificed', {
        creature: sacInst,
        cardName: sacInst.name,
        owner: sacInst.owner,
        heroIdx: sacInst.heroIdx,
        zoneSlot: sacInst.zoneSlot,
        source,
        _skipReactionCheck: true,
      });
      await engine.actionDestroyCard(source, sacInst, { fireCreatureDeath: true });

      // Verify the sacrifice actually emptied the slot. Absolute-
      // protection gates inside actionDestroyCard (immovable counter,
      // first-turn protection, gate shield, Monia-style beforeAffected
      // cancel, …) can silently no-op the destroy. Without this check
      // we'd pop a card from the deck below and try to place it on top
      // of a still-occupied slot — safePlaceInSupport would relocate
      // it to a different slot, violating the "same Support Zone"
      // contract. Bail cleanly: HOPT stays refunded, deck untouched.
      const slotArr = ps.supportZones?.[sacHeroIdx]?.[sacZoneSlot] || [];
      if (slotArr.length > 0) {
        engine.log('garius_reform_blocked', {
          player: ps.username, reason: 'sacrifice immune', card: sacName,
        });
        engine.sync();
        return false;
      }

      // (2) Pop the chosen card from the deck and reshuffle.
      const deckIdx = (ps.mainDeck || []).indexOf(repName);
      if (deckIdx < 0) {
        // Sacrifice already committed; deck shifted unexpectedly. Bail
        // cleanly — HOPT stays consumed (we did pay the sacrifice).
        engine.sync();
        return true;
      }
      ps.mainDeck.splice(deckIdx, 1);
      engine.shuffleDeck(pi);

      // (3) Place into the freshly emptied slot. `isPlacement: true`
      //     fires onPlay + onCardEnterZone in placement mode (skips
      //     host-incapacitation gates).
      const summonRes = await engine.summonCreatureWithHooks(
        repName, pi, sacHeroIdx, sacZoneSlot,
        { source: CARD_NAME, isPlacement: true },
      );
      if (!summonRes?.inst) {
        // Placement fizzled (beforeSummon refused etc.). Refund the
        // deck card so the player isn't out a card AND a HOPT.
        ps.mainDeck.push(repName);
        engine.shuffleDeck(pi);
        engine.sync();
        return true;
      }

      // (4) Haste lift — "may activate its active effect this turn."
      if (!summonRes.inst.counters) summonRes.inst.counters = {};
      summonRes.inst.counters._hasHaste = true;

      // (5) Reformer flair on Garius's hero zone — visual link
      //     between the activator and the placed Creature.
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle',
        owner: pi, heroIdx: gariusHeroIdx, zoneSlot: -1,
      });

      engine.log('garius_reform', {
        player: ps.username,
        sacrificed: sacName,
        placed: repName,
        slot: { heroIdx: sacHeroIdx, zoneSlot: sacZoneSlot },
      });

      engine.sync();
      return true;
    }
  },
};
