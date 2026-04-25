// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Shepherd"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  Once per turn, when a "Loyal" Creature you
//  control, except "Loyal Shepherd", is defeated
//  by an opponent's card or effect, you may
//  immediately search your deck for a "Loyal"
//  Creature with a different name and summon it
//  into the same Support Zone as an additional
//  Action. Negate that Creature's effects until
//  the beginning of your next turn.
//
//  Wiring: `onCreatureDeath` listener on the
//  Shepherd's support-zone instance. Filters the
//  dying creature against the card text's three
//  rules (own side, Loyal, not Shepherd, killed
//  by opponent). Per-Shepherd HOPT lets multiple
//  Shepherds each fire once per turn.
//
//  The "different name" constraint excludes both
//  the dying Loyal AND every Loyal already in
//  hand / on board would be allowed — we only
//  hard-exclude the dying creature's name per the
//  card text. (Multiple Loyal Shepherds in deck
//  for instance are still valid summons.)
// ═══════════════════════════════════════════

const { isLoyalCreature, getLoyalsInDeck } = require('./_loyal-shared');

const CARD_NAME = 'Loyal Shepherd';

module.exports = {
  activeIn: ['support'],

  // ── CPU evaluation hints ──────────────────────────────────────────
  // Shepherd is a "chain source" — when another own Loyal (not
  // Shepherd itself) dies to an opponent's effect during its
  // unfired-this-turn state, it tutors a different-name Loyal from
  // deck and summons it into the vacated slot (negated). The CPU
  // brain reads `cpuMeta.chainSource` generically — see Terrier for
  // the full pattern. Shepherd's `triggersOn` excludes Shepherd
  // itself per the card text's "except Loyal Shepherd". `isArmed`
  // checks the per-instance HOPT key.
  //
  // valuePerTrigger ≈ 25: the chain preserves the dead Loyal's slot
  // (replacement lands in the same position) AND tutors a fresh
  // Loyal from deck (some hand-equivalent value). The slot-
  // preservation isn't "free value" because we lost the previous
  // creature, but the tutor effect is a clean gain — split the
  // difference at ~25.
  cpuMeta: {
    chainSource: {
      isArmed(engine, inst) {
        const hoptKey = `loyal_shepherd_revive:${inst.id}`;
        return engine.gs.hoptUsed?.[hoptKey] !== engine.gs.turn;
      },
      triggersOn(engine, tributeInst /*, sourceInst */) {
        if (tributeInst.name === CARD_NAME) return false;
        return isLoyalCreature(tributeInst.name, engine);
      },
      valuePerTrigger: 25,
    },
  },

  hooks: {
    onCreatureDeath: async (ctx) => {
      const death = ctx.creature;
      if (!death) return;

      const engine = ctx._engine;
      const gs     = engine.gs;
      const pi     = ctx.cardOriginalOwner;
      const ps     = gs.players[pi];
      if (!ps) return;

      // ── Filter: must be OUR Loyal, not Shepherd itself ──
      if ((death.owner ?? death.originalOwner) !== pi) return;
      if (death.name === CARD_NAME) return;
      if (!isLoyalCreature(death.name, engine)) return;

      // Simultaneous-death gate: when a multi-target wipe (Forbidden
      // Zone, AoEs, etc.) takes Shepherd out alongside the Loyal that
      // just died, the engine processes the dying entries one at a
      // time — so the listener could fire on a sibling's death even
      // though Shepherd itself is doomed in the same batch. The
      // damage path pre-marks every lethal entry's instance with
      // `_dyingThisBatch` BEFORE applying any HP, so we can detect
      // "I'm also about to die" here and bail. Matches the user's
      // "they all die simultaneously" semantics.
      if (ctx.card.counters?._dyingThisBatch) return;

      // ── Filter: killed by an OPPONENT's card or effect ──
      // Shepherd does NOT trigger off your own sacrifices, your own
      // recoil damage, or self-damage from another Loyal.
      const src = ctx.source || {};
      const srcOwner = src.owner ?? src.controller;
      if (srcOwner == null || srcOwner === pi) return;

      // Per-Shepherd HOPT — instance-scoped so two Shepherds in play
      // each get a turn slot.
      const hoptKey = `loyal_shepherd_revive:${ctx.card.id}`;
      if (!engine.claimHOPT?.(hoptKey, pi)) return;

      // ── Eligibility: deck has a different-name Loyal ──
      const deckLoyals = getLoyalsInDeck(ps, engine, { exclude: death.name });
      if (deckLoyals.length === 0) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // ── Confirm prompt ──
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `${death.name} was defeated! Summon a different Loyal Creature from your deck into its slot?`,
        showCard: CARD_NAME,
        confirmLabel: '🐕 Replace!',
        cancelLabel: 'No',
        cancellable: true,
      });
      if (!confirmed) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // ── Pick the replacement ──
      const gallery = deckLoyals.map(l => ({
        name: l.name, source: 'deck', count: l.count,
      }));
      const picked = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: `Choose a different-named Loyal Creature from your deck.`,
        cancellable: true,
      });
      if (!picked || picked.cancelled || !picked.cardName) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }
      const replacementName = picked.cardName;
      if (!isLoyalCreature(replacementName, engine)) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }
      if (replacementName === death.name) {
        // "Different name" guard, defensive.
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // Verify deck still has it.
      const deckIdx = ps.mainDeck.indexOf(replacementName);
      if (deckIdx < 0) {
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // ── Place the replacement into the dead Creature's slot ──
      // The slot is empty already (engine cleared it before firing
      // ON_CREATURE_DEATH). Use the same hero+slot the dying Loyal
      // occupied. summonCreatureWithHooks fires the full lifecycle.
      ps.mainDeck.splice(deckIdx, 1);

      const placed = await engine.summonCreatureWithHooks(
        replacementName, pi, death.heroIdx, death.zoneSlot,
        { source: CARD_NAME },
      );
      if (!placed) {
        // Couldn't place — refund.
        ps.mainDeck.push(replacementName);
        engine.shuffleDeck(pi, 'main');
        if (gs.hoptUsed) delete gs.hoptUsed[hoptKey];
        return;
      }

      // Standard tutor reveal + shuffle.
      engine.shuffleDeck(pi, 'main');
      engine._broadcastEvent('deck_search_add', { cardName: replacementName, playerIdx: pi });

      // ── Negate the placed Creature's effects until our next turn ──
      // expiresAtTurn / expiresForPlayer convention: turn+2 if WE'RE
      // currently active (so it persists through opp's turn and lifts
      // at the start of OUR next turn), turn+1 if opp is active (so it
      // lifts when we become active for our next turn).
      const expiresAtTurn = gs.turn + (gs.activePlayer === pi ? 2 : 1);
      engine.actionNegateCreature(placed.inst, CARD_NAME, {
        expiresAtTurn,
        expiresForPlayer: pi,
      });

      // Reveal to opponent.
      await engine._delay(300);
      const oi = pi === 0 ? 1 : 0;
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: replacementName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });

      engine.log('loyal_shepherd_revive', {
        player: ps.username, fallen: death.name, replacement: replacementName,
        heroIdx: death.heroIdx, zoneSlot: death.zoneSlot,
      });
      engine.sync();
    },
  },
};
