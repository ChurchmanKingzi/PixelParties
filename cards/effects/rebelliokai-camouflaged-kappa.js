// ═══════════════════════════════════════════
//  CARD EFFECT: "Rebelliokai Camouflaged Kappa"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Rebelliokai
//
//  Self-deletes when sent to discard from
//  outside hand or board.
//
//  Active effect (1×/turn): sacrifice this
//  Creature → search your deck for ANY card →
//  reveal it to your opponent → add it to your
//  hand → immediately discard it afterwards.
//
//  Net function: a sacrifice-fueled mill into
//  hand-then-discard. Feeds the discard pile
//  with a card of your choice. The post-search
//  discard is tagged with the standard
//  Rebelliokai source so Kind Kitsune (Phase 3)
//  and any future "discarded by a Rebelliokai
//  effect" listener fires off it. Backup Baku's
//  trigger also fires when the discarded card is
//  a Rebelliokai — making Kappa a clean engine
//  piece that can fuel Baku without a hand cost.
//
//  Wiring:
//    • `creatureEffect: true` — engine handles
//      per-instance HOPT, summoning sickness,
//      and Main-Phase gating automatically.
//    • Sacrifice mirrors Loyal Rottweiler:
//      `onCreatureSacrificed` hook → knife anim
//      → `actionDestroyCard` (fires
//      onCreatureDeath + discard-pile routing).
//    • Deck search uses the canonical
//      `actionAddCardFromDeckToHand` (auto-fires
//      `onCardAddedToHand` for Cosmic Depths
//      Analyzer / Gatherer + opp reveal).
//    • Discard step uses `actionDiscardHandCard`
//      with source = DISCARD_SOURCE_TAG.
// ═══════════════════════════════════════════

const { DISCARD_SOURCE_TAG } = require('./_rebelliokai-shared');

const CARD_NAME = 'Rebelliokai Camouflaged Kappa';

module.exports = {
  selfDeleteOnExternalDiscard: true,
  activeIn: ['support'],
  creatureEffect: true,

  cpuMeta: {
    // Sacrifices itself for an any-card deck-tutor + a fueled discard.
    // The tutor alone is ≈+15 hand-value; the discard is "free fuel"
    // for the rest of the archetype (extra different-name in pile,
    // plus any onDiscard chain — Baku, Kitsune). Net ≈+18 to owner
    // when she dies via her OWN sacrifice. We don't separately count
    // the chain bonuses — those propagate through the chainSource
    // declarations on the cards that do the chaining.
    onDeathBenefit: 18,
  },

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps     = engine.gs.players[ctx.cardOriginalOwner ?? ctx.cardOwner];
    if (!ps) return false;
    // No deck → can't search → no point activating (the kappa would
    // sacrifice for nothing, and the rule requires we add a card to
    // hand before the discard step). Bail before the cost is paid.
    if (!Array.isArray(ps.mainDeck) || ps.mainDeck.length === 0) return false;
    // Hand-lock gate — see actionAddCardFromDeckToHand. The deck pull
    // would silently fizzle and we'd waste the sacrifice.
    if (ps.handLocked) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOriginalOwner;
    const ps     = gs.players[pi];
    if (!ps) return false;

    const ownHeroIdx  = ctx.cardHeroIdx;
    const ownZoneSlot = ctx.card.zoneSlot;

    // ── Step 1: build deck gallery ──
    if ((ps.mainDeck || []).length === 0) return false;
    const counts = {};
    for (const cn of ps.mainDeck) counts[cn] = (counts[cn] || 0) + 1;
    const gallery = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (gallery.length === 0) return false;

    // Show gallery FIRST, before paying the sacrifice — the prompt is
    // cancellable, and a cancel here releases the HOPT (per the
    // engine's `creatureEffect` cancel-rollback contract: returning
    // false from onCreatureEffect un-marks the per-inst HOPT).
    const picked = await engine.promptGeneric(pi, {
      type:        'cardGallery',
      cards:       gallery,
      title:       CARD_NAME,
      description: 'Sacrifice this Creature to search your deck. The chosen card is revealed to your opponent and immediately discarded.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const searchedName = picked.cardName;

    // Defensive re-check — nothing should mutate the deck mid-prompt,
    // but a parallel reaction window could in theory.
    if (ps.mainDeck.indexOf(searchedName) < 0) return false;

    // ── Step 2: sacrifice the kappa ──
    // Fire onCreatureSacrificed first (matches Loyal Rottweiler's
    // contract and the standard sacrifice-cost pipeline) so listeners
    // see the kappa with its zone still intact.
    const sacrificed = ctx.card;
    await engine.runHooks('onCreatureSacrificed', {
      creature: sacrificed,
      cardName: sacrificed.name,
      owner:    sacrificed.owner,
      heroIdx:  sacrificed.heroIdx,
      zoneSlot: sacrificed.zoneSlot,
      source:   { name: CARD_NAME, owner: pi, heroIdx: ownHeroIdx },
      _skipReactionCheck: true,
    });

    // Knife-plunge animation on the kappa's slot — same FX shared
    // with Loyal Rottweiler's self-sacrifice.
    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice',
      owner: pi, heroIdx: ownHeroIdx, zoneSlot: ownZoneSlot,
    });
    await engine._delay(550);

    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: ownHeroIdx },
      sacrificed,
    );

    // ── Step 3: deck → hand (with reveal) ──
    if (ps.mainDeck.indexOf(searchedName) < 0) {
      // Some other effect pulled it during the sacrifice chain. Fizzle
      // gracefully — kappa is already gone, but we don't error.
      engine.sync();
      return true;
    }
    const ok = await engine.actionAddCardFromDeckToHand(pi, searchedName, {
      source:  CARD_NAME,
      reveal:  true,
      shuffle: true,
    });
    if (!ok) {
      engine.sync();
      return true;
    }

    // ── Step 4: immediate discard from hand ──
    // Source-tag the discard with DISCARD_SOURCE_TAG so any
    // archetype-aware onDiscard listener (Kind Kitsune in Phase 3,
    // future cards) can attribute it to Rebelliokai. Backup Baku's
    // trigger also fires here when `searchedName` is a Rebelliokai
    // Creature — which is the intended chain.
    await engine.actionDiscardHandCard(pi, searchedName, null, {
      source: DISCARD_SOURCE_TAG,
    });

    engine.log('rebelliokai_camouflaged_kappa', {
      player:   ps.username,
      searched: searchedName,
    });
    engine.sync();
    return true;
  },
};
