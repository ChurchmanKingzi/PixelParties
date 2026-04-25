// ═══════════════════════════════════════════
//  CARD EFFECT: "Homerun!"
//  Artifact (Reaction, Cost 4)
//
//  Play this card immediately when a Hero you
//  control would take damage equal to or greater
//  than their max HP. Negate that damage and any
//  effects associated with it on that Hero.
//
//  Implementation: hooked into the engine's
//  pre-damage hand-reaction window
//  (`isPreDamageReaction`). The window fires AFTER
//  every modifier has applied to the incoming
//  damage (Cloudy halve, arrow boost, Smug Coin
//  save, etc.) so the threshold compares against
//  the FINAL number about to land, matching the
//  card text "would take damage equal to or
//  greater than their max HP".
//
//  On accept: the engine returns `{ dealt: 0,
//  cancelled: true }` from actionDealDamage, so
//  no afterDamage hook fires, no hp drop, no
//  status side-effects (Burn/Poison from the
//  triggering source). The hero is fully shielded
//  for that single damage instance — exactly the
//  "any effects associated with it" wording.
// ═══════════════════════════════════════════

const CARD_NAME = 'Homerun!';

module.exports = {
  // Engine-side trigger flag — wires this card into the pre-damage
  // hand-reaction window (`_checkPreDamageHandReactions`).
  isPreDamageReaction: true,
  // No `isReaction: true` here on purpose: that flag would surface
  // Homerun in the generic chain reaction window when ANY card is
  // played, but Homerun without a `resolve` resolves as a no-op and
  // the triggering card proceeds to deal damage anyway. Using only
  // `isPreDamageReaction` keeps the activation prompt scoped to the
  // exact moment the damage is about to land, matching the card text
  // "Play this card immediately when a Hero you control would take
  // damage equal to or greater than their max HP".
  canActivate: () => false,
  // Strictly reactive — the only legitimate path is the pre-damage
  // hand-reaction window. Surface as a "never proactively playable"
  // card so it stays dimmed in hand and the player can't try to
  // drag/click-play it as a regular Artifact.
  neverPlayable: true,
  activeIn: ['hand'],

  /**
   * Trigger condition — the engine hands over the resolved damage amount
   * (post-modifiers, after Smug Coin / Cloudy / arrow rebates / etc.).
   *
   * Per card text: fires when the incoming damage instance is at least
   * the hero's max HP (a single hit big enough to one-shot a
   * full-health hero). Cheap defensive cover against burst spells like
   * Cataclysm or Heat-Wave-stack scenarios.
   */
  preDamageCondition(gs, pi, _engine, target, _heroIdx, _source, amount, _type) {
    if (!target || target.hp === undefined) return false;
    if (target.hp <= 0) return false;
    const maxHp = target.maxHp || 0;
    if (maxHp <= 0) return false;
    return amount >= maxHp;
  },

  /**
   * On accept: just negate. The engine plays its own card-reveal banner
   * and discards Homerun! after we return; we add a brief shield flash
   * on the saved hero so the rescue is visible.
   */
  async preDamageResolve(engine, pi, target, heroIdx /*, source, amount, type */) {
    engine._broadcastEvent('play_zone_animation', {
      type: 'holy_revival', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(700);
    engine.log('homerun_save', {
      player: engine.gs.players[pi]?.username,
      hero: target.name,
    });
    engine.sync();
    return { negated: true };
  },
};
