// ═══════════════════════════════════════════
//  CARD EFFECT: "Hive's Crown"
//  Artifact (Normal, Cost 4, Sparkfly)
//
//  Sacrifice a "Sparkfly" Creature you control (NOT "Sparkfly Queen")
//  to play this card. Choose a "Sparkfly Queen" from your hand and
//  place it into the same Support Zone as the sacrificed Creature.
//  If the Creature you sacrificed wasn't summoned this turn, you may
//  summon a "Sparkfly Queen" from your deck instead.
//
//  Whichever non-Queen Sparkfly is sacrificed permanently grants its
//  "When sacrificed to summon Sparkfly Queen, it gains this effect:"
//  rider to the placed Queen — wired through `grantInheritedAbility`
//  in `_sparkfly-shared.js`.
//
//  Source semantics for the Queen pull:
//    • Hand is always eligible if a Queen is in hand.
//    • Deck is eligible only if a Queen is in deck AND the
//      sacrificed creature wasn't summoned this turn.
//    • If both are eligible, the player picks via an option modal.
//    • If only one is eligible, that source is used implicitly.
// ═══════════════════════════════════════════

const { HOOKS } = require('./_hooks');
const {
  QUEEN_NAME,
  findControlledQueen,
  findSacrificeCandidates,
  grantInheritedAbility,
} = require('./_sparkfly-shared');

const CARD_NAME = "Hive's Crown";

/**
 * Per-candidate Queen-source eligibility.
 * Hand is always available when there's a Queen in hand. Deck is
 * available only when there's a Queen in deck AND the candidate
 * creature wasn't summoned this turn.
 */
function queenSourcesFor(gs, ps, candidateInst) {
  const inHand = (ps?.hand || []).includes(QUEEN_NAME);
  const inDeck = (ps?.mainDeck || []).includes(QUEEN_NAME);
  const wasSummonedThisTurn = candidateInst?.turnPlayed === (gs.turn || 0);
  return {
    hand: inHand,
    deck: inDeck && !wasSummonedThisTurn,
  };
}

module.exports = {
  isTargetingArtifact: true,
  deferBroadcast: true,

  /**
   * CPU helpers — Hive's Crown surfaces two prompts:
   *   • 'target' — pick which Sparkfly to sacrifice. Prefer Architect
   *     (its gift = draw to opp's hand size, generally strong) >
   *     Worker (steal-on-summon-already-fired) > Attendant (its gift
   *     duplicates the live aura). Within ties, prefer the creature
   *     with the LOWEST current HP so we don't trash a near-full unit.
   *   • 'generic' optionPicker (hand-vs-deck) — prefer DECK if available
   *     (drawing the Queen out of the deck thins it; the hand Queen
   *     remains tutorable). Default brain picks first option ('hand'),
   *     which is fine but not optimal.
   */
  cpuResponse(engine, kind, promptData) {
    if (kind === 'target') {
      const { validTargets, config } = promptData || {};
      if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
      // Only intercept when the targeting belongs to Hive's Crown.
      if (!config?.description || !config.description.includes('"Sparkfly"')) return undefined;
      const PRIORITY = {
        'Sparkfly Architect': 3,
        'Sparkfly Worker':    2,
        'Sparkfly Attendant': 1,
      };
      let best = null;
      let bestScore = -Infinity;
      for (const t of validTargets) {
        const score = (PRIORITY[t.cardName] || 0) * 1000
          + (1000 - ((t._cardInstance?.counters?.currentHp) || 0));
        if (score > bestScore) { bestScore = score; best = t; }
      }
      return best ? [best.id] : undefined;
    }
    if (kind === 'generic' && promptData?.type === 'optionPicker'
        && promptData.title === CARD_NAME) {
      const options = promptData.options || [];
      const deckOpt = options.find(o => o.id === 'deck');
      if (deckOpt) return { optionId: 'deck' };
      return undefined;
    }
    return undefined;
  },

  canActivate(gs, pi) {
    return this.getValidTargets(gs, pi, gs._engineRef || null).length > 0;
  },

  /**
   * Targeting picks the sacrifice. Filter to candidates that can supply
   * a Queen from at least one viable pile under the current rules.
   *
   * `getValidTargets` is invoked by both the artifact targeting flow
   * (engine handle present) and the canActivate gate (engine handle
   * may be null on some call sites). When engine is null we can't
   * inspect live `cardInstances` for `turnPlayed`, so we fall back to
   * a permissive check (treat every candidate as "summoned this turn"
   * → only the hand path). The targeting flow will run with the engine
   * present and produce the precise list.
   */
  getValidTargets(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return [];
    if (!engine) {
      // Permissive fallback: as long as a Queen is in hand and there's
      // some non-Queen Sparkfly on the board, declare playable.
      const queenInHand = (ps.hand || []).includes(QUEEN_NAME);
      if (!queenInHand) return [];
      // Block when a Queen is already on board.
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        for (let zi = 0; zi < (ps.supportZones?.[hi] || []).length; zi++) {
          if (((ps.supportZones[hi] || [])[zi] || [])[0] === QUEEN_NAME) return [];
        }
      }
      const candNames = ['Sparkfly Architect', 'Sparkfly Attendant', 'Sparkfly Worker'];
      const out = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        for (let zi = 0; zi < (ps.supportZones?.[hi] || []).length; zi++) {
          const slot = (ps.supportZones[hi] || [])[zi] || [];
          if (slot.length === 0) continue;
          if (!candNames.includes(slot[0])) continue;
          out.push({
            id: `equip-${pi}-${hi}-${zi}`,
            type: 'equip',
            owner: pi, heroIdx: hi, slotIdx: zi,
            cardName: slot[0],
          });
        }
      }
      return out;
    }

    if (findControlledQueen(engine, pi)) return [];

    const queenInHand = (ps.hand || []).includes(QUEEN_NAME);
    const queenInDeck = (ps.mainDeck || []).includes(QUEEN_NAME);
    if (!queenInHand && !queenInDeck) return [];

    const candidates = findSacrificeCandidates(engine, pi);
    const out = [];
    for (const inst of candidates) {
      const sources = queenSourcesFor(gs, ps, inst);
      if (!sources.hand && !sources.deck) continue;
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    }
    return out;
  },

  targetingConfig: {
    description: 'Sacrifice a "Sparkfly" Creature (not "Sparkfly Queen") to summon "Sparkfly Queen" in its Support Zone.',
    confirmLabel: '👑 Crown!',
    confirmClass: 'btn-warning',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
    // Sacrifice flavor — repaints eligible Sparkflies with the red
    // sacrifice glow. This artifact's targeting flow doesn't route
    // through engine.resolveSacrificeCost (which auto-applies the
    // flag), so it's set explicitly here.
    redSelect: true,
  },

  validateSelection(selectedIds) {
    return selectedIds.length === 1;
  },

  animationType: 'none',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const sel = (validTargets || []).find(t => t.id === selectedIds[0]);
    let sacInst = sel?._cardInstance;
    // The targeting flow sometimes hands back targets without
    // _cardInstance attached if the artifact reopens after a cancel —
    // re-resolve from coordinates as a safety net.
    if (!sacInst && sel) {
      sacInst = engine.cardInstances.find(c =>
        c.zone === 'support'
        && c.owner === sel.owner
        && c.heroIdx === sel.heroIdx
        && c.zoneSlot === sel.slotIdx,
      );
    }
    if (!sacInst) return { cancelled: true };

    // Re-validate Queen sources against live state — the player could
    // have lost their hand Queen between targeting and resolve via a
    // chained reaction.
    const sources = queenSourcesFor(gs, ps, sacInst);
    if (!sources.hand && !sources.deck) {
      engine.log('hives_crown_fizzle', {
        player: ps.username,
        reason: 'no_queen_source',
      });
      return { cancelled: true };
    }

    // ── Step 1: pick the Queen source (hand vs deck). ──
    let queenSource;
    if (sources.hand && sources.deck) {
      const choice = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Bring "Sparkfly Queen" from where?',
        options: [
          { id: 'hand', label: '✋  From your hand' },
          { id: 'deck', label: '📚  From your deck' },
        ],
        cancellable: false,
      });
      queenSource = choice?.optionId === 'deck' ? 'deck' : 'hand';
    } else {
      queenSource = sources.hand ? 'hand' : 'deck';
    }

    // Reveal Hive's Crown to both sides now that the player has committed.
    engine._broadcastEvent('card_reveal', { cardName: CARD_NAME });
    delete engine.gs._pendingCardReveal;
    await engine._delay(300);

    // ── Step 2: sacrifice the chosen Sparkfly creature. ──
    const sacHeroIdx  = sacInst.heroIdx;
    const sacZoneSlot = sacInst.zoneSlot;
    const sacName     = sacInst.name;

    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice',
      owner: sacInst.owner,
      heroIdx: sacInst.heroIdx,
      zoneSlot: sacInst.zoneSlot,
    });
    await engine._delay(500);

    await engine.runHooks(HOOKS.ON_CREATURE_SACRIFICED, {
      creature: sacInst,
      cardName: sacInst.name,
      owner: sacInst.owner,
      heroIdx: sacInst.heroIdx,
      zoneSlot: sacInst.zoneSlot,
      source: { name: CARD_NAME, owner: pi, heroIdx: sacInst.heroIdx },
      _skipReactionCheck: true,
    });
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: sacInst.heroIdx },
      sacInst,
    );

    // ── Step 3: pull the Queen from the chosen pile. ──
    if (queenSource === 'hand') {
      const handIdx = (ps.hand || []).indexOf(QUEEN_NAME);
      if (handIdx < 0) {
        engine.log('hives_crown_fizzle', { player: ps.username, reason: 'queen_left_hand' });
        return { cancelled: true };
      }
      ps.hand.splice(handIdx, 1);
      // Untrack the matching hand instance so the support track is clean
      // (mirrors divine-gift-of-the-deepsea's hand-pull pattern).
      const handInst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === QUEEN_NAME,
      );
      if (handInst) engine._untrackCard(handInst.id);
    } else {
      const deckIdx = (ps.mainDeck || []).indexOf(QUEEN_NAME);
      if (deckIdx < 0) {
        engine.log('hives_crown_fizzle', { player: ps.username, reason: 'queen_left_deck' });
        return { cancelled: true };
      }
      ps.mainDeck.splice(deckIdx, 1);
      // Reveal to opponent — standard deck-search reveal etiquette.
      const oi = pi === 0 ? 1 : 0;
      engine._broadcastEvent('card_reveal', { cardName: QUEEN_NAME });
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: QUEEN_NAME,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });
      engine.shuffleDeck(pi, 'main');
    }

    // ── Step 4: place the Queen in the freshly-vacated slot. ──
    // `source: 'deck'` is a sentinel that bypasses actionPlaceCreature's
    // hand/discard splice branches — both piles have already been
    // serviced above, so we just want the placement + tracking + hooks.
    // Stamping `gs._hivesCrownActive = true` while the placement fires
    // its onPlay/onCardEnterZone hooks tells the Queen's `canSummon`
    // gate to allow this otherwise-blocked summon.
    gs._hivesCrownActive = true;
    let placeRes;
    try {
      placeRes = await engine.actionPlaceCreature(QUEEN_NAME, pi, sacHeroIdx, sacZoneSlot, {
        source: 'deck',
        sourceName: CARD_NAME,
        countAsSummon: true,
        animationType: 'summon',
        fireHooks: true,
      });
    } finally {
      delete gs._hivesCrownActive;
    }
    if (!placeRes?.inst) {
      engine.log('hives_crown_fizzle', { player: ps.username, reason: 'placement_failed' });
      return { cancelled: true };
    }

    // ── Step 5: stamp the inherited gift on the Queen. ──
    grantInheritedAbility(placeRes.inst, sacName);

    engine.log('hives_crown_summon', {
      player: ps.username,
      sacrificed: sacName,
      queenFrom: queenSource,
      heroIdx: sacHeroIdx,
      zoneSlot: sacZoneSlot,
    });
    engine.sync();
    return true;
  },
};
