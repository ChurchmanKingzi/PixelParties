// ═══════════════════════════════════════════
//  Shared helpers for the Harpyformer archetype.
//
//  All Harpyformers share the same inherent-
//  action rule: summoning the first Creature
//  of your turn counts as an additional Action.
// ═══════════════════════════════════════════

/**
 * inherentAction function shared by every Harpyformer.
 * Returns true (= counts as additional action) only when
 * no other creature has been summoned yet this turn.
 *
 * Usage in a card module:
 *   const { harpyformerInherentAction } = require('./_harpyformer-shared');
 *   module.exports = { inherentAction: harpyformerInherentAction, ... };
 */
function harpyformerInherentAction(gs, pi) {
  const ps = gs.players[pi];
  return ps ? (ps._creaturesSummonedThisTurn || 0) === 0 : false;
}

/**
 * Discard an Ability from hand to pay a Harpyformer's creature-effect
 * activation cost. Direct in-hand selection (forceDiscardCancellable)
 * — ineligible cards dim, all copies of `abilityName` highlight as
 * discard targets. The player clicks one to discard, or cancels to
 * abort the activation entirely.
 *
 * On a successful discard, fires the engine's standard onDiscard hook
 * via `actionDiscardHandCard` so listeners (Rebelliokai Kind Kitsune,
 * any "when discarded by an effect" cards) trigger correctly.
 *
 * Returns true on success (caller proceeds to apply the harpyformer's
 * payoff), false on cancel / no eligible card (caller should return
 * false from onCreatureEffect so HOPT isn't stamped).
 *
 * Usage:
 *   const ok = await harpyformerDiscardCost(engine, pi, 'Support Magic', {
 *     title: CARD_NAME,
 *     description: 'Discard "Support Magic" to heal a target by 100 HP.',
 *     source: CARD_NAME,
 *     logType: 'ballad_discard',
 *   });
 *   if (!ok) return false;
 */
async function harpyformerDiscardCost(engine, pi, abilityName, opts = {}) {
  const ps = engine.gs.players[pi];
  if (!ps) return false;

  const eligibleIndices = [];
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (ps.hand[i] === abilityName) eligibleIndices.push(i);
  }
  if (eligibleIndices.length === 0) return false;

  const result = await engine.promptGeneric(pi, {
    type: 'forceDiscardCancellable',
    // ★ v1037: Dieser Abwurf ist eine KOSTE, kein Abwurf-Duell. Die
    // Marke `costFor` unterscheidet beides — daran haengen der
    // Lernkanal (`_costDiscardLog`) und die CPU-Entscheidung
    // („lohnt sich die Zahlung fuer DIESEN Effekt?"). Jede kuenftige
    // Karte mit Abwurfkosten sollte sie ebenso setzen.
    costFor: opts.title || abilityName,
    // ★ v1038: Die SORTE der Gegenleistung entscheidet, welche Lage
    // ueberhaupt zaehlt (Gold beim Goldeffekt, gegnerische Restpunkte
    // beim Schadenseffekt). Ein Wort je Karte; die Buckets stehen in
    // `_deck-profile.costDiscardTags`.
    ...(opts.costKind ? { costKind: opts.costKind } : {}),
    ...(opts.costTags ? { costTags: opts.costTags } : {}),
    title: opts.title || 'Discard Ability',
    description: opts.description || `Discard "${abilityName}" to activate this effect.`,
    instruction: `Click a "${abilityName}" in your hand to discard it.`,
    eligibleIndices,
    cancellable: true,
  });
  if (!result || result.cancelled || result.cardName == null) return false;
  // Defensive: only allow the named ability through, in case the
  // client ever sends a different hand index.
  if (result.cardName !== abilityName) return false;

  const ok = await engine.actionDiscardHandCard(pi, abilityName, result.handIndex, {
    source: opts.source || abilityName,
  });
  if (!ok) return false;

  if (opts.logType) {
    engine.log(opts.logType, { player: ps.username, card: abilityName });
  }
  return true;
}

module.exports = { harpyformerInherentAction, harpyformerDiscardCost };
