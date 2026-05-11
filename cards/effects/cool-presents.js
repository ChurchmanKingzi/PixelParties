// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Presents"
//  Artifact (Normal, cost 4) — Crystals
//
//  Add any number of cards with DIFFERENT NAMES
//  from your hand to your opponent's hand. The
//  Artifact's cost is multiplied by the number of
//  cards gifted — so 1 card = 4G, 2 = 8G, 3 = 12G,
//  etc. 0 cards is legal (you discard the Artifact
//  for free).
//
//  Picker semantics (targeting framework):
//   • Multi-select via the standard potion-targeting
//     UI — each hand slot (one per distinct name,
//     excluding the resolving Cool Presents) becomes
//     a `type: 'hand'` target.
//   • `alwaysConfirmable: true` so the Confirm
//     button is always live (0 cards → just discards
//     the Artifact). Same pattern Beer uses for
//     "any number of targets, including 0".
//   • `manualGoldCost: true` + no explicit
//     `maxTotal` → server's auto-cap at
//     `floor(gold / cost)` enforces affordability
//     without the script needing to track gold itself.
//   • `dynamicCostPerTarget: cost` so the Confirm
//     button shows the running total.
//   • Selected cards toggle on re-click (standard
//     `togglePotionTarget` flow); selected slots
//     get the purple `hand-pick-selected` outline
//     instead of grey-dim.
//
//  Cost is paid manually inside `resolve` —
//  `manualGoldCost: true` so the engine skips its
//  default `cost`-deduction step at the play site.
// ═══════════════════════════════════════════

const CARD_NAME = 'Cool Presents';

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,

  /**
   * Optimistic gate — need ≥1 hand card (besides the resolving copy),
   * ≥4 gold (one transfer minimum), and a hand that isn't locked.
   * The opponent's hand-lock is re-checked at resolve time.
   */
  canActivate(gs, pi) {
    const ps = gs.players?.[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;
    if ((ps.gold || 0) < 4) return false;
    // At least 2 cards in hand (Cool Presents + one to give) — though
    // sibling-copy plays can technically count the OTHER copy too, so
    // 2 cards is the floor either way.
    return (ps.hand?.length || 0) >= 2;
  },

  /**
   * One eligible hand-target per DISTINCT NAME in the player's hand,
   * excluding the resolving Cool Presents slot (`handIndex` arg passed
   * by `doUseArtifactEffect`). First occurrence of each name wins —
   * the in-game outcome is identical regardless of which copy is
   * gifted, so the picker stays uncluttered.
   */
  getValidTargets(gs, pi, _engine, handIndex) {
    const ps = gs.players?.[pi];
    if (!ps) return [];
    const seen = new Set();
    const out = [];
    for (let i = 0; i < (ps.hand || []).length; i++) {
      if (i === handIndex) continue;
      const name = ps.hand[i];
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        id: `hand-${pi}-${i}`,
        type: 'hand',
        owner: pi,
        handIndex: i,
        cardName: name,
      });
    }
    return out;
  },

  targetingConfig(_gs, _pi, cost) {
    return {
      description: `Give any number of different-named cards from your hand to your opponent. ${cost || 4} Gold per card.`,
      confirmLabel: '🎁 Give!',
      confirmClass: 'btn-info',
      cancellable: true,
      alwaysConfirmable: true,           // 0 selected is legal — Beer-style
      dynamicCostPerTarget: cost || 4,   // Confirm button shows running total
      maxPerType: { hand: 99 },          // affordability cap auto-applied via manualGoldCost
    };
  },

  validateSelection() { return true; },

  async resolve(engine, pi, selectedIds, validTargets) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oi = pi === 0 ? 1 : 0;
    const ops = gs.players[oi];
    if (!ps || !ops) return { cancelled: true };
    if (ops.handLocked) return { cancelled: true };

    // 0-selection branch — legal, Artifact still resolves and discards
    // for free, no transfers, no gold spent. Matches "any number" → 0.
    if (!selectedIds || selectedIds.length === 0) {
      engine.log('cool_presents_resolve', {
        player: ps.username, gifted: 0, cost: 0,
      });
      return;
    }

    const baseCost = engine._getCardDB()[CARD_NAME]?.cost || 4;
    const targets = selectedIds.map(id => (validTargets || []).find(t => t.id === id))
      .filter(t => t && t.type === 'hand' && t.owner === pi);
    if (targets.length === 0) {
      // Selected IDs don't resolve to hand targets — defensive bail.
      return;
    }

    const totalCost = baseCost * targets.length;
    if ((ps.gold || 0) < totalCost) {
      // Affordability is auto-capped server-side via manualGoldCost,
      // so this is defense-in-depth — bail without committing.
      return;
    }

    ps.gold -= totalCost;
    engine._broadcastEvent('gold_change', { owner: pi, amount: -totalCost });

    // Process in DESCENDING handIndex order so the splice from each
    // transfer doesn't shift indices we still need to process. Cool
    // Presents' own slot may shift as gifted cards leave hand — the
    // engine's standard post-resolve cleanup uses `getResolvingHandIndex`
    // (name lookup), so the artifact's discard still lands correctly.
    const sorted = [...targets].sort((a, b) => b.handIndex - a.handIndex);
    for (const t of sorted) {
      const ok = await engine.actionTransferCardToOppHand(pi, t.handIndex, {
        source: CARD_NAME,
      });
      if (!ok) break; // opp.handLocked mid-loop — bail.
      await engine._delay(150);
    }

    engine.log('cool_presents_resolve', {
      player: ps.username,
      gifted: targets.length,
      cost: totalCost,
    });
    engine.sync();
  },
};
