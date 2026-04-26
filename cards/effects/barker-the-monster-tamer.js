// ═══════════════════════════════════════════
//  CARD EFFECT: "Barker, the Monster Tamer"
//  Hero — At the start of your first turn,
//  you may choose a Lv 1 or lower Creature
//  from your hand or deck and place it into
//  one of this Hero's free Support Zones.
//  This is a "placement" (special summon).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  // CPU valuation hook. Once Barker's free turn-1 Lv ≤ 1 summon has
  // fired, his on-the-board contribution is done — the abilities he
  // hosts still count, but Barker himself drops to a low-priority
  // target. The `barkerUsed` counter is set on Barker's hero-zone
  // card instance the moment the summon fires (or fizzles).
  cpuMeta: {
    oneShotEffectSpent: (_engine, _pi, _hi, _hero, heroInst) =>
      !!heroInst?.counters?.barkerUsed,
  },

  // CPU prompt override. Barker's on-play card-gallery lists every Lv ≤ 1
  // Creature in hand + deck. The CPU should prefer Lv 1 over Lv 0; ties
  // broken at random. We also accept the initial confirm and the
  // zone-picker as their defaults (confirm → yes, zonePick → random).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData.type !== 'cardGallery') return undefined;
    const cards = promptData.cards || [];
    if (!cards.length) return undefined;
    const cardDB = engine._getCardDB();
    // Partition by card level.
    let bestLevel = -Infinity;
    for (const c of cards) {
      const cd = cardDB[c.name];
      const lvl = cd?.level || 0;
      if (lvl > bestLevel) bestLevel = lvl;
    }
    const top = cards.filter(c => (cardDB[c.name]?.level || 0) === bestLevel);
    const pick = top[Math.floor(Math.random() * top.length)];
    return { cardName: pick.name, source: pick.source };
  },

  hooks: {
    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      // Only fire once — first turn ever
      if (ctx.card.counters.barkerUsed) return;
      ctx.card.counters.barkerUsed = 1;

      const engine = ctx._engine;
      const gs = ctx.players;
      const pi = ctx.cardOwner;
      const ps = gs[pi];

      // Can't summon if summon-locked
      if (ps.summonLocked) return;
      const heroIdx = ctx.cardHeroIdx;

      // Load card database for creature data
      const allCards = require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8');
      const cardDB = {};
      JSON.parse(allCards).forEach(c => { cardDB[c.name] = c; });

      // Find all Lv <=1 Creatures in hand and deck
      const eligibleCards = [];
      for (const name of (ps.hand || [])) {
        const c = cardDB[name];
        if (c && hasCardType(c, 'Creature') && (c.level || 0) <= 1) {
          if (!eligibleCards.some(e => e.name === name && e.source === 'hand')) {
            eligibleCards.push({ name, source: 'hand' });
          }
        }
      }
      for (const name of (ps.mainDeck || [])) {
        const c = cardDB[name];
        if (c && hasCardType(c, 'Creature') && (c.level || 0) <= 1) {
          if (!eligibleCards.some(e => e.name === name && e.source === 'deck')) {
            eligibleCards.push({ name, source: 'deck' });
          }
        }
      }

      // Fizzle if no eligible creatures
      if (eligibleCards.length === 0) return;

      // Find free support zones on this hero
      const getFreeZones = () => {
        const zones = [];
        const supZones = ps.supportZones[heroIdx] || [];
        for (let s = 0; s < 3; s++) { // Only base zones (not islands)
          if ((supZones[s] || []).length === 0) {
            zones.push({ heroIdx, slotIdx: s, label: `Support ${s + 1}` });
          }
        }
        return zones;
      };

      // Fizzle if no free zones
      if (getFreeZones().length === 0) return;

      // Step 1: Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Barker, the Monster Tamer',
        message: 'Summon a Lv 1 or lower Creature from your hand or deck?',
      });
      if (!confirmed) return;

      // Step 2 + 3: Pick creature → pick zone (with back navigation)
      while (true) {
        // Step 2: Pick a creature
        const selected = await ctx.promptCardGallery(eligibleCards, {
          title: 'Barker, the Monster Tamer',
          description: 'Select a Creature to place.',
          cancellable: true,
        });
        if (!selected) return; // Escape = abort entire effect

        // Step 3: Pick a zone
        const freeZones = getFreeZones();
        if (freeZones.length === 0) return; // Safety check

        const zone = await ctx.promptZonePick(freeZones, {
          title: 'Barker, the Monster Tamer',
          description: `Place ${selected.cardName} into a Support Zone.`,
          cancellable: true,
        });
        if (!zone) continue; // Escape = back to creature picker

        // Execute: remove from source, place into support zone
        const cardName = selected.cardName;
        if (selected.source === 'hand') {
          const idx = ps.hand.indexOf(cardName);
          if (idx >= 0) ps.hand.splice(idx, 1);
        } else {
          const idx = ps.mainDeck.indexOf(cardName);
          if (idx >= 0) ps.mainDeck.splice(idx, 1);
        }

        // Place into support zone
        if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
        ps.supportZones[heroIdx][zone.slotIdx] = [cardName];

        // Track card instance in engine with placement flag
        const inst = engine._trackCard(cardName, pi, 'support', heroIdx, zone.slotIdx);
        inst.counters.isPlacement = 1;

        engine.log('placement', { card: cardName, by: 'Barker, the Monster Tamer', from: selected.source, heroIdx, zoneSlot: zone.slotIdx });

        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: zone.slotIdx, cardName });

        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: zone.slotIdx });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });

        engine.sync();
        break;
      }
    },
  },
};
