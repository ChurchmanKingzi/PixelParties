// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Friendly Fireballer"
//  Creature (Summoning Magic Lv1, 50 HP)
//
//  Two pieces:
//
//   1. Passive (in Support Zone): "Whenever you sacrifice a Creature
//      you control, EXCEPT with this Creature's effect, you may openly
//      add a 'Fireball' Spell from deck or discard pile to your hand."
//      The except-clause prevents the active mode (which spends a
//      Fireball) from immediately refilling it — we skip when the
//      sacrifice's source is a Friendly Fireballer effect.
//
//   2. Active (creatureEffect): "You may once per turn sacrifice a
//      Creature you control that was not summoned this turn to have
//      this Creature perform a 'Fireball' Spell from your hand as an
//      additional Action, ignoring its level, but if you do, DELETE
//      that 'Fireball' Spell."
//      The sub-cast uses the canonical `runHooks('onPlay')` path
//      (Timeless King Zi / Chaos Magic), which bypasses
//      `validateActionPlay` → level & school requirements ignored.
//      The performed Fireball goes to the DELETED pile, not the
//      discard pile — that closes the tutor⇄perform recursion loop,
//      since the passive can only pull a Fireball back from deck or
//      discard. Disposal follows the engine's hand→deleted contract:
//      `_handCardPileOwner` routing for stolen copies, a
//      `beforeDelete` rescue gate, a zone-anchored flight whose pile
//      push is deferred until the flight lands, and an `onDelete`
//      hook fire for pile-resident listeners.
// ═══════════════════════════════════════════

const { chaorcSacrificeFilter, chaorcFreshSacCandidates, isOwnSacrifice } = require('./_chaorcs-shared');

const CARD_NAME = 'Chaorc Friendly Fireballer';
const FIREBALL = 'Fireball';

/** Available "Fireball" copies in the controller's deck + discard. */
function fireballSources(engine, pi) {
  const ps = engine.gs.players[pi];
  const out = [];
  if ((ps?.mainDeck || []).includes(FIREBALL)) out.push('deck');
  if ((ps?.discardPile || []).includes(FIREBALL)) out.push('discard');
  return out;
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  requiresTarget: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;
    // Need a Fireball in hand to perform, and a legal Chaorc sacrifice.
    if (!(ps.hand || []).includes(FIREBALL)) return false;
    return chaorcFreshSacCandidates(engine, pi, ctx.card.id).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps || !(ps.hand || []).includes(FIREBALL)) return false;

    // ── Pay the sacrifice (not summoned this turn; Cannon Fodder
    //    exception via the shared filter). ──
    const paid = await engine.resolveSacrificeCost(ctx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn) to perform a Fireball, ignoring its level. The Fireball is deleted afterwards.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: chaorcSacrificeFilter(engine),
    });
    if (!paid) return false;

    // A Fireball could in theory have left the hand during the
    // sacrifice's reaction window — re-check.
    if (!(ps.hand || []).includes(FIREBALL)) { engine.sync(); return true; }
    // Reuse the existing tracked hand instance (hand cards are tracked).
    // Crucially, KEEP the Fireball in hand (don't splice it yet) so it
    // stays visible while the player picks targets — it only flies to
    // the discard pile once it actually resolves (below). Splicing it
    // up-front made the card vanish the instant the effect activated.
    let subInst = engine.findCards({ owner: pi, zone: 'hand', name: FIREBALL })[0];
    if (!subInst) subInst = engine._trackCard(FIREBALL, pi, 'hand', -1, -1);

    // Stamp THIS Creature's board position onto the sub-instance for the
    // cast so Fireball originates its projectiles from the Fireballer
    // itself: it reads the source Hero column from `ctx.cardHeroIdx`
    // (= instance heroIdx) and the source slot from `ctx.card.zoneSlot`.
    // A hand instance carries heroIdx/zoneSlot -1 (no on-board origin),
    // so the projectiles wouldn't fly. The Creature is consumed by the
    // perform either way, so no restore is needed.
    subInst.heroIdx = heroIdx;
    subInst.zoneSlot = ctx.card.zoneSlot;

    // ── Perform the Fireball from hand, ignoring its level. ──
    gs._spellDamageLog = [];
    gs._spellExcludeTargets = [];
    delete gs._spellPlacedOnBoard;
    delete gs._spellCancelled;
    delete gs._spellNegatedByEffect;
    const cardDB = engine._getCardDB();
    try {
      await engine.runHooks('onPlay', {
        _onlyCard: subInst, playedCard: subInst,
        cardName: FIREBALL, zone: 'hand', heroIdx,
        _skipReactionCheck: true,
        // No opt-out — the sacrifice is already paid, so Fireball's
        // targeting is non-cancellable (see fireball.js).
        _forcePerform: true,
      });
      const uniqueTargets = [];
      const seenIds = new Set();
      for (const t of (gs._spellDamageLog || [])) {
        if (!seenIds.has(t.id)) { seenIds.add(t.id); uniqueTargets.push(t); }
      }
      await engine.runHooks('afterSpellResolved', {
        spellName: FIREBALL, spellCardData: cardDB[FIREBALL],
        heroIdx, casterIdx: pi, damageTargets: uniqueTargets,
        isSecondCast: false, _skipReactionCheck: true,
      });
    } catch (err) {
      console.error(`[${CARD_NAME}] sub-Fireball error:`, err?.message || err);
    }
    const placedOnBoard = !!gs._spellPlacedOnBoard;
    delete gs._spellDamageLog;
    delete gs._spellExcludeTargets;
    delete gs._spellPlacedOnBoard;
    delete gs._spellCancelled;
    delete gs._spellNegatedByEffect;

    // The Fireball is forced (no opt-out once the sacrifice is paid), so
    // after the perform it always leaves the hand — and per the card
    // text it is DELETED, not discarded.
    // (Fireball never places itself on the board, but guard anyway.)
    if (!placedOnBoard) {
      const finalHandIdx = (ps.hand || []).indexOf(FIREBALL);
      if (finalHandIdx >= 0) {
        // Stolen copies land in their ORIGINAL owner's deleted pile —
        // the engine's hand→pile routing contract. Resolved BEFORE the
        // splice / re-home, since the helper looks up a hand instance.
        const pileOwner = engine._handCardPileOwner(pi, FIREBALL);
        const pilePs = gs.players[pileOwner] || ps;

        // Splice first, then the rescue gate — the engine's own delete
        // paths (actionPromptForceDiscard, enforceHandLimit) do it in
        // this order: the card leaves the hand either way (it WAS
        // performed), a rescue only cancels the deleted-pile landing.
        ps.hand.splice(finalHandIdx, 1);

        const rescued = await engine._tryBeforeDelete(FIREBALL, pi, {
          fromZone: 'hand', fromInstance: subInst, source: CARD_NAME,
        });

        if (rescued) {
          // A rescuer (Cute Hydra & co.) claimed the card and made its
          // own arrangements — no pile push, no flight, no onDelete.
          engine._untrackCard(subInst.id);
          engine.log('delete_rescued', {
            player: ps.username, card: FIREBALL, source: CARD_NAME,
          });
        } else {
          // Broadcast BEFORE any sync so the client still finds the
          // hand slot and pins the flight's source rect to it.
          engine._broadcastEvent('play_pile_transfer', {
            owner: pi, cardName: FIREBALL,
            from: 'hand', to: 'deleted', fromHandIdx: finalHandIdx,
            ...(pileOwner !== pi ? { fromOwner: pi, toOwner: pileOwner } : {}),
          });
          // Re-home the instance instead of untracking it: cards that
          // listen from the deleted pile (`activeIn: ['deleted']`)
          // need a tracked inst there. Clear the board coordinates we
          // stamped on above for the projectile origin, or the card
          // lingers as a board-anchored deleted inst.
          subInst.zone = 'deleted';
          subInst.owner = pileOwner;
          subInst.heroIdx = -1;
          subInst.zoneSlot = -1;
          // Hand shrinks now (flight overlay takes over), pile push is
          // DEFERRED until the flight lands — there is no client-side
          // "hide pile card until it arrives" for pile destinations, so
          // an immediate push pops the card into the deleted pile at
          // flight START (same rationale as the engine's
          // `routeNegatedInitialCard`).
          engine.sync();
          await engine._delay(650);
          if (!pilePs.deletedPile) pilePs.deletedPile = [];
          pilePs.deletedPile.push(FIREBALL);
          engine.log('card_deleted', {
            player: ps.username, card: FIREBALL, source: CARD_NAME,
          });
          await engine.runHooks('onDelete', {
            playerIdx: pi, card: subInst, cardName: FIREBALL,
            discardedCardName: FIREBALL, discardedInstId: subInst.id,
            _fromHand: true, _skipReactionCheck: true,
          });
        }
      }
    }
    engine.log('friendly_fireballer_perform', { player: ps.username });
    engine.sync();
    return true;
  },

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      // Passive tutor — board only.
      if (ctx.cardZone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardController ?? ctx.cardOwner;
      if (!isOwnSacrifice(ctx, pi)) return;
      // "except with this Creature's effect" — a sacrifice paid by a
      // Friendly Fireballer's own active effect doesn't refill a
      // Fireball (anti-loop). Other sources (Calamitusk, Pyre Grill
      // Master, another Chaorc) all qualify.
      if (ctx.source?.name === CARD_NAME) return;

      const ps = gs.players[pi];
      const sources = fireballSources(engine, pi);
      if (sources.length === 0) return;

      // Single prompt: the source options ARE the opt-in, the Cancel
      // button is the opt-out — no separate confirm. Only piles that
      // actually hold a "Fireball" are offered.
      const OPT = {
        deck: { id: 'deck', label: '📚 From deck' },
        discard: { id: 'discard', label: '♻️ From discard pile' },
      };
      const pick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: 'Openly add a "Fireball" to your hand from:',
        options: sources.map(s => OPT[s]),
        cancellable: true,
      });
      if (!pick || pick.cancelled || !pick.optionId) return;
      const from = pick.optionId;

      const pile = from === 'deck' ? ps.mainDeck : ps.discardPile;
      const idx = (pile || []).indexOf(FIREBALL);
      if (idx < 0) return;

      if (from === 'deck') {
        // Deck search reveal — the card flies in from the deck pile.
        pile.splice(idx, 1);
        ps.hand.push(FIREBALL);
        engine.shuffleDeck(pi);
        engine._broadcastEvent('deck_search_add', { cardName: FIREBALL, playerIdx: pi });
      } else {
        // From the DISCARD pile — fly the card in from there, not the
        // deck. Broadcast BEFORE the splice so the client pins the
        // flight's source rect to the discard pile and projects the
        // landing hand slot (Cybug fuel-recovery pattern).
        const toHandIdx = ps.hand.length;
        engine._broadcastEvent('play_pile_transfer', {
          owner: pi, cardName: FIREBALL,
          from: 'discard', to: 'hand',
          toHandIdx, finalHandSize: toHandIdx + 1,
        });
        pile.splice(idx, 1);
        ps.hand.push(FIREBALL);
      }
      engine.log('friendly_fireballer_tutor', { player: ps.username, from });
      engine.sync();
      await engine._delay(300);
    },
  },

  cpuMeta: {
    onDeathBenefit: 6,
    // Profits from your sacrifices — adds a "Fireball" to hand whenever
    // you sacrifice your own Creature — so the CPU should value
    // sacrifices happening more highly while it's on the board.
    chainSource: {
      isArmed: (engine, inst) => inst.zone === 'support',
      triggersOn: (engine, tributeInst, sourceInst) =>
        tributeInst.id !== sourceInst.id
        && (tributeInst.controller ?? tributeInst.owner) === (sourceInst.controller ?? sourceInst.owner),
      valuePerTrigger: 15,
    },
  },
};
