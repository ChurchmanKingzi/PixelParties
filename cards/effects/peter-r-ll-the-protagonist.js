// ═══════════════════════════════════════════
//  CARD EFFECT: "Peter Röll, the Protagonist"
//  Hero — 400 HP, 90 ATK (Terror + Training)
//
//  ① Deck-building rule (handled in app-shared.jsx
//    `MULTI_TEAM_HEROES` set + canAddCard hero
//    branch): any number of copies allowed in the
//    Starting Heroes section.
//  ② Trigger: Whenever a target this Peter's
//    controller controls is defeated (hero KO or
//    creature death), the controller may attach
//    an Ability from their hand or deck to THIS
//    Peter Röll as an additional attachment.
//    "Additional" → bypasses the once-per-turn
//    `abilityGivenThisTurn` lock.
//
//  Multiple Peter Rölls each fire independently,
//  in turn — each gets its own attach prompt for
//  the same defeat event.
//  Skips when the defeated target IS this Peter
//  (he's dead, can't attach to a dead hero).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Peter Röll, the Protagonist';

/** Pick the zone slot the tutored ability will land in. Mirrors Alex's helper. */
function findTargetZone(abZones, cardName) {
  const script = loadCardEffect(cardName);
  if (script?.customPlacement) {
    for (let z = 0; z < 3; z++) {
      if (script.customPlacement.canPlace(abZones[z] || [])) return z;
    }
    return -1;
  }
  // Stack onto an existing same-name slot (< 3 stacked) first ...
  for (let z = 0; z < 3; z++) {
    const slot = abZones[z] || [];
    if (slot.length > 0 && slot[0] === cardName && slot.length < 3) return z;
  }
  // ... else first empty slot.
  for (let z = 0; z < 3; z++) {
    if ((abZones[z] || []).length === 0) return z;
  }
  return -1;
}

/** True if `hero` is currently controlled by `controllerIdx` (own or charmed). */
function isHeroControlledBy(engine, hero, controllerIdx) {
  if (!hero) return false;
  if (hero.charmedBy != null) return hero.charmedBy === controllerIdx;
  return (engine.gs.players[controllerIdx]?.heroes || []).includes(hero);
}

/**
 * Core: offer to attach an Ability from hand or deck to THIS Peter Röll.
 * No-op (silent fizzle) when there's nothing valid to attach or this
 * Peter is dead.
 */
async function offerAttach(ctx) {
  const peter = ctx.attachedHero;
  if (!peter?.name || peter.hp <= 0) return;

  const engine = ctx._engine;
  const pi = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const ps = engine.gs.players[pi];
  if (!ps) return;

  const cardDB = engine._getCardDB();

  // Build deduplicated gallery: every Ability in hand OR deck whose
  // attachment to THIS Peter is currently legal. Per-name de-duped per
  // source so the gallery doesn't show "Fighting (deck) ×3" alongside
  // "Fighting (hand) ×2" as separate entries — a single (name, source)
  // pair is enough for the picker.
  const seen = new Set();
  const gallery = [];
  const considerCard = (name, source) => {
    const key = `${source}::${name}`;
    if (seen.has(key)) return;
    const cd = cardDB[name];
    if (!cd || !hasCardType(cd, 'Ability')) return;
    if (!engine.canAttachAbilityToHero(pi, name, heroIdx)) return;
    seen.add(key);
    gallery.push({ name, source });
  };
  for (const name of (ps.hand || [])) considerCard(name, 'hand');
  for (const name of (ps.mainDeck || [])) considerCard(name, 'deck');
  if (gallery.length === 0) return;

  // Sort: by name, hand-source first within same name (subtle UX —
  // hand attaches keep options open longer than deck attaches).
  gallery.sort((a, b) => {
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.source === 'hand' ? -1 : 1;
  });

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Attach an Ability from your hand or deck to ${peter.name} as an additional attachment.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return;

  const chosenAbility = picked.cardName;
  const chosenSource = picked.source === 'hand' ? 'hand' : 'deck';

  // Re-verify legality (state may have shifted while the prompt was open).
  if (!engine.canAttachAbilityToHero(pi, chosenAbility, heroIdx)) return;
  if (chosenSource === 'hand') {
    if ((ps.hand || []).indexOf(chosenAbility) < 0) return;
  } else {
    if ((ps.mainDeck || []).indexOf(chosenAbility) < 0) return;
  }

  // Hand-sourced attaches funnel through the canonical helper; deck-
  // sourced are inlined the same way Alex does (no hand path in the
  // helper). Both branches skip the once-per-turn lock — "additional
  // attachment" per card text.
  if (chosenSource === 'hand') {
    await engine.attachAbilityFromHand(pi, chosenAbility, heroIdx, {
      skipAbilityGivenCheck: true,
    });
  } else {
    const deckIdx = ps.mainDeck.indexOf(chosenAbility);
    if (deckIdx < 0) return;
    ps.mainDeck.splice(deckIdx, 1);

    const abZones = ps.abilityZones[heroIdx] || [[], [], []];
    ps.abilityZones[heroIdx] = abZones;
    const targetZone = findTargetZone(abZones, chosenAbility);
    if (targetZone < 0) {
      // Race: zone filled between the gate check and now. Restore.
      ps.mainDeck.push(chosenAbility);
      engine.shuffleDeck(pi, 'main');
      return;
    }
    if (!abZones[targetZone]) abZones[targetZone] = [];
    abZones[targetZone].push(chosenAbility);

    const inst = engine._trackCard(chosenAbility, pi, 'ability', heroIdx, targetZone);
    engine._broadcastEvent('deck_search_add', { cardName: chosenAbility, playerIdx: pi });

    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: chosenAbility,
      zone: 'ability', heroIdx, _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'ability', toHeroIdx: heroIdx,
      _skipReactionCheck: true,
    });

    engine.shuffleDeck(pi, 'main');
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenAbility,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });
  }

  engine.log('peter_roll_attach', {
    player: ps.username,
    ability: chosenAbility,
    source: chosenSource,
  });

  engine._broadcastEvent('ability_activated', {
    owner: pi, heroIdx, zoneIdx: -1, abilityName: chosenAbility,
  });

  engine.sync();
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    // Fires for EVERY hero KO globally — gate on "Peter's controller
    // controls the defeated hero, and that hero isn't this Peter."
    onHeroKO: async (ctx) => {
      const koHero = ctx.hero;
      if (!koHero) return;
      // Skip Peter's own KO — peter.hp <= 0 short-circuits offerAttach,
      // but we still want to skip even when the prompt would fizzle, so
      // there's no spurious "trigger fired but found nothing" log noise.
      if (koHero === ctx.attachedHero) return;
      const engine = ctx._engine;
      if (!isHeroControlledBy(engine, koHero, ctx.cardOwner)) return;
      await offerAttach(ctx);
    },

    // Fires for EVERY creature death globally — gate on "creature was
    // controlled by Peter's controller at time of death." Use the
    // engine-supplied `controller` field (added to deathInfo) so a
    // cross-side-placed Creature (Chilly Wizard given to opp) is
    // attributed to its CURRENT controller, not its original owner.
    // Falls back to owner for any death payload that pre-dates the
    // controller field.
    onCreatureDeath: async (ctx) => {
      const creature = ctx.creature;
      if (!creature) return;
      const effectiveOwner = creature.controller ?? creature.owner;
      if (effectiveOwner !== ctx.cardOwner) return;
      await offerAttach(ctx);
    },
  },
};
