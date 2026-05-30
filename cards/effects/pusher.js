// ═══════════════════════════════════════════
//  CARD EFFECT: "Pusher"
//  Attack (Fighting, Lv1, Normal)
//
//  "Choose a Creature and deal damage equal to the user's Attack
//   stat to it. If this damage defeats the Creature, your opponent
//   must send all copies of that Creature from their deck and hand
//   to their discard pile."
//
//  ── Animation choreography ──────────────────────────────────────
//  Phoenix-Tackle-style: the casting Hero RAMS out of its Hero Zone
//  into the chosen Creature's Support Zone (`play_ram_animation`,
//  charge-and-return arc). On contact the Creature is punched and
//  then literally FLUNG off the top of the screen
//  (`play_pusher_fling`), hangs a beat, and PLOPS back down into its
//  Support Zone — landing roughly when the Hero is already past
//  halfway back to its Hero Zone. ATK damage is applied as the
//  Creature lands (so a survivor is back in place / a defeated one
//  then dies → discard, and its copies are swept).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Pusher';
const RAM_DUR    = 1200; // Hero charge-and-return round trip.
const REACH_MS   = 170;  // Hero reaches the Creature (~14% of RAM_DUR).
const FLING_DUR  = 720;  // Creature launch → hold → plop back.

/** Is there any Creature on the board to target? */
function anyCreatureOnBoard(engine) {
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js.

  spellPlayCondition: (gs, pi, engine) => {
    if (!engine) return true; // optimistic without engine
    return anyCreatureOnBoard(engine);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) { gs._spellCancelled = true; return; }

      const atk = hero.atk || 0;

      // ── Choose a Creature (either side) ──
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        description: `Deal ${atk} damage to a Creature.`,
        confirmLabel: `👊 Push! (${atk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target || target.type !== 'equip') { gs._spellCancelled = true; return; }

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtSlot = target.slotIdx;
      const name = target.cardName;
      const inst = target.cardInstance || engine.cardInstances.find(c =>
        c.owner === tgtOwner && c.zone === 'support'
        && c.heroIdx === tgtHeroIdx && c.zoneSlot === tgtSlot
      );

      // Pre-resolution hook (Doq's guess, future "when this Hero
      // attacks" effects) fires AFTER target pick but BEFORE the
      // animation + damage. Listeners may mutate the about-to-deal
      // damage.
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi, usesHeroAtk: true };
      const finalDmg = await engine._fireAttackDeclare(attackSource, target, atk);

      // ── Hero rams into the Creature (charge + return arc) ──
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtSlot,
        cardName: hero.name, duration: RAM_DUR,
      });
      await engine._delay(REACH_MS); // Hero arrives at the Creature

      // Contact: punch impact, then the Creature is flung off-screen.
      engine._broadcastEvent('punch_impact', {
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      engine._broadcastEvent('play_pusher_fling', {
        owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
        cardName: name, duration: FLING_DUR,
      });
      // Let the Creature finish its launch → hold → plop-back while
      // the Hero is on its way home (lands ~70% into the Hero's
      // return — i.e. "already half returned").
      await engine._delay(FLING_DUR);

      // ── Damage resolves as the Creature lands ──
      if (inst) {
        await engine.actionDealCreatureDamage(
          attackSource, inst, finalDmg, 'attack',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();

      // "If this damage defeats the Creature" — gone from its Support
      // Zone or at ≤0 HP (Cute Angel Molinda's currentHp<=0 read).
      const defeated = !inst
        || inst.zone !== 'support'
        || (inst.counters?.currentHp ?? 1) <= 0;
      if (!defeated) { engine.sync(); return; }

      const oppIdx = pi === 0 ? 1 : 0;          // "your opponent"
      const oppPs = gs.players[oppIdx];
      if (!oppPs || !name) { engine.sync(); return; }

      let sent = 0;

      // ── Hand copies → discard (zone-anchored flight before the
      //    splice + the hook-firing discard helper). ──
      let guard = 0;
      while (guard++ < 40) {
        const idx = (oppPs.hand || []).indexOf(name);
        if (idx < 0) break;
        engine._broadcastEvent('play_pile_transfer', {
          owner: oppIdx, cardName: name,
          from: 'hand', to: 'discard', fromHandIdx: idx,
        });
        await engine.actionDiscardHandCard(oppIdx, name, idx, { source: CARD_NAME });
        sent++;
        if ((oppPs.hand || []).indexOf(name) >= 0) await engine._delay(160);
      }

      // ── Deck copies → discard (splice all + one batched
      //    deck_to_discard_animation; deck cards aren't tracked
      //    instances — soul-shard-ren pattern). ──
      const deckHits = [];
      for (let i = (oppPs.mainDeck || []).length - 1; i >= 0; i--) {
        if (oppPs.mainDeck[i] === name) { oppPs.mainDeck.splice(i, 1); deckHits.push(name); }
      }
      if (deckHits.length > 0) {
        for (const n of deckHits) oppPs.discardPile.push(n);
        engine._broadcastEvent('deck_to_discard_animation', {
          owner: oppIdx, cardNames: deckHits.slice(), source: CARD_NAME,
        });
        sent += deckHits.length;
      }

      engine.log('pusher', {
        player: gs.players[pi]?.username,
        creature: name, defeated: true, copiesSent: sent,
      });
      engine.sync();
    },
  },
};
