// ═══════════════════════════════════════════
//  CARD EFFECT: "Lunatic Cycle - New Moon"
//  Artifact (Equipment, Cost 12, Lunatic)
//
//  Equip to a Hero you control (no play
//  precondition — New Moon is the chain's root).
//  While you control a Hero equipped with this,
//  you may ONCE PER TURN discard a card from your
//  hand to search a "Lunatic Cycle" card from
//  your deck, reveal it and add it to your hand.
//  If you do, that card's Cost becomes 4 for the
//  rest of the turn.
//
//  Activated equip effect via the engine's
//  dedicated EQUIP-effect API: `equipEffect: true`
//  + `onEquipEffect` + `canActivateEquipEffect`.
//  The player clicks the New Moon CARD ITSELF in
//  the Support Zone (it highlights via
//  `getActivatableEquips` → `activate_equip_effect`
//  → `doActivateEquipEffect`). Once per turn per
//  instance, auto-enforced by the engine's
//  `equip-effect:<instId>` HOPT (returning `false`
//  rolls it back). Main Phase, free.
//
//  "Cost becomes 4 while it remains in your hand"
//  uses the PERMANENT per-instance reduction field
//  `_handCostReductionsPermanent` (the engine's
//  registerHandIndexedField system auto-remaps it
//  through hand splices/reorders so it follows the
//  physical copy, and it survives turn boundaries —
//  the value-field analogue of Bamboo Shield's
//  `_permanentlyRevealedHandIndices`). The entry
//  is dropped automatically the moment the card
//  leaves the hand.
// ═══════════════════════════════════════════

const { isLunaticCycle } = require('./_lunatic-shared');

const CARD_NAME = 'Lunatic Cycle - New Moon';

/** Distinct Lunatic Cycle names currently in `pi`'s deck. */
function deckLunaticCycleNames(engine, pi) {
  const deck = engine.gs.players[pi]?.mainDeck || [];
  const out = [];
  const seen = new Set();
  for (const n of deck) {
    if (seen.has(n) || !isLunaticCycle(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

module.exports = {
  isEquip: true,
  activeIn: ['support'],
  equipEffect: true, // click the equipped card itself to activate

  canEquipToHero() { return true; }, // chain root — always playable

  canActivateEquipEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    if ((ps.hand || []).length < 1) return false;   // need a card to discard
    if (ps.handLocked) return false;                 // can't add the search → pointless
    return deckLunaticCycleNames(engine, pi).length > 0;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    const targets = deckLunaticCycleNames(engine, pi);
    if (targets.length === 0) return false;
    if ((ps.hand || []).length < 1) return false;

    // ── Step 1: choose a hand card to discard ──
    const eligibleIndices = (ps.hand || []).map((_, i) => i);
    const pick = await engine.promptGeneric(pi, {
      type: 'pickHandCard',
      title: CARD_NAME,
      description: 'Discard 1 card from your hand to search a "Lunatic Cycle" card.',
      instruction: 'Click a card in your hand to discard it.',
      eligibleIndices,
      cancellable: true,
    });
    if (!pick || pick.cancelled || pick.cardName == null) return false;
    // Animate the discard: the chosen card flies from its hand slot to
    // the discard pile. Broadcast the flight BEFORE the state mutation
    // (the source slot must still render); `play_pile_transfer`'s
    // built-in suppressor stops the diff-detector double-firing.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: pick.cardName,
      from: 'hand', to: 'discard', fromHandIdx: pick.handIndex,
    });
    const ok = await engine.actionDiscardHandCard(pi, pick.cardName, pick.handIndex, {
      source: CARD_NAME,
    });
    if (!ok) return false;
    // Commit the discard visually and let the flight land BEFORE the
    // search adds a card. Without the gap, discard (−1) + search (+1)
    // net to a zero hand-size delta in one sync and the own-side
    // draw-animation detector (which keys on "hand grew") never fires —
    // so the searched card would just pop in. Syncing here drops the
    // hand by 1 first, so the subsequent +1 reads as a real draw.
    engine.sync();
    await engine._delay(600);

    // ── Step 2: choose which Lunatic Cycle card to search ──
    const stillThere = deckLunaticCycleNames(engine, pi);
    if (stillThere.length === 0) {
      engine.log('lunatic_new_moon_no_target', { player: ps.username });
      return true; // discard already paid; nothing left to fetch
    }
    let chosen = stillThere[0];
    if (stillThere.length > 1) {
      const gallery = stillThere.map(n => ({ name: n, source: 'deck' }));
      const res = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: 'Search your deck for a "Lunatic Cycle" card to add to your hand.',
        cancellable: false, // the discard is already spent
      });
      if (res && typeof res.cardName === 'string' && stillThere.includes(res.cardName)) {
        chosen = res.cardName;
      }
    }

    // ── Step 3: search → hand (handles splice + reveal + shuffle) ──
    const searched = await engine.searchDeckForNamedCard(pi, chosen, CARD_NAME, {});
    if (!searched) {
      engine.log('lunatic_new_moon_search_failed', { player: ps.username, card: chosen });
      return true;
    }

    // ── Step 4: that card's Cost becomes 4 while it remains in hand ──
    // Permanent (survives turn boundaries) + follows the physical copy
    // through hand mutations via the engine's hand-indexed-field remap.
    const cardDB = engine._getCardDB();
    const baseCost = cardDB[chosen]?.cost || 0;
    const reduction = Math.max(0, baseCost - 4);
    if (reduction > 0) {
      const idx = ps.hand.lastIndexOf(chosen); // the freshly-added copy
      if (idx >= 0) {
        if (!ps._handCostReductionsPermanent) ps._handCostReductionsPermanent = {};
        ps._handCostReductionsPermanent[idx] =
          Math.max(ps._handCostReductionsPermanent[idx] || 0, reduction);
      }
    }

    engine.log('lunatic_new_moon_search', { player: ps.username, card: chosen, costNow: Math.max(0, baseCost - reduction) });
    engine.sync();
    return true;
  },
};
