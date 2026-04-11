// ═══════════════════════════════════════════
//  CARD EFFECT: "Beato, the Butterfly Witch"
//  Hero — This Hero can use all level 1
//  Spells and Creatures.
//
//  Ascension: Track unique spell schools used
//  (Destruction, Decay, Magic Arts, Support,
//  Summoning). Display as colored orbs.
//  When all 5 collected → eligible to Ascend
//  into "Beato, the Eternal Butterfly".
//
//  Beato CANNOT be cheat-ascended.
// ═══════════════════════════════════════════

const REQUIRED_SCHOOLS = [
  { school: 'Destruction Magic', color: '#ff4444' },
  { school: 'Decay Magic',      color: '#aa44ff' },
  { school: 'Magic Arts',       color: '#4488ff' },
  { school: 'Support Magic',    color: '#ffdd44' },
  { school: 'Summoning Magic',  color: '#44ff88' },
];

const ASCENSION_TARGET = 'Beato, the Eternal Butterfly';

/** Initialize orbs on a hero object. */
function initOrbs(hero) {
  hero.ascensionOrbs = REQUIRED_SCHOOLS.map(s => ({
    school: s.school,
    color: s.color,
    collected: false,
  }));
  hero.ascensionReady = false;
  hero.ascensionTarget = ASCENSION_TARGET;
}

/** Try to collect a school orb. Returns true if a new orb was collected. */
function tryCollectSchool(hero, schoolName) {
  if (!hero.ascensionOrbs) return false;
  const orb = hero.ascensionOrbs.find(o => o.school === schoolName && !o.collected);
  if (!orb) return false;
  orb.collected = true;
  // Check if all orbs collected
  if (hero.ascensionOrbs.every(o => o.collected)) {
    hero.ascensionReady = true;
  }
  return true;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /** Beato cannot be cheat-ascended — must earn all 5 orbs. */
  cheatAscensionBlocked: true,

  /**
   * Bypass level requirements for level-1 Spells and Creatures.
   * Checked by the engine's generic bypassLevelReq flag system.
   */
  bypassLevelReq(_gs, _pi, _heroIdx, cardData, _engine) {
    if ((cardData.level || 0) !== 1) return false;
    const t = cardData.cardType;
    return t === 'Spell' || t === 'Creature';
  },

  hooks: {
    /** Set up orb tracking + level bypass flag at game start. */
    onGameStart: (ctx) => {
      const ps = ctx.gameState.players[ctx.cardOriginalOwner];
      const hero = ps?.heroes?.[ctx.cardHeroIdx];
      if (!hero) return;
      // Level 1 bypass flag (for client-side rendering)
      hero.bypassLevelReq = { maxLevel: 1, types: ['Spell', 'Creature'] };
      // Ascension orb tracking
      initOrbs(hero);
    },

    /**
     * Track spell schools after a spell resolves successfully.
     * Only counts if:
     *  - Beato herself cast it (casterIdx + heroIdx match)
     *  - The spell was NOT negated by a surprise/reaction
     */
    afterSpellResolved: (ctx) => {
      // Match caster to this Beato instance
      if (ctx.casterIdx !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Check negation flag
      if (ctx._engine.gs._spellNegatedByEffect) return;
      const hero = ctx.attachedHero;
      if (!hero?.ascensionOrbs || hero.ascensionReady) return;
      // Get spell school from the resolved spell/attack
      const cd = ctx.spellCardData;
      if (!cd) return;
      // Only count Spells and Creatures (attacks excluded from orb tracking)
      if (cd.cardType !== 'Spell') return;
      let changed = false;
      if (cd.spellSchool1) changed = tryCollectSchool(hero, cd.spellSchool1) || changed;
      if (cd.spellSchool2) changed = tryCollectSchool(hero, cd.spellSchool2) || changed;
      if (changed) ctx._engine.sync();
    },

    /**
     * Track creature spell schools when a creature enters the board
     * under this Beato's hero slot.
     */
    onCardEnterZone: (ctx) => {
      if (ctx.toZone !== 'support') return;
      if (ctx.toHeroIdx !== ctx.cardHeroIdx) return;
      const entering = ctx.enteringCard;
      if (!entering) return;
      // Only count if Beato's owner summoned it
      if (entering.owner !== ctx.cardOriginalOwner) return;
      const hero = ctx.attachedHero;
      if (!hero?.ascensionOrbs || hero.ascensionReady) return;
      // Look up creature's spell school
      const cardDB = ctx._engine._getCardDB();
      const cd = cardDB[entering.name];
      if (!cd || cd.cardType !== 'Creature') return;
      let changed = false;
      if (cd.spellSchool1) changed = tryCollectSchool(hero, cd.spellSchool1) || changed;
      if (cd.spellSchool2) changed = tryCollectSchool(hero, cd.spellSchool2) || changed;
      if (changed) ctx._engine.sync();
    },
  },
};
