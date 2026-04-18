// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Mirror"
//  Spell (Magic Arts Lv3, Surprise)
//  Pollution archetype.
//
//  Activate when the user would be hit by a Spell.
//  Negate that Spell. Then the user immediately
//  performs a copy of it as an additional Action,
//  ignoring its level requirement. Place Pollution
//  Tokens equal to the negated Spell's level into
//  your free Support Zones.
//
//  The copy-cast bypasses level/school requirements
//  per the card text. It runs through the standard
//  onPlay flow of the reflected Spell, so nested
//  reaction chains still work.
// ═══════════════════════════════════════════

const { placePollutionTokens } = require('./_pollution-shared');
const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

module.exports = {
  isSurprise: true,

  /**
   * Trigger: fires when the user (host Hero) is being targeted by a Spell.
   * sourceInfo = { cardName, owner, heroIdx, cardInstance }.
   * We check the source card's type is Spell. Reactions / Surprises are
   * not "normal Spells" — but the card text is "when the user would be hit
   * by a Spell" so we accept all Spell subtypes and let the engine decide
   * what counts as "hitting" via the surprise window timing.
   */
  surpriseTrigger: (gs, ownerIdx, heroIdx, sourceInfo, engine) => {
    const cardDB = engine._getCardDB();
    const sourceCard = sourceInfo?.cardName;
    if (!sourceCard) return false;
    const cd = cardDB[sourceCard];
    if (!cd) return false;
    return hasCardType(cd, 'Spell');
  },

  /**
   * On activation: return { effectNegated: true } to negate the incoming
   * Spell. Then synthesize a fresh instance of the same Spell in the
   * user's hand-adjacent space, fire its onPlay bypassing level checks,
   * and clean up. Finally place Pollution Tokens equal to the negated
   * Spell's level.
   */
  onSurpriseActivate: async (ctx, sourceInfo) => {
    const engine = ctx._engine;
    const gs = engine.gs;
    const ownerIdx = ctx.cardOwner;       // The player who placed the Surprise
    const hostHeroIdx = ctx.cardHeroIdx;  // The Hero hosting the Surprise
    const cardDB = engine._getCardDB();
    const sourceCard = sourceInfo?.cardName;

    if (!sourceCard) return null;
    const sourceCd = cardDB[sourceCard];
    if (!sourceCd) return null;

    const spellLevel = sourceCd.level || 0;

    // ── Animation: Magic Mirror shimmer on host Hero ──
    // No dedicated animation yet — use plague_smoke as a placeholder for the
    // negation flash, then the reflected spell's own onPlay will produce its
    // native animation.
    engine._broadcastEvent('play_zone_animation', {
      type: 'plague_smoke', owner: ownerIdx, heroIdx: hostHeroIdx, zoneSlot: -1,
    });
    await engine._delay(500);

    engine.log('magic_mirror_reflect', {
      player: gs.players[ownerIdx]?.username,
      spell: sourceCard, level: spellLevel,
    });

    // ── Place Pollution Tokens equal to the negated Spell's level ──
    if (spellLevel > 0) {
      await placePollutionTokens(engine, ownerIdx, spellLevel, 'Magic Mirror', {
        promptCtx: ctx,
      });
    }

    // ── Copy-cast the reflected Spell as an additional Action, ignoring
    //    its level requirement. We synthesize a fresh instance, fire its
    //    onPlay, then clean up. This mirrors the pattern in
    //    performImmediateAction (line 4313–4325) minus the hand bookkeeping. ──
    const script = loadCardEffect(sourceCard);
    if (script?.hooks?.onPlay) {
      // Synthesize the card as if it were in the user's hand attached to
      // the host hero. _trackCard returns a fresh instance object; we pass
      // zone 'hand' so downstream cost logic in the spell treats it as a
      // normal play.
      const synthInst = engine._trackCard(sourceCard, ownerIdx, 'hand', hostHeroIdx, -1);

      // Mark this as an immediate/copied play so nested systems know to
      // skip certain once-per-turn restrictions that would otherwise lock
      // the original caster out.
      gs._immediateActionContext = true;
      gs._magicMirrorBypassLevel = true; // Advisory flag for future use

      try {
        // Fire the Spell's onPlay hook scoped to this instance.
        await engine.runHooks('onPlay', {
          _onlyCard: synthInst, playedCard: synthInst,
          cardName: sourceCard, zone: 'hand',
          heroIdx: hostHeroIdx,
          _skipReactionCheck: true,
        });
      } finally {
        delete gs._immediateActionContext;
        delete gs._magicMirrorBypassLevel;
        // Move the synthetic instance to the user's discard (or deleted pile,
        // depending on the card's own `_spellPlacedOnBoard` flag). Standard
        // spells get discarded; placed-on-board ones handled themselves.
        if (!gs._spellPlacedOnBoard) {
          const ps = gs.players[ownerIdx];
          if (ps) ps.discardPile.push(sourceCard);
          engine._untrackCard(synthInst.id);
        } else {
          delete gs._spellPlacedOnBoard;
        }
      }
    }

    engine.sync();
    return { effectNegated: true };
  },
};
