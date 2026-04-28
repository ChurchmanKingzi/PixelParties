// ═══════════════════════════════════════════
//  CARD EFFECT: "Voice in your Head"
//  Spell (Magic Arts Lv0, Normal)
//
//  Restrictions:
//    • Per-hero: only an Ascended Hero may cast.
//    • Hand must be under 8 cards (the spell
//      itself is still in hand during resolve;
//      Supply Chain uses the same off-by-one).
//
//  Effect:
//    Draw cards until the hand reaches 7 (i.e.
//    8 minus the resolving spell). Drawn one at
//    a time with the engine's standard staggered
//    delay (`actionDrawCards`).
//
//  Action economy:
//    `inherentAction: true` — declared statically
//    so the engine's getPlayableActionCards filter
//    (which gates Main-Phase plays on either an
//    inherent action or an additional-action
//    provider) sees Voice as playable in BOTH
//    Main Phases AND post-action Action Phase.
//    The runtime `_spellFreeAction` flag would
//    only refund AFTER the static gate already
//    rejected the play in Main Phase.
//
//  Animation:
//    Thought + lightbulb bubbles drift up from
//    the casting hero (existing `thought_bubbles`
//    play_zone_animation type — same one Brilliant
//    Idea uses).
// ═══════════════════════════════════════════

const HAND_TARGET_PLUS_SELF = 8; // 7 in hand after Voice resolves and discards itself

function _heroIsAscended(hero, cardDB) {
  if (!hero?.name || hero.hp <= 0) return false;
  return cardDB[hero.name]?.cardType === 'Ascended Hero';
}

function _playerHasAscendedHero(gs, pi, engine) {
  const ps = gs.players[pi];
  if (!ps) return false;
  const cardDB = engine?._getCardDB ? engine._getCardDB() : null;
  if (!cardDB) return false;
  for (const hero of (ps.heroes || [])) {
    if (_heroIsAscended(hero, cardDB)) return true;
  }
  return false;
}

module.exports = {
  // Static declaration — Voice doesn't consume an action in EITHER
  // phase. This is the playability gate the engine consults at UI-fill
  // time (getPlayableActionCards), so without it the spell greys out in
  // Main Phase.
  inherentAction: true,

  // Cheap player-level pre-filter: greys the card out entirely when
  // no Ascended Hero exists or the hand is already at cap.
  spellPlayCondition(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.hand || []).length >= HAND_TARGET_PLUS_SELF) return false;
    return _playerHasAscendedHero(gs, pi, engine);
  },

  // Per-hero gate: only Ascended Heroes can cast Voice. Greys out
  // non-Ascended Heroes from being able to host the spell.
  canPlayWithHero(gs, pi, heroIdx, cardData, engine) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.hand || []).length >= HAND_TARGET_PLUS_SELF) return false;
    return _heroIsAscended(ps.heroes?.[heroIdx], engine._getCardDB());
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = ctx.gameState;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      if (!ps) return;

      const handSize  = (ps.hand || []).length;
      const drawCount = HAND_TARGET_PLUS_SELF - handSize;
      if (drawCount <= 0) {
        // Defensive: spellPlayCondition gates this, but a pre-resolve
        // discard hook could theoretically push the hand to 8+.
        gs._spellCancelled = true;
        return;
      }

      const choice = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Voice in your Head',
        message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''} (to 7 in hand).`,
        confirmLabel: `🧠 Listen! (+${drawCount})`,
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!choice || choice.cancelled) {
        gs._spellCancelled = true;
        return;
      }

      // Thought bubbles drift up from the casting hero (same emoji set
      // Brilliant Idea uses — already wired into the client renderer).
      engine._broadcastEvent('play_zone_animation', {
        type: 'thought_bubbles', owner: pi, heroIdx, zoneSlot: -1,
      });
      await engine._delay(400);

      await engine.actionDrawCards(pi, drawCount);

      engine.log('voice_in_your_head', { player: ps.username, drawn: drawCount });
      engine.sync();
    },
  },
};
