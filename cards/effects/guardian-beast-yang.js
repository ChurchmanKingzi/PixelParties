// ═══════════════════════════════════════════
//  CARD EFFECT: "Guardian Beast Yang" (Sheep)
//  Creature (Summoning Magic Lv0, 60 HP).
//  Archetype: Guardian Beasts.
//
//  EFFECT (once/turn): choose up to 3 of your
//    opponent's DELETED cards and add them back
//    to their discard pile. If you return 3,
//    draw 2 cards.
//
//  Note: the resurrected cards land in the
//  opponent's discard pile, not yours and not
//  back in their hand. The benefit is purely
//  archetype synergy — Guardian Beasts feed on
//  discard pile contents (Mao's effect, Shu's
//  tutor, Niu's attack bonus, etc.) so handing
//  the opponent ammo for THEIR own discard
//  recursion is the cost. The "delete 3 → draw
//  2" rider is the payoff: your hand grows by
//  the same 2 you "spent" on their pile, plus
//  the 3 returned cards refresh delete-cost
//  fuel for follow-up turns.
// ═══════════════════════════════════════════

const {
  canSummonGuardianBeast,
  inherentActionForFirstSummon,
} = require('./_guardian-beasts-shared');

const CARD_NAME = 'Guardian Beast Yang';
const RETURN_FOR_BONUS = 3;
const BONUS_DRAW = 2;

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canSummon: canSummonGuardianBeast,
  inherentAction: (gs, pi) => inherentActionForFirstSummon(gs, pi),

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const oi = ctx.cardOwner === 0 ? 1 : 0;
    return (engine.gs.players[oi]?.deletedPile?.length || 0) >= 1;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const ops = engine.gs.players[oi];
    if (!ops?.deletedPile?.length) return false;

    const max = Math.min(3, ops.deletedPile.length);
    const gallery = ops.deletedPile.map((name, i) => ({
      name,
      source: 'deleted',
      entryId: `dp-opp-${i}`,
      label: `${name} (opp deleted)`,
    }));

    // Build validCounts: any count from 1 to max (max ≤ 3). Doesn't
    // require an exact pick — the player chooses how many to return.
    const validCounts = [];
    for (let n = 1; n <= max; n++) validCounts.push(n);

    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: gallery,
      title: CARD_NAME,
      description: `Pick 1-${max} of your opponent's deleted cards to return to their discard pile.${max >= RETURN_FOR_BONUS ? ` (Return exactly ${RETURN_FOR_BONUS} → draw ${BONUS_DRAW}.)` : ''}`,
      validCounts,
      cancellable: true,
    });
    if (!result || result.cancelled) return false;

    // Use selectedIndices (gallery indices) to look up entryIds — the
    // canonical mapping. Falls back to legacy name-search if a stale
    // client omits indices.
    const claimed = new Set();
    const indices = [];
    if (Array.isArray(result.selectedIndices) && result.selectedIndices.length > 0) {
      for (const galIdx of result.selectedIndices) {
        const entry = gallery[galIdx];
        if (!entry) continue;
        const m = /^dp-opp-(\d+)$/.exec(entry.entryId || '');
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        if (claimed.has(idx)) continue;
        if (ops.deletedPile[idx] !== entry.name) continue;
        claimed.add(idx);
        indices.push(idx);
      }
    } else if (Array.isArray(result.selectedCards)) {
      for (const raw of result.selectedCards) {
        const name = typeof raw === 'string' ? raw : raw?.cardName || raw?.name;
        if (!name) continue;
        for (let i = 0; i < ops.deletedPile.length; i++) {
          if (claimed.has(i)) continue;
          if (ops.deletedPile[i] !== name) continue;
          claimed.add(i);
          indices.push(i);
          break;
        }
      }
    }
    if (indices.length === 0) return false;

    // Splice descending so earlier indices stay stable.
    indices.sort((a, b) => b - a);
    const returned = [];
    for (const idx of indices) {
      const name = ops.deletedPile[idx];
      if (name == null) continue;
      ops.deletedPile.splice(idx, 1);
      ops.discardPile.push(name);
      returned.push(name);
    }

    if (returned.length === 0) return false;

    // Visual: fly each returned card from the opponent's deleted pile
    // back to their discard pile. Mirrors the discard→deleted flight
    // used for delete costs (green-cyan glow distinguishes "rescued
    // from oblivion" from "sent to oblivion"). One broadcast per
    // owner — Yang only ever touches the opponent's pile, so a single
    // event with the full list is enough.
    engine._broadcastEvent('deleted_to_discard_animation', {
      owner: oi,
      cardNames: returned,
      source: CARD_NAME,
    });

    engine.log('guardian_beast_yang_return', {
      player: engine.gs.players[pi]?.username,
      returned: returned.length,
      cards: returned,
    });

    if (returned.length === RETURN_FOR_BONUS) {
      await engine.actionDrawCards(pi, BONUS_DRAW);
    }
    engine.sync();
    return true;
  },
};
