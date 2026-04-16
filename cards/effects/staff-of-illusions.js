// ═══════════════════════════════════════════
//  CARD EFFECT: "Staff of Illusions"
//  Artifact (Normal, Cost 10 × creature level)
//
//  Choose a level 3 or lower Creature from
//  your deck or hand and place it into the
//  Support Zone of any Hero you control.
//  Cost = 10 × chosen Creature's level.
//  You cannot summon other Creatures this turn.
//
//  At the end of your opponent's next turn,
//  the Creature is shuffled back into your deck.
//
//  Visual: creature receives the light-blue
//  illusion filter (_illusionSummon counter)
//  identical to Xuanwu's revived creatures.
//
//  Return trigger: tracked via onTurnEnd hook
//  on this card instance while it is in the
//  discard zone (activeIn includes 'discard').
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME  = 'Staff of Illusions';
const COST_PER_LEVEL = 10;
const MAX_LEVEL  = 3;

/** Build deduplicated gallery entries for eligible deck + hand creatures. */
function buildCreatureGallery(ps, cardDB) {
  const entries = new Map(); // name → {name, source, level}

  for (const cn of (ps.mainDeck || [])) {
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level ?? 0) > MAX_LEVEL) continue;
    if (!entries.has(cn)) entries.set(cn, { name: cn, source: 'deck', level: cd.level ?? 0 });
  }
  for (const cn of (ps.hand || [])) {
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if ((cd.level ?? 0) > MAX_LEVEL) continue;
    if (!entries.has(cn)) entries.set(cn, { name: cn, source: 'hand', level: cd.level ?? 0 });
  }
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,
  deferBroadcast: true,
  activeIn: ['support', 'ability', 'hero', 'hand', 'discard'],

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    const cardDB = {}; // placeholder — real check below
    // Player needs at least 10 gold (level 1 minimum cost) and a free support zone
    if ((ps.gold || 0) < COST_PER_LEVEL) return false;
    const hasFreeZone = (ps.heroes || []).some((h, hi) =>
      h?.name && h.hp > 0 &&
      (ps.supportZones?.[hi] || []).some(slot => (slot || []).length === 0),
    );
    return hasFreeZone;
  },

  async resolve(engine, pi) {
    const gs  = engine.gs;
    const ps  = gs.players[pi];
    const cardDB = engine._getCardDB();

    // Reveal the card to the opponent now
    const oppIdx = pi === 0 ? 1 : 0;
    const oppSid = gs.players[oppIdx]?.socketId;
    if (oppSid) engine.io.to(oppSid).emit('card_reveal', { cardName: CARD_NAME });
    await engine._delay(100);

    // ── Step 1: pick a Creature from deck or hand ────────────────────────

    const gallery = buildCreatureGallery(ps, cardDB);
    if (gallery.length === 0) return { aborted: true };

    const creaturePick = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Choose a level ${MAX_LEVEL} or lower Creature (cost: 10 × its level).`,
      confirmLabel: '✨ Summon as Illusion!',
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!creaturePick || creaturePick.cancelled || !creaturePick.cardName) return { aborted: true };

    const chosenName = creaturePick.cardName;
    const chosenCd   = cardDB[chosenName];
    const level      = chosenCd?.level ?? 0;
    const goldCost   = level * COST_PER_LEVEL;

    // Verify the player can afford it
    if ((ps.gold || 0) < goldCost) return { aborted: true };

    // ── Step 2: pick a free support zone ────────────────────────────────

    const freeZones = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      for (let si = 0; si < 3; si++) {
        if ((ps.supportZones?.[hi]?.[si] || []).length === 0) {
          freeZones.push({ heroIdx: hi, slotIdx: si, label: `${h.name} — Slot ${si + 1}` });
        }
      }
    }
    if (freeZones.length === 0) return { aborted: true };

    let destHeroIdx, destSlot;
    if (freeZones.length === 1) {
      destHeroIdx = freeZones[0].heroIdx;
      destSlot    = freeZones[0].slotIdx;
    } else {
      const ctx   = engine._createContext(
        engine.cardInstances.find(c => c.owner === pi && c.name === CARD_NAME) || { owner: pi, heroIdx: -1, zoneSlot: -1, counters: {} },
        {},
      );
      const zonePick = await ctx.promptZonePick(freeZones, {
        title: CARD_NAME,
        description: `Choose where to place the illusion of ${chosenName}.`,
        confirmLabel: '📍 Place here',
        cancellable: false,
      });
      if (!zonePick) return { aborted: true };
      destHeroIdx = zonePick.heroIdx;
      destSlot    = zonePick.slotIdx;
    }

    // ── Step 3: remove from source, deduct gold, place ──────────────────

    // Remove from deck or hand
    const deckIdx = ps.mainDeck.indexOf(chosenName);
    if (deckIdx >= 0) {
      ps.mainDeck.splice(deckIdx, 1);
      engine.shuffleDeck(pi);
    } else {
      const handIdx = ps.hand.indexOf(chosenName);
      if (handIdx >= 0) ps.hand.splice(handIdx, 1);
    }

    // Deduct gold
    ps.gold = Math.max(0, (ps.gold || 0) - goldCost);

    // Place in support zone
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    ps.supportZones[destHeroIdx][destSlot] = [chosenName];

    const inst     = engine._trackCard(chosenName, pi, 'support', destHeroIdx, destSlot);
    inst.turnPlayed = gs.turn;

    // Light-blue illusion visual filter (same as Xuanwu revived creatures)
    inst.counters._illusionSummon = true;

    ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName,
    });
    await engine._delay(400);

    engine.log('staff_illusion_place', {
      player: ps.username, creature: chosenName, goldCost,
      hero: ps.heroes[destHeroIdx]?.name,
    });

    // Fire enter-zone hooks (Ingo, Maya, Layn, etc.)
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
    });

    // Lock summoning for the rest of the turn
    engine.lockSummons
      ? engine.lockSummons(pi)
      : (ps.summonLocked = true);

    // ── Step 4: tag this Staff instance to return the creature later ─────
    // Find this Staff's card instance (now in discard after resolution)
    // We'll store tracking on gs._staffIllusions for the onTurnEnd hook
    if (!gs._staffIllusions) gs._staffIllusions = [];
    gs._staffIllusions.push({
      instId:         inst.id,
      owner:          pi,
      opponent:       oppIdx,       // Return triggers at end of THEIR next turn
      creatureName:   chosenName,
      heroIdx:        destHeroIdx,
      slotIdx:        destSlot,
      oppTurnPending: true,         // Waiting for opponent's turn to start
    });

    engine.sync();
    return {};
  },

  hooks: {
    /**
     * Return-trigger: fires at the end of every turn.
     * The Staff instance may be in hand, discard, etc. — activeIn covers them.
     * We track illusions via gs._staffIllusions (not per-card-instance) to avoid
     * relying on a specific Staff instance surviving in a trackable zone.
     */
    onTurnEnd: async (ctx) => {
      const gs     = ctx._engine.gs;
      const engine = ctx._engine;

      if (!gs._staffIllusions || gs._staffIllusions.length === 0) return;

      const remaining = [];

      for (const entry of gs._staffIllusions) {
        // Mark that the opponent's turn has started
        if (entry.oppTurnPending && ctx.activePlayer === entry.opponent) {
          entry.oppTurnPending = false;
          remaining.push(entry);
          continue;
        }

        // Return condition: it's the end of the opponent's (non-pending) turn
        if (!entry.oppTurnPending && ctx.activePlayer === entry.opponent) {
          // Find the creature instance
          const inst = engine.cardInstances.find(c =>
            c.id === entry.instId && c.zone === 'support',
          );

          if (inst) {
            const ps = gs.players[entry.owner];

            // Fire onCardLeaveZone before removing
            await engine.runHooks('onCardLeaveZone', {
              card: inst, fromZone: 'support',
              fromHeroIdx: inst.heroIdx,
              fromZoneSlot: inst.zoneSlot,
              toZone: 'deck',
            });

            // Remove from support zone
            if (ps.supportZones?.[inst.heroIdx]?.[inst.zoneSlot]) {
              ps.supportZones[inst.heroIdx][inst.zoneSlot] = [];
            }

            // Return to deck and shuffle
            ps.mainDeck.push(entry.creatureName);
            engine.shuffleDeck(entry.owner);
            engine._untrackCard(inst.id);

            engine.log('staff_illusion_return', {
              player: ps.username, creature: entry.creatureName,
            });

            // Opponent draw on return (Create Illusion)
            if (entry.oppDrawCount > 0) {
              await engine.actionDrawCards(entry.opponent, entry.oppDrawCount, {});
              engine.log('illusion_opp_draw', {
                player: gs.players[entry.opponent]?.username,
                amount: entry.oppDrawCount,
              });
            }
          }
          // Don't push to remaining — entry is done
          continue;
        }

        remaining.push(entry);
      }

      gs._staffIllusions = remaining.length ? remaining : undefined;
      engine.sync();
    },
  },
};
