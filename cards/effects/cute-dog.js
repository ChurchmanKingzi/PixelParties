// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Dog"
//  Creature (Summoning Magic Lv 1, 20 HP — Cute archetype)
//
//  Two effects:
//
//  1. DISCARD-SUMMON — when this card is
//     discarded from your hand, you MAY
//     immediately summon it as an additional
//     Action. Hard cap: 1 Cute-Dog summon per
//     turn via this effect.
//
//  2. HOPT TUTOR (creature effect, while in
//     support) — discard up to 2 cards from
//     hand to search your deck for that many
//     Lv 3+ Spells OR Creatures WITH DIFFERENT
//     NAMES, reveal them, and add them to your
//     hand.
//
//  Wiring notes:
//    • The discard-summon listener is gated by
//      `ctx.card.zone === 'discard'` so only the
//      just-discarded copy prompts — copies in
//      support don't double-fire. Per-turn cap
//      is taken on prompt-SHOW (matches "may"
//      semantics: declining still spends the
//      offer).
//    • Tutor flow is click-to-discard direct on
//      the hand UI (matches Cute Hydra's pattern).
//      First iteration is mandatory; if a 2nd
//      discard would be useful (hand has another
//      card AND deck still has a tutor target), a
//      "Done" button appears so the player can
//      stop at 1 discard. After 2 discards the
//      loop ends. The deck-search gallery is
//      shown only AFTER the discard count is
//      finalized — total count = `discarded`.
//    • Multi-search uses cardGalleryMulti with
//      `selectCount: N` and `minSelect: N` so
//      the player MUST pick N distinct names
//      (cost is already paid).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME      = 'Cute Dog';
const MIN_TUTOR_LEVEL = 3;
const MAX_DISCARD_FOR_TUTOR = 2;

// ─── HELPERS ─────────────────────────────

/**
 * The tutor pool is "Lv 3+ Spell OR Creature". Tokens (subtype 'Token'
 * cards that ALSO list Creature in cardType) are excluded — they can't
 * meaningfully sit in a deck. Hand-only / non-deck cards are filtered
 * by the caller via the deck walk.
 */
function isTutorEligible(cd) {
  if (!cd) return false;
  if ((cd.level || 0) < MIN_TUTOR_LEVEL) return false;
  if (hasCardType(cd, 'Token')) return false;
  return hasCardType(cd, 'Spell') || hasCardType(cd, 'Creature');
}

function distinctTutorNames(engine, ps) {
  const cardDB = engine._getCardDB();
  const names = new Set();
  for (const cn of (ps.mainDeck || [])) {
    if (!isTutorEligible(cardDB[cn])) continue;
    names.add(cn);
  }
  return names;
}

function buildTutorGallery(engine, ps) {
  const cardDB = engine._getCardDB();
  const counts = {};
  for (const cn of (ps.mainDeck || [])) {
    if (!isTutorEligible(cardDB[cn])) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => {
      const cd = cardDB[name];
      // Two-key sort below pivots on cardType (Spells first, then
      // Creatures) so the gallery groups visually by type even though
      // they share the same level tier.
      return { name, source: 'deck', count, level: cd?.level || 0, cardType: cd?.cardType || '' };
    })
    .sort((a, b) =>
      a.level - b.level
      || a.cardType.localeCompare(b.cardType)
      || a.name.localeCompare(b.name)
    );
}

/**
 * List heroes that can host a fresh Cute Dog summon RIGHT NOW —
 * alive, not Frozen/Stunned, has a free Support slot, meets the
 * Lv1 Summoning Magic requirement (or the Cute-Princess-Mary
 * level bypass). Mirrors `heroCanHostDruidTutor` in
 * `elven-druid.js`.
 */
function getHostHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const cardDB = engine._getCardDB();
  const cd = cardDB[CARD_NAME];
  if (!cd) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (h.statuses?.frozen || h.statuses?.stunned) continue;
    const supZones = ps.supportZones?.[hi] || [];
    if (!supZones.some(slot => (slot || []).length === 0)) continue;
    if (!engine.heroMeetsLevelReq(pi, hi, cd)) continue;
    out.push(hi);
  }
  return out;
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  // 'support' → live HOPT tutor.  'discard' → just-discarded copy
  // listens for its own onDiscard event and fires the summon prompt.
  activeIn: ['support', 'discard'],

  // ── 2. HOPT TUTOR ──────────────────────────────────────────────

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if ((ps.hand || []).length === 0) return false;
    return distinctTutorNames(engine, ps).size > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    const distinctInitial = distinctTutorNames(engine, ps);
    if (distinctInitial.size === 0) return false;

    const handSize = (ps.hand || []).length;
    const maxN = Math.min(MAX_DISCARD_FOR_TUTOR, distinctInitial.size, handSize);
    if (maxN < 1) return false;

    // ── Step 1: click-to-discard loop ──
    // First iteration is mandatory (the player committed to the
    // effect by activating Cute Dog). Subsequent iterations show the
    // standard cancellable prompt with a "Done" label so the player
    // can stop at 1 discard. Loop bounds itself to maxN — already
    // factoring in distinct deck names + hand size — so "Done" never
    // appears when a 2nd discard wouldn't actually help.
    let discarded = 0;
    while (discarded < maxN && (ps.hand || []).length > 0) {
      // Re-check distinct names after the first discard — an onDiscard
      // hook from the just-discarded card could in theory mill / move
      // deck cards. If the deck no longer has any tutor target, no
      // point asking for another discard.
      if (discarded > 0 && distinctTutorNames(engine, ps).size === 0) break;

      const isMandatory = discarded === 0;
      const result = await engine.promptGeneric(pi, {
        type: isMandatory ? 'forceDiscard' : 'forceDiscardCancellable',
        title: CARD_NAME,
        description: isMandatory
          ? `Discard a card to search your deck for a Lv${MIN_TUTOR_LEVEL}+ Spell or Creature. (You may discard a 2nd to search a 2nd with a different name.)`
          : `Click another hand card to add a 2nd Lv${MIN_TUTOR_LEVEL}+ Spell or Creature with a different name, or click "Done" to stop.`,
        instruction: 'Click a card in your hand to discard it.',
        cancellable: !isMandatory,
        cancelLabel: 'Done',
      });

      if (result?.cancelled) break;
      if (!result || result.cardName == null) break;

      let actualIdx = result.handIndex;
      if (actualIdx == null || actualIdx < 0 || actualIdx >= ps.hand.length || ps.hand[actualIdx] !== result.cardName) {
        actualIdx = ps.hand.indexOf(result.cardName);
        if (actualIdx < 0) break;
      }

      ps.hand.splice(actualIdx, 1);
      ps.discardPile.push(result.cardName);
      engine.log('discard', { player: ps.username, card: result.cardName, source: CARD_NAME });
      await engine.runHooks('onDiscard', {
        playerIdx: pi,
        cardName: result.cardName,
        discardedCardName: result.cardName,
        _fromHand: true,
        _skipReactionCheck: true,
      });
      discarded++;
      engine.sync();
    }

    if (discarded === 0) return false; // mandatory first iteration didn't resolve

    // ── Step 2: build & show the gallery (cost is paid; commit) ──
    // Re-read state — onDiscard hooks may have shifted the deck.
    const gallery = buildTutorGallery(engine, ps);
    if (gallery.length === 0) return true; // Cost paid, no payoff. HOPT burned.
    const tutorCount = Math.min(discarded, gallery.length);

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: gallery,
      title: CARD_NAME,
      description: tutorCount === 1
        ? 'Choose a Lv3+ Spell or Creature to add to your hand.'
        : `Choose ${tutorCount} Lv3+ Spells or Creatures with different names to add to your hand.`,
      selectCount: tutorCount,
      minSelect: tutorCount,
      cancellable: false,
    });
    if (!picked || !Array.isArray(picked.selectedCards) || picked.selectedCards.length === 0) return true;

    // ── Step 3: add the tutored cards ONE AT A TIME ──
    // `actionAddCardFromDeckToHand` is the canonical "search-and-add"
    // helper (Magnetic Glove's pattern): it broadcasts the deck-search
    // flight animation, pauses, then fires the standard
    // `deckSearchReveal` confirmation modal to the opponent before
    // returning. `await`ing each call serialises the flow — card 1
    // flies in + reveals + opponent confirms, THEN card 2 flies in +
    // reveals — so it reads the same way Wheels' staggered draws do.
    const tutored = [];
    for (const name of picked.selectedCards) {
      const ok = await engine.actionAddCardFromDeckToHand(pi, name, {
        source: CARD_NAME,
        reveal: true,
      });
      if (ok) tutored.push(name);
    }
    if (tutored.length === 0) return true;
    engine.shuffleDeck(pi, 'main');

    engine.log('cute_dog_tutor', {
      player: ps.username,
      discarded,
      tutored,
    });
    engine.sync();
    return true;
  },

  // ── 1. DISCARD-SUMMON ──────────────────────────────────────────

  hooks: {
    onDiscard: async (ctx) => {
      // Only fire on the just-discarded copy itself — copies in
      // support shouldn't re-prompt for someone else's discard.
      if (!ctx._fromHand) return;
      if (ctx.discardedCardName !== CARD_NAME) return;
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx.card?.zone !== 'discard') return;

      const engine = ctx._engine;
      const pi     = ctx.cardOwner;
      const ps     = engine.gs.players[pi];
      if (!ps) return;

      // Per-turn cap: 1 Cute-Dog summon via this effect per turn.
      // Stamp on prompt-SHOW (declining still spends the offer; the
      // engine fires onDiscard once per discarded copy, so multiple
      // listeners in 'discard' would otherwise re-prompt).
      const turn = engine.gs.turn || 0;
      if (ps._cuteDogDiscardSummonTurn !== turn) {
        ps._cuteDogDiscardSummonTurn = turn;
        ps._cuteDogDiscardSummonUsed = false;
      }
      if (ps._cuteDogDiscardSummonUsed) return;

      // Need a hero that can host the summon.
      const hosts = getHostHeroes(engine, pi);
      if (hosts.length === 0) return;

      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `Immediately summon ${CARD_NAME} as an additional Action?`,
        confirmLabel: '🐶 Summon!',
        cancelLabel: 'No',
        cancellable: true,
      });
      // Stamp regardless of accept/decline — the offer counts as the
      // turn's use of this effect.
      ps._cuteDogDiscardSummonUsed = true;
      if (!confirmed) return;

      // ── Pick destination zone ──
      const zones = [];
      for (const hi of hosts) {
        const sup = ps.supportZones?.[hi] || [];
        for (let s = 0; s < 3; s++) {
          if ((sup[s] || []).length === 0) {
            zones.push({ heroIdx: hi, slotIdx: s, label: `${ps.heroes[hi].name} — Support ${s + 1}` });
          }
        }
      }
      if (zones.length === 0) return;

      let chosen;
      if (zones.length === 1) {
        chosen = zones[0];
      } else {
        const picked = await engine.promptGeneric(pi, {
          type: 'zonePick',
          zones,
          title: CARD_NAME,
          description: `Choose a Support Zone to summon ${CARD_NAME} into.`,
          cancellable: true,
        });
        if (!picked || picked.cancelled) return;
        chosen = zones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx) || zones[0];
      }

      // ── Pop one copy from discard pile ──
      const dpIdx = (ps.discardPile || []).indexOf(CARD_NAME);
      if (dpIdx < 0) return; // Got moved between prompt and now (rare).
      ps.discardPile.splice(dpIdx, 1);

      // Untrack the orphaned instance (this listener's own card).
      // Without this, the dead instance lingers in cardInstances at
      // zone='discard' but absent from the pile array.
      const oldInst = ctx.card;
      if (oldInst && oldInst.zone === 'discard') {
        engine._untrackCard(oldInst.id);
      }

      // ── Summon with full hooks ──
      await engine.summonCreatureWithHooks(
        CARD_NAME, pi, chosen.heroIdx, chosen.slotIdx,
        { source: CARD_NAME }
      );

      engine.log('cute_dog_discard_summon', {
        player: ps.username,
        heroIdx: chosen.heroIdx,
        zoneSlot: chosen.slotIdx,
      });
      engine.sync();
    },
  },
};
