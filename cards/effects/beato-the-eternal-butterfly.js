// ═══════════════════════════════════════════
//  CARD EFFECT: "Beato, the Eternal Butterfly"
//  Ascended Hero — This Hero can use any Spell
//  or Creature, regardless of level or school.
//
//  Ascension Bonus: Add up to 2 different
//  Spells/Creatures from your deck to your hand.
//
//  Does NOT block End Phase skip on Ascension
//  (default behavior).
// ═══════════════════════════════════════════

const SPELL_SCHOOL_ABILITY_NAMES = new Set([
  'Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic', 'Summoning Magic',
]);

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Ascended Beato can cast any Spell of any school at any level. For CPU
  // hero-ranking purposes she's treated as if every spell school were
  // stacked to level 9 — so she's the top pick for any Spell candidate
  // regardless of her ability-zone contents.
  virtualSpellSchoolLevel: 9,

  // CPU attach-ability filter: never attach a Spell-School ability to her.
  // She already effectively has all of them at max, so another copy is
  // wasted; the ability is more useful on a different hero.
  rejectsAbility(abilityName, _cardData) {
    return SPELL_SCHOOL_ABILITY_NAMES.has(abilityName);
  },

  // Passive setup in onGameStart must fire even if this hero starts
  // frozen / stunned / negated (e.g. a puzzle where she begins
  // Ascended AND incapacitated). Without this, her bypassLevelReq
  // field would never get set and would remain missing even after
  // the status is cleansed — because nothing else re-asserts it.
  // bypassLevelReq is a plain field on the hero object, so once set
  // it persists through subsequent freeze/thaw cycles without
  // further intervention.
  bypassStatusFilter: true,

  /**
   * Called by performAscension after the hero identity is swapped.
   * Sets up the new hero's passive effects on the hero object.
   */
  onAscendSetup(gs, pi, heroIdx, _engine) {
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero) return;
    // Full level + school bypass for Spells and Creatures
    hero.bypassLevelReq = { maxLevel: 99, types: ['Spell', 'Creature'] };
  },

  /**
   * Ascension Bonus: pick up to 2 different Spells/Creatures from deck.
   */
  async onAscensionBonus(engine, pi, heroIdx) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    const cardDB = engine._getCardDB();

    // Build deduplicated gallery of Spells/Creatures in deck
    const seen = new Set();
    const galleryCards = [];
    for (const cardName of (ps.mainDeck || [])) {
      if (seen.has(cardName)) continue;
      const cd = cardDB[cardName];
      if (!cd) continue;
      if (cd.cardType !== 'Spell' && cd.cardType !== 'Creature') continue;
      seen.add(cardName);
      galleryCards.push({ name: cardName, source: 'deck' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));

    if (galleryCards.length === 0) return;

    // Prompt: pick up to 2 different cards
    const maxPicks = Math.min(2, galleryCards.length);
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: galleryCards,
      selectCount: maxPicks,
      minSelect: 1,
      title: 'Ascension Bonus — Eternal Butterfly',
      description: `Choose up to ${maxPicks} different Spell${maxPicks > 1 ? 's' : ''}/Creature${maxPicks > 1 ? 's' : ''} from your deck to add to your hand.`,
      confirmLabel: '🦋 Claim!',
      confirmClass: 'btn-success',
      cancellable: false,
    });

    if (!result || !result.selectedCards || result.selectedCards.length === 0) return;

    const chosen = result.selectedCards;

    // Move chosen cards from deck to hand
    for (const name of chosen) {
      const idx = ps.mainDeck.indexOf(name);
      if (idx >= 0) {
        ps.mainDeck.splice(idx, 1);
        ps.hand.push(name);
      }
    }

    // Shuffle deck after searching
    engine.shuffleDeck(pi);

    // Reveal chosen cards to opponent one by one (opponent confirms each)
    await engine.revealSearchedCards(pi, chosen, 'Eternal Butterfly Ascension');
  },

  hooks: {
    /**
     * If Eternal Butterfly enters play via a non-ascension method (e.g. game
     * start in testing), still set up her passive.
     */
    onGameStart: (ctx) => {
      const ps = ctx.gameState.players[ctx.cardOriginalOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      hero.bypassLevelReq = { maxLevel: 99, types: ['Spell', 'Creature'] };
    },
  },
};
