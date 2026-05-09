// ═══════════════════════════════════════════
//  SPELL (Reaction): "Ragnarock"
//  Play immediately when your opponent activates
//  the effect of an Ability by deleting the top
//  card of your Coolness Stack. Negate that
//  Ability's activation and discard the top copy
//  of that Ability from the Hero that activated
//  it.
// ═══════════════════════════════════════════

const { SPEED } = require('./_hooks');

const CARD_NAME = 'Ragnarock';

module.exports = {
  isReaction: true,
  speed: SPEED.COUNTER,

  /**
   * Engine signature is `(gs, pi, engine, chainCtx)`. `chainCtx.chain[0]`
   * is the initial card being reacted to. We trigger when:
   *   • the card is an Ability (chain links from Ability code paths
   *     all use `cardType: 'Ability'`),
   *   • the link was an ACTIVATION rather than an attach. Both paths
   *     share the cardType, but activation paths set `fromBoard: true`
   *     (`doActivateAbility` and `doActivateFreeAbility`). Without
   *     this gate, Ragnarock would also fire on opponent's hand-attach
   *     plays — and `doPlayAbility`'s `chainResult.negated` branch
   *     splices+discards the just-attached copy itself, so combined
   *     with our resolve that would discard the ability twice.
   *   • the activator is the opponent,
   *   • we have a Coolness Stack to pay the cost from.
   */
  reactionCondition: (gs, pi, engine, chainCtx) => {
    const initial = chainCtx?.chain?.[0];
    if (!initial || !initial.isInitialCard) return false;
    if (initial.cardType !== 'Ability') return false;
    if (initial.fromBoard !== true) return false;
    if (initial.owner === pi) return false;
    return engine.hasCoolnessStack(pi);
  },

  // Reaction-only — never proactively activatable.
  canActivate: () => false,

  /**
   * Resolve runs LIFO from `_resolveReactionChain`. Negating the
   * initial link here means the engine's own resolve loop sees
   * `link.negated === true` when it reaches index 0 and skips the
   * Ability's effect entirely.
   */
  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    const initialLink = chain?.[0];
    if (!initialLink) return;

    // ── Cost: delete the top of own Coolness Stack ──
    const ps = engine.gs.players[pi];
    if (ps?.coolnessStack?.length) {
      await engine.actionPopCoolnessStackTo(pi, 'delete', { source: CARD_NAME });
    }

    // ── Effect 1: negate the activated Ability ──
    engine.negateChainLink(chain, 0);

    // ── Effect 2: discard the top copy of that Ability from the
    // Hero that activated it. Abilities stack as repeats of the same
    // name within a slot, so the "top copy" is the last entry.
    const oppPi = initialLink.owner;
    const heroIdx = initialLink.heroIdx;
    const abilityName = initialLink.cardName;
    if (oppPi != null && oppPi >= 0 && heroIdx != null && heroIdx >= 0 && abilityName) {
      const oppPs = engine.gs.players[oppPi];
      const slots = oppPs?.abilityZones?.[heroIdx] || [];
      for (let zi = 0; zi < slots.length; zi++) {
        const slot = slots[zi];
        if (!slot?.length) continue;
        if (slot[slot.length - 1] === abilityName) {
          slot.pop();
          oppPs.discardPile.push(abilityName);
          engine._broadcastEvent('ability_zone_to_discard', {
            owner: oppPi, heroIdx, zoneSlot: zi, cardName: abilityName,
          });
          engine.log('ragnarock_discard_ability', {
            player: oppPs.username, ability: abilityName,
          });
          break;
        }
      }
    }
    engine.sync();
  },
};
