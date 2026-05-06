// ═══════════════════════════════════════════
//  SHARED HELPERS — Magic Gem Artifacts
//
//  The seven Magic Gems (Amber, Amethyst, Cobalt,
//  Emerald, Ruby, Sapphire, Topaz) share two
//  rules:
//
//   ① Once-per-turn play lock — keyed by the
//     gem's name.
//   ② "You may discard a card from your hand to
//     keep this card in your hand instead of
//     putting it into your discard pile after
//     playing it."
//
//  This module centralizes both. Each gem's
//  script:
//   • Calls `canPlayMagicGem(gs, pi, name)` from
//     `canActivate` / `reactionCondition` to gate
//     the play.
//   • Calls `maybeKeepGemInHand(engine, pi, name)`
//     at the END of its resolve. The helper claims
//     the HOPT, prompts the player, and reports
//     whether the gem should stay in hand.
//
//  Disposition handling:
//   • Non-reaction gems return `{ keepInHand:
//     <bool> }` from their resolve. Server's
//     `doUseArtifactEffect` reads `chainResult.
//     resolveResult.keepInHand` and either keeps
//     the card pinned in hand or runs the standard
//     splice + push-to-discard.
//   • Reaction gems (Magic Topaz) are already
//     spliced out of hand by the time resolve
//     fires. They declare `skipPostResolveDiscard:
//     true` to suppress the engine's auto-discard,
//     then push back to hand or to discard
//     manually based on the helper's return.
// ═══════════════════════════════════════════

/**
 * True iff the named Magic Gem has not yet been played by `pi` on this turn.
 * Mirrors the read side of `engine.claimHOPT`; the actual claim happens
 * inside `maybeKeepGemInHand` so a cancelled prompt doesn't burn the slot.
 */
function canPlayMagicGem(gs, pi, gemName) {
  const hoptKey = `${gemName}:${pi}`;
  return gs.hoptUsed?.[hoptKey] !== gs.turn;
}

/**
 * Final step of every Magic Gem's resolve. Claims the once-per-turn HOPT,
 * then prompts the player to discard a hand card to keep the gem instead
 * of letting it head to the discard pile.
 *
 * Returns `{ keepInHand: boolean }`. `false` is the default outcome —
 * empty hand, declined prompt, or any error path all leave the gem
 * heading to discard.
 *
 * The HOPT claim is unconditional even when the player declines. The
 * card was still played (its main effect resolved); only the recycle
 * is optional.
 */
async function maybeKeepGemInHand(engine, pi, gemName) {
  // Claim once-per-turn slot. Reading was done in the canActivate /
  // reactionCondition gate; the write here is the source of truth.
  engine.claimHOPT(gemName, pi);

  const ps = engine.gs.players[pi];
  if (!ps) return { keepInHand: false };

  // No discardable cards → can't pay the keep-in-hand cost.
  // Reaction gems: hand has already had the gem spliced out by the
  // engine before resolve, so 0 means truly empty. Non-reaction gems:
  // the gem itself is still pinned in hand (the splice runs AFTER
  // resolve), so 1 means "only the gem", which is also unpayable.
  // The client's forceDiscardCancellable prompt already filters the
  // resolving card out of the eligible-indices list, so we don't
  // need to send eligibleIndices here — the UI guard covers it.
  const minHand = gemName === 'Magic Topaz' ? 1 : 2;
  if ((ps.hand || []).length < minHand) return { keepInHand: false };

  const result = await engine.promptGeneric(pi, {
    type: 'forceDiscardCancellable',
    title: gemName,
    description: `You may discard a card to keep ${gemName} in your hand. Click a card to pay, or cancel to send ${gemName} to the discard pile.`,
    cancelLabel: 'Send to Discard',
    cancellable: true,
  });

  if (!result || result.cancelled) return { keepInHand: false };
  const { cardName, handIndex } = result;
  if (cardName == null) return { keepInHand: false };

  // Splice the chosen card and push to discard. The handIndex from the
  // prompt is authoritative when it points at the requested card name;
  // fall back to indexOf if the indices have shifted.
  if (handIndex != null && ps.hand[handIndex] === cardName) {
    ps.hand.splice(handIndex, 1);
  } else {
    const fi = ps.hand.indexOf(cardName);
    if (fi < 0) return { keepInHand: false };
    ps.hand.splice(fi, 1);
  }
  ps.discardPile.push(cardName);
  await engine.runHooks('onDiscard', {
    playerIdx: pi, cardName, discardedCardName: cardName,
    _fromHand: true, _skipReactionCheck: true,
  });

  engine.log('magic_gem_kept', { player: ps.username, gem: gemName, discarded: cardName });
  engine.sync();
  return { keepInHand: true };
}

module.exports = { canPlayMagicGem, maybeKeepGemInHand };
