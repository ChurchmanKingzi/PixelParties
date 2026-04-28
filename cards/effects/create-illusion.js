// ═══════════════════════════════════════════
//  CARD EFFECT: "Create Illusion"
//  Spell (Magic Arts Lv1, Normal)
//  Counts as an additional Action (inherentAction).
//
//  Choose a level 1/2/3 or lower Creature from
//  your deck (max level = Magic Arts level) and
//  place it into a free Support Zone of the caster.
//  You cannot summon Creatures for the rest of
//  the turn afterwards.
//
//  At the end of your opponent's next turn,
//  the Creature is shuffled back into your deck,
//  and your opponent may immediately draw as many
//  cards as the Creature's level.
//
//  Return tracking reuses gs._staffIllusions with
//  oppDrawCount set to the creature's level.
//  Visual: same light-blue illusion filter
//  (_illusionSummon) as Staff of Illusions.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Create Illusion';

module.exports = {
  inherentAction: true,
  cpuMeta: { scalesWithSchool: 'Magic Arts' },

  /** Cannot play without an eligible deck creature and a free support zone. */
  spellPlayCondition(gs, playerIdx) {
    const ps = gs.players[playerIdx];
    if (!ps) return false;
    const cardDB = {}; // gs has no direct cardDB ref; check done in onPlay with real cardDB
    // Check for free support zone
    const hasFreeZone = (ps.heroes || []).some((h, hi) =>
      h?.name && h.hp > 0 &&
      (ps.supportZones?.[hi] || []).some(slot => (slot || []).length === 0),
    );
    return hasFreeZone;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine  = ctx._engine;
      const gs      = engine.gs;
      const pi      = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps      = gs.players[pi];
      const oppIdx  = pi === 0 ? 1 : 0;
      if (!ps) return;

      const cardDB = engine._getCardDB();

      // Max level = Magic Arts level on this hero
      const magicArtsLevel = engine.countAbilitiesForSchool(
        'Magic Arts', ps.abilityZones[heroIdx] || [],
      );
      const maxLevel = Math.max(1, Math.min(magicArtsLevel, 3));

      // Build deduplicated gallery from deck
      const seen = new Set();
      const galleryCards = [];
      for (const cn of (ps.mainDeck || [])) {
        if (seen.has(cn)) continue;
        const cd = cardDB[cn];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if ((cd.level ?? 0) > maxLevel) continue;
        seen.add(cn);
        galleryCards.push({ name: cn, source: 'deck' });
      }
      galleryCards.sort((a, b) => a.name.localeCompare(b.name));

      if (galleryCards.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      // ── Step 1: pick a Creature ──────────────────────────────────────

      const creaturePick = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: CARD_NAME,
        description: `Choose a level ${maxLevel} or lower Creature from your deck.`,
        confirmLabel: '✨ Create Illusion!',
        confirmClass: 'btn-info',
        cancellable: true,
      });

      if (!creaturePick || creaturePick.cancelled || !creaturePick.cardName) {
        gs._spellCancelled = true;
        return;
      }

      const chosenName = creaturePick.cardName;
      const chosenCd   = cardDB[chosenName];
      const level      = chosenCd?.level ?? 0;

      // ── Step 2: pick a free support zone ────────────────────────────

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

      if (freeZones.length === 0) {
        gs._spellCancelled = true;
        return;
      }

      let destHeroIdx, destSlot;
      if (freeZones.length === 1) {
        destHeroIdx = freeZones[0].heroIdx;
        destSlot    = freeZones[0].slotIdx;
      } else {
        const zonePick = await ctx.promptZonePick(freeZones, {
          title: CARD_NAME,
          description: `Choose where to place the illusion of ${chosenName}.`,
          cancellable: false,
        });
        if (!zonePick) { gs._spellCancelled = true; return; }
        destHeroIdx = zonePick.heroIdx;
        destSlot    = zonePick.slotIdx;
      }

      // ── Step 3: remove from deck, reveal, place ──────────────────────

      const deckIdx = ps.mainDeck.indexOf(chosenName);
      if (deckIdx < 0) { gs._spellCancelled = true; return; }
      ps.mainDeck.splice(deckIdx, 1);

      // Reveal to opponent
      await engine.revealSearchedCards(pi, [chosenName], CARD_NAME);
      engine.shuffleDeck(pi);

      if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
      ps.supportZones[destHeroIdx][destSlot] = [chosenName];

      const inst     = engine._trackCard(chosenName, pi, 'support', destHeroIdx, destSlot);
      inst.turnPlayed = gs.turn; // Summoning sickness

      // Light-blue illusion visual filter
      inst.counters._illusionSummon = true;

      ps._creaturesSummonedThisTurn = (ps._creaturesSummonedThisTurn || 0) + 1;

      engine._broadcastEvent('summon_effect', {
        owner: pi, heroIdx: destHeroIdx, zoneSlot: destSlot, cardName: chosenName,
      });
      await engine._delay(400);

      engine.log('create_illusion_place', {
        player: ps.username, creature: chosenName, level,
        hero: ps.heroes[destHeroIdx]?.name,
      });

      // Fire enter-zone hooks (Ingo, Maya, Layn, Summoning Circle, etc.)
      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
        _skipReactionCheck: true,
      });

      // Lock summoning for rest of turn
      ps.summonLocked = true;

      // ── Step 4: register return trigger (end of opponent's next turn) ──

      if (!gs._staffIllusions) gs._staffIllusions = [];
      gs._staffIllusions.push({
        instId:         inst.id,
        owner:          pi,
        opponent:       oppIdx,
        creatureName:   chosenName,
        heroIdx:        destHeroIdx,
        slotIdx:        destSlot,
        oppTurnPending: true,
        oppDrawCount:   level, // Create Illusion: opponent draws = creature's level
      });

      engine.sync();
    },
  },
};
