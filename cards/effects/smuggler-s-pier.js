// ═══════════════════════════════════════════
//  CARD EFFECT: "Smuggler's Pier"
//  Artifact (Area, Cost 5) — Smugglers
//
//  Both players may once per turn, during their
//  turn, pay a multiple of 5 Gold to draw a card
//  for every 5 Gold paid, up to a maximum of 6.
//  If a player draws cards through this effect,
//  they cannot draw cards for the rest of the
//  turn afterwards.
//
//  Implementation
//  ──────────────
//  • This is an Artifact-typed Area, so it routes
//    through `doUseArtifactEffect` (NOT
//    `doPlaySpell` — that's the Spell-Area path
//    used by Crystal Well / Acid Rain). Three
//    pieces glue Artifact + Area together:
//
//      1. `canActivate(gs, pi)` returns false
//         when the player's Area Zone already
//         holds a card. The engine's generic Area
//         gate at `_engine.js` ~L9343 only fires
//         from `validateActionPlay` (the Spell
//         path), so the Artifact path needs an
//         explicit gate here. Identical effect:
//         the play is rejected upstream before
//         any state mutation.
//
//      2. `resolve(engine, pi)` calls
//         `engine.placeArea(pi, inst)` — same
//         helper Crystal Well / Acid Rain use
//         from their `onPlay` hooks. The helper
//         stamps `gs._spellPlacedOnBoard = true`
//         so the Artifact-disposition pass in
//         `doUseArtifactEffect` (see ~L6285)
//         skips the standard hand → discard push.
//
//      3. `areaEffect: true` + `onAreaEffect`
//         open the per-activator HOPT window
//         once the Area is on the board. The
//         engine HOPTs the activation per side
//         automatically.
//
//  • Cost picker — `optionPicker` rendered as a
//    dropdown of all affordable payment tiers
//    (5/10/.../30 Gold → 1–6 cards). Tiers above
//    the player's current gold are dropped from
//    the picker entirely.
//
//  • Hand-lock after drawing — `ps.handLocked =
//    true`. The engine's `actionDrawCards` early-
//    returns when this flag is set (same gate
//    Crystal Well / Acid Rain rely on). The
//    `handLocked` flag is the canonical engine
//    marker for "no more cards into hand this
//    turn"; using it keeps the contract
//    consistent with every other draw-
//    suppression effect.
// ═══════════════════════════════════════════

const CARD_NAME    = "Smuggler's Pier";
const GOLD_PER_CARD = 5;
const MAX_CARDS    = 6;

module.exports = {
  // Active in 'hand' (for the play-time gate) and 'area' (for the
  // per-turn effect window after placement).
  activeIn: ['hand', 'area'],

  /**
   * Play-time gate. The card can only be played from hand when the
   * controller's Area Zone is free — same rule the engine enforces
   * generically for Spell-Areas (`_engine.js` ~L9343), re-stated
   * here because the Artifact path (`doUseArtifactEffect`) doesn't
   * route through that gate. Boomerang's Artifact-lockout is checked
   * upstream and doesn't need to be duplicated here.
   */
  canActivate(gs, pi /*, engine */) {
    if (!gs?.areaZones) return true;
    return (gs.areaZones[pi] || []).length === 0;
  },

  /**
   * Place into the Area Zone. `_resolvingCard` (stamped by
   * `doUseArtifactEffect` before `resolve` runs) lets us locate the
   * specific instance being played even when the controller holds
   * multiple Smuggler's Pier copies. After placement, the engine's
   * post-resolve discard pass sees `gs._spellPlacedOnBoard` and
   * leaves the card on the board (see server.js ~L6285).
   */
  async resolve(engine, pi /*, selectedIds, validTargets */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // Defensive: the play-time gate should already reject this, but
    // an interleaved effect between play-time and resolve could in
    // theory have placed an Area. Bail cleanly without a partial
    // commit.
    if ((gs.areaZones?.[pi] || []).length > 0) return { cancelled: true };

    // Find the resolving inst — the card currently held at the
    // resolving hand-index. `getResolvingHandIndex` returns the
    // index that matches `ps._resolvingCard` (name + nth), and
    // `_findHandInstanceAt` looks up the tracked inst at that index.
    const resolveHi = _getResolvingHandIndex(ps);
    if (resolveHi < 0) return { cancelled: true };
    const inst = engine._findHandInstanceAt(pi, resolveHi);
    if (!inst) return { cancelled: true };

    await engine.placeArea(pi, inst);

    engine.log('smugglers_pier_placed', { player: ps.username });
    engine.sync();
    return true;
  },

  // ── Area effect — both players, once per turn (engine HOPT) ──
  areaEffect: true,

  /**
   * Activatable iff the activator can afford at least the minimum
   * payment (5 Gold = 1 card) AND isn't already locked out of draws
   * for this turn. The engine handles the per-activator once-per-
   * turn gate via its own HOPT machinery.
   */
  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx._activator ?? ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;
    if ((ps.gold || 0) < GOLD_PER_CARD) return false;
    if ((ps.mainDeck || []).length === 0) return false;
    return true;
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx._activator ?? ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;

    const deckSize = (ps.mainDeck || []).length;
    if (deckSize === 0) return false;

    const goldHave = ps.gold || 0;
    const maxByGold = Math.floor(goldHave / GOLD_PER_CARD);
    const maxCards = Math.min(MAX_CARDS, maxByGold, deckSize);
    if (maxCards < 1) return false;

    // Build a dropdown of affordable payment tiers. Each option's
    // label shows BOTH the gold cost and the card count so the player
    // can pick by either dimension without doing the math themselves.
    const options = [];
    for (let cards = 1; cards <= maxCards; cards++) {
      const cost = cards * GOLD_PER_CARD;
      options.push({
        id: `pay-${cards}`,
        label: `${cost} Gold  →  Draw ${cards} card${cards === 1 ? '' : 's'}`,
      });
    }

    const choice = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      renderAs: 'dropdown',
      title: CARD_NAME,
      description: `Pay a multiple of ${GOLD_PER_CARD} Gold (max ${MAX_CARDS * GOLD_PER_CARD}) to draw 1 card per ${GOLD_PER_CARD} Gold. You will not be able to draw any more cards this turn afterwards.`,
      options,
      confirmLabel: '💰 Pay & Draw!',
      cancellable: true,
    });
    if (!choice || choice.cancelled || !choice.optionId) return false;

    const cards = parseInt(String(choice.optionId).replace('pay-', ''), 10);
    if (!Number.isInteger(cards) || cards < 1 || cards > maxCards) return false;

    const cost = cards * GOLD_PER_CARD;
    // Defensive re-check — async prompt could have interleaved an
    // effect that drained gold or capped the deck. Bail without
    // partial payment if the situation changed underneath us.
    if ((ps.gold || 0) < cost) return false;
    if ((ps.mainDeck || []).length < cards) return false;

    ps.gold -= cost;
    await engine.actionDrawCards(pi, cards);

    // Lock further hand-additions for the rest of the turn. This is
    // the engine-canonical flag — turn-start resets it via the
    // standard cleanup path (see `_engine.js` ~L10011).
    ps.handLocked = true;

    engine.log('smugglers_pier_draw', {
      player: ps.username, cards, cost,
    });
    engine.sync();
    return true;
  },
};

/**
 * Local copy of server.js's `getResolvingHandIndex` (re-implemented
 * here so the card script stays self-contained — no cross-process
 * import). Finds the hand index of the Nth occurrence of the
 * resolving card name, matching the `_resolvingCard` stamp that
 * `doUseArtifactEffect` set just before calling `resolve`.
 */
function _getResolvingHandIndex(ps) {
  const rc = ps?._resolvingCard;
  if (!rc?.name) return -1;
  const wantedNth = rc.nth || 1;
  let seen = 0;
  for (let i = 0; i < (ps.hand || []).length; i++) {
    if (ps.hand[i] !== rc.name) continue;
    seen++;
    if (seen === wantedNth) return i;
  }
  return -1;
}
