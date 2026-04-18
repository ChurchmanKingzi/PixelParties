// ═══════════════════════════════════════════
//  SHARED: Area card helpers
//
//  "Area" is a Spell subtype: once cast, the card
//  sits on the board as a persistent field effect
//  until it's destroyed / displaced / removed. The
//  engine/server infrastructure for this has been
//  dormant — gs.areaZones = [[], []] exists at the
//  game-state root but nothing has ever placed a
//  card there. This module provides the helpers so
//  every Area card can route through one place.
//
//  Structural model:
//    • gs.areaZones[pi] is a flat array of card
//      names (can hold multiple Areas per side —
//      the card text decides whether to clear
//      existing areas before placement).
//    • The card instance's zone becomes 'area'.
//    • activeIn: ['area'] on a card's module makes
//      its hooks fire while it's in that zone.
//    • The Spell must set gs._spellPlacedOnBoard =
//      true inside its onPlay so the server's
//      post-resolve cleanup skips sending it to
//      discard (it stays in play).
//
//  Server routing note: the current server.js does
//  not yet render the Area zone — these cards will
//  function correctly on the engine side, but may
//  need frontend work to display the areas visibly.
// ═══════════════════════════════════════════

/**
 * Place an Area card from a casting Spell onto its owner's Area zone.
 *
 * Must be called from inside the Area Spell's onPlay hook. Three things happen:
 *   1. The card name is pushed into gs.areaZones[playerIdx].
 *   2. The card's CardInstance is updated to zone='area' so hooks fire via
 *      activeIn: ['area'].
 *   3. gs._spellPlacedOnBoard is set so the server's resolve-cleanup skips
 *      discarding the card.
 *
 * Optional flag: opts.replaceExisting — if true, any existing Areas on the
 * caster's side are sent to discard first. Reality Crack uses this via
 * removeAllAreas() directly, but we expose the flag for simpler cards.
 *
 * @param {object} engine
 * @param {number} playerIdx - The Area's owner
 * @param {object} cardInstance - The casting spell's card instance (ctx.card)
 * @param {object} [opts]
 * @param {boolean} [opts.replaceExisting] - Remove existing Areas before placement
 */
async function placeArea(engine, playerIdx, cardInstance, opts = {}) {
  const gs = engine.gs;
  const ps = gs.players[playerIdx];
  if (!ps) return;

  if (!gs.areaZones) gs.areaZones = [[], []];
  if (!gs.areaZones[playerIdx]) gs.areaZones[playerIdx] = [];

  if (opts.replaceExisting) {
    await removeAllAreas(engine, playerIdx, opts.replacedBy || cardInstance.name);
  }

  const cardName = cardInstance.name;

  gs.areaZones[playerIdx].push(cardName);
  cardInstance.zone = 'area';
  // No heroIdx / zoneSlot for area zones
  cardInstance.heroIdx = -1;
  cardInstance.zoneSlot = -1;

  // If this Area was placed by ANOTHER spell (e.g. Reality Crack bringing in
  // Acid Rain), tag the instance so its own afterSpellResolved hook ignores
  // that enclosing spell — otherwise a freshly-placed reactive Area would
  // trigger on the very spell that brought it in.
  const resolvingName = ps._resolvingCard?.name;
  if (resolvingName && resolvingName !== cardName) {
    cardInstance.counters._skipAfterResolveName = resolvingName;
  }

  // Critical flag — tells the server-side resolve cleanup that THIS CAST
  // (i.e. an Area cast from hand) stays in play and must NOT be sent to
  // discard. Skip if the enclosing spell is a different spell that merely
  // brought this Area in; otherwise the enclosing spell itself would also
  // bypass discard. (Reality Crack → Acid Rain: only Acid Rain stays.)
  if (!resolvingName || resolvingName === cardName) {
    gs._spellPlacedOnBoard = true;
  }

  engine.log('area_placed', { player: ps.username, area: cardName });

  // Flashy placement animation: the descending card smacks down onto the
  // caster's Area Zone with shockwave, dust, and a bright impact flash.
  // Areas are cornerstone cards so the effect is intentionally big.
  engine._broadcastEvent('area_descend', {
    owner: playerIdx, cardName,
  });

  // Fire onCardEnterZone so cards that react to area placement (e.g. counter
  // cards, weather-style effects) respond.
  await engine.runHooks('onCardEnterZone', {
    enteringCard: cardInstance, toZone: 'area', toHeroIdx: -1,
    _skipReactionCheck: true,
  });

  engine.sync();

  // Hold on the flashy impact so the player registers it before the spell's
  // follow-up effects (status prompts, token placements) kick in.
  await engine._delay(1300);
}

/**
 * Remove a specific Area card instance from the board.
 * Sends its name to the owner's discard pile and fires onCardLeaveZone.
 */
async function removeArea(engine, cardInstance, sourceName = 'unknown') {
  const gs = engine.gs;
  const ownerIdx = cardInstance.owner;
  const ps = gs.players[ownerIdx];
  if (!ps) return;

  const cardName = cardInstance.name;

  // Fire the area → discard flying-card animation BEFORE removing the card
  // from the zone, so the client can capture the source position while the
  // card is still "there". The animation is purely visual; state updates
  // follow immediately below.
  engine._broadcastEvent('play_pile_transfer', {
    owner: ownerIdx, cardName, from: 'area', to: 'discard',
  });

  // Remove from areaZones
  if (gs.areaZones?.[ownerIdx]) {
    const idx = gs.areaZones[ownerIdx].indexOf(cardName);
    if (idx >= 0) gs.areaZones[ownerIdx].splice(idx, 1);
  }

  // Send to discard
  if (!ps.discardPile) ps.discardPile = [];
  ps.discardPile.push(cardName);
  cardInstance.zone = 'discard';

  engine.log('area_removed', { player: ps.username, area: cardName, by: sourceName });

  await engine.runHooks('onCardLeaveZone', {
    card: cardInstance, fromZone: 'area',
    fromOwner: ownerIdx, fromHeroIdx: -1, fromZoneSlot: -1,
    _skipReactionCheck: true,
  });

  engine.sync();
  // Give the flying-card animation (700ms) time to arrive before any
  // subsequent effect (like chaining to another remove) starts.
  await engine._delay(750);
}

/**
 * Remove all Area cards from the board (both players' sides).
 * Used by Reality Crack's "Send all Areas on the board to the discard pile".
 * Returns the count of areas removed.
 */
async function removeAllAreas(engine, excludePlayerIdx = -2, sourceName = 'unknown') {
  // We walk card instances (not gs.areaZones) so the onCardLeaveZone hook
  // fires properly. Collect first, then iterate — mutating while walking
  // the canonical cardInstances list is unsafe.
  const areaInsts = engine.cardInstances.filter(c => c.zone === 'area');
  let removed = 0;
  for (const inst of areaInsts) {
    if (inst.owner === excludePlayerIdx) continue;
    await removeArea(engine, inst, sourceName);
    removed++;
  }
  return removed;
}

/**
 * Return all active Area CardInstances for a player (or both if unspecified).
 */
function getAreas(engine, playerIdx) {
  return engine.cardInstances.filter(inst =>
    inst.zone === 'area' &&
    (playerIdx == null || inst.owner === playerIdx)
  );
}

module.exports = {
  placeArea,
  removeArea,
  removeAllAreas,
  getAreas,
};
