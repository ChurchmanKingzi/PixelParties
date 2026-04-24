// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Starlet Megu"
//  Hero (400 HP, 40 ATK — Charme + Singing)
//
//  Activated Hero Effect (once per turn — HOPT
//  gate is handled server-side via the standard
//  `hero-effect:${name}:${pi}:${heroIdx}` key):
//
//    Discard ONE card from your hand, then
//    search your deck for any Ability, reveal
//    it to the opponent, and add it to your
//    hand. If the discarded card was itself an
//    Ability, you may then immediately attach
//    the searched Ability to one of your Heroes
//    as an ADDITIONAL attachment — bypassing the
//    target Hero's once-per-turn
//    `abilityGivenThisTurn` gate (same rule
//    Alex's tutor uses).
//
//  Flow:
//    1. `forceDiscardCancellable` prompt —
//       player picks the hand card to discard.
//       Cancel stops the effect before the HOPT
//       is burned (server's chain handler only
//       marks HOPT on non-cancelled resolutions).
//    2. Splice discard → discard pile, fire
//       `onDiscard` with `_skipReactionCheck` so
//       discard-triggered effects run but don't
//       open a reaction chain (matches Training).
//       Capture `discardedIsAbility` for step 5.
//    3. Build a gallery of every Ability name
//       still in the deck. Fizzle silently if
//       none — the discard is already paid; no
//       search can happen.
//    4. `cardGallery` (non-cancellable — the
//       discard cost is paid, we MUST find a
//       card). Splice from deck, shuffle, add
//       to hand, broadcast `deck_search_add`,
//       fire `deckSearchReveal` on the opponent.
//    5. If discarded was an Ability AND the
//       Ability we just searched can legally
//       attach to at least one live own Hero,
//       offer the attach via the generic
//       `abilityAttachTarget` prompt (Alex's
//       shared UI — eligible Heroes + their
//       Ability Zones light up, click to place).
//       Cancel leaves the searched Ability in
//       hand. Attach goes through
//       `attachAbilityFromHand` with
//       `skipAbilityGivenCheck: true` so the
//       target Hero's per-turn slot is
//       untouched.
//
//  "Any Hero" — unlike Alex's tutor which
//  excludes the triggering Hero, Megu's text
//  doesn't restrict the target, so attaching
//  onto Megu herself is legal.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cute Starlet Megu';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Activatable iff the player has at least one discardable card in hand
  // AND at least one Ability left in the deck (no point offering the
  // effect when the search has no possible target).
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const hero   = ctx.attachedHero;
    if (!hero?.name || hero.hp <= 0) return false;
    const ps = engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    if ((ps.hand || []).length === 0) return false;
    const cardDB = engine._getCardDB();
    for (const cn of (ps.mainDeck || [])) {
      const cd = cardDB[cn];
      if (cd && hasCardType(cd, 'Ability')) return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps      = gs.players[pi];
    const hero    = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if ((ps.hand || []).length === 0) return false;

    const cardDB = engine._getCardDB();

    // ── Step 1: pick the card to discard ──────────────────────────
    const discardRes = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      title: CARD_NAME,
      description: 'Discard a card to search your deck for an Ability.',
      cancellable: true,
    });
    if (!discardRes || discardRes.cancelled) return false;
    const { cardName: discardName, handIndex } = discardRes;
    if (discardName === undefined || handIndex === undefined) return false;
    if (handIndex < 0 || handIndex >= ps.hand.length || ps.hand[handIndex] !== discardName) return false;

    // ── Step 2: pay the discard ──────────────────────────────────
    const discardedCd = cardDB[discardName];
    const discardedIsAbility = !!(discardedCd && hasCardType(discardedCd, 'Ability'));

    ps.hand.splice(handIndex, 1);
    ps.discardPile.push(discardName);
    engine.log('discard', { player: ps.username, card: discardName, by: CARD_NAME });
    await engine.runHooks('onDiscard', {
      playerIdx: pi, cardName: discardName, _skipReactionCheck: true,
    });
    engine.sync();

    // ── Step 3: build the deck-Ability gallery ────────────────────
    // State may have shifted during the onDiscard hook (rare but
    // possible), so we re-read the deck here rather than caching.
    const countMap = {};
    for (const cn of (ps.mainDeck || [])) {
      const cd = cardDB[cn];
      if (!cd || !hasCardType(cd, 'Ability')) continue;
      countMap[cn] = (countMap[cn] || 0) + 1;
    }
    const gallery = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (gallery.length === 0) return true; // Cost paid, no payoff — HOPT burned.

    // ── Step 4: deck search → reveal → add to hand ────────────────
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose an Ability to add to your hand.',
      cancellable: false, // Discard already paid — commit.
    });
    if (!picked || !picked.cardName) return true;
    const chosenAbility = picked.cardName;
    const deckIdx = ps.mainDeck.indexOf(chosenAbility);
    if (deckIdx < 0) return true;
    ps.mainDeck.splice(deckIdx, 1);
    engine.shuffleDeck(pi, 'main');
    ps.hand.push(chosenAbility);

    engine._broadcastEvent('deck_search_add', { cardName: chosenAbility, playerIdx: pi });
    engine.log('megu_search', { player: ps.username, searched: chosenAbility, discarded: discardName });
    engine.sync();

    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenAbility,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    // ── Step 5: optional instant attach (only if discarded was Ability) ──
    if (!discardedIsAbility) return true;

    // Every live own Hero the searched Ability can legally attach to.
    const eligibleHeroes = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (engine.canAttachAbilityToHero(pi, chosenAbility, hi)) eligibleHeroes.push(hi);
    }
    if (eligibleHeroes.length === 0) return true;
    // The searched Ability must still be in hand (defensive guard).
    if (ps.hand.indexOf(chosenAbility) < 0) return true;

    const pickRes = await engine.promptGeneric(pi, {
      type: 'abilityAttachTarget',
      cardName: chosenAbility,
      eligibleHeroIdxs: eligibleHeroes,
      skipAbilityGiven: true,
      title: CARD_NAME,
      description: `Attach ${chosenAbility} to a Hero as an additional attachment (or cancel to keep it in hand).`,
      cancellable: true,
    });
    if (!pickRes || pickRes.cancelled) return true;
    if (typeof pickRes.heroIdx !== 'number' || !eligibleHeroes.includes(pickRes.heroIdx)) return true;
    const targetHeroIdx = pickRes.heroIdx;
    const explicitZone  = typeof pickRes.zoneSlot === 'number' ? pickRes.zoneSlot : -1;

    // attachAbilityFromHand handles: remove-from-hand, find-zone (stack
    // or first-empty, honouring `targetZoneSlot`), track the instance,
    // fire onPlay + onCardEnterZone. `skipAbilityGivenCheck` keeps the
    // target Hero's per-turn ability slot available — "additional
    // attachment" in card-text terms.
    const attachRes = await engine.attachAbilityFromHand(pi, chosenAbility, targetHeroIdx, {
      skipAbilityGivenCheck: true,
      targetZoneSlot: explicitZone >= 0 ? explicitZone : undefined,
    });
    if (!attachRes?.success) return true;
    engine.log('megu_instant_attach', {
      player: ps.username, ability: chosenAbility,
      to: ps.heroes[targetHeroIdx]?.name,
    });
    engine.sync();
    return true;
  },
};
