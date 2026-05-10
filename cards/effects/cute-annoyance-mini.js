// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Annoyance Mini"
//  Hero — HP 350, ATK 30 (Cute archetype)
//  Starting abilities: Charme + Summoning Magic.
//
//  Active hero effect (HOPT):
//    Discard 1 card. Search your deck for a "Cute"
//    Creature, reveal it, and add it to your hand.
//    You MAY then discard 1 ADDITIONAL card to
//    immediately summon that Creature as an
//    additional Action with this Hero.
//
//  Implementation:
//   • `canActivateHeroEffect` — at least 1 card
//     in hand (cost), not hand-locked, deck has
//     at least one "Cute" Creature.
//   • `onHeroEffect` flow:
//       1. Pay 1 discard via the standard
//          `actionPromptForceDiscard` (self-
//          inflicted; player picks).
//       2. Build gallery of unique "Cute"
//          Creatures still in deck. Player
//          picks one.
//       3. Splice from deck → push to hand.
//          Reveal to opponent via the canonical
//          `deck_search_add` + `deckSearchReveal`
//          modal pair.
//       4. Optional rider: confirm "discard 1
//          more to summon now". On yes, pay a
//          second discard, then summon onto
//          Mini's slot via
//          `summonCreatureWithHooks` with
//          `_summonedAsAdditional: true`.
//          Action-economy consumption is NOT
//          done here — the summon is the rider's
//          point, NOT Mini's main Action.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Cute Annoyance Mini';
const CUTE_ARCHETYPE = 'Cute';

/**
 * Enumerate unique Cute Creature names still in the player's main
 * deck. Returns `[{ name, count }]` deduped by name so the gallery
 * shows each option once with a stack count badge.
 */
function getCuteCreaturesInDeck(engine, ps) {
  if (!ps?.mainDeck?.length) return [];
  const cardDB = engine._getCardDB();
  const counts = {};
  for (const name of ps.mainDeck) counts[name] = (counts[name] || 0) + 1;
  const out = [];
  for (const [name, count] of Object.entries(counts)) {
    const cd = cardDB[name];
    if (!cd) continue;
    if (cd.archetype !== CUTE_ARCHETYPE) continue;
    if (!hasCardType(cd, 'Creature')) continue;
    out.push({ name, count });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Eligible (heroIdx, slotIdx) pairs on Mini's support zones for the
 * post-tutor summon. Only Mini's slots — the rider summons "with
 * this Hero" per card text. Returns empty when Mini's zones are
 * full or summoning is locked.
 */
function eligibleSummonSlots(engine, pi, miniHeroIdx, creatureCd) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  if (ps.summonLocked) return [];
  const hero = ps.heroes?.[miniHeroIdx];
  if (!hero?.name || hero.hp <= 0) return [];
  // Mini herself must still meet the level req for the chosen
  // creature (the summon is "with this Hero", so Mini is the host).
  if (!engine.heroMeetsLevelReq(pi, miniHeroIdx, creatureCd)) return [];
  const zones = ps.supportZones?.[miniHeroIdx] || [[], [], []];
  const out = [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) {
      out.push({ heroIdx: miniHeroIdx, slotIdx: z });
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // Rough threat — averages ~1 tutor per turn; the rider summon is
  // archetype-dependent and accounted for separately by MCTS.
  supportYield() {
    return { drawsPerTurn: 0 };
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;       // tutor adds to hand → locked is wasteful
    if ((ps.hand?.length || 0) < 1) return false; // cost requires ≥1 discard
    return getCuteCreaturesInDeck(engine, ps).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const miniHeroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];
    if (!ps) return false;

    // ── Step 1: pay the tutor discard ──
    const handBefore = ps.hand.length;
    await engine.actionPromptForceDiscard(pi, 1, {
      title: CARD_NAME,
      source: CARD_NAME,
      selfInflicted: true,
    });
    if (ps.hand.length >= handBefore) {
      // Defensive — discard didn't actually shrink the hand. Fizzle
      // without tutoring (we don't want a free search if a hook
      // intercepted the discard).
      return false;
    }

    // ── Step 2: gallery of Cute Creatures still in deck ──
    const candidates = getCuteCreaturesInDeck(engine, ps);
    if (candidates.length === 0) return false;
    const gallery = candidates.map(c => ({
      name: c.name, source: 'deck', count: c.count,
    }));
    const pick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Pick a "Cute" Creature from your deck to add to your hand.',
      cancellable: false, // discard already paid — must commit to a pick
    });
    const chosenName = pick?.cardName;
    if (!chosenName) return false;
    const cardDB = engine._getCardDB();
    const chosenCd = cardDB[chosenName];
    if (!chosenCd) return false;
    const deckIdx = ps.mainDeck.indexOf(chosenName);
    if (deckIdx < 0) return false;

    // ── Step 3: splice from deck → push to hand, reveal ──
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(chosenName);
    const newInst = engine._trackCard(chosenName, pi, 'hand');
    engine.shuffleDeck?.(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
    engine.log('mini_tutor', { player: ps.username, card: chosenName });
    engine.sync();

    // Opponent reveal modal (standard tutor disclosure).
    const oi = pi === 0 ? 1 : 0;
    await engine._delay(300);
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    // ── Step 4: optional rider — discard 1 more → summon now ──
    // Skip the prompt entirely if the rider can't actually fire:
    //   • hand has < 1 card to spend (the just-tutored card is the
    //     only one in hand and that IS the summon target — picking
    //     the same card to discard would defeat the rider).
    //   • Mini has no free Support Zone for the summon.
    const hostSlots = eligibleSummonSlots(engine, pi, miniHeroIdx, chosenCd);
    // Hand cards available to spend on the second discard: every
    // hand card EXCEPT the just-tutored copy at the trailing slot.
    const tutoredHandIdx = ps.hand.length - 1;
    const spendable = (ps.hand || []).reduce((acc, _, i) => {
      if (i === tutoredHandIdx) return acc;
      return acc + 1;
    }, 0);
    if (spendable < 1 || hostSlots.length === 0) {
      engine.sync();
      return true;
    }

    const wantsRider = await engine.promptGeneric(pi, {
      type: 'confirm',
      title: CARD_NAME,
      message: `Discard 1 more card to immediately summon ${chosenName} on ${ps.heroes[miniHeroIdx]?.name || 'this Hero'} as an additional Action?`,
      showCard: chosenName,
      confirmLabel: '✨ Summon now!',
      cancelLabel: 'No',
      cancellable: true,
    });
    if (!wantsRider) {
      engine.sync();
      return true;
    }

    // Pay the second discard. Restrict eligible indices so the
    // just-tutored card itself can't be picked (otherwise the rider
    // would discard the very Creature it's supposed to summon).
    const eligible = (ps.hand || []).map((_, i) => i).filter(i => i !== tutoredHandIdx);
    const handBefore2 = ps.hand.length;
    const result = await engine.promptGeneric(pi, {
      type: 'forceDiscard',
      title: CARD_NAME,
      description: 'Discard 1 card to pay for the additional Summon.',
      instruction: 'Click a card in your hand to discard it.',
      eligibleIndices: eligible,
      cancellable: false,
    });
    if (!result?.cardName) {
      engine.sync();
      return true;
    }
    const ok = await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, {
      source: CARD_NAME,
    });
    if (!ok || ps.hand.length >= handBefore2) {
      engine.sync();
      return true;
    }

    // Find the just-tutored card's CURRENT hand index (the second
    // discard may have shifted it).
    const summonHandIdx = ps.hand.indexOf(chosenName);
    if (summonHandIdx < 0) {
      engine.sync();
      return true;
    }
    // Splice the tutored card out of hand for the summon.
    ps.hand.splice(summonHandIdx, 1);
    if (newInst) engine._untrackCard(newInst.id);

    // Pick the slot — auto-resolve when only one is free; otherwise
    // prompt zonePick.
    let slot;
    if (hostSlots.length === 1) {
      slot = hostSlots[0];
    } else {
      const zones = hostSlots.map(h => ({
        heroIdx: h.heroIdx, slotIdx: h.slotIdx,
        label: `Support ${h.slotIdx + 1}`,
      }));
      const zp = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones,
        title: CARD_NAME,
        description: `Place ${chosenName} into which Support Zone?`,
        cancellable: false,
      });
      slot = hostSlots.find(h => h.heroIdx === zp?.heroIdx && h.slotIdx === zp?.slotIdx) || hostSlots[0];
    }

    const placed = await engine.summonCreatureWithHooks(
      chosenName, pi, slot.heroIdx, slot.slotIdx,
      {
        source: CARD_NAME,
        hookExtras: {
          _summonedBy: CARD_NAME,
          _summonedAsAdditional: true,
        },
      },
    );
    if (!placed) {
      // Roll back hand if summon failed.
      ps.hand.splice(summonHandIdx, 0, chosenName);
      engine._trackCard(chosenName, pi, 'hand');
      engine.sync();
      return true;
    }

    // Mini-summon flair — purple hearts pop around the just-placed
    // Creature. Routed through the standard `play_zone_animation`
    // dispatcher so it anchors to the support slot's bounding rect.
    engine._broadcastEvent('play_zone_animation', {
      type: 'mini_hearts',
      owner: pi,
      heroIdx: slot.heroIdx,
      zoneSlot: placed.actualSlot,
    });
    await engine._delay(150);

    // Mark the additional-action use for any listeners that key
    // off "an additional Action was taken this turn".
    await engine.runHooks('onActionUsed', {
      actionType: 'creature', source: CARD_NAME, playerIdx: pi,
      cardName: chosenName, heroIdx: slot.heroIdx,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onAdditionalActionUsed', {
      actionType: 'creature', source: CARD_NAME, playerIdx: pi,
      cardName: chosenName, heroIdx: slot.heroIdx,
      _skipReactionCheck: true,
    });

    engine.log('mini_summon_rider', {
      player: ps.username, summoned: chosenName,
      heroIdx: slot.heroIdx, zoneSlot: slot.slotIdx,
    });
    engine.sync();
    return true;
  },
};
