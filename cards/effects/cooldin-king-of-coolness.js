// ═══════════════════════════════════════════
//  CARD EFFECT: "Cooldin, King of Coolness"
//  Hero — Activated effect, once per turn.
//
//  Choose a level 3 or lower Area (Spell OR Attack)
//  from your HAND or DECK and play it as an additional
//  Action, regardless of its level. Immediately end
//  your turn afterwards.
//
//  Flow:
//    1. Build the eligible pool — all Area-subtype
//       Spells AND Area Attacks (e.g. Blood Rock) with
//       level ≤ 3 in hand and deck.
//    2. Gallery prompt: player picks one (with source
//       badge so "from deck" is clear).
//    3. If the pick came from the deck, splice it out
//       and shuffle the deck (search-from-deck ritual).
//    4. Drive the Area play directly: reaction chain
//       window → onPlay → placeArea. The level gate is
//       bypassed because we call executeCardWithChain /
//       runHooks directly rather than going through
//       validateActionPlay, which is where the school
//       / level check lives.
//    5. On successful play (or negation — the hero
//       effect was "used"), immediately end the turn
//       via advanceToPhase(..., END).
//    6. Cancelled before step 3 → return false so the
//       hero-effect HOPT is NOT consumed (Cooldin can
//       try again later if they wanted to back out).
//
//  Animation: `cooldin_terraform` — a reality-warping
//  terraforming wave sweeps the entire battlefield as
//  Cooldin reshapes the world. Fires once before the
//  Area descends. The standard `area_descend` animation
//  still plays on top.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cooldin, King of Coolness';

/** Collect eligible Areas (lv ≤ 3) from a source array. Preserves duplicates. */
function collectAreasFromSource(names, cardDB, source, engine, pi) {
  const out = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const cd = cardDB[name];
    if (!cd) continue;
    // Areas come in BOTH subtypes: Area Spells AND Area Attacks
    // (e.g. Blood Rock). Cooldin tutors either.
    if (cd.cardType !== 'Spell' && cd.cardType !== 'Attack') continue;
    if ((cd.subtype || '').toLowerCase() !== 'area') continue;
    // Effective level (honours Cataclysm's `reduceCardLevel` for Area
    // Spells in play, Mana Absorbing Crystal +1 in hand, etc.).
    const lvl = engine?.effectiveCardLevel
      ? engine.effectiveCardLevel(cd, pi)
      : (cd.level || 0);
    if (lvl > 3) continue;
    out.push({ name, source, sourceIdx: i });
  }
  return out;
}

/**
 * Drive the Area play pipeline for a pre-chosen card. Replicates the
 * essential parts of the server's play_spell handler — reaction chain
 * window + onPlay + placement cleanup — without the level/school gate
 * (which is the whole point of this effect).
 */
async function playCooldinArea(engine, pi, heroIdx, cardName, fromDeck) {
  const gs = engine.gs;
  const ps = gs.players[pi];

  // Step A: Source handling. If the Area was picked from the deck, pull
  // it out and drop it onto the end of the hand, then shuffle the deck
  // (search-from-deck convention). Pull AFTER we've committed, so a
  // cancelled prompt earlier doesn't leak. Routed through the canonical
  // helper so ON_CARD_ADDED_TO_HAND fires (Cosmic Depths Analyzer /
  // Gatherer key off this hook for any opp search effect, including
  // Cooldin's Area-tutor flow). `reveal: false` skips the helper's
  // reveal modal — the Area is about to land on the board anyway, so
  // the modal would just delay the play with no extra disclosure.
  //
  // `_bypassHandLock`: Cooldin tutors the Area deck→hand→board as ONE
  // motion — the hand is only a 1-tick staging step (spliced + played on
  // the very next lines). The generic hand-lock exists to stop draws /
  // hand-additions the player KEEPS; it must not block Cooldin's
  // terraform, whose text is "activate a lv≤3 Area Attack/Spell from
  // your hand or DECK". Same bypass precedent as Kassaran's draw clause.
  // Without it, a player that hand-locked itself earlier in the turn
  // (Kazena, etc.) could no longer use Cooldin (the CPU "Blood Rock
  // does nothing" bug).
  if (fromDeck) {
    if (ps.mainDeck.indexOf(cardName) < 0) return false;
    const ok = await engine.actionAddCardFromDeckToHand(pi, cardName, {
      source: 'Cooldin, King of Coolness',
      reveal: false,
      shuffle: true,
      _bypassHandLock: true,
    });
    if (!ok) return false;
  }

  const handIndex = ps.hand.lastIndexOf(cardName);
  if (handIndex < 0) return false;

  // Real card type — Area Attacks (Blood Rock) must chain as 'Attack'
  // so reaction cards that gate on Spell-vs-Attack and the chain UI
  // read correctly. (Placement still works either way: every Area's
  // onPlay routes through placeArea, which sets _spellPlacedOnBoard.)
  const _cd = engine._getCardDB()[cardName];
  const areaCardType = _cd?.cardType === 'Attack' ? 'Attack' : 'Spell';

  // Step B: Reaction chain. Gives the opponent a window to negate (The
  // Master's Plan, Anti Magic Shield, etc.). If negated, the Area is
  // discarded — Cooldin's hero effect still counts as "used".
  const chainResult = await engine.executeCardWithChain({
    cardName, owner: pi, heroIdx, cardType: areaCardType, goldCost: 0,
  });
  if (chainResult.negated) {
    ps.hand.splice(handIndex, 1);
    ps.discardPile.push(cardName);
    engine.log('cooldin_area_negated', { player: ps.username, card: cardName });
    return true;
  }

  // Step C: Splice from hand + track a fresh in-hand instance so onPlay
  // sees it exactly the way the normal spell-play handler would.
  ps.hand.splice(handIndex, 1);
  const inst = engine._trackCard(cardName, pi, 'hand', heroIdx, -1);

  // _immediateActionContext lets downstream hooks know this was driven
  // by a hero effect rather than a normal action, mirroring what
  // performImmediateAction does. Some cards (e.g. Bartas second-cast
  // tracking) look at this flag.
  gs._immediateActionContext = true;

  try {
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName, zone: 'hand', heroIdx,
      _skipReactionCheck: true,
    });
  } finally {
    delete gs._immediateActionContext;
  }

  // Step D: did the Area actually land on the board?
  //
  // We must NOT rely solely on `gs._spellPlacedOnBoard`: `placeArea`
  // only sets that flag when `ps._resolvingCard` is unset OR equals
  // the area's name. Cooldin sub-plays the Area via a hero effect
  // (doActivateHeroEffect never sets `_resolvingCard`), so when some
  // unrelated `_resolvingCard` is lingering the flag is never set even
  // though `placeArea` DID move the card to the Area zone — Cooldin
  // would then wrongly discard a successfully-placed Area (Blood Rock
  // "vanishing", for human AND CPU). The authoritative signal is the
  // instance itself: `placeArea` sets `inst.zone='area'` and pushes
  // the name into `gs.areaZones[pi]`. Treat EITHER as "placed".
  const placedOnBoard = !!gs._spellPlacedOnBoard
    || inst.zone === 'area'
    || (gs.areaZones?.[pi] || []).includes(cardName);
  if (!placedOnBoard) {
    ps.discardPile.push(cardName);
    engine._untrackCard(inst.id);
    engine.log('cooldin_area_fizzle', { player: ps.username, card: cardName });
  }
  delete gs._spellPlacedOnBoard;
  delete gs._spellCancelled;

  return true;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // CPU threat assessment: plays an extra Area per activation (≈1 card of
  // value). Doesn't cost a card from hand but ends the turn early — the
  // trade-off isn't modeled here, just the raw tempo.
  supportYield() {
    return { drawsPerTurn: 1 };
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    // Can only cast an Area if the caster's own Area zone is empty
    // (generic Area rule, enforced by validateActionPlay). We enforce it
    // here too so Cooldin's button grays out when the zone is occupied.
    if ((gs.areaZones?.[pi] || []).length > 0) return false;
    // Reality Crack's turn-long area lock also blocks Cooldin.
    if (ps._cantPlayAreaThisTurn === gs.turn) return false;

    const cardDB = engine._getCardDB();
    const fromHand = collectAreasFromSource(ps.hand || [], cardDB, 'hand', engine, pi);
    if (fromHand.length > 0) return true;
    const fromDeck = collectAreasFromSource(ps.mainDeck || [], cardDB, 'deck', engine, pi);
    return fromDeck.length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cardDB = engine._getCardDB();
    const fromHand = collectAreasFromSource(ps.hand || [], cardDB, 'hand', engine, pi);
    const fromDeck = collectAreasFromSource(ps.mainDeck || [], cardDB, 'deck', engine, pi);
    const all = [...fromHand, ...fromDeck];
    if (all.length === 0) return false;

    // Build the gallery. Each row distinguishes source so the player
    // sees which Areas are public (hand) vs. searched (deck). We don't
    // dedupe by name — multiple copies in the deck are legitimately
    // different draws once chosen.
    const galleryCards = all.map(entry => ({
      name: entry.name,
      source: entry.source, // 'hand' or 'deck'
    }));

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: 'Choose a level 3 or lower Area from your hand or deck to reshape the world. Your turn ends afterwards.',
      confirmLabel: '🌍 Terraform!',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) {
      // Cancelled before commitment — don't consume HOPT.
      return false;
    }

    const picked = all.find(a => a.name === result.cardName && a.source === result.source)
      || all.find(a => a.name === result.cardName);
    if (!picked) return false;

    // Cooldin's resolution is a deliberate, bounded ~2.4s sequence
    // (terraform wave 1200ms + Area chain ~950ms + onPlay/placeArea).
    // On the CPU's own turn that wall-clock can push past the live-
    // turn deadline; the runHooks deadline check would then throw
    // mid-placeArea and Cooldin would discard the Area instead of
    // placing it (Blood Rock vanishing). Grant the budget back — the
    // turn ends immediately after this anyway.
    engine.extendCpuTurnDeadline?.(8000);

    // ── Battlefield-wide terraforming wave — Cooldin reshapes reality ──
    engine._broadcastEvent('cooldin_terraform', {
      owner: pi, heroIdx, cardName: picked.name,
    });
    await engine._delay(1200);

    // ── Play the Area ──
    const played = await playCooldinArea(engine, pi, heroIdx, picked.name, picked.source === 'deck');

    // ── End the turn, win or lose the reaction chain ──
    // advanceToPhase validates that MAIN1/ACTION/MAIN2 → END is a legal
    // transition and runs the END phase (status expiry, switchTurn, etc.).
    // If the game has already ended (e.g. negated effect killed a hero),
    // gs.result is set and advance is a no-op.
    //
    // CRITICAL: clear our own `_heroEffectInProgress` slot BEFORE
    // advancing into END. The server's doActivateHeroEffect set
    // `gs._heroEffectInProgress[`${pi}:${heroIdx}`] = true` before
    // invoking us and only clears it in its own `finally` (i.e. AFTER
    // we return). The END phase calls `_waitForPromptsToClear`, which
    // polls `_isMidPromptOrEffect` — and that helper treats ANY truthy
    // entry in `_heroEffectInProgress` as "still mid-effect". Without
    // clearing here, the END phase would spin for the full 10-minute
    // MAX_ITER waiting for Cooldin's own in-progress slot to clear,
    // which only happens AFTER advanceToPhase returns. Classic
    // deadlock — observed as the game freezing for ~10 minutes after
    // ANY Cooldin Area play, with any deck. Clearing here is safe:
    // the server's finally still runs (delete is idempotent), and no
    // further Cooldin-side work depends on the flag.
    if (gs._heroEffectInProgress) {
      delete gs._heroEffectInProgress[`${pi}:${heroIdx}`];
    }

    if (!gs.result) {
      const currentPhase = gs.currentPhase;
      if (currentPhase === 2 || currentPhase === 3 || currentPhase === 4) {
        await engine.advanceToPhase(pi, 5);
      }
    }

    engine.log('cooldin_terraform', {
      player: ps.username, card: picked.name, source: picked.source,
    });

    // Return true to consume HOPT regardless of play outcome — Cooldin's
    // effect "fired" the moment the player confirmed the pick.
    return played !== false;
  },
};
