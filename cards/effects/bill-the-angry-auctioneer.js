// ═══════════════════════════════════════════
//  CARD EFFECT: "Bill, the Angry Auctioneer"
//  Hero — Before starting hands are drawn,
//  search deck for up to 2 Equipment Artifacts
//  with combined cost ≤ 20 and equip them to
//  other Heroes (not Bill). Each Hero gets at
//  most 1 Artifact from this effect.
//  Max equips = number of other living Heroes.
//  No gold cost.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const billHeroIdx = ctx.cardHeroIdx;

      // Find other (non-Bill) heroes
      const otherHeroes = [];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name) continue;
        if (hi === billHeroIdx) continue;
        otherHeroes.push({ heroIdx: hi, name: hero.name });
      }

      // No allies → effect doesn't fire
      if (otherHeroes.length === 0) return;

      const maxEquips = Math.min(2, otherHeroes.length);

      // Find eligible Equipment Artifacts in deck (cost ≤ 20)
      const cardDB = engine._getCardDB();
      const seen = new Set();
      const eligibleCards = [];
      for (const cardName of (ps.mainDeck || [])) {
        if (seen.has(cardName)) continue;
        const cd = cardDB[cardName];
        if (!cd || cd.cardType !== 'Artifact') continue;
        if ((cd.subtype || '').toLowerCase() !== 'equipment') continue;
        if ((cd.cost || 0) > 20) continue;
        seen.add(cardName);
        eligibleCards.push({ name: cardName, source: 'deck', cost: cd.cost || 0 });
      }

      // No eligible equips → effect doesn't fire
      if (eligibleCards.length === 0) return;

      // Signal opponent that Bill's effect is resolving
      gs.heroEffectPending = { ownerIdx: pi, heroName: 'Bill, the Angry Auctioneer' };
      engine.sync();

      try {
      // Confirm
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Bill, the Angry Auctioneer',
        message: 'Provide Equips to your other Heroes?',
      });
      if (!confirmed) { gs.heroEffectPending = null; engine.sync(); return; }

      // Multi-select gallery with budget constraint
      const selection = await ctx.promptCardGalleryMulti(eligibleCards, {
        title: 'Bill, the Angry Auctioneer',
        description: `Select up to ${maxEquips} Equipment Artifact${maxEquips > 1 ? 's' : ''} to equip.`,
        selectCount: maxEquips,
        minSelect: 1,
        maxBudget: 20,
        costKey: 'cost',
        confirmLabel: '⚒️ Equip!',
        confirmClass: 'btn-success',
        cancellable: true,
      });

      if (!selection || !selection.selectedCards || selection.selectedCards.length === 0) { gs.heroEffectPending = null; engine.sync(); return; }

      const selectedNames = selection.selectedCards;

      /**
       * Build targets: both hero cards AND their free support zones.
       * Excludes heroes already assigned an equip by this effect.
       */
      const buildTargets = (excludeHeroIndices = []) => {
        const targets = [];
        for (const h of otherHeroes) {
          if (excludeHeroIndices.includes(h.heroIdx)) continue;
          // Hero target
          targets.push({
            id: `hero-${pi}-${h.heroIdx}`, type: 'hero',
            owner: pi, heroIdx: h.heroIdx, cardName: h.name,
          });
          // Free support zone targets
          const supZones = ps.supportZones[h.heroIdx] || [[], [], []];
          for (let s = 0; s < 3; s++) {
            if ((supZones[s] || []).length === 0) {
              targets.push({
                id: `equip-${pi}-${h.heroIdx}-${s}`, type: 'equip',
                owner: pi, heroIdx: h.heroIdx, slotIdx: s, cardName: '',
              });
            }
          }
        }
        return targets;
      };

      /**
       * Parse a selected target into { heroIdx, slotIdx }.
       * Hero clicks → first free zone. Zone clicks → that zone.
       */
      const parseTarget = (targetId, targets) => {
        const target = targets.find(t => t.id === targetId);
        if (!target) return null;
        if (target.type === 'equip') return { heroIdx: target.heroIdx, slotIdx: target.slotIdx };
        // Hero click → find first free support zone
        const supZones = ps.supportZones[target.heroIdx] || [[], [], []];
        for (let s = 0; s < 3; s++) {
          if ((supZones[s] || []).length === 0) return { heroIdx: target.heroIdx, slotIdx: s };
        }
        return null;
      };

      // Assign equips to heroes
      const assignments = []; // [{ equipName, heroIdx, slotIdx }]

      if (selectedNames.length === 1) {
        // One equip — auto-assign if only 1 hero, else prompt
        if (otherHeroes.length === 1) {
          const parsed = parseTarget(`hero-${pi}-${otherHeroes[0].heroIdx}`, buildTargets());
          if (parsed) assignments.push({ equipName: selectedNames[0], ...parsed });
        } else {
          const targets = buildTargets();
          const picked = await ctx.promptTarget(targets, {
            title: 'Bill, the Angry Auctioneer',
            description: `Choose a Hero or Support Zone to equip «${selectedNames[0]}» to.`,
            confirmLabel: '⚒️ Equip!',
            confirmClass: 'btn-success',
            cancellable: false,
            maxPerType: { hero: 1, equip: 1 },
          });
          if (!picked || picked.length === 0) { gs.heroEffectPending = null; engine.sync(); return; }
          const parsed = parseTarget(picked[0], targets);
          if (parsed) assignments.push({ equipName: selectedNames[0], ...parsed });
        }
      } else {
        // Two equips — pick target for first, second auto-assigned to remaining hero
        const targets = buildTargets();
        const picked = await ctx.promptTarget(targets, {
          title: 'Bill, the Angry Auctioneer',
          description: `Choose a Hero or Support Zone to equip «${selectedNames[0]}» to.\n«${selectedNames[1]}» will go to the other Hero.`,
          confirmLabel: '⚒️ Equip!',
          confirmClass: 'btn-success',
          cancellable: false,
          maxPerType: { hero: 1, equip: 1 },
        });
        if (!picked || picked.length === 0) { gs.heroEffectPending = null; engine.sync(); return; }
        const firstParsed = parseTarget(picked[0], targets);
        if (firstParsed) {
          assignments.push({ equipName: selectedNames[0], ...firstParsed });
          // Auto-assign second to the other hero's first free zone
          const remaining = buildTargets([firstParsed.heroIdx]);
          const heroTarget = remaining.find(t => t.type === 'hero');
          if (heroTarget) {
            const secondParsed = parseTarget(heroTarget.id, remaining);
            if (secondParsed) assignments.push({ equipName: selectedNames[1], ...secondParsed });
          }
        }
      }

      // Execute assignments: remove from deck, place into support zones
      for (const { equipName, heroIdx, slotIdx } of assignments) {
        // Remove from deck
        const deckIdx = ps.mainDeck.indexOf(equipName);
        if (deckIdx < 0) continue;
        ps.mainDeck.splice(deckIdx, 1);

        const freeSlot = slotIdx;

        // Place equipment
        if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
        ps.supportZones[heroIdx][freeSlot] = [equipName];

        // Track card instance
        const inst = engine._trackCard(equipName, pi, 'support', heroIdx, freeSlot);

        // Emit summon effect
        engine._broadcastEvent('summon_effect', { owner: pi, heroIdx, zoneSlot: freeSlot, cardName: equipName });

        engine.log('bill_equip', { player: ps.username, equip: equipName, hero: ps.heroes[heroIdx]?.name, slot: freeSlot });

        // Fire placement hooks
        await engine.runHooks('onPlay', { _onlyCard: inst, playedCard: inst, cardName: equipName, zone: 'support', heroIdx, zoneSlot: freeSlot });
        await engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heroIdx });

        engine.sync();
        await engine._delay(400);
      }

      } finally {
        gs.heroEffectPending = null;
      }

      engine.sync();
    },
  },
};
