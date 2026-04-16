// ═══════════════════════════════════════════
//  CARD EFFECT: "Ska Harpyformer"
//  Creature (Summoning Magic Lv0)
//  Archetype: Harpyformers
//
//  ① First Creature of turn = additional Action.
//  ② On summon: may deal 50 damage to the Hero
//    this was summoned under to search the deck
//    for a "Performance" Ability, reveal and
//    add it to hand.
//  ③ Once per turn: discard a Performance Ability
//    from hand to attach any Ability from your
//    deck to a Hero you control.
// ═══════════════════════════════════════════

const { harpyformerInherentAction } = require('./_harpyformer-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

const CARD_NAME    = 'Ska Harpyformer';
const ABILITY_NAME = 'Performance';

module.exports = {
  inherentAction: harpyformerInherentAction,

  // ── On summon: optional 50-damage cost to search deck for Performance ─────
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!ps || !hero?.name || hero.hp <= 0) return;

      if (!(ps.mainDeck || []).includes(ABILITY_NAME)) return;

      // Offer the 50-damage trade
      const confirm = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Deal 50 damage to ${hero.name} to search your deck for a "${ABILITY_NAME}" Ability?`,
      });
      if (!confirm) return;

      // Deal 50 to the hosting hero
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);
      await ctx.dealDamage(hero, 50, 'other');

      // Only search if the hero survived
      if (hero.hp <= 0) return;
      await engine.searchDeckForNamedCard(pi, ABILITY_NAME, CARD_NAME);
    },
  },

  // ── Once-per-turn creature effect: attach ability from deck ───────────────
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).includes(ABILITY_NAME);
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Confirm discard of Performance
    const discardResult = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: [{ name: ABILITY_NAME, source: 'hand' }],
      title: CARD_NAME,
      description: `Discard "${ABILITY_NAME}" to attach any Ability from your deck to a Hero you control.`,
      confirmLabel: '🎸 Discard & Attach',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!discardResult || discardResult.cancelled) return false;

    const perfIdx = ps.hand.indexOf(ABILITY_NAME);
    if (perfIdx < 0) return false;
    ps.hand.splice(perfIdx, 1);
    ps.discardPile.push(ABILITY_NAME);
    engine.log('ska_discard', { player: ps.username, card: ABILITY_NAME });
    engine.sync();

    // Build list of living heroes that have room for at least one deck ability
    const cardDB = engine._getCardDB();
    const heroOptions = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;

      // Check there is at least one attachable ability in deck for this hero
      const hasDeckAbility = (ps.mainDeck || []).some(cn => {
        const cd = cardDB[cn];
        return cd && hasCardType(cd, 'Ability') && engine.canAttachAbilityToHero(pi, cn, hi);
      });
      if (!hasDeckAbility) continue;

      heroOptions.push({ id: String(hi), label: h.name, description: `Hero ${hi + 1}`, color: 'var(--accent)' });
    }

    if (heroOptions.length === 0) {
      // No valid hero/ability combinations — effect fizzles after discard
      engine.log('ska_no_targets', { player: ps.username });
      return true;
    }

    // If only one eligible hero, skip the picker
    let targetHeroIdx;
    if (heroOptions.length === 1) {
      targetHeroIdx = parseInt(heroOptions[0].id, 10);
    } else {
      const heroPick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Choose a Hero to attach an Ability to.',
        options: heroOptions,
        cancellable: false, // Performance already discarded
      });
      if (!heroPick || heroPick.cancelled) return true;
      targetHeroIdx = parseInt(heroPick.optionId, 10);
    }

    // Build deduplicated gallery of attachable abilities from deck for the chosen hero
    const countMap = {};
    for (const cn of (ps.mainDeck || [])) {
      const cd = cardDB[cn];
      if (!cd || !hasCardType(cd, 'Ability')) continue;
      if (!engine.canAttachAbilityToHero(pi, cn, targetHeroIdx)) continue;
      countMap[cn] = (countMap[cn] || 0) + 1;
    }
    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return true;

    const heroName = ps.heroes[targetHeroIdx]?.name || 'Hero';
    const abilityPick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: `Choose an Ability from your deck to attach to ${heroName}.`,
      cancellable: false,
    });
    if (!abilityPick || !abilityPick.cardName) return true;

    const chosenAbility = abilityPick.cardName;

    // Verify still in deck, move to hand temporarily, then attach via engine
    const deckIdx = ps.mainDeck.indexOf(chosenAbility);
    if (deckIdx < 0) return true;
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(chosenAbility);

    const attachResult = await engine.attachAbilityFromHand(pi, chosenAbility, targetHeroIdx, {
      skipAbilityGivenCheck: true,
    });

    if (!attachResult?.success) {
      // Attachment failed — return card to hand (player keeps it)
      engine.log('ska_attach_failed', { player: ps.username, card: chosenAbility });
    } else {
      engine._broadcastEvent('deck_search_add', { cardName: chosenAbility, playerIdx: pi });
      engine.log('ska_attach', { player: ps.username, ability: chosenAbility, hero: heroName });
      engine.shuffleDeck(pi);
    }

    engine.sync();
    return true;
  },
};
