// ═══════════════════════════════════════════
//  CARD EFFECT: "Divinity"
//  Ability — level-manipulation (free coverage).
//
//  This Hero can use and resolve Attacks and Spells up to 1/2/3
//  levels higher than it normally could, depending on Divinity's
//  slot size on this hero. No discard cost, unlike Wisdom.
//
//  Restricted attachment: Divinity can ONLY land on a hero by being
//  a starting ability or by an effect that specifically mentions
//  "Divinity". Generic ability tutors (Alex, Cute Starlet Megu, Ska
//  Harpyformer, etc.) and direct hand-plays must be refused. Cards
//  that legitimately attach Divinity pass `{ allowRestricted: true }`
//  to the engine's attachment helpers.
//
//  Plugs into the engine's generic level-manipulation mechanism via
//  `coverLevelGap`. The engine walks abilities and finds a coverage
//  handler without knowing about Divinity by name — same hook
//  Wisdom uses, just with `discardCost: 0`. Coverage applies to
//  Spell, Attack, AND Creature plays — the engine's gap-coverage
//  branch was Spell-only by default; Divinity opens it up to Attacks
//  and Creature summons too (the engine's `_testLevelReqForZones`
//  consults the same `coverLevelGap` hook for all three types).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],

  // ── CPU evaluation hint ───────────────────────────────────────────
  // Divinity is the deck's primary "engine" ability — extending the
  // playable Spell/Attack pool by 1-3 levels per stack at zero
  // discard cost is what every "to attain Divinity"-style deck builds
  // around. The CPU eval reads `cpuMeta.engineValue` from the
  // ability scripts and adds `engineValue × stack_size` per copy on
  // own heroes (with Performance copies on a Divinity slot counting
  // as Divinity-equivalent because Performance inherits the
  // underlying ability's school). 120 ≈ "as valuable as a Lv4
  // Creature" per the user's intent: makes Sacrifice-to-Divinity's
  // trade (-30 creature, +120 fresh stack, minus the spell-from-hand
  // value) cleanly positive, and stacking Performance / a second
  // Divinity onto an existing slot is just as attractive as the
  // initial attach.
  //
  // Future engine-tier abilities can declare their own `engineValue`
  // — the CPU brain reads it generically without per-card hard-codes.
  cpuMeta: {
    engineValue: 120,

    // CPU ability-placement bias: prefer the middle Hero (heroIdx 1).
    // The planner consults this per pass: if hero 1 is currently a
    // legal placement target, every non-middle heroIdx is filtered
    // out of the pass. Falls through (no bias) when hero 1 is dead /
    // max-leveled / rejects the ability / has no slot.
    cpuPlacementBias(engine, pi, helpers) {
      const ps = engine.gs.players[pi];
      const cardDB = engine._getCardDB();
      const hi = 1;
      const hero = ps.heroes?.[hi];
      if (!hero?.name || hero.hp <= 0) return null;
      if (ps.abilityGivenThisTurn?.[hi]) return null;
      if (helpers.heroHasAbilityAtMaxLevel(ps, hi, 'Divinity')) return null;
      const cd = cardDB['Divinity'];
      if (!cd) return null;
      if (helpers.heroRejectsAbility(engine, pi, hi, 'Divinity', cd)) return null;
      if (helpers.resolveAbilitySlot(engine, pi, hi, 'Divinity') === null) return null;
      return { allowedHeroes: new Set([1]) };
    },
  },

  // Engine-side flag: refuses generic attachment paths
  // (canAttachAbilityToHero / attachAbilityFromHand / direct hand
  // play) unless the caller explicitly passes
  // `opts.allowRestricted: true`. Tutors that scan the deck for
  // attachable abilities therefore skip Divinity automatically.
  restrictedAttachment: true,

  // Hand-play guard: doPlayAbility consults this hook before
  // committing the attach. Returning false blocks the placement.
  // Independent of `restrictedAttachment` so it's bullet-proof
  // even if a future code path forgets the engine-level gate.
  canAttachToHero(/* gs, pi, heroIdx, engine */) {
    return false;
  },

  /**
   * Generic level-gap coverage. Called by the engine when a Spell,
   * Attack, or Creature's effective level exceeds the hero's school
   * count by `gap`. Divinity covers up to `abilityLevel` levels of
   * gap free of charge.
   *
   * @param {object} cardData - The Spell / Attack / Creature being played
   * @param {number} abilityLevel - Divinity's slot size on this hero (1-3)
   * @param {object} engine - Engine reference (unused; signature parity with Wisdom)
   * @param {number} gap - Remaining level gap after silent reductions
   * @returns {{ coverable: boolean, discardCost: number }}
   */
  coverLevelGap(cardData, abilityLevel, engine, gap) {
    const ct = cardData?.cardType;
    if (ct !== 'Spell' && ct !== 'Attack' && ct !== 'Creature') {
      return { coverable: false, discardCost: 0 };
    }
    if (gap <= 0) return { coverable: true, discardCost: 0 };
    if (abilityLevel >= gap) return { coverable: true, discardCost: 0 };
    return { coverable: false, discardCost: 0 };
  },
};
