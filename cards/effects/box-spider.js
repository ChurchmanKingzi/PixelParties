// ═══════════════════════════════════════════
//  CARD EFFECT: "Box Spider"
//  Creature (Summoning Magic Lv1, Normal) — 50 HP
//
//  "You may send 3 Surprises you control to the discard pile to summon
//   this Creature as an additional Action. At the end of each of your
//   turns, if the corresponding Hero has no Surprise in its Surprise
//   Zone, you may search your deck for a Surprise and place it
//   face-down into its Surprise Zone without showing it to your
//   opponent."
//
//  Mechanics
//  ─────────
//   • Summon-cost path via shared `makeSurpriseCostSummon(3)` mixin.
//   • End-of-own-turn tutor (`onTurnEnd` while active player == owner):
//       – Skip if host Hero's Surprise Zone already has a Surprise.
//       – Skip if host Hero is dead.
//       – Build a private gallery of Surprise card names in the deck
//         (per-name copy count). The cardGallery prompt is delivered
//         only to the owner — opp never sees the choices.
//       – On confirm, splice the chosen copy from the deck, shuffle,
//         track a face-down inst in the Hero's Surprise Zone, fire
//         the standard `onCardEnterZone` hook.
//       – Skip the `deckSearchReveal` modal so opp learns NOTHING
//         (per "without showing it to your opponent").
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { makeSurpriseCostSummon } = require('./_spider-shared');

const CARD_NAME = 'Box Spider';
const SURPRISE_COST = 3;

module.exports = {
  activeIn: ['support'],

  ...makeSurpriseCostSummon(SURPRISE_COST, CARD_NAME),

  hooks: {
    onTurnEnd: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const owner = inst.controller ?? inst.owner;
      // Only fires on Box Spider's controller's own End Phase.
      if (gs.activePlayer !== owner) return;

      const ps = gs.players[owner];
      if (!ps) return;
      const heroIdx = inst.heroIdx;
      const hero = ps.heroes?.[heroIdx];
      // Host Hero must be alive (a dead Hero has no Surprise Zone).
      if (!hero?.name || hero.hp <= 0) return;
      // Surprise Zone must be empty.
      if ((ps.surpriseZones?.[heroIdx] || []).length > 0) return;
      // Box Spider must still be alive on the board.
      const cardDB = engine._getCardDB();
      const hp = inst.counters?.currentHp ?? cardDB[CARD_NAME]?.hp ?? 0;
      if (hp <= 0) return;

      // Build the unique Surprise gallery from the deck. We accept any
      // Surprise subtype (Spell or Creature) — Box Spider doesn't
      // restrict by card type beyond "Surprise".
      const surpriseCounts = new Map();
      for (const name of (ps.mainDeck || [])) {
        const cd = cardDB[name];
        if (!cd) continue;
        if ((cd.subtype || '').toLowerCase() !== 'surprise') continue;
        surpriseCounts.set(name, (surpriseCounts.get(name) || 0) + 1);
      }
      if (surpriseCounts.size === 0) return;
      const gallery = [...surpriseCounts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      // Private prompt to the owner — opp doesn't see the gallery.
      const result = await engine.promptGeneric(owner, {
        type: 'cardGallery',
        cards: gallery,
        title: CARD_NAME,
        description: `Search your deck for a Surprise and place it face-down on ${hero.name} without revealing it.`,
        cancellable: true,
        confirmLabel: '🕷️ Set Surprise',
      });
      if (!result || result.cancelled || !result.cardName) return;
      const chosenName = result.cardName;
      if (!surpriseCounts.has(chosenName)) return;

      // Splice from deck, shuffle, place face-down in Surprise Zone.
      const deckIdx = ps.mainDeck.indexOf(chosenName);
      if (deckIdx < 0) return;
      ps.mainDeck.splice(deckIdx, 1);

      ps.surpriseZones[heroIdx] = [chosenName];
      const surpriseInst = engine._trackCard(chosenName, owner, 'surprise', heroIdx, 0);
      surpriseInst.faceDown = true;

      // Per-player deck → Surprise Zone flight. The owner's client
      // gets the real card image (they just searched for it); the
      // opponent + spectators see a cardback (per "without showing
      // it to your opponent"). `_broadcastEvent` would send the same
      // payload to both sides, so we emit twice with different
      // `faceDown` flags. Pre-sync flight so the Surprise Zone is
      // still empty when the flying card leaves the deck — the
      // engine.sync() after the hook fires lands the card visibly.
      const ownerSid = gs.players[owner]?.socketId;
      const oppSid = gs.players[1 - owner]?.socketId;
      const basePayload = {
        owner, cardName: chosenName,
        from: 'deck', to: 'surprise',
        toHeroIdx: heroIdx,
      };
      if (ownerSid) engine.io.to(ownerSid).emit('play_pile_transfer', basePayload);
      if (oppSid) engine.io.to(oppSid).emit('play_pile_transfer', { ...basePayload, faceDown: true });
      if (engine.room?.spectators) {
        for (const spec of engine.room.spectators) {
          if (spec.socketId) engine.io.to(spec.socketId).emit('play_pile_transfer', { ...basePayload, faceDown: true });
        }
      }
      // Hold here so the flight animation lands (~700ms) BEFORE we
      // sync the new Surprise Zone state. Without this the diff
      // animator would also try to render the new surprise card
      // appearing in the zone, and the player would see both the
      // tutor flight + a zone-pop simultaneously.
      await engine._delay(720);

      // Shuffle the deck (post-search ritual). Do NOT call
      // `deckSearchReveal` on the opponent — the card text explicitly
      // says "without showing it to your opponent".
      engine.shuffleDeck(owner, 'main');

      // Fire onCardEnterZone for downstream listeners (some Surprise
      // / Spider passives might react to a Surprise being SET, even
      // though it stays face-down).
      try {
        await engine.runHooks('onCardEnterZone', {
          enteringCard: surpriseInst, toZone: 'surprise', toHeroIdx: heroIdx,
          _skipReactionCheck: true,
        });
      } catch (err) {
        console.error('[Box Spider] onCardEnterZone hook error:', err.message);
      }

      engine.log('box_spider_tutor', {
        player: ps.username, hero: hero.name,
        // Don't log the card name to the action log — preserves the
        // "without showing it to your opponent" privacy guarantee.
        // The activating player's own client will see it via the
        // surprise zone state sync (their `surpriseKnown` flag).
      });
      engine.sync();
    },
  },
};
