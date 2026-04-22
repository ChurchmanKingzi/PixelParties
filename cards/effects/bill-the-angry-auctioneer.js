// ═══════════════════════════════════════════
//  CARD EFFECT: "Bill, the Angry Auctioneer"
//  Hero — Before starting hands are drawn,
//  search deck for up to 2 different Equipment
//  Artifacts with combined cost ≤ 20 and equip
//  them to other Heroes (not Bill). Each Hero
//  gets at most 1 Artifact from this effect.
//  Max equips = number of other living Heroes.
//  No gold cost.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  // CPU response override for Bill's prompts.
  //
  // cardGalleryMulti (equip selection) — greedy max-value fill: pick the
  // most expensive equips that fit within the 20-gold budget, up to
  // selectCount cards. Because we return the sorted-by-cost selection,
  // selectedCards[0] is the MOST expensive.
  //
  // target (hero/zone pick) — Bill's placement prompt: route the first
  // equip (the expensive one) to the HIGHER-ATK eligible hero. For single-
  // equip prompts this means the expensive equip lands on the stronger
  // hero; for two-equip prompts, the handler auto-assigns the second
  // (cheaper) equip to the remaining hero.
  cpuResponse(engine, kind, promptData) {
    if (kind === 'generic' && promptData.type === 'cardGalleryMulti') {
      const cards = promptData.cards || [];
      if (!cards.length) return { selectedCards: [] };
      const budget = promptData.maxBudget != null ? promptData.maxBudget : 20;
      const maxCount = promptData.selectCount || 2;
      const sorted = [...cards].sort((a, b) => (b.cost || 0) - (a.cost || 0));
      const chosen = [];
      let spent = 0;
      for (const c of sorted) {
        if (chosen.length >= maxCount) break;
        const cost = c.cost || 0;
        if (spent + cost > budget) continue;
        chosen.push(c.name);
        spent += cost;
      }
      if (chosen.length === 0 && sorted.length) chosen.push(sorted[sorted.length - 1].name);
      return { selectedCards: chosen };
    }

    if (kind === 'target') {
      const { validTargets } = promptData;
      if (!Array.isArray(validTargets) || validTargets.length === 0) return undefined;
      // Bill's target list is a mix of 'hero' entries and 'equip' entries
      // (the hero's free Support Zone slots). Picking a hero-type target
      // lets Bill's parseTarget use its first free zone — which is the
      // behaviour we want (dropping on the hero card itself).
      const gs = engine.gs;
      const heroes = validTargets.filter(t => t.type === 'hero');
      const candidates = heroes.length ? heroes : validTargets;
      let bestAtk = -Infinity;
      let pickedId = null;
      for (const t of candidates) {
        const ps = gs.players[t.owner];
        const h = ps?.heroes?.[t.heroIdx];
        const atk = h?.atk || 0;
        if (atk > bestAtk) { bestAtk = atk; pickedId = t.id; }
      }
      return pickedId ? [pickedId] : undefined;
    }
    return undefined;
  },

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
        if (!cd || !hasCardType(cd, 'Artifact')) continue;
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
      const confirmed = await ctx.promptConfirmEffect({
        title: 'Bill, the Angry Auctioneer',
        message: 'Provide Equips to your other Heroes?',
      });
      if (!confirmed) { gs.heroEffectPending = null; engine.sync(); return; }

      const selection = await ctx.promptCardGalleryMulti(eligibleCards, {
        title: 'Bill, the Angry Auctioneer',
        description: `Select up to ${maxEquips} different Equipment Artifact${maxEquips > 1 ? 's' : ''} to equip.`,
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
