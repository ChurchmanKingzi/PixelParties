// ═══════════════════════════════════════════
//  CARD EFFECT: "Barker, the Monster Tamer"
//  Hero — At the start of your first turn,
//  you may choose a Lv 1 or lower Creature
//  from your hand or deck and place it into
//  one of this Hero's free Support Zones.
//  This is a "placement" (special summon).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

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
      const heroIdx = ctx.cardHeroIdx;

      // Load card database for creature data
      const allCards = require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8');
      const cardDB = {};
      JSON.parse(allCards).forEach(c => { cardDB[c.name] = c; });

      // Find all Lv <=1 Creatures in hand and deck
      const eligibleCards = [];
      for (const name of (ps.hand || [])) {
        const c = cardDB[name];
        if (c && c.cardType === 'Creature' && (c.level || 0) <= 1) {
          if (!eligibleCards.some(e => e.name === name && e.source === 'hand')) {
            eligibleCards.push({ name, source: 'hand' });
          }
        }
      }
      for (const name of (ps.mainDeck || [])) {
        const c = cardDB[name];
        if (c && c.cardType === 'Creature' && (c.level || 0) <= 1) {
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
        inst.counters.isPlacement = 1; // Flag: this was a special "placement", not a normal summon

        engine.log('placement', { card: cardName, by: 'Barker, the Monster Tamer', from: selected.source, heroIdx, zoneSlot: zone.slotIdx });

        // Emit summon effect for visual glow
        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: zone.slotIdx, cardName });

        // Fire on-summon hooks (creature's own onPlay effects)
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName, zone: 'support', heroIdx, zoneSlot: zone.slotIdx });
        await engine.runHooks('onCardEnterZone', { card: inst, toZone: 'support', toHeroIdx: heroIdx });

        engine.sync();
        break; // Done!
      }
    },
  },
};
