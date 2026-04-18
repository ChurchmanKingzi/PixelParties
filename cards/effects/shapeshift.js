// ═══════════════════════════════════════════
//  CARD EFFECT: "Shapeshift"
//  Spell (Summoning Magic Lv0, Normal)
//
//  Pick one of your own Creatures on the board,
//  then pick a different-named Creature with
//  level ≤ that Creature's from your hand. The
//  two are swapped atomically — bounced creature
//  flies to hand, new creature flies in, new
//  creature's on-summon fires. Same UX /
//  animation as Deepsea Castle's click-to-swap.
//
//  Action economy:
//   • Inherent additional action as long as at
//     least 1 of your Creatures NOT summoned
//     this turn has an eligible replacement.
//   • When used as additional (Action Phase
//     after the main Action, or Main Phase),
//     only not-summoned-this-turn Creatures can
//     be targeted — the card has no "main
//     Action" to spend.
//   • When used with a main Action available
//     (Action Phase, fresh), ANY own Creature
//     is a valid target. If the bounced Creature
//     was NOT summoned this turn the spell
//     declares itself a free action
//     (`gs._spellFreeAction = true`) and the
//     main Action / consumed additional slot is
//     refunded by the server.
// ═══════════════════════════════════════════

const {
  ownSupportCreatures,
  eligibleSwapReplacements,
  atomicSwap,
} = require('./_deepsea-shared');

const CARD_NAME = 'Shapeshift';

/** Count own creatures on board whose turnPlayed predates the current turn. */
function _hasOldCreatureWithReplacement(engine, pi) {
  const gs = engine.gs;
  const turn = gs.turn || 0;
  const creatures = ownSupportCreatures(engine, pi);
  const cardDB = engine._getCardDB();
  for (const inst of creatures) {
    if ((inst.turnPlayed || 0) >= turn) continue;
    const lvl = cardDB[inst.name]?.level ?? 0;
    if (eligibleSwapReplacements(engine, pi, inst.name, lvl).length > 0) return true;
  }
  return false;
}

/** True if ANY own creature has an eligible replacement (no turn filter). */
function _hasAnySwappable(engine, pi) {
  const creatures = ownSupportCreatures(engine, pi);
  const cardDB = engine._getCardDB();
  for (const inst of creatures) {
    const lvl = cardDB[inst.name]?.level ?? 0;
    if (eligibleSwapReplacements(engine, pi, inst.name, lvl).length > 0) return true;
  }
  return false;
}

module.exports = {
  // Inherent additional action is granted specifically when a not-
  // summoned-this-turn target with a valid replacement exists. The
  // engine consults this to decide whether the card can be played
  // without spending the turn's Action. Summon-locked players (e.g.
  // after an Infected Squirrel self-bounce) can't use this at all —
  // Shapeshift places a new Creature on the board.
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (gs.players[pi]?.summonLocked) return false;
    return _hasOldCreatureWithReplacement(engine, pi);
  },

  spellPlayCondition: (gs, pi, engine) => {
    if (gs.players[pi]?.summonLocked) return false;
    if (!engine) return true;
    return _hasAnySwappable(engine, pi);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      // Summon-lock catch-all. canActivate / spellPlayCondition should
      // already block this, but we re-check here since the server's
      // spell pipeline can reach onPlay via routes that didn't call
      // those predicates (surprise flips, chained reactions, etc.).
      if (ps.summonLocked) { gs._spellCancelled = true; return; }
      const cardDB = engine._getCardDB();

      // "Played as an additional action" heuristic: either not in the
      // Action Phase at all (Main Phase casts never spend an Action to
      // begin with, so there's no main-Action slot in play) OR the
      // main Action has already been consumed earlier in the Action
      // Phase. In either case the card fills only the additional-action
      // slot and is bound by the not-summoned-this-turn restriction.
      const isActionPhase = gs.currentPhase === 3;
      const actionAlreadyUsed = isActionPhase && (ps.heroesActedThisTurn?.length || 0) > 0;
      const asAdditional = !isActionPhase || actionAlreadyUsed;

      // Build the pickable-creature list — filtered by the additional-
      // action restriction when applicable.
      const turn = gs.turn || 0;
      const allOwn = ownSupportCreatures(engine, pi);
      const creatures = asAdditional
        ? allOwn.filter(inst => (inst.turnPlayed || 0) < turn)
        : allOwn;
      // Only offer creatures that actually have at least one valid
      // replacement — otherwise the hand-pick prompt would dead-end.
      const pickable = creatures.filter(inst => {
        const lvl = cardDB[inst.name]?.level ?? 0;
        return eligibleSwapReplacements(engine, pi, inst.name, lvl).length > 0;
      });
      if (pickable.length === 0) { gs._spellCancelled = true; return; }

      // ── Step 1: pick which own Creature to bounce ─────────────────
      const zones = pickable.map(inst => {
        const hero = ps.heroes[inst.heroIdx];
        const lvl = cardDB[inst.name]?.level ?? 0;
        return {
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          label: `${hero?.name || 'Hero'} — ${inst.name} (Lv${lvl}, Slot ${inst.zoneSlot + 1})`,
        };
      });
      const picked = await ctx.promptZonePick(zones, {
        title: CARD_NAME,
        description: asAdditional
          ? 'Pick one of your Creatures NOT summoned this turn to swap OUT.'
          : 'Pick one of your own Creatures to swap OUT.',
        cancellable: true,
      });
      if (!picked) { gs._spellCancelled = true; return; }
      const chosenInst = pickable.find(i =>
        i.heroIdx === picked.heroIdx && i.zoneSlot === picked.slotIdx
      );
      if (!chosenInst) { gs._spellCancelled = true; return; }
      const chosenName = chosenInst.name;
      const chosenLevel = cardDB[chosenName]?.level ?? 0;
      const bouncedWasThisTurn = (chosenInst.turnPlayed || 0) >= turn;

      // ── Step 2: pick the replacement in hand via pickHandCard ─────
      const replacements = eligibleSwapReplacements(engine, pi, chosenName, chosenLevel);
      if (replacements.length === 0) { gs._spellCancelled = true; return; }
      const eligibleNames = new Set(replacements.map(r => r.name));
      const eligibleIndices = [];
      for (let i = 0; i < (ps.hand || []).length; i++) {
        if (eligibleNames.has(ps.hand[i])) eligibleIndices.push(i);
      }
      const rpick = await engine.promptGeneric(pi, {
        type: 'pickHandCard',
        title: `${CARD_NAME} — Swap In`,
        description: `Pick a different-named Creature with level ≤ ${chosenLevel} to take ${chosenName}'s place.`,
        instruction: 'Click a highlighted card in your hand.',
        eligibleIndices,
        cancellable: true,
      });
      if (!rpick || rpick.cancelled) { gs._spellCancelled = true; return; }
      const newName = rpick.cardName;
      if (!newName) { gs._spellCancelled = true; return; }
      const newLevel = cardDB[newName]?.level ?? 0;
      if (newLevel > chosenLevel || newName === chosenName) {
        gs._spellCancelled = true; return;
      }

      // ── Step 3: atomic swap ───────────────────────────────────────
      await atomicSwap(engine, pi, chosenInst, newName, CARD_NAME);
      engine.log('shapeshift_swap', {
        player: ps.username, bounced: chosenName, placed: newName,
        bouncedLevel: chosenLevel, placedLevel: newLevel,
      });

      // Free-action refund: swapping a Creature NOT summoned this turn
      // doesn't consume the main Action / additional slot. The server
      // reads _spellFreeAction after the spell resolves and refunds the
      // consumed slot.
      if (!bouncedWasThisTurn) {
        gs._spellFreeAction = true;
      }
      engine.sync();
    },
  },
};
