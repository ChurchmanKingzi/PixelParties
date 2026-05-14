// ═══════════════════════════════════════════
//  CARD EFFECT: "Escape"
//  Attack (Fighting Lv2, Reaction)
//
//  Play this card immediately when a Hero you control that can use
//  this Attack would be defeated by an Attack or Spell.
//  Discard 1 card and negate all effects the Attack or Spell has on
//  that Hero (including damage).
//
//  Notes:
//    • The triggering Attack/Spell CAN be the user's own. The
//      pre-damage reaction loop runs for the TARGET's owner
//      regardless of who the source belongs to, so no
//      `source.owner !== ownerIdx` gate is needed.
//    • "Can use this Attack" gates the eligibility check on the
//      TARGET Hero — the one about to die must meet Escape's
//      Fighting Lv2 requirement (Wisdom / Divinity gap-coverage
//      flows through `heroMeetsLevelReq` automatically).
//
//  Wiring:
//    • `isReaction: true` + subtype 'Reaction' in cards.json → the
//      engine refuses proactive Main-Phase casts.
//    • `isPreDamageReaction: true` → the engine's
//      `_checkPreDamageHandReactions` (see _engine.js ~L13219)
//      offers this card to the target's owner BEFORE the HP loss
//      lands, which is the only timing that can save the Hero from
//      lethal.
//    • `preDamageCondition` filters by (a) lethal incoming amount,
//      (b) source cardType ∈ {Attack, Spell}, (c) target Hero can
//      cast Escape via `engine.heroMeetsLevelReq`, (d) at least
//      one extra hand card exists to pay the discard cost on top
//      of Escape itself.
//    • `preDamageResolve` discards 1 card from the controller's
//      hand via `actionPromptForceDiscard` and returns
//      `{ negated: true }` — `actionDealDamage` reads that flag
//      and cancels the damage event entirely (no HP loss, no
//      `afterDamage`, no on-hit riders).
//
//  Limitation worth noting:
//    The "negate all effects on that Hero" clause is implemented
//    via damage cancellation. For Attack/Spell cards whose `onPlay`
//    runs side-effects AFTER the damage call without checking the
//    damage result (independent status applications, healing
//    riders, …), those side-effects may still fire — same caveat
//    Spectral Armor and Bamboo Shield carry. The vast majority of
//    Attack/Spell cards in this codebase route every hero-side
//    effect through the damage call, so this is rarely visible.
// ═══════════════════════════════════════════

const CARD_NAME = 'Escape';

module.exports = {
  // Reaction-subtype cards are never proactively playable in the
  // normal Main-Phase action flow.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  // Engine flag — surfaces Escape in the pre-damage hand-reaction
  // window. Spectral Armor's pattern.
  isPreDamageReaction: true,

  /**
   * Eligibility gate for the pre-damage reaction prompt.
   *
   * @param {object} gs        - Game state
   * @param {number} ownerIdx  - The target Hero's controller (and
   *                             Escape's controller — the same player)
   * @param {object} engine    - Engine reference
   * @param {object} target    - The Hero about to take damage
   * @param {number} heroIdx   - That Hero's slot index
   * @param {object} source    - Source card info (cardInstance or
   *                             synthetic source object)
   * @param {number} amount    - Incoming damage
   * @returns {boolean}
   */
  preDamageCondition(gs, ownerIdx, engine, target, heroIdx, source, amount /*, type */) {
    if (!(amount > 0)) return false;
    // Trigger condition: damage would be lethal. `target.hp` is the
    // current HP at the moment of the check; the reaction is offered
    // only when the post-damage HP would drop to 0 or below.
    if (target?.hp == null || amount < target.hp) return false;

    // Source must be an Attack or Spell card. Status-tick damage
    // (Burn / Poison), Creature effects, recoil from rule effects
    // (`{ name: 'Burn' }` synthetic sources, etc.) carry a `name`
    // that doesn't resolve in the card DB — those return undefined
    // from the lookup and are filtered out here.
    const cd = engine._getCardDB()[source?.name];
    if (!cd) return false;
    if (cd.cardType !== 'Attack' && cd.cardType !== 'Spell') return false;

    // The target Hero must be able to play Escape themselves. The
    // engine's standard level-req helper handles Performance,
    // Wisdom, Divinity gap-coverage, etc.
    const escapeCd = engine._getCardDB()[CARD_NAME];
    if (!escapeCd) return false;
    if (!engine.heroMeetsLevelReq(ownerIdx, heroIdx, escapeCd)) return false;

    // Need at least one extra card to pay the discard cost. At
    // condition-check time, Escape itself is still in hand — so
    // `hand.length >= 2` means there's at least one OTHER card
    // available once Escape is consumed.
    const ps = gs.players[ownerIdx];
    if (!ps || (ps.hand?.length || 0) < 2) return false;

    return true;
  },

  /**
   * Pay the discard cost and negate the damage event. By the time
   * this runs, the engine has already spliced Escape itself out of
   * the hand (see `_checkPreDamageHandReactions` ~L13333), so the
   * forced-discard prompt picks from the REMAINING cards.
   */
  async preDamageResolve(engine, ownerIdx, target, heroIdx /*, source, amount, type */) {
    const ps = engine.gs.players[ownerIdx];
    // Defensive: condition gated on hand.length >= 2 (counting
    // Escape). After Escape's splice we expect >= 1 here — but if
    // a parallel effect drained the hand between the prompt and
    // resolution, fall through to negation regardless rather than
    // letting the Hero die after the player committed.
    if (ps && (ps.hand?.length || 0) >= 1) {
      await engine.actionPromptForceDiscard(ownerIdx, 1, {
        title: CARD_NAME, source: CARD_NAME, selfInflicted: true,
      });
    }

    // Dodge animation — the saved Hero leans / dashes side-to-side
    // out of the way of the incoming Attack/Spell. Registered in
    // `app-board.jsx#ANIM_REGISTRY.escape_dodge`; the visual is a
    // ~700ms left-right shimmy of the Hero Zone DOM element itself.
    engine._broadcastEvent('play_zone_animation', {
      type: 'escape_dodge', owner: ownerIdx, heroIdx, zoneSlot: -1,
    });
    engine.log('escape_negate', {
      player: engine.gs.players[ownerIdx]?.username,
      hero: target?.name,
    });
    // Hold the damage call until the dodge motion has visibly
    // completed — at ~700ms total, we wait for the bulk of the
    // animation before returning `{ negated: true }` so the player
    // sees the dodge BEFORE the damage indicator would have flashed.
    await engine._delay(720);

    return { negated: true };
  },
};
