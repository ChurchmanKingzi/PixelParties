// ═══════════════════════════════════════════
//  CARD EFFECT: "Play Money"
//  Artifact (Normal, Cost 4)
//
//  Choose another Artifact from your hand. That
//  Artifact's Cost is reduced by 20 for the rest
//  of the turn (floor 0).
//
//  Wiring: writes to the engine's per-hand-index
//  registry `_handCostReductions` (registered in
//  `_registerBuiltinHandIndexedFields`). The
//  splice interceptor and `reorder_hand` remap
//  follow each entry through every hand mutation
//  (drag-reorder, mid-hand splice, draw, etc.) —
//  the discount stays bound to the physical copy.
//  The reduction is wiped at the next turn start
//  (whoever's turn) by the per-turn cleanup block
//  in startTurn.
//
//  Cost computation: server's doPlayArtifact /
//  doUseArtifactEffect both read `ps._handCostReductions
//  [handIndex]` and stack it with Shu'Chaku's
//  next-artifact discount, capped at 0.
//
//  Display: the client renders an effective-cost
//  badge on each tagged hand card (see
//  app-board.jsx — `handEffectiveCost` /
//  `.hand-cost-override`).
// ═══════════════════════════════════════════

const COST_REDUCTION = 20;
const CARD_NAME = 'Play Money';

/**
 * Build the eligible-hand-indices list for the player's pickHandCard
 * prompt: every other Artifact in their hand whose Cost > 0. Excludes:
 *   • the resolving Play Money slot (text says "another Artifact"),
 *   • 0-cost Artifacts (no point discounting something free — also
 *     spares the player from accidentally targeting them and watching
 *     the discount fizzle on the floor-at-0 cap).
 * The client UI also guards against picking the resolving card; we
 * send the filter so the server validates correctly.
 */
function _eligibleArtifactIndices(ps, cardDB, resolvingHandIdx) {
  const out = [];
  const hand = ps.hand || [];
  for (let i = 0; i < hand.length; i++) {
    if (i === resolvingHandIdx) continue;
    const cd = cardDB[hand[i]];
    if (!cd || cd.cardType !== 'Artifact') continue;
    if ((cd.cost || 0) <= 0) continue;
    out.push(i);
  }
  return out;
}

module.exports = {
  activeIn: ['hand'],

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least 2 cost > 0 Artifacts in hand so that, after the
    // resolving Play Money is excluded, at least one valid target
    // remains. 0-cost Artifacts are filtered out entirely (discounting
    // a free card does nothing). canActivate runs BEFORE the resolving-
    // card pin is set, so the count includes Play Money itself; a
    // second Play Money copy IS a valid "another" target.
    const dbCache = _getCardDB();
    let costlyArtifactCount = 0;
    for (const name of (ps.hand || [])) {
      const cd = dbCache[name];
      if (cd && cd.cardType === 'Artifact' && (cd.cost || 0) > 0) {
        costlyArtifactCount++;
        if (costlyArtifactCount >= 2) return true;
      }
    }
    return false;
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return { cancelled: true };

    // Resolve the live hand index of THIS Play Money. `_resolvingCard`
    // pins the {name, nth} pair set by doUseArtifactEffect; map it
    // back to the n-th occurrence of `Play Money` in the hand.
    let resolvingIdx = -1;
    if (ps._resolvingCard?.name === CARD_NAME) {
      const targetNth = ps._resolvingCard.nth;
      let seen = 0;
      for (let i = 0; i < ps.hand.length; i++) {
        if (ps.hand[i] === CARD_NAME) {
          seen++;
          if (seen === targetNth) { resolvingIdx = i; break; }
        }
      }
    }

    const cardDB = engine._getCardDB();
    const eligibleIndices = _eligibleArtifactIndices(ps, cardDB, resolvingIdx);
    if (eligibleIndices.length === 0) {
      // Nothing eligible — silent fizzle. The card still resolves
      // (gold paid, goes to discard) per the standard flow.
      return null;
    }

    const picked = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: `Click another Artifact in your hand. Its Cost is reduced by ${COST_REDUCTION} this turn (floor 0).`,
      eligibleIndices,
      confirmLabel: '💰 Discount!',
      cancellable: true,
    });
    if (!picked || picked.cancelled || picked.cardName == null) {
      // Server's doUseArtifactEffect inspects `chainResult.resolveResult.
      // cancelled` to refund the gold cost and leave the card in hand.
      return { cancelled: true };
    }

    const { cardName: chosenName, handIndex } = picked;
    if (handIndex == null || handIndex < 0 || handIndex >= ps.hand.length) return null;
    if (ps.hand[handIndex] !== chosenName) return null;
    // Re-validate eligibility post-prompt — the hand may have shifted
    // mid-prompt via a reaction window. Cheap re-check.
    if (!eligibleIndices.includes(handIndex)) {
      const freshEligible = _eligibleArtifactIndices(ps, cardDB, resolvingIdx);
      if (!freshEligible.includes(handIndex)) return null;
    }

    // Reveal the chosen card to the opponent — same etiquette as other
    // hand-pick effects (Divine Gift of Magic, etc.).
    engine._broadcastEvent('card_reveal', { cardName: chosenName, playerIdx: pi });

    // Stamp the per-hand-index reduction. Cumulative: multiple Play
    // Moneys can stack on the same target; the server caps the
    // resulting cost at 0 in `doPlayArtifact` / `doUseArtifactEffect`.
    if (!ps._handCostReductions) ps._handCostReductions = {};
    ps._handCostReductions[handIndex] = (ps._handCostReductions[handIndex] || 0) + COST_REDUCTION;

    engine.log('play_money_discount', {
      player: ps.username,
      target: chosenName,
      reduction: COST_REDUCTION,
      newReduction: ps._handCostReductions[handIndex],
    });
    engine.sync();
  },
};

// ─── Module-level cards.json cache ─────────────────────────────────────
let _cardDBCache = null;
function _getCardDB() {
  if (_cardDBCache) return _cardDBCache;
  try {
    const allCards = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8')
    );
    _cardDBCache = {};
    allCards.forEach(c => { _cardDBCache[c.name] = c; });
    return _cardDBCache;
  } catch { return {}; }
}
