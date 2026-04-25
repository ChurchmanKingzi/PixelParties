// ═══════════════════════════════════════════
//  CARD EFFECT: "Xiong, the Bamboo Guardian"
//  Hero — 450 HP, 100 ATK
//  Starting abilities: Biomancy, Fighting
//
//  Whenever this Hero defeats a target with an
//  Attack, you may choose a card from either
//  player's discard pile and add it to your hand.
//
//  Wiring:
//    • `afterDamage` listener — covers Hero
//      targets killed by Xiong's Attack.
//      `processCreatureDamageBatch` does NOT fire
//      `afterDamage` per creature, so creature
//      kills are handled by a separate
//      `onCreatureDeath` listener.
//    • Per-victim trigger: each kill gets its own
//      cancellable gallery prompt. AoE Attacks
//      that wipe N targets generate up to N
//      consecutive tutor prompts.
//    • In-resolution Attack exclusion: the engine
//      stamps `ps._resolvingCard` while a played
//      card is mid-resolution. At our trigger
//      point that Attack hasn't been pushed to
//      discard yet, but we filter its name out of
//      the gallery defensively in case any future
//      Attack discards before damage finalizes.
//    • The hand-recovery itself goes through the
//      central `addCardFromDiscardToHand` helper,
//      which fires the
//      `onCardAddedFromDiscardToHand` hook —
//      Bamboo Staff hears it, Bamboo Shield uses
//      it for its cost-reveal mechanic.
//    • Both piles share a single gallery
//      (deduplicated, summed counts). On pick we
//      prefer the player's own pile, falling back
//      to the opponent's — straightforward UX
//      that doesn't burden the player with a
//      "from which pile?" follow-up question.
// ═══════════════════════════════════════════

const CARD_NAME = 'Xiong, the Bamboo Guardian';

/**
 * Did `source` come from THIS Xiong's slot? Heroes are identified by
 * (originalOwner, heroIdx) — charm doesn't migrate the physical slot.
 */
function isFromThisXiong(ctx, source) {
  if (!source) return false;
  const owner = source.owner ?? source.controller;
  if (owner !== ctx.cardOriginalOwner) return false;
  if (source.heroIdx !== ctx.card.heroIdx) return false;
  return true;
}

/** Xiong himself must still be alive to use his trigger. */
function xiongAlive(ctx) {
  const hero = ctx._engine.gs.players[ctx.cardOriginalOwner]
    ?.heroes?.[ctx.card.heroIdx];
  return !!(hero?.name && hero.hp > 0);
}

/**
 * Pull a single card from EITHER player's discard pile into Xiong's
 * controller's hand. Uses the engine helper so the universal
 * `onCardAddedFromDiscardToHand` hook fires (Bamboo Staff free-attack
 * chain, Bamboo Shield cost-reveal, …).
 */
async function tryTutor(ctx) {
  const engine = ctx._engine;
  const gs     = engine.gs;
  const pi     = ctx.cardOriginalOwner;
  const ownPs  = gs.players[pi];
  if (!ownPs) return;
  if (ownPs.handLocked) return;

  // Build the combined gallery from both piles. The Attack mid-
  // resolution (`_resolvingCard`) is excluded — it has not yet been
  // pushed to discard at this trigger point, but we filter
  // defensively.
  const exclude = new Set();
  const resolving = ownPs._resolvingCard?.name;
  if (resolving) exclude.add(resolving);

  const counts = new Map();
  for (let owner = 0; owner < gs.players.length; owner++) {
    const dp = gs.players[owner]?.discardPile || [];
    for (const name of dp) {
      if (exclude.has(name)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  if (counts.size === 0) return;

  const galleryCards = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => ({ name, source: 'discard', count }));

  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: galleryCards,
    title: CARD_NAME,
    description: `Choose a card from either discard pile to add to your hand.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return;

  // Prefer own pile; fall back to opponent's. Card names are unique
  // per copy in a pile, so as long as the gallery offered the name,
  // at least one of the piles still has it.
  const oi = pi === 0 ? 1 : 0;
  const fromOwner = (gs.players[pi]?.discardPile || []).includes(picked.cardName)
    ? pi
    : (gs.players[oi]?.discardPile || []).includes(picked.cardName) ? oi : -1;
  if (fromOwner < 0) return;

  await engine.addCardFromDiscardToHand(pi, picked.cardName, fromOwner, {
    source: CARD_NAME,
  });
  engine.sync();
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * Hero target killed by Xiong's Attack. Fires once per damaged
     * Hero target, post-HP-application — `target.hp <= 0` is the kill
     * signal.
     */
    afterDamage: async (ctx) => {
      if (ctx.type !== 'attack') return;
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      if (target.hp > 0) return;
      if (!isFromThisXiong(ctx, ctx.source)) return;
      if (!xiongAlive(ctx)) return;
      await tryTutor(ctx);
    },

    /**
     * Creature target killed by Xiong's Attack. The creature damage
     * batch path does NOT fire afterDamage per creature, so we hook
     * onCreatureDeath separately. The engine carries the death's
     * damage `type` on the hook ctx (added alongside this card) so
     * we can filter to attacks only without inspecting the source's
     * cardType.
     */
    onCreatureDeath: async (ctx) => {
      if (ctx.type !== 'attack') return;
      if (!isFromThisXiong(ctx, ctx.source)) return;
      if (!xiongAlive(ctx)) return;
      await tryTutor(ctx);
    },
  },
};
