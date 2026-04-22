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

  // Base Beato can use any level-1 Spell/Creature regardless of school
  // stacks. For CPU decision-making, treat her as if every spell school
  // were at effective level 1 — so she ranks as a plausible caster for
  // any level-1 Spell even without real ability stacks on her.
  virtualSpellSchoolLevel: 1,

  // CPU ascension targeting: a card "progresses" Beato's ascension if it's
  // a Spell or Creature whose school matches an uncollected orb.
  ascensionNeedsCard(_cardName, cardData, engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero?.ascensionOrbs || hero.ascensionReady) return false;
    const ct = cardData?.cardType;
    if (ct !== 'Spell' && ct !== 'Creature') return false;
    const s1 = cardData.spellSchool1;
    const s2 = cardData.spellSchool2;
    for (const orb of hero.ascensionOrbs) {
      if (orb.collected) continue;
      if (orb.school === s1 || orb.school === s2) return true;
    }
    return false;
  },

  // CPU evaluator: 0..1 progress toward Ascension. Uses orb count.
  ascensionProgress(engine, pi, hi) {
    const hero = engine.gs.players[pi]?.heroes?.[hi];
    if (!hero?.ascensionOrbs) return 0;
    const total = hero.ascensionOrbs.length;
    if (total === 0) return 0;
    const collected = hero.ascensionOrbs.filter(o => o.collected).length;
    return collected / total;
  },

  // Passive setup in onGameStart must fire even if this hero starts
  // frozen / stunned / negated (e.g. a puzzle where she begins
  // incapacitated). Without this, her bypassLevelReq field and orb
  // tracking would never get set and would remain missing even after
  // the status is cleansed.
  bypassStatusFilter: true,

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
     *  - Beato is not currently incapacitated (since bypassStatusFilter
     *    was enabled to let onGameStart fire while frozen, we must
     *    manually re-apply the filter to orb-tracking hooks)
     */
    afterSpellResolved: (ctx) => {
      // Match caster to this Beato instance
      if (ctx.casterIdx !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.cardHeroIdx) return;
      // Check negation flag
      if (ctx._engine.gs._spellNegatedByEffect) return;
      const hero = ctx.attachedHero;
      if (!hero?.ascensionOrbs || hero.ascensionReady) return;
      // Guard against incapacitation (undoes the module-wide bypassStatusFilter)
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;
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
      // Guard against incapacitation (undoes the module-wide bypassStatusFilter)
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) return;
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
