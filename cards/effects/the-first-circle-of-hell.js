// ═══════════════════════════════════════════
//  CARD EFFECT: "The First Circle of Hell"
//  Spell (Destruction Magic Lv1, Area)
//  Archetype: Hell Circles. BANNED.
//
//  EFFECT (passive, while in Area zone):
//   • At the BEGINNING of either player's turn,
//     if the number of cards in that player's
//     discard pile is ODD, delete them all.
//   • At the END of either player's turn, if
//     the number of cards in that player's
//     deleted pile is EVEN, return them all to
//     their discard pile.
//
//  IMPLEMENTATION:
//   • Self-place into the caster's Area zone via
//     the standard onPlay → placeArea path
//     (mirrors Acid Rain / Graveyard of Limited
//     Power / Cosmic Depths).
//   • onTurnStart hook checks ctx.activePlayer's
//     discard parity and mass-deletes via the
//     standard `_tryBeforeDelete` rescue gate, so
//     Cute Hydra-style "save myself from delete"
//     listeners still get a chance.
//   • onTurnEnd hook checks the same player's
//     deleted-pile parity and mass-returns. No
//     rescue gate on the return path (cards moving
//     out of the deleted pile aren't being deleted).
//   • Both mass-moves broadcast the standard
//     pile-flight animations (`discard_to_deleted_
//     animation`, `deleted_to_discard_animation`)
//     so the visual continuity matches the
//     Guardian Beast picker's deletions and Yang's
//     reanimations.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'The First Circle of Hell';

/** Mass-delete every card in `pi`'s discard pile. Walks end-to-start
 *  so splices stay index-stable, fires `_tryBeforeDelete` per card so
 *  rescue listeners can intercept, and broadcasts ONE batched flight
 *  animation per call. */
async function massDeleteDiscardPile(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.discardPile?.length) return [];
  const moved = [];
  for (let idx = ps.discardPile.length - 1; idx >= 0; idx--) {
    const name = ps.discardPile[idx];
    const rescued = await engine._tryBeforeDelete(name, pi, {
      fromZone: 'discard', fromInstance: null, source: CARD_NAME,
    });
    if (rescued) continue;
    ps.discardPile.splice(idx, 1);
    ps.deletedPile = ps.deletedPile || [];
    ps.deletedPile.push(name);
    engine.log('card_deleted', {
      card: name, player: ps.username, source: CARD_NAME,
    });
    // Build animation list in original front-to-back order — we
    // walked the array backwards, so unshift restores the visual
    // order the player originally laid the discards down in.
    moved.unshift(name);
  }
  if (moved.length > 0) {
    engine._broadcastEvent('discard_to_deleted_animation', {
      owner: pi, cardNames: moved, source: CARD_NAME,
    });
    engine.sync();
  }
  return moved;
}

/** Mass-return every card in `pi`'s deleted pile back to the discard
 *  pile. No rescue gate — this path isn't "deleting" anything.
 *
 *  Cards that opt into `selfDeleteOnExternalDiscard` (Rebelliokai
 *  Creatures, etc.) self-delete the moment they would land in the
 *  discard pile from this "anywhere except hand or board" source.
 *  Per the rule, we still let them transit through the discard pile
 *  in game state (so the player sees discardPile +1 then -1 / deletedPile
 *  +1 in sync with the animations). The transit handler
 *  `_scheduleSelfDeleteTransit` schedules each redirected card's
 *  splice + chained discard→deleted flight + final deletedPile push
 *  using the same timings the mill path uses. */
function massReturnDeletedPile(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps?.deletedPile?.length) return [];
  const returned = ps.deletedPile.slice();
  ps.deletedPile.length = 0;
  ps.discardPile = ps.discardPile || [];

  const redirected = [];
  for (const name of returned) {
    const script = loadCardEffect(name);
    if (script?.selfDeleteOnExternalDiscard) {
      // Defer the pile pushes to `_scheduleSelfDeleteTransit` so the
      // discardPile UI count only goes up when the deleted→discard
      // flying animation visually lands at the discard pile. Pushing
      // here would make the card appear in the discard pile UI
      // immediately on the next sync — before the visual flying
      // animation has even reached the pile rect.
      redirected.push(name);
    } else {
      ps.discardPile.push(name);
    }
  }

  engine._broadcastEvent('deleted_to_discard_animation', {
    owner: pi, cardNames: returned, source: CARD_NAME,
  });

  if (redirected.length > 0) {
    // landAtMs per card mirrors the deleted_to_discard_animation's
    // 160ms per-card stagger + 560ms visual-landing offset (80% of
    // the 700ms travel).
    const schedule = redirected.map(name => ({
      name,
      landAtMs: returned.indexOf(name) * 160 + 560,
    }));
    engine._scheduleSelfDeleteTransit(pi, schedule, {
      source: `${CARD_NAME} return → self-delete`,
    });
  }

  engine.log('first_circle_return', {
    player: ps.username,
    count: returned.length,
    redirected: redirected.length,
    source: CARD_NAME,
  });
  engine.sync();
  return returned;
}

module.exports = {
  // 'hand' for the self-cast onPlay; 'area' for the passive turn hooks.
  activeIn: ['hand', 'area'],

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },

    /** Beginning-of-turn delete: discard parity must be ODD. */
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const pi = ctx.activePlayer;
      if (pi == null || pi < 0) return;
      const dp = engine.gs.players[pi]?.discardPile;
      if (!dp || dp.length === 0) return;
      if (dp.length % 2 !== 1) return; // even → no-op
      await massDeleteDiscardPile(engine, pi);
    },

    /** End-of-turn return: deleted-pile parity must be EVEN AND > 0. */
    onTurnEnd: async (ctx) => {
      if (ctx.cardZone !== 'area') return;
      const engine = ctx._engine;
      const pi = ctx.activePlayer;
      if (pi == null || pi < 0) return;
      const dPile = engine.gs.players[pi]?.deletedPile || [];
      if (dPile.length === 0) return;        // 0 is even but no-op
      if (dPile.length % 2 !== 0) return;    // odd → no-op
      massReturnDeletedPile(engine, pi);
    },
  },
};
