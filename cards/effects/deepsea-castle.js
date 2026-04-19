// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Castle"
//  Spell (Magic Arts Lv1, Area)
//
//  Both players may, once per turn, click the
//  Castle to swap any own Creature they control
//  for a different-named Creature from their
//  hand whose level is at or below the LEVEL OF
//  THE CREATURE BEING BOUNCED. Not archetype-
//  locked (any Creature qualifies) and there is
//  no "not summoned this turn" restriction.
//
//  Flow — two picks, then one atomic swap:
//    1. Click Castle (area-effect activation).
//    2. Pick which of your own Creatures to
//       swap out (promptZonePick over every
//       own Creature on the board). Cancelling
//       here aborts cleanly — no mutation.
//    3. Pick the replacement from hand
//       (promptCardGallery filtered to
//       different-named Creatures whose level
//       ≤ the bounced Creature's level).
//       Cancelling here also aborts cleanly.
//    4. Swap atomically: bounce out + place in
//       ship in ONE sync, matching the look
//       of a Deepsea bounce-place. The old
//       Creature flies to hand while the new
//       one settles into its slot.
//
//  The activating player is always the active
//  player (`ctx._activator`) regardless of who
//  placed the Castle — the effect reads their
//  OWN board + hand.
// ═══════════════════════════════════════════

const {
  ownSupportCreatures,
  eligibleSwapReplacements,
  atomicSwap,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Castle';

module.exports = {
  // Active in 'hand' so the self-cast onPlay fires from hand, and in
  // 'area' so board-state hooks stay live once placed.
  activeIn: ['hand', 'area'],
  areaEffect: true,

  /**
   * The active player can activate whenever they have:
   *   1. Any own Creature on the board.
   *   2. AT LEAST ONE of those Creatures has at least one eligible
   *      replacement (different-named Creature in hand whose level ≤
   *      the bounced Creature's level).
   * The engine's HOPT gate blocks subsequent activations in the
   * same turn automatically.
   */
  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const activator = ctx._activator ?? engine.gs.activePlayer;
    if (activator == null || activator < 0) return false;
    // Player-wide summon lock: Castle's swap places a new Creature on
    // the board, so it's blocked by the same gate as a normal summon.
    if (engine.gs.players[activator]?.summonLocked) return false;
    const creatures = ownSupportCreatures(engine, activator);
    if (creatures.length === 0) return false;
    const cardDB = engine._getCardDB();
    for (const inst of creatures) {
      const lvl = cardDB[inst.name]?.level ?? 0;
      if (eligibleSwapReplacements(engine, activator,inst.name, lvl).length > 0) return true;
    }
    return false;
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const activator = ctx._activator ?? gs.activePlayer;
    if (activator == null || activator < 0) return false;
    const ps = gs.players[activator];
    if (!ps) return false;
    // Defence-in-depth summon-lock gate — canActivateAreaEffect should
    // already hide the button, but the server's activate_area_effect
    // socket handler still reaches this path directly.
    if (ps.summonLocked) return false;
    const cardDB = engine._getCardDB();

    // Synthetic ctx so prompts route to the activator (which may not be
    // the Castle's owner — Castle is activatable from both sides).
    const pseudoInst = {
      id: 'deepsea-castle-pseudo',
      name: CARD_NAME, owner: activator, controller: activator,
      zone: 'area', heroIdx: -1, zoneSlot: -1, counters: {}, faceDown: false,
    };
    const promptCtx = engine._createContext(pseudoInst, {});

    // ── Step 1: pick which own Creature to bounce ─────────────────
    const creatures = ownSupportCreatures(engine, activator);
    if (creatures.length === 0) return false;
    // Only offer creatures that have at least one valid replacement —
    // otherwise the second prompt would dead-end with no options.
    const pickable = creatures.filter(inst => {
      const lvl = cardDB[inst.name]?.level ?? 0;
      return eligibleSwapReplacements(engine, activator,inst.name, lvl).length > 0;
    });
    if (pickable.length === 0) return false;
    const zones = pickable.map(inst => {
      const hero = ps.heroes[inst.heroIdx];
      const lvl = cardDB[inst.name]?.level ?? 0;
      return {
        heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        label: `${hero?.name || 'Hero'} — ${inst.name} (Lv${lvl}, Slot ${inst.zoneSlot + 1})`,
      };
    });
    const picked = await promptCtx.promptZonePick(zones, {
      title: CARD_NAME,
      description: 'Pick one of your own Creatures to swap OUT.',
      cancellable: true,
    });
    if (!picked) return false;
    const chosenInst = pickable.find(i =>
      i.heroIdx === picked.heroIdx && i.zoneSlot === picked.slotIdx
    );
    if (!chosenInst) return false;
    const chosenName = chosenInst.name;
    const chosenLevel = cardDB[chosenName]?.level ?? 0;

    // ── Step 2: pick the replacement (level ≤ bounced creature's level) ──
    //
    // Rather than a modal card gallery, highlight the eligible cards
    // IN the player's hand itself and let them click one — much more
    // immediate than "scroll through a list of card thumbnails". Uses
    // the generic pickHandCard prompt; ineligible cards dim while
    // eligible ones pulse with the purple pick outline.
    const replacements = eligibleSwapReplacements(engine, activator,chosenName, chosenLevel);
    if (replacements.length === 0) return false;

    const eligibleNames = new Set(replacements.map(r => r.name));
    const eligibleIndices = [];
    for (let i = 0; i < (ps.hand || []).length; i++) {
      if (eligibleNames.has(ps.hand[i])) eligibleIndices.push(i);
    }

    const rpick = await engine.promptGeneric(activator, {
      type: 'pickHandCard',
      title: `${CARD_NAME} — Swap In`,
      description: `Pick a different-named Creature with level ≤ ${chosenLevel} to take ${chosenName}'s place.`,
      instruction: 'Click a highlighted card in your hand.',
      eligibleIndices,
      cancellable: true,
    });
    if (!rpick || rpick.cancelled) return false;
    const newName = rpick.cardName;
    if (!newName) return false;

    // Sanity re-verify the replacement's level + name gate (guards
    // against stale state if anything raced in between prompts).
    const newLevel = cardDB[newName]?.level ?? 0;
    if (newLevel > chosenLevel) return false;
    if (newName === chosenName) return false;

    // ── Step 3: atomic swap ─────────────────────────────────────
    // atomicSwap runs the replacement Creature's beforeSummon hook. If
    // it aborts (sacrifice/tribute cancelled, or the card placed itself
    // via its own hook — e.g. Dark Deepsea God), return false so Castle
    // doesn't log a swap that didn't happen.
    const swap = await atomicSwap(engine, activator, chosenInst, newName, CARD_NAME);
    if (!swap) return false;
    engine.log('deepsea_castle_swap', {
      player: ps.username, bounced: chosenName, placed: newName,
      bouncedLevel: chosenLevel, placedLevel: newLevel,
    });
    return true;
  },

  hooks: {
    onPlay: async (ctx) => {
      // Self-placement on cast. Only fires when THIS instance is being
      // played from hand (not when some other card's onPlay bubbles
      // through while Castle sits on the area zone).
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },
};
